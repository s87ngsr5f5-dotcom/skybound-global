'use strict';
const airportEnvironmentBounds=new Map();
function airportSurroundingsContains(airport,frame){
  const b=airportEnvironmentBounds.get(airport.code);
  return b&&frame.cross>b[0]&&frame.cross<b[1]&&Math.abs(-frame.along-b[2])<b[3];
}
// Original environment details fitted to the existing playable airport layout.
// Access roads/parking are scenery approximations, not an aeronautical survey.
function createAirportSurroundings(parent,airport,layout){
  const root=new THREE.Group();root.name=airport.code+' airport surroundings';parent.add(root);
  const {terminalX,terminalWidth,height,buildingLength,apronZ,gateWall}=layout;
  const side=Math.sign(airport.apron),back=terminalX+side*terminalWidth/2;
  const roadX=back+side*23,parkingX=back+side*74;
  const dense=airport.code==='RCSS',length=buildingLength+(dense?95:55);
  airportEnvironmentBounds.set(airport.code,[Math.min(gateWall,parkingX-parkPadding()),Math.max(gateWall,parkingX+parkPadding()),apronZ,length/2+9]);
  function parkPadding(){return dense?44:30;}
  const stats={parkingSpaces:0,parkedVehicles:0,fencePanels:0,trees:0,lights:0,movingVehicles:0,facadeBays:0};
  const mat=(color,extra={})=>new THREE.MeshStandardMaterial({color,roughness:.83,...extra});
  const roadCanvas=document.createElement('canvas');roadCanvas.width=128;roadCanvas.height=128;
  const rc=roadCanvas.getContext('2d');rc.fillStyle='#353b40';rc.fillRect(0,0,128,128);
  for(let i=0;i<900;i++){rc.fillStyle=i%2?'#2c3135':'#40464c';rc.fillRect((i*47)%128,(i*83)%128,2,2);}
  rc.fillStyle='rgba(25,28,31,0.38)';rc.fillRect(26,0,22,128);rc.fillRect(80,0,22,128);
  const roadTex=new THREE.CanvasTexture(roadCanvas);roadTex.wrapS=roadTex.wrapT=THREE.RepeatWrapping;roadTex.repeat.set(2,14);roadTex.colorSpace=THREE.SRGBColorSpace;
  const road=mat('#ffffff',{map:roadTex,roughness:.85}),paving=mat('#a3a497'),curb=mat('#d2d0bf'),paint=mat('#e5dfc2');
  const frame=mat('#737f82',{metalness:.3,roughness:.53}),white=mat('#e3e2d7'),rubber=mat('#252a2c');
  const glazing=mat('#3e6173',{metalness:.28,roughness:.32});
  const brick=mat('#9b725a'),red=mat('#aa4c3d'),grass=mat('#52674b');
  const leaves=mat('#41613e',{vertexColors:true}),trunk=mat('#77614b');
  const lamp=mat('#ffe6b0',{emissive:0xffd482,emissiveIntensity:.05});
  const darkMetal=mat('#36464b',{metalness:.55,roughness:.42});
  const litGlass=mat('#456b79',{metalness:.48,roughness:.22,emissive:0xffdba0,emissiveIntensity:.02});
  const drain=mat('#343c3c'),blue=mat('#396c8b'),yellow=mat('#d1ad52');
  const batches=new Map(),transform=new THREE.Object3D();
  function add(geometry,material,x,y,z,sx=1,sy=1,sz=1,angle=0){
    transform.position.set(x,y,z);transform.rotation.set(0,angle,0);transform.scale.set(sx,sy,sz);transform.updateMatrix();
    const flat=geometry.index?geometry.toNonIndexed():geometry;
    if(flat!==geometry)geometry.dispose();flat.applyMatrix4(transform.matrix);
    if(!batches.has(material))batches.set(material,[]);batches.get(material).push(flat);
  }
  function box(material,w,h,d,x,y,z){add(new THREE.BoxGeometry(w,h,d),material,x,y,z);}
  function pole(x,z,h=7){
    add(new THREE.CylinderGeometry(.08,.13,h,7),frame,x,h/2,z);
    box(frame,2.4,.09,.12,x+1, h-.12,z);box(lamp,.75,.15,.36,x+2,h-.18,z);stats.lights++;
  }
  // Landside access: parallel drop-off road + outward airport expressway spurs joining regional highways.
  const spurLen=680;
  box(road,15,.12,length+spurLen*2,roadX,.06,apronZ);
  box(road,spurLen,.12,14,roadX+side*(spurLen*0.5+6),.06,apronZ+length*0.5+45);
  box(road,spurLen,.12,14,roadX+side*(spurLen*0.5+6),.06,apronZ-length*0.5-45);
  for(let z=-length/2-spurLen+16;z<length/2+spurLen-12;z+=18)box(paint,.14,.018,7,roadX,.13,apronZ+z);
  for(const s of [-1,1]){
    box(paving,3.5,.18,length,roadX+s*9.2,.09,apronZ);
    box(curb,.24,.24,length,roadX+s*7.6,.12,apronZ);
  }
  for(let z=-length/2+8;z<length/2-3;z+=11)box(paint,.12,.018,4.5,roadX,.13,apronZ+z);
  for(const z of [-buildingLength*.34,buildingLength*.34]){
    for(let i=-6;i<=6;i+=2)box(paint,13.8,.025,.7,roadX,.14,apronZ+z+i);
  }
  box(paving,8,.15,buildingLength-15,back+side*4.5,.075,apronZ);
  box(white,7,.27,buildingLength-24,back+side*4.5,4.6,apronZ);
  for(let z=-buildingLength/2+15;z<buildingLength/2-5;z+=18){
    add(new THREE.CylinderGeometry(.12,.12,4.5,8),frame,back+side*6.8,2.25,apronZ+z);
    box(glazing,.16,3.8,4,back+side*.2,2,apronZ+z);
  }
  // Roof seams, HVAC cabinets and ducts make the existing terminal readable close up.
  for(let z=-buildingLength/2+7;z<buildingLength/2;z+=12)box(frame,terminalWidth+2,.035,.09,terminalX,height+.80,apronZ+z);
  for(let z=-buildingLength/2+24;z<buildingLength/2-12;z+=40){
    box(frame,3.8,1.45,5.6,terminalX,height+1.45,apronZ+z);
    box(white,4,.1,5.8,terminalX,height+2.2,apronZ+z);
    box(frame,1.1,.55,12,terminalX+side*3,height+1,apronZ+z+4);
  }
  // Bespoke 3D Architectural Landmarks for World-Famous & Regional Airports (merged into batched draw calls!)
  (function buildFamousAirportArchitecture(){
    const code=airport.code;
    const tZ=apronZ-buildingLength/2-56;
    const tX=terminalX+side*15;
    if(code==='RCTP'){
      // Taiwan Taoyuan International: T1 Saarinen-inspired sweeping catenary wing eaves + 65m red/white cylindrical dual-cab ATCT
      for(let k=-4;k<=4;k++){
        const z=apronZ+k*(buildingLength/9.5);
        const sag=Math.abs(k)*0.32;
        box(white,terminalWidth+18,0.65+sag*0.2,buildingLength/10,terminalX,height+1.6+sag,z);
        box(frame,1.4,4.2+sag,1.4,gateWall-side*3,height*0.75,z);
        box(frame,1.4,4.2+sag,1.4,back+side*3,height*0.75,z);
      }
      add(new THREE.CylinderGeometry(4.8,5.6,54,16),white,tX,27,tZ);
      add(new THREE.CylinderGeometry(9.2,7.8,5.2,16),litGlass,tX,52,tZ);
      add(new THREE.CylinderGeometry(9.8,9.8,1.1,16),red,tX,55.2,tZ);
      add(new THREE.CylinderGeometry(6.8,6.2,3.6,16),litGlass,tX,57.5,tZ);
      add(new THREE.CylinderGeometry(7.2,7.2,0.9,16),red,tX,59.8,tZ);
      stats.landmark='Taoyuan Catenary Wing Terminal & Dual-Cab Red/White ATCT';
    }else if(code==='RCSS'){
      // Taipei Songshan: T1/T2 orange-and-silver dual roofline + green-glass octagonal ATCT
      box(yellow,terminalWidth+6,1.15,buildingLength+4,terminalX,height+1.1,apronZ);
      box(litGlass,28,4.6,44,terminalX,height+2.8,apronZ);
      add(new THREE.CylinderGeometry(6.5,5.8,5.5,8),litGlass,tX,34,tZ);
      stats.landmark='Songshan Orange/Silver Fascia & Octagonal ATCT';
    }else if(code==='RCKH'){
      // Kaohsiung International: Central elevated pyramidal glass skylight atrium + octagonal ATCT
      add(new THREE.ConeGeometry(26,9.5,4),litGlass,terminalX,height+5.2,apronZ,1.2,1,1.6,Math.PI/4);
      box(blue,terminalWidth+6,0.9,buildingLength,terminalX,height+1.05,apronZ);
      stats.landmark='Kaohsiung Skylight Atrium Terminal';
    }else if(code==='RCMQ'){
      // Taichung Ching Chuan Kang: Wave-curved white terminal canopy + military hardened shelters
      for(let i=-3;i<=3;i++){
        const z=apronZ+i*(buildingLength/7.2);
        add(new THREE.CylinderGeometry(18,18,terminalWidth+10,12),white,terminalX,height+0.8,z,1,0.22,1,Math.PI/2);
      }
      stats.landmark='Taichung Wave Canopy Terminal';
    }else if(code==='RCBS'){
      // Kinmen Shangyi: Traditional Minnan terracotta swallowtail curved ridge crown atop glass terminal
      box(red,terminalWidth*0.65,2.6,buildingLength*0.72,terminalX,height+1.8,apronZ);
      for(const end of [-1,1]){
        box(red,terminalWidth*0.68,4.2,6,terminalX,height+3.1,apronZ+end*(buildingLength*0.36));
        box(yellow,terminalWidth*0.72,0.8,8,terminalX,height+5.1,apronZ+end*(buildingLength*0.37));
      }
      stats.landmark='Kinmen Minnan Swallowtail Ridge Terminal';
    }else if(code==='WSSS'){
      // Singapore Changi: Moshe Safdie Jewel Changi 130m toroidal diamond-glass vortex dome + 81m double-goblet ATCT
      const jX=back+side*46, jZ=apronZ;
      add(new THREE.SphereGeometry(56,24,14),litGlass,jX,12,jZ,1.0,0.46,1.25);
      add(new THREE.TorusGeometry(42,1.6,8,24),frame,jX,24,jZ,1.0,1.2,0.35);
      add(new THREE.CylinderGeometry(8,11,28,16),litGlass,jX,14,jZ);
      add(new THREE.CylinderGeometry(4.5,6.2,72,16),white,tX,36,tZ);
      add(new THREE.CylinderGeometry(15,9,6.5,20),litGlass,tX,68,tZ);
      add(new THREE.CylinderGeometry(16,16,1.4,20),white,tX,72,tZ);
      stats.landmark='Changi Jewel Vortex Glass Dome & 81m Goblet ATCT';
    }else if(code==='KJFK'){
      // New York JFK: Eero Saarinen TWA Flight Center 4 soaring thin-shell white concrete bird wings + 98m ATCT
      for(const s of [-1,1]){
        const wingZ=apronZ+s*34;
        add(new THREE.ConeGeometry(28,14,12),white,back+side*14,height*0.65,wingZ,1.1,0.55,1.8,s*0.32);
        add(new THREE.ConeGeometry(22,11,12),white,gateWall-side*4,height*0.72,wingZ*0.8,0.9,0.48,1.5,-s*0.25);
      }
      add(new THREE.CylinderGeometry(5.2,7.2,86,12),white,tX,43,tZ);
      add(new THREE.CylinderGeometry(12.5,9.2,7.5,12),litGlass,tX,88,tZ);
      add(new THREE.SphereGeometry(4.2,12,10),white,tX,96,tZ);
      stats.landmark='JFK Saarinen TWA Flight Center Bird-Wing Shells & 98m ATCT';
    }else if(code==='KLAX'){
      // Los Angeles LAX: Iconic Googie parabolic-arch Theme Building spider legs & flying saucer + 15 Illuminated Gateway Pylons
      const tbX=back+side*42, tbZ=apronZ;
      for(let a=0;a<4;a++){
        const ang=a*Math.PI/2+Math.PI/4;
        add(new THREE.TorusGeometry(28,1.3,8,20,Math.PI),white,tbX,2,tbZ,1,1.35,1,ang);
      }
      add(new THREE.CylinderGeometry(18,16,4.2,24),white,tbX,22,tbZ);
      add(new THREE.CylinderGeometry(15,15,3.2,24),litGlass,tbX,24.5,tbZ);
      for(let p=-7;p<=7;p++){
        const pH=18+Math.abs(p)*1.4;
        add(new THREE.CylinderGeometry(1.3,1.6,pH,12),lamp,roadX+side*13,pH*0.5,apronZ+p*22);
      }
      stats.landmark='LAX Googie Theme Building Arches & 15 Illuminated Gateway Pylons';
    }else if(code==='KSFO'){
      // San Francisco SFO: SOM International Terminal double-cantilevered inverted-truss butterfly wing roof + 67m flared Torch ATCT
      box(white,terminalWidth+26,1.4,buildingLength*0.86,terminalX,height+3.8,apronZ);
      for(let z=-buildingLength*0.38;z<=buildingLength*0.38;z+=28){
        box(frame,terminalWidth+24,2.6,1.2,terminalX,height+2.1,apronZ+z);
      }
      add(new THREE.CylinderGeometry(8.5,4.2,62,16),white,tX,31,tZ);
      add(new THREE.CylinderGeometry(11.5,8.5,6.5,16),litGlass,tX,64,tZ);
      stats.landmark='SFO Butterfly Inverted-Truss Roof & Flared Torch ATCT';
    }else if(code==='RJTT'||code==='RJAA'||code==='RJBB'){
      // Tokyo Haneda / Narita / Osaka Kansai: Sweeping airfoil / Edo-wave silver roof shells + Circular Satellites (RJAA) + 110m ATCT
      const waves=code==='RJBB'?9:5;
      for(let w=0;w<waves;w++){
        const wz=apronZ-buildingLength*0.42+w*(buildingLength*0.84/Math.max(1,waves-1));
        add(new THREE.CylinderGeometry(terminalWidth*0.55,terminalWidth*0.55,buildingLength/waves+6,16),white,terminalX,height+0.6,wz,1,0.28,1);
      }
      if(code==='RJAA'){
        for(const end of [-1,1]){
          add(new THREE.CylinderGeometry(32,32,height+2,20),litGlass,gateWall-side*14,(height+2)*0.5,apronZ+end*(buildingLength*0.46));
          add(new THREE.CylinderGeometry(34,34,1.2,20),white,gateWall-side*14,height+2.6,apronZ+end*(buildingLength*0.46));
        }
      }
      add(new THREE.CylinderGeometry(5.5,6.8,88,16),frame,tX,44,tZ);
      add(new THREE.CylinderGeometry(12,9.5,6.5,16),litGlass,tX,90,tZ);
      stats.landmark=code+' Sweeping Airfoil Wave Roof & High-Elevation ATCT';
    }else if(code==='VHHH'){
      // Hong Kong Chek Lap Kok: Norman Foster barrel-vaulted multi-bay Y-concourse skylight roof + SkyBridge over taxiway
      for(let b=-3;b<=3;b++){
        const bz=apronZ+b*(buildingLength/7.2);
        add(new THREE.CylinderGeometry(16,16,terminalWidth+8,12),white,terminalX,height+1.2,bz,1,0.35,1,Math.PI/2);
      }
      box(litGlass,48,7.5,16,gateWall-side*24,18,apronZ-buildingLength*0.38);
      box(white,50,1.2,18,gateWall-side*24,22.2,apronZ-buildingLength*0.38);
      stats.landmark='HKIA Foster Barrel-Vault Roof & SkyBridge';
    }else if(code==='RKSI'||code==='ZSPD'||code==='ZBAA'||code==='ZGGG'||code==='ZGSZ'){
      // Incheon / Pudong / Beijing Capital Dragon Roof / Guangzhou / Shenzhen Manta-Ray
      const roofMatUse=code==='ZBAA'?red:white;
      for(let s=-4;s<=4;s++){
        const sz=apronZ+s*(buildingLength/9);
        const hLift=code==='RKSI'?(4-Math.abs(s))*0.9:(s%2===0?2.6:0.8);
        box(roofMatUse,terminalWidth+16,1.3,buildingLength/8.5,terminalX,height+1.5+hLift,sz);
        box(litGlass,12,0.5,buildingLength/10,terminalX,height+2.3+hLift,sz);
      }
      add(new THREE.CylinderGeometry(4.6,7.2,84,16),white,tX,42,tZ);
      add(new THREE.CylinderGeometry(11,8,6,16),litGlass,tX,86,tZ);
      stats.landmark=code+' Grand Mega-Hub Wave/Dragon Canopy & 95m ATCT';
    }else if(code==='VTBS'||code==='WMKK'||code==='VIDP'||code==='VABB'){
      // Bangkok Suvarnabhumi Super-Truss & 132m ATCT / KLIA Islamic Shells / Delhi & Mumbai
      for(let bay=-4;bay<=4;bay++){
        const bz=apronZ+bay*(buildingLength/9);
        box(frame,terminalWidth+14,2.8,1.6,terminalX,height+3.4,bz);
        add(new THREE.ConeGeometry(20,6.5,12),white,terminalX,height+1.8,bz,1.3,0.6,1.1);
      }
      const twH=code==='VTBS'||code==='WMKK'?112:82;
      add(new THREE.CylinderGeometry(4.4,6.4,twH,16),white,tX,twH*0.5,tZ);
      add(new THREE.CylinderGeometry(10.5,8.2,6.5,16),litGlass,tX,twH+2,tZ);
      stats.landmark=code+' Super-Truss Membrane Vaults & Ultra-Tall ATCT';
    }else if(code==='OMDB'||code==='OTHH'||code==='LTFM'){
      // Dubai Cigar Aerodynamic Shell / Doha Oasis Wave / Istanbul Ottoman Vaults & Tulip ATCT
      add(new THREE.CylinderGeometry(terminalWidth*0.52,terminalWidth*0.52,buildingLength*0.96,20),frame,terminalX,height*0.85,apronZ,1,0.42,1);
      add(new THREE.CylinderGeometry(terminalWidth*0.48,terminalWidth*0.48,buildingLength*0.92,20),litGlass,terminalX,height*0.92,apronZ,1,0.44,1);
      add(new THREE.CylinderGeometry(7.8,4.6,74,16),white,tX,37,tZ);
      add(new THREE.CylinderGeometry(12.5,7.8,8.5,16),litGlass,tX,76,tZ);
      stats.landmark=code+' Aerodynamic Teardrop Concourse & Crescent/Tulip ATCT';
    }else if(code==='EGLL'||code==='LFPG'||code==='EDDF'||code==='EHAM'||code==='LEMD'||code==='LIRF'||code==='LSZH'){
      // London Heathrow T5 / Paris CDG T1 Circular Drum / Frankfurt Squaire / Madrid T4 Bamboo Wave
      if(code==='LFPG'){
        add(new THREE.CylinderGeometry(48,48,height+6,24),white,back+side*38,(height+6)*0.5,apronZ);
        add(new THREE.CylinderGeometry(49,49,4.2,24),litGlass,back+side*38,height*0.7,apronZ);
      }
      const roofCol=code==='LEMD'?yellow:white;
      for(let b=-4;b<=4;b++){
        const bz=apronZ+b*(buildingLength/9);
        box(roofCol,terminalWidth+12,1.2,buildingLength/8.6,terminalX,height+2.2+Math.sin(b)*1.1,bz);
        box(code==='LEMD'?red:frame,1.4,height+2.4,1.4,gateWall-side*2.2,(height+2.4)*0.5,bz);
        box(code==='LEMD'?red:frame,1.4,height+2.4,1.4,back+side*2.2,(height+2.4)*0.5,bz);
      }
      add(new THREE.CylinderGeometry(3.8,4.2,78,16),frame,tX,39,tZ);
      add(new THREE.CylinderGeometry(12.8,5.5,7.5,16),litGlass,tX,80,tZ);
      add(new THREE.CylinderGeometry(0.6,0.9,14,8),yellow,tX,90,tZ);
      stats.landmark=code+' European Mega-Hub Vaulted Terminal & 87m Cone-Cab ATCT';
    }else{
      // All other international & regional airports (KORD, KSEA, CYYZ, CYVR, PHNL, PANC, YSSY, YMML, NZAA, SBGR, MMMX, SCEL, HECA, FAOR, etc.)
      for(let b=-2;b<=2;b++){
        const bz=apronZ+b*(buildingLength/5.2);
        box(white,terminalWidth+8,1.1,buildingLength/6,terminalX,height+1.6+(2-Math.abs(b))*0.7,bz);
        box(litGlass,terminalWidth*0.6,1.4,buildingLength/7,terminalX,height+2.4+(2-Math.abs(b))*0.7,bz);
      }
      add(new THREE.CylinderGeometry(4.2,5.4,48,14),white,tX,24,tZ);
      add(new THREE.CylinderGeometry(9.6,7.2,5.4,14),litGlass,tX,50,tZ);
      stats.landmark=code+' Custom Multi-Bay Skylight Terminal & Regional ATCT';
    }
  })();
  // Separate curtain-wall panes, mullions, recessed entrance doors and roof fascia.
  // All dimensions are metres; details remain outside the working jetway envelope.
  for(const wall of [gateWall-side*.16,back+side*.16]){
    for(let z=-buildingLength/2+4;z<buildingLength/2-3;z+=4){
      box(litGlass,.13,height*.43,3.7,wall,height*.55,apronZ+z);
      box(frame,.20,height*.52,.11,wall-side*.10,height*.54,apronZ+z-1.92);
      box(frame,.22,.12,3.95,wall-side*.12,height*.55,apronZ+z);
      stats.facadeBays++;
    }
    box(darkMetal,.23,.32,buildingLength,wall,height*.79,apronZ);
  }
  function sign(text,x,y,z,w=9,h=1.1){
    const c=document.createElement('canvas');c.width=512;c.height=64;
    const context=c.getContext('2d');context.fillStyle='#163e50';context.fillRect(0,0,512,64);
    context.fillStyle='#f4eed6';context.font='bold 32px sans-serif';context.textAlign='center';context.textBaseline='middle';context.fillText(text,256,33);
    const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;
    const m=mat('#ffffff',{map:texture,emissive:0xffffff,emissiveMap:texture,emissiveIntensity:.12});
    const geometry=new THREE.PlaneGeometry(w,h);geometry.rotateY(side*Math.PI/2);
    add(geometry,m,x,y,z);return m;
  }
  sign(airport.code+'  ARRIVALS  /  DEPARTURES',back+side*.3,height*.83,apronZ,22,1.5);
  for(const end of [-1,1]){
    const z=apronZ+end*buildingLength*.34;
    sign(end<0?'BUS  /  TAXI':'P  PARKING',back+side*7,3.8,z,8,1);
    for(const offset of [-3,-1.5,1.5,3])box(yellow,.12,.85,.12,back+side*8.4,.43,z+offset);
  }
  // Paving expansion joints, drainage grilles and protected pedestrian space.
  for(let z=-buildingLength/2+4;z<buildingLength/2;z+=6){
    box(frame,7.5,.012,.035,back+side*4.5,.158,apronZ+z);
    for(let d=-.8;d<=.8;d+=.2)box(drain,.55,.02,.055,roadX-side*7.15,.145,apronZ+z+d);
  }
  // Marked parking stays on the landside, clear of all gate/tug/taxi paths.
  const parkLength=Math.min(length-28,dense?240:140),parkWidth=dense?64:37;
  box(road,parkWidth,.13,parkLength,parkingX,.065,apronZ);
  for(const s of [-1,1])box(curb,.22,.19,parkLength,parkingX+s*parkWidth/2,.10,apronZ);
  // Access aisles connect to the main drop-off road at both ends of the car park.
  for(const end of [-1,1]){
    const z=apronZ+end*(parkLength/2-3.5),w=Math.abs(parkingX-roadX);
    box(road,w,.12,7,(parkingX+roadX)/2,.06,z);
    for(let x=Math.min(parkingX,roadX)+5;x<Math.max(parkingX,roadX)-4;x+=9)box(paint,3.5,.018,.10,x,.14,z);
  }
  const tones=['#b4c2c5','#d6d2c6','#42566a','#ae5746','#d4ad45','#77887a'];
  const carPaint=tones.map(c=>mat(c,{roughness:.49,metalness:.15}));
  function vehicle(x,z,tone,type='car'){
    const bus=type==='bus',truck=type==='truck',l=bus?10:truck?6.6:4.4,w=bus?2.4:truck?2.3:1.78;
    box(carPaint[tone%6],w,bus?2.3:truck?2:1.05,l,x,bus?1.6:truck?1.5:.88,z);
    box(glazing,w*.87,bus?.7:truck?.7:.57,l*(truck?.24:.63),x,bus?2.5:truck?2.3:1.62,z-(truck?l*.32:0));
    for(const sx of [-1,1])for(const sz of [-1,1]){
      const g=new THREE.CylinderGeometry(bus?.43:.31,bus?.43:.31,.23,9);g.rotateZ(Math.PI/2);
      add(g,rubber,x+sx*w*.49,bus?.48:.37,z+sz*l*.33);
    }
    box(lamp,w*.8,.13,.08,x,.98,z-l*.51);box(red,w*.76,.15,.08,x,.98,z+l*.51);
    stats.parkedVehicles++;
  }
  let n=0;
  for(const row of dense?[-22,-8,8,22]:[-10,10])for(let z=-parkLength/2+9;z<parkLength/2-6;z+=3){
    const x=parkingX+row,cz=apronZ+z;
    box(paint,5.3,.025,.08,x,.15,cz-1.45);
    box(paint,.1,.025,2.85,x+2.65,.15,cz);stats.parkingSpaces++;
    if(n++%4===0)continue;
    // Cars face across the parking aisle, perpendicular to the access road.
    const start=new Map([...batches].map(([m,p])=>[m,p.length]));
    vehicle(x,cz,n);
    const turn=new THREE.Matrix4().makeTranslation(-x,0,-cz);
    const restore=new THREE.Matrix4().makeTranslation(x,0,cz).multiply(new THREE.Matrix4().makeRotationY(Math.PI/2)).multiply(turn);
    for(const [m,parts] of batches)for(let i=start.get(m)??0;i<parts.length;i++)parts[i].applyMatrix4(restore);
  }
  vehicle(roadX-side*6,apronZ+buildingLength*.29,4,'bus');
  vehicle(roadX+side*6,apronZ-buildingLength*.28,4);
  // Small reusable vehicles: bodies, inset windows, bumpers and rolling wheels.
  // Traffic is confined to the landside road; it never enters a taxiway or gate.
  const traffic=new THREE.Group();traffic.name='Landside shuttle traffic';root.add(traffic);
  const moving=[],wheelGeometry=new THREE.CylinderGeometry(.34,.34,.2,10);wheelGeometry.rotateZ(Math.PI/2);
  function movingBox(group,material,w,h,d,x,y,z){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);mesh.position.set(x,y,z);group.add(mesh);return mesh;}
  for(let i=0;i<(dense?3:1);i++){
    const v=new THREE.Group(),bus=i===0,l=bus?8.6:4.6,w=bus?2.35:1.85;
    movingBox(v,bus?white:carPaint[i],w,bus?2.4:1.05,l,0,bus?1.65:.92,0);
    movingBox(v,glazing,w*.91,bus?.75:.58,l*.68,0,bus?2.55:1.62,0);
    if(bus){
      for(let z=-3;z<3.8;z+=1.15)movingBox(v,frame,w*.95,.84,.075,0,2.52,z);
      movingBox(v,blue,w+.025,.38,l+.02,0,1.35,0);
      movingBox(v,frame,w+.03,.2,l+.1,0,.65,0);
    }
    movingBox(v,lamp,w*.8,.18,.08,0,1,-l/2-.02);
    movingBox(v,red,w*.8,.15,.08,0,1,l/2+.02);
    const wheels=[];for(const sx of [-1,1])for(const sz of [-1,1]){
      const wheel=new THREE.Mesh(wheelGeometry,rubber);wheel.position.set(sx*w*.5,.37,sz*l*.34);v.add(wheel);wheels.push(wheel);
    }
    traffic.add(v);moving.push({root:v,wheels,distance:i*(length*.65+11),speed:bus?4.1:5.8});stats.movingVehicles++;
  }
  // A visiting regional jet occupies an outer stand, clear of the player stand.
  const standX=gateWall-side*33, standZ=apronZ+buildingLength*.34;
  function jetPart(material,x,y,z,sx,sy,sz){
    add(new THREE.SphereGeometry(1,sx>10?20:8,sx>10?12:4),material,standX+side*x,y,standZ+z,sx,sy,sz);
  }
  jetPart(white,0,2.9,0,12.6,1.46,1.5);
  jetPart(glazing,9.65,3.66,0,1.42,.45,.98);
  for(const wing of [-1,1]){
    for(let n=0;n<12;n++){
      jetPart(white,-n*.32,2.48,wing*(1.2+n*.79),3.55-n*.19,.19,.92);
    }
    jetPart(blue,-.45,1.77,wing*4.6,2.05,.61,.6);
    jetPart(darkMetal,1.24,1.77,wing*4.6,.32,.48,.48);
    jetPart(white,-9.25,3.4,wing*2.4,2.45,.16,2.55);
    jetPart(rubber,-1.25,.58,wing*2.15,.53,.53,.21);
    for(let n=0;n<16;n++)jetPart(glazing,6.8-n*.77,3.27,wing*(1.42*Math.sqrt(1-((6.8-n*.77)/12.6)**2)),.2,.24,.08);
  }
  jetPart(blue,-9.9,4.65,0,2.15,2.75,.2);
  jetPart(rubber,8.25,.5,0,.38,.43,.22);

  const truck=new THREE.Group();
  movingBox(truck,white,2.15,1.55,3.4,0,1.53,.55);
  movingBox(truck,yellow,2.05,1.45,1.5,0,1.36,-1.85);
  movingBox(truck,glazing,1.84,.55,.1,0,1.7,-2.63);
  const truckWheels=[];
  for(const sx of [-1,1])for(const axle of [-1.78,1.55]){
    const wheel=new THREE.Mesh(wheelGeometry,rubber);
    wheel.position.set(sx,.39,axle);truck.add(wheel);truckWheels.push(wheel);
  }
  traffic.add(truck);
  moving.push({root:truck,wheels:truckWheels,distance:0,speed:2.8,
    laneX:gateWall-side*9,laneZ:apronZ-buildingLength*.31,straight:buildingLength*.24});
  stats.movingVehicles++;
  // Airside equipment is parked off the centreline and away from the active central gate.
  for(const end of [-1,1]){
    const x=gateWall-side*12,z=apronZ+end*(buildingLength/2-17);
    box(white,2.2,1.3,3.5,x,.9,z);box(glazing,1.8,.48,1.1,x,1.55,z-1.2);
    for(let i=0;i<3;i++){
      box(frame,1.5,.7,2.8,x+side*(5+i*2.1),.55,z);box(rubber,1.6,.22,2,x+side*(5+i*2.1),.23,z);
    }
    box(brick,8,4,10,terminalX+side*8,2,z+end*18);box(frame,9,.3,11,terminalX+side*8,4.1,z+end*18);
  }
  // Chain-link panel texture is an original drawing; alpha-tested holes remain see-through.
  const canvas=document.createElement('canvas');canvas.width=canvas.height=64;
  const ctx=canvas.getContext('2d');ctx.strokeStyle='#c2c7c4';ctx.lineWidth=1.5;
  for(let i=-64;i<128;i+=16){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i+64,64);ctx.moveTo(i,0);ctx.lineTo(i-64,64);ctx.stroke();}
  const fenceTexture=new THREE.CanvasTexture(canvas);fenceTexture.colorSpace=THREE.SRGBColorSpace;
  fenceTexture.wrapS=fenceTexture.wrapT=THREE.RepeatWrapping;fenceTexture.repeat.set(3,1);
  const meshFence=mat('#979f9c',{map:fenceTexture,alphaTest:.35,side:THREE.DoubleSide});
  function fence(x,z,length){
    for(let start=-length/2;start<length/2;start+=6){
      add(new THREE.CylinderGeometry(.045,.045,2.4,6),frame,x,1.2,z+start);
      const panel=new THREE.PlaneGeometry(6,2.1);panel.rotateY(Math.PI/2);
      add(panel,meshFence,x,1.25,z+start+3);stats.fencePanels++;
    }
  }
  if(dense)fence(-side*148,0,airport.length-160);
  for(const end of [-1,1])fence(airport.apron+side*65,apronZ+end*(buildingLength/2+80),95);
  // Human-scale landscaping, with no crowns over access lanes or parking bays.
  const canopy=naturalTreeCrown(1);
  const leafy=[leaves,mat('#556849',{vertexColors:true}),mat('#3f6955',{vertexColors:true})];
  let treeNumber=0;
  for(let z=-parkLength/2+8;z<parkLength/2;z+=16){
    const x=parkingX+side*(parkWidth/2+6),cz=apronZ+z;
    box(grass,6,.15,11,x,.08,cz);box(curb,6.3,.10,11.3,x,.035,cz);
    const variation=(treeNumber*7%11)/10,h=5.2+variation*1.8,m=leafy[treeNumber++%3];
    add(new THREE.CylinderGeometry(.13,.19,h*.65,7),trunk,x,h*.325,cz);
    add(canopy.clone(),m,x,h,cz,2.25+variation*.45,2.35+variation*.6,2.2,z*.17);
    for(const s of [-1,1]){
      const branch=new THREE.CylinderGeometry(.055,.10,2.2,6);branch.rotateZ(s*.55);
      add(branch,trunk,x+s*.5,h*.63,cz+.25);
      add(canopy.clone(),m,x+s*1.4,h-s*.28,cz+s*.55,1.7,1.6+variation*.3,1.65,z*.37);
    }
    stats.trees++;
    pole(roadX+side*10.6,cz);
  }
  canopy.dispose();
  if(dense){
    // Bus shelter and pedestrian railings in front of the terminal.
    box(white,4,.2,12,roadX-side*11.7,3,apronZ+38);
    box(glazing,.12,2.7,11.5,roadX-side*13.5,1.55,apronZ+38);
    for(const z of [33,43])box(frame,3.6,.1,.12,roadX-side*11.7,.65,apronZ+z);
    for(let z=-length/2;z<length/2;z+=34)pole(gateWall-side*9,apronZ+z,9);
  }
  // Soft apron/road light pools use one batched transparent surface, no point lights.
  const glowCanvas=document.createElement('canvas');glowCanvas.width=glowCanvas.height=64;
  const glowContext=glowCanvas.getContext('2d'),gradient=glowContext.createRadialGradient(32,32,0,32,32,32);
  gradient.addColorStop(0,'rgba(255,224,159,.28)');gradient.addColorStop(1,'rgba(255,224,159,0)');
  glowContext.fillStyle=gradient;glowContext.fillRect(0,0,64,64);
  const glowTexture=new THREE.CanvasTexture(glowCanvas);glowTexture.colorSpace=THREE.SRGBColorSpace;
  const glow=new THREE.MeshBasicMaterial({map:glowTexture,transparent:true,depthWrite:false,opacity:0,polygonOffset:true,polygonOffsetFactor:-1});
  for(let z=-parkLength/2+8;z<parkLength/2;z+=16){
    const plane=new THREE.PlaneGeometry(17,21);plane.rotateX(-Math.PI/2);add(plane,glow,roadX+side*6,.155,apronZ+z);
  }
  // Original deterministic aggregate texture, mapped in metres rather than per box.
  const surface=document.createElement('canvas');surface.width=surface.height=128;
  const surfaceContext=surface.getContext('2d'),pixels=surfaceContext.createImageData(128,128);
  let noise=65497;
  for(let i=0;i<pixels.data.length;i+=4){
    noise=(Math.imul(noise,1664525)+1013904223)>>>0;
    const shade=226+(noise%29);pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=shade;pixels.data[i+3]=255;
  }
  surfaceContext.putImageData(pixels,0,0);
  const aggregate=new THREE.CanvasTexture(surface);aggregate.wrapS=aggregate.wrapT=THREE.RepeatWrapping;
  aggregate.colorSpace=THREE.SRGBColorSpace;aggregate.anisotropy=8;road.map=aggregate;paving.map=aggregate;
  for(const material of [road,paving])for(const g of batches.get(material)||[]){
    const positions=g.attributes.position,uv=g.attributes.uv;
    for(let i=0;i<positions.count;i++)uv.setXY(i,positions.getX(i)/7,positions.getZ(i)/7);
  }
  // Merge static geometry by material; hundreds of details cost only a few draws.
  for(const [material,parts] of batches){
    const geometry=new THREE.BufferGeometry();
    for(const [name,width] of [['position',3],['normal',3],['uv',2],['color',3]]){
      const array=new Float32Array(parts.reduce((n,g)=>n+g.attributes.position.count*width,0));let offset=0;
      if(name==='color')array.fill(1);
      for(const g of parts){if(g.attributes[name])array.set(g.attributes[name].array,offset);offset+=g.attributes.position.count*width;}
      geometry.setAttribute(name,new THREE.BufferAttribute(array,width));
    }
    geometry.computeBoundingSphere();const mesh=new THREE.Mesh(geometry,material);mesh.receiveShadow=true;root.add(mesh);
    parts.forEach(g=>g.dispose());
  }
  root.userData={...stats,roadX,parkingX,parkWidth,parkLength,source:'Original scenery fitted to existing layout'};
  let lastTime=performance.now();
  function update(x,z,day,quality){
    const now=performance.now(),dt=Math.min(.1,(now-lastTime)/1000);lastTime=now;
    root.visible=Math.hypot(x-airport.x,z-airport.z)<(quality==='ultra'?9500:quality==='high'?6500:3800);
    lamp.emissiveIntensity=day<.35?2.6*(1-day):.05;
    const night=THREE.MathUtils.clamp((.42-day)/.32,0,1);
    litGlass.emissiveIntensity=.04+night*1.25;glow.opacity=night;
    road.roughness=byId('weather').value==='wet'?.38:.91;
    traffic.visible=root.visible&&Math.hypot(x-airport.x,z-airport.z)<2400;
    if(traffic.visible)for(const v of moving){
      const r=3.3,straight=v.straight??(length-18),curve=Math.PI*r,lap=straight*2+curve*2;
      v.distance=(v.distance+dt*v.speed)%lap;
      let d=v.distance,cx,cz,yaw;
      if(d<straight){cx=-r;cz=-straight/2+d;yaw=Math.PI;}
      else if((d-=straight)<curve){const a=Math.PI-d/r;cx=r*Math.cos(a);cz=straight/2+r*Math.sin(a);yaw=-a;}
      else if((d-=curve)<straight){cx=r;cz=straight/2-d;yaw=0;}
      else{d-=straight;const a=-d/r;cx=r*Math.cos(a);cz=-straight/2+r*Math.sin(a);yaw=-a;}
      v.root.position.set((v.laneX??roadX)+cx,0,(v.laneZ??apronZ)+cz);v.root.rotation.y=yaw;
      for(const wheel of v.wheels)wheel.rotation.x-=dt*v.speed/.34;
    }
  }
  return {root,update,stats};
}
