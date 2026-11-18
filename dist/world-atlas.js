'use strict';
// Offline-first vector World Atlas with real country territories, borders, biomes & 3D continental elevation.
const WorldAtlas = (() => {
  const COUNTRIES = [
    // East & Southeast Asia
    { code: 'TW', zh: '台灣', biome: 'temperate', base: 28, hill: 420, poly: [[120.02,22.02],[120.88,21.88],[121.62,22.75],[121.98,25.02],[121.52,25.29],[120.92,24.85],[120.24,23.62],[120.05,22.75]] },
    { code: 'JP', zh: '日本', biome: 'temperate', base: 34, hill: 560, poly: [[130.1,31.2],[132.4,33.2],[135.2,34.3],[136.9,34.7],[139.8,35.1],[140.9,35.7],[141.6,40.5],[140.3,41.2],[139.6,37.8],[136.6,36.8],[133.1,35.5],[130.6,33.6]] },
    { code: 'JP_HKD', zh: '日本 北海道', biome: 'boreal', base: 42, hill: 480, poly: [[139.8,41.6],[143.5,42.0],[145.6,43.4],[144.2,45.2],[141.7,45.5],[141.0,43.4],[139.8,42.5]] },
    { code: 'KR', zh: '韓國', biome: 'temperate', base: 26, hill: 320, poly: [[126.1,34.4],[128.9,35.0],[129.5,36.5],[128.6,38.3],[126.3,38.0],[126.4,36.4]] },
    { code: 'CN', zh: '中國', biome: 'temperate', base: 65, hill: 620, poly: [[75,39],[82,45],[95,49],[116,49],[124,53],[134,48],[130,42],[124,40],[119,39],[122,37],[120,34],[122.2,31.1],[120.6,27.5],[116.5,23.4],[113.4,22.1],[108.5,21.5],[103,22],[98,24],[92,28],[84,29],[78,34]] },
    { code: 'PH', zh: '菲律賓', biome: 'tropical', base: 22, hill: 340, poly: [[119.8,13.6],[122.4,13.8],[122.5,18.4],[120.2,18.4]] },
    { code: 'PH_S', zh: '菲律賓南部', biome: 'tropical', base: 24, hill: 300, poly: [[121.8,6.5],[126.4,5.6],[126.5,9.8],[122.8,9.5]] },
    { code: 'SEA', zh: '中南半島', biome: 'tropical', base: 24, hill: 260, poly: [[96.2,16.5],[98.5,21.5],[104.5,22.8],[108.2,21.4],[109.4,13.0],[107.0,10.2],[104.5,10.4],[100.3,13.3],[98.8,9.8],[99.8,14.5],[97.2,15.5]] },
    { code: 'MY', zh: '馬來西亞／新加坡', biome: 'tropical', base: 18, hill: 190, poly: [[100.1,6.5],[102.2,6.2],[104.3,1.3],[103.3,1.2],[101.2,3.1],[100.1,5.2]] },
    { code: 'ID_B', zh: '婆羅洲', biome: 'tropical', base: 24, hill: 340, poly: [[108.8,-2.8],[117.6,-3.5],[118.9,5.5],[115.4,6.9],[110.2,1.8]] },
    { code: 'ID_S', zh: '蘇門答臘', biome: 'tropical', base: 22, hill: 380, poly: [[95.2,5.6],[99.5,3.5],[105.9,-5.8],[103.5,-5.5],[97.2,1.2]] },
    { code: 'ID_J', zh: '爪哇島', biome: 'tropical', base: 26, hill: 350, poly: [[105.2,-6.9],[114.5,-8.5],[114.5,-6.9],[106.0,-5.9]] },
    { code: 'IN', zh: '印度', biome: 'tropical', base: 48, hill: 360, poly: [[68.5,23.5],[71.2,31.5],[78.5,32.5],[88.2,27.0],[91.8,22.4],[85.5,19.3],[80.3,12.8],[77.5,8.0],[72.5,19.1],[69.2,22.2]] },
    // Middle East & Turkey
    { code: 'TR', zh: '土耳其', biome: 'temperate', base: 140, hill: 540, poly: [[26.1,40.2],[29.5,41.6],[41.5,41.5],[44.2,39.5],[42.5,37.1],[35.8,36.2],[27.3,36.8]] },
    { code: 'AE', zh: '阿拉伯半島／阿聯', biome: 'arid', base: 28, hill: 180, poly: [[34.9,29.5],[39.5,32.2],[48.5,30.1],[51.8,25.5],[56.5,25.6],[59.8,22.4],[53.5,16.5],[43.4,12.6],[39.0,21.5],[34.8,28.1]] },
    { code: 'IR', zh: '伊朗／美索不達米亞', biome: 'arid', base: 180, hill: 640, poly: [[42.5,37.0],[48.5,38.8],[60.8,36.5],[61.5,25.4],[56.4,26.8],[48.6,30.1],[42.5,33.5]] },
    // Europe
    { code: 'GB', zh: '英國', biome: 'temperate', base: 22, hill: 180, poly: [[-5.6,50.1],[1.8,51.2],[1.4,53.4],[-1.8,58.6],[-6.2,58.4],[-5.1,54.2]] },
    { code: 'IE', zh: '愛爾蘭', biome: 'temperate', base: 22, hill: 140, poly: [[-10.2,51.6],[-6.1,52.2],[-5.9,55.2],[-9.8,54.4]] },
    { code: 'FR', zh: '法國', biome: 'temperate', base: 48, hill: 290, poly: [[-4.8,48.4],[2.5,51.1],[8.1,49.0],[7.4,47.5],[6.8,43.8],[3.1,42.5],[-1.8,43.3],[-1.5,46.8]] },
    { code: 'DE', zh: '德國／荷比盧', biome: 'temperate', base: 56, hill: 320, poly: [[3.4,51.4],[5.2,53.3],[9.0,55.0],[14.2,54.0],[14.9,50.8],[13.5,47.6],[7.5,47.5],[6.1,49.5],[3.4,51.0]] },
    { code: 'CH', zh: '阿爾卑斯／中歐', biome: 'alpine', base: 420, hill: 1650, poly: [[6.0,46.2],[7.6,47.6],[16.8,48.8],[17.0,46.6],[13.5,45.8],[7.5,45.8]] },
    { code: 'ES', zh: '西班牙／葡萄牙', biome: 'arid', base: 160, hill: 480, poly: [[-9.4,37.0],[-9.2,43.2],[-1.8,43.4],[3.2,42.4],[-0.4,38.0],[-5.6,36.0]] },
    { code: 'IT', zh: '義大利', biome: 'temperate', base: 48, hill: 520, poly: [[7.2,45.8],[13.6,46.0],[18.4,40.1],[15.6,38.0],[12.2,41.7],[8.6,44.4]] },
    { code: 'SC', zh: '北歐斯堪地那維亞', biome: 'boreal', base: 90, hill: 640, poly: [[5.0,58.8],[10.5,57.8],[18.5,59.5],[24.5,65.8],[30.5,70.2],[20.0,70.5],[12.5,66.2],[5.0,61.0]] },
    { code: 'EE', zh: '東歐／俄羅斯西部', biome: 'temperate', base: 85, hill: 220, poly: [[14.3,54.0],[24.5,60.2],[45.0,66.5],[65.0,68.0],[65.0,46.0],[41.0,42.5],[28.0,41.2],[17.0,46.5]] },
    // Africa
    { code: 'EG', zh: '埃及與東北非', biome: 'arid', base: 45, hill: 240, poly: [[24.5,31.6],[32.8,31.4],[34.8,29.5],[42.8,12.5],[51.2,11.8],[44.5,2.0],[33.5,4.0],[24.5,14.0]] },
    { code: 'NA_AF', zh: '西北非／撒哈拉', biome: 'arid', base: 120, hill: 340, poly: [[-17.2,14.7],[-13.5,27.8],[-5.8,35.9],[10.8,37.0],[24.5,31.6],[24.5,14.0],[12.5,4.2],[2.5,6.2],[-8.2,4.4],[-16.4,11.2]] },
    { code: 'ZA', zh: '中南非洲', biome: 'temperate', base: 340, hill: 680, poly: [[12.0,4.2],[33.5,4.0],[41.0,-1.8],[40.5,-15.2],[35.2,-24.2],[28.5,-33.2],[18.4,-34.4],[14.4,-22.5],[11.8,-6.0]] },
    { code: 'MG', zh: '馬達加斯加', biome: 'tropical', base: 65, hill: 320, poly: [[44.0,-25.2],[47.2,-25.0],[50.2,-15.2],[49.2,-12.0],[45.0,-16.2],[43.3,-22.0]] },
    // North America & Caribbean
    { code: 'US', zh: '美國', biome: 'temperate', base: 72, hill: 560, poly: [[-124.7,48.8],[-110.0,49.0],[-95.0,49.0],[-83.0,46.0],[-75.0,45.0],[-67.0,45.0],[-70.2,41.8],[-75.4,39.4],[-80.8,32.0],[-80.2,25.2],[-82.6,28.8],[-89.2,29.1],[-97.2,26.1],[-106.5,31.8],[-117.1,32.5],[-122.6,37.8],[-124.5,42.5]] },
    { code: 'AK', zh: '阿拉斯加', biome: 'boreal', base: 46, hill: 620, poly: [[-168.0,65.8],[-156.5,71.3],[-141.0,69.7],[-141.0,60.2],[-151.5,59.5],[-162.5,55.0],[-164.5,62.2]] },
    { code: 'CA', zh: '加拿大', biome: 'boreal', base: 110, hill: 580, poly: [[-141.0,69.7],[-122.0,70.2],[-95.0,69.0],[-78.0,62.5],[-64.0,60.2],[-55.5,52.0],[-64.5,48.8],[-75.0,45.0],[-95.0,49.0],[-124.7,48.8],[-133.0,55.5],[-141.0,60.2]] },
    { code: 'MX', zh: '墨西哥／中美洲', biome: 'arid', base: 240, hill: 720, poly: [[-117.1,32.5],[-106.5,31.8],[-97.2,26.1],[-96.0,19.2],[-87.0,21.5],[-83.5,14.5],[-77.5,8.6],[-84.5,10.0],[-93.0,15.2],[-105.5,20.5],[-110.2,23.2]] },
    { code: 'GL', zh: '格陵蘭', biome: 'alpine', base: 420, hill: 850, poly: [[-52,60],[-43,60],[-34,68],[-20,74],[-18,81],[-32,83],[-50,82],[-66,77],[-58,70],[-53,64]] },
    { code: 'HI', zh: '夏威夷', biome: 'tropical', base: 18, hill: 320, poly: [[-158.3,21.7],[-157.6,21.2],[-154.9,19.5],[-155.8,19.0],[-158.1,21.3]] },
    // South America
    { code: 'BR', zh: '巴西', biome: 'tropical', base: 120, hill: 340, poly: [[-68.0,4.5],[-51.5,4.2],[-49.0,0.0],[-34.8,-6.8],[-38.5,-13.5],[-40.5,-22.5],[-48.5,-27.5],[-53.5,-33.6],[-58.0,-27.5],[-62.0,-16.0],[-70.0,-7.5]] },
    { code: 'AR', zh: '智利／阿根廷', biome: 'alpine', base: 260, hill: 1450, poly: [[-70.5,-18.0],[-62.0,-22.0],[-53.5,-33.6],[-62.0,-40.5],[-66.5,-48.0],[-67.8,-54.8],[-74.2,-52.0],[-73.8,-41.5],[-71.8,-33.0]] },
    { code: 'CO', zh: '安地斯北麓', biome: 'tropical', base: 220, hill: 980, poly: [[-77.5,8.6],[-71.8,12.2],[-62.0,10.5],[-68.0,4.5],[-70.0,-7.5],[-78.5,-13.5],[-81.2,-4.8],[-79.2,2.2]] },
    // Oceania
    { code: 'AU', zh: '澳洲', biome: 'arid', base: 85, hill: 280, poly: [[114.0,-22.0],[122.2,-17.2],[131.0,-12.2],[137.2,-12.4],[142.5,-10.9],[146.5,-18.4],[153.5,-27.5],[150.2,-37.4],[144.8,-38.4],[138.0,-35.6],[132.0,-32.1],[122.2,-34.0],[115.0,-34.2],[113.4,-26.0]] },
    { code: 'NZ', zh: '紐西蘭', biome: 'temperate', base: 42, hill: 620, poly: [[172.6,-34.4],[178.4,-37.6],[175.4,-41.5],[172.5,-43.8],[166.5,-46.2],[167.2,-44.2],[173.8,-39.0]] }
  ];

  const COUNTRY_BBOX = COUNTRIES.map(c => {
    let minLon = 180, maxLon = -180, minLat = 90, maxLat = -90;
    for (const [lon, lat] of c.poly) {
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
    return { ...c, minLon, maxLon, minLat, maxLat };
  });

  const LANDMASSES = COUNTRIES.map(c => c.poly);

  const REGION_LABELS = [
    { name: 'NORTH AMERICA', lon: -102, lat: 45 },
    { name: 'SOUTH AMERICA', lon: -58, lat: -14 },
    { name: 'EUROPE', lon: 14, lat: 51 },
    { name: 'AFRICA', lon: 20, lat: 5 },
    { name: 'ASIA', lon: 94, lat: 42 },
    { name: 'OCEANIA', lon: 134, lat: -25 },
    { name: 'PACIFIC OCEAN', lon: -160, lat: 8, ocean: true },
    { name: 'ATLANTIC OCEAN', lon: -36, lat: 24, ocean: true },
    { name: 'INDIAN OCEAN', lon: 78, lat: -15, ocean: true }
  ];

  function wrapLon(lon) {
    const v = ((lon + 180) % 360 + 360) % 360 - 180;
    return v === -180 && lon > 0 ? 180 : v;
  }

  function pointInRing(lon, lat, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0], yi = poly[i][1];
      const xj = poly[j][0], yj = poly[j][1];
      const hit = ((yi > lat) !== (yj > lat)) && (lon < (xj - xi) * (lat - yi) / ((yj - yi) || 1e-12) + xi);
      if (hit) inside = !inside;
    }
    return inside;
  }

  function countryAt(lon, lat) {
    const wLon = wrapLon(lon);
    for (let i = 0; i < COUNTRY_BBOX.length; i++) {
      const c = COUNTRY_BBOX[i];
      if (wLon < c.minLon || wLon > c.maxLon || lat < c.minLat || lat > c.maxLat) continue;
      if (pointInRing(wLon, lat, c.poly)) return c;
    }
    return null;
  }

  function globalLandElevation(lon, lat, x = 0, z = 0) {
    const c = countryAt(lon, lat);
    if (!c) return 0;
    const w1 = Math.sin(x * 0.000085 + lon * 0.6) * Math.cos(z * 0.000085 - lat * 0.5);
    const w2 = Math.sin(x * 0.00031 - z * 0.00024) * 0.5 + 0.5;
    const ridge = Math.pow(Math.max(0, w1 * 0.65 + w2 * 0.35), 1.4);
    const fine = Math.sin(x * 0.0012) * Math.cos(z * 0.0011) * 4.5;
    return Math.max(2.2, c.base + ridge * c.hill + fine);
  }

  function greatCircleGeoPoints(from, to, steps = 20) {
    if (!from || !to) return [];
    const r = Math.PI / 180;
    const lat1 = from.lat * r, lon1 = from.lon * r;
    const lat2 = to.lat * r, lon2 = to.lon * r;
    const p1 = [Math.cos(lat1) * Math.cos(lon1), Math.cos(lat1) * Math.sin(lon1), Math.sin(lat1)];
    const p2 = [Math.cos(lat2) * Math.cos(lon2), Math.cos(lat2) * Math.sin(lon2), Math.sin(lat2)];
    const dot = Math.max(-1, Math.min(1, p1[0] * p2[0] + p1[1] * p2[1] + p1[2] * p2[2]));
    const omega = Math.acos(dot);
    if (omega < 1e-5) return [{ lat: from.lat, lon: from.lon }, { lat: to.lat, lon: to.lon }];
    const sinO = Math.sin(omega);
    const out = [];
    for (let i = 0; i <= steps; i++) {
      const f = i / steps;
      const a = Math.sin((1 - f) * omega) / sinO;
      const b = Math.sin(f * omega) / sinO;
      const x = a * p1[0] + b * p2[0];
      const y = a * p1[1] + b * p2[1];
      const z = a * p1[2] + b * p2[2];
      out.push({ lat: Math.atan2(z, Math.hypot(x, y)) / r, lon: Math.atan2(y, x) / r });
    }
    return out;
  }

  const BIOME_COLORS = {
    temperate: '#2b4d2c',
    tropical: '#1d4424',
    arid: '#7c6b4b',
    boreal: '#394f43',
    alpine: '#646e6a'
  };

  // Shared Google Maps Satellite tile cache for WorldAtlas (2D projections)
  const satCache = new Map();
  function getSatTile(lyrs, z, x, y, onReady) {
    if (!lyrs || typeof Image === 'undefined') return null;
    const n = 1 << z;
    if (y < 0 || y >= n) return null;
    const tx = ((x % n) + n) % n;
    const key = `${lyrs}:${z}:${tx}:${y}`;
    let e = satCache.get(key);
    if (e) {
      if (e.state === 'loading' && onReady) e.waiters.add(onReady);
      return e;
    }
    const img = new Image();
    e = { img, state: 'loading', waiters: new Set(onReady ? [onReady] : []) };
    satCache.set(key, e);
    const done = st => {
      e.state = st;
      for (const fn of e.waiters) { try { fn(); } catch {} }
      e.waiters.clear();
    };
    img.onload = () => done('ready');
    img.onerror = () => {
      if (!e.fallback) {
        e.fallback = true;
        img.src = `https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${tx}`;
      } else {
        done('error');
      }
    };
    img.referrerPolicy = 'no-referrer';
    img.src = `https://mt${(tx + y) & 3}.google.com/vt/lyrs=${lyrs}&hl=zh-TW&x=${tx}&y=${y}&z=${z}`;
    while (satCache.size > 260) {
      const firstKey = satCache.keys().next().value;
      satCache.delete(firstKey);
    }
    return e;
  }

  function tileLon(tx, n) { return (tx / n) * 360 - 180; }
  function tileLat(ty, n) {
    const u = Math.PI - (2 * Math.PI * ty) / n;
    return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(u) - Math.exp(-u)));
  }

  function drawVectorWorld(ctx, projectLonLat, w, h, opts = {}) {
    const {
      oceanTop = '#04101e',
      oceanBot = '#07223b',
      landStroke = 'rgba(155, 212, 178, 0.48)',
      gridStep = 30,
      showLabels = true,
      satMode = 'y',
      tileZoom = null,
      onTileLoad = null
    } = opts;

    // 1. Deep Ocean Bathymetry Base
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, oceanTop);
    grad.addColorStop(0.5, '#092845');
    grad.addColorStop(1, oceanBot);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    // 2. Shaded-Relief Satellite Landmasses Base (instant zero-latency base before tiles finish loading)
    ctx.lineJoin = 'round';
    for (const c of COUNTRIES) {
      ctx.fillStyle = BIOME_COLORS[c.biome] || '#2b4d2c';
      ctx.strokeStyle = 'rgba(26, 118, 152, 0.34)';
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      let prevLon = null;
      for (let i = 0; i < c.poly.length; i++) {
        const [lon, lat] = c.poly[i];
        const [px, py] = projectLonLat(lon, lat);
        if (i === 0 || (prevLon !== null && Math.abs(lon - prevLon) > 180)) {
          ctx.moveTo(px, py);
        } else {
          ctx.lineTo(px, py);
        }
        prevLon = lon;
      }
      ctx.closePath();
      ctx.stroke();
      ctx.fill();
      ctx.strokeStyle = landStroke;
      ctx.lineWidth = 0.9;
      ctx.stroke();
    }

    // 3. Google Maps Satellite / Hybrid Web Mercator Tiles
    let satDrawn = 0;
    const notify = onTileLoad || (ctx.canvas && ctx.canvas._onSatelliteTileLoad) || null;
    if (satMode && typeof Image !== 'undefined' && typeof ctx.drawImage === 'function') {
      const [pWest] = projectLonLat(-180, 0);
      const [pEast] = projectLonLat(180, 0);
      const worldSpanPx = Math.max(256, Math.abs(pEast - pWest));
      const tz = tileZoom || Math.max(2, Math.min(13, Math.round(Math.log2(worldSpanPx / 256))));
      const n = 1 << tz;
      for (let ty = 0; ty < n; ty++) {
        const latTop = Math.max(-82, Math.min(82, tileLat(ty, n)));
        const latBot = Math.max(-82, Math.min(82, tileLat(ty + 1, n)));
        const [, y0] = projectLonLat(0, latTop);
        const [, y1] = projectLonLat(0, latBot);
        const py = Math.min(y0, y1), ph = Math.abs(y1 - y0);
        if (py + ph < -2 || py > h + 2 || ph < 2) continue;
        for (let tx = 0; tx < n; tx++) {
          const lonL = tileLon(tx, n);
          const lonR = tileLon(tx + 1, n);
          const [x0] = projectLonLat(lonL, 0);
          const [x1] = projectLonLat(lonR, 0);
          if (x1 < x0) continue; // skip antimeridian wrap inversion
          const pw = x1 - x0;
          if (x1 < -2 || x0 > w + 2 || pw < 2) continue;
          const entry = getSatTile(satMode, tz, tx, ty, notify);
          if (entry && entry.state === 'ready') {
            ctx.drawImage(entry.img, x0, py, pw + 0.6, ph + 0.6);
            satDrawn++;
          } else if (tz > 2) {
            const shift = tz - 2;
            const pEntry = satCache.get(`${satMode}:2:${tx >> shift}:${ty >> shift}`);
            if (pEntry && pEntry.state === 'ready') {
              const sc = 1 << shift, sub = 256 / sc;
              ctx.drawImage(pEntry.img, (tx & (sc - 1)) * sub, (ty & (sc - 1)) * sub, sub, sub, x0, py, pw + 0.6, ph + 0.6);
              satDrawn++;
            }
          }
        }
      }
    }

    // 4. Subtle Graticule Grid
    for (let lon = -180; lon <= 180; lon += gridStep) {
      const [x0, y0] = projectLonLat(lon, 82);
      const [x1, y1] = projectLonLat(lon, -72);
      ctx.strokeStyle = lon === 0 ? 'rgba(120, 210, 245, 0.22)' : 'rgba(100, 185, 230, 0.09)';
      ctx.lineWidth = lon === 0 ? 1.1 : 0.8;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }
    for (let lat = -60; lat <= 75; lat += gridStep) {
      const [x0, y0] = projectLonLat(-180, lat);
      const [x1, y1] = projectLonLat(180, lat);
      ctx.strokeStyle = lat === 0 ? 'rgba(120, 210, 245, 0.24)' : 'rgba(100, 185, 230, 0.09)';
      ctx.lineWidth = lat === 0 ? 1.1 : 0.8;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }

    if (showLabels && satDrawn === 0) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const lbl of REGION_LABELS) {
        const [cx, cy] = projectLonLat(lbl.lon, lbl.lat);
        if (cx > 30 && cx < w - 30 && cy > 18 && cy < h - 18) {
          ctx.font = lbl.ocean ? 'italic 9px system-ui, sans-serif' : 'bold 10px system-ui, sans-serif';
          ctx.fillStyle = lbl.ocean ? 'rgba(125, 195, 235, 0.34)' : 'rgba(220, 244, 255, 0.65)';
          ctx.fillText(lbl.name, cx, cy);
        }
      }
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    }
    ctx.restore();
  }

  return { COUNTRIES, LANDMASSES, wrapLon, countryAt, globalLandElevation, greatCircleGeoPoints, drawVectorWorld };
})();
if (typeof module !== 'undefined') Object.assign(globalThis, { WorldAtlas });
