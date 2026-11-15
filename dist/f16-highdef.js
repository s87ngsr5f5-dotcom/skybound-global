'use strict';
// High-detail procedural F-16C Block 50 (sf16) and F-16V Block 70 (f16v) benchmarks.
// Genuine sub-variant geometry: CFTs, dorsal spine, tail-base ECM fairing, APX-113 IFF blades,
// Sniper ATP pod, MCID chin intake w/ diverter & fan, 3-wheel landing gear, and dedicated Block 50 / Viper cockpits.
(function (globalScope) {
  function clampVal(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function makeCanvas(w, h) {
    if (typeof document !== 'undefined' && document.createElement) {
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      return c;
    }
    const stubCtx = {
      fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, font: '', textAlign: 'left',
      textBaseline: 'alphabetic', globalAlpha: 1,
      fillRect() {}, clearRect() {}, strokeRect() {}, beginPath() {}, closePath() {},
      moveTo() {}, lineTo() {}, arc() {}, ellipse() {}, roundRect() {}, bezierCurveTo() {},
      quadraticCurveTo() {}, fill() {}, stroke() {}, fillText() {}, strokeText() {},
      save() {}, restore() {}, translate() {}, rotate() {}, scale() {}, clip() {},
      setLineDash() {}, createLinearGradient() { return { addColorStop() {} }; },
      createRadialGradient() { return { addColorStop() {} }; }
    };
    return { width: w, height: h, getContext: () => stubCtx };
  }

  function makeTex(canvas, srgb = true) {
    const tex = new THREE.CanvasTexture(canvas);
    if (srgb && 'colorSpace' in tex) tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }

  function buildPanelTextures(variant) {
    const isViper = variant === 'f16v';
    const baseHex = isViper ? '#636d78' : '#7b858e';
    const upperHex = isViper ? '#4e5863' : '#65707a';
    const lowerHex = isViper ? '#818b95' : '#96a0a8';
    const colC = makeCanvas(1024, 1024);
    const ctx = colC.getContext('2d');
    const bumpC = makeCanvas(1024, 1024);
    const btx = bumpC.getContext('2d');
    const roughC = makeCanvas(512, 512);
    const rtx = roughC.getContext('2d');

    const grad = ctx.createLinearGradient(0, 0, 0, 1024);
    grad.addColorStop(0.0, lowerHex);
    grad.addColorStop(0.28, baseHex);
    grad.addColorStop(0.55, upperHex);
    grad.addColorStop(0.82, baseHex);
    grad.addColorStop(1.0, lowerHex);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 1024);

    btx.fillStyle = '#808080';
    btx.fillRect(0, 0, 1024, 1024);
    rtx.fillStyle = isViper ? '#949494' : '#848484';
    rtx.fillRect(0, 0, 512, 512);

    // Subtle Have Glass V metallic/RAM mottling vs clean USAF tactical sheen
    for (let i = 0; i < 4200; i++) {
      const x = (i * 199.7) % 1024;
      const y = (i * 89.3) % 1024;
      ctx.fillStyle = i % 3 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(22,30,38,0.035)';
      ctx.fillRect(x, y, isViper ? 10 : 6, isViper ? 6 : 4);
      btx.fillStyle = i % 2 === 0 ? '#848484' : '#7c7c7c';
      btx.fillRect(x, y, 2, 2);
    }

    ctx.strokeStyle = 'rgba(32,40,48,0.22)';
    ctx.lineWidth = 1.4;
    btx.strokeStyle = '#505050';
    btx.lineWidth = 1.6;
    for (let r = 0; r < 14; r++) {
      const y = r * (1024 / 14) + 18;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1024, y); ctx.stroke();
      btx.beginPath(); btx.moveTo(0, y); btx.lineTo(1024, y); btx.stroke();
      for (let c = 0; c < 10; c++) {
        const x = c * (1024 / 10) + (r % 2) * 34;
        const w = 84, h = 52;
        ctx.strokeRect(x, y + 6, w, h);
        btx.strokeRect(x, y + 6, w, h);
        if ((r + c) % 4 === 0) {
          ctx.fillStyle = 'rgba(38,46,54,0.14)';
          ctx.fillRect(x + 12, y + 14, 24, 14);
          rtx.fillStyle = '#6c6c6c';
          rtx.fillRect(x * 0.5 + 6, (y + 14) * 0.5, 12, 7);
        }
        btx.fillStyle = '#404040';
        for (let rv = 4; rv < w - 4; rv += 10) {
          btx.fillRect(x + rv, y + 8, 1.5, 1.5);
        }
      }
    }

    // Air-to-air aerial refueling slipway chevron along top center u ~ 0.5
    ctx.strokeStyle = 'rgba(205,212,218,0.42)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(290, 492); ctx.lineTo(350, 512); ctx.lineTo(290, 532);
    ctx.stroke();

    const map = makeTex(colC, true);
    const bumpMap = makeTex(bumpC, false);
    const roughnessMap = makeTex(roughC, false);
    map.anisotropy = 4;
    bumpMap.anisotropy = 4;
    return { map, bumpMap, roughnessMap };
  }

  function buildF16ForebodyStation(z, half, variant) {
    const t = clampVal((z + half) / (half * 1.90), 0, 1);
    const isViper = variant === 'f16v';
    // Tip t=0 (-half) to Exhaust base t=1 (+0.90*half)
    let rx = 0.02, ryTop = 0.02, ryBot = 0.02, yMid = -0.02;
    let spineW = 0.0, spineH = 0.0, chineX = 0.0, chineY = 0.0;

    if (t < 0.14) {
      // Radome nosecone (pointed tangent ogive)
      const u = t / 0.14;
      const og = Math.pow(u, 0.72);
      rx = Math.max(0.014, 0.44 * og);
      ryTop = Math.max(0.014, 0.36 * og);
      ryBot = Math.max(0.014, 0.34 * og);
      yMid = -0.10 + 0.04 * u;
    } else if (t < 0.38) {
      // Cockpit tub & LERX strake sweep (-5.3m to -1.7m)
      const u = (t - 0.14) / 0.24;
      rx = 0.44 + 0.24 * Math.sin(u * Math.PI * 0.5);
      ryTop = 0.36 + 0.08 * Math.sin(u * Math.PI);
      ryBot = 0.34 + 0.08 * u;
      yMid = -0.04;
      chineX = 0.06 + 0.38 * Math.pow(u, 1.35);
      chineY = 0.08 + 0.05 * u;
    } else if (t < 0.76) {
      // Mid fuselage / wing-root blend / dorsal avionics spine (-1.7m to +3.7m)
      const u = (t - 0.38) / 0.38;
      rx = 0.68 + 0.09 * Math.sin(u * Math.PI);
      ryTop = 0.44 + 0.08 * Math.sin(u * Math.PI * 0.75);
      ryBot = 0.42 + 0.14 * Math.sin(u * Math.PI * 0.8);
      yMid = -0.02 + 0.03 * u;
      chineX = u < 0.35 ? 0.44 * (1 - u * 0.5) : Math.max(0.0, 0.36 * (1 - (u - 0.35) / 0.65));
      chineY = 0.06;
      // Dorsal spine fairing behind cockpit bulkhead
      const sEnv = Math.sin(Math.min(1, u * 1.15) * Math.PI * 0.85);
      spineW = isViper ? (0.31 + 0.06 * sEnv) : (0.20 + 0.03 * sEnv);
      spineH = isViper ? (0.44 * sEnv + 0.16) : (0.30 * sEnv + 0.08);
    } else {
      // Aft engine fuselage converging cleanly into F110 turbine collar
      const u = (t - 0.76) / 0.24;
      const s = 1 - u;
      rx = 0.68 * s + 0.545 * u;
      ryTop = 0.44 * s + 0.545 * u;
      ryBot = 0.48 * s + 0.545 * u;
      yMid = 0.01 * s;
      spineW = (isViper ? 0.28 : 0.16) * (1 - u * 0.82);
      spineH = (isViper ? 0.34 : 0.18) * (1 - u * 0.90);
    }
    return { rx, ryTop, ryBot, yMid, spineW, spineH, chineX, chineY, t };
  }

  function buildLoftedF16HullGeometry(half, variant) {
    const stations = 54, slices = 48;
    const zStart = -half * 0.99;
    const zEnd = half * 0.89;
    const positions = [], uvs = [], indices = [];
    const ringCount = slices + 1;

    for (let i = 0; i <= stations; i++) {
      const f = i / stations;
      const z = zStart + (zEnd - zStart) * f;
      const st = buildF16ForebodyStation(z, half, variant);
      // Carve cockpit tub subtly down between z=-4.18 and z=-1.92 on top center
      const inCockpitZ = z > -half * 0.565 && z < -half * 0.255;
      const cBell = inCockpitZ ? Math.sin(((z + half * 0.565) / (half * 0.31)) * Math.PI) : 0;

      for (let j = 0; j < ringCount; j++) {
        const theta = (j / slices) * Math.PI * 2; // 0 = top (+Y), PI/2 = right (+X), PI = bottom (-Y)
        const sT = Math.sin(theta), cT = Math.cos(theta);
        let x = sT * st.rx;
        let y = st.yMid + (cT >= 0 ? cT * st.ryTop : cT * st.ryBot);

        // Blended chine / LERX flare around horizontal equator (cT near 0)
        if (st.chineX > 0.005) {
          const band = Math.exp(-Math.pow((cT - 0.05) / 0.28, 2));
          x += Math.sign(sT || 0) * Math.abs(sT) * st.chineX * band;
          y += st.chineY * band * 0.45;
        }
        // Dorsal spine ridge (around top theta=0)
        if (st.spineH > 0.005 && cT > 0.15) {
          const ridge = Math.pow(cT, 3.2);
          y += st.spineH * ridge;
          if (Math.abs(sT) < 0.45 && st.spineW > 0.22) {
            x += Math.sign(sT) * (st.spineW - 0.18) * 0.55 * ridge;
          }
        }
        // Subtle open cockpit sill recess beneath canopy glass so pilot tub fits realistically
        if (cBell > 0.01 && cT > 0.52) {
          const well = Math.pow((cT - 0.52) / 0.48, 1.5);
          y -= 0.22 * cBell * well;
        }

        positions.push(x, y, z);
        uvs.push(f, j / slices);
      }
    }

    for (let i = 0; i < stations; i++) {
      for (let j = 0; j < slices; j++) {
        const a = i * ringCount + j;
        const b = a + ringCount;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }

  function buildBubbleCanopyGeometry(half) {
    // One-piece teardrop polycarbonate bubble canopy sitting cleanly on y=0.38..0.44 sill
    // Aft canopy arch at z=-half*0.245 meets dorsal spine at y~0.86 so protrude <= 0.20 (pass verify-no-clipping)
    const length = half * 0.33; // ~2.44m
    const slices = 22, radial = 28;
    const positions = [], uvs = [], indices = [];
    const ringCount = radial + 1;

    for (let i = 0; i <= slices; i++) {
      const t = i / slices;
      const z = -half * 0.575 + t * length;
      const wEnv = Math.sin(Math.pow(t, 0.72) * Math.PI);
      const hEnv = Math.sin(Math.pow(t, 0.66) * Math.PI);
      const sillY = 0.39 + 0.05 * Math.sin(t * Math.PI);
      const rx = Math.max(0.015, 0.415 * wEnv);
      const ryTop = Math.max(0.015, 0.555 * hEnv);

      for (let j = 0; j < ringCount; j++) {
        const phi = -Math.PI * 0.5 + (j / radial) * Math.PI; // -PI/2 left sill -> 0 crown -> +PI/2 right sill
        const x = Math.sin(phi) * rx;
        const dome = Math.pow(Math.max(0, Math.cos(phi)), 0.78);
        const y = sillY + dome * ryTop;
        positions.push(x, y, z);
        uvs.push(t, j / radial);
      }
    }

    for (let i = 0; i < slices; i++) {
      for (let j = 0; j < radial; j++) {
        const a = i * ringCount + j;
        const b = a + ringCount;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }

  function buildConformalFuelTank(half, side) {
    // Sculpted Block 70 F-16V upper shoulder CFT
    const stations = 20, radial = 18;
    const zStart = -half * 0.27;
    const zEnd = half * 0.36;
    const positions = [], uvs = [], indices = [];
    const ringCount = radial + 1;

    for (let i = 0; i <= stations; i++) {
      const t = i / stations;
      const z = zStart + (zEnd - zStart) * t;
      const env = Math.sin(Math.pow(t, 0.76) * Math.PI);
      const lenTail = t > 0.7 ? 1 - (t - 0.7) / 0.3 * 0.35 : 1;
      const xCenter = side * (0.64 + 0.14 * env);
      const yBase = 0.08;
      const rx = 0.23 * env + 0.015;
      const ry = (0.37 * env + 0.02) * lenTail;

      for (let j = 0; j < ringCount; j++) {
        const a = (j / radial) * Math.PI * 2;
        const ca = Math.cos(a), sa = Math.sin(a);
        const px = xCenter + ca * rx;
        const py = yBase + (sa >= 0 ? Math.pow(sa, 0.85) * ry : sa * 0.06);
        positions.push(px, py, z);
        uvs.push(t, j / radial);
      }
    }
    for (let i = 0; i < stations; i++) {
      for (let j = 0; j < radial; j++) {
        const a = i * ringCount + j;
        const b = a + ringCount;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }

  function buildChinIntakeGeometry(half) {
    // MCID wide ovoid F110 chin intake w/ upper diverter separation under forward fuselage
    const stations = 18, radial = 28;
    const zStart = -half * 0.635; // ~ -4.70m lip
    const zEnd = -half * 0.06;    // ~ -0.45m blend into belly
    const positions = [], uvs = [], indices = [];
    const ringCount = radial + 1;

    for (let i = 0; i <= stations; i++) {
      const t = i / stations;
      const z = zStart + (zEnd - zStart) * t;
      const rx = t < 0.08 ? 0.50 + 0.06 * (t / 0.08) : 0.56 * (1 - t * 0.14);
      const ryTop = t < 0.08 ? 0.22 + 0.06 * (t / 0.08) : 0.28 + 0.08 * t;
      const ryBot = t < 0.08 ? 0.28 + 0.04 * (t / 0.08) : 0.32 * (1 - t * 0.10);
      const yc = -0.58 + 0.08 * t;

      for (let j = 0; j < ringCount; j++) {
        const a = (j / radial) * Math.PI * 2;
        const ca = Math.cos(a), sa = Math.sin(a);
        const flatTop = sa > 0 ? Math.pow(sa, 0.72) * 0.82 : sa;
        const px = ca * rx;
        const py = yc + (flatTop >= 0 ? flatTop * ryTop : flatTop * ryBot);
        positions.push(px, py, z);
        uvs.push(t, j / radial);
      }
    }
    for (let i = 0; i < stations; i++) {
      for (let j = 0; j < radial; j++) {
        const a = i * ringCount + j;
        const b = a + ringCount;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }

  function buildWingPylonAndStore(matBody, matDark, matMissile, matStripe, tipRailOnly) {
    const g = new THREE.Group();
    // Sidewinder AIM-9X / AIM-120C slender air-to-air missile
    const mLen = tipRailOnly ? 3.58 : 2.95;
    const mRad = tipRailOnly ? 0.088 : 0.068;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(mRad, mRad, mLen, 16), matMissile);
    body.rotation.x = Math.PI / 2;
    body.name = 'f16MissileBody';
    g.add(body);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(mRad, 0.44, 16), matDark);
    nose.rotation.x = -Math.PI / 2;
    nose.position.z = -mLen * 0.5 - 0.22;
    g.add(nose);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(mRad * 1.03, mRad * 1.03, 0.14, 16), matStripe);
    band.rotation.x = Math.PI / 2;
    band.position.z = -mLen * 0.25;
    g.add(band);
    for (let f = 0; f < 4; f++) {
      const ang = (f * Math.PI) / 2 + Math.PI / 4;
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.012, mRad * 2.5, 0.28), matDark);
      fin.rotation.z = ang;
      fin.position.set(Math.cos(ang) * mRad * 1.1, Math.sin(ang) * mRad * 1.1, mLen * 0.38);
      g.add(fin);
      const fwdFin = new THREE.Mesh(new THREE.BoxGeometry(0.010, mRad * 1.7, 0.16), matDark);
      fwdFin.rotation.z = ang;
      fwdFin.position.set(Math.cos(ang) * mRad * 0.95, Math.sin(ang) * mRad * 0.95, -mLen * 0.34);
      g.add(fwdFin);
    }
    return g;
  }

  function addWheelGroup(parent, r, width, tireMat, hubMat, name) {
    const wG = new THREE.Group();
    wG.name = name || 'f16Wheel';
    // flight.js:5777 calls w.rotateY(...) where w.rotation.z = Math.PI/2 makes axle along X
    wG.rotation.z = Math.PI / 2;
    wG.userData = { radius: r };
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(r, r, width, 24), tireMat);
    tire.name = 'f16Tire';
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.56, r * 0.56, width * 1.03, 18), hubMat);
    rim.name = 'f16Hub';
    const brake = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.36, r * 0.36, width * 1.06, 12), tireMat);
    wG.add(tire, rim, brake);
    parent.add(wG);
    return wG;
  }

  function buildF16Airframe(profile, scene) {
    const variant = profile.id === 'f16v' ? 'f16v' : 'sf16';
    const isViper = variant === 'f16v';
    const half = profile.geometry?.[0] ?? (isViper ? 7.51 : 7.40);
    const radius = profile.geometry?.[1] ?? 0.85;
    const span = profile.geometry?.[2] ?? (isViper ? 4.72 : 4.90);
    const gearH = profile.gearHeight ?? 1.85;

    const group = new THREE.Group();
    group.name = isViper ? 'F16V_HighDef' : 'F16C_HighDef';
    const gear = new THREE.Group();
    gear.name = 'f16GearGroup';
    const cabin = new THREE.Group();
    cabin.name = 'f16CockpitCabin';
    group.add(gear);
    if (scene && typeof scene.add === 'function') scene.add(group, cabin);

    const texSet = buildPanelTextures(variant);
    const airframeMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: texSet.map,
      bumpMap: texSet.bumpMap,
      bumpScale: 0.015,
      roughnessMap: texSet.roughnessMap,
      roughness: isViper ? 0.52 : 0.45,
      metalness: isViper ? 0.32 : 0.38,
      clearcoat: isViper ? 0.22 : 0.42,
      clearcoatRoughness: 0.25,
      envMapIntensity: 1.15
    });
    const spineMat = new THREE.MeshPhysicalMaterial({
      color: isViper ? 0x525d68 : 0x67727c,
      bumpMap: texSet.bumpMap,
      bumpScale: 0.012,
      roughness: 0.48,
      metalness: 0.34
    });
    const radomeMat = new THREE.MeshStandardMaterial({
      color: isViper ? 0x353f4b : 0x45505c,
      roughness: 0.58,
      metalness: 0.22
    });
    const intakeDarkMat = new THREE.MeshStandardMaterial({ color: 0x161b20, roughness: 0.85, metalness: 0.15 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0xadb7c0, roughness: 0.28, metalness: 0.82 });
    const tiDarkMat = new THREE.MeshStandardMaterial({ color: 0x2f373f, roughness: 0.42, metalness: 0.72 });
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x181c20, roughness: 0.86, metalness: 0.08 });
    const missileMat = new THREE.MeshStandardMaterial({ color: 0xd8dfe5, roughness: 0.42, metalness: 0.18 });
    const blueBandMat = new THREE.MeshStandardMaterial({ color: 0x26548a, roughness: 0.4, metalness: 0.2 });

    // Gold/smoke F-16 polycarbonate canopy glass
    const canopyMat = new THREE.MeshPhysicalMaterial({
      color: isViper ? 0x685a3a : 0x546872,
      roughness: 0.08,
      metalness: 0.16,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      transparent: true,
      opacity: 0.46,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    // 1. Blended forebody / LERX / engine fuselage / spine loft
    const hullGeo = buildLoftedF16HullGeometry(half, variant);
    const hullMesh = new THREE.Mesh(hullGeo, airframeMat);
    hullMesh.name = 'f16Fuselage';
    group.add(hullMesh);

    // Distinct dark RAM radome nosecone collar + forward APG-68 / APG-83 radome skin
    const radConePts = [];
    for (let k = 0; k <= 12; k++) {
      const f = k / 12;
      radConePts.push(new THREE.Vector2(Math.max(0.012, 0.445 * Math.pow(f, 0.72)), -half + f * (half * 0.275)));
    }
    const radGeo = new THREE.LatheGeometry(radConePts.map((p) => new THREE.Vector2(p.x, p.y)), 28);
    radGeo.rotateX(Math.PI / 2);
    const radMesh = new THREE.Mesh(radGeo, radomeMat);
    radMesh.position.y = -0.075;
    radMesh.name = 'f16Radome';
    group.add(radMesh);

    // Nose static pitot needle probe + AoA probes
    const pitot = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.020, 0.36, 10), metalMat);
    pitot.rotation.x = Math.PI / 2;
    pitot.position.set(0, -0.075, -half - 0.14);
    pitot.name = 'f16Pitot';
    group.add(pitot);

    for (const s of [-1, 1]) {
      const aoa = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.14, 8), metalMat);
      aoa.rotation.z = s * Math.PI * 0.5;
      aoa.position.set(s * 0.42, -0.04, -half * 0.74);
      group.add(aoa);
    }

    // 2. Signature F-16V APX-113 "bird-slicer" IFF blades ahead of windshield
    if (isViper) {
      for (let b = 0; b < 4; b++) {
        const bx = -0.15 + b * 0.10;
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.105, 0.16), tiDarkMat);
        blade.position.set(bx, 0.345, -half * 0.65);
        blade.rotation.x = -0.18;
        blade.name = 'f16vIffBlade';
        group.add(blade);
      }
      // Conformal Fuel Tanks (port & starboard shoulder CFTs exclusive to F-16V)
      for (const side of [-1, 1]) {
        const cftMesh = new THREE.Mesh(buildConformalFuelTank(half, side), spineMat);
        cftMesh.name = side < 0 ? 'f16vCftPort' : 'f16vCftStbd';
        group.add(cftMesh);
      }
      // AN/AAQ-33 Sniper ATP targeting pod asymmetrical on starboard intake cheek
      const podGroup = new THREE.Group();
      podGroup.name = 'f16vSniperPod';
      podGroup.position.set(0.46, -0.44, -half * 0.54);
      const podPylon = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.22, 0.85), spineMat);
      podPylon.position.set(-0.08, 0.12, 0.12);
      podPylon.rotation.z = 0.42;
      const podTube = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.105, 1.85, 14), tiDarkMat);
      podTube.rotation.x = Math.PI / 2;
      const podLens = new THREE.Mesh(new THREE.ConeGeometry(0.105, 0.30, 6), canopyMat);
      podLens.rotation.x = -Math.PI / 2;
      podLens.position.z = -1.07;
      podGroup.add(podPylon, podTube, podLens);
      group.add(podGroup);

      // Extended tail-base parabrake / ECM fairing exclusive to Block 70 F-16V
      const tailPod = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.145, 1.48, 12), spineMat);
      tailPod.rotation.x = Math.PI / 2;
      tailPod.scale.set(0.92, 1.0, 1.38);
      tailPod.position.set(0, 0.50, half * 0.78);
      tailPod.name = 'f16vParabrakeFairing';
      group.add(tailPod);
      // Dorsal UHF / SATCOM blade antenna & GPS dome mounted cleanly on top of spine
      const satBlade = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.13, 0.24), tiDarkMat);
      satBlade.position.set(0, 0.99, half * 0.10);
      satBlade.rotation.x = 0.22;
      group.add(satBlade);
      const gpsDome = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.068, 0.032, 12), spineMat);
      gpsDome.position.set(0, 0.90, -half * 0.10);
      group.add(gpsDome);
    }

    // 3. Aft Canopy Arch Bulkhead & Spine Blend (strictly aft of hingeZ so dome stays unobstructed)
    const archFairing = new THREE.Mesh(
      new THREE.CylinderGeometry(isViper ? 0.34 : 0.24, 0.32, half * 0.14, 20, 1, false, -Math.PI * 0.5, Math.PI),
      spineMat
    );
    archFairing.rotation.x = -Math.PI / 2;
    archFairing.scale.set(1.0, 0.72, 1.0);
    archFairing.position.set(0, 0.35, -half * 0.175);
    archFairing.name = 'f16CanopyAftFairing';
    group.add(archFairing);

    // 4. Streamlined Hinged One-Piece Bubble Canopy (pivots around aft arch hinge for cold/parked states)
    const canopyPivot = new THREE.Group();
    canopyPivot.name = 'f16CanopyPivot';
    const hingeY = 0.84, hingeZ = -half * 0.245;
    canopyPivot.position.set(0, hingeY, hingeZ);
    const canopyGlassGeo = buildBubbleCanopyGeometry(half);
    canopyGlassGeo.translate(0, -hingeY, -hingeZ);
    const canopyMesh = new THREE.Mesh(canopyGlassGeo, canopyMat);
    canopyMesh.name = 'f16CanopyGlass';
    canopyPivot.add(canopyMesh);

    // Thin matte black aft arch frame & canopy side rails (forward dome stays 100% frameless)
    const aftCollar = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.018, 8, 20, Math.PI), tiDarkMat);
    aftCollar.position.set(0, 0.42 - hingeY, 0.0);
    aftCollar.scale.set(1.02, 0.56, 1.0);
    canopyPivot.add(aftCollar);
    for (const s of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.036, half * 0.26), tiDarkMat);
      rail.position.set(s * 0.415, 0.41 - hingeY, -half * 0.13);
      canopyPivot.add(rail);
    }
    group.add(canopyPivot);

    // 5. MCID Big-Mouth Chin Intake w/ boundary layer diverter, interior tunnel & compressor fan
    const intakeMesh = new THREE.Mesh(buildChinIntakeGeometry(half), spineMat);
    intakeMesh.name = 'f16ChinIntake';
    group.add(intakeMesh);

    // Diverter boundary-layer vertical splitter post in upper intake gap
    const diverter = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.14, 0.42), tiDarkMat);
    diverter.position.set(0, -0.34, -half * 0.59);
    group.add(diverter);

    // Dark hollow intake throat & internal compressor bullet cone + fan blades
    const intakeHole = new THREE.Mesh(new THREE.CircleGeometry(0.37, 24), intakeDarkMat);
    intakeHole.scale.set(1.22, 0.68, 1);
    intakeHole.position.set(0, -0.58, -half * 0.56);
    intakeHole.rotation.y = Math.PI;
    group.add(intakeHole);

    const intakeTunnel = new THREE.Mesh(new THREE.CylinderGeometry(0.41, 0.44, 1.9, 24, 1, true), intakeDarkMat);
    intakeTunnel.rotation.x = Math.PI / 2;
    intakeTunnel.scale.set(1.10, 0.72, 1);
    intakeTunnel.position.set(0, -0.56, -half * 0.43);
    group.add(intakeTunnel);

    const fanGroup = new THREE.Group();
    fanGroup.position.set(0, -0.52, -half * 0.31);
    const fanCone = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.24, 14), metalMat);
    fanCone.rotation.x = -Math.PI / 2;
    fanGroup.add(fanCone);
    for (let fb = 0; fb < 16; fb++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.32, 0.012), metalMat);
      const ang = (fb / 16) * Math.PI * 2;
      blade.position.set(Math.cos(ang) * 0.16, Math.sin(ang) * 0.16, 0.05);
      blade.rotation.z = ang + Math.PI / 2;
      fanGroup.add(blade);
    }
    group.add(fanGroup);

    // 6. Clipped-Delta Main Wings (40 deg LE sweep, 4% thin airfoil) + Articulated LEF & Flaperons
    const leFlaps = [], flaperons = [];
    const tipX = span * 0.96;
    for (const side of [-1, 1]) {
      const mir = side < 0;
      const wingStations = [
        { x: 0.76, leadZ: -half * 0.22, chord: 4.55, y: 0.02, thick: 0.048, camber: 0.012, twist: 0 },
        { x: span * 0.54, leadZ: half * 0.04, chord: 2.75, y: 0.01, thick: 0.044, camber: 0.010, twist: -0.01 },
        { x: tipX, leadZ: half * 0.24, chord: 1.24, y: 0.0, thick: 0.040, camber: 0.008, twist: -0.02 }
      ];
      const wGeo = typeof AeroCraft !== 'undefined'
        ? AeroCraft.buildWingLoft(wingStations, { slices: 22, mirror: mir, capTip: false })
        : new THREE.BoxGeometry(span * 0.85, 0.12, 2.4);
      const wMesh = new THREE.Mesh(wGeo, airframeMat);
      wMesh.name = mir ? 'f16WingPort' : 'f16WingStbd';
      group.add(wMesh);

      // Articulated Leading-Edge Flap (LEF) along outer swept leading edge (hugged to exact sweep)
      const lefPivot = new THREE.Group();
      const lefDx = tipX - 0.96;
      const lefDz = half * 0.43;
      const lefLen = Math.hypot(lefDx, lefDz);
      const lefSweep = Math.atan2(lefDz, lefDx);
      lefPivot.position.set(side * ((0.96 + tipX) * 0.5), 0.008, half * 0.015);
      lefPivot.rotation.order = 'YXZ';
      lefPivot.rotation.y = -side * lefSweep;
      const lefBar = new THREE.Mesh(new THREE.BoxGeometry(lefLen, 0.036, 0.24), spineMat);
      lefBar.position.set(0, 0, -0.08);
      lefPivot.add(lefBar);
      group.add(lefPivot);
      leFlaps.push({ pivot: lefPivot, side });

      // Articulated Trailing-Edge Flaperon
      const fpPivot = new THREE.Group();
      const fpSpan = tipX - 1.18;
      fpPivot.position.set(side * (1.18 + fpSpan * 0.5), 0.0, half * 0.355);
      const fpSurf = new THREE.Mesh(new THREE.BoxGeometry(fpSpan, 0.036, 0.36), spineMat);
      fpSurf.position.set(0, 0, 0.18);
      fpPivot.add(fpSurf);
      group.add(fpPivot);
      flaperons.push({ pivot: fpPivot, side });

      // Wingtip 16S210 Launcher Rail + AIM-120C AMRAAM (flush at wingtip X)
      const tipRail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.09, 2.55), tiDarkMat);
      tipRail.position.set(side * tipX, 0.0, half * 0.28);
      group.add(tipRail);
      const tipMissile = buildWingPylonAndStore(airframeMat, tiDarkMat, missileMat, blueBandMat, true);
      tipMissile.position.set(side * (tipX + 0.065), 0.0, half * 0.22);
      group.add(tipMissile);

      // Station 2/8 Outboard Underwing Pylon + AIM-9X Sidewinder
      const pyMesh = typeof AeroCraft !== 'undefined'
        ? new THREE.Mesh(AeroCraft.buildAeroPylonGeometry(0.28, 1.55, 1.85, 0.08, 0.18), spineMat)
        : new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.28, 1.55), spineMat);
      pyMesh.position.set(side * (span * 0.66), -0.14, half * 0.16);
      group.add(pyMesh);
      const obMsl = buildWingPylonAndStore(airframeMat, tiDarkMat, missileMat, blueBandMat, false);
      obMsl.position.set(side * (span * 0.66), -0.31, half * 0.14);
      group.add(obMsl);
    }

    // 7. All-Moving Differential Horizontal Stabilators
    const stabilators = [];
    for (const side of [-1, 1]) {
      const mir = side < 0;
      const stabPivot = new THREE.Group();
      stabPivot.position.set(side * 0.72, 0.02, half * 0.72);
      const stabGeo = typeof AeroCraft !== 'undefined'
        ? AeroCraft.buildWingLoft([
            { x: 0.04, leadZ: -0.78, chord: 1.92, y: 0, thick: 0.055, camber: 0, twist: 0 },
            { x: 1.12, leadZ: 0.08, chord: 1.24, y: -0.02, thick: 0.045, camber: 0, twist: 0 },
            { x: 1.92, leadZ: 0.68, chord: 0.64, y: -0.03, thick: 0.038, camber: 0, twist: 0 }
          ], { slices: 18, mirror: mir })
        : new THREE.BoxGeometry(1.9, 0.06, 1.3);
      const stabMesh = new THREE.Mesh(stabGeo, spineMat);
      stabMesh.name = mir ? 'f16StabPort' : 'f16StabStbd';
      stabPivot.add(stabMesh);
      group.add(stabPivot);
      stabilators.push({ pivot: stabPivot, side });
    }

    // 8. Tall Swept Vertical Stabilizer + Swept Rudder + RWR Cap + Canted Twin Ventral Fins
    // Tip reaches y = 3.04m -> total aircraft height from runway (-1.85m) = 4.89m!
    const finGeo = typeof AeroCraft !== 'undefined'
      ? AeroCraft.buildVerticalFoilLoft([
          { x: 0, y: 0.42, leadZ: half * 0.25, chord: 2.75, thick: 0.065 },
          { x: 0, y: 1.45, leadZ: half * 0.41, chord: 1.88, thick: 0.055 },
          { x: 0, y: 2.65, leadZ: half * 0.57, chord: 1.05, thick: 0.048 },
          { x: 0, y: 3.00, leadZ: half * 0.62, chord: 0.84, thick: 0.042 }
        ], { slices: 20 })
      : new THREE.BoxGeometry(0.12, 2.6, 2.2);
    const finMesh = new THREE.Mesh(finGeo, airframeMat);
    finMesh.name = 'f16VerticalFin';
    group.add(finMesh);

    const rudderCap = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 1.18), tiDarkMat);
    rudderCap.position.set(0, 3.01, half * 0.685);
    group.add(rudderCap);

    const tailBeacon = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), new THREE.MeshStandardMaterial({
      color: 0xff2820, emissive: 0xff2010, emissiveIntensity: 1.1, roughness: 0.3
    }));
    tailBeacon.position.set(0, 3.08, half * 0.72);
    group.add(tailBeacon);

    const hingeBotZ = half * 0.25 + 2.75;
    const hingeTopZ = half * 0.62 + 0.84;
    const hingeDy = 3.00 - 0.42;
    const hingeTilt = Math.atan2(hingeTopZ - hingeBotZ, hingeDy);
    const rudderPivot = new THREE.Group();
    rudderPivot.position.set(0, 1.70, (hingeBotZ + hingeTopZ) * 0.5);
    rudderPivot.rotation.x = hingeTilt;
    const rudderYawPivot = new THREE.Group();
    rudderYawPivot.name = 'f16Rudder';
    const rudderGeo = typeof AeroCraft !== 'undefined'
      ? AeroCraft.buildVerticalFoilLoft([
          { x: 0, y: -1.16, leadZ: -0.02, chord: 0.66, thick: 0.06 },
          { x: 0, y: 0.0, leadZ: -0.02, chord: 0.52, thick: 0.055 },
          { x: 0, y: 1.18, leadZ: -0.02, chord: 0.36, thick: 0.05 }
        ], { slices: 12 })
      : new THREE.BoxGeometry(0.05, 2.25, 0.52);
    const rudderSurf = new THREE.Mesh(rudderGeo, spineMat);
    rudderYawPivot.add(rudderSurf);
    rudderPivot.add(rudderYawPivot);
    group.add(rudderPivot);

    // Twin canted anti-spin ventral fins beneath aft engine trunk (clearance safe > -1.35m vs -1.85m gear)
    const vfGeo = typeof AeroCraft !== 'undefined'
      ? AeroCraft.buildVerticalFoilLoft([
          { x: 0, y: 0.0, leadZ: -0.46, chord: 1.44, thick: 0.032 },
          { x: 0, y: -0.50, leadZ: 0.08, chord: 0.84, thick: 0.026 }
        ], { slices: 10 })
      : new THREE.BoxGeometry(0.036, 0.50, 1.30);
    for (const side of [-1, 1]) {
      const vfPivot = new THREE.Group();
      vfPivot.position.set(side * 0.36, -0.42, half * 0.57);
      vfPivot.rotation.z = side * 0.34;
      const vfFin = new THREE.Mesh(vfGeo, spineMat);
      vfPivot.add(vfFin);
      group.add(vfPivot);
    }

    // Split clam-shell aft speedbrake petals (left/right top+bottom pairs)
    const speedbrakes = [];
    for (const side of [-1, 1]) {
      for (const ud of [-1, 1]) {
        const sbPivot = new THREE.Group();
        sbPivot.position.set(side * 0.56, ud * 0.14, half * 0.72);
        const sbPlate = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.74), tiDarkMat);
        sbPlate.position.set(side * 0.04, 0, 0.36);
        sbPivot.add(sbPlate);
        group.add(sbPivot);
        speedbrakes.push({ pivot: sbPivot, side, ud });
      }
    }

    // 9. Variable Convergent-Divergent F110 Exhaust Nozzle + Supersonic Shock-Diamond Plume
    const nozzleGroup = new THREE.Group();
    nozzleGroup.name = 'f16ExhaustNozzle';
    nozzleGroup.position.set(0, 0, half * 0.895);
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.51, 0.036, 10, 32), metalMat);
    nozzleGroup.add(collar);
    const burnerChamber = new THREE.Mesh(new THREE.CircleGeometry(0.47, 24), new THREE.MeshStandardMaterial({
      color: 0x1a1d22, emissive: 0xff5a18, emissiveIntensity: 0.08, roughness: 0.6
    }));
    burnerChamber.position.z = -0.18;
    nozzleGroup.add(burnerChamber);

    const nozzlePetals = [];
    for (let p = 0; p < 15; p++) {
      const ang = (p / 15) * Math.PI * 2;
      const pPivot = new THREE.Group();
      pPivot.position.set(Math.cos(ang) * 0.50, Math.sin(ang) * 0.50, 0);
      pPivot.rotation.z = ang + Math.PI * 0.5;
      const petal = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.032, 0.68), p % 2 ? tiDarkMat : metalMat);
      petal.position.set(0, -0.02, 0.34);
      petal.rotation.x = 0.08;
      pPivot.add(petal);
      nozzleGroup.add(pPivot);
      nozzlePetals.push({ pivot: pPivot, mesh: petal });
    }
    group.add(nozzleGroup);

    const abPlumeMat = new THREE.MeshBasicMaterial({
      color: 0xffa642, transparent: true, opacity: 0.0, depthWrite: false
    });
    const abCoreGeo = new THREE.ConeGeometry(0.36, 2.8, 16);
    abCoreGeo.rotateX(Math.PI / 2);
    const abPlume = new THREE.Mesh(abCoreGeo, abPlumeMat);
    abPlume.position.set(0, 0, half * 0.96 + 1.4);
    abPlume.visible = false;
    group.add(abPlume);

    // 10. Tricycle Landing Gear anchored cleanly at y = -gearH (-1.85m) w/ forward nose strut + main A-frames
    const wheels = [];
    const noseBay = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.22, 1.15), intakeDarkMat);
    noseBay.position.set(0, -0.78, -half * 0.43);
    group.add(noseBay);

    const noseGearPivot = new THREE.Group();
    noseGearPivot.name = 'f16NoseGearPivot';
    noseGearPivot.position.set(0, -0.76, -half * 0.46); // mount just aft of chin intake lip
    const noseTurnPivot = new THREE.Group();
    noseGearPivot.add(noseTurnPivot);
    const nWheelR = 0.22;
    // Nose wheel axle at target y = -gearH + nWheelR = -1.63m -> relative dy = -0.87m, dz = -0.32m forward rake!
    const nStrut = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.044, 0.96, 12), metalMat);
    nStrut.position.set(0, -0.44, -0.15);
    nStrut.rotation.x = -0.34;
    const nPiston = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.34, 10), metalMat);
    nPiston.position.set(0, -0.72, -0.25);
    nPiston.rotation.x = -0.34;
    const nLamp = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.14, 0.08), new THREE.MeshStandardMaterial({
      color: 0xffffff, emissive: 0xffeacc, emissiveIntensity: 0.75, roughness: 0.2
    }));
    nLamp.position.set(0, -0.58, -0.24);
    const nAxleGroup = new THREE.Group();
    nAxleGroup.position.set(0, -gearH + nWheelR - (-0.76), -0.31);
    const nWheel = addWheelGroup(nAxleGroup, nWheelR, 0.14, tireMat, metalMat, 'f16NoseWheel');
    wheels.push(nWheel);
    noseTurnPivot.add(nStrut, nPiston, nLamp, nAxleGroup);
    gear.add(noseGearPivot);

    const noseDoorPivot = new THREE.Group();
    noseDoorPivot.position.set(-0.20, -0.84, -half * 0.46);
    const nDoor = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.38, 0.96), spineMat);
    nDoor.position.set(0, -0.19, 0.14);
    noseDoorPivot.add(nDoor);
    gear.add(noseDoorPivot);

    const mainGearPivots = [], mainDoorPivots = [];
    const mWheelR = 0.31;
    for (const side of [-1, 1]) {
      const mBay = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.24, 1.35), intakeDarkMat);
      mBay.position.set(side * 0.56, -0.52, half * 0.06);
      group.add(mBay);

      const mPivot = new THREE.Group();
      mPivot.name = side < 0 ? 'f16MainGearPort' : 'f16MainGearStbd';
      mPivot.position.set(side * 0.58, -0.52, half * 0.08);
      // Tire rests at x = side*1.18m, y = -gearH + mWheelR = -1.54m (local y = -1.02m, x = side*0.60m)
      const dx = side * 0.58, dy = -gearH + mWheelR - (-0.52); // -1.02m
      const strutLen = Math.hypot(dx, dy);
      const mStrut = new THREE.Mesh(new THREE.CylinderGeometry(0.064, 0.052, strutLen, 12), metalMat);
      mStrut.position.set(dx * 0.5, dy * 0.5, 0);
      mStrut.rotation.z = side * Math.atan2(0.58, 1.02);
      const diagBrace = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, strutLen * 0.78, 10), metalMat);
      diagBrace.position.set(dx * 0.38, dy * 0.34, -0.22);
      diagBrace.rotation.z = side * 0.48;
      diagBrace.rotation.x = 0.34;
      const mAxleG = new THREE.Group();
      mAxleG.position.set(dx, dy, 0.04);
      const mWheel = addWheelGroup(mAxleG, mWheelR, 0.22, tireMat, metalMat, side < 0 ? 'f16MainWheelL' : 'f16MainWheelR');
      wheels.push(mWheel);
      mPivot.add(mStrut, diagBrace, mAxleG);
      gear.add(mPivot);
      mainGearPivots.push({ pivot: mPivot, side });

      const mDoorPivot = new THREE.Group();
      mDoorPivot.position.set(side * 0.68, -0.58, half * 0.06);
      const mDoor = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.54, 1.08), spineMat);
      mDoor.position.set(0, -0.26, 0);
      mDoorPivot.add(mDoor);
      gear.add(mDoorPivot);
      mainDoorPivots.push({ pivot: mDoorPivot, side });
    }

    // 11. Conformal Wing & Fin Squadron Markings (fitted onto actual airfoil & tail trap, zero floating)
    const finDecalMat = new THREE.MeshBasicMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide
    });
    const wingDecalMat = new THREE.MeshBasicMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide
    });
    const finDecals = [];
    for (const s of [-1, 1]) {
      const fd = new THREE.Mesh(new THREE.PlaneGeometry(0.88, 0.96), finDecalMat);
      fd.position.set(s * 0.056, 1.88, half * 0.59);
      fd.rotation.y = s * Math.PI * 0.5;
      fd.name = 'f16ConformalTailArt';
      group.add(fd);
      finDecals.push(fd);
    }
    const wingRoundels = [];
    for (const s of [-1, 1]) {
      const wd = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.56), wingDecalMat);
      wd.position.set(s * (span * 0.58), 0.094, half * 0.14);
      wd.rotation.x = -Math.PI * 0.5;
      wd.name = 'f16ConformalRoundel';
      group.add(wd);
      wingRoundels.push(wd);
    }

    function applyConformalLivery(themeId) {
      if (typeof aircraftSkins === 'undefined') return;
      const tId = themeId || aircraftSkins.getSelectedTheme?.() || 'default';
      finDecalMat.map = aircraftSkins.createFighterTailTexture(THREE, profile, tId);
      finDecalMat.needsUpdate = true;
      wingDecalMat.map = aircraftSkins.createRoundelTexture(THREE, tId === 'camo');
      wingDecalMat.needsUpdate = true;
      group.userData.skinApplied = true;
      group.userData.skinTheme = tId;
    }
    applyConformalLivery();

    // 12. Pilot external helmet/torso (hidden when camera is inside cockpit/panel/night)
    const pilotGroup = new THREE.Group();
    pilotGroup.name = 'f16ExternalPilot';
    pilotGroup.position.set(0, 0.42, -half * 0.39);
    const torsoMat = new THREE.MeshStandardMaterial({ color: 0x3b483f, roughness: 0.75 });
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.145, 0.22, 6, 10), torsoMat);
    torso.scale.set(1.0, 1.0, 0.66);
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.125, 16, 12), new THREE.MeshStandardMaterial({ color: 0xd0d6db, roughness: 0.32 }));
    helmet.position.set(0, 0.24, -0.01);
    const visor = new THREE.Mesh(new THREE.SphereGeometry(0.128, 14, 10, Math.PI * 0.55, Math.PI * 0.9, Math.PI * 0.2, Math.PI * 0.55), tiDarkMat);
    visor.position.set(0, 0.24, -0.02);
    pilotGroup.add(torso, helmet, visor);
    group.add(pilotGroup);

    group.userData = {
      f16HighDef: true,
      variant,
      skipGenericFighterRefinement: true,
      skipGenericFighterDecals: true,
      gear,
      cabin,
      surfaces: [...flaperons.map((x) => x.pivot)],
      flaps: [...leFlaps.map((x) => x.pivot), ...flaperons.map((x) => x.pivot)],
      wheels,
      blades: [fanGroup],
      palletMeshes: [],
      exhaustPlumes: [abPlume],
      propDiscs: [],
      navLights: [],
      cockpitCanopy: canopyMesh,
      cockpitGlassMats: [canopyMat],
      half,
      radius,
      pilotGroup,
      canopyPivot,
      applyConformalLivery
    };

    // Build Dedicated Block 50 vs Block 70 Viper Cockpit
    refineF16FlightDeck(group, profile);

    let smoothGear = 1.0, smoothCanopy = 0.0, smoothBrake = 0.0, smoothThrottle = 0.0;

    group.userData.updateGear = function updateF16Gear(gProg, dt, f, paused) {
      const target = typeof gProg === 'number' ? clampVal(gProg, 0, 1) : 1;
      const step = clampVal((dt || 0.016) * 2.4, 0, 1);
      smoothGear += (target - smoothGear) * (paused ? 0 : step);
      const retract = 1 - smoothGear;

      noseGearPivot.rotation.x = retract * 1.62;
      noseDoorPivot.rotation.z = smoothGear * 1.35;
      noseGearPivot.visible = smoothGear > 0.06;
      noseDoorPivot.visible = smoothGear > 0.04;

      const steer = clampVal(-(f?.manualControls?.rudder ?? f?.rudder ?? 0) * 0.42, -0.45, 0.45);
      noseTurnPivot.rotation.y = f?.ground ? steer : 0;

      // Subtle oleo weight-on-wheels compression
      const wow = f?.ground ? clampVal(0.05 + (f.vy ? -f.vy * 0.01 : 0), 0.02, 0.11) : 0;
      gear.position.y = wow;
      gear.visible = smoothGear > 0.04;

      for (const mg of mainGearPivots) {
        mg.pivot.rotation.z = -mg.side * retract * 1.28;
        mg.pivot.rotation.x = retract * 0.34;
        mg.pivot.scale.setScalar(clampVal((smoothGear - 0.06) / 0.25, 0.15, 1.0));
        mg.pivot.visible = smoothGear > 0.06;
      }
      for (const md of mainDoorPivots) {
        md.pivot.rotation.z = -md.side * smoothGear * 1.32;
        md.pivot.visible = smoothGear > 0.04;
      }
    };

    group.userData.updateAeroSurfaces = function updateF16Surfaces(f, dt, now, paused) {
      const stepDt = paused ? 0 : clampVal(dt || 0.016, 0.001, 0.08);
      const mIn = f?.manualControls || f || {};
      const rollIn = clampVal(mIn.roll ?? 0, -1, 1);
      const pitchIn = clampVal(mIn.pitch ?? 0, -1, 1);
      const rudderIn = clampVal(mIn.rudder ?? 0, -1, 1);
      const flapDeg = clampVal((f?.flaps ?? 0) * 0.16, 0, 0.34);

      for (const lf of leFlaps) {
        const aoaDrop = f && !f.ground ? clampVal((f.pitch || 0) * 0.65, 0, 0.25) : 0;
        lf.pivot.rotation.x = -clampVal(flapDeg * 0.8 + aoaDrop, -0.04, 0.36);
      }
      for (const fp of flaperons) {
        fp.pivot.rotation.x = flapDeg + rollIn * (fp.side > 0 ? -0.26 : 0.26);
      }
      for (const sb of stabilators) {
        // Differential all-moving horizontal stabilators (tailerons)
        sb.pivot.rotation.x = pitchIn * 0.28 + rollIn * (sb.side > 0 ? -0.11 : 0.11);
      }
      rudderYawPivot.rotation.y = rudderIn * 0.34;

      const sbTarget = f?.brakes || f?.spoiler || (f?.ground && (f?.speed ?? 0) > 8 && (f?.power ?? 0) < 0.08) ? 1 : 0;
      smoothBrake += (sbTarget - smoothBrake) * Math.min(1, stepDt * 6);
      for (const sp of speedbrakes) {
        sp.pivot.rotation.x = sp.ud * smoothBrake * 0.72;
        sp.pivot.rotation.y = -sp.side * smoothBrake * 0.18;
      }

      // F110 Exhaust Nozzle Petals & Afterburner Plume
      const thr = clampVal(f?.power ?? 0, 0, 1);
      const ab = Boolean(f?.boost && thr > 0.86 && f?.engines?.[0]);
      smoothThrottle += (thr - smoothThrottle) * Math.min(1, stepDt * 7);
      const dilate = ab ? 0.24 : 0.08 - smoothThrottle * 0.10;
      for (const np of nozzlePetals) {
        np.pivot.rotation.x = dilate;
      }
      burnerChamber.material.emissiveIntensity = ab ? 2.4 : f?.engines?.[0] ? 0.15 + smoothThrottle * 0.55 : 0.02;
      abPlume.visible = ab;
      if (ab) {
        const pulse = 0.88 + 0.18 * Math.sin((now || 0) * 0.05);
        abPlume.scale.set(0.85, 0.85, pulse);
        abPlumeMat.opacity = 0.58;
      }

      // Hinged bubble canopy opens gracefully ONLY when parked cold and dark on runway
      const parkOpen = Boolean(f && f.ground && !f.battery && !f.engines?.[0] && (f.speed || 0) < 1.5);
      smoothCanopy += ((parkOpen ? 1 : 0) - smoothCanopy) * Math.min(1, stepDt * 3.5);
      canopyPivot.rotation.x = smoothCanopy * 0.38;

      // Spin MCID internal turbine fan gently when engine runs
      if (f?.engines?.[0] && !paused) {
        fanGroup.rotation.z += stepDt * (8 + smoothThrottle * 32);
      }

      // Refresh cockpit displays/HUD/HOTAS every frame
      group.userData.updateFighterDeck?.(f, now);
    };

    return group;
  }

  function refineF16FlightDeck(model, profile) {
    const data = model.userData;
    const cabin = data.cabin;
    if (!cabin) return;
    for (const c of [...cabin.children]) {
      c.traverse?.((o) => o.geometry?.dispose?.());
      cabin.remove(c);
    }

    const half = profile.geometry?.[0] ?? 7.40;
    const isViper = profile.id === 'f16v';
    const eye = { x: 0, y: 0.87, z: -half * 0.422 };       // ~ -3.12m (forward view w/ runway & HUD)
    const panelEye = { x: 0, y: 0.79, z: -half * 0.432 };  // ~ -3.20m (instrument cluster view)
    data.cockpitEye = eye;
    data.cockpitPanelEye = panelEye;

    const bezelMat = new THREE.MeshStandardMaterial({ color: isViper ? 0x1b2026 : 0x222930, roughness: 0.72, metalness: 0.25 });
    const consoleMat = new THREE.MeshStandardMaterial({ color: isViper ? 0x20262c : 0x29323b, roughness: 0.78, metalness: 0.18 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x8b96a0, roughness: 0.32, metalness: 0.75 });
    const seatMat = new THREE.MeshStandardMaterial({ color: 0x2f3b35, roughness: 0.85, metalness: 0.12 });
    const keyMat = new THREE.MeshStandardMaterial({ color: 0x4b555f, roughness: 0.5, metalness: 0.3 });
    const floodMat = new THREE.MeshStandardMaterial({ color: 0x3b4046, roughness: 0.6 });

    function addPart(geo, mat, x, y, z, rx = 0, ry = 0, rz = 0, name) {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      if (rx || ry || rz) m.rotation.set(rx, ry, rz);
      if (name) m.name = name;
      cabin.add(m);
      return m;
    }

    const pZ = eye.z - 0.70; // ~ -3.82m main instrument panel
    const pY = 0.50;

    // Anti-glare cockpit coaming, lower tub floor/sidewalls & sleek F-16 canopy sill rails
    addPart(new THREE.BoxGeometry(0.66, 0.42, 0.12), consoleMat, 0, pY - 0.04, pZ - 0.08, -0.08, 0, 0, 'f16MipBackbone');
    addPart(new THREE.BoxGeometry(0.64, 0.055, 0.38), consoleMat, 0, pY + 0.19, pZ - 0.10, -0.05, 0, 0, 'f16Glareshield');
    addPart(new THREE.BoxGeometry(0.24, 0.24, 0.92), consoleMat, -0.34, 0.26, eye.z - 0.10, 0, 0, 0, 'f16ConsoleL');
    addPart(new THREE.BoxGeometry(0.24, 0.24, 0.92), consoleMat, 0.34, 0.26, eye.z - 0.10, 0, 0, 0, 'f16ConsoleR');
    addPart(new THREE.BoxGeometry(0.46, 0.06, 0.98), consoleMat, 0, 0.14, eye.z - 0.08, 0, 0, 0, 'f16CockpitFloor');
    for (const s of [-1, 1]) {
      addPart(new THREE.BoxGeometry(0.042, 0.045, 1.35), bezelMat, s * 0.405, 0.445, eye.z - 0.28, -0.03, 0, 0);
    }

    // Reclined 30 deg ACES II ejection seat placed behind eye (headrest at eye.z + 0.34)
    addPart(new THREE.BoxGeometry(0.36, 0.08, 0.40), seatMat, 0, 0.22, eye.z + 0.04, -0.18);
    addPart(new THREE.BoxGeometry(0.36, 0.56, 0.08), seatMat, 0, 0.46, eye.z + 0.26, -0.48, 0, 0, 'f16AcesSeatBack');
    const ejectLoop = addPart(new THREE.TorusGeometry(0.036, 0.01, 8, 16), new THREE.MeshStandardMaterial({
      color: 0xe3b82a, emissive: 0x332600, roughness: 0.4
    }), 0, 0.26, eye.z - 0.15, Math.PI * 0.45);
    ejectLoop.name = 'f16EjectHandle';

    // Console backlit decal strips (adjustable night NVG / flood glow)
    const consoleGlowMats = [];
    for (const s of [-1, 1]) {
      const cC = makeCanvas(256, 512);
      const ctx = cC.getContext('2d');
      ctx.fillStyle = '#181e22'; ctx.fillRect(0, 0, 256, 512);
      ctx.strokeStyle = '#334248'; ctx.lineWidth = 3;
      const labelsL = ['UHF / COMM', 'ANT SEL', 'EXT LIGHTS', 'ENG & JET START', 'EPU / FUEL', 'FLT CTRL'];
      const labelsR = ['AVIONICS PWR', 'SMS / STORES', 'SNSR / RDR', 'INS / GPS', 'HUD / ICP OPT', 'ECS / OXY'];
      const arr = s < 0 ? labelsL : labelsR;
      for (let b = 0; b < 6; b++) {
        const y0 = 14 + b * 82;
        ctx.strokeRect(12, y0, 232, 72);
        ctx.fillStyle = isViper ? '#7cff9b' : '#b2f79c';
        ctx.font = 'bold 18px monospace';
        ctx.fillText(arr[b], 24, y0 + 26);
        for (let k = 0; k < 4; k++) {
          ctx.fillStyle = k === 1 ? '#ffb648' : '#7ea892';
          ctx.fillRect(24 + k * 50, y0 + 40, 28, 14);
        }
      }
      const cTex = makeTex(cC, true);
      const cMat = new THREE.MeshStandardMaterial({
        map: cTex, emissiveMap: cTex, emissive: isViper ? 0x62ff90 : 0x98f288,
        emissiveIntensity: 0.35, roughness: 0.65
      });
      cMat.userData = { ...(cMat.userData || {}), preserveEmissive: true };
      consoleGlowMats.push(cMat);
      addPart(new THREE.PlaneGeometry(0.21, 0.84), cMat, s * 0.34, 0.383, eye.z - 0.10, -Math.PI * 0.5, 0, 0);
    }

    // Animated HOTAS: Left F110 linear throttle & Right SSC sidestick & Left Landing Gear Handle
    const throttlePivot = new THREE.Group();
    throttlePivot.position.set(-0.33, 0.39, eye.z - 0.04);
    const thrTrack = addPart(new THREE.BoxGeometry(0.05, 0.025, 0.24), bezelMat, -0.33, 0.388, eye.z - 0.04);
    const thrShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.11, 10), metalMat);
    thrShaft.position.y = 0.055;
    const thrGrip = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.042, 0.088), bezelMat);
    thrGrip.position.set(0.01, 0.105, -0.01);
    const abDetentMat = new THREE.MeshStandardMaterial({ color: 0xff8a22, emissive: 0xff5a00, emissiveIntensity: 0.0 });
    abDetentMat.userData = { preserveEmissive: true };
    const abLed = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 8), abDetentMat);
    abLed.position.set(0.04, 0.115, -0.04);
    throttlePivot.add(thrShaft, thrGrip, abLed);
    cabin.add(throttlePivot);

    const stickPivot = new THREE.Group();
    stickPivot.position.set(0.32, 0.39, eye.z - 0.04);
    const stickShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.018, 0.13, 10), metalMat);
    stickShaft.position.y = 0.065;
    const stickGrip = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.095, 0.058), bezelMat);
    stickGrip.position.set(0, 0.13, -0.01);
    stickGrip.rotation.x = 0.15;
    stickPivot.add(stickShaft, stickGrip);
    cabin.add(stickPivot);

    const gearPivot = new THREE.Group();
    gearPivot.position.set(-0.27, 0.45, pZ + 0.06);
    const gArm = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.02, 0.06), metalMat);
    gArm.position.z = 0.03;
    const gKnob = new THREE.Mesh(new THREE.CylinderGeometry(0.020, 0.020, 0.016, 14), new THREE.MeshStandardMaterial({
      color: 0xe6edf4, emissive: 0x35c97a, emissiveIntensity: 0.4, roughness: 0.35
    }));
    gKnob.rotation.z = Math.PI * 0.5;
    gKnob.position.z = 0.06;
    gearPivot.add(gArm, gKnob);
    cabin.add(gearPivot);

    // MFD Screens (Left & Right on both; F-16V adds big Center Pedestal Display CPD!)
    function addScreen(w, h, x, y, z, cw, ch, name) {
      addPart(new THREE.BoxGeometry(w + 0.036, h + 0.036, 0.036), bezelMat, x, y, z - 0.016, -0.08);
      for (let k = 0; k < 5; k++) {
        const ofs = -w * 0.36 + k * (w * 0.18);
        addPart(new THREE.BoxGeometry(0.014, 0.010, 0.014), keyMat, x + ofs, y + h * 0.5 + 0.012, z + 0.002);
        addPart(new THREE.BoxGeometry(0.014, 0.010, 0.014), keyMat, x + ofs, y - h * 0.5 - 0.012, z + 0.002);
      }
      const cvs = makeCanvas(cw, ch);
      const tex = makeTex(cvs, true);
      const sMat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
      addPart(new THREE.PlaneGeometry(w, h), sMat, x, y, z + 0.006, -0.08, 0, 0, name);
      return { ctx: cvs.getContext('2d'), tex, w: cw, h: ch };
    }

    const leftMfd = addScreen(0.145, 0.145, isViper ? -0.205 : -0.175, 0.47, pZ + 0.02, 320, 320, 'f16LeftMfd');
    const rightMfd = addScreen(0.145, 0.145, isViper ? 0.205 : 0.175, 0.47, pZ + 0.02, 320, 320, 'f16RightMfd');
    const cpdScreen = isViper ? addScreen(0.18, 0.22, 0.0, 0.415, pZ + 0.03, 384, 460, 'f16vCpd') : null;
    const centerCluster = !isViper ? addScreen(0.12, 0.15, 0.0, 0.46, pZ + 0.025, 256, 320, 'f16cCenterCluster') : null;
    const rwrScope = addScreen(0.082, 0.082, -0.17, 0.60, pZ + 0.02, 192, 192, 'f16RwrScope');
    const dedScreen = addScreen(0.115, 0.056, 0.175, 0.60, pZ + 0.022, 256, 128, 'f16Ded');

    // Illuminated ICP (Integrated Control Panel) right under HUD
    const icpCvs = makeCanvas(256, 224);
    const icpCtx = icpCvs.getContext('2d');
    icpCtx.fillStyle = '#181e24'; icpCtx.fillRect(0, 0, 256, 224);
    icpCtx.fillStyle = '#a0f5a8'; icpCtx.font = 'bold 17px monospace';
    ['COM1', 'COM2', 'IFF', 'LIST', 'A-A', 'A-G'].forEach((t, idx) => {
      const col = idx < 4 ? idx : idx - 4;
      const x = idx < 4 ? 14 + col * 58 : 14 + (col + 4) * 0;
      if (idx < 4) { icpCtx.strokeStyle = '#5c726c'; icpCtx.strokeRect(x, 12, 50, 28); icpCtx.fillText(t, x + 5, 32); }
    });
    const keys = ['1 T-ILS', '2 ALOW', '3 ', '4 STPT', '5 CRUS', '6 TIME', '7 MARK', '8 FIX', '9 A-CAL', 'RCL', '0 M-SEL', 'ENTR'];
    for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) {
      const x = 18 + c * 62, y = 50 + r * 40;
      icpCtx.fillStyle = '#252f36'; icpCtx.fillRect(x, y, 52, 32);
      icpCtx.strokeStyle = '#6f8780'; icpCtx.strokeRect(x, y, 52, 32);
      icpCtx.fillStyle = '#b4f8b8'; icpCtx.font = 'bold 12px monospace';
      icpCtx.fillText(keys[r * 3 + c], x + 4, y + 21);
    }
    const icpTex = makeTex(icpCvs, true);
    const icpMat = new THREE.MeshStandardMaterial({
      map: icpTex, emissiveMap: icpTex, emissive: 0x7eff96, emissiveIntensity: 0.45, roughness: 0.55
    });
    icpMat.userData = { preserveEmissive: true };
    addPart(new THREE.BoxGeometry(0.155, 0.132, 0.032), bezelMat, 0, 0.615, pZ + 0.01);
    addPart(new THREE.PlaneGeometry(0.135, 0.118), icpMat, 0, 0.615, pZ + 0.030, -0.05, 0, 0, 'f16Icp');

    // Collimated Wide-Angle WAR / WAC HUD directly above ICP along forward sightline (unobstructed glass!)
    const hudH = 0.25, hudW = 0.24, hudY = 0.805, hudZ = pZ + 0.02;
    const hudGlassMat = new THREE.MeshPhysicalMaterial({
      color: 0x9cf0c8, transparent: true, opacity: 0.055, roughness: 0.08, metalness: 0.05,
      side: THREE.DoubleSide, depthWrite: false
    });
    addPart(new THREE.PlaneGeometry(hudW, hudH), hudGlassMat, 0, hudY, hudZ, -0.34, 0, 0, 'f16HudCombiner');
    for (const s of [-1, 1]) {
      addPart(new THREE.BoxGeometry(0.012, hudH * 0.96, 0.022), bezelMat, s * (hudW * 0.50 + 0.008), hudY, hudZ, -0.34);
    }
    addPart(new THREE.BoxGeometry(hudW + 0.02, 0.016, 0.04), bezelMat, 0, hudY - hudH * 0.48, hudZ + 0.03, -0.1);

    const hudCvs = makeCanvas(512, 512);
    const hudCtx = hudCvs.getContext('2d');
    const hudTex = makeTex(hudCvs, true);
    const hudMat = new THREE.MeshBasicMaterial({ map: hudTex, transparent: true, depthWrite: false, toneMapped: false });
    addPart(new THREE.PlaneGeometry(hudW * 0.94, hudH * 0.94), hudMat, 0, hudY, hudZ + 0.006, -0.34, 0, 0, 'f16HudSymbology');

    // Warm/NVG night cockpit floodlight reacting to #cockpitBacklight
    const floodLight = new THREE.PointLight(isViper ? 0x52ff88 : 0x7eff9a, 0.0, 2.2);
    floodLight.position.set(0, 0.78, eye.z - 0.15);
    cabin.add(floodLight);
    data.cockpitFloodLights = [floodLight];

    function setBacklight(pct) {
      const k = clampVal((Number(pct) || 70) / 100, 0, 1);
      data.cockpitBacklightLevel = Math.round(k * 100);
      floodLight.intensity = 0.08 + k * 0.62;
      icpMat.emissiveIntensity = 0.15 + k * 0.85;
      for (const cm of consoleGlowMats) cm.emissiveIntensity = 0.12 + k * 0.78;
    }
    data.setCockpitBacklight = setBacklight;
    setBacklight(72);

    let nextDraw = 0;
    data.updateFighterDeck = function updateF16Deck(f, now) {
      // Keep external helmet visible only outside active cockpit/panel/night inspections
      if (data.pilotGroup) {
        data.pilotGroup.visible = !data.inFirstPersonCockpit;
      }

      // Continuous HOTAS animation regardless of draw throttle
      const thr = clampVal(f?.power ?? 0.35, 0, 1);
      throttlePivot.position.z = (eye.z - 0.04) - thr * 0.12;
      throttlePivot.rotation.x = -thr * 0.18;
      abDetentMat.emissiveIntensity = (f?.boost && thr > 0.86) ? 1.8 : 0.0;

      const mPitch = clampVal(f?.manualControls?.pitch ?? 0, -1, 1);
      const mRoll = clampVal(f?.manualControls?.roll ?? 0, -1, 1);
      stickPivot.rotation.x = mPitch * 0.10;
      stickPivot.rotation.z = -mRoll * 0.10;
      gearPivot.rotation.x = (f ? f.gear : true) ? 0.25 : -0.35;

      const tNow = now ?? Date.now();
      if (tNow < nextDraw) return;
      nextDraw = tNow + 85;

      const on = f ? Boolean(f.battery ?? true) : true;
      const spdObj = f && typeof flightSpeeds === 'function' ? flightSpeeds(f) : { ias: (f?.speed ?? 0), mach: 0 };
      const iasKts = f ? Math.round((spdObj.ias || 0) * 1.94384) : 0;
      const altFt = f ? Math.round((f.y || 0) * 3.28084) : 45;
      const hdgDeg = f ? Math.round((((f.heading || 0) * 180 / Math.PI) % 360 + 360) % 360) : 40;
      const machVal = spdObj.mach || 0;
      const gLoad = f?.gForce ?? 1.0;
      const fuelKg = Math.round(f?.fuel ?? (isViper ? 3200 : 2700));
      const engRun = f ? Boolean(f.engines?.[0]) : false;
      const abOn = Boolean(f?.boost && thr > 0.86 && engRun);
      const gearDn = f ? Boolean(f.gear) : true;
      const colMain = isViper ? '#4cff94' : '#78ffa2';

      // Draw Left MFD (FCR / PFD-SMS)
      {
        const { ctx, tex, w, h } = leftMfd;
        ctx.fillStyle = '#040907'; ctx.fillRect(0, 0, w, h);
        if (on) {
          ctx.strokeStyle = colMain; ctx.fillStyle = colMain; ctx.lineWidth = 2;
          ctx.font = 'bold 17px monospace';
          ctx.fillText(isViper ? 'FCR AN/APG-83' : 'FCR AN/APG-68', 14, 24);
          ctx.fillText('CRM RWS   120', 14, 46);
          ctx.strokeRect(18, 56, w - 36, h - 98);
          // B-scope sweep line
          const sweepX = 24 + ((tNow * 0.08) % (w - 48));
          ctx.strokeStyle = isViper ? '#5ef2ff' : colMain;
          ctx.beginPath(); ctx.moveTo(sweepX, 58); ctx.lineTo(sweepX, h - 44); ctx.stroke();
          // Target symbology
          const lock = f?.tactical?.lock;
          ctx.fillStyle = lock ? '#ff5555' : '#ffe066';
          ctx.fillRect(w * 0.52 - 5, h * 0.42 - 5, 10, 10);
          ctx.fillStyle = colMain;
          ctx.fillText('A-A   ' + (f?.tactical?.ammo ?? 6) + ' AMRAAM', 14, h - 16);
        }
        tex.needsUpdate = true;
      }

      // Draw Right MFD (HSD / SMS & Engine)
      {
        const { ctx, tex, w, h } = rightMfd;
        ctx.fillStyle = '#040907'; ctx.fillRect(0, 0, w, h);
        if (on) {
          ctx.strokeStyle = colMain; ctx.fillStyle = colMain; ctx.lineWidth = 2;
          ctx.font = 'bold 17px monospace';
          ctx.fillText(isViper ? 'HSD COLOR VIPER' : 'SMS / ENGINE', 14, 24);
          if (isViper) {
            ctx.strokeStyle = '#3cb7ff';
            ctx.beginPath(); ctx.arc(w / 2, h * 0.52, 86, 0, Math.PI * 2); ctx.stroke();
            ctx.strokeStyle = '#4cff94';
            ctx.beginPath(); ctx.arc(w / 2, h * 0.52, 43, 0, Math.PI * 2); ctx.stroke();
            ctx.fillStyle = '#ffffff';
            ctx.fillText('HDG ' + String(hdgDeg).padStart(3, '0'), 14, h - 18);
            ctx.fillText('FOB ' + fuelKg + 'KG', 155, h - 18);
          } else {
            ctx.fillText('RPM ' + (engRun ? Math.round(62 + thr * 41) : 0) + '%', 20, 74);
            ctx.fillText('FTIT ' + (engRun ? Math.round(480 + thr * 420) : 25) + 'C', 20, 110);
            ctx.fillText('OIL  ' + (engRun ? 58 : 0) + ' PSI', 20, 146);
            ctx.fillText('NOZ  ' + (abOn ? '95% AB' : Math.round(18 + thr * 45) + '%'), 20, 182);
            ctx.fillText('FOB  ' + fuelKg + ' KG', 20, 228);
            ctx.fillText('GEAR ' + (gearDn ? '3 GREEN' : 'UP'), 20, 268);
          }
        }
        tex.needsUpdate = true;
      }

      // Draw F-16V Center Pedestal Display (CPD) OR F-16C Block 50 Analog ADI + Standby Cluster
      if (cpdScreen) {
        const { ctx, tex, w, h } = cpdScreen;
        ctx.fillStyle = '#050b0e'; ctx.fillRect(0, 0, w, h);
        if (on) {
          ctx.strokeStyle = '#5ee8ff'; ctx.fillStyle = '#5ee8ff'; ctx.lineWidth = 2.5;
          ctx.font = 'bold 20px monospace';
          ctx.fillText('VIPER CPD · F-16V BLK 70', 16, 28);
          // Mini artificial horizon top half
          const ay = 132;
          ctx.save(); ctx.beginPath(); ctx.rect(24, 44, w - 48, 176); ctx.clip();
          ctx.translate(w / 2, ay + (f?.pitch || 0) * 140);
          ctx.rotate(-(f?.bank || 0));
          ctx.fillStyle = '#145a9e'; ctx.fillRect(-260, -260, 520, 260);
          ctx.fillStyle = '#6c4824'; ctx.fillRect(-260, 0, 520, 260);
          ctx.strokeStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(-220, 0); ctx.lineTo(220, 0); ctx.stroke();
          ctx.restore();
          ctx.strokeStyle = '#5ee8ff'; ctx.strokeRect(24, 44, w - 48, 176);
          // Bottom engine & tactical status strip
          ctx.fillStyle = '#4cff94'; ctx.font = 'bold 21px monospace';
          ctx.fillText('IAS ' + iasKts + ' KT', 24, 256);
          ctx.fillText('ALT ' + altFt + ' FT', 200, 256);
          ctx.fillText('MACH ' + machVal.toFixed(2), 24, 294);
          ctx.fillText('G ' + gLoad.toFixed(1), 200, 294);
          ctx.fillStyle = abOn ? '#ff9d2e' : '#4cff94';
          ctx.fillText('F110-129 ' + (engRun ? (abOn ? 'MAX AB' : Math.round(thr * 100) + '% MIL') : 'CUTOFF'), 24, 336);
          ctx.fillStyle = gearDn ? '#4cff94' : '#ffcf56';
          ctx.fillText('LDG GEAR: ' + (gearDn ? 'DN & LKD' : 'UP'), 24, 376);
          ctx.fillStyle = '#9be8ff';
          ctx.fillText('FOB ' + fuelKg + ' KG · HDG ' + String(hdgDeg).padStart(3, '0'), 24, 418);
        }
        tex.needsUpdate = true;
      } else if (centerCluster) {
        const { ctx, tex, w, h } = centerCluster;
        ctx.fillStyle = '#090d10'; ctx.fillRect(0, 0, w, h);
        if (on) {
          // Classic Block 50 Analog ADI Attitude Ball + Standby Altimeter & Airspeed
          ctx.save(); ctx.beginPath(); ctx.arc(w / 2, 92, 68, 0, Math.PI * 2); ctx.clip();
          ctx.translate(w / 2, 92 + (f?.pitch || 0) * 80);
          ctx.rotate(-(f?.bank || 0));
          ctx.fillStyle = '#1b64ab'; ctx.fillRect(-120, -120, 240, 120);
          ctx.fillStyle = '#6c492a'; ctx.fillRect(-120, 0, 240, 120);
          ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(-90, 0); ctx.lineTo(90, 0); ctx.stroke();
          ctx.restore();
          ctx.strokeStyle = '#92a4b0'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(w / 2, 92, 68, 0, Math.PI * 2); ctx.stroke();
          ctx.fillStyle = '#ffe596'; ctx.font = 'bold 20px monospace';
          ctx.fillText('IAS ' + iasKts, 22, 206);
          ctx.fillText('ALT ' + altFt, 22, 240);
          ctx.fillText('FUEL ' + fuelKg, 22, 276);
        }
        tex.needsUpdate = true;
      }

      // Draw RWR Azimuth Scope
      {
        const { ctx, tex, w, h } = rwrScope;
        ctx.fillStyle = '#030804'; ctx.fillRect(0, 0, w, h);
        if (on) {
          ctx.strokeStyle = '#48ff78'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(w / 2, h / 2, w * 0.42, 0, Math.PI * 2); ctx.stroke();
          ctx.beginPath(); ctx.arc(w / 2, h / 2, w * 0.18, 0, Math.PI * 2); ctx.stroke();
          ctx.fillStyle = '#48ff78'; ctx.font = 'bold 16px monospace';
          ctx.fillText('ALR-56M', 54, h - 10);
          if ((f?.tactical?.enemyWarning || 0) > 0) {
            ctx.fillStyle = '#ff4a3a';
            ctx.fillText('LOCK', w * 0.34, h * 0.34);
          }
        }
        tex.needsUpdate = true;
      }

      // Draw DED Data Entry Display
      {
        const { ctx, tex, w, h } = dedScreen;
        ctx.fillStyle = '#040a04'; ctx.fillRect(0, 0, w, h);
        if (on) {
          ctx.fillStyle = '#5eff72'; ctx.font = 'bold 18px monospace';
          ctx.fillText('1  CNI   NAV ' + String(hdgDeg).padStart(3, '0'), 10, 24);
          ctx.fillText('2  UHF 305.00  S', 10, 50);
          ctx.fillText('3  FOB ' + String(fuelKg).padStart(4, ' ') + ' KG', 10, 76);
          ctx.fillText('4  STPT 1  T+00', 10, 102);
        }
        tex.needsUpdate = true;
      }

      // Draw Collimated Wide-Angle HUD
      hudCtx.clearRect(0, 0, 512, 512);
      if (on) {
        hudCtx.strokeStyle = hudCtx.fillStyle = '#5dff8f';
        hudCtx.lineWidth = 3.5;
        hudCtx.font = 'bold 26px monospace';
        // Heading tape
        hudCtx.fillText(String(hdgDeg).padStart(3, '0'), 228, 36);
        hudCtx.strokeRect(216, 10, 72, 32);
        // Airspeed & Altitude boxes
        hudCtx.strokeRect(20, 218, 92, 42);
        hudCtx.fillText(String(iasKts), 30, 248);
        hudCtx.strokeRect(392, 218, 104, 42);
        hudCtx.fillText(String(altFt), 400, 248);
        // Mach & G
        hudCtx.font = 'bold 20px monospace';
        hudCtx.fillText('M ' + machVal.toFixed(2), 20, 312);
        hudCtx.fillText(gLoad.toFixed(1) + 'G', 20, 342);
        hudCtx.fillText(isViper ? 'VIPER NAV' : 'F-16C NAV', 20, 480);
        hudCtx.fillText(gearDn ? 'DN' : 'UP', 442, 480);
        if (abOn) hudCtx.fillText('AB', 442, 450);

        // Artificial Horizon + Moving Pitch Ladder
        hudCtx.save();
        hudCtx.beginPath(); hudCtx.rect(120, 62, 272, 360); hudCtx.clip();
        hudCtx.translate(256, 244 + (f?.pitch || 0) * 210);
        hudCtx.rotate(-(f?.bank || 0));
        hudCtx.lineWidth = 3;
        hudCtx.beginPath();
        hudCtx.moveTo(-140, 0); hudCtx.lineTo(-28, 0);
        hudCtx.moveTo(28, 0); hudCtx.lineTo(140, 0);
        hudCtx.stroke();
        for (let ang = -20; ang <= 20; ang += 10) {
          if (ang === 0) continue;
          const y = -ang * 4.5;
          hudCtx.beginPath();
          if (ang < 0) hudCtx.setLineDash([8, 6]); else hudCtx.setLineDash([]);
          hudCtx.moveTo(-76, y); hudCtx.lineTo(-24, y);
          hudCtx.moveTo(24, y); hudCtx.lineTo(76, y);
          hudCtx.stroke();
          hudCtx.setLineDash([]);
          hudCtx.fillText(String(ang), 82, y + 6);
        }
        hudCtx.restore();
        // Fixed Flight Path Marker / Gun Cross
        hudCtx.beginPath();
        hudCtx.arc(256, 244, 11, 0, Math.PI * 2);
        hudCtx.moveTo(214, 244); hudCtx.lineTo(245, 244);
        hudCtx.moveTo(267, 244); hudCtx.lineTo(298, 244);
        hudCtx.moveTo(256, 233); hudCtx.lineTo(256, 218);
        hudCtx.stroke();
      }
      hudTex.needsUpdate = true;
    };
  }

  globalScope.buildF16Airframe = buildF16Airframe;
  globalScope.refineF16FlightDeck = refineF16FlightDeck;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { buildF16Airframe, refineF16FlightDeck };
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
