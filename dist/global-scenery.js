'use strict';
// Complete Worldwide 3D Architecture, 360+ WorldCitiesCatalog, Zero-Lag 3-Tier LOD (LOD0/LOD1/LOD2), Street-Block Cities, Regional Pitched-Roof Neighborhoods, Industrial Zones & Iconic Landmarks (v0.84).
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

  function nowMs() {
    return (typeof performance !== 'undefined' && typeof performance.now === 'function') ? performance.now() : Date.now();
  }

  function getWorldCitiesCatalog() {
    if (typeof WorldCitiesCatalog !== 'undefined' && WorldCitiesCatalog) return WorldCitiesCatalog;
    if (typeof window !== 'undefined' && window.WorldCitiesCatalog) return window.WorldCitiesCatalog;
    if (typeof globalThis !== 'undefined' && globalThis.WorldCitiesCatalog) return globalThis.WorldCitiesCatalog;
    return null;
  }

  function resolveCityRecord(raw, refX, refZ) {
    if (!raw || typeof raw !== 'object') return null;
    const c = (raw.city && typeof raw.city === 'object') ? raw.city : raw;
    let x = Number.isFinite(c.x) ? c.x : (Number.isFinite(raw.x) ? raw.x : NaN);
    let z = Number.isFinite(c.z) ? c.z : (Number.isFinite(raw.z) ? raw.z : NaN);
    let lat = Number.isFinite(c.lat) ? c.lat : (Number.isFinite(raw.lat) ? raw.lat : NaN);
    let lon = Number.isFinite(c.lon) ? c.lon : (Number.isFinite(raw.lon) ? raw.lon : NaN);
    if ((!Number.isFinite(x) || !Number.isFinite(z)) && typeof geoPoint === 'function' && Number.isFinite(lat) && Number.isFinite(lon)) {
      const pt = geoPoint(lat, lon);
      if (pt) { x = pt.x; z = pt.z; }
    }
    if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
    if ((!Number.isFinite(lat) || !Number.isFinite(lon)) && typeof latLon === 'function') {
      const ll = latLon(x, z);
      if (ll) { lat = ll.lat; lon = ll.lon; }
    }
    const dist = Number.isFinite(raw.dist) ? raw.dist
      : Number.isFinite(c.dist) ? c.dist
      : (Number.isFinite(refX) && Number.isFinite(refZ) ? Math.hypot(refX - x, refZ - z) : 0);
    const pop = Number.isFinite(c.pop) ? c.pop : (Number.isFinite(c.population) ? c.population : 0);
    const tier = Number.isFinite(c.tier) ? c.tier : (pop >= 4500000 ? 1 : pop >= 1200000 ? 2 : 3);
    const rawRad = Number.isFinite(c.radius) ? (c.radius < 250 ? c.radius * 1000 : c.radius) : NaN;
    const urbanRadius = Number.isFinite(rawRad)
      ? Math.max(11000, Math.min(28000, rawRad))
      : (tier === 1 ? 24000 : tier === 2 ? 19000 : 15000);
    const suburbanRadius = urbanRadius + 16000;
    const cbdRadius = tier === 1 ? 3200 : tier === 2 ? 2600 : 2100;
    const skylineH = Number.isFinite(c.skylineH) ? c.skylineH : (Number.isFinite(c.maxH) ? c.maxH : null);
    const id = String(c.id || c.code || c.name || (Math.round((lat || 0) * 100) + '_' + Math.round((lon || 0) * 100)));
    return {
      id,
      name: c.name || id,
      x,
      z,
      lat,
      lon,
      dist,
      pop,
      tier,
      region: c.region || c.reg || null,
      historic: Boolean(c.historic),
      skylineH,
      urbanRadius,
      suburbanRadius,
      cbdRadius,
      raw: c
    };
  }

  function disposeGroup(grp) {
    if (!grp) return;
    root.remove(grp);
    if (typeof grp.traverse === 'function') {
      grp.traverse(o => {
        if (o.geometry && !sharedGeos.has(o.geometry) && typeof o.geometry.dispose === 'function') {
          o.geometry.dispose();
        }
        if (o.isInstancedMesh && typeof o.dispose === 'function') {
          o.dispose();
        }
      });
    }
  }

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

  // =========================================================================
  // 5-Archetype Photorealistic PBR Wall Facades (256x256) + 2 Roof Materials
  // =========================================================================

  // Archetype 0 — Modern Glass Curtain-Wall Tower (day + night emissive)
  const archGlassDayTex = makeCanvasTex(256, 256, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#c6d6e4');
    grad.addColorStop(0.35, '#e8f2fa');
    grad.addColorStop(0.65, '#bed0e0');
    grad.addColorStop(1, '#dce9f4');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    // Diagonal sky-reflection sheen bands
    g.save();
    g.fillStyle = 'rgba(255,255,255,0.24)';
    g.beginPath(); g.moveTo(0, 48); g.lineTo(132, 0); g.lineTo(188, 0); g.lineTo(0, 108); g.closePath(); g.fill();
    g.fillStyle = 'rgba(235,248,255,0.18)';
    g.beginPath(); g.moveTo(64, 256); g.lineTo(256, 84); g.lineTo(256, 138); g.lineTo(126, 256); g.closePath(); g.fill();
    g.restore();
    // 8 stories x 8 curtain-wall bays with spandrel bands & vertical mullions
    const floorH = 32, bayW = 32;
    for (let fy = 0; fy < h; fy += floorH) {
      // Darker metallic spandrel band between floors
      g.fillStyle = 'rgba(24,36,48,0.44)';
      g.fillRect(0, fy, w, 7);
      g.fillStyle = 'rgba(255,255,255,0.34)';
      g.fillRect(0, fy + 7, w, 2);
      for (let bx = 0; bx < w; bx += bayW) {
        const s = (bx * 13 + fy * 29) % 19;
        // Subtle interior ceiling / Venetian blind depth variation per glass pane
        g.fillStyle = s < 5 ? 'rgba(20,38,54,0.24)' : s < 11 ? 'rgba(245,252,255,0.16)' : 'rgba(38,58,76,0.12)';
        g.fillRect(bx + 3, fy + 9, bayW - 5, floorH - 10);
        // Subtle upper blind band on some panes
        if (s % 4 === 0) {
          g.fillStyle = 'rgba(235,242,248,0.28)';
          g.fillRect(bx + 3, fy + 9, bayW - 5, 7);
        }
        // Vertical anodized aluminum mullion + 1px highlight
        g.fillStyle = 'rgba(34,44,54,0.62)';
        g.fillRect(bx, fy, 3, floorH);
        g.fillStyle = 'rgba(255,255,255,0.36)';
        g.fillRect(bx + 3, fy, 1, floorH);
      }
    }
  }, 1, 1);

  const archGlassNightTex = makeCanvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#04070d';
    g.fillRect(0, 0, w, h);
    const floorH = 32, bayW = 32;
    for (let fy = 0; fy < h; fy += floorH) {
      const floorHash = ((fy * 19 + 7) % 11);
      const floorActive = floorHash < 7;
      for (let bx = 0; bx < w; bx += bayW) {
        const s = (bx * 23 + fy * 41) % 29;
        const lit = floorActive ? (s < 19) : (s < 5);
        if (lit) {
          g.fillStyle = s < 7 ? '#ffebb2' : s < 13 ? '#b8e2ff' : '#ffd280';
          g.fillRect(bx + 4, fy + 10, bayW - 7, floorH - 12);
          g.fillStyle = 'rgba(255,255,255,0.35)';
          g.fillRect(bx + 4, fy + 10, bayW - 7, 4);
        }
      }
    }
  }, 1, 1);

  // Archetype 1 — Warm Brick / Masonry Urban Apartment (day + night emissive)
  const archBrickDayTex = makeCanvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#ddd6ce';
    g.fillRect(0, 0, w, h);
    // Running-bond brick / ashlar masonry courses (bright neutral so vertexColors tint vividly)
    for (let y = 0; y < h; y += 8) {
      const row = (y >> 3);
      const off = (row & 1) ? 10 : 0;
      for (let x = -10; x < w; x += 20) {
        const v = ((x * 11 + y * 17) & 15) - 7;
        const c = Math.max(198, Math.min(238, 220 + v));
        g.fillStyle = `rgb(${c},${c - 4},${c - 9})`;
        g.fillRect(x + off + 1, y + 1, 18, 6);
      }
      g.fillStyle = 'rgba(72,62,54,0.16)';
      g.fillRect(0, y, w, 1);
    }
    // 3 upper apartment stories + 1 ground-floor retail storefront
    const floors = [8, 68, 128];
    for (let fi = 0; fi < floors.length; fi++) {
      const fy = floors[fi];
      // Horizontal carved stone cornice ledge
      g.fillStyle = 'rgba(255,252,246,0.58)';
      g.fillRect(0, fy - 5, w, 4);
      g.fillStyle = 'rgba(42,36,30,0.28)';
      g.fillRect(0, fy - 1, w, 3);
      for (let bx = 12; bx < w - 12; bx += 48) {
        // Stone lintel above window
        g.fillStyle = 'rgba(246,242,235,0.72)';
        g.fillRect(bx - 2, fy + 6, 30, 4);
        // Recessed dark window frame & glass
        g.fillStyle = '#2d3742';
        g.fillRect(bx, fy + 10, 26, 34);
        const paneTint = ((bx + fi * 31) % 3 === 0) ? '#46586a' : '#3a4b5c';
        g.fillStyle = paneTint;
        g.fillRect(bx + 2, fy + 12, 22, 30);
        // Window muntin crossbars
        g.fillStyle = '#c8c4bc';
        g.fillRect(bx + 12, fy + 12, 2, 30);
        g.fillRect(bx + 2, fy + 25, 22, 2);
        // Protruding stone sill + under-shadow
        g.fillStyle = '#ede8df';
        g.fillRect(bx - 3, fy + 44, 32, 4);
        g.fillStyle = 'rgba(30,24,20,0.28)';
        g.fillRect(bx - 2, fy + 48, 30, 3);
        // Occasional warm striped fabric awning on mid windows
        if (((bx + fi * 17) % 5) === 0) {
          g.fillStyle = fi === 1 ? 'rgba(155,58,48,0.82)' : 'rgba(46,92,74,0.82)';
          g.fillRect(bx - 2, fy + 10, 30, 8);
        }
      }
    }
    // Ground-floor cornice + warm retail storefront band
    g.fillStyle = '#e8e2d8';
    g.fillRect(0, 188, w, 6);
    g.fillStyle = 'rgba(35,28,22,0.34)';
    g.fillRect(0, 194, w, 4);
    g.fillStyle = '#c6beb4';
    g.fillRect(0, 198, w, 58);
    for (let sx = 10; sx < w - 16; sx += 82) {
      g.fillStyle = '#333b44';
      g.fillRect(sx, 206, 66, 44);
      g.fillStyle = '#6c7c88';
      g.fillRect(sx + 3, 209, 60, 38);
      g.fillStyle = 'rgba(255,232,188,0.28)';
      g.fillRect(sx + 6, 212, 54, 24);
      // Shop awning strip
      g.fillStyle = (sx % 164 === 10) ? 'rgba(156,64,52,0.85)' : 'rgba(54,84,108,0.85)';
      g.fillRect(sx - 2, 202, 70, 9);
    }
  }, 1, 1);

  const archBrickNightTex = makeCanvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#040507';
    g.fillRect(0, 0, w, h);
    const floors = [8, 68, 128];
    for (let fi = 0; fi < floors.length; fi++) {
      const fy = floors[fi];
      for (let bx = 12; bx < w - 12; bx += 48) {
        const s = (bx * 29 + fy * 17) % 19;
        if (s < 10) {
          g.fillStyle = s < 4 ? '#ffdfa0' : s < 8 ? '#ffc26e' : '#ffeec4';
          g.fillRect(bx + 3, fy + 13, 20, 28);
        }
      }
    }
    // Warm lit ground-floor storefronts
    for (let sx = 10; sx < w - 16; sx += 82) {
      g.fillStyle = '#ffe09c';
      g.fillRect(sx + 4, 212, 58, 34);
    }
  }, 1, 1);

  // Archetype 2 — Contemporary Stucco / Balcony Condo (day + night emissive)
  const archCondoDayTex = makeCanvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#eae8e3';
    g.fillRect(0, 0, w, h);
    // Subtle architectural stucco panel seams
    g.fillStyle = 'rgba(60,68,76,0.10)';
    for (let x = 0; x < w; x += 64) g.fillRect(x, 0, 2, h);
    // 4 crisp stories with cantilevered balcony slabs, glass/steel railings & sliding doors
    const floorH = 64;
    for (let fy = 0; fy < h; fy += floorH) {
      // Deep shadow cast beneath cantilevered balcony slab above
      g.fillStyle = 'rgba(22,30,38,0.34)';
      g.fillRect(0, fy + 8, w, 9);
      for (let bx = 8; bx < w - 8; bx += 64) {
        // Large recessed dark sliding glass window/door behind balcony
        g.fillStyle = '#2c3c4c';
        g.fillRect(bx + 4, fy + 12, 42, 42);
        g.fillStyle = '#536c82';
        g.fillRect(bx + 6, fy + 14, 18, 38);
        g.fillStyle = '#445c70';
        g.fillRect(bx + 26, fy + 14, 18, 38);
        // Subtle diagonal window sheen
        g.fillStyle = 'rgba(220,242,255,0.22)';
        g.fillRect(bx + 8, fy + 16, 10, 14);
        // Semi-transparent glass balcony railing + steel handrail
        g.fillStyle = 'rgba(185,212,228,0.42)';
        g.fillRect(bx, fy + 38, 50, 18);
        g.fillStyle = '#485664';
        g.fillRect(bx, fy + 36, 50, 2);
        g.fillRect(bx, fy + 38, 2, 18);
        g.fillRect(bx + 24, fy + 38, 2, 18);
        g.fillRect(bx + 48, fy + 38, 2, 18);
      }
      // Crisp white cantilevered concrete balcony slab
      g.fillStyle = '#f4f3ef';
      g.fillRect(0, fy + 56, w, 8);
      g.fillStyle = 'rgba(255,255,255,0.55)';
      g.fillRect(0, fy + 56, w, 2);
    }
  }, 1, 1);

  const archCondoNightTex = makeCanvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#040609';
    g.fillRect(0, 0, w, h);
    const floorH = 64;
    for (let fy = 0; fy < h; fy += floorH) {
      for (let bx = 8; bx < w - 8; bx += 64) {
        const s = (bx * 19 + fy * 37) % 23;
        if (s < 11) {
          g.fillStyle = s < 5 ? '#ffe3a4' : s < 9 ? '#ffcb78' : '#d2eaff';
          g.fillRect(bx + 6, fy + 15, 38, 24);
          // Soft diffused glow through glass railing
          g.fillStyle = 'rgba(255,216,144,0.45)';
          g.fillRect(bx + 6, fy + 40, 38, 13);
        }
      }
    }
  }, 1, 1);

  // Archetype 3 — Residential Clapboard / Villa / Townhouse (day + night emissive)
  const archHouseDayTex = makeCanvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#edeae4';
    g.fillRect(0, 0, w, h);
    // Horizontal clapboard siding / subtle plaster texture courses
    for (let y = 0; y < h; y += 10) {
      g.fillStyle = (y % 20 === 0) ? 'rgba(255,255,255,0.22)' : 'rgba(60,55,48,0.06)';
      g.fillRect(0, y, w, 8);
      g.fillStyle = 'rgba(42,38,34,0.14)';
      g.fillRect(0, y + 8, w, 2);
    }
    // Trim band separating 1st and 2nd story
    g.fillStyle = 'rgba(255,255,255,0.68)';
    g.fillRect(0, 122, w, 6);
    g.fillStyle = 'rgba(35,32,28,0.20)';
    g.fillRect(0, 128, w, 3);
    // Upper-story paired windows with crisp trim & shutters
    const drawResWindow = (wx, wy, ww, wh, shutters = true) => {
      if (shutters) {
        g.fillStyle = '#475563';
        g.fillRect(wx - 11, wy, 9, wh);
        g.fillRect(wx + ww + 2, wy, 9, wh);
      }
      g.fillStyle = '#f5f4f0';
      g.fillRect(wx - 3, wy - 3, ww + 6, wh + 6);
      g.fillStyle = '#334250';
      g.fillRect(wx, wy, ww, wh);
      g.fillStyle = '#4a5f72';
      g.fillRect(wx + 2, wy + 2, ww - 4, wh - 4);
      g.fillStyle = '#f2f0eb';
      g.fillRect(wx + Math.floor(ww * 0.5) - 1, wy, 2, wh);
      g.fillRect(wx, wy + Math.floor(wh * 0.5) - 1, ww, 2);
    };
    drawResWindow(28, 34, 36, 52, true);
    drawResWindow(110, 34, 36, 52, true);
    drawResWindow(192, 34, 36, 52, true);
    // Lower-story windows + warm wooden front door in center
    drawResWindow(28, 152, 38, 54, true);
    drawResWindow(190, 152, 38, 54, true);
    // Front door with white frame & transom window
    g.fillStyle = '#f5f3ee';
    g.fillRect(108, 152, 40, 100);
    g.fillStyle = '#6b4532';
    g.fillRect(113, 170, 30, 82);
    g.fillStyle = '#4b5f72';
    g.fillRect(113, 156, 30, 10);
    g.fillStyle = '#855840';
    g.fillRect(117, 176, 10, 28);
    g.fillRect(130, 176, 10, 28);
    g.fillRect(117, 210, 10, 32);
    g.fillRect(130, 210, 10, 32);
    // Stone foundation plinth
    g.fillStyle = 'rgba(92,88,82,0.34)';
    g.fillRect(0, 240, w, 16);
  }, 1, 1);

  const archHouseNightTex = makeCanvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#040507';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffd988';
    g.fillRect(30, 36, 32, 48);
    g.fillStyle = '#ffc76e';
    g.fillRect(194, 36, 32, 48);
    g.fillStyle = '#ffe5a4';
    g.fillRect(30, 154, 34, 50);
    g.fillStyle = '#ffd582';
    g.fillRect(192, 154, 34, 50);
    // Warm porch transom light
    g.fillStyle = '#ffdf9a';
    g.fillRect(114, 157, 28, 9);
  }, 1, 1);

  // Archetype 4 — Industrial / Logistics Warehouse (day + night emissive)
  const archIndDayTex = makeCanvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#d8dee4';
    g.fillRect(0, 0, w, h);
    // Corrugated steel vertical wall ribs
    for (let x = 0; x < w; x += 6) {
      g.fillStyle = 'rgba(255,255,255,0.28)';
      g.fillRect(x, 0, 2, h);
      g.fillStyle = 'rgba(40,50,60,0.18)';
      g.fillRect(x + 3, 0, 2, h);
    }
    // Roofline flashing band + upper clerestory strip windows
    g.fillStyle = '#5a6570';
    g.fillRect(0, 0, w, 12);
    g.fillStyle = '#3c4e5e';
    g.fillRect(0, 24, w, 28);
    for (let x = 4; x < w; x += 32) {
      g.fillStyle = '#688296';
      g.fillRect(x, 27, 26, 22);
      g.fillStyle = 'rgba(220,240,255,0.24)';
      g.fillRect(x + 2, 29, 22, 7);
    }
    // Horizontal structural steel girt beam
    g.fillStyle = 'rgba(54,64,74,0.45)';
    g.fillRect(0, 134, w, 7);
    // Structural columns every 64px
    for (let x = 0; x < w; x += 64) {
      g.fillStyle = '#8b959e';
      g.fillRect(x, 12, 8, h - 12);
      g.fillStyle = 'rgba(30,38,46,0.25)';
      g.fillRect(x + 8, 12, 3, h - 12);
    }
    // Lower concrete plinth + ribbed roll-up loading dock doors
    g.fillStyle = '#bcc2c8';
    g.fillRect(0, 214, w, 42);
    for (let dx = 16; dx < w - 32; dx += 64) {
      g.fillStyle = '#424a52';
      g.fillRect(dx, 162, 42, 92);
      g.fillStyle = '#aeb6be';
      g.fillRect(dx + 3, 166, 36, 86);
      for (let ry = 172; ry < 250; ry += 9) {
        g.fillStyle = 'rgba(42,48,54,0.30)';
        g.fillRect(dx + 3, ry, 36, 2);
      }
      // Yellow/dark safety dock bumpers
      g.fillStyle = '#d8a630';
      g.fillRect(dx - 3, 212, 3, 38);
      g.fillRect(dx + 42, 212, 3, 38);
    }
  }, 1, 1);

  const archIndNightTex = makeCanvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#040608';
    g.fillRect(0, 0, w, h);
    // Lit clerestory strip windows
    for (let x = 4; x < w; x += 32) {
      g.fillStyle = (x % 64 === 4) ? '#d6ecff' : '#ffe29c';
      g.fillRect(x + 1, 28, 24, 20);
    }
    // Subtle loading dock apron security lights
    for (let dx = 16; dx < w - 32; dx += 64) {
      g.fillStyle = '#ffd98a';
      g.fillRect(dx + 16, 155, 10, 4);
    }
  }, 1, 1);

  // Roof Material 1 — Flat Gravel / Concrete Membrane + Parapet Rim + AC / Skylights
  const archFlatRoofTex = makeCanvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#c8cdd2';
    g.fillRect(0, 0, w, h);
    // Subtle gravel / waterproof membrane texture + seam grid
    for (let y = 0; y < h; y += 8) {
      for (let x = 0; x < w; x += 8) {
        const v = ((x * 19 + y * 37) % 19) - 9;
        const c = 196 + v;
        g.fillStyle = `rgb(${c},${c + 1},${c + 2})`;
        g.fillRect(x, y, 8, 8);
      }
    }
    g.strokeStyle = 'rgba(70,76,82,0.22)';
    g.lineWidth = 2;
    for (let i = 64; i < w; i += 64) {
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.stroke();
      g.beginPath(); g.moveTo(0, i); g.lineTo(w, i); g.stroke();
    }
    // Parapet rim border
    g.strokeStyle = 'rgba(78,84,92,0.52)';
    g.lineWidth = 10;
    g.strokeRect(5, 5, w - 10, h - 10);
    g.strokeStyle = 'rgba(240,244,248,0.45)';
    g.lineWidth = 2;
    g.strokeRect(11, 11, w - 22, h - 22);
    // Rooftop HVAC units, cooling fan grilles & skylight
    const drawHvac = (hx, hy, hw, hh) => {
      g.fillStyle = 'rgba(30,36,42,0.34)';
      g.fillRect(hx + 4, hy + 4, hw, hh);
      g.fillStyle = '#b4bcc4';
      g.fillRect(hx, hy, hw, hh);
      g.strokeStyle = '#68727c';
      g.lineWidth = 2;
      g.strokeRect(hx, hy, hw, hh);
      g.fillStyle = '#48525c';
      g.fillRect(hx + 6, hy + 6, Math.floor(hw * 0.42), hh - 12);
    };
    drawHvac(32, 34, 52, 36);
    drawHvac(154, 148, 56, 44);
    // Glass skylight panel
    g.fillStyle = '#5a7286';
    g.fillRect(142, 42, 62, 34);
    g.strokeStyle = '#d4dce2';
    g.lineWidth = 3;
    g.strokeRect(142, 42, 62, 34);
  }, 1, 1);

  // Roof Material 2 — Overlapping Clay / Shingle / Slate Roof Tile Courses
  const archPitchedRoofTex = makeCanvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#d4d0ca';
    g.fillRect(0, 0, w, h);
    const courseH = 16;
    const tileW = 16;
    for (let y = 0; y < h; y += courseH) {
      const row = Math.floor(y / courseH);
      const off = (row & 1) ? 8 : 0;
      for (let x = -tileW; x < w; x += tileW) {
        const s = ((x * 13 + y * 29) % 23) - 11;
        const base = Math.max(194, Math.min(238, 218 + s));
        g.fillStyle = `rgb(${base},${base - 2},${base - 4})`;
        g.fillRect(x + off, y, tileW - 1, courseH - 2);
        // Subtle vertical tile ridge highlight & flute shadow
        g.fillStyle = 'rgba(255,255,255,0.22)';
        g.fillRect(x + off + 2, y + 1, 3, courseH - 4);
        g.fillStyle = 'rgba(28,24,22,0.24)';
        g.fillRect(x + off + tileW - 2, y, 2, courseH);
      }
      // Overlapping row lip drop-shadow
      g.fillStyle = 'rgba(22,18,16,0.34)';
      g.fillRect(0, y + courseH - 3, w, 3);
      g.fillStyle = 'rgba(255,255,255,0.18)';
      g.fillRect(0, y, w, 1);
    }
  }, 1, 1);

  // Aliases kept for bespoke landmarks compatibility
  const wallDayTex = archBrickDayTex;
  const wallNightTex = archBrickNightTex;
  const glassDayTex = archGlassDayTex;
  const glassNightTex = archGlassNightTex;
  const houseDayTex = archHouseDayTex;
  const roofDetailTex = archFlatRoofTex;

  // 5-Archetype PBR Wall Materials (all vertexColors: true for per-building / OSM / instanced tinting)
  const archGlassMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: archGlassDayTex,
    emissive: 0xffe6ad,
    emissiveMap: archGlassNightTex,
    emissiveIntensity: 0.10,
    roughness: 0.22,
    metalness: 0.62,
    vertexColors: true
  });
  const archBrickMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: archBrickDayTex,
    emissive: 0xffd28c,
    emissiveMap: archBrickNightTex,
    emissiveIntensity: 0,
    roughness: 0.86,
    metalness: 0.03,
    vertexColors: true
  });
  const archCondoMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: archCondoDayTex,
    emissive: 0xffd896,
    emissiveMap: archCondoNightTex,
    emissiveIntensity: 0,
    roughness: 0.66,
    metalness: 0.12,
    vertexColors: true
  });
  const archHouseMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: archHouseDayTex,
    emissive: 0xffd28c,
    emissiveMap: archHouseNightTex,
    emissiveIntensity: 0,
    roughness: 0.82,
    metalness: 0.02,
    vertexColors: true
  });
  const archIndMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: archIndDayTex,
    emissive: 0xdceeff,
    emissiveMap: archIndNightTex,
    emissiveIntensity: 0,
    roughness: 0.50,
    metalness: 0.42,
    vertexColors: true
  });
  const ARCH_WALL_MATS = [archGlassMat, archBrickMat, archCondoMat, archHouseMat, archIndMat];

  // 2 Distinct Roof PBR Materials
  const archFlatRoofMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: archFlatRoofTex,
    roughness: 0.84,
    metalness: 0.08,
    vertexColors: true
  });
  const archPitchedRoofMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: archPitchedRoofTex,
    roughness: 0.78,
    metalness: 0.06,
    vertexColors: true
  });

  // Helper: unit BoxGeometry with baked vertex colors (vertical subtle AO) so vertexColors:true materials render cleanly on InstancedMesh
  function makeColoredUnitBox(vRepeat = 1, bottomAo = 0.88, roofShade = 0.86) {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const pos = geo.attributes.position;
    const nrm = geo.attributes.normal;
    const uv = geo.attributes.uv;
    const cols = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const ny = nrm ? nrm.getY(i) : 0;
      const y = pos.getY(i);
      const shade = ny > 0.5 ? roofShade : (y < 0 ? bottomAo : 1.0);
      cols[i * 3] = shade;
      cols[i * 3 + 1] = shade;
      cols[i * 3 + 2] = shade;
      if (uv && vRepeat !== 1 && Math.abs(ny) < 0.5) {
        uv.setY(i, uv.getY(i) * vRepeat);
      }
    }
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    return geo;
  }

  // Helper: push a triangle guaranteed to face expected outward normal direction
  function pushOrientedTri(pos, nrm, uvs, col, ax, ay, az, bx, by, bz, cx, cy, cz, u0, v0, u1, v1, u2, v2, ex, ey, ez, r, g, b) {
    const e1x = bx - ax, e1y = by - ay, e1z = bz - az;
    const e2x = cx - ax, e2y = cy - ay, e2z = cz - az;
    let nx = e1y * e2z - e1z * e2y;
    let ny = e1z * e2x - e1x * e2z;
    let nz = e1x * e2y - e1y * e2x;
    const dot = nx * ex + ny * ey + nz * ez;
    if (dot < 0) {
      pos.push(ax, ay, az, cx, cy, cz, bx, by, bz);
      uvs.push(u0, v0, u2, v2, u1, v1);
      nx = -nx; ny = -ny; nz = -nz;
    } else {
      pos.push(ax, ay, az, bx, by, bz, cx, cy, cz);
      uvs.push(u0, v0, u1, v1, u2, v2);
    }
    const nLen = Math.hypot(nx, ny, nz) || 1;
    nx /= nLen; ny /= nLen; nz /= nLen;
    for (let i = 0; i < 3; i++) { nrm.push(nx, ny, nz); col.push(r, g, b); }
  }

  // Unit Gable House Walls (4 walls + 2 triangular gable peaks, walls y:-0.5..0.18, peak y:0.52)
  function createUnitGableWallGeometry() {
    const geo = new THREE.BufferGeometry();
    const hw = 0.5, hd = 0.5, y0 = -0.5, yEave = 0.18, yPeak = 0.52;
    const pos = [], nrm = [], uvs = [], col = [];
    const quad = (ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz, ex, ey, ez, sh) => {
      pushOrientedTri(pos, nrm, uvs, col, ax, ay, az, bx, by, bz, cx, cy, cz, 0, 0, 1, 0, 1, 1, ex, ey, ez, sh, sh, sh);
      pushOrientedTri(pos, nrm, uvs, col, ax, ay, az, cx, cy, cz, dx, dy, dz, 0, 0, 1, 1, 0, 1, ex, ey, ez, sh, sh, sh);
    };
    quad(-hw, y0, hd, hw, y0, hd, hw, yEave, hd, -hw, yEave, hd, 0, 0, 1, 1.0);
    quad(hw, y0, -hd, -hw, y0, -hd, -hw, yEave, -hd, hw, yEave, -hd, 0, 0, -1, 0.94);
    quad(hw, y0, hd, hw, y0, -hd, hw, yEave, -hd, hw, yEave, hd, 1, 0, 0, 0.96);
    quad(-hw, y0, -hd, -hw, y0, hd, -hw, yEave, hd, -hw, yEave, -hd, -1, 0, 0, 0.92);
    // Front & back gable triangles
    pushOrientedTri(pos, nrm, uvs, col, -hw, yEave, hd, hw, yEave, hd, 0, yPeak, hd, 0, 0.7, 1, 0.7, 0.5, 1, 0, 0, 1, 0.96, 0.96, 0.96);
    pushOrientedTri(pos, nrm, uvs, col, hw, yEave, -hd, -hw, yEave, -hd, 0, yPeak, -hd, 0, 0.7, 1, 0.7, 0.5, 1, 0, 0, -1, 0.91, 0.91, 0.91);
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    return geo;
  }

  // Unit Gable Roof Cap (overhanging 2-slope tiled roof matched to unitGableWallGeo, independent roof color!)
  function createUnitGableRoofCapGeometry() {
    const geo = new THREE.BufferGeometry();
    const ow = 0.56, od = 0.55, yEave = 0.16, yPeak = 0.53;
    const pos = [], nrm = [], uvs = [], col = [];
    const quad = (ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz, ex, ey, ez, sh) => {
      pushOrientedTri(pos, nrm, uvs, col, ax, ay, az, bx, by, bz, cx, cy, cz, 0, 0, 1.4, 0, 1.4, 1.2, ex, ey, ez, sh, sh, sh);
      pushOrientedTri(pos, nrm, uvs, col, ax, ay, az, cx, cy, cz, dx, dy, dz, 0, 0, 1.4, 1.2, 0, 1.2, ex, ey, ez, sh, sh, sh);
    };
    quad(ow, yEave, od, ow, yEave, -od, 0, yPeak, -od, 0, yPeak, od, 0.6, 0.8, 0, 1.0);
    quad(-ow, yEave, -od, -ow, yEave, od, 0, yPeak, od, 0, yPeak, -od, -0.6, 0.8, 0, 0.94);
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    return geo;
  }

  // Unit Hip Roof Cap (4-sided overhanging hipped/mansard roof from y=0.5 to y=0.86, sits atop unitBoxGeo)
  function createUnitHipRoofCapGeometry(yBase = 0.49, yPeak = 0.84, ridgeFrac = 0.24) {
    const geo = new THREE.BufferGeometry();
    const ow = 0.55, od = 0.55;
    const pos = [], nrm = [], uvs = [], col = [];
    // +X slope
    pushOrientedTri(pos, nrm, uvs, col, ow, yBase, od, ow, yBase, -od, 0, yPeak, -ridgeFrac, 0, 0, 1.4, 0, 1.0, 1.1, 0.6, 0.8, 0, 1.0, 1.0, 1.0);
    pushOrientedTri(pos, nrm, uvs, col, ow, yBase, od, 0, yPeak, -ridgeFrac, 0, yPeak, ridgeFrac, 0, 0, 1.0, 1.1, 0.4, 1.1, 0.6, 0.8, 0, 1.0, 1.0, 1.0);
    // -X slope
    pushOrientedTri(pos, nrm, uvs, col, -ow, yBase, -od, -ow, yBase, od, 0, yPeak, ridgeFrac, 0, 0, 1.4, 0, 1.0, 1.1, -0.6, 0.8, 0, 0.94, 0.94, 0.94);
    pushOrientedTri(pos, nrm, uvs, col, -ow, yBase, -od, 0, yPeak, ridgeFrac, 0, yPeak, -ridgeFrac, 0, 0, 1.0, 1.1, 0.4, 1.1, -0.6, 0.8, 0, 0.94, 0.94, 0.94);
    // +Z hip end
    pushOrientedTri(pos, nrm, uvs, col, -ow, yBase, od, ow, yBase, od, 0, yPeak, ridgeFrac, 0, 0, 1.2, 0, 0.6, 1.0, 0, 0.75, 0.66, 0.97, 0.97, 0.97);
    // -Z hip end
    pushOrientedTri(pos, nrm, uvs, col, ow, yBase, -od, -ow, yBase, -od, 0, yPeak, -ridgeFrac, 0, 0, 1.2, 0, 0.6, 1.0, 0, 0.75, -0.66, 0.91, 0.91, 0.91);
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    return geo;
  }

  // Lightweight 2-material-group unit building box for fast LOD1 mid-range tiles (group 0 = 4 walls, group 1 = flat roof, no bottom face -> 2 draw calls)
  function createUnitTwoGroupBoxGeo(vRepeat = 1.4, bottomAo = 0.88, roofShade = 0.90) {
    const geo = new THREE.BufferGeometry();
    const pos = [], nrm = [], uvs = [], col = [];
    const wallQuad = (ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz, ex, ey, ez, sh) => {
      const bSh = sh * bottomAo;
      pushOrientedTri(pos, nrm, uvs, col, ax, ay, az, bx, by, bz, cx, cy, cz, 0, 0, 1, 0, 1, vRepeat, ex, ey, ez, sh, sh, sh);
      pushOrientedTri(pos, nrm, uvs, col, ax, ay, az, cx, cy, cz, dx, dy, dz, 0, 0, 1, vRepeat, 0, vRepeat, ex, ey, ez, sh, sh, sh);
      // Apply subtle bottom AO on bottom vertices of the 2 triangles
      const base = col.length - 18;
      col[base] = col[base + 1] = col[base + 2] = bSh;
      col[base + 3] = col[base + 4] = col[base + 5] = bSh;
      col[base + 9] = col[base + 10] = col[base + 11] = bSh;
    };
    const h = 0.5;
    wallQuad(-h, -h, h, h, -h, h, h, h, h, -h, h, h, 0, 0, 1, 1.0);
    wallQuad(h, -h, -h, -h, -h, -h, -h, h, -h, h, h, -h, 0, 0, -1, 0.94);
    wallQuad(h, -h, h, h, -h, -h, h, h, -h, h, h, h, 1, 0, 0, 0.96);
    wallQuad(-h, -h, -h, -h, -h, h, -h, h, h, -h, h, -h, -1, 0, 0, 0.92);
    // Top roof face (group 1)
    pushOrientedTri(pos, nrm, uvs, col, -h, h, h, h, h, h, h, h, -h, 0, 0, 1, 0, 1, 1, 0, 1, 0, roofShade, roofShade, roofShade);
    pushOrientedTri(pos, nrm, uvs, col, -h, h, h, h, h, -h, -h, h, -h, 0, 0, 1, 1, 0, 1, 0, 1, 0, roofShade, roofShade, roofShade);
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    if (typeof geo.addGroup === 'function') {
      geo.addGroup(0, 24, 0);
      geo.addGroup(24, 6, 1);
    }
    return geo;
  }

  const unitBoxGeo = makeColoredUnitBox(1, 0.88, 0.86);
  const unitMidBoxGeo = makeColoredUnitBox(1.5, 0.88, 0.86);
  const unitTallBoxGeo = makeColoredUnitBox(2.8, 0.86, 0.84);
  const unitLod1BoxGeo = createUnitTwoGroupBoxGeo(1.4, 0.88, 0.90);
  const unitLod1TallGeo = createUnitTwoGroupBoxGeo(2.6, 0.86, 0.88);
  const unitGableWallGeo = createUnitGableWallGeometry();
  const unitGableRoofCapGeo = createUnitGableRoofCapGeometry();
  const unitHipRoofCapGeo = createUnitHipRoofCapGeometry(0.49, 0.86, 0.24);
  const unitMansardRoofGeo = createUnitHipRoofCapGeometry(0.49, 0.68, 0.34);
  const houseGeo = unitGableWallGeo;
  const lampGeo = new THREE.BoxGeometry(1.4, 0.9, 1.4);
  const beaconGeo = new THREE.SphereGeometry(0.95, 8, 6);

  const roadMat = new THREE.MeshStandardMaterial({ color: 0x32373e, roughness: 0.86, side: THREE.DoubleSide });
  const stripeMat = new THREE.MeshBasicMaterial({ color: 0xefe4b8, side: THREE.DoubleSide });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffdd94 });
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff2e24 });

  // Landmark / non-vertex-colored compatibility materials (used by 52 GPS landmarks & bespoke monuments)
  const houseMat = archHouseMat;
  const bldgWallMat = new THREE.MeshStandardMaterial({
    color: 0xe8dfd2,
    map: archBrickDayTex,
    emissive: 0xffd694,
    emissiveMap: archBrickNightTex,
    emissiveIntensity: 0,
    roughness: 0.84,
    metalness: 0.04
  });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0xd0d6dc, map: archFlatRoofTex, roughness: 0.84 });
  const indWallMat = new THREE.MeshStandardMaterial({
    color: 0xc2cbd2,
    map: archIndDayTex,
    emissive: 0xdceeff,
    emissiveMap: archIndNightTex,
    emissiveIntensity: 0,
    roughness: 0.50,
    metalness: 0.42
  });
  const indRoofMat = new THREE.MeshStandardMaterial({ color: 0x7e8994, map: archFlatRoofTex, roughness: 0.68, metalness: 0.24 });
  const landmarkGlassMat = new THREE.MeshStandardMaterial({
    color: 0x9ac2df,
    map: archGlassDayTex,
    metalness: 0.62,
    roughness: 0.22,
    emissive: 0xffe6ad,
    emissiveMap: archGlassNightTex,
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

  // OSM aliases pointing directly to the new 5-archetype PBR system
  const osmWallMat = archBrickMat;
  const osmGlassMat = archGlassMat;
  const osmRoofMat = archFlatRoofMat;

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
  const sharedGeos = new Set([
    houseGeo, unitBoxGeo, unitMidBoxGeo, unitTallBoxGeo, unitLod1BoxGeo, unitLod1TallGeo,
    unitGableWallGeo, unitGableRoofCapGeo, unitHipRoofCapGeo, unitMansardRoofGeo,
    lampGeo, beaconGeo, osmTrafficGeo, osmTreeGeo
  ]);

  // LOD2 Far Horizon Impostors (10-145 km) for all 360+ WorldCitiesCatalog cities (3 draw calls)
  const _wccInit = getWorldCitiesCatalog();
  let distantCityLOD = (_wccInit && typeof _wccInit.createDistantCityHorizonLOD === 'function')
    ? _wccInit.createDistantCityHorizonLOD(root, ground)
    : null;

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
    let bestDist = 1e9, bestAirport = null, bestCity = null;
    for (let i = 0; i < airports.length; i++) {
      const a = airports[i];
      if (a.shortField || a.carrier) continue;
      const d = Math.hypot(x - a.x, z - a.z);
      if (d < bestDist) { bestDist = d; bestAirport = a; }
    }
    let cbdX = 1e9, cbdZ = 1e9, hubX = 0, hubZ = 0;
    let region = bestAirport?.region || null;
    let urbanRadius = 20000, suburbanRadius = 38000, cbdRadius = 2800;
    if (bestAirport) {
      const cbdSide = Math.sign(bestAirport.apron || 1);
      cbdX = bestAirport.x + Math.cos(bestAirport.heading) * (cbdSide * 3400);
      cbdZ = bestAirport.z + Math.sin(bestAirport.heading) * (cbdSide * 3400);
      hubX = bestAirport.x;
      hubZ = bestAirport.z;
    }
    const wcc = getWorldCitiesCatalog();
    if (wcc && typeof wcc.nearestCity === 'function') {
      const rawCity = wcc.nearestCity(x, z, 140000);
      const cityRec = resolveCityRecord(rawCity, x, z);
      if (cityRec && cityRec.dist < bestDist) {
        bestDist = cityRec.dist;
        bestCity = cityRec;
        cbdX = cityRec.x;
        cbdZ = cityRec.z;
        hubX = cityRec.x;
        hubZ = cityRec.z;
        if (cityRec.region) region = cityRec.region;
        urbanRadius = cityRec.urbanRadius;
        suburbanRadius = cityRec.suburbanRadius;
        cbdRadius = cityRec.cbdRadius;
      }
    }
    return { dist: bestDist, airport: bestAirport, city: bestCity, cbdX, cbdZ, hubX, hubZ, region, urbanRadius, suburbanRadius, cbdRadius };
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
    const wcc = getWorldCitiesCatalog();
    if (wcc && typeof wcc.nearestCity === 'function') {
      const rawCity = wcc.nearestCity(x, z, 140000);
      const cityRec = resolveCityRecord(rawCity, x, z);
      if (cityRec && cityRec.dist < bestDist) bestDist = cityRec.dist;
    }
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

  // =========================================================================
  // Ultra-Authentic Global Regional Color Palettes (20-26 Distinct Colors / Region)
  // =========================================================================
  const REGIONAL_PALETTES = {
    europe: {
      // Western / Central Europe: Haussmann limestone, Parisian cream, London brick, ochre, sage, rose, zinc & terracotta roofs
      brick: [0xece3d0, 0xe4d8c0, 0xd8b272, 0xc97154, 0xb25442, 0xc47d54, 0xd49a8e, 0xdccab2],
      condo: [0xefe9dc, 0xbcc8b8, 0xead48c, 0xe2d4c2, 0xcbd5dc, 0xdcb8a6],
      house: [0xece3d0, 0xe4d8c0, 0xd8b272, 0xc97154, 0xb25442, 0xc47d54, 0xbcc8b8, 0xead48c, 0xd49a8e, 0xf2ede2],
      glass: [0x6e96b6, 0x86aec8, 0x5c809c, 0x9ab4c2, 0x73999e, 0xb49c7c],
      ind: [0xc6ced4, 0xb6bec4, 0xcac2b6, 0x8d9ca8],
      flatRoof: [0x606b74, 0x737b82, 0x847a72, 0x535e68],
      pitchedRoof: [0xb5563e, 0x4d5f70, 0x464d54, 0xa24d38, 0x6b4b3e, 0x566470],
      brickBias: 0.68,
      pitchedChance: 0.72,
      historicLowRise: true
    },
    mediterranean: {
      // Southern Europe / Mediterranean: Sun-drenched terracotta, peach, apricot, warm ochre, whitewash, lavender-cream, clay roofs
      brick: [0xe8c49e, 0xd89268, 0xcf6e4c, 0xe2b66a, 0xefe3ce, 0xdcb09a, 0xd2845e],
      condo: [0xf4eee2, 0xf0cfa8, 0xe8b896, 0xece0c4, 0xded4df, 0xf2d99b],
      house: [0xf5f0e6, 0xeec49c, 0xe5a87e, 0xd97d56, 0xe6be72, 0xead9c4, 0xe4ccd2, 0xf0d696, 0xd69378],
      glass: [0x6ea0be, 0x84b4cc, 0x6296a8, 0xb8a27c, 0x90b2c8],
      ind: [0xd8cfc2, 0xc6bdb0, 0xb8c2c8, 0xc8b29c],
      flatRoof: [0xc4b098, 0xb59e86, 0x968e86, 0xa89888],
      pitchedRoof: [0xc95a36, 0xb84e30, 0xd46d42, 0xa64a32, 0xc06844, 0x8e4a38],
      brickBias: 0.64,
      pitchedChance: 0.74,
      historicLowRise: true
    },
    north_america: {
      // North America: Brownstone/red brick, colorful suburban clapboard siding, sapphire/bronze/silver/emerald glass skyscrapers
      brick: [0xa85242, 0x8f5140, 0xbe6e52, 0xc99c7c, 0x9c624e, 0xd6c4b0, 0xb5684c],
      condo: [0xe6e2da, 0xcfd8df, 0xdccbb8, 0xc5d2c8, 0xd8d2c8, 0xb8c6d2],
      house: [0xeef0f2, 0x7c9bb5, 0x8ea894, 0xe5cf8e, 0xad5349, 0xd8cab4, 0xadbac4, 0xe2d4be, 0x9e7d68, 0xcfdad2],
      glass: [0x5886b2, 0x4a769e, 0x7aa4c4, 0xa68e6c, 0x5c9690, 0x94aab8],
      ind: [0xc4ccd2, 0xb2bcc4, 0xc8c0b4, 0x8c9aa6, 0xb69c8a],
      flatRoof: [0x5e656c, 0x767c82, 0x8b857e, 0x525960],
      pitchedRoof: [0x454b52, 0x5e4a3c, 0x745844, 0x3b444e, 0x6a5c52, 0x844e3c],
      brickBias: 0.56,
      pitchedChance: 0.76,
      historicLowRise: false
    },
    east_asia: {
      // East Asia (Japan / Korea / China / Taiwan): Porcelain white, ivory, pastel peach/mint/sky condos, dark charcoal modern homes, brick shophouses
      brick: [0xdcc8b4, 0xc47e62, 0xb86850, 0xe2d6c2, 0xc9a882, 0xb28a72],
      condo: [0xf4f2ec, 0xeee6d6, 0xebd2c4, 0xcce0d6, 0xc8dceb, 0xe6dfd2, 0xd6d4dc],
      house: [0xf2f0ea, 0xebe3d4, 0x4a5058, 0xd8c6b2, 0xe8d0c0, 0xcbdad2, 0xc4d4e2, 0x625a54, 0xdfd4be],
      glass: [0x5a94a8, 0x4c82a8, 0x6aa8a0, 0x8ab2ca, 0xa8b8c4, 0x5c7fa6],
      ind: [0xcbd2d8, 0xb4bec6, 0xd4cdc2, 0x8a9aa8],
      flatRoof: [0x7e878e, 0x6a737b, 0x90969a, 0x5c666e],
      pitchedRoof: [0x3c434c, 0x4e5864, 0xa64e3c, 0x3c6b5a, 0x5a4c44, 0x38526c],
      brickBias: 0.34,
      pitchedChance: 0.64,
      historicLowRise: false
    },
    middle_east: {
      // Middle East: Sunlit desert limestone, warm sandstone, whitewashed villas, ochre-gold, rose-terracotta, gleaming silver/turquoise/gold glass
      brick: [0xede2cc, 0xdbc298, 0xcfa86b, 0xc9886e, 0xe4cfa8, 0xd2b488],
      condo: [0xf2eee6, 0xede2cc, 0xe4d2b4, 0xdec09a, 0xe8d8c2, 0xd8b498],
      house: [0xf2eee6, 0xede2cc, 0xdbc298, 0xcfa86b, 0xc9886e, 0xe8d9be, 0xdec4a0, 0xf0e5d2],
      glass: [0x9eb8c8, 0x5aa6b4, 0xc8ad72, 0x5688b4, 0xb4c4ce, 0x76b0be],
      ind: [0xd8ccb8, 0xc8baa2, 0xbec6cc, 0xc4ae92],
      flatRoof: [0xdac9ae, 0xcab696, 0xbfa988, 0xe2d5be],
      pitchedRoof: [0xb86846, 0xc68256, 0x9c6a4a, 0x8a745c],
      brickBias: 0.44,
      pitchedChance: 0.22,
      historicLowRise: false
    },
    latin_america: {
      // Latin America: Vibrant colonial ochre, coral-terracotta, turquoise-mint, cobalt-pastel, sunlit yellow, blush pink, whitewash, terracotta roofs
      brick: [0xdfae5a, 0xd47058, 0xc46048, 0xe4c686, 0xd88872, 0xce9662],
      condo: [0xefeae0, 0x7bbcb4, 0x7a9ec9, 0xecd27c, 0xdfa096, 0xe8d4b8, 0x98c4aa],
      house: [0xdfae5a, 0xd47058, 0x7bbcb4, 0x7a9ec9, 0xecd27c, 0xdfa096, 0xefeae0, 0xe8945e, 0xb6a0cc, 0x92bf8a],
      glass: [0x5894b2, 0x6aa8b8, 0x4c7ea2, 0x86aec4, 0xa89a74],
      ind: [0xd2c8ba, 0xb8c4ca, 0xc8b29a, 0x92a4b0],
      flatRoof: [0xa6988a, 0x8e867e, 0xb89c84, 0x767c82],
      pitchedRoof: [0xc45836, 0xb24a2e, 0xd06a42, 0x9c4832, 0x84503c],
      brickBias: 0.48,
      pitchedChance: 0.58,
      historicLowRise: false
    },
    se_asia: {
      // Southeast Asia: Tropical white, warm cream, saffron/ochre, mint-pastel, coral-pink, sky-blue, terracotta & emerald roofs, teal/sapphire glass
      brick: [0xe6c896, 0xd48668, 0xe8d8be, 0xce9e64, 0xc87458, 0xdcb898],
      condo: [0xf4f0e6, 0xebe0c8, 0xb8dcc8, 0xf0c2b4, 0xbad6ec, 0xf2dc9a, 0xe2dcd0],
      house: [0xf4f0e6, 0xebe0c8, 0xe6b85e, 0xaed4be, 0xecaaa0, 0x9ec4e0, 0xe8cda2, 0xd88e6e, 0xf0e4be],
      glass: [0x4c94a6, 0x5886b6, 0x62a89c, 0x7cb0c4, 0x96b2c2, 0xb2a072],
      ind: [0xc6d0d6, 0xb6c2c8, 0xd2c6b4, 0x869ea8],
      flatRoof: [0x8c8a84, 0x747c82, 0x9e9488, 0x667076],
      pitchedRoof: [0xc25638, 0x3a7a5c, 0xb04830, 0x4a6882, 0x98503a, 0x2f6c52],
      brickBias: 0.36,
      pitchedChance: 0.62,
      historicLowRise: false
    },
    south_asia: {
      // South Asia: Tropical cream, saffron/ochre, sandstone pink, terracotta, mint-pastel, sky-blue, vibrant roof accents
      brick: [0xdca272, 0xc87456, 0xe2b872, 0xd89078, 0xc46648, 0xe8d2b2],
      condo: [0xf2eadc, 0xedd29a, 0xbcd8cc, 0xebb4a6, 0xb6d2e8, 0xe8dcc8],
      house: [0xf2eadc, 0xebba62, 0xe89e8c, 0x9cc4de, 0xb0d4be, 0xd87c5a, 0xf0dc96, 0xe4c6ae, 0xc2b2d4],
      glass: [0x548eb0, 0x4e969e, 0x72a6c0, 0xa89872, 0x88a8bc],
      ind: [0xd0c6b8, 0xb8c2c8, 0xc6b096, 0x8c9ca6],
      flatRoof: [0xa69888, 0x8e867e, 0xb6a492, 0x7a8086],
      pitchedRoof: [0xc05236, 0xa84630, 0x487664, 0x5c6c7c, 0x94503c],
      brickBias: 0.50,
      pitchedChance: 0.44,
      historicLowRise: false
    },
    oceania: {
      // Oceania (Australia / NZ): Red/terracotta brick, crisp white coastal villas, sandstone, colorbond slate/green/terracotta roofs
      brick: [0xb85e46, 0xc87858, 0xdfcca8, 0xa6543e, 0xd4a67e, 0xc28a68],
      condo: [0xf2f0eb, 0xe4dccb, 0xcad6dc, 0xd6dfd6, 0xead8c0, 0xbccad4],
      house: [0xf4f2ee, 0xc2664c, 0xe6dac4, 0xb8c8d2, 0xc6d4c4, 0xead49c, 0xd29c7a, 0xdee4e8, 0xb25842],
      glass: [0x5c90b6, 0x74aac6, 0x4e7ea4, 0x62a09a, 0x98b2c2],
      ind: [0xc4ccd2, 0xb0bcc4, 0xcac2b4, 0x8296a2],
      flatRoof: [0x6c747c, 0x848a90, 0x989088, 0x5c646c],
      pitchedRoof: [0xb45238, 0x47525c, 0x3f6250, 0x5a6872, 0x984a36, 0x6a584c],
      brickBias: 0.52,
      pitchedChance: 0.78,
      historicLowRise: false
    },
    africa: {
      // Africa: Warm earth-ochre, whitewash, terracotta, red earth, sandy plaster, corrugated iron & bright colored roofs
      brick: [0xd8a268, 0xc46e4c, 0xe4c69c, 0xb86242, 0xce8e5a, 0xdfc092],
      condo: [0xf2ece0, 0xe8d4b2, 0xdcb488, 0xd4a288, 0xc8d8d0, 0xe8cf8e],
      house: [0xf0e8da, 0xdda25c, 0xc86e4c, 0xe6c896, 0xd6967a, 0xa4c8c0, 0xe8d284, 0xb87852, 0x94b2c8],
      glass: [0x6296b4, 0x76a8bc, 0xb89c6c, 0x548a94, 0x92aab8],
      ind: [0xc8beb0, 0xb4bcc2, 0xc4a488, 0x8e9ca4],
      flatRoof: [0xba9e82, 0x9e8a76, 0x88847e, 0xc8b298],
      pitchedRoof: [0xb64a34, 0x3b6e56, 0x4a6684, 0x9c6244, 0x767e86, 0xc6623a],
      brickBias: 0.52,
      pitchedChance: 0.54,
      historicLowRise: false
    }
  };

  function resolveGlobalRegion(country, airportRegion, lat, lon) {
    const code = country?.code || '';
    if (code) {
      if (code === 'ES' || code === 'IT' || code === 'MED_IS' || code === 'GR_BK' || code === 'TR') return 'mediterranean';
      if (code === 'FR') return (Number.isFinite(lat) && lat < 44.2) ? 'mediterranean' : 'europe';
      if (code === 'GB' || code === 'IE' || code === 'DE' || code === 'CH' || code === 'PL_CE' || code === 'RO_UA' || code === 'FI_BA' || code === 'SC' || code === 'EE') return 'europe';
      if (code === 'US' || code === 'CA' || code === 'AK' || code === 'HI') return 'north_america';
      if (code === 'MX' || code === 'CU_CB' || code === 'CO' || code === 'PE_BO' || code === 'BR' || code === 'AR') return 'latin_america';
      if (code === 'AE' || code === 'IL_JO' || code === 'IR') return 'middle_east';
      if (code === 'IN' || code === 'LK' || code === 'PK_AF' || code === 'BD_MM') return 'south_asia';
      if (code === 'SEA' || code === 'MY' || code === 'PH' || code === 'PH_S' || code === 'ID_B' || code === 'ID_S' || code === 'ID_J' || code === 'ID_SUL' || code === 'PG') return 'se_asia';
      if (code === 'JP' || code === 'JP_KYU' || code === 'JP_SHK' || code === 'JP_HKD' || code === 'KR' || code === 'KR_CJU' || code === 'CN' || code === 'CN_HN' || code === 'TW') return 'east_asia';
      if (code === 'AU' || code === 'AU_TAS' || code === 'NZ') return 'oceania';
      if (code === 'EG' || code === 'MA_DZ' || code === 'LY' || code === 'NA_AF' || code === 'KE_EA' || code === 'ZA' || code === 'MG') return 'africa';
    }
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      if (lat >= 35 && lat <= 72 && lon >= -26 && lon <= 45) return lat < 44 ? 'mediterranean' : 'europe';
      if (lat >= 12 && lat <= 40 && lon >= 34 && lon <= 63) return 'middle_east';
      if (lat >= -36 && lat <= 36 && lon >= -18 && lon <= 52) return 'africa';
      if (lat >= 5 && lat <= 36 && lon >= 63 && lon <= 93) return 'south_asia';
      if (lat >= -11 && lat <= 22 && lon >= 93 && lon <= 142) return 'se_asia';
      if (lat >= 20 && lat <= 54 && lon >= 98 && lon <= 150) return 'east_asia';
      if (lat < -10 && lon >= 110 && lon <= 180) return 'oceania';
      if (lat >= 24 && lon <= -52) return 'north_america';
      if (lat < 24 && lon <= -30) return 'latin_america';
    }
    if (airportRegion && REGIONAL_PALETTES[airportRegion]) return airportRegion;
    const b = country?.biome || 'temperate';
    if (airportRegion === 'eu' || b === 'mediterranean') return (Number.isFinite(lat) && lat < 44) ? 'mediterranean' : 'europe';
    if (airportRegion === 'me' || b === 'arid') return 'middle_east';
    if (airportRegion === 'na') return 'north_america';
    if (airportRegion === 'sea' || b === 'tropical') return 'se_asia';
    if (airportRegion === 'ea') return 'east_asia';
    if (airportRegion === 'oc') return 'oceania';
    if (airportRegion === 'sa' || airportRegion === 'la') return 'latin_america';
    if (airportRegion === 'af') return 'africa';
    return 'east_asia';
  }

  function rgbToHsl01(r, g, b) {
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) * 0.5;
    if (max === min) return [0, 0, l];
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h = 0;
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    return [h / 6, s, l];
  }

  function hsl01ToRgb(h, s, l) {
    if (s <= 0.0001) return [l, l, l];
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 0.5) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    return [hue2rgb(p, q, h + 1 / 3), hue2rgb(p, q, h), hue2rgb(p, q, h - 1 / 3)];
  }

  // Deterministic per-building HSL jitter (±8-12% variation so no two neighboring structures look identical)
  function jitterRgbHsl(rgb, seed, hSpan = 0.028, sSpan = 0.11, lSpan = 0.095) {
    const [h, s, l] = rgbToHsl01(rgb[0], rgb[1], rgb[2]);
    const jh = (hash2(seed * 1.37 + 11.3, seed * 0.71 + 3.7) - 0.5) * 2 * hSpan;
    const js = (hash2(seed * 2.13 + 7.1, seed * 1.91 + 19.3) - 0.5) * 2 * sSpan;
    const jl = (hash2(seed * 3.07 + 23.9, seed * 0.53 + 5.9) - 0.5) * 2 * lSpan;
    const nh = ((h + jh) % 1 + 1) % 1;
    const ns = Math.min(0.86, Math.max(0.03, s * (1 + js) + js * 0.18));
    const nl = Math.min(0.95, Math.max(0.16, l * (1 + jl)));
    return hsl01ToRgb(nh, ns, nl);
  }

  function jitterHex(hex, seed, hSpan = 0.028, sSpan = 0.11, lSpan = 0.095) {
    const rgb = [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
    const [r, g, b] = jitterRgbHsl(rgb, seed, hSpan, sSpan, lSpan);
    return (Math.round(r * 255) << 16) | (Math.round(g * 255) << 8) | Math.round(b * 255);
  }

  function getRegionalPalette(country, airportRegion, lat, lon) {
    const regId = resolveGlobalRegion(country, airportRegion, lat, lon);
    const p = REGIONAL_PALETTES[regId] || REGIONAL_PALETTES.north_america;
    return { ...p, id: regId, apt: p.brick };
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

  // Fast Batched Mid-Range LOD1 Tile Builder (< 0.35 ms, 1-3 draw calls/tile, exact regional palette continuity!)
  function buildMidLodTile(col, row) {
    const cx = (col + 0.5) * TILE, cz = (row + 0.5) * TILE;
    const ll = typeof latLon === 'function' ? latLon(cx, cz) : null;
    if (!ll || insideTaiwanDetailed(ll.lat, ll.lon)) return null;
    const centerGround = ground(cx, cz);
    if (centerGround < 0.8) return null;

    const hubInfo = nearestHubInfo(cx, cz);
    const hubDist = hubInfo.dist;
    const cbdX = hubInfo.cbdX;
    const cbdZ = hubInfo.cbdZ;
    const cbdDist = Math.hypot(cx - cbdX, cz - cbdZ);
    const regCellX = Math.floor(col / 8), regCellZ = Math.floor(row / 8);
    const regCityCore = hubDist > 22000 && hash2(regCellX * 13, regCellZ * 17) > 0.52 &&
      Math.abs(((col % 8) + 8) % 8 - 4) <= 1 && Math.abs(((row % 8) + 8) % 8 - 4) <= 1;
    const isMetroCore = cbdDist < (hubInfo.cbdRadius || 2800) || regCityCore;
    const isUrbanTile = hubDist < (hubInfo.urbanRadius || 20000) || regCityCore;
    const isSuburbanTile = !isUrbanTile && hubDist < (hubInfo.suburbanRadius || 38000);
    const sampler = typeof window !== 'undefined' ? window.__SKYBOUND_SAT_SAMPLER : null;
    const hasSatPhoto = Boolean(sampler && sampler(cx, cz));

    // Only populate urban/suburban mid-range tiles (rural/open terrain stays clean & zero-cost)
    if (!isUrbanTile && !isSuburbanTile && !hasSatPhoto) return null;

    const country = typeof WorldAtlas !== 'undefined' ? WorldAtlas.countryAt(ll.lon, ll.lat) : null;
    const biome = country?.biome || 'temperate';
    const regionCode = hubInfo.region || (biome === 'arid' ? 'me' : biome === 'mediterranean' ? 'eu' : 'na');
    const pal = getRegionalPalette(country, regionCode, ll.lat, ll.lon);
    const isEuropean = pal.historicLowRise;
    const isMiddleEast = pal.id === 'middle_east';
    const pickJitter = (arr, seed, idx) => jitterHex(arr[Math.abs(idx) % arr.length], seed);

    const osmCity = typeof window !== 'undefined' ? window.__SKYBOUND_WORLD_CITY : null;
    const x0 = col * TILE, z0 = row * TILE;
    const gridDiv = (isMetroCore || isUrbanTile) ? 3 : 2;
    const blockSize = TILE / gridDiv;
    const districtAngle = (hash2(col * 11, row * 17) - 0.5) * 1.15;
    const maxBuildElev = (isUrbanTile || isSuburbanTile) ? 4200 : 2450;

    const mainBlocks = [];
    const glassBlocks = [];
    const roofCaps = [];

    for (let br = 0; br < gridDiv; br++) {
      for (let bc = 0; bc < gridDiv; bc++) {
        const bx0 = x0 + bc * blockSize, bz0 = z0 + br * blockSize;
        const bcx = bx0 + blockSize * 0.5, bcz = bz0 + blockSize * 0.5;
        if (osmCity && typeof osmCity.blocked === 'function' && osmCity.blocked(bcx, bcz)) continue;
        if (inLiveOsmArea(bcx, bcz)) continue;
        const bGround = ground(bcx, bcz);
        if (bGround < 1.1 || bGround > maxBuildElev) continue;

        const landUse = classifyLandUse(bcx, bcz, bGround);
        if (landUse === 'water' || landUse === 'forest' || landUse === 'mountain' || landUse === 'open') continue;

        const allowUrban = landUse === 'urban' || (!hasSatPhoto && isUrbanTile);
        const allowSuburban = landUse === 'suburban' || (!hasSatPhoto && isSuburbanTile);
        if (!allowUrban && !allowSuburban) continue;

        const blockCbdDist = Math.hypot(bcx - cbdX, bcz - cbdZ);
        const blockSeed = hash2(col * 19 + bc * 7, row * 23 + br * 11);
        const lots = (allowUrban && (blockCbdDist < 3000 || isMetroCore)) ? 3 : (allowUrban ? 3 : 2);

        for (let k = 0; k < lots; k++) {
          const rA = hash2(col * 37 + bc * 13 + k, row * 41 + br * 17);
          const rB = hash2(col * 17 + k * 29, row * 31 + bc + br);
          const lx = bx0 + 55 + rA * (blockSize - 110);
          const lz = bz0 + 55 + rB * (blockSize - 110);
          if (inAirportClearance(lx, lz, 180)) continue;
          const lg = ground(lx, lz);
          if (lg < 1.2 || lg > maxBuildElev) continue;

          const bSeed = col * 131 + row * 97 + bc * 29 + br * 17 + k * 7;
          const rot = districtAngle + ((k & 1) ? 0 : Math.PI * 0.5);

          if (allowUrban && (blockCbdDist < (hubInfo.cbdRadius || 2800) || (isMetroCore && blockSeed > 0.45))) {
            const w = 32 + hash2(k, bc + col) * 26;
            const d = 30 + hash2(br + row, k) * 24;
            const maxH = isEuropean ? 40 : isMiddleEast ? 128 : 104;
            const h = (isEuropean ? 18 : 24) + Math.pow(hash2(col + k, row - k + bc), 1.55) * (blockCbdDist < 1900 ? maxH : maxH * 0.55);
            if (h > 44 && (!isEuropean || k === 0)) {
              glassBlocks.push({ x: lx, y: lg + h * 0.5 - 0.8, z: lz, w, h, d, rot: districtAngle, tone: pickJitter(pal.glass, bSeed + 3, k + bc) });
            } else {
              const srcArr = hash2(bSeed, 13.7) < pal.brickBias ? pal.brick : pal.condo;
              mainBlocks.push({ x: lx, y: lg + h * 0.5 - 0.8, z: lz, w, h, d, rot, tone: pickJitter(srcArr, bSeed, k + bc + br) });
              if (isEuropean && hash2(bSeed, 53.3) < 0.72) {
                roofCaps.push({ x: lx, y: lg + h * 0.5 - 0.8, z: lz, w, h, d, rot, tone: pickJitter(pal.pitchedRoof, bSeed + 5, k + br) });
              }
            }
          } else {
            const w = (allowUrban ? 34 : 30) + hash2(k * 5 + col, bc + br) * 24;
            const d = (allowUrban ? 30 : 26) + hash2(br + row, k * 7 + bc) * 22;
            const h = allowUrban
              ? (12 + hash2(k + col, br + row) * (isEuropean ? 14 : 18))
              : (7.5 + hash2(bc + k, br + row) * 5.2);
            const wallPool = allowUrban
              ? (hash2(bSeed, 19.1) < pal.brickBias ? pal.brick : pal.condo)
              : pal.house;
            mainBlocks.push({ x: lx, y: lg + h * 0.5 - 0.6, z: lz, w, h, d, rot, tone: pickJitter(wallPool, bSeed, k + bc + br) });
            if (hash2(bSeed, 61.9) < pal.pitchedChance * 0.75) {
              roofCaps.push({ x: lx, y: lg + h * 0.5 - 0.6, z: lz, w, h, d, rot, tone: pickJitter(pal.pitchedRoof, bSeed + 17, k + bc) });
            }
          }
        }
      }
    }

    if (!mainBlocks.length && !glassBlocks.length) return null;

    const group = new THREE.Group();
    group.name = 'MidLOD1_' + col + '_' + row;
    group.userData.lod = 1;
    group.userData.hadSat = hasSatPhoto;
    group.userData.osmRev = liveOsmRevision;

    const dummy = new THREE.Object3D();
    const tmpCol = new THREE.Color();
    const emitFast = (items, geo, mat) => {
      if (!items.length) return;
      const inst = new THREE.InstancedMesh(geo, mat, items.length);
      for (let idx = 0; idx < items.length; idx++) {
        const b = items[idx];
        dummy.position.set(b.x, b.y, b.z);
        dummy.rotation.set(0, b.rot || 0, 0);
        dummy.scale.set(b.w, b.h, b.d);
        dummy.updateMatrix();
        inst.setMatrixAt(idx, dummy.matrix);
        if (typeof inst.setColorAt === 'function') {
          tmpCol.setHex(b.tone);
          inst.setColorAt(idx, tmpCol);
        }
      }
      if (inst.instanceMatrix) inst.instanceMatrix.needsUpdate = true;
      if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
      inst.castShadow = false;
      inst.receiveShadow = false;
      group.add(inst);
    };

    const primaryMat = pal.brickBias >= 0.48 ? archBrickMat : archCondoMat;
    emitFast(mainBlocks, unitLod1BoxGeo, [primaryMat, archFlatRoofMat]);
    emitFast(glassBlocks, unitLod1TallGeo, [archGlassMat, archFlatRoofMat]);
    if (roofCaps.length && !isLowMem) {
      emitFast(roofCaps, unitMansardRoofGeo, archPitchedRoofMat);
    }

    root.add(group);
    return group;
  }

  function buildTile(col, row, lod = 0) {
    if (lod >= 1) return buildMidLodTile(col, row);
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
    group.userData.lod = 0;
    group.userData.hadSat = hasSatPhoto;
    group.userData.osmRev = liveOsmRevision;
    const posArr = [], linePosArr = [];
    // Separate multi-archetype & dual-color roof batches (fast InstancedMesh batching!)
    const gableHouses = [], hipHouses = [], flatHouses = [];
    const brickApts = [], condoApts = [], mansardRoofs = [];
    const glassTowers = [], warehouses = [], lamps = [], beacons = [], trees = [];
    const x0 = col * TILE, z0 = row * TILE;
    const hubAp = hubInfo.airport;
    const cbdX = hubInfo.cbdX;
    const cbdZ = hubInfo.cbdZ;
    const cbdDist = Math.hypot(cx - cbdX, cz - cbdZ);
    const regCellX = Math.floor(col / 8), regCellZ = Math.floor(row / 8);
    const regCityCore = hubDist > 22000 && hash2(regCellX * 13, regCellZ * 17) > 0.52 &&
      Math.abs(((col % 8) + 8) % 8 - 4) <= 1 && Math.abs(((row % 8) + 8) % 8 - 4) <= 1;
    const isMetroCore = cbdDist < (hubInfo.cbdRadius || 2800) || regCityCore;
    const isUrbanTile = hubDist < (hubInfo.urbanRadius || 20000) || regCityCore;
    const isSuburbanTile = !isUrbanTile && hubDist < (hubInfo.suburbanRadius || 38000);
    const biome = country?.biome || 'temperate';
    const regionCode = hubInfo.region || (biome === 'arid' ? 'me' : biome === 'mediterranean' ? 'eu' : 'na');
    const pal = getRegionalPalette(country, regionCode, ll.lat, ll.lon);
    const isEuropean = pal.historicLowRise;
    const isMiddleEast = pal.id === 'middle_east';
    const pickJitter = (arr, seed, idx) => jitterHex(arr[Math.abs(idx) % arr.length], seed);
    const maxBuildElev = (isUrbanTile || isSuburbanTile) ? 4200 : 2450;

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
        if (bGround < 1.1 || bGround > maxBuildElev) continue;

        const landUse = classifyLandUse(bcx, bcz, bGround);
        if (landUse === 'water') continue;

        const blockCbdDist = Math.hypot(bcx - cbdX, bcz - cbdZ);
        const nearAirportInd = hubAp ? (Math.hypot(bcx - hubAp.x, bcz - hubAp.z) < 2400) : false;
        const blockSeed = hash2(col * 19 + bc * 7, row * 23 + br * 11);

        // Parks, Forests, Cliffs & Mountain Slopes: NEVER place fake buildings! Render lush biome-appropriate trees & keep real terrain visible!
        if (landUse === 'forest' || landUse === 'mountain') {
          const treeCount = landUse === 'mountain' ? (biome === 'arid' ? 2 : 7) : (biome === 'arid' ? 3 : 11);
          for (let t = 0; t < treeCount; t++) {
            const tx = bx0 + 16 + hash2(bc * 43 + t * 5, br * 19 + col) * (blockSize - 32);
            const tz = bz0 + 16 + hash2(bc * 29 + row, br * 37 + t * 7) * (blockSize - 32);
            if (inAirportClearance(tx, tz, 240)) continue;
            const tg = ground(tx, tz);
            if (tg >= 1.5 && tg < maxBuildElev) {
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

        if (allowUrban && (blockCbdDist < (hubInfo.cbdRadius || 2600) || (isMetroCore && blockSeed > 0.45))) {
          // Region-Distinct Downtown CBD (European Haussmann limestone & mansard blocks vs global glass/brick/condo skylines!)
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
            const bSeed = col * 131 + row * 97 + bc * 29 + br * 17 + k * 7;
            const maxH = isEuropean ? 42 : isMiddleEast ? 135 : 110;
            const h = (isEuropean ? 18 : 22) + Math.pow(hash2(col + k, row - k + bc), 1.6) * (blockCbdDist < 1800 ? maxH : maxH * 0.55);
            const rot = districtAngle + ((k & 1) ? 0 : Math.PI * 0.5);
            const useBrick = hash2(bSeed, 13.7) < pal.brickBias;
            const podList = useBrick ? brickApts : condoApts;
            const podTone = pickJitter(useBrick ? pal.brick : pal.condo, bSeed, k + bc + br);
            if (h > 44 && (!isEuropean || (k === 0 && h > 48))) {
              const podH = Math.min(15, h * 0.24);
              const glassTone = pickJitter(pal.glass, bSeed + 3, k + bc);
              podList.push({ x: lx, y: lg + podH * 0.5 - 0.5, z: lz, w: w * 1.18, h: podH, d: d * 1.18, rot: districtAngle, tone: podTone });
              glassTowers.push({ x: lx, y: lg + h * 0.5 - 0.5, z: lz, w: w * 0.86, h, d: d * 0.86, rot: districtAngle, tone: glassTone });
              const crownH = h * (0.14 + hash2(bSeed, 31.1) * 0.10);
              const crownScale = 0.52 + hash2(bSeed, 41.7) * 0.16;
              glassTowers.push({ x: lx, y: lg + h + crownH * 0.5 - 0.8, z: lz, w: w * crownScale, h: crownH, d: d * crownScale, rot: districtAngle, tone: jitterHex(glassTone, bSeed + 9, 0.012, 0.06, 0.06) });
              if (h > 68) beacons.push({ x: lx, y: lg + h + crownH + 1.2, z: lz });
            } else {
              podList.push({ x: lx, y: lg + h * 0.5 - 0.5, z: lz, w, h, d, rot, tone: podTone });
              if (isEuropean && hash2(bSeed, 53.3) < 0.72) {
                // Authentic Parisian zinc / terracotta mansard & hipped roof over historic mid-rise block
                mansardRoofs.push({ x: lx, y: lg + h * 0.5 - 0.5, z: lz, w, h, d, rot, tone: pickJitter(pal.pitchedRoof, bSeed + 5, k + br) });
              } else if (h >= 24) {
                // Recessed rooftop mechanical penthouse for varied urban skyline silhouettes
                const ph = Math.min(6.5, h * 0.16);
                condoApts.push({ x: lx, y: lg + h + ph * 0.5 - 0.6, z: lz, w: w * 0.44, h: ph, d: d * 0.44, rot, tone: pickJitter(pal.flatRoof, bSeed + 17, k) });
              }
            }
          }
        } else if (allowUrban && (nearAirportInd ? blockSeed < 0.35 : (blockCbdDist > 2400 && blockSeed < 0.16))) {
          // Logistics / Port / Airport Commercial Park Block (corrugated steel warehouses)
          for (let wIdx = 0; wIdx < 3; wIdx++) {
            const wx = bx0 + 44 + (wIdx % 2) * (blockSize * 0.44);
            const wz = bz0 + 44 + Math.floor(wIdx / 2) * (blockSize * 0.44);
            if (inAirportClearance(wx, wz, 150)) continue;
            const wg = ground(wx, wz);
            if (wg < 1.2 || classifyLandUse(wx, wz, wg) === 'water') continue;
            const ww = 34 + hash2(wIdx, col) * 24;
            const wd = 24 + hash2(row, wIdx) * 18;
            const wh = 9.5 + (wIdx % 2) * 3.5;
            const wSeed = col * 71 + row * 59 + bc * 13 + br * 19 + wIdx * 5;
            warehouses.push({ x: wx, y: wg + wh * 0.5 - 0.5, z: wz, w: ww, h: wh, d: wd, rot: districtAngle, tone: pickJitter(pal.ind, wSeed, wIdx + bc) });
          }
        } else if (allowUrban || allowSuburban) {
          // Organic Regional Residential Neighborhood (multi-color clapboard/stucco houses + brick & balcony apartments!)
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
              const lotSeed = col * 113 + row * 89 + bc * 31 + br * 23 + rr * 11 + cc * 5;
              const rot = districtAngle + (((cc + rr) & 1) ? 0 : Math.PI * 0.5);
              const isMidRiseLot = allowUrban && ((rr + cc + bc) % 3 === 0);
              if (isMidRiseLot) {
                const ah = (isEuropean ? 15 : 12) + hash2(cc + col, rr + row) * (isEuropean ? 14 : 20);
                const aw = 16 + (cc % 3) * 5, ad = 14 + (rr % 3) * 5;
                const useBrick = hash2(lotSeed, 19.1) < pal.brickBias;
                const list = useBrick ? brickApts : condoApts;
                const tone = pickJitter(useBrick ? pal.brick : pal.condo, lotSeed, cc + rr + bc);
                list.push({ x: hx, y: hg + ah * 0.5 - 0.5, z: hz, w: aw, h: ah, d: ad, rot, tone });
                if (isEuropean && hash2(lotSeed, 47.3) < 0.65) {
                  mansardRoofs.push({ x: hx, y: hg + ah * 0.5 - 0.5, z: hz, w: aw, h: ah, d: ad, rot, tone: pickJitter(pal.pitchedRoof, lotSeed + 7, cc + br) });
                } else if (ah >= 24) {
                  const ph = 3.8;
                  condoApts.push({ x: hx, y: hg + ah + ph * 0.5 - 0.6, z: hz, w: aw * 0.42, h: ph, d: ad * 0.42, rot, tone: pickJitter(pal.flatRoof, lotSeed + 13, rr) });
                }
              } else {
                const hh = 7.2 + hash2(cc, rr + row) * 4.5;
                const hw = 10.5 + ((cc + bc) % 4) * 2.4;
                const hd = 9.5 + ((rr + br) % 3) * 2.4;
                const wallTone = pickJitter(pal.house, lotSeed, cc + rr + bc + br);
                const roofTone = pickJitter(pal.pitchedRoof, lotSeed + 17, cc * 3 + rr + bc);
                const roofRoll = hash2(lotSeed, 61.9);
                if (roofRoll > pal.pitchedChance) {
                  // Flat-roofed stucco villa (common in Middle East, North Africa, parts of Latin America & Asia)
                  flatHouses.push({ x: hx, y: hg + hh * 0.42 - 0.4, z: hz, w: hw, h: hh * 0.84, d: hd, rot, tone: wallTone });
                } else if (roofRoll < pal.pitchedChance * 0.55) {
                  // Gabled house with independent wall color + tiled pitched roof color
                  gableHouses.push({ x: hx, y: hg + hh * 0.5 - 0.4, z: hz, w: hw, h: hh, d: hd, rot, wallTone, roofTone });
                } else {
                  // Hipped-roof house with independent wall color + 4-sided tiled hip roof color
                  hipHouses.push({ x: hx, y: hg + hh * 0.42 - 0.4, z: hz, w: hw, h: hh * 0.84, d: hd, rot, wallTone, roofTone });
                }
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
    const tmpCol = new THREE.Color();
    const emitInst = (items, geo, mat, getColorHex, cast = true, recv = true) => {
      if (!items.length) return;
      const inst = new THREE.InstancedMesh(geo, mat, items.length);
      for (let idx = 0; idx < items.length; idx++) {
        const b = items[idx];
        dummy.position.set(b.x, b.y, b.z);
        dummy.rotation.set(0, b.rot || 0, 0);
        dummy.scale.set(b.w, b.h, b.d);
        dummy.updateMatrix();
        inst.setMatrixAt(idx, dummy.matrix);
        if (getColorHex && typeof inst.setColorAt === 'function') {
          tmpCol.setHex(getColorHex(b));
          inst.setColorAt(idx, tmpCol);
        }
      }
      if (inst.instanceMatrix) inst.instanceMatrix.needsUpdate = true;
      if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
      inst.castShadow = cast;
      inst.receiveShadow = recv;
      group.add(inst);
    };

    // Dual-color Gabled Residential Houses (walls + overhanging tiled gable roofs)
    if (gableHouses.length) {
      emitInst(gableHouses, unitGableWallGeo, archHouseMat, h => h.wallTone, true, true);
      emitInst(gableHouses, unitGableRoofCapGeo, archPitchedRoofMat, h => h.roofTone, true, true);
    }
    // Dual-color Hipped Residential Houses (walls + 4-sided tiled hip roofs)
    if (hipHouses.length) {
      emitInst(hipHouses, unitBoxGeo, [archHouseMat, archHouseMat, archFlatRoofMat, archFlatRoofMat, archHouseMat, archHouseMat], h => h.wallTone, true, true);
      emitInst(hipHouses, unitHipRoofCapGeo, archPitchedRoofMat, h => h.roofTone, true, true);
    }
    // Flat-roofed Residential Villas (Middle East / arid / modern tropical)
    if (flatHouses.length) {
      emitInst(flatHouses, unitBoxGeo, [archHouseMat, archHouseMat, archFlatRoofMat, archFlatRoofMat, archHouseMat, archHouseMat], h => h.tone, true, true);
    }
    // Archetype 1: Warm Brick / Masonry Urban Apartments
    if (brickApts.length) {
      emitInst(brickApts, unitMidBoxGeo, [archBrickMat, archBrickMat, archFlatRoofMat, archFlatRoofMat, archBrickMat, archBrickMat], b => b.tone, true, true);
    }
    // Archetype 2: Contemporary Stucco / Balcony Condos
    if (condoApts.length) {
      emitInst(condoApts, unitMidBoxGeo, [archCondoMat, archCondoMat, archFlatRoofMat, archFlatRoofMat, archCondoMat, archCondoMat], b => b.tone, true, true);
    }
    // European Historic Mansard / Hipped Mid-Rise Roofs
    if (mansardRoofs.length) {
      emitInst(mansardRoofs, unitMansardRoofGeo, archPitchedRoofMat, b => b.tone, true, true);
    }
    // Archetype 4: Industrial / Logistics Corrugated Steel Warehouses
    if (warehouses.length) {
      emitInst(warehouses, unitBoxGeo, [archIndMat, archIndMat, archFlatRoofMat, archFlatRoofMat, archIndMat, archIndMat], b => b.tone, true, true);
    }
    // Archetype 0: Modern Glass Curtain-Wall Skyscrapers
    if (glassTowers.length) {
      emitInst(glassTowers, unitTallBoxGeo, [archGlassMat, archGlassMat, archFlatRoofMat, archFlatRoofMat, archGlassMat, archGlassMat], b => b.tone, true, true);
    }
    if (trees.length) {
      const tInst = new THREE.InstancedMesh(osmTreeGeo, treeMat, trees.length);
      for (let idx = 0; idx < trees.length; idx++) {
        const t = trees[idx];
        dummy.position.set(t.x, t.y, t.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(t.r, t.r * 0.85, t.r);
        dummy.updateMatrix();
        tInst.setMatrixAt(idx, dummy.matrix);
        if (typeof tInst.setColorAt === 'function') {
          tmpCol.setHex(t.color);
          tInst.setColorAt(idx, tmpCol);
        }
      }
      if (tInst.instanceMatrix) tInst.instanceMatrix.needsUpdate = true;
      if (tInst.instanceColor) tInst.instanceColor.needsUpdate = true;
      group.add(tInst);
    }
    if (lamps.length) {
      const lInst = new THREE.InstancedMesh(lampGeo, lampMat, lamps.length);
      for (let idx = 0; idx < lamps.length; idx++) {
        const l = lamps[idx];
        dummy.position.set(l.x, l.y, l.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        lInst.setMatrixAt(idx, dummy.matrix);
      }
      if (lInst.instanceMatrix) lInst.instanceMatrix.needsUpdate = true;
      group.add(lInst);
    }
    if (beacons.length) {
      const bInst = new THREE.InstancedMesh(beaconGeo, beaconMat, beacons.length);
      for (let idx = 0; idx < beacons.length; idx++) {
        const b = beacons[idx];
        dummy.position.set(b.x, b.y, b.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        bInst.setMatrixAt(idx, dummy.matrix);
      }
      if (bInst.instanceMatrix) bInst.instanceMatrix.needsUpdate = true;
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
        disposeGroup(oldVal);
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
    const cellHubInfo = cellCenter ? nearestHubInfo(cellCenter.x, cellCenter.z) : null;
    const biome = country?.biome || 'temperate';
    const regionCode = cellHubInfo?.region || (biome === 'arid' ? 'me' : biome === 'mediterranean' ? 'eu' : 'na');
    const pal = getRegionalPalette(country, regionCode, cellLat, cellLon);

    // 1. Extrude real OSM buildings across 5 PBR wall archetypes + 2 distinct roof meshes (<= 7 building draw calls/cell!)
    const makeBuf = () => ({ pos: [], nrm: [], uv: [], col: [] });
    const archBufs = [makeBuf(), makeBuf(), makeBuf(), makeBuf(), makeBuf()];
    const flatRoofBuf = makeBuf();
    const pitchedRoofBuf = makeBuf();
    const ARCH_KEYS = ['glass', 'brick', 'condo', 'house', 'ind'];
    const ARCH_UV_SCALE = [
      [16, 22], // 0: Glass curtain wall
      [15, 13], // 1: Brick / masonry urban apartment
      [16, 13], // 2: Contemporary stucco / balcony condo
      [11, 7.5], // 3: Residential clapboard / villa / townhouse
      [20, 10]  // 4: Industrial / logistics warehouse
    ];
    let bldgCount = 0;
    let cellMinX = 1e12, cellMaxX = -1e12, cellMinZ = 1e12, cellMaxZ = -1e12;

    const pushWallQuad = (buf, ax, az, bx, bz, yBot, yTop, nx, nz, uLen, vRep, rgb, botAo = 0.90) => {
      const rB = rgb[0] * botAo, gB = rgb[1] * botAo, bB = rgb[2] * botAo;
      const rT = rgb[0], gT = rgb[1], bT = rgb[2];
      buf.pos.push(ax, yBot, az, bx, yBot, bz, bx, yTop, bz, ax, yBot, az, bx, yTop, bz, ax, yTop, az);
      for (let k = 0; k < 6; k++) buf.nrm.push(nx, 0, nz);
      buf.col.push(rB, gB, bB, rB, gB, bB, rT, gT, bT, rB, gB, bB, rT, gT, bT, rT, gT, bT);
      buf.uv.push(0, 0, uLen, 0, uLen, vRep, 0, 0, uLen, vRep, 0, vRep);
    };

    const pushWallTri = (buf, ax, ay, az, bx, by, bz, cx, cy, cz, ex, ey, ez, u0, v0, u1, v1, u2, v2, rgb) => {
      pushOrientedTri(buf.pos, buf.nrm, buf.uv, buf.col, ax, ay, az, bx, by, bz, cx, cy, cz, u0, v0, u1, v1, u2, v2, ex, ey, ez, rgb[0], rgb[1], rgb[2]);
    };

    const pushFlatRoofTri = (p0x, p0z, p1x, p1z, p2x, p2z, yTop, rgb) => {
      flatRoofBuf.pos.push(p0x, yTop, p0z, p2x, yTop, p2z, p1x, yTop, p1z);
      flatRoofBuf.nrm.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
      flatRoofBuf.uv.push(p0x * 0.045, p0z * 0.045, p2x * 0.045, p2z * 0.045, p1x * 0.045, p1z * 0.045);
      for (let k = 0; k < 3; k++) flatRoofBuf.col.push(rgb[0], rgb[1], rgb[2]);
    };

    const pushPitchedTri = (ax, ay, az, bx, by, bz, cx, cy, cz, u0, v0, u1, v1, u2, v2, rgb) => {
      pushOrientedTri(pitchedRoofBuf.pos, pitchedRoofBuf.nrm, pitchedRoofBuf.uv, pitchedRoofBuf.col, ax, ay, az, bx, by, bz, cx, cy, cz, u0, v0, u1, v1, u2, v2, 0, 1, 0, rgb[0], rgb[1], rgb[2]);
    };

    const pushPenthouseBox = (buf, cx, cz, hx, hz, yBot, yTop, wallRgb, roofRgb) => {
      const x0 = cx - hx, x1 = cx + hx, z0 = cz - hz, z1 = cz + hz;
      const vRep = Math.max(0.5, (yTop - yBot) / 10);
      const uX = Math.max(0.5, (hx * 2) / 12), uZ = Math.max(0.5, (hz * 2) / 12);
      pushWallQuad(buf, x0, z1, x1, z1, yBot, yTop, 0, 1, uX, vRep, wallRgb, 0.94);
      pushWallQuad(buf, x1, z0, x0, z0, yBot, yTop, 0, -1, uX, vRep, wallRgb, 0.94);
      pushWallQuad(buf, x1, z1, x1, z0, yBot, yTop, 1, 0, uZ, vRep, wallRgb, 0.94);
      pushWallQuad(buf, x0, z0, x0, z1, yBot, yTop, -1, 0, uZ, vRep, wallRgb, 0.94);
      pushFlatRoofTri(x0, z0, x0, z1, x1, z1, yTop, roofRgb);
      pushFlatRoofTri(x0, z0, x1, z1, x1, z0, yTop, roofRgb);
    };

    const classifyOsmArchetype = (bType, matTag, bh, footArea, hVal) => {
      if (
        /^(industrial|warehouse|factory|hangar|manufacture|storage_tank|shed|barn|farm_auxiliary|service)$/.test(bType) ||
        /^(metal|steel|corrugated|sheet_metal)$/.test(matTag) ||
        (bType === 'retail' && footArea > 1100 && bh <= 14) ||
        (footArea > 1800 && bh <= 13 && !/apartments|hotel|residential|house|school|church|cathedral/.test(bType))
      ) return 4; // Industrial / Logistics Warehouse
      if (
        matTag === 'glass' || matTag === 'mirror' || bType === 'skyscraper' ||
        (bh >= 38 && (!pal.historicLowRise || bh >= 54)) ||
        (bType === 'office' && bh >= 16) ||
        ((bType === 'commercial' || bType === 'hotel') && bh >= 24 && hVal < 0.72)
      ) return 0; // Modern Glass Curtain-Wall Tower
      if (
        /^(house|detached|semidetached_house|terrace|bungalow|villa|cabin|farm|chalet)$/.test(bType) ||
        (bType === 'residential' && bh <= 12.5 && footArea < 440) ||
        (bType === 'yes' && bh <= 11.5 && footArea < 340)
      ) return 3; // Residential Clapboard / Villa / Townhouse
      if (/^(brick|stone|sandstone|limestone|masonry|marble|granite|wood|timber_framing)$/.test(matTag)) return 1;
      if (/^(concrete|plaster|stucco|cement_block|panel|prefab)$/.test(matTag)) return 2;
      return hVal < pal.brickBias ? 1 : 2;
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

      // Signed area to ensure consistent outward wall normals (sArea > 0 => CW in XZ, outward normal = (dz, 0, -dx))
      let sArea = 0;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        sArea += a.x * b.z - b.x * a.z;
      }
      const footArea = Math.abs(sArea) * 0.5;
      if (footArea < 6) continue;
      if (sArea < 0) pts.reverse();

      const tags = w.tags || {};
      const bType = typeof tags.building === 'string' ? tags.building.trim().toLowerCase() : 'yes';
      const rawH = typeof tags.height === 'string' ? parseFloat(tags.height.replace(/[^\d.+-]/g, '')) : parseFloat(tags.height);
      const rawLevels = parseFloat(tags['building:levels']);
      const parsedH = (Number.isFinite(rawH) && rawH > 0) ? rawH : (Number.isFinite(rawLevels) && rawLevels > 0 ? rawLevels * 3.5 : 0);
      const bSeed = Math.abs(Math.floor(cx * 3.1 + cz * 5.7)) + wi * 13 + 7;
      const hVal = hash2(bSeed, wi * 7.3 + 1.9);
      const defaultH = bType === 'apartments' || bType === 'commercial' ? (16 + hVal * 10)
        : bType === 'office' ? (24 + hVal * 18)
        : /^(house|detached|semidetached_house|bungalow|villa|terrace)$/.test(bType) ? (6.8 + hVal * 3.6)
        : /^(industrial|warehouse|factory|retail)$/.test(bType) ? (8.5 + hVal * 4.5)
        : (footArea < 240 ? (7.4 + hVal * 3.4) : (11.0 + hVal * 6.5));
      const bh = parsedH > 2.5 ? Math.min(420, parsedH) : defaultH;
      const y0 = gy - 1.5, y1 = gy + bh;
      const matTag = typeof tags['building:material'] === 'string' ? tags['building:material'].trim().toLowerCase() : '';
      const archIdx = classifyOsmArchetype(bType, matTag, bh, footArea, hVal);
      const archBuf = archBufs[archIdx];

      // Determine whether this building gets a 3D pitched / hipped roof
      const roofShape = typeof tags['roof:shape'] === 'string' ? tags['roof:shape'].trim().toLowerCase() : '';
      const explicitPitched = /^(gabled|hipped|pyramidal|half-hipped|mansard|skillion|saltbox|gambrel)$/.test(roofShape);
      const allowLowRisePitch = roofShape !== 'flat' && archIdx !== 0 && archIdx !== 4 && bh <= 11.5 && footArea >= 18 && footArea <= 560 &&
        (archIdx === 3 || /^(house|detached|semidetached_house|terrace|bungalow|villa|residential|yes)$/.test(bType)) &&
        hash2(bSeed, 43.1) < pal.pitchedChance;
      const allowEuroMidPitch = roofShape !== 'flat' && pal.historicLowRise && archIdx === 1 && bh > 11.5 && bh <= 22 && footArea <= 900 &&
        hash2(bSeed, 59.3) < 0.52;
      const wantsPitchedRoof = explicitPitched || allowLowRisePitch || allowEuroMidPitch;

      // Resolve realistic per-building wall & roof RGB colors (explicit OSM tags take priority 1:1; else rich regional palette + HSL jitter!)
      const rawWallColor = tags['building:colour'] || tags['building:color'];
      let wallRgb;
      if (typeof rawWallColor === 'string' && rawWallColor.trim()) {
        wallRgb = parseOsmColor(rawWallColor, hexToRgb01(pal[ARCH_KEYS[archIdx]][0]));
      } else {
        const palArr = pal[ARCH_KEYS[archIdx]] || pal.brick;
        let baseRgb = hexToRgb01(palArr[bSeed % palArr.length]);
        const matNorm = matTag.replace(/[\s_-]+/g, '');
        if (matNorm && OSM_NAMED_COLORS[matNorm]) {
          const mRgb = OSM_NAMED_COLORS[matNorm];
          baseRgb = [baseRgb[0] * 0.45 + mRgb[0] * 0.55, baseRgb[1] * 0.45 + mRgb[1] * 0.55, baseRgb[2] * 0.45 + mRgb[2] * 0.55];
        }
        wallRgb = jitterRgbHsl(baseRgb, bSeed, 0.028, 0.11, 0.095);
      }

      const rawRoofColor = tags['roof:colour'] || tags['roof:color'];
      let roofRgb;
      if (typeof rawRoofColor === 'string' && rawRoofColor.trim()) {
        roofRgb = parseOsmColor(rawRoofColor, hexToRgb01(pal.flatRoof[0]));
      } else {
        const roofPalArr = wantsPitchedRoof ? pal.pitchedRoof : pal.flatRoof;
        roofRgb = jitterRgbHsl(hexToRgb01(roofPalArr[(bSeed + 5) % roofPalArr.length]), bSeed + 17, 0.024, 0.10, 0.09);
      }

      const [uScale, vScale] = ARCH_UV_SCALE[archIdx];
      const vRepeat = Math.max(0.65, bh / vScale);

      // Properly front-facing outward walls (sArea > 0 => emit edge b -> a so (b, a, aTop) faces outward (dz, 0, -dx)!)
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        if (a.x < cellMinX) cellMinX = a.x; if (a.x > cellMaxX) cellMaxX = a.x;
        if (a.z < cellMinZ) cellMinZ = a.z; if (a.z > cellMaxZ) cellMaxZ = a.z;
        const dx = b.x - a.x, dz = b.z - a.z;
        const len = Math.hypot(dx, dz);
        if (len < 0.4) continue;
        const nx = dz / len, nz = -dx / len;
        const uLen = Math.max(0.45, len / uScale);
        pushWallQuad(archBuf, b.x, b.z, a.x, a.z, y0, y1, nx, nz, uLen, vRepeat, wallRgb, archIdx === 0 ? 0.94 : 0.89);
      }

      // Roof generation: 3D Gabled / Hipped / Pyramidal pitched roof OR triangulated flat roof
      let builtPitched = false;
      if (wantsPitchedRoof && pointInPolyXZ(cx, cz, pts)) {
        const rawRoofH = typeof tags['roof:height'] === 'string' ? parseFloat(tags['roof:height'].replace(/[^\d.+-]/g, '')) : parseFloat(tags['roof:height']);
        const spanMin = Math.min(maxX - minX, maxZ - minZ);
        const roofH = (Number.isFinite(rawRoofH) && rawRoofH > 0.8 && rawRoofH < 14)
          ? rawRoofH
          : Math.min(4.8, Math.max(1.7, spanMin * (bh > 11.5 ? 0.20 : 0.25)));
        const yPeak = y1 + roofH;

        if (pts.length === 4) {
          // Oriented 4-point Gabled or Hipped roof aligned to the building's true long axis!
          const l01 = Math.hypot(pts[1].x - pts[0].x, pts[1].z - pts[0].z);
          const l12 = Math.hypot(pts[2].x - pts[1].x, pts[2].z - pts[1].z);
          // Reorder (q0,q1,q2,q3) so q0->q1 and q2->q3 are the LONG eaves edges
          const q = l01 >= l12 ? [pts[0], pts[1], pts[2], pts[3]] : [pts[1], pts[2], pts[3], pts[0]];
          const longLen = Math.max(l01, l12), shortLen = Math.min(l01, l12);
          const mAx = (q[0].x + q[3].x) * 0.5, mAz = (q[0].z + q[3].z) * 0.5;
          const mBx = (q[1].x + q[2].x) * 0.5, mBz = (q[1].z + q[2].z) * 0.5;
          const isGabled = roofShape === 'gabled' || (roofShape !== 'hipped' && roofShape !== 'pyramidal' && roofShape !== 'mansard' && (bSeed & 1) === 0 && bh <= 11.5);
          const uLong = Math.max(0.6, longLen / 6.5);
          const vSlope = Math.max(0.6, Math.hypot(shortLen * 0.5, roofH) / 4.5);

          if (isGabled) {
            // 2 sloped roof planes into pitchedRoofBuf
            pushPitchedTri(q[0].x, y1, q[0].z, q[1].x, y1, q[1].z, mBx, yPeak, mBz, 0, 0, uLong, 0, uLong, vSlope, roofRgb);
            pushPitchedTri(q[0].x, y1, q[0].z, mBx, yPeak, mBz, mAx, yPeak, mAz, 0, 0, uLong, vSlope, 0, vSlope, roofRgb);
            pushPitchedTri(q[2].x, y1, q[2].z, q[3].x, y1, q[3].z, mAx, yPeak, mAz, 0, 0, uLong, 0, uLong, vSlope, roofRgb);
            pushPitchedTri(q[2].x, y1, q[2].z, mAx, yPeak, mAz, mBx, yPeak, mBz, 0, 0, uLong, vSlope, 0, vSlope, roofRgb);
            // 2 matching gable-end wall triangles into the building's wall archetype buffer
            const gAdx = q[0].x - q[3].x, gAdz = q[0].z - q[3].z, gAl = Math.hypot(gAdx, gAdz) || 1;
            pushWallTri(archBuf, q[0].x, y1, q[0].z, q[3].x, y1, q[3].z, mAx, yPeak, mAz, gAdz / gAl, 0, -gAdx / gAl, 0, 0.7, gAl / uScale, 0.7, gAl / (uScale * 2), 1, wallRgb);
            const gBdx = q[2].x - q[1].x, gBdz = q[2].z - q[1].z, gBl = Math.hypot(gBdx, gBdz) || 1;
            pushWallTri(archBuf, q[2].x, y1, q[2].z, q[1].x, y1, q[1].z, mBx, yPeak, mBz, gBdz / gBl, 0, -gBdx / gBl, 0, 0.7, gBl / uScale, 0.7, gBl / (uScale * 2), 1, wallRgb);
            builtPitched = true;
          } else {
            // 4-sided Hipped / Mansard roof with inset ridge
            const inset = Math.min(0.36, (shortLen * 0.44) / (longLen || 1));
            const rAx = mAx + (mBx - mAx) * inset, rAz = mAz + (mBz - mAz) * inset;
            const rBx = mBx + (mAx - mBx) * inset, rBz = mBz + (mAz - mBz) * inset;
            const uShort = Math.max(0.5, shortLen / 6.5);
            pushPitchedTri(q[0].x, y1, q[0].z, q[1].x, y1, q[1].z, rBx, yPeak, rBz, 0, 0, uLong, 0, uLong * (1 - inset), vSlope, roofRgb);
            pushPitchedTri(q[0].x, y1, q[0].z, rBx, yPeak, rBz, rAx, yPeak, rAz, 0, 0, uLong * (1 - inset), vSlope, uLong * inset, vSlope, roofRgb);
            pushPitchedTri(q[2].x, y1, q[2].z, q[3].x, y1, q[3].z, rAx, yPeak, rAz, 0, 0, uLong, 0, uLong * (1 - inset), vSlope, roofRgb);
            pushPitchedTri(q[2].x, y1, q[2].z, rAx, yPeak, rAz, rBx, yPeak, rBz, 0, 0, uLong * (1 - inset), vSlope, uLong * inset, vSlope, roofRgb);
            pushPitchedTri(q[3].x, y1, q[3].z, q[0].x, y1, q[0].z, rAx, yPeak, rAz, 0, 0, uShort, 0, uShort * 0.5, vSlope, roofRgb);
            pushPitchedTri(q[1].x, y1, q[1].z, q[2].x, y1, q[2].z, rBx, yPeak, rBz, 0, 0, uShort, 0, uShort * 0.5, vSlope, roofRgb);
            builtPitched = true;
          }
        } else if (pts.length <= 10) {
          // General convex/near-convex polygon -> Pyramidal / Hipped roof fanning perimeter edges up to centroid peak
          let allConvex = true;
          for (let i = 0; i < pts.length; i++) {
            const a = pts[i], b = pts[(i + 1) % pts.length];
            const cross = (b.x - a.x) * (cz - a.z) - (b.z - a.z) * (cx - a.x);
            if (cross <= 1e-4) { allConvex = false; break; }
          }
          if (allConvex) {
            for (let i = 0; i < pts.length; i++) {
              const a = pts[i], b = pts[(i + 1) % pts.length];
              const edgeLen = Math.hypot(b.x - a.x, b.z - a.z);
              const mx = (a.x + b.x) * 0.5, mz = (a.z + b.z) * 0.5;
              const slopeLen = Math.hypot(cx - mx, cz - mz, roofH);
              pushPitchedTri(a.x, y1, a.z, b.x, y1, b.z, cx, yPeak, cz, 0, 0, Math.max(0.4, edgeLen / 6.5), 0, Math.max(0.2, edgeLen / 13), Math.max(0.5, slopeLen / 4.5), roofRgb);
            }
            builtPitched = true;
          }
        }
      }

      if (!builtPitched) {
        // Exact triangulated flat roof polygon into flatRoofBuf
        const tris = triangulatePolyXZ(pts);
        let bestTriArea = -1, bestTriCx = cx, bestTriCz = cz;
        for (let t = 0; t < tris.length; t += 3) {
          const p0 = pts[tris[t]], p1 = pts[tris[t + 1]], p2 = pts[tris[t + 2]];
          pushFlatRoofTri(p0.x, p0.z, p1.x, p1.z, p2.x, p2.z, y1, roofRgb);
          const ta = Math.abs((p1.x - p0.x) * (p2.z - p0.z) - (p2.x - p0.x) * (p1.z - p0.z)) * 0.5;
          if (ta > bestTriArea) {
            bestTriArea = ta;
            bestTriCx = (p0.x + p1.x + p2.x) / 3;
            bestTriCz = (p0.z + p1.z + p2.z) / 3;
          }
        }

        // 3D Rooftop Penthouses / Stepped Setback Crowns + Parapet Rim on mid/high-rise buildings (h >= 24m)
        if (bh >= 24) {
          const parapetH = Math.min(2.2, 0.85 + bh * 0.012);
          const rimRgb = [wallRgb[0] * 0.86, wallRgb[1] * 0.86, wallRgb[2] * 0.86];
          for (let i = 0; i < pts.length; i++) {
            const a = pts[i], b = pts[(i + 1) % pts.length];
            const dx = b.x - a.x, dz = b.z - a.z;
            const len = Math.hypot(dx, dz);
            if (len < 0.6) continue;
            const nx = dz / len, nz = -dx / len;
            pushWallQuad(archBuf, b.x, b.z, a.x, a.z, y1, y1 + parapetH, nx, nz, Math.max(0.4, len / uScale), 0.25, rimRgb, 0.96);
          }

          const anchorX = pointInPolyXZ(cx, cz, pts) ? cx : bestTriCx;
          const anchorZ = pointInPolyXZ(cx, cz, pts) ? cz : bestTriCz;
          let hx = Math.min(18, Math.max(2.4, (maxX - minX) * (archIdx === 0 ? 0.28 : 0.22)));
          let hz = Math.min(18, Math.max(2.4, (maxZ - minZ) * (archIdx === 0 ? 0.28 : 0.22)));
          const fitsInRoof = (ox, oz) =>
            pointInPolyXZ(anchorX - ox, anchorZ - oz, pts) &&
            pointInPolyXZ(anchorX + ox, anchorZ - oz, pts) &&
            pointInPolyXZ(anchorX + ox, anchorZ + oz, pts) &&
            pointInPolyXZ(anchorX - ox, anchorZ + oz, pts);
          if (!fitsInRoof(hx, hz)) { hx *= 0.58; hz *= 0.58; }
          if (hx >= 1.6 && hz >= 1.6 && fitsInRoof(hx, hz)) {
            const pentBuf = archIdx === 0 ? archBufs[0] : archBufs[2];
            const pentH = Math.min(12.5, Math.max(2.8, bh * (archIdx === 0 ? 0.11 : 0.068)));
            const pentWallRgb = archIdx === 0
              ? [wallRgb[0] * 0.94, wallRgb[1] * 0.94, wallRgb[2] * 0.94]
              : [roofRgb[0] * 0.90, roofRgb[1] * 0.90, roofRgb[2] * 0.90];
            const pentRoofRgb = [roofRgb[0] * 0.94, roofRgb[1] * 0.94, roofRgb[2] * 0.94];
            pushPenthouseBox(pentBuf, anchorX, anchorZ, hx, hz, y1, y1 + pentH, pentWallRgb, pentRoofRgb);
            if (bh >= 52 && hx >= 2.8 && hz >= 2.8) {
              // Stepped upper crown setback tier for tall towers
              const crownH = Math.min(10, Math.max(3.2, pentH * 0.72));
              pushPenthouseBox(pentBuf, anchorX, anchorZ, hx * 0.56, hz * 0.56, y1 + pentH, y1 + pentH + crownH, rimRgb, pentRoofRgb);
            }
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

    const ARCH_MESH_NAMES = ['OSM_Glass_', 'OSM_Brick_', 'OSM_Condo_', 'OSM_House_', 'OSM_Ind_'];
    for (let ai = 0; ai < archBufs.length; ai++) {
      const ab = archBufs[ai];
      makeMerged(ab.pos, ab.nrm, ab.uv, ab.col, ARCH_WALL_MATS[ai], ARCH_MESH_NAMES[ai] + cellKey, true, true);
    }
    makeMerged(flatRoofBuf.pos, flatRoofBuf.nrm, flatRoofBuf.uv, flatRoofBuf.col, archFlatRoofMat, 'OSM_FlatRoofs_' + cellKey, true, true);
    makeMerged(pitchedRoofBuf.pos, pitchedRoofBuf.nrm, pitchedRoofBuf.uv, pitchedRoofBuf.col, archPitchedRoofMat, 'OSM_PitchedRoofs_' + cellKey, true, true);
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
    liveOsmCells.delete(cellKey);
    liveOsmCells.set(cellKey, g);
    if (bldgCount && cellMinX < cellMaxX) {
      const oldBoxIdx = liveOsmBoxes.findIndex(b => b.key === cellKey);
      if (oldBoxIdx >= 0) liveOsmBoxes.splice(oldBoxIdx, 1);
      liveOsmBoxes.push({ key: cellKey, minX: cellMinX - 35, maxX: cellMaxX + 35, minZ: cellMinZ - 35, maxZ: cellMaxZ + 35 });
      liveOsmRevision++;
    }
    evictOldOsmCells();
    return g;
  }

  // Zero-stutter OSM build queue: process at most 1 queued OSM cell per frame, closest-first & frame-budgeted!
  const osmBuildQueue = [];
  const osmQueuedKeys = new Set();

  function processNextQueuedOsmCell(px, pz, tStart, budgetMs) {
    if (!osmBuildQueue.length) return false;
    if ((nowMs() - tStart) >= budgetMs) return false;
    let bestIdx = 0;
    let bestD2 = Infinity;
    for (let i = 0; i < osmBuildQueue.length; i++) {
      const q = osmBuildQueue[i];
      const dx = q.x - px, dz = q.z - pz;
      const d2 = dx * dx + dz * dz;
      if (d2 < bestD2) {
        bestD2 = d2;
        bestIdx = i;
      }
    }
    const item = osmBuildQueue.splice(bestIdx, 1)[0];
    if (!item) return false;
    osmQueuedKeys.delete(item.cellKey);
    buildOsmCellFromData(item.cellKey, item.data, item.cellLat, item.cellLon, item.maxWays);
    return true;
  }

  function streamLiveOsmBuildings(px, pz) {
    if (typeof fetch !== 'function' || typeof window === 'undefined' || typeof latLon !== 'function' || typeof geoPoint !== 'function') return;
    const now = nowMs();
    if (liveOsmBusy || osmBuildQueue.length >= 2 || now - lastOsmCheck < (isLowMem ? 4500 : 2800)) return;
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
        if (!data || !Array.isArray(data.elements)) {
          liveOsmCells.set(cellKey, 'empty');
          evictOldOsmCells();
          return;
        }
        const midLat = clat + step * 0.5;
        const midLon = clon + step * 0.5;
        const pt = geoPoint(midLat, midLon) || { x: px, z: pz };
        if (!osmQueuedKeys.has(cellKey)) {
          osmQueuedKeys.add(cellKey);
          osmBuildQueue.push({ cellKey, data, cellLat: midLat, cellLon: midLon, maxWays, x: pt.x, z: pt.z });
          while (osmBuildQueue.length > 3) {
            const dropped = osmBuildQueue.shift();
            if (dropped) {
              osmQueuedKeys.delete(dropped.cellKey);
              if (liveOsmCells.get(dropped.cellKey) === 'loading') liveOsmCells.delete(dropped.cellKey);
            }
          }
        }
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
      const hubCountry = typeof WorldAtlas !== 'undefined' ? WorldAtlas.countryAt(lon, lat) : null;
      const hubPal = getRegionalPalette(hubCountry, a.region, lat, lon);
      const towers = [];
      const brickPodiums = [];
      const condoPodiums = [];
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
        const tSeed = i * 197 + k * 23 + 11;
        const glassTone = jitterHex(hubPal.glass[k % hubPal.glass.length], tSeed);
        const crownTone = jitterHex(glassTone, tSeed + 5, 0.015, 0.06, 0.06);
        const useBrickPod = hash2(tSeed, 17.3) < hubPal.brickBias;
        const podTone = jitterHex((useBrickPod ? hubPal.brick : hubPal.condo)[k % (useBrickPod ? hubPal.brick : hubPal.condo).length], tSeed + 3);
        // Street-level masonry / stucco podium
        const podH = Math.min(18, h * 0.20);
        (useBrickPod ? brickPodiums : condoPodiums).push({ x: tx, y: tGround + podH * 0.5 - 1, z: tz, w: w * 1.24, h: podH, d: d * 1.24, tone: podTone });
        // Main glass curtain-wall shaft
        towers.push({ x: tx, y: tGround + h * 0.5 - 1, z: tz, w, h, d, tone: glassTone });
        // Setback upper tier
        const tierH = h * 0.22;
        towers.push({ x: tx, y: tGround + h + tierH * 0.5 - 1.5, z: tz, w: w * 0.64, h: tierH, d: d * 0.64, tone: crownTone });
        if (k < 10) {
          const spireH = h * 0.15;
          towers.push({ x: tx, y: tGround + h + tierH + spireH * 0.5 - 2, z: tz, w: w * 0.16, h: spireH, d: d * 0.16, tone: crownTone });
          bcnPts.push({ x: tx, y: tGround + h + tierH + spireH + 1.2, z: tz });
        } else if (h > 95) {
          bcnPts.push({ x: tx, y: tGround + h + tierH + 1.2, z: tz });
        }
      }
      const dummy = new THREE.Object3D();
      const tmpCol = new THREE.Color();
      const addHubInst = (items, geo, mat) => {
        if (!items.length) return;
        const inst = new THREE.InstancedMesh(geo, mat, items.length);
        for (let idx = 0; idx < items.length; idx++) {
          const t = items[idx];
          dummy.position.set(t.x, t.y, t.z);
          dummy.rotation.set(0, 0, 0);
          dummy.scale.set(t.w, t.h, t.d);
          dummy.updateMatrix();
          inst.setMatrixAt(idx, dummy.matrix);
          if (t.tone && typeof inst.setColorAt === 'function') {
            tmpCol.setHex(t.tone);
            inst.setColorAt(idx, tmpCol);
          }
        }
        if (inst.instanceMatrix) inst.instanceMatrix.needsUpdate = true;
        if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
        inst.castShadow = inst.receiveShadow = true;
        g.add(inst);
      };
      addHubInst(brickPodiums, unitMidBoxGeo, [archBrickMat, archBrickMat, archFlatRoofMat, archFlatRoofMat, archBrickMat, archBrickMat]);
      addHubInst(condoPodiums, unitMidBoxGeo, [archCondoMat, archCondoMat, archFlatRoofMat, archFlatRoofMat, archCondoMat, archCondoMat]);
      addHubInst(towers, unitTallBoxGeo, [archGlassMat, archGlassMat, archFlatRoofMat, archFlatRoofMat, archGlassMat, archGlassMat]);
      if (bcnPts.length) {
        const bInst = new THREE.InstancedMesh(new THREE.SphereGeometry(1.2, 8, 6), beaconMat, bcnPts.length);
        bcnPts.forEach((b, idx) => {
          dummy.position.set(b.x, b.y, b.z);
          dummy.rotation.set(0, 0, 0);
          dummy.scale.set(1, 1, 1);
          dummy.updateMatrix();
          bInst.setMatrixAt(idx, dummy.matrix);
        });
        if (bInst.instanceMatrix) bInst.instanceMatrix.needsUpdate = true;
        g.add(bInst);
      }
      root.add(g);
    }
  }

  // WorldCitiesCatalog 360+ City Downtown CBD Skyline Streamer (throttled >3 km movement, bounded LRU)
  const cityCbdGroups = new Map();
  const MAX_CITY_CBDS = isLowMem ? 4 : 10;
  let lastCitySkylineX = 1e12;
  let lastCitySkylineZ = 1e12;

  function ensureCitySkyline(px, pz) {
    const wcc = getWorldCitiesCatalog();
    if (!wcc || typeof wcc.citiesWithin !== 'function') return;
    if (Math.hypot(px - lastCitySkylineX, pz - lastCitySkylineZ) < 3000) return;
    lastCitySkylineX = px;
    lastCitySkylineZ = pz;

    const nearby = wcc.citiesWithin(px, pz, 45000);
    if (!Array.isArray(nearby) || !nearby.length) return;
    const osmCity = typeof window !== 'undefined' ? window.__SKYBOUND_WORLD_CITY : null;

    for (let i = 0; i < nearby.length; i++) {
      const rec = resolveCityRecord(nearby[i], px, pz);
      if (!rec) continue;
      if (cityCbdGroups.has(rec.id)) {
        // Touch LRU order so active approached cities remain cached
        const existingGrp = cityCbdGroups.get(rec.id);
        cityCbdGroups.delete(rec.id);
        cityCbdGroups.set(rec.id, existingGrp);
        continue;
      }
      if (Number.isFinite(rec.lat) && Number.isFinite(rec.lon)) {
        if (insideTaiwanDetailed(rec.lat, rec.lon)) continue;
        if (osmCity && typeof osmCity.inside === 'function' && osmCity.inside(rec.lat, rec.lon)) continue;
      }
      if (osmCity && typeof osmCity.blocked === 'function' && osmCity.blocked(rec.x, rec.z)) continue;
      if (inAirportClearance(rec.x, rec.z, 420)) continue;

      // Skip if an existing airport synthetic CBD hub skyline is right on top of this GPS city center
      let overlapsHubCbd = false;
      for (let ai = 0; ai < airports.length; ai++) {
        const a = airports[ai];
        if (!a || a.shortField || a.carrier || !hubLandmarksAdded.has(a.code)) continue;
        const side = Math.sign(a.apron || 1);
        const hbx = a.x + Math.cos(a.heading) * (side * 3400);
        const hbz = a.z + Math.sin(a.heading) * (side * 3400);
        if (Math.hypot(rec.x - hbx, rec.z - hbz) < 1100) { overlapsHubCbd = true; break; }
      }
      if (overlapsHubCbd) continue;

      const gy = ground(rec.x, rec.z);
      if (gy < 0.8) continue;

      const cCountry = (typeof WorldAtlas !== 'undefined' && Number.isFinite(rec.lat) && Number.isFinite(rec.lon))
        ? WorldAtlas.countryAt(rec.lon, rec.lat) : null;
      const cPal = getRegionalPalette(cCountry, rec.region, rec.lat, rec.lon);
      const isHistoric = Boolean(cPal.historicLowRise || rec.historic);
      const isMiddleEast = cPal.id === 'middle_east';

      const baseFlagship = rec.tier === 1
        ? (isHistoric ? 92 : isMiddleEast ? 275 : 235)
        : rec.tier === 2
          ? (isHistoric ? 68 : isMiddleEast ? 195 : 165)
          : (isHistoric ? 46 : 118);
      const flagshipH = (Number.isFinite(rec.skylineH) && rec.skylineH > 20)
        ? Math.min(340, Math.max(32, rec.skylineH))
        : baseFlagship;

      const totalTowers = rec.tier === 1
        ? (isLowMem ? 18 : 30)
        : rec.tier === 2
          ? (isLowMem ? 14 : 22)
          : (isLowMem ? 10 : 16);

      // Deterministic integer seed from city id
      let idHash = 17;
      for (let ch = 0; ch < rec.id.length; ch++) idHash = (idHash * 31 + rec.id.charCodeAt(ch)) & 0x7fffffff;

      const towers = [];
      const brickPodiums = [];
      const condoPodiums = [];
      const mansardCaps = [];
      const bcnPts = [];

      for (let k = 0; k < totalTowers; k++) {
        const ring = Math.floor(k / 7);
        const angle = ((k % 7) / 7) * Math.PI * 2 + ring * 0.48 + (idHash % 19) * 0.17;
        const radius = (k === 0 ? 18 : 78 + ring * 125 + (k % 3) * 34);
        const tx = rec.x + Math.cos(angle) * radius;
        const tz = rec.z + Math.sin(angle) * radius;
        if (inAirportClearance(tx, tz, 360)) continue;
        if (osmCity && typeof osmCity.blocked === 'function' && osmCity.blocked(tx, tz)) continue;
        const tGround = ground(tx, tz);
        if (tGround < 0.8) continue;

        const distDecay = Math.max(0.32, 1 - ring * 0.22);
        const tSeed = idHash * 13 + k * 29 + 7;
        const hRaw = flagshipH * distDecay * (0.48 + hash2(k * 13 + idHash * 0.01, ring * 7 + 3) * 0.52);
        const h = Math.max(isHistoric ? 20 : 34, hRaw);
        const w = 20 + (k % 4) * 5;
        const d = 20 + ((k + 2) % 4) * 5;
        const rot = ((idHash + k) & 1) ? 0 : Math.PI * 0.25;
        const useBrickPod = hash2(tSeed, 17.3) < cPal.brickBias;
        const podArr = useBrickPod ? cPal.brick : cPal.condo;
        const podTone = jitterHex(podArr[(k + idHash) % podArr.length], tSeed + 3);

        // Historic European/Mediterranean cores stay mostly classic limestone/brick + mansard roofs, with selective modern business towers
        const buildGlassTower = !isHistoric || (h > 50 && k % 3 === 0);
        if (buildGlassTower) {
          const glassTone = jitterHex(cPal.glass[(k + idHash) % cPal.glass.length], tSeed);
          const crownTone = jitterHex(glassTone, tSeed + 5, 0.015, 0.06, 0.06);
          const podH = Math.min(16, h * 0.22);
          (useBrickPod ? brickPodiums : condoPodiums).push({ x: tx, y: tGround + podH * 0.5 - 1, z: tz, w: w * 1.22, h: podH, d: d * 1.22, rot, tone: podTone });
          towers.push({ x: tx, y: tGround + h * 0.5 - 1, z: tz, w, h, d, rot, tone: glassTone });
          // Stepped crown tier
          const tierH = h * 0.20;
          towers.push({ x: tx, y: tGround + h + tierH * 0.5 - 1.5, z: tz, w: w * 0.64, h: tierH, d: d * 0.64, rot, tone: crownTone });
          if (k < 6 && h > 75) {
            const spireH = h * 0.14;
            towers.push({ x: tx, y: tGround + h + tierH + spireH * 0.5 - 2, z: tz, w: w * 0.16, h: spireH, d: d * 0.16, rot, tone: crownTone });
            bcnPts.push({ x: tx, y: tGround + h + tierH + spireH + 1.2, z: tz });
          } else if (h > 92) {
            bcnPts.push({ x: tx, y: tGround + h + tierH + 1.2, z: tz });
          }
        } else {
          (useBrickPod ? brickPodiums : condoPodiums).push({ x: tx, y: tGround + h * 0.5 - 1, z: tz, w: w * 1.15, h, d: d * 1.15, rot, tone: podTone });
          if (hash2(tSeed, 41.9) < 0.78) {
            const roofTone = jitterHex(cPal.pitchedRoof[(k + idHash) % cPal.pitchedRoof.length], tSeed + 11);
            mansardCaps.push({ x: tx, y: tGround + h * 0.5 - 1, z: tz, w: w * 1.15, h, d: d * 1.15, rot, tone: roofTone });
          }
        }
      }

      if (!towers.length && !brickPodiums.length && !condoPodiums.length) continue;

      const g = new THREE.Group();
      g.name = 'CityCBD_' + rec.id;
      const dummy = new THREE.Object3D();
      const tmpCol = new THREE.Color();
      const addCbdInst = (items, geo, mat) => {
        if (!items.length) return;
        const inst = new THREE.InstancedMesh(geo, mat, items.length);
        for (let idx = 0; idx < items.length; idx++) {
          const t = items[idx];
          dummy.position.set(t.x, t.y, t.z);
          dummy.rotation.set(0, t.rot || 0, 0);
          dummy.scale.set(t.w, t.h, t.d);
          dummy.updateMatrix();
          inst.setMatrixAt(idx, dummy.matrix);
          if (t.tone && typeof inst.setColorAt === 'function') {
            tmpCol.setHex(t.tone);
            inst.setColorAt(idx, tmpCol);
          }
        }
        if (inst.instanceMatrix) inst.instanceMatrix.needsUpdate = true;
        if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
        inst.castShadow = !isLowMem;
        inst.receiveShadow = true;
        g.add(inst);
      };

      addCbdInst(brickPodiums, unitLod1BoxGeo, [archBrickMat, archFlatRoofMat]);
      addCbdInst(condoPodiums, unitLod1BoxGeo, [archCondoMat, archFlatRoofMat]);
      addCbdInst(towers, unitLod1TallGeo, [archGlassMat, archFlatRoofMat]);
      if (mansardCaps.length) addCbdInst(mansardCaps, unitMansardRoofGeo, archPitchedRoofMat);
      if (bcnPts.length) {
        const bInst = new THREE.InstancedMesh(beaconGeo, beaconMat, bcnPts.length);
        for (let idx = 0; idx < bcnPts.length; idx++) {
          const b = bcnPts[idx];
          dummy.position.set(b.x, b.y, b.z);
          dummy.rotation.set(0, 0, 0);
          dummy.scale.set(1.15, 1.15, 1.15);
          dummy.updateMatrix();
          bInst.setMatrixAt(idx, dummy.matrix);
        }
        if (bInst.instanceMatrix) bInst.instanceMatrix.needsUpdate = true;
        g.add(bInst);
      }

      root.add(g);
      cityCbdGroups.set(rec.id, g);
    }

    // Strict LRU cap so round-the-world flights never leak city CBD memory
    while (cityCbdGroups.size > MAX_CITY_CBDS) {
      const oldId = cityCbdGroups.keys().next().value;
      const oldGrp = cityCbdGroups.get(oldId);
      disposeGroup(oldGrp);
      cityCbdGroups.delete(oldId);
    }
  }

  let lastUpdatePx = NaN;
  let lastUpdatePz = NaN;
  let moveDirX = 0;
  let moveDirZ = 0;
  let hasMoveDir = false;

  function update(px, pz, quality, dayRatio, dt = 0.016) {
    if (quality === 'low') {
      root.visible = false;
      return;
    }
    const tStart = nowMs();
    const FRAME_BUDGET_MS = 2.2;
    root.visible = true;

    // Track aircraft heading vector for forward-biased closest-first tile priority
    if (Number.isFinite(lastUpdatePx) && Number.isFinite(lastUpdatePz)) {
      const mdx = px - lastUpdatePx, mdz = pz - lastUpdatePz;
      const mLen = Math.hypot(mdx, mdz);
      if (mLen > 4 && mLen < 50000) {
        moveDirX = mdx / mLen;
        moveDirZ = mdz / mLen;
        hasMoveDir = true;
      }
    }
    lastUpdatePx = px;
    lastUpdatePz = pz;

    const nightAmt = Math.max(0, 1 - (Number.isFinite(dayRatio) ? dayRatio : 1));
    // Update all 5 PBR architectural archetype night-window emissive intensities with sun height (dayRatio)
    archGlassMat.emissiveIntensity = 0.10 + nightAmt * 0.92;
    archBrickMat.emissiveIntensity = nightAmt * 0.86;
    archCondoMat.emissiveIntensity = nightAmt * 0.84;
    archHouseMat.emissiveIntensity = nightAmt * 0.74;
    archIndMat.emissiveIntensity = nightAmt * 0.58;
    // Update legacy / bespoke landmark materials
    bldgWallMat.emissiveIntensity = nightAmt * 0.85;
    indWallMat.emissiveIntensity = nightAmt * 0.55;
    landmarkGlassMat.emissiveIntensity = 0.10 + nightAmt * 0.90;
    monumentGoldMat.emissiveIntensity = 0.14 + nightAmt * 0.75;

    // LOD2 Far Horizon Impostors (10-145 km, 360+ cities in 3 draw calls)
    if (!distantCityLOD) {
      const wccLate = getWorldCitiesCatalog();
      if (wccLate && typeof wccLate.createDistantCityHorizonLOD === 'function') {
        distantCityLOD = wccLate.createDistantCityHorizonLOD(root, ground);
      }
    }
    if (distantCityLOD && typeof distantCityLOD.update === 'function') {
      distantCityLOD.update(px, pz, dayRatio);
    }

    ensureHubSkyline(px, pz);
    ensureCitySkyline(px, pz);
    ensureRealGPSLandmarks(px, pz);
    for (let i = 0; i < animatedLandmarks.length; i++) {
      animatedLandmarks[i].userData.animate?.(dt);
    }
    if (liveOsmTraffic.size) updateLiveOsmTraffic(dt, nightAmt);
    if (quality === 'ultra' || quality === 'high' || quality === 'balanced') {
      streamLiveOsmBuildings(px, pz);
      // Zero-stutter OSM mesh construction: at most 1 closest queued OSM cell per frame within 2.2 ms budget
      processNextQueuedOsmCell(px, pz, tStart, FRAME_BUDGET_MS);
    }

    // 3-Tier Distance-Priority LOD Streaming (LOD0 Near Ring <= nearRad, LOD1 Mid Ring <= midRad)
    const cx = Math.floor(px / TILE), cz = Math.floor(pz / TILE);
    const nearRad = isLowMem ? 1 : 2;
    const midRad = isLowMem ? 3 : (quality === 'ultra' || quality === 'high' ? 5 : 4);
    const keep = new Set();
    const candidates = [];
    const sampler = typeof window !== 'undefined' ? window.__SKYBOUND_SAT_SAMPLER : null;

    for (let r = cz - midRad; r <= cz + midRad; r++) {
      for (let c = cx - midRad; c <= cx + midRad; c++) {
        const key = c + ':' + r;
        keep.add(key);
        const cheb = Math.max(Math.abs(c - cx), Math.abs(r - cz));
        const targetLod = cheb <= nearRad ? 0 : 1;
        const existing = loaded.get(key);
        const tx = (c + 0.5) * TILE, tz = (r + 0.5) * TILE;
        const nowHasSat = Boolean(sampler && sampler(tx, tz));

        // Detect missing, LOD1->LOD0 upgrade, hysteretic LOD0->LOD1 downgrade, or stale sat/OSM transitions
        const needsUpgrade = Boolean(existing && existing.lod === 1 && targetLod === 0);
        const needsDowngrade = Boolean(existing && existing.lod === 0 && cheb > nearRad + 1);
        const staleSat = Boolean(existing && existing.group && !existing.hadSat && nowHasSat);
        const staleOsm = Boolean(existing && existing.group && existing.osmRev < liveOsmRevision && inLiveOsmArea(tx, tz));

        if (!existing || needsUpgrade || needsDowngrade || staleSat || staleOsm) {
          const dx = tx - px, dz = tz - pz;
          const d2 = dx * dx + dz * dz;
          // Tile directly under aircraft gets absolute top priority; forward tiles beat behind tiles at equal distance
          const underAircraft = (c === cx && r === cz);
          const fwdBias = (!underAircraft && hasMoveDir) ? Math.max(-TILE * 600, Math.min(TILE * 600, (dx * moveDirX + dz * moveDirZ) * 420)) : 0;
          const score = underAircraft ? -1e12 : (d2 - fwdBias);
          candidates.push({ c, r, key, targetLod, nowHasSat, d2, score });
        }
      }
    }

    // Strict closest-first priority: LOD0 near tiles always precede LOD1 mid tiles, ordered by squared distance from (px, pz)
    candidates.sort((a, b) => (a.targetLod - b.targetLod) || (a.score - b.score));

    let lod0BuiltThisFrame = 0;
    let lod1BuiltThisFrame = 0;
    const maxLod0PerFrame = 1;
    const maxLod1PerFrame = isLowMem ? 2 : 4;

    for (let i = 0; i < candidates.length; i++) {
      if ((nowMs() - tStart) >= FRAME_BUDGET_MS) break;
      const cand = candidates[i];
      if (cand.targetLod === 0) {
        if (lod0BuiltThisFrame >= maxLod0PerFrame) continue;
      } else {
        if (lod1BuiltThisFrame >= maxLod1PerFrame) continue;
      }
      const prev = loaded.get(cand.key);
      if (prev && prev.group) {
        disposeGroup(prev.group);
      }
      const grp = buildTile(cand.c, cand.r, cand.targetLod);
      loaded.set(cand.key, {
        group: grp,
        lod: cand.targetLod,
        hadSat: Boolean(grp ? grp.userData.hadSat : cand.nowHasSat),
        osmRev: liveOsmRevision
      });
      if (grp) {
        if (cand.targetLod === 0) lod0BuiltThisFrame++;
        else lod1BuiltThisFrame++;
      }
      if (lod0BuiltThisFrame >= maxLod0PerFrame && lod1BuiltThisFrame >= maxLod1PerFrame) break;
    }

    // Evict tiles outside midRad cleanly with proper GPU disposal
    for (const [key, entry] of loaded) {
      if (!keep.has(key)) {
        if (entry && entry.group) {
          disposeGroup(entry.group);
        }
        loaded.delete(key);
      }
    }
  }

  return {
    root,
    update,
    getLandmarks: () => REAL_WORLD_LANDMARKS,
    getStats: () => ({
      tiles: loaded.size,
      cityCbds: cityCbdGroups.size,
      osmCells: liveOsmCells.size,
      osmQueued: osmBuildQueue.length,
      hasDistantCityLOD: Boolean(distantCityLOD)
    })
  };
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
