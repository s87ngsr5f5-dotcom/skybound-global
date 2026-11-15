'use strict';
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.join(__dirname, 'dist');
const THREE = require(path.join(ROOT, 'three.js'));

function makeCanvas() {
  const ctx = {
    fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, font: '12px sans-serif',
    textAlign: 'left', textBaseline: 'alphabetic', globalAlpha: 1, shadowBlur: 0, shadowColor: '#000',
    fillRect() {}, strokeRect() {}, clearRect() {}, rect() {}, roundRect() {}, beginPath() {}, closePath() {},
    moveTo() {}, lineTo() {}, quadraticCurveTo() {}, bezierCurveTo() {}, arc() {}, ellipse() {},
    fill() {}, stroke() {}, fillText() {}, strokeText() {}, save() {}, restore() {}, translate() {},
    rotate() {}, scale() {}, clip() {}, setLineDash() {},
    measureText: (t) => ({ width: String(t).length * 8 }),
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
    drawImage() {},
    getImageData: () => ({ data: new Uint8ClampedArray(16) })
  };
  return { width: 256, height: 256, getContext: () => ctx };
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
  code = code.replace(/\bconst (trainer|fleet|benchmarkFleet|expansionFleet|fleetCategories|specialAircraft|aircraftSkins|cockpitEnhancements|cockpitElectrical|airRefueling)\b/g, 'var $1');
  vm.runInContext(code, sandbox, { filename: name });
}

for (const f of [
  'physics.js', 'fleet.js', 'aero-aircraft.js', 'benchmarks.js', 'b773-highdef.js', 'b748f-highdef.js', 'f16-highdef.js', 'an124-highdef.js', 'benchmark-models.js',
  'helicopter.js', 'fleet-expansion.js', 'fighter-refinement.js',
  'airliner-refinement.js', 'aircraft-skins.js', 'cockpit-enhancements.js',
  'cockpit-electrical.js', 'air-refueling.js'
]) {
  runDist(f);
}

const flightSrc = fs.readFileSync(path.join(ROOT, 'flight.js'), 'utf8');
const maStart = flightSrc.indexOf('  function makeAircraft(profile,index){');
assert(maStart >= 0, 'makeAircraft definition not found in flight.js');
let ma = flightSrc.slice(maStart);
let depth = 0, endIdx = -1;
for (let i = ma.indexOf('{'); i < ma.length; i++) {
  if (ma[i] === '{') depth++;
  else if (ma[i] === '}' && --depth === 0) { endIdx = i + 1; break; }
}
vm.runInContext(ma.slice(0, endIdx), sandbox, { filename: 'flight_makeAircraft.js' });

assert.strictEqual(sandbox.fleet.length, 100, `Expected 100 aircraft in fleet, got ${sandbox.fleet.length}`);

const failures = [];
const vTmp = new THREE.Vector3();

for (let i = 0; i < sandbox.fleet.length; i++) {
  const p = sandbox.fleet[i];
  const scene = new THREE.Scene();
  sandbox.scene = scene;
  const model = p.helicopter
    ? sandbox.buildHelicopter(p, scene)
    : (p.role ? sandbox.buildBenchmarkAirframe(p, scene) : sandbox.makeAircraft(p, i));
  if (p.role === 'fighter' && !model.userData?.skipGenericFighterRefinement) sandbox.refineFighter(model, p);
  if (sandbox.aircraftSkins) sandbox.aircraftSkins.applyLivery(model, p, THREE);
  if (p.id === 'b773' && typeof sandbox.refineB773FlightDeck === 'function') {
    sandbox.refineB773FlightDeck(model, p);
  } else if (p.id === 'sf748' && typeof sandbox.refineB748FFlightDeck === 'function') {
    sandbox.refineB748FFlightDeck(model, p);
  } else if (p.id === 'an124' && typeof sandbox.refineAn124FlightDeck === 'function') {
    sandbox.refineAn124FlightDeck(model, p);
  } else if (p.role === 'passenger' || p.role === 'cargo') {
    sandbox.refineAirliner(model, { twin: (p.geometry[4] ?? 2) === 2 });
  }
  if (sandbox.cockpitEnhancements) sandbox.cockpitEnhancements.enhanceCockpit(model, p, THREE);
  if (sandbox.cockpitElectrical && model.userData?.cabin) {
    sandbox.cockpitElectrical.buildSwitchPanel(THREE, model.userData.cabin, p.role === 'fighter', p);
  }
  model.updateMatrixWorld(true);
  if (model.userData?.cabin) model.userData.cabin.updateMatrixWorld(true);

  const isDescendant = (obj, ancestor) => {
    for (let cur = obj; cur; cur = cur.parent) if (cur === ancestor) return true;
    return false;
  };
  const [half, radius] = p.geometry;
  const gearBox = model.userData?.gear ? new THREE.Box3().setFromObject(model.userData.gear) : null;
  const plumes = new Set(model.userData?.exhaustPlumes || []);
  const propDiscs = new Set(model.userData?.propDiscs || []);
  const glassMeshes = [];
  const glareMeshes = [];
  const opaqueMeshes = [];

  model.traverse((obj) => {
    if (!obj.isMesh || !obj.geometry || plumes.has(obj) || propDiscs.has(obj)) return;
    if (obj.parent && (plumes.has(obj.parent) || obj.parent.name === 'exhaustPlumes')) return;
    const mat = Array.isArray(obj.material) ? obj.material[0] : obj.material;
    const name = obj.name || '';
    if (name === 'Windshield_Glare' || name === 'Cockpit_Placards') {
      glareMeshes.push(obj); return;
    }
    if (obj.parent?.name === 'AircraftSkins_Decals') return;
    if (isDescendant(obj, model.userData?.cabin)) return;
    if (name.includes('window') || name.includes('Window')) return;
    const isCanopyMat = (mat === sandbox.windowMat) || /canopy|glass|windshield/i.test(name) ||
      (model.userData?.cockpitGlassMats?.includes(mat) && obj !== model && !name.includes('wing'));
    if (isCanopyMat || (mat && mat.transparent && mat.opacity > 0.3 && mat.opacity < 0.92 && mat.color && (mat.color.b > mat.color.r || mat.clearcoat > 0.5))) {
      const box = new THREE.Box3().setFromObject(obj);
      const sz = box.getSize(new THREE.Vector3());
      if (sz.x > 0.3 && sz.z > 0.3) {
        glassMeshes.push({ name: name || 'glass', box, sz });
        return;
      }
    }
    if (!isDescendant(obj, model.userData?.gear)) {
      opaqueMeshes.push(obj);
    }
  });

  function maxFuseYInZRange(zMin, zMax, xTol) {
    let bestY = null;
    for (const m of opaqueMeshes) {
      if (m.name?.includes('wing') || m.name?.includes('fin') || m.name?.includes('stabilator') || m.name?.includes('canard') || m.name?.includes('rotor') || m.parent?.name?.includes('engine')) continue;
      const pos = m.geometry.attributes.position;
      if (!pos) continue;
      for (let vi = 0; vi < pos.count; vi++) {
        vTmp.fromBufferAttribute(pos, vi).applyMatrix4(m.matrixWorld);
        if (vTmp.z >= zMin && vTmp.z <= zMax && Math.abs(vTmp.x) <= xTol) {
          if (bestY === null || vTmp.y > bestY) bestY = vTmp.y;
        }
      }
    }
    return bestY;
  }

  const issues = [];
  for (const g of glassMeshes) {
    const fuseTopY = maxFuseYInZRange(g.box.min.z - 0.35, g.box.max.z + 0.35, Math.max(0.25, radius * 0.35));
    if (fuseTopY !== null) {
      const protrude = g.box.max.y - fuseTopY;
      const limit = p.role === 'fighter' ? 0.25 : 0.14;
      if (protrude > limit) issues.push(`canopy_protrude=${protrude.toFixed(2)}>${limit}`);
    }
    if (g.sz.x > radius * 2.02) issues.push(`glassW=${g.sz.x.toFixed(2)}>2r`);
  }

  for (const b of (model.userData?.blades || [])) {
    b.updateMatrixWorld(true);
    const bsz = new THREE.Box3().setFromObject(b).getSize(new THREE.Vector3());
    if (!p.jet && bsz.z > 0.65 && bsz.x < bsz.z * 0.55) issues.push(`propSpearZ=${bsz.z.toFixed(2)}`);
  }

  if (gearBox && !gearBox.isEmpty() && !p.externalModel) {
    const gd = Math.abs(gearBox.min.y + p.gearHeight);
    if (gd > 0.12) issues.push(`gearDiff=${gd.toFixed(2)}`);
  }

  let nonGearMinY = Infinity;
  let lowestPart = '';
  model.traverse((obj) => {
    if (!obj.isMesh || !obj.geometry || plumes.has(obj) || propDiscs.has(obj)) return;
    if (isDescendant(obj, model.userData?.gear)) return;
    if (isDescendant(obj, model.userData?.cabin)) return;
    const box = new THREE.Box3().setFromObject(obj);
    if (box.min.y < nonGearMinY) { nonGearMinY = box.min.y; lowestPart = obj.name || obj.geometry.type; }
  });
  if (nonGearMinY < -p.gearHeight + 0.05 && !p.externalModel) {
    issues.push(`lowClearance=${(nonGearMinY + p.gearHeight).toFixed(2)}(${lowestPart})`);
  }

  model.traverse((obj) => {
    if (!obj.isMesh || !obj.parent?.name?.includes('wing engine')) return;
    const ebox = new THREE.Box3().setFromObject(obj);
    let wingTop = -Infinity, found = false;
    for (const m of opaqueMeshes) {
      if (!m.name?.includes('main wing')) continue;
      const pos = m.geometry.attributes.position;
      for (let vi = 0; vi < pos.count; vi++) {
        vTmp.fromBufferAttribute(pos, vi).applyMatrix4(m.matrixWorld);
        if (vTmp.x >= ebox.min.x - 0.5 && vTmp.x <= ebox.max.x + 0.5 && vTmp.z >= ebox.min.z - 0.5 && vTmp.z <= ebox.max.z + 0.5) {
          if (vTmp.y > wingTop) { wingTop = vTmp.y; found = true; }
        }
      }
    }
    if (found && ebox.max.y > wingTop + 0.03 && !p.overwingEngines) {
      issues.push(`pylonPokeWing=+${(ebox.max.y - wingTop).toFixed(2)}`);
    }
  });

  for (const gb of glareMeshes) {
    const sz = new THREE.Box3().setFromObject(gb).getSize(new THREE.Vector3());
    if (sz.x > radius * 2.02) issues.push(`glareW=${sz.x.toFixed(2)}>2r`);
  }

  // Ensure airliner MFD screen stays unobscured in front of its console housing
  if ((p.role === 'passenger' || p.role === 'cargo') && model.userData?.cabin) {
    let mfdZ = null, consoleMaxZ = -Infinity;
    const cockpitZ = model.userData?.b773HighDef ? -29.95 : model.userData?.b748fHighDef ? -29.90 : model.userData?.an124HighDef ? -24.45 : -half * 0.56;
    model.userData.cabin.traverse((o) => {
      if (!o.isMesh || !o.geometry) return;
      const b = new THREE.Box3().setFromObject(o);
      const sz = b.getSize(new THREE.Vector3());
      if (o.geometry.type === 'PlaneGeometry' && sz.x > 2.5 && Math.abs(b.min.z - cockpitZ) < 2.0) {
        mfdZ = (b.min.z + b.max.z) * 0.5;
      } else if (o.geometry.type === 'BoxGeometry' && sz.x > 3.2 && sz.y > 0.8 && sz.z < 1.0 && Math.abs(b.max.z - cockpitZ) < 2.0) {
        if (b.max.z > consoleMaxZ) consoleMaxZ = b.max.z;
      }
    });
    if (mfdZ !== null && consoleMaxZ > -Infinity && mfdZ <= consoleMaxZ) {
      issues.push(`mfd_buried(mfdZ=${mfdZ.toFixed(2)}<=consoleMaxZ=${consoleMaxZ.toFixed(2)})`);
    }
  }

  if (issues.length) failures.push(`${p.id}: ${issues.join(', ')}`);
}

assert.strictEqual(failures.length, 0, `Aircraft geometry/clipping failures:\n  ${failures.join('\n  ')}`);

// Check KC-135 Tanker geometry
const tankerScene = new THREE.Scene();
const tankerGroup = sandbox.airRefueling.buildTanker3D(THREE, tankerScene);
tankerGroup.updateMatrixWorld(true);
const tankerState = sandbox.airRefueling.state;
assert(tankerState.boomMesh.rotation.x > 0, `KC-135 boom must pitch downward (+x > 0), got ${tankerState.boomMesh.rotation.x}`);

// Check external GLB & AW101 ground clearance guards in source
const dlSrc = fs.readFileSync(path.join(ROOT, 'downloaded-aircraft.js'), 'utf8');
const dlBoxIdx = dlSrc.lastIndexOf('new THREE.Box3().setFromObject(object)');
const dlAddIdx = dlSrc.search(/^\s*model\.add\(object\)/m);
assert(dlBoxIdx !== -1, 'downloaded-aircraft.js must measure Box3 ground clearance');
assert(dlAddIdx > dlBoxIdx, 'downloaded-aircraft.js must call Box3().setFromObject(object) BEFORE model.add(object)');
assert(dlSrc.includes('for(const child of [...model.children])'), 'downloaded-aircraft.js must isolate legacy children inside legacy group');
const heliSrc = fs.readFileSync(path.join(ROOT, 'helicopter.js'), 'utf8');
const heliBoxIdx = heliSrc.indexOf('new THREE.Box3().setFromObject(obj)');
const heliAddIdx = heliSrc.search(/^\s*root\.add\(obj\)/m);
assert(heliBoxIdx !== -1 && heliAddIdx > heliBoxIdx, 'helicopter.js must call Box3().setFromObject(obj) on AW101 BEFORE root.add(obj)');
assert(heliSrc.includes('-profile.gearHeight - bounds.min.y'), 'helicopter.js must anchor AW101 GLB using Box3 bounds');

console.log('verify-no-clipping: PASSED 100/100 fleet aircraft + KC-135 tanker + GLB clearance checks!');
