'use strict';
// Streaming global country roads, arterial highways, city grids & hub skylines outside Taiwan (v0.80).
function createGlobalScenery(scene, ground, airports = []) {
  const root = new THREE.Group();
  root.name = 'Global country roads & cities';
  scene.add(root);

  const TILE = 1600;
  const loaded = new Map();
  const hubLandmarksAdded = new Set();

  const roadMat = new THREE.MeshStandardMaterial({ color: 0x3b4046, roughness: 0.88, side: THREE.DoubleSide });
  const stripeMat = new THREE.MeshBasicMaterial({ color: 0xe6dfb8, side: THREE.DoubleSide });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffd98a });
  const bldgWallMat = new THREE.MeshStandardMaterial({ color: 0xc8cdd2, roughness: 0.84, emissive: 0xffd28a, emissiveIntensity: 0 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x67727c, roughness: 0.8 });
  const landmarkGlassMat = new THREE.MeshStandardMaterial({ color: 0x5d8aa8, metalness: 0.45, roughness: 0.25, emissive: 0xffe4a8, emissiveIntensity: 0.1 });

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
    const sw = 0.28, sy0 = y0 + 0.08, sy1 = y1 + 0.08;
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

  function buildTile(col, row) {
    const cx = (col + 0.5) * TILE, cz = (row + 0.5) * TILE;
    const ll = typeof latLon === 'function' ? latLon(cx, cz) : null;
    if (!ll || insideTaiwanDetailed(ll.lat, ll.lon)) return null;
    const country = typeof WorldAtlas !== 'undefined' ? WorldAtlas.countryAt(ll.lon, ll.lat) : null;
    if (!country) return null;
    const centerGround = ground(cx, cz);
    if (centerGround < 0.8) return null;

    const group = new THREE.Group();
    const posArr = [], linePosArr = [], bldgs = [], lamps = [];
    const x0 = col * TILE, z0 = row * TILE;
    const hubDist = nearestHubDist(cx, cz);
    const isUrbanTile = hubDist < 18000 || hash2(col * 3, row * 5) > 0.72;

    // 1. Continuous cross-country arterial highways along tile grid (every tile connects cleanly to neighbors!)
    const segs = 4, step = TILE / segs;
    const hwyOffsetZ = z0 + TILE * 0.5 + (Math.sin(col * 0.45) * 240);
    const hwyOffsetZNext = z0 + TILE * 0.5 + (Math.sin((col + 1) * 0.45) * 240);
    const hwyOffsetX = x0 + TILE * 0.5 + (Math.cos(row * 0.45) * 240);
    const hwyOffsetXNext = x0 + TILE * 0.5 + (Math.cos((row + 1) * 0.45) * 240);

    for (let s = 0; s < segs; s++) {
      const t0 = s / segs, t1 = (s + 1) / segs;
      addRoadStrip(posArr, linePosArr,
        x0 + s * step, hwyOffsetZ + (hwyOffsetZNext - hwyOffsetZ) * t0,
        x0 + (s + 1) * step, hwyOffsetZ + (hwyOffsetZNext - hwyOffsetZ) * t1, 14);
      addRoadStrip(posArr, linePosArr,
        hwyOffsetX + (hwyOffsetXNext - hwyOffsetX) * t0, z0 + s * step,
        hwyOffsetX + (hwyOffsetXNext - hwyOffsetX) * t1, z0 + (s + 1) * step, 14);
    }

    // 2. Secondary country roads & urban grids
    if (isUrbanTile || hash2(col, row) > 0.35) {
      const gridDiv = isUrbanTile ? 4 : 2;
      const subStep = TILE / gridDiv;
      for (let g = 1; g < gridDiv; g++) {
        for (let s = 0; s < 2; s++) {
          addRoadStrip(posArr, linePosArr, x0 + s * (TILE / 2), z0 + g * subStep, x0 + (s + 1) * (TILE / 2), z0 + g * subStep, 8);
          addRoadStrip(posArr, linePosArr, x0 + g * subStep, z0 + s * (TILE / 2), x0 + g * subStep, z0 + (s + 1) * (TILE / 2), 8);
        }
      }
    }

    // 3. Roadside streetlights & regional towns/city blocks
    const bCount = isUrbanTile ? 26 : 9;
    for (let i = 0; i < bCount; i++) {
      const r1 = hash2(col * 31 + i, row * 17);
      const r2 = hash2(col * 13, row * 29 + i);
      const bx = x0 + 80 + r1 * (TILE - 160);
      const bz = z0 + 80 + r2 * (TILE - 160);
      if (inAirportClearance(bx, bz, 260)) continue;
      const bg = ground(bx, bz);
      if (bg < 1.0) continue;
      const bw = 16 + hash2(i, col) * 24;
      const bd = 16 + hash2(row, i) * 24;
      const bh = isUrbanTile ? (12 + Math.pow(hash2(col + i, row - i), 2) * (hubDist < 8500 ? 78 : 34)) : (6 + hash2(i, row) * 10);
      bldgs.push({ x: bx, y: bg + bh * 0.5 - 0.5, z: bz, w: bw, h: bh, d: bd });
      if (i % 3 === 0) lamps.push({ x: bx + bw * 0.65, y: bg + 6, z: bz });
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
      });
      inst.castShadow = true;
      inst.receiveShadow = true;
      group.add(inst);
    }
    if (lamps.length) {
      const lInst = new THREE.InstancedMesh(new THREE.BoxGeometry(1.2, 0.8, 1.2), lampMat, lamps.length);
      const dummy = new THREE.Object3D();
      lamps.forEach((l, idx) => {
        dummy.position.set(l.x, l.y, l.z);
        dummy.updateMatrix();
        lInst.setMatrixAt(idx, dummy.matrix);
      });
      group.add(lInst);
    }

    root.add(group);
    return group;
  }

  function ensureHubSkyline(px, pz) {
    for (let i = 0; i < airports.length; i++) {
      const a = airports[i];
      if (a.shortField || a.carrier || hubLandmarksAdded.has(a.code)) continue;
      if (Math.hypot(px - a.x, pz - a.z) > 26000) continue;
      hubLandmarksAdded.add(a.code);
      const { lat, lon } = latLon(a.x, a.z);
      if (insideTaiwanDetailed(lat, lon)) continue;
      const g = new THREE.Group();
      const side = Math.sign(a.apron || 1);
      const basePt = { x: a.x + Math.cos(a.heading) * (side * 3400), z: a.z + Math.sin(a.heading) * (side * 3400) };
      const gy = ground(basePt.x, basePt.z);
      if (gy < 0.8) continue;
      const spires = a.code === 'OMDB' ? [[0, 0, 22, 420, 22], [110, 80, 32, 160, 32]] :
        a.code === 'KJFK' ? [[0, 0, 36, 260, 36], [90, -70, 34, 210, 34], [-95, 65, 32, 185, 32]] :
        [[0, 0, 28, 145, 28], [75, 55, 26, 110, 26]];
      for (const [ox, oz, w, h, d] of spires) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), landmarkGlassMat);
        m.position.set(basePt.x + ox, gy + h * 0.5 - 1, basePt.z + oz);
        g.add(m);
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
    bldgWallMat.emissiveIntensity = Math.max(0, (1 - dayRatio) * 0.65);
    landmarkGlassMat.emissiveIntensity = 0.08 + Math.max(0, (1 - dayRatio) * 0.72);
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
if (typeof module !== 'undefined') Object.assign(globalThis, { createGlobalScenery });
