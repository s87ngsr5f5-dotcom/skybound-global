'use strict';
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.join(__dirname, 'dist');
const THREE = require(path.join(ROOT, 'three.js'));

const drawnTexts = [];
const fillStyles = [];
function makeCanvas() {
  const ctx = {
    fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, font: '12px sans-serif',
    textAlign: 'left', textBaseline: 'alphabetic', globalAlpha: 1, shadowBlur: 0, shadowColor: '#000',
    fillRect(x, y, w, h) { void x; void y; void w; void h; fillStyles.push(this.fillStyle); },
    strokeRect() {}, clearRect() {}, rect() {}, roundRect() {}, beginPath() {}, closePath() {},
    moveTo() {}, lineTo() {}, quadraticCurveTo() {}, bezierCurveTo() {}, arc() {}, ellipse() {},
    fill() {}, stroke() {},
    fillText(t) { drawnTexts.push(String(t)); },
    strokeText() {}, save() {}, restore() {}, translate() {},
    rotate() {}, scale() {}, clip() {}, setLineDash() {},
    measureText: (t) => ({ width: String(t).length * 8 }),
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
    drawImage() {},
    getImageData: () => ({ data: new Uint8ClampedArray(16) })
  };
  return { width: 512, height: 512, getContext: () => ctx };
}

const sandbox = {
  THREE,
  console, Math, Array, Object, Number, Boolean, String, Map, Set, Float32Array, Uint16Array, Uint32Array,
  JSON, Promise, Error, performance: { now: () => 1000 },
  document: {
    createElement: (tag) => (tag === 'canvas' ? makeCanvas() : { style: {} }),
    getElementById: () => null
  },
  localStorage: { getItem: () => null, setItem: () => {} },
  material: (c, r = 0.5, m = 0.2) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m }),
  fuselage: new THREE.MeshStandardMaterial({ color: 0xe6ebee, roughness: 0.4 }),
  windowMat: new THREE.MeshPhysicalMaterial({ color: 0x152932, transparent: true, opacity: 0.72 }),
  scene: new THREE.Scene(),
  requestAnimationFrame: () => 0,
  addEventListener: () => {}
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

function runDist(name) {
  let code = fs.readFileSync(path.join(ROOT, name), 'utf8');
  code = code.replace(
    /\bconst (trainer|fleet|benchmarkFleet|expansionFleet|fleetCategories|taiwanAirports|internationalAirports|specialAircraft|aircraftSkins|cockpitEnhancements|cockpitElectrical|elevationGrid|naritaAirport|cargoVoyageRoute)\b/g,
    'var $1'
  );
  vm.runInContext(code, sandbox, { filename: name });
}

for (const f of [
  'elevation.js', 'physics.js', 'region.js', 'fleet.js', 'aero-aircraft.js', 'benchmarks.js',
  'cargo-voyage.js', 'an124-highdef.js', 'benchmark-models.js',
  'airliner-refinement.js', 'aircraft-skins.js', 'cockpit-enhancements.js',
  'cockpit-electrical.js'
]) {
  runDist(f);
}

const p = sandbox.fleet.find((m) => m.id === 'an124');
assert(p, 'an124 Antonov An-124-100 profile missing from fleet');
assert.strictEqual(p.role, 'cargo', 'an124 must be cargo role');
assert.strictEqual(p.geometry[0], 34.55, 'an124 half-length must be 34.55m (69.10m)');
assert.strictEqual(p.geometry[2], 36.65, 'an124 half-span must be 36.65m (73.30m)');
assert.strictEqual(p.geometry[4], 4, 'an124 must be 4-engine quad');
assert.strictEqual(p.antonov, true, 'an124 must keep antonov flag');

// 1. Build 3D airframe + Russian-teal flight deck + electrical + conformal livery
const scene = new THREE.Scene();
sandbox.scene = scene;
const model = sandbox.buildBenchmarkAirframe(p, scene);
const data = model.userData;
assert(data.an124HighDef === true, 'an124 must build using dedicated an124-highdef module');
assert(data.articulatedGear === true, 'an124 must use articulated 24-wheel kneeling gear');
assert(Array.isArray(data.blades), 'an124 userData.blades must be initialized as an array for flight.js loop compatibility');
assert.strictEqual(model.parent, scene, 'an124 model must be attached to scene');
assert.strictEqual(data.cabin.parent, scene, 'an124 cabin must be attached to scene');
assert.strictEqual(data.cabin.visible, false, 'an124 cabin must start hidden until cockpit or cabin view');
assert.strictEqual(data.sideDoor, null, 'An-124 only has front/rear loading doors, no 747 side cargo door');

if (sandbox.aircraftSkins) sandbox.aircraftSkins.applyLivery(model, p, THREE);
const deck = sandbox.refineAn124FlightDeck(model, p);
if (sandbox.cockpitEnhancements) sandbox.cockpitEnhancements.enhanceCockpit(model, p, THREE);
if (sandbox.cockpitElectrical && data.cabin) sandbox.cockpitElectrical.buildSwitchPanel(THREE, data.cabin, p.role === 'fighter', p);

model.updateMatrixWorld(true);
const fullBox = new THREE.Box3().setFromObject(model);
const totalLen = fullBox.max.z - fullBox.min.z;
const totalSpan = fullBox.max.x - fullBox.min.x;
const totalHeight = fullBox.max.y - fullBox.min.y;
assert(totalLen >= 68.5 && totalLen <= 70.5, `Expected ~69.1m An-124 length, got ${totalLen.toFixed(2)}`);
assert(totalSpan >= 72.5 && totalSpan <= 74.2, `Expected ~73.3m An-124 span, got ${totalSpan.toFixed(2)}`);
assert(totalHeight >= 19.5 && totalHeight <= 21.3, `Expected ~20.5m An-124 height, got ${totalHeight.toFixed(2)}`);

// 2. Verify High Shoulder Anhedral Wings ('an124 main wing')
const wingMeshes = [];
model.traverse((o) => { if (o.isMesh && o.name === 'an124 main wing') wingMeshes.push(o); });
assert.strictEqual(wingMeshes.length, 2, `Expected 2 symmetric An-124 main wing lofts, got ${wingMeshes.length}`);
const wPos = wingMeshes[0].geometry.attributes.position;
let rootMaxY = -99, tipMaxY = -99;
for (let i = 0; i < wPos.count; i++) {
  const ax = Math.abs(wPos.getX(i)), y = wPos.getY(i);
  if (ax < 6.0 && y > rootMaxY) rootMaxY = y;
  if (ax > 33.0 && y > tipMaxY) tipMaxY = y;
}
assert(rootMaxY >= 2.2, `An-124 high shoulder wing root must mount high (>= 2.2m), got ${rootMaxY.toFixed(2)}`);
assert(tipMaxY < rootMaxY - 1.0, `An-124 wing must exhibit distinct downward anhedral (root=${rootMaxY.toFixed(2)}, tip=${tipMaxY.toFixed(2)})`);

// 3. Verify 4x Progress D-18T engines ('an124 wing engine') & flush cockpit windshield
const nacelles = [];
model.traverse((o) => { if (o.name === 'an124 wing engine') nacelles.push(o); });
assert.strictEqual(nacelles.length, 4, `Expected 4 D-18T nacelles, got ${nacelles.length}`);
assert.strictEqual(data.fans.length, 4, 'Expected 4 rotating 24-blade turbofan rotors');
assert.strictEqual(data.reverserSleeves.length, 4, 'Expected 4 translating thrust-reverser sleeves');
for (let i = 0; i < nacelles.length; i++) {
  const nb = new THREE.Box3().setFromObject(nacelles[i]);
  assert(nb.min.y > -2.5, `High-wing D-18T engine #${i + 1} clearance invalid: minY=${nb.min.y.toFixed(3)}`);
}
const wsGlass = [];
data.closeDetails.traverse((c) => { if (c.isMesh && c.material === data.cockpitGlassMats[0]) wsGlass.push(c); });
assert.strictEqual(wsGlass.length, 18, `Expected 6 windshield + 12 courier deck windows = 18, got ${wsGlass.length}`);
const mainWindshield = wsGlass.filter((w) => w.name === 'Cockpit Windshield Glass');
assert.strictEqual(mainWindshield.length, 6, `Expected 6 main cockpit windshield panes, got ${mainWindshield.length}`);
const windshieldMinZ = Math.min(...mainWindshield.map((w) => new THREE.Box3().setFromObject(w).min.z));
assert(windshieldMinZ >= -25.6, `Upper-deck windshield overlapped visor split: minZ=${windshieldMinZ.toFixed(2)}`);

// 4. Verify 24-Wheel Multi-Bogie Gear Grounding, Tire Roll Axis & Retraction
assert.strictEqual(data.wheels.length, 24, `An-124 must have 24 wheels (4 nose + 20 main), got ${data.wheels.length}`);
for (let i = 0; i < data.wheels.length; i++) {
  const w = data.wheels[i];
  assert(Math.abs(w.rotation.z - Math.PI / 2) < 1e-4, `Wheel #${i} must rotate.z=PI/2`);
  assert(w.userData && w.userData.radius > 0.4, `Wheel #${i} missing userData.radius`);
  const wb = new THREE.Box3().setFromObject(w);
  assert(Math.abs(wb.min.y - (-4.48)) <= 0.04, `Wheel #${i} not grounded at -4.48m: minY=${wb.min.y.toFixed(3)}`);
}
const rot0Before = data.wheels[0].rotation.x;
data.wheels.forEach((w) => w.rotateY(5.0 / w.userData.radius));
assert(Math.abs(data.wheels[0].rotation.x - rot0Before) > 0.1 || Math.abs(data.wheels[0].rotation.y) > 0.1,
  'All 24 An-124 wheels must revolve smoothly via rotateY(travel / radius)');

// 5. Verify Nose Visor Lift + Nose-Kneel Crouch + 2-Stage Ramp Flush Ground Contact + Cargo Vault Cranes
const simOpen = { ground: true, gear: true, noseDoor: true, pallets: [24000, 30000, 20000], engines: [false, false, false, false], fuel: 120000 };
for (let s = 0; s < 45; s++) {
  data.noseDoor.rotation.x += (1.37 - data.noseDoor.rotation.x) * Math.min(1, 0.05 * 2.8);
  data.updateCargoDoors(true, false, 0.05);
  data.updateGear(1, 0.05, simOpen, false);
  data.syncExteriorCargo(simOpen, 0.05);
}
model.updateMatrixWorld(true);
const noseOpenBox = new THREE.Box3().setFromObject(data.noseDoor);
const rampOpenBox = new THREE.Box3().setFromObject(data.cargoRamp);
const tireMesh = data.wheels[0].children[0];
const tPos = tireMesh.geometry.attributes.position;
let noseTireWorldMinY = Infinity;
const vW = new THREE.Vector3();
for (let vi = 0; vi < tPos.count; vi++) {
  vW.fromBufferAttribute(tPos, vi).applyMatrix4(tireMesh.matrixWorld);
  if (vW.y < noseTireWorldMinY) noseTireWorldMinY = vW.y;
}
assert(noseOpenBox.max.y > 7.5, `Nose visor must tilt upward (> +7.5m), got maxY=${noseOpenBox.max.y.toFixed(2)}`);
assert(noseOpenBox.max.z < windshieldMinZ - 0.15, `Open nose visor (maxZ=${noseOpenBox.max.z.toFixed(2)}) overlaps cockpit windshield (${windshieldMinZ.toFixed(2)})`);
const kneeledRad = data.kneelPivot.rotation.x;
assert(kneeledRad < -0.02, `Kneel pivot must crouch nose down (< -0.02 rad), got ${kneeledRad.toFixed(4)}`);
assert(Math.abs(noseTireWorldMinY - (-4.48)) <= 0.05, `Kneeled nose tire must stay flush on -4.48m tarmac, got ${noseTireWorldMinY.toFixed(3)}`);
assert.strictEqual(data.cargoRamp.visible, true, '2-stage cargo ramp must deploy visibly when nose visor opens');
assert(rampOpenBox.min.y >= -4.53 && rampOpenBox.min.y <= -4.42, `Ramp toe must kiss -4.48m tarmac cleanly without clipping underground: minY=${rampOpenBox.min.y.toFixed(3)}`);
assert.strictEqual(data.gantryCranes.length, 2, 'An-124 cargo vault must include twin overhead bridge cranes');
assert.strictEqual(data.extPallets.length, 3, 'An-124 cargo vault must sync 3 external cargo modules');
assert(data.extPallets.every((ep) => ep.visible), 'Loaded cargo modules must appear visibly inside exterior bay');

// Close visor, un-kneel & test airborne retraction + reversers/flaps/spoilers
for (let s = 0; s < 50; s++) {
  data.noseDoor.rotation.x += (0 - data.noseDoor.rotation.x) * Math.min(1, 0.05 * 2.8);
  data.updateCargoDoors(false, false, 0.05);
}
const simGroundRev = { ground: true, gear: true, gearProgress: 1, vy: -1.8, manualControls: { rudder: 0.5, roll: 0.2 }, flaps: 2, spoilers: true, reverse: true, power: 0.5, battery: true, lights: true, engines: [true, true, true, true], fuel: 140000 };
for (let s = 0; s < 20; s++) {
  data.updateGear(1, 0.05, simGroundRev, false);
  data.updateAeroSurfaces(simGroundRev, 0.05, s * 50, false);
}
assert(data.reverserSleeves[0].position.z > 0.4, 'Progress D-18T translating reversers must slide aft in reverse');
assert(data.flaps[0].rotation.x > 0.3, 'Fowler flaps must deflect at flaps 2');
assert(data.airBrakes[0].rotation.x < -0.5, 'Upper wing spoilers must deploy cleanly');

const simAir = { ground: false, gear: false, gearProgress: 0, vy: 12, manualControls: { rudder: 0, roll: 0 }, flaps: 0, spoilers: false, reverse: false, power: 0.9, battery: true, lights: true, engines: [true, true, true, true], fuel: 138000 };
for (let s = 0; s < 35; s++) data.updateGear(0, 0.05, simAir, false);
assert.strictEqual(data.gear.scale.x, 1, 'Articulated An-124 gear must never scale down into hull');
assert.strictEqual(data.gear.visible, false, 'Retracted 24-wheel gear must stow completely inside sponsons');

// 6. Verify Dedicated Russian-Teal Upper Flight Deck (Cold & Dark + Day + Night 40% Backlight + Switches)
assert(data.cockpitEye.y >= 2.65 && data.cockpitEye.z <= -23.5, 'An-124 cockpit camera must sit on upper flight deck');
assert(deck && Array.isArray(deck.switches) && deck.switches.length >= 10, 'Russian-teal cockpit must expose interactive switches');
assert(deck.switches.some((sw) => sw.userData.action === '機鼻貨門'), 'Flight deck must include clickable nose visor control');

drawnTexts.length = 0;
deck.update({ battery: false, engines: [false, false, false, false], fuel: 150000, pallets: [0, 0, 0] }, 1000, 0.9);
assert(drawnTexts.length === 0, 'Cold & Dark An-124 cockpit (battery off) must stay dark');

drawnTexts.length = 0;
deck.setBacklight(0.40);
deck.update({
  battery: true, engines: [true, true, true, true], gear: true, flaps: 1, spoilers: false, reverse: false,
  parkingBrake: true, speed: 75, y: 1200, heading: 0.4, bank: 0.05, pitch: 0.04, power: 0.72,
  fuel: 145000, pallets: [24000, 30000, 20000], aircraft: p, profile: p,
  departure: { code: 'RCKH' }, destination: { code: 'RCTP' }, hold: { altitude: 10500 }
}, 2000, 0.12);
assert(drawnTexts.some((t) => t.includes('AN-124-100 · 4x D-18T')), 'Russian-teal 4-engine MIP title missing');
assert(drawnTexts.some((t) => t.includes('CARGO 74,000 KG')), 'Live cargo total 74,000 KG missing from MIP');
assert(drawnTexts.some((t) => t.includes('BACKLIGHT 40%')), 'Night panel dimmer must display BACKLIGHT 40%');

// 7. End-to-End RCKH -> RCTP Heavy Cargo Mission Physics (74,000 kg)
const rckh = sandbox.taiwanAirports.find((a) => a.code === 'RCKH');
const rctp = sandbox.taiwanAirports.find((a) => a.code === 'RCTP');
assert(rckh && rctp, 'RCKH and RCTP airports must exist in region.js');

const fCargo = sandbox.createTrainer(false, 0);
fCargo.aircraft = p;
fCargo.profile = p;
fCargo.y = sandbox.groundHeight(fCargo.x, fCargo.z) + p.gearHeight;
fCargo.ground = true;
fCargo.parkingBrake = true;
fCargo.phase = 'cold';
fCargo.vx = 0;
fCargo.vz = 0;
fCargo.speed = 0;
fCargo.fuel = p.fuel;
fCargo.fuelStart = p.fuel;
fCargo.pallets = [0, 0, 0];
fCargo.noseDoor = true;
fCargo.sideDoor = false;
fCargo.engines = [false, false, false, false];
fCargo.battery = true;
assert(sandbox.setPallet(fCargo, 0, 24000), 'Fwd pallet 24,000 kg failed');
assert(sandbox.setPallet(fCargo, 1, 30000), 'Mid pallet 30,000 kg failed');
assert(sandbox.setPallet(fCargo, 2, 20000), 'Aft pallet 20,000 kg failed');
const cg = sandbox.cargoBalance(fCargo);
assert.strictEqual(cg.total ?? cg.mass, 74000, 'Expected 74,000 kg total freight load');
assert.strictEqual(cg.problems.length, 0, `Balanced 74t An-124 load should have zero CG warnings, got ${cg.problems}`);

fCargo.noseDoor = false;
fCargo.engines = [true, true, true, true];
fCargo.phase = 'active';
fCargo.parkingBrake = false;
fCargo.flaps = 1;
const massWithCargo = sandbox.flightMass(fCargo);
assert.strictEqual(massWithCargo, p.mass + 74000, `flightMass must equal OEW (${p.mass}) + 74,000 kg cargo`);

let liftoffSpeed = 0, maxAlt = 0;
for (let step = 0; step < 3600; step++) {
  const rotate = fCargo.speed > 76 && fCargo.ground ? 0.52 : fCargo.y < 900 ? 0.28 : 0.04;
  sandbox.stepTrainer(fCargo, { throttle: 1, trim: 0, pitch: rotate, roll: 0, rudder: 0, brake: 0 }, 0.05);
  if (!fCargo.ground && liftoffSpeed === 0) liftoffSpeed = fCargo.speed;
  if (fCargo.y > 40) fCargo.gear = false;
  if (fCargo.y > maxAlt) maxAlt = fCargo.y;
}
assert(liftoffSpeed > 60, `An-124 heavy freighter rotated cleanly (liftoff ${liftoffSpeed.toFixed(1)} m/s)`);
assert(maxAlt > 600, `An-124 heavy freighter climbed with 74t cargo (maxAlt=${maxAlt.toFixed(1)} m)`);

const route = sandbox.benchmarkRoute('cargo', rckh, rctp);
assert(Array.isArray(route) && route.length >= 6 && Number.isFinite(route.at(-1).x), 'benchmarkRoute cargo RCKH->RCTP must return valid route');

console.log(
  `PASSED an124 Antonov An-124-100 benchmark: ${totalLen.toFixed(2)}m x ${totalSpan.toFixed(2)}m x ${totalHeight.toFixed(2)}m, ` +
  `anhedral wing (${rootMaxY.toFixed(2)}m -> ${tipMaxY.toFixed(2)}m), 24 wheels grounded, kneel=${kneeledRad.toFixed(3)} rad, ` +
  `ramp minY=${rampOpenBox.min.y.toFixed(3)}m, 74t RCKH->RCTP liftoff @ ${liftoffSpeed.toFixed(1)} m/s, maxAlt=${maxAlt.toFixed(0)} m.`
);
