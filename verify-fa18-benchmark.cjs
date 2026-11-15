'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const noop = () => {};
const mockCtx = {
  fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, font: '', textAlign: 'left',
  textBaseline: 'alphabetic', globalAlpha: 1,
  fillRect: noop, clearRect: noop, strokeRect: noop, rect: noop, beginPath: noop, closePath: noop,
  moveTo: noop, lineTo: noop, arc: noop, ellipse: noop, roundRect: noop, bezierCurveTo: noop,
  quadraticCurveTo: noop, fill: noop, stroke: noop, fillText: noop, strokeText: noop,
  save: noop, restore: noop, translate: noop, rotate: noop, scale: noop, clip: noop,
  setLineDash: noop,
  createLinearGradient: () => ({ addColorStop: noop }),
  createRadialGradient: () => ({ addColorStop: noop })
};
const sandbox = {
  console, Math, Date, JSON, Set, Map, Int16Array, Uint8Array, Float32Array, Uint16Array, Uint32Array,
  crypto: require('node:crypto'),
  atob: (s) => Buffer.from(s, 'base64').toString('binary'),
  module: { exports: {} },
  window: null,
  localStorage: { getItem: () => null, setItem: noop },
  document: {
    getElementById: () => null,
    createElement: (tag) => tag === 'canvas' ? { width: 512, height: 512, getContext: () => mockCtx } : {}
  },
  clamp: (v, lo, hi) => Math.max(lo, Math.min(hi, v))
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

const load = (file) => vm.runInContext(fs.readFileSync('dist/' + file, 'utf8'), sandbox, { filename: file });
load('three.js');
for (const file of [
  'elevation.js', 'physics.js', 'regional-elevation.js', 'kinmen-elevation.js', 'region.js',
  'fleet.js', 'aero-aircraft.js', 'benchmarks.js', 'aircraft-skins.js',
  'cockpit-enhancements.js', 'cockpit-electrical.js', 'fa18-highdef.js', 'benchmark-models.js',
  'fleet-expansion.js', 'operations.js', 'tactical.js'
]) {
  load(file);
}

const THREE = sandbox.THREE;
const scene = new THREE.Scene();
const fleetList = sandbox.fleet || vm.runInContext('fleet', sandbox);
const profile = fleetList.find((a) => a.id === 'fa18c');
assert(profile, 'Missing fa18c profile');

const model = sandbox.buildBenchmarkAirframe(profile, scene);
assert.strictEqual(model.parent, scene, 'fa18c airframe group must be attached directly to scene');
assert.strictEqual(model.userData.cabin.parent, scene, 'fa18c cabin must be attached directly to scene');
assert.strictEqual(model.userData.fa18HighDef, true, 'fa18c must build F/A-18C high-detail model');
assert.strictEqual(model.userData.skipGenericFighterRefinement, true, 'fa18c must skip generic refineFighter');

if (sandbox.aircraftSkins) sandbox.aircraftSkins.applyLivery(model, profile, THREE, 'default');
if (sandbox.cockpitEnhancements) sandbox.cockpitEnhancements.enhanceCockpit(model, profile, THREE);
if (sandbox.cockpitElectrical && model.userData.cabin) {
  sandbox.cockpitElectrical.buildSwitchPanel(THREE, model.userData.cabin, true, profile);
}
model.updateMatrixWorld(true);

const box = new THREE.Box3();
const plumes = new Set(model.userData.exhaustPlumes || []);
model.traverse((o) => {
  if (o.isMesh && o.geometry && !plumes.has(o)) {
    o.geometry.computeBoundingBox?.();
    box.expandByObject(o);
  }
});
const sz = box.getSize(new THREE.Vector3());
assert(sz.z > 16.4 && sz.z < 17.8, `fa18c length=${sz.z.toFixed(2)}m out of F/A-18C range (17.07m)`);
assert(sz.x > 11.2 && sz.x < 12.6, `fa18c unfolded span=${sz.x.toFixed(2)}m out of F/A-18C range (11.43-12.31m)`);
assert(sz.y > 4.2 && sz.y < 5.2, `fa18c height=${sz.y.toFixed(2)}m out of F/A-18C range`);

// Gear grounding & wheels
const gearBox = new THREE.Box3().setFromObject(model.userData.gear);
assert(Math.abs(gearBox.min.y + profile.gearHeight) < 0.08, `fa18c gear bottom ${gearBox.min.y.toFixed(3)} != -${profile.gearHeight}`);
assert(model.userData.wheels.length >= 4, 'fa18c must expose dual nose + main wheels');
for (const w of model.userData.wheels) {
  assert(Math.abs(w.rotation.z - Math.PI / 2) < 0.02, 'fa18c wheel rotation.z must orient tire for rotateY()');
}

// Folding Outer Wings & Arrestor Tailhook Check
const flightState = {
  aircraft: profile, battery: true, engines: [true, true], power: 0.92, boost: true,
  ground: false, gear: false, flaps: 0, brakes: false, speed: 240, y: 1200, pitch: 0.04, bank: 0,
  heading: 0.5, fuel: 4900, gForce: 1.0, tailhook: false
};
for (let i = 0; i < 40; i++) model.userData.updateAeroSurfaces(flightState, 0.1, i * 100, false);
assert(model.userData.wingFoldAngleDeg < 2.0, `fa18c wings must stay unfolded in flight (${model.userData.wingFoldAngleDeg.toFixed(1)}°)`);

const parkedState = {
  ...flightState, ground: true, engines: [false, false], speed: 0, power: 0, boost: false, tailhook: true
};
for (let i = 0; i < 60; i++) model.userData.updateAeroSurfaces(parkedState, 0.1, i * 100, false);
assert(model.userData.wingFoldAngleDeg > 86.0, `fa18c outer wings must fold upward when parked (${model.userData.wingFoldAngleDeg.toFixed(1)}°)`);

// Verify folded vertex X span shrinks cleanly (~8.4m vs 11.8m unfolded)
model.updateMatrixWorld(true);
let minX = Infinity, maxX = -Infinity;
const v = new THREE.Vector3();
model.traverse((o) => {
  if (o.isMesh && o.geometry && !plumes.has(o)) {
    const pos = o.geometry.attributes?.position;
    if (!pos) return;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      if (v.x < minX) minX = v.x;
      if (v.x > maxX) maxX = v.x;
    }
  }
});
const foldedSpan = maxX - minX;
assert(foldedSpan < 9.2, `fa18c folded span=${foldedSpan.toFixed(2)}m must be compact (<9.2m)`);

// Arrestor hook rotation check
const hookPivot = model.getObjectByName('fa18ArrestorHook');
assert(hookPivot && hookPivot.rotation.x > 0.65, `fa18c arrestor hook must deploy (>0.65 rad), got ${hookPivot?.rotation.x}`);

// Afterburner + 3-MFD cockpit check
model.userData.updateAeroSurfaces(flightState, 0.05, 1000, false);
assert.strictEqual(model.userData.exhaustPlumes[0].visible, true, 'fa18c port AB plume must engage');
assert.strictEqual(model.userData.exhaustPlumes[1].visible, true, 'fa18c stbd AB plume must engage');
model.userData.updateFighterDeck(flightState, 1000);
assert(model.userData.cockpitControls?.switches?.length >= 8, 'fa18c cockpit must expose 8 clickable switch hitboxes');

// Live tactical takeoff & climb
const rcmq = sandbox.taiwanAirports.find((a) => a.code === 'RCMQ');
const f = sandbox.makeTacticalFlight(rcmq, profile, 'duel', 0, true, false);
f.battery = true; f.engines[0] = true; f.engines[1] = true; f.parkingBrake = false;
f.power = 1.0; f.boost = true;
for (let i = 0; i < 120 * 14 && !f.airborne; i++) {
  sandbox.stepTrainer(f, { pitch: 0.25, roll: 0, rudder: 0, trim: 0, throttle: 1 });
}
assert(f.airborne, 'fa18c failed takeoff roll with afterburner');
for (let i = 0; i < 120 * 10; i++) {
  sandbox.stepTrainer(f, { pitch: 0.06, roll: 0.3, rudder: 0, trim: 0, throttle: 1 });
}
assert(f.y > 400 && f.speed > 140, `fa18c climb/speed below fighter envelope: alt=${f.y.toFixed(0)} speed=${f.speed.toFixed(1)}`);

console.log(`PASSED fa18c (${sz.z.toFixed(2)}m x ${sz.x.toFixed(2)}m unfolded -> ${foldedSpan.toFixed(2)}m folded, climb ${Math.round(f.y)}m @ ${f.speed.toFixed(1)}m/s)!`);
