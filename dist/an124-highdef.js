'use strict';
// Antonov An-124-100 Ruslan High-Definition Airframe, Upward Nose Visor, Kneeling Nose Gear, 2-Stage Ground Ramp,
// High Anhedral Shoulder Wing, 4x Progress D-18T Turbofans, 24-Wheel Multi-Bogie Gear, Cargo Hold w/ Overhead Cranes & Russian-Teal Flight Deck
// Original procedural reference model derived from public ICAO / Antonov Design Bureau dimensions (69.10 m x 73.30 m x 20.78 m)
(function (globalScope) {
  function clamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }
  function smoothstep(a, b, x){
    const t = clamp((x - a) / Math.max(1e-5, b - a), 0, 1);
    return t * t * (3 - 2 * t);
  }

  // Exact An-124-100 Ruslan double-deck pear/ovoid fuselage station law along Z (-34.55 .. +34.55)
  function hullParamsAt(z){
    let rx, ryBot, ryTop, yOff = 0, pBot = 2.65, pTop = 2.15;
    if(z < -25.64){
      // Nose visor cone forward of -25.64 m hinge bulkhead
      const t = smoothstep(-34.55, -25.64, z);
      const rad = Math.pow(t, 0.56);
      rx = 0.08 + 2.68 * rad;
      ryBot = 0.08 + 2.04 * rad;
      ryTop = 0.08 + 2.86 * rad;
      yOff = THREE.MathUtils.lerp(-0.78, -0.34, Math.pow(t, 0.72));
      pBot = THREE.MathUtils.lerp(2.0, 2.72, t);
      pTop = 2.05;
    }else if(z <= 12.2){
      // Wide lower cargo vault + rising courier deck + shoulder wingbox fairing
      const tFore = smoothstep(-25.64, -15.5, z);
      rx = 2.76 + 0.62 * tFore;
      ryBot = 2.12 + 0.56 * smoothstep(-25.64, -14.0, z);
      ryTop = 2.90 + 0.42 * smoothstep(-25.64, -18.5, z);
      yOff = -0.34 + 0.08 * tFore;
      pBot = 2.85;
      pTop = 2.18;
    }else{
      // Signature steep Antonov upswept aft cargo beaver tailcone
      const t = smoothstep(12.2, 34.55, z);
      const shrink = 1 - Math.pow(t, 1.24) * 0.945;
      rx = Math.max(0.14, 3.38 * shrink);
      ryBot = Math.max(0.14, 2.68 * Math.pow(1 - t, 1.08) + 0.14);
      ryTop = Math.max(0.14, 3.32 * Math.pow(1 - t, 1.15) + 0.14);
      yOff = -0.26 + 2.38 * Math.pow(t, 1.28);
      pBot = 2.85 - 0.8 * t;
      pTop = 2.18;
    }

    // Smooth upper-deck eyebrow & deep high-wing center wingbox dorsal crown (-25.55 .. +9.5)
    const rise = smoothstep(-25.55, -24.15, z);
    const fall = 1 - smoothstep(4.5, 16.5, z);
    const hump = rise * fall;
    // Slight step at upper-deck forehead (-25.4..-23.5) rising smoothly into +4.08 m shoulder wingbox crest (-9..+5)
    const wingboxLift = smoothstep(-22.5, -10.5, z) * (1 - smoothstep(3.5, 14.5, z));
    const uhx = (1.68 + 0.85 * wingboxLift) * hump;
    const uyCenter = 1.98 + 0.42 * wingboxLift;
    const uhy = (1.38 + 0.34 * wingboxLift) * hump;

    return { rx, ryBot, ryTop, yOff, pBot, pTop, hump, uhx, uyCenter, uhy };
  }

  function hullSurfacePoint(z, phi){
    // phi: 0 = bottom (-ryBot), PI = top crown (+ryTop), 0..PI starboard (+X), PI..2PI port (-X)
    const s = hullParamsAt(z);
    const cosP = Math.cos(phi);
    const sinP = Math.sin(phi);
    const ry = cosP >= 0 ? s.ryBot : s.ryTop;
    const pow = cosP >= 0 ? s.pBot : s.pTop;
    const exp = 2 / pow;
    let x = Math.sign(sinP || 0) * Math.pow(Math.abs(sinP), exp) * s.rx;
    let y = s.yOff - Math.sign(cosP || 0) * Math.pow(Math.abs(cosP), exp) * ry;

    if(s.hump > 0.005 && phi > Math.PI * 0.38 && phi < Math.PI * 1.62){
      const tDome = (phi - Math.PI) / (Math.PI * 0.62);
      const domeA = tDome * Math.PI * 0.72;
      const dxUpper = Math.sin(domeA) * s.uhx;
      const dyUpper = s.uyCenter + Math.cos(domeA) * s.uhy;
      const blendW = Math.pow(Math.max(0, Math.cos(tDome * Math.PI * 0.5)), 0.78) * s.hump;
      if(dyUpper > y){
        const k = smoothstep(0.0, 0.35, blendW);
        y = THREE.MathUtils.lerp(y, Math.max(y, dyUpper), k);
        const upperW = Math.abs(dxUpper);
        const sideMix = smoothstep(Math.PI * 0.50, Math.PI * 0.76, Math.PI - Math.abs(phi - Math.PI));
        x = Math.sign(sinP || 1) * Math.max(Math.abs(x) * (1 - 0.35 * k * (1 - sideMix)), upperW * k + Math.abs(x) * (1 - k));
      }
    }
    return [x, y, z];
  }

  function buildLoftedSegment(zStart, zEnd, rings, slices, pivotOffset = [0, 0, 0], capFront = false, capBack = false){
    const pos = [], uvs = [], idx = [];
    const rLen = slices + 1;
    const [px, py, pz] = pivotOffset;
    for(let r = 0; r <= rings; r++){
      const z = THREE.MathUtils.lerp(zStart, zEnd, r / rings);
      const u = r / rings;
      for(let j = 0; j <= slices; j++){
        const phi = (j / slices) * Math.PI * 2;
        const [x, y, zz] = hullSurfacePoint(z, phi);
        pos.push(x - px, y - py, zz - pz);
        uvs.push(u, j / slices);
      }
    }
    for(let r = 0; r < rings; r++){
      for(let j = 0; j < slices; j++){
        const a = r * rLen + j;
        const b = a + rLen;
        idx.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
    if(capFront){
      const cy = hullParamsAt(zStart).yOff;
      const cIdx = pos.length / 3;
      pos.push(0 - px, cy - py, zStart - pz);
      uvs.push(0, 0.5);
      for(let j = 0; j < slices; j++) idx.push(cIdx, j + 1, j);
    }
    if(capBack){
      const backBase = rings * rLen;
      const cy = hullParamsAt(zEnd).yOff;
      const cIdx = pos.length / 3;
      pos.push(0 - px, cy - py, zEnd - pz);
      uvs.push(1, 0.5);
      for(let j = 0; j < slices; j++) idx.push(cIdx, backBase + j, backBase + j + 1);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return geo;
  }

  // Conformal UV-mapped skin textures for Antonov Ruslan hull + towering tail fin
  const AN124_THEMES = {
    default: { hullTop: '#f1f4f7', belly: '#a7b2bc', stripe1: '#0e3c78', stripe2: '#2d93d6', gold: '#e0b338', title: 'AN-124-100 RUSLAN · SKYBOUND', tailBg: '#0d3f7a', tailFlag: '#ffd23f' },
    starlux: { hullTop: '#242b33', belly: '#171c22', stripe1: '#c8a238', stripe2: '#7a6326', gold: '#f0cf65', title: 'STARBOUND HEAVY CARGO', tailBg: '#1c232b', tailFlag: '#d4af37' },
    plum: { hullTop: '#f3f2f8', belly: '#b4b8cb', stripe1: '#23327c', stripe2: '#cb5692', gold: '#e396b8', title: 'FORMOSA AIRLIFT RUSLAN', tailBg: '#1d2d6b', tailFlag: '#d85a98' },
    thunder: { hullTop: '#f3f5f8', belly: '#b1bac4', stripe1: '#a81c20', stripe2: '#154791', gold: '#ffffff', title: 'AN-124 HEAVY TESTBED', tailBg: '#0d47a1', tailFlag: '#d32f2f' },
    camo: { hullTop: '#768288', belly: '#5e6a70', stripe1: '#37474f', stripe2: '#4e5d64', gold: '#b0bec5', title: 'AIRLIFT 124 · LOW VIS', tailBg: '#455a64', tailFlag: '#78909c' },
    rescue: { hullTop: '#eef2f5', belly: '#adb8c2', stripe1: '#d84315', stripe2: '#ff8f00', gold: '#ffd54f', title: 'NASC HEAVY RESCUE AN-124', tailBg: '#bf360c', tailFlag: '#ffd54f' }
  };

  function makeRuslanHullTexture(themeId, includeText = true){
    const spec = AN124_THEMES[themeId] || AN124_THEMES.default;
    const c = document.createElement('canvas');
    c.width = 1024; c.height = 512;
    const g = c.getContext('2d');
    if(!g) return null;
    // NOTE: In buildLoftedSegment, v=0.0 is bottom (phi=0), v=0.25 starboard (+X), v=0.50 crown (phi=PI), v=0.75 port (-X), v=1.0 bottom
    g.fillStyle = spec.hullTop;
    g.fillRect(0, 0, 1024, 512);
    // Grey undercarriage / lower belly wrap (v near 0..0.15 and 0.85..1.0)
    g.fillStyle = spec.belly;
    g.fillRect(0, 0, 1024, 82);
    g.fillRect(0, 430, 1024, 82);

    // Classic Antonov twin cheatlines along lower-mid side of cargo fuselage (symmetrical around v=0.5)
    for(const yBand of [82, 408]){
      const isUpper = yBand > 256;
      g.fillStyle = spec.stripe1;
      g.fillRect(0, yBand + (isUpper ? 8 : 0), 1024, 14);
      g.fillStyle = spec.stripe2;
      g.fillRect(0, yBand + (isUpper ? 0 : 15), 1024, 7);
    }
    // Thin gold pinline
    g.fillStyle = spec.gold;
    g.fillRect(0, 79, 1024, 3);
    g.fillRect(0, 430, 1024, 3);

    // Stenciled fleet title forward of wing leading edge, upright and left-to-right on BOTH sides!
    if(includeText){
      g.fillStyle = spec.stripe1;
      g.font = 'bold 17px sans-serif';
      // Port side (v~0.75 -> canvas y~120): u runs left->right, flipY means +canvas_y goes up -> scale(1, -1)
      g.save();
      g.translate(105, 114);
      g.scale(1, -1);
      g.fillText(spec.title, 0, 0);
      g.restore();
      // Starboard side (v~0.25 -> canvas y~395): u runs right->left, +canvas_y goes down -> scale(-1, 1)
      g.save();
      g.translate(310, 396);
      g.scale(-1, 1);
      g.fillText(spec.title, 0, 0);
      g.restore();
    }

    // Fine aerospace seam panel grid & inspection latches
    g.strokeStyle = 'rgba(38,54,70,0.20)';
    g.lineWidth = 1.2;
    for(let x = 32; x < 1024; x += 64){
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 512); g.stroke();
    }
    for(let y = 32; y < 512; y += 64){
      g.beginPath(); g.moveTo(0, y); g.lineTo(1024, y); g.stroke();
    }

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  function makeRuslanTailTexture(themeId){
    const spec = AN124_THEMES[themeId] || AN124_THEMES.default;
    const c = document.createElement('canvas');
    c.width = 512; c.height = 512;
    const g = c.getContext('2d');
    if(!g) return null;
    g.fillStyle = spec.hullTop;
    g.fillRect(0, 0, 512, 512);
    // Antonov diagonal tail tricolor stripes along fin
    g.fillStyle = spec.tailBg;
    g.beginPath();
    g.moveTo(0, 195); g.lineTo(512, 50); g.lineTo(512, 225); g.lineTo(0, 370); g.closePath();
    g.fill();
    g.fillStyle = spec.stripe2;
    g.beginPath();
    g.moveTo(0, 372); g.lineTo(512, 227); g.lineTo(512, 290); g.lineTo(0, 435); g.closePath();
    g.fill();
    g.fillStyle = spec.tailFlag;
    g.beginPath();
    g.moveTo(0, 436); g.lineTo(512, 291); g.lineTo(512, 326); g.lineTo(0, 471); g.closePath();
    g.fill();
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  function buildAn124Airframe(profile, scene){
    const group = new THREE.Group();
    const gear = new THREE.Group();
    const cabin = new THREE.Group();
    const kneelPivot = new THREE.Group();
    const hullRoot = new THREE.Group();
    const closeDetails = new THREE.Group();
    const noseDoor = new THREE.Group();
    const cargoRamp = new THREE.Group();

    const [half, radius, span, wingY] = profile.geometry; // [34.55, 3.56, 36.65, 2.87]
    const gearH = profile.gearHeight ?? 4.48;
    const panelBump = typeof AeroCraft !== 'undefined' ? AeroCraft.getPanelBumpTexture(THREE) : null;

    // Main-bogie fulcrum at aft sponson bogie axis: z = +5.2, y = -gearH
    const kneelFulcrumZ = 5.2;
    kneelPivot.position.set(0, -gearH, kneelFulcrumZ);
    hullRoot.position.set(0, gearH, -kneelFulcrumZ);
    kneelPivot.add(hullRoot);
    group.add(kneelPivot, gear);

    const noseHingeZ = -25.64, noseHingeY = 2.68;
    const rampSillY = -2.05, rampSillZ = -25.64;
    hullRoot.add(closeDetails, noseDoor, cargoRamp);

    const hullTex = makeRuslanHullTexture('default', true);
    const noseTex = makeRuslanHullTexture('default', false);
    const tailTex = makeRuslanTailTexture('default');
    const hullMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: hullTex,
      roughness: 0.34,
      metalness: 0.12,
      clearcoat: 0.68,
      clearcoatRoughness: 0.16,
      bumpMap: panelBump,
      bumpScale: 0.012
    });
    const whiteMat = new THREE.MeshPhysicalMaterial({
      color: 0xf1f4f7,
      roughness: 0.34,
      metalness: 0.12,
      clearcoat: 0.66,
      clearcoatRoughness: 0.16,
      bumpMap: panelBump,
      bumpScale: 0.011
    });
    const wingMat = new THREE.MeshPhysicalMaterial({
      color: 0xdbe2e8,
      roughness: 0.38,
      metalness: 0.18,
      clearcoat: 0.54,
      clearcoatRoughness: 0.22,
      bumpMap: panelBump,
      bumpScale: 0.013,
      side: THREE.DoubleSide
    });
    const greySponsonMat = new THREE.MeshPhysicalMaterial({
      color: 0xa6b1bb,
      roughness: 0.38,
      metalness: 0.16,
      clearcoat: 0.56,
      bumpMap: panelBump,
      bumpScale: 0.011
    });
    const accentMat = new THREE.MeshPhysicalMaterial({
      color: 0x0e3c78,
      roughness: 0.32,
      metalness: 0.14,
      clearcoat: 0.72,
      bumpMap: panelBump,
      bumpScale: 0.010
    });
    const tailMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: tailTex,
      roughness: 0.34,
      metalness: 0.12,
      clearcoat: 0.68,
      bumpMap: panelBump,
      bumpScale: 0.011
    });
    const radomeMat = new THREE.MeshPhysicalMaterial({
      color: 0xecf1f5,
      map: noseTex,
      roughness: 0.36,
      metalness: 0.06,
      clearcoat: 0.70
    });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x7e8d99, roughness: 0.28, metalness: 0.74 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xc9d4dc, roughness: 0.15, metalness: 0.88 });
    const titaniumMat = new THREE.MeshStandardMaterial({ color: 0x454f58, roughness: 0.36, metalness: 0.78 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x161f27, roughness: 0.66 });
    const rubberMat = new THREE.MeshStandardMaterial({ color: 0x15191d, roughness: 0.92 });
    const yellowTrimMat = new THREE.MeshStandardMaterial({ color: 0xf4bd28, roughness: 0.36, metalness: 0.18 });
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x122631,
      roughness: 0.07,
      metalness: 0.74,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      transparent: true,
      opacity: 0.78
    });
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x24303a, roughness: 0.44, side: THREE.DoubleSide });

    function addM(parent, geo, mat, x = 0, y = 0, z = 0){
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      parent.add(m);
      return m;
    }

    // 1. Articulated Upward-Hinged Nose Visor Cargo Door (-34.55 .. -25.64 m, strictly clear of cockpit windshield!)
    noseDoor.position.set(0, noseHingeY, noseHingeZ);
    const visorGeo = buildLoftedSegment(-half, noseHingeZ, 24, 56, [0, noseHingeY, noseHingeZ], false, false);
    addM(noseDoor, visorGeo, radomeMat).name = 'An-124 Nose Visor Door';
    // Visor aft sealing bulkhead ring & lock lugs (elliptical fit inside -25.64 m pear aperture)
    const visorRing = addM(noseDoor, new THREE.RingGeometry(1.72, 2.02, 40), titaniumMat, 0, -0.34 - noseHingeY, 0.02);
    visorRing.scale.set(1.18, 0.90, 1.0);
    // Dark weather radome black dielectric tip cap & pitot nose probe
    addM(noseDoor, new THREE.SphereGeometry(0.46, 20, 14), new THREE.MeshStandardMaterial({ color: 0x202832, roughness: 0.34, metalness: 0.14 }), 0, -0.78 - noseHingeY, -half + 0.34 - noseHingeZ).scale.set(1.0, 0.96, 1.35);

    // 2. Main Cargo Trunk (-25.64 .. +34.55) w/ sculpted dorsal shoulder wingbox & upswept beaver tail
    const mainFuseGeo = buildLoftedSegment(noseHingeZ, half, 54, 60, [0, 0, 0], false, true);
    addM(hullRoot, mainFuseGeo, hullMat).name = 'An-124 Main Fuselage';

    // Cargo-threshold dark frame bulkhead flange & hydraulic visor jacks
    addM(hullRoot, new THREE.BoxGeometry(3.85, 0.20, 0.22), titaniumMat, 0, 1.56, noseHingeZ + 0.06);
    for(const xs of [-1, 1]){
      addM(hullRoot, new THREE.BoxGeometry(0.20, 3.65, 0.26), titaniumMat, xs * 1.98, -0.22, noseHingeZ + 0.06);
      // Hydraulic nose-visor actuator scissor jacks (visible when visor opens!)
      addM(hullRoot, new THREE.CylinderGeometry(0.10, 0.11, 1.35, 10), chromeMat, xs * 1.65, 1.15, noseHingeZ + 0.36).rotation.x = 0.52;
    }
    // Signature armored lower landing-gear sponson blisters along z = -8.5 .. +12.5 m
    for(const side of [-1, 1]){
      if(typeof AeroCraft !== 'undefined'){
        const sponsonGeo = AeroCraft.buildFuselageLoft([
          { z: -8.8, rx: 0.16, ryTop: 0.14, ryBot: 0.14, y: -1.95 },
          { z: -5.4, rx: 0.88, ryTop: 1.05, ryBot: 0.72, y: -1.92, pTop: 2.2, pBot: 2.6 },
          { z: 0.0, rx: 1.05, ryTop: 1.24, ryBot: 0.86, y: -1.88, pTop: 2.4, pBot: 2.8 },
          { z: 7.5, rx: 1.05, ryTop: 1.24, ryBot: 0.86, y: -1.88, pTop: 2.4, pBot: 2.8 },
          { z: 11.8, rx: 0.82, ryTop: 0.94, ryBot: 0.64, y: -1.84 },
          { z: 14.6, rx: 0.14, ryTop: 0.14, ryBot: 0.14, y: -1.55 }
        ], 24);
        addM(hullRoot, sponsonGeo, greySponsonMat, side * 3.44, 0, 0).name = 'An-124 Gear Sponson Fairing';
      }
      // Subtle recessed dark wheel-well cavity shadow beneath each sponson row
      addM(hullRoot, new THREE.BoxGeometry(1.18, 0.09, 10.6), darkMat, side * 3.72, -2.74, 5.1);
    }

    // Tailcone APU shroud & aft underside clamshell cargo door panel seams
    const apuCone = addM(hullRoot, new THREE.CylinderGeometry(0.16, 0.38, 1.05, 20), titaniumMat, 0, 2.08, half - 0.38);
    apuCone.rotation.x = Math.PI / 2 - 0.05;
    addM(hullRoot, new THREE.CylinderGeometry(0.10, 0.14, 0.28, 14), darkMat, 0, 2.10, half + 0.08).rotation.x = Math.PI / 2 - 0.05;
    // Etched rear beaver-tail cargo ramp & clamshell seams (molded flush with belly taper)
    const rearSeamMat = new THREE.MeshStandardMaterial({ color: 0x3b4856, roughness: 0.55 });
    for(const side of [-1, 1]){
      addM(closeDetails, new THREE.BoxGeometry(0.04, 0.03, 9.2), rearSeamMat, side * 1.65, -0.58, 18.8).rotation.x = -0.24;
    }
    addM(closeDetails, new THREE.BoxGeometry(3.30, 0.03, 0.04), rearSeamMat, 0, -1.68, 14.3);
    addM(closeDetails, new THREE.BoxGeometry(2.60, 0.03, 0.04), rearSeamMat, 0, 0.52, 23.2);

    // 3. Conformal Flush 6-Pane Upper-Deck Windshield (strictly aft of -25.64 visor hinge + below crown -> 0 protrusion!)
    function findHullZAtPhiY(phi, targetY, side){
      let bestZ = -24.5, bestErr = 99, bestPt = [0, targetY, -24.5];
      for(let i = 0; i <= 120; i++){
        const z = -25.52 + (i / 120) * 2.25;
        const pt = hullSurfacePoint(z, phi);
        const err = Math.abs(pt[1] - targetY);
        if(err < bestErr){ bestErr = err; bestZ = z; bestPt = pt; }
      }
      const pZ = hullSurfacePoint(bestZ + 0.10, phi);
      const pPhi = hullSurfacePoint(bestZ, phi - side * 0.04);
      const tPhi = new THREE.Vector3(pPhi[0] - bestPt[0], pPhi[1] - bestPt[1], 0).normalize();
      const tZ = new THREE.Vector3(pZ[0] - bestPt[0], pZ[1] - bestPt[1], 0.10).normalize();
      const nrm = new THREE.Vector3().crossVectors(tPhi, tZ).normalize();
      if(nrm.z > 0) nrm.negate();
      if(nrm.y < 0) nrm.negate();
      return { pt: new THREE.Vector3(bestPt[0], bestPt[1], bestPt[2]), nrm, tPhi };
    }
    for(const side of [-1, 1]){
      const paneSpecs = [
        { phiOff: 0.15, y: 2.98, w: 0.52, h: 0.44 },
        { phiOff: 0.31, y: 2.95, w: 0.50, h: 0.42 },
        { phiOff: 0.47, y: 2.92, w: 0.46, h: 0.39 }
      ];
      for(const sp of paneSpecs){
        const { pt, nrm, tPhi } = findHullZAtPhiY(Math.PI - side * sp.phiOff, sp.y, side);
        const uAxis = tPhi.clone().multiplyScalar(side);
        const vAxis = new THREE.Vector3().crossVectors(nrm, uAxis).normalize();
        const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(uAxis, vAxis, nrm));
        const fMesh = new THREE.Mesh(new THREE.BoxGeometry(sp.w + 0.04, sp.h + 0.04, 0.014), frameMat);
        fMesh.position.copy(pt).addScaledVector(nrm, 0.010);
        fMesh.quaternion.copy(q);
        fMesh.name = 'Windshield Frame';
        closeDetails.add(fMesh);

        const gMesh = new THREE.Mesh(new THREE.BoxGeometry(sp.w, sp.h, 0.015), glassMat);
        gMesh.position.copy(pt).addScaledVector(nrm, 0.015);
        gMesh.quaternion.copy(q);
        gMesh.name = 'Cockpit Windshield Glass';
        closeDetails.add(gMesh);
      }
      // Windshield wipers
      const { pt: wPt, nrm: wNrm } = findHullZAtPhiY(Math.PI - side * 0.15, 2.76, side);
      addM(closeDetails, new THREE.BoxGeometry(0.022, 0.32, 0.012), darkMat,
        wPt.x + wNrm.x * 0.025, wPt.y + wNrm.y * 0.025, wPt.z + wNrm.z * 0.025).rotation.set(-0.62, -side * 0.20, side * 0.36);

      // Tangential upper-deck courier cabin windows + crew entry doors + static air data probes
      function orientWall(mesh, zCtr, targetY, outOff){
        let bestPhi = Math.PI - side * 0.45, bestErr = 99, bestPt = [0, targetY, zCtr];
        for(let i = 10; i <= 96; i++){
          const phi = Math.PI - side * (i / 100) * Math.PI * 0.48;
          const pt = hullSurfacePoint(zCtr, phi);
          const err = Math.abs(pt[1] - targetY);
          if(err < bestErr){ bestErr = err; bestPhi = phi; bestPt = pt; }
        }
        const pF = hullSurfacePoint(zCtr - 0.35, bestPhi);
        const pA = hullSurfacePoint(zCtr + 0.35, bestPhi);
        const pU = hullSurfacePoint(zCtr, bestPhi + side * 0.05);
        const uFwd = new THREE.Vector3(pA[0] - pF[0], pA[1] - pF[1], pA[2] - pF[2]).normalize();
        const vUp = new THREE.Vector3(pU[0] - bestPt[0], pU[1] - bestPt[1], 0).normalize();
        const nOut = new THREE.Vector3().crossVectors(uFwd, vUp).normalize();
        if(nOut.x * side < 0) nOut.negate();
        const vOrtho = new THREE.Vector3().crossVectors(nOut, uFwd).normalize();
        if(vOrtho.y < 0) vOrtho.negate();
        mesh.position.set(bestPt[0], bestPt[1], bestPt[2]).addScaledVector(nOut, outOff);
        mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(nOut, vOrtho, uFwd));
      }

      // Upper crew / courier relief compartment windows
      for(let w = 0; w < 6; w++){
        const wz = -22.2 + w * 1.15;
        const winG = new THREE.Group();
        addM(winG, new THREE.BoxGeometry(0.014, 0.32, 0.25), frameMat);
        addM(winG, new THREE.BoxGeometry(0.018, 0.26, 0.19), glassMat);
        orientWall(winG, wz, 2.38, 0.012);
        closeDetails.add(winG);
      }
      // Forward crew access door + lower technician door with external latch handles & hinges
      for(const [dz, dy, dw, dh] of [[-19.2, 2.05, 0.85, 1.48], [-15.8, -1.38, 0.92, 1.72], [11.5, -0.92, 0.86, 1.56]]){
        const dG = new THREE.Group();
        addM(dG, new THREE.BoxGeometry(0.016, dh, dw), frameMat);
        addM(dG, new THREE.BoxGeometry(0.020, dh - 0.05, dw - 0.05), whiteMat);
        addM(dG, new THREE.BoxGeometry(0.026, 0.11, 0.06), chromeMat, 0.016, 0.06, -dw * 0.30);
        orientWall(dG, dz, dy, 0.012);
        closeDetails.add(dG);
      }
      // Forward L-shaped Pitot probes + AoA vanes along -28.0 .. -26.8
      for(const pz of [-27.8, -26.8]){
        const [px, py] = hullSurfacePoint(pz, Math.PI - side * 0.56);
        addM(closeDetails, new THREE.CylinderGeometry(0.014, 0.022, 0.38, 8), chromeMat, px + side * 0.10, py, pz).rotation.z = -side * Math.PI / 2;
      }
    }
    // Dorsal VHF/SATCOM blade antennas & ADF fairing blisters along upper spine
    for(const [az, ay, ah, al] of [[-16.5, 3.68, 0.44, 0.65], [-10.5, 4.02, 0.38, 1.15], [6.5, 3.92, 0.42, 0.58]]){
      addM(closeDetails, new THREE.BoxGeometry(0.06, ah, al), whiteMat, 0, ay, az);
    }

    // 4. Illuminated Vaulted Cargo Bay (mirrored in hullRoot for exterior cargoDoor AND inside cabin for interior inspection!)
    const bayGroup = new THREE.Group();
    bayGroup.name = 'An-124 Illuminated Cargo Vault';
    hullRoot.add(bayGroup);
    const cabBayGroup = new THREE.Group();
    cabBayGroup.name = 'An-124 Cabin Cargo Vault';
    cabBayGroup.visible = false;
    cabin.add(cabBayGroup);
    const bayCeilingMat = new THREE.MeshStandardMaterial({ color: 0xdfe7ee, roughness: 0.65, side: THREE.DoubleSide });
    const bayFloorMat = new THREE.MeshStandardMaterial({ color: 0x4b5661, roughness: 0.72, metalness: 0.32 });
    const bayGlowMat = new THREE.MeshBasicMaterial({ color: 0xfff3d4 });
    const gantryCranes = [], bayCranes = [];
    function populateCargoVault(target, craneArr, withCeiling){
      addM(target, new THREE.BoxGeometry(3.86, 0.08, 34.8), bayFloorMat, 0, rampSillY + 0.02, -8.2);
      for(const xs of [-1, 1]){
        addM(target, new THREE.BoxGeometry(0.08, 3.02, 34.8), bayCeilingMat, xs * 1.94, rampSillY + 1.51, -8.2);
        addM(target, new THREE.BoxGeometry(0.16, 0.05, 34.6), yellowTrimMat, xs * 1.72, rampSillY + 0.07, -8.2);
        addM(target, new THREE.BoxGeometry(0.14, 0.06, 33.8), chromeMat, xs * 0.88, rampSillY + 0.07, -8.2);
      }
      if(withCeiling){
        addM(target, new THREE.BoxGeometry(3.88, 0.08, 34.8), bayCeilingMat, 0, rampSillY + 3.30, -8.2);
        addM(target, new THREE.BoxGeometry(3.88, 3.25, 0.14), metalMat, 0, rampSillY + 1.62, -25.4);
      }
      for(let rz = -24.5; rz <= 8.0; rz += 3.4){
        const rib = new THREE.Mesh(new THREE.TorusGeometry(1.94, 0.07, 6, 18, Math.PI), metalMat);
        rib.position.set(0, rampSillY + 2.02, rz);
        rib.scale.set(1.0, 0.68, 1.0);
        target.add(rib);
      }
      for(const xs of [-0.75, 0.75]){
        addM(target, new THREE.BoxGeometry(0.22, 0.05, 31.0), bayGlowMat, xs, rampSillY + 3.22, -8.2);
      }
      for(const gz of [-19.5, -10.5]){
        const crG = new THREE.Group();
        crG.position.set(0, rampSillY + 3.06, gz);
        addM(crG, new THREE.BoxGeometry(3.72, 0.14, 0.22), yellowTrimMat, 0, 0, 0);
        for(const hs of [-0.88, 0.88]){
          addM(crG, new THREE.BoxGeometry(0.28, 0.18, 0.30), titaniumMat, hs, -0.12, 0);
          addM(crG, new THREE.CylinderGeometry(0.022, 0.022, 0.72, 6), metalMat, hs, -0.50, 0);
          addM(crG, new THREE.BoxGeometry(0.16, 0.14, 0.20), yellowTrimMat, hs, -0.88, 0);
        }
        target.add(crG);
        craneArr.push(crG);
      }
    }
    populateCargoVault(bayGroup, gantryCranes, false);
    populateCargoVault(cabBayGroup, bayCranes, true);
    const cargoBayLight = typeof THREE.PointLight === 'function' ? new THREE.PointLight(0xffefc8, 0, 22, 1.5) : null;
    if(cargoBayLight){
      cargoBayLight.position.set(0, 0.35, -21.5);
      hullRoot.add(cargoBayLight);
    }
    const cabLightA = typeof THREE.PointLight === 'function' ? new THREE.PointLight(0xfff1d2, 24, 28, 1.2) : null;
    if(cabLightA){ cabLightA.position.set(0, 0.65, -14.0); cabBayGroup.add(cabLightA); }
    const cabLightB = typeof THREE.PointLight === 'function' ? new THREE.PointLight(0xfff1d2, 22, 26, 1.2) : null;
    if(cabLightB){ cabLightB.position.set(0, 0.65, -2.0); cabBayGroup.add(cabLightB); }

    // 5. Two-Stage Folding Ground Cargo Ramp (CargoRamp + Articulated Beveled RampToe)
    cargoRamp.position.set(0, rampSillY, rampSillZ);
    const rampL = 3.85;
    const rampMat = new THREE.MeshStandardMaterial({ color: 0x62707d, roughness: 0.60, metalness: 0.45 });
    // Main ramp spans local z: 0 -> -3.85 m (stowed cleanly inside nose cone above -2.05 m!)
    addM(cargoRamp, new THREE.BoxGeometry(3.64, 0.15, rampL), rampMat, 0, -0.075, -rampL * 0.5);
    addM(cargoRamp, new THREE.BoxGeometry(3.05, 0.025, rampL - 0.15), darkMat, 0, 0.015, -rampL * 0.5);
    for(const xs of [-1.74, -0.88, 0.88, 1.74]){
      addM(cargoRamp, new THREE.BoxGeometry(0.10, 0.04, rampL - 0.15), yellowTrimMat, xs, 0.02, -rampL * 0.5);
    }
    const rampToe = new THREE.Group();
    rampToe.position.set(0, 0, -rampL);
    const toeL = 1.45;
    // Tapered wedge bevel toe kissing runway cleanly at -4.48 m when deployed!
    addM(rampToe, new THREE.BoxGeometry(3.58, 0.11, toeL * 0.58), rampMat, 0, -0.055, -toeL * 0.29);
    const tipBevel = addM(rampToe, new THREE.BoxGeometry(3.54, 0.045, toeL * 0.48), yellowTrimMat, 0, -0.025, -toeL * 0.78);
    tipBevel.rotation.x = 0.05;
    cargoRamp.add(rampToe);
    cargoRamp.visible = false;
    cargoRamp.rotation.x = 1.42;
    rampToe.rotation.x = -2.75;

    // 6. High Shoulder Anhedral Wings ('an124 main wing') + Flap-Track Canoes + Flaps/Slats/Spoilers/Ailerons
    const wingRootX = 2.75;
    const wingV = f => clamp((span * f - wingRootX) / Math.max(1, span - wingRootX), 0, 1);
    function wingLeadAt(v){
      // Authentic Yehudi kink around v = 0.28: slight inner sweep, steady 32 deg outer sweep
      return -8.25 + v * 20.20;
    }
    function wingChordAt(v){
      if(v <= 0.28) return THREE.MathUtils.lerp(13.60, 9.45, v / 0.28);
      return THREE.MathUtils.lerp(9.45, 3.55, (v - 0.28) / 0.72);
    }
    // Signature Antonov high shoulder ANHEDRAL: +2.68 m at fuselage shoulder drooping cleanly to +1.18 m at tip!
    const wingYAt = v => 2.68 - 1.50 * Math.pow(v, 1.08);
    const wingThickAt = v => 0.145 - 0.058 * v;

    const flaps = [], slats = [], surfaces = [], airBrakes = [], elevs = [], rudders = [];
    const fans = [], reverserSleeves = [], landingLights = [], navLights = [], strobes = [], beacons = [];

    for(const side of [-1, 1]){
      if(typeof AeroCraft !== 'undefined'){
        const stations = [];
        for(let k = 0; k <= 20; k++){
          const v = k / 20;
          stations.push({
            x: wingRootX + v * (span - wingRootX),
            leadZ: wingLeadAt(v),
            chord: wingChordAt(v),
            y: wingYAt(v),
            thick: wingThickAt(v),
            camber: 0.022 - 0.010 * v,
            twist: 0.020 - 0.052 * v
          });
        }
        addM(hullRoot, AeroCraft.buildWingLoft(stations, { slices: 30, capTip: true, mirror: side < 0 }), wingMat).name = 'an124 main wing';
        // Fairing fillet collar blending high shoulder wing root cleanly into dorsal wingbox
        addM(hullRoot, AeroCraft.buildCanoeGeometry(18.5, 1.45, 0.92), whiteMat, side * 2.55, 2.74, -1.8);

        // 4 Prominent Antonov Flap-Track Fairing Canoes per wing
        for(const cf of [0.22, 0.39, 0.56, 0.72]){
          const cv = wingV(cf), c = wingChordAt(cv);
          addM(closeDetails, AeroCraft.buildCanoeGeometry(Math.min(c * 0.42, 4.1), 0.17, 0.15), whiteMat,
            side * span * cf, wingYAt(cv) - c * 0.048 - 0.15, wingLeadAt(cv) + c * 0.62).rotation.x = -0.05;
        }

        // Double-Slotted Fowler Flaps (Inboard + Mid)
        for(const [f0, f1] of [[0.14, 0.35], [0.38, 0.60]]){
          const v0 = wingV(f0), v1 = wingV(f1);
          const c0 = wingChordAt(v0), c1 = wingChordAt(v1);
          const fp = new THREE.Group();
          fp.position.set(side * span * f0, wingYAt(v0) - 0.04, wingLeadAt(v0) + c0 * 0.84);
          fp.add(new THREE.Mesh(AeroCraft.buildWingLoft([
            { x: 0, leadZ: 0, chord: c0 * 0.21, y: 0, thick: 0.10, camber: 0.03 },
            { x: span * (f1 - f0), leadZ: wingLeadAt(v1) + c1 * 0.84 - fp.position.z, chord: c1 * 0.21, y: wingYAt(v1) - wingYAt(v0), thick: 0.09, camber: 0.03 }
          ], { slices: 12, capTip: false, mirror: side < 0 }), metalMat));
          hullRoot.add(fp);
          flaps.push(fp);
        }

        // Full-Span Articulated Leading-Edge Slats
        for(const [s0, s1] of [[0.18, 0.45], [0.49, 0.82]]){
          const v0 = wingV(s0), v1 = wingV(s1);
          const c0 = wingChordAt(v0), c1 = wingChordAt(v1);
          const baseY = wingYAt(v0) - 0.02, baseZ = wingLeadAt(v0) - 0.10;
          const sl = new THREE.Group();
          sl.position.set(side * span * s0, baseY, baseZ);
          sl.userData = { baseY, baseZ };
          sl.add(new THREE.Mesh(AeroCraft.buildWingLoft([
            { x: 0, leadZ: 0, chord: c0 * 0.11, y: 0, thick: 0.11, camber: 0.02 },
            { x: span * (s1 - s0), leadZ: wingLeadAt(v1) - wingLeadAt(v0), chord: c1 * 0.11, y: wingYAt(v1) - wingYAt(v0), thick: 0.10, camber: 0.02 }
          ], { slices: 10, capTip: false, mirror: side < 0 }), metalMat));
          hullRoot.add(sl);
          slats.push(sl);
        }

        // Outboard Differential Ailerons
        const a0 = wingV(0.62), a1 = wingV(0.88);
        const ac0 = wingChordAt(a0), ac1 = wingChordAt(a1);
        const ail = new THREE.Group();
        ail.position.set(side * span * 0.62, wingYAt(a0), wingLeadAt(a0) + ac0 * 0.84);
        ail.add(new THREE.Mesh(AeroCraft.buildWingLoft([
          { x: 0, leadZ: 0, chord: ac0 * 0.18, y: 0, thick: 0.09, camber: 0.01 },
          { x: span * 0.26, leadZ: wingLeadAt(a1) + ac1 * 0.84 - ail.position.z, chord: ac1 * 0.18, y: wingYAt(a1) - wingYAt(a0), thick: 0.08, camber: 0.01 }
        ], { slices: 12, capTip: false, mirror: side < 0 }), wingMat));
        hullRoot.add(ail);
        surfaces.push(ail);

        // 6 Flush Upper-Wing Lift/Dump Spoilers per side
        for(let sp = 0; sp < 6; sp++){
          const sf0 = 0.23 + sp * 0.072, sf1 = sf0 + 0.064;
          const sv = wingV((sf0 + sf1) * 0.5), sv0 = wingV(sf0), sv1 = wingV(sf1);
          const sc = wingChordAt(sv);
          const panel = new THREE.Group();
          panel.position.set(side * span * ((sf0 + sf1) * 0.5), wingYAt(sv) + sc * 0.068 + 0.008, wingLeadAt(sv) + sc * 0.55);
          panel.rotation.z = side * Math.atan2(wingYAt(sv1) - wingYAt(sv0), span * 0.064);
          addM(panel, new THREE.BoxGeometry(span * 0.058, 0.025, sc * 0.15), wingMat, 0, 0, sc * 0.075);
          hullRoot.add(panel);
          airBrakes.push(panel);
        }

        // Conventional Low-Set Anhedral Horizontal Stabilizers + Dual Elevators
        const hRootZ = 24.4, hTipZ = 31.8, hSpan = 12.2, hRootY = 1.62, hTipY = 1.18;
        addM(hullRoot, AeroCraft.buildWingLoft([
          { x: 1.05, leadZ: hRootZ, chord: 6.4, y: hRootY, thick: 0.095, camber: 0, twist: -0.01 },
          { x: hSpan, leadZ: hTipZ, chord: 2.3, y: hTipY, thick: 0.075, camber: 0, twist: -0.02 }
        ], { slices: 18, capTip: true, mirror: side < 0 }), wingMat).name = 'An-124 Horizontal Stabilizer';
        const elev = new THREE.Group();
        elev.position.set(side * 1.4, hRootY - 0.02, hRootZ + 4.9);
        elev.add(new THREE.Mesh(AeroCraft.buildWingLoft([
          { x: 0, leadZ: 0, chord: 1.45, y: 0, thick: 0.08, camber: 0 },
          { x: hSpan - 1.5, leadZ: (hTipZ + 1.68) - (hRootZ + 4.9), chord: 0.62, y: hTipY - hRootY, thick: 0.07, camber: 0 }
        ], { slices: 12, capTip: false, mirror: side < 0 }), wingMat));
        hullRoot.add(elev);
        elevs.push(elev);
      }

      // Wingtip Nav/Strobes + Landing Lights
      const tipY = wingYAt(1.0) - 0.02, tipZ = wingLeadAt(1.0) + wingChordAt(1.0) * 0.34;
      navLights.push(addM(hullRoot, new THREE.SphereGeometry(0.11, 10, 8),
        new THREE.MeshBasicMaterial({ color: side === -1 ? 0xed4f49 : 0x65ffd4 }), side * span, tipY, tipZ));
      strobes.push(addM(hullRoot, new THREE.SphereGeometry(0.12, 10, 8),
        new THREE.MeshBasicMaterial({ color: 0xffffff }), side * span, tipY, tipZ + 0.18));
      landingLights.push(addM(hullRoot, new THREE.SphereGeometry(0.14, 10, 8),
        new THREE.MeshBasicMaterial({ color: 0xfff8d6 }), side * 3.55, -2.02, -8.75));

      // 7. 4x Progress D-18T High-Bypass Turbofan Nacelles ('an124 wing engine') + Pylons strictly under high wing!
      const engSpecs = [
        { x: side * 12.1, yOff: -0.08, z: -5.15 },
        { x: side * 21.8, yOff: -0.35, z: 0.55 }
      ];
      for(const eng of engSpecs){
        const rNac = 1.43; // 2.86 m diameter Progress D-18T
        const ev = wingV(Math.abs(eng.x) / span);
        const wingMidY = wingYAt(ev);
        const wingChord = wingChordAt(ev);
        const wingHalfT = wingChord * wingThickAt(ev) * 0.45;
        const wingBottomY = wingMidY - wingHalfT;

        const nacG = new THREE.Group();
        nacG.position.set(eng.x, eng.yOff, eng.z);
        nacG.name = 'an124 wing engine';

        // De-ice metal inlet collar
        addM(nacG, new THREE.TorusGeometry(rNac * 0.90, rNac * 0.11, 16, 36), chromeMat, 0, 0, -2.36);
        // Sculpted Progress D-18T fan cowl profile (distinctive long thick intake + tapered rear cowl)
        const cowlProf = [
          new THREE.Vector2(rNac * 0.83, -2.42),
          new THREE.Vector2(rNac * 0.99, -2.02),
          new THREE.Vector2(rNac * 1.02, -0.45),
          new THREE.Vector2(rNac * 0.95, 1.25),
          new THREE.Vector2(rNac * 0.82, 1.82)
        ];
        const cowlGeo = new THREE.LatheGeometry(cowlProf, 34);
        cowlGeo.rotateX(Math.PI / 2);
        addM(nacG, cowlGeo, whiteMat);
        // Antonov blue cowl intake accent ring
        const cowlRing = new THREE.CylinderGeometry(rNac * 1.005, rNac * 1.005, 0.24, 32, 1, true);
        cowlRing.rotateX(Math.PI / 2);
        addM(nacG, cowlRing, accentMat, 0, 0, -1.68);
        // Dark acoustic inner intake barrel
        addM(nacG, new THREE.CylinderGeometry(rNac * 0.82, rNac * 0.80, 2.05, 28, 1, true), darkMat, 0, 0, -1.38).rotation.x = Math.PI / 2;

        // Translating reverser sleeve + internal cascade ring
        const revG = new THREE.Group();
        const revGeo = new THREE.CylinderGeometry(rNac * 0.94, rNac * 0.86, 1.08, 30, 1, true);
        revGeo.rotateX(Math.PI / 2);
        addM(revG, revGeo, whiteMat, 0, 0, 1.28);
        nacG.add(revG);
        reverserSleeves.push(revG);
        const casGeo = new THREE.CylinderGeometry(rNac * 0.82, rNac * 0.82, 0.90, 24, 1, true);
        casGeo.rotateX(Math.PI / 2);
        addM(nacG, casGeo, titaniumMat, 0, 0, 1.22);

        // Hot core exhaust nozzle & central plug cone
        const coreGeo = new THREE.CylinderGeometry(rNac * 0.56, rNac * 0.42, 1.72, 24);
        coreGeo.rotateX(Math.PI / 2);
        addM(nacG, coreGeo, titaniumMat, 0, 0, 2.15);
        addM(nacG, new THREE.ConeGeometry(rNac * 0.35, 1.05, 18), titaniumMat, 0, 0, 3.00).rotation.x = Math.PI / 2;

        // 24-blade Titanium Progress D-18T fan + spinner spiral
        const fanG = new THREE.Group();
        fanG.position.z = -1.55;
        addM(fanG, new THREE.ConeGeometry(rNac * 0.25, 0.68, 18), darkMat, 0, 0, -0.20).rotation.x = -Math.PI / 2;
        addM(fanG, new THREE.TorusGeometry(rNac * 0.14, 0.017, 6, 16), whiteMat, 0, 0, -0.26);
        const bladeGeo = new THREE.BoxGeometry(0.095, rNac * 0.76, 0.028);
        for(let b = 0; b < 24; b++){
          const bg = new THREE.Group();
          bg.rotation.z = (b / 24) * Math.PI * 2;
          const bm = new THREE.Mesh(bladeGeo, titaniumMat);
          bm.position.y = rNac * 0.44;
          bm.rotation.y = 0.44;
          bg.add(bm);
          fanG.add(bg);
        }
        nacG.add(fanG);
        fans.push(fanG);

        // Sleek Tall Under-High-Wing Pylon: terminates safely between nacelle top & wingMidY (NEVER poking wing top!)
        const pyBotY = rNac * 0.76;
        const pyTopY = (wingBottomY - eng.yOff) + wingHalfT * 0.55; // cleanly inside wing lower skin -> strictly < wingTop!
        const pyH = Math.max(0.45, pyTopY - pyBotY);
        if(typeof AeroCraft !== 'undefined'){
          addM(nacG, AeroCraft.buildAeroPylonGeometry(pyH, 4.1, 4.6, 0.11, 1.15), whiteMat, 0, pyBotY, 0.25);
        }else{
          addM(nacG, new THREE.BoxGeometry(0.44, pyH, 4.2), whiteMat, 0, pyBotY + pyH * 0.5, 0.75);
        }

        hullRoot.add(nacG);
      }
    }

    // 8. Towering An-124 Swept Vertical Tail Fin (~20.5 m total ground height!) + Articulated Two-Piece Rudder
    const tailTipY = 16.05; // -4.48 -> +16.05 = 20.53 m!
    if(typeof AeroCraft !== 'undefined'){
      // Dorsal ram-air fin fillet intake along z = 14.2 .. 22.8 m
      addM(hullRoot, AeroCraft.buildVerticalFoilLoft([
        { y: 2.35, leadZ: 14.5, chord: 8.6, thick: 0.11 },
        { y: 5.15, leadZ: 19.6, chord: 7.4, thick: 0.10 }
      ], { slices: 14, capTip: false }), whiteMat);

      const finGeo = AeroCraft.buildVerticalFoilLoft([
        { y: 2.55, leadZ: 18.8, chord: 11.4, thick: 0.11 },
        { y: 9.20, leadZ: 24.8, chord: 7.8, thick: 0.095 },
        { y: tailTipY, leadZ: 30.8, chord: 4.1, thick: 0.08 }
      ], { slices: 24, capTip: true });
      addM(hullRoot, finGeo, tailMat).name = 'An-124 Vertical Tail';

      const rudder = new THREE.Group();
      rudder.position.set(0, 2.75, 29.8);
      rudder.add(new THREE.Mesh(AeroCraft.buildVerticalFoilLoft([
        { y: 0, leadZ: -0.6, chord: 2.35, thick: 0.085 },
        { y: tailTipY - 3.05, leadZ: 4.5, chord: 1.35, thick: 0.07 }
      ], { slices: 12, capTip: true }), accentMat));
      hullRoot.add(rudder);
      rudders.push(rudder);
    }

    beacons.push(
      addM(hullRoot, new THREE.SphereGeometry(0.17, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff2222 }), 0, tailTipY + 0.12, 32.8),
      addM(hullRoot, new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff2222 }), 0, -2.92, -3.5)
    );
    navLights.push(addM(hullRoot, new THREE.SphereGeometry(0.13, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xffffff }), 0, 2.25, half - 0.08));

    // 9. Authentic 24-Wheel Kneeling Multi-Bogie Landing Gear (grounded dead-flush at -gearH = -4.48 m!)
    //   - 2 Wide-Stance Twin-Wheel Nose Bogies (4 wheels) at x = +/- 1.42 m, z = -22.80 m (clearly aft of -25.64 m ramp!)
    //   - 2 Sponson Rows x 5 Independent Twin-Wheel Main Bogies (20 wheels) at x = +/- 3.82 m, z = 1.0, 3.1, 5.2, 7.3, 9.4 m
    const wheels = [];
    const noseTireR = 0.54, noseTireW = 0.30;
    const mainTireR = 0.62, mainTireW = 0.34;

    function createTireGeo(r, w){
      const pts = [
        [0.46, -0.50], [0.80, -0.50], [0.93, -0.42], [0.99, -0.26], [1, -0.14],
        [1, 0.14], [0.99, 0.26], [0.93, 0.42], [0.80, 0.50], [0.46, 0.50]
      ].map(([rr, yy]) => new THREE.Vector2(rr * r, yy * w));
      return new THREE.LatheGeometry(pts, 24);
    }
    const noseTireGeo = createTireGeo(noseTireR, noseTireW);
    const mainTireGeo = createTireGeo(mainTireR, mainTireW);

    function addTire(parent, x, y, z, r, geo){
      const wG = new THREE.Group();
      wG.position.set(x, y, z);
      wG.rotation.z = Math.PI / 2;
      wG.userData = { radius: r };
      addM(wG, geo, rubberMat);
      addM(wG, new THREE.CylinderGeometry(r * 0.49, r * 0.49, r * 0.54, 14), chromeMat);
      parent.add(wG);
      wheels.push(wG);
      return wG;
    }

    // Dual Wide-Stance Nose Struts (4 nose tires total, strictly aft of ramp hinge z=-25.64!)
    const noseStruts = [];
    const nosePivotY = -2.28, nosePivotZ = -22.80;
    const noseAxleY = -gearH + noseTireR; // -3.94 m
    const noseStrutLen = Math.abs(noseAxleY - nosePivotY); // 1.66 m
    for(const side of [-1, 1]){
      const piv = new THREE.Group();
      piv.position.set(side * 1.42, nosePivotY, nosePivotZ);
      addM(piv, new THREE.CylinderGeometry(0.14, 0.13, noseStrutLen * 0.72, 12), metalMat, 0, -noseStrutLen * 0.36, 0);
      addM(piv, new THREE.CylinderGeometry(0.06, 0.06, noseStrutLen * 0.65, 8), titaniumMat, -side * 0.24, -noseStrutLen * 0.32, 0.25).rotation.set(-0.30, 0, side * 0.24);
      const oleo = new THREE.Group();
      oleo.position.set(0, -noseStrutLen, 0);
      addM(oleo, new THREE.CylinderGeometry(0.10, 0.10, 0.85, 10), chromeMat, 0, 0.42, 0);
      const steer = new THREE.Group();
      addM(steer, new THREE.CylinderGeometry(0.07, 0.07, 0.64, 10), metalMat, 0, 0, 0).rotation.z = Math.PI / 2;
      addM(steer, new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff8dc }), 0, 0.42, -0.14);
      for(const ws of [-1, 1]) addTire(steer, ws * 0.30, 0, 0, noseTireR, noseTireGeo);
      oleo.add(steer);
      piv.add(oleo);
      gear.add(piv);
      noseStruts.push({ pivot: piv, oleo, steer, side, baseY: nosePivotY });
    }

    // Dual Sponson 5-Bogie Main Landing Gear Rows (10 bogies x 2 wheels = 20 main tires!)
    const mainBogies = [];
    const mainPivotY = -2.28;
    const mainAxleY = -gearH + mainTireR; // -3.86 m
    const mainLen = Math.abs(mainAxleY - mainPivotY); // 1.58 m
    for(const side of [-1, 1]){
      for(const bz of [1.0, 3.1, 5.2, 7.3, 9.4]){
        const piv = new THREE.Group();
        piv.position.set(side * 3.82, mainPivotY, bz);
        addM(piv, new THREE.CylinderGeometry(0.13, 0.12, mainLen * 0.70, 10), metalMat, 0, -mainLen * 0.35, 0);
        const oleo = new THREE.Group();
        oleo.position.set(0, -mainLen, 0);
        addM(oleo, new THREE.CylinderGeometry(0.095, 0.095, 0.62, 10), chromeMat, 0, 0.30, 0);
        addM(oleo, new THREE.CylinderGeometry(0.075, 0.075, 0.90, 10), metalMat, 0, 0, 0).rotation.z = Math.PI / 2;
        for(const ws of [-1, 1]) addTire(oleo, ws * 0.42, 0, 0, mainTireR, mainTireGeo);
        piv.add(oleo);
        gear.add(piv);
        mainBogies.push({ pivot: piv, oleo, side });
      }
    }

    // 10. Synchronized Heavy Oversized Cargo Modules (Exterior Hangar/Runway bay + Cabin hold view!)
    function buildOversizedCrate(index){
      const cg = new THREE.Group();
      const basePallet = new THREE.Mesh(new THREE.BoxGeometry(3.25, 0.18, 5.4), new THREE.MeshStandardMaterial({ color: 0x768592, roughness: 0.45, metalness: 0.58 }));
      basePallet.position.y = 0.09;
      cg.add(basePallet);
      if(index === 0){
        // Aerospace Satellite Launch Container
        const body = addM(cg, new THREE.BoxGeometry(2.75, 1.95, 4.45), new THREE.MeshStandardMaterial({ color: 0xe3e9ef, roughness: 0.34, metalness: 0.25 }), 0, 1.15, 0);
        void body;
        addM(cg, new THREE.BoxGeometry(2.82, 0.18, 4.52), accentMat, 0, 1.15, 0);
        addM(cg, new THREE.BoxGeometry(2.82, 0.12, 0.65), yellowTrimMat, 0, 1.15, -1.35);
      }else if(index === 1){
        // Giant Heavy Power-Gen Turbine Module on Twin Steel Skid Frame
        const cyl = addM(cg, new THREE.CylinderGeometry(1.18, 1.18, 4.6, 20), new THREE.MeshStandardMaterial({ color: 0x26547c, roughness: 0.36, metalness: 0.42 }), 0, 1.42, 0);
        cyl.rotation.x = Math.PI / 2;
        for(const xs of [-1.15, 1.15]) addM(cg, new THREE.BoxGeometry(0.16, 0.95, 4.85), yellowTrimMat, xs, 0.65, 0);
        for(const zs of [-1.8, 1.8]) addM(cg, new THREE.TorusGeometry(1.22, 0.07, 8, 20), metalMat, 0, 1.42, zs);
      }else{
        // Tracked Industrial Generator / Heavy Equipment Platform w/ Amber Tie-Down Straps
        addM(cg, new THREE.BoxGeometry(2.88, 1.68, 4.5), new THREE.MeshStandardMaterial({ color: 0xc87d28, roughness: 0.42, metalness: 0.28 }), 0, 1.02, 0);
        addM(cg, new THREE.BoxGeometry(2.94, 0.22, 4.56), darkMat, 0, 1.76, 0);
      }
      cg.userData = { index, zBay: -17.5 + index * 7.2 };
      return cg;
    }

    const palletMeshes = [];
    const extPallets = [];
    for(let i = 0; i < 3; i++){
      const cabPallet = buildOversizedCrate(i);
      cabPallet.position.set(0, rampSillY + 0.08, -17.5 + i * 7.2);
      cabBayGroup.add(cabPallet);
      palletMeshes.push(cabPallet);

      const extPallet = buildOversizedCrate(i);
      extPallet.position.set(0, rampSillY + 0.08, -17.5 + i * 7.2);
      bayGroup.add(extPallet);
      extPallets.push(extPallet);
    }

    // 11. Articulated Animations: Kneeling Ruslan Nose + Ramp + 24-Wheel Gear + Control Surfaces + Cranes + Cargo
    let smoothGear = 1, smoothOleo = 0, smoothSteer = 0, smoothKneel = 0;
    let smoothFlaps = 0, smoothSlats = 0, smoothSpoilers = 0, smoothRev = 0;

    function updateCargoDoors(noseOpen, _sideOpen, dt){
      const dTime = clamp(dt || 0.016, 0.001, 0.12);
      const extension = clamp((noseDoor.rotation.x - 0.31) / 0.98, 0, 1);
      // An-124 crouches forward nose down (-0.025 rad) once nose visor rises clear
      const kneelTarget = smoothstep(0.16, 0.88, noseDoor.rotation.x / 1.37);
      smoothKneel += (kneelTarget - smoothKneel) * Math.min(1, dTime * 4.2);
      kneelPivot.rotation.x = -smoothKneel * 0.025;

      cargoRamp.visible = extension > 0.025;
      cargoRamp.rotation.x = THREE.MathUtils.lerp(1.42, -0.345, extension);
      rampToe.rotation.x = THREE.MathUtils.lerp(-2.75, 0.195, extension);
      // Warm bay flood illumination intensifies when visor opens
      if(cargoBayLight) cargoBayLight.intensity = noseDoor.rotation.x > 0.25 ? 48 * clamp(noseDoor.rotation.x, 0, 1) : 0;
    }

    function syncExteriorCargo(f, dt){
      const dTime = clamp(dt || 0.016, 0.001, 0.12);
      const pallets = f?.pallets || [0, 0, 0];
      const loadingPct = f?.noseDoor ? clamp((f.service?.cargoProgress ?? (Math.sin(performance.now() * 0.0012) * 0.5 + 0.5)), 0, 1) : 1;
      for(let i = 0; i < 3; i++){
        const wt = clamp((pallets[i] || 0) / 44000, 0.35, 1.15);
        const visible = (pallets[i] || 0) > 0;
        const ep = extPallets[i];
        const cp = palletMeshes[i];
        const targetZ = visible ? (ep.userData.zBay + (f?.noseDoor ? (1 - loadingPct) * (-6.5 + i * 1.4) : 0)) : ep.userData.zBay;
        ep.visible = visible;
        ep.scale.set(0.86 + wt * 0.14, 0.72 + wt * 0.28, 1);
        ep.position.z += (targetZ - ep.position.z) * Math.min(1, dTime * 4);
        if(cp){
          cp.visible = visible;
          cp.scale.copy(ep.scale);
          cp.position.z = ep.position.z;
        }
      }
      // Subtle travel along gantry bridge beam when bay is open
      gantryCranes.forEach((cr, idx) => {
        const tgtZ = (idx === 0 ? -19.5 : -10.5) + (f?.noseDoor ? Math.sin(performance.now() * 0.0009 + idx * 2) * 2.4 : 0);
        cr.position.z += (tgtZ - cr.position.z) * Math.min(1, dTime * 3);
        if(bayCranes[idx]) bayCranes[idx].position.z = cr.position.z;
      });
    }

    function updateGear(gProg, dt, f, paused){
      const dTime = clamp(dt || 0.016, 0.001, 0.12);
      const rawTarget = clamp(gProg ?? (f ? (f.gear ? 1 : 0) : 1), 0, 1);
      smoothGear = paused ? rawTarget : smoothGear + (rawTarget - smoothGear) * Math.min(1, dTime * 5.2);
      const p = smoothGear;
      const ext = clamp((p - 0.10) / 0.90, 0, 1);

      const tgtOleo = f && f.ground ? clamp(Math.max(0, -(f.vy || 0)) * 0.036, 0, 0.13) : 0;
      smoothOleo += (tgtOleo - smoothOleo) * Math.min(1, dTime * 10);

      // Synchronize wide dual-strut nose gear w/ Ruslan nose-kneel crouch (tires stay flush at -gearH!)
      const kneelDrop = smoothKneel * 0.70;
      const steer = f && f.ground ? -clamp((f.manualControls?.rudder ?? 0) * 0.44 + (f.manualControls?.roll ?? 0) * 0.24, -0.46, 0.46) : 0;
      smoothSteer += (steer - smoothSteer) * Math.min(1, dTime * 8);
      for(const ns of noseStruts){
        ns.pivot.rotation.x = -(1 - ext) * 1.48;
        ns.pivot.position.y = ns.baseY - kneelDrop * ext;
        ns.oleo.position.y = -noseStrutLen + (smoothOleo * 0.45 + kneelDrop) * ext;
        ns.steer.rotation.y = smoothSteer;
      }
      // 10 main bogies retract inward/upward into fuselage sponson bays
      for(const mb of mainBogies){
        mb.pivot.rotation.z = -mb.side * (1 - ext) * 1.42;
        mb.oleo.position.y = -mainLen + smoothOleo;
      }

      gear.visible = p > 0.05;
    }

    function updateAeroSurfaces(f, dt, _now, paused){
      const dTime = clamp(dt || 0.016, 0.001, 0.12);
      const blend = paused ? 1 : Math.min(1, dTime * 7);
      const fTarget = f ? clamp((f.flaps || 0) / 2, 0, 1) : 0;
      const sTarget = f ? clamp((f.flaps || 0) > 0 ? 1 : 0, 0, 1) : 0;
      const spTarget = f && (f.spoilers || (f.ground && f.reverse)) ? 1 : 0;
      const rTarget = f && f.reverse && f.ground ? 1 : 0;

      smoothFlaps += (fTarget - smoothFlaps) * Math.min(1, dTime * 3.4);
      smoothSlats += (sTarget - smoothSlats) * Math.min(1, dTime * 3.8);
      smoothSpoilers += (spTarget - smoothSpoilers) * blend;
      smoothRev += (rTarget - smoothRev) * Math.min(1, dTime * 5.0);

      for(const fl of flaps) fl.rotation.x = smoothFlaps * 0.44;
      for(const sl of slats){
        sl.rotation.x = -smoothSlats * 0.22;
        sl.position.y = (sl.userData.baseY ?? 0) - smoothSlats * 0.11;
        sl.position.z = (sl.userData.baseZ ?? 0) - smoothSlats * 0.15;
      }
      for(const sp of airBrakes) sp.rotation.x = -smoothSpoilers * 0.74;
      for(const rv of reverserSleeves) rv.position.z = smoothRev * 0.58;

      const roll = f && !f.tow ? (f.manualControls?.roll ?? 0) : 0;
      const pitch = f && !f.tow ? (f.manualControls?.pitch ?? 0) : 0;
      const rudder = f && !f.tow ? (f.manualControls?.rudder ?? 0) : 0;
      if(surfaces[0]) surfaces[0].rotation.x = smoothFlaps * 0.12 + roll * 0.28;
      if(surfaces[1]) surfaces[1].rotation.x = smoothFlaps * 0.12 - roll * 0.28;
      for(const ev of elevs) ev.rotation.x = -pitch * 0.32;
      for(const rd of rudders) rd.rotation.y = rudder * 0.35;

      for(let i = 0; i < fans.length; i++){
        const running = f ? Boolean(f.engines?.[i] && f.fuel !== 0) : false;
        const rate = running ? (14 + (f?.power || 0) * 30 + (f?.reverse ? 16 : 0)) : 0.4;
        fans[i].rotation.z += rate * dTime;
      }
    }

    function applyConformalLivery(themeId){
      const spec = AN124_THEMES[themeId] || AN124_THEMES.default;
      const newHullTex = makeRuslanHullTexture(themeId, true);
      const newNoseTex = makeRuslanHullTexture(themeId, false);
      const newTailTex = makeRuslanTailTexture(themeId);
      if(newHullTex){
        hullMat.map?.dispose?.();
        hullMat.map = newHullTex;
        hullMat.needsUpdate = true;
      }
      if(newNoseTex){
        radomeMat.map?.dispose?.();
        radomeMat.map = newNoseTex;
        radomeMat.needsUpdate = true;
      }
      if(newTailTex){
        tailMat.map?.dispose?.();
        tailMat.map = newTailTex;
        tailMat.needsUpdate = true;
      }
      accentMat.color.set(spec.stripe1);
      whiteMat.color.set(spec.hullTop);
    }

    group.userData = {
      an124HighDef: true,
      articulatedGear: true,
      blades: [],
      cockpitEye: { x: -0.44, y: 2.66, z: -23.52 },
      cockpitPanelEye: { x: -0.22, y: 2.64, z: -23.52 },
      setCabinHoldVisible: vis => { cabBayGroup.visible = Boolean(vis); },
      gear, wheels, gearHeight: gearH, half, radius, span,
      cabin, closeDetails, kneelPivot, hullRoot,
      noseDoor, sideDoor: null, cargoRamp, rampToe, palletMeshes, extPallets,
      gantryCranes, cargoBayLight,
      fans, engines: fans, flaps, slats, surfaces, airBrakes, elevs, rudders,
      reverserSleeves, landingLights, navLights, strobes, beacons,
      cockpitGlassMats: [glassMat],
      updateCargoDoors,
      syncExteriorCargo,
      updateGear,
      updateAeroSurfaces,
      applyConformalLivery
    };

    cabin.visible = false;
    if(scene) scene.add(group, cabin);
    return group;
  }

  // Dedicated Russian-Teal Antonov An-124-100 Upper Flight Deck (Dual Rams-Horn Yokes, Quad D-18T Quadrant, Analog+EFIS MIP)
  function refineAn124FlightDeck(model, profile){
    const data = model?.userData;
    const cabin = data?.cabin;
    if(!cabin) return { update(){}, animateControls(){}, switches: [], setBacklight(){} };

    const deckY = 2.15, deckZ = -23.48;
    const switches = [];

    // Signature Antonov Russian Emerald-Teal Cockpit Color Palette!
    const tealPanelMat = new THREE.MeshStandardMaterial({ color: 0x2d5e63, roughness: 0.56, metalness: 0.14 });
    const darkTealMat = new THREE.MeshStandardMaterial({ color: 0x1d4147, roughness: 0.62, metalness: 0.16 });
    const slateShellMat = new THREE.MeshStandardMaterial({ color: 0x222c33, roughness: 0.68, metalness: 0.18 });
    const glareMat = new THREE.MeshStandardMaterial({ color: 0x141b20, roughness: 0.78 });
    const bezelMat = new THREE.MeshStandardMaterial({ color: 0x1b2329, roughness: 0.46, metalness: 0.42 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x8695a2, roughness: 0.28, metalness: 0.74 });
    const gripMat = new THREE.MeshStandardMaterial({ color: 0x171b20, roughness: 0.85 });

    const b = (parent, mat, w, h, d, x, y, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      parent.add(m);
      return m;
    };

    // Upper flight deck structural floor, sculpted console housing BEHIND MIP, side walls, captain & F/O seats
    b(cabin, slateShellMat, 3.60, 0.10, 2.75, 0, deckY - 0.62, deckZ - 0.18);
    // Console housing BoxGeometry stays below black glare shield and aft of -25.55 m nose step
    const consoleBox = b(cabin, tealPanelMat, 3.24, 0.56, 0.30, 0, deckY - 0.14, deckZ - 1.56);
    consoleBox.rotation.x = -0.08;
    // Lower pedestal skirt & rudder kickboard
    b(cabin, darkTealMat, 3.20, 0.30, 0.30, 0, deckY - 0.44, deckZ - 1.46);

    // Crew seats (sheepskin + Russian teal trim frames)
    const seatSkinMat = new THREE.MeshStandardMaterial({ color: 0x434a50, roughness: 0.88 });
    for(const s of [-1, 1]){
      b(cabin, tealPanelMat, 0.18, 0.92, 1.48, s * 1.48, deckY - 0.06, deckZ - 0.68);
      b(cabin, seatSkinMat, 0.60, 0.72, 0.15, s * 0.54, deckY - 0.04, deckZ + 0.62).rotation.x = -0.10;
      b(cabin, seatSkinMat, 0.60, 0.12, 0.62, s * 0.54, deckY - 0.44, deckZ + 0.38);
    }

    // Antonov Glare Shield, Header Bow & Window Mullion Columns (clean peripheral view!)
    b(cabin, glareMat, 2.86, 0.09, 0.48, 0, deckY + 0.25, deckZ - 1.24).rotation.x = 0.05;
    b(cabin, glareMat, 2.84, 0.08, 0.38, 0, deckY + 1.02, deckZ - 0.95);
    const ctrPost = b(cabin, glareMat, 0.05, 0.88, 0.08, 0, deckY + 0.63, deckZ - 1.12);
    ctrPost.rotation.x = -0.40;
    for(const s of [-1, 1]){
      const post = b(cabin, glareMat, 0.06, 0.90, 0.08, s * 1.38, deckY + 0.62, deckZ - 1.05);
      post.rotation.set(-0.40, 0, s * 0.06);
      b(cabin, tealPanelMat, 0.14, 0.16, 1.32, s * 1.42, deckY + 0.18, deckZ - 0.62);
    }
    const ovh = b(cabin, darkTealMat, 1.62, 0.07, 0.76, 0, deckY + 1.08, deckZ - 0.38);
    ovh.rotation.x = 0.36;

    // Night warm Soviet red-amber & green instrument flood lighting
    const floodMat = new THREE.MeshBasicMaterial({ color: 0xff9d3b, transparent: true, opacity: 0 });
    b(cabin, floodMat, 2.40, 0.02, 0.03, 0, deckY + 0.21, deckZ - 1.04);
    const floodLight = typeof THREE.PointLight === 'function' ? new THREE.PointLight(0xffaa55, 0, 4.4, 2) : null;
    if(floodLight){
      floodLight.position.set(0, deckY + 0.18, deckZ - 0.90);
      cabin.add(floodLight);
    }

    // Main Russian-Teal Hybrid Analog + Upgraded EFIS MIP Canvas (2048x576)
    const mipCanvas = document.createElement('canvas');
    mipCanvas.width = 2048; mipCanvas.height = 576;
    const mctx = mipCanvas.getContext('2d');
    const mipTex = new THREE.CanvasTexture(mipCanvas);
    mipTex.colorSpace = THREE.SRGBColorSpace;
    const mipMesh = new THREE.Mesh(new THREE.PlaneGeometry(2.60, 0.56), new THREE.MeshBasicMaterial({ map: mipTex }));
    mipMesh.position.set(0, deckY + 0.01, deckZ - 1.30); // clearly in front (+Z) of consoleBox & > 0.60m near clip!
    mipMesh.rotation.x = -0.08;
    cabin.add(mipMesh);

    // Center Glare Autopilot Strip
    const mcpCanvas = document.createElement('canvas');
    mcpCanvas.width = 1024; mcpCanvas.height = 128;
    const mcpCtx = mcpCanvas.getContext('2d');
    const mcpTex = new THREE.CanvasTexture(mcpCanvas);
    mcpTex.colorSpace = THREE.SRGBColorSpace;
    const mcpMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.76, 0.11), new THREE.MeshBasicMaterial({ map: mcpTex }));
    mcpMesh.position.set(0, deckY + 0.22, deckZ - 1.04);
    mcpMesh.rotation.x = -0.32;
    cabin.add(mcpMesh);

    // Center Pedestal w/ Navigation / Cargo-Kneel Computer CDU + Quad Progress D-18T Thrust Levers
    b(cabin, tealPanelMat, 0.58, 0.38, 1.34, 0, deckY - 0.42, deckZ - 0.52);
    const cduCanvas = document.createElement('canvas');
    cduCanvas.width = 512; cduCanvas.height = 384;
    const cduCtx = cduCanvas.getContext('2d');
    const cduTex = new THREE.CanvasTexture(cduCanvas);
    cduTex.colorSpace = THREE.SRGBColorSpace;
    const cduMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.30), new THREE.MeshBasicMaterial({ map: cduTex }));
    cduMesh.position.set(0, deckY - 0.22, deckZ - 0.88);
    cduMesh.rotation.x = -1.25;
    cabin.add(cduMesh);

    const throttleLevers = [];
    for(let i = 0; i < 4; i++){
      const tp = new THREE.Group();
      tp.position.set(-0.078 + i * 0.052, deckY - 0.24, deckZ - 0.45);
      b(tp, metalMat, 0.018, 0.19, 0.025, 0, 0.09, 0);
      b(tp, gripMat, 0.036, 0.044, 0.050, 0, 0.185, -0.01);
      cabin.add(tp);
      throttleLevers.push(tp);
    }
    const flapLever = new THREE.Group();
    flapLever.position.set(0.18, deckY - 0.24, deckZ - 0.42);
    b(flapLever, metalMat, 0.018, 0.14, 0.018, 0, 0.07, 0);
    b(flapLever, new THREE.MeshStandardMaterial({ color: 0xe8eff5 }), 0.048, 0.022, 0.042, 0, 0.14, 0);
    cabin.add(flapLever);

    const speedbrakeLever = new THREE.Group();
    speedbrakeLever.position.set(-0.18, deckY - 0.24, deckZ - 0.42);
    b(speedbrakeLever, metalMat, 0.018, 0.14, 0.018, 0, 0.07, 0);
    cabin.add(speedbrakeLever);

    const gearLever = new THREE.Group();
    gearLever.position.set(0.432, deckY + 0.05, deckZ - 1.24);
    b(gearLever, metalMat, 0.016, 0.12, 0.018, 0, -0.05, 0.03);
    const gKnob = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.022, 14),
      new THREE.MeshStandardMaterial({ color: 0xecf3f8 }));
    gKnob.position.set(0, -0.105, 0.04);
    gKnob.rotation.z = Math.PI / 2;
    gearLever.add(gKnob);
    cabin.add(gearLever);

    // Dual Classic Antonov Yokes
    const yokes = [];
    for(const s of [-1, 1]){
      const yp = new THREE.Group();
      yp.position.set(s * 0.48, deckY - 0.44, deckZ - 0.72);
      b(yp, bezelMat, 0.055, 0.38, 0.06, 0, 0.19, 0).rotation.x = -0.14;
      const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.148, 0.022, 10, 28, Math.PI * 1.28), bezelMat);
      wheel.position.set(0, 0.37, -0.02);
      wheel.rotation.z = Math.PI * 0.86;
      yp.add(wheel);
      cabin.add(yp);
      yokes.push({ pivot: yp, wheel });
    }

    // Clickable Switch Hitboxes matching flight.js labels
    const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
    const swSpecs = [
      ['電瓶', -0.45, deckY + 1.05, deckZ - 0.38],
      ['引擎 1', -0.25, deckY + 1.05, deckZ - 0.38],
      ['引擎 2', -0.08, deckY + 1.05, deckZ - 0.38],
      ['引擎 3', 0.08, deckY + 1.05, deckZ - 0.38],
      ['引擎 4', 0.25, deckY + 1.05, deckZ - 0.38],
      ['燈光', 0.45, deckY + 1.05, deckZ - 0.38],
      ['起落架', 0.432, deckY + 0.02, deckZ - 1.22],
      ['襟翼', 0.18, deckY - 0.16, deckZ - 0.42],
      ['擾流板', -0.18, deckY - 0.16, deckZ - 0.42],
      ['機鼻貨門', -0.52, deckY + 0.14, deckZ - 1.04],
      ['航向／高度保持', 0.52, deckY + 0.22, deckZ - 1.04]
    ];
    for(const [action, sx, sy, sz] of swSpecs){
      const sw = b(cabin, hitMat, 0.15, 0.12, 0.15, sx, sy, sz);
      sw.userData.action = action;
      switches.push(sw);
    }

    let backlight = 0.78, lastDraw = -999;
    function setBacklight(v){
      backlight = clamp(Number(v) || 0.78, 0.25, 1.0);
      lastDraw = -1;
    }

    function update(f, now, day){
      if(now - lastDraw < 90) return;
      lastDraw = now;
      const isNight = (day ?? 1) < 0.38;
      const dim = isNight ? (0.45 + 0.55 * backlight) : 1.0;
      floodMat.opacity = isNight ? backlight * 0.85 : 0;
      if(floodLight) floodLight.intensity = isNight ? backlight * 2.2 : 0;

      const elec = typeof cockpitElectrical !== 'undefined' ? cockpitElectrical.state : null;
      const batOn = !f ? true : Boolean(f.battery && (!elec || elec.battery));
      const fullAvionics = !f ? true : (batOn && (f.engines?.some(Boolean) || !elec || elec.avionics || elec.apu));

      const speeds = f && typeof flightSpeeds === 'function' ? flightSpeeds(f) : { ias: 0, tas: 0, gs: 0, mach: 0 };
      const kts = typeof knotsPerMps !== 'undefined' ? knotsPerMps : 1.94384;
      const iasKt = Math.round((speeds.ias || 0) * kts);
      const gsKt = Math.round((speeds.gs || 0) * kts);
      const altFt = Math.round((f?.y || 0) * 3.28084);
      const hdgDeg = Math.round((((f?.heading || 0) * 180 / Math.PI) % 360 + 360) % 360);
      const bank = f?.bank || 0, pitch = f?.pitch || 0;

      // Russian Emerald-Teal steel faceplate surround
      mctx.fillStyle = isNight ? '#162f33' : '#2d5e63';
      mctx.fillRect(0, 0, 2048, 576);

      // 6 Instrument Zones across MIP: PFD/ADI (0,5), ND/HSI (1,4), 4-Eng Analog+EFIS Engine Cluster (2), Kneel/Ramp/24-Wheel Synoptic (3)
      const panes = [22, 358, 694, 1030, 1366, 1702];
      const pw = 322, ph = 510;
      for(let i = 0; i < 6; i++){
        const px = panes[i], py = 32;
        const paneOn = (i === 2) ? batOn : fullAvionics;
        mctx.fillStyle = paneOn ? '#0a1618' : '#030809';
        mctx.fillRect(px, py, pw, ph);
        mctx.strokeStyle = isNight ? '#3f6d73' : '#6f9ea3'; mctx.lineWidth = 4;
        mctx.strokeRect(px, py, pw, ph);
        if(!paneOn) continue;

        mctx.save();
        mctx.globalAlpha = dim;
        if(i === 0 || i === 5){
          // An-124 Attitude Director + Speed/Altitude Digital Tapes
          mctx.fillStyle = '#142a2e'; mctx.fillRect(px + 10, py + 8, pw - 20, 32);
          mctx.fillStyle = '#7bffb0'; mctx.font = 'bold 17px monospace'; mctx.textAlign = 'left';
          mctx.fillText((f?.engines?.some(Boolean) ? 'TO/NOM' : 'STOP') + ' | ' + (f?.hold ? 'AP ATT' : 'MAN FD'), px + 16, py + 30);
          mctx.save();
          mctx.beginPath(); mctx.rect(px + 68, py + 76, 186, 260); mctx.clip();
          mctx.translate(px + 161, py + 206);
          mctx.rotate(-bank);
          mctx.translate(0, pitch * 260);
          mctx.fillStyle = '#2075a8'; mctx.fillRect(-240, -340, 480, 340);
          mctx.fillStyle = '#6e4e2a'; mctx.fillRect(-240, 0, 480, 340);
          mctx.strokeStyle = '#ffffff'; mctx.lineWidth = 2.5;
          mctx.beginPath(); mctx.moveTo(-220, 0); mctx.lineTo(220, 0); mctx.stroke();
          mctx.restore();
          mctx.fillStyle = '#eefaff'; mctx.font = 'bold 20px monospace';
          mctx.fillText(String(iasKt), px + 14, py + 212);
          mctx.fillText(String(altFt), px + pw - 68, py + 212);
          mctx.fillStyle = '#73e5ff'; mctx.font = '15px monospace';
          mctx.fillText('M ' + (speeds.mach || 0).toFixed(2) + '  HDG ' + String(hdgDeg).padStart(3, '0') + '°', px + 24, py + 382);
        }else if(i === 1 || i === 4){
          // Russian HSI / Navigation Map Display
          mctx.fillStyle = '#73e5ff'; mctx.font = 'bold 16px monospace'; mctx.textAlign = 'left';
          mctx.fillText('GS ' + gsKt + ' KT  HDG ' + String(hdgDeg).padStart(3, '0') + '°', px + 14, py + 28);
          mctx.strokeStyle = '#477f85'; mctx.lineWidth = 1.6;
          const cx = px + 161, cy = py + 288;
          for(const r of [60, 120, 180]){ mctx.beginPath(); mctx.arc(cx, cy, r, Math.PI * 1.15, Math.PI * 1.85); mctx.stroke(); }
          mctx.fillStyle = '#ffd159';
          mctx.beginPath(); mctx.moveTo(cx, cy - 12); mctx.lineTo(cx - 8, cy + 8); mctx.lineTo(cx + 8, cy + 8); mctx.closePath(); mctx.fill();
        }else if(i === 2){
          // Center Analog Dials + 4x Progress D-18T Vertical Gauges
          mctx.fillStyle = '#92eef7'; mctx.font = 'bold 17px monospace'; mctx.textAlign = 'left';
          mctx.fillText('AN-124-100 · 4x D-18T', px + 14, py + 28);
          for(let e = 0; e < 4; e++){
            const running = f ? Boolean(f.engines?.[e] && f.fuel !== 0) : false;
            const n1 = running ? Math.round(24 + (f?.power || 0) * 78) : 0;
            const gx = px + 46 + e * 76, gy = py + 112;
            mctx.strokeStyle = '#335a60'; mctx.lineWidth = 5;
            mctx.beginPath(); mctx.arc(gx, gy, 28, Math.PI * 0.75, Math.PI * 2.15); mctx.stroke();
            mctx.strokeStyle = running ? '#67f7a2' : '#7b5548';
            mctx.beginPath(); mctx.arc(gx, gy, 28, Math.PI * 0.75, Math.PI * 0.75 + (n1 / 110) * Math.PI * 1.4); mctx.stroke();
            mctx.fillStyle = '#eef8ff'; mctx.font = 'bold 15px monospace'; mctx.textAlign = 'center';
            mctx.fillText(n1 + '%', gx, gy + 6);
            mctx.font = '12px monospace'; mctx.fillStyle = '#9ecdd1';
            mctx.fillText('D' + (e + 1), gx, gy + 44);
          }
          mctx.textAlign = 'left'; mctx.font = 'bold 16px monospace'; mctx.fillStyle = '#eef8ff';
          mctx.fillText('FUEL  ' + Math.round(f?.fuel || 0).toLocaleString() + ' KG', px + 16, py + 206);
          const cargoKg = (f?.pallets || [0, 0, 0]).reduce((a, b) => a + b, 0);
          mctx.fillText('CARGO ' + Math.round(cargoKg).toLocaleString() + ' KG', px + 16, py + 236);
          mctx.fillStyle = f?.noseDoor ? '#ffd159' : '#67f7a2';
          mctx.fillText('VISOR/RAMP: ' + (f?.noseDoor ? 'OPEN' : 'LOCKED'), px + 16, py + 278);
          const isKneeling = Math.abs(data.kneelPivot?.rotation.x || 0) > 0.008;
          mctx.fillStyle = isKneeling ? '#ffd159' : '#67f7a2';
          mctx.fillText('NOSE KNEEL: ' + (isKneeling ? 'KNEELING' : 'FLIGHT HT'), px + 16, py + 306);
          const alerts = [];
          if(f?.parkingBrake) alerts.push(['PARKING BRAKE', '#ffd159']);
          if(f?.reverse) alerts.push(['D-18T REV x4', '#67f7a2']);
          if(f?.spoilers) alerts.push(['SPOILERS EXT', '#ffd159']);
          alerts.forEach(([msg, col], ai) => {
            mctx.fillStyle = col; mctx.fillText('> ' + msg, px + 16, py + 362 + ai * 26);
          });
        }else{
          // Synoptic: 24-Wheel Multi-Bogie Status, CG, Backlight %
          mctx.fillStyle = '#92eef7'; mctx.font = 'bold 17px monospace'; mctx.textAlign = 'left';
          mctx.fillText('RUSLAN 24-WHEEL & CG', px + 14, py + 28);
          mctx.font = '15px monospace'; mctx.fillStyle = '#67f7a2';
          const genStr = [0, 1, 2, 3].map(g => 'G' + (g + 1) + (f?.engines?.[g] ? '+' : '-')).join(' ');
          mctx.fillText('GEN ' + genStr, px + 16, py + 76);
          const bal = f?.aircraft && typeof cargoBalance === 'function' ? cargoBalance(f) : { shift: 0 };
          mctx.fillText('CG SHIFT: ' + (bal.shift >= 0 ? '+' : '') + bal.shift.toFixed(2) + ' m', px + 16, py + 114);
          const gCol = f?.gear === false ? '#687982' : '#4ee88f';
          for(const [gx, gy, lbl] of [[106, 178, 'N-L 2W'], [216, 178, 'N-R 2W'], [106, 236, 'MAIN L 10W'], [216, 236, 'MAIN R 10W']]){
            mctx.strokeStyle = gCol; mctx.lineWidth = 2.5; mctx.strokeRect(px + gx - 48, py + gy, 96, 32);
            mctx.fillStyle = gCol; mctx.textAlign = 'center'; mctx.fillText(lbl + (f?.gear === false ? ' UP' : ' DN'), px + gx, py + gy + 21);
          }
          mctx.textAlign = 'left'; mctx.fillStyle = '#a4c8d8';
          mctx.fillText(isNight ? ('BACKLIGHT ' + Math.round(backlight * 100) + '%') : 'DAYLIGHT AUTO', px + 16, py + 455);
        }
        mctx.restore();
      }
      mipTex.needsUpdate = true;

      mcpCtx.fillStyle = '#183338'; mcpCtx.fillRect(0, 0, 1024, 128);
      if(batOn){
        mcpCtx.fillStyle = fullAvionics ? '#ffbf54' : '#554022';
        mcpCtx.font = 'bold 34px monospace';
        mcpCtx.fillText('IAS ' + String(iasKt).padStart(3, '0'), 54, 74);
        mcpCtx.fillText('HDG ' + String(hdgDeg).padStart(3, '0'), 305, 74);
        mcpCtx.fillText('ALT ' + String(Math.round((f?.hold?.altitude ?? f?.y ?? 0) * 3.28084)).padStart(5, '0'), 555, 74);
        mcpCtx.fillStyle = (f?.hold && fullAvionics) ? '#59ff96' : '#55656e';
        mcpCtx.fillText(f?.hold ? 'SAU-124 ON' : 'SAU STBY', 810, 74);
      }
      mcpTex.needsUpdate = true;

      cduCtx.fillStyle = '#071416'; cduCtx.fillRect(0, 0, 512, 384);
      if(batOn){
        cduCtx.fillStyle = '#7beeff'; cduCtx.font = 'bold 24px monospace';
        cduCtx.fillText('RUSLAN LOAD & NAV', 22, 42);
        cduCtx.fillStyle = '#67f7a2'; cduCtx.font = '20px monospace';
        cduCtx.fillText('RTE: ' + (f?.departure?.code || 'RCKH') + ' -> ' + (f?.destination?.code || 'RCTP'), 22, 92);
        cduCtx.fillText('V1 134   VR 141   V2 151', 22, 140);
        const cargoTotal = (f?.pallets || [0, 0, 0]).reduce((a, b) => a + b, 0);
        cduCtx.fillText('CARGO: ' + Math.round(cargoTotal).toLocaleString() + ' KG', 22, 188);
        cduCtx.fillText('GW:    ' + Math.round(profile.mass + (f?.fuel || 0) + cargoTotal).toLocaleString() + ' KG', 22, 236);
        cduCtx.fillText(f?.noseDoor ? 'NOSE RAMP / KNEEL' : 'VISOR LOCKED', 22, 294);
      }
      cduTex.needsUpdate = true;
    }

    function animateControls(f, dt){
      if(!f) return;
      const roll = f.manualControls?.roll ?? 0, pitch = f.manualControls?.pitch ?? 0;
      const pwr = clamp(f.power ?? 0, 0, 1);
      const lerp = Math.min(1, (dt || 0.016) * 14);
      for(const y of yokes){
        y.pivot.rotation.x += (pitch * 0.18 - 0.10 - y.pivot.rotation.x) * lerp;
        y.wheel.rotation.z += (Math.PI * 0.86 - roll * 0.62 - y.wheel.rotation.z) * lerp;
      }
      const thrRot = 0.24 - pwr * 0.78 + (f.reverse ? 0.28 : 0);
      for(const lv of throttleLevers) lv.rotation.x += (thrRot - lv.rotation.x) * lerp;
      flapLever.rotation.x += (((f.flaps || 0) * 0.34 - 0.18) - flapLever.rotation.x) * lerp;
      speedbrakeLever.rotation.x += (((f.spoilers ? 0.42 : -0.18)) - speedbrakeLever.rotation.x) * lerp;
      gearLever.rotation.x += ((f.gear === false ? -0.36 : 0.28) - gearLever.rotation.x) * lerp;
    }

    data.setAn124Backlight = setBacklight;
    return { update, animateControls, switches, setBacklight };
  }

  globalScope.buildAn124Airframe = buildAn124Airframe;
  globalScope.refineAn124FlightDeck = refineAn124FlightDeck;
})(typeof window !== 'undefined' ? window : globalThis);
