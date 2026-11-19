'use strict';
// Parametric NACA Cambered 3D Airfoil Lofting & Aerodynamic Fuselage/Nacelle Builder (v0.62)
(function (globalScope) {
  function nacaSection(profilePoints, camber, camberPos, thick) {
    const pts = [];
    const n = profilePoints;
    const m = camber || 0;
    const p = camberPos || 0.4;
    // Traverse upper surface TE (1) -> LE (0) -> lower surface TE (1)
    for (let i = 0; i <= n; i++) {
      const theta = (i / n) * Math.PI * 2;
      // Cosine clustering concentrates vertices at rounded leading edge & trailing edge
      const beta = theta <= Math.PI ? theta : Math.PI * 2 - theta;
      const xc = 0.5 * (1 + Math.cos(beta)); // starts 1.0 at i=0 (TE), 0.0 at LE (pi), 1.0 at i=n (TE)
      const isUpper = theta <= Math.PI;
      const sq = Math.sqrt(Math.max(0, xc));
      const yt = 5 * thick * (0.2969 * sq - 0.1260 * xc - 0.3516 * xc * xc + 0.2843 * xc * xc * xc - 0.1036 * xc * xc * xc * xc);
      let yc = 0, dyc = 0;
      if (m > 1e-5) {
        if (xc < p) {
          yc = (m / (p * p)) * (2 * p * xc - xc * xc);
          dyc = (2 * m / (p * p)) * (p - xc);
        } else {
          const omp = 1 - p;
          yc = (m / (omp * omp)) * ((1 - 2 * p) + 2 * p * xc - xc * xc);
          dyc = (2 * m / (omp * omp)) * (p - xc);
        }
      }
      const ang = Math.atan(dyc);
      const xOff = isUpper ? xc - yt * Math.sin(ang) : xc + yt * Math.sin(ang);
      const yOff = isUpper ? yc + yt * Math.cos(ang) : yc - yt * Math.cos(ang);
      pts.push([xOff, yOff]);
    }
    return pts;
  }

  function buildWingLoft(stations, options = {}) {
    const slices = options.slices ?? 38;
    const capTip = options.capTip !== false;
    const mirror = Boolean(options.mirror);
    const positions = [];
    const uvs = [];
    const indices = [];
    const ringCount = slices + 1;

    const allStations = [...stations];
    if (capTip && allStations.length >= 2) {
      const last = allStations[allStations.length - 1];
      const prev = allStations[allStations.length - 2];
      const dx = (last.x - prev.x);
      const tipSpan = Math.max(0.06, Math.abs(dx) * 0.14) * Math.sign(dx || (mirror ? -1 : 1));
      allStations.push({
        x: last.x + tipSpan,
        leadZ: last.leadZ + last.chord * 0.42,
        chord: last.chord * 0.24,
        y: last.y + (last.tipCurlY ?? 0.03),
        thick: last.thick * 0.5,
        camber: last.camber * 0.3,
        twist: last.twist || 0,
        dihedralTwist: last.dihedralTwist || 0
      });
    }

    for (let s = 0; s < allStations.length; s++) {
      const st = allStations[s];
      const prof = nacaSection(slices, st.camber ?? 0.022, 0.38, st.thick ?? 0.11);
      const tw = st.twist || 0;
      const cosT = Math.cos(tw), sinT = Math.sin(tw);
      const pivZ = st.leadZ + st.chord * 0.25;
      const u = s / Math.max(1, allStations.length - 1);
      for (let j = 0; j < ringCount; j++) {
        const [xc, yc] = prof[j];
        const pz = st.leadZ + xc * st.chord - pivZ;
        const py = yc * st.chord;
        const rz = pivZ + pz * cosT - py * sinT;
        const ry = st.y + pz * sinT + py * cosT;
        positions.push(mirror ? -st.x : st.x, ry, rz);
        uvs.push(u, j / slices);
      }
    }

    const totalRings = allStations.length;
    for (let s = 0; s < totalRings - 1; s++) {
      for (let j = 0; j < slices; j++) {
        const a = s * ringCount + j;
        const b = a + ringCount;
        if (mirror) {
          indices.push(a, a + 1, b, a + 1, b + 1, b);
        } else {
          indices.push(a, b, a + 1, a + 1, b, b + 1);
        }
      }
    }

    if (capTip) {
      const last = allStations[allStations.length - 1];
      const tipCenterIdx = positions.length / 3;
      const cx = (mirror ? -last.x : last.x) + (mirror ? -0.02 : 0.02);
      positions.push(cx, last.y, last.leadZ + last.chord * 0.45);
      uvs.push(1, 0.5);
      const base = (totalRings - 1) * ringCount;
      for (let j = 0; j < slices; j++) {
        if (mirror) indices.push(base + j, base + j + 1, tipCenterIdx);
        else indices.push(base + j, tipCenterIdx, base + j + 1);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }

  // Vertical or slanted airfoil fin loft (span runs along +y, lateral tilt along +/-x, chord along +z)
  function buildVerticalFoilLoft(stations, options = {}) {
    const slices = options.slices ?? 30;
    const capTip = options.capTip !== false;
    const positions = [];
    const uvs = [];
    const indices = [];
    const ringCount = slices + 1;

    for (let s = 0; s < stations.length; s++) {
      const st = stations[s];
      const prof = nacaSection(slices, st.camber ?? 0, 0.35, st.thick ?? 0.095);
      const u = s / Math.max(1, stations.length - 1);
      for (let j = 0; j < ringCount; j++) {
        const [xc, xcThick] = prof[j];
        const px = (st.x || 0) + xcThick * st.chord;
        const pz = st.leadZ + xc * st.chord;
        positions.push(px, st.y, pz);
        uvs.push(u, j / slices);
      }
    }

    for (let s = 0; s < stations.length - 1; s++) {
      for (let j = 0; j < slices; j++) {
        const a = s * ringCount + j;
        const b = a + ringCount;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }

    if (capTip) {
      const last = stations[stations.length - 1];
      const tipIdx = positions.length / 3;
      positions.push(last.x || 0, last.y + 0.03, last.leadZ + last.chord * 0.48);
      uvs.push(1, 0.5);
      const base = (stations.length - 1) * ringCount;
      for (let j = 0; j < slices; j++) {
        indices.push(base + j, base + j + 1, tipIdx);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }

  // Multi-station contoured non-axisymmetric fuselage loft (super-ellipse top/bottom profiles)
  function buildFuselageLoft(sections, radial = 36) {
    const positions = [];
    const uvs = [];
    const indices = [];
    const ringCount = radial + 1;
    const zMin = sections[0].z;
    const zMax = sections[sections.length - 1].z;
    const zSpan = Math.max(0.1, zMax - zMin);

    for (let s = 0; s < sections.length; s++) {
      const sec = sections[s];
      const rx = Math.max(0.008, sec.rx);
      const ryTop = Math.max(0.008, sec.ryTop ?? sec.ry ?? rx);
      const ryBot = Math.max(0.008, sec.ryBot ?? sec.ry ?? rx);
      const yc = sec.y || 0;
      const pTop = sec.pTop ?? sec.power ?? 2.0;
      const pBot = sec.pBot ?? sec.power ?? 2.0;
      const uCoord = (sec.z - zMin) / zSpan;

      for (let j = 0; j < ringCount; j++) {
        const a = (j / radial) * Math.PI * 2;
        const ca = Math.cos(a), sa = Math.sin(a);
        const ry = sa >= 0 ? ryTop : ryBot;
        const pow = sa >= 0 ? pTop : pBot;
        const exp = 2 / pow;
        const x = Math.sign(ca) * Math.pow(Math.abs(ca), exp) * rx;
        const y = yc + Math.sign(sa) * Math.pow(Math.abs(sa), exp) * ry;
        positions.push(x, y, sec.z);
        uvs.push(uCoord, j / radial);
      }
    }

    for (let s = 0; s < sections.length - 1; s++) {
      for (let j = 0; j < radial; j++) {
        const a = s * ringCount + j;
        const b = a + ringCount;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    // Both ends of each UV ring share a surface normal at the texture join.
    const normals = geo.getAttribute('normal');
    const joined = new THREE.Vector3(), other = new THREE.Vector3();
    for (let ring = 0; ring < sections.length; ring++) {
      const first = ring * ringCount, last = first + radial;
      joined.fromBufferAttribute(normals, first);
      other.fromBufferAttribute(normals, last);
      joined.add(other).normalize();
      normals.setXYZ(first, joined.x, joined.y, joined.z);
      normals.setXYZ(last, joined.x, joined.y, joined.z);
    }
    return geo;
  }

  // Sculpted teardrop / bubble canopy
  function buildCanopyGeometry(length, width, height, slices = 16, radial = 22, options = {}) {
    const sections = [];
    const streamlined = Boolean(options.streamlined);
    for (let i = 0; i <= slices; i++) {
      const t = i / slices; // 0 nose -> 1 tail
      const z = (t - 0.5) * length;
      // Asymmetric laminar teardrop curve: gentle windscreen rake forward, streamlined aft spine fairing
      const env = streamlined
        ? Math.sin(Math.pow(t, 0.78) * Math.PI) * (t < 0.35 ? (0.72 + 0.28 * (t / 0.35)) : 1.0)
        : Math.sin(Math.pow(t, 0.72) * Math.PI);
      const ryScale = streamlined ? Math.pow(Math.max(0.03, env), 0.95) : Math.max(0.03, Math.pow(env, 0.85));
      sections.push({
        z,
        rx: width * 0.5 * Math.max(0.03, env),
        ryTop: height * ryScale,
        ryBot: height * (streamlined ? 0.05 : 0.14) * Math.max(0.02, env),
        y: 0,
        pTop: streamlined ? 2.25 : 2.15,
        pBot: 2.6
      });
    }
    return buildFuselageLoft(sections, radial);
  }

  // Streamlined flap-track canoe fairing pod
  function buildCanoeGeometry(length, rx, ry) {
    const sections = [
      { z: -length * 0.42, rx: rx * 0.18, ryTop: ry * 0.18, ryBot: ry * 0.18, y: 0 },
      { z: -length * 0.30, rx: rx * 0.82, ryTop: ry * 0.80, ryBot: ry * 0.82, y: 0 },
      { z: -length * 0.08, rx: rx, ryTop: ry, ryBot: ry, y: 0 },
      { z: length * 0.25, rx: rx * 0.78, ryTop: ry * 0.72, ryBot: ry * 0.78, y: -ry * 0.08 },
      { z: length * 0.58, rx: rx * 0.32, ryTop: ry * 0.28, ryBot: ry * 0.32, y: -ry * 0.18 },
      { z: length * 0.74, rx: rx * 0.05, ryTop: ry * 0.05, ryBot: ry * 0.05, y: -ry * 0.22 }
    ];
    return buildFuselageLoft(sections, 16);
  }

  // Streamlined wheel pant / aerodynamic fairing
  function buildWheelPantGeometry(size, width) {
    const L = size * 3.1;
    const W = Math.max(width * 0.85, size * 0.58);
    const H = size * 1.15;
    return buildFuselageLoft([
      { z: -L * 0.50, rx: W * 0.08, ryTop: H * 0.08, ryBot: H * 0.08, y: 0 },
      { z: -L * 0.34, rx: W * 0.78, ryTop: H * 0.78, ryBot: H * 0.55, y: 0.04 * H },
      { z: -L * 0.05, rx: W, ryTop: H * 0.96, ryBot: H * 0.62, y: 0.05 * H },
      { z: L * 0.32, rx: W * 0.72, ryTop: H * 0.65, ryBot: H * 0.46, y: 0.04 * H },
      { z: L * 0.62, rx: W * 0.16, ryTop: H * 0.20, ryBot: H * 0.16, y: 0.03 * H }
    ], 18);
  }

  // Contoured swept NACA pylon joining underwing engine nacelle
  function buildAeroPylonGeometry(height, rootChord, tipChord, thick, sweepZ) {
    return buildVerticalFoilLoft([
      { y: 0, leadZ: -rootChord * 0.48, chord: rootChord, thick: thick ?? 0.14 },
      { y: height * 0.5, leadZ: -rootChord * 0.48 + sweepZ * 0.45, chord: rootChord * 0.88 + tipChord * 0.12, thick: (thick ?? 0.14) * 0.92 },
      { y: height, leadZ: -rootChord * 0.48 + sweepZ, chord: tipChord, thick: (thick ?? 0.14) * 0.85 }
    ], { slices: 20, capTip: false });
  }

  // Contoured laminar high-bypass turbofan nacelle with chevron nozzle & pitched NACA fan blades
  function buildTurbofanNacelle(THREE, size, lengthScale, mats, options = {}) {
    const group = new THREE.Group();
    const { surface, metal, dark } = mats;
    const L = size * 2.55 * (lengthScale || 1);
    const mesh = (g, m, x = 0, y = 0, z = 0) => {
      const o = new THREE.Mesh(g, m);
      o.position.set(x, y, z);
      group.add(o);
      return o;
    };

    // Contoured outer fan cowl + rounded inner laminar inlet lip (Lathe rotated around Z)
    const cowlPts = [
      [-L * 1.15, size * 0.77], // inside throat
      [-L * 1.32, size * 0.81],
      [-L * 1.46, size * 0.89], // inner lip highlight
      [-L * 1.50, size * 0.95], // LE stagnation ring
      [-L * 1.44, size * 1.00], // outer lip crest
      [-L * 1.15, size * 1.04], // max diameter barrel
      [-L * 0.35, size * 1.01], // thrust reverser split
      [L * 0.35, size * 0.90],  // aft fan cowl taper
      [L * 0.62, size * 0.80]
    ].map(([z, r]) => new THREE.Vector2(r, z));
    const cowlGeo = new THREE.LatheGeometry(cowlPts, 44);
    cowlGeo.rotateX(Math.PI / 2);
    mesh(cowlGeo, surface);

    // Metallic anti-ice inlet lip collar
    const lipPts = [
      [-L * 1.35, size * 0.825],
      [-L * 1.47, size * 0.89],
      [-L * 1.505, size * 0.95],
      [-L * 1.44, size * 1.005],
      [-L * 1.28, size * 1.032]
    ].map(([z, r]) => new THREE.Vector2(r, z));
    const lipGeo = new THREE.LatheGeometry(lipPts, 44);
    lipGeo.rotateX(Math.PI / 2);
    mesh(lipGeo, metal);

    // Core hot cowl & chevron nozzle shroud
    const corePts = [
      [L * 0.42, size * 0.72],
      [L * 0.68, size * 0.68],
      [L * 0.94, size * 0.54],
      [L * 1.06, size * 0.45]
    ].map(([z, r]) => new THREE.Vector2(r, z));
    const coreGeo = new THREE.LatheGeometry(corePts, 36);
    coreGeo.rotateX(Math.PI / 2);
    mesh(coreGeo, metal);

    // Thrust-reverser translating cowl seam band
    const revSeam = mesh(new THREE.TorusGeometry(size * 0.995, Math.max(0.008, size * 0.012), 8, 36), dark, 0, 0, -L * 0.35);
    revSeam.scale.z = 0.5;

    // Serrated acoustic chevron teeth around fan & core exit if modern turbofan
    if (options.chevron !== false) {
      const chevCount = 12;
      const chevGeo = new THREE.ConeGeometry(size * 0.14, size * 0.28, 3);
      chevGeo.rotateX(Math.PI / 2);
      const chevs = new THREE.InstancedMesh(chevGeo, surface, chevCount);
      const dummy = new THREE.Object3D();
      for (let i = 0; i < chevCount; i++) {
        const a = (i / chevCount) * Math.PI * 2;
        dummy.position.set(Math.cos(a) * size * 0.78, Math.sin(a) * size * 0.78, L * 0.66);
        dummy.rotation.set(0, 0, a);
        dummy.lookAt(Math.cos(a) * size * 0.62, Math.sin(a) * size * 0.62, L * 0.88);
        dummy.updateMatrix();
        chevs.setMatrixAt(i, dummy.matrix);
      }
      group.add(chevs);
    }

    // Center exhaust plug cone & dark acoustic barrel backplate
    const plug = mesh(new THREE.ConeGeometry(size * 0.27, size * 0.92, 24), metal, 0, 0, L * 1.10);
    plug.rotation.x = Math.PI / 2;
    const intakeBack = mesh(new THREE.CircleGeometry(size * 0.82, 28), dark, 0, 0, -L * 1.12);
    intakeBack.rotation.y = Math.PI;
    mesh(new THREE.CircleGeometry(size * 0.44, 24), dark, 0, 0, L * 1.04);

    // Rotating NACA wide-chord twisted fan stage + elliptical spinner cone
    const fanGroup = new THREE.Group();
    fanGroup.position.set(0, 0, -L * 1.18);
    const spinPts = [
      [0, -size * 0.42],
      [size * 0.10, -size * 0.25],
      [size * 0.19, -size * 0.04],
      [size * 0.22, size * 0.12]
    ].map(([r, z]) => new THREE.Vector2(r, z));
    const spinGeo = new THREE.LatheGeometry(spinPts, 24);
    spinGeo.rotateX(Math.PI / 2);
    fanGroup.add(new THREE.Mesh(spinGeo, dark));

    // Twisted swept wide-chord fan blade loft
    const bladeStations = [
      { x: size * 0.19, leadZ: -size * 0.09, chord: size * 0.17, y: 0, thick: 0.10, camber: 0.04, twist: 0.65 },
      { x: size * 0.50, leadZ: -size * 0.11, chord: size * 0.21, y: 0, thick: 0.07, camber: 0.03, twist: 0.42 },
      { x: size * 0.80, leadZ: -size * 0.08, chord: size * 0.19, y: 0, thick: 0.04, camber: 0.02, twist: 0.24 }
    ];
    const bladeGeo = buildWingLoft(bladeStations, { slices: 14, capTip: false });
    const bladeCount = 24;
    const fanBlades = new THREE.InstancedMesh(bladeGeo, metal, bladeCount);
    const bd = new THREE.Object3D();
    for (let i = 0; i < bladeCount; i++) {
      bd.position.set(0, 0, 0);
      bd.rotation.set(0, 0, (i / bladeCount) * Math.PI * 2);
      bd.updateMatrix();
      fanBlades.setMatrixAt(i, bd.matrix);
    }
    fanGroup.add(fanBlades);
    const spiralTip = new THREE.Mesh(new THREE.ConeGeometry(size * 0.065, size * 0.16, 12), surface);
    spiralTip.rotation.x = -Math.PI / 2;
    spiralTip.position.set(0, 0, -size * 0.36);
    fanGroup.add(spiralTip);
    group.add(fanGroup);

    // Swept NACA aerodynamic pylon connecting nacelle cleanly into wing interior (never poking through upper skin)
    const pylonH = Math.max(0.02, options.pylonHeight ?? size * 0.52);
    const pylonY = options.overwing ? -(size * 0.78 + pylonH) : (options.pylonBaseY ?? size * 0.72);
    const pylon = mesh(buildAeroPylonGeometry(pylonH, size * 1.75, size * 2.05, 0.13, size * 0.55), surface, 0, pylonY, size * 0.05);
    if (options.pylonPitch) pylon.rotation.x = options.pylonPitch;

    return { group, fanGroup, length: L };
  }

  // Contoured blended swept winglet / scimitar wingtip loft
  function buildBlendedWinglet(chordRoot, height, sweep, cantRad, mirror = false) {
    const c1 = Math.max(0.18, chordRoot * 0.92);
    const c2 = Math.max(0.12, chordRoot * 0.62);
    const c3 = Math.max(0.08, chordRoot * 0.34);
    const sgn = mirror ? -1 : 1;
    const x1 = sgn * Math.sin(cantRad) * height * 0.45;
    const x2 = sgn * Math.sin(cantRad) * height;
    return buildWingLoft([
      { x: 0, leadZ: 0, chord: c1, y: 0, thick: 0.09, camber: 0.012, twist: 0 },
      { x: x1 * 0.55, leadZ: sweep * 0.32, chord: c1 * 0.78 + c2 * 0.22, y: height * 0.36, thick: 0.085, camber: 0.010, twist: -0.02 },
      { x: x2 * 0.85, leadZ: sweep * 0.72, chord: c2, y: height * 0.76, thick: 0.08, camber: 0.008, twist: -0.04 },
      { x: x2, leadZ: sweep, chord: c3, y: height, thick: 0.07, camber: 0.004, twist: -0.05 }
    ], { slices: 18, capTip: true, mirror: false });
  }

  // Twisted NACA-4412 propeller / helicopter airfoil blade (span along +Y or +X)
  function buildTwistedBlade(length, rootChord, tipChord, washoutRad = 0.36) {
    return buildWingLoft([
      { x: length * 0.05, leadZ: -rootChord * 0.45, chord: rootChord * 0.55, y: 0, thick: 0.18, camber: 0.02, twist: washoutRad },
      { x: length * 0.28, leadZ: -rootChord * 0.52, chord: rootChord, y: 0, thick: 0.12, camber: 0.035, twist: washoutRad * 0.72 },
      { x: length * 0.72, leadZ: -rootChord * 0.42, chord: rootChord * 0.82, y: 0, thick: 0.09, camber: 0.025, twist: washoutRad * 0.25 },
      { x: length, leadZ: -tipChord * 0.40, chord: tipChord, y: 0, thick: 0.075, camber: 0.015, twist: 0 }
    ], { slices: 16, capTip: true, mirror: false });
  }

  // Aerodynamic missile body (AIM-9/AIM-120 style) with ogive nosecone & delta fins
  function buildAeroMissile(length, radius, bodyMat, finMat, exhaustMat) {
    const g = new THREE.Group();
    const nosePts = [
      [0, -length * 0.52],
      [radius * 0.45, -length * 0.44],
      [radius * 0.85, -length * 0.34],
      [radius, -length * 0.22],
      [radius, length * 0.42],
      [radius * 0.82, length * 0.50]
    ].map(([r, z]) => new THREE.Vector2(r, z));
    const bodyGeo = new THREE.LatheGeometry(nosePts, 14);
    bodyGeo.rotateX(Math.PI / 2);
    g.add(new THREE.Mesh(bodyGeo, bodyMat));
    if (exhaustMat) {
      const noz = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.78, 12), exhaustMat);
      noz.position.z = length * 0.505;
      g.add(noz);
    }
    const finGeo = buildVerticalFoilLoft([
      { y: radius * 0.7, leadZ: length * 0.16, chord: length * 0.24, thick: 0.07 },
      { y: radius * 3.1, leadZ: length * 0.28, chord: length * 0.09, thick: 0.06 }
    ], { slices: 10, capTip: true });
    for (let k = 0; k < 4; k++) {
      const f = new THREE.Mesh(finGeo, finMat);
      f.rotation.z = k * Math.PI / 2 + Math.PI / 4;
      g.add(f);
    }
    return g;
  }

  let _panelBump = null;
  function getPanelBumpTexture(THREE) {
    if (_panelBump || !THREE || typeof document === 'undefined') return _panelBump;
    const c = document.createElement('canvas');
    c.width = 512; c.height = 512;
    const g = c.getContext('2d');
    g.fillStyle = '#808080';
    g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 1800; i++) {
      g.fillStyle = (i & 1) ? '#848484' : '#7c7c7c';
      g.fillRect((i * 173) % 512, (i * 97) % 512, 2, 2);
    }
    // Crisp aerospace aluminum skin lap seams
    g.strokeStyle = '#525252';
    g.lineWidth = 1.4;
    for (let p = 0; p < 512; p += 64) {
      g.beginPath(); g.moveTo(0, p + 0.5); g.lineTo(512, p + 0.5); g.stroke();
      g.beginPath(); g.moveTo(p + 0.5, 0); g.lineTo(p + 0.5, 512); g.stroke();
    }
    g.strokeStyle = '#686868';
    g.lineWidth = 0.9;
    for (let p = 32; p < 512; p += 64) {
      g.beginPath(); g.moveTo(0, p + 0.5); g.lineTo(512, p + 0.5); g.stroke();
    }
    // Double micro-rivet rows along seams
    g.fillStyle = '#a8a8a8';
    for (let x = 5; x < 512; x += 10) {
      for (let y = 0; y < 512; y += 64) {
        g.fillRect(x, y + 3, 1.6, 1.6);
        g.fillRect(x, (y + 60) % 512, 1.6, 1.6);
        g.fillRect(y + 3, x, 1.6, 1.6);
      }
    }
    _panelBump = new THREE.CanvasTexture(c);
    _panelBump.wrapS = _panelBump.wrapT = THREE.RepeatWrapping;
    _panelBump.repeat.set(6, 4);
    return _panelBump;
  }

  // Add realistic aerospace hardware details (pitot tubes, AOA vanes, APU exhaust, static wicks, SATCOM)
  function addAirframeExternalDetails(THREE, group, profile, mats) {
    if (!THREE || !group || !profile || !profile.geometry) return;
    const [half, radius, span, wingY, , sweep] = profile.geometry;
    const { surface, metal, dark } = mats;
    const details = new THREE.Group();
    details.name = (profile.id || 'aircraft') + ' aero external details';
    const minSafeY = -(profile.gearHeight || 1.2) + 0.22;

    // 1. Tailcone titanium APU exhaust shroud & orifice (for jets & airliners/cargo)
    const isJetOrLarge = profile.jet || profile.role === 'passenger' || profile.role === 'cargo';
    if (isJetOrLarge && !profile.rearEngines && profile.role !== 'fighter') {
      const apuR = Math.max(0.035, Math.min(0.18, radius * 0.085));
      const apuLen = Math.max(0.14, Math.min(0.65, half * 0.03));
      const apuY = profile.role ? 0 : radius * 0.16;
      const apuZ = half * 0.985;
      const shroud = new THREE.Mesh(new THREE.CylinderGeometry(apuR * 0.82, apuR, apuLen, 18), metal);
      shroud.rotation.x = Math.PI / 2;
      shroud.position.set(0, Math.max(minSafeY, apuY), apuZ);
      details.add(shroud);
      const hole = new THREE.Mesh(new THREE.CircleGeometry(apuR * 0.72, 16), dark);
      hole.position.set(0, Math.max(minSafeY, apuY), apuZ + apuLen * 0.51);
      details.add(hole);
    }

    // 2. Forward nose pitot-static L-probes & AOA sensor vanes
    const pitotScale = Math.max(0.35, Math.min(1.15, radius / 1.4));
    const noseZ = -half * 0.78;
    const noseY = Math.max(minSafeY, -radius * 0.08);
    for (const side of [-1, 1]) {
      const px = side * radius * 0.74;
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.035 * pitotScale, 0.018 * pitotScale, 0.09 * pitotScale), metal);
      base.position.set(px, noseY, noseZ);
      details.add(base);
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.006 * pitotScale, 0.009 * pitotScale, 0.18 * pitotScale, 8), metal);
      tube.rotation.x = Math.PI / 2;
      tube.position.set(px + side * 0.018 * pitotScale, noseY, noseZ - 0.07 * pitotScale);
      details.add(tube);
    }

    // 3. Wingtip trailing-edge static discharge wicks
    const tipZ = -half * 0.30 + (sweep || 0) + Math.max(0.4, half * 0.18);
    const tipY = Math.max(minSafeY, (wingY || 0) + (profile.dihedral ?? 0.25) * 0.75);
    const wickLen = Math.max(0.12, Math.min(0.36, span * 0.016));
    const wickGeo = new THREE.CylinderGeometry(0.003, 0.005, wickLen, 6);
    wickGeo.rotateX(Math.PI / 2);
    for (const side of [-1, 1]) {
      for (let w = 0; w < 3; w++) {
        const frac = 0.86 + w * 0.055;
        const wick = new THREE.Mesh(wickGeo, dark);
        wick.position.set(side * span * frac, tipY, tipZ * frac + wickLen * 0.5);
        details.add(wick);
      }
    }

    // 4. Secondary Ku-band Wi-Fi dorsal dome for airliners & business jets
    if ((profile.role === 'passenger' || profile.jet) && surface) {
      const dome = new THREE.Mesh(buildCanoeGeometry(Math.min(1.6, half * 0.10), Math.min(0.32, radius * 0.15), Math.min(0.11, radius * 0.055)), surface);
      dome.position.set(0, radius * (profile.role ? 1.15 : 0.91), -half * 0.22);
      details.add(dome);
    }

    group.add(details);
    return details;
  }

  let _propBlurTex = null;
  function getPropBlurTexture(THREE) {
    if (_propBlurTex || !THREE || typeof document === 'undefined') return _propBlurTex;
    const c = document.createElement('canvas');
    c.width = 256; c.height = 256;
    const g = c.getContext('2d');
    const rg = g.createRadialGradient(128, 128, 12, 128, 128, 126);
    rg.addColorStop(0.0, 'rgba(220, 228, 236, 0.05)');
    rg.addColorStop(0.45, 'rgba(180, 195, 210, 0.24)');
    rg.addColorStop(0.86, 'rgba(215, 225, 235, 0.34)');
    rg.addColorStop(0.95, 'rgba(255, 228, 110, 0.42)');
    rg.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
    g.fillStyle = rg;
    g.fillRect(0, 0, 256, 256);
    // Radial sweep streaks for motion blur illusion
    for (let i = 0; i < 6; i++) {
      g.save();
      g.translate(128, 128);
      g.rotate((i / 6) * Math.PI * 2);
      const sg = g.createLinearGradient(0, -12, 124, 12);
      sg.addColorStop(0, 'rgba(255,255,255,0)');
      sg.addColorStop(0.5, 'rgba(240,248,255,0.22)');
      sg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = sg;
      g.beginPath();
      g.moveTo(10, 0);
      g.arc(0, 0, 122, -0.18, 0.18);
      g.closePath();
      g.fill();
      g.restore();
    }
    _propBlurTex = new THREE.CanvasTexture(c);
    _propBlurTex.colorSpace = THREE.SRGBColorSpace;
    return _propBlurTex;
  }

  // Photorealistic Convergent-Divergent Titanium "Turkey Feather" Fighter Exhaust Nozzle (F404 / F110 / F119 style)
  function buildTurkeyFeatherNozzle(THREE, radius, length = 0.86, mats = {}) {
    const g = new THREE.Group();
    g.name = 'turkey feather exhaust nozzle';
    const titaniumMat = mats.titanium || new THREE.MeshStandardMaterial({
      color: 0x8b7b65, roughness: 0.28, metalness: 0.86
    });
    const petalMat = mats.petal || new THREE.MeshStandardMaterial({
      color: 0x3b3835, roughness: 0.34, metalness: 0.84
    });
    const sootMat = mats.soot || new THREE.MeshStandardMaterial({
      color: 0x111316, roughness: 0.92, metalness: 0.15, side: THREE.BackSide
    });
    const flameholderMat = mats.flameholder || new THREE.MeshStandardMaterial({
      color: 0x4a3b2e, emissive: 0xff6218, emissiveIntensity: 0.32, roughness: 0.52, metalness: 0.72
    });

    // 1. Brushed bronze-titanium forward shroud collar
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(radius * 1.03, radius * 1.06, length * 0.34, 24), titaniumMat);
    collar.rotation.x = Math.PI / 2;
    collar.position.z = -length * 0.30;
    g.add(collar);

    // 2. 16 Articulated Convergent-Divergent Turkey-Feather Petals
    const petalCount = 16;
    const petalW = (Math.PI * 2 * radius * 0.96) / petalCount * 0.86;
    const petalLen = length * 0.74;
    const petalGeo = new THREE.BoxGeometry(petalW, radius * 0.095, petalLen);
    const petals = new THREE.InstancedMesh(petalGeo, petalMat, petalCount);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < petalCount; i++) {
      const a = (i / petalCount) * Math.PI * 2;
      const rMid = radius * 0.91;
      dummy.position.set(Math.cos(a) * rMid, Math.sin(a) * rMid, length * 0.14);
      dummy.rotation.set(0, 0, a - Math.PI / 2);
      dummy.rotateX(0.14); // Convergent taper toward exit lip
      dummy.updateMatrix();
      petals.setMatrixAt(i, dummy.matrix);
    }
    g.add(petals);

    // 3. Recessed Deep Carbon-Soot Inner Exhaust Duct + Exit Rim Lip
    const liner = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.78, radius * 0.90, length * 0.94, 22, 1, true), sootMat);
    liner.rotation.x = Math.PI / 2;
    liner.position.z = length * 0.02;
    g.add(liner);

    const lip = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.79, radius * 0.045, 8, 24), titaniumMat);
    lip.position.z = length * 0.49;
    g.add(lip);

    // 4. Recessed Turbine Flameholder Ring & Center Cone
    const backplate = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.86, 20), new THREE.MeshStandardMaterial({ color: 0x0b0d10, roughness: 0.95 }));
    backplate.position.z = -length * 0.38;
    g.add(backplate);

    const fhRing = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.48, radius * 0.055, 8, 20), flameholderMat);
    fhRing.position.z = -length * 0.30;
    g.add(fhRing);

    const coreCone = new THREE.Mesh(new THREE.ConeGeometry(radius * 0.24, length * 0.34, 14), flameholderMat);
    coreCone.rotation.x = Math.PI / 2;
    coreCone.position.z = -length * 0.22;
    g.add(coreCone);

    return { group: g, flameholderMat };
  }

  globalScope.AeroCraft = {
    nacaSection,
    buildWingLoft,
    buildVerticalFoilLoft,
    buildFuselageLoft,
    buildCanopyGeometry,
    buildCanoeGeometry,
    buildWheelPantGeometry,
    buildAeroPylonGeometry,
    buildTurbofanNacelle,
    buildTurkeyFeatherNozzle,
    buildBlendedWinglet,
    buildTwistedBlade,
    buildAeroMissile,
    getPanelBumpTexture,
    getPropBlurTexture,
    addAirframeExternalDetails
  };
})(typeof window !== 'undefined' ? window : globalThis);
