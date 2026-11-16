'use strict';

/**
 * SKYBOUND GLOBAL - Aircraft Carrier Operations (CVN-78 福特號航空母艦起降系統)
 * Catapult Launch (3.5G 蒸氣/電磁彈射) & 4-Wire Arrested Landing (攔截索三線阻攔) & FLOLS 光學助降鏡
 */
const carrierOps = (() => {
  // Carrier Global Positioning: Pacific Ocean offshore Yilan/Hualien
  const carrier = {
    code: 'CVN78',
    name: '福特號航空母艦',
    x: 60245,
    y: 0,
    z: 79710,
    deckElevation: 18.5,
    heading: 0, // Heading North (0 rad) into Pacific wind
    speed: 12,  // 12 m/s (~23 knots) forward cruise
    length: 333,
    width: 78,
    // Angled flight deck offset: -8.9 degrees to port
    angledHeading: -0.155,
    angledLength: 220,
    angledWidth: 28,
    // Catapults on deck (relative along/cross from carrier center)
    catapults: [
      { id: 1, name: '一號艦艏彈射器 (Bow 1)', along: -55, cross: 8, heading: 0, stroke: 90 },
      { id: 2, name: '二號艦艏彈射器 (Bow 2)', along: -50, cross: -6, heading: 0, stroke: 90 },
      { id: 3, name: '三號斜角彈射器 (Waist 3)', along: 15, cross: -16, heading: -0.155, stroke: 85 },
      { id: 4, name: '四號斜角彈射器 (Waist 4)', along: 22, cross: -26, heading: -0.155, stroke: 85 }
    ],
    // 4 Arresting wires across angled deck
    wires: [
      { id: 1, name: '一號索', along: 72, cross: -12, grade: '1-Wire (進場略低)' },
      { id: 2, name: '二號索', along: 59, cross: -14, grade: '2-Wire (良好攔截)' },
      { id: 3, name: '三號索 (Target)', along: 46, cross: -16, grade: 'OK 3-Wire (完美王牌降落！)' },
      { id: 4, name: '四號索', along: 33, cross: -18, grade: '4-Wire (進場略深)' }
    ],
    // FLOLS Optical Landing System (Fresnel Lens) on port catwalk
    flols: { along: 46, cross: -39, y: 19.5, targetGlideSlope: 3.5 * Math.PI / 180 }
  };

  let carrierMesh = null;
  let catapultState = { armed: false, launching: false, timer: 0, catId: 1 };
  let arrestState = { caught: false, wireId: 0, grade: '', cableStretch: 0 };
  let flolsLight = null;

  function getCarrierData() {
    return carrier;
  }

  function getDeckPoint(along, cross, height = carrier.deckElevation) {
    const s = Math.sin(carrier.heading), c = Math.cos(carrier.heading);
    return {
      x: carrier.x + along * s + cross * c,
      y: height,
      z: carrier.z - along * c + cross * s
    };
  }

  /**
   * Check if a world point (x, z) is physically on the flight deck
   */
  function isOnDeck(x, z) {
    const dx = x - carrier.x, dz = z - carrier.z;
    const s = Math.sin(carrier.heading), c = Math.cos(carrier.heading);
    const along = dx * s - dz * c;
    const cross = dx * c + dz * s;
    return Math.abs(along) <= carrier.length / 2 + 10 && Math.abs(cross) <= carrier.width / 2 + 5;
  }

  /**
   * Catapult launch check and step simulation
   */
  function stepCatapult(f, dt, onLaunchPill) {
    if (!f || f.aircraft?.helicopter) return;
    const dx = f.x - carrier.x, dz = f.z - carrier.z;
    const s = Math.sin(carrier.heading), c = Math.cos(carrier.heading);
    const shipAlong = dx * s - dz * c;
    const shipCross = dx * c + dz * s;

    // Check if on carrier deck
    if (!isOnDeck(f.x, f.z)) {
      if (catapultState.launching || catapultState.armed) {
        catapultState.armed = false;
        catapultState.launching = false;
      }
      return;
    }

    // Check catapult shuttle alignment
    if (!catapultState.launching) {
      for (const cat of carrier.catapults) {
        const dAlong = shipAlong - cat.along;
        const dCross = shipCross - cat.cross;
        const distToShuttle = Math.hypot(dAlong, dCross);

        if (distToShuttle < 12 && f.speed < 15 && f.ground) {
          if (!catapultState.armed) {
            catapultState.armed = true;
            catapultState.catId = cat.id;
            catapultState.timer = 0;
            if (onLaunchPill) onLaunchPill(`⚓ 已對準 ${cat.name}！拉緊煞車並將油門推至 100% 進行彈射！`);
          }

          // Full throttle + hold brakes -> trigger launch stroke
          if (catapultState.armed && f.power >= 0.92) {
            catapultState.timer += dt;
            if (catapultState.timer >= 1.2) {
              catapultState.launching = true;
              catapultState.timer = 0;
              f.parkingBrake = false;
              if (onLaunchPill) onLaunchPill(`🚀 彈射出發！3.5G 彈射衝刺！`);
              if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([80, 40, 150]);
            }
          }
          break;
        }
      }
    }

    // Execute 3.5G Catapult Launch acceleration stroke
    if (catapultState.launching) {
      catapultState.timer += dt;
      const cat = carrier.catapults.find(c => c.id === catapultState.catId) || carrier.catapults[0];
      const catHeading = carrier.heading + cat.heading;

      // 3.6G acceleration = 35.5 m/s^2 forward
      const accel = 35.5;
      f.speed += accel * dt;
      f.heading = catHeading;
      f.vx = Math.sin(catHeading) * f.speed;
      f.vz = -Math.cos(catHeading) * f.speed;
      f.power = 1.0;

      // When reaching deck edge (approx 2.25s or speed >= 80 m/s = ~156 kts)
      if (catapultState.timer >= 2.25 || f.speed >= 80) {
        catapultState.launching = false;
        catapultState.armed = false;
        f.ground = false;
        f.vy = Math.max(f.vy, 4.5); // Positive rate of climb off the deck
        if (onLaunchPill) onLaunchPill(`✈ 成功彈射離艦！空速 ${Math.round(f.speed * 1.944)} 節，爬升中！`);
      }
    }
  }

  /**
   * Arrestor hook and wire trap simulation
   */
  function stepArrestor(f, dt, onTrapGrade) {
    if (!f || f.aircraft?.helicopter) return;

    // Aircraft tailhook state
    f.tailhook = Boolean(f.tailhook);

    // If already trapped, apply heavy cable deceleration until stop
    if (arrestState.caught) {
      // 2.9G deceleration = 28.5 m/s^2
      f.speed = Math.max(0, f.speed - 28.5 * dt);
      f.vx = Math.sin(f.heading) * f.speed;
      f.vz = -Math.cos(f.heading) * f.speed;
      arrestState.cableStretch += f.speed * dt;

      if (f.speed <= 0.5) {
        f.speed = 0;
        f.vx = 0;
        f.vz = 0;
        f.parkingBrake = true;
        arrestState.caught = false;
        if (onTrapGrade) onTrapGrade(`⚓ ${arrestState.grade} · 停機滑行，歡迎登艦！`);
      }
      return;
    }

    // Check touchdown in carrier wire arrestor zone
    if (isOnDeck(f.x, f.z) && f.y <= carrier.deckElevation + 1.2) {
      const dx = f.x - carrier.x, dz = f.z - carrier.z;
      const s = Math.sin(carrier.heading), c = Math.cos(carrier.heading);
      const shipAlong = dx * s - dz * c;
      const shipCross = dx * c + dz * s;

      // Angled runway strip boundaries
      const inLandingStrip = shipCross >= -32 && shipCross <= 8;

      if (inLandingStrip && f.speed >= 25 && f.speed <= 95) {
        if (f.tailhook) {
          // Find closest wire
          let caughtWire = null;
          let minDiff = Infinity;
          for (const wire of carrier.wires) {
            const diff = Math.abs(shipAlong - wire.along);
            if (diff < minDiff) {
              minDiff = diff;
              caughtWire = wire;
            }
          }

          if (caughtWire && minDiff < 10) {
            arrestState.caught = true;
            arrestState.wireId = caughtWire.id;
            arrestState.grade = caughtWire.grade;
            arrestState.cableStretch = 0;
            f.ground = true;
            if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([100, 50, 150]);
            if (onTrapGrade) onTrapGrade(`🪝 抓到 ${caughtWire.name}！${caughtWire.grade}`);
            return;
          }
        }

        // If tailhook not down or missed all wires while on carrier deck
        if (shipAlong > 85 && !arrestState.caught && f.speed > 35) {
          if (onTrapGrade) onTrapGrade(`⚠️ BOLTER! 觸艦復飛！立即開全油門拉起！`);
        }
      }
    }
  }

  /**
   * FLOLS Glide slope calculation for optical Meatball indicator
   */
  function calculateFLOLS(f) {
    if (!f) return null;
    const dx = f.x - carrier.x, dz = f.z - carrier.z;
    const s = Math.sin(carrier.heading), c = Math.cos(carrier.heading);
    const shipAlong = dx * s - dz * c;
    const shipCross = dx * c + dz * s;

    // Approach distance behind carrier
    const distanceBehind = Math.abs(shipAlong - carrier.wires[2].along);
    if (distanceBehind <= 50 || distanceBehind > 8000) return null;

    const altAboveDeck = f.y - carrier.deckElevation;
    const currentSlope = Math.atan2(altAboveDeck, distanceBehind);
    const targetSlope = carrier.flols.targetGlideSlope; // 3.5 deg
    const slopeDiff = (currentSlope - targetSlope) * (180 / Math.PI); // deg

    // -1 (very low) to +1 (very high), 0 (centered meatball)
    const ballPos = Math.max(-1.5, Math.min(1.5, slopeDiff / 0.8));
    const isWaveOff = ballPos < -1.0 || slopeDiff < -1.2;

    return {
      ballPos,
      isWaveOff,
      distanceKm: distanceBehind / 1000,
      altM: altAboveDeck
    };
  }

  /**
   * Build realistic Three.js 3D Carrier Model
   */
  function buildCarrier3D(scene) {
    if (carrierMesh && carrierMesh.parent) {
      carrierMesh.parent.remove(carrierMesh);
    }
    if (typeof THREE === 'undefined') return null;

    const root = new THREE.Group();
    root.name = 'USS_Gerald_R_Ford_CVN78';
    root.position.set(carrier.x, carrier.y, carrier.z);
    root.rotation.y = -carrier.heading;

    const steelMat = new THREE.MeshStandardMaterial({ color: 0x48515c, roughness: 0.72, metalness: 0.35 });
    const deckMat = new THREE.MeshStandardMaterial({ color: 0x1f242a, roughness: 0.88, metalness: 0.15 });
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xf5f7fa });
    const yellowMat = new THREE.MeshBasicMaterial({ color: 0xfac832 });
    const redMat = new THREE.MeshBasicMaterial({ color: 0xcc292b });
    const towerMat = new THREE.MeshStandardMaterial({ color: 0x5a636e, roughness: 0.65, metalness: 0.45 });
    const cableMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5, metalness: 0.85 });

    // 1. Ship Hull
    // Flared ship hull: narrow waterline, a fine bow and broad stern under deck overhangs.
    const hullPositions=[],hullIndices=[];
    const stations=[[-carrier.length/2+8,1.5],[-carrier.length*.38,16],[-carrier.length*.22,22],[carrier.length*.28,23],[carrier.length/2-12,19]];
    stations.forEach(([z,w])=>{
      hullPositions.push(-w*.67,-4,z,w*.67,-4,z,-w,carrier.deckElevation-1.2,z,w,carrier.deckElevation-1.2,z);
    });
    for(let j=0;j<stations.length-1;j++){
      const a=j*4,b=a+4;
      for(const [u,v] of [[0,1],[1,3],[3,2],[2,0]])hullIndices.push(a+u,b+u,a+v,a+v,b+u,b+v);
    }
    hullIndices.push(0,2,1,1,2,3,16,17,18,17,19,18);
    for(let i=0;i<hullIndices.length;i+=3){const t=hullIndices[i+1];hullIndices[i+1]=hullIndices[i+2];hullIndices[i+2]=t;}
    const hullGeo=new THREE.BufferGeometry();hullGeo.setAttribute('position',new THREE.Float32BufferAttribute(hullPositions,3));hullGeo.setIndex(hullIndices);hullGeo.computeVertexNormals();
    const hullMesh=new THREE.Mesh(hullGeo,steelMat);hullMesh.name='Flared carrier hull';root.add(hullMesh);

    // 3. Flight Deck Platform
    const deckGeo = new THREE.BoxGeometry(carrier.width, 1.8, carrier.length);
    const deckMesh = new THREE.Mesh(deckGeo, deckMat);
    deckMesh.position.set(0, carrier.deckElevation, 0);
    root.add(deckMesh);

    // Low-cost deck texture: non-skid panels, drains and touchdown rubber wear.
    const deckCanvas=document.createElement('canvas');deckCanvas.width=512;deckCanvas.height=1024;
    const dg=deckCanvas.getContext('2d');dg.fillStyle='#353a3d';dg.fillRect(0,0,512,1024);
    for(let y=0;y<1024;y+=32){dg.fillStyle=y%64?'#323638':'#393d3f';dg.fillRect(0,y,512,31);}
    for(let i=0;i<1600;i++){const x=(i*137)%512,y=(i*239)%1024;dg.fillStyle=i%3?'#404548':'#292e31';dg.fillRect(x,y,2,1);}
    dg.fillStyle='#272c2f';for(let i=0;i<13;i++)dg.fillRect(140+i*6,510+(i%3)*12,3,170);
    dg.fillStyle='#d8d8cc';dg.font='bold 80px sans-serif';dg.textAlign='center';dg.fillText('78',256,130);
    const deckTexture=new THREE.CanvasTexture(deckCanvas);deckTexture.colorSpace=THREE.SRGBColorSpace;deckTexture.anisotropy=4;
    deckMat.map=deckTexture;deckMat.needsUpdate=true;
    function shipBox(w,h,d,x,y,z,mat=steelMat){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);root.add(m);return m;}
    // Catapult tracks, elevators and deck-edge safety catwalks remain outside the landing lane.
    for(const cat of carrier.catapults){
      shipBox(.45,.07,cat.stroke,cat.cross,carrier.deckElevation+1.03,cat.along-cat.stroke*.5,cableMat);
      shipBox(1.4,.09,2,cat.cross,carrier.deckElevation+1.1,cat.along,yellowMat);
    }
    for(const z of [-78,24,110]){
      shipBox(13,.10,18,carrier.width/2-7,carrier.deckElevation+.97,z,towerMat);
      for(const dz of [-9,9])shipBox(13,.06,.18,carrier.width/2-7,carrier.deckElevation+1.04,z+dz,yellowMat);
    }
    for(const side of [-1,1]){
      shipBox(2,.6,carrier.length-28,side*(carrier.width/2+.5),carrier.deckElevation-1.5,0);
      for(let z=-140;z<=145;z+=9){
        shipBox(.08,.8,.08,side*(carrier.width/2+1.3),carrier.deckElevation-.8,z);
        const lamp=new THREE.Mesh(new THREE.SphereGeometry(.13,6,4),new THREE.MeshBasicMaterial({color:0x6eafff}));
        lamp.position.set(side*(carrier.width/2-.6),carrier.deckElevation+1.03,z);root.add(lamp);
      }
    }

    // 4. Angled Deck Strip (Painted lines)
    const stripGeo = new THREE.PlaneGeometry(carrier.angledWidth, carrier.angledLength);
    const stripMesh = new THREE.Mesh(stripGeo, deckMat);
    stripMesh.rotation.x = -Math.PI / 2;
    stripMesh.rotation.z = -carrier.angledHeading;
    stripMesh.position.set(-10, carrier.deckElevation + 0.92, 10);
    root.add(stripMesh);

    for(const side of [-1,1]){
      const edge=new THREE.Mesh(new THREE.PlaneGeometry(.38,carrier.angledLength),lineMat);
      edge.rotation.x=-Math.PI/2;edge.rotation.z=-carrier.angledHeading;
      edge.position.set(-10+side*carrier.angledWidth/2,carrier.deckElevation+.96,10);root.add(edge);
    }
    // Dashed Centerline for Angled Runway
    for (let z = -80; z <= 80; z += 16) {
      const dashGeo = new THREE.PlaneGeometry(1.2, 8);
      const dashMesh = new THREE.Mesh(dashGeo, lineMat);
      dashMesh.rotation.x = -Math.PI / 2;
      dashMesh.rotation.z = -carrier.angledHeading;
      const cz = z * Math.cos(-carrier.angledHeading);
      const cx = -10 + z * Math.sin(-carrier.angledHeading);
      dashMesh.position.set(cx, carrier.deckElevation + 0.95, cz + 10);
      root.add(dashMesh);
    }

    // 5. 4 Arresting Wire Cables
    for (const wire of carrier.wires) {
      const cableGeo = new THREE.CylinderGeometry(0.12, 0.12, carrier.angledWidth + 4, 6);
      const cableMesh = new THREE.Mesh(cableGeo, cableMat);
      cableMesh.rotation.z = Math.PI / 2;
      cableMesh.rotation.y = -carrier.angledHeading;
      cableMesh.position.set(wire.cross, carrier.deckElevation + 1.05, wire.along);
      root.add(cableMesh);
    }

    // 6. Island Superstructure (Tower on starboard side)
    const islandGroup = new THREE.Group();
    islandGroup.position.set(26, carrier.deckElevation + 12, 28);
    const islandBody = new THREE.Mesh(new THREE.BoxGeometry(10, 22, 28), towerMat);
    islandGroup.add(islandBody);
    // Mast & Radome
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.8, 16, 6), steelMat);
    mast.position.set(0, 19, 0);
    islandGroup.add(mast);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(2.2, 8, 6), lineMat);
    dome.position.set(0, 27, 0);
    islandGroup.add(dome);
    // Bridge windows
    const winMat=new THREE.MeshPhysicalMaterial({color:0x172c38,roughness:.16,metalness:.35,clearcoat:.8});
    for(let i=0;i<10;i++){
      const win=new THREE.Mesh(new THREE.BoxGeometry(.08,1.6,2.1),winMat);win.position.set(-5.04,7.5,-12+i*2.6);islandGroup.add(win);
    }
    for(let i=0;i<4;i++){
      const win=new THREE.Mesh(new THREE.BoxGeometry(1.8,1.6,.08),winMat);win.position.set(-3.6+i*2.4,7.5,-14.04);islandGroup.add(win);
    }
    for(let i=0;i<3;i++){
      const aerial=new THREE.Mesh(new THREE.CylinderGeometry(.07,.12,8+i*3,8),steelMat);aerial.position.set(-3+i*3,18+i*1.5,-8);islandGroup.add(aerial);
    }
    root.add(islandGroup);

    // 7. FLOLS Optical Light Assembly (Port catwalk)
    const flolsGroup = new THREE.Group();
    flolsGroup.position.set(carrier.flols.cross, carrier.flols.y, carrier.flols.along);
    const flolsBox = new THREE.Mesh(new THREE.BoxGeometry(2, 4, 3), steelMat);
    flolsGroup.add(flolsBox);
    // Green Datum Bar Lights
    const datumGeo = new THREE.BoxGeometry(3.6, 0.3, 0.4);
    const datumMat = new THREE.MeshBasicMaterial({ color: 0x00ff66 });
    const datumMesh = new THREE.Mesh(datumGeo, datumMat);
    datumMesh.position.set(0, 0, 1.6);
    flolsGroup.add(datumMesh);
    // Amber Meatball Light
    const meatballMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
    const meatballMesh = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), meatballMat);
    meatballMesh.position.set(0, 0, 1.6);
    flolsGroup.add(meatballMesh);
    flolsLight = meatballMesh;
    root.add(flolsGroup);

    // Local open-water patch guarantees a continuous sea around the offshore carrier.
    const oceanUniforms={time:{value:0},day:{value:1},lightDir:{value:new THREE.Vector3(.3,.8,.4)}};
    const oceanMat=new THREE.ShaderMaterial({
      uniforms:oceanUniforms,side:THREE.DoubleSide,
      vertexShader:`varying vec3 wp;uniform float time;void main(){vec3 p=position;p.y+=sin(p.x*.018+time*.7)*.12+sin(p.z*.025-time*.6)*.10;wp=(modelMatrix*vec4(p,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(wp,1.);}`,
      fragmentShader:`varying vec3 wp;uniform float time,day;uniform vec3 lightDir;
      void main(){
       vec2 p=wp.xz;
       float swell=sin(dot(p,vec2(.023,.017))+time*.8);
       float crossWave=sin(dot(p,vec2(-.041,.059))-time*.65+swell*1.4);
       float ripple=sin(dot(p,vec2(.19,.13))+time*1.7+crossWave*2.);
       float farFade=1.-smoothstep(500.,6000.,distance(cameraPosition,wp));
       vec3 n=normalize(vec3(swell*.07+crossWave*.045+ripple*.028*farFade,1.,crossWave*.07-swell*.033+cos(dot(p,vec2(-.17,.23))-time*1.5+ripple)*.025*farFade));
       vec3 v=normalize(cameraPosition-wp);float fres=pow(1.-max(0.,dot(n,v)),4.);
       vec3 water=mix(vec3(.012,.05,.10),vec3(.025,.20,.29),day);
       vec3 sky=mix(vec3(.025,.045,.08),vec3(.38,.60,.76),day);
       vec3 c=mix(water,sky,fres*.78);
       float sun=pow(max(0.,dot(reflect(-v,n),normalize(lightDir))),100.);
       c+=vec3(1.,.82,.54)*sun*day*1.6;
       float foam=smoothstep(.98,1.,sin(p.x*.037+time+crossWave)*sin(p.y*.042-time*.7+swell));
       c=mix(c,vec3(.70,.82,.86)*(.12+.88*day),foam*.14);
       gl_FragColor=vec4(c,1.);
       #include <tonemapping_fragment>
       #include <colorspace_fragment>
      }`
    });
    const oceanGeo=new THREE.PlaneGeometry(14000,14000,64,64);oceanGeo.rotateX(-Math.PI/2);
    const oceanMesh=new THREE.Mesh(oceanGeo,oceanMat);oceanMesh.position.y=-.18;oceanMesh.name='Carrier open ocean';
    oceanMesh.onBeforeRender=()=>{
      oceanUniforms.time.value=performance.now()*.001;
      const sun=scene.children.find(o=>o.isDirectionalLight);
      if(sun){oceanUniforms.day.value=Math.min(1,Math.max(.02,(sun.intensity-.05)/2.8));oceanUniforms.lightDir.value.copy(sun.position).sub(sun.target.position).normalize();}
    };
    root.add(oceanMesh);

    // 8. Ocean Wake Foam Trails
    const wakeGeo = new THREE.PlaneGeometry(carrier.width * 1.5, 320);
    const wakeMat = new THREE.ShaderMaterial({
      transparent:true,depthWrite:false,side:THREE.DoubleSide,
      uniforms:{clock:{value:0}},
      vertexShader:'varying vec2 tex;void main(){tex=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:`varying vec2 tex;uniform float clock;void main(){
        float aft=1.-tex.y;float width=.14+aft*.82;float edge=abs(tex.x-.5)*2.;
        float ribbon=(1.-smoothstep(width-.13,width,edge))*smoothstep(0.,.06,aft)*(1.-smoothstep(.65,1.,aft));
        float pattern=.5+.5*sin(tex.x*92.+sin(tex.y*37.-clock*1.3)*3.);
        float churn=.5+.5*sin(tex.y*110.-clock*3.+sin(tex.x*60.));
        gl_FragColor=vec4(.78,.90,.94,ribbon*(.08+pattern*churn*.30));
      }`
    });
    const wakeMesh = new THREE.Mesh(wakeGeo, wakeMat);
    wakeMesh.rotation.x = -Math.PI / 2;
    wakeMesh.position.set(0, 0.2, carrier.length / 2 + 150);
    wakeMesh.onBeforeRender=()=>{wakeMat.uniforms.clock.value=performance.now()*.001;};
    root.add(wakeMesh);

    root.traverse(o=>{if(o.isMesh&&o!==wakeMesh&&o!==oceanMesh){o.castShadow=true;o.receiveShadow=true;}});
    scene.add(root);
    carrierMesh = root;
    return root;
  }

  function getCatapultState() {
    return { ...catapultState };
  }

  function getArrestState() {
    return { ...arrestState };
  }

  return {
    getCarrierData,
    getDeckPoint,
    isOnDeck,
    stepCatapult,
    stepArrestor,
    calculateFLOLS,
    buildCarrier3D,
    getCatapultState,
    getArrestState
  };
})();

if (typeof module !== 'undefined') module.exports = carrierOps;
