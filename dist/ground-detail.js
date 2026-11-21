'use strict';

/**
 * SKYBOUND GLOBAL - Close-Range 3D Ground Clutter Ring (Zero-Lag 4-Draw-Call GPU Instancing)
 * Reads live satellite imagery (__SKYBOUND_SAT_SAMPLER), terrain height, and terrain slope
 * to populate a closest-first 0-2,400m ring around the aircraft (ultra-lush 0-900m grass/shrubs,
 * extending 3D trees & cliff rocks to 2,400m) with strict <=1.6ms time-sliced rebuilds,
 * zero per-frame allocations, and smooth outer-25% distance scale-out.
 */
function createGroundDetailRing(scene, ground, airports = []) {
  const isLowMem = typeof navigator !== 'undefined' && (
    /iPhone|iPad|iPod|Android/i.test(navigator.userAgent || '') ||
    (navigator.deviceMemory && navigator.deviceMemory <= 4)
  );

  const CELL = 28;
  const INNER_RADIUS = isLowMem ? 340 : 480;
  const GROUND_RADIUS = isLowMem ? 560 : 900;
  const RADIUS = isLowMem ? 1200 : 2400;
  const REBUILD_DIST = isLowMem ? 70 : 75;
  const MAX_AGL = 1050;
  const FRAME_BUDGET_MS = 1.6;
  const MAX_GRASS = isLowMem ? 320 : 960;
  const MAX_SHRUB = isLowMem ? 180 : 480;
  const MAX_TREE = isLowMem ? 180 : 620;
  const MAX_ROCK = isLowMem ? 120 : 360;

  const groundFn = typeof ground === 'function'
    ? ground
    : (typeof terrainHeight === 'function' ? terrainHeight : () => 0);
  const airportList = Array.isArray(airports) && airports.length
    ? airports
    : (typeof allAirports !== 'undefined' && Array.isArray(allAirports) ? allAirports : []);

  const root = new THREE.Group();
  root.name = 'Close-range 3D ground detail';
  root.visible = false;
  if (scene && typeof scene.add === 'function') scene.add(root);

  // Pure deterministic integer hash -> [0, 1) (world-anchored, zero jitter across frames)
  function hash2(ix, iz) {
    let h = Math.imul(ix | 0, 374761393) ^ Math.imul(iz | 0, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function nowMs() {
    return typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now();
  }

  // Smooth cubic scale-out over the outer 25% of any ring radius (zero pop-in / pop-out)
  function smoothFade(dist, maxDist) {
    const fadeStart = maxDist * 0.75;
    if (dist <= fadeStart) return 1.0;
    if (dist >= maxDist) return 0.0;
    const t = (maxDist - dist) / (maxDist - fadeStart);
    return t * t * (3 - 2 * t);
  }

  // Precompute 3-tier world-anchored concentric grid offsets sorted strictly closest-first:
  //  - Tier 0 (0..480m, 28m stride): ultra-dense grass tufts, shrubs, trees & rocks
  //  - Tier 1 (480..900m, 56m even stride): dense meadow grass, shrubs, trees & rocks
  //  - Tier 2 (900..2,400m, 112m stride): crisp 3D forest trees & coastal/mountain rocks
  const cellOffsets = [];
  const span0 = Math.ceil((INNER_RADIUS + CELL) / CELL);
  for (let dz = -span0; dz <= span0; dz++) {
    for (let dx = -span0; dx <= span0; dx++) {
      const dist = Math.hypot(dx * CELL, dz * CELL);
      if (dist <= INNER_RADIUS + CELL) cellOffsets.push({ dx, dz, dist, tier: 0 });
    }
  }
  const span1 = Math.ceil((GROUND_RADIUS + CELL * 2) / CELL);
  const s1Min = Math.max(0, INNER_RADIUS - CELL * 2);
  const s1Max = GROUND_RADIUS + CELL * 2;
  for (let dz = -((span1 + 1) & ~1); dz <= ((span1 + 1) & ~1); dz += 2) {
    for (let dx = -((span1 + 1) & ~1); dx <= ((span1 + 1) & ~1); dx += 2) {
      const dist = Math.hypot(dx * CELL, dz * CELL);
      if (dist >= s1Min && dist <= s1Max) cellOffsets.push({ dx, dz, dist, tier: 1 });
    }
  }
  const span2 = Math.ceil((RADIUS + CELL * 4) / CELL);
  const s2Min = Math.max(0, GROUND_RADIUS - CELL * 4);
  const s2Max = RADIUS + CELL * 4;
  const s2Lim = (span2 + 3) & ~3;
  for (let dz = -s2Lim; dz <= s2Lim; dz += 4) {
    for (let dx = -s2Lim; dx <= s2Lim; dx += 4) {
      const dist = Math.hypot(dx * CELL, dz * CELL);
      if (dist >= s2Min && dist <= s2Max) cellOffsets.push({ dx, dz, dist, tier: 2 });
    }
  }
  cellOffsets.sort((a, b) => a.dist - b.dist || a.tier - b.tier);

  // ---------------------------------------------------------------------------
  // 1. Custom 3D Geometries (4 compact GPU buffers -> ONLY 4 draw calls total)
  // ---------------------------------------------------------------------------

  // Crossed multi-blade 3D grass tuft (6 radiating tapered blades with root-to-tip AO)
  function buildGrassTuftGeometry() {
    const geo = new THREE.BufferGeometry();
    const pos = [];
    const nrm = [];
    const col = [];

    function pushTri(ax, ay, az, bx, by, bz, cx, cy, cz, ca, cb, cc) {
      const ux = bx - ax, uy = by - ay, uz = bz - az;
      const vx = cx - ax, vy = cy - ay, vz = cz - az;
      let nx = uy * vz - uz * vy;
      let ny = uz * vx - ux * vz;
      let nz = ux * vy - uy * vx;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len; ny /= len; nz /= len;
      // Bias normal slightly upward so grass blends smoothly with terrain sunlight
      ny = clamp(ny * 0.5 + 0.72, 0.25, 1.0);
      const nLen = Math.hypot(nx, ny, nz) || 1;
      nx /= nLen; ny /= nLen; nz /= nLen;

      pos.push(ax, ay, az, bx, by, bz, cx, cy, cz);
      nrm.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
      col.push(ca[0], ca[1], ca[2], cb[0], cb[1], cb[2], cc[0], cc[1], cc[2]);
    }

    const bladeCount = 6;
    const baseCol = [0.58, 0.64, 0.52];
    const midCol = [0.84, 0.90, 0.78];
    const tipCol = [1.0, 1.0, 0.92];

    for (let i = 0; i < bladeCount; i++) {
      const angle = (i / bladeCount) * Math.PI * 2 + (i % 2) * 0.24;
      const cosA = Math.cos(angle), sinA = Math.sin(angle);
      const perpX = -sinA, perpZ = cosA;
      const h = 0.68 + (i % 3) * 0.16;
      const w = 0.26 + (i % 2) * 0.06;
      const lean = 0.26 + (i % 3) * 0.11;
      const rOff = 0.08 + (i % 2) * 0.06;

      const ox = cosA * rOff, oz = sinA * rOff;
      const bx0 = ox - perpX * w, bz0 = oz - perpZ * w;
      const bx1 = ox + perpX * w, bz1 = oz + perpZ * w;
      const mx = ox + cosA * (lean * 0.45), mz = oz + sinA * (lean * 0.45);
      const mw = w * 0.55;
      const mx0 = mx - perpX * mw, mz0 = mz - perpZ * mw;
      const mx1 = mx + perpX * mw, mz1 = mz + perpZ * mw;
      const tx = ox + cosA * lean, tz = oz + sinA * lean;
      const yMid = h * 0.52;

      pushTri(bx0, -0.05, bz0, bx1, -0.05, bz1, mx1, yMid, mz1, baseCol, baseCol, midCol);
      pushTri(bx0, -0.05, bz0, mx1, yMid, mz1, mx0, yMid, mz0, baseCol, midCol, midCol);
      pushTri(mx0, yMid, mz0, mx1, yMid, mz1, tx, h, tz, midCol, midCol, tipCol);
    }

    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    return geo;
  }

  // Organic faceted dodecahedron with grounded base & vertical AO vertex colors
  function buildFacetedGeometry(mode) {
    const geo = new THREE.DodecahedronGeometry(1, 0);
    const posAttr = geo.attributes && geo.attributes.position;
    if (posAttr && typeof posAttr.count === 'number' && posAttr.count > 0) {
      const colors = new Float32Array(posAttr.count * 3);
      for (let i = 0; i < posAttr.count; i++) {
        let vx = posAttr.getX(i);
        let vy = posAttr.getY(i);
        let vz = posAttr.getZ(i);

        // Deterministic organic distortion based on quantized direction so shared corners stay watertight
        const qx = Math.round(vx * 10), qy = Math.round(vy * 10), qz = Math.round(vz * 10);
        const jitter = hash2(qx * 19 + qy * 7, qz * 23 + qy * 13);

        if (mode === 'rock') {
          const radScale = 0.82 + jitter * 0.34;
          vx *= radScale;
          vz *= radScale;
          // Flatten underside slightly so rocks embed firmly into sloped ground
          vy = vy < 0 ? vy * 0.52 : vy * (0.76 + jitter * 0.32);
          vy += 0.28;
          posAttr.setXYZ(i, vx, vy, vz);
          const shade = clamp(0.62 + vy * 0.30 + (jitter - 0.5) * 0.14, 0.52, 1.05);
          colors[i * 3] = shade;
          colors[i * 3 + 1] = shade * 0.99;
          colors[i * 3 + 2] = shade * 0.97;
        } else {
          // Shrub crown: slightly fuller waist, soft bumpy silhouette, grounded around y=0
          const bushScale = 0.88 + jitter * 0.26;
          vx *= bushScale;
          vz *= bushScale;
          vy = vy * 0.72 + 0.56;
          posAttr.setXYZ(i, vx, vy, vz);
          const shade = clamp(0.58 + vy * 0.34 + (jitter - 0.5) * 0.12, 0.50, 1.05);
          colors[i * 3] = shade * 0.95;
          colors[i * 3 + 1] = shade * 1.02;
          colors[i * 3 + 2] = shade * 0.92;
        }
      }
      posAttr.needsUpdate = true;
      if (typeof geo.computeVertexNormals === 'function') geo.computeVertexNormals();
      geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    }
    return geo;
  }

  // Merged 2-tier close-up tree (woody trunk + lower canopy + sunlit crown, 1 single draw call)
  function buildTreeGeometry() {
    const geo = new THREE.BufferGeometry();
    const pos = [];
    const nrm = [];
    const col = [];

    function pushTri(ax, ay, az, bx, by, bz, cx, cy, cz, ca, cb, cc) {
      const ux = bx - ax, uy = by - ay, uz = bz - az;
      const vx = cx - ax, vy = cy - ay, vz = cz - az;
      let nx = uy * vz - uz * vy;
      let ny = uz * vx - ux * vz;
      let nz = ux * vy - uy * vx;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len; ny /= len; nz /= len;
      pos.push(ax, ay, az, bx, by, bz, cx, cy, cz);
      nrm.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
      col.push(ca[0], ca[1], ca[2], cb[0], cb[1], cb[2], cc[0], cc[1], cc[2]);
    }

    function addFrustum(segs, y0, y1, r0, r1, c0, c1, phase) {
      for (let i = 0; i < segs; i++) {
        const a0 = phase + (i / segs) * Math.PI * 2;
        const a1 = phase + ((i + 1) / segs) * Math.PI * 2;
        const cA0 = Math.cos(a0), sA0 = Math.sin(a0);
        const cA1 = Math.cos(a1), sA1 = Math.sin(a1);
        const ax = cA0 * r0, az = sA0 * r0;
        const bx = cA1 * r0, bz = sA1 * r0;
        if (r1 <= 0.001) {
          pushTri(ax, y0, az, bx, y0, bz, 0, y1, 0, c0, c0, c1);
        } else {
          const cx = cA1 * r1, cz = sA1 * r1;
          const dx = cA0 * r1, dz = sA0 * r1;
          pushTri(ax, y0, az, bx, y0, bz, cx, y1, cz, c0, c0, c1);
          pushTri(ax, y0, az, cx, y1, cz, dx, y1, dz, c0, c1, c1);
        }
      }
    }

    // Grounded tapered trunk (extends slightly below y=0 so trees never float on steep hills)
    addFrustum(6, -0.18, 0.42, 0.095, 0.055, [0.58, 0.38, 0.24], [0.76, 0.50, 0.30], 0.0);
    // Lower foliage tier + shaded underside skirt
    addFrustum(7, 0.28, 0.74, 0.50, 0.16, [0.36, 0.56, 0.30], [0.50, 0.74, 0.40], 0.15);
    addFrustum(7, 0.28, 0.25, 0.50, 0.06, [0.28, 0.42, 0.24], [0.24, 0.36, 0.20], 0.15);
    // Upper broadleaf/conical crown tier
    addFrustum(7, 0.54, 1.00, 0.39, 0.0, [0.46, 0.68, 0.36], [0.64, 0.88, 0.48], 0.60);

    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    return geo;
  }

  // ---------------------------------------------------------------------------
  // 2. Materials & Pre-allocated InstancedMeshes (Zero GC Churn)
  // ---------------------------------------------------------------------------

  const grassMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.94,
    metalness: 0.0,
    side: THREE.DoubleSide
  });
  const shrubMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.92,
    metalness: 0.0
  });
  const treeMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.90,
    metalness: 0.0
  });
  const rockMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.95,
    metalness: 0.04
  });

  const grassGeo = buildGrassTuftGeometry();
  const shrubGeo = buildFacetedGeometry('shrub');
  const treeGeo = buildTreeGeometry();
  const rockGeo = buildFacetedGeometry('rock');

  const grassInst = new THREE.InstancedMesh(grassGeo, grassMat, MAX_GRASS);
  const shrubInst = new THREE.InstancedMesh(shrubGeo, shrubMat, MAX_SHRUB);
  const treeInst = new THREE.InstancedMesh(treeGeo, treeMat, MAX_TREE);
  const rockInst = new THREE.InstancedMesh(rockGeo, rockMat, MAX_ROCK);

  grassInst.name = 'Ground detail grass tufts';
  shrubInst.name = 'Ground detail shrubs';
  treeInst.name = 'Ground detail close-up trees';
  rockInst.name = 'Ground detail rocks';

  const allMeshes = [grassInst, shrubInst, treeInst, rockInst];
  for (let i = 0; i < allMeshes.length; i++) {
    const m = allMeshes[i];
    m.count = 0;
    m.frustumCulled = false;
    m.castShadow = false;
    m.receiveShadow = true;
    root.add(m);
  }

  // ---------------------------------------------------------------------------
  // 3. Strict Airport & Runway Clearance
  // ---------------------------------------------------------------------------

  const LARGE_AIRPORTS = new Set([
    'RCSS', 'RCTP', 'RJAA', 'RCKH', 'RJTT', 'VHHH', 'ROAH', 'RKSI', 'WSSS', 'RPLL'
  ]);

  const rwCoordsOut = { along: 0, cross: 0 };
  function getRunwayCoords(x, z, ap) {
    if (typeof runwayCoordinates === 'function') {
      return runwayCoordinates(x, z, ap);
    }
    const dx = x - ap.x;
    const dz = z - ap.z;
    const s = Math.sin(ap.heading || 0);
    const c = Math.cos(ap.heading || 0);
    rwCoordsOut.along = dx * s - dz * c;
    rwCoordsOut.cross = dx * c + dz * s;
    return rwCoordsOut;
  }

  const airportParamCache = new Map();
  function airportParams(ap) {
    let cached = airportParamCache.get(ap);
    if (cached) return cached;
    const half = (ap.length || 2400) * 0.5;
    const width = ap.width || 45;
    const apron = ap.apron ?? 175;
    const side = Math.sign(apron) || 1;
    const local = Boolean(ap.shortField);
    const large = (!local && (ap.length || 0) >= 3400) || LARGE_AIRPORTS.has(ap.code);
    const gates = local ? 1 : large ? 8 : (ap.code === 'RCSS' || ap.code === 'RCMQ') ? 6 : 4;
    const gatePitch = local ? 27 : large ? 73 : 51;
    const apronLength = gates * gatePitch + (local ? 55 : 80);
    const terminalWidth = local ? 18 : large ? 88 : 60;
    const terminalX = apron + side * ((local ? 14.5 : large ? 82.5 : 68) + terminalWidth * 0.5);
    const apronZ = local ? -(ap.parkingAlong || 0) : -65;
    const apronOuter = Math.abs(terminalX) + terminalWidth * 0.5 + (local ? 45 : 110);
    cached = {
      ap,
      half,
      width,
      apron,
      side,
      local,
      apronLength,
      apronZ,
      apronOuter,
      reach: half + apronOuter + 420
    };
    airportParamCache.set(ap, cached);
    return cached;
  }

  const nearbyAirports = [];

  function refreshNearbyAirports(px, pz) {
    nearbyAirports.length = 0;
    for (let i = 0; i < airportList.length; i++) {
      const ap = airportList[i];
      if (!ap || !Number.isFinite(ap.x) || !Number.isFinite(ap.z)) continue;
      const maxReach = (ap.length || 2400) * 0.65 + Math.abs(ap.apron || 180) + RADIUS + 750;
      if (Math.abs(px - ap.x) <= maxReach && Math.abs(pz - ap.z) <= maxReach) {
        nearbyAirports.push(airportParams(ap));
      }
    }
  }

  /**
   * Returns:
   *  - 'paved': strictly forbidden (runway, overrun, shoulders, parallel/connector taxiways, apron, terminal, carrier)
   *  - 'verge': airfield grass infield / safety clearway (ALLOWS short grass tufts only; FORBIDS shrubs/trees/rocks)
   *  - 'open': outside airport bounds (all natural ground clutter allowed)
   */
  function checkAirportZone(x, z, list) {
    const activeList = list || nearbyAirports;
    let inVerge = false;
    for (let i = 0; i < activeList.length; i++) {
      const p = activeList[i];
      const ap = p.ap;
      if (Math.abs(x - ap.x) > p.reach || Math.abs(z - ap.z) > p.reach) continue;
      const { along, cross } = getRunwayCoords(x, z, ap);

      // Aircraft carrier deck & surrounding ship hull
      if (ap.carrier) {
        if (Math.abs(along) <= p.half + 160 && Math.abs(cross) <= 160) return 'paved';
        continue;
      }

      // 1. Runway strip + shoulders + blast pads / approach lighting overrun
      if (Math.abs(along) <= p.half + 95 && Math.abs(cross) <= p.width * 0.5 + 28) {
        return 'paved';
      }

      // 2. Parallel taxiway
      if (!p.local && Math.abs(along) <= p.half - 35 && Math.abs(cross - p.apron) <= 30) {
        return 'paved';
      }

      // 3. Cross-connector taxiways (flight.js local z maps to along = -z)
      const minC = Math.min(0, p.apron) - 14;
      const maxC = Math.max(0, p.apron) + 14;
      if (cross >= minC && cross <= maxC) {
        if (p.local) {
          if (Math.abs(along - (-p.apronZ)) <= 26) return 'paved';
        } else if (
          Math.abs(along - (-(p.half - 135))) <= 26 ||
          Math.abs(along - 440) <= 26 ||
          Math.abs(along - 950) <= 26
        ) {
          return 'paved';
        }
      }

      // 4. Apron, jetways, terminal building & landside pad
      const alongApron = -p.apronZ;
      const apronHalfLen = p.apronLength * 0.5 + (p.local ? 42 : 95);
      const cSide = cross * p.side;
      const apronInner = Math.abs(p.apron) - (p.local ? 28 : 55);
      if (Math.abs(along - alongApron) <= apronHalfLen && cSide >= apronInner && cSide <= p.apronOuter) {
        return 'paved';
      }

      // 5. Green airfield infield & obstacle-free safety perimeter (grass tufts allowed, NO tall obstacles)
      if (
        Math.abs(along) <= p.half + 320 &&
        cSide >= -(p.width * 0.5 + 220) &&
        cSide <= p.apronOuter + 140
      ) {
        inVerge = true;
      }
    }
    return inVerge ? 'verge' : 'open';
  }

  // ---------------------------------------------------------------------------
  // 4. Deterministic Rebuild Loop (Satellite + Height + Slope Driven)
  // ---------------------------------------------------------------------------

  const dummy = new THREE.Object3D();
  const tmpColor = new THREE.Color();
  const tmpMatrix = typeof THREE.Matrix4 === 'function' ? new THREE.Matrix4() : null;
  const tmpVec = typeof THREE.Vector3 === 'function' ? new THREE.Vector3() : null;
  const allMaterials = [grassMat, shrubMat, treeMat, rockMat];

  // Pre-allocated double-buffered staging typed arrays (zero per-frame GC allocations, flicker-free atomic swaps)
  const grassStageMat = new Float32Array(MAX_GRASS * 16);
  const grassStageCol = new Float32Array(MAX_GRASS * 3);
  const shrubStageMat = new Float32Array(MAX_SHRUB * 16);
  const shrubStageCol = new Float32Array(MAX_SHRUB * 3);
  const treeStageMat = new Float32Array(MAX_TREE * 16);
  const treeStageCol = new Float32Array(MAX_TREE * 3);
  const rockStageMat = new Float32Array(MAX_ROCK * 16);
  const rockStageCol = new Float32Array(MAX_ROCK * 3);

  let built = false;
  let lastX = 1e12;
  let lastZ = 1e12;
  let lastSatRev = -1;
  let lastDayRatio = -1;

  const buildState = {
    active: false,
    progressive: false,
    px: 0,
    pz: 0,
    baseGx: 0,
    baseGz: 0,
    base1X: 0,
    base1Z: 0,
    base2X: 0,
    base2Z: 0,
    cursor: 0,
    grassCount: 0,
    shrubCount: 0,
    treeCount: 0,
    rockCount: 0,
    satRev: 0,
    sampler: null
  };

  function stageInstance(stageMat, stageCol, idx, fallbackMesh) {
    const els = dummy.matrix && dummy.matrix.elements;
    if (els && els.length === 16) {
      const mOff = idx * 16;
      for (let k = 0; k < 16; k++) stageMat[mOff + k] = els[k];
    } else if (fallbackMesh && typeof fallbackMesh.setMatrixAt === 'function') {
      fallbackMesh.setMatrixAt(idx, dummy.matrix);
    }
    const cOff = idx * 3;
    stageCol[cOff] = tmpColor.r;
    stageCol[cOff + 1] = tmpColor.g;
    stageCol[cOff + 2] = tmpColor.b;
  }

  function commitMeshBuffer(mesh, stageMat, stageCol, count) {
    if (count > 0) {
      const matAttr = mesh.instanceMatrix;
      if (matAttr && matAttr.array) {
        const dst = matAttr.array;
        const mLen = count * 16;
        for (let i = 0; i < mLen; i++) dst[i] = stageMat[i];
      } else if (tmpMatrix && tmpMatrix.elements && typeof mesh.setMatrixAt === 'function') {
        const te = tmpMatrix.elements;
        for (let i = 0; i < count; i++) {
          const off = i * 16;
          for (let k = 0; k < 16; k++) te[k] = stageMat[off + k];
          mesh.setMatrixAt(i, tmpMatrix);
        }
      }
      if (!mesh.instanceColor && typeof mesh.setColorAt === 'function') {
        tmpColor.setRGB(stageCol[0], stageCol[1], stageCol[2]);
        mesh.setColorAt(0, tmpColor);
      }
      const colAttr = mesh.instanceColor;
      if (colAttr && colAttr.array) {
        const dstC = colAttr.array;
        const cLen = count * 3;
        for (let i = 0; i < cLen; i++) dstC[i] = stageCol[i];
      } else if (typeof mesh.setColorAt === 'function') {
        for (let i = 0; i < count; i++) {
          const off = i * 3;
          tmpColor.setRGB(stageCol[off], stageCol[off + 1], stageCol[off + 2]);
          mesh.setColorAt(i, tmpColor);
        }
      }
    }
    mesh.count = count;
    if (mesh.instanceMatrix) mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  function commitAllStaged() {
    commitMeshBuffer(grassInst, grassStageMat, grassStageCol, buildState.grassCount);
    commitMeshBuffer(shrubInst, shrubStageMat, shrubStageCol, buildState.shrubCount);
    commitMeshBuffer(treeInst, treeStageMat, treeStageCol, buildState.treeCount);
    commitMeshBuffer(rockInst, rockStageMat, rockStageCol, buildState.rockCount);
  }

  function applyDaylight(dayRatio) {
    const d = clamp(Number.isFinite(dayRatio) ? dayRatio : 1, 0, 1);
    if (Math.abs(d - lastDayRatio) < 0.015) return;
    lastDayRatio = d;
    // Smooth transition: moonlit blue-gray night -> warm golden dusk -> crisp neutral daylight
    const dusk = Math.sin(d * Math.PI) * 0.14;
    const r = clamp(0.24 + d * 0.76 + dusk * 0.9, 0.20, 1.04);
    const g = clamp(0.28 + d * 0.72 + dusk * 0.35, 0.24, 1.02);
    const b = clamp(0.36 + d * 0.64 - dusk * 0.35, 0.28, 1.02);
    for (let i = 0; i < allMaterials.length; i++) {
      allMaterials[i].color.setRGB(r, g, b);
    }
  }

  function setGrassColorFromSat(sat, hVar) {
    if (sat && sat.a > 80) {
      const nr = sat.r / 255;
      const ng = sat.g / 255;
      const nb = sat.b / 255;
      const boost = 1.12 + (hVar - 0.5) * 0.18;
      tmpColor.setRGB(
        clamp(nr * 0.96 * boost + 0.05, 0.18, 0.78),
        clamp(ng * 1.12 * boost + 0.07, 0.26, 0.88),
        clamp(nb * 0.88 * boost + 0.03, 0.10, 0.56)
      );
    } else {
      tmpColor.setRGB(
        0.34 + hVar * 0.14,
        0.50 + hVar * 0.16,
        0.22 + hVar * 0.08
      );
    }
  }

  function setShrubColorFromSat(sat, hVar, arid) {
    if (arid) {
      tmpColor.setRGB(
        0.44 + hVar * 0.12,
        0.48 + hVar * 0.10,
        0.28 + hVar * 0.08
      );
      return;
    }
    if (sat && sat.a > 80) {
      const nr = sat.r / 255;
      const ng = sat.g / 255;
      const nb = sat.b / 255;
      const boost = 1.05 + (hVar - 0.5) * 0.22;
      tmpColor.setRGB(
        clamp(nr * 0.88 * boost + 0.04, 0.14, 0.58),
        clamp(ng * 1.08 * boost + 0.06, 0.24, 0.72),
        clamp(nb * 0.82 * boost + 0.03, 0.10, 0.44)
      );
    } else {
      tmpColor.setRGB(
        0.24 + hVar * 0.10,
        0.42 + hVar * 0.14,
        0.18 + hVar * 0.07
      );
    }
  }

  function setTreeTintFromSat(sat, hVar) {
    // Vertex colors already carry brown trunk & deep foliage hues; keep tint lively so bark stays distinct
    if (sat && sat.a > 80) {
      const nr = sat.r / 255;
      const ng = sat.g / 255;
      const nb = sat.b / 255;
      const greenRatio = ng / Math.max(0.08, (nr + ng + nb) / 3);
      tmpColor.setRGB(
        clamp(0.56 + nr * 0.42 + (hVar - 0.5) * 0.14, 0.52, 0.92),
        clamp(0.68 + ng * 0.45 * clamp(greenRatio, 0.85, 1.25) + (hVar - 0.5) * 0.16, 0.66, 1.05),
        clamp(0.50 + nb * 0.38 + (hVar - 0.5) * 0.12, 0.46, 0.84)
      );
    } else {
      tmpColor.setRGB(
        0.66 + hVar * 0.12,
        0.82 + hVar * 0.14,
        0.58 + hVar * 0.10
      );
    }
  }

  function setRockColorFromSat(sat, hVar, coastal) {
    if (sat && sat.a > 80) {
      const nr = sat.r / 255;
      const ng = sat.g / 255;
      const nb = sat.b / 255;
      const avg = (nr + ng + nb) / 3;
      const tone = 0.74 + (hVar - 0.5) * 0.20;
      tmpColor.setRGB(
        clamp((nr * 0.65 + avg * 0.35) * tone + 0.16, 0.28, 0.78),
        clamp((ng * 0.65 + avg * 0.35) * tone + 0.15, 0.27, 0.75),
        clamp((nb * 0.62 + avg * 0.38) * tone + 0.14, 0.25, 0.72)
      );
    } else if (coastal) {
      tmpColor.setRGB(0.38 + hVar * 0.12, 0.39 + hVar * 0.12, 0.41 + hVar * 0.12);
    } else {
      tmpColor.setRGB(0.46 + hVar * 0.14, 0.44 + hVar * 0.13, 0.41 + hVar * 0.12);
    }
  }

  function beginRebuild(px, pz, satRev) {
    refreshNearbyAirports(px, pz);
    const baseGx = Math.floor(px / CELL);
    const baseGz = Math.floor(pz / CELL);
    buildState.active = true;
    buildState.progressive = !built;
    buildState.px = px;
    buildState.pz = pz;
    buildState.baseGx = baseGx;
    buildState.baseGz = baseGz;
    buildState.base1X = baseGx & ~1;
    buildState.base1Z = baseGz & ~1;
    buildState.base2X = baseGx & ~3;
    buildState.base2Z = baseGz & ~3;
    buildState.cursor = 0;
    buildState.grassCount = 0;
    buildState.shrubCount = 0;
    buildState.treeCount = 0;
    buildState.rockCount = 0;
    buildState.satRev = satRev;
    buildState.sampler = typeof window !== 'undefined' && typeof window.__SKYBOUND_SAT_SAMPLER === 'function'
      ? window.__SKYBOUND_SAT_SAMPLER
      : null;
  }

  function stepRebuild(budgetMs) {
    const tStart = nowMs();
    const sampler = buildState.sampler;
    const bPx = buildState.px;
    const bPz = buildState.pz;
    const totalCells = cellOffsets.length;

    let grassCount = buildState.grassCount;
    let shrubCount = buildState.shrubCount;
    let treeCount = buildState.treeCount;
    let rockCount = buildState.rockCount;
    let cursor = buildState.cursor;
    let processed = 0;
    let allFull = false;

    while (cursor < totalCells) {
      if (
        grassCount >= MAX_GRASS &&
        shrubCount >= MAX_SHRUB &&
        treeCount >= MAX_TREE &&
        rockCount >= MAX_ROCK
      ) {
        allFull = true;
        break;
      }

      if ((processed & 7) === 0 && processed > 0 && (nowMs() - tStart) >= budgetMs) {
        break;
      }
      processed++;

      const off = cellOffsets[cursor++];
      const tier = off.tier;

      // Skip outer tier early if tree & rock budgets are already saturated
      if (tier === 2 && treeCount >= MAX_TREE && rockCount >= MAX_ROCK) {
        allFull = (grassCount >= MAX_GRASS && shrubCount >= MAX_SHRUB);
        if (allFull) break;
        continue;
      }

      const gx = (tier === 0 ? buildState.baseGx : tier === 1 ? buildState.base1X : buildState.base2X) + off.dx;
      const gz = (tier === 0 ? buildState.baseGz : tier === 1 ? buildState.base1Z : buildState.base2Z) + off.dz;

      const h0 = hash2(gx, gz);
      const h1 = hash2(gx * 3 + 17, gz * 5 - 31);
      const h2 = hash2(gx * 7 - 11, gz * 11 + 29);
      const h3 = hash2(gx * 13 + 43, gz * 17 - 19);

      // World-anchored position inside this deterministic cell
      const wx = (gx + 0.14 + h0 * 0.72) * CELL;
      const wz = (gz + 0.14 + h1 * 0.72) * CELL;

      // Exact radial distance from rebuild center (disjoint tier intervals guarantee zero duplicates & zero gaps)
      const actualDist = Math.hypot(wx - bPx, wz - bPz);
      if (tier === 0) {
        if (actualDist > INNER_RADIUS) continue;
      } else if (tier === 1) {
        if (actualDist <= INNER_RADIUS || actualDist > GROUND_RADIUS) continue;
      } else {
        if (actualDist <= GROUND_RADIUS || actualDist > RADIUS) continue;
      }

      const outerFade = smoothFade(actualDist, RADIUS);
      if (outerFade < 0.05) continue;
      const groundFade = tier < 2 ? smoothFade(actualDist, GROUND_RADIUS) : 0.0;

      const gY = groundFn(wx, wz);
      if (!Number.isFinite(gY) || gY < 1.15 || gY > 3400) continue;

      const zone = checkAirportZone(wx, wz, nearbyAirports);
      if (zone === 'paved') continue;

      // Local terrain slope over 12m baseline
      const gxH = groundFn(wx + 12, wz);
      const gzH = groundFn(wx, wz + 12);
      const slope = Math.hypot(gxH - gY, gzH - gY) / 12;

      const sat = sampler ? sampler(wx, wz) : null;
      const hasSat = Boolean(sat && sat.a > 80);

      let isWater = false;
      let isUrban = false;
      let isDarkForest = false;
      let isGreenGrass = false;
      let isAridRocky = false;

      if (hasSat) {
        const lum = sat.r + sat.g + sat.b;
        const maxC = Math.max(sat.r, sat.g, sat.b);
        const minC = Math.min(sat.r, sat.g, sat.b);
        const chroma = maxC - minC;

        if ((sat.b > sat.r * 1.12 && sat.b > sat.g * 1.03 && sat.r < 110) || (lum < 78 && gY < 6)) {
          isWater = true;
        } else if (
          (chroma < 18 && lum < 215 && sat.g <= sat.r + 6) ||
          (chroma < 22 && lum > 375 && sat.g <= sat.r * 1.03)
        ) {
          isUrban = true;
        } else if (
          sat.g > sat.r * 1.06 &&
          sat.g > sat.b * 1.08 &&
          sat.g >= 38 &&
          sat.g <= 116 &&
          sat.r < 96 &&
          lum < 285
        ) {
          isDarkForest = true;
        } else if (
          (sat.g > sat.r * 1.02 && sat.g > sat.b * 1.05 && sat.g > 54) ||
          (sat.g >= sat.r * 0.94 && sat.g > sat.b * 1.16 && sat.r > 68 && sat.g > 70 && lum < 455)
        ) {
          isGreenGrass = true;
        } else if (sat.r > 116 && sat.g > 82 && (sat.r - sat.b) > 22 && sat.r >= sat.g) {
          isAridRocky = true;
        }
      }

      if (isWater) continue;

      // Airfield green grass infield / verges: ONLY short mowed grass tufts, NEVER trees/shrubs/rocks
      if (zone === 'verge') {
        if (groundFade >= 0.05 && grassCount < MAX_GRASS && (!hasSat || (!isUrban && (isGreenGrass || isDarkForest || sat.g >= sat.r * 0.92)))) {
          if (h2 < 0.78) {
            const scaleW = (1.15 + h3 * 1.05) * groundFade;
            const scaleH = (0.55 + h2 * 0.45) * groundFade; // Kept low & realistic beside runways
            if (tmpVec) tmpVec.set(wx, gY - 0.04, wz);
            dummy.position.set(wx, gY - 0.04, wz);
            dummy.rotation.set(0, h1 * Math.PI * 2, 0);
            dummy.scale.set(scaleW, scaleH, scaleW);
            dummy.updateMatrix();
            setGrassColorFromSat(sat, h3);
            stageInstance(grassStageMat, grassStageCol, grassCount, grassInst);
            grassCount++;
          }
        }
        continue;
      }

      // Open terrain outside airport obstacle zones
      const isCoastalCliff = gY > 1.5 && gY < 14 && slope > 0.12;
      const isSteepSlope = slope > 0.20;

      // 1. Rocks / angular boulders on steep mountain slopes, coastal cliffs, and arid/rocky pixels
      if (rockCount < MAX_ROCK && (isSteepSlope || isCoastalCliff || (isAridRocky && h2 < 0.42))) {
        const rockProb = isSteepSlope ? 0.68 : isCoastalCliff ? 0.58 : 0.34;
        if (h2 < rockProb) {
          const baseScale = (isSteepSlope ? (1.4 + h3 * 2.4) : (0.9 + h3 * 1.6)) * outerFade;
          dummy.position.set(wx, gY - baseScale * 0.24, wz);
          dummy.rotation.set((h0 - 0.5) * 0.35, h1 * Math.PI * 2, (h2 - 0.5) * 0.35);
          dummy.scale.set(
            baseScale * (0.85 + h0 * 0.55),
            baseScale * (0.52 + h1 * 0.42),
            baseScale * (0.80 + h2 * 0.55)
          );
          dummy.updateMatrix();
          setRockColorFromSat(sat, h3, isCoastalCliff);
          stageInstance(rockStageMat, rockStageCol, rockCount, rockInst);
          rockCount++;
          if (isSteepSlope && slope > 0.34) continue;
        }
      }

      if (isUrban) continue;

      // 2. Crisp 2-tier close-up trees strictly on dark-green forest / hillside pixels
      const allowFallbackTree = !hasSat && gY > 35 && gY < 2200 && slope <= 0.45 && h2 < 0.24;
      if (
        treeCount < MAX_TREE &&
        gY > 1.8 &&
        gY < 2600 &&
        slope <= 0.58 &&
        (isDarkForest || allowFallbackTree)
      ) {
        if (h2 < (isDarkForest ? 0.66 : 0.24)) {
          const treeH = (7.2 + h3 * 7.8) * outerFade;
          const treeW = treeH * (0.48 + h0 * 0.16);
          dummy.position.set(wx, gY - 0.18 * outerFade, wz);
          dummy.rotation.set((h0 - 0.5) * 0.06, h1 * Math.PI * 2, (h2 - 0.5) * 0.06);
          dummy.scale.set(treeW, treeH, treeW);
          dummy.updateMatrix();
          setTreeTintFromSat(sat, h3);
          stageInstance(treeStageMat, treeStageCol, treeCount, treeInst);
          treeCount++;

          // Optional understory shrub beside forest tree within the 0-900m lush ground ring
          if (groundFade >= 0.05 && shrubCount < MAX_SHRUB && h3 > 0.55) {
            const sx = wx + (h0 - 0.5) * 9.0;
            const sz = wz + (h1 - 0.5) * 9.0;
            if (checkAirportZone(sx, sz, nearbyAirports) === 'open') {
              const sy = groundFn(sx, sz);
              if (sy > 1.3) {
                const bw = (1.4 + h2 * 1.4) * groundFade;
                dummy.position.set(sx, sy - 0.12 * groundFade, sz);
                dummy.rotation.set(0, h3 * Math.PI * 2, 0);
                dummy.scale.set(bw, (0.95 + h0 * 0.85) * groundFade, bw * (0.85 + h1 * 0.30));
                dummy.updateMatrix();
                setShrubColorFromSat(sat, h0, false);
                stageInstance(shrubStageMat, shrubStageCol, shrubCount, shrubInst);
                shrubCount++;
              }
            }
          }
          continue;
        }
      }

      if (groundFade < 0.05) continue;

      // 3. Organic bushes/shrubs along forest edges, hills, rural fields, and arid scrub (0-900m)
      const allowFallbackShrub = !hasSat && gY > 2.0 && gY < 2400 && slope <= 0.45 && h2 < 0.22;
      if (
        shrubCount < MAX_SHRUB &&
        gY > 1.5 &&
        gY < 2800 &&
        slope <= 0.55 &&
        (isDarkForest || isGreenGrass || isAridRocky || allowFallbackShrub)
      ) {
        const shrubProb = isDarkForest ? 0.54 : isGreenGrass ? 0.28 : isAridRocky ? 0.20 : 0.18;
        if (h3 < shrubProb) {
          const bw = (1.3 + h0 * 1.8) * groundFade;
          const bh = (0.85 + h1 * 1.15) * groundFade;
          dummy.position.set(wx, gY - 0.14 * groundFade, wz);
          dummy.rotation.set(0, h2 * Math.PI * 2, 0);
          dummy.scale.set(bw, bh, bw * (0.82 + h3 * 0.36));
          dummy.updateMatrix();
          setShrubColorFromSat(sat, h2, isAridRocky);
          stageInstance(shrubStageMat, shrubStageCol, shrubCount, shrubInst);
          shrubCount++;
        }
      }

      // 4. Ultra-lush grass tufts on grass, farmland, park, and gentle meadow pixels (0-900m)
      const allowFallbackGrass = !hasSat && gY > 1.5 && gY < 2000 && slope <= 0.30;
      if (
        grassCount < MAX_GRASS &&
        gY > 1.2 &&
        gY < 2400 &&
        slope <= 0.40 &&
        (isGreenGrass || isDarkForest || (isAridRocky && h0 < 0.35) || allowFallbackGrass)
      ) {
        const subTufts = actualDist < 240 && isGreenGrass ? 3 : actualDist < 480 && isGreenGrass ? 2 : 1;
        for (let k = 0; k < subTufts && grassCount < MAX_GRASS; k++) {
          const shA = k === 0 ? h0 : k === 1 ? hash2(gx * 5 + 71, gz * 7 - 53) : hash2(gx * 17 - 23, gz * 13 + 61);
          const shB = k === 0 ? h1 : k === 1 ? hash2(gx * 11 - 37, gz * 3 + 89) : hash2(gx * 19 + 41, gz * 23 - 17);
          const tx = k === 0 ? wx : (gx + 0.12 + shA * 0.76) * CELL;
          const tz = k === 0 ? wz : (gz + 0.12 + shB * 0.76) * CELL;
          if (k > 0 && checkAirportZone(tx, tz, nearbyAirports) === 'paved') continue;
          const ty = k === 0 ? gY : groundFn(tx, tz);
          if (!Number.isFinite(ty) || ty < 1.2) continue;

          const gw = (1.35 + shA * 1.35) * groundFade;
          const gh = (0.78 + shB * 0.92) * groundFade;
          dummy.position.set(tx, ty - 0.05 * groundFade, tz);
          dummy.rotation.set(0, (shA + shB) * Math.PI * 2, 0);
          dummy.scale.set(gw, gh, gw);
          dummy.updateMatrix();
          setGrassColorFromSat(sat, shB);
          stageInstance(grassStageMat, grassStageCol, grassCount, grassInst);
          grassCount++;
        }
      }
    }

    buildState.grassCount = grassCount;
    buildState.shrubCount = shrubCount;
    buildState.treeCount = treeCount;
    buildState.rockCount = rockCount;
    buildState.cursor = cursor;

    const done = allFull || cursor >= totalCells;
    if (done) {
      commitAllStaged();
      buildState.active = false;
      built = true;
      lastX = bPx;
      lastZ = bPz;
      lastSatRev = buildState.satRev;
    } else if (buildState.progressive) {
      // Initial closest-first frame slice: show inner sub-ring immediately while outer rings stream in
      commitAllStaged();
    }
  }

  function update(px, py, pz, dayRatio = 1, quality = 'high') {
    if (quality === 'low' || !Number.isFinite(px) || !Number.isFinite(py) || !Number.isFinite(pz)) {
      root.visible = false;
      return;
    }

    const groundY = groundFn(px, pz);
    const agl = py - (Number.isFinite(groundY) ? groundY : 0);
    if (agl > MAX_AGL) {
      root.visible = false;
      return;
    }

    root.visible = true;
    applyDaylight(dayRatio);

    const satRev = typeof window !== 'undefined' ? (window.__SKYBOUND_SAT_REVISION || 0) : 0;
    if (buildState.active) {
      if (Math.hypot(px - buildState.px, pz - buildState.pz) > RADIUS * 0.45) {
        beginRebuild(px, pz, satRev);
      }
      stepRebuild(FRAME_BUDGET_MS);
    } else if (!built || Math.hypot(px - lastX, pz - lastZ) > REBUILD_DIST || satRev !== lastSatRev) {
      beginRebuild(px, pz, satRev);
      stepRebuild(FRAME_BUDGET_MS);
    }
  }

  function dispose() {
    for (let i = 0; i < allMeshes.length; i++) {
      allMeshes[i].geometry?.dispose?.();
      allMeshes[i].material?.dispose?.();
    }
    if (root.parent) root.parent.remove(root);
  }

  return {
    root,
    update,
    dispose,
    checkAirportZone: (x, z) => {
      refreshNearbyAirports(x, z);
      return checkAirportZone(x, z, nearbyAirports);
    },
    meshes: {
      grass: grassInst,
      shrub: shrubInst,
      tree: treeInst,
      rock: rockInst
    }
  };
}

if (typeof window !== 'undefined') window.createGroundDetailRing = createGroundDetailRing;
if (typeof globalThis !== 'undefined') globalThis.createGroundDetailRing = createGroundDetailRing;
