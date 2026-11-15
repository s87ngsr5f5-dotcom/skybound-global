'use strict';
// Boeing 747-8F High-Definition Airframe, Articulated Nose/Side Cargo Doors, 4x GEnx-2B67, 18-Wheel Gear, Cargo Hold & Upper-Deck Flight Deck
// Original procedural reference model derived from public Boeing 747-8 Airport Planning dimensions (76.30 m x 68.40 m, no external non-free assets)
(function (globalScope) {
  function clamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }
  function smoothstep(a, b, x){
    const t = clamp((x - a) / Math.max(1e-5, b - a), 0, 1);
    return t * t * (3 - 2 * t);
  }

  // Exact Boeing 747-8F double-lobe envelope parameters along longitudinal station Z (-38.15 .. +38.15)
  function hullParamsAt(z){
    // Lower deck width rx(z), bottom ryBot(z), main-deck top ryMain(z), center yOff(z)
    let rx, ryBot, ryMain, yOff = 0;
    if(z < -31.8){
      const t = smoothstep(-38.15, -31.8, z);
      const rad = Math.pow(t, 0.56);
      rx = 0.09 + 2.62 * rad;
      ryBot = 0.12 + 2.58 * rad;
      ryMain = 0.12 + 1.94 * rad;
      yOff = -0.35 * (1 - t);
    }else if(z < -20.5){
      const t = smoothstep(-31.8, -20.5, z);
      rx = 2.71 + 0.54 * t;
      ryBot = 2.70 + 0.64 * t;
      ryMain = 2.06 + 1.24 * t;
    }else if(z <= 12.0){
      rx = 3.25;
      ryBot = 3.34;
      ryMain = 3.30;
    }else{
      // Upswept aft tailcone characteristic of Boeing 747
      const t = smoothstep(12.0, 38.15, z);
      const shrink = 1 - Math.pow(t, 1.32) * 0.94;
      rx = Math.max(0.16, 3.25 * shrink);
      ryBot = Math.max(0.16, 3.34 * Math.pow(1 - t, 1.15) + 0.16);
      ryMain = Math.max(0.16, 3.30 * Math.pow(1 - t, 1.15) + 0.16);
      yOff = 1.42 * Math.pow(t, 1.35);
    }

    // Authentic 747-8F SHORT upper deck crown lobe starting aft of nose visor hinge (-31.68 .. -11.5)
    const humpRise = smoothstep(-31.68, -29.95, z);
    const humpFall = 1 - smoothstep(-20.2, -11.5, z);
    const hump = humpRise * humpFall;
    const uhx = 2.12 * hump;
    const uyCenter = 1.95;
    const uhy = 2.48 * hump;

    return { rx, ryBot, ryMain, yOff, hump, uhx, uyCenter, uhy };
  }

  function hullSurfacePoint(z, phi){
    // phi: 0 = bottom (-ryBot), PI = top crown (+ryMain), 0..PI starboard (+X), PI..2PI port (-X)
    const s = hullParamsAt(z);
    const cosP = Math.cos(phi);
    const sinP = Math.sin(phi);
    const ry = cosP > 0 ? s.ryBot : s.ryMain;
    let x = Math.sin(phi) * s.rx;
    let y = s.yOff - cosP * ry;

    // Smoothly blend upper-deck dome over top quadrant without crease z-fighting
    if(s.hump > 0.005 && phi > Math.PI * 0.34 && phi < Math.PI * 1.66){
      const tDome = (phi - Math.PI) / (Math.PI * 0.66); // -1 .. +1 centered at top PI
      const domeA = tDome * Math.PI * 0.72;
      const dxUpper = Math.sin(domeA) * s.uhx;
      const dyUpper = s.uyCenter + Math.cos(domeA) * s.uhy;
      const blendW = Math.pow(Math.max(0, Math.cos(tDome * Math.PI * 0.5)), 0.72) * s.hump;
      // Preserve widest silhouette in x while swelling smoothly upward into upper deck crown
      if(dyUpper > y){
        const k = smoothstep(0.0, 0.35, blendW);
        y = THREE.MathUtils.lerp(y, Math.max(y, dyUpper), k);
        const upperW = Math.abs(dxUpper);
        const sideMix = smoothstep(Math.PI * 0.52, Math.PI * 0.75, Math.PI - Math.abs(phi - Math.PI));
        x = Math.sign(sinP || 1) * Math.max(Math.abs(x) * (1 - 0.38 * k * (1 - sideMix)), upperW * k + Math.abs(x) * (1 - k));
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
      const [fx, fy, fz] = hullSurfacePoint(zStart, 0);
      const cy = hullParamsAt(zStart).yOff;
      const cIdx = pos.length / 3;
      pos.push(0 - px, cy - py, fz - pz);
      uvs.push(0, 0.5);
      for(let j = 0; j < slices; j++){
        idx.push(cIdx, j + 1, j);
      }
      void fx; void fy;
    }
    if(capBack){
      const backBase = rings * rLen;
      const cy = hullParamsAt(zEnd).yOff;
      const cIdx = pos.length / 3;
      pos.push(0 - px, cy - py, zEnd - pz);
      uvs.push(1, 0.5);
      for(let j = 0; j < slices; j++){
        idx.push(cIdx, backBase + j, backBase + j + 1);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return geo;
  }

  function buildB748FAirframe(profile, scene){
    const group = new THREE.Group();
    const gear = new THREE.Group();
    const cabin = new THREE.Group();
    const closeDetails = new THREE.Group();
    const noseDoor = new THREE.Group();
    const sideDoor = new THREE.Group();
    group.add(gear, closeDetails, noseDoor, sideDoor);

    const [half, radius, span, wingY] = profile.geometry; // [38.15, 3.25, 34.2, -1.10]
    const gearH = profile.gearHeight ?? 4.60;
    const panelBump = typeof AeroCraft !== 'undefined' ? AeroCraft.getPanelBumpTexture(THREE) : null;
    const stockColor = profile.trimColor ?? 0x154a78;

    const whiteMat = new THREE.MeshPhysicalMaterial({
      color: 0xf1f5f8, roughness: 0.28, metalness: 0.10,
      clearcoat: 0.86, clearcoatRoughness: 0.11,
      bumpMap: panelBump, bumpScale: 0.011
    });
    const wingUpperMat = new THREE.MeshPhysicalMaterial({
      color: 0xe3e9ee, roughness: 0.34, metalness: 0.16,
      clearcoat: 0.62, clearcoatRoughness: 0.18,
      bumpMap: panelBump, bumpScale: 0.012, side: THREE.DoubleSide
    });
    const accentMat = new THREE.MeshPhysicalMaterial({
      color: stockColor, roughness: 0.30, metalness: 0.14,
      clearcoat: 0.84, clearcoatRoughness: 0.12,
      bumpMap: panelBump, bumpScale: 0.011
    });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xd9a742, roughness: 0.32, metalness: 0.45 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x8696a2, roughness: 0.26, metalness: 0.74 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xc8d4dc, roughness: 0.14, metalness: 0.88 });
    const titaniumMat = new THREE.MeshStandardMaterial({ color: 0x434d55, roughness: 0.34, metalness: 0.78 });
    const radomeMat = new THREE.MeshPhysicalMaterial({ color: 0xeaf0f4, roughness: 0.36, metalness: 0.04, clearcoat: 0.7 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x151e26, roughness: 0.68 });
    const rubberMat = new THREE.MeshStandardMaterial({ color: 0x161a1e, roughness: 0.92 });
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x10222c, roughness: 0.06, metalness: 0.78,
      clearcoat: 1.0, clearcoatRoughness: 0.04,
      transparent: true, opacity: 0.84
    });
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x26323a, roughness: 0.44, side: THREE.DoubleSide });

    function addM(parent, geo, mat, x = 0, y = 0, z = 0){
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      parent.add(m);
      return m;
    }

    // 1. Articulated Upward-Hinged Nose Visor Cargo Door (hinged cleanly forward of upper-deck windshield)
    const noseHingeZ = -31.80, noseHingeY = 2.08;
    noseDoor.position.set(0, noseHingeY, noseHingeZ);
    const visorGeo = buildLoftedSegment(-half, noseHingeZ, 24, 56, [0, noseHingeY, noseHingeZ], false, true);
    addM(noseDoor, visorGeo, radomeMat).name = 'B748F Nose Visor Door';
    // Contoured elliptical nose-visor seal collar (never extends above hingeY)
    const seamPts = [];
    for(let i = 0; i <= 40; i++){
      const [sx, sy] = hullSurfacePoint(noseHingeZ - 0.02, (i / 40) * Math.PI * 2);
      seamPts.push(new THREE.Vector3(sx, Math.min(-0.02, sy - noseHingeY), -0.02));
    }
    addM(noseDoor, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(seamPts, true), 40, 0.032, 6, true), metalMat);

    // 2. Main Double-Lobe Fuselage (-31.80 .. +38.15) with Authentic Short Freighter Upper Deck
    const mainHullGeo = buildLoftedSegment(noseHingeZ, half, 96, 60, [0, 0, 0], false, false);
    addM(group, mainHullGeo, whiteMat).name = 'B748F Double-Lobe Fuselage';

    // Internal Nose Bulkhead Rim & Threshold Apron (visible when noseDoor opens cleanly!)
    const bulkheadGroup = new THREE.Group();
    bulkheadGroup.position.set(0, 0, noseHingeZ + 0.14);
    addM(bulkheadGroup, new THREE.BoxGeometry(4.3, 2.45, 0.22), darkMat, 0, 0.25, 0);
    addM(bulkheadGroup, new THREE.BoxGeometry(4.55, 0.16, 0.55), titaniumMat, 0, -0.95, 0.05);
    for(const side of [-1, 1]){
      addM(bulkheadGroup, new THREE.BoxGeometry(0.18, 2.55, 0.42), metalMat, side * 2.12, 0.30, 0.05);
      // Hydraulic nose-visor lift actuator struts inside upper frame
      addM(bulkheadGroup, new THREE.CylinderGeometry(0.055, 0.075, 1.35, 10), chromeMat, side * 1.45, 1.15, 0.12).rotation.x = 0.22;
    }
    group.add(bulkheadGroup);

    // 3. Port Aft Main-Deck Side Cargo Door (sideDoor) + Interior Threshold Seal
    const sdX = -3.22, sdY = 1.62, sdZ = 14.8;
    sideDoor.position.set(sdX, sdY, sdZ);
    const sdPanel = addM(sideDoor, new THREE.BoxGeometry(0.14, 2.42, 3.55), whiteMat, 0, -1.21, 0);
    sdPanel.name = 'B748F Port Side Cargo Door';
    addM(sideDoor, new THREE.BoxGeometry(0.155, 0.46, 3.52), accentMat, -0.01, -1.55, 0);
    addM(sideDoor, new THREE.BoxGeometry(0.10, 2.28, 3.40), titaniumMat, 0.05, -1.21, 0);
    // Internal side door opening frame
    addM(group, new THREE.BoxGeometry(0.14, 2.38, 3.50), darkMat, -3.14, 0.42, sdZ);

    // Freighter fuselage stripe + tail APU exhaust cone
    for(const side of [-1, 1]){
      const stripeSegs = [];
      for(let i = 0; i <= 24; i++){
        const z = THREE.MathUtils.lerp(-30.5, 30.0, i / 24);
        const s = hullParamsAt(z);
        stripeSegs.push(new THREE.Vector3(side * (s.rx + 0.018), s.yOff + 0.22, z));
      }
      const lineGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(stripeSegs), 32, 0.045, 6, false);
      addM(group, lineGeo, goldMat);
    }
    const apuCone = addM(group, new THREE.CylinderGeometry(0.16, 0.34, 0.92, 20), titaniumMat, 0, 1.44, half - 0.36);
    apuCone.rotation.x = Math.PI / 2 - 0.05;
    const apuCore = addM(group, new THREE.CylinderGeometry(0.10, 0.14, 0.24, 14), darkMat, 0, 1.46, half + 0.06);
    apuCore.rotation.x = Math.PI / 2 - 0.05;

    // 4. Upper-Deck 6-Pane Boeing 747 Wraparound Windshield (streamlined flush surface projection!) + Supernumerary Windows
    function findHullPointAtY(z, side, targetY){
      let bestPhi = Math.PI - side * 0.15, bestErr = 99, bestPt = [0, targetY, z];
      for(let i = 4; i <= 96; i++){
        const phi = Math.PI - side * (i / 100) * Math.PI * 0.42;
        const pt = hullSurfacePoint(z, phi);
        const err = Math.abs(pt[1] - targetY);
        if(err < bestErr){ bestErr = err; bestPhi = phi; bestPt = pt; }
      }
      const pZ = hullSurfacePoint(z + 0.12, bestPhi);
      const pPhi = hullSurfacePoint(z, bestPhi - side * 0.04);
      const tPhi = new THREE.Vector3(pPhi[0] - bestPt[0], pPhi[1] - bestPt[1], 0).normalize();
      const tZ = new THREE.Vector3(pZ[0] - bestPt[0], pZ[1] - bestPt[1], 0.12).normalize();
      const nrm = new THREE.Vector3().crossVectors(tPhi, tZ).normalize();
      if(nrm.z > 0) nrm.negate();
      if(nrm.y < 0) nrm.negate();
      return { pt: new THREE.Vector3(bestPt[0], bestPt[1], bestPt[2]), nrm, tZ, tPhi };
    }
    function findHullZAtPhiY(phi, targetY, side){
      let bestZ = -30.5, bestErr = 99, bestPt = [0, targetY, -30.5];
      for(let i = 0; i <= 140; i++){
        const z = -31.65 + (i / 140) * 2.45;
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
      // 3 swept Boeing 747 upper-deck cockpit panes per side conforming flush along forehead sweep
      const paneSpecs = [
        { phiOff: 0.14, y: 3.12, w: 0.56, h: 0.44 },
        { phiOff: 0.30, y: 3.08, w: 0.54, h: 0.42 },
        { phiOff: 0.46, y: 3.04, w: 0.50, h: 0.39 }
      ];
      for(const sp of paneSpecs){
        const { pt, nrm, tPhi } = findHullZAtPhiY(Math.PI - side * sp.phiOff, sp.y, side);
        const uAxis = tPhi.clone().multiplyScalar(side);
        const vAxis = new THREE.Vector3().crossVectors(nrm, uAxis).normalize();
        const basis = new THREE.Matrix4().makeBasis(uAxis, vAxis, nrm);
        const q = new THREE.Quaternion().setFromRotationMatrix(basis);

        const fMesh = new THREE.Mesh(new THREE.BoxGeometry(sp.w + 0.04, sp.h + 0.04, 0.014), frameMat);
        fMesh.position.copy(pt).addScaledVector(nrm, 0.010);
        fMesh.quaternion.copy(q);
        closeDetails.add(fMesh);

        const gMesh = new THREE.Mesh(new THREE.BoxGeometry(sp.w, sp.h, 0.016), glassMat);
        gMesh.position.copy(pt).addScaledVector(nrm, 0.016);
        gMesh.quaternion.copy(q);
        closeDetails.add(gMesh);
      }
      // Low-profile windshield wipers
      const { pt: wPt, nrm: wNrm } = findHullZAtPhiY(Math.PI - side * 0.14, 2.94, side);
      addM(closeDetails, new THREE.BoxGeometry(0.02, 0.32, 0.012), darkMat, wPt.x + wNrm.x * 0.025, wPt.y + wNrm.y * 0.025, wPt.z + wNrm.z * 0.025).rotation.set(-0.68, -side * 0.22, side * 0.40);
      // Helper: orient upper-deck side detail tangentially on doubly-curved fuselage skin (prevents Z-fighting/clipping)
      function orientWallDetail(mesh, zCtr, targetY, outOff){
        let bestPhi = Math.PI - side * 0.42, bestErr = 99, bestPt = [0, targetY, zCtr];
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
        const nrm = new THREE.Vector3().crossVectors(uFwd, vUp).normalize();
        if(nrm.x * side < 0) nrm.negate();
        const uAxis = new THREE.Vector3().crossVectors(vUp, nrm).normalize();
        mesh.position.set(bestPt[0] + nrm.x * outOff, bestPt[1] + nrm.y * outOff, bestPt[2] + nrm.z * outOff);
        mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(uAxis, vUp, nrm));
      }
      // 4 upper-deck freighter supernumerary windows flush on upper-deck side wall
      for(let w = 0; w < 4; w++){
        const wz = -26.5 + w * 1.05;
        const winM = addM(closeDetails, new THREE.BoxGeometry(0.20, 0.27, 0.014), glassMat);
        orientWallDetail(winM, wz, 3.30, 0.022);
      }
      // Upper-deck L1 / R1 entry door outline flush on upper-deck wall
      const doorM = addM(closeDetails, new THREE.BoxGeometry(0.76, 1.42, 0.014), frameMat);
      orientWallDetail(doorM, -24.0, 3.05, 0.022);
      const doorSkin = addM(closeDetails, new THREE.BoxGeometry(0.68, 1.34, 0.016), whiteMat);
      orientWallDetail(doorSkin, -24.0, 3.05, 0.024);
      for(const pz of [-34.6, -33.2]){
        const [px] = hullSurfacePoint(pz, Math.PI * (side < 0 ? 1.56 : 0.44));
        addM(closeDetails, new THREE.CylinderGeometry(0.014, 0.016, 0.36, 8), chromeMat, px + side * 0.04, 0.35, pz).rotation.x = Math.PI / 2;
      }
    }
    // Dorsal SATCOM hump radome + VHF antennas
    if(typeof AeroCraft !== 'undefined'){
      addM(closeDetails, AeroCraft.buildCanoeGeometry(3.4, 0.52, 0.32), whiteMat, 0, 3.45, -2.0);
      addM(closeDetails, AeroCraft.buildAeroPylonGeometry(0.26, 0.36, 0.14, 0.10, 0.14), metalMat, 0, 4.46, -24.5);
      addM(closeDetails, AeroCraft.buildAeroPylonGeometry(0.24, 0.32, 0.12, 0.10, 0.12), metalMat, 0, 3.36, 10.5);
    }

    // 5. Swept Boeing 747-8 Wings, Raked Wingtips, Flaps, Slats, Ailerons & Flush Spoilers
    const wingRootX = 2.6, wingRootZ = -13.6, wingRootChord = 15.6;
    const wingV = f => clamp((span * f - wingRootX) / Math.max(0.5, span - wingRootX), 0, 1);
    const wingRake = v => Math.max(0, (v - 0.87) / 0.13);
    const wingChordAt = v => {
      const r = wingRake(v);
      const yehudi = v < 0.34 ? Math.sin((v / 0.34) * Math.PI * 0.5) * 2.1 : 0;
      return wingRootChord * (1 - 0.77 * v) * (1 - r * 0.82) + yehudi;
    };
    const wingLeadAt = v => wingRootZ + 23.4 * v + wingRake(v) * 2.8;
    const wingYAt = v => wingY + Math.pow(v, 1.35) * 2.35;

    const flaps = [], slats = [], surfaces = [], airBrakes = [], elevs = [], rudders = [], fans = [], reverserSleeves = [], landingLights = [];
    const navLights = [], strobes = [], beacons = [];

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
            thick: 0.138 - 0.052 * v,
            camber: 0.025 - 0.012 * v,
            twist: 0.028 - 0.062 * v,
            tipCurlY: 0.32
          });
        }
        addM(group, AeroCraft.buildWingLoft(stations, { slices: 32, capTip: true, mirror: side < 0 }), wingUpperMat).name = 'B748F Main Wing';
        // Karman wing-to-body belly fairing
        addM(group, AeroCraft.buildCanoeGeometry(22.0, 1.95, 1.25), whiteMat, side * 1.95, -1.65, -3.0);

        // 4 Sculpted Flap-Track Canoes per wing
        for(const cf of [0.22, 0.38, 0.54, 0.70]){
          const cv = wingV(cf), c = wingChordAt(cv);
          const pod = addM(closeDetails, AeroCraft.buildCanoeGeometry(Math.min(c * 0.44, 4.4), 0.16, 0.14), whiteMat,
            side * span * cf, wingYAt(cv) - c * 0.048 - 0.14, wingLeadAt(cv) + c * 0.60);
          pod.rotation.x = -0.05;
        }

        // Triple-slotted Flaps (inboard + mid)
        for(const [f0, f1] of [[0.14, 0.34], [0.37, 0.58]]){
          const v0 = wingV(f0), v1 = wingV(f1);
          const c0 = wingChordAt(v0), c1 = wingChordAt(v1);
          const fp = new THREE.Group();
          fp.position.set(side * span * f0, wingYAt(v0) - 0.04, wingLeadAt(v0) + c0 * 0.84);
          fp.add(new THREE.Mesh(AeroCraft.buildWingLoft([
            { x: 0, leadZ: 0, chord: c0 * 0.21, y: 0, thick: 0.10, camber: 0.03 },
            { x: span * (f1 - f0), leadZ: wingLeadAt(v1) + c1 * 0.84 - fp.position.z, chord: c1 * 0.21, y: wingYAt(v1) - wingYAt(v0), thick: 0.09, camber: 0.03 }
          ], { slices: 12, capTip: false, mirror: side < 0 }), metalMat));
          group.add(fp);
          flaps.push(fp);
        }

        // Variable-camber LE Slats
        for(const [s0, s1] of [[0.18, 0.44], [0.48, 0.78]]){
          const v0 = wingV(s0), v1 = wingV(s1);
          const c0 = wingChordAt(v0), c1 = wingChordAt(v1);
          const baseY = wingYAt(v0) - 0.02;
          const baseZ = wingLeadAt(v0) - 0.10;
          const sl = new THREE.Group();
          sl.position.set(side * span * s0, baseY, baseZ);
          sl.userData = { baseY, baseZ };
          sl.add(new THREE.Mesh(AeroCraft.buildWingLoft([
            { x: 0, leadZ: 0, chord: c0 * 0.11, y: 0, thick: 0.11, camber: 0.02 },
            { x: span * (s1 - s0), leadZ: wingLeadAt(v1) - wingLeadAt(v0), chord: c1 * 0.11, y: wingYAt(v1) - wingYAt(v0), thick: 0.10, camber: 0.02 }
          ], { slices: 10, capTip: false, mirror: side < 0 }), metalMat));
          group.add(sl);
          slats.push(sl);
        }

        // Differential Outboard + High-Speed Ailerons
        const a0 = wingV(0.60), a1 = wingV(0.84);
        const ac0 = wingChordAt(a0), ac1 = wingChordAt(a1);
        const ail = new THREE.Group();
        ail.position.set(side * span * 0.60, wingYAt(a0), wingLeadAt(a0) + ac0 * 0.84);
        ail.add(new THREE.Mesh(AeroCraft.buildWingLoft([
          { x: 0, leadZ: 0, chord: ac0 * 0.18, y: 0, thick: 0.09, camber: 0.01 },
          { x: span * 0.24, leadZ: wingLeadAt(a1) + ac1 * 0.84 - ail.position.z, chord: ac1 * 0.18, y: wingYAt(a1) - wingYAt(a0), thick: 0.08, camber: 0.01 }
        ], { slices: 12, capTip: false, mirror: side < 0 }), wingUpperMat));
        group.add(ail);
        surfaces.push(ail);

        // 6 Flush Aluminum Upper-Wing Spoilers per side (aligned flush to local wing surface tangent)
        for(let sp = 0; sp < 6; sp++){
          const sf0 = 0.22 + sp * 0.075, sf1 = sf0 + 0.068;
          const sv = wingV((sf0 + sf1) * 0.5), sv1 = wingV(sf1), sv0 = wingV(sf0);
          const sc = wingChordAt(sv);
          const panel = new THREE.Group();
          const px = side * span * ((sf0 + sf1) * 0.5);
          const py = wingYAt(sv) + sc * 0.064 + 0.008;
          const pz = wingLeadAt(sv) + sc * 0.56;
          panel.position.set(px, py, pz);
          panel.rotation.z = side * Math.atan2(wingYAt(sv1) - wingYAt(sv0), span * 0.068);
          addM(panel, new THREE.BoxGeometry(span * 0.062, 0.025, sc * 0.15), wingUpperMat, 0, 0, sc * 0.075);
          group.add(panel);
          airBrakes.push(panel);
        }

        // Hinged Swept Horizontal Stabilizers + Elevators
        const hRootZ = 24.8, hTipZ = 34.4, hSpan = 11.4, hY = 1.42;
        addM(group, AeroCraft.buildWingLoft([
          { x: 1.05, leadZ: hRootZ, chord: 7.4, y: hY, thick: 0.09, camber: 0, twist: -0.01 },
          { x: hSpan, leadZ: hTipZ, chord: 2.5, y: hY + 0.88, thick: 0.075, camber: 0, twist: -0.02 }
        ], { slices: 20, capTip: true, mirror: side < 0 }), wingUpperMat).name = 'B748F Horizontal Stabilizer';
        const elev = new THREE.Group();
        elev.position.set(side * 1.4, hY + 0.08, hRootZ + 5.7);
        elev.add(new THREE.Mesh(AeroCraft.buildWingLoft([
          { x: 0, leadZ: 0, chord: 1.65, y: 0, thick: 0.08, camber: 0 },
          { x: hSpan - 1.6, leadZ: (hTipZ + 1.85) - (hRootZ + 5.7), chord: 0.65, y: 0.82, thick: 0.07, camber: 0 }
        ], { slices: 12, capTip: false, mirror: side < 0 }), wingUpperMat));
        group.add(elev);
        elevs.push(elev);
      }

      // Wingtip Nav/Strobe & Inboard Root Landing Lamps
      const tipY = wingYAt(1.0) + 0.30, tipZ = wingLeadAt(1.0) + wingChordAt(1.0) * 0.28;
      navLights.push(addM(group, new THREE.SphereGeometry(0.11, 10, 8),
        new THREE.MeshBasicMaterial({ color: side === -1 ? 0xed4f49 : 0x65ffd4 }), side * span, tipY, tipZ));
      strobes.push(addM(group, new THREE.SphereGeometry(0.12, 10, 8),
        new THREE.MeshBasicMaterial({ color: 0xffffff }), side * span, tipY, tipZ + 0.16));
      landingLights.push(addM(group, new THREE.SphereGeometry(0.14, 10, 8),
        new THREE.MeshBasicMaterial({ color: 0xfff8d6 }), side * 3.45, wingY - 0.12, wingRootZ + 0.25));

      // 6. 4x GEnx-2B67 High-Bypass Turbofan Nacelles w/ Sawtooth Chevrons & Translating Reversers
      const engineSpecs = [
        { x: side * 11.6, v: wingV(0.34), yOff: -2.28, z: -8.6 },
        { x: side * 21.4, v: wingV(0.625), yOff: -1.32, z: 1.2 }
      ];
      for(const eng of engineSpecs){
        const rNac = 1.53; // True 747-8 GEnx-2B67 diameter ~3.05 m radius 1.53 m
        const nacG = new THREE.Group();
        nacG.position.set(eng.x, eng.yOff, eng.z);
        nacG.name = 'B748F GEnx-2B67 Nacelle';

        // Chrome de-ice inlet lip + dark acoustic barrel
        const lipGeo = new THREE.TorusGeometry(rNac * 0.90, rNac * 0.11, 16, 36);
        addM(nacG, lipGeo, chromeMat, 0, 0, -2.52);
        // Sculpted outer fan cowl + aerodynamic profile
        const cowlProf = [
          new THREE.Vector2(rNac * 0.83, -2.58),
          new THREE.Vector2(rNac * 0.99, -2.18),
          new THREE.Vector2(rNac * 1.02, -0.55),
          new THREE.Vector2(rNac * 0.96, 1.35),
          new THREE.Vector2(rNac * 0.84, 1.95)
        ];
        const cowlGeo = new THREE.LatheGeometry(cowlProf, 36);
        cowlGeo.rotateX(Math.PI / 2);
        addM(nacG, cowlGeo, whiteMat);
        // Inner dark acoustic barrel
        addM(nacG, new THREE.CylinderGeometry(rNac * 0.82, rNac * 0.80, 2.2, 28, 1, true), darkMat, 0, 0, -1.45).rotation.x = Math.PI / 2;

        // Translating Reverse Thrust Sleeve + 16 Signature GEnx-2B67 Sawtooth Chevrons!
        const revG = new THREE.Group();
        const revGeo = new THREE.CylinderGeometry(rNac * 0.95, rNac * 0.89, 1.15, 32, 1, true);
        revGeo.rotateX(Math.PI / 2);
        addM(revG, revGeo, whiteMat, 0, 0, 1.38);
        // Cascade dark ring exposed when sleeve slides aft
        const casGeo = new THREE.CylinderGeometry(rNac * 0.84, rNac * 0.84, 0.95, 24, 1, true);
        casGeo.rotateX(Math.PI / 2);
        addM(nacG, casGeo, titaniumMat, 0, 0, 1.32);
        const toothGeo = new THREE.ConeGeometry(rNac * 0.17, 0.44, 4);
        for(let c = 0; c < 16; c++){
          const ca = (c / 16) * Math.PI * 2;
          const tooth = new THREE.Mesh(toothGeo, whiteMat);
          tooth.position.set(Math.sin(ca) * rNac * 0.88, Math.cos(ca) * rNac * 0.88, 2.02);
          tooth.rotation.x = Math.PI / 2;
          tooth.rotation.z = ca;
          revG.add(tooth);
        }
        nacG.add(revG);
        reverserSleeves.push(revG);

        // Titanium exhaust core cone + secondary core chevrons
        const coreGeo = new THREE.CylinderGeometry(rNac * 0.56, rNac * 0.42, 1.85, 24);
        coreGeo.rotateX(Math.PI / 2);
        addM(nacG, coreGeo, titaniumMat, 0, 0, 2.35);
        addM(nacG, new THREE.ConeGeometry(rNac * 0.36, 1.15, 18), titaniumMat, 0, 0, 3.25).rotation.x = Math.PI / 2;

        // Spinning 18-blade GEnx fan + spinner spiral
        const fanG = new THREE.Group();
        fanG.position.z = -1.65;
        addM(fanG, new THREE.ConeGeometry(rNac * 0.25, 0.72, 18), darkMat, 0, 0, -0.22).rotation.x = -Math.PI / 2;
        addM(fanG, new THREE.TorusGeometry(rNac * 0.14, 0.018, 6, 16), whiteMat, 0, 0, -0.28);
        const bladeGeo = new THREE.BoxGeometry(0.11, rNac * 0.76, 0.032);
        for(let b = 0; b < 18; b++){
          const bg = new THREE.Group();
          bg.rotation.z = (b / 18) * Math.PI * 2;
          const bm = new THREE.Mesh(bladeGeo, titaniumMat);
          bm.position.y = rNac * 0.44;
          bm.rotation.y = 0.42;
          bg.add(bm);
          fanG.add(bg);
        }
        nacG.add(fanG);
        fans.push(fanG);

        // Swept underwing strut pylon extending upward cleanly to wing lower skin
        const wingLocalY = wingYAt(eng.v) - 0.12 - eng.yOff;
        if(typeof AeroCraft !== 'undefined'){
          const pyLen = Math.max(0.45, wingLocalY - rNac * 0.78 + 0.35);
          addM(nacG, AeroCraft.buildAeroPylonGeometry(0.42, pyLen, 3.2, 0.48, 0.24), whiteMat, 0, rNac * 0.76 + pyLen * 0.46, 0.85);
        }else{
          addM(nacG, new THREE.BoxGeometry(0.42, wingLocalY, 3.2), whiteMat, 0, rNac * 0.76 + wingLocalY * 0.3, 0.85);
        }

        group.add(nacG);
      }
    }

    // 7. Towering 19.35 m Boeing 747-8 Vertical Stabilizer & Split Rudders
    const tailHeight = profile.finHeight ?? 14.75;
    if(typeof AeroCraft !== 'undefined'){
      const finGeo = AeroCraft.buildVerticalFoilLoft([
        { y: 1.5, leadZ: 18.8, chord: 14.8, thick: 0.088 },
        { y: 6.2, leadZ: 24.4, chord: 9.2, thick: 0.086 },
        { y: tailHeight, leadZ: 31.2, chord: 4.1, thick: 0.075 }
      ], { slices: 24, capTip: true });
      addM(group, finGeo, accentMat).name = 'B748F Vertical Tail';
      const rudder = new THREE.Group();
      rudder.position.set(0, 2.2, 33.4);
      rudder.add(new THREE.Mesh(AeroCraft.buildVerticalFoilLoft([
        { y: 0, leadZ: -0.6, chord: 2.35, thick: 0.08 },
        { y: tailHeight - 2.6, leadZ: 1.8, chord: 1.25, thick: 0.07 }
      ], { slices: 12, capTip: true }), accentMat));
      group.add(rudder);
      rudders.push(rudder);
    }

    // Anti-collision top/bottom beacons & tail logo light
    beacons.push(
      addM(group, new THREE.SphereGeometry(0.17, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff2222 }), 0, 4.52, -22.5),
      addM(group, new THREE.SphereGeometry(0.17, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff2222 }), 0, -3.40, 2.0)
    );
    navLights.push(addM(group, new THREE.SphereGeometry(0.13, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xffffff }), 0, 2.8, half - 0.1));

    // 8. Authentic 5-Strut 18-Wheel Boeing 747-8 Landing Gear (strictly grounded at -4.60 m!)
    //   - Nose Gear: 2 steerable 0.56 m tires (-28.6 m)
    //   - Wing Gear L/R: 4 tires per bogie (±5.45 m, z=+1.6 m)
    //   - Body Gear L/R: 4 tires per bogie (±1.95 m, z=+6.4 m)
    const wheels = [];
    const noseTireR = 0.56, noseTireW = 0.30;
    const mainTireR = 0.63, mainTireW = 0.35;

    function createTireGeo(r, w){
      const pts = [
        [0.48, -0.50], [0.80, -0.50], [0.93, -0.42], [0.99, -0.26], [1, -0.14],
        [1, 0.14], [0.99, 0.26], [0.93, 0.42], [0.80, 0.50], [0.48, 0.50]
      ].map(([rr, yy]) => new THREE.Vector2(rr * r, yy * w));
      return new THREE.LatheGeometry(pts, 28);
    }
    const noseTireGeo = createTireGeo(noseTireR, noseTireW);
    const mainTireGeo = createTireGeo(mainTireR, mainTireW);

    function addTireAssembly(parent, x, y, z, r, geo){
      const wG = new THREE.Group();
      wG.position.set(x, y, z);
      wG.rotation.z = Math.PI / 2;
      wG.userData = { radius: r };
      addM(wG, geo, rubberMat);
      addM(wG, new THREE.CylinderGeometry(r * 0.49, r * 0.49, r * 0.56, 16), chromeMat);
      parent.add(wG);
      wheels.push(wG);
      return wG;
    }

    // Nose Strut Pivot at fuselage underside (0, -2.55, -28.6) -> -gearH + noseTireR = -4.04 m axle!
    const nosePivotY = -2.55, nosePivotZ = -28.6;
    const noseGearPivot = new THREE.Group();
    noseGearPivot.position.set(0, nosePivotY, nosePivotZ);
    const noseStrutLen = Math.abs(-gearH + noseTireR - nosePivotY); // 1.49 m
    addM(noseGearPivot, new THREE.CylinderGeometry(0.15, 0.14, noseStrutLen * 0.72, 12), metalMat, 0, -noseStrutLen * 0.36, 0);
    const noseOleo = new THREE.Group();
    noseOleo.position.set(0, -noseStrutLen, 0);
    addM(noseOleo, new THREE.CylinderGeometry(0.11, 0.11, 0.65, 10), chromeMat, 0, 0.30, 0);
    const noseSteerPivot = new THREE.Group();
    addM(noseSteerPivot, new THREE.CylinderGeometry(0.08, 0.08, 0.72, 10), metalMat, 0, 0, 0).rotation.z = Math.PI / 2;
    addM(noseSteerPivot, new THREE.SphereGeometry(0.11, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff8dc }), 0, 0.48, -0.14);
    for(const ws of [-1, 1]) addTireAssembly(noseSteerPivot, ws * 0.34, 0, 0, noseTireR, noseTireGeo);
    noseOleo.add(noseSteerPivot);
    noseGearPivot.add(noseOleo);
    gear.add(noseGearPivot);

    // 4-Wheel Main Gear Helper (Wing & Body Bogies)
    const wingGears = [], bodyGears = [];
    const mainAxleY = -gearH + mainTireR; // -3.97 m
    function build4WheelBogie(xPos, yPivot, zPos, retractMode, sideSign){
      const piv = new THREE.Group();
      piv.position.set(xPos, yPivot, zPos);
      const len = Math.abs(mainAxleY - yPivot);
      addM(piv, new THREE.CylinderGeometry(0.22, 0.20, len * 0.68, 14), metalMat, 0, -len * 0.34, 0);
      const brace = addM(piv, new THREE.CylinderGeometry(0.08, 0.09, len * 0.62, 10), titaniumMat, -sideSign * 0.48, -len * 0.32, 0.2);
      brace.rotation.z = sideSign * 0.42;

      const oleo = new THREE.Group();
      oleo.position.set(0, -len, 0);
      addM(oleo, new THREE.CylinderGeometry(0.16, 0.16, 0.85, 12), chromeMat, 0, 0.38, 0);

      const bogie = new THREE.Group();
      addM(bogie, new THREE.BoxGeometry(0.32, 0.24, 1.95), titaniumMat, 0, 0, 0);
      for(const az of [-0.76, 0.76]){
        addM(bogie, new THREE.CylinderGeometry(0.11, 0.11, 1.02, 10), metalMat, 0, 0, az).rotation.z = Math.PI / 2;
        for(const xs of [-0.46, 0.46]) addTireAssembly(bogie, xs, 0, az, mainTireR, mainTireGeo);
      }
      oleo.add(bogie);
      piv.add(oleo);
      gear.add(piv);
      return { pivot: piv, oleo, bogie, side: sideSign, len, mode: retractMode };
    }

    for(const side of [-1, 1]){
      wingGears.push(build4WheelBogie(side * 5.45, -1.60, 1.6, 'inward', side));
      bodyGears.push(build4WheelBogie(side * 1.95, -2.55, 6.4, 'forward', side));
    }

    // 9. Illuminated Main-Deck Freighter Cargo Hold (PDU Rollers, Tiedown Rails, ULD Pallets)
    const cargoFloorY = -0.82;
    const cStart = -29.0, cEnd = 24.5, cLen = cEnd - cStart, cMid = (cStart + cEnd) / 2;
    addM(cabin, new THREE.BoxGeometry(5.35, 0.12, cLen), new THREE.MeshStandardMaterial({ color: 0x2c3842, roughness: 0.88 }), 0, cargoFloorY - 0.06, cMid);
    // Freighter main deck vault ceiling & ribbed liner walls
    const linerMat = new THREE.MeshStandardMaterial({ color: 0xc2ccd4, roughness: 0.84, side: THREE.DoubleSide });
    addM(cabin, new THREE.BoxGeometry(4.8, 0.12, cLen), linerMat, 0, 1.88, cMid);
    for(const side of [-1, 1]){
      addM(cabin, new THREE.BoxGeometry(0.12, 2.75, cLen), linerMat, side * 2.78, 0.52, cMid);
      addM(cabin, new THREE.BoxGeometry(0.18, 0.08, cLen), goldMat, side * 2.50, cargoFloorY + 0.05, cMid);
      // Overhead LED bay strips along main cargo ceiling
      for(let lz = cStart + 3; lz < cEnd - 2; lz += 6.2){
        addM(cabin, new THREE.BoxGeometry(0.18, 0.04, 2.2), new THREE.MeshBasicMaterial({ color: 0xd9f2ff }), side * 1.35, 1.78, lz);
      }
    }

    // Powered PDU Roller Ball-Mat Tracks along full 53.5 m main cargo floor (InstancedMesh)
    const trackXs = [-1.42, -0.72, 0.72, 1.42];
    const rollerCountPerTrack = Math.floor((cLen - 2) / 0.56);
    const rollerGeo = new THREE.CylinderGeometry(0.036, 0.036, 0.22, 8);
    rollerGeo.rotateZ(Math.PI / 2);
    const rollerMesh = new THREE.InstancedMesh(rollerGeo, chromeMat, trackXs.length * rollerCountPerTrack);
    const mtx = new THREE.Matrix4();
    let rIdx = 0;
    for(const tx of trackXs){
      addM(cabin, new THREE.BoxGeometry(0.26, 0.035, cLen - 1.2), darkMat, tx, cargoFloorY + 0.015, cMid);
      for(let i = 0; i < rollerCountPerTrack; i++){
        mtx.makeTranslation(tx, cargoFloorY + 0.045, cStart + 1.0 + i * 0.56);
        rollerMesh.setMatrixAt(rIdx++, mtx);
      }
    }
    rollerMesh.name = 'B748F Main Deck PDU Rollers';
    cabin.add(rollerMesh);

    // 3 Contoured Aluminum ULD Main-Deck Pallets w/ Cargo Net Restraint Straps synced directly to flight.js & cargoBalance
    const palletMeshes = [];
    const uldMat = new THREE.MeshStandardMaterial({ color: 0xb6c5d0, roughness: 0.36, metalness: 0.68 });
    const uldBaseMat = new THREE.MeshStandardMaterial({ color: 0x627380, roughness: 0.45, metalness: 0.72 });
    const strapMat = new THREE.MeshStandardMaterial({ color: 0xd98026, roughness: 0.65 });
    const stations = typeof palletStations !== 'undefined' ? palletStations : [{ arm: -11 }, { arm: 0 }, { arm: 13 }];
    for(const slot of stations){
      const uldG = new THREE.Group();
      uldG.position.set(0, cargoFloorY + 0.04, slot.arm);
      uldG.name = 'B748F ULD Container';
      addM(uldG, new THREE.BoxGeometry(3.45, 0.08, 3.88), uldBaseMat, 0, 0.04, 0);
      addM(uldG, new THREE.BoxGeometry(3.32, 1.32, 3.74), uldMat, 0, 0.74, 0);
      for(const rz of [-1.25, 0, 1.25]){
        addM(uldG, new THREE.BoxGeometry(3.36, 1.34, 0.07), strapMat, 0, 0.74, rz);
      }
      cabin.add(uldG);
      palletMeshes.push(uldG);
    }

    let smoothGear = 1, smoothOleo = 0, smoothSteer = 0, smoothFlaps = 0, smoothSlats = 0, smoothSpoilers = 0, smoothRev = 0;
    const engineSpinRates = [0, 0, 0, 0];

    function updateGear(gProg, dt, f, paused){
      const dTime = clamp(dt || 0.016, 0.001, 0.12);
      const rawTarget = clamp(gProg ?? (f ? (f.gear ? 1 : 0) : 1), 0, 1);
      smoothGear = paused ? rawTarget : smoothGear + (rawTarget - smoothGear) * Math.min(1, dTime * 5.2);
      const p = smoothGear;
      const ext = clamp((p - 0.14) / 0.72, 0, 1);

      noseGearPivot.rotation.x = -(1 - ext) * 1.46;
      for(const wg of wingGears){
        wg.pivot.rotation.z = -wg.side * (1 - ext) * 1.44;
        const tilt = f && !f.ground ? 0.20 : (1 - ext) * 0.20;
        wg.bogie.rotation.x += (tilt - wg.bogie.rotation.x) * Math.min(1, dTime * 6);
      }
      for(const bg of bodyGears){
        bg.pivot.rotation.x = (1 - ext) * 1.38;
        const tilt = f && !f.ground ? -0.22 : (1 - ext) * -0.22;
        bg.bogie.rotation.x += (tilt - bg.bogie.rotation.x) * Math.min(1, dTime * 6);
      }
      const tgtOleo = f && f.ground ? clamp(Math.max(0, -(f.vy || 0)) * 0.036, 0, 0.14) : 0;
      smoothOleo += (tgtOleo - smoothOleo) * Math.min(1, dTime * 10);
      gear.position.y = 0;
      noseOleo.position.y = -noseStrutLen + smoothOleo * 0.45;
      for(const g of [...wingGears, ...bodyGears]) g.oleo.position.y = -g.len + smoothOleo;

      const steer = f && f.ground ? -clamp((f.manualControls?.rudder ?? 0) * 0.42 + (f.manualControls?.roll ?? 0) * 0.24, -0.44, 0.44) : 0;
      smoothSteer += (steer - smoothSteer) * Math.min(1, dTime * 8);
      noseSteerPivot.rotation.y = smoothSteer;
      // 747-8 authentic subtle opposite body-gear steering when taxiing tightly
      for(const bg of bodyGears) bg.pivot.rotation.y = -smoothSteer * 0.18;
      gear.visible = p > 0.05;
    }

    function updateAeroSurfaces(f, dt, now, paused){
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
      for(const rv of reverserSleeves) rv.position.z = smoothRev * 0.62;

      const roll = f && !f.tow ? (f.manualControls?.roll ?? 0) : 0;
      const pitch = f && !f.tow ? (f.manualControls?.pitch ?? 0) : 0;
      const rudder = f && !f.tow ? (f.manualControls?.rudder ?? 0) : 0;
      if(surfaces[0]) surfaces[0].rotation.x = smoothFlaps * 0.12 + roll * 0.28;
      if(surfaces[1]) surfaces[1].rotation.x = smoothFlaps * 0.12 - roll * 0.28;
      for(const ev of elevs) ev.rotation.x = -pitch * 0.32;
      for(const rd of rudders) rd.rotation.y = rudder * 0.35;

      for(let i = 0; i < fans.length; i++){
        const running = f ? Boolean(f.engines?.[i] && f.fuel !== 0) : false;
        const revBoost = f?.reverse ? 0.62 : 0;
        const targetRate = running ? (10.5 + Math.max(f?.power || 0, revBoost) * 92) : 0;
        engineSpinRates[i] += (targetRate - engineSpinRates[i]) * Math.min(1, dTime * (running ? 2.2 : 0.72));
        if(!paused) fans[i].rotation.z += engineSpinRates[i] * dTime;
      }
      const lightsOn = f ? Boolean(f.battery && f.lights) : true;
      for(const ll of landingLights) ll.visible = lightsOn;
    }

    cabin.visible = false;
    scene.add(group, cabin);
    group.userData = {
      b748fHighDef: true,
      profileId: profile.id,
      modelStatus: profile.modelStatus,
      gear,
      articulatedGear: true,
      blades: [],
      fans,
      surfaces,
      flaps,
      slats,
      airBrakes,
      reverserSleeves,
      elevs,
      rudders,
      navLights,
      strobes,
      beacons,
      noseDoor,
      sideDoor,
      cargoRamp: null,
      wheels,
      cabin,
      palletMeshes,
      passengerCabin: null,
      closeDetails,
      cockpitGlassMats: [glassMat],
      cockpitEye: { x: -0.46, y: 2.74, z: -29.55 },
      cockpitPanelEye: { x: -0.32, y: 2.74, z: -29.62 },
      cockpitLookOffset: { x: 0, y: -0.14, z: -2.5 },
      half,
      radius,
      updateGear,
      updateAeroSurfaces,
      setLivery: owned => {
        if(owned) accentMat.color.setHex(0x12786a);
        else accentMat.color.setHex(stockColor);
      }
    };
    return group;
  }

  // Dedicated Boeing 747-8F Upper-Deck 4-Engine Glass Flight Deck
  function refineB748FFlightDeck(model, profile){
    const data = model.userData;
    const cabin = data.cabin;
    const switches = [];

    // Hide generic cargo nose box panels on main deck
    for(const ch of cabin.children){
      if(ch.type === 'Group' && ch.position.z < -15) ch.visible = false;
    }

    // Authentic Upper Deck Command Floor at y=+2.10, pilot seated around z=-29.6
    const deckY = 2.48, deckZ = -29.9;
    const deckFloorMat = new THREE.MeshStandardMaterial({ color: 0x2a353e, roughness: 0.78 });
    const slateMat = new THREE.MeshStandardMaterial({ color: 0x1e2830, roughness: 0.62 });
    const darkConsoleMat = new THREE.MeshStandardMaterial({ color: 0x131b21, roughness: 0.56 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x8ea0ab, roughness: 0.28, metalness: 0.68 });
    const gripMat = new THREE.MeshStandardMaterial({ color: 0x36414a, roughness: 0.74 });
    const glassBezelMat = new THREE.MeshStandardMaterial({ color: 0x2c3842, roughness: 0.42 });

    function b(parent, mat, w, h, d, x, y, z){
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      parent.add(m);
      return m;
    }

    // Upper-deck cockpit floor pan, aft bulkhead behind cockpit seats & sloped glare housing
    b(cabin, deckFloorMat, 3.10, 0.10, 2.75, 0, deckY - 0.62, deckZ - 0.15);
    b(cabin, slateMat, 3.00, 1.55, 0.10, 0, deckY + 0.15, deckZ + 1.25);
    b(cabin, slateMat, 2.86, 0.72, 0.40, 0, deckY - 0.08, deckZ - 1.48);
    // Sidewall window sills & armrests
    for(const s of [-1, 1]){
      b(cabin, slateMat, 0.14, 0.55, 2.35, s * 1.46, deckY - 0.22, deckZ - 0.25);
      b(cabin, slateMat, 0.60, 0.72, 0.14, s * 0.54, deckY - 0.05, deckZ + 0.76).rotation.x = -0.10;
      b(cabin, slateMat, 0.60, 0.12, 0.62, s * 0.54, deckY - 0.46, deckZ + 0.52);
    }

    // Sleek wraparound glareshield, solid A-pillars, corner coaming & upper windshield header frame (no floating bars!)
    const glare = b(cabin, darkConsoleMat, 2.86, 0.08, 0.48, 0, deckY + 0.24, deckZ - 1.26);
    glare.rotation.x = 0.05;
    b(cabin, darkConsoleMat, 2.84, 0.08, 0.36, 0, deckY + 1.00, deckZ - 0.96);
    const ctrMullion = b(cabin, darkConsoleMat, 0.045, 0.86, 0.07, 0, deckY + 0.62, deckZ - 1.15);
    ctrMullion.rotation.x = -0.38;
    for(const s of [-1, 1]){
      const post = b(cabin, darkConsoleMat, 0.06, 0.88, 0.08, s * 1.38, deckY + 0.60, deckZ - 1.08);
      post.rotation.set(-0.38, 0, s * 0.06);
      // Horizontal side window sill & A-pillar gusset linking glare corners smoothly into sidewall sill
      b(cabin, slateMat, 0.14, 0.16, 1.35, s * 1.42, deckY + 0.16, deckZ - 0.64);
      const aftPost = b(cabin, darkConsoleMat, 0.07, 0.96, 0.08, s * 1.44, deckY + 0.60, deckZ - 0.36);
      aftPost.rotation.set(-0.12, 0, s * 0.04);
      b(cabin, darkConsoleMat, 0.10, 0.06, 0.78, s * 1.40, deckY + 1.00, deckZ - 0.66);
    }

    // Overhead 4-engine Fuel/Elec/Cargo Door Overhead Panel raised clearly above camera FOV
    const ovh = b(cabin, slateMat, 1.56, 0.07, 0.74, 0, deckY + 1.08, deckZ - 0.38);
    ovh.rotation.x = 0.36;

    // Night warm amber glareshield flood light
    const floodMat = new THREE.MeshBasicMaterial({ color: 0xffaa44, transparent: true, opacity: 0 });
    const glareFlood = b(cabin, floodMat, 2.38, 0.02, 0.03, 0, deckY + 0.20, deckZ - 1.06);
    const floodLight = typeof THREE.PointLight === 'function' ? new THREE.PointLight(0xffb468, 0, 4.2, 2) : null;
    if(floodLight){
      floodLight.position.set(0, deckY + 0.18, deckZ - 0.92);
      cabin.add(floodLight);
    }

    // 6-LCD 747-8 Flight Deck MIP (2048x576 MeshBasicMaterial canvas)
    const mipCanvas = document.createElement('canvas');
    mipCanvas.width = 2048; mipCanvas.height = 576;
    const mctx = mipCanvas.getContext('2d');
    const mipTex = new THREE.CanvasTexture(mipCanvas);
    mipTex.colorSpace = THREE.SRGBColorSpace;
    const mipMesh = new THREE.Mesh(new THREE.PlaneGeometry(2.58, 0.62), new THREE.MeshBasicMaterial({ map: mipTex }));
    mipMesh.position.set(0, deckY - 0.06, deckZ - 1.26);
    mipMesh.rotation.x = -0.10;
    cabin.add(mipMesh);

    // MCP Amber Mode Control Panel Strip
    const mcpCanvas = document.createElement('canvas');
    mcpCanvas.width = 1024; mcpCanvas.height = 128;
    const mcpCtx = mcpCanvas.getContext('2d');
    const mcpTex = new THREE.CanvasTexture(mcpCanvas);
    mcpTex.colorSpace = THREE.SRGBColorSpace;
    const mcpMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.75, 0.11), new THREE.MeshBasicMaterial({ map: mcpTex }));
    mcpMesh.position.set(0, deckY + 0.21, deckZ - 1.06);
    mcpMesh.rotation.x = -0.32;
    cabin.add(mcpMesh);

    // Center Pedestal + FMC CDU + Quad 4-Engine Thrust Quadrant
    b(cabin, slateMat, 0.56, 0.36, 1.32, 0, deckY - 0.44, deckZ - 0.48);
    const cduCanvas = document.createElement('canvas');
    cduCanvas.width = 512; cduCanvas.height = 384;
    const cduCtx = cduCanvas.getContext('2d');
    const cduTex = new THREE.CanvasTexture(cduCanvas);
    cduTex.colorSpace = THREE.SRGBColorSpace;
    const cduMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.40, 0.28), new THREE.MeshBasicMaterial({ map: cduTex }));
    cduMesh.position.set(0, deckY - 0.255, deckZ - 0.85);
    cduMesh.rotation.x = -1.25;
    cabin.add(cduMesh);

    // Quad Thrust Levers (4x GEnx-2B67!) + Speedbrake + Flap + Gear Lever
    const throttleLevers = [];
    for(let i = 0; i < 4; i++){
      const tp = new THREE.Group();
      tp.position.set(-0.075 + i * 0.05, deckY - 0.26, deckZ - 0.45);
      b(tp, metalMat, 0.018, 0.17, 0.024, 0, 0.085, 0);
      b(tp, gripMat, 0.036, 0.042, 0.048, 0, 0.175, -0.01);
      cabin.add(tp);
      throttleLevers.push(tp);
    }
    const flapLever = new THREE.Group();
    flapLever.position.set(0.18, deckY - 0.26, deckZ - 0.42);
    b(flapLever, metalMat, 0.018, 0.14, 0.018, 0, 0.07, 0);
    b(flapLever, new THREE.MeshStandardMaterial({ color: 0xf0f4f8 }), 0.048, 0.022, 0.042, 0, 0.14, 0);
    cabin.add(flapLever);

    const speedbrakeLever = new THREE.Group();
    speedbrakeLever.position.set(-0.18, deckY - 0.26, deckZ - 0.42);
    b(speedbrakeLever, metalMat, 0.018, 0.14, 0.018, 0, 0.07, 0);
    cabin.add(speedbrakeLever);

    const gearLever = new THREE.Group();
    gearLever.position.set(0.36, deckY + 0.05, deckZ - 1.22);
    b(gearLever, metalMat, 0.02, 0.13, 0.02, 0, -0.05, 0.03);
    const gKnob = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.026, 14),
      new THREE.MeshStandardMaterial({ color: 0xecf3f8 }));
    gKnob.position.set(0, -0.11, 0.04);
    gKnob.rotation.z = Math.PI / 2;
    gearLever.add(gKnob);
    cabin.add(gearLever);

    // Dual Boeing Yokes
    const yokes = [];
    for(const s of [-1, 1]){
      const yp = new THREE.Group();
      yp.position.set(s * 0.52, deckY - 0.46, deckZ - 0.62);
      b(yp, glassBezelMat, 0.055, 0.38, 0.06, 0, 0.19, 0).rotation.x = -0.14;
      const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.145, 0.022, 10, 28, Math.PI * 1.24), glassBezelMat);
      wheel.position.set(0, 0.37, -0.02);
      wheel.rotation.z = Math.PI * 0.88;
      yp.add(wheel);
      cabin.add(yp);
      yokes.push({ pivot: yp, wheel });
    }

    // Clickable Switch Hitboxes (matching flight.js raycaster labels!)
    const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
    const swSpecs = [
      ['電瓶', -0.45, deckY + 1.05, deckZ - 0.38],
      ['引擎 1', -0.25, deckY + 1.05, deckZ - 0.38],
      ['引擎 2', -0.08, deckY + 1.05, deckZ - 0.38],
      ['引擎 3', 0.08, deckY + 1.05, deckZ - 0.38],
      ['引擎 4', 0.25, deckY + 1.05, deckZ - 0.38],
      ['燈光', 0.45, deckY + 1.05, deckZ - 0.38],
      ['起落架', 0.36, deckY + 0.02, deckZ - 1.20],
      ['襟翼', 0.18, deckY - 0.18, deckZ - 0.42],
      ['擾流板', -0.18, deckY - 0.18, deckZ - 0.42],
      ['機鼻貨門', -0.52, deckY + 0.14, deckZ - 1.05],
      ['航向／高度保持', 0.52, deckY + 0.21, deckZ - 1.06]
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
      if(floodLight) floodLight.intensity = isNight ? backlight * 2.1 : 0;

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

      mctx.fillStyle = '#0d1317';
      mctx.fillRect(0, 0, 2048, 576);
      const panes = [22, 358, 694, 1030, 1366, 1702];
      const pw = 322, ph = 510;
      for(let i = 0; i < 6; i++){
        const px = panes[i], py = 32;
        const paneOn = (i === 2) ? batOn : fullAvionics;
        mctx.fillStyle = paneOn ? '#061118' : '#020507';
        mctx.fillRect(px, py, pw, ph);
        mctx.strokeStyle = '#364b56'; mctx.lineWidth = 3;
        mctx.strokeRect(px, py, pw, ph);
        if(!paneOn) continue;

        mctx.save();
        mctx.globalAlpha = dim;
        if(i === 0 || i === 5){
          // PFD
          mctx.fillStyle = '#12222d'; mctx.fillRect(px + 10, py + 8, pw - 20, 32);
          mctx.fillStyle = '#57f29c'; mctx.font = 'bold 17px monospace'; mctx.textAlign = 'left';
          mctx.fillText((f?.engines?.some(Boolean) ? 'TO/GA' : 'IDLE') + ' | ' + (f?.hold?.nav ? 'LNAV' : f?.hold ? 'HDG' : 'FD'), px + 16, py + 30);
          mctx.save();
          mctx.beginPath(); mctx.rect(px + 68, py + 76, 186, 260); mctx.clip();
          mctx.translate(px + 161, py + 206);
          mctx.rotate(-bank);
          mctx.translate(0, pitch * 260);
          mctx.fillStyle = '#1d72ab'; mctx.fillRect(-240, -340, 480, 340);
          mctx.fillStyle = '#73532d'; mctx.fillRect(-240, 0, 480, 340);
          mctx.strokeStyle = '#ffffff'; mctx.lineWidth = 2.5;
          mctx.beginPath(); mctx.moveTo(-220, 0); mctx.lineTo(220, 0); mctx.stroke();
          mctx.restore();
          mctx.fillStyle = '#e8f7ff'; mctx.font = 'bold 20px monospace';
          mctx.fillText(String(iasKt), px + 14, py + 212);
          mctx.fillText(String(altFt), px + pw - 68, py + 212);
          mctx.fillStyle = '#6fe6ff'; mctx.font = '15px monospace';
          mctx.fillText('M ' + (speeds.mach || 0).toFixed(2) + '  HDG ' + String(hdgDeg).padStart(3, '0') + '°', px + 24, py + 382);
        }else if(i === 1 || i === 4){
          // ND
          mctx.fillStyle = '#6fe6ff'; mctx.font = 'bold 16px monospace'; mctx.textAlign = 'left';
          mctx.fillText('GS ' + gsKt + ' KT  TRK ' + String(hdgDeg).padStart(3, '0') + '°', px + 14, py + 28);
          mctx.strokeStyle = '#3d6d7d'; mctx.lineWidth = 1.5;
          const cx = px + 161, cy = py + 288;
          for(const r of [60, 120, 180]){ mctx.beginPath(); mctx.arc(cx, cy, r, Math.PI * 1.15, Math.PI * 1.85); mctx.stroke(); }
          mctx.fillStyle = '#fff';
          mctx.beginPath(); mctx.moveTo(cx, cy - 12); mctx.lineTo(cx - 8, cy + 8); mctx.lineTo(cx + 8, cy + 8); mctx.closePath(); mctx.fill();
        }else if(i === 2){
          // 4-Engine 747-8F GEnx-2B67 Upper EICAS!
          mctx.fillStyle = '#7cd7ff'; mctx.font = 'bold 17px monospace'; mctx.textAlign = 'left';
          mctx.fillText('747-8F GEnx-2B67 EICAS', px + 14, py + 28);
          for(let e = 0; e < 4; e++){
            const running = f ? Boolean(f.engines?.[e] && f.fuel !== 0) : false;
            const n1 = running ? Math.round(23 + (f?.power || 0) * 80) : 0;
            const gx = px + 46 + e * 76, gy = py + 112;
            mctx.strokeStyle = '#385766'; mctx.lineWidth = 5;
            mctx.beginPath(); mctx.arc(gx, gy, 28, Math.PI * 0.75, Math.PI * 2.15); mctx.stroke();
            mctx.strokeStyle = running ? '#5ef59b' : '#7a5244';
            mctx.beginPath(); mctx.arc(gx, gy, 28, Math.PI * 0.75, Math.PI * 0.75 + (n1 / 110) * Math.PI * 1.4); mctx.stroke();
            mctx.fillStyle = '#eef8ff'; mctx.font = 'bold 15px monospace'; mctx.textAlign = 'center';
            mctx.fillText(n1 + '%', gx, gy + 6);
            mctx.font = '12px monospace'; mctx.fillStyle = '#9fc5d6';
            mctx.fillText('E' + (e + 1), gx, gy + 44);
          }
          mctx.textAlign = 'left'; mctx.font = 'bold 16px monospace'; mctx.fillStyle = '#eef8ff';
          mctx.fillText('FOB  ' + Math.round(f?.fuel || 0).toLocaleString() + ' KG', px + 16, py + 206);
          const cargoKg = (f?.pallets || [0, 0, 0]).reduce((a, b) => a + b, 0);
          mctx.fillText('CARGO ' + Math.round(cargoKg).toLocaleString() + ' KG', px + 16, py + 236);
          mctx.fillStyle = f?.noseDoor ? '#ffcf5c' : '#57f29c';
          mctx.fillText('NOSE VISOR: ' + (f?.noseDoor ? 'OPEN' : 'LOCKED'), px + 16, py + 278);
          mctx.fillStyle = f?.sideDoor ? '#ffcf5c' : '#57f29c';
          mctx.fillText('SIDE CARGO: ' + (f?.sideDoor ? 'OPEN' : 'LOCKED'), px + 16, py + 306);
          const alerts = [];
          if(f?.parkingBrake) alerts.push(['PARKING BRAKE', '#ffcf5c']);
          if(f?.reverse) alerts.push(['REV THRUST x4', '#5ef59b']);
          if(f?.spoilers) alerts.push(['SPEEDBRAKES', '#ffcf5c']);
          alerts.forEach(([msg, col], ai) => {
            mctx.fillStyle = col; mctx.fillText('> ' + msg, px + 16, py + 362 + ai * 26);
          });
        }else{
          // Lower Synoptic (4x GEN, 5-Gear 18-Wheel Status, CG Shift, Backlight %)
          mctx.fillStyle = '#7cd7ff'; mctx.font = 'bold 17px monospace'; mctx.textAlign = 'left';
          mctx.fillText('SYNOPTIC · GEAR & CARGO', px + 14, py + 28);
          mctx.font = '15px monospace'; mctx.fillStyle = '#5ef59b';
          const genStr = [0, 1, 2, 3].map(g => 'G' + (g + 1) + (f?.engines?.[g] ? '+' : '-')).join(' ');
          mctx.fillText('GEN ' + genStr, px + 16, py + 76);
          const bal = f?.aircraft && typeof cargoBalance === 'function' ? cargoBalance(f) : { shift: 0 };
          mctx.fillText('CG SHIFT: ' + (bal.shift >= 0 ? '+' : '') + bal.shift.toFixed(2) + ' m', px + 16, py + 114);
          // 5 Gear Green Boxes: NOSE + LW + RW + LB + RB
          const gCol = f?.gear === false ? '#687982' : '#49e38d';
          for(const [gx, gy, lbl] of [[161, 185, 'NOSE'], [82, 240, 'L WNG'], [240, 240, 'R WNG'], [118, 295, 'L BDY'], [204, 295, 'R BDY']]){
            mctx.strokeStyle = gCol; mctx.lineWidth = 2.5; mctx.strokeRect(px + gx - 32, py + gy, 64, 30);
            mctx.fillStyle = gCol; mctx.textAlign = 'center'; mctx.fillText(lbl + ' ' + (f?.gear === false ? 'UP' : 'DN'), px + gx, py + gy + 20);
          }
          mctx.textAlign = 'left'; mctx.fillStyle = '#a4c8d8';
          mctx.fillText(isNight ? ('BACKLIGHT ' + Math.round(backlight * 100) + '%') : 'DAYLIGHT AUTO', px + 16, py + 455);
        }
        mctx.restore();
      }
      mipTex.needsUpdate = true;

      mcpCtx.fillStyle = '#182128'; mcpCtx.fillRect(0, 0, 1024, 128);
      if(batOn){
        mcpCtx.fillStyle = fullAvionics ? '#ffb84d' : '#554022';
        mcpCtx.font = 'bold 34px monospace';
        mcpCtx.fillText('IAS ' + String(iasKt).padStart(3, '0'), 54, 74);
        mcpCtx.fillText('HDG ' + String(hdgDeg).padStart(3, '0'), 305, 74);
        mcpCtx.fillText('ALT ' + String(Math.round((f?.hold?.altitude ?? f?.y ?? 0) * 3.28084)).padStart(5, '0'), 555, 74);
        mcpCtx.fillStyle = (f?.hold && fullAvionics) ? '#4dff88' : '#55656e';
        mcpCtx.fillText(f?.hold ? 'A/P ON' : 'A/P FD', 835, 74);
      }
      mcpTex.needsUpdate = true;

      cduCtx.fillStyle = '#071015'; cduCtx.fillRect(0, 0, 512, 384);
      if(batOn){
        cduCtx.fillStyle = '#6fe6ff'; cduCtx.font = 'bold 24px monospace';
        cduCtx.fillText('FMC · BOEING 747-8F', 22, 42);
        cduCtx.fillStyle = '#5ef59b'; cduCtx.font = '20px monospace';
        cduCtx.fillText('RTE: ' + (f?.departure?.code || 'RCKH') + ' -> ' + (f?.destination?.code || 'RCTP'), 22, 92);
        cduCtx.fillText('V1 136   VR 142   V2 152', 22, 140);
        const cargoTotal = (f?.pallets || [0, 0, 0]).reduce((a, b) => a + b, 0);
        cduCtx.fillText('CARGO: ' + Math.round(cargoTotal).toLocaleString() + ' KG', 22, 188);
        cduCtx.fillText('GW:    ' + Math.round(profile.mass + (f?.fuel || 0) + cargoTotal).toLocaleString() + ' KG', 22, 236);
        cduCtx.fillText(f?.noseDoor ? 'NOSE VISOR OPEN' : f?.sideDoor ? 'SIDE CARGO OPEN' : 'DOORS ARMED', 22, 294);
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
        y.wheel.rotation.z += (Math.PI * 0.88 - roll * 0.62 - y.wheel.rotation.z) * lerp;
      }
      const thrRot = 0.24 - pwr * 0.78 + (f.reverse ? 0.28 : 0);
      for(const lv of throttleLevers) lv.rotation.x += (thrRot - lv.rotation.x) * lerp;
      flapLever.rotation.x += (((f.flaps || 0) * 0.34 - 0.18) - flapLever.rotation.x) * lerp;
      speedbrakeLever.rotation.x += (((f.spoilers ? 0.42 : -0.18)) - speedbrakeLever.rotation.x) * lerp;
      gearLever.rotation.x += ((f.gear === false ? -0.36 : 0.28) - gearLever.rotation.x) * lerp;
    }

    data.setB748FBacklight = setBacklight;
    return { update, animateControls, switches, setBacklight };
  }

  globalScope.buildB748FAirframe = buildB748FAirframe;
  globalScope.refineB748FFlightDeck = refineB748FFlightDeck;
})(typeof window !== 'undefined' ? window : globalThis);
