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
  'cockpit-enhancements.js', 'cockpit-electrical.js', 'f16-highdef.js', 'benchmark-models.js',
  'operations.js', 'tactical.js'
]) {
  load(file);
}

const THREE = sandbox.THREE;
const scene = new THREE.Scene();

function checkF16Variant(id) {
  const fleetList = sandbox.fleet || vm.runInContext('fleet', sandbox);
  const profile = fleetList.find((a) => a.id === id);
  assert(profile, `Missing profile ${id}`);
  const model = sandbox.buildBenchmarkAirframe(profile, scene);
  assert.strictEqual(model.parent, scene, `${id} airframe group must be attached directly to scene`);
  assert.strictEqual(model.userData.cabin.parent, scene, `${id} cabin must be attached directly to scene`);
  assert.strictEqual(model.userData.f16HighDef, true, `${id} must build F16 high-detail model`);
  assert.strictEqual(model.userData.skipGenericFighterRefinement, true, `${id} must skip generic refineFighter`);
  assert.strictEqual(model.userData.skipGenericFighterDecals, true, `${id} must use conformal markings`);

  if (sandbox.aircraftSkins) sandbox.aircraftSkins.applyLivery(model, profile, THREE, 'thunder');
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
  assert(sz.z > 14.2 && sz.z < 15.6, `${id} length=${sz.z.toFixed(2)}m out of F-16 range`);
  assert(sz.x > 9.1 && sz.x < 10.6, `${id} span=${sz.x.toFixed(2)}m out of F-16 range`);
  assert(sz.y > 4.6 && sz.y < 5.2, `${id} height=${sz.y.toFixed(2)}m out of F-16 range`);

  // Gear grounding & rolling rotation axes
  const gearBox = new THREE.Box3().setFromObject(model.userData.gear);
  assert(Math.abs(gearBox.min.y + profile.gearHeight) < 0.06, `${id} gear bottom ${gearBox.min.y.toFixed(3)} != -${profile.gearHeight}`);
  assert.strictEqual(model.userData.wheels.length, 3, `${id} must expose 3 tricycle wheels`);
  for (const w of model.userData.wheels) {
    assert(Math.abs(w.rotation.z - Math.PI / 2) < 0.01, `${id} wheel ${w.name} rotation.z must orient tire for rotateY()`);
    assert(w.userData?.radius > 0.18, `${id} wheel ${w.name} must set valid rolling radius`);
  }

  // Distinct F-16C vs F-16V exterior & cockpit hardware
  const names = new Set();
  model.traverse((o) => { if (o.name) names.add(o.name); });
  model.userData.cabin?.traverse((o) => { if (o.name) names.add(o.name); });
  assert(names.has('f16ChinIntake') && names.has('f16CanopyGlass') && names.has('f16HudSymbology') && names.has('f16Icp'));
  if (id === 'f16v') {
    for (const req of ['f16vCftPort', 'f16vCftStbd', 'f16vSniperPod', 'f16vIffBlade', 'f16vParabrakeFairing', 'f16vCpd']) {
      assert(names.has(req), `F-16V missing genuine sub-variant feature: ${req}`);
    }
    assert(!names.has('f16cCenterCluster'), 'F-16V must not use Block 50 center cluster');
  } else {
    assert(names.has('f16cCenterCluster'), 'F-16C Block 50 must use analog/standby center cluster');
    for (const forb of ['f16vCftPort', 'f16vSniperPod', 'f16vIffBlade', 'f16vParabrakeFairing', 'f16vCpd']) {
      assert(!names.has(forb), `F-16C must not clone F-16V sub-variant part: ${forb}`);
    }
  }

  // Ensure switch panel sits in cockpit forward bay (not z = -0.52 behind pilot!)
  const swPanel = model.userData.cabin.children.find((c) => c.name === 'electricalSwitchPanel');
  assert(swPanel && swPanel.position.z < -2.5, `${id} electricalSwitchPanel misplaced at z=${swPanel?.position.z}`);

  // Wing & stabilator left/right symmetry check (no mirror double-negation!)
  const wPort = model.getObjectByName('f16WingPort');
  const wStbd = model.getObjectByName('f16WingStbd');
  const sPort = model.getObjectByName('f16StabPort');
  const sStbd = model.getObjectByName('f16StabStbd');
  const bpW = new THREE.Box3().setFromObject(wPort);
  const bsW = new THREE.Box3().setFromObject(wStbd);
  const bpS = new THREE.Box3().setFromObject(sPort);
  const bsS = new THREE.Box3().setFromObject(sStbd);
  assert(bpW.max.x < -0.5 && bpW.min.x < -4.2, `${id} f16WingPort must span negative X (${bpW.min.x.toFixed(2)}..${bpW.max.x.toFixed(2)})`);
  assert(bsW.min.x > 0.5 && bsW.max.x > 4.2, `${id} f16WingStbd must span positive X (${bsW.min.x.toFixed(2)}..${bsW.max.x.toFixed(2)})`);
  assert(Math.abs(Math.abs(bpW.min.x) - bsW.max.x) < 0.12, `${id} asymmetric main wings!`);
  assert(bpS.max.x < -0.5 && bsS.min.x > 0.5 && Math.abs(Math.abs(bpS.min.x) - bsS.max.x) < 0.12, `${id} asymmetric stabilators!`);

  // Dynamic surface, afterburner & gear animation checks
  const mockFlight = {
    aircraft: profile, battery: true, engines: [true], power: 0.96, boost: true,
    ground: false, gear: false, flaps: 1, brakes: true, speed: 340, y: 4500, pitch: 0.18, bank: -0.25,
    heading: 1.2, fuel: 2450, gForce: 3.4,
    manualControls: { pitch: 0.6, roll: -0.8, rudder: 0.35 }
  };
  model.userData.updateAeroSurfaces(mockFlight, 0.05, 1000, false);
  model.userData.updateGear(0.0, 0.2, mockFlight, false);
  model.updateMatrixWorld(true);
  const mainWheelL = model.getObjectByName('f16MainWheelL');
  const mwPos = new THREE.Vector3();
  mainWheelL.getWorldPosition(mwPos);
  assert(Math.abs(mwPos.x) < 1.15, `${id} main gear must fold INWARD toward belly, got x=${mwPos.x.toFixed(2)}`);
  model.userData.updateGear(0.0, 0.5, mockFlight, false);
  assert.strictEqual(model.userData.gear.visible, false, `${id} retracted gear must tuck cleanly invisible`);
  assert.strictEqual(model.userData.exhaustPlumes[0].visible, true, `${id} AB plume must engage at wet boost`);
  model.userData.setCockpitBacklight(40);
  assert.strictEqual(model.userData.cockpitBacklightLevel, 40, `${id} backlight slider sync failed`);

  // Live tactical mission & aerodynamic performance check
  const rcmq = sandbox.taiwanAirports.find((a) => a.code === 'RCMQ');
  const f = sandbox.makeTacticalFlight(rcmq, profile, 'duel', 0, true, false);
  f.battery = true; f.engines[0] = true; f.parkingBrake = false;
  f.power = 1.0; f.boost = true;
  for (let i = 0; i < 120 * 14 && !f.airborne; i++) {
    sandbox.stepTrainer(f, { pitch: 0.25, roll: 0, rudder: 0, trim: 0, throttle: 1 });
  }
  assert(f.airborne, `${id} failed takeoff roll with afterburner`);
  for (let i = 0; i < 120 * 10; i++) {
    sandbox.stepTrainer(f, { pitch: 0.06, roll: 0.35, rudder: 0, trim: 0, throttle: 1 });
  }
  assert(f.y > 400 && f.speed > 170, `${id} climb/speed below fighter envelope: alt=${f.y.toFixed(0)} speed=${f.speed.toFixed(1)}`);

  return { id, len: sz.z.toFixed(2), span: sz.x.toFixed(2), height: sz.y.toFixed(2), alt: Math.round(f.y), speed: f.speed.toFixed(1) };
}

const rC = checkF16Variant('sf16');
const rV = checkF16Variant('f16v');
console.log(`PASSED sf16 (${rC.len}m x ${rC.span}m x ${rC.height}m, climb ${rC.alt}m @ ${rC.speed}m/s) & f16v (${rV.len}m x ${rV.span}m x ${rV.height}m, climb ${rV.alt}m @ ${rV.speed}m/s) benchmarks!`);
