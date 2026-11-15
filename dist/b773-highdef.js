'use strict';
// High-Fidelity Boeing 777-300ER (b773) Reference Model, Articulated 6-Wheel Gear, 3-4-3 Cabin & 6-LCD Flight Deck
(function(globalScope){
  const DEG = Math.PI / 180;

  function clamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }

  // Boeing 777-300ER circular fuselage cross-section profile (73.86m overall length, 6.20m diameter)
  const B773_STATIONS = [
    { z: -36.93, rx: 0.06, ryTop: 0.06, ryBot: 0.06, y: -0.62, pTop: 2.0, pBot: 2.0 },
    { z: -36.15, rx: 0.68, ryTop: 0.64, ryBot: 0.58, y: -0.54, pTop: 2.0, pBot: 2.0 },
    { z: -34.50, rx: 1.55, ryTop: 1.44, ryBot: 1.32, y: -0.36, pTop: 2.05, pBot: 2.0 },
    { z: -32.25, rx: 2.38, ryTop: 2.16, ryBot: 2.04, y: -0.18, pTop: 2.1, pBot: 2.0 },
    { z: -29.80, rx: 2.84, ryTop: 2.86, ryBot: 2.76, y: -0.04, pTop: 2.12, pBot: 2.02 },
    { z: -26.80, rx: 3.07, ryTop: 3.12, ryBot: 3.06, y: 0.00, pTop: 2.08, pBot: 2.02 },
    { z: -23.50, rx: 3.10, ryTop: 3.16, ryBot: 3.10, y: 0.00, pTop: 2.04, pBot: 2.02 },
    { z: 16.50,  rx: 3.10, ryTop: 3.16, ryBot: 3.10, y: 0.00, pTop: 2.04, pBot: 2.02 },
    { z: 24.50,  rx: 2.72, ryTop: 2.82, ryBot: 2.66, y: 0.20, pTop: 2.04, pBot: 2.02 },
    { z: 31.20,  rx: 1.72, ryTop: 2.02, ryBot: 1.58, y: 0.54, pTop: 2.05, pBot: 2.02 },
    { z: 35.10,  rx: 0.64, ryTop: 1.16, ryBot: 0.72, y: 0.88, pTop: 2.1, pBot: 2.0 },
    { z: 36.85,  rx: 0.14, ryTop: 0.48, ryBot: 0.28, y: 1.04, pTop: 2.2, pBot: 2.0 },
    { z: 37.35,  rx: 0.05, ryTop: 0.22, ryBot: 0.14, y: 1.08, pTop: 2.2, pBot: 2.0 }
  ];

  function evalB773Section(z){
    if(z <= B773_STATIONS[0].z) return B773_STATIONS[0];
    if(z >= B773_STATIONS[B773_STATIONS.length - 1].z) return B773_STATIONS[B773_STATIONS.length - 1];
    for(let i = 0; i < B773_STATIONS.length - 1; i++){
      const a = B773_STATIONS[i], b = B773_STATIONS[i + 1];
      if(z >= a.z && z <= b.z){
        const t = (z - a.z) / Math.max(0.01, b.z - a.z);
        const e = t * t * (3 - 2 * t);
        return {
          z,
          rx: a.rx + (b.rx - a.rx) * e,
          ryTop: a.ryTop + (b.ryTop - a.ryTop) * e,
          ryBot: a.ryBot + (b.ryBot - a.ryBot) * e,
          y: a.y + (b.y - a.y) * e,
          pTop: a.pTop + (b.pTop - a.pTop) * e,
          pBot: a.pBot + (b.pBot - a.pBot) * e
        };
      }
    }
    return B773_STATIONS[0];
  }

  // Matches buildFuselageLoft angular convention: angle=0 is +X, +PI/2 is top +Y
  // For caller convenience here angleFromTop=0 is top crown +Y, +side*PI/2 is side +/-X
  function skinPointFromTop(z, angleFromTop, offset = 0){
    const s = evalB773Section(z);
    const a = Math.PI / 2 - angleFromTop;
    const ca = Math.cos(a), sa = Math.sin(a);
    const ry = sa >= 0 ? s.ryTop : s.ryBot;
    const pow = sa >= 0 ? s.pTop : s.pBot;
    const exp = 2 / pow;
    const x = Math.sign(ca) * Math.pow(Math.abs(ca), exp) * (s.rx + offset);
    const y = s.y + Math.sign(sa) * Math.pow(Math.abs(sa), exp) * (ry + offset);
    return [x, y, z];
  }

  function makeCurvedPanel(corners, mat, offset, steps = 8){
    const verts = [], idx = [];
    for(let i = 0; i <= steps; i++){
      const t = i / steps;
      for(let j = 0; j <= steps; j++){
        const u = j / steps;
        const lo0 = corners[0][0] + (corners[1][0] - corners[0][0]) * u;
        const lo1 = corners[0][1] + (corners[1][1] - corners[0][1]) * u;
        const hi0 = corners[3][0] + (corners[2][0] - corners[3][0]) * u;
        const hi1 = corners[3][1] + (corners[2][1] - corners[3][1]) * u;
        verts.push(...skinPointFromTop(lo0 + (hi0 - lo0) * t, lo1 + (hi1 - lo1) * t, offset));
        if(i && j){
          const a = i * (steps + 1) + j, b = a - steps - 1;
          idx.push(a, b, a - 1, b, b - 1, a - 1);
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return new THREE.Mesh(geo, mat);
  }

  function buildB773TireTreadTexture(){
    if(typeof document === 'undefined') return null;
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    if(!g) return null;
    g.fillStyle = '#505050';
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#181818';
    for(let x = 14; x < 128; x += 22) g.fillRect(x, 0, 6, 128);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 1);
    return tex;
  }

  function buildB773Airframe(profile, scene){
    const half = profile.geometry[0]; // 36.93
    const radius = profile.geometry[1]; // 3.10
    const span = profile.geometry[2]; // 32.40
    const wingY = profile.geometry[3]; // -0.95
    const gearHeight = profile.gearHeight; // 4.50
    const group = new THREE.Group();
    const gear = new THREE.Group();
    const cabin = new THREE.Group();
    const closeDetails = new THREE.Group();
    const noseDoor = new THREE.Group(), sideDoor = new THREE.Group();
    group.add(gear, closeDetails, noseDoor, sideDoor);

    const stockColor = profile.trimColor ?? 0x146a80;
    const panelBump = typeof AeroCraft !== 'undefined' ? AeroCraft.getPanelBumpTexture(THREE) : null;
    const tireBump = buildB773TireTreadTexture();

    const surface = new THREE.MeshPhysicalMaterial({
      color: 0xf4f7f9, roughness: 0.34, metalness: 0.14, clearcoat: 0.72, clearcoatRoughness: 0.16,
      bumpMap: panelBump, bumpScale: 0.011
    });
    const paint = new THREE.MeshPhysicalMaterial({
      color: stockColor, roughness: 0.30, metalness: 0.22, clearcoat: 0.80, clearcoatRoughness: 0.14,
      bumpMap: panelBump, bumpScale: 0.009
    });
    const metal = new THREE.MeshStandardMaterial({ color: 0xb0bcc5, roughness: 0.24, metalness: 0.84 });
    const hotMetal = new THREE.MeshStandardMaterial({ color: 0x5c6670, roughness: 0.34, metalness: 0.86 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x19232c, roughness: 0.72, metalness: 0.10 });
    const rubber = new THREE.MeshStandardMaterial({ color: 0x161a1f, roughness: 0.93, metalness: 0.02, bumpMap: tireBump, bumpScale: 0.04 });
    const chrome = new THREE.MeshStandardMaterial({ color: 0xd9e3eb, roughness: 0.14, metalness: 0.95 });
    const glazing = new THREE.MeshPhysicalMaterial({
      color: 0x132833, roughness: 0.06, metalness: 0.78, clearcoat: 1.0, clearcoatRoughness: 0.04,
      transparent: true, opacity: 0.84, side: THREE.DoubleSide
    });
    const winGlass = new THREE.MeshPhysicalMaterial({
      color: 0x0f2029, roughness: 0.08, metalness: 0.68, emissive: 0x45697a, emissiveIntensity: 0.06,
      transparent: true, opacity: 0.92, side: THREE.DoubleSide
    });
    const windowFrame = new THREE.MeshStandardMaterial({ color: 0x33414a, roughness: 0.42, metalness: 0.35, side: THREE.DoubleSide });
    const beaconDomeMat = new THREE.MeshPhysicalMaterial({
      color: 0xc81c22, emissive: 0xff2222, emissiveIntensity: 0.35, roughness: 0.15, transparent: true, opacity: 0.86
    });
    const landingGlowMat = new THREE.MeshBasicMaterial({ color: 0xfff8e2 });

    function addMesh(parent, geo, mat, x = 0, y = 0, z = 0){
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      parent.add(m);
      return m;
    }
    function box(parent, mat, w, h, d, x, y, z){
      return addMesh(parent, new THREE.BoxGeometry(w, h, d), mat, x, y, z);
    }

    // 1. Fuselage Loft (circular 6.20m cross-section, droop nose, blade tailcone)
    const fuselageGeo = AeroCraft.buildFuselageLoft(B773_STATIONS, 48);
    const fuselageMesh = addMesh(group, fuselageGeo, surface);
    fuselageMesh.name = 'b773 fuselage loft';

    // Asymmetric offset titanium APU exhaust cone protruding from the pinched 777 blade tailcone
    const apuTail = addMesh(group, new THREE.CylinderGeometry(0.16, 0.23, 1.35, 18), hotMetal, 0.09, 1.08, 36.85);
    apuTail.rotation.x = Math.PI / 2 - 0.04;
    const apuBore = addMesh(group, new THREE.CircleGeometry(0.14, 14), dark, 0.09, 1.11, 37.53);
    apuBore.name = 'b773 apu exhaust';

    // Dark recessed wheel wells in belly & wing root so retracted gear stows into real wells
    box(group, dark, 1.35, 0.55, 2.75, 0, -2.55, -26.8);
    for(const side of [-1, 1]){
      box(group, dark, 2.85, 0.65, 3.30, side * 3.15, -2.15, 2.6);
    }

    // Radome seam + lightning diverter strips + 6-pane Boeing 777 cockpit windshield
    const seamMat = new THREE.LineBasicMaterial({ color: 0x829098, transparent: true, opacity: 0.78 });
    const radomePts = [];
    for(let i = 0; i <= 48; i++) radomePts.push(new THREE.Vector3(...skinPointFromTop(-34.25, i * Math.PI / 24, 0.020)));
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(radomePts), seamMat));

    const cockpitGlassMats = [glazing];
    const windowSlots = [];
    // 5 pairs of Type-A passenger door Z stations (L1..L5, R1..R5), matching Boeing 777-300ER spacing
    const doorZs = [-half * 0.58, -half * 0.34, -half * 0.04, half * 0.34, half * 0.62];
    for(let z = -22.8; z <= 22.4; z += 0.56){
      if(doorZs.every(d => Math.abs(z - d) > 0.88)) windowSlots.push(z);
    }

    const winShape = new THREE.Shape();
    winShape.moveTo(-0.10, -0.15); winShape.lineTo(0.10, -0.15);
    winShape.quadraticCurveTo(0.16, -0.15, 0.16, -0.06); winShape.lineTo(0.16, 0.06);
    winShape.quadraticCurveTo(0.16, 0.15, 0.10, 0.15); winShape.lineTo(-0.10, 0.15);
    winShape.quadraticCurveTo(-0.16, 0.15, -0.16, 0.06); winShape.lineTo(-0.16, -0.06);
    winShape.quadraticCurveTo(-0.16, -0.15, -0.10, -0.15);
    const winGeo = new THREE.ShapeGeometry(winShape, 5);
    const dummy = new THREE.Object3D();

    for(const side of [-1, 1]){
      // 3-pane Boeing 777 wrap-around windshield per side
      const panes = [[0.06, 0.42], [0.46, 0.78], [0.82, 1.10]];
      for(let p = 0; p < panes.length; p++){
        const [a0, a1] = panes[p];
        const zFwd = -33.25 + p * 0.66;
        const zAft = zFwd + 1.18;
        const outline = [
          [zFwd, a0 * side],
          [zAft, (a0 - 0.04) * side],
          [zAft + 0.14, a1 * side],
          [zFwd + 0.24, a1 * side]
        ];
        group.add(makeCurvedPanel(outline, windowFrame, 0.015, 6));
        const cx = outline.reduce((s, q) => s + q[0], 0) / 4;
        const ca = outline.reduce((s, q) => s + q[1], 0) / 4;
        const inner = outline.map(q => [cx + (q[0] - cx) * 0.84, ca + (q[1] - ca) * 0.84]);
        group.add(makeCurvedPanel(inner, glazing, 0.026, 6));
      }

      // Parked Boeing windshield wiper arms
      const wiper = box(closeDetails, dark, 0.032, 0.62, 0.032, side * 0.48, 0.88, -32.42);
      wiper.rotation.set(0.32, 0, -side * 0.56);

      // Flush passenger cabin windows instanced cleanly along constant circular barrel
      const winMesh = new THREE.InstancedMesh(winGeo, winGlass, windowSlots.length);
      for(let i = 0; i < windowSlots.length; i++){
        const wz = windowSlots[i];
        dummy.position.set(...skinPointFromTop(wz, side * 1.41, 0.028));
        dummy.rotation.set(-side * 0.14, side * Math.PI / 2, 0, 'YXZ');
        dummy.updateMatrix();
        winMesh.setMatrixAt(i, dummy.matrix);
      }
      group.add(winMesh);

      // 5 Type-A passenger doors per side (seam outline + recessed latch handle + warning band)
      for(let dIdx = 0; dIdx < doorZs.length; dIdx++){
        const dz = doorZs[dIdx];
        const pts = [];
        const corners = [[-0.48, 1.24], [0.48, 1.24], [0.48, 1.76], [-0.48, 1.76], [-0.48, 1.24]];
        for(let e = 1; e < corners.length; e++){
          for(let k = 0; k < 6; k++){
            const t = k / 6;
            const z = dz + corners[e - 1][0] + (corners[e][0] - corners[e - 1][0]) * t;
            const ang = corners[e - 1][1] + (corners[e][1] - corners[e - 1][1]) * t;
            pts.push(new THREE.Vector3(...skinPointFromTop(z, side * ang, 0.032)));
          }
        }
        pts.push(pts[0].clone());
        group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), seamMat));
        // Flush door handle recess
        const hPos = skinPointFromTop(dz + 0.25, side * 1.48, 0.030);
        addMesh(closeDetails, new THREE.BoxGeometry(0.03, 0.11, 0.18), metal, ...hPos);
      }

      // Nose pitot probes, AOA vanes & TAT probes (closeDetails)
      for(let p = 0; p < 2; p++){
        const pPos = skinPointFromTop(-33.9 + p * 0.75, side * (1.82 + p * 0.18), 0.035);
        addMesh(closeDetails, new THREE.CylinderGeometry(0.012, 0.018, 0.22, 8), chrome, pPos[0] + side * 0.06, pPos[1], pPos[2]).rotation.x = Math.PI / 2;
      }
    }

    // Starboard lower-deck cargo doors (forward & aft cargo holds on +X belly)
    for(const cz of [-14.2, 10.6]){
      const pts = [];
      const c = [[-1.35, 1.98], [1.35, 1.98], [1.35, 2.38], [-1.35, 2.38], [-1.35, 1.98]];
      for(let e = 1; e < c.length; e++){
        for(let k = 0; k < 6; k++){
          const t = k / 6;
          pts.push(new THREE.Vector3(...skinPointFromTop(cz + c[e - 1][0] + (c[e][0] - c[e - 1][0]) * t, c[e - 1][1] + (c[e][1] - c[e - 1][1]) * t, 0.032)));
        }
      }
      pts.push(pts[0].clone());
      group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), seamMat));
    }

    // Dorsal SATCOM hump + VHF blade antennas + red beacon polycarbonate domes
    addMesh(group, AeroCraft.buildCanoeGeometry(3.8, 0.56, 0.34), surface, 0, 3.12, 3.2);
    addMesh(group, AeroCraft.buildAeroPylonGeometry(0.32, 0.38, 0.16, 0.12, 0.14), metal, 0, 3.06, -12.5);
    addMesh(group, AeroCraft.buildAeroPylonGeometry(0.28, 0.34, 0.14, 0.12, 0.12), metal, 0, 3.08, 11.4);
    const ventralAnt = addMesh(group, AeroCraft.buildAeroPylonGeometry(0.26, 0.30, 0.12, 0.12, 0.11), metal, 0, -3.02, 7.2);
    ventralAnt.rotation.x = Math.PI;

    const beaconTop = addMesh(group, new THREE.SphereGeometry(0.16, 16, 12), beaconDomeMat, 0, 3.16, -2.5);
    const beaconBottom = addMesh(group, new THREE.SphereGeometry(0.16, 16, 12), beaconDomeMat, 0, -3.12, 1.0);
    beaconTop.scale.y = beaconBottom.scale.y = 0.65;

    // 2. Supercritical Main Wing, 16-ft Raked Wingtips, Moving Slats, Slotted Flaps, Flaperons, Ailerons & Spoilers
    const surfaces = [], flaps = [], slats = [], airBrakes = [], lamps = [], strobes = [], fans = [], bladeRotors = [];
    const reverserSleeves = [], wheels = [], elevs = [], rudders = [], landingLights = [];

    function wingLeadZ(v){
      if(v < 0.876) return -9.6 + (v / 0.876) * 16.0;
      const rk = (v - 0.876) / 0.124;
      return 6.4 + rk * 5.7;
    }
    function wingChord(v){
      if(v < 0.34){
        const t = v / 0.34;
        return 16.8 * (1 - t) + 10.4 * t;
      }
      if(v < 0.876){
        const t = (v - 0.34) / (0.876 - 0.34);
        return 10.4 * (1 - t) + 4.55 * t;
      }
      const rk = (v - 0.876) / 0.124;
      return 4.55 * (1 - rk) + 1.42 * rk;
    }
    function wingYAt(v){
      return wingY + v * 2.15 + v * v * 0.22;
    }
    function wingXAt(v){
      return 2.65 + v * (span - 2.65);
    }

    for(const side of [-1, 1]){
      // Main wing loft (26 spanwise stations)
      const stations = [];
      for(let i = 0; i <= 26; i++){
        const v = i / 26;
        stations.push({
          x: wingXAt(v),
          leadZ: wingLeadZ(v),
          chord: wingChord(v),
          y: wingYAt(v),
          thick: v < 0.35 ? 0.138 - v * 0.04 : 0.124 - v * 0.045,
          camber: 0.025 - v * 0.011,
          twist: 0.022 - v * 0.052,
          tipCurlY: v > 0.96 ? 0.06 : 0
        });
      }
      const wingMat = surface.clone();
      wingMat.side = THREE.DoubleSide;
      const wMesh = addMesh(group, AeroCraft.buildWingLoft(stations, { slices: 32, capTip: true, mirror: side < 0 }), wingMat);
      wMesh.name = 'b773 ' + (side < 0 ? 'port' : 'starboard') + ' wing';

      // Blended wing-body Karman fairing
      addMesh(group, AeroCraft.buildCanoeGeometry(22.5, 1.38, 0.96), surface, side * 2.55, wingY + 0.06, -1.6);

      // Wing-root landing light cluster (white glass lens + emissive lamp when active)
      const lLight = addMesh(group, new THREE.SphereGeometry(0.16, 12, 8), landingGlowMat, side * 3.85, wingY + 0.04, -8.5);
      landingLights.push(lLight);

      // 4 sculpted underwing flap-track canoe fairings per wing
      for(const v of [0.20, 0.40, 0.60, 0.76]){
        const c = wingChord(v);
        const cz = wingLeadZ(v) + c * 0.72;
        const can = addMesh(group, AeroCraft.buildCanoeGeometry(Math.min(4.8, c * 0.56), 0.19, 0.17), surface, side * wingXAt(v), wingYAt(v) - c * 0.048 - 0.14, cz);
        can.rotation.x = -0.04;
      }

      // Animated Leading-Edge Slats (inboard engine-side & outboard main span)
      for(const [v0, v1] of [[0.32, 0.58], [0.60, 0.85]]){
        const sGrp = new THREE.Group();
        const x0 = wingXAt(v0), x1 = wingXAt(v1);
        const z0 = wingLeadZ(v0), z1 = wingLeadZ(v1);
        const y0 = wingYAt(v0), y1 = wingYAt(v1);
        sGrp.position.set(side * x0, y0, z0);
        sGrp.userData.baseY = y0;
        sGrp.userData.baseZ = z0;
        const slatGeo = AeroCraft.buildWingLoft([
          { x: 0, leadZ: -0.08, chord: wingChord(v0) * 0.16, y: 0, thick: 0.11, camber: 0.03 },
          { x: x1 - x0, leadZ: z1 - z0 - 0.06, chord: wingChord(v1) * 0.16, y: y1 - y0, thick: 0.10, camber: 0.03 }
        ], { slices: 12, capTip: true, mirror: side < 0 });
        sGrp.add(new THREE.Mesh(slatGeo, metal));
        group.add(sGrp);
        slats.push(sGrp);
      }

      // Animated Trailing-Edge Slotted Flaps (inboard + outboard)
      for(const [v0, v1] of [[0.04, 0.25], [0.34, 0.58]]){
        const x0 = wingXAt(v0), x1 = wingXAt(v1), c0 = wingChord(v0), c1 = wingChord(v1);
        const te0 = wingLeadZ(v0) + c0 * 0.83, te1 = wingLeadZ(v1) + c1 * 0.83;
        const y0 = wingYAt(v0) - 0.04, y1 = wingYAt(v1) - 0.04;
        const fGrp = new THREE.Group();
        fGrp.position.set(side * x0, y0, te0);
        const fGeo = AeroCraft.buildWingLoft([
          { x: 0, leadZ: 0, chord: c0 * 0.22, y: 0, thick: 0.10, camber: 0.035 },
          { x: x1 - x0, leadZ: te1 - te0, chord: c1 * 0.22, y: y1 - y0, thick: 0.09, camber: 0.035 }
        ], { slices: 12, capTip: true, mirror: side < 0 });
        fGrp.add(new THREE.Mesh(fGeo, metal));
        group.add(fGrp);
        flaps.push(fGrp);
      }

      // Animated Flaperon + Outboard Aileron (`surfaces`: grouped per wing side for differential roll!)
      const wingRollGroup = new THREE.Group();
      const s0 = 0.62, s1 = 0.84;
      const sx0 = wingXAt(s0), sx1 = wingXAt(s1), sc0 = wingChord(s0), sc1 = wingChord(s1);
      const ste0 = wingLeadZ(s0) + sc0 * 0.84, ste1 = wingLeadZ(s1) + sc1 * 0.84;
      const sy0 = wingYAt(s0), sy1 = wingYAt(s1);
      wingRollGroup.position.set(side * sx0, sy0, ste0);
      const ailGeo = AeroCraft.buildWingLoft([
        { x: 0, leadZ: 0, chord: sc0 * 0.20, y: 0, thick: 0.085, camber: 0.008 },
        { x: sx1 - sx0, leadZ: ste1 - ste0, chord: sc1 * 0.20, y: sy1 - sy0, thick: 0.075, camber: 0.008 }
      ], { slices: 12, capTip: true, mirror: side < 0 });
      wingRollGroup.add(new THREE.Mesh(ailGeo, paint));
      group.add(wingRollGroup);
      surfaces.push(wingRollGroup);

      // 5 Flush Upper-Wing Spoiler / Speedbrake Panels per side (hinged along forward edge matching wing dihedral)
      for(let sp = 0; sp < 5; sp++){
        const vs = 0.16 + sp * 0.125;
        const c = wingChord(vs);
        const wSpan = 2.55;
        const hZ = wingLeadZ(vs) + c * 0.56;
        const hY = wingYAt(vs) + c * 0.042;
        const dih = Math.atan2(wingYAt(Math.min(1, vs + 0.1)) - wingYAt(vs), wingXAt(Math.min(1, vs + 0.1)) - wingXAt(vs));
        const spGrp = new THREE.Group();
        spGrp.position.set(side * wingXAt(vs), hY, hZ);
        spGrp.rotation.z = side * dih;
        const spMesh = box(spGrp, surface, wSpan, 0.022, c * 0.15, 0, -0.008, c * 0.075);
        spMesh.rotation.y = -side * 0.34;
        group.add(spGrp);
        airBrakes.push(spGrp);
      }

      // Proportional Raked Wingtip Nav Light & White Strobe + Static Wicks
      const tipX = side * span, tipY = wingYAt(1.0) + 0.05, tipZ = wingLeadZ(1.0) + wingChord(1.0) * 0.32;
      lamps.push(addMesh(group, new THREE.SphereGeometry(0.11, 12, 8), new THREE.MeshBasicMaterial({ color: side < 0 ? 0xed4f49 : 0x55ffd2 }), tipX, tipY, tipZ));
      strobes.push(addMesh(group, new THREE.SphereGeometry(0.125, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }), tipX, tipY, tipZ + 0.18));
      for(let w = 0; w < 3; w++){
        box(closeDetails, dark, 0.025, 0.015, 0.34, tipX - side * (0.2 + w * 0.45), tipY - 0.02, tipZ + wingChord(1.0) * 0.65);
      }

      // 3. Twin GE90-115B Massive Turbofans + Swept Pylons + Translating Reverse Thrust Cowls
      const nacRadius = profile.nacelleRadius ?? 1.88; // 3.76m diameter
      const engX = side * 10.65;
      const engY = -2.14;
      const engZ = -3.85;
      const nac = AeroCraft.buildTurbofanNacelle(THREE, nacRadius, 1.06, { surface, metal: chrome, dark }, {
        chevron: true,
        pylonHeight: Math.max(0.28, wingYAt(0.27) - engY - nacRadius * 0.70),
        pylonBaseY: nacRadius * 0.70,
        overwing: false
      });
      nac.group.position.set(engX, engY, engZ);
      nac.group.name = 'b773 GE90-115B ' + (side < 0 ? 'L' : 'R');

      // White spiral emblem on spinner cone
      const spiral = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.022, 6, 18, Math.PI * 1.4), new THREE.MeshBasicMaterial({ color: 0xf6fbff }));
      spiral.position.set(0, 0, -nac.length * 1.18 - 0.42);
      nac.fanGroup.add(spiral);

      // Translating Thrust Reverser Sleeve + Exposed Blocker Cascade Ring when `f.reverse`
      const cascadeRing = addMesh(nac.group, new THREE.CylinderGeometry(nacRadius * 0.90, nacRadius * 0.87, 0.72, 28, 1, true), dark, 0, 0, -0.05);
      cascadeRing.rotation.x = Math.PI / 2;
      const revSleeve = new THREE.Group();
      const revPts = [
        [-nac.length * 0.35, nacRadius * 1.02],
        [nac.length * 0.36, nacRadius * 0.91],
        [nac.length * 0.60, nacRadius * 0.81]
      ].map(([z, r]) => new THREE.Vector2(r, z));
      const revGeo = new THREE.LatheGeometry(revPts, 32);
      revGeo.rotateX(Math.PI / 2);
      revSleeve.add(new THREE.Mesh(revGeo, paint));
      nac.group.add(revSleeve);
      reverserSleeves.push(revSleeve);

      group.add(nac.group);
      fans.push(nac.fanGroup);
      bladeRotors.push(0);

      // 4. Horizontal Stabilizer + Articulated Hinged Elevator per side
      const hStabGeo = AeroCraft.buildWingLoft([
        { x: 0.75, leadZ: 24.4, chord: 6.45, y: 1.08, thick: 0.095, camber: 0 },
        { x: 10.8, leadZ: 31.4, chord: 2.35, y: 1.88, thick: 0.075, camber: 0, twist: -0.015 }
      ], { slices: 20, capTip: true, mirror: side < 0 });
      addMesh(group, hStabGeo, wingMat).name = 'b773 h-stab ' + (side < 0 ? 'L' : 'R');

      const elevPivot = new THREE.Group();
      elevPivot.position.set(side * 1.1, 1.12, 29.2);
      elevPivot.rotation.y = -side * 0.28;
      const elevMesh = box(elevPivot, paint, 8.8, 0.14, 1.32, side * 4.4, 0, 0.65);
      elevMesh.name = 'b773 elevator ' + (side < 0 ? 'L' : 'R');
      group.add(elevPivot);
      elevs.push(elevPivot);
    }

    // 5. Tall Boeing 777-300ER Vertical Fin + Hinged Two-Segment Rudder
    const vFinGeo = AeroCraft.buildVerticalFoilLoft([
      { y: 1.55, leadZ: 22.8, chord: 11.4, thick: 0.088 },
      { y: 7.40, leadZ: 27.6, chord: 6.9,  thick: 0.088 },
      { y: 14.00, leadZ: 32.8, chord: 3.15, thick: 0.078 }
    ], { slices: 24, capTip: true });
    addMesh(group, vFinGeo, paint).name = 'b773 vertical fin';

    const rudderHinge = new THREE.Group();
    rudderHinge.position.set(0, 2.2, 32.2);
    rudderHinge.rotation.x = 0.25; // Matches swept vertical fin hinge line
    const rudderFoil = AeroCraft.buildVerticalFoilLoft([
      { y: 0.0, leadZ: 0, chord: 2.25, thick: 0.08 },
      { y: 11.2, leadZ: 0.25, chord: 1.15, thick: 0.07 }
    ], { slices: 14, capTip: true });
    const rudderMesh = new THREE.Mesh(rudderFoil, surface);
    rudderMesh.position.z = 0.05;
    rudderHinge.add(rudderMesh);
    group.add(rudderHinge);
    rudders.push(rudderHinge);

    const tailLight = addMesh(group, new THREE.SphereGeometry(0.11, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }), 0, 4.1, 34.4);
    lamps.push(tailLight);

    // 6. Articulated Boeing 777-300ER Landing Gear (Dual Steerable Nose + 3-Axle 6-Wheel Main Bogies + Wheel Well Doors + Oleo Compression)
    const mainTireR = 0.65, mainTireW = 0.40;
    const shoulderMain = [[0.52,-0.50],[0.80,-0.50],[0.93,-0.44],[0.99,-0.30],[1,-0.16],[1,0.16],[0.99,0.30],[0.93,0.44],[0.80,0.50],[0.52,0.50]]
      .map(([r, y]) => new THREE.Vector2(r * mainTireR, y * mainTireW));
    const mainTireGeo = new THREE.LatheGeometry(shoulderMain, 28);

    const noseTireR = 0.45, noseTireW = 0.29;
    const shoulderNose = shoulderMain.map(p => new THREE.Vector2(p.x * (noseTireR / mainTireR), p.y * (noseTireW / mainTireW)));
    const noseTireGeo = new THREE.LatheGeometry(shoulderNose, 24);

    function makeWheel(geo, r, w){
      const wMesh = new THREE.Mesh(geo, rubber);
      wMesh.userData.radius = r;
      wMesh.rotation.z = Math.PI / 2;
      for(const s of [-1, 1]){
        addMesh(wMesh, new THREE.CylinderGeometry(r * 0.56, r * 0.56, 0.032, 18), metal, 0, s * w * 0.48, 0);
        addMesh(wMesh, new THREE.CylinderGeometry(r * 0.22, r * 0.22, 0.045, 12), dark, 0, s * w * 0.52, 0);
      }
      wheels.push(wMesh);
      return wMesh;
    }

    // Dual Nose Gear (z = -27.2, trunnion at y = -1.65, wheel ground bottom = -4.50)
    const noseTrunnionY = -1.65;
    const noseGearPivot = new THREE.Group();
    noseGearPivot.position.set(0, noseTrunnionY, -27.2);
    const noseSteerPivot = new THREE.Group();
    noseGearPivot.add(noseSteerPivot);

    addMesh(noseSteerPivot, new THREE.CylinderGeometry(0.14, 0.16, 1.70, 14), metal, 0, -0.82, 0);
    const noseOleo = new THREE.Group();
    noseOleo.position.set(0, -1.65, 0);
    addMesh(noseOleo, new THREE.CylinderGeometry(0.11, 0.11, 0.88, 12), chrome, 0, -0.36, 0);
    addMesh(noseOleo, new THREE.CylinderGeometry(0.06, 0.06, 0.72, 10), metal, 0, -0.75, 0).rotation.z = Math.PI / 2;
    for(const ox of [-0.28, 0.28]){
      const nw = makeWheel(noseTireGeo, noseTireR, noseTireW);
      nw.position.set(ox, -0.75, 0);
      noseOleo.add(nw);
    }
    const noseLamp = addMesh(noseSteerPivot, new THREE.SphereGeometry(0.11, 10, 8), landingGlowMat, 0, -1.42, -0.22);
    landingLights.push(noseLamp);
    noseSteerPivot.add(noseOleo);
    gear.add(noseGearPivot);

    const noseDoors = [];
    for(const side of [-1, 1]){
      const d = new THREE.Group();
      d.position.set(side * 0.58, -2.55, -27.2);
      box(d, surface, 0.56, 0.06, 2.55, -side * 0.28, 0, 0);
      gear.add(d);
      noseDoors.push({ pivot: d, side });
    }

    // Twin 3-Axle 6-Wheel Main Gear Bogies (x = +/-5.48, z = +2.6, trunnion at y = -1.42)
    const mainTrunnionY = -1.42;
    const mainStrutLen = Math.abs(-gearHeight + mainTireR - mainTrunnionY); // 2.43m exact so tires rest at -4.50m
    const mainGears = [], mainDoors = [];
    for(const side of [-1, 1]){
      const x = side * 5.48;
      const mPivot = new THREE.Group();
      mPivot.position.set(x, mainTrunnionY, 2.6);

      addMesh(mPivot, new THREE.CylinderGeometry(0.24, 0.27, mainStrutLen * 0.62, 14), metal, 0, -mainStrutLen * 0.30, 0);
      const sideBrace = addMesh(mPivot, new THREE.CylinderGeometry(0.10, 0.11, 1.95, 10), metal, -side * 0.55, -0.82, 0.18);
      sideBrace.rotation.z = -side * 0.52;

      const mOleo = new THREE.Group();
      mOleo.position.set(0, -mainStrutLen * 0.55, 0);
      addMesh(mOleo, new THREE.CylinderGeometry(0.18, 0.18, mainStrutLen * 0.48, 12), chrome, 0, -mainStrutLen * 0.22, 0);

      // 3-axle 6-wheel articulating bogie beam
      const bogiePivot = new THREE.Group();
      bogiePivot.position.set(0, -mainStrutLen * 0.45, 0);
      addMesh(bogiePivot, new THREE.CylinderGeometry(0.15, 0.15, 3.15, 12), metal, 0, 0, 0).rotation.x = Math.PI / 2;
      for(const az of [-1.36, 0, 1.36]){
        addMesh(bogiePivot, new THREE.CylinderGeometry(0.08, 0.08, 0.92, 10), metal, 0, 0, az).rotation.z = Math.PI / 2;
        for(const ox of [-0.46, 0.46]){
          const mw = makeWheel(mainTireGeo, mainTireR, mainTireW);
          mw.position.set(ox, 0, az);
          bogiePivot.add(mw);
        }
      }
      mOleo.add(bogiePivot);
      mPivot.add(mOleo);
      gear.add(mPivot);
      mainGears.push({ pivot: mPivot, oleo: mOleo, bogie: bogiePivot, side });

      // Wing/Belly gear bay door
      const md = new THREE.Group();
      md.position.set(side * 1.95, -2.35, 2.6);
      box(md, surface, 2.25, 0.07, 3.40, side * 1.12, 0, 0);
      gear.add(md);
      mainDoors.push({ pivot: md, side });
    }

    // 7. Boeing 777-300ER 3-4-3 Widebody Cabin Interior + Openable Curved L1 Boarding Door
    const passengerCabin = buildB773Cabin(profile, cabin, group, surface, paint);

    cabin.visible = false;
    scene.add(group, cabin);

    // State-driven continuous animation updater (Flaps, Slats, Spoilers, Elevators, Rudder, GE90 Spool & Reversers, 6-Wheel Gear)
    let smoothFlaps = 0, smoothSlats = 0, smoothSpoilers = 0, smoothRev = 0, smoothSteer = 0, smoothGearProg = 1, smoothOleo = 0;

    function updateGear(gProg, dt, f, paused){
      const dTime = clamp(dt || 0.016, 0.001, 0.12);
      const blend = paused ? 1 : Math.min(1, dTime * 4.5);
      const tgt = f ? (f.gear === false ? 0 : 1) : gProg;
      smoothGearProg += (tgt - smoothGearProg) * blend;
      const p = smoothGearProg;

      // Doors open during 0..0.34, stay open while gear swings, close 0.82..1.0
      const doorOpen = clamp(p < 0.85 ? p / 0.30 : (1 - p) / 0.16, 0, 1);
      // Actually keep doors open when gear DOWN (`p > 0.85` -> 777 main body doors close partially or stay open!)
      const mainDoorAngle = 1.42 * (1 - clamp((p - 0.88) / 0.12, 0, 1) * 0.15) * clamp(p / 0.25, 0, 1);
      for(const nd of noseDoors) nd.pivot.rotation.z = nd.side * (1.42 * clamp(p / 0.28, 0, 1));
      for(const md of mainDoors) md.pivot.rotation.z = -md.side * mainDoorAngle;

      // Struts swing cleanly inward from 0.14..0.86 without scaling/shrinking
      const ext = clamp((p - 0.14) / 0.72, 0, 1);
      noseGearPivot.rotation.x = -(1 - ext) * 1.48;
      for(const mg of mainGears){
        mg.pivot.rotation.z = -mg.side * (1 - ext) * 1.46;
        // 777 semi-levered bogie tilts nose-up in air & levels cleanly on runway weight-on-wheels
        const bogieTilt = f && !f.ground ? 0.19 : (1 - ext) * 0.19;
        mg.bogie.rotation.x += (bogieTilt - mg.bogie.rotation.x) * Math.min(1, dTime * 6);
      }
      // Oleo suspension compression momentarily absorbs vertical sink at touchdown
      const tgtOleo = f && f.ground ? clamp(Math.max(0, -(f.vy || 0)) * 0.035, 0, 0.14) : 0;
      smoothOleo += (tgtOleo - smoothOleo) * Math.min(1, dTime * 10);
      gear.position.y = 0; // Grounded flush on runway/hangar floor (-gearHeight)
      noseOleo.position.y = -1.65 + (1 - ext) * 0.32 + smoothOleo * 0.45;
      for(const mg of mainGears) mg.oleo.position.y = -mainStrutLen * 0.55 + smoothOleo;

      // Nosewheel steering on ground (negative Y rotation turns nose tire rightward +X)
      const steerTarget = f && f.ground ? -clamp((f.manualControls?.rudder ?? 0) * 0.44 + (f.manualControls?.roll ?? 0) * 0.26, -0.45, 0.45) : 0;
      smoothSteer += (steerTarget - smoothSteer) * Math.min(1, dTime * 8);
      noseSteerPivot.rotation.y = smoothSteer;
      gear.visible = p > 0.05;
      void doorOpen;
    }

    function updateAeroSurfaces(f, dt, now, paused){
      const dTime = clamp(dt || 0.016, 0.001, 0.12);
      const blend = paused ? 1 : Math.min(1, dTime * 7);
      const fTarget = f ? clamp((f.flaps || 0) / 2, 0, 1) : 0;
      const sTarget = f ? clamp((f.flaps || 0) > 0 ? 1 : 0, 0, 1) : 0;
      const spTarget = f && (f.spoilers || (f.ground && f.reverse)) ? 1 : 0;
      const rTarget = f && f.reverse && f.ground ? 1 : 0;

      smoothFlaps += (fTarget - smoothFlaps) * Math.min(1, dTime * 3.5);
      smoothSlats += (sTarget - smoothSlats) * Math.min(1, dTime * 3.8);
      smoothSpoilers += (spTarget - smoothSpoilers) * blend;
      smoothRev += (rTarget - smoothRev) * Math.min(1, dTime * 5.0);

      for(const fl of flaps) fl.rotation.x = smoothFlaps * 0.44;
      for(const sl of slats){
        sl.rotation.x = -smoothSlats * 0.24;
        sl.position.y = (sl.userData.baseY ?? 0) - smoothSlats * 0.12;
        sl.position.z = (sl.userData.baseZ ?? 0) - smoothSlats * 0.16;
      }
      for(const sp of airBrakes) sp.rotation.x = -smoothSpoilers * 0.72;
      for(const rv of reverserSleeves) rv.position.z = smoothRev * 0.64;

      const roll = f && !f.tow ? (f.manualControls?.roll ?? 0) : 0;
      const pitch = f && !f.tow ? (f.manualControls?.pitch ?? 0) : 0;
      const rudder = f && !f.tow ? (f.manualControls?.rudder ?? 0) : 0;
      if(surfaces[0]) surfaces[0].rotation.x = smoothFlaps * 0.14 + roll * 0.28;
      if(surfaces[1]) surfaces[1].rotation.x = smoothFlaps * 0.14 - roll * 0.28;
      for(const ev of elevs) ev.rotation.x = -pitch * 0.34;
      for(const rd of rudders) rd.rotation.y = rudder * 0.36;

      // Engine fan inertia: spool up smoothly and coast down gracefully when shut down
      for(let i = 0; i < fans.length; i++){
        const running = f ? Boolean(f.engines?.[i] && f.fuel !== 0) : false;
        const revBoost = f?.reverse ? 0.62 : 0;
        const targetRate = running ? (11 + Math.max(f?.power || 0, revBoost) * 95) : 0;
        bladeRotors[i] += (targetRate - bladeRotors[i]) * Math.min(1, dTime * (running ? 2.4 : 0.75));
        if(!paused) fans[i].rotation.z += bladeRotors[i] * dTime;
      }
      const lightsOn = f ? Boolean(f.battery && f.lights) : true;
      for(const ll of landingLights) ll.visible = lightsOn;
    }

    group.userData = {
      b773HighDef: true,
      profileId: profile.id,
      modelStatus: profile.modelStatus,
      gear,
      articulatedGear: true,
      blades: [], // Handled with spool-down inertia by updateAeroSurfaces
      fans,
      surfaces,
      flaps,
      slats,
      navLights: lamps,
      strobes,
      beacons: [beaconTop, beaconBottom],
      noseDoor,
      sideDoor,
      cargoRamp: null,
      wheels,
      cabin,
      palletMeshes: [],
      passengerCabin,
      closeDetails,
      airBrakes,
      exhaustPlumes: [],
      cockpitGlassMats,
      reverserSleeves,
      elevators: elevs,
      rudders,
      half,
      radius,
      updateGear,
      updateAeroSurfaces,
      setLivery: owned => paint.color.setHex(owned ? 0x1f9991 : stockColor)
    };
    return group;
  }

  function buildB773Cabin(profile, cabin, airframe, exteriorMat, accentMat){
    const half = profile.geometry[0], radius = profile.geometry[1];
    const count = profile.passengers ?? 360;
    const [leftSeats, rightSeats] = profile.seatColumns ?? [3, 3];
    const centerSeats = profile.centerSeats ?? 4;
    const rowSeats = leftSeats + centerSeats + rightSeats;
    const rows = Math.ceil(count / rowSeats);
    const firstZ = -17.4, lastZ = 21.8;
    const gap = Math.min(1.06, (lastZ - firstZ) / Math.max(1, rows - 1));
    const seatW = 0.45;
    const aisleCenters = [-1.06, 1.06]; // Twin widebody aisles!

    const seats = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0x1e4d69, roughness: 0.86 }), count * 2);
    const headrests = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0x8db6cb, roughness: 0.88 }), count);
    const ife = new THREE.InstancedMesh(new THREE.BoxGeometry(0.24, 0.16, 0.02),
      new THREE.MeshStandardMaterial({ color: 0x164c73, emissive: 0x0e3d61, emissiveIntensity: 0.52, roughness: 0.35 }), count);
    const head = new THREE.InstancedMesh(new THREE.SphereGeometry(0.105, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xd9a785, roughness: 0.92 }), count);
    const body = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.142, 0.24, 4, 8),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92 }), count);

    const wallMat = new THREE.MeshStandardMaterial({ color: 0xdfe7eb, side: THREE.DoubleSide, roughness: 0.85 });
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x2f4352, roughness: 0.90 });
    const carpetMat = new THREE.MeshStandardMaterial({ color: 0x183c52, roughness: 0.94 });
    const coveMat = new THREE.MeshStandardMaterial({ color: 0xeaf4fa, emissive: 0x99cfe8, emissiveIntensity: 0.55 });
    const beltMat = new THREE.MeshBasicMaterial({ color: 0x3ef0a5 });

    const cStart = -22.2, cEnd = 22.8, cLen = cEnd - cStart, mid = (cStart + cEnd) / 2;
    function cBox(mat, x, y, z, w, h, d){
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      cabin.add(m);
      return m;
    }

    // Main floor + dual sculpted blue aisle runners + vaulted overhead cove + stowage bins
    cBox(floorMat, 0, -0.74, mid, 5.75, 0.12, cLen);
    for(const ax of aisleCenters) cBox(carpetMat, ax, -0.675, mid, 0.62, 0.015, cLen - 0.6);
    cBox(wallMat, 0, 1.62, mid, 5.40, 0.14, cLen);
    // Center + side overhead luggage bins
    cBox(wallMat, 0, 1.24, mid, 1.56, 0.42, cLen - 1.2);
    for(const side of [-1, 1]){
      cBox(wallMat, side * 2.18, 1.18, mid, 1.04, 0.42, cLen - 1.2);
      cBox(coveMat, side * 1.44, 1.38, mid, 0.14, 0.04, cLen - 1.4);
      cBox(wallMat, side * 2.86, -0.22, mid, 0.09, 1.02, cLen);
      cBox(wallMat, side * 2.86, 1.22, mid, 0.09, 0.52, cLen);
      const winCount = Math.ceil(cLen / 0.95);
      for(let w = 0; w < winCount; w++){
        cBox(wallMat, side * 2.86, 0.62, cStart + (w + 0.5) * (cLen / winCount), 0.09, 0.68, 0.52);
      }
    }
    // Forward galley bulkhead, cockpit doorway lintel & illuminated seatbelt sign
    cBox(wallMat, -1.96, 0.44, -20.6, 1.75, 2.25, 0.14);
    cBox(wallMat, 1.96, 0.44, -20.6, 1.75, 2.25, 0.14);
    cBox(wallMat, 0, 1.40, -20.6, 2.20, 0.36, 0.14);
    const sbSign = cBox(beltMat, 0, 1.32, -20.48, 0.58, 0.09, 0.03);

    // Animated L1 Boarding Plug Door (-half*0.58 = -21.42) swinging smoothly outward & forward cleanly
    const l1Door = new THREE.Group();
    l1Door.position.set(-3.04, -0.72, -half * 0.58 - 0.52);
    const l1Panel = new THREE.Mesh(new THREE.BoxGeometry(0.11, 1.84, 1.02), exteriorMat);
    const l1Band = new THREE.Mesh(new THREE.BoxGeometry(0.125, 0.34, 1.00), accentMat);
    const l1Inner = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.72, 0.94), wallMat);
    l1Panel.position.set(0, 0.92, 0.51);
    l1Band.position.set(0, 0.92, 0.51);
    l1Inner.position.set(0.04, 0.92, 0.51);
    l1Door.add(l1Panel, l1Band, l1Inner);
    l1Door.visible = false;
    airframe.add(l1Door);

    // 3-4-3 Widebody Seat Layout (360 seats)
    const slots = [];
    const mtx = new THREE.Object3D();
    const shirtPalette = [0x477ca9, 0x8d424a, 0x65816b, 0xd3b485, 0x624575, 0x3b6e78];
    for(let i = 0; i < count; i++){
      const row = Math.floor(i / rowSeats);
      const col = i % rowSeats;
      let x;
      if(col < leftSeats){
        x = -2.55 + col * seatW;
      }else if(col < leftSeats + centerSeats){
        x = (col - leftSeats - (centerSeats - 1) / 2) * seatW;
      }else{
        x = 1.62 + (col - leftSeats - centerSeats) * seatW;
      }
      const z = firstZ + row * gap;
      slots.push({ x, z });
      mtx.position.set(x, -0.45, z); mtx.scale.set(seatW * 0.90, 0.17, 0.49); mtx.updateMatrix(); seats.setMatrixAt(i * 2, mtx.matrix);
      mtx.position.set(x, -0.10, z + 0.25); mtx.scale.set(seatW * 0.88, 0.78, 0.12); mtx.updateMatrix(); seats.setMatrixAt(i * 2 + 1, mtx.matrix);
      mtx.position.set(x, 0.24, z + 0.22); mtx.scale.set(seatW * 0.74, 0.18, 0.06); mtx.updateMatrix(); headrests.setMatrixAt(i, mtx.matrix);
      mtx.position.set(x, 0.02, z + 0.315); mtx.scale.set(1, 1, 1); mtx.updateMatrix(); ife.setMatrixAt(i, mtx.matrix);
      body.setColorAt(i, new THREE.Color(shirtPalette[i % shirtPalette.length]));
    }
    head.count = body.count = 0;
    head.frustumCulled = body.frustumCulled = ife.frustumCulled = false;
    cabin.add(seats, headrests, ife, head, body);

    let prevBoarded = -1;
    function update(f, dt){
      const service = f?.service;
      const boarded = service?.boarded ?? 0;
      const tgtDoor = Number(Boolean(service?.door));
      const dAngle = l1Door.rotation.y + (-tgtDoor * 1.48 - l1Door.rotation.y) * Math.min(1, (dt || 0.016) * 4);
      l1Door.rotation.y = dAngle;
      l1Door.position.x = -3.04 - Math.sin(Math.min(1, Math.abs(dAngle))) * 0.24;
      l1Door.visible = Boolean(service?.door) || Math.abs(dAngle) > 0.03;
      coveMat.emissiveIntensity = service?.cabinLights === false ? 0 : 0.55;
      beltMat.color.setHex(service?.seatBelts === false ? 0x263238 : 0x3ef0a5);
      if(prevBoarded === boarded) return;
      prevBoarded = boarded;
      head.count = body.count = boarded;
      mtx.scale.set(1, 1, 1);
      for(let i = 0; i < boarded; i++){
        const s = slots[i];
        mtx.position.set(s.x, 0.30, s.z + 0.10); mtx.updateMatrix(); head.setMatrixAt(i, mtx.matrix);
        mtx.position.set(s.x, -0.05, s.z + 0.11); mtx.updateMatrix(); body.setMatrixAt(i, mtx.matrix);
      }
      head.instanceMatrix.needsUpdate = body.instanceMatrix.needsUpdate = true;
    }
    return { update, door: l1Door };
  }

  // Bespoke 6-LCD Interactive Boeing 777-300ER Flight Deck
  function refineB773FlightDeck(model, profile){
    const data = model.userData, half = data.half, cabin = data.cabin;
    for(const child of [...cabin.children]){
      if(child.type === 'Group' && Math.abs(child.position.z - (-half * 0.56 - 0.63)) < 0.2) child.visible = false;
    }

    // Flight deck sits accurately behind the nose windshield at z = -30.2 .. -29.0, floor y = 0.22
    const deckY = 0.72, deckZ = -29.95;
    data.cockpitEye = { x: -0.52, y: deckY + 0.80, z: deckZ + 0.62 };
    data.cockpitPanelEye = { x: -0.18, y: deckY + 0.68, z: deckZ + 0.86 };

    const slate = new THREE.MeshStandardMaterial({ color: 0x2d3840, roughness: 0.62, metalness: 0.22 });
    const darkBrownSlate = new THREE.MeshStandardMaterial({ color: 0x242a2e, roughness: 0.68, metalness: 0.18 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x9aa9b4, roughness: 0.30, metalness: 0.76 });
    const sheepskin = new THREE.MeshStandardMaterial({ color: 0x525d63, roughness: 0.92 });
    const floodMat = new THREE.MeshStandardMaterial({
      color: 0x252d34, emissive: 0xffb366, emissiveIntensity: 0, roughness: 0.55
    });

    function b(parent, mat, w, h, d, x, y, z){
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      parent.add(m);
      return m;
    }

    // Deck floor, lower main instrument pedestal, side consoles & contoured low glareshield
    b(cabin, slate, 3.60, 0.10, 2.50, 0, deckY - 0.50, deckZ - 0.20);
    b(cabin, darkBrownSlate, 3.45, 1.02, 0.42, 0, deckY + 0.02, deckZ - 1.54);
    const glare = b(cabin, darkBrownSlate, 3.48, 0.085, 0.46, 0, deckY + 0.44, deckZ - 1.28);
    glare.rotation.x = 0.06;
    b(cabin, slate, 0.58, 0.46, 1.92, 0, deckY - 0.42, deckZ + 0.04); // Center Pedestal

    // Open unobstructed windshield framing pillars around Boeing 777 brow
    b(cabin, darkBrownSlate, 3.36, 0.08, 0.22, 0, deckY + 1.44, deckZ - 1.15);
    const centerPost = b(cabin, darkBrownSlate, 0.048, 1.02, 0.055, 0, deckY + 0.94, deckZ - 1.22);
    centerPost.rotation.x = -0.22;
    for(const side of [-1, 1]){
      b(cabin, slate, 0.18, 0.54, 1.75, side * 1.66, deckY - 0.18, deckZ - 0.45);
      const aPillar = b(cabin, darkBrownSlate, 0.06, 1.04, 0.08, side * 1.54, deckY + 0.94, deckZ - 1.20);
      aPillar.rotation.x = -0.22; aPillar.rotation.z = side * 0.12;
      // Crew Seats
      const back = b(cabin, sheepskin, 0.58, 0.78, 0.15, side * 0.58, deckY + 0.04, deckZ + 1.08);
      back.rotation.x = -0.10;
      b(cabin, sheepskin, 0.62, 0.14, 0.66, side * 0.58, deckY - 0.34, deckZ + 0.78);
    }

    // Boeing 777 Overhead Panel housing + Glareshield under-edge warm amber Flood Strip
    const overhead = b(cabin, floodMat, 1.85, 0.06, 0.92, 0, deckY + 1.68, deckZ - 0.44);
    overhead.rotation.x = 0.12;
    const glareFlood = new THREE.MeshBasicMaterial({ color: 0xffa654, transparent: true, opacity: 0 });
    b(cabin, glareFlood, 3.34, 0.028, 0.04, 0, deckY + 0.41, deckZ - 1.08);
    const deckFloodLight = typeof THREE.PointLight === 'function' ? new THREE.PointLight(0xff9f45, 0, 4.6) : null;
    if(deckFloodLight){
      deckFloodLight.position.set(0, deckY + 1.25, deckZ - 0.45);
      cabin.add(deckFloodLight);
    }

    // 6-LCD Boeing 777 Main Instrument Panel Canvas (2048x576) + MCP Strip
    const mipCanvas = document.createElement('canvas');
    mipCanvas.width = 2048; mipCanvas.height = 576;
    const ctx = mipCanvas.getContext('2d');
    const mipTex = new THREE.CanvasTexture(mipCanvas);
    mipTex.colorSpace = THREE.SRGBColorSpace;
    const mipScreen = new THREE.Mesh(
      new THREE.PlaneGeometry(3.26, 0.88),
      new THREE.MeshBasicMaterial({ map: mipTex })
    );
    mipScreen.position.set(0, deckY + 0.02, deckZ - 1.30);
    mipScreen.rotation.x = -0.09;
    cabin.add(mipScreen);

    // MCP (Mode Control Panel) strip inset along front glareshield face
    const mcpCanvas = document.createElement('canvas');
    mcpCanvas.width = 1024; mcpCanvas.height = 128;
    const mctx = mcpCanvas.getContext('2d');
    const mcpTex = new THREE.CanvasTexture(mcpCanvas);
    mcpTex.colorSpace = THREE.SRGBColorSpace;
    const mcpScreen = new THREE.Mesh(new THREE.PlaneGeometry(1.75, 0.18), new THREE.MeshBasicMaterial({ map: mcpTex }));
    mcpScreen.position.set(0, deckY + 0.41, deckZ - 1.03);
    mcpScreen.rotation.x = -0.35;
    cabin.add(mcpScreen);

    // Pedestal FMC/CDU display canvas
    const cduCanvas = document.createElement('canvas');
    cduCanvas.width = 512; cduCanvas.height = 384;
    const cctx = cduCanvas.getContext('2d');
    const cduTex = new THREE.CanvasTexture(cduCanvas);
    cduTex.colorSpace = THREE.SRGBColorSpace;
    const cduMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.30), new THREE.MeshBasicMaterial({ map: cduTex }));
    cduMesh.position.set(0, deckY - 0.16, deckZ - 0.34);
    cduMesh.rotation.x = -Math.PI / 2 + 0.25;
    cabin.add(cduMesh);

    // Control Yokes + Gear Lever + Dual Thrust & Reverser Levers + Flap Lever + Speedbrake
    const yokePivots = [], throttleLevers = [], switches = [];
    for(const side of [-1, 1]){
      const yp = new THREE.Group();
      yp.position.set(side * 0.58, deckY - 0.32, deckZ - 0.62);
      const col = b(yp, slate, 0.065, 0.44, 0.07, 0, 0.22, 0); col.rotation.x = -0.14;
      const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.025, 10, 32, Math.PI * 1.24), slate);
      wheel.position.set(0, 0.42, -0.02); wheel.rotation.z = Math.PI * 0.88; yp.add(wheel);
      b(yp, metalMat, 0.13, 0.075, 0.04, 0, 0.41, 0);
      cabin.add(yp);
      yokePivots.push({ pivot: yp, wheel });
    }

    // 3D Landing Gear Lever to right of EICAS
    const gearLever = new THREE.Group();
    gearLever.position.set(0.46, deckY + 0.16, deckZ - 1.24);
    b(gearLever, metalMat, 0.024, 0.16, 0.024, 0, -0.06, 0.04);
    gearLever.add(addMeshLocal(new THREE.CylinderGeometry(0.032, 0.032, 0.03, 14),
      new THREE.MeshStandardMaterial({ color: 0xeaf2f7 }), 0, -0.13, 0.05));
    cabin.add(gearLever);

    function addMeshLocal(g, m, x, y, z){ const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.rotation.z = Math.PI / 2; return o; }

    // Center Pedestal Thrust Quadrant (2 levers + Flap Lever + Speedbrake)
    for(let i = 0; i < 2; i++){
      const lp = new THREE.Group();
      lp.position.set(-0.065 + i * 0.13, deckY - 0.18, deckZ + 0.08);
      b(lp, metalMat, 0.028, 0.19, 0.034, 0, 0.09, 0);
      b(lp, darkBrownSlate, 0.068, 0.05, 0.065, 0, 0.19, -0.01);
      cabin.add(lp);
      throttleLevers.push(lp);
    }
    const flapLever = new THREE.Group();
    flapLever.position.set(0.18, deckY - 0.18, deckZ + 0.10);
    b(flapLever, metalMat, 0.022, 0.16, 0.022, 0, 0.08, 0);
    b(flapLever, new THREE.MeshStandardMaterial({ color: 0xf4f7f9 }), 0.055, 0.024, 0.05, 0, 0.16, 0);
    cabin.add(flapLever);

    const speedbrakeLever = new THREE.Group();
    speedbrakeLever.position.set(-0.18, deckY - 0.18, deckZ + 0.10);
    b(speedbrakeLever, metalMat, 0.022, 0.16, 0.022, 0, 0.08, 0);
    cabin.add(speedbrakeLever);

    // Clickable invisible raycast hitboxes + sleek recessed pedestal/MCP/overhead interactive buttons
    const hitboxMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
    const swSpecs = [
      ['電瓶', -0.52, deckY + 1.49, deckZ - 0.56],
      ['引擎 1', -0.22, deckY + 1.49, deckZ - 0.56],
      ['引擎 2', 0.08, deckY + 1.49, deckZ - 0.56],
      ['燈光', 0.42, deckY + 1.49, deckZ - 0.56],
      ['起落架', 0.46, deckY + 0.10, deckZ - 1.22],
      ['襟翼', 0.18, deckY - 0.08, deckZ + 0.10],
      ['擾流板', -0.18, deckY - 0.08, deckZ + 0.10],
      ['停機煞車', -0.18, deckY - 0.16, deckZ + 0.42],
      ['反推', 0.0, deckY - 0.04, deckZ + 0.04],
      ['航向／高度保持', 0.56, deckY + 0.41, deckZ - 1.00]
    ];
    for(const [action, sx, sy, sz] of swSpecs){
      const sw = b(cabin, hitboxMat, 0.16, 0.12, 0.16, sx, sy, sz);
      sw.userData.action = action;
      switches.push(sw);
    }

    let backlightLevel = 0.78, lastDraw = -999;
    function setBacklight(val){
      backlightLevel = clamp(Number(val) || 0.78, 0.25, 1.0);
      lastDraw = -1;
    }

    function update(f, now, day){
      if(now - lastDraw < 90) return;
      lastDraw = now;
      const isNight = (day ?? 1) < 0.38;
      const dim = isNight ? (0.45 + 0.55 * backlightLevel) : 1.0;
      floodMat.emissiveIntensity = isNight ? backlightLevel * 0.72 : 0;
      glareFlood.opacity = isNight ? backlightLevel * 0.85 : 0;
      if(deckFloodLight) deckFloodLight.intensity = isNight ? backlightLevel * 2.2 : 0;

      const elec = typeof cockpitElectrical !== 'undefined' ? cockpitElectrical.state : null;
      const batOn = !f ? true : Boolean(f.battery && (!elec || elec.battery));
      const fullAvionics = !f ? true : (batOn && (f.engines?.some(Boolean) || !elec || elec.avionics || elec.apu));

      ctx.fillStyle = '#0d1317';
      ctx.fillRect(0, 0, 2048, 576);

      const speeds = f && typeof flightSpeeds === 'function' ? flightSpeeds(f) : { ias: 0, tas: 0, gs: 0, mach: 0 };
      const iasKt = Math.round((speeds.ias || 0) * (typeof knotsPerMps !== 'undefined' ? knotsPerMps : 1.94384));
      const gsKt = Math.round((speeds.gs || 0) * (typeof knotsPerMps !== 'undefined' ? knotsPerMps : 1.94384));
      const altFt = Math.round((f?.y || 0) * 3.28084);
      const vsFpm = Math.round((f?.vs || 0) * 196.85);
      const hdgDeg = Math.round((((f?.heading || 0) * 180 / Math.PI) % 360 + 360) % 360);
      const bank = f?.bank || 0, pitch = f?.pitch || 0;

      // 6 Boeing 777 LCD panes: [Capt PFD, Capt ND, Upper EICAS, Lower MFD, FO ND, FO PFD]
      const panes = [22, 358, 694, 1030, 1366, 1702];
      const pw = 322, ph = 510;
      for(let idx = 0; idx < 6; idx++){
        const px = panes[idx], py = 32;
        const paneOn = (idx === 2) ? batOn : fullAvionics;
        ctx.fillStyle = paneOn ? '#061118' : '#020507';
        ctx.fillRect(px, py, pw, ph);
        ctx.strokeStyle = '#364b56'; ctx.lineWidth = 3;
        ctx.strokeRect(px, py, pw, ph);
        if(!paneOn) continue;

        ctx.save();
        ctx.globalAlpha = dim;
        if(idx === 0 || idx === 5){
          // Boeing 777 PFD
          ctx.fillStyle = '#12222d'; ctx.fillRect(px + 10, py + 8, pw - 20, 32);
          ctx.fillStyle = '#57f29c'; ctx.font = 'bold 17px monospace'; ctx.textAlign = 'left';
          const apMode = f?.hold?.nav ? 'LNAV' : f?.hold ? 'HDG SEL' : 'FD';
          const altMode = f?.approach ? 'G/S' : f?.hold?.climb ? 'FLCH SPD' : f?.hold ? 'ALT' : 'TO/GA';
          ctx.fillText((f?.engines?.some(Boolean) ? 'SPD' : 'IDLE') + ' | ' + apMode + ' | ' + altMode, px + 16, py + 30);

          // Attitude Indicator Sphere + Pitch Ladder
          ctx.save();
          ctx.beginPath(); ctx.rect(px + 68, py + 76, 186, 260); ctx.clip();
          ctx.translate(px + 161, py + 206);
          ctx.rotate(-bank);
          ctx.translate(0, pitch * 260);
          ctx.fillStyle = '#1d72ab'; ctx.fillRect(-240, -340, 480, 340);
          ctx.fillStyle = '#73532d'; ctx.fillRect(-240, 0, 480, 340);
          ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.moveTo(-220, 0); ctx.lineTo(220, 0); ctx.stroke();
          ctx.lineWidth = 1.6;
          for(const d of [-20, -10, 10, 20]){
            const dy = -d * (Math.PI / 180) * 260;
            ctx.beginPath(); ctx.moveTo(-40, dy); ctx.lineTo(40, dy); ctx.stroke();
          }
          ctx.restore();
          ctx.strokeStyle = '#ffd24d'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(px + 146, py + 206); ctx.lineTo(px + 176, py + 206); ctx.stroke();

          // Airspeed & Altitude side tapes
          ctx.fillStyle = '#1b2b36';
          ctx.fillRect(px + 8, py + 76, 54, 260);
          ctx.fillRect(px + pw - 68, py + 76, 60, 260);
          ctx.fillStyle = '#e8f7ff'; ctx.font = 'bold 20px monospace';
          ctx.fillText(String(iasKt), px + 14, py + 212);
          ctx.fillText(String(altFt), px + pw - 64, py + 212);
          ctx.fillStyle = '#6fe6ff'; ctx.font = '15px monospace';
          ctx.fillText('M ' + (speeds.mach || 0).toFixed(2), px + 12, py + 364);
          ctx.fillText('V/S ' + (vsFpm >= 0 ? '+' : '') + vsFpm, px + 120, py + 364);
          ctx.fillText('HDG ' + String(hdgDeg).padStart(3, '0') + '°', px + 110, py + 412);
        }else if(idx === 1 || idx === 4){
          // Boeing 777 Navigation Display (ND)
          const cx = px + 161, cy = py + 288;
          ctx.fillStyle = '#6fe6ff'; ctx.font = 'bold 16px monospace'; ctx.textAlign = 'left';
          ctx.fillText('GS ' + gsKt + ' KT   TRK ' + String(hdgDeg).padStart(3, '0') + '°', px + 14, py + 28);
          const nextWp = f?.route?.[f.waypoint || 0];
          const wpDist = nextWp && f ? (Math.hypot(nextWp.x - f.x, nextWp.z - f.z) / 1852).toFixed(1) : '0.0';
          ctx.fillStyle = '#ff6ef2';
          ctx.fillText((nextWp?.name || profile.id.toUpperCase()) + '  ' + wpDist + ' NM', px + 14, py + 52);

          ctx.strokeStyle = '#3d6d7d'; ctx.lineWidth = 1.5;
          for(const r of [60, 120, 180]){
            ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
          }
          // Live route leg polyline
          if(f?.route?.length){
            ctx.strokeStyle = '#e56eff'; ctx.lineWidth = 2.4; ctx.beginPath();
            ctx.moveTo(cx, cy);
            const hSin = Math.sin(f.heading || 0), hCos = -Math.cos(f.heading || 0);
            for(let w = f.waypoint || 0; w < f.route.length; w++){
              const dx = f.route[w].x - f.x, dz = f.route[w].z - f.z;
              const rx = (dx * (-hCos) - dz * hSin) / 450;
              const ry = -(dx * hSin + dz * hCos) / 450;
              ctx.lineTo(clamp(cx + rx, px + 12, px + pw - 12), clamp(cy + ry, py + 70, py + ph - 20));
            }
            ctx.stroke();
          }
          ctx.fillStyle = '#ffffff';
          ctx.beginPath(); ctx.moveTo(cx, cy - 12); ctx.lineTo(cx - 8, cy + 8); ctx.lineTo(cx + 8, cy + 8); ctx.closePath(); ctx.fill();
        }else if(idx === 2){
          // Boeing 777 Upper EICAS (Twin GE90 N1 arcs + EGT + Flap/Gear + Alert Stack)
          ctx.fillStyle = '#7cd7ff'; ctx.font = 'bold 17px monospace'; ctx.textAlign = 'left';
          ctx.fillText('GE90-115B  EICAS', px + 14, py + 28);
          for(let e = 0; e < 2; e++){
            const running = f ? Boolean(f.engines?.[e] && f.fuel !== 0) : false;
            const n1 = running ? Math.round(24 + (f?.power || 0) * 79) : 0;
            const gx = px + 88 + e * 146, gy = py + 115;
            ctx.strokeStyle = '#385766'; ctx.lineWidth = 6;
            ctx.beginPath(); ctx.arc(gx, gy, 44, Math.PI * 0.75, Math.PI * 2.15); ctx.stroke();
            ctx.strokeStyle = running ? '#5ef59b' : '#7a5244';
            ctx.beginPath(); ctx.arc(gx, gy, 44, Math.PI * 0.75, Math.PI * 0.75 + (n1 / 110) * Math.PI * 1.4); ctx.stroke();
            ctx.fillStyle = '#eef8ff'; ctx.font = 'bold 21px monospace'; ctx.textAlign = 'center';
            ctx.fillText(n1 + '%', gx, gy + 8);
            ctx.font = '14px monospace'; ctx.fillStyle = '#9fc5d6';
            ctx.fillText('N1 #' + (e + 1), gx, gy + 64);
          }
          ctx.textAlign = 'left'; ctx.font = 'bold 16px monospace';
          ctx.fillStyle = '#eef8ff';
          ctx.fillText('FOB ' + Math.round(f?.fuel || 0).toLocaleString() + ' KG', px + 16, py + 220);
          ctx.fillText('FF  ' + ((f?.fuelFlow || 0).toFixed(2)) + ' KG/S', px + 16, py + 246);
          ctx.fillStyle = f?.gear === false ? '#6fe6ff' : '#57f29c';
          ctx.fillText('GEAR  ' + (f?.gear === false ? 'UP' : 'DOWN'), px + 16, py + 284);
          ctx.fillText('FLAPS ' + ((f?.flaps || 0) === 0 ? 'UP' : f.flaps === 1 ? '5 / 15' : '30'), px + 16, py + 312);

          // Live EICAS Caution & Memo messages
          const alerts = [];
          if(f?.parkingBrake) alerts.push(['PARKING BRAKE', '#ffcf5c']);
          if(f?.service?.door) alerts.push(['DOOR ENTRY L1', '#ffcf5c']);
          if(f?.reverse) alerts.push(['REV THRUST', '#5ef59b']);
          if(f?.spoilers) alerts.push(['SPEEDBRAKES', '#ffcf5c']);
          if(f && f.fuel < 4000) alerts.push(['LOW FUEL', '#ff6464']);
          alerts.slice(0, 4).forEach(([msg, col], ai) => {
            ctx.fillStyle = col;
            ctx.fillText('> ' + msg, px + 16, py + 365 + ai * 26);
          });
        }else{
          // Lower EICAS MFD Synoptic (ELEC / HYD / DOORS / GEAR)
          ctx.fillStyle = '#7cd7ff'; ctx.font = 'bold 17px monospace'; ctx.textAlign = 'left';
          ctx.fillText('SYNOPTIC · ELEC / DOORS', px + 14, py + 28);
          ctx.font = '16px monospace'; ctx.fillStyle = '#5ef59b';
          ctx.fillText('DC BUS  ' + (elec ? elec.busVoltage.toFixed(1) : '28.2') + ' V', px + 16, py + 76);
          ctx.fillText('GEN 1 ' + (f?.engines?.[0] ? 'ON' : 'OFF') + '   GEN 2 ' + (f?.engines?.[1] ? 'ON' : 'OFF'), px + 16, py + 106);
          ctx.fillStyle = f?.service?.door ? '#ffd15c' : '#5ef59b';
          ctx.fillText('L1 PAX DOOR: ' + (f?.service?.door ? 'OPEN' : 'CLOSED'), px + 16, py + 146);
          ctx.fillText('CABIN: ' + (f?.service?.boarded ?? 0) + ' / ' + (profile.passengers ?? 360), px + 16, py + 178);
          // 3 Green gear position boxes
          const gCol = f?.gear === false ? '#687982' : '#49e38d';
          for(const [gx, lbl] of [[161, 'N'], [96, 'L'], [226, 'R']]){
            ctx.strokeStyle = gCol; ctx.lineWidth = 3; ctx.strokeRect(px + gx - 24, py + 250, 48, 34);
            ctx.fillStyle = gCol; ctx.textAlign = 'center'; ctx.fillText(f?.gear === false ? 'UP' : 'DN', px + gx, py + 273);
          }
          ctx.textAlign = 'left'; ctx.fillStyle = '#a4c8d8';
          ctx.fillText(isNight ? ('BACKLIGHT ' + Math.round(backlightLevel * 100) + '%') : 'DAYLIGHT AUTO', px + 16, py + 455);
        }
        ctx.restore();
      }
      mipTex.needsUpdate = true;

      // Update MCP readout windows
      mctx.fillStyle = '#182128'; mctx.fillRect(0, 0, 1024, 128);
      mctx.fillStyle = fullAvionics ? '#ffb84d' : '#2a2a2a';
      mctx.font = 'bold 34px monospace';
      mctx.fillText('IAS ' + String(iasKt).padStart(3, '0'), 60, 74);
      mctx.fillText('HDG ' + String(hdgDeg).padStart(3, '0'), 310, 74);
      mctx.fillText('ALT ' + String(Math.round((f?.hold?.altitude ?? f?.y ?? 0) * 3.28084)).padStart(5, '0'), 560, 74);
      mctx.fillStyle = (f?.hold && fullAvionics) ? '#4dff88' : '#55656e';
      mctx.fillText(f?.hold ? 'A/P ON' : 'A/P FD', 840, 74);
      mcpTex.needsUpdate = true;

      // Update Pedestal FMC/CDU
      cctx.fillStyle = '#071015'; cctx.fillRect(0, 0, 512, 384);
      if(batOn){
        cctx.fillStyle = '#6fe6ff'; cctx.font = 'bold 24px monospace';
        cctx.fillText('FMC · B777-300ER', 22, 42);
        cctx.fillStyle = '#5ef59b'; cctx.font = '20px monospace';
        cctx.fillText('RTE: ' + (f?.departure?.code || 'RCTP') + ' -> ' + (f?.destination?.code || 'RCKH'), 22, 92);
        cctx.fillText('V1 139   VR 149   V2 157', 22, 140);
        cctx.fillText('FOB: ' + Math.round(f?.fuel || 0) + ' KG', 22, 188);
        cctx.fillText('GW:  ' + Math.round((profile.mass + (f?.fuel || 0))).toLocaleString() + ' KG', 22, 236);
        cctx.fillText(f?.bridge ? 'JETWAY CONNECTED' : 'FREE / LINE OPS', 22, 294);
      }
      cduTex.needsUpdate = true;
    }

    function animateControls(f, dt){
      if(!f) return;
      const roll = f.manualControls?.roll ?? 0, pitch = f.manualControls?.pitch ?? 0;
      const pwr = clamp(f.power ?? 0, 0, 1);
      const lerp = Math.min(1, (dt || 0.016) * 14);
      for(const y of yokePivots){
        y.pivot.rotation.x += (pitch * 0.18 - 0.10 - y.pivot.rotation.x) * lerp;
        y.wheel.rotation.z += (Math.PI * 0.88 - roll * 0.62 - y.wheel.rotation.z) * lerp;
      }
      const thrRot = 0.24 - pwr * 0.78 + (f.reverse ? 0.28 : 0);
      for(const lv of throttleLevers) lv.rotation.x += (thrRot - lv.rotation.x) * lerp;
      flapLever.rotation.x += (((f.flaps || 0) * 0.34 - 0.18) - flapLever.rotation.x) * lerp;
      speedbrakeLever.rotation.x += (((f.spoilers ? 0.42 : -0.18)) - speedbrakeLever.rotation.x) * lerp;
      gearLever.rotation.x += ((f.gear === false ? -0.36 : 0.28) - gearLever.rotation.x) * lerp;
    }

    data.setB773Backlight = setBacklight;
    return { update, animateControls, switches, setBacklight };
  }

  globalScope.buildB773Airframe = buildB773Airframe;
  globalScope.refineB773FlightDeck = refineB773FlightDeck;
})(typeof window !== 'undefined' ? window : globalThis);
