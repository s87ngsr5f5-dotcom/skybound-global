'use strict';

/**
 * SKYBOUND GLOBAL - Next-Gen Visual Effects & Transonic Shockwave System (v0.42)
 * Prandtl-Glauert condensation vapor cone, afterburner Mach shock diamonds,
 * and high-fidelity PBR environment reflection mappings.
 */
(function(root) {
  function createTransonicVFX(THREE, scene) {
    if (!THREE || !scene) return { update: () => {} };

    const vfxGroup = new THREE.Group();
    vfxGroup.name = 'Transonic Shock & Afterburner VFX';
    scene.add(vfxGroup);

    // 1. Prandtl-Glauert Vapor Cone (Condensation Frustum)
    // Cone geometry along Z axis
    const coneGeo = new THREE.CylinderGeometry(0.2, 4.2, 3.8, 32, 1, true);
    coneGeo.rotateX(Math.PI / 2);
    const coneMat = new THREE.MeshBasicMaterial({
      color: 0xeef6ff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const vaporCone = new THREE.Mesh(coneGeo, coneMat);
    vaporCone.visible = false;
    vfxGroup.add(vaporCone);

    // Shockwave expansion ring
    const ringGeo = new THREE.RingGeometry(1.5, 3.2, 36);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xcde8ff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const shockRing = new THREE.Mesh(ringGeo, ringMat);
    shockRing.visible = false;
    vfxGroup.add(shockRing);

    // 2. Afterburner Mach Shock Diamonds (Series of luminous diamond disks)
    const diamondCount = 5;
    const diamondGeo = new THREE.OctahedronGeometry(0.35, 0);
    diamondGeo.scale(1, 1, 1.8);
    const diamondMat = new THREE.MeshBasicMaterial({
      color: 0x99ccff,
      transparent: true,
      opacity: 0,
      depthWrite: false
    });
    const machDiamonds = [];
    for (let i = 0; i < diamondCount; i++) {
      const m = new THREE.Mesh(diamondGeo, diamondMat.clone());
      m.visible = false;
      vfxGroup.add(m);
      machDiamonds.push(m);
    }

    // 3. Live 3D Wingtip & LEX Aerodynamic Condensation Vapor Ribbons (high-G turns & humid low passes)
    const vortexTrails = [];
    const VORTEX_LEN = 36;
    if (THREE.BufferGeometry && THREE.BufferAttribute && THREE.Line && THREE.LineBasicMaterial) {
      for (let side of [-1, 1]) {
        const arr = new Float32Array(VORTEX_LEN * 3);
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
        const mat = new THREE.LineBasicMaterial({ color: 0xf4f9ff, transparent: true, opacity: 0, depthWrite: false });
        const line = new THREE.Line(geo, mat);
        line.frustumCulled = false;
        line.visible = false;
        vfxGroup.add(line);
        vortexTrails.push({ side, line, arr, geo, mat, active: false });
      }
    }

    function calculateTransonicIntensity(mach) {
      if (!mach || mach < 0.90 || mach > 1.15) return 0;
      // Peak at Mach 0.99 ~ 1.01
      return Math.max(0, 1 - Math.abs(mach - 1.0) / 0.10);
    }

    function calculateAfterburnerIntensity(power, boost) {
      if (!boost || power <= 0.88) return 0;
      return Math.min(1, (power - 0.88) / 0.12);
    }

    function update(f, dt, speeds) {
      if (!f || f.ground || !speeds) {
        vaporCone.visible = false;
        shockRing.visible = false;
        machDiamonds.forEach(m => (m.visible = false));
        vortexTrails.forEach(vt => { vt.line.visible = false; vt.active = false; });
        return;
      }

      const mach = speeds.mach || 0;
      const tIntensity = 0; // Condensation cone and expansion ring intentionally disabled for visibility.
      const isFighter = f.aircraft?.role === 'fighter';
      const wingSpan = f.aircraft?.geometry ? f.aircraft.geometry[2] * 2 : 14;
      const fuseLen = f.aircraft?.geometry ? f.aircraft.geometry[0] * 2 : 15;

      const rot = new THREE.Euler(f.pitch, -f.heading, f.bank, 'YXZ');
      const quat = new THREE.Quaternion().setFromEuler(rot);

      // --- Transonic Vapor Cone Update ---
      if (tIntensity > 0.05) {
        vaporCone.visible = true;
        shockRing.visible = true;

        const coneScale = (wingSpan / 12) * (0.85 + tIntensity * 0.35);
        vaporCone.scale.set(coneScale, coneScale, coneScale);
        vaporCone.material.opacity = tIntensity * 0.72;

        // Position slightly behind wing mid-chord
        const coneOffset = new THREE.Vector3(0, 0, fuseLen * 0.15).applyQuaternion(quat);
        vaporCone.position.set(f.x + coneOffset.x, f.y + coneOffset.y, f.z + coneOffset.z);
        vaporCone.quaternion.copy(quat);

        // Shock ring expanding backwards
        const ringScale = (wingSpan / 10) * (1.0 + tIntensity * 0.6);
        shockRing.scale.set(ringScale, ringScale, ringScale);
        shockRing.material.opacity = tIntensity * 0.45;
        const ringOffset = new THREE.Vector3(0, 0, fuseLen * 0.35).applyQuaternion(quat);
        shockRing.position.set(f.x + ringOffset.x, f.y + ringOffset.y, f.z + ringOffset.z);
        shockRing.quaternion.copy(quat);
      } else {
        vaporCone.visible = false;
        shockRing.visible = false;
      }

      // --- Afterburner Mach Shock Diamonds Update ---
      const abIntensity = calculateAfterburnerIntensity(f.power, f.boost);
      if (abIntensity > 0.05 && isFighter) {
        const exhaustOffset = new THREE.Vector3(0, 0, fuseLen * 0.52).applyQuaternion(quat);
        const nozzleX = f.x + exhaustOffset.x;
        const nozzleY = f.y + exhaustOffset.y;
        const nozzleZ = f.z + exhaustOffset.z;

        // Direction opposite to flight forward vector (stream behind exhaust)
        const rearDir = new THREE.Vector3(0, 0, 1).applyQuaternion(quat);
        const diamondSpacing = 0.95 + abIntensity * 0.3;

        machDiamonds.forEach((m, idx) => {
          m.visible = true;
          const dist = (idx + 1) * diamondSpacing;
          m.position.set(
            nozzleX + rearDir.x * dist,
            nozzleY + rearDir.y * dist,
            nozzleZ + rearDir.z * dist
          );
          m.quaternion.copy(quat);

          // Pulse glow effect
          const pulse = Math.sin((f.elapsed || 0) * 85 + idx * 1.5) * 0.15;
          const diaScale = (1.0 - idx * 0.12) * (0.8 + abIntensity * 0.5 + pulse);
          m.scale.set(diaScale, diaScale, diaScale * 1.5);
          m.material.opacity = (abIntensity * 0.85) * (1.0 - idx * 0.14);
        });
      } else {
        machDiamonds.forEach(m => (m.visible = false));
      }

      // --- Live 3D Wingtip Condensation Vapor Ribbons ---
      if (vortexTrails.length) {
        const gForce = Math.abs(f.gForce || 1);
        const bankAbs = Math.abs(f.bank || 0);
        const humidLowPass = isFighter && (f.y || 0) < 750 && (f.speed || 0) > 125;
        const gIntensity = Math.max(0, Math.min(1, (gForce - 1.45) / 1.8));
        const bankIntensity = isFighter && (f.speed || 0) > 110 ? Math.max(0, Math.min(1, (bankAbs - 0.42) / 0.55)) * 0.65 : 0;
        const targetOpacity = Math.min(0.68, Math.max(gIntensity * 0.65, bankIntensity, humidLowPass ? 0.34 : 0));
        const halfSpan = f.aircraft?.geometry ? f.aircraft.geometry[2] : 6;
        const wingY = f.aircraft?.geometry ? (f.aircraft.geometry[3] || 0) : 0;
        const tipZ = f.aircraft?.geometry ? (f.aircraft.geometry[5] || 1.2) * 0.6 : 1.0;

        for (const vt of vortexTrails) {
          vt.mat.opacity += (targetOpacity - vt.mat.opacity) * Math.min(1, (dt || 0.016) * 5.5);
          if (vt.mat.opacity < 0.02) {
            vt.line.visible = false;
            vt.active = false;
            continue;
          }
          const tip = new THREE.Vector3(vt.side * halfSpan, wingY, tipZ).applyQuaternion(quat);
          const wx = f.x + tip.x, wy = f.y + tip.y, wz = f.z + tip.z;
          if (!vt.active) {
            vt.active = true;
            for (let i = 0; i < VORTEX_LEN; i++) {
              vt.arr[i * 3] = wx; vt.arr[i * 3 + 1] = wy; vt.arr[i * 3 + 2] = wz;
            }
          } else {
            for (let i = VORTEX_LEN - 1; i > 0; i--) {
              vt.arr[i * 3] = vt.arr[(i - 1) * 3];
              vt.arr[i * 3 + 1] = vt.arr[(i - 1) * 3 + 1];
              vt.arr[i * 3 + 2] = vt.arr[(i - 1) * 3 + 2];
            }
            vt.arr[0] = wx; vt.arr[1] = wy; vt.arr[2] = wz;
          }
          vt.geo.attributes.position.needsUpdate = true;
          vt.line.visible = true;
        }
      }
    }

    return {
      update,
      calculateTransonicIntensity,
      calculateAfterburnerIntensity,
      vfxGroup
    };
  }

  // Sculptural 3D Sunlit Volumetric Cumulus Cloud Field (billowy MSFS-style multi-puff clouds)
  function createVolumetricCumulusField(THREE, scene) {
    if (!THREE || !scene || !THREE.Sprite || !THREE.SpriteMaterial || !THREE.CanvasTexture || typeof document === 'undefined') {
      return { update: () => {}, group: null };
    }
    const group = new THREE.Group();
    group.name = '3D Volumetric Cumulus Cloud Field';
    scene.add(group);

    // Paint a soft sunlit multi-lobe cumulus puff with bright white top and soft blue-grey shadowed base
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, 256, 256);
      const lobes = [
        [128, 138, 92, 'rgba(186,202,220,0.42)', 'rgba(170,188,210,0)'],
        [86, 126, 66, 'rgba(232,239,248,0.68)', 'rgba(218,228,242,0)'],
        [170, 124, 68, 'rgba(234,240,248,0.66)', 'rgba(218,228,242,0)'],
        [128, 96, 78, 'rgba(255,255,255,0.88)', 'rgba(248,251,255,0)'],
        [104, 104, 58, 'rgba(255,255,255,0.82)', 'rgba(248,251,255,0)'],
        [154, 102, 56, 'rgba(255,255,255,0.80)', 'rgba(248,251,255,0)']
      ];
      for (const [cx, cy, r, c0, c1] of lobes) {
        const g = ctx.createRadialGradient(cx, cy - r * 0.14, r * 0.12, cx, cy, r);
        g.addColorStop(0, c0);
        g.addColorStop(0.58, c0);
        g.addColorStop(1, c1);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    const puffTex = new THREE.CanvasTexture(canvas);
    if (THREE.SRGBColorSpace) puffTex.colorSpace = THREE.SRGBColorSpace;

    const SPAN = 26000;
    const HALF = SPAN * 0.5;
    const clusters = [];
    let seed = 918273;
    const rand = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    const baseMat = new THREE.SpriteMaterial({
      map: puffTex,
      color: 0xffffff,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
      fog: true
    });

    for (let i = 0; i < 24; i++) {
      const cGrp = new THREE.Group();
      const ox = (rand() - 0.5) * SPAN;
      const oz = (rand() - 0.5) * SPAN;
      const oy = 680 + rand() * 1450;
      const scaleBase = 480 + rand() * 760;
      const puffCount = 5 + Math.floor(rand() * 3);
      for (let p = 0; p < puffCount; p++) {
        const sp = new THREE.Sprite(baseMat);
        const angle = (p / puffCount) * Math.PI * 2 + rand() * 0.5;
        const rad = p === 0 ? 0 : scaleBase * (0.22 + rand() * 0.28);
        const s = scaleBase * (p === 0 ? 1.15 : 0.65 + rand() * 0.42);
        sp.position.set(Math.cos(angle) * rad, (p === 0 ? 0.18 : (rand() - 0.35) * 0.22) * scaleBase * 0.55, Math.sin(angle) * rad);
        sp.scale.set(s * 1.28, s * 0.88, 1);
        cGrp.add(sp);
      }
      cGrp.position.set(ox, oy, oz);
      group.add(cGrp);
      clusters.push({ grp: cGrp, ox, oy, oz, drift: 7 + rand() * 9 });
    }

    const dayCol = new THREE.Color(0xffffff);
    const duskCol = new THREE.Color(0xffb482);
    const nightCol = new THREE.Color(0x1e2c42);
    const tmpCol = new THREE.Color();

    function update(camPos, dt, dayRatio, weather, enabled) {
      group.visible = Boolean(enabled);
      if (!enabled || !camPos) return;
      const dense = weather === 'clouds' || weather === 'storm' || weather === 'wet';
      const targetOp = weather === 'fog' ? 0.25 : dense ? 0.82 : 0.58;
      baseMat.opacity = targetOp;
      const twilight = Math.max(0, 1 - Math.abs(dayRatio - 0.28) * 3.8);
      tmpCol.copy(nightCol).lerp(dayCol, Math.max(0, Math.min(1, dayRatio * 1.15)));
      if (twilight > 0.01) tmpCol.lerp(duskCol, twilight * 0.55);
      baseMat.color.copy(tmpCol);

      for (let i = 0; i < clusters.length; i++) {
        const c = clusters[i];
        c.ox += c.drift * (dt || 0.016);
        let dx = ((c.ox - camPos.x + HALF) % SPAN + SPAN) % SPAN - HALF;
        let dz = ((c.oz - camPos.z + HALF) % SPAN + SPAN) % SPAN - HALF;
        c.grp.position.set(camPos.x + dx, c.oy, camPos.z + dz);
        const dist = Math.hypot(dx, c.oy - camPos.y, dz);
        c.grp.visible = dist > 550; // Hide smoothly when flying directly inside a puff
      }
    }

    return { update, group };
  }

  const visualFXModule = {
    createTransonicVFX,
    createVolumetricCumulusField
  };

  if (typeof root !== 'undefined') root.visualFX = visualFXModule;
  if (typeof window !== 'undefined') window.visualFX = visualFXModule;
  if (typeof global !== 'undefined') global.visualFX = visualFXModule;
  if (typeof module !== 'undefined' && module.exports) module.exports = visualFXModule;
})(typeof window !== 'undefined' ? window : global);
