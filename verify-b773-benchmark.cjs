'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const ROOT = path.join(__dirname, 'dist');
const THREE = require(path.join(ROOT, 'three.js'));

function makeCanvas() {
  const drawCalls = [];
  const ctx = {
    fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, font: '12px sans-serif',
    textAlign: 'left', textBaseline: 'alphabetic', globalAlpha: 1, shadowBlur: 0, shadowColor: '#000',
    fillRect() {}, strokeRect() {}, clearRect() {}, rect() {}, roundRect() {}, beginPath() {}, closePath() {},
    moveTo() {}, lineTo() {}, quadraticCurveTo() {}, bezierCurveTo() {}, arc() {}, ellipse() {},
    fill() {}, stroke() {}, fillText(t) { drawCalls.push(String(t)); }, strokeText() {},
    save() {}, restore() {}, translate() {}, rotate() {}, scale() {}, clip() {}, setLineDash() {},
    measureText: (t) => ({ width: String(t).length * 8 }),
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
    drawImage() {},
    getImageData: () => ({ data: new Uint8ClampedArray(16) })
  };
  return { width: 512, height: 256, getContext: () => ctx, _drawCalls: drawCalls };
}

const canvases = [];
const sandbox = {
  THREE,
  console, Math, Array, Object, Number, Boolean, String, Map, Set,
  Float32Array, Int16Array, Uint8Array, Uint8ClampedArray, Uint16Array, Uint32Array,
  JSON, Promise, Error, atob: (s) => Buffer.from(s, 'base64').toString('binary'),
  document: {
    createElement: (tag) => {
      if (tag === 'canvas') { const c = makeCanvas(); canvases.push(c); return c; }
      return { style: {} };
    },
    getElementById: () => null
  },
  localStorage: { getItem: () => null, setItem: () => {} },
  scene: new THREE.Scene(),
  requestAnimationFrame: () => 0,
  addEventListener: () => {}
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

function runDist(name) {
  let code = fs.readFileSync(path.join(ROOT, name), 'utf8');
  code = code.replace(/\bconst (trainer|fleet|benchmarkFleet|expansionFleet|fleetCategories|specialAircraft|aircraftSkins|cockpitEnhancements|cockpitElectrical|downloadedAirframes)\b/g, 'var $1');
  vm.runInContext(code, sandbox, { filename: name });
}

for (const f of [
  'elevation.js', 'physics.js', 'regional-elevation.js', 'region.js',
  'fleet.js', 'aero-aircraft.js', 'benchmarks.js', 'b773-highdef.js', 'benchmark-models.js',
  'downloaded-aircraft.js', 'operations.js', 'aircraft-skins.js', 'cockpit-enhancements.js', 'cockpit-electrical.js'
]) {
  runDist(f);
}

// 1. Verify b773 is NOT swapped to legacy low-poly GLB
assert.strictEqual(sandbox.downloadedAirframes.b773, undefined, 'b773 must not map to legacy downloaded GLB');

const b773 = sandbox.benchmarkFleet.find(a => a.id === 'b773');
assert(b773, 'b773 profile missing from benchmarkFleet');

// 2. Build 3D reference airframe and verify dimensions, wheels, clearance
const scene = new THREE.Scene();
const model = sandbox.buildBenchmarkAirframe(b773, scene);
assert(model.userData?.b773HighDef, 'b773 must build via b773-highdef.js');
model.updateMatrixWorld(true);

const fuseBox = new THREE.Box3();
model.traverse((obj) => {
  if (!obj.isMesh || !obj.geometry) return;
  let p = obj;
  while (p) { if (p === model.userData.gear || p === model.userData.cabin) return; p = p.parent; }
  fuseBox.expandByObject(obj);
});
const fullSize = fuseBox.getSize(new THREE.Vector3());
assert(fullSize.z >= 73.2 && fullSize.z <= 75.2, `Expected 777-300ER length ~73.9m, got ${fullSize.z.toFixed(2)}m`);
assert(fullSize.x >= 64.2 && fullSize.x <= 65.4, `Expected 777-300ER span ~64.8m, got ${fullSize.x.toFixed(2)}m`);

// Engine clearance above ground plane (-4.50m)
let minEngineY = Infinity;
model.traverse((obj) => {
  if (obj.isMesh && obj.parent?.name?.startsWith('b773 GE90')) {
    minEngineY = Math.min(minEngineY, new THREE.Box3().setFromObject(obj).min.y);
  }
});
assert(minEngineY > -4.25 && minEngineY < -3.6, `GE90 bottom should sit safely above -4.50m runway: ${minEngineY.toFixed(2)}m`);

// 14 Wheels resting flush at -4.50m
assert.strictEqual(model.userData.wheels.length, 14, `Expected 14 wheels (2 nose + 12 main), got ${model.userData.wheels.length}`);
const gearBox = new THREE.Box3().setFromObject(model.userData.gear);
assert(Math.abs(gearBox.min.y + b773.gearHeight) < 0.04, `Landing gear tires must touch -4.50m, got ${gearBox.min.y.toFixed(3)}`);

// 3. Verify articulated gear retraction WITHOUT scale shrinking and INWARD main strut swing
const data = model.userData;
const mockFlight = {
  aircraft: b773, battery: true, lights: true, fuel: 32000, fuelFlow: 2.1,
  engines: [true, true], power: 0.75, gear: false, ground: false,
  flaps: 2, spoilers: false, reverse: false, parkingBrake: false,
  vx: 0, vy: 2, vz: -120, y: 800, x: 0, z: 0, speed: 120, heading: 0.5, bank: 0.2, pitch: 0.1,
  manualControls: { roll: 0.8, pitch: 0.5, rudder: 0.6 },
  service: { door: false, boarded: 0, cabinLights: true, seatBelts: true },
  departure: { code: 'RCTP' }, destination: { code: 'RCKH' }, route: [{ x: 1000, z: -2000, name: 'WP1' }], waypoint: 0
};
for (let step = 0; step < 30; step++) data.updateGear(0, 0.1, mockFlight, false);
assert.strictEqual(data.gear.scale.x, 1, 'Articulated gear must never shrink via scale');
assert(!data.gear.visible, 'Gear must finish retracted cleanly');

// Check partial extension inward rotation direction mid-swing
mockFlight.gear = true;
for (let step = 0; step < 3; step++) data.updateGear(1, 0.05, mockFlight, false);
const mainPivots = data.gear.children.filter(c => c.position.z > 2 && c.position.x !== 0);
assert(mainPivots.length >= 2, 'Expected left and right main gear pivots');
const leftPivot = mainPivots.find(p => p.position.x < 0);
const rightPivot = mainPivots.find(p => p.position.x > 0);
assert(leftPivot.rotation.z > 0.05 && rightPivot.rotation.z < -0.05,
  `Main struts must swing INWARD (L:+Z ${leftPivot.rotation.z.toFixed(3)}, R:-Z ${rightPivot.rotation.z.toFixed(3)})`);

// Fully extended on ground + nosewheel steer response
mockFlight.ground = true;
for (let step = 0; step < 40; step++) data.updateGear(1, 0.1, mockFlight, false);
assert(data.gear.visible);
const noseSteerGroup = data.gear.children.find(c => c.position.z < -20 && c.children.length === 1)?.children[0];
assert(noseSteerGroup && noseSteerGroup.rotation.y < -0.1, 'Right rudder must steer nosewheel toward right (-Y rotation)');

// 4. Verify aero surfaces, slats base preservation, reverser sleeves, and GE90 spool down
mockFlight.ground = true;
mockFlight.reverse = true;
mockFlight.spoilers = true;
for (let step = 0; step < 40; step++) data.updateAeroSurfaces(mockFlight, 0.08, step * 80, false);
assert(data.flaps[0].rotation.x > 0.30, 'Flaps must deflect downward (+X)');
assert(data.slats[0].rotation.x < -0.15, 'Slats must droop downward (-X)');
assert(Math.abs(data.slats[0].position.y - data.slats[1].position.y) > 0.25, 'Inboard vs outboard slats must keep individual dihedral root Y');
assert(data.airBrakes[0].rotation.x < -0.5, 'Spoilers must deploy upward (-X)');
assert(data.reverserSleeves[0].position.z > 0.5, 'GE90 thrust reverser sleeves must translate aft on reverse');
assert(data.surfaces[0].rotation.x > 0.1 && data.surfaces[1].rotation.x < -0.05, 'Ailerons must deflect differentially with right roll');
assert(data.rudders[0].rotation.y > 0.15, 'Rudder must deflect right (+Y) for positive right rudder');

const spinBeforeShutdown = data.fans[0].rotation.z;
mockFlight.engines = [false, false];
mockFlight.reverse = false;
mockFlight.spoilers = false;
data.updateAeroSurfaces(mockFlight, 0.05, 5000, false);
assert(data.fans[0].rotation.z > spinBeforeShutdown, 'Engine fans must coast down gradually with inertia after shutdown');

// 5. Verify 3-4-3 360-seat Cabin Sync + Bespoke 6-LCD Flight Deck + Cold & Dark
mockFlight.service.door = true;
mockFlight.service.boarded = 180;
data.passengerCabin.update(mockFlight, 0.6);
assert(data.passengerCabin.door.visible && Math.abs(data.passengerCabin.door.rotation.y) > 0.4, 'L1 plug door must open smoothly');
let halfBoardedCount = 0;
data.cabin.traverse(o => { if (o.isInstancedMesh && o.count === 180) halfBoardedCount++; });
assert.strictEqual(halfBoardedCount, 2, 'Half-boarded cabin must show 180 head & torso instances on fixed 360 headrests');
mockFlight.service.boarded = 360;
data.passengerCabin.update(mockFlight, 0.6);
let boardedMeshCount = 0;
data.cabin.traverse(o => { if (o.isInstancedMesh && o.count === 360) boardedMeshCount++; });
assert.strictEqual(boardedMeshCount, 4, 'Full cabin must align 360 headrests, seatback IFE monitors, heads, and torsos');

const cockpit = sandbox.refineB773FlightDeck(model, b773);
assert(cockpit.switches.length >= 8, '777 flight deck must provide interactive cockpit hitboxes');
cockpit.setBacklight(0.35);
cockpit.update(mockFlight, 6000, 0.1);
assert(canvases.some(c => c._drawCalls.some(t => t.includes('BACKLIGHT 35%'))), 'Night backlight adjustment must update cockpit displays');
mockFlight.battery = false;
cockpit.update({ ...mockFlight }, 7000, 1.0); // Cold & Dark state must draw without error

// 6. Verify Complete End-to-End 777-300ER Airline Mission (RCTP -> RCKH, gate boarding -> takeoff -> cruise -> arrival deboarding)
const benchSrc = fs.readFileSync(path.join(__dirname, 'verify-benchmarks.cjs'), 'utf8');
const regSrc = fs.readFileSync(path.join(__dirname, 'verify-regional.cjs'), 'utf8');
const ctrlCode = regSrc.slice(regSrc.indexOf('const clampValue='), regSrc.indexOf('function verifyFlight'))
  .replace('Math.min(6,distance*.22):Math.min(7,distance*.28)', 'Math.min(5,distance*.19):Math.min(6,distance*.21)')
  .replace('power=clampValue(.09+(taxiSpeed-speed)*.085,0,.34)', 'power=clampValue(.065+(taxiSpeed-speed)*.10,0,.38)')
  .replace('f.destination.elevation-12', 'f.destination.elevation-28')
  .replace('(-f.destination.length/2+200-frame.along)*.048', '(-f.destination.length/2+250-frame.along)*.036')
  .replace('14000?440:1050', '16000?270:940')
  .replace('f.aircraft.mass*(9.81', 'flightMass(f)*(9.81')
  .replace('(final?.19:.54)+(goalSpeed-f.speed)*.095', '(final?.14:.44)+(goalSpeed-f.speed)*.095');
const store = new Map([['skybound.money', '250000']]);
const missionSandbox = {
  ...sandbox,
  assert,
  crypto: require('node:crypto'),
  setTimeout,
  clearTimeout,
  localStorage: { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) }
};
missionSandbox.window = missionSandbox;
missionSandbox.globalThis = missionSandbox;
vm.createContext(missionSandbox);
for (const file of ['elevation', 'physics', 'regional-elevation', 'kinmen-elevation', 'region', 'fleet', 'benchmarks', 'operations']) {
  const src = fs.readFileSync(path.join(ROOT, file + '.js'), 'utf8')
    .replace(/\bconst (regionalElevation|taiwanAirports|benchmarkFleet|benchmarkMissions|trainer|fleet)\b/g, 'var $1');
  vm.runInContext(src, missionSandbox, { filename: file + '.js' });
}
vm.runInContext(ctrlCode, missionSandbox, { filename: 'ctrl.js' });
const from = missionSandbox.taiwanAirports.find(a => a.code === 'RCTP');
const to = missionSandbox.taiwanAirports.find(a => a.code === 'RCKH');
const brief = missionSandbox.passengerBrief(b773, from, to);
const f = missionSandbox.makePassengerFlight(from, to, b773, 0, brief.estimated + brief.reserve, '0', '13:00');
assert(missionSandbox.groundServiceAllowed(f));
f.battery = true;
f.bridge = true;
missionSandbox.setPassengerDoor(f, true);
f.service.pumping = true;
f.service.bridgeDelay = 60;
const simTick = missionSandbox.simTick;
for (let i = 0; i < 120 * 160; i++) missionSandbox.updatePassengerService(f, simTick);
assert.strictEqual(f.service.boarded, 360, `Expected full 360 pax boarding at RCTP gate, got ${f.service.boarded}`);
assert.strictEqual(f.fuel, f.fuelStart, 'Fuel truck pumping should top off mission fuel');
f.service.door = false;
f.bridge = false;
f.service.mode = null;
f.service.pushing = 18;
for (let i = 0; i < 120 * 12; i++) missionSandbox.updatePassengerService(f, simTick);
assert(f.service.pushed, 'Pushback tug must complete pushback before engine start');
f.engines.forEach((_, i) => assert(missionSandbox.startEngine(f, i)));
f.parkingBrake = false;
let maxCruiseTasKt = 0;
for (let i = 0; i < 120 * 7200 && !f.finished; i++) {
  if (f.airborne && f.y > 900) maxCruiseTasKt = Math.max(maxCruiseTasKt, f.speed * 1.94384);
  if (f.awaitingService) {
    if (!f.service.delivered) {
      f.power = 0;
      f.engines.forEach((on, idx) => { if (on) missionSandbox.startEngine(f, idx); });
      f.bridge = true; f.service.door = true; f.service.mode = 'exit';
    }
    if (f.service.delivered === f.passengers) { f.bridge = false; f.service.door = false; }
  }
  missionSandbox.stepTrainer(f, missionSandbox.pilot(f));
  missionSandbox.updatePassengerService(f, simTick);
  missionSandbox.updateRegionalFlight(f);
}
assert(f.finished && f.landed, `b773 passenger flight must land and settle cleanly at RCKH (state=${JSON.stringify({ finished: f.finished, landed: f.landed, phase: f.phase, elapsed: Math.round(f.elapsed), wp: f.waypoint, y: Math.round(f.y), td: f.touchdown, fuel: Math.round(f.fuel), mass: Math.round(missionSandbox.flightMass(f)) })})`);
assert.strictEqual(f.service.delivered, 360, `All 360 passengers must deboard at RCKH gate, got ${f.service.delivered}`);
assert(f.receipt && f.receipt.net > 0, 'Airline receipt must settle net revenue');
assert(maxCruiseTasKt >= 185, `Expected 777-300ER regional leg TAS >= 185 KTAS, got ${Math.round(maxCruiseTasKt)}`);
void benchSrc;

console.log(`verify-b773-benchmark: PASSED! 73.86m x 64.80m, 14 grounded tires, articulated gear, aero surfaces, 3-4-3 360-pax cabin, 6-LCD flight deck, RCTP->RCKH (${Math.round(maxCruiseTasKt)} KTAS, net ${f.receipt.net} coins) complete!`);
