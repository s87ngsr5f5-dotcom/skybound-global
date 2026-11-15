'use strict';
// High-detail procedural McDonnell Douglas F/A-18C Hornet (fa18c) benchmark.
// Features pointed ogive nose, straked LEX, rounded twin side intakes w/ rotating fans,
// twin 20°-canted vertical tails, twin F404 nozzles w/ AB plumes, FOLDING OUTER WINGS,
// animated carrier arrestor tailhook, dual-wheel nose gear w/ catapult launch bar,
// and dedicated 3-MFD + UFC + HUD Hornet cockpit.
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

  function buildHornetPanelTextures() {
    const colC = makeCanvas(1024, 1024);
    const ctx = colC.getContext('2d');
    const bumpC = makeCanvas(1024, 1024);
    const btx = bumpC.getContext('2d');

    // US Navy Light Ghost Grey FS 36375 / Dark Ghost Grey FS 36320
    ctx.fillStyle = '#adb6be';
    ctx.fillRect(0, 0, 1024, 1024);
    ctx.fillStyle = '#9aa4ad';
    ctx.fillRect(0, 0, 1024, 340);

    btx.fillStyle = '#808080';
    btx.fillRect(0, 0, 1024, 1024);

    ctx.strokeStyle = 'rgba(42, 50, 58, 0.28)';
    ctx.lineWidth = 2;
    btx.strokeStyle = '#585858';
    btx.lineWidth = 2;
    for (let y = 64; y < 1024; y += 96) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1024, y); ctx.stroke();
      btx.beginPath(); btx.moveTo(0, y); btx.lineTo(1024, y); btx.stroke();
    }
    for (let x = 64; x < 1024; x += 128) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 1024); ctx.stroke();
      btx.beginPath(); btx.moveTo(x, 0); btx.lineTo(x, 1024); btx.stroke();
    }

    // Subtle carrier deck grime & walkways
    ctx.fillStyle = 'rgba(45, 52, 58, 0.14)';
    ctx.fillRect(140, 220, 744, 24);
    ctx.fillRect(180, 620, 664, 18);

    const colorMap = makeTex(colC, true);
    colorMap.wrapS = THREE.RepeatWrapping;
    colorMap.wrapT = THREE.RepeatWrapping;
    const bumpMap = makeTex(bumpC, false);
    bumpMap.wrapS = THREE.RepeatWrapping;
    bumpMap.wrapT = THREE.RepeatWrapping;
    return { colorMap, bumpMap };
  }

  function makeWingShape(span, rootChord, tipChord, sweepBack) {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.lineTo(span, -sweepBack);
    s.lineTo(span, -sweepBack - tipChord);
    s.lineTo(0, -rootChord);
    s.closePath();
    return s;
  }

  function extrudeWing(shape, thickness, mat, bevel = 0.02) {
    const g = new THREE.ExtrudeGeometry(shape, {
      depth: thickness,
      bevelEnabled: true,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelSegments: 2
    });
    g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, mat);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }

  function buildFa18Airframe(profile, scene) {
    const group = new THREE.Group();
    group.name = 'fa18c highdef airframe';

    const cabin = new THREE.Group();
    cabin.name = 'fa18c highdef cabin';
    if (scene && scene.add) scene.add(cabin);

    const tex = buildHornetPanelTextures();
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xb6c0c8,
      map: tex.colorMap,
      bumpMap: tex.bumpMap,
      bumpScale: 0.015,
      roughness: 0.50,
      metalness: 0.24
    });
    const darkTPSMat = new THREE.MeshStandardMaterial({
      color: 0x87929c,
      roughness: 0.56,
      metalness: 0.22
    });
    const radomeMat = new THREE.MeshStandardMaterial({
      color: 0x6f7882,
      roughness: 0.54,
      metalness: 0.14
    });
    const metalMat = new THREE.MeshStandardMaterial({
      color: 0x525a62,
      roughness: 0.34,
      metalness: 0.78
    });
    const nozzleMat = new THREE.MeshStandardMaterial({
      color: 0x343a40,
      roughness: 0.32,
      metalness: 0.84
    });
    const tireMat = new THREE.MeshStandardMaterial({
      color: 0x1b1e22,
      roughness: 0.88,
      metalness: 0.05
    });
    const strutMat = new THREE.MeshStandardMaterial({
      color: 0xd0d7de,
      roughness: 0.28,
      metalness: 0.72
    });
    const canopyMat = new THREE.MeshPhysicalMaterial({
      color: 0x263f4e,
      roughness: 0.08,
      metalness: 0.08,
      transparent: true,
      opacity: 0.44,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06
    });
    const accentMat = new THREE.MeshStandardMaterial({
      color: 0x2b3e52,
      roughness: 0.45,
      metalness: 0.25
    });

    // 1. Sleek Hornet Fuselage (17.07 m total length: z = -8.535 nose to +8.535 tail)
    const lathePts = [
      new THREE.Vector2(0.005, -8.535),
      new THREE.Vector2(0.11, -8.20),
      new THREE.Vector2(0.28, -7.65),
      new THREE.Vector2(0.47, -6.90),
      new THREE.Vector2(0.62, -5.85),
      new THREE.Vector2(0.70, -4.55),
      new THREE.Vector2(0.75, -2.85),
      new THREE.Vector2(0.78, -0.50),
      new THREE.Vector2(0.76, 2.50),
      new THREE.Vector2(0.72, 5.20),
      new THREE.Vector2(0.62, 6.85),
      new THREE.Vector2(0.32, 7.65),
      new THREE.Vector2(0.01, 7.90)
    ];
    const fuseGeom = new THREE.LatheGeometry(lathePts, 28);
    fuseGeom.rotateX(Math.PI / 2);
    fuseGeom.scale(1.12, 0.86, 1.0);
    const fuseMesh = new THREE.Mesh(fuseGeom, bodyMat);
    fuseMesh.castShadow = true;
    fuseMesh.receiveShadow = true;
    group.add(fuseMesh);

    // Pointed Radome Cap
    const noseCone = new THREE.Mesh(new THREE.ConeGeometry(0.49, 1.80, 24), radomeMat);
    noseCone.rotation.x = -Math.PI / 2;
    noseCone.position.set(0, -0.02, -7.63);
    noseCone.scale.set(1.04, 1.0, 0.86);
    group.add(noseCone);

    // Nose Pitot & AOA probes
    const pitot = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.018, 0.42, 8), metalMat);
    pitot.rotation.x = Math.PI / 2;
    pitot.position.set(0, -0.02, -8.70);
    group.add(pitot);

    // Dorsal avionics spine behind canopy
    const spine = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.36, 6.6), darkTPSMat);
    spine.position.set(0, 0.56, -0.2);
    group.add(spine);

    // 2. Signature F/A-18C Bubble Canopy & Cockpit Interior Shell
    const canopyPivot = new THREE.Group();
    canopyPivot.position.set(0, 0.58, -4.85);
    group.add(canopyPivot);

    const canopyGeom = new THREE.SphereGeometry(0.56, 24, 16);
    canopyGeom.scale(0.86, 0.78, 3.05);
    const canopyGlass = new THREE.Mesh(canopyGeom, canopyMat);
    canopyGlass.name = 'fa18CanopyGlass';
    canopyGlass.position.set(0, 0.14, 0.08);
    canopyPivot.add(canopyGlass);

    // Canopy windscreen frame bow + pilot helmet & SJU-17 seat
    const archFrame = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.032, 8, 18, Math.PI), metalMat);
    archFrame.position.set(0, 0.10, -0.42);
    archFrame.rotation.x = -0.35;
    canopyPivot.add(archFrame);

    const seatBack = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.72, 0.22), metalMat);
    seatBack.position.set(0, 0.58, -4.60);
    seatBack.rotation.x = -0.18;
    group.add(seatBack);

    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 12), new THREE.MeshStandardMaterial({ color: 0xdce2e6, roughness: 0.3 }));
    helmet.position.set(0, 0.96, -4.72);
    group.add(helmet);

    // 3. Broad Straked Leading-Edge Extensions (LEX) + Dorsal LEX Fences
    for (const s of [-1, 1]) {
      const lexShape = makeWingShape(0.82, 4.75, 0.35, -0.25);
      const lex = extrudeWing(lexShape, 0.14, darkTPSMat, 0.02);
      lex.position.set(s * 0.56, 0.12, -5.20);
      if (s < 0) lex.scale.x = -1;
      group.add(lex);

      const fence = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.16, 0.95), metalMat);
      fence.position.set(s * 0.88, 0.28, -2.55);
      group.add(fence);
    }

    // 4. Twin Rounded Side Intakes (under LEX) + Rotating F404 Fans + Twin Exhaust Nozzles
    const blades = [];
    const exhaustPlumes = [];
    for (const s of [-1, 1]) {
      const intake = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.38, 2.25, 18), darkTPSMat);
      intake.rotation.x = Math.PI / 2;
      intake.scale.set(1.08, 1.0, 0.88);
      intake.position.set(s * 0.78, -0.14, -2.05);
      group.add(intake);

      const lip = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.04, 10, 20), metalMat);
      lip.scale.set(1.08, 0.88, 1.0);
      lip.position.set(s * 0.78, -0.14, -3.16);
      group.add(lip);

      const fanGroup = new THREE.Group();
      fanGroup.position.set(s * 0.78, -0.14, -2.92);
      const hub = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.24, 12), metalMat);
      hub.rotation.x = -Math.PI / 2;
      fanGroup.add(hub);
      for (let b = 0; b < 10; b++) {
        const bl = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.26, 0.02), metalMat);
        bl.rotation.z = (b / 10) * Math.PI * 2;
        bl.position.set(Math.sin(bl.rotation.z) * 0.15, Math.cos(bl.rotation.z) * 0.15, 0);
        fanGroup.add(bl);
      }
      group.add(fanGroup);
      blades.push(fanGroup);

      // Engine nacelle & F404 turkey-feather nozzle
      const nac = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.38, 6.2, 18), bodyMat);
      nac.rotation.x = Math.PI / 2;
      nac.position.set(s * 0.46, -0.06, 4.15);
      group.add(nac);

      const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.37, 0.78, 18), nozzleMat);
      nozzle.rotation.x = Math.PI / 2;
      nozzle.position.set(s * 0.46, -0.06, 7.55);
      group.add(nozzle);

      const abCone = new THREE.Mesh(
        new THREE.ConeGeometry(0.28, 3.1, 16),
        new THREE.MeshBasicMaterial({ color: 0xffaa44, transparent: true, opacity: 0.78, depthWrite: false })
      );
      abCone.rotation.x = -Math.PI / 2;
      abCone.position.set(s * 0.46, -0.06, 9.40);
      abCone.visible = false;
      group.add(abCone);
      exhaustPlumes.push(abCone);
    }

    // 5. Twin Outward-Canted (20°) Vertical Tails + Rudders
    const rudders = [];
    for (const s of [-1, 1]) {
      const finPivot = new THREE.Group();
      finPivot.position.set(s * 0.76, 0.34, 4.05);
      finPivot.rotation.z = -s * 0.349; // 20° outward cant
      group.add(finPivot);

      const finShape = new THREE.Shape();
      finShape.moveTo(0, 0);
      finShape.lineTo(1.55, 2.75);
      finShape.lineTo(2.45, 2.75);
      finShape.lineTo(2.78, 0);
      finShape.closePath();
      const finGeom = new THREE.ExtrudeGeometry(finShape, { depth: 0.07, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015 });
      finGeom.rotateY(-Math.PI / 2);
      const finMesh = new THREE.Mesh(finGeom, darkTPSMat);
      finMesh.position.x = 0.035;
      finMesh.castShadow = true;
      finPivot.add(finMesh);

      const rudderPivot = new THREE.Group();
      rudderPivot.position.set(0, 1.32, 2.55);
      const rudderMesh = new THREE.Mesh(new THREE.BoxGeometry(0.055, 2.15, 0.40), accentMat);
      rudderMesh.position.set(0, 0, 0.18);
      rudderPivot.add(rudderMesh);
      finPivot.add(rudderPivot);
      rudders.push(rudderPivot);
    }

    // 6. Signature F/A-18C Folding Main Wings (Inner Panel + Folding Outer Wing Panel w/ AIM-9 Tip Rails)
    const foldingOuterWings = [];
    const flaps = [];
    const ailerons = [];
    const surfaces = [];
    const navLights = [];

    for (const s of [-1, 1]) {
      // Inner fixed wing section: x = ±0.88 out to fold hinge at x = ±3.82 (span 2.94m)
      const innerSpan = 2.94;
      const innerShape = makeWingShape(innerSpan, 3.65, 2.25, 0.92);
      const innerWing = extrudeWing(innerShape, 0.16, bodyMat, 0.022);
      innerWing.position.set(s * 0.88, 0.16, -0.45);
      if (s < 0) innerWing.scale.x = -1;
      group.add(innerWing);

      // Trailing-edge Flap on inner wing
      const flapPivot = new THREE.Group();
      flapPivot.position.set(s * 2.35, 0.08, 2.65);
      flapPivot.rotation.y = s * 0.12;
      const flapMesh = new THREE.Mesh(new THREE.BoxGeometry(2.55, 0.06, 0.44), darkTPSMat);
      flapMesh.position.set(0, 0, 0.20);
      flapPivot.add(flapMesh);
      group.add(flapPivot);
      flaps.push(flapPivot);
      surfaces.push(flapPivot);

      // Folding Outer Wing Hinge at (x = ±3.82, y = 0.16, z = 0.47)
      const foldPivot = new THREE.Group();
      foldPivot.name = s < 0 ? 'fa18OuterWingPort' : 'fa18OuterWingStbd';
      foldPivot.position.set(s * 3.82, 0.16, 0.47);
      group.add(foldPivot);

      // Outer wing span: 1.895m -> reaches x = ±5.715 m (11.43 m unfolded wingspan!)
      const outerSpan = 1.895;
      const outerShape = makeWingShape(outerSpan, 2.25, 1.32, 0.56);
      const outerWing = extrudeWing(outerShape, 0.13, bodyMat, 0.018);
      outerWing.position.set(0, 0.06, 0);
      if (s < 0) outerWing.scale.x = -1;
      foldPivot.add(outerWing);

      // Outer Aileron
      const ailPivot = new THREE.Group();
      ailPivot.position.set(s * 0.92, 0.0, 1.98);
      const ailMesh = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.05, 0.34), darkTPSMat);
      ailMesh.position.set(0, 0, 0.16);
      ailPivot.add(ailMesh);
      foldPivot.add(ailPivot);
      ailerons.push({ pivot: ailPivot, side: s });
      surfaces.push(ailPivot);

      // Wingtip LAU-7 Sidewinder Rail + AIM-9 + Nav Light
      const tipRail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.10, 2.05), metalMat);
      tipRail.position.set(s * (outerSpan + 0.04), 0.02, 1.25);
      foldPivot.add(tipRail);

      const aim9 = new THREE.Mesh(new THREE.CylinderGeometry(0.064, 0.064, 2.45, 12), new THREE.MeshStandardMaterial({ color: 0xe6ebee, roughness: 0.35 }));
      aim9.rotation.x = Math.PI / 2;
      aim9.position.set(s * (outerSpan + 0.14), 0.02, 1.18);
      foldPivot.add(aim9);

      const navLamp = new THREE.Mesh(
        new THREE.SphereGeometry(0.065, 8, 8),
        new THREE.MeshBasicMaterial({ color: s > 0 ? 0x3dff88 : 0xff3b47 })
      );
      navLamp.position.set(s * (outerSpan + 0.05), 0.06, 0.48);
      foldPivot.add(navLamp);
      navLights.push(navLamp);

      foldingOuterWings.push({ pivot: foldPivot, side: s });
    }

    // 7. All-Moving Differential Horizontal Stabilators (z = +5.95..8.10)
    const stabilators = [];
    for (const s of [-1, 1]) {
      const stabPivot = new THREE.Group();
      stabPivot.name = s < 0 ? 'fa18StabPort' : 'fa18StabStbd';
      stabPivot.position.set(s * 1.05, -0.02, 6.25);
      group.add(stabPivot);

      const stabShape = makeWingShape(2.25, 1.95, 0.72, 1.15);
      const stabMesh = extrudeWing(stabShape, 0.09, darkTPSMat, 0.015);
      stabMesh.position.set(0, 0.04, -0.15);
      if (s < 0) stabMesh.scale.x = -1;
      stabPivot.add(stabMesh);
      stabilators.push({ pivot: stabPivot, side: s });
    }

    // 8. Dorsal Speedbrake (between twin tails) + Carrier Arrestor Tailhook
    const speedBrake = new THREE.Group();
    speedBrake.position.set(0, 0.56, 3.85);
    const brakePanel = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.05, 1.45), darkTPSMat);
    brakePanel.position.set(0, 0.03, 0.72);
    speedBrake.add(brakePanel);
    group.add(speedBrake);

    const hookPivot = new THREE.Group();
    hookPivot.name = 'fa18ArrestorHook';
    hookPivot.position.set(0, -0.34, 6.05);
    const hookBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.028, 2.25, 10), metalMat);
    hookBeam.rotation.x = Math.PI / 2;
    hookBeam.position.set(0, 0, 1.12);
    hookPivot.add(hookBeam);
    const hookShoe = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 0.24), new THREE.MeshStandardMaterial({ color: 0xe6b800, roughness: 0.45 }));
    hookShoe.position.set(0, -0.03, 2.24);
    hookPivot.add(hookShoe);
    group.add(hookPivot);

    // 9. Carrier 3-Point Landing Gear (gearHeight = 1.38 m) w/ Dual Nose Wheels & Launch Bar
    const gear = new THREE.Group();
    gear.name = 'fa18Gear';
    group.add(gear);

    const wheels = [];
    const wheelRadii = { nose: 0.28, main: 0.38 };

    const makeWheel = (name, r, w) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 18), tireMat);
      m.name = name;
      m.rotation.z = Math.PI / 2;
      m.userData = { radius: r };
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.56, r * 0.56, w + 0.015, 12), strutMat);
      m.add(rim);
      wheels.push(m);
      return m;
    };

    // Dual-wheel Nose Gear at z = -4.65 (bottom at -1.38 m)
    const noseGearPivot = new THREE.Group();
    noseGearPivot.position.set(0, -0.34, -4.65);
    gear.add(noseGearPivot);

    const noseStrut = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.044, 0.80, 12), strutMat);
    noseStrut.position.set(0, -0.40, 0);
    noseGearPivot.add(noseStrut);

    const launchBar = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.035, 0.62), metalMat);
    launchBar.position.set(0, -0.66, -0.26);
    launchBar.rotation.x = 0.22;
    noseGearPivot.add(launchBar);

    const noseSteer = new THREE.Group();
    noseSteer.position.set(0, -0.76, 0);
    noseGearPivot.add(noseSteer);

    for (const s of [-1, 1]) {
      const nw = makeWheel(s < 0 ? 'fa18NoseWheelL' : 'fa18NoseWheelR', wheelRadii.nose, 0.14);
      nw.position.set(s * 0.13, 0, 0);
      noseSteer.add(nw);
    }

    // Wide-track Splayed Main Gear at z = +1.15 (bottom at -1.38 m)
    const mainGearPivots = [];
    for (const s of [-1, 1]) {
      const mgPivot = new THREE.Group();
      mgPivot.position.set(s * 0.72, -0.24, 1.15);
      gear.add(mgPivot);

      const upperStrut = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.052, 0.96, 12), strutMat);
      upperStrut.position.set(s * 0.42, -0.38, 0);
      upperStrut.rotation.z = s * 0.62;
      mgPivot.add(upperStrut);

      const mw = makeWheel(s < 0 ? 'fa18MainWheelL' : 'fa18MainWheelR', wheelRadii.main, 0.24);
      mw.position.set(s * 0.82, -0.76, 0);
      mgPivot.add(mw);

      mainGearPivots.push({ pivot: mgPivot, side: s });
    }

    const gearMeshes = [noseGearPivot, ...mainGearPivots.map((m) => m.pivot)];

    group.userData = {
      fa18HighDef: true,
      skipGenericFighterRefinement: true,
      skipGenericFighterDecals: true,
      half: profile?.geometry?.[0] ?? 8.535,
      radius: profile?.geometry?.[1] ?? 0.95,
      span: profile?.geometry?.[2] ?? 5.715,
      cabin,
      gear,
      gearMeshes,
      wheels,
      blades,
      surfaces,
      navLights,
      exhaustPlumes,
      wingFoldAngleDeg: 0,
      applyConformalLivery(themeId) {
        const tints = {
          default: 0xb6c0c8,
          starlux: 0x3b424c,
          plum: 0x9aa4b4,
          thunder: 0xc8d0d6,
          camo: 0x7c8682,
          rescue: 0xd0d6da
        };
        bodyMat.color.setHex(tints[themeId] ?? 0xb6c0c8);
      }
    };

    refineFa18FlightDeck(group, profile);

    let smoothGear = 1.0, smoothFoldDeg = 0.0, smoothHook = 0.0, smoothBrake = 0.0;

    group.userData.updateGear = function updateFa18Gear(gProg, dt, f, paused) {
      const target = typeof gProg === 'number' ? clampVal(gProg, 0, 1) : 1;
      const step = clampVal((dt || 0.016) * 2.5, 0, 1);
      smoothGear += (target - smoothGear) * (paused ? 0 : step);
      const retract = 1 - smoothGear;

      noseGearPivot.rotation.x = -retract * 1.56;
      noseGearPivot.visible = smoothGear > 0.06;
      noseSteer.rotation.y = clampVal((f?.steer || 0) * 0.48, -0.52, 0.52);
      for (const mg of mainGearPivots) {
        mg.pivot.rotation.x = retract * 1.48;
        mg.pivot.rotation.z = -mg.side * retract * 0.42;
        mg.pivot.visible = smoothGear > 0.06;
      }
      gear.visible = smoothGear > 0.05;
    };

    group.userData.updateAeroSurfaces = function updateFa18Surfaces(f, dt, now, paused) {
      const step = paused ? 0 : clampVal((dt || 0.016) * 5.0, 0, 1);
      const parked = Boolean(f?.ground && !f?.engines?.some(Boolean));

      // Signature F/A-18C Folding Outer Wings (0° flight -> 92° folded on carrier deck or mechanismDemo)
      let targetFold = 0;
      if (f?.mechanismDemo) {
        targetFold = 92 * (0.5 - 0.5 * Math.cos((now || 0) * 0.0019));
      } else if (parked) {
        targetFold = 92;
      }
      smoothFoldDeg += (targetFold - smoothFoldDeg) * (paused && !f?.mechanismDemo ? 0 : clampVal((dt || 0.016) * 2.4, 0, 1));
      group.userData.wingFoldAngleDeg = smoothFoldDeg;

      const foldRad = smoothFoldDeg * (Math.PI / 180);
      for (const fw of foldingOuterWings) {
        fw.pivot.rotation.z = fw.side * foldRad;
      }

      // Flaps & Differential Ailerons
      const flapAmt = (f?.flaps || 0) * 0.28;
      for (const fp of flaps) fp.rotation.x = -flapAmt;
      const rollCmd = clampVal((f?.rollInput || 0) * 0.28, -0.32, 0.32);
      for (const a of ailerons) a.pivot.rotation.x = a.side * rollCmd;

      // Differential Horizontal Stabilators & Twin Rudders
      const pitchCmd = clampVal((f?.pitchInput || 0) * 0.28, -0.34, 0.34);
      for (const st of stabilators) {
        st.pivot.rotation.x = pitchCmd + st.side * rollCmd * 0.65;
      }
      for (const r of rudders) {
        r.rotation.y = clampVal((f?.yawInput || 0) * 0.34, -0.38, 0.38);
      }

      // Dorsal Speedbrake
      const brkTarget = f?.airBrake ? 0.66 : 0.0;
      smoothBrake += (brkTarget - smoothBrake) * step;
      speedBrake.rotation.x = smoothBrake;

      // Carrier Arrestor Tailhook
      const hookTarget = (f?.tailhook || f?.mechanismDemo) ? 0.76 : 0.0;
      smoothHook += (hookTarget - smoothHook) * (paused && !f?.mechanismDemo ? 0 : clampVal((dt || 0.016) * 4.5, 0, 1));
      hookPivot.rotation.x = smoothHook;

      // Twin F404 Afterburner Plumes
      const abOn = Boolean(f?.engines?.some(Boolean) && f?.fuel !== 0 && f?.power > 0.85 && (f?.boost || f?.fastCruise));
      const pulse = 0.82 + 0.18 * Math.sin((now || 0) * 0.044);
      exhaustPlumes.forEach((p, idx) => {
        p.visible = Boolean(f?.engines?.[idx] ?? true) && abOn;
        p.scale.set(1, clampVal(0.75 + (f?.power || 0.9) * 0.45, 0.5, 1.35) * pulse, 1);
      });
    };

    if (scene && scene.add) scene.add(group);
    return group;
  }

  function refineFa18FlightDeck(model, profile) {
    const data = model.userData;
    const cabin = data.cabin;
    const half = profile?.geometry?.[0] ?? 8.535;

    const deckY = 0.58;
    const deckZ = -half + 3.68; // -4.855
    data.cockpitEye = { x: 0, y: 0.90, z: deckZ + 0.04 };
    data.cockpitPanelEye = { x: 0, y: 0.68, z: deckZ - 0.16 };
    data.cockpitHudConfig = { compact: true, hidePitchLadder: true };

    const tubMat = new THREE.MeshStandardMaterial({ color: 0x20272e, roughness: 0.80, metalness: 0.25 });
    const panelMat = new THREE.MeshStandardMaterial({ color: 0x151a1f, roughness: 0.66, metalness: 0.32 });
    const hazardMat = new THREE.MeshStandardMaterial({ color: 0xe6b800, roughness: 0.45, metalness: 0.15 });

    const b = (parent, mat, w, h, d, x, y, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      parent.add(m);
      return m;
    };

    // Cockpit tub, glare shield, side consoles & canopy bow
    b(cabin, tubMat, 0.86, 0.20, 1.35, 0, deckY - 0.46, deckZ - 0.24);
    b(cabin, tubMat, 0.18, 0.44, 1.24, -0.40, deckY - 0.22, deckZ - 0.22);
    b(cabin, tubMat, 0.18, 0.44, 1.24, 0.40, deckY - 0.22, deckZ - 0.22);
    b(cabin, tubMat, 0.84, 0.045, 0.32, 0, deckY + 0.16, deckZ - 0.64);

    // SJU-17 Ejection Handle
    b(cabin, hazardMat, 0.08, 0.025, 0.035, 0, deckY - 0.34, deckZ - 0.28);

    // Hornet 3-MFD + UFC Main Instrument Panel (Left DDI, Center MPCD, Right DDI, UFC keypad)
    const mipC = makeCanvas(1024, 640);
    const mctx = mipC.getContext('2d');
    const mipTex = makeTex(mipC, true);
    const mipMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.74, 0.46), new THREE.MeshBasicMaterial({ map: mipTex }));
    mipMesh.name = 'fa18Mip3Mfd';
    mipMesh.position.set(0, deckY - 0.06, deckZ - 0.68);
    mipMesh.rotation.x = -0.14;
    cabin.add(mipMesh);

    // Wide-angle Hornet HUD Glass above UFC
    const hudC = makeCanvas(512, 512);
    const hudCtx = hudC.getContext('2d');
    const hudTex = makeTex(hudC, true);
    const hudGlass = new THREE.Mesh(
      new THREE.PlaneGeometry(0.29, 0.29),
      new THREE.MeshBasicMaterial({ map: hudTex, transparent: true, opacity: 0.94, depthWrite: false })
    );
    hudGlass.name = 'fa18HudSymbology';
    hudGlass.position.set(0, deckY + 0.32, deckZ - 0.58);
    hudGlass.rotation.x = -0.06;
    cabin.add(hudGlass);

    // Center Stick, Twin Left Throttles & Arrestor Hook Lever
    const stickPivot = new THREE.Group();
    stickPivot.position.set(0, deckY - 0.36, deckZ - 0.22);
    b(stickPivot, panelMat, 0.034, 0.27, 0.04, 0, 0.13, 0);
    cabin.add(stickPivot);

    const thrPivot = new THREE.Group();
    thrPivot.position.set(-0.34, deckY - 0.08, deckZ - 0.22);
    b(thrPivot, panelMat, 0.06, 0.04, 0.10, 0, 0, 0);
    cabin.add(thrPivot);

    const hookLever = new THREE.Group();
    hookLever.position.set(0.32, deckY + 0.04, deckZ - 0.64);
    b(hookLever, hazardMat, 0.022, 0.075, 0.022, 0, -0.03, 0.03);
    cabin.add(hookLever);

    // Clickable Switch Hitboxes
    const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
    const switches = [];
    const swSpecs = [
      ['電瓶', -0.35, deckY - 0.04, deckZ - 0.36],
      ['引擎 1', -0.35, deckY - 0.04, deckZ - 0.24],
      ['引擎 2', -0.35, deckY - 0.04, deckZ - 0.12],
      ['燈光', 0.35, deckY - 0.04, deckZ - 0.32],
      ['起落架', -0.26, deckY - 0.06, deckZ - 0.64],
      ['襟翼', -0.32, deckY - 0.08, deckZ - 0.42],
      ['尾鉤', 0.32, deckY + 0.02, deckZ - 0.62],
      ['航向／高度保持', 0.16, deckY + 0.12, deckZ - 0.64]
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

    data.updateFighterDeck = function updateFa18Deck(f, now) {
      stickPivot.rotation.x = clampVal((f?.pitchInput || 0) * 0.24, -0.28, 0.28);
      stickPivot.rotation.z = -clampVal((f?.rollInput || 0) * 0.26, -0.30, 0.30);
      thrPivot.position.z = deckZ - 0.18 - clampVal(f?.power || 0, 0, 1) * 0.14;
      hookLever.rotation.x = f?.tailhook ? 0.45 : -0.22;

      if (now - lastDraw < 45) return;
      lastDraw = now;

      const powerOn = Boolean(f?.battery || f?.engines?.some(Boolean));
      const spd = f?.speed || 0;
      const iasKt = Math.round(spd * 1.94384);
      const altFt = Math.round((f?.y || 0) * 3.28084);
      const hdgDeg = Math.round((((f?.heading || 0) * 180 / Math.PI) % 360 + 360) % 360);
      const gLoad = Number(f?.gForce || 1.0);
      const foldDeg = Math.round(data.wingFoldAngleDeg || 0);
      const bl = backlight;

      mctx.fillStyle = '#12181d';
      mctx.fillRect(0, 0, 1024, 640);

      // Center Up-Front Controller (UFC) Keypad
      mctx.fillStyle = '#090d10';
      mctx.fillRect(384, 24, 256, 224);
      mctx.strokeStyle = '#3c4d5a';
      mctx.lineWidth = 3;
      mctx.strokeRect(384, 24, 256, 224);
      if (powerOn) {
        mctx.fillStyle = `rgba(92, 245, 145, ${0.75 + 0.25 * bl})`;
        mctx.font = 'bold 20px monospace';
        mctx.fillText('UFC · TACAN 42X', 402, 58);
        mctx.font = '18px monospace';
        mctx.fillText(f?.gear ? 'GEAR DN' : 'GEAR UP', 402, 100);
        mctx.fillText(f?.tailhook ? 'HOOK DN' : 'HOOK UP', 524, 100);
        mctx.fillText('FOLD ' + foldDeg + '°', 402, 142);
      }

      // Left DDI: Tactical / Wing Fold & Stores
      mctx.fillStyle = '#07120c';
      mctx.fillRect(36, 48, 300, 290);
      mctx.strokeStyle = '#334650';
      mctx.strokeRect(36, 48, 300, 290);
      if (powerOn) {
        mctx.fillStyle = `rgba(90, 255, 140, ${0.75 + 0.25 * bl})`;
        mctx.font = 'bold 20px monospace';
        mctx.fillText('LEFT DDI · FCS', 54, 80);
        mctx.font = '18px monospace';
        mctx.fillText('WING FOLD: ' + foldDeg + '°', 54, 128);
        mctx.fillText('FLAPS: ' + (f?.flaps ? 'HALF/FULL' : 'AUTO'), 54, 168);
        mctx.fillText('G-LOAD: ' + gLoad.toFixed(1) + 'G', 54, 208);
      }

      // Right DDI: Twin F404 Engine & Fuel Page
      mctx.fillStyle = '#07120c';
      mctx.fillRect(688, 48, 300, 290);
      mctx.strokeStyle = '#334650';
      mctx.strokeRect(688, 48, 300, 290);
      if (powerOn) {
        const rpm1 = f?.engines?.[0] ? Math.round(62 + (f?.power || 0) * 38) : 0;
        const rpm2 = f?.engines?.[1] ? Math.round(62 + (f?.power || 0) * 38) : 0;
        mctx.fillStyle = `rgba(90, 255, 140, ${0.75 + 0.25 * bl})`;
        mctx.font = 'bold 20px monospace';
        mctx.fillText('RIGHT DDI · F404', 706, 80);
        mctx.font = '18px monospace';
        mctx.fillText(`N2 L:${rpm1}%  R:${rpm2}%`, 706, 128);
        mctx.fillText(`FUEL: ${Math.round(f?.fuel || 0)} KG`, 706, 168);
        mctx.fillText(`IAS: ${iasKt} KT`, 706, 208);
      }

      // Center Lower MPCD: HSI / Heading Rose
      mctx.fillStyle = '#07120c';
      mctx.fillRect(362, 276, 300, 310);
      mctx.strokeStyle = '#334650';
      mctx.strokeRect(362, 276, 300, 310);
      if (powerOn) {
        mctx.strokeStyle = `rgba(90, 255, 140, ${0.72 + 0.25 * bl})`;
        mctx.beginPath();
        mctx.arc(512, 435, 92, 0, Math.PI * 2);
        mctx.stroke();
        mctx.fillStyle = `rgba(90, 255, 140, ${0.78 + 0.22 * bl})`;
        mctx.font = 'bold 22px monospace';
        mctx.fillText(`HDG ${String(hdgDeg).padStart(3, '0')}°`, 450, 314);
        mctx.fillText(`ALT ${altFt} FT`, 442, 566);
      }
      mipTex.needsUpdate = true;

      // Collimated HUD Glass
      hudCtx.clearRect(0, 0, 512, 512);
      if (powerOn) {
        hudCtx.strokeStyle = 'rgba(105, 255, 160, 0.92)';
        hudCtx.fillStyle = 'rgba(105, 255, 160, 0.95)';
        hudCtx.lineWidth = 3;
        hudCtx.font = 'bold 22px monospace';
        hudCtx.fillText(String(iasKt).padStart(3, '0'), 28, 252);
        hudCtx.fillText(String(altFt).padStart(5, ' '), 408, 252);
        hudCtx.fillText(String(hdgDeg).padStart(3, '0') + '°', 232, 46);
        hudCtx.font = 'bold 18px monospace';
        hudCtx.fillText('M ' + (spd / 340.3).toFixed(2), 28, 308);
        hudCtx.fillText(gLoad.toFixed(1) + 'G', 28, 338);
        hudCtx.fillText('FOLD ' + foldDeg + '°', 28, 466);
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

  globalScope.buildFa18Airframe = buildFa18Airframe;
  globalScope.refineFa18FlightDeck = refineFa18FlightDeck;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { buildFa18Airframe, refineFa18FlightDeck };
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
