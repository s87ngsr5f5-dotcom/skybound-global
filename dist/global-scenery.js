'use strict';
// Complete Worldwide 3D Architecture, Street-Block Cities, Regional Pitched-Roof Neighborhoods, Industrial Zones & Iconic Landmarks (v0.83).
function createGlobalScenery(scene, ground, airports = []) {
  const root = new THREE.Group();
  root.name = 'Global country roads & cities';
  scene.add(root);

  const TILE = 1600;
  const loaded = new Map();
  const hubLandmarksAdded = new Set();
  const isLowMem = typeof navigator !== 'undefined' && (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent || '') || (navigator.deviceMemory && navigator.deviceMemory <= 4));
  const liveOsmBoxes = [];
  let liveOsmRevision = 0;
  function inLiveOsmArea(x, z) {
    for (let i = 0; i < liveOsmBoxes.length; i++) {
      const b = liveOsmBoxes[i];
      if (x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ) return true;
    }
    return false;
  }

  function makeCanvasTex(w, h, drawFn, repeatX = 1, repeatY = 1) {
    if (typeof document === 'undefined' || !document.createElement) return null;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext && c.getContext('2d');
    if (ctx && typeof ctx.fillRect === 'function') {
      drawFn(ctx, w, h);
    }
    if (!THREE.CanvasTexture) return null;
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    if (tex.repeat && typeof tex.repeat.set === 'function') tex.repeat.set(repeatX, repeatY);
    if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  // 1. Mid-rise apartment / commercial facade texture + night window emissive map
  const wallDayTex = makeCanvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#dde2e6';
    g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 28) {
      g.fillStyle = 'rgba(20,30,40,0.18)';
      g.fillRect(0, y, w, 4);
      for (let x = 5; x < w; x += 22) {
        const shade = ((x * 7 + y * 13) % 17) < 8 ? '#465869' : '#607588';
        g.fillStyle = shade;
        g.fillRect(x, y + 6, 13, 16);
        g.fillStyle = 'rgba(255,255,255,0.32)';
        g.fillRect(x, y + 22, 13, 2);
      }
    }
  }, 1, 2);

  const wallNightTex = makeCanvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#05070a';
    g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 28) {
      for (let x = 5; x < w; x += 22) {
        const s = (x * 31 + y * 53) % 23;
        if (s < 12) {
          g.fillStyle = s < 5 ? '#ffe3a2' : s < 9 ? '#ffc978' : '#cce6ff';
          g.fillRect(x + 1, y + 7, 11, 14);
        }
      }
    }
  }, 1, 2);

  // 2. High-rise glass curtain wall texture + night office floor map
  const glassDayTex = makeCanvasTex(256, 256, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#5c84a4');
    grad.addColorStop(0.5, '#82aecb');
    grad.addColorStop(1, '#486d8b');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 18) {
      g.fillStyle = 'rgba(12,24,36,0.38)';
      g.fillRect(0, y, w, 3);
      for (let x = 0; x < w; x += 16) {
        g.fillStyle = 'rgba(225,242,255,0.25)';
        g.fillRect(x + 1, y + 4, 13, 13);
      }
    }
  }, 1, 3);

  const glassNightTex = makeCanvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#04080e';
    g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 18) {
      const bandLit = ((y * 19) % 7) < 4;
      for (let x = 0; x < w; x += 16) {
        const s = (x * 17 + y * 41) % 19;
        if (bandLit && s < 13) {
          g.fillStyle = s < 6 ? '#ffebb4' : s < 10 ? '#a8dcff' : '#ffd280';
          g.fillRect(x + 2, y + 4, 12, 12);
        }
      }
    }
  }, 1, 3);

  // 3. Residential house wall + window texture
  const houseDayTex = makeCanvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#ece6dc';
    g.fillRect(0, 0, w, h);
    for (let y = 14; y < h; y += 42) {
      g.fillStyle = 'rgba(0,0,0,0.06)';
      g.fillRect(0, y - 3, w, 2);
      for (let x = 10; x < w; x += 30) {
        g.fillStyle = '#3b4854';
        g.fillRect(x, y, 14, 18);
        g.fillStyle = '#e5e0d5';
        g.fillRect(x + 6, y, 2, 18);
        g.fillRect(x, y + 8, 14, 2);
      }
    }
  }, 1, 1);

  const roofDetailTex = makeCanvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#6f7982';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#4c545c';
    g.lineWidth = 8;
    g.strokeRect(4, 4, w - 8, h - 8);
    g.fillStyle = '#8b959e';
    g.fillRect(24, 24, 32, 26);
    g.fillRect(68, 64, 34, 34);
    g.fillStyle = '#404850';
    g.fillRect(28, 28, 10, 18);
    g.fillRect(42, 28, 10, 18);
  }, 1, 1);

  // Unit pitched-roof house geometry: walls (y: -0.5..0.18) + 3D gable roof (y: 0.18..0.52) with baked roof/wall shading
  function createPitchedHouseGeometry() {
    const geo = new THREE.BufferGeometry();
    const hw = 0.5, hd = 0.5, y0 = -0.5, yEave = 0.18, yPeak = 0.52;
    const pos = [], nrm = [], uvs = [], col = [];
    function quad(ax, ay, az, bx, by, bz, cx, cy, dz, dx, dy, dzz, nx, ny, nz, r, g, b, uMax = 1, vMax = 1) {
      pos.push(ax, ay, az, bx, by, bz, cx, cy, dz, ax, ay, az, cx, cy, dz, dx, dy, dzz);
      for (let i = 0; i < 6; i++) { nrm.push(nx, ny, nz); col.push(r, g, b); }
      uvs.push(0, 0, uMax, 0, uMax, vMax, 0, 0, uMax, vMax, 0, vMax);
    }
    function tri(ax, ay, az, bx, by, bz, cx, cy, cz, nx, ny, nz, r, g, b) {
      pos.push(ax, ay, az, bx, by, bz, cx, cy, cz);
      for (let i = 0; i < 3; i++) { nrm.push(nx, ny, nz); col.push(r, g, b); }
      uvs.push(0, 0, 1, 0, 0.5, 1);
    }
    // 4 walls (bright neutral so instanceColor tints walls cleanly)
    quad(-hw, y0, hd, hw, y0, hd, hw, yEave, hd, -hw, yEave, hd, 0, 0, 1, 1.0, 1.0, 1.0);
    quad(hw, y0, -hd, -hw, y0, -hd, -hw, yEave, -hd, hw, yEave, -hd, 0, 0, -1, 0.94, 0.94, 0.94);
    quad(hw, y0, hd, hw, y0, -hd, hw, yEave, -hd, hw, yEave, hd, 1, 0, 0, 0.96, 0.96, 0.96);
    quad(-hw, y0, -hd, -hw, y0, hd, -hw, yEave, hd, -hw, yEave, -hd, -1, 0, 0, 0.92, 0.92, 0.92);
    // Front & back gable triangles
    tri(-hw, yEave, hd, hw, yEave, hd, 0, yPeak, hd, 0, 0, 1, 0.95, 0.95, 0.95);
    tri(hw, yEave, -hd, -hw, yEave, -hd, 0, yPeak, -hd, 0, 0, -1, 0.90, 0.90, 0.90);
    // 2 sloped roof planes with slight overhang and darker terracotta/slate contrast
    const ow = 0.54, od = 0.53;
    quad(0, yPeak, od, ow, yEave, od, ow, yEave, -od, 0, yPeak, -od, 0.55, 0.83, 0, 0.62, 0.46, 0.40);
    quad(-ow, yEave, od, 0, yPeak, od, 0, yPeak, -od, -ow, yEave, -od, -0.55, 0.83, 0, 0.58, 0.43, 0.37);
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    return geo;
  }

  const houseGeo = createPitchedHouseGeometry();
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x32373e, roughness: 0.86, side: THREE.DoubleSide });
  const stripeMat = new THREE.MeshBasicMaterial({ color: 0xefe4b8, side: THREE.DoubleSide });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffdd94 });
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff2e24 });

  const houseMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: houseDayTex,
    emissive: 0xffd28c,
    emissiveMap: wallNightTex,
    emissiveIntensity: 0,
    vertexColors: true,
    roughness: 0.82,
    metalness: 0.04
  });
  const bldgWallMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: wallDayTex,
    emissive: 0xffd694,
    emissiveMap: wallNightTex,
    emissiveIntensity: 0,
    roughness: 0.76,
    metalness: 0.08
  });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0xd8dee4, map: roofDetailTex, roughness: 0.82 });
  const indWallMat = new THREE.MeshStandardMaterial({
    color: 0xc2cbd2,
    map: wallDayTex,
    emissive: 0xffd694,
    emissiveMap: wallNightTex,
    emissiveIntensity: 0,
    roughness: 0.72,
    metalness: 0.22
  });
  const indRoofMat = new THREE.MeshStandardMaterial({ color: 0x7e8994, map: roofDetailTex, roughness: 0.68, metalness: 0.24 });
  const landmarkGlassMat = new THREE.MeshStandardMaterial({
    color: 0xd8ecff,
    map: glassDayTex,
    metalness: 0.54,
    roughness: 0.19,
    emissive: 0xffe6ad,
    emissiveMap: glassNightTex,
    emissiveIntensity: 0.12
  });
  const monumentGoldMat = new THREE.MeshStandardMaterial({
    color: 0xd8b878,
    metalness: 0.62,
    roughness: 0.28,
    emissive: 0xffc864,
    emissiveIntensity: 0.16
  });
  const treeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.88 });

  // Cloned OSM materials with per-vertex RGB color tinting (1:1 real building:colour & roof:colour)
  const osmWallMat = typeof bldgWallMat.clone === 'function' ? bldgWallMat.clone() : new THREE.MeshStandardMaterial({
    color: 0xffffff, map: wallDayTex, emissive: 0xffd694, emissiveMap: wallNightTex, emissiveIntensity: 0, roughness: 0.76, metalness: 0.08
  });
  osmWallMat.vertexColors = true;
  if (osmWallMat.color && typeof osmWallMat.color.setHex === 'function') osmWallMat.color.setHex(0xffffff);

  const osmGlassMat = typeof landmarkGlassMat.clone === 'function' ? landmarkGlassMat.clone() : new THREE.MeshStandardMaterial({
    color: 0xffffff, map: glassDayTex, metalness: 0.54, roughness: 0.19, emissive: 0xffe6ad, emissiveMap: glassNightTex, emissiveIntensity: 0.12
  });
  osmGlassMat.vertexColors = true;
  if (osmGlassMat.color && typeof osmGlassMat.color.setHex === 'function') osmGlassMat.color.setHex(0xffffff);

  const osmRoofMat = typeof roofMat.clone === 'function' ? roofMat.clone() : new THREE.MeshStandardMaterial({
    color: 0xffffff, map: roofDetailTex, roughness: 0.82
  });
  osmRoofMat.vertexColors = true;
  if (osmRoofMat.color && typeof osmRoofMat.color.setHex === 'function') osmRoofMat.color.setHex(0xffffff);

  const osmPierMat = new THREE.MeshStandardMaterial({ color: 0x9aa2aa, roughness: 0.88, metalness: 0.06 });
  const osmTrafficMat = new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true });

  // Shared unit highway vehicle geometry (+Z forward: twin warm-white headlights; -Z rear: twin vivid red taillights)
  function createOsmTrafficVehicleGeometry() {
    const pos = [], nrm = [], col = [];
    const pushBox = (cx, cy, cz, w, h, d, r, g, b) => {
      const hw = w * 0.5, hh = h * 0.5, hd = d * 0.5;
      const x0 = cx - hw, x1 = cx + hw, y0 = cy - hh, y1 = cy + hh, z0 = cz - hd, z1 = cz + hd;
      const q = (ax, ay, az, bx, by, bz, dx, dy, dz, ex, ey, ez, nx, ny, nz) => {
        pos.push(ax, ay, az, bx, by, bz, dx, dy, dz, ax, ay, az, dx, dy, dz, ex, ey, ez);
        for (let k = 0; k < 6; k++) { nrm.push(nx, ny, nz); col.push(r, g, b); }
      };
      q(x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1, 0, 0, 1);
      q(x1, y0, z0, x0, y0, z0, x0, y1, z0, x1, y1, z0, 0, 0, -1);
      q(x1, y0, z1, x1, y0, z0, x1, y1, z0, x1, y1, z1, 1, 0, 0);
      q(x0, y0, z0, x0, y0, z1, x0, y1, z1, x0, y1, z0, -1, 0, 0);
      q(x0, y1, z1, x1, y1, z1, x1, y1, z0, x0, y1, z0, 0, 1, 0);
    };
    pushBox(0, 0.72, 0, 2.0, 1.25, 4.2, 0.25, 0.28, 0.34);          // dark vehicle body
    pushBox(-0.62, 0.72, 2.25, 0.62, 0.46, 0.55, 1.0, 0.98, 0.88); // front-left warm-white headlight
    pushBox(0.62, 0.72, 2.25, 0.62, 0.46, 0.55, 1.0, 0.98, 0.88);  // front-right warm-white headlight
    pushBox(-0.62, 0.74, -2.25, 0.62, 0.44, 0.55, 1.0, 0.14, 0.09);// rear-left red taillight
    pushBox(0.62, 0.74, -2.25, 0.62, 0.44, 0.55, 1.0, 0.14, 0.09); // rear-right red taillight
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    return geo;
  }
  const osmTrafficGeo = createOsmTrafficVehicleGeometry();
  const osmTreeGeo = new THREE.DodecahedronGeometry ? new THREE.DodecahedronGeometry(1, 1) : new THREE.SphereGeometry(1, 7, 5);

  function insideTaiwanDetailed(lat, lon) {
    return lat >= 21.8 && lat <= 25.4 && lon >= 119.3 && lon <= 122.1;
  }

  function inAirportClearance(x, z, pad = 160) {
    for (let i = 0; i < airports.length; i++) {
      const a = airports[i];
      const reach = a.length / 2 + pad + 260;
      if (Math.abs(x - a.x) > reach || Math.abs(z - a.z) > reach) continue;
      const dx = x - a.x, dz = z - a.z;
      const s = Math.sin(a.heading), c = Math.cos(a.heading);
      const along = dx * s - dz * c, cross = dx * c + dz * s;
      const sideReach = Math.max(a.width / 2 + 85, Math.abs(a.apron || 175) + 115) + pad * 0.55;
      if (Math.abs(along) < a.length / 2 + pad && Math.abs(cross) < sideReach) return true;
      // Keep narrow approach/departure flight path clear beyond runway ends
      if (Math.abs(along) < reach && Math.abs(cross) < Math.max(a.width * 1.5, 110)) return true;
    }
    return false;
  }

  function nearestHubInfo(x, z) {
    let bestDist = 1e9, bestAirport = null;
    for (let i = 0; i < airports.length; i++) {
      const a = airports[i];
      if (a.shortField || a.carrier) continue;
      const d = Math.hypot(x - a.x, z - a.z);
      if (d < bestDist) { bestDist = d; bestAirport = a; }
    }
    return { dist: bestDist, airport: bestAirport };
  }

  function nearestAnyAirportDist(x, z) {
    let bestDist = 1e9;
    const scan = (list) => {
      if (!Array.isArray(list)) return;
      for (let i = 0; i < list.length; i++) {
        const a = list[i];
        if (!a || a.carrier || !Number.isFinite(a.x) || !Number.isFinite(a.z)) continue;
        const d = Math.hypot(x - a.x, z - a.z);
        if (d < bestDist) bestDist = d;
      }
    };
    scan(airports);
    if (typeof allAirports !== 'undefined' && allAirports !== airports) scan(allAirports);
    return bestDist;
  }

  function hash2(ix, iz) {
    const n = Math.sin(ix * 127.1 + iz * 311.7) * 43758.5453;
    return n - Math.floor(n);
  }

  function addRoadStrip(posArr, linePosArr, x0, z0, x1, z1, width) {
    const mx = (x0 + x1) * 0.5, mz = (z0 + z1) * 0.5;
    if (inAirportClearance(mx, mz, 220)) return;
    const h0 = ground(x0, z0), h1 = ground(x1, z1), hm = ground(mx, mz);
    if (h0 < 0.8 || h1 < 0.8 || hm < 0.8) return;
    const len = Math.hypot(x1 - x0, z1 - z0);
    if (len < 10) return;
    const nx = -(z1 - z0) / len, nz = (x1 - x0) / len;
    const hw = width * 0.5, y0 = h0 + 0.35, y1 = h1 + 0.35;
    const p = [
      x0 - nx * hw, y0, z0 - nz * hw,
      x0 + nx * hw, y0, z0 + nz * hw,
      x1 + nx * hw, y1, z1 + nz * hw,
      x0 - nx * hw, y0, z0 - nz * hw,
      x1 + nx * hw, y1, z1 + nz * hw,
      x1 - nx * hw, y1, z1 - nz * hw
    ];
    for (let i = 0; i < p.length; i++) posArr.push(p[i]);
    const sw = 0.30, sy0 = y0 + 0.08, sy1 = y1 + 0.08;
    const lp = [
      x0 - nx * sw, sy0, z0 - nz * sw,
      x0 + nx * sw, sy0, z0 + nz * sw,
      x1 + nx * sw, sy1, z1 + nz * sw,
      x0 - nx * sw, sy0, z0 - nz * sw,
      x1 + nx * sw, sy1, z1 + nz * sw,
      x1 - nx * sw, sy1, z1 - nz * sw
    ];
    for (let i = 0; i < lp.length; i++) linePosArr.push(lp[i]);
  }

  function getRegionalPalette(country, airportRegion) {
    const b = country?.biome || 'temperate';
    if (airportRegion === 'eu' || b === 'mediterranean') {
      return {
        apt: [0xe6dac8, 0xd8cbb8, 0xdfd3c2, 0xc9d0d6, 0xe2c9b4],
        house: [0xf0e4d2, 0xe5d4be, 0xead8c3, 0xdccab6, 0xf2eae0],
        glass: [0x82a4be, 0x6f92ae, 0x9ab6cc],
        ind: [0x9da7b0, 0x8b959e]
      };
    }
    if (airportRegion === 'me' || b === 'arid') {
      return {
        apt: [0xe8d9c0, 0xdec8a8, 0xd4bc98, 0xefe3ce],
        house: [0xf2e6d0, 0xe6d4b7, 0xdec8a6, 0xeadbc2],
        glass: [0x8ab4c8, 0xbfa87a, 0x76a2bc],
        ind: [0xc2b6a2, 0xafa38e]
      };
    }
    if (airportRegion === 'na') {
      return {
        apt: [0xd4dce2, 0xc4ced6, 0xd8c8bc, 0xccd4dc, 0xbfb4aa],
        house: [0xebe6de, 0xd8dee4, 0xe2d8cc, 0xcfd8e0, 0xe6dcd2],
        glass: [0x6e98ba, 0x5c86a8, 0x88b0ce],
        ind: [0x929da6, 0x828e98]
      };
    }
    if (airportRegion === 'sea' || b === 'tropical') {
      return {
        apt: [0xebe4d8, 0xd8e4de, 0xe8d8ce, 0xdce4ea],
        house: [0xf2eadc, 0xe4dfd2, 0xead8c8, 0xdde5de],
        glass: [0x689eb2, 0x7cb0c4, 0x5c8ea2],
        ind: [0x96a2aa, 0x85929a]
      };
    }
    return {
      apt: [0xdce0e5, 0xced4dc, 0xe2ddd4, 0xc6ced6],
      house: [0xeae3d8, 0xded7cb, 0xe4dcd0, 0xd4d8dc],
      glass: [0x789ec0, 0x688eae, 0x90b2ce],
      ind: [0x98a2ac, 0x88939e]
    };
  }

  function getTreeTone(biome, r) {
    if (biome === 'arid') return r > 0.5 ? 0x5c7a48 : 0x6d8252;
    if (biome === 'tropical') return r > 0.5 ? 0x2d6e36 : 0x3b8040;
    if (biome === 'boreal') return r > 0.5 ? 0x2a4f3c : 0x355e47;
    if (biome === 'mediterranean') return r > 0.5 ? 0x4f6f3e : 0x627c48;
    return r > 0.65 ? 0x46783e : r > 0.3 ? 0x386634 : 0x528244;
  }

  function classifyLandUse(x, z, gH) {
    if (gH < 1.1) return 'water';
    const slope = Math.hypot(ground(x + 55, z) - gH, ground(x, z + 55) - gH) / 55;
    const sampler = typeof window !== 'undefined' ? window.__SKYBOUND_SAT_SAMPLER : null;
    const sat = sampler ? sampler(x, z) : null;
    if (sat && sat.a > 120) {
      const lum = sat.r + sat.g + sat.b;
      if ((sat.b > sat.r * 1.12 && sat.b > sat.g * 1.03 && sat.r < 110) || (lum < 90 && gH < 6)) return 'water';
      if (slope > 0.25) return 'mountain';
      if (sat.g > sat.r * 1.04 && sat.g > sat.b * 1.04 && sat.g > 52) return 'forest';
      if (sat.r > 138 && sat.g > 108 && (sat.r - sat.b) > 34 && lum > 330) return 'open';
      if (Math.abs(sat.r - sat.g) < 26 && Math.abs(sat.g - sat.b) < 30 && sat.r > 68) return 'urban';
      return 'suburban';
    }
    if (slope > 0.24) return 'mountain';
    return null;
  }

  function buildTile(col, row) {
    const cx = (col + 0.5) * TILE, cz = (row + 0.5) * TILE;
    const ll = typeof latLon === 'function' ? latLon(cx, cz) : null;
    if (!ll || insideTaiwanDetailed(ll.lat, ll.lon)) return null;
    const centerGround = ground(cx, cz);
    if (centerGround < 0.8) return null;
    const country = typeof WorldAtlas !== 'undefined' ? WorldAtlas.countryAt(ll.lon, ll.lat) : null;
    const hubInfo = nearestHubInfo(cx, cz);
    const hubDist = hubInfo.dist;
    const sampler = typeof window !== 'undefined' ? window.__SKYBOUND_SAT_SAMPLER : null;
    const hasSatPhoto = Boolean(sampler && sampler(cx, cz));

    const group = new THREE.Group();
    group.userData.hadSat = hasSatPhoto;
    group.userData.osmRev = liveOsmRevision;
    const posArr = [], linePosArr = [];
    const houses = [], apts = [], glassTowers = [], warehouses = [], lamps = [], beacons = [], trees = [];
    const x0 = col * TILE, z0 = row * TILE;
    const hubAp = hubInfo.airport;
    const cbdSide = Math.sign(hubAp?.apron || 1);
    const cbdX = hubAp ? hubAp.x + Math.cos(hubAp.heading) * (cbdSide * 3400) : 1e9;
    const cbdZ = hubAp ? hubAp.z + Math.sin(hubAp.heading) * (cbdSide * 3400) : 1e9;
    const cbdDist = Math.hypot(cx - cbdX, cz - cbdZ);
    const regCellX = Math.floor(col / 8), regCellZ = Math.floor(row / 8);
    const regCityCore = hubDist > 22000 && hash2(regCellX * 13, regCellZ * 17) > 0.52 &&
      Math.abs(((col % 8) + 8) % 8 - 4) <= 1 && Math.abs(((row % 8) + 8) % 8 - 4) <= 1;
    const isMetroCore = cbdDist < 2800 || regCityCore;
    const isUrbanTile = hubDist < 20000 || regCityCore;
    const isSuburbanTile = !isUrbanTile && hubDist < 38000;
    const biome = country?.biome || 'temperate';
    const regionCode = hubAp?.region || (biome === 'arid' ? 'me' : biome === 'mediterranean' ? 'eu' : 'na');
    const pal = getRegionalPalette(country, regionCode);
    const isEuropean = regionCode === 'eu' || biome === 'mediterranean';
    const isMiddleEast = regionCode === 'me' || biome === 'arid';

    // 1. Only draw procedural road strips when offline/no Google Satellite photo is available (otherwise real Google Satellite roads shine cleanly!)
    if (!hasSatPhoto) {
      const segs = 4, step = TILE / segs;
      const hwyOffsetZ = z0 + TILE * 0.5 + (Math.sin(col * 0.45) * 220);
      const hwyOffsetZNext = z0 + TILE * 0.5 + (Math.sin((col + 1) * 0.45) * 220);
      const hwyOffsetX = x0 + TILE * 0.5 + (Math.cos(row * 0.45) * 220);
      const hwyOffsetXNext = x0 + TILE * 0.5 + (Math.cos((row + 1) * 0.45) * 220);
      for (let s = 0; s < segs; s++) {
        const t0 = s / segs, t1 = (s + 1) / segs;
        addRoadStrip(posArr, linePosArr, x0 + s * step, hwyOffsetZ + (hwyOffsetZNext - hwyOffsetZ) * t0, x0 + (s + 1) * step, hwyOffsetZ + (hwyOffsetZNext - hwyOffsetZ) * t1, 14);
        addRoadStrip(posArr, linePosArr, hwyOffsetX + (hwyOffsetXNext - hwyOffsetX) * t0, z0 + s * step, hwyOffsetX + (hwyOffsetXNext - hwyOffsetX) * t1, z0 + (s + 1) * step, 14);
      }
    }

    // 2. Satellite-Color & Slope-Guided Real Land-Use Population (Forests stay green, Hills/Cliffs stay natural, Cities get regional architecture!)
    const gridDiv = isMetroCore ? 5 : isUrbanTile ? 4 : 3;
    const blockSize = TILE / gridDiv;
    const osmCity = typeof window !== 'undefined' ? window.__SKYBOUND_WORLD_CITY : null;
    const districtAngle = (hash2(col * 11, row * 17) - 0.5) * 1.15;

    for (let br = 0; br < gridDiv; br++) {
      for (let bc = 0; bc < gridDiv; bc++) {
        const bx0 = x0 + bc * blockSize, bz0 = z0 + br * blockSize;
        const bcx = bx0 + blockSize * 0.5, bcz = bz0 + blockSize * 0.5;
        if (osmCity && typeof osmCity.blocked === 'function' && osmCity.blocked(bcx, bcz)) continue;
        if (inLiveOsmArea(bcx, bcz)) continue;
        const bGround = ground(bcx, bcz);
        if (bGround < 1.1 || bGround > 2450) continue;

        const landUse = classifyLandUse(bcx, bcz, bGround);
        if (landUse === 'water') continue;

        const blockCbdDist = Math.hypot(bcx - cbdX, bcz - cbdZ);
        const blockHubDist = Math.hypot(bcx - (hubAp?.x || 0), bcz - (hubAp?.z || 0));
        const blockSeed = hash2(col * 19 + bc * 7, row * 23 + br * 11);

        // Parks, Forests, Cliffs & Mountain Slopes: NEVER place fake buildings! Render lush biome-appropriate trees & keep real terrain visible!
        if (landUse === 'forest' || landUse === 'mountain') {
          const treeCount = landUse === 'mountain' ? (biome === 'arid' ? 2 : 7) : (biome === 'arid' ? 3 : 11);
          for (let t = 0; t < treeCount; t++) {
            const tx = bx0 + 16 + hash2(bc * 43 + t * 5, br * 19 + col) * (blockSize - 32);
            const tz = bz0 + 16 + hash2(bc * 29 + row, br * 37 + t * 7) * (blockSize - 32);
            if (inAirportClearance(tx, tz, 240)) continue;
            const tg = ground(tx, tz);
            if (tg >= 1.5 && tg < 2350) {
              const tr = (biome === 'tropical' ? 5.8 : biome === 'boreal' ? 4.8 : 5.2) + hash2(t * 7, col + row) * 6.5;
              trees.push({ x: tx, y: tg + tr * 0.72, z: tz, r: tr, color: getTreeTone(biome, hash2(t, bc + br)) });
            }
          }
          continue;
        }

        // Open deserts, beaches & agricultural plains: leave open & natural with only occasional rural farms/trees
        if (landUse === 'open' || (!hasSatPhoto && !isUrbanTile && !isSuburbanTile && blockSeed > 0.35)) {
          if (biome !== 'arid' && blockSeed < 0.65) {
            for (let t = 0; t < 4; t++) {
              const tx = bx0 + 20 + hash2(bc * 13 + t, br * 29) * (blockSize - 40);
              const tz = bz0 + 20 + hash2(br * 17 + t, bc * 31) * (blockSize - 40);
              if (inAirportClearance(tx, tz, 220)) continue;
              const tg = ground(tx, tz);
              if (tg >= 1.5) trees.push({ x: tx, y: tg + 4.5, z: tz, r: 5.2, color: getTreeTone(biome, hash2(t, col)) });
            }
          }
          continue;
        }

        const allowUrban = landUse === 'urban' || (!hasSatPhoto && isUrbanTile);
        const allowSuburban = landUse === 'suburban' || (!hasSatPhoto && isSuburbanTile);

        if (allowUrban && (blockCbdDist < 2600 || (isMetroCore && blockSeed > 0.45))) {
          // Region-Distinct Downtown CBD (European Haussmann courtyard blocks vs American/Asian/Dubai glass skylines!)
          const lotCount = isEuropean ? 6 : 5;
          for (let k = 0; k < lotCount; k++) {
            const rA = hash2(col * 37 + bc * 13 + k, row * 41 + br * 17);
            const rB = hash2(col * 17 + k * 29, row * 31 + bc + br);
            const lx = bx0 + 26 + rA * (blockSize - 52);
            const lz = bz0 + 26 + rB * (blockSize - 52);
            if (inAirportClearance(lx, lz, 160)) continue;
            const lg = ground(lx, lz);
            if (lg < 1.2 || classifyLandUse(lx, lz, lg) === 'water') continue;
            const w = 18 + hash2(k, bc + col) * 20;
            const d = 18 + hash2(br + row, k) * 20;
            // European historic centers favor elegant 6-8 story limestone blocks; NA/Asia/ME build taller glass cores
            const maxH = isEuropean ? 42 : isMiddleEast ? 135 : 110;
            const h = (isEuropean ? 18 : 22) + Math.pow(hash2(col + k, row - k + bc), 1.6) * (blockCbdDist < 1800 ? maxH : maxH * 0.55);
            const tone = pal.apt[(k + bc + br) % pal.apt.length];
            if (h > 48 && !isEuropean) {
              const podH = Math.min(15, h * 0.24);
              apts.push({ x: lx, y: lg + podH * 0.5 - 0.5, z: lz, w: w * 1.18, h: podH, d: d * 1.18, rot: districtAngle, tone });
              glassTowers.push({ x: lx, y: lg + h * 0.5 - 0.5, z: lz, w: w * 0.86, h, d: d * 0.86, tone: pal.glass[k % pal.glass.length] });
              const crownH = h * 0.18;
              glassTowers.push({ x: lx, y: lg + h + crownH * 0.5 - 0.8, z: lz, w: w * 0.55, h: crownH, d: d * 0.55, tone: pal.glass[k % pal.glass.length] });
              if (h > 68) beacons.push({ x: lx, y: lg + h + crownH + 1.2, z: lz });
            } else {
              apts.push({ x: lx, y: lg + h * 0.5 - 0.5, z: lz, w, h, d, rot: districtAngle + ((k & 1) ? 0 : Math.PI * 0.5), tone });
            }
          }
        } else if (allowUrban && (blockHubDist < 2400 ? blockSeed < 0.35 : blockSeed < 0.16)) {
          // Logistics / Port / Airport Commercial Park Block
          for (let wIdx = 0; wIdx < 3; wIdx++) {
            const wx = bx0 + 44 + (wIdx % 2) * (blockSize * 0.44);
            const wz = bz0 + 44 + Math.floor(wIdx / 2) * (blockSize * 0.44);
            if (inAirportClearance(wx, wz, 150)) continue;
            const wg = ground(wx, wz);
            if (wg < 1.2 || classifyLandUse(wx, wz, wg) === 'water') continue;
            const ww = 34 + hash2(wIdx, col) * 24;
            const wd = 24 + hash2(row, wIdx) * 18;
            const wh = 9.5 + (wIdx % 2) * 3.5;
            warehouses.push({ x: wx, y: wg + wh * 0.5 - 0.5, z: wz, w: ww, h: wh, d: wd, tone: pal.ind[wIdx % pal.ind.length] });
          }
        } else if (allowUrban || allowSuburban) {
          // Organic Regional Residential Neighborhood (respects satellite land-use & slopes, varied street angles!)
          const rows = allowUrban ? 3 : 2;
          const colsPerRow = allowUrban ? 4 : 3;
          for (let rr = 0; rr < rows; rr++) {
            for (let cc = 0; cc < colsPerRow; cc++) {
              const jitterX = (hash2(bc * 17 + cc, br * 23 + rr) - 0.5) * 18;
              const jitterZ = (hash2(bc * 31 + rr, br * 13 + cc) - 0.5) * 18;
              const hx = bx0 + 26 + ((cc + 0.5) / colsPerRow) * (blockSize - 52) + jitterX;
              const hz = bz0 + 26 + ((rr + 0.5) / rows) * (blockSize - 52) + jitterZ;
              if (inAirportClearance(hx, hz, 140)) continue;
              const hg = ground(hx, hz);
              const ptUse = classifyLandUse(hx, hz, hg);
              if (hg < 1.2 || ptUse === 'water' || ptUse === 'forest' || ptUse === 'mountain') continue;
              const isMidRiseLot = allowUrban && ((rr + cc + bc) % 3 === 0);
              if (isMidRiseLot) {
                const ah = (isEuropean ? 15 : 12) + hash2(cc + col, rr + row) * (isEuropean ? 14 : 20);
                const aw = 16 + (cc % 3) * 5, ad = 14 + (rr % 3) * 5;
                apts.push({ x: hx, y: hg + ah * 0.5 - 0.5, z: hz, w: aw, h: ah, d: ad, rot: districtAngle + (((cc + rr) & 1) ? 0 : Math.PI * 0.5), tone: pal.apt[(cc + rr + bc) % pal.apt.length] });
              } else {
                const hh = 7.2 + hash2(cc, rr + row) * 4.5;
                const hw = 10.5 + ((cc + bc) % 4) * 2.4;
                const hd = 9.5 + ((rr + br) % 3) * 2.4;
                houses.push({ x: hx, y: hg + hh * 0.5 - 0.4, z: hz, w: hw, h: hh, d: hd, rot: districtAngle + (((cc + rr) & 1) ? 0 : Math.PI * 0.5), tone: pal.house[(cc + rr + bc + br) % pal.house.length] });
              }
            }
          }
          lamps.push({ x: bx0 + 18, y: bGround + 6.2, z: bz0 + 18 });
        }

        // Natural neighborhood trees
        const treePerBlock = biome === 'arid' ? 1 : (allowUrban ? 2 : 4);
        for (let t = 0; t < treePerBlock; t++) {
          const tx = bx0 + 18 + hash2(bc * 43 + t, br * 19 + col) * (blockSize - 36);
          const tz = bz0 + 18 + hash2(bc * 29 + row, br * 37 + t) * (blockSize - 36);
          if (inAirportClearance(tx, tz, 240)) continue;
          const tg = ground(tx, tz);
          if (tg >= 1.5 && tg < 2300 && classifyLandUse(tx, tz, tg) !== 'water') {
            const tr = 4.5 + hash2(t * 7, col + row) * 5.2;
            trees.push({ x: tx, y: tg + tr * 0.72, z: tz, r: tr, color: getTreeTone(biome, hash2(t, bc + br)) });
          }
        }
      }
    }

    if (posArr.length) {
      const rg = new THREE.BufferGeometry();
      rg.setAttribute('position', new THREE.Float32BufferAttribute(posArr, 3));
      rg.computeVertexNormals();
      const rm = new THREE.Mesh(rg, roadMat);
      rm.receiveShadow = true;
      group.add(rm);
    }
    if (linePosArr.length) {
      const lg = new THREE.BufferGeometry();
      lg.setAttribute('position', new THREE.Float32BufferAttribute(linePosArr, 3));
      group.add(new THREE.Mesh(lg, stripeMat));
    }
    const dummy = new THREE.Object3D();
    if (houses.length) {
      const hInst = new THREE.InstancedMesh(houseGeo, houseMat, houses.length);
      houses.forEach((h, idx) => {
        dummy.position.set(h.x, h.y, h.z);
        dummy.rotation.set(0, h.rot || 0, 0);
        dummy.scale.set(h.w, h.h, h.d);
        dummy.updateMatrix();
        hInst.setMatrixAt(idx, dummy.matrix);
        if (typeof hInst.setColorAt === 'function') hInst.setColorAt(idx, new THREE.Color(h.tone));
      });
      hInst.castShadow = true;
      hInst.receiveShadow = true;
      group.add(hInst);
    }
    if (apts.length) {
      const aInst = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), [bldgWallMat, bldgWallMat, roofMat, roofMat, bldgWallMat, bldgWallMat], apts.length);
      apts.forEach((b, idx) => {
        dummy.position.set(b.x, b.y, b.z);
        dummy.rotation.set(0, b.rot || 0, 0);
        dummy.scale.set(b.w, b.h, b.d);
        dummy.updateMatrix();
        aInst.setMatrixAt(idx, dummy.matrix);
        if (typeof aInst.setColorAt === 'function') aInst.setColorAt(idx, new THREE.Color(b.tone));
      });
      aInst.castShadow = true;
      aInst.receiveShadow = true;
      group.add(aInst);
    }
    if (warehouses.length) {
      const wInst = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), [indWallMat, indWallMat, indRoofMat, indRoofMat, indWallMat, indWallMat], warehouses.length);
      warehouses.forEach((b, idx) => {
        dummy.position.set(b.x, b.y, b.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(b.w, b.h, b.d);
        dummy.updateMatrix();
        wInst.setMatrixAt(idx, dummy.matrix);
        if (typeof wInst.setColorAt === 'function') wInst.setColorAt(idx, new THREE.Color(b.tone));
      });
      wInst.castShadow = true;
      wInst.receiveShadow = true;
      group.add(wInst);
    }
    if (glassTowers.length) {
      const gInst = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), [landmarkGlassMat, landmarkGlassMat, roofMat, roofMat, landmarkGlassMat, landmarkGlassMat], glassTowers.length);
      glassTowers.forEach((b, idx) => {
        dummy.position.set(b.x, b.y, b.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(b.w, b.h, b.d);
        dummy.updateMatrix();
        gInst.setMatrixAt(idx, dummy.matrix);
        if (b.tone && typeof gInst.setColorAt === 'function') gInst.setColorAt(idx, new THREE.Color(b.tone));
      });
      gInst.castShadow = true;
      gInst.receiveShadow = true;
      group.add(gInst);
    }
    if (trees.length) {
      const crownGeo = new THREE.DodecahedronGeometry ? new THREE.DodecahedronGeometry(1, 1) : new THREE.SphereGeometry(1, 7, 5);
      const tInst = new THREE.InstancedMesh(crownGeo, treeMat, trees.length);
      trees.forEach((t, idx) => {
        dummy.position.set(t.x, t.y, t.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(t.r, t.r * 0.85, t.r);
        dummy.updateMatrix();
        tInst.setMatrixAt(idx, dummy.matrix);
        if (typeof tInst.setColorAt === 'function') tInst.setColorAt(idx, new THREE.Color(t.color));
      });
      group.add(tInst);
    }
    if (lamps.length) {
      const lInst = new THREE.InstancedMesh(new THREE.BoxGeometry(1.4, 0.9, 1.4), lampMat, lamps.length);
      lamps.forEach((l, idx) => {
        dummy.position.set(l.x, l.y, l.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        lInst.setMatrixAt(idx, dummy.matrix);
      });
      group.add(lInst);
    }
    if (beacons.length) {
      const bInst = new THREE.InstancedMesh(new THREE.SphereGeometry(0.95, 8, 6), beaconMat, beacons.length);
      beacons.forEach((b, idx) => {
        dummy.position.set(b.x, b.y, b.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        bInst.setMatrixAt(idx, dummy.matrix);
      });
      group.add(bInst);
    }

    root.add(group);
    return group;
  }

  // Real-World GPS-Accurate Iconic Landmarks (aligned 1:1 with Google Satellite 3D terrain & #radar map pins)
  const REAL_WORLD_LANDMARKS = [
    { id: 'golden_gate', name: '金門大橋 Golden Gate', lat: 37.8199, lon: -122.4783, type: 'golden_gate', h: 227 },
    { id: 'sf_transamerica', name: '泛美金字塔', lat: 37.7952, lon: -122.4028, type: 'pyramid_tower', h: 260 },
    { id: 'sf_salesforce', name: 'Salesforce 大樓', lat: 37.7897, lon: -122.3969, type: 'glass_obelisk', h: 326 },
    { id: 'nyc_owtc', name: '世界貿易中心一號大樓', lat: 40.7127, lon: -74.0134, type: 'owtc', h: 541 },
    { id: 'nyc_empire', name: '帝國大廈 Empire State', lat: 40.7484, lon: -73.9857, type: 'empire', h: 443 },
    { id: 'nyc_liberty', name: '自由女神像', lat: 40.6892, lon: -74.0445, type: 'liberty', h: 93 },
    { id: 'paris_eiffel', name: '艾菲爾鐵塔 Eiffel', lat: 48.8584, lon: 2.2945, type: 'eiffel', h: 330 },
    { id: 'london_shard', name: '碎片大廈 The Shard', lat: 51.5045, lon: -0.0865, type: 'shard', h: 310 },
    { id: 'london_towerbridge', name: '倫敦塔橋 Tower Bridge', lat: 51.5055, lon: -0.0754, type: 'tower_bridge', h: 65 },
    { id: 'london_bigben', name: '大笨鐘 Big Ben', lat: 51.5007, lon: -0.1246, type: 'clock_tower', h: 96 },
    { id: 'dubai_burj', name: '哈里發塔 Burj Khalifa', lat: 25.1972, lon: 55.2744, type: 'burj', h: 620 },
    { id: 'tokyo_skytree', name: '東京晴空塔 Skytree', lat: 35.7101, lon: 139.8107, type: 'skytree', h: 540 },
    { id: 'tokyo_tower', name: '東京鐵塔 Tokyo Tower', lat: 35.6586, lon: 139.7454, type: 'tokyo_tower', h: 333 },
    { id: 'sg_mbs', name: '濱海灣金沙 Marina Bay', lat: 1.2834, lon: 103.8607, type: 'mbs', h: 207 },
    { id: 'kl_petronas', name: '雙峰塔 Petronas', lat: 3.1579, lon: 101.7116, type: 'petronas', h: 452 },
    { id: 'seoul_lotte', name: '樂天世界塔 Lotte', lat: 37.5125, lon: 127.1025, type: 'lotte', h: 520 },
    { id: 'shanghai_pearl', name: '東方明珠塔', lat: 31.2397, lon: 121.4998, type: 'needle', h: 468 },
    { id: 'shanghai_tower', name: '上海中心大廈', lat: 31.2335, lon: 121.5055, type: 'glass_obelisk', h: 560 },
    { id: 'gz_canton', name: '廣州塔 Canton Tower', lat: 23.1064, lon: 113.3245, type: 'needle', h: 454 },
    { id: 'hk_icc', name: '香港環球貿易廣場 ICC', lat: 22.3034, lon: 114.1602, type: 'glass_obelisk', h: 484 },
    { id: 'sydney_opera', name: '雪梨歌劇院 Opera House', lat: -33.8568, lon: 151.2153, type: 'opera_house', h: 65 },
    { id: 'sydney_bridge', name: '雪梨港灣大橋', lat: -33.8523, lon: 151.2108, type: 'harbour_bridge', h: 134 },
    { id: 'cairo_giza', name: '吉薩金字塔群', lat: 29.9792, lon: 31.1342, type: 'pyramids', h: 146 },
    { id: 'toronto_cn', name: '加拿大國家電視塔 CN', lat: 43.6426, lon: -79.3871, type: 'needle', h: 453 },
    { id: 'seattle_needle', name: '太空針塔 Space Needle', lat: 47.6205, lon: -122.3493, type: 'needle', h: 184 },
    { id: 'rome_colosseum', name: '羅馬競技場 Colosseum', lat: 41.8902, lon: 12.4922, type: 'colosseum', h: 48 },
    { id: 'berlin_tv', name: '柏林電視塔', lat: 52.5208, lon: 13.4094, type: 'needle', h: 368 },
    { id: 'rio_christ', name: '里約救世基督像', lat: -22.9519, lon: -43.2105, type: 'christ', h: 40 },
    { id: 'taipei_101', name: '台北 101', lat: 25.0339, lon: 121.5645, type: 'pin_only', h: 508 },
    { id: 'taipei_cks', name: '中正紀念堂 CKS Hall', lat: 25.0347, lon: 121.5218, type: 'palace_hall', h: 70 },
    { id: 'taipei_grand_hotel', name: '圓山大飯店 Grand Hotel', lat: 25.0792, lon: 121.5262, type: 'palace_hall', h: 87 },
    { id: 'kaohsiung_85', name: '高雄 85 大樓 85 Sky Tower', lat: 22.6116, lon: 120.3002, type: 'kaohsiung_85', h: 378 },
    { id: 'taichung_opera', name: '臺中國家歌劇院', lat: 24.1627, lon: 120.6404, type: 'palace_hall', h: 38 },
    { id: 'osaka_castle', name: '大阪城天守閣 Osaka Castle', lat: 34.6873, lon: 135.5262, type: 'castle_keep', h: 58 },
    { id: 'fuji_torii', name: '富士山忠靈塔與鳥居', lat: 35.5012, lon: 138.8035, type: 'castle_keep', h: 42 },
    { id: 'beijing_cctv', name: '北京央視總部大樓 CCTV', lat: 39.9154, lon: 116.4631, type: 'cctv_loop', h: 234 },
    { id: 'hk_boc', name: '香港中銀大廈 BOC Tower', lat: 22.2793, lon: 114.1615, type: 'pyramid_tower', h: 367 },
    { id: 'macau_tower', name: '澳門旅遊塔 Macau Tower', lat: 22.1795, lon: 113.5367, type: 'needle', h: 338 },
    { id: 'bangkok_mahanakhon', name: '曼谷大京都大廈 MahaNakhon', lat: 13.7235, lon: 100.5283, type: 'empire', h: 314 },
    { id: 'agra_taj_mahal', name: '印度泰姬瑪哈陵 Taj Mahal', lat: 27.1751, lon: 78.0421, type: 'taj_mahal', h: 73 },
    { id: 'dubai_burj_alarab', name: '杜拜帆船飯店 Burj Al Arab', lat: 25.1412, lon: 55.1853, type: 'sail_hotel', h: 321 },
    { id: 'dubai_future', name: '杜拜未來博物館', lat: 25.2192, lon: 55.2819, type: 'torus_ring', h: 77 },
    { id: 'nyc_chrysler', name: '紐約克萊斯勒大廈 Chrysler', lat: 40.7516, lon: -73.9755, type: 'empire', h: 319 },
    { id: 'chicago_willis', name: '芝加哥威利斯大廈 Willis', lat: 41.8789, lon: -87.6359, type: 'empire', h: 442 },
    { id: 'la_hollywood_griffith', name: '格里斐斯天文台與好萊塢', lat: 34.1184, lon: -118.3004, type: 'taj_mahal', h: 45 },
    { id: 'chichen_itza', name: '奇琴伊察馬雅金字塔', lat: 20.6843, lon: -88.5678, type: 'pyramids', h: 30 },
    { id: 'paris_triomphe', name: '巴黎凱旋門 Arc de Triomphe', lat: 48.8738, lon: 2.2950, type: 'arch_gate', h: 50 },
    { id: 'london_eye', name: '倫敦眼摩天輪 London Eye', lat: 51.5033, lon: -0.1196, type: 'ferris_wheel', h: 135 },
    { id: 'pisa_tower', name: '比薩斜塔 Leaning Tower', lat: 43.7230, lon: 10.3966, type: 'pisa', h: 56 },
    { id: 'barcelona_sagrada', name: '巴塞隆納聖家堂 Sagrada', lat: 41.4036, lon: 2.1744, type: 'sagrada', h: 172 },
    { id: 'bavaria_neuschwanstein', name: '德國新天鵝堡 Neuschwanstein', lat: 47.5576, lon: 10.7498, type: 'castle_keep', h: 65 },
    { id: 'athens_parthenon', name: '雅典衛城帕德嫩神廟', lat: 37.9715, lon: 23.7267, type: 'arch_gate', h: 32 }
  ];

  const bridgeOrangeMat = new THREE.MeshStandardMaterial({
    color: 0xc43c2b,
    roughness: 0.44,
    metalness: 0.34
  });
  const bridgeCableMat = new THREE.MeshStandardMaterial({
    color: 0xb63526,
    roughness: 0.48,
    metalness: 0.42
  });
  const bridgeDeckTex = makeCanvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#383d44';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#8b9096';
    g.fillRect(0, 0, 14, h);
    g.fillRect(w - 14, 0, 14, h);
    g.fillStyle = '#e8b944';
    g.fillRect(w * 0.5 - 3, 0, 2, h);
    g.fillRect(w * 0.5 + 1, 0, 2, h);
    g.fillStyle = 'rgba(245,248,252,0.85)';
    for (const lx of [0.22, 0.36, 0.64, 0.78]) {
      for (let y = 8; y < h; y += 36) g.fillRect(w * lx - 1, y, 2, 18);
    }
  }, 1, 45);
  const bridgeDeckMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: bridgeDeckTex,
    roughness: 0.82,
    metalness: 0.08
  });
  const whiteShellMat = new THREE.MeshStandardMaterial({
    color: 0xf4f1e8,
    roughness: 0.32,
    metalness: 0.12
  });
  const copperGreenMat = new THREE.MeshStandardMaterial({
    color: 0x5ba38e,
    roughness: 0.46,
    metalness: 0.38
  });
  const steelArchMat = new THREE.MeshStandardMaterial({
    color: 0x6c7680,
    roughness: 0.45,
    metalness: 0.55
  });

  // Hero-Detail Golden Gate Bridge (227m twin Art Deco open-portal towers, catenary main cables, vertical suspenders, 6-lane deck)
  function buildGoldenGateBridge(cx, cz) {
    const g = new THREE.Group();
    g.name = 'Landmark_GoldenGateBridge';
    g.position.set(cx, 0, cz);
    g.rotation.y = -0.175; // Real-world Golden Gate Strait axis (~350 deg)

    const deckY = 67;
    const deckW = 28;
    const halfMain = 640; // 1,280m main span
    const halfTotal = 1140; // 2,280m total suspended span
    const towerTopY = 227;
    const legHalfX = 14.2;

    const addPart = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      if (rx || ry || rz) m.rotation.set(rx, ry, rz);
      m.castShadow = m.receiveShadow = true;
      g.add(m);
      return m;
    };

    // 1. 6-Lane Asphalt Roadway Deck + Steel Under-Truss + Side Guardrails
    addPart(new THREE.BoxGeometry(deckW, 2.2, halfTotal * 2), bridgeDeckMat, 0, deckY, 0);
    addPart(new THREE.BoxGeometry(deckW + 1.4, 7.6, halfTotal * 2), bridgeOrangeMat, 0, deckY - 4.9, 0);
    for (const s of [-1, 1]) {
      addPart(new THREE.BoxGeometry(0.9, 2.4, halfTotal * 2), bridgeOrangeMat, s * (deckW * 0.5 + 0.5), deckY + 1.8, 0);
    }

    // 2. Twin Iconic International-Orange Art Deco Towers (Open Rectangular Portals!)
    for (const tz of [-halfMain, halfMain]) {
      // Concrete water piers
      addPart(new THREE.BoxGeometry(44, 16, 22), roofMat, 0, 4, tz);
      // Stepped Art Deco twin vertical legs (wider at base, stepping inward as they climb)
      const tiers = [
        { y0: 10, y1: 72, w: 6.8, d: 11.5 },
        { y0: 72, y1: 128, w: 5.8, d: 9.8 },
        { y0: 128, y1: 180, w: 4.9, d: 8.2 },
        { y0: 180, y1: towerTopY, w: 4.1, d: 6.8 }
      ];
      for (const side of [-1, 1]) {
        for (const t of tiers) {
          const h = t.y1 - t.y0;
          addPart(new THREE.BoxGeometry(t.w, h, t.d), bridgeOrangeMat, side * legHalfX, t.y0 + h * 0.5, tz);
        }
        // Top cable saddle cap + aviation beacon
        addPart(new THREE.BoxGeometry(5.2, 4.2, 7.8), bridgeOrangeMat, side * legHalfX, towerTopY + 1.5, tz);
        addPart(new THREE.SphereGeometry(1.5, 8, 6), beaconMat, side * legHalfX, towerTopY + 5.2, tz);
      }
      // 4 Horizontal Art Deco Cross-Struts above deck (forming the 3 unmistakable open sky portals!)
      for (const [sy, sh, sd] of [[104, 7.5, 7.2], [142, 7.0, 6.4], [178, 6.5, 5.6], [214, 7.2, 5.2]]) {
        addPart(new THREE.BoxGeometry(legHalfX * 2 - 3.6, sh, sd), bridgeOrangeMat, 0, sy, tz);
      }
      // Under-deck horizontal cross-struts
      for (const sy of [24, 46, 60]) {
        addPart(new THREE.BoxGeometry(legHalfX * 2 - 4, 4.2, 6.2), bridgeOrangeMat, 0, sy, tz);
      }
    }

    // 3. Sweeping Catenary Main Suspension Cables + Instanced Vertical Suspender Cables
    const catenaryY = z => {
      const az = Math.abs(z);
      if (az <= halfMain) {
        const u = z / halfMain;
        return deckY + 6 + (towerTopY - deckY - 6) * u * u;
      }
      const u = Math.min(1, (az - halfMain) / (halfTotal - halfMain));
      return towerTopY - (towerTopY - deckY - 12) * Math.pow(u, 1.38);
    };
    const cablePts = [];
    for (let z = -halfTotal; z <= halfTotal; z += 30) cablePts.push([z, catenaryY(z)]);
    const segDummy = new THREE.Object3D();
    const suspenderMatrices = [];
    const mainSegMatrices = [];
    const upVec = new THREE.Vector3(0, 1, 0);
    const vA = new THREE.Vector3(), vB = new THREE.Vector3(), dir = new THREE.Vector3();

    for (const side of [-1, 1]) {
      const cxOff = side * legHalfX;
      for (let i = 0; i < cablePts.length - 1; i++) {
        vA.set(cxOff, cablePts[i][1], cablePts[i][0]);
        vB.set(cxOff, cablePts[i + 1][1], cablePts[i + 1][0]);
        dir.subVectors(vB, vA);
        const len = dir.length();
        segDummy.position.copy(vA).addScaledVector(dir, 0.5);
        segDummy.quaternion.setFromUnitVectors(upVec, dir.clone().normalize());
        segDummy.scale.set(1.05, len + 0.4, 1.05);
        segDummy.updateMatrix();
        mainSegMatrices.push(segDummy.matrix.clone());
      }
      // Vertical suspender cables every 26m
      for (let z = -halfTotal + 36; z <= halfTotal - 36; z += 26) {
        if (Math.abs(Math.abs(z) - halfMain) < 18) continue;
        const topY = catenaryY(z);
        const h = Math.max(2, topY - deckY);
        segDummy.position.set(cxOff, deckY + h * 0.5, z);
        segDummy.quaternion.identity();
        segDummy.scale.set(0.24, h, 0.24);
        segDummy.updateMatrix();
        suspenderMatrices.push(segDummy.matrix.clone());
      }
    }
    if (mainSegMatrices.length) {
      const mainCableInst = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.55, 0.55, 1, 8), bridgeCableMat, mainSegMatrices.length);
      mainSegMatrices.forEach((mat, i) => mainCableInst.setMatrixAt(i, mat));
      g.add(mainCableInst);
    }
    if (suspenderMatrices.length) {
      const suspInst = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.5, 0.5, 1, 6), steelArchMat, suspenderMatrices.length);
      suspenderMatrices.forEach((mat, i) => suspInst.setMatrixAt(i, mat));
      g.add(suspInst);
    }
    // Concrete shore anchorages + deck streetlights
    for (const az of [-halfTotal, halfTotal]) {
      addPart(new THREE.BoxGeometry(38, 76, 36), roofMat, 0, 38, az);
    }
    const lampPts = [];
    for (let z = -halfTotal + 60; z <= halfTotal - 60; z += 75) {
      for (const side of [-1, 1]) lampPts.push({ x: side * (deckW * 0.47), y: deckY + 7.5, z });
    }
    const lampInst = new THREE.InstancedMesh(new THREE.SphereGeometry(0.95, 6, 5), lampMat, lampPts.length);
    lampPts.forEach((lp, i) => {
      segDummy.position.set(lp.x, lp.y, lp.z);
      segDummy.quaternion.identity();
      segDummy.scale.set(1, 1, 1);
      segDummy.updateMatrix();
      lampInst.setMatrixAt(i, segDummy.matrix);
    });
    g.add(lampInst);

    // 4. Moving 6-Lane Golden Gate Bridge Traffic Vehicles (animated smoothly in update!)
    const carCount = 44;
    const carGeo = new THREE.BoxGeometry(2.1, 1.45, 4.6);
    const carMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.42, metalness: 0.35 });
    const carInst = new THREE.InstancedMesh(carGeo, carMat, carCount);
    const carSpecs = [];
    const carColors = [0xe8edf2, 0x2a3138, 0xc83e32, 0x3b6fa0, 0xd4a948, 0x5c6670];
    const tmpCol = new THREE.Color();
    for (let i = 0; i < carCount; i++) {
      const dirSign = i % 2 === 0 ? 1 : -1;
      const laneIdx = i % 3;
      const laneX = dirSign * (3.1 + laneIdx * 3.4);
      const z0 = ((i / carCount) * 2 - 1) * (halfTotal - 50);
      const spd = (24 + (i % 5) * 3.2) * dirSign;
      carSpecs.push({ x: laneX, z: z0, spd });
      tmpCol.setHex(carColors[i % carColors.length]);
      carInst.setColorAt?.(i, tmpCol);
    }
    if (carInst.instanceColor) carInst.instanceColor.needsUpdate = true;
    g.add(carInst);

    // 5. Coastal Bluff Vista Buildings, Historic Fort Point & Iconic Bay Sea-Stack Rock + Bay Boats!
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x3c3a37, roughness: 0.92, metalness: 0.04 });
    // Iconic dark sea-stack rock jutting out of the bay west of the bridge (matching lowpass aerial view)
    const seaStack = addPart(new THREE.DodecahedronGeometry(34, 1), rockMat, -185, 11, 210, 0.2, 0.7, 0.1);
    seaStack.scale.set(1.1, 1.35, 0.9);
    const reefRock = addPart(new THREE.DodecahedronGeometry(18, 0), rockMat, -152, 4, 245);
    reefRock.scale.set(1.4, 0.55, 1.1);
    // Historic brick Fort Point nestled right under the south anchorage
    const fortMat = new THREE.MeshStandardMaterial({ color: 0x8b4c3b, roughness: 0.86 });
    addPart(new THREE.BoxGeometry(58, 20, 44), fortMat, -32, 10, halfTotal - 90);
    // Coastal Vista Point visitor parking strip & white-roofed buildings on the bluff
    for (let b = 0; b < 4; b++) {
      addPart(new THREE.BoxGeometry(14, 7.5, 24), whiteShellMat, -76 - b * 4, 26, halfTotal - 260 + b * 36);
    }
    // Cargo ship & sailboats cruising San Francisco Bay
    const ships = [];
    const shipGroup = new THREE.Group();
    const hullMat = new THREE.MeshStandardMaterial({ color: 0x26323d, roughness: 0.65 });
    const hullMesh = new THREE.Mesh(new THREE.BoxGeometry(24, 9, 138), hullMat);
    hullMesh.position.y = 4.5;
    shipGroup.add(hullMesh);
    const contMat = new THREE.MeshStandardMaterial({ color: 0xb54434, roughness: 0.7 });
    const containers = new THREE.Mesh(new THREE.BoxGeometry(20, 10, 88), contMat);
    containers.position.set(0, 13, 8);
    shipGroup.add(containers);
    const bridgeHouse = new THREE.Mesh(new THREE.BoxGeometry(19, 16, 16), whiteShellMat);
    bridgeHouse.position.set(0, 17, -42);
    shipGroup.add(bridgeHouse);
    shipGroup.position.set(-480, 0, -140);
    shipGroup.rotation.y = Math.PI * 0.46;
    g.add(shipGroup);
    ships.push({ obj: shipGroup, vx: 6.5, vz: 0.8, minX: -950, maxX: 950 });

    g.userData.animate = (dt) => {
      const step = Math.min(0.1, dt || 0.016);
      for (let i = 0; i < carSpecs.length; i++) {
        const c = carSpecs[i];
        c.z += c.spd * step;
        if (c.z > halfTotal - 40) c.z = -(halfTotal - 40);
        else if (c.z < -(halfTotal - 40)) c.z = halfTotal - 40;
        segDummy.position.set(c.x, deckY + 1.85, c.z);
        segDummy.rotation.set(0, c.spd > 0 ? 0 : Math.PI, 0);
        segDummy.scale.set(1, 1, 1);
        segDummy.updateMatrix();
        carInst.setMatrixAt(i, segDummy.matrix);
      }
      carInst.instanceMatrix.needsUpdate = true;
      for (const s of ships) {
        s.obj.position.x += s.vx * step;
        s.obj.position.z += s.vz * step;
        if (s.obj.position.x > s.maxX) s.obj.position.x = s.minX;
      }
    };
    animatedLandmarks.push(g);
    return g;
  }

  const animatedLandmarks = [];

  const realLandmarksBuilt = new Set();
  function buildRealLandmarkAtGPS(lm) {
    if (lm.type === 'pin_only' || typeof geoPoint !== 'function') return null;
    const pt = geoPoint(lm.lat, lm.lon);
    if (!pt) return null;
    const cx = pt.x, cz = pt.z;
    if (lm.type === 'golden_gate') return buildGoldenGateBridge(cx, cz);
    const gy = Math.max(0.5, ground(cx, cz));
    const g = new THREE.Group();
    g.name = 'RealLandmark_' + lm.id;
    const beacons = [];
    const addBox = (mat, w, h, d, x, y, z, ry = 0) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z); if (ry) m.rotation.y = ry;
      m.castShadow = m.receiveShadow = true; g.add(m); return m;
    };
    const addCyl = (mat, rt, rb, h, segs, x, y, z, ry = 0) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, segs), mat);
      m.position.set(x, y, z); if (ry) m.rotation.y = ry;
      m.castShadow = m.receiveShadow = true; g.add(m); return m;
    };

    if (lm.type === 'burj') {
      // Y-shaped 3-wing spiraling setbacks rising to 828m (scaled ~680m silhouette)
      addCyl(landmarkGlassMat, 10, 22, 540, 6, cx, gy + 270, cz);
      for (let w = 0; w < 3; w++) {
        const ang = (w * Math.PI * 2) / 3;
        for (let t = 0; t < 4; t++) {
          const th = 420 - t * 90 - w * 28;
          const dist = 16 + t * 9;
          addCyl(landmarkGlassMat, 9 - t * 1.1, 11 - t * 1.1, th, 10, cx + Math.cos(ang) * dist, gy + th * 0.5, cz + Math.sin(ang) * dist);
        }
      }
      addCyl(whiteShellMat, 1.4, 7.5, 165, 10, cx, gy + 610, cz);
      beacons.push({ x: cx, y: gy + 695, z: cz });
    } else if (lm.type === 'eiffel' || lm.type === 'tokyo_tower') {
      const mat = lm.type === 'tokyo_tower' ? bridgeOrangeMat : monumentGoldMat;
      // 4 angled lattice corner legs meeting at 1st & 2nd decks
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const leg = addBox(mat, 9.5, 92, 9.5, cx + sx * 24, gy + 44, cz + sz * 24);
        leg.rotation.z = sx * 0.24; leg.rotation.x = -sz * 0.24;
      }
      addBox(mat, 66, 7, 66, cx, gy + 84, cz);
      addCyl(mat, 14, 24, 72, 4, cx, gy + 123, cz, Math.PI / 4);
      addBox(lm.type === 'tokyo_tower' ? whiteShellMat : mat, 36, 6, 36, cx, gy + 160, cz);
      addCyl(mat, 4.2, 13, 130, 4, cx, gy + 226, cz, Math.PI / 4);
      addCyl(whiteShellMat, 0.9, 3.0, 42, 8, cx, gy + 310, cz);
      beacons.push({ x: cx, y: gy + 333, z: cz });
    } else if (lm.type === 'skytree') {
      addCyl(whiteShellMat, 16, 34, 290, 3, cx, gy + 145, cz);
      addCyl(landmarkGlassMat, 26, 22, 24, 24, cx, gy + 298, cz);
      addCyl(whiteShellMat, 10, 15, 110, 12, cx, gy + 365, cz);
      addCyl(landmarkGlassMat, 17, 16, 16, 20, cx, gy + 422, cz);
      addCyl(whiteShellMat, 1.2, 6.5, 115, 10, cx, gy + 485, cz);
      beacons.push({ x: cx, y: gy + 544, z: cz });
    } else if (lm.type === 'mbs') {
      // Marina Bay Sands: 3 tilted towers + 340m SkyPark cantilevered boat + ArtScience Lotus Museum
      for (const ox of [-58, 0, 58]) {
        const tw = addBox(landmarkGlassMat, 26, 194, 42, cx + ox, gy + 96, cz);
        tw.rotation.z = 0.08;
        const tw2 = addBox(landmarkGlassMat, 22, 194, 38, cx + ox + 12, gy + 96, cz);
        tw2.rotation.z = -0.04;
      }
      addBox(monumentGoldMat, 250, 12, 48, cx + 24, gy + 198, cz);
      // 10-petal white ArtScience Lotus Museum on bayfront
      for (let p = 0; p < 10; p++) {
        const a = (p / 10) * Math.PI * 2;
        const petal = addBox(whiteShellMat, 8, 36, 14, cx - 125 + Math.cos(a) * 18, gy + 18, cz + 65 + Math.sin(a) * 18, -a);
        petal.rotation.z = 0.35;
      }
      beacons.push({ x: cx + 145, y: gy + 206, z: cz }, { x: cx - 98, y: gy + 206, z: cz });
    } else if (lm.type === 'petronas') {
      for (const ox of [-42, 42]) {
        addCyl(landmarkGlassMat, 20, 24, 340, 16, cx + ox, gy + 170, cz);
        addCyl(whiteShellMat, 10, 19, 55, 16, cx + ox, gy + 365, cz);
        addCyl(monumentGoldMat, 1.2, 4.5, 62, 10, cx + ox, gy + 422, cz);
        beacons.push({ x: cx + ox, y: gy + 455, z: cz });
      }
      addBox(whiteShellMat, 62, 10, 12, cx, gy + 172, cz);
    } else if (lm.type === 'lotte') {
      addCyl(landmarkGlassMat, 9, 34, 520, 16, cx, gy + 260, cz);
      beacons.push({ x: cx, y: gy + 523, z: cz });
    } else if (lm.type === 'opera_house') {
      addBox(roofMat, 150, 12, 110, cx, gy + 5, cz);
      for (const [ox, oz, s] of [[-38, -14, 1.0], [-14, -8, 1.18], [16, -2, 0.95], [40, 10, 0.78], [-22, 24, 0.85], [14, 28, 0.72]]) {
        const sail = new THREE.Mesh(new THREE.ConeGeometry(22 * s, 54 * s, 6), whiteShellMat);
        sail.position.set(cx + ox, gy + 10 + 24 * s, cz + oz);
        sail.rotation.z = -0.26; sail.scale.set(0.72, 1.0, 1.28);
        sail.castShadow = true; g.add(sail);
      }
    } else if (lm.type === 'harbour_bridge') {
      const deckY = 54;
      addBox(bridgeDeckMat, 36, 3.5, 580, cx, deckY, cz);
      for (const az of [-250, 250]) {
        for (const sx of [-1, 1]) addBox(roofMat, 16, 89, 26, cx + sx * 22, 44, cz + az);
      }
      for (let i = -10; i <= 10; i++) {
        const z = i * 24, u = z / 250;
        const archY = 132 - 78 * u * u;
        for (const sx of [-1, 1]) {
          addBox(steelArchMat, 4.5, 9, 26, cx + sx * 19, archY, cz + z);
          if (archY > deckY + 6) addBox(steelArchMat, 1.2, archY - deckY, 1.2, cx + sx * 19, (archY + deckY) * 0.5, cz + z);
        }
      }
    } else if (lm.type === 'tower_bridge') {
      addBox(bridgeDeckMat, 22, 3, 240, cx, 16, cz);
      for (const tz of [-52, 52]) {
        addBox(bldgWallMat, 24, 65, 18, cx, 32, cz + tz);
        addCyl(monumentGoldMat, 1, 8, 18, 4, cx, 72, cz + tz, Math.PI / 4);
      }
      addBox(landmarkGlassMat, 16, 6, 104, cx, 46, cz);
    } else if (lm.type === 'owtc') {
      addBox(landmarkGlassMat, 46, 417, 46, cx, gy + 208, cz, Math.PI / 8);
      addCyl(whiteShellMat, 1.2, 4.8, 124, 12, cx, gy + 478, cz);
      beacons.push({ x: cx, y: gy + 543, z: cz });
    } else if (lm.type === 'empire') {
      if (lm.id === 'chicago_willis') {
        // Exact 9-bundled-tube Fazlur Khan setback matrix + twin 85m white broadcast antennas
        const tubes = [
          [-1, -1, 198], [0, -1, 362], [1, -1, 266],
          [-1, 0, 442],  [0, 0, 442],  [1, 0, 362],
          [-1, 1, 266],  [0, 1, 362],  [1, 1, 198]
        ];
        for (const [gx, gz, th] of tubes) {
          addBox(roofMat, 22.5, th, 22.5, cx + gx * 22.9, gy + th * 0.5, cz + gz * 22.9);
        }
        addCyl(whiteShellMat, 1.0, 2.8, 85, 10, cx - 22.9, gy + 484, cz);
        addCyl(whiteShellMat, 1.0, 2.8, 78, 10, cx, gy + 481, cz);
        beacons.push({ x: cx - 22.9, y: gy + 528, z: cz }, { x: cx, y: gy + 521, z: cz });
      } else {
        addBox(bldgWallMat, 52, 265, 36, cx, gy + 132, cz);
        addBox(bldgWallMat, 34, 88, 24, cx, gy + 308, cz);
        addCyl(whiteShellMat, 1.1, 6, 90, 12, cx, gy + 397, cz);
        beacons.push({ x: cx, y: gy + 444, z: cz });
      }
    } else if (lm.type === 'liberty') {
      addBox(roofMat, 34, 46, 34, cx, gy + 23, cz);
      addCyl(copperGreenMat, 5, 9, 34, 12, cx, gy + 63, cz);
      addCyl(monumentGoldMat, 2.2, 1.5, 14, 10, cx + 5, gy + 86, cz);
    } else if (lm.type === 'shard') {
      // 8 angled overlapping extra-white glass shards meeting at fractured open-air spire
      addCyl(landmarkGlassMat, 3.2, 35, 310, 8, cx, gy + 154, cz, Math.PI / 8);
      for (let sh = 0; sh < 4; sh++) {
        const a = (sh / 4) * Math.PI * 2;
        const shH = 290 + sh * 6;
        addBox(whiteShellMat, 2.5, shH * 0.35, 14, cx + Math.cos(a) * 5, gy + shH * 0.82, cz + Math.sin(a) * 5, -a);
      }
      beacons.push({ x: cx, y: gy + 312, z: cz });
    } else if (lm.type === 'clock_tower') {
      addBox(monumentGoldMat, 14, 72, 14, cx, gy + 36, cz);
      addCyl(steelArchMat, 1.2, 10, 26, 4, cx, gy + 85, cz, Math.PI / 4);
    } else if (lm.type === 'pyramid_tower') {
      addCyl(whiteShellMat, 2.8, 34, 260, 4, cx, gy + 130, cz, Math.PI / 4);
      beacons.push({ x: cx, y: gy + 262, z: cz });
    } else if (lm.type === 'glass_obelisk') {
      if (lm.id === 'shanghai_tower') {
        // 120-degree helically twisted tapered rounded-triangle loft (9 stacked sky-lobby zones!)
        for (let zIdx = 0; zIdx < 9; zIdx++) {
          const zH = lm.h / 9;
          const rBot = 40 * (1 - zIdx * 0.06);
          const rTop = 40 * (1 - (zIdx + 1) * 0.06);
          addCyl(landmarkGlassMat, rTop, rBot, zH, 3, cx, gy + zIdx * zH + zH * 0.5, cz, (zIdx / 9) * (Math.PI * 2 / 3));
        }
      } else {
        addCyl(landmarkGlassMat, 18, 28, lm.h, 16, cx, gy + lm.h * 0.5, cz);
      }
      beacons.push({ x: cx, y: gy + lm.h + 2, z: cz });
    } else if (lm.type === 'needle') {
      const h = lm.h || 350;
      if (lm.id === 'gz_canton') {
        // Hyperboloid twisted hourglass waist (Canton Tower)
        addCyl(steelArchMat, 13, 36, h * 0.44, 16, cx, gy + h * 0.22, cz);
        addCyl(steelArchMat, 26, 13, h * 0.30, 16, cx, gy + h * 0.59, cz);
        addCyl(whiteShellMat, 1.0, 5.0, h * 0.26, 10, cx, gy + h * 0.87, cz);
      } else {
        addCyl(bldgWallMat, 7, 22, h * 0.72, 16, cx, gy + h * 0.36 - 1, cz);
        addCyl(monumentGoldMat, 26, 22, 18, 20, cx, gy + h * 0.68, cz);
        addCyl(landmarkGlassMat, 28, 28, 12, 20, cx, gy + h * 0.72, cz);
        addCyl(monumentGoldMat, 1.0, 5.0, h * 0.28, 10, cx, gy + h * 0.86, cz);
      }
      beacons.push({ x: cx, y: gy + h + 2, z: cz });
    } else if (lm.type === 'pyramids') {
      addCyl(monumentGoldMat, 2, 115, 146, 4, cx, gy + 72, cz, Math.PI / 4);
      addCyl(monumentGoldMat, 2, 105, 136, 4, cx - 280, gy + 67, cz + 220, Math.PI / 4);
      addCyl(monumentGoldMat, 2, 58, 68, 4, cx - 510, gy + 33, cz + 420, Math.PI / 4);
    } else if (lm.type === 'colosseum') {
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(86, 88, 46, 28, 1, true), bldgWallMat);
      ring.material = bldgWallMat.clone(); ring.material.side = THREE.DoubleSide;
      ring.position.set(cx, gy + 23, cz); ring.scale.set(1.18, 1, 0.96); g.add(ring);
    } else if (lm.type === 'christ') {
      addBox(roofMat, 12, 10, 12, cx, gy + 5, cz);
      addCyl(whiteShellMat, 3.2, 4.5, 30, 10, cx, gy + 25, cz);
      addBox(whiteShellMat, 28, 4, 4, cx, gy + 32, cz);
    } else if (lm.type === 'kaohsiung_85') {
      // Kaohsiung 85 Sky Tower: Pronged "高" twin lower piers merging into central 347m tower + 378m spire
      for (const ox of [-22, 22]) addBox(landmarkGlassMat, 22, 165, 34, cx + ox, gy + 82, cz);
      addBox(landmarkGlassMat, 48, 178, 34, cx, gy + 185, cz);
      addCyl(monumentGoldMat, 4, 24, 38, 4, cx, gy + 293, cz, Math.PI / 4);
      addCyl(whiteShellMat, 0.8, 2.2, 48, 8, cx, gy + 336, cz);
      beacons.push({ x: cx, y: gy + 362, z: cz });
    } else if (lm.type === 'palace_hall') {
      // CKS Memorial Hall / Grand Hotel / Taichung Opera
      const h = lm.h || 70;
      addBox(whiteShellMat, 64, h * 0.56, 56, cx, gy + h * 0.28, cz);
      addCyl(bridgeOrangeMat, 6, 48, h * 0.44, 8, cx, gy + h * 0.78, cz, Math.PI / 8);
      beacons.push({ x: cx, y: gy + h + 2, z: cz });
    } else if (lm.type === 'castle_keep') {
      // Osaka Castle / Neuschwanstein / Fuji Pagoda
      const h = lm.h || 56;
      addBox(roofMat, 54, h * 0.32, 54, cx, gy + h * 0.16, cz);
      for (let t = 0; t < 4; t++) {
        const w = 38 - t * 7, y = gy + h * 0.32 + t * (h * 0.16);
        addBox(whiteShellMat, w, h * 0.14, w, cx, y, cz);
        addCyl(copperGreenMat, w * 0.35, w * 0.82, h * 0.07, 4, cx, y + h * 0.09, cz, Math.PI / 4);
      }
    } else if (lm.type === 'cctv_loop') {
      // Beijing CCTV Headquarters canted 3D structural loop
      for (const [ox, oz] of [[-38, -28], [38, 28]]) {
        const leg = addBox(landmarkGlassMat, 34, 210, 34, cx + ox, gy + 105, cz + oz);
        leg.rotation.z = ox > 0 ? 0.11 : -0.11;
      }
      addBox(landmarkGlassMat, 118, 36, 76, cx, gy + 192, cz);
      beacons.push({ x: cx, y: gy + 218, z: cz });
    } else if (lm.type === 'taj_mahal') {
      // Taj Mahal / Griffith Observatory white marble onion dome & 4 corner minarets
      addBox(whiteShellMat, 86, 12, 86, cx, gy + 6, cz);
      addBox(whiteShellMat, 52, 34, 52, cx, gy + 29, cz);
      addCyl(whiteShellMat, 4, 18, 28, 16, cx, gy + 58, cz);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        addCyl(whiteShellMat, 2.2, 3.2, 44, 10, cx + sx * 38, gy + 34, cz + sz * 38);
      }
    } else if (lm.type === 'sail_hotel') {
      // Dubai Burj Al Arab billowing dhow sail & cantilevered circular helipad
      addCyl(whiteShellMat, 6, 38, 280, 3, cx, gy + 140, cz);
      addCyl(landmarkGlassMat, 14, 34, 250, 12, cx + 8, gy + 132, cz);
      addCyl(whiteShellMat, 15, 15, 2.5, 20, cx - 18, gy + 210, cz);
      addCyl(whiteShellMat, 0.9, 2.5, 42, 8, cx, gy + 300, cz);
      beacons.push({ x: cx, y: gy + 322, z: cz });
    } else if (lm.type === 'torus_ring') {
      // Dubai Museum of the Future metallic torus ring
      const torus = new THREE.Mesh(new THREE.TorusGeometry(34, 12, 12, 28), steelArchMat);
      torus.position.set(cx, gy + 44, cz);
      torus.scale.set(1.35, 1.0, 0.65);
      g.add(torus);
    } else if (lm.type === 'arch_gate') {
      // Arc de Triomphe / Parthenon
      for (const ox of [-16, 16]) addBox(bldgWallMat, 14, 46, 22, cx + ox, gy + 23, cz);
      addBox(bldgWallMat, 46, 16, 23, cx, gy + 42, cz);
    } else if (lm.type === 'ferris_wheel') {
      // London Eye 135m cantilevered observation wheel
      const rim = new THREE.Mesh(new THREE.TorusGeometry(58, 2.2, 10, 28), whiteShellMat);
      rim.position.set(cx, gy + 72, cz);
      g.add(rim);
      for (const sx of [-1, 1]) {
        const leg = addCyl(whiteShellMat, 1.8, 2.6, 82, 8, cx + sx * 22, gy + 38, cz);
        leg.rotation.z = -sx * 0.28;
      }
      beacons.push({ x: cx, y: gy + 134, z: cz });
    } else if (lm.type === 'pisa') {
      // Leaning Tower of Pisa tilted 4 degrees
      const pisa = addCyl(whiteShellMat, 7.6, 8.2, 56, 18, cx, gy + 28, cz);
      pisa.rotation.z = 0.072;
    } else if (lm.type === 'sagrada') {
      // Barcelona Sagrada Familia 5 organic spindle honeycomb towers
      for (const [ox, oz, th] of [[0, 0, 172], [-18, -14, 115], [18, -14, 115], [-18, 14, 110], [18, 14, 110]]) {
        addCyl(monumentGoldMat, 2.2, 9.5, th, 10, cx + ox, gy + th * 0.5, cz + oz);
      }
      addBox(bldgWallMat, 58, 45, 76, cx, gy + 22, cz);
      beacons.push({ x: cx, y: gy + 174, z: cz });
    }
    // Automatic Blender .glb landmark model loader via models/glb-manifest.json (or explicit lm.glb)
    if (typeof THREE.GLTFLoader === 'function') {
      const loadGlbFile = (relPath) => {
        try {
          new THREE.GLTFLoader().load('models/' + relPath, (gltf) => {
            if (gltf && gltf.scene) {
              // Hide procedural fallback meshes once Blender .glb arrives
              g.children.forEach(ch => { ch.visible = false; });
              gltf.scene.position.set(cx, gy, cz);
              g.add(gltf.scene);
            }
          });
        } catch (_) {}
      };
      if (lm.glb) {
        loadGlbFile(lm.glb);
      } else if (typeof getSkyboundGlbManifest === 'function') {
        getSkyboundGlbManifest().then(manifest => {
          if (manifest && Array.isArray(manifest.landmarks) && manifest.landmarks.includes(lm.id)) {
            loadGlbFile('landmarks/' + lm.id + '.glb');
          }
        });
      }
    }
    if (beacons.length) {
      const dummy = new THREE.Object3D();
      const bInst = new THREE.InstancedMesh(new THREE.SphereGeometry(1.4, 8, 6), beaconMat, beacons.length);
      beacons.forEach((b, idx) => {
        dummy.position.set(b.x, b.y, b.z);
        dummy.updateMatrix();
        bInst.setMatrixAt(idx, dummy.matrix);
      });
      g.add(bInst);
    }
    return g;
  }

  function ensureRealGPSLandmarks(px, pz) {
    if (typeof geoPoint !== 'function') return;
    for (let i = 0; i < REAL_WORLD_LANDMARKS.length; i++) {
      const lm = REAL_WORLD_LANDMARKS[i];
      if (realLandmarksBuilt.has(lm.id)) continue;
      const pt = geoPoint(lm.lat, lm.lon);
      if (!pt) continue;
      if (Math.hypot(px - pt.x, pz - pt.z) > 105000) continue;
      realLandmarksBuilt.add(lm.id);
      const grp = buildRealLandmarkAtGPS(lm);
      if (grp) root.add(grp);
    }
  }

  // Fast ear-clipping / convex-fan XZ polygon triangulator for exact 1:1 real-map OSM building roofs
  function triangulatePolyXZ(pts) {
    const n = pts.length;
    if (n < 3) return [];
    if (n === 3) return [0, 1, 2];
    if (n === 4) return [0, 1, 2, 0, 2, 3];
    // Signed area in XZ plane; ensure CCW
    let area = 0;
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % n];
      area += a.x * b.z - b.x * a.z;
    }
    const idx = [];
    for (let i = 0; i < n; i++) idx.push(area >= 0 ? i : n - 1 - i);
    const tris = [];
    const cross = (a, b, c) => (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
    const inTri = (p, a, b, c) => {
      const c1 = cross(a, b, p), c2 = cross(b, c, p), c3 = cross(c, a, p);
      return (c1 >= -1e-6 && c2 >= -1e-6 && c3 >= -1e-6);
    };
    let guard = n * n;
    while (idx.length > 3 && guard-- > 0) {
      let clipped = false;
      const m = idx.length;
      for (let i = 0; i < m; i++) {
        const i0 = idx[(i + m - 1) % m], i1 = idx[i], i2 = idx[(i + 1) % m];
        const a = pts[i0], b = pts[i1], c = pts[i2];
        if (cross(a, b, c) <= 1e-6) continue;
        let contains = false;
        for (let k = 0; k < m; k++) {
          const ik = idx[k];
          if (ik === i0 || ik === i1 || ik === i2) continue;
          if (inTri(pts[ik], a, b, c)) { contains = true; break; }
        }
        if (!contains) {
          tris.push(i0, i1, i2);
          idx.splice(i, 1);
          clipped = true;
          break;
        }
      }
      if (!clipped) break;
    }
    if (idx.length === 3) tris.push(idx[0], idx[1], idx[2]);
    return tris;
  }

  // XZ ray-casting point-in-polygon check for OSM parks, forests & stepped rooftop penthouses
  function pointInPolyXZ(x, z, pts) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i].x, zi = pts[i].z;
      const xj = pts[j].x, zj = pts[j].z;
      const intersect = ((zi > z) !== (zj > z)) && (x < ((xj - xi) * (z - zi)) / ((zj - zi) || 1e-9) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  const OSM_NAMED_COLORS = {
    white: [0.95, 0.95, 0.94],
    offwhite: [0.93, 0.91, 0.86],
    ivory: [0.95, 0.93, 0.86],
    cream: [0.94, 0.90, 0.80],
    beige: [0.87, 0.80, 0.69],
    sand: [0.86, 0.78, 0.63],
    sandstone: [0.84, 0.74, 0.58],
    wheat: [0.90, 0.82, 0.66],
    tan: [0.82, 0.71, 0.55],
    khaki: [0.78, 0.72, 0.54],
    buff: [0.88, 0.78, 0.60],
    ochre: [0.80, 0.56, 0.24],
    grey: [0.66, 0.68, 0.71],
    gray: [0.66, 0.68, 0.71],
    lightgrey: [0.81, 0.83, 0.85],
    lightgray: [0.81, 0.83, 0.85],
    silver: [0.79, 0.81, 0.84],
    darkgrey: [0.40, 0.43, 0.47],
    darkgray: [0.40, 0.43, 0.47],
    charcoal: [0.32, 0.35, 0.39],
    anthracite: [0.30, 0.33, 0.37],
    black: [0.22, 0.24, 0.27],
    brown: [0.58, 0.41, 0.31],
    lightbrown: [0.72, 0.56, 0.43],
    darkbrown: [0.42, 0.30, 0.22],
    chocolate: [0.52, 0.34, 0.22],
    sienna: [0.66, 0.38, 0.24],
    umber: [0.46, 0.35, 0.26],
    red: [0.74, 0.34, 0.28],
    darkred: [0.55, 0.22, 0.20],
    brick: [0.71, 0.37, 0.29],
    maroon: [0.52, 0.20, 0.22],
    crimson: [0.74, 0.24, 0.26],
    terracotta: [0.80, 0.46, 0.32],
    orange: [0.85, 0.54, 0.28],
    coral: [0.86, 0.50, 0.40],
    salmon: [0.88, 0.56, 0.48],
    rust: [0.68, 0.34, 0.22],
    yellow: [0.90, 0.81, 0.47],
    lightyellow: [0.94, 0.90, 0.68],
    gold: [0.85, 0.72, 0.36],
    amber: [0.88, 0.66, 0.28],
    blue: [0.44, 0.60, 0.78],
    darkblue: [0.26, 0.39, 0.56],
    lightblue: [0.68, 0.80, 0.91],
    skyblue: [0.60, 0.78, 0.92],
    navy: [0.24, 0.33, 0.48],
    azure: [0.48, 0.68, 0.86],
    cyan: [0.48, 0.76, 0.82],
    teal: [0.34, 0.60, 0.62],
    green: [0.44, 0.60, 0.47],
    darkgreen: [0.28, 0.44, 0.32],
    lightgreen: [0.64, 0.78, 0.62],
    olive: [0.54, 0.58, 0.36],
    sage: [0.62, 0.70, 0.58],
    copper: [0.42, 0.64, 0.56],
    pink: [0.86, 0.67, 0.68],
    rose: [0.84, 0.58, 0.60],
    purple: [0.58, 0.48, 0.66],
    violet: [0.60, 0.50, 0.70],
    slate: [0.45, 0.50, 0.56],
    stone: [0.80, 0.77, 0.71],
    limestone: [0.85, 0.81, 0.73],
    marble: [0.92, 0.91, 0.88],
    granite: [0.62, 0.60, 0.59],
    concrete: [0.76, 0.78, 0.80],
    metal: [0.72, 0.76, 0.80],
    glass: [0.66, 0.80, 0.90]
  };

  function hexToRgb01(hex) {
    return [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
  }

  function parseOsmColor(raw, fallbackRgb) {
    if (typeof raw === 'string' && raw.trim()) {
      const s = raw.trim().toLowerCase();
      if (s[0] === '#') {
        const hex = s.slice(1);
        if (/^[0-9a-f]{6}$/.test(hex)) {
          return [
            parseInt(hex.slice(0, 2), 16) / 255,
            parseInt(hex.slice(2, 4), 16) / 255,
            parseInt(hex.slice(4, 6), 16) / 255
          ];
        }
        if (/^[0-9a-f]{3}$/.test(hex)) {
          return [
            parseInt(hex[0] + hex[0], 16) / 255,
            parseInt(hex[1] + hex[1], 16) / 255,
            parseInt(hex[2] + hex[2], 16) / 255
          ];
        }
      }
      const rgbMatch = s.match(/^rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)/);
      if (rgbMatch) {
        return [
          Math.min(1, Math.max(0, parseFloat(rgbMatch[1]) / 255)),
          Math.min(1, Math.max(0, parseFloat(rgbMatch[2]) / 255)),
          Math.min(1, Math.max(0, parseFloat(rgbMatch[3]) / 255))
        ];
      }
      const norm = s.replace(/[\s_-]+/g, '');
      if (OSM_NAMED_COLORS[norm]) return OSM_NAMED_COLORS[norm];
    }
    return fallbackRgb || [0.86, 0.87, 0.89];
  }

  // Exact 1:1 Real OpenStreetMap Polygon Extruded Buildings, Highways, Live Traffic & Parks Streamer
  const liveOsmCells = new Map();
  const liveOsmTraffic = new Map();
  const osmTrafficDummy = new THREE.Object3D();
  let liveOsmBusy = false;
  let lastOsmCheck = 0;

  function updateOsmTrafficEntry(entry, dt, nightAmt = 0) {
    const { inst, paths, vehicles } = entry;
    if (!inst || !vehicles || !vehicles.length) return;
    const step = Math.min(0.1, Math.max(0, dt || 0));
    const scaleBoost = 1 + nightAmt * 0.16;
    for (let i = 0; i < vehicles.length; i++) {
      const v = vehicles[i];
      const path = paths[v.pathIdx];
      if (!path || path.totalLen <= 0.1) continue;
      v.dist += v.dir * v.speed * step;
      if (v.dist > path.totalLen) v.dist -= path.totalLen;
      else if (v.dist < 0) v.dist += path.totalLen;
      if (v.dist > path.totalLen || v.dist < 0) {
        v.dist = ((v.dist % path.totalLen) + path.totalLen) % path.totalLen;
      }
      // Find active segment along polyline
      let acc = 0;
      let segIdx = 0;
      const segLens = path.segLens;
      for (let s = 0; s < segLens.length; s++) {
        if (v.dist <= acc + segLens[s] || s === segLens.length - 1) {
          segIdx = s;
          break;
        }
        acc += segLens[s];
      }
      const segLen = segLens[segIdx] || 1;
      const t = Math.min(1, Math.max(0, (v.dist - acc) / segLen));
      const a = path.pts[segIdx], b = path.pts[segIdx + 1];
      const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
      const hLen = Math.hypot(dx, dz) || 1;
      const tx = dx / hLen, tz = dz / hLen;
      // Right-hand lateral offset perpendicular to travel direction
      const rx = -tz, rz = tx;
      const px = a.x + dx * t + rx * v.laneOffset;
      const py = a.y + dy * t + 0.18;
      const pz = a.z + dz * t + rz * v.laneOffset;
      const yaw = Math.atan2(tx * v.dir, tz * v.dir);
      osmTrafficDummy.position.set(px, py, pz);
      osmTrafficDummy.rotation.set(0, yaw, 0);
      osmTrafficDummy.scale.set(scaleBoost, scaleBoost, scaleBoost);
      osmTrafficDummy.updateMatrix();
      inst.setMatrixAt(i, osmTrafficDummy.matrix);
    }
    if (inst.instanceMatrix) inst.instanceMatrix.needsUpdate = true;
  }

  function updateLiveOsmTraffic(dt, nightAmt = 0) {
    for (const entry of liveOsmTraffic.values()) {
      updateOsmTrafficEntry(entry, dt, nightAmt);
    }
  }

  function evictOldOsmCells() {
    const maxLiveOsmCells = isLowMem ? 8 : 20;
    while (liveOsmCells.size > maxLiveOsmCells) {
      const oldKey = liveOsmCells.keys().next().value;
      const oldVal = liveOsmCells.get(oldKey);
      if (oldVal && typeof oldVal === 'object' && oldVal.isObject3D) {
        root.remove(oldVal);
        oldVal.traverse(o => {
          if (o.geometry && o.geometry !== osmTrafficGeo && o.geometry !== osmTreeGeo) {
            o.geometry.dispose();
          }
        });
      }
      liveOsmCells.delete(oldKey);
      liveOsmTraffic.delete(oldKey);
      const bi = liveOsmBoxes.findIndex(b => b.key === oldKey);
      if (bi >= 0) liveOsmBoxes.splice(bi, 1);
    }
  }

  function buildOsmCellFromData(cellKey, data, cellLat, cellLon, maxWays) {
    if (!data || !Array.isArray(data.elements)) { liveOsmCells.set(cellKey, 'empty'); evictOldOsmCells(); return null; }
    const nodes = new Map();
    const buildingWays = [];
    const highwayWays = [];
    const parkWays = [];
    for (let i = 0; i < data.elements.length; i++) {
      const el = data.elements[i];
      if (el.type === 'node') {
        nodes.set(el.id, [el.lat, el.lon]);
      } else if (el.type === 'way' && Array.isArray(el.nodes) && el.nodes.length >= 2 && el.tags) {
        const t = el.tags;
        if (t.building && el.nodes.length >= 3) {
          buildingWays.push(el);
        } else if (t.highway && /^(motorway|trunk|primary)$/.test(t.highway)) {
          highwayWays.push(el);
        } else if ((t.landuse === 'forest' || t.landuse === 'wood' || t.leisure === 'park') && el.nodes.length >= 3) {
          parkWays.push(el);
        }
      }
    }
    if (!buildingWays.length && !highwayWays.length && !parkWays.length) {
      liveOsmCells.set(cellKey, 'empty');
      evictOldOsmCells();
      return null;
    }

    // Regional architectural defaults when explicit OSM colour tags are absent
    const country = typeof WorldAtlas !== 'undefined' && Number.isFinite(cellLat) && Number.isFinite(cellLon)
      ? WorldAtlas.countryAt(cellLon, cellLat) : null;
    const cellCenter = (Number.isFinite(cellLat) && Number.isFinite(cellLon)) ? geoPoint(cellLat, cellLon) : null;
    const hubAp = cellCenter ? nearestHubInfo(cellCenter.x, cellCenter.z).airport : null;
    const biome = country?.biome || 'temperate';
    const regionCode = hubAp?.region || (biome === 'arid' ? 'me' : biome === 'mediterranean' ? 'eu' : 'na');
    const pal = getRegionalPalette(country, regionCode);
    const isEuropean = regionCode === 'eu' || biome === 'mediterranean';
    const isMiddleEast = regionCode === 'me' || biome === 'arid';
    const isJapan = Number.isFinite(cellLat) && Number.isFinite(cellLon) && cellLat >= 24 && cellLat <= 46 && cellLon >= 123 && cellLon <= 148;

    // 1. Extrude real OSM buildings with true building:colour, roof:colour, height & stepped rooftops
    const wPos = [], wNrm = [], wUv = [], wCol = [];
    const gPos = [], gNrm = [], gUv = [], gCol = [];
    const rPos = [], rNrm = [], rUv = [], rCol = [];
    let bldgCount = 0;
    let cellMinX = 1e12, cellMaxX = -1e12, cellMinZ = 1e12, cellMaxZ = -1e12;

    const pushWallQuad = (posArr, nrmArr, uvArr, colArr, ax, az, bx, bz, yBot, yTop, nx, nz, uLen, vRep, rgb) => {
      posArr.push(ax, yBot, az, bx, yBot, bz, bx, yTop, bz, ax, yBot, az, bx, yTop, bz, ax, yTop, az);
      for (let k = 0; k < 6; k++) {
        nrmArr.push(nx, 0, nz);
        colArr.push(rgb[0], rgb[1], rgb[2]);
      }
      uvArr.push(0, 0, uLen, 0, uLen, vRep, 0, 0, uLen, vRep, 0, vRep);
    };

    const pushRoofTri = (p0x, p0z, p1x, p1z, p2x, p2z, yTop, rgb) => {
      rPos.push(p0x, yTop, p0z, p2x, yTop, p2z, p1x, yTop, p1z);
      rNrm.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
      rUv.push(p0x * 0.04, p0z * 0.04, p2x * 0.04, p2z * 0.04, p1x * 0.04, p1z * 0.04);
      for (let k = 0; k < 3; k++) rCol.push(rgb[0], rgb[1], rgb[2]);
    };

    const pushPenthouseBox = (cx, cz, hx, hz, yBot, yTop, wallRgb, roofRgb) => {
      const x0 = cx - hx, x1 = cx + hx, z0 = cz - hz, z1 = cz + hz;
      const vRep = Math.max(0.5, (yTop - yBot) / 8);
      const uX = Math.max(0.5, (hx * 2) / 10), uZ = Math.max(0.5, (hz * 2) / 10);
      pushWallQuad(wPos, wNrm, wUv, wCol, x0, z1, x1, z1, yBot, yTop, 0, 1, uX, vRep, wallRgb);
      pushWallQuad(wPos, wNrm, wUv, wCol, x1, z0, x0, z0, yBot, yTop, 0, -1, uX, vRep, wallRgb);
      pushWallQuad(wPos, wNrm, wUv, wCol, x1, z1, x1, z0, yBot, yTop, 1, 0, uZ, vRep, wallRgb);
      pushWallQuad(wPos, wNrm, wUv, wCol, x0, z0, x0, z1, yBot, yTop, -1, 0, uZ, vRep, wallRgb);
      pushRoofTri(x0, z0, x0, z1, x1, z1, yTop, roofRgb);
      pushRoofTri(x0, z0, x1, z1, x1, z0, yTop, roofRgb);
    };

    for (let wi = 0; wi < buildingWays.length; wi++) {
      if (bldgCount >= maxWays) break;
      const w = buildingWays[wi];
      const pts = [];
      const rawIds = w.nodes;
      const endIdx = rawIds[0] === rawIds[rawIds.length - 1] ? rawIds.length - 1 : rawIds.length;
      for (let i = 0; i < endIdx; i++) {
        const nd = nodes.get(rawIds[i]);
        if (nd) pts.push(geoPoint(nd[0], nd[1]));
      }
      if (pts.length < 3 || pts.length > 48) continue;
      let cx = 0, cz = 0;
      let minX = 1e12, maxX = -1e12, minZ = 1e12, maxZ = -1e12;
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        cx += p.x; cz += p.z;
        if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
        if (p.z < minZ) minZ = p.z; if (p.z > maxZ) maxZ = p.z;
      }
      cx /= pts.length; cz /= pts.length;
      if (inAirportClearance(cx, cz, 140)) continue;
      const gy = ground(cx, cz);
      if (gy < 0.5) continue;

      const tags = w.tags || {};
      const rawH = typeof tags.height === 'string' ? parseFloat(tags.height.replace(/[^\d.+-]/g, '')) : parseFloat(tags.height);
      const rawLevels = parseFloat(tags['building:levels']);
      const parsedH = (Number.isFinite(rawH) && rawH > 0) ? rawH : (Number.isFinite(rawLevels) && rawLevels > 0 ? rawLevels * 3.5 : 0);
      const bh = parsedH > 2.5 ? Math.min(420, parsedH) : (tags.building === 'apartments' || tags.building === 'commercial' ? 18 : tags.building === 'office' ? 28 : 10.5);
      const y0 = gy - 1.5, y1 = gy + bh;
      const matTag = typeof tags['building:material'] === 'string' ? tags['building:material'].trim().toLowerCase() : '';
      const isGlass = bh > 36 || tags.building === 'office' || tags.building === 'skyscraper' || matTag === 'glass';

      // Signed area to ensure consistent outward wall normals
      let sArea = 0;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        sArea += a.x * b.z - b.x * a.z;
      }
      if (Math.abs(sArea) < 12) continue;
      if (sArea < 0) pts.reverse();

      // Resolve realistic per-building wall & roof RGB colors (explicit OSM tags always take priority 1:1!)
      const bSeed = Math.abs(Math.floor(cx * 3.1 + cz * 5.7)) + wi;
      const defaultWallHex = isGlass
        ? pal.glass[bSeed % pal.glass.length]
        : (isJapan ? [0xf0eee9, 0xe7e1d6, 0xdce0e4, 0xebe6dc][bSeed % 4] : pal.apt[bSeed % pal.apt.length]);
      let fallbackWallRgb = hexToRgb01(defaultWallHex);
      if (matTag && OSM_NAMED_COLORS[matTag.replace(/[\s_-]+/g, '')]) {
        fallbackWallRgb = OSM_NAMED_COLORS[matTag.replace(/[\s_-]+/g, '')];
      }
      const wallRgb = parseOsmColor(tags['building:colour'] || tags['building:color'], fallbackWallRgb);

      let fallbackRoofRgb;
      if (isEuropean && bh < 26) {
        fallbackRoofRgb = hexToRgb01([0xb85d40, 0xa85238, 0x9c4c36, 0x7a5c52][bSeed % 4]);
      } else if (isMiddleEast) {
        fallbackRoofRgb = hexToRgb01([0xd6c3a4, 0xcab696, 0xbfa988][bSeed % 3]);
      } else if (isJapan) {
        fallbackRoofRgb = hexToRgb01([0x9ea5ac, 0x8b949c, 0xa8adb2][bSeed % 3]);
      } else {
        fallbackRoofRgb = hexToRgb01(bh >= 26 ? 0x6f7780 : [0x7c838a, 0x6c737a, 0x8b7e74][bSeed % 3]);
      }
      const roofRgb = parseOsmColor(tags['roof:colour'] || tags['roof:color'], fallbackRoofRgb);

      const tPos = isGlass ? gPos : wPos;
      const tNrm = isGlass ? gNrm : wNrm;
      const tUv = isGlass ? gUv : wUv;
      const tCol = isGlass ? gCol : wCol;
      const vRepeat = Math.max(1, bh / 12);

      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        if (a.x < cellMinX) cellMinX = a.x; if (a.x > cellMaxX) cellMaxX = a.x;
        if (a.z < cellMinZ) cellMinZ = a.z; if (a.z > cellMaxZ) cellMaxZ = a.z;
        const dx = b.x - a.x, dz = b.z - a.z;
        const len = Math.hypot(dx, dz);
        if (len < 0.4) continue;
        const nx = dz / len, nz = -dx / len;
        const uLen = Math.max(0.5, len / 14);
        pushWallQuad(tPos, tNrm, tUv, tCol, a.x, a.z, b.x, b.z, y0, y1, nx, nz, uLen, vRepeat, wallRgb);
      }

      // Exact triangulated roof polygon
      const tris = triangulatePolyXZ(pts);
      let bestTriArea = -1, bestTriCx = cx, bestTriCz = cz;
      for (let t = 0; t < tris.length; t += 3) {
        const p0 = pts[tris[t]], p1 = pts[tris[t + 1]], p2 = pts[tris[t + 2]];
        pushRoofTri(p0.x, p0.z, p1.x, p1.z, p2.x, p2.z, y1, roofRgb);
        const ta = Math.abs((p1.x - p0.x) * (p2.z - p0.z) - (p2.x - p0.x) * (p1.z - p0.z)) * 0.5;
        if (ta > bestTriArea) {
          bestTriArea = ta;
          bestTriCx = (p0.x + p1.x + p2.x) / 3;
          bestTriCz = (p0.z + p1.z + p2.z) / 3;
        }
      }

      // Stepped rooftop mechanical penthouse + parapet rim for tall buildings (>= 26m)
      if (bh >= 26) {
        const parapetH = Math.min(2.2, 0.9 + bh * 0.012);
        const rimRgb = [wallRgb[0] * 0.86, wallRgb[1] * 0.86, wallRgb[2] * 0.86];
        for (let i = 0; i < pts.length; i++) {
          const a = pts[i], b = pts[(i + 1) % pts.length];
          const dx = b.x - a.x, dz = b.z - a.z;
          const len = Math.hypot(dx, dz);
          if (len < 0.6) continue;
          const nx = dz / len, nz = -dx / len;
          pushWallQuad(tPos, tNrm, tUv, tCol, a.x, a.z, b.x, b.z, y1, y1 + parapetH, nx, nz, Math.max(0.4, len / 14), 0.25, rimRgb);
        }

        const anchorX = pointInPolyXZ(cx, cz, pts) ? cx : bestTriCx;
        const anchorZ = pointInPolyXZ(cx, cz, pts) ? cz : bestTriCz;
        let hx = Math.min(16, Math.max(2.4, (maxX - minX) * 0.22));
        let hz = Math.min(16, Math.max(2.4, (maxZ - minZ) * 0.22));
        const fitsInRoof = (ox, oz) =>
          pointInPolyXZ(anchorX - ox, anchorZ - oz, pts) &&
          pointInPolyXZ(anchorX + ox, anchorZ - oz, pts) &&
          pointInPolyXZ(anchorX + ox, anchorZ + oz, pts) &&
          pointInPolyXZ(anchorX - ox, anchorZ + oz, pts);
        if (!fitsInRoof(hx, hz)) { hx *= 0.55; hz *= 0.55; }
        if (hx >= 1.6 && hz >= 1.6 && fitsInRoof(hx, hz)) {
          const pentH = Math.min(9.5, Math.max(2.8, bh * 0.065));
          const pentWallRgb = [roofRgb[0] * 0.88, roofRgb[1] * 0.88, roofRgb[2] * 0.88];
          const pentRoofRgb = [roofRgb[0] * 0.94, roofRgb[1] * 0.94, roofRgb[2] * 0.94];
          pushPenthouseBox(anchorX, anchorZ, hx, hz, y1, y1 + pentH, pentWallRgb, pentRoofRgb);
          if (bh >= 65 && hx >= 3.0 && hz >= 3.0) {
            pushPenthouseBox(anchorX, anchorZ, hx * 0.56, hz * 0.56, y1 + pentH, y1 + pentH * 1.62, rimRgb, pentRoofRgb);
          }
        }
      }
      bldgCount++;
    }

    // 2. Real OSM 3D Highways & Bridges (highway=motorway|trunk|primary)
    const hwyPos = [], hwyNrm = [], hwyUv = [];
    const hwyStripePos = [];
    const pierPos = [], pierNrm = [];
    const highwayPaths = [];

    const pushPierBox = (cx, cz, yBot, yTop, hw, hd) => {
      if (yTop - yBot < 0.8) return;
      const x0 = cx - hw, x1 = cx + hw, z0 = cz - hd, z1 = cz + hd;
      const q = (ax, ay, az, bx, by, bz, dx, dy, dz, ex, ey, ez, nx, ny, nz) => {
        pierPos.push(ax, ay, az, bx, by, bz, dx, dy, dz, ax, ay, az, dx, dy, dz, ex, ey, ez);
        for (let k = 0; k < 6; k++) pierNrm.push(nx, ny, nz);
      };
      q(x0, yBot, z1, x1, yBot, z1, x1, yTop, z1, x0, yTop, z1, 0, 0, 1);
      q(x1, yBot, z0, x0, yBot, z0, x0, yTop, z0, x1, yTop, z0, 0, 0, -1);
      q(x1, yBot, z1, x1, yBot, z0, x1, yTop, z0, x1, yTop, z1, 1, 0, 0);
      q(x0, yBot, z0, x0, yBot, z1, x0, yTop, z1, x0, yTop, z0, -1, 0, 0);
    };

    for (let hi = 0; hi < highwayWays.length; hi++) {
      const w = highwayWays[hi];
      const tags = w.tags || {};
      const hwType = tags.highway;
      const width = hwType === 'motorway' ? 16 : hwType === 'trunk' ? 12 : 9;
      const hw = width * 0.5;
      const isBridge = Boolean(tags.bridge && tags.bridge !== 'no');
      const oneway = tags.oneway === 'yes' || tags.oneway === '1' || tags.oneway === 'true';

      const rawPts = [];
      for (let i = 0; i < w.nodes.length; i++) {
        const nd = nodes.get(w.nodes[i]);
        if (nd) rawPts.push(geoPoint(nd[0], nd[1]));
      }
      if (rawPts.length < 2) continue;

      // Subdivide long spans so terrain contours and river crossings are smooth
      const subPts = [rawPts[0]];
      for (let i = 0; i < rawPts.length - 1; i++) {
        const a = rawPts[i], b = rawPts[i + 1];
        const segLen = Math.hypot(b.x - a.x, b.z - a.z);
        if (segLen < 0.8) continue;
        const steps = Math.max(1, Math.min(12, Math.ceil(segLen / 55)));
        for (let s = 1; s <= steps; s++) {
          const t = s / steps;
          subPts.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
        }
      }
      if (subPts.length < 2) continue;

      // Split into airport-clear runs and resolve road / bridge elevations
      let currentRun = [];
      let pierDistAcc = 22;
      const flushRun = () => {
        if (currentRun.length < 2) { currentRun = []; return; }
        const segLens = [];
        let totalLen = 0;
        for (let i = 0; i < currentRun.length - 1; i++) {
          const a = currentRun[i], b = currentRun[i + 1];
          const sl = Math.hypot(b.x - a.x, b.z - a.z);
          segLens.push(sl);
          totalLen += sl;
        }
        if (totalLen >= 25) {
          highwayPaths.push({ pts: currentRun, segLens, totalLen, width, oneway });
        }
        currentRun = [];
      };

      const liftPoint = (pt) => {
        const gY = ground(pt.x, pt.z);
        const elevated = isBridge || gY < 0.8;
        const y = elevated ? Math.max(gY + 0.35, 9.5) : (gY + 0.35);
        return { x: pt.x, y, z: pt.z, gY, elevated };
      };

      for (let i = 0; i < subPts.length - 1; i++) {
        const pA = subPts[i], pB = subPts[i + 1];
        const mx = (pA.x + pB.x) * 0.5, mz = (pA.z + pB.z) * 0.5;
        if (inAirportClearance(mx, mz, 130)) {
          flushRun();
          continue;
        }
        const a = liftPoint(pA), b = liftPoint(pB);
        const dx = b.x - a.x, dz = b.z - a.z;
        const len = Math.hypot(dx, dz);
        if (len < 0.8) continue;

        if (!currentRun.length) currentRun.push(a);
        currentRun.push(b);

        const nx = -dz / len, nz = dx / len;
        const alx = a.x - nx * hw, alz = a.z - nz * hw;
        const arx = a.x + nx * hw, arz = a.z + nz * hw;
        const blx = b.x - nx * hw, blz = b.z - nz * hw;
        const brx = b.x + nx * hw, brz = b.z + nz * hw;

        // Road surface ribbon (+Y upward normal)
        hwyPos.push(
          alx, a.y, alz, arx, a.y, arz, brx, b.y, brz,
          alx, a.y, alz, brx, b.y, brz, blx, b.y, blz
        );
        for (let k = 0; k < 6; k++) hwyNrm.push(0, 1, 0);
        const vLen = len / 20;
        hwyUv.push(0, 0, 1, 0, 1, vLen, 0, 0, 1, vLen, 0, vLen);

        // Center stripe ribbon
        const sw = 0.34, syA = a.y + 0.08, syB = b.y + 0.08;
        hwyStripePos.push(
          a.x - nx * sw, syA, a.z - nz * sw, a.x + nx * sw, syA, a.z + nz * sw, b.x + nx * sw, syB, b.z + nz * sw,
          a.x - nx * sw, syA, a.z - nz * sw, b.x + nx * sw, syB, b.z + nz * sw, b.x - nx * sw, syB, b.z - nz * sw
        );

        // Bridge concrete side fascia + vertical support piers when bridge=yes or crossing water
        if (a.elevated || b.elevated) {
          const deckDepth = 1.45;
          // Left & right deck fascia skirts
          pierPos.push(
            alx, a.y - deckDepth, alz, blx, b.y - deckDepth, blz, blx, b.y, blz,
            alx, a.y - deckDepth, alz, blx, b.y, blz, alx, a.y, alz,
            brx, b.y - deckDepth, brz, arx, a.y - deckDepth, arz, arx, a.y, arz,
            brx, b.y - deckDepth, brz, arx, a.y, arz, brx, b.y, brz
          );
          for (let k = 0; k < 6; k++) pierNrm.push(-nx, 0, -nz);
          for (let k = 0; k < 6; k++) pierNrm.push(nx, 0, nz);

          pierDistAcc += len;
          if (pierDistAcc >= 45) {
            pierDistAcc = 0;
            const pierOff = hw * 0.62;
            const deckBot = (a.y + b.y) * 0.5 - deckDepth * 0.85;
            const footY = Math.min(a.gY, b.gY, 0) - 2.5;
            pushPierBox(mx - nx * pierOff, mz - nz * pierOff, footY, deckBot, 0.95, 0.95);
            pushPierBox(mx + nx * pierOff, mz + nz * pierOff, footY, deckBot, 0.95, 0.95);
          }
        }
      }
      flushRun();
    }

    // 3. Real OSM Park & Forest 3D Trees (landuse=forest|wood, leisure=park)
    const parkTrees = [];
    const maxCellTrees = isLowMem ? 260 : 520;
    for (let pi = 0; pi < parkWays.length && parkTrees.length < maxCellTrees; pi++) {
      const w = parkWays[pi];
      const tags = w.tags || {};
      const pts = [];
      const rawIds = w.nodes;
      const endIdx = rawIds[0] === rawIds[rawIds.length - 1] ? rawIds.length - 1 : rawIds.length;
      for (let i = 0; i < endIdx; i++) {
        const nd = nodes.get(rawIds[i]);
        if (nd) pts.push(geoPoint(nd[0], nd[1]));
      }
      if (pts.length < 3) continue;
      let minX = 1e12, maxX = -1e12, minZ = 1e12, maxZ = -1e12;
      let area2 = 0;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        if (a.x < minX) minX = a.x; if (a.x > maxX) maxX = a.x;
        if (a.z < minZ) minZ = a.z; if (a.z > maxZ) maxZ = a.z;
        area2 += a.x * b.z - b.x * a.z;
      }
      const polyArea = Math.abs(area2) * 0.5;
      if (polyArea < 80) continue;

      const isForest = tags.landuse === 'forest' || tags.landuse === 'wood';
      const areaPerTree = isForest ? 460 : 760;
      const remaining = maxCellTrees - parkTrees.length;
      const targetForPark = Math.min(remaining, Math.min(140, Math.max(4, Math.floor(polyArea / areaPerTree))));
      const spanX = Math.max(10, maxX - minX);
      const spanZ = Math.max(10, maxZ - minZ);
      const aspect = Math.min(4, Math.max(0.25, spanX / spanZ));
      const cols = Math.min(18, Math.max(2, Math.ceil(Math.sqrt(targetForPark * aspect * 1.4))));
      const rows = Math.min(18, Math.max(2, Math.ceil((targetForPark * 1.4) / cols)));
      const stepX = spanX / cols, stepZ = spanZ / rows;
      let addedHere = 0;

      for (let rz = 0; rz < rows && addedHere < targetForPark && parkTrees.length < maxCellTrees; rz++) {
        for (let cxIdx = 0; cxIdx < cols && addedHere < targetForPark && parkTrees.length < maxCellTrees; cxIdx++) {
          const jx = 0.15 + hash2(cxIdx * 31 + pi * 7, rz * 17 + 3) * 0.70;
          const jz = 0.15 + hash2(rz * 29 + pi * 11, cxIdx * 19 + 5) * 0.70;
          const tx = minX + (cxIdx + jx) * stepX;
          const tz = minZ + (rz + jz) * stepZ;
          if (!pointInPolyXZ(tx, tz, pts)) continue;
          if (inAirportClearance(tx, tz, 160)) continue;
          const tg = ground(tx, tz);
          if (tg < 0.8 || tg > 2400) continue;
          const tr = (isForest ? 5.4 : 4.6) + hash2(cxIdx * 13 + pi, rz * 23) * 5.2;
          parkTrees.push({
            x: tx,
            y: tg + tr * 0.72,
            z: tz,
            r: tr,
            sy: 0.82 + hash2(rz * 7, cxIdx * 11 + pi) * 0.34,
            color: getTreeTone(biome, hash2(cxIdx + pi * 3, rz))
          });
          addedHere++;
        }
      }
    }

    if (!bldgCount && !hwyPos.length && !parkTrees.length) {
      liveOsmCells.set(cellKey, 'empty');
      return null;
    }

    const g = new THREE.Group();
    g.name = 'LiveOSM_RealPoly_' + cellKey;
    const makeMerged = (pos, nrm, uv, col, mat, meshName, castShadow = true, receiveShadow = true) => {
      if (!pos.length) return null;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      if (nrm && nrm.length) geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
      if (uv && uv.length) geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      if (col && col.length) geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      const m = new THREE.Mesh(geo, mat);
      if (meshName) m.name = meshName;
      m.castShadow = castShadow;
      m.receiveShadow = receiveShadow;
      g.add(m);
      return m;
    };

    makeMerged(wPos, wNrm, wUv, wCol, osmWallMat, 'OSM_Walls_' + cellKey, true, true);
    makeMerged(gPos, gNrm, gUv, gCol, osmGlassMat, 'OSM_Glass_' + cellKey, true, true);
    makeMerged(rPos, rNrm, rUv, rCol, osmRoofMat, 'OSM_Roofs_' + cellKey, true, true);
    makeMerged(hwyPos, hwyNrm, hwyUv, null, roadMat, 'OSM_Highways_' + cellKey, false, true);
    makeMerged(hwyStripePos, null, null, null, stripeMat, 'OSM_HighwayStripes_' + cellKey, false, false);
    makeMerged(pierPos, pierNrm, null, null, osmPierMat, 'OSM_BridgePiers_' + cellKey, true, true);

    // 4. Live Moving Highway Traffic InstancedMesh (<= 80 vehicles/cell, 22-30 m/s along real OSM highways!)
    if (highwayPaths.length) {
      let totalHwyLen = 0;
      for (let i = 0; i < highwayPaths.length; i++) totalHwyLen += highwayPaths[i].totalLen;
      const maxVehicles = isLowMem ? 48 : 80;
      const vehicleCount = Math.min(maxVehicles, Math.max(4, Math.floor(totalHwyLen / 55)));
      const vehicles = [];
      for (let i = 0; i < vehicleCount; i++) {
        // Length-weighted path selection
        let pick = hash2(i * 19 + 3, highwayPaths.length * 7) * totalHwyLen;
        let pathIdx = 0;
        for (let p = 0; p < highwayPaths.length; p++) {
          pick -= highwayPaths[p].totalLen;
          if (pick <= 0) { pathIdx = p; break; }
        }
        const path = highwayPaths[pathIdx];
        const dir = path.oneway ? 1 : (i % 2 === 0 ? 1 : -1);
        const speed = 22 + hash2(i * 13 + pathIdx * 5, bldgCount + 11) * 8;
        const laneOffset = dir * Math.max(1.8, path.width * 0.24);
        const dist = hash2(i * 29 + 7, pathIdx * 17 + 3) * path.totalLen;
        vehicles.push({ pathIdx, dist, dir, speed, laneOffset });
      }
      const trafficInst = new THREE.InstancedMesh(osmTrafficGeo, osmTrafficMat, vehicles.length);
      trafficInst.name = 'OSM_Traffic_' + cellKey;
      trafficInst.frustumCulled = false;
      g.add(trafficInst);
      const trafficEntry = { inst: trafficInst, paths: highwayPaths, vehicles };
      liveOsmTraffic.set(cellKey, trafficEntry);
      updateOsmTrafficEntry(trafficEntry, 0, 0);
    }

    // 5. Park & Forest 3D Trees InstancedMesh
    if (parkTrees.length) {
      const tInst = new THREE.InstancedMesh(osmTreeGeo, treeMat, parkTrees.length);
      tInst.name = 'OSM_Parks_' + cellKey;
      const tDummy = new THREE.Object3D();
      for (let i = 0; i < parkTrees.length; i++) {
        const t = parkTrees[i];
        tDummy.position.set(t.x, t.y, t.z);
        tDummy.rotation.set(0, 0, 0);
        tDummy.scale.set(t.r, t.r * t.sy, t.r);
        tDummy.updateMatrix();
        tInst.setMatrixAt(i, tDummy.matrix);
        if (typeof tInst.setColorAt === 'function') tInst.setColorAt(i, new THREE.Color(t.color));
      }
      if (tInst.instanceMatrix) tInst.instanceMatrix.needsUpdate = true;
      if (tInst.instanceColor) tInst.instanceColor.needsUpdate = true;
      tInst.receiveShadow = true;
      g.add(tInst);
    }

    root.add(g);
    liveOsmCells.set(cellKey, g);
    if (bldgCount && cellMinX < cellMaxX) {
      liveOsmBoxes.push({ key: cellKey, minX: cellMinX - 35, maxX: cellMaxX + 35, minZ: cellMinZ - 35, maxZ: cellMaxZ + 35 });
      liveOsmRevision++;
    }
    evictOldOsmCells();
    return g;
  }

  function streamLiveOsmBuildings(px, pz) {
    if (typeof fetch !== 'function' || typeof window === 'undefined' || typeof latLon !== 'function' || typeof geoPoint !== 'function') return;
    const now = performance.now ? performance.now() : Date.now();
    if (liveOsmBusy || now - lastOsmCheck < (isLowMem ? 4500 : 2800)) return;
    const { lat, lon } = latLon(px, pz);
    if (insideTaiwanDetailed(lat, lon)) return;
    const osmCity = window.__SKYBOUND_WORLD_CITY;
    if (osmCity && typeof osmCity.blocked === 'function' && osmCity.blocked(px, pz)) return;
    const nearHub = nearestAnyAirportDist(px, pz) < 105000;
    if (!nearHub) return;
    const step = isLowMem ? 0.014 : 0.018;
    const clat = Math.floor(lat / step) * step;
    const clon = Math.floor(lon / step) * step;
    const cellKey = clat.toFixed(3) + ',' + clon.toFixed(3);
    if (liveOsmCells.has(cellKey)) {
      // Touch LRU order so active cell stays hot
      const existing = liveOsmCells.get(cellKey);
      liveOsmCells.delete(cellKey);
      liveOsmCells.set(cellKey, existing);
      return;
    }
    liveOsmCells.set(cellKey, 'loading');
    liveOsmBusy = true;
    lastOsmCheck = now;

    const bbox = `${clat.toFixed(4)},${clon.toFixed(4)},${(clat + step).toFixed(4)},${(clon + step).toFixed(4)}`;
    const maxWays = isLowMem ? 340 : 620;
    const query = `[out:json][timeout:9];(way["building"](${bbox});way["highway"~"^(motorway|trunk|primary)$"](${bbox});way["landuse"~"^(forest|wood)$"](${bbox});way["leisure"="park"](${bbox}););out body ${maxWays};>;out skel qt;`;
    const fetchOsm = url => fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'data=' + encodeURIComponent(query)
    }).then(r => (r.ok ? r.json() : null));
    fetchOsm('https://overpass-api.de/api/interpreter')
      .catch(() => null)
      .then(d => d || fetchOsm('https://overpass.kumi.systems/api/interpreter'))
      .then(data => {
        liveOsmBusy = false;
        buildOsmCellFromData(cellKey, data, clat + step * 0.5, clon + step * 0.5, maxWays);
      }).catch(() => {
        liveOsmBusy = false;
        liveOsmCells.set(cellKey, 'error');
        evictOldOsmCells();
      });
  }

  // Bespoke 3D Iconic World Landmarks + 40-Tower Metropolitan CBD Skylines
  function buildBespokeLandmark(g, code, cx, gy, cz, beacons) {
    const addBox = (mat, w, h, d, x, y, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      m.castShadow = m.receiveShadow = true;
      g.add(m);
      return m;
    };
    const addCyl = (mat, rt, rb, h, segs, x, y, z) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, segs), mat);
      m.position.set(x, y, z);
      m.castShadow = m.receiveShadow = true;
      g.add(m);
      return m;
    };

    if (code === 'OMDB') {
      // Burj Khalifa stepped 6-tier spire (520m)
      const tiers = [[44, 90], [34, 175], [26, 260], [19, 340], [13, 415], [7.5, 475], [2.2, 525]];
      let prevH = 0;
      for (const [r, topH] of tiers) {
        const segH = topH - prevH;
        addCyl(landmarkGlassMat, r * 0.78, r, segH, 12, cx, gy + prevH + segH * 0.5 - 1, cz);
        prevH = topH;
      }
      beacons.push({ x: cx, y: gy + 527, z: cz });
    } else if (code === 'LFPG') {
      // Eiffel Tower 3-stage bronze lattice monument (300m) + La Defense Grande Arche
      addCyl(monumentGoldMat, 28, 52, 65, 4, cx, gy + 32, cz).rotation.y = Math.PI / 4;
      addBox(monumentGoldMat, 62, 6, 62, cx, gy + 65, cz);
      addCyl(monumentGoldMat, 16, 26, 75, 4, cx, gy + 105, cz).rotation.y = Math.PI / 4;
      addBox(monumentGoldMat, 36, 5, 36, cx, gy + 143, cz);
      addCyl(monumentGoldMat, 4.5, 15, 125, 4, cx, gy + 205, cz).rotation.y = Math.PI / 4;
      addCyl(monumentGoldMat, 0.8, 2.5, 36, 8, cx, gy + 285, cz);
      beacons.push({ x: cx, y: gy + 305, z: cz });
    } else if (code === 'EGLL') {
      // The Shard (310m tapered glass pyramid) + Gherkin
      addCyl(landmarkGlassMat, 3.5, 34, 305, 4, cx, gy + 151, cz).rotation.y = Math.PI / 4;
      addCyl(landmarkGlassMat, 14, 24, 180, 16, cx + 140, gy + 89, cz - 80);
      beacons.push({ x: cx, y: gy + 306, z: cz });
    } else if (code === 'KJFK') {
      // One World Trade Center (415m + spire) + Empire State Building stepped art-deco tower
      addBox(landmarkGlassMat, 42, 340, 42, cx, gy + 169, cz);
      addCyl(monumentGoldMat, 1.2, 4.5, 78, 12, cx, gy + 378, cz);
      beacons.push({ x: cx, y: gy + 419, z: cz });
      addBox(bldgWallMat, 46, 240, 32, cx - 180, gy + 119, cz + 120);
      addBox(bldgWallMat, 30, 65, 22, cx - 180, gy + 270, cz + 120);
      addCyl(monumentGoldMat, 1.2, 5, 58, 12, cx - 180, gy + 330, cz + 120);
      beacons.push({ x: cx - 180, y: gy + 361, z: cz + 120 });
    } else if (code === 'HECA') {
      // Great Pyramids of Giza (Khufu, Khafre, Menkaure)
      addCyl(monumentGoldMat, 2, 115, 146, 4, cx - 220, gy + 72, cz - 180).rotation.y = Math.PI / 4;
      addCyl(monumentGoldMat, 2, 105, 136, 4, cx - 40, gy + 67, cz - 30).rotation.y = Math.PI / 4;
      addCyl(monumentGoldMat, 2, 58, 68, 4, cx + 110, gy + 33, cz + 95).rotation.y = Math.PI / 4;
    } else if (code === 'CYYZ' || code === 'KSEA' || code === 'ZSPD' || code === 'ZGGG') {
      // Observation Needle Tower (CN Tower / Space Needle / Oriental Pearl / Canton Tower)
      const h = code === 'CYYZ' ? 380 : code === 'ZSPD' ? 350 : 280;
      addCyl(bldgWallMat, 7, 22, h * 0.72, 16, cx, gy + h * 0.36 - 1, cz);
      addCyl(monumentGoldMat, 26, 22, 18, 20, cx, gy + h * 0.68, cz);
      addCyl(landmarkGlassMat, 28, 28, 12, 20, cx, gy + h * 0.72, cz);
      addCyl(monumentGoldMat, 1.0, 5.0, h * 0.28, 10, cx, gy + h * 0.86, cz);
      beacons.push({ x: cx, y: gy + h + 2, z: cz });
    } else if (code === 'YSSY') {
      // Sydney Tower Eye golden turret + Harbour CBD
      addCyl(monumentGoldMat, 6.5, 14, 220, 16, cx, gy + 109, cz);
      addCyl(monumentGoldMat, 22, 18, 24, 20, cx, gy + 230, cz);
      addCyl(bldgWallMat, 1.2, 4, 48, 8, cx, gy + 265, cz);
      beacons.push({ x: cx, y: gy + 291, z: cz });
    } else if (code === 'KSFO') {
      // Transamerica Pyramid + Salesforce Tower
      addCyl(bldgWallMat, 2.5, 32, 260, 4, cx, gy + 129, cz).rotation.y = Math.PI / 4;
      addCyl(landmarkGlassMat, 20, 26, 295, 16, cx + 145, gy + 146, cz + 85);
      beacons.push({ x: cx, y: gy + 261, z: cz }, { x: cx + 145, y: gy + 296, z: cz + 85 });
    }
  }

  function ensureHubSkyline(px, pz) {
    for (let i = 0; i < airports.length; i++) {
      const a = airports[i];
      if (a.shortField || a.carrier || hubLandmarksAdded.has(a.code)) continue;
      if (Math.hypot(px - a.x, pz - a.z) > 75000) continue;
      hubLandmarksAdded.add(a.code);
      const { lat, lon } = latLon(a.x, a.z);
      if (insideTaiwanDetailed(lat, lon)) continue;
      const g = new THREE.Group();
      g.name = 'Skyline_' + a.code;
      const side = Math.sign(a.apron || 1);
      const basePt = { x: a.x + Math.cos(a.heading) * (side * 3400), z: a.z + Math.sin(a.heading) * (side * 3400) };
      const gy = ground(basePt.x, basePt.z);
      if (gy < 0.8) continue;

      const flagshipH = a.code === 'OMDB' ? 380 : ['KJFK', 'ZSPD', 'VHHH', 'RJTT', 'WSSS', 'KORD', 'ZGGG', 'ZBAA'].includes(a.code) ? 295 : 210;
      const towers = [];
      const podiums = [];
      const bcnPts = [];

      buildBespokeLandmark(g, a.code, basePt.x, gy, basePt.z, bcnPts);

      // 36-Building Multi-Tier Downtown CBD Cluster around the hub skyline center
      const totalTowers = 36;
      for (let k = 0; k < totalTowers; k++) {
        const ring = Math.floor(k / 9);
        const angle = ((k % 9) / 9) * Math.PI * 2 + ring * 0.42 + i * 0.31;
        const radius = 95 + ring * 135 + (k % 3) * 38;
        const ox = Math.cos(angle) * radius;
        const oz = Math.sin(angle) * radius;
        const tx = basePt.x + ox, tz = basePt.z + oz;
        if (inAirportClearance(tx, tz, 360)) continue;
        const tGround = ground(tx, tz);
        if (tGround < 0.8) continue;
        const distDecay = Math.max(0.28, 1 - ring * 0.21);
        const h = Math.max(48, flagshipH * distDecay * (0.45 + hash2(k * 11, i * 7) * 0.55));
        const w = 22 + (k % 4) * 5;
        const d = 22 + ((k + 2) % 4) * 5;
        // Street-level podium
        const podH = Math.min(18, h * 0.20);
        podiums.push({ x: tx, y: tGround + podH * 0.5 - 1, z: tz, w: w * 1.24, h: podH, d: d * 1.24 });
        // Main glass shaft
        towers.push({ x: tx, y: tGround + h * 0.5 - 1, z: tz, w, h, d });
        // Setback upper tier
        const tierH = h * 0.22;
        towers.push({ x: tx, y: tGround + h + tierH * 0.5 - 1.5, z: tz, w: w * 0.64, h: tierH, d: d * 0.64 });
        if (k < 10) {
          const spireH = h * 0.15;
          towers.push({ x: tx, y: tGround + h + tierH + spireH * 0.5 - 2, z: tz, w: w * 0.16, h: spireH, d: d * 0.16 });
          bcnPts.push({ x: tx, y: tGround + h + tierH + spireH + 1.2, z: tz });
        } else if (h > 95) {
          bcnPts.push({ x: tx, y: tGround + h + tierH + 1.2, z: tz });
        }
      }
      const dummy = new THREE.Object3D();
      if (podiums.length) {
        const pInst = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), [bldgWallMat, bldgWallMat, roofMat, roofMat, bldgWallMat, bldgWallMat], podiums.length);
        podiums.forEach((t, idx) => {
          dummy.position.set(t.x, t.y, t.z);
          dummy.scale.set(t.w, t.h, t.d);
          dummy.updateMatrix();
          pInst.setMatrixAt(idx, dummy.matrix);
        });
        pInst.castShadow = pInst.receiveShadow = true;
        g.add(pInst);
      }
      if (towers.length) {
        const tInst = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), [landmarkGlassMat, landmarkGlassMat, roofMat, roofMat, landmarkGlassMat, landmarkGlassMat], towers.length);
        towers.forEach((t, idx) => {
          dummy.position.set(t.x, t.y, t.z);
          dummy.scale.set(t.w, t.h, t.d);
          dummy.updateMatrix();
          tInst.setMatrixAt(idx, dummy.matrix);
        });
        tInst.castShadow = tInst.receiveShadow = true;
        g.add(tInst);
      }
      if (bcnPts.length) {
        const bInst = new THREE.InstancedMesh(new THREE.SphereGeometry(1.2, 8, 6), beaconMat, bcnPts.length);
        bcnPts.forEach((b, idx) => {
          dummy.position.set(b.x, b.y, b.z);
          dummy.scale.set(1, 1, 1);
          dummy.updateMatrix();
          bInst.setMatrixAt(idx, dummy.matrix);
        });
        g.add(bInst);
      }
      root.add(g);
    }
  }

  function update(px, pz, quality, dayRatio, dt = 0.016) {
    if (quality === 'low') {
      root.visible = false;
      return;
    }
    root.visible = true;
    const nightAmt = Math.max(0, 1 - dayRatio);
    houseMat.emissiveIntensity = nightAmt * 0.72;
    bldgWallMat.emissiveIntensity = nightAmt * 0.85;
    osmWallMat.emissiveIntensity = nightAmt * 0.85;
    indWallMat.emissiveIntensity = nightAmt * 0.55;
    landmarkGlassMat.emissiveIntensity = 0.10 + nightAmt * 0.90;
    osmGlassMat.emissiveIntensity = 0.10 + nightAmt * 0.90;
    monumentGoldMat.emissiveIntensity = 0.14 + nightAmt * 0.75;
    ensureHubSkyline(px, pz);
    ensureRealGPSLandmarks(px, pz);
    for (let i = 0; i < animatedLandmarks.length; i++) {
      animatedLandmarks[i].userData.animate?.(dt);
    }
    if (liveOsmTraffic.size) updateLiveOsmTraffic(dt, nightAmt);
    if (quality === 'ultra' || quality === 'high' || quality === 'balanced') streamLiveOsmBuildings(px, pz);

    const cx = Math.floor(px / TILE), cz = Math.floor(pz / TILE);
    const rad = isLowMem ? 3 : (quality === 'ultra' || quality === 'high' ? 5 : 4);
    const keep = new Set();
    const candidates = [];
    const sampler = typeof window !== 'undefined' ? window.__SKYBOUND_SAT_SAMPLER : null;
    for (let r = cz - rad; r <= cz + rad; r++) {
      for (let c = cx - rad; c <= cx + rad; c++) {
        const key = c + ':' + r;
        keep.add(key);
        const existing = loaded.get(key);
        const tx = (c + 0.5) * TILE, tz = (r + 0.5) * TILE;
        const nowHasSat = Boolean(sampler && sampler(tx, tz));
        // Only rebuild ONCE when this specific tile transitions no-sat -> has-sat, or when a live OSM cell covers it!
        const staleSat = existing && !existing.userData?.hadSat && nowHasSat;
        const staleOsm = existing && (existing.userData?.osmRev || 0) < liveOsmRevision && inLiveOsmArea(tx, tz);
        if (!loaded.has(key) || staleSat || staleOsm) {
          candidates.push({ c, r, key, stale: Boolean(staleSat || staleOsm), d: Math.hypot(c - cx, r - cz) });
        }
      }
    }
    candidates.sort((a, b) => a.d - b.d);
    const maxBuild = loaded.size < 9 ? 9 : 2;
    for (let i = 0; i < candidates.length && i < maxBuild; i++) {
      const { c, r, key, stale } = candidates[i];
      if (stale) {
        const old = loaded.get(key);
        if (old) {
          root.remove(old);
          old.traverse(o => { if (o.geometry && o.geometry !== houseGeo) o.geometry.dispose(); });
        }
      }
      loaded.set(key, buildTile(c, r));
    }
    for (const [key, grp] of loaded) {
      if (!keep.has(key)) {
        if (grp) {
          root.remove(grp);
          grp.traverse(o => { if (o.geometry && o.geometry !== houseGeo) o.geometry.dispose(); });
        }
        loaded.delete(key);
      }
    }
  }

  return { root, update, getLandmarks: () => REAL_WORLD_LANDMARKS };
}
const GlobalScenery = { createGlobalScenery, getLandmarks: () => [
  { id: 'golden_gate', name: '金門大橋', lat: 37.8199, lon: -122.4783 },
  { id: 'nyc_owtc', name: '世貿一號樓', lat: 40.7127, lon: -74.0134 },
  { id: 'nyc_empire', name: '帝國大廈', lat: 40.7484, lon: -73.9857 },
  { id: 'nyc_liberty', name: '自由女神', lat: 40.6892, lon: -74.0445 },
  { id: 'paris_eiffel', name: '艾菲爾鐵塔', lat: 48.8584, lon: 2.2945 },
  { id: 'london_shard', name: '碎片大廈', lat: 51.5045, lon: -0.0865 },
  { id: 'london_bigben', name: '大笨鐘', lat: 51.5007, lon: -0.1246 },
  { id: 'dubai_burj', name: '哈里發塔', lat: 25.1972, lon: 55.2744 },
  { id: 'tokyo_skytree', name: '東京晴空塔', lat: 35.7101, lon: 139.8107 },
  { id: 'tokyo_tower', name: '東京鐵塔', lat: 35.6586, lon: 139.7454 },
  { id: 'sg_mbs', name: '金沙酒店', lat: 1.2834, lon: 103.8607 },
  { id: 'kl_petronas', name: '雙峰塔', lat: 3.1579, lon: 101.7116 },
  { id: 'seoul_lotte', name: '樂天世界塔', lat: 37.5125, lon: 127.1025 },
  { id: 'shanghai_pearl', name: '東方明珠', lat: 31.2397, lon: 121.4998 },
  { id: 'hk_icc', name: '環球貿易廣場', lat: 22.3034, lon: 114.1602 },
  { id: 'sydney_opera', name: '雪梨歌劇院', lat: -33.8568, lon: 151.2153 },
  { id: 'cairo_giza', name: '吉薩金字塔', lat: 29.9792, lon: 31.1342 },
  { id: 'toronto_cn', name: 'CN 塔', lat: 43.6426, lon: -79.3871 },
  { id: 'seattle_needle', name: '太空針塔', lat: 47.6205, lon: -122.3493 },
  { id: 'rome_colosseum', name: '羅馬競技場', lat: 41.8902, lon: 12.4922 },
  { id: 'taipei_101', name: '台北 101', lat: 25.0339, lon: 121.5645 }
] };
if (typeof window !== 'undefined') window.GlobalScenery = GlobalScenery;
if (typeof globalThis !== 'undefined') Object.assign(globalThis, { createGlobalScenery, GlobalScenery });
