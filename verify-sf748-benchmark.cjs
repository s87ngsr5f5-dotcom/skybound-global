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
  JSON, Promise, Error,
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
  'cargo-voyage.js', 'b748f-highdef.js', 'benchmark-models.js',
  'airliner-refinement.js', 'aircraft-skins.js', 'cockpit-enhancements.js',
  'cockpit-electrical.js'
]) {
  runDist(f);
}

const p = sandbox.fleet.find((m) => m.id === 'sf748');
assert(p, 'sf748 Boeing 747-8F profile missing from fleet');
assert.strictEqual(p.role, 'cargo', 'sf748 must be cargo role');
assert.strictEqual(p.geometry[0], 38.15, 'sf748 half-length must be 38.15m (76.30m)');
assert.strictEqual(p.geometry[2], 34.2, 'sf748 half-span must be 34.2m (68.40m)');
assert.strictEqual(p.geometry[4], 4, 'sf748 must be 4-engine quad');
assert(p.cargoSlotLimit >= 38000, 'sf748 cargoSlotLimit must support heavy freighter stations >= 38000');

// 1. Build 3D airframe + upper-deck cockpit + electrical + livery
const scene = new THREE.Scene();
sandbox.scene = scene;
const model = sandbox.buildBenchmarkAirframe(p, scene);
const data = model.userData;
assert(data.b748fHighDef === true, 'sf748 must build using dedicated b748f-highdef module');
assert(data.articulatedGear === true, 'sf748 must use articulated 5-strut 18-wheel gear');

if (sandbox.aircraftSkins) sandbox.aircraftSkins.applyLivery(model, p, THREE);
const deck = sandbox.refineB748FFlightDeck(model, p);
if (sandbox.cockpitEnhancements) sandbox.cockpitEnhancements.enhanceCockpit(model, p, THREE);
if (sandbox.cockpitElectrical && data.cabin) sandbox.cockpitElectrical.buildSwitchPanel(THREE, data.cabin, p.role === 'fighter', p);

model.updateMatrixWorld(true);
const fullBox = new THREE.Box3().setFromObject(model);
const totalLen = fullBox.max.z - fullBox.min.z;
const totalSpan = fullBox.max.x - fullBox.min.x;
const totalHeight = fullBox.max.y - fullBox.min.y;
assert(totalLen >= 75.5 && totalLen <= 78.0, `Expected ~76.3m 747-8F length, got ${totalLen.toFixed(2)}`);
assert(totalSpan >= 68.0 && totalSpan <= 69.5, `Expected ~68.4m 747-8F span, got ${totalSpan.toFixed(2)}`);
assert(totalHeight >= 19.0 && totalHeight <= 19.8, `Expected ~19.35m 747-8F height, got ${totalHeight.toFixed(2)}`);

// 2. Verify short freighter upper-deck hump ends ahead of wing midbody (not full-length 747-8I / A380!)
const hullMesh = model.children.find((c) => c.name === 'B748F Double-Lobe Fuselage');
assert(hullMesh, 'B748F Double-Lobe Fuselage mesh missing');
const hPos = hullMesh.geometry.attributes.position;
let forwardUpperY = -99, midFuselageY = -99;
for (let i = 0; i < hPos.count; i++) {
  const z = hPos.getZ(i), y = hPos.getY(i);
  if (z >= -29.0 && z <= -21.0) forwardUpperY = Math.max(forwardUpperY, y);
  if (z >= -8.0 && z <= 10.0) midFuselageY = Math.max(midFuselageY, y);
}
assert(forwardUpperY > 4.2, `Expected 747-8F upper-deck crown > 4.2m, got ${forwardUpperY.toFixed(2)}`);
assert(midFuselageY <= 3.35, `747-8F short upper deck must return to main deck by z=-8..+10, got maxY=${midFuselageY.toFixed(2)}`);

// 3. Verify 4x GEnx-2B67 nacelles clearance & flush wraparound cockpit glass
const nacelles = model.children.filter((c) => c.name === 'B748F GEnx-2B67 Nacelle');
assert.strictEqual(nacelles.length, 4, `Expected 4 GEnx-2B67 nacelles, got ${nacelles.length}`);
assert.strictEqual(data.fans.length, 4, 'Expected 4 spinning turbofan rotors');
assert.strictEqual(data.reverserSleeves.length, 4, 'Expected 4 translating thrust-reverser sleeves');
for (let i = 0; i < nacelles.length; i++) {
  const nb = new THREE.Box3().setFromObject(nacelles[i]);
  assert(nb.min.y > -4.05, `Engine #${i + 1} too close to -4.60m ground: minY=${nb.min.y.toFixed(3)}`);
}
const wsGlass = data.closeDetails.children.filter((c) => c.material === data.cockpitGlassMats[0]);
assert(wsGlass.length === 14, `Expected 6 windshield + 8 upper-deck side windows = 14, got ${wsGlass.length}`);
const windshieldMinZ = Math.min(...wsGlass.slice(0, 6).map((w) => new THREE.Box3().setFromObject(w).min.z));
assert(windshieldMinZ >= -31.2, `Upper-deck windshield shifted too far forward: minZ=${windshieldMinZ.toFixed(2)}`);

// 4. Verify 5-strut 18-wheel gear grounding, scale preservation, retraction, steering & tire roll axis
assert.strictEqual(data.wheels.length, 18, `747-8F must have 18 wheels (2 nose + 16 main), got ${data.wheels.length}`);
for (let i = 0; i < data.wheels.length; i++) {
  const w = data.wheels[i];
  assert(Math.abs(w.rotation.z - Math.PI / 2) < 1e-4, `Wheel #${i} must rotate.z=PI/2 so flight.js rotateY rolls forward`);
  assert(w.userData && w.userData.radius > 0.4, `Wheel #${i} missing userData.radius for ground roll speed`);
  const wb = new THREE.Box3().setFromObject(w);
  assert(Math.abs(wb.min.y - (-4.60)) <= 0.04, `Wheel #${i} not grounded at -4.60m: minY=${wb.min.y.toFixed(3)}`);
}
const rot0Before = data.wheels[0].rotation.x;
data.wheels.forEach((w) => w.rotateY(5.0 / w.userData.radius));
assert(Math.abs(data.wheels[0].rotation.x - rot0Before) > 0.1 || Math.abs(data.wheels[0].rotation.y) > 0.1,
  'Wheels must revolve when rotateY(travel / radius) is called');

// Test gear retraction & opposite body-gear steering
const simGround = { ground: true, gear: true, gearProgress: 1, vy: -2.0, manualControls: { rudder: 0.6, roll: 0.2 }, flaps: 2, spoilers: true, reverse: true, power: 0.5, battery: true, lights: true, engines: [true, true, true, true], fuel: 120000 };
for (let s = 0; s < 20; s++) {
  data.updateGear(1, 0.05, simGround, false);
  data.updateAeroSurfaces(simGround, 0.05, s * 50, false);
}
assert(data.reverserSleeves[0].position.z > 0.4, 'GEnx translating reverser sleeves should slide aft in ground reverse');
assert(data.flaps[0].rotation.x > 0.3, 'Triple-slotted flaps should deflect at flaps 2');
assert(data.airBrakes[0].rotation.x < -0.5, 'Flush aluminum spoilers should deploy upward');

const simAir = { ground: false, gear: false, gearProgress: 0, vy: 12, manualControls: { rudder: 0, roll: 0 }, flaps: 0, spoilers: false, reverse: false, power: 0.9, battery: true, lights: true, engines: [true, true, true, true], fuel: 118000 };
for (let s = 0; s < 35; s++) data.updateGear(0, 0.05, simAir, false);
assert.strictEqual(data.gear.scale.x, 1, 'Articulated 747-8F gear must NOT scale down to shrink into fuselage');
assert.strictEqual(data.gear.visible, false, 'Fully retracted gear should hide cleanly inside belly bays');

// 5. Verify articulated nose visor door clears upper-deck windshield & port side door swings clear of wings/tail
data.noseDoor.rotation.x = 1.37;
data.sideDoor.rotation.z = -1.33;
model.updateMatrixWorld(true);
const noseOpenBox = new THREE.Box3().setFromObject(data.noseDoor);
const sideOpenBox = new THREE.Box3().setFromObject(data.sideDoor);
assert(noseOpenBox.max.z < windshieldMinZ - 0.3, `Open nose visor (maxZ=${noseOpenBox.max.z.toFixed(2)}) overlaps upper-deck windshield (minZ=${windshieldMinZ.toFixed(2)})`);
assert(noseOpenBox.max.y > 7.5, `Nose visor must swing sharply upward (+7.5m+), got maxY=${noseOpenBox.max.y.toFixed(2)}`);
assert(sideOpenBox.min.x < -5.2 && sideOpenBox.min.z > 12.0 && sideOpenBox.max.z < 17.5, 'Port side cargo door must swing outward aft of wing & ahead of H-stab');

// 6. Verify PDU roller cargo hold & upper-deck cockpit displays + switches
assert(data.cabin && data.palletMeshes.length === 3, '747-8F cargo cabin must contain 3 ULD pallet meshes');
const hasRollers = data.cabin.children.some((c) => c.isInstancedMesh && c.count >= 40);
assert(hasRollers, 'Cargo hold must contain InstancedMesh PDU roller conveyor tracks');
assert(data.cockpitEye.y >= 2.65 && data.cockpitEye.z <= -29.0, 'Cockpit camera must be elevated on upper deck');
assert(deck && Array.isArray(deck.switches) && deck.switches.length >= 10, 'Upper-deck flight deck must expose interactive switches');
assert(deck.switches.some((sw) => sw.userData.action === '機鼻貨門'), 'Upper-deck must include clickable nose visor door control');

drawnTexts.length = 0;
deck.update({ battery: false, engines: [false, false, false, false], fuel: 150000, pallets: [0, 0, 0] }, 1000, 0.9);
assert(drawnTexts.length === 0, 'Cold & Dark cockpit (battery off) must not draw active EICAS/PFD text');

drawnTexts.length = 0;
deck.setBacklight(0.40);
const balFlight = {
  battery: true, engines: [true, true, true, true], gear: true, flaps: 1, spoilers: false, reverse: false,
  parkingBrake: true, speed: 75, y: 1200, heading: 0.4, bank: 0.05, pitch: 0.04, power: 0.72,
  fuel: 145000, pallets: [26000, 28000, 30000], aircraft: p, profile: p,
  departure: { code: 'RCKH' }, destination: { code: 'RCTP' }, hold: { altitude: 10500 }
};
deck.update(balFlight, 2000, 0.12);
assert(drawnTexts.some((t) => t.includes('747-8F GEnx-2B67 EICAS')), 'Upper EICAS title missing');
assert(drawnTexts.some((t) => t.includes('CARGO 84,000 KG')), 'Live cargo total 84,000 KG missing from EICAS');
assert(drawnTexts.some((t) => t.includes('BACKLIGHT 40%')), 'Night panel dimmer must display BACKLIGHT 40%');

// 7. End-to-end RCKH -> RCTP Heavy Cargo Physics & Cargo Balance Check
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
assert(sandbox.setPallet(fCargo, 0, 26000), 'Fwd pallet 26,000 kg failed');
assert(sandbox.setPallet(fCargo, 1, 28000), 'Mid pallet 28,000 kg failed');
assert(sandbox.setPallet(fCargo, 2, 30000), 'Aft pallet 30,000 kg failed');
const cg = sandbox.cargoBalance(fCargo);
assert.strictEqual(cg.total ?? cg.mass, 84000, 'Expected 84,000 kg total freight load');
assert.strictEqual(cg.problems.length, 0, `Balanced 84t load should have no CG warnings, got ${cg.problems}`);

// Ensure pallet meshes reflect cargo load scaling cleanly & stay inside fuselage envelope
data.palletMeshes.forEach((pm, idx) => {
  pm.visible = fCargo.pallets[idx] > 0;
  pm.scale.y = Math.max(0.25, fCargo.pallets[idx] / 36000);
});
data.cabin.updateMatrixWorld(true);
assert(data.palletMeshes.every((pm) => pm.visible && Math.abs(pm.position.x) < 2.2), 'All 3 ULDs must fit within main cargo deck');

// Close cargo doors cleanly, start 4x GEnx-2B67 engines, release brakes & rotate into climb!
fCargo.noseDoor = false;
fCargo.engines = [true, true, true, true];
fCargo.phase = 'active';
fCargo.parkingBrake = false;
fCargo.flaps = 1;
const massWithCargo = sandbox.flightMass(fCargo);
assert.strictEqual(massWithCargo, p.mass + 84000, `flightMass must equal OEW+ref (${p.mass}) + 84,000 kg cargo, got ${massWithCargo}`);

let liftoffSpeed = 0, maxAlt = 0;
for (let step = 0; step < 3600; step++) {
  const rotate = fCargo.speed > 76 && fCargo.ground ? 0.52 : fCargo.y < 900 ? 0.28 : 0.04;
  sandbox.stepTrainer(fCargo, { throttle: 1, trim: 0, pitch: rotate, roll: 0, rudder: 0, brake: 0 }, 0.05);
  if (!fCargo.ground && liftoffSpeed === 0) liftoffSpeed = fCargo.speed;
  if (fCargo.y > 40) fCargo.gear = false;
  if (fCargo.y > maxAlt) maxAlt = fCargo.y;
}
assert(liftoffSpeed > 65, `747-8F heavy freighter rotated cleanly into flight (liftoff ${liftoffSpeed.toFixed(1)} m/s)`);
assert(maxAlt > 600, `747-8F heavy freighter climbed with 84t cargo (maxAlt=${maxAlt.toFixed(1)} m)`);

const route = sandbox.benchmarkRoute('cargo', rckh, rctp);
assert(Array.isArray(route) && route.length >= 6 && route[0].name === '高雄東南離場' && Number.isFinite(route.at(-1).x), 'benchmarkRoute cargo RCKH->RCTP must produce valid offshore waypoints');
assert(Array.isArray(sandbox.cargoVoyageRoute) && sandbox.cargoVoyageRoute.length >= 2 && sandbox.naritaAirport.code === 'RJAA', 'cargoVoyageRoute & RJAA intact');

console.log(
  `PASSED sf748 Boeing 747-8F benchmark: ${totalLen.toFixed(2)}m x ${totalSpan.toFixed(2)}m x ${totalHeight.toFixed(2)}m, ` +
  `18 wheels grounded, nose visor clear (maxZ=${noseOpenBox.max.z.toFixed(2)}), 84t RCKH->RCTP liftoff @ ${liftoffSpeed.toFixed(1)} m/s, maxAlt=${maxAlt.toFixed(0)} m.`
);
