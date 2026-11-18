'use strict';
// High-definition streaming global country roads, arterial highways, biome vegetation, textured city grids & metropolitan skylines (v0.81).
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

  const wallDayTex = makeCanvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#d8dde2';
    g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 32) {
      g.fillStyle = 'rgba(25,35,45,0.16)';
      g.fillRect(0, y, w, 4);
      for (let x = 6; x < w; x += 24) {
        const shade = ((x * 7 + y * 13) % 17) < 8 ? '#4c5f70' : '#65798b';
        g.fillStyle = shade;
        g.fillRect(x, y + 7, 14, 18);
        g.fillStyle = 'rgba(255,255,255,0.28)';
        g.fillRect(x, y + 25, 14, 2);
      }
    }
  }, 1, 2);

  const wallNightTex = makeCanvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#05070a';
    g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 32) {
      for (let x = 6; x < w; x += 24) {
        const s = (x * 31 + y * 53) % 23;
        if (s < 11) {
          g.fillStyle = s < 5 ? '#ffe3a2' : s < 8 ? '#ffc978' : '#cce6ff';
          g.fillRect(x + 1, y + 8, 12, 16);
        }
      }
    }
  }, 1, 2);

  const glassDayTex = makeCanvasTex(256, 256, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#6289a8');
    grad.addColorStop(0.5, '#82acc8');
    grad.addColorStop(1, '#4c718e');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 20) {
      g.fillStyle = 'rgba(14,26,38,0.34)';
      g.fillRect(0, y, w, 3);
      for (let x = 0; x < w; x += 16) {
        g.fillStyle = 'rgba(220,240,255,0.22)';
        g.fillRect(x + 1, y + 4, 13, 14);
      }
    }
  }, 1, 3);

  const glassNightTex = makeCanvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#04080e';
    g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 20) {
      const bandLit = ((y * 19) % 7) < 4;
      for (let x = 0; x < w; x += 16) {
        const s = (x * 17 + y * 41) % 19;
        if (bandLit && s < 12) {
          g.fillStyle = s < 6 ? '#ffebb4' : s < 9 ? '#a8dcff' : '#ffd280';
          g.fillRect(x + 2, y + 4, 12, 13);
        }
      }
    }
  }, 1, 3);

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

  const roadMat = new THREE.MeshStandardMaterial({ color: 0x343940, roughness: 0.86, side: THREE.DoubleSide });
  const stripeMat = new THREE.MeshBasicMaterial({ color: 0xefe4b8, side: THREE.DoubleSide });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffdd94 });
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff2e24 });
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
  const landmarkGlassMat = new THREE.MeshStandardMaterial({
    color: 0xd8ecff,
    map: glassDayTex,
    metalness: 0.52,
    roughness: 0.20,
    emissive: 0xffe6ad,
    emissiveMap: glassNightTex,
    emissiveIntensity: 0.12
  });
  const treeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.88 });

  function insideTaiwanDetailed(lat, lon) {
    return lat >= 21.8 && lat <= 25.4 && lon >= 119.3 && lon <= 122.1;
  }

  function inAirportClearance(x, z, pad = 240) {
    for (let i = 0; i < airports.length; i++) {
      const a = airports[i];
      const reach = a.length / 2 + pad;
      if (Math.abs(x - a.x) > reach || Math.abs(z - a.z) > reach) continue;
      const dx = x - a.x, dz = z - a.z;
      const s = Math.sin(a.heading), c = Math.cos(a.heading);
      const along = dx * s - dz * c, cross = dx * c + dz * s;
      const sideReach = Math.max(a.width / 2, Math.abs(a.apron || 175) + 120) + pad;
      if (Math.abs(along) < reach && Math.abs(cross) < sideReach) return true;
    }
    return false;
  }

  function nearestHubDist(x, z) {
    let best = 1e9;
    for (let i = 0; i < airports.length; i++) {
      const a = airports[i];
      if (a.shortField || a.carrier) continue;
      const d = Math.hypot(x - a.x, z - a.z);
      if (d < best) best = d;
    }
    return best;
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

  function getBiomePalette(biome) {
    if (biome === 'arid') return [0xe6d7be, 0xd8c3a5, 0xcab292, 0xdfd1ba];
    if (biome === 'mediterranean') return [0xe8dccb, 0xdfc7b0, 0xcfd6dc, 0xe2d2be];
    if (biome === 'tropical') return [0xd4dee4, 0xc5d4dc, 0xe0dcd2, 0xbecbd4];
    if (biome === 'boreal') return [0xc8d2da, 0xb8c4ce, 0xd6d2c8, 0xaebbc6];
    return [0xd6dce2, 0xc8d0d8, 0xdedad2, 0xbcc6d0];
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
    if (!country) return null;
    const centerGround = ground(cx, cz);
    if (centerGround < 0.8) return null;

    const group = new THREE.Group();
    const posArr = [], linePosArr = [], bldgs = [], glassTowers = [], lamps = [], beacons = [], trees = [];
    const x0 = col * TILE, z0 = row * TILE;
    const hubDist = nearestHubDist(cx, cz);
    const isUrbanTile = hubDist < 18000 || hash2(col * 3, row * 5) > 0.70;
    const palette = getBiomePalette(country.biome);

    // 1. Continuous cross-country arterial highways along tile grid
    const segs = 4, step = TILE / segs;
    const hwyOffsetZ = z0 + TILE * 0.5 + (Math.sin(col * 0.45) * 240);
    const hwyOffsetZNext = z0 + TILE * 0.5 + (Math.sin((col + 1) * 0.45) * 240);
    const hwyOffsetX = x0 + TILE * 0.5 + (Math.cos(row * 0.45) * 240);
    const hwyOffsetXNext = x0 + TILE * 0.5 + (Math.cos((row + 1) * 0.45) * 240);

    for (let s = 0; s < segs; s++) {
      const t0 = s / segs, t1 = (s + 1) / segs;
      const hx0 = x0 + s * step, hz0 = hwyOffsetZ + (hwyOffsetZNext - hwyOffsetZ) * t0;
      const hx1 = x0 + (s + 1) * step, hz1 = hwyOffsetZ + (hwyOffsetZNext - hwyOffsetZ) * t1;
      addRoadStrip(posArr, linePosArr, hx0, hz0, hx1, hz1, 15);
      const vx0 = hwyOffsetX + (hwyOffsetXNext - hwyOffsetX) * t0, vz0 = z0 + s * step;
      const vx1 = hwyOffsetX + (hwyOffsetXNext - hwyOffsetX) * t1, vz1 = z0 + (s + 1) * step;
      addRoadStrip(posArr, linePosArr, vx0, vz0, vx1, vz1, 15);

      const hg = ground(hx0, hz0);
      if (hg >= 1.0 && !inAirportClearance(hx0, hz0, 250)) {
        lamps.push({ x: hx0, y: hg + 6.5, z: hz0 + 9.5 });
      }
    }

    // 2. Secondary country roads & urban street grids
    if (isUrbanTile || hash2(col, row) > 0.32) {
      const gridDiv = isUrbanTile ? 4 : 2;
      const subStep = TILE / gridDiv;
      for (let g = 1; g < gridDiv; g++) {
        for (let s = 0; s < 2; s++) {
          addRoadStrip(posArr, linePosArr, x0 + s * (TILE / 2), z0 + g * subStep, x0 + (s + 1) * (TILE / 2), z0 + g * subStep, 8.5);
          addRoadStrip(posArr, linePosArr, x0 + g * subStep, z0 + s * (TILE / 2), x0 + g * subStep, z0 + (s + 1) * (TILE / 2), 8.5);
        }
      }
    }

    // 3. Multi-tiered buildings, glass high-rises & rooftop beacons
    const bCount = isUrbanTile ? 32 : 12;
    for (let i = 0; i < bCount; i++) {
      const r1 = hash2(col * 31 + i, row * 17);
      const r2 = hash2(col * 13, row * 29 + i);
      const bx = x0 + 75 + r1 * (TILE - 150);
      const bz = z0 + 75 + r2 * (TILE - 150);
      if (inAirportClearance(bx, bz, 260)) continue;
      const bg = ground(bx, bz);
      if (bg < 1.0) continue;
      const bw = 16 + hash2(i, col) * 26;
      const bd = 16 + hash2(row, i) * 26;
      const tallFactor = Math.pow(hash2(col + i, row - i), 2);
      const bh = isUrbanTile ? (14 + tallFactor * (hubDist < 9500 ? 92 : 42)) : (6 + hash2(i, row) * 12);
      const tone = palette[i % palette.length];

      if (bh > 36) {
        // Podium + stepped glass skyscraper + crown + red aviation beacon
        const podH = Math.min(14, bh * 0.24);
        bldgs.push({ x: bx, y: bg + podH * 0.5 - 0.5, z: bz, w: bw * 1.18, h: podH, d: bd * 1.18, tone });
        glassTowers.push({ x: bx, y: bg + bh * 0.5 - 0.5, z: bz, w: bw * 0.86, h: bh, d: bd * 0.86 });
        const crownH = bh * 0.18;
        glassTowers.push({ x: bx, y: bg + bh + crownH * 0.5 - 0.8, z: bz, w: bw * 0.54, h: crownH, d: bd * 0.54 });
        beacons.push({ x: bx, y: bg + bh + crownH + 1.2, z: bz });
      } else {
        bldgs.push({ x: bx, y: bg + bh * 0.5 - 0.5, z: bz, w: bw, h: bh, d: bd, tone });
      }
      if (i % 3 === 0) lamps.push({ x: bx + bw * 0.65, y: bg + 6, z: bz });
    }

    // 4. Regional 3D biome tree canopies along roads & town parks
    const tCount = country.biome === 'arid' ? 6 : (isUrbanTile ? 18 : 24);
    for (let i = 0; i < tCount; i++) {
      const tx = x0 + 60 + hash2(col * 43 + i, row * 19) * (TILE - 120);
      const tz = z0 + 60 + hash2(col * 23, row * 41 + i) * (TILE - 120);
      if (inAirportClearance(tx, tz, 250)) continue;
      const tg = ground(tx, tz);
      if (tg < 1.2 || tg > 2400) continue;
      const tr = 4.5 + hash2(i * 7, col + row) * 5.5;
      trees.push({ x: tx, y: tg + tr * 0.72, z: tz, r: tr, color: getTreeTone(country.biome, hash2(i, col)) });
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
    if (bldgs.length) {
      const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), [bldgWallMat, bldgWallMat, roofMat, roofMat, bldgWallMat, bldgWallMat], bldgs.length);
      const dummy = new THREE.Object3D();
      bldgs.forEach((b, idx) => {
        dummy.position.set(b.x, b.y, b.z);
        dummy.scale.set(b.w, b.h, b.d);
        dummy.updateMatrix();
        inst.setMatrixAt(idx, dummy.matrix);
        if (typeof inst.setColorAt === 'function') inst.setColorAt(idx, new THREE.Color(b.tone));
      });
      inst.castShadow = true;
      inst.receiveShadow = true;
      group.add(inst);
    }
    if (glassTowers.length) {
      const gInst = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), [landmarkGlassMat, landmarkGlassMat, roofMat, roofMat, landmarkGlassMat, landmarkGlassMat], glassTowers.length);
      const dummy = new THREE.Object3D();
      glassTowers.forEach((b, idx) => {
        dummy.position.set(b.x, b.y, b.z);
        dummy.scale.set(b.w, b.h, b.d);
        dummy.updateMatrix();
        gInst.setMatrixAt(idx, dummy.matrix);
      });
      gInst.castShadow = true;
      gInst.receiveShadow = true;
      group.add(gInst);
    }
    if (trees.length) {
      const crownGeo = new THREE.DodecahedronGeometry ? new THREE.DodecahedronGeometry(1, 1) : new THREE.SphereGeometry(1, 7, 5);
      const tInst = new THREE.InstancedMesh(crownGeo, treeMat, trees.length);
      const dummy = new THREE.Object3D();
      trees.forEach((t, idx) => {
        dummy.position.set(t.x, t.y, t.z);
        dummy.scale.set(t.r, t.r * 0.85, t.r);
        dummy.updateMatrix();
        tInst.setMatrixAt(idx, dummy.matrix);
        if (typeof tInst.setColorAt === 'function') tInst.setColorAt(idx, new THREE.Color(t.color));
      });
      group.add(tInst);
    }
    if (lamps.length) {
      const lInst = new THREE.InstancedMesh(new THREE.BoxGeometry(1.4, 0.9, 1.4), lampMat, lamps.length);
      const dummy = new THREE.Object3D();
      lamps.forEach((l, idx) => {
        dummy.position.set(l.x, l.y, l.z);
        dummy.updateMatrix();
        lInst.setMatrixAt(idx, dummy.matrix);
      });
      group.add(lInst);
    }
    if (beacons.length) {
      const bInst = new THREE.InstancedMesh(new THREE.SphereGeometry(0.95, 8, 6), beaconMat, beacons.length);
      const dummy = new THREE.Object3D();
      beacons.forEach((b, idx) => {
        dummy.position.set(b.x, b.y, b.z);
        dummy.updateMatrix();
        bInst.setMatrixAt(idx, dummy.matrix);
      });
      group.add(bInst);
    }

    root.add(group);
    return group;
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

      const flagshipH = a.code === 'OMDB' ? 440 : ['KJFK', 'ZSPD', 'VHHH', 'RJTT', 'WSSS'].includes(a.code) ? 280 : 195;
      const towers = [];
      const bcnPts = [];
      for (let k = 0; k < 16; k++) {
        const angle = (k / 16) * Math.PI * 2 + (i * 0.37);
        const radius = k === 0 ? 0 : (75 + (k % 4) * 95 + Math.floor(k / 4) * 70);
        const ox = Math.cos(angle) * radius;
        const oz = Math.sin(angle) * radius;
        const tx = basePt.x + ox, tz = basePt.z + oz;
        if (inAirportClearance(tx, tz, 360)) continue;
        const tGround = ground(tx, tz);
        if (tGround < 0.8) continue;
        const h = k === 0 ? flagshipH : Math.max(58, flagshipH * (0.32 + hash2(k * 11, i * 7) * 0.48));
        const w = k === 0 ? 34 : (24 + (k % 3) * 6);
        const d = k === 0 ? 34 : (24 + ((k + 1) % 3) * 6);
        // Base shaft
        towers.push({ x: tx, y: tGround + h * 0.5 - 1, z: tz, w, h, d });
        // Setback upper tier
        const tierH = h * 0.24;
        towers.push({ x: tx, y: tGround + h + tierH * 0.5 - 1.5, z: tz, w: w * 0.64, h: tierH, d: d * 0.64 });
        // Spire on flagship and major towers
        if (k < 4) {
          const spireH = h * 0.16;
          towers.push({ x: tx, y: tGround + h + tierH + spireH * 0.5 - 2, z: tz, w: w * 0.16, h: spireH, d: d * 0.16 });
          bcnPts.push({ x: tx, y: tGround + h + tierH + spireH + 1.2, z: tz });
        } else {
          bcnPts.push({ x: tx, y: tGround + h + tierH + 1.2, z: tz });
        }
      }
      if (towers.length) {
        const tInst = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), [landmarkGlassMat, landmarkGlassMat, roofMat, roofMat, landmarkGlassMat, landmarkGlassMat], towers.length);
        const dummy = new THREE.Object3D();
        towers.forEach((t, idx) => {
          dummy.position.set(t.x, t.y, t.z);
          dummy.scale.set(t.w, t.h, t.d);
          dummy.updateMatrix();
          tInst.setMatrixAt(idx, dummy.matrix);
        });
        tInst.castShadow = true;
        tInst.receiveShadow = true;
        g.add(tInst);
      }
      if (bcnPts.length) {
        const bInst = new THREE.InstancedMesh(new THREE.SphereGeometry(1.2, 8, 6), beaconMat, bcnPts.length);
        const dummy = new THREE.Object3D();
        bcnPts.forEach((b, idx) => {
          dummy.position.set(b.x, b.y, b.z);
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
    bldgWallMat.emissiveIntensity = nightAmt * 0.85;
    landmarkGlassMat.emissiveIntensity = 0.10 + nightAmt * 0.88;
    ensureHubSkyline(px, pz);

    const cx = Math.floor(px / TILE), cz = Math.floor(pz / TILE);
    const rad = quality === 'ultra' || quality === 'high' ? 4 : 3;
    const keep = new Set();
    let builtThisFrame = 0;
    for (let r = cz - rad; r <= cz + rad; r++) {
      for (let c = cx - rad; c <= cx + rad; c++) {
        const key = c + ':' + r;
        keep.add(key);
        if (!loaded.has(key) && builtThisFrame < 2) {
          loaded.set(key, buildTile(c, r));
          builtThisFrame++;
        }
      }
    }
    for (const [key, grp] of loaded) {
      if (!keep.has(key)) {
        if (grp) {
          root.remove(grp);
          grp.traverse(o => { if (o.geometry) o.geometry.dispose(); });
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
