'use strict';
// High-detail procedural Grumman F-14B Tomcat (f14b) benchmark.
// Continuous variable-sweep wings (20° unswept to 68° supersonic, 75° parked oversweep),
// twin F110-GE-400 nacelles with rectangular variable intakes & nozzles, ventral strakes,
// carrier dual-wheel nose gear w/ launch bar, animated arrestor tailhook, and dual-crew Tomcat cockpit.
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

  function buildTomcatPanelTextures() {
    const colC = makeCanvas(1024, 1024);
    const ctx = colC.getContext('2d');
    const bumpC = makeCanvas(1024, 1024);
    const btx = bumpC.getContext('2d');
    const roughC = makeCanvas(512, 512);
    const rtx = roughC.getContext('2d');

    // US Navy Tactical Paint Scheme (TPS) Light Gull Grey / Dark Ghost Grey
    const grad = ctx.createLinearGradient(0, 0, 0, 1024);
    grad.addColorStop(0.0, '#b9c0c6');
    grad.addColorStop(0.35, '#9ba4ad');
    grad.addColorStop(0.65, '#86909a');
    grad.addColorStop(1.0, '#b5bdc4');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 1024);

    btx.fillStyle = '#808080';
    btx.fillRect(0, 0, 1024, 1024);
    rtx.fillStyle = '#8e8e8e';
    rtx.fillRect(0, 0, 512, 512);

    // Subtle carrier-deck TPS weathering & maintenance touch-up patches
    for (let i = 0; i < 4000; i++) {
      const x = (i * 193.7) % 1024;
      const y = (i * 97.3) % 1024;
      ctx.fillStyle = i % 3 === 0 ? 'rgba(255,255,255,0.032)' : 'rgba(28,35,44,0.038)';
      ctx.fillRect(x, y, 8, 5);
      btx.fillStyle = i % 2 === 0 ? '#848484' : '#7c7c7c';
      btx.fillRect(x, y, 2, 2);
    }

    ctx.strokeStyle = 'rgba(28,36,44,0.22)';
    ctx.lineWidth = 1.4;
    btx.strokeStyle = '#4e4e4e';
    btx.lineWidth = 1.6;
    for (let r = 0; r < 14; r++) {
      const y = r * (1024 / 14) + 18;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1024, y); ctx.stroke();
      btx.beginPath(); btx.moveTo(0, y); btx.lineTo(1024, y); btx.stroke();
      for (let c = 0; c < 10; c++) {
        const x = c * (1024 / 10) + ((r % 2) * 32);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 72); ctx.stroke();
        btx.beginPath(); btx.moveTo(x, y); btx.lineTo(x, y + 72); btx.stroke();
      }
    }

    const colTex = makeTex(colC, true);
    const bumpTex = makeTex(bumpC, false);
    const roughTex = makeTex(roughC, false);
    [colTex, bumpTex, roughTex].forEach((t) => {
      t.wrapS = THREE.RepeatWrapping;
      t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(2, 2);
    });
    return { colTex, bumpTex, roughTex };
  }

  function makeWingShape(spanLen, rootChord, tipChord, sweepBack) {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.lineTo(spanLen, sweepBack);
    s.lineTo(spanLen, sweepBack + tipChord);
    s.lineTo(0, rootChord);
    s.closePath();
    return s;
  }

  function extrudeWing(shape, thickness, mat, bevel = 0.03) {
    const geom = new THREE.ExtrudeGeometry(shape, {
      depth: thickness,
      bevelEnabled: true,
      bevelThickness: bevel,
      bevelSize: bevel * 0.85,
      bevelSegments: 2,
      curveSegments: 8
    });
    geom.rotateX(Math.PI / 2);
    const mesh = new THREE.Mesh(geom, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  function loftFuselageSection(stations, segs, mat) {
    // stations: [{ z, y0, rx, ryTop, ryBot, flatTop }]
    const pos = [], uvs = [], idx = [];
    for (let i = 0; i < stations.length; i++) {
      const st = stations[i];
      const v = i / (stations.length - 1);
      for (let j = 0; j <= segs; j++) {
        const u = j / segs;
        const th = u * Math.PI * 2;
        const cx = Math.sin(th);
        const cy = Math.cos(th);
        let x = cx * st.rx;
        let y = st.y0 + (cy >= 0 ? cy * st.ryTop : cy * st.ryBot);
        if (st.flatTop && cy > 0.35) {
          y = st.y0 + st.ryTop * (0.65 + 0.35 * ((cy - 0.35) / 0.65) * 0.4);
        }
        pos.push(x, y, st.z);
        uvs.push(u, v);
      }
    }
    const row = segs + 1;
    for (let i = 0; i < stations.length - 1; i++) {
      for (let j = 0; j < segs; j++) {
        const a = i * row + j;
        const b = a + 1;
        const c = (i + 1) * row + j;
        const d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geom.setIndex(idx);
    geom.computeVertexNormals();
    const m = new THREE.Mesh(geom, mat);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }

  function buildF14Airframe(profile, scene) {
    const group = new THREE.Group();
    const gear = new THREE.Group();
    const cabin = new THREE.Group();
    const closeDetails = new THREE.Group();
    group.add(closeDetails, gear);
    cabin.visible = false;
    if (scene) scene.add(cabin);

    const half = profile?.geometry?.[0] ?? 9.55;      // 19.10 m total length
    const radius = profile?.geometry?.[1] ?? 1.10;
    const gearH = profile?.gearHeight ?? 1.59;       // Ground y = -1.59 m

    const tex = buildTomcatPanelTextures();
    const bodyMat = new THREE.MeshStandardMaterial({
      map: tex.colTex,
      bumpMap: tex.bumpTex,
      bumpScale: 0.012,
      roughnessMap: tex.roughTex,
      roughness: 0.56,
      metalness: 0.24
    });
    const darkTPSMat = new THREE.MeshStandardMaterial({
      color: 0x5d6772,
      bumpMap: tex.bumpTex,
      bumpScale: 0.01,
      roughness: 0.52,
      metalness: 0.28
    });
    const radomeMat = new THREE.MeshStandardMaterial({ color: 0xc8ccd0, roughness: 0.44, metalness: 0.1 });
    const antiGlareMat = new THREE.MeshStandardMaterial({ color: 0x1a1e24, roughness: 0.85, metalness: 0.05 });
    const intakeDarkMat = new THREE.MeshStandardMaterial({ color: 0x101419, roughness: 0.78, metalness: 0.3 });
    const tiMat = new THREE.MeshStandardMaterial({ color: 0x454c54, roughness: 0.34, metalness: 0.78 });
    const strutMat = new THREE.MeshStandardMaterial({ color: 0xd4dde5, roughness: 0.28, metalness: 0.72 });
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x171b20, roughness: 0.90, metalness: 0.05 });
    const canopyMat = new THREE.MeshPhysicalMaterial({
      color: 0x203846,
      roughness: 0.06,
      metalness: 0.18,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      transparent: true,
      opacity: 0.48
    });
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x222930, roughness: 0.55, metalness: 0.35 });
    const missileMat = new THREE.MeshStandardMaterial({ color: 0xe6ebef, roughness: 0.36, metalness: 0.2 });

    // 1. Forward Fuselage + Wide "Pancake" Lifting-Body Tunnel
    const radome = loftFuselageSection([
      { z: -half, y0: 0.02, rx: 0.025, ryTop: 0.025, ryBot: 0.025 },
      { z: -half + 0.55, y0: 0.03, rx: 0.21, ryTop: 0.21, ryBot: 0.20 },
      { z: -half + 1.45, y0: 0.06, rx: 0.42, ryTop: 0.41, ryBot: 0.38 },
      { z: -half + 2.35, y0: 0.10, rx: 0.57, ryTop: 0.55, ryBot: 0.48 }
    ], 24, radomeMat);
    radome.name = 'f14 radome';
    group.add(radome);

    // Nose Pitot Boom
    const pitot = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.024, 0.68, 8), strutMat);
    pitot.rotation.x = Math.PI / 2;
    pitot.position.set(0, 0.02, -half - 0.32);
    group.add(pitot);

    // AN/AXX-1 TCS / AAS-42 Dual Chin Sensor Pod
    const chinPod = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.72, 6, 12), darkTPSMat);
    chinPod.rotation.x = Math.PI / 2;
    chinPod.position.set(0, -0.44, -half + 2.15);
    group.add(chinPod);
    const chinLens = new THREE.Mesh(new THREE.SphereGeometry(0.095, 12, 10), canopyMat);
    chinLens.position.set(0, -0.44, -half + 1.75);
    group.add(chinLens);

    // Forward Cockpit Spine & Wide Pancake Tunnel
    const fwdAndTunnel = loftFuselageSection([
      { z: -half + 2.34, y0: 0.10, rx: 0.57, ryTop: 0.55, ryBot: 0.48 },
      { z: -half + 3.60, y0: 0.14, rx: 0.70, ryTop: 0.60, ryBot: 0.54 },
      { z: -half + 5.20, y0: 0.15, rx: 0.86, ryTop: 0.62, ryBot: 0.56, flatTop: true },
      { z: -half + 6.90, y0: 0.12, rx: 1.28, ryTop: 0.54, ryBot: 0.48, flatTop: true },
      { z: 0.0,          y0: 0.10, rx: 1.44, ryTop: 0.46, ryBot: 0.40, flatTop: true },
      { z: 4.10,         y0: 0.08, rx: 1.38, ryTop: 0.42, ryBot: 0.38, flatTop: true },
      { z: 6.95,         y0: 0.04, rx: 0.92, ryTop: 0.28, ryBot: 0.26, flatTop: true },
      { z: 8.55,         y0: 0.02, rx: 0.18, ryTop: 0.08, ryBot: 0.08 } // Beaver tail
    ], 28, bodyMat);
    fwdAndTunnel.name = 'f14 fuselage tunnel';
    group.add(fwdAndTunnel);

    // Anti-glare black strip ahead of windscreen
    const antiGlare = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.08, 1.45), antiGlareMat);
    antiGlare.position.set(0, 0.66, -half + 2.85);
    antiGlare.rotation.x = 0.08;
    group.add(antiGlare);

    // 2. Twin F-14B Bubble Canopy (2-seat tandem with iconic framed 3-piece windscreen)
    const canopyPivot = new THREE.Group();
    canopyPivot.position.set(0, 0.64, -half + 3.45);
    group.add(canopyPivot);

    const canopyGeom = new THREE.SphereGeometry(0.56, 22, 16, 0, Math.PI * 2, 0, Math.PI * 0.54);
    canopyGeom.scale(0.84, 0.88, 3.35);
    const canopyMesh = new THREE.Mesh(canopyGeom, canopyMat);
    canopyMesh.position.set(0, -0.02, 1.88);
    canopyPivot.add(canopyMesh);

    // Canopy windshield bow & center hoop arch
    const frontBow = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.032, 8, 18, Math.PI), frameMat);
    frontBow.position.set(0, 0.04, 0.72);
    frontBow.rotation.x = -0.32;
    canopyPivot.add(frontBow);

    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.032, 0.78), frameMat);
      post.position.set(side * 0.18, 0.28, 0.36);
      post.rotation.set(-0.56, side * 0.20, 0);
      canopyPivot.add(post);
    }

    // 2 Crew Members (Pilot + RIO in tandem)
    const pilotGroup = new THREE.Group();
    for (const pz of [-half + 4.30, -half + 5.75]) {
      const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.135, 0.22, 6, 10), new THREE.MeshStandardMaterial({ color: 0x3b483e, roughness: 0.78 }));
      torso.position.set(0, 0.56, pz);
      const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.115, 14, 10), new THREE.MeshStandardMaterial({ color: 0xd8dde2, roughness: 0.35 }));
      helmet.position.set(0, 0.79, pz - 0.01);
      pilotGroup.add(torso, helmet);
    }
    group.add(pilotGroup);

    // 3. Twin Wide-Spaced Engine Nacelles + Variable-Ramp Intakes + F110 Nozzles + Ventral Strakes
    const blades = [];
    const exhaustPlumes = [];
    for (const s of [-1, 1]) {
      const nx = s * 1.32;
      const nacGroup = new THREE.Group();
      nacGroup.name = 'f14 engine nacelle';
      nacGroup.position.set(nx, -0.08, 0);
      group.add(nacGroup);

      // Rectangular variable-ramp intake box at z = -3.45 .. -0.4
      const intakeBox = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.88, 3.15), bodyMat);
      intakeBox.position.set(0, -0.02, -1.90);
      intakeBox.castShadow = true;
      nacGroup.add(intakeBox);

      // Overhanging angled supersonic intake lip
      const lip = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.12, 0.65), darkTPSMat);
      lip.position.set(0, 0.40, -3.52);
      lip.rotation.x = 0.18;
      nacGroup.add(lip);

      // Intake dark cavity & internal compressor fan
      const cavity = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.68, 0.22), intakeDarkMat);
      cavity.position.set(0, -0.03, -3.38);
      nacGroup.add(cavity);

      const fan = new THREE.Group();
      fan.position.set(0, -0.03, -3.28);
      for (let b = 0; b < 12; b++) {
        const bl = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.32, 0.015), tiMat);
        const ang = (b / 12) * Math.PI * 2;
        bl.position.set(Math.cos(ang) * 0.16, Math.sin(ang) * 0.16, 0);
        bl.rotation.z = ang;
        bl.rotation.y = 0.45;
        fan.add(bl);
      }
      nacGroup.add(fan);
      blades.push(fan);

      // Cylindrical/faired mid-to-aft nacelle barrel (z = -0.4 .. +8.45)
      const barrel = loftFuselageSection([
        { z: -0.45, y0: -0.02, rx: 0.49, ryTop: 0.46, ryBot: 0.45 },
        { z: 3.40,  y0: -0.02, rx: 0.56, ryTop: 0.50, ryBot: 0.48 },
        { z: 7.40,  y0: -0.02, rx: 0.50, ryTop: 0.46, ryBot: 0.44 },
        { z: 8.55,  y0: -0.02, rx: 0.44, ryTop: 0.42, ryBot: 0.42 }
      ], 20, bodyMat);
      nacGroup.add(barrel);

      // F110-GE-400 Variable Exhaust Nozzle (z = 8.55 .. 9.35)
      const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.41, 0.34, 0.82, 18, 1, true), tiMat);
      nozzle.rotation.x = Math.PI / 2;
      nozzle.position.set(0, -0.02, 8.95);
      nacGroup.add(nozzle);

      // Afterburner Plume
      const abMat = new THREE.MeshBasicMaterial({ color: 0xffaa44, transparent: true, opacity: 0.78, depthWrite: false });
      const abCone = new THREE.Mesh(new THREE.ConeGeometry(0.32, 3.6, 16), abMat);
      abCone.rotation.x = -Math.PI / 2;
      abCone.position.set(0, -0.02, 11.1);
      abCone.visible = false;
      nacGroup.add(abCone);
      exhaustPlumes.push(abCone);

      // Ventral Strake Fin beneath aft nacelle (clearance checked: minY = -0.08 - 0.96 = -1.04 m > -1.59 m ground)
      const strakeShape = new THREE.Shape();
      strakeShape.moveTo(0, 0);
      strakeShape.lineTo(2.45, -0.10);
      strakeShape.lineTo(2.10, -0.52);
      strakeShape.lineTo(0.28, -0.38);
      strakeShape.closePath();
      const strakeGeom = new THREE.ExtrudeGeometry(strakeShape, { depth: 0.05, bevelEnabled: false });
      strakeGeom.rotateY(-Math.PI / 2);
      const strake = new THREE.Mesh(strakeGeom, darkTPSMat);
      strake.position.set(0.025, -0.42, 5.45);
      nacGroup.add(strake);
    }

    // 4. Twin Outward-Canted Vertical Tails (mounted on aft nacelles) + Animated Rudders
    const rudders = [];
    for (const s of [-1, 1]) {
      const finPivot = new THREE.Group();
      finPivot.position.set(s * 1.32, 0.38, 4.75);
      finPivot.rotation.z = -s * 0.095; // ~5.4° outward cant
      group.add(finPivot);

      const finShape = new THREE.Shape();
      finShape.moveTo(0, 0);
      finShape.lineTo(1.75, 2.86);   // top y = 0.38 + 2.86 = 3.24 m (height above ground = 4.83 m)
      finShape.lineTo(3.05, 2.86);
      finShape.lineTo(3.45, 0);
      finShape.closePath();
      const finGeom = new THREE.ExtrudeGeometry(finShape, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015 });
      finGeom.rotateY(-Math.PI / 2);
      const finMesh = new THREE.Mesh(finGeom, darkTPSMat);
      finMesh.position.x = 0.04;
      finMesh.castShadow = true;
      finPivot.add(finMesh);

      // Rudder hinge along trailing edge
      const rudderPivot = new THREE.Group();
      rudderPivot.position.set(0, 1.35, 3.22);
      const rudderMesh = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.35, 0.46), bodyMat);
      rudderMesh.position.set(0, 0, 0.22);
      rudderPivot.add(rudderMesh);
      finPivot.add(rudderPivot);
      rudders.push(rudderPivot);
    }

    // 5. Fixed Wing-Glove Fairings + Glove Vanes + Continuous Variable-Sweep Outer Wings (20° -> 68° -> 75°)
    const swingWings = [];
    const flaps = [];
    const surfaces = [];
    const navLights = [];
    const gloveVanes = [];

    for (const s of [-1, 1]) {
      // Fixed wing-glove fairing (root blend from fuselage tunnel x=±1.18 out to pivot x=±2.45)
      const gloveShape = makeWingShape(1.55, 5.25, 2.75, 2.35);
      const glove = extrudeWing(gloveShape, 0.24, bodyMat, 0.025);
      glove.position.set(s * 1.12, 0.28, -2.75);
      if (s < 0) glove.scale.x = -1;
      group.add(glove);

      // Retractable small triangular glove vane (extends slightly at high Mach)
      const vane = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.03, 0.72), darkTPSMat);
      vane.position.set(s * 1.48, 0.22, -2.35);
      vane.rotation.y = s * 0.65;
      group.add(vane);
      gloveVanes.push({ mesh: vane, side: s });

      // Swing-Wing Pivot at (x = ±2.45, y = 0.27, z = 0.15)
      // At 20° baseline (delta = 0): span arm 7.80 m with 20° leading-edge sweep -> half-span 2.45 + 7.80*cos(20°) = 9.78 m (19.56 m full span!)
      const wingPivot = new THREE.Group();
      wingPivot.name = 'f14 swing wing';
      wingPivot.position.set(s * 2.45, 0.27, 0.15);
      group.add(wingPivot);

      const armSpan = 7.33; // 7.33 / cos(20°) -> exact span x reach 7.33 -> 2.45+7.33 = 9.78 m
      const baseSweepZ = armSpan * Math.tan(20 * Math.PI / 180); // 2.67 m at 20° baseline
      const wingShape = makeWingShape(armSpan, 2.55, 1.02, baseSweepZ);
      const wingMesh = extrudeWing(wingShape, 0.18, bodyMat, 0.025);
      wingMesh.position.set(0, 0.07, -0.55);
      if (s < 0) wingMesh.scale.x = -1;
      wingPivot.add(wingMesh);

      // Trailing-edge Flap + Spoiler Control Surface
      const flapPivot = new THREE.Group();
      flapPivot.position.set(s * 3.10, -0.02, 2.38);
      flapPivot.rotation.y = -s * 0.22;
      const flapMesh = new THREE.Mesh(new THREE.BoxGeometry(3.85, 0.06, 0.48), darkTPSMat);
      flapMesh.position.set(0, 0, 0.20);
      flapPivot.add(flapMesh);
      wingPivot.add(flapPivot);
      flaps.push(flapPivot);
      surfaces.push(flapPivot);

      // Wingtip Navigation Light (Green starboard, Red port)
      const navLamp = new THREE.Mesh(
        new THREE.SphereGeometry(0.075, 8, 8),
        new THREE.MeshBasicMaterial({ color: s > 0 ? 0x3dff88 : 0xff3b47 })
      );
      navLamp.position.set(s * armSpan, 0.0, baseSweepZ - 0.18);
      wingPivot.add(navLamp);
      navLights.push(navLamp);

      swingWings.push({ pivot: wingPivot, side: s });
    }

    // 6. All-Moving Differential Horizontal Stabilators (z = +6.55)
    const stabilators = [];
    for (const s of [-1, 1]) {
      const stabPivot = new THREE.Group();
      stabPivot.name = 'f14 stabilator';
      stabPivot.position.set(s * 1.82, -0.02, 6.75);
      group.add(stabPivot);

      const stabShape = makeWingShape(3.25, 2.15, 0.72, 1.55);
      const stabMesh = extrudeWing(stabShape, 0.11, darkTPSMat, 0.018);
      stabMesh.position.set(0, 0.04, -0.55);
      if (s < 0) stabMesh.scale.x = -1;
      stabPivot.add(stabMesh);
      stabilators.push({ pivot: stabPivot, side: s });
    }

    // 7. Ordnance (Twin AIM-54 Phoenix under belly tunnel + Twin AIM-9 Sidewinders on glove pylons)
    for (const s of [-1, 1]) {
      const phoenix = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 3.65, 12), missileMat);
      phoenix.rotation.x = Math.PI / 2;
      phoenix.position.set(s * 0.45, -0.44, 0.45);
      group.add(phoenix);

      const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.28, 1.45), darkTPSMat);
      pylon.position.set(s * 2.05, 0.02, -0.45);
      const sidewinder = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 2.75, 10), missileMat);
      sidewinder.rotation.x = Math.PI / 2;
      sidewinder.position.set(s * 2.05, -0.16, -0.55);
      group.add(pylon, sidewinder);
    }

    // 8. Arrestor Tailhook (pivots cleanly at aft belly z = +6.25, drops to deck -1.59 m)
    const hookPivot = new THREE.Group();
    hookPivot.name = 'f14 tailhook';
    hookPivot.position.set(0, -0.26, 6.20);
    const hookArm = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.032, 2.25, 10), strutMat);
    hookArm.rotation.x = Math.PI / 2;
    hookArm.position.set(0, 0, 1.12);
    const hookShoe = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.22), antiGlareMat);
    hookShoe.position.set(0, -0.02, 2.25);
    hookPivot.add(hookArm, hookShoe);
    group.add(hookPivot);

    // 9. Dorsal Speedbrake
    const speedBrake = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.06, 1.18), darkTPSMat);
    speedBrake.position.set(0, 0.36, 6.85);
    group.add(speedBrake);

    // 10. Carrier-Grade 3-Point Retractable Landing Gear (grounded precisely at y = -gearH = -1.59 m)
    const wheels = [];
    const noseGearPivot = new THREE.Group();
    noseGearPivot.position.set(0, -0.34, -5.85);
    const noseStrutLen = gearH - 0.34 - 0.22; // -0.34 - strutLen - 0.22 = -1.59 m
    const noseStrut = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.055, noseStrutLen, 12), strutMat);
    noseStrut.position.set(0, -noseStrutLen * 0.5, 0);
    noseGearPivot.add(noseStrut);

    // Carrier Catapult Launch Bar on nose strut
    const launchBar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.65), strutMat);
    launchBar.position.set(0, -noseStrutLen + 0.14, -0.28);
    launchBar.rotation.x = 0.28;
    noseGearPivot.add(launchBar);

    const noseSteer = new THREE.Group();
    noseSteer.position.set(0, -noseStrutLen, 0);
    noseGearPivot.add(noseSteer);
    for (const s of [-1, 1]) {
      const nw = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.13, 18), tireMat);
      nw.rotation.z = Math.PI / 2;
      nw.position.set(s * 0.13, 0, 0);
      nw.userData.radius = 0.22;
      noseSteer.add(nw);
      wheels.push(nw);
    }
    gear.add(noseGearPivot);

    const mainGearPivots = [];
    for (const s of [-1, 1]) {
      const mgPivot = new THREE.Group();
      mgPivot.position.set(s * 2.15, -0.22, 1.45);
      const mainR = 0.34;
      const strutLen = gearH - 0.22 - mainR;
      const mStrut = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.065, strutLen, 12), strutMat);
      mStrut.position.set(s * 0.18, -strutLen * 0.5, 0);
      mStrut.rotation.z = s * 0.16;
      mgPivot.add(mStrut);

      const mWheel = new THREE.Mesh(new THREE.CylinderGeometry(mainR, mainR, 0.22, 20), tireMat);
      mWheel.rotation.z = Math.PI / 2;
      mWheel.position.set(s * 0.36, -strutLen, 0);
      mWheel.userData.radius = mainR;
      mgPivot.add(mWheel);
      wheels.push(mWheel);
      gear.add(mgPivot);
      mainGearPivots.push({ pivot: mgPivot, side: s });
    }

    group.userData = {
      f14HighDef: true,
      skipGenericFighterRefinement: true,
      skipGenericFighterDecals: true,
      gear,
      cabin,
      surfaces,
      flaps,
      wheels,
      blades,
      palletMeshes: [],
      exhaustPlumes,
      propDiscs: [],
      navLights,
      cockpitCanopy: canopyMesh,
      cockpitGlassMats: [canopyMat],
      half,
      radius,
      pilotGroup,
      canopyPivot,
      swingWings,
      hookPivot,
      currentSweepDeg: 20
    };

    refineF14FlightDeck(group, profile);

    let smoothGear = 1.0, smoothSweepDeg = 20.0, smoothHook = 0.0, smoothBrake = 0.0;

    group.userData.updateGear = function updateF14Gear(gProg, dt, f, paused) {
      const target = typeof gProg === 'number' ? clampVal(gProg, 0, 1) : 1;
      const step = clampVal((dt || 0.016) * 2.4, 0, 1);
      smoothGear += (target - smoothGear) * (paused ? 0 : step);
      const retract = 1 - smoothGear;

      noseGearPivot.rotation.x = retract * 1.56;
      noseGearPivot.visible = smoothGear > 0.06;
      noseSteer.rotation.y = clampVal((f?.steer || 0) * 0.45, -0.5, 0.5);
      for (const mg of mainGearPivots) {
        mg.pivot.rotation.x = retract * 1.52;
        mg.pivot.rotation.z = mg.side * retract * 0.28;
        mg.pivot.visible = smoothGear > 0.06;
      }
      gear.visible = smoothGear > 0.05;
    };

    group.userData.updateAeroSurfaces = function updateF14Surfaces(f, dt, now, paused) {
      const step = paused ? 0 : clampVal((dt || 0.016) * 5.0, 0, 1);
      const spd = f?.speed || 0;
      const mach = spd / 340.3;
      const parked = Boolean(f?.ground && !f?.engines?.some(Boolean));
      // Target sweep: 75° parked oversweep; 20° at low speed/flaps/gear; continuous 20° -> 68° from M 0.45 to M 1.40
      let targetSweep = 20;
      if (f?.mechanismDemo) {
        targetSweep = 20 + 48 * (0.5 - 0.5 * Math.cos((now || 0) * 0.0018));
      } else if (parked) {
        targetSweep = 75;
      } else if (!f?.flaps && f?.gear === false) {
        targetSweep = clampVal(20 + (mach - 0.42) / 0.98 * 48, 20, 68);
      }
      smoothSweepDeg += (targetSweep - smoothSweepDeg) * (paused && !f?.mechanismDemo ? 0 : clampVal((dt || 0.016) * 2.2, 0, 1));
      group.userData.currentSweepDeg = smoothSweepDeg;

      const deltaRad = (smoothSweepDeg - 20) * (Math.PI / 180);
      for (const w of swingWings) {
        w.pivot.rotation.y = -w.side * deltaRad;
      }
      for (const gv of gloveVanes) {
        gv.mesh.scale.x = mach > 0.85 ? 1.15 : 0.72;
      }

      // Flaps retract cleanly above 45° sweep
      const flapAmt = smoothSweepDeg > 42 ? 0 : (f?.flaps || 0) * 0.22;
      for (const fp of flaps) fp.rotation.x = -flapAmt;

      // Differential All-Moving Stabilators
      const pitchCmd = clampVal((f?.pitchInput || 0) * 0.28, -0.34, 0.34);
      const rollCmd = clampVal((f?.rollInput || 0) * 0.22, -0.28, 0.28);
      for (const st of stabilators) {
        st.pivot.rotation.x = pitchCmd + st.side * rollCmd;
      }
      for (const r of rudders) {
        r.rotation.y = clampVal((f?.yawInput || 0) * 0.34, -0.38, 0.38);
      }

      // Dorsal Speedbrake
      const brkTarget = f?.airBrake ? 0.68 : 0.0;
      smoothBrake += (brkTarget - smoothBrake) * step;
      speedBrake.rotation.x = smoothBrake;

      // Carrier Arrestor Tailhook
      const hookTarget = (f?.tailhook || f?.mechanismDemo) ? 0.74 : 0.0;
      smoothHook += (hookTarget - smoothHook) * (paused && !f?.mechanismDemo ? 0 : clampVal((dt || 0.016) * 4.5, 0, 1));
      hookPivot.rotation.x = smoothHook;

      // Twin Afterburner Plumes
      const abOn = Boolean(f?.engines?.some(Boolean) && f?.fuel !== 0 && f?.power > 0.85 && (f?.boost || f?.fastCruise));
      const pulse = 0.82 + 0.18 * Math.sin((now || 0) * 0.042);
      exhaustPlumes.forEach((p, idx) => {
        p.visible = Boolean(f?.engines?.[idx] ?? true) && abOn;
        p.scale.set(1, clampVal(0.75 + (f?.power || 0.9) * 0.45, 0.5, 1.35) * pulse, 1);
      });
    };

    if (scene && scene.add) scene.add(group);
    return group;
  }

  function refineF14FlightDeck(model, profile) {
    const data = model.userData;
    const cabin = data.cabin;
    const half = profile?.geometry?.[0] ?? 9.55;

    // Pilot eye coordinates inside Tomcat front cockpit
    const deckY = 0.62;
    const deckZ = -half + 4.30; // -5.25
    data.cockpitEye = { x: 0, y: 0.96, z: deckZ + 0.05 };
    data.cockpitPanelEye = { x: 0, y: 0.72, z: deckZ - 0.14 };
    data.cockpitHudConfig = { compact: true, hidePitchLadder: true };

    const tubMat = new THREE.MeshStandardMaterial({ color: 0x222930, roughness: 0.80, metalness: 0.25 });
    const panelMat = new THREE.MeshStandardMaterial({ color: 0x161b20, roughness: 0.66, metalness: 0.32 });
    const hazardMat = new THREE.MeshStandardMaterial({ color: 0xe6b800, roughness: 0.45, metalness: 0.15 });

    const b = (parent, mat, w, h, d, x, y, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      parent.add(m);
      return m;
    };

    // Cockpit tub, glare shield, side consoles & Grumman canopy bow
    b(cabin, tubMat, 0.94, 0.22, 1.45, 0, deckY - 0.48, deckZ - 0.25);
    b(cabin, tubMat, 0.20, 0.46, 1.32, -0.44, deckY - 0.22, deckZ - 0.24);
    b(cabin, tubMat, 0.20, 0.46, 1.32, 0.44, deckY - 0.22, deckZ - 0.24);
    b(cabin, tubMat, 0.90, 0.05, 0.34, 0, deckY + 0.18, deckZ - 0.68);

    // 3-piece Tomcat front windscreen mullions
    for (const s of [-1, 1]) {
      const m = b(cabin, panelMat, 0.032, 0.46, 0.032, s * 0.22, deckY + 0.40, deckZ - 0.60);
      m.rotation.set(-0.54, s * 0.18, 0);
    }

    // Center Ejection Handle (yellow/black Martin-Baker GRU-7A)
    b(cabin, hazardMat, 0.09, 0.025, 0.035, 0, deckY - 0.36, deckZ - 0.30);

    // Tomcat Main Instrument Panel (VDI top, HSD/TID bottom, Sweep Gauge left, Engine Tapes right)
    const mipC = makeCanvas(1024, 640);
    const mctx = mipC.getContext('2d');
    const mipTex = makeTex(mipC, true);
    const mipMat = new THREE.MeshBasicMaterial({ map: mipTex });
    const mipMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.76, 0.46), mipMat);
    mipMesh.position.set(0, deckY - 0.06, deckZ - 0.72);
    mipMesh.rotation.x = -0.14;
    cabin.add(mipMesh);

    // Collimated HUD Glass above glareshield
    const hudC = makeCanvas(512, 512);
    const hudCtx = hudC.getContext('2d');
    const hudTex = makeTex(hudC, true);
    const hudMat = new THREE.MeshBasicMaterial({ map: hudTex, transparent: true, opacity: 0.94, depthWrite: false });
    const hudGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.30, 0.30), hudMat);
    hudGlass.position.set(0, deckY + 0.33, deckZ - 0.62);
    hudGlass.rotation.x = -0.06;
    cabin.add(hudGlass);

    // Center Stick + Dual Left Console Throttles + Hook Lever
    const stickPivot = new THREE.Group();
    stickPivot.position.set(0, deckY - 0.38, deckZ - 0.24);
    b(stickPivot, panelMat, 0.036, 0.28, 0.042, 0, 0.14, 0);
    cabin.add(stickPivot);

    const thrPivot = new THREE.Group();
    thrPivot.position.set(-0.37, deckY - 0.08, deckZ - 0.24);
    b(thrPivot, panelMat, 0.065, 0.045, 0.11, 0, 0, 0);
    cabin.add(thrPivot);

    const hookLever = new THREE.Group();
    hookLever.position.set(0.35, deckY + 0.04, deckZ - 0.68);
    b(hookLever, hazardMat, 0.025, 0.08, 0.025, 0, -0.03, 0.03);
    cabin.add(hookLever);

    // Clickable Switch Hitboxes
    const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
    const switches = [];
    const swSpecs = [
      ['電瓶', -0.38, deckY - 0.04, deckZ - 0.38],
      ['引擎 1', -0.38, deckY - 0.04, deckZ - 0.26],
      ['引擎 2', -0.38, deckY - 0.04, deckZ - 0.14],
      ['燈光', 0.38, deckY - 0.04, deckZ - 0.34],
      ['起落架', -0.28, deckY - 0.06, deckZ - 0.68],
      ['襟翼', -0.34, deckY - 0.08, deckZ - 0.44],
      ['尾鉤', 0.34, deckY + 0.02, deckZ - 0.66],
      ['航向／高度保持', 0.18, deckY + 0.14, deckZ - 0.68]
    ];
    for (const [action, sx, sy, sz] of swSpecs) {
      const sw = b(cabin, hitMat, 0.10, 0.08, 0.10, sx, sy, sz);
      sw.userData.action = action;
      switches.push(sw);
    }

    let backlight = 0.80, lastDraw = -999;
    data.cockpitControls = {
      switches,
      setBacklight(v) {
        backlight = clampVal(Number(v) || 0.80, 0.25, 1.0);
        lastDraw = -1;
      }
    };

    data.updateFighterDeck = function updateF14Deck(f, now) {
      stickPivot.rotation.x = clampVal((f?.pitchInput || 0) * 0.24, -0.28, 0.28);
      stickPivot.rotation.z = -clampVal((f?.rollInput || 0) * 0.26, -0.30, 0.30);
      thrPivot.position.z = deckZ - 0.20 - clampVal(f?.power || 0, 0, 1) * 0.14;
      hookLever.rotation.x = f?.tailhook ? 0.45 : -0.22;

      if ((now || 0) - lastDraw < 70) return;
      lastDraw = now || 0;

      const elec = typeof cockpitElectrical !== 'undefined' ? cockpitElectrical.state : null;
      const batOn = !f ? true : Boolean(f.battery && (!elec || elec.battery));
      const powerOn = !f ? true : (batOn && (f.engines?.some(Boolean) || !elec || elec.avionics || elec.apu));
      const speeds = f && typeof flightSpeeds === 'function' ? flightSpeeds(f) : { ias: 0, mach: 0 };
      const kts = typeof knotsPerMps !== 'undefined' ? knotsPerMps : 1.94384;
      const iasKt = Math.round((speeds.ias || 0) * kts);
      const altFt = Math.round((f?.y || 0) * 3.28084);
      const hdgDeg = Math.round((((f?.heading || 0) * 180 / Math.PI) % 360 + 360) % 360);
      const sweepDeg = Math.round(data.currentSweepDeg || 20);
      const gLoad = f?.gForce || 1.0;

      // Draw Tomcat Main Instrument Panel
      mctx.fillStyle = '#181e24';
      mctx.fillRect(0, 0, 1024, 640);

      if (powerOn) {
        mctx.save();
        mctx.globalAlpha = 0.55 + 0.45 * backlight;
        // Upper VDI (CRT Horizon)
        mctx.fillStyle = '#091a14'; mctx.fillRect(320, 24, 384, 248);
        mctx.strokeStyle = '#4ad68e'; mctx.lineWidth = 3; mctx.strokeRect(320, 24, 384, 248);
        mctx.save();
        mctx.beginPath(); mctx.rect(326, 30, 372, 236); mctx.clip();
        mctx.translate(512, 148 + (f?.pitch || 0) * 200);
        mctx.rotate(-(f?.bank || 0));
        mctx.fillStyle = '#165a72'; mctx.fillRect(-300, -300, 600, 300);
        mctx.fillStyle = '#4f3b21'; mctx.fillRect(-300, 0, 600, 300);
        mctx.strokeStyle = '#7dffb2'; mctx.beginPath(); mctx.moveTo(-260, 0); mctx.lineTo(260, 0); mctx.stroke();
        mctx.restore();

        // Lower HSD/TID Tactical Display
        mctx.fillStyle = '#06130f'; mctx.fillRect(332, 300, 360, 312);
        mctx.strokeStyle = '#45c784'; mctx.strokeRect(332, 300, 360, 312);
        mctx.strokeStyle = '#2c7e54'; mctx.lineWidth = 2;
        mctx.beginPath(); mctx.arc(512, 466, 105, 0, Math.PI * 2); mctx.stroke();
        mctx.fillStyle = '#7dffb2'; mctx.font = 'bold 20px monospace';
        mctx.fillText('TID  HDG ' + String(hdgDeg).padStart(3, '0') + '°', 350, 334);
        mctx.fillText('BACKLIGHT ' + Math.round(backlight * 100) + '%', 350, 594);

        // Left: Wing-Sweep Indicator Tape + Airspeed/Alt
        mctx.fillStyle = '#0b161b'; mctx.fillRect(32, 36, 260, 570);
        mctx.strokeStyle = '#4c6d7a'; mctx.strokeRect(32, 36, 260, 570);
        mctx.fillStyle = '#ffb84d'; mctx.font = 'bold 22px monospace';
        mctx.fillText('WING SWEEP', 54, 80);
        mctx.fillStyle = '#7dffb2'; mctx.font = 'bold 40px monospace';
        mctx.fillText(sweepDeg + '°', 54, 130);
        mctx.fillStyle = '#1d3640'; mctx.fillRect(54, 152, 200, 26);
        mctx.fillStyle = '#ffb84d'; mctx.fillRect(54, 152, clampVal((sweepDeg - 20) / 55, 0, 1) * 200, 26);
        mctx.fillStyle = '#d4f4ff'; mctx.font = 'bold 22px monospace';
        mctx.fillText('IAS  ' + iasKt + ' KT', 54, 240);
        mctx.fillText('MACH ' + (speeds.mach || 0).toFixed(2), 54, 282);
        mctx.fillText('ALT  ' + altFt + ' FT', 54, 324);
        mctx.fillText('GEAR ' + (f?.gear === false ? 'UP' : 'DN'), 54, 386);
        mctx.fillText('FLAP ' + (f?.flaps ? 'DN' : 'UP'), 54, 428);

        // Right: Dual F110 Engines + Tailhook Annunciator
        mctx.fillStyle = '#0b161b'; mctx.fillRect(732, 36, 260, 570);
        mctx.strokeStyle = '#4c6d7a'; mctx.strokeRect(732, 36, 260, 570);
        mctx.fillStyle = '#7dffb2'; mctx.font = 'bold 22px monospace';
        mctx.fillText('F110-GE-400', 754, 80);
        for (let e = 0; e < 2; e++) {
          const on = !f || (f.engines?.[e] ?? true);
          const rpm = on ? Math.round(62 + (f?.power || 0) * 38) : 0;
          mctx.fillStyle = on ? '#7dffb2' : '#ff6b6b';
          mctx.fillText('ENG ' + (e + 1) + ': ' + rpm + '%', 754, 140 + e * 52);
        }
        mctx.fillStyle = f?.tailhook ? '#ffd24d' : '#7dffb2';
        mctx.font = 'bold 26px monospace';
        mctx.fillText('HOOK: ' + (f?.tailhook ? 'DOWN' : 'UP'), 754, 300);
        mctx.fillStyle = '#9cdbff'; mctx.font = '20px monospace';
        mctx.fillText('F-14B TOMCAT', 754, 560);
        mctx.restore();
      }
      mipTex.needsUpdate = true;

      // Draw Collimated HUD
      hudCtx.clearRect(0, 0, 512, 512);
      if (powerOn) {
        hudCtx.strokeStyle = 'rgba(110, 255, 165, 0.92)';
        hudCtx.fillStyle = 'rgba(110, 255, 165, 0.95)';
        hudCtx.lineWidth = 3;
        hudCtx.font = 'bold 22px monospace';
        hudCtx.fillText(String(iasKt).padStart(3, '0'), 28, 252);
        hudCtx.fillText(String(altFt).padStart(5, ' '), 408, 252);
        hudCtx.fillText(String(hdgDeg).padStart(3, '0') + '°', 232, 46);
        hudCtx.font = 'bold 18px monospace';
        hudCtx.fillText('M ' + (speeds.mach || 0).toFixed(2), 28, 308);
        hudCtx.fillText(gLoad.toFixed(1) + 'G', 28, 338);
        hudCtx.fillText('SWP ' + sweepDeg + '°', 28, 466);
        hudCtx.fillText(f?.tailhook ? 'HOOK DN' : 'HOOK UP', 402, 466);

        hudCtx.save();
        hudCtx.beginPath(); hudCtx.rect(120, 68, 272, 348); hudCtx.clip();
        hudCtx.translate(256, 244 + (f?.pitch || 0) * 200);
        hudCtx.rotate(-(f?.bank || 0));
        hudCtx.beginPath();
        hudCtx.moveTo(-130, 0); hudCtx.lineTo(-26, 0);
        hudCtx.moveTo(26, 0); hudCtx.lineTo(130, 0);
        hudCtx.stroke();
        hudCtx.restore();

        hudCtx.beginPath();
        hudCtx.arc(256, 244, 10, 0, Math.PI * 2);
        hudCtx.moveTo(218, 244); hudCtx.lineTo(246, 244);
        hudCtx.moveTo(266, 244); hudCtx.lineTo(294, 244);
        hudCtx.moveTo(256, 234); hudCtx.lineTo(256, 220);
        hudCtx.stroke();
      }
      hudTex.needsUpdate = true;
    };
  }

  globalScope.buildF14Airframe = buildF14Airframe;
  globalScope.refineF14FlightDeck = refineF14FlightDeck;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { buildF14Airframe, refineF14FlightDeck };
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
