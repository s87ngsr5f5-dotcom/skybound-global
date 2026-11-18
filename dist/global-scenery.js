'use strict';
// Complete Worldwide 3D Architecture, Street-Block Cities, Regional Pitched-Roof Neighborhoods, Industrial Zones & Iconic Landmarks (v0.83).
function createGlobalScenery(scene, ground, airports = []) {
  const root = new THREE.Group();
  root.name = 'Global country roads & cities';
  scene.add(root);

  const TILE = 1600;
  const loaded = new Map();
  const hubLandmarksAdded = new Set();

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

  function buildTile(col, row) {
    const cx = (col + 0.5) * TILE, cz = (row + 0.5) * TILE;
    const ll = typeof latLon === 'function' ? latLon(cx, cz) : null;
    if (!ll || insideTaiwanDetailed(ll.lat, ll.lon)) return null;
    const country = typeof WorldAtlas !== 'undefined' ? WorldAtlas.countryAt(ll.lon, ll.lat) : null;
    const hubInfo = nearestHubInfo(cx, cz);
    const hubDist = hubInfo.dist;
    if (!country && hubDist > 26000) return null;
    const centerGround = ground(cx, cz);
    if (centerGround < 0.8) return null;

    const group = new THREE.Group();
    const posArr = [], linePosArr = [];
    const houses = [], apts = [], glassTowers = [], warehouses = [], lamps = [], beacons = [], trees = [];
    const x0 = col * TILE, z0 = row * TILE;
    const hubAp = hubInfo.airport;
    const cbdSide = Math.sign(hubAp?.apron || 1);
    const cbdX = hubAp ? hubAp.x + Math.cos(hubAp.heading) * (cbdSide * 3400) : 1e9;
    const cbdZ = hubAp ? hubAp.z + Math.sin(hubAp.heading) * (cbdSide * 3400) : 1e9;
    const cbdDist = Math.hypot(cx - cbdX, cz - cbdZ);
    const isMetroCore = cbdDist < 2800 || (hubDist > 2600 && hubDist < 6800 && hash2(col * 5, row * 9) > 0.68);
    const isUrbanTile = hubDist < 20000 || hash2(col * 3, row * 5) > 0.52;
    const isSuburbanTile = !isUrbanTile && (hubDist < 34000 || hash2(col * 7, row * 11) > 0.30);
    const biome = country?.biome || 'temperate';
    const pal = getRegionalPalette(country, hubAp?.region);

    // 1. Continuous cross-country arterial highways
    const segs = 4, step = TILE / segs;
    const hwyOffsetZ = z0 + TILE * 0.5 + (Math.sin(col * 0.45) * 220);
    const hwyOffsetZNext = z0 + TILE * 0.5 + (Math.sin((col + 1) * 0.45) * 220);
    const hwyOffsetX = x0 + TILE * 0.5 + (Math.cos(row * 0.45) * 220);
    const hwyOffsetXNext = x0 + TILE * 0.5 + (Math.cos((row + 1) * 0.45) * 220);

    for (let s = 0; s < segs; s++) {
      const t0 = s / segs, t1 = (s + 1) / segs;
      const hx0 = x0 + s * step, hz0 = hwyOffsetZ + (hwyOffsetZNext - hwyOffsetZ) * t0;
      const hx1 = x0 + (s + 1) * step, hz1 = hwyOffsetZ + (hwyOffsetZNext - hwyOffsetZ) * t1;
      addRoadStrip(posArr, linePosArr, hx0, hz0, hx1, hz1, 16);
      const vx0 = hwyOffsetX + (hwyOffsetXNext - hwyOffsetX) * t0, vz0 = z0 + s * step;
      const vx1 = hwyOffsetX + (hwyOffsetXNext - hwyOffsetX) * t1, vz1 = z0 + (s + 1) * step;
      addRoadStrip(posArr, linePosArr, vx0, vz0, vx1, vz1, 16);

      const hg = ground(hx0, hz0);
      if (hg >= 1.0 && !inAirportClearance(hx0, hz0, 240)) {
        lamps.push({ x: hx0, y: hg + 6.5, z: hz0 + 9.5 });
      }
    }

    // 2. Dense Urban & Suburban Street Grid (4x4 = 16 city blocks in urban tiles, 3x3 in suburban)
    const gridDiv = isMetroCore ? 5 : isUrbanTile ? 4 : isSuburbanTile ? 3 : 2;
    const blockSize = TILE / gridDiv;
    for (let g = 1; g < gridDiv; g++) {
      for (let s = 0; s < 2; s++) {
        addRoadStrip(posArr, linePosArr, x0 + s * (TILE / 2), z0 + g * blockSize, x0 + (s + 1) * (TILE / 2), z0 + g * blockSize, isUrbanTile ? 9.5 : 7.5);
        addRoadStrip(posArr, linePosArr, x0 + g * blockSize, z0 + s * (TILE / 2), x0 + g * blockSize, z0 + (s + 1) * (TILE / 2), isUrbanTile ? 9.5 : 7.5);
      }
    }

    // 3. Populate Every City Block with Complete Street-Aligned Architecture
    const osmCity = typeof window !== 'undefined' ? window.__SKYBOUND_WORLD_CITY : null;
    for (let br = 0; br < gridDiv; br++) {
      for (let bc = 0; bc < gridDiv; bc++) {
        const bx0 = x0 + bc * blockSize, bz0 = z0 + br * blockSize;
        const bcx = bx0 + blockSize * 0.5, bcz = bz0 + blockSize * 0.5;
        if (osmCity && typeof osmCity.blocked === 'function' && osmCity.blocked(bcx, bcz)) continue;
        const bGround = ground(bcx, bcz);
        if (bGround < 1.0 || bGround > 2350) continue;

        const blockCbdDist = Math.hypot(bcx - cbdX, bcz - cbdZ);
        const blockHubDist = Math.hypot(bcx - (hubAp?.x || 0), bcz - (hubAp?.z || 0));
        const blockSeed = hash2(col * 19 + bc * 7, row * 23 + br * 11);

        if (blockCbdDist < 2600 || (isMetroCore && blockSeed > 0.45)) {
          // Downtown CBD / Metropolitan Commercial & High-Rise Block
          const lotCount = 5;
          for (let k = 0; k < lotCount; k++) {
            const rA = hash2(col * 37 + bc * 13 + k, row * 41 + br * 17);
            const rB = hash2(col * 17 + k * 29, row * 31 + bc + br);
            const lx = bx0 + 26 + rA * (blockSize - 52);
            const lz = bz0 + 26 + rB * (blockSize - 52);
            if (inAirportClearance(lx, lz, 150)) continue;
            const lg = ground(lx, lz);
            if (lg < 1.0) continue;
            const w = 20 + hash2(k, bc + col) * 22;
            const d = 20 + hash2(br + row, k) * 22;
            const h = 24 + Math.pow(hash2(col + k, row - k + bc), 1.65) * (blockCbdDist < 1800 ? 115 : 64);
            const tone = pal.apt[(k + bc + br) % pal.apt.length];
            if (h > 48) {
              const podH = Math.min(15, h * 0.24);
              apts.push({ x: lx, y: lg + podH * 0.5 - 0.5, z: lz, w: w * 1.18, h: podH, d: d * 1.18, rot: 0, tone });
              glassTowers.push({ x: lx, y: lg + h * 0.5 - 0.5, z: lz, w: w * 0.86, h, d: d * 0.86, tone: pal.glass[k % pal.glass.length] });
              const crownH = h * 0.18;
              glassTowers.push({ x: lx, y: lg + h + crownH * 0.5 - 0.8, z: lz, w: w * 0.55, h: crownH, d: d * 0.55, tone: pal.glass[k % pal.glass.length] });
              if (h > 68) beacons.push({ x: lx, y: lg + h + crownH + 1.2, z: lz });
            } else {
              apts.push({ x: lx, y: lg + h * 0.5 - 0.5, z: lz, w, h, d, rot: (k & 1) ? 0 : Math.PI * 0.5, tone });
            }
          }
          // Street-front low-rise retail & townhouses along block edges
          for (let hIdx = 0; hIdx < 6; hIdx++) {
            const hx = bx0 + 24 + (hIdx / 6) * (blockSize - 48);
            const hz = bz0 + (hIdx % 2 === 0 ? 22 : blockSize - 22);
            if (inAirportClearance(hx, hz, 140)) continue;
            const hg = ground(hx, hz);
            if (hg < 1.0) continue;
            houses.push({
              x: hx, y: hg + 5.2 - 0.4, z: hz,
              w: 12 + (hIdx % 3) * 3, h: 10.4, d: 11 + ((hIdx + 1) % 3) * 2,
              rot: 0, tone: pal.house[(hIdx + bc) % pal.house.length]
            });
          }
        } else if (isUrbanTile && (blockHubDist < 2200 ? blockSeed < 0.38 : blockSeed < 0.18)) {
          // Logistics / Industrial / Airport Perimeter Commercial Park Block
          for (let wIdx = 0; wIdx < 4; wIdx++) {
            const wx = bx0 + 44 + (wIdx % 2) * (blockSize * 0.48);
            const wz = bz0 + 44 + Math.floor(wIdx / 2) * (blockSize * 0.46);
            if (inAirportClearance(wx, wz, 140)) continue;
            const wg = ground(wx, wz);
            if (wg < 1.0) continue;
            const ww = 36 + hash2(wIdx, col) * 26;
            const wd = 26 + hash2(row, wIdx) * 20;
            const wh = 9.5 + (wIdx % 2) * 3.5;
            warehouses.push({ x: wx, y: wg + wh * 0.5 - 0.5, z: wz, w: ww, h: wh, d: wd, tone: pal.ind[wIdx % pal.ind.length] });
          }
        } else {
          // Mixed Residential & Mid-Rise Neighborhood Block (dense rows of pitched-roof houses + mid-rise apartments)
          const rows = isUrbanTile ? 4 : isSuburbanTile ? 3 : 2;
          const colsPerRow = isUrbanTile ? 5 : isSuburbanTile ? 4 : 3;
          for (let rr = 0; rr < rows; rr++) {
            for (let cc = 0; cc < colsPerRow; cc++) {
              const jitterX = (hash2(bc * 17 + cc, br * 23 + rr) - 0.5) * 10;
              const jitterZ = (hash2(bc * 31 + rr, br * 13 + cc) - 0.5) * 10;
              const hx = bx0 + 22 + ((cc + 0.5) / colsPerRow) * (blockSize - 44) + jitterX;
              const hz = bz0 + 22 + ((rr + 0.5) / rows) * (blockSize - 44) + jitterZ;
              if (inAirportClearance(hx, hz, 130)) continue;
              const hg = ground(hx, hz);
              if (hg < 1.0) continue;
              const isMidRiseLot = isUrbanTile && ((rr + cc + bc) % 3 === 0);
              if (isMidRiseLot) {
                const ah = 13 + hash2(cc + col, rr + row) * 20;
                const aw = 18 + (cc % 3) * 6, ad = 16 + (rr % 3) * 5;
                apts.push({ x: hx, y: hg + ah * 0.5 - 0.5, z: hz, w: aw, h: ah, d: ad, rot: ((cc + rr) & 1) ? 0 : Math.PI * 0.5, tone: pal.apt[(cc + rr + bc) % pal.apt.length] });
              } else {
                const hh = 7.5 + hash2(cc, rr + row) * 4.5;
                const hw = 11.5 + ((cc + bc) % 4) * 2.5;
                const hd = 10.5 + ((rr + br) % 3) * 2.5;
                const rot = ((cc + rr) & 1) ? 0 : Math.PI * 0.5;
                houses.push({ x: hx, y: hg + hh * 0.5 - 0.4, z: hz, w: hw, h: hh, d: hd, rot, tone: pal.house[(cc + rr + bc + br) % pal.house.length] });
              }
            }
          }
        }

        // Block streetlamp & courtyard trees
        lamps.push({ x: bx0 + 14, y: bGround + 6.2, z: bz0 + 14 });
        const treePerBlock = biome === 'arid' ? 1 : (isUrbanTile ? 2 : 4);
        for (let t = 0; t < treePerBlock; t++) {
          const tx = bx0 + 18 + hash2(bc * 43 + t, br * 19 + col) * (blockSize - 36);
          const tz = bz0 + 18 + hash2(bc * 29 + row, br * 37 + t) * (blockSize - 36);
          if (inAirportClearance(tx, tz, 240)) continue;
          const tg = ground(tx, tz);
          if (tg >= 1.2 && tg < 2300) {
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
      if (Math.hypot(px - a.x, pz - a.z) > 28000) continue;
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

  function update(px, pz, quality, dayRatio) {
    if (quality === 'low') {
      root.visible = false;
      return;
    }
    root.visible = true;
    const nightAmt = Math.max(0, 1 - dayRatio);
    houseMat.emissiveIntensity = nightAmt * 0.72;
    bldgWallMat.emissiveIntensity = nightAmt * 0.85;
    indWallMat.emissiveIntensity = nightAmt * 0.55;
    landmarkGlassMat.emissiveIntensity = 0.10 + nightAmt * 0.90;
    monumentGoldMat.emissiveIntensity = 0.14 + nightAmt * 0.75;
    ensureHubSkyline(px, pz);

    const cx = Math.floor(px / TILE), cz = Math.floor(pz / TILE);
    const rad = quality === 'ultra' || quality === 'high' ? 4 : 3;
    const keep = new Set();
    const candidates = [];
    for (let r = cz - rad; r <= cz + rad; r++) {
      for (let c = cx - rad; c <= cx + rad; c++) {
        const key = c + ':' + r;
        keep.add(key);
        if (!loaded.has(key)) {
          candidates.push({ c, r, key, d: Math.hypot(c - cx, r - cz) });
        }
      }
    }
    candidates.sort((a, b) => a.d - b.d);
    const maxBuild = loaded.size < 9 ? 12 : 4;
    for (let i = 0; i < candidates.length && i < maxBuild; i++) {
      const { c, r, key } = candidates[i];
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

  return { root, update };
}
const GlobalScenery = { createGlobalScenery };
if (typeof window !== 'undefined') window.GlobalScenery = GlobalScenery;
if (typeof globalThis !== 'undefined') Object.assign(globalThis, { createGlobalScenery, GlobalScenery });
