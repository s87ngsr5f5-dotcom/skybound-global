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
  'cockpit-enhancements.js', 'cockpit-electrical.js', 'f14-highdef.js', 'benchmark-models.js',
  'fleet-expansion.js', 'operations.js', 'tactical.js'
]) {
  load(file);
}

const THREE = sandbox.THREE;
const scene = new THREE.Scene();
const fleetList = sandbox.fleet || vm.runInContext('fleet', sandbox);
const profile = fleetList.find((a) => a.id === 'f14b');
assert(profile, 'Missing f14b profile');

const model = sandbox.buildBenchmarkAirframe(profile, scene);
assert.strictEqual(model.parent, scene, 'f14b airframe group must be attached directly to scene');
assert.strictEqual(model.userData.cabin.parent, scene, 'f14b cabin must be attached directly to scene');
assert.strictEqual(model.userData.f14HighDef, true, 'f14b must build F-14B high-detail model');
assert.strictEqual(model.userData.skipGenericFighterRefinement, true, 'f14b must skip generic refineFighter');

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
assert(sz.z > 18.4 && sz.z < 19.8, `f14b length=${sz.z.toFixed(2)}m out of F-14B range (19.10m)`);
assert(sz.x > 18.8 && sz.x < 20.4, `f14b unswept span=${sz.x.toFixed(2)}m out of F-14B range (19.55m)`);
assert(sz.y > 4.6 && sz.y < 5.6, `f14b height=${sz.y.toFixed(2)}m out of F-14B range`);

// Gear grounding & wheels
const gearBox = new THREE.Box3().setFromObject(model.userData.gear);
assert(Math.abs(gearBox.min.y + profile.gearHeight) < 0.08, `f14b gear bottom ${gearBox.min.y.toFixed(3)} != -${profile.gearHeight}`);
assert(model.userData.wheels.length >= 3, 'f14b must expose nose & main wheels');
for (const w of model.userData.wheels) {
  assert(Math.abs(w.rotation.z - Math.PI / 2) < 0.02, `f14b wheel rotation.z must orient tire for rotateY()`);
}

// Continuous Variable-Sweep Wing Check (20° -> 68° high Mach -> 75° parked oversweep)
const lowSpeedFlight = {
  aircraft: profile, battery: true, engines: [true, true], power: 0.72, boost: false,
  ground: false, gear: true, flaps: 1, brakes: false, speed: 95, y: 800, pitch: 0.05, bank: 0,
  heading: 0.5, fuel: 7000, gForce: 1.0, tailhook: false
};
for (let i = 0; i < 40; i++) model.userData.updateAeroSurfaces(lowSpeedFlight, 0.1, i * 100, false);
const sweep20 = model.userData.currentSweepDeg;
assert(sweep20 >= 19.5 && sweep20 <= 21.0, `Expected ~20 deg low-speed sweep, got ${sweep20.toFixed(1)}`);

const highMachFlight = {
  ...lowSpeedFlight, gear: false, flaps: 0, speed: 480, power: 1.0, boost: true, tailhook: true
};
for (let i = 0; i < 60; i++) model.userData.updateAeroSurfaces(highMachFlight, 0.1, i * 100, false);
const sweep68 = model.userData.currentSweepDeg;
assert(sweep68 > 64.0 && sweep68 <= 68.5, `Expected ~68 deg supersonic sweep, got ${sweep68.toFixed(1)}`);

const parkedFlight = {
  ...lowSpeedFlight, ground: true, engines: [false, false], speed: 0, flaps: 0
};
for (let i = 0; i < 60; i++) model.userData.updateAeroSurfaces(parkedFlight, 0.1, i * 100, false);
const sweep75 = model.userData.currentSweepDeg;
assert(sweep75 > 72.0 && sweep75 <= 75.5, `Expected ~75 deg parked oversweep, got ${sweep75.toFixed(1)}`);

// Verify swept wing clears vertical tails (measure actual transformed vertices, not AABB-of-AABB)
model.updateMatrixWorld(true);
let sweptMinX = Infinity, sweptMaxX = -Infinity;
const v = new THREE.Vector3();
model.traverse((o) => {
  if (o.isMesh && o.geometry && !plumes.has(o)) {
    const pos = o.geometry.attributes?.position;
    if (!pos) return;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      if (v.x < sweptMinX) sweptMinX = v.x;
      if (v.x > sweptMaxX) sweptMaxX = v.x;
    }
  }
});
const sweptSpan = sweptMaxX - sweptMinX;
assert(sweptSpan < 13.0, `f14b overswept span=${sweptSpan.toFixed(2)}m should be compact (<13.0m)`);

// Afterburner + cockpit deck update
model.userData.updateAeroSurfaces(highMachFlight, 0.05, 1000, false);
assert.strictEqual(model.userData.exhaustPlumes[0].visible, true, 'f14b port AB plume must engage');
assert.strictEqual(model.userData.exhaustPlumes[1].visible, true, 'f14b stbd AB plume must engage');
model.userData.updateFighterDeck(highMachFlight, 1000);
assert(model.userData.cockpitControls?.switches?.length >= 8, 'f14b cockpit must expose 8 clickable switch hitboxes');

// Live tactical takeoff & climb
const rcmq = sandbox.taiwanAirports.find((a) => a.code === 'RCMQ');
const f = sandbox.makeTacticalFlight(rcmq, profile, 'duel', 0, true, false);
f.battery = true; f.engines[0] = true; f.engines[1] = true; f.parkingBrake = false;
f.power = 1.0; f.boost = true;
for (let i = 0; i < 120 * 14 && !f.airborne; i++) {
  sandbox.stepTrainer(f, { pitch: 0.25, roll: 0, rudder: 0, trim: 0, throttle: 1 });
}
assert(f.airborne, 'f14b failed takeoff roll with afterburner');
for (let i = 0; i < 120 * 10; i++) {
  sandbox.stepTrainer(f, { pitch: 0.06, roll: 0.3, rudder: 0, trim: 0, throttle: 1 });
}
assert(f.y > 400 && f.speed > 140, `f14b climb/speed below fighter envelope: alt=${f.y.toFixed(0)} speed=${f.speed.toFixed(1)}`);

console.log(`PASSED f14b (${sz.z.toFixed(2)}m x ${sz.x.toFixed(2)}m unswept -> ${sweptSpan.toFixed(2)}m swept, climb ${Math.round(f.y)}m @ ${f.speed.toFixed(1)}m/s)!`);
