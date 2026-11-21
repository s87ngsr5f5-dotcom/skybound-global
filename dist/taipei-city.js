'use strict';
// Offline OSM footprints, locally generated facades and original landmark models.
// City streaming is independent of the optional desktop forest/road layers.
function createTaipeiCity(scene,ground,airports){
  const root=new THREE.Group();root.name='Taipei 3D city';scene.add(root);
  const loaded=new Map(),pending=new Set(),failed=new Map();
  const masks=new Map();
  function mask(group,x0,z0,x1,z1){
    const rect=[x0,z0,x1,z1];
    for(let x=Math.floor(x0/100);x<=Math.floor(x1/100);x++)for(let z=Math.floor(z0/100);z<=Math.floor(z1/100);z++){
      const key=x+':'+z;if(!masks.has(key))masks.set(key,new Set());
      masks.get(key).add(rect);group.userData.masks.push([key,rect]);
    }
  }
  function blocked(x,z,radius){
    for(let cx=Math.floor((x-radius)/100);cx<=Math.floor((x+radius)/100);cx++)for(let cz=Math.floor((z-radius)/100);cz<=Math.floor((z+radius)/100);cz++){
      const cell=masks.get(cx+':'+cz);if(cell)for(const r of cell)if(x+radius>r[0]&&x-radius<r[2]&&z+radius>r[1]&&z-radius<r[3])return true;
    }
    return false;
  }
  const stats={buildings:0,tiles:0,roads:0,loading:0,vehicles:0,maskRevision:0};
  let index=null,indexRequest=false,nextScan=0,clock=0,jobs=[],day=1;
  const bounds=[24.97,121.43,25.14,121.65];
  const inside=(lat,lon)=>lat>=bounds[0]&&lat<=bounds[2]&&lon>=bounds[1]&&lon<=bounds[3];
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=128;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='#eee9e0';ctx.fillRect(0,0,256,128);
  for(let i=0;i<4;i++){
    ctx.fillStyle=i%2?'#455e69':'#71858c';ctx.fillRect(i*64+9,16,45,72);
    ctx.fillStyle='#b4c8cb';ctx.fillRect(i*64+11,18,20,65);
    ctx.fillStyle='#c7c3b8';ctx.fillRect(i*64+29,16,3,72);
    ctx.fillStyle='#999d98';ctx.fillRect(i*64+8,96,47,12);
  }
  const facade=new THREE.CanvasTexture(canvas);facade.colorSpace=THREE.SRGBColorSpace;
  facade.wrapS=facade.wrapT=THREE.RepeatWrapping;facade.anisotropy=8;
  const night=document.createElement('canvas');night.width=256;night.height=128;
  const ink=night.getContext('2d');ink.fillStyle='#000';ink.fillRect(0,0,256,128);
  for(let i=0;i<4;i++){ink.fillStyle=i===1?'#d7b37c':'#080c10';ink.fillRect(i*64+11,18,40,66);}
  const lights=new THREE.CanvasTexture(night);lights.wrapS=lights.wrapT=THREE.RepeatWrapping;
  // Procedural PBR Multi-Lane Asphalt, Curb, Roughness & Illuminated Night Streetlamp Texture
  function makeRoadTextures(){
    const dayC=document.createElement('canvas');dayC.width=512;dayC.height=512;
    const d=dayC.getContext('2d');
    d.fillStyle='#8d9092';d.fillRect(0,0,512,512); // outer concrete curb & shoulder
    d.fillStyle='#5c6064';d.fillRect(16,0,480,512); // curb bevel shadow
    d.fillStyle='#31353a';d.fillRect(24,0,464,512); // main asphalt carriageways
    for(let i=0;i<7200;i++){
      const px=24+((i*173)%464),py=(i*311)%512;
      d.fillStyle=i%3===0?'#3b4046':i%2===0?'#272a2e':'#43474d';
      d.fillRect(px,py,2,2);
    }
    // Longitudinal rubber tire wear channels inside 4 lanes
    for(const lx of [102,190,322,410]){
      const wg=d.createLinearGradient(lx-32,0,lx+32,0);
      wg.addColorStop(0,'rgba(22,25,28,0)');
      wg.addColorStop(.32,'rgba(18,20,23,0.42)');
      wg.addColorStop(.5,'rgba(26,29,33,0.12)');
      wg.addColorStop(.68,'rgba(18,20,23,0.42)');
      wg.addColorStop(1,'rgba(22,25,28,0)');
      d.fillStyle=wg;d.fillRect(lx-32,0,64,512);
    }
    // Shoulder solid white fog lines
    d.fillStyle='#e8e6d8';d.fillRect(34,0,6,512);d.fillRect(472,0,6,512);
    // Double yellow Taiwan center divider
    d.fillStyle='#e8b838';d.fillRect(249,0,5,512);d.fillRect(258,0,5,512);
    // Crisp dashed white lane dividers
    d.fillStyle='#ecece4';
    for(let y=16;y<512;y+=128){d.fillRect(142,y,5,68);d.fillRect(365,y,5,68);}

    const nightC=document.createElement('canvas');nightC.width=512;nightC.height=512;
    const n=nightC.getContext('2d');
    n.fillStyle='#000';n.fillRect(0,0,512,512);
    // Warm sodium & LED streetlamp pools along both shoulders
    for(const sy of [128,384]){
      for(const sx of [52,460]){
        const g=n.createRadialGradient(sx,sy,4,sx,sy,155);
        g.addColorStop(0,'rgba(255,222,168,0.88)');
        g.addColorStop(0.28,'rgba(255,180,94,0.46)');
        g.addColorStop(0.68,'rgba(230,132,58,0.14)');
        g.addColorStop(1,'rgba(0,0,0,0)');
        n.fillStyle=g;n.fillRect(0,sy-160,512,320);
      }
    }
    // Nighttime illuminated center reflectors & directional headlight/taillight streaks
    n.fillStyle='rgba(255,208,90,0.42)';n.fillRect(250,0,12,512);
    for(let y=28;y<512;y+=128){
      n.fillStyle='rgba(255,244,210,0.85)';n.fillRect(92,y,5,9);n.fillRect(114,y,5,9);
      n.fillStyle='rgba(255,56,42,0.85)';n.fillRect(390,y+44,5,8);n.fillRect(412,y+44,5,8);
      n.fillStyle='rgba(255,244,210,0.65)';n.fillRect(178,y+64,4,8);n.fillRect(198,y+64,4,8);
      n.fillStyle='rgba(255,56,42,0.70)';n.fillRect(308,y+8,4,8);n.fillRect(328,y+8,4,8);
    }

    const roughC=document.createElement('canvas');roughC.width=256;roughC.height=256;
    const rc=roughC.getContext('2d');rc.fillStyle='#cfcfcf';rc.fillRect(0,0,256,256);
    for(const lx of [51,95,161,205]){rc.fillStyle='#727272';rc.fillRect(lx-10,0,20,256);}

    const map=new THREE.CanvasTexture(dayC);map.wrapS=THREE.ClampToEdgeWrapping;map.wrapT=THREE.RepeatWrapping;map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=8;
    const eMap=new THREE.CanvasTexture(nightC);eMap.wrapS=THREE.ClampToEdgeWrapping;eMap.wrapT=THREE.RepeatWrapping;eMap.colorSpace=THREE.SRGBColorSpace;eMap.anisotropy=4;
    const rMap=new THREE.CanvasTexture(roughC);rMap.wrapS=THREE.ClampToEdgeWrapping;rMap.wrapT=THREE.RepeatWrapping;
    return {map,eMap,rMap};
  }
  const roadTex=makeRoadTextures();
  const asphalt=new THREE.MeshStandardMaterial({color:0xffffff,map:roadTex.map,roughnessMap:roadTex.rMap,roughness:.86,emissive:0xffd89c,emissiveMap:roadTex.eMap,emissiveIntensity:0,side:THREE.DoubleSide});
  const concreteCurb=new THREE.MeshStandardMaterial({color:0xb9bec2,roughness:.85,vertexColors:true});
  const stripe=new THREE.MeshStandardMaterial({color:0xf3efd9,roughness:.82,emissive:0xffebb5,emissiveIntensity:0,side:THREE.DoubleSide});
  const water=new THREE.MeshStandardMaterial({color:0x486f76,roughness:.3,metalness:.2,side:THREE.DoubleSide});
  for(const mat of [asphalt,stripe,water]){mat.polygonOffset=true;mat.polygonOffsetFactor=-3;mat.polygonOffsetUnits=-3;}
  const officeCanvas=document.createElement('canvas');officeCanvas.width=officeCanvas.height=256;
  const oi=officeCanvas.getContext('2d');
  const officeNight=document.createElement('canvas');officeNight.width=officeNight.height=256;
  const ni=officeNight.getContext('2d');ni.fillStyle='#000';ni.fillRect(0,0,256,256);
  const roughCanvas=document.createElement('canvas');roughCanvas.width=roughCanvas.height=256;
  const ri=roughCanvas.getContext('2d');ri.fillStyle='#999';ri.fillRect(0,0,256,256);
  oi.fillStyle='#1c2429';oi.fillRect(0,0,256,256);
  for(let row=0;row<4;row++)for(let col=0;col<4;col++){
    const x=col*64,y=row*64;
    oi.fillStyle='#27333b';oi.fillRect(x+2,y+2,60,8);
    ri.fillStyle='#777';ri.fillRect(x+2,y+2,60,8);
    const reflection=oi.createLinearGradient(x+3,y+12,x+61,y+60);
    reflection.addColorStop(0,['#4b6e82','#5c8296','#436376','#648b9f'][(row+col)%4]);
    reflection.addColorStop(.48,'#1c3445');
    reflection.addColorStop(.52,'#244254');
    reflection.addColorStop(1,'#6b8fa1');
    oi.fillStyle=reflection;oi.fillRect(x+3,y+12,58,48);
    oi.fillStyle='#222b31';oi.fillRect(x+31,y+12,2,48);
    oi.fillStyle='#4c5d67';oi.fillRect(x+32,y+12,.8,48);
    ri.fillStyle='#292929';ri.fillRect(x+3,y+12,58,48);
    if((row*5+col*7)%9<4){
      const warm=(row+col)%3!==0;
      ni.fillStyle=warm?'#fce0b0':'#d2e8f7';
      ni.fillRect(x+5,y+14,54,44);
      ni.fillStyle=warm?'#fff4d8':'#f0f8ff';
      ni.fillRect(x+7,y+20,50,4);
      ni.fillRect(x+7,y+32,50,4);
      ni.fillRect(x+7,y+44,50,4);
    }
  }
  function repeatTexture(canvas,color=false){const t=new THREE.CanvasTexture(canvas);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=8;if(color)t.colorSpace=THREE.SRGBColorSpace;return t;}
  const reflectedCity=document.createElement('canvas');reflectedCity.width=1024;reflectedCity.height=512;
  const reflected=reflectedCity.getContext('2d'),sky=reflected.createLinearGradient(0,0,0,512);
  sky.addColorStop(0,'#1c4270');sky.addColorStop(.36,'#497fa9');sky.addColorStop(.52,'#98bfd4');
  sky.addColorStop(.56,'#c8dbe4');sky.addColorStop(.60,'#4c5d68');sky.addColorStop(1,'#2c373d');
  reflected.fillStyle=sky;reflected.fillRect(0,0,1024,512);
  reflected.fillStyle='#3e4e58';
  reflected.beginPath();reflected.moveTo(0,307);
  for(let x=0;x<=1024;x+=32){reflected.lineTo(x,295-Math.sin(x*.02)*18-Math.cos(x*.007)*14);}
  reflected.lineTo(1024,350);reflected.lineTo(0,350);reflected.fill();
  for(let i=0;i<64;i++){
    const x=i*16,h=28+(i*53%135);reflected.fillStyle=['#556874','#6d808c','#485a65','#7a8e9b'][i%4];
    reflected.fillRect(x,300-h,13,h+120);
    reflected.fillStyle='#c8dbe2';for(let y=308-h;y<360;y+=8)reflected.fillRect(x+2,y,9,1.8);
  }
  const reflectedMap=new THREE.CanvasTexture(reflectedCity);reflectedMap.colorSpace=THREE.SRGBColorSpace;
  reflectedMap.mapping=THREE.EquirectangularReflectionMapping;
  const officeGlass=new THREE.MeshPhysicalMaterial({map:repeatTexture(officeCanvas,true),roughnessMap:repeatTexture(roughCanvas),
    color:0x36586c,metalness:.82,roughness:.22,clearcoat:1.0,clearcoatRoughness:.09,envMap:reflectedMap,envMapIntensity:1.15,
    emissiveMap:repeatTexture(officeNight),emissive:0xffdfab,emissiveIntensity:0,side:THREE.DoubleSide});
  // Multi-Archetype PBR Facade & Roof System (4 wall styles + 2 roof styles, 256x256 pure 2D Canvas)
  function makePrng(seed){
    let s=seed>>>0;
    return ()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};
  }
  function makeCanvasPair(){
    const dayC=document.createElement('canvas');dayC.width=dayC.height=256;
    const nightC=document.createElement('canvas');nightC.width=nightC.height=256;
    const d=dayC.getContext('2d'),n=nightC.getContext('2d');
    n.fillStyle='#000';n.fillRect(0,0,256,256);
    return {dayC,nightC,d,n};
  }
  // Style 0: Taiwanese Mosaic Tile & Balcony Apartment (磁磚公寓 / 陽台 / 室外機 / 騎樓店面)
  function makeAptTextures(){
    const {dayC,nightC,d,n}=makeCanvasPair(),rnd=makePrng(104729);
    d.fillStyle='#ece9e2';d.fillRect(0,0,256,256);
    // Fine Taiwanese ceramic mosaic tile grid with mortar joints
    for(let ty=0;ty<256;ty+=8){
      const off=(ty/8)%2?6:0;
      for(let tx=-6;tx<256;tx+=12){
        const v=226+Math.floor(rnd()*22);
        d.fillStyle=`rgb(${v+2},${v},${v-4})`;
        d.fillRect(tx+off+1,ty+1,11,7);
      }
    }
    d.fillStyle='rgba(110,106,98,0.28)';
    for(let ty=0;ty<256;ty+=8)d.fillRect(0,ty,256,1);
    // Subtle subtropical rain patina beneath ledges
    for(let i=0;i<24;i++){
      const sx=Math.floor(rnd()*256),sy=Math.floor(rnd()*240);
      d.fillStyle='rgba(78,74,68,0.06)';d.fillRect(sx,sy,2+Math.floor(rnd()*4),10+Math.floor(rnd()*18));
    }
    // Floor slab ledges between 4 floors
    for(let row=0;row<4;row++){
      const y=row*64;
      d.fillStyle='#f6f4ef';d.fillRect(0,y,256,3);
      d.fillStyle='rgba(50,47,42,0.34)';d.fillRect(0,y+3,256,3);
    }
    // Rows 0..2: upper residential floors (alternating recessed balconies & grilled windows)
    for(let row=0;row<3;row++){
      for(let col=0;col<4;col++){
        const bx=col*64,by=row*64,isBalcony=(row+col)%2===0;
        if(isBalcony){
          // Recessed balcony shadow cavity
          const rec=d.createLinearGradient(bx+5,by+8,bx+5,by+58);
          rec.addColorStop(0,'#464c52');rec.addColorStop(.5,'#646a70');rec.addColorStop(1,'#53585e');
          d.fillStyle=rec;d.fillRect(bx+5,by+8,54,49);
          // Sliding balcony door inside recess
          const dg=d.createLinearGradient(bx+9,by+11,bx+43,by+43);
          dg.addColorStop(0,'#394f5e');dg.addColorStop(.45,'#263844');dg.addColorStop(.55,'#6c8c9e');dg.addColorStop(1,'#2c404d');
          d.fillStyle=dg;d.fillRect(bx+9,by+11,34,34);
          d.strokeStyle='#d9dfe4';d.lineWidth=1.5;d.strokeRect(bx+9.5,by+11.5,33,33);
          d.fillStyle='#d5dce0';d.fillRect(bx+25,by+11,2,34);
          // Balcony parapet curb + white/silver steel railing
          d.fillStyle='#dedcd6';d.fillRect(bx+5,by+48,54,9);
          d.fillStyle='#f4f6f8';d.fillRect(bx+5,by+35,54,2.5);
          d.fillStyle='rgba(30,34,38,0.30)';d.fillRect(bx+5,by+37.5,54,2);
          d.fillStyle='#e2e6ea';
          for(let rx=bx+9;rx<bx+56;rx+=6)d.fillRect(rx,by+36,1.6,12);
          // Exterior split AC condenser unit mounted on right side of balcony
          d.fillStyle='#e2e5e8';d.fillRect(bx+44,by+24,13,10);
          d.fillStyle='#b8bec4';d.fillRect(bx+44,by+33,13,1.5);
          d.fillStyle='#3b4248';d.beginPath();d.arc(bx+49,by+29,3.5,0,Math.PI*2);d.fill();
          d.fillStyle='#9aa3ab';d.fillRect(bx+54,by+26,2,6);
          if((row+col)%4===0){
            // Tiny potted greenery accent on balcony rail
            d.fillStyle='#5b8052';d.fillRect(bx+11,by+31,9,4);
            d.fillStyle='#a86d54';d.fillRect(bx+12,by+34,7,2);
          }
          if((row*3+col*5)%7<3){
            const cool=(row+col)%4===2;
            n.fillStyle=cool?'#cbe8ff':((row+col)%3?'#ffd490':'#ffe8bc');
            n.fillRect(bx+11,by+13,30,22);
            n.fillStyle='rgba(0,0,0,0.35)';n.fillRect(bx+25,by+13,2,22);
          }
        }else{
          // Recessed dark aluminum sliding window + sill + optional iron grille (鐵窗)
          d.fillStyle='#f2f0ea';d.fillRect(bx+7,by+11,50,36);
          d.fillStyle='#3b4248';d.fillRect(bx+9,by+13,46,32);
          const wg=d.createLinearGradient(bx+10,by+14,bx+54,by+44);
          wg.addColorStop(0,'#4e6a7c');wg.addColorStop(.5,'#2c404e');wg.addColorStop(.58,'#7ea0b2');wg.addColorStop(1,'#324756');
          d.fillStyle=wg;d.fillRect(bx+10,by+14,44,30);
          d.fillStyle='#cfd6dc';d.fillRect(bx+31,by+14,2,30);d.fillRect(bx+10,by+28,44,1.5);
          if((row+col)%3===1){
            d.fillStyle='rgba(232,238,242,0.52)';
            for(let gx=bx+14;gx<bx+53;gx+=6)d.fillRect(gx,by+15,1,28);
            d.fillRect(bx+10,by+21,44,1);d.fillRect(bx+10,by+36,44,1);
          }
          // Projecting sill & shadow
          d.fillStyle='#f5f3ee';d.fillRect(bx+6,by+46,52,3.5);
          d.fillStyle='rgba(45,42,38,0.32)';d.fillRect(bx+6,by+49.5,52,2.5);
          // Compact AC unit tucked under right sill
          if((row+col)%2===1){
            d.fillStyle='#dfe3e6';d.fillRect(bx+43,by+50,13,10);
            d.fillStyle='#3d454c';d.beginPath();d.arc(bx+48,by+55,3.2,0,Math.PI*2);d.fill();
          }
          if((row*5+col*3)%6<3){
            const warm=(row+col)%3!==0;
            n.fillStyle=warm?'#ffd898':'#d2ecff';
            n.fillRect(bx+11,by+15,42,28);
            n.fillStyle='rgba(0,0,0,0.42)';n.fillRect(bx+31,by+15,2,28);
            for(let sy=by+19;sy<by+42;sy+=5)n.fillRect(bx+11,sy,42,1);
          }
        }
      }
    }
    // Row 3 (bottom 64px, v=0..0.25): ground-floor retail storefront & 騎樓 arcade strip
    for(let col=0;col<4;col++){
      const bx=col*64,by=192;
      // Arcade columns & plinth
      d.fillStyle='#e2dfd8';d.fillRect(bx,by+4,7,60);d.fillRect(bx+57,by+4,7,60);
      d.fillStyle='#b6b2aa';d.fillRect(bx,by+54,7,10);d.fillRect(bx+57,by+54,7,10);
      // Shopfront signboard fascia & awning shadow
      d.fillStyle='#f3ede0';d.fillRect(bx+7,by+6,50,10);
      d.fillStyle=['#c88e68','#6a8f88','#b87a70','#7d8fa4'][col];d.fillRect(bx+10,by+8,44,5);
      d.fillStyle='rgba(30,28,24,0.45)';d.fillRect(bx+7,by+16,50,4);
      // Warm-lit retail glass storefront
      const sg=d.createLinearGradient(bx+8,by+20,bx+8,by+62);
      sg.addColorStop(0,'#5d5040');sg.addColorStop(.55,'#9c7e58');sg.addColorStop(1,'#c6a16e');
      d.fillStyle=sg;d.fillRect(bx+8,by+20,48,40);
      d.fillStyle='#d4d8dc';d.fillRect(bx+31,by+20,2,40);d.fillRect(bx+8,by+34,48,1.5);
      d.fillStyle='#8c8a84';d.fillRect(bx+7,by+60,50,4);
      if(col!==2){
        n.fillStyle=col===1?'#ffe5b0':'#ffc978';
        n.fillRect(bx+9,by+22,46,36);
        n.fillStyle='rgba(0,0,0,0.45)';n.fillRect(bx+31,by+22,2,36);n.fillRect(bx+9,by+34,46,2);
      }
    }
    return {map:repeatTexture(dayC,true),emissiveMap:repeatTexture(nightC)};
  }
  // Style 1: Modern Glass Curtain-Wall High-Rise (帷幕玻璃高樓)
  function makeGlassTextures(){
    const {dayC,nightC,d,n}=makeCanvasPair();
    d.fillStyle='#2a343d';d.fillRect(0,0,256,256);
    for(let row=0;row<4;row++){
      for(let col=0;col<4;col++){
        const bx=col*64,by=row*64;
        // Horizontal brushed metallic spandrel band
        const sp=d.createLinearGradient(bx,by+1,bx,by+16);
        sp.addColorStop(0,'#8c9ca8');sp.addColorStop(.5,'#6b7c88');sp.addColorStop(1,'#4d5c66');
        d.fillStyle=sp;d.fillRect(bx+2,by+1,60,14);
        d.fillStyle='#b8c9d4';d.fillRect(bx+2,by+2,60,1.5);
        d.fillStyle='#202930';d.fillRect(bx+2,by+15,60,2);
        // Vision glass panels with coherent diagonal sky sheen (bright so vertex tint shines)
        const gg=d.createLinearGradient(bx+2,by+17,bx+62,by+62);
        gg.addColorStop(0,['#c6dfec','#d4e8f4','#b8d4e4','#cce2ef'][(row+col)%4]);
        gg.addColorStop(.38,'#8db1c4');
        gg.addColorStop(.52,'#6e94aa');
        gg.addColorStop(.62,'#b7d5e5');
        gg.addColorStop(1,'#e2f0f8');
        d.fillStyle=gg;d.fillRect(bx+2,by+17,60,45);
        // Subtle interior ceiling & blind depth
        d.fillStyle='rgba(255,255,255,0.18)';d.fillRect(bx+4,by+19,56,4);
        if((row+col)%3===0){
          d.fillStyle='rgba(30,45,58,0.16)';d.fillRect(bx+3,by+18,58,14);
        }
        // Crisp center & quarter vertical mullions with specular edge
        d.fillStyle='#28323b';d.fillRect(bx+31,by+1,2.2,62);
        d.fillStyle='rgba(235,246,255,0.45)';d.fillRect(bx+33.2,by+17,1,45);
        d.fillStyle='#35424d';d.fillRect(bx+2,by+43,60,1.4);
        // Night office lighting
        if((row*7+col*5)%9<5){
          const cool=(row+col)%3===0;
          n.fillStyle=cool?'#d2ecff':'#ffe4b5';
          n.fillRect(bx+4,by+19,56,41);
          n.fillStyle=cool?'#f2faff':'#fff6de';
          n.fillRect(bx+6,by+23,52,3);n.fillRect(bx+6,by+34,52,3);n.fillRect(bx+6,by+47,52,3);
          n.fillStyle='rgba(0,0,0,0.65)';n.fillRect(bx+31,by+19,2.5,41);
        }
      }
    }
    // Global diagonal sky reflection streak across curtain grid
    const sheen=d.createLinearGradient(0,0,256,256);
    sheen.addColorStop(0,'rgba(255,255,255,0.08)');sheen.addColorStop(.44,'rgba(255,255,255,0)');
    sheen.addColorStop(.5,'rgba(255,255,255,0.22)');sheen.addColorStop(.56,'rgba(255,255,255,0)');
    sheen.addColorStop(1,'rgba(255,255,255,0.06)');
    d.fillStyle=sheen;d.fillRect(0,0,256,256);
    return {map:repeatTexture(dayC,true),emissiveMap:repeatTexture(nightC)};
  }
  // Style 2: Classic Brick / Warm Terracotta / Heritage Shophouse (紅磚 / 老屋街屋)
  function makeBrickTextures(){
    const {dayC,nightC,d,n}=makeCanvasPair(),rnd=makePrng(229937);
    d.fillStyle='#b8afa4';d.fillRect(0,0,256,256); // sand-colored mortar
    // Running-bond masonry brick courses (bright warm-neutral so vertex palette tints richly)
    for(let row=0;row<32;row++){
      const y=row*8,off=(row%2)*8;
      for(let x=-8;x<256;x+=16){
        const shade=216+Math.floor(rnd()*30);
        d.fillStyle=`rgb(${Math.min(255,shade+6)},${shade},${Math.max(0,shade-8)})`;
        d.fillRect(x+off+1,y+1,14.4,6.4);
      }
    }
    // Classical horizontal cornice moldings between floors
    for(let row=0;row<4;row++){
      const y=row*64;
      d.fillStyle='#f6f2eb';d.fillRect(0,y,256,3.5);
      d.fillStyle='#d8d0c5';d.fillRect(0,y+3.5,256,3);
      d.fillStyle='rgba(55,44,36,0.34)';d.fillRect(0,y+6.5,256,3);
    }
    // Rows 0..2: classic arched & framed heritage windows with shutters / awnings
    for(let row=0;row<3;row++){
      for(let col=0;col<4;col++){
        const bx=col*64,by=row*64;
        const arched=(row+col)%2===0;
        // Decorative stone arch/lintel surround
        d.fillStyle='#f2ede3';
        if(arched){
          d.beginPath();d.arc(bx+32,by+24,18,Math.PI,0);d.lineTo(bx+50,by+50);d.lineTo(bx+14,by+50);d.closePath();d.fill();
          d.fillStyle='#353f48';
          d.beginPath();d.arc(bx+32,by+25,14,Math.PI,0);d.lineTo(bx+46,by+48);d.lineTo(bx+18,by+48);d.closePath();d.fill();
          // Window glass reflection & divided muntins
          d.fillStyle='#5c7585';d.fillRect(bx+20,by+24,11,22);
          d.fillStyle='#dad4c8';d.fillRect(bx+31,by+12,2,36);d.fillRect(bx+18,by+25,28,2);d.fillRect(bx+18,by+36,28,1.5);
        }else{
          // Framed window with flanking louvered shutters
          d.fillRect(bx+13,by+11,38,4);
          d.fillStyle='#a8a095';d.fillRect(bx+6,by+15,9,33);d.fillRect(bx+49,by+15,9,33);
          d.fillStyle='rgba(48,40,34,0.35)';
          for(let sy=by+18;sy<by+46;sy+=4){d.fillRect(bx+7,sy,7,1.4);d.fillRect(bx+50,sy,7,1.4);}
          d.fillStyle='#36414a';d.fillRect(bx+16,by+15,32,33);
          d.fillStyle='#637d8c';d.fillRect(bx+18,by+17,13,29);
          d.fillStyle='#dcd5c8';d.fillRect(bx+31,by+15,2,33);d.fillRect(bx+16,by+30,32,1.6);
          if(col===1){
            // Sloped canvas window awning
            d.fillStyle='#eae2d2';d.fillRect(bx+14,by+14,36,7);
            d.fillStyle='#8c7e70';for(let ax=bx+16;ax<bx+49;ax+=6)d.fillRect(ax,by+14,3,7);
            d.fillStyle='rgba(35,28,22,0.38)';d.fillRect(bx+15,by+21,34,3);
          }
        }
        // Projecting stone sill + cast shadow
        d.fillStyle='#f4efe6';d.fillRect(bx+12,by+49,40,3.5);
        d.fillStyle='rgba(46,38,30,0.36)';d.fillRect(bx+12,by+52.5,40,2.5);
        if((row*5+col*3)%7<3){
          n.fillStyle=(row+col)%2?'#ffc978':'#ffe1a6';
          n.fillRect(bx+19,by+18,26,28);
          n.fillStyle='rgba(0,0,0,0.5)';n.fillRect(bx+31,by+18,2,28);n.fillRect(bx+19,by+30,26,2);
        }
      }
    }
    // Row 3 (bottom 64px): warm heritage shophouse arcade base & striped awning
    for(let col=0;col<4;col++){
      const bx=col*64,by=192;
      // Masonry piers
      d.fillStyle='#dcd4c8';d.fillRect(bx,by+8,9,56);d.fillRect(bx+55,by+8,9,56);
      d.fillStyle='#efe9de';d.fillRect(bx,by+52,9,12);d.fillRect(bx+55,by+52,9,12);
      // Striped heritage shophouse awning
      d.fillStyle='#f2eadc';d.fillRect(bx+9,by+10,46,10);
      d.fillStyle='#9e826c';for(let ax=bx+10;ax<bx+54;ax+=8)d.fillRect(ax,by+10,4,10);
      d.fillStyle='rgba(34,24,18,0.44)';d.fillRect(bx+9,by+20,46,4);
      // Warm-toned wooden shopfront display window
      const wg=d.createLinearGradient(bx+10,by+24,bx+10,by+60);
      wg.addColorStop(0,'#5e4c3a');wg.addColorStop(.5,'#a68052');wg.addColorStop(1,'#cfa36a');
      d.fillStyle=wg;d.fillRect(bx+10,by+24,44,36);
      d.fillStyle='#e4dccf';d.fillRect(bx+31,by+24,2,36);d.fillRect(bx+10,by+36,44,1.6);
      d.fillStyle='#8c8276';d.fillRect(bx+9,by+60,46,4);
      if(col!==3){
        n.fillStyle=col%2?'#ffca74':'#ffe0a2';
        n.fillRect(bx+12,by+25,40,33);
        n.fillStyle='rgba(0,0,0,0.45)';n.fillRect(bx+31,by+25,2,33);
      }
    }
    return {map:repeatTexture(dayC,true),emissiveMap:repeatTexture(nightC)};
  }
  // Style 3: Modern Stucco / Granite Condo & Institutional (現代石材豪宅 / 水平深陽台 / 玻璃欄杆)
  function makeCondoTextures(){
    const {dayC,nightC,d,n}=makeCanvasPair(),rnd=makePrng(311911);
    d.fillStyle='#eeede9';d.fillRect(0,0,256,256);
    // Large honed granite/stone ashlar panels (32x32px) with subtle stone grain
    for(let py=0;py<256;py+=32){
      for(let px=0;px<256;px+=32){
        const v=228+Math.floor(rnd()*16);
        d.fillStyle=`rgb(${v+1},${v},${v-2})`;d.fillRect(px+1,py+1,30.5,30.5);
      }
    }
    d.fillStyle='rgba(92,96,104,0.24)';
    for(let i=0;i<256;i+=32){d.fillRect(0,i,256,1);d.fillRect(i,0,1,256);}
    // Rows 0..2: sleek cantilevered slabs, deep recessed glazing, glass balustrades, vertical fins
    for(let row=0;row<3;row++){
      const by=row*64;
      // Sleek cantilevered horizontal architectural band + deep cast shadow
      d.fillStyle='#f7f7f4';d.fillRect(0,by,256,9);
      d.fillStyle='#d8d7d2';d.fillRect(0,by+8,256,2);
      d.fillStyle='rgba(32,38,44,0.45)';d.fillRect(0,by+10,256,4);
      for(let col=0;col<4;col++){
        const bx=col*64;
        // Crisp vertical architectural stone/metal fin
        d.fillStyle='#f3f2ee';d.fillRect(bx,by+9,7,55);
        d.fillStyle='rgba(40,45,52,0.28)';d.fillRect(bx+7,by+10,3,54);
        // Recessed floor-to-ceiling balcony glazing
        const cg=d.createLinearGradient(bx+10,by+12,bx+60,by+58);
        cg.addColorStop(0,'#455b6c');cg.addColorStop(.45,'#2a3b48');cg.addColorStop(.56,'#7393a6');cg.addColorStop(1,'#344858');
        d.fillStyle=cg;d.fillRect(bx+10,by+12,51,48);
        d.fillStyle='#2a333c';d.fillRect(bx+34,by+12,2,48);
        // Translucent modern glass balustrade + brushed stainless handrail
        d.fillStyle='rgba(182,214,232,0.52)';d.fillRect(bx+10,by+41,51,19);
        d.fillStyle='#f0f4f8';d.fillRect(bx+10,by+40,51,2.2);
        d.fillStyle='rgba(235,244,250,0.45)';d.fillRect(bx+10,by+44,51,1.2);
        d.fillStyle='#cfd8e0';d.fillRect(bx+27,by+41,1.4,19);d.fillRect(bx+44,by+41,1.4,19);
        if((row*5+col*7)%8<4){
          const warm=(row+col)%4!==0;
          n.fillStyle=warm?'#ffe0ab':'#dff1ff';
          n.fillRect(bx+12,by+15,47,26);
          n.fillStyle='rgba(0,0,0,0.5)';n.fillRect(bx+34,by+15,2,26);
        }
      }
    }
    // Row 3 (bottom 64px): clean granite stone-panel podium / lobby base
    d.fillStyle='#f5f4f0';d.fillRect(0,192,256,8);
    d.fillStyle='rgba(30,36,42,0.42)';d.fillRect(0,200,256,4);
    for(let col=0;col<4;col++){
      const bx=col*64,by=192;
      d.fillStyle='#e6e4de';d.fillRect(bx,by+8,11,56);d.fillRect(bx+56,by+8,8,56);
      const lg=d.createLinearGradient(bx+11,by+12,bx+56,by+62);
      lg.addColorStop(0,'#3b5060');lg.addColorStop(.6,'#627a88');lg.addColorStop(1,'#b29c7a');
      d.fillStyle=lg;d.fillRect(bx+11,by+12,45,48);
      d.fillStyle='#dde3e8';d.fillRect(bx+32,by+12,1.8,48);
      d.fillStyle='#c4c6c8';d.fillRect(bx+11,by+60,45,4);
      if(col===0||col===2){
        n.fillStyle='#ffe6b8';n.fillRect(bx+13,by+16,41,42);
        n.fillStyle='rgba(0,0,0,0.4)';n.fillRect(bx+32,by+16,2,42);
      }
    }
    return {map:repeatTexture(dayC,true),emissiveMap:repeatTexture(nightC)};
  }
  // Roof 0: Taiwanese Flat Rooftop (防水塗層 / 混凝土分格 / 不鏽鋼水塔 / 空調主機)
  function makeRoofFlatTexture(){
    const c=document.createElement('canvas');c.width=c.height=256;
    const d=c.getContext('2d'),rnd=makePrng(409913);
    d.fillStyle='#dfe2df';d.fillRect(0,0,256,256);
    for(let y=0;y<256;y+=32)for(let x=0;x<256;x+=32){
      const v=216+Math.floor(rnd()*22);
      d.fillStyle=`rgb(${v},${v+2},${v})`;d.fillRect(x+1,y+1,30,30);
    }
    d.fillStyle='rgba(85,90,88,0.20)';
    for(let i=0;i<256;i+=32){d.fillRect(0,i,256,1.2);d.fillRect(i,0,1.2,256);}
    for(let i=0;i<900;i++){
      const px=Math.floor(rnd()*256),py=Math.floor(rnd()*256);
      d.fillStyle=i%2?'rgba(255,255,255,0.12)':'rgba(60,64,66,0.10)';d.fillRect(px,py,2,2);
    }
    // Iconic Taiwanese stainless-steel cylindrical water tanks (不鏽鋼水塔)
    for(const [tx,ty,tr] of [[48,54,11],[74,56,9],[192,188,12],[166,192,9]]){
      d.fillStyle='rgba(32,38,42,0.34)';d.beginPath();d.arc(tx+4,ty+4,tr,0,Math.PI*2);d.fill();
      const tg=d.createRadialGradient(tx-tr*.3,ty-tr*.3,1,tx,ty,tr);
      tg.addColorStop(0,'#ffffff');tg.addColorStop(.55,'#d4dce2');tg.addColorStop(1,'#8f9aa3');
      d.fillStyle=tg;d.beginPath();d.arc(tx,ty,tr,0,Math.PI*2);d.fill();
      d.strokeStyle='rgba(70,78,86,0.45)';d.lineWidth=1;d.stroke();
    }
    // Rooftop HVAC & AC chiller arrays
    for(const [ax,ay,aw,ah] of [[146,38,34,18],[186,42,20,14],[42,164,30,22],[92,118,26,18]]){
      d.fillStyle='rgba(34,38,42,0.30)';d.fillRect(ax+3,ay+3,aw,ah);
      d.fillStyle='#e6eaed';d.fillRect(ax,ay,aw,ah);
      d.strokeStyle='#9ca4ac';d.lineWidth=1;d.strokeRect(ax+.5,ay+.5,aw-1,ah-1);
      d.fillStyle='#4a535c';d.beginPath();d.arc(ax+aw*.35,ay+ah*.5,Math.min(aw,ah)*.28,0,Math.PI*2);d.fill();
      if(aw>=28){d.beginPath();d.arc(ax+aw*.72,ay+ah*.5,Math.min(aw,ah)*.26,0,Math.PI*2);d.fill();}
    }
    // Stair skylight / maintenance hatch
    d.fillStyle='rgba(36,40,44,0.28)';d.fillRect(114,202,28,22);
    d.fillStyle='#cfd6dc';d.fillRect(111,199,28,22);
    d.fillStyle='#6c7c88';d.fillRect(115,203,20,14);
    return repeatTexture(c,true);
  }
  // Roof 1: Corrugated Metal Sheet (鐵皮加蓋) & Tile Pitched Roof
  function makeRoofPitchedTexture(){
    const c=document.createElement('canvas');c.width=c.height=256;
    const d=c.getContext('2d'),rnd=makePrng(517721);
    d.fillStyle='#e6e6e4';d.fillRect(0,0,256,256);
    // Crisp corrugated standing-seam ribs
    for(let x=0;x<256;x+=8){
      d.fillStyle='#f8f8f6';d.fillRect(x,0,2,256);
      d.fillStyle='#dedfe0';d.fillRect(x+2,0,3,256);
      d.fillStyle='#aeb3b8';d.fillRect(x+5,0,2,256);
      d.fillStyle='#cdd0d4';d.fillRect(x+7,0,1,256);
    }
    // Horizontal overlapping metal sheet / roof tile courses
    for(let y=0;y<256;y+=32){
      d.fillStyle='rgba(52,56,62,0.30)';d.fillRect(0,y,256,2);
      d.fillStyle='rgba(255,255,255,0.42)';d.fillRect(0,y+2,256,1.5);
    }
    // Subtle weathering streaks
    for(let i=0;i<180;i++){
      const px=Math.floor(rnd()*256),py=Math.floor(rnd()*256);
      d.fillStyle=i%2?'rgba(70,68,64,0.08)':'rgba(255,255,255,0.08)';
      d.fillRect(px,py,3,10+Math.floor(rnd()*18));
    }
    return repeatTexture(c,true);
  }
  const aptTex=makeAptTextures(),glassTex=makeGlassTextures(),brickTex=makeBrickTextures(),condoTex=makeCondoTextures();
  const matApt=new THREE.MeshStandardMaterial({color:0xffffff,map:aptTex.map,vertexColors:true,roughness:.78,metalness:.04,
    emissiveMap:aptTex.emissiveMap,emissive:0xffd9a3,emissiveIntensity:0,side:THREE.DoubleSide});
  const matGlass=new THREE.MeshStandardMaterial({color:0xffffff,map:glassTex.map,vertexColors:true,roughness:.24,metalness:.58,
    envMap:reflectedMap,envMapIntensity:.85,emissiveMap:glassTex.emissiveMap,emissive:0xffe4b8,emissiveIntensity:0,side:THREE.DoubleSide});
  const matBrick=new THREE.MeshStandardMaterial({color:0xffffff,map:brickTex.map,vertexColors:true,roughness:.86,metalness:.02,
    emissiveMap:brickTex.emissiveMap,emissive:0xffcb82,emissiveIntensity:0,side:THREE.DoubleSide});
  const matCondo=new THREE.MeshStandardMaterial({color:0xffffff,map:condoTex.map,vertexColors:true,roughness:.62,metalness:.14,
    envMap:reflectedMap,envMapIntensity:.35,emissiveMap:condoTex.emissiveMap,emissive:0xffdfad,emissiveIntensity:0,side:THREE.DoubleSide});
  const wallMats=[matApt,matGlass,matBrick,matCondo];
  const wallNames=['Taipei apartment facades','Taipei glass curtain walls','Taipei brick & shophouse facades','Taipei condo & stone facades'];
  const wallUVScale=[[12.4,12.4],[12.8,15.2],[11.6,12.8],[13.6,13.6]];
  const roofFlat=new THREE.MeshStandardMaterial({color:0xffffff,map:makeRoofFlatTexture(),vertexColors:true,roughness:.84,metalness:.08});
  const roofPitched=new THREE.MeshStandardMaterial({color:0xffffff,map:makeRoofPitchedTexture(),vertexColors:true,roughness:.56,metalness:.24,side:THREE.DoubleSide});
  // Rich 36-color per-style real-world Taipei wall & roof palettes
  const stylePalettes=[
    ['#f0e6d2','#e6d8be','#c97b5d','#d9a08c','#b8cab8','#bccbd6','#d4b483','#d8c3a5','#b86452','#e8d9a8','#c2b4a3','#e2e4e6'].map(c=>new THREE.Color(c)),
    ['#4a7ea8','#3e7d74','#9ab8cc','#a89378','#3d5c78','#488a8c','#586978','#7aa8c7'].map(c=>new THREE.Color(c)),
    ['#b55845','#c76e50','#c98c53','#dfd0b8','#d18874','#cfa55b','#9e5a50','#d6c8b2'].map(c=>new THREE.Color(c)),
    ['#eef0f2','#b5aba0','#6a7078','#d8ccb8','#7a8da1','#9e9284','#e5dcc8','#736d66'].map(c=>new THREE.Color(c))
  ];
  const roofFlatPalette=['#4d8562','#3d7a6e','#a85042','#466c8c','#9fa3a6','#525a63','#b58c58','#b8c0c8'].map(c=>new THREE.Color(c));
  const roofPitchedPalette=['#a85042','#3d7a6e','#466c8c','#b58c58','#525a63','#4d8562','#a85042','#3d7a6e'].map(c=>new THREE.Color(c));
  const landmarks=new THREE.Group();landmarks.name='Taipei landmarks';root.add(landmarks);
  const landmarkSites=[
    {name:'臺北101',lat:25.03396,lon:121.56450,radius:53,height:508,type:'101'},
    {name:'新光摩天大樓',lat:25.04625,lon:121.51520,radius:44,height:245,type:'tower'},
    {name:'臺北大巨蛋',lat:25.04242,lon:121.55940,radius:151,height:74.5,type:'dome'},
    {name:'臺北小巨蛋',lat:25.05190,lon:121.55074,radius:115,height:42,type:'arena'},
    {name:'圓山大飯店',lat:25.07846,lon:121.52648,radius:83,height:87,type:'hotel'},
    {name:'臺北車站',lat:25.0478,lon:121.5170,radius:115,height:49,type:'station'},
    {name:'中正紀念堂',lat:25.0346,lon:121.5219,radius:55,height:70,type:'memorial'},
    {name:'臺北南山廣場',lat:25.03540,lon:121.56630,radius:55,height:272,type:'nanshan'},
    {name:'富邦信義A25',lat:25.03920,lon:121.56750,radius:46,height:266,type:'fubon'},
    {name:'國泰置地廣場',lat:25.04070,lon:121.56680,radius:48,height:212,type:'cathay'},
    {name:'陶朱隱園',lat:25.03780,lon:121.57140,radius:42,height:100,type:'taozhu'},
    {name:'美麗華百樂園摩天輪',lat:25.08330,lon:121.55740,radius:65,height:100,type:'miramar'},
    {name:'台北流行音樂中心',lat:25.05190,lon:121.59750,radius:68,height:45,type:'tmc'},
    {name:'板橋百揚大樓',lat:25.01250,lon:121.46550,radius:52,height:220,type:'megatower'}
  ];
  const glass=new THREE.MeshStandardMaterial({color:0x5e9e99,metalness:.48,roughness:.20,map:facade,
    envMap:reflectedMap,emissiveMap:lights,emissive:0xffd6a2,emissiveIntensity:0});
  const stone=new THREE.MeshStandardMaterial({color:0xc1c1ae,roughness:.82});
  const darkGlass=new THREE.MeshStandardMaterial({color:0x416572,roughness:.22,metalness:.58,map:facade,envMap:reflectedMap});
  const metal=new THREE.MeshStandardMaterial({color:0xa5aeb0,roughness:.4,metalness:.35});
  const red=new THREE.MeshStandardMaterial({color:0xa14735,roughness:.78});
  const gold=new THREE.MeshStandardMaterial({color:0xe1b866,roughness:.65});
  const whiteFrame=new THREE.MeshStandardMaterial({color:0xf0f3f5,roughness:.32,metalness:.25});
  const greenGarden=new THREE.MeshStandardMaterial({color:0x3b6e3f,roughness:.86});
  const ferrisGreen=new THREE.MeshStandardMaterial({color:0x22c55e,roughness:.35,metalness:.2,emissive:0x16a34a,emissiveIntensity:.65});
  const beaconMat=new THREE.MeshStandardMaterial({color:0xff1818,emissive:0xff2222,emissiveIntensity:1.2,roughness:.3});
  function add(parent,geometry,mat,x,y,z){
    const mesh=new THREE.Mesh(geometry,mat);mesh.position.set(x,y,z);parent.add(mesh);return mesh;
  }
  function box(parent,mat,w,h,d,x,y,z){return add(parent,new THREE.BoxGeometry(w,h,d),mat,x,y,z);}
  for(const site of landmarkSites){
    const p=geoPoint(site.lat,site.lon);Object.assign(site,p);
    if(typeof BuildingCollision!=='undefined'){const gy=ground(p.x,p.z);BuildingCollision.addCircle('tp:landmarks',p.x,p.z,site.radius*.55,gy+site.height,gy-2);}
    const group=new THREE.Group();group.name=site.name;group.position.set(p.x,ground(p.x,p.z),p.z);
    group.userData={height:site.height,source:'Original simplified landmark geometry; see TAIPEI-3D.txt'};landmarks.add(group);
    if(site.type==='101'){
      group.rotation.y=-.12;
      box(group,stone,150,24,120,-22,12,-22);
      box(group,glass,64,68,64,0,34,0);
      for(let tier=0;tier<8;tier++){
        const y=68+tier*44;
        const segment=add(group,new THREE.CylinderGeometry(38,30,44,4,1,false,Math.PI/4),glass,0,y+22,0);
        // Repeat windows by real section height rather than stretching one window.
        const uv=segment.geometry.attributes.uv;
        for(let n=0;n<uv.count;n++)uv.setXY(n,uv.getX(n)*20,uv.getY(n)*12);
        box(group,metal,56,1.2,56,0,y+43,0);
        for(const sx of [-1,1])for(const sz of [-1,1])box(group,metal,1.3,44,1.3,sx*25,y+22,sz*25);
      }
      box(group,glass,35,28,35,0,434,0);
      box(group,metal,22,12,22,0,454,0);
      add(group,new THREE.CylinderGeometry(1,4,48,12),metal,0,484,0);
      box(group,beaconMat,2.5,2.5,2.5,0,508,0);
    }else if(site.type==='tower'){
      box(group,stone,67,26,68,0,13,0);
      box(group,darkGlass,52,171,49,0,111.5,0);
      box(group,metal,45,22,43,0,208,0);
      add(group,new THREE.CylinderGeometry(12,28,26,4,1,false,Math.PI/4),metal,0,232,0);
      box(group,beaconMat,2,2,2,0,245,0);
    }else if(site.type==='dome'||site.type==='arena'){
      const big=site.type==='dome',w=big?260:177,d=big?208:136,h=big?74.5:42;
      box(group,stone,w,18,d,0,9,0);
      box(group,darkGlass,w+1,13,d+1,0,21,0);
      const dome=add(group,new THREE.SphereGeometry(1,48,20,0,Math.PI*2,0,Math.PI/2),metal,0,24,0);
      dome.scale.set(w*.52,h-24,d*.52);
      for(let x=-w*.43;x<w*.44;x+=12)box(group,stone,.8,23,d+2,x,12,0);
    }else if(site.type==='station'){
      box(group,stone,190,29,130,0,14.5,0);
      box(group,darkGlass,191,12,131,0,23,0);
      for(let level=0;level<3;level++){
        const g=add(group,new THREE.CylinderGeometry(60-level*8,78-level*8,8,4,1,false,Math.PI/4),red,0,32+level*7,0);
        g.scale.set(1.85,1,1.2);
      }
    }else if(site.type==='memorial'){
      box(group,stone,88,11,88,0,5.5,0);box(group,stone,50,39,50,0,30.5,0);
      for(let level=0;level<2;level++)add(group,new THREE.CylinderGeometry(13-level*5,38-level*6,12,8,1,false,Math.PI/8),darkGlass,0,54+level*10,0);
    }else if(site.type==='hotel'){
      box(group,stone,124,65,56,0,32.5,0);
      for(let floor=0;floor<12;floor++){
        box(group,red,129,1.3,61,0,6+floor*5,0);
        for(let col=-5;col<=5;col++)box(group,red,1.4,4.2,59,col*11,8+floor*5,0);
      }
      const top=add(group,new THREE.CylinderGeometry(42,77,18,4,1,false,Math.PI/4),red,0,76,0);
      top.scale.z=.57;box(group,gold,111,2,5,0,86,0);
    }else if(site.type==='nanshan'){
      group.rotation.y=-0.12;
      box(group,stone,76,38,64,0,19,-10);
      box(group,officeGlass,78,14,66,0,7,-10);
      box(group,officeGlass,32,26,30,22,13,26);
      add(group,new THREE.CylinderGeometry(14,22,26,6),officeGlass,22,13,26);
      box(group,officeGlass,54,82,42,0,79,-10);
      for(const sx of [-27,27])for(const sz of [-31,11])box(group,metal,1.5,82,1.5,sx,79,sz);
      box(group,darkGlass,52,6,40,0,123,-10);
      box(group,officeGlass,48,72,38,0,159,-10);
      for(const sx of [-24,24])for(const sz of [-29,9])box(group,metal,1.3,72,1.3,sx,159,sz);
      box(group,officeGlass,44,55,34,0,222.5,-10);
      box(group,metal,40,2,30,0,251,-10);
      const crown1=add(group,new THREE.CylinderGeometry(16,22,20,4,1,false,Math.PI/4),officeGlass,0,261,-10);
      crown1.scale.set(1.1,1,0.8);
      box(group,metal,14,10,12,0,266,-10);
      box(group,beaconMat,2.5,2.5,2.5,0,272,-10);
    }else if(site.type==='fubon'){
      group.rotation.y=-0.12;
      box(group,officeGlass,52,18,40,0,9,0);
      box(group,officeGlass,44,222,32,0,129,0);
      for(const sx of [-23,23])for(const sz of [-17,17]){
        box(group,whiteFrame,2.5,248,2.5,sx,124,sz);
      }
      for(let f=1;f<=5;f++){
        box(group,whiteFrame,47,2,35,0,f*44,0);
        box(group,whiteFrame,1.2,1.2,34,-23,f*44-22,0);
        box(group,whiteFrame,1.2,1.2,34,23,f*44-22,0);
      }
      box(group,whiteFrame,46,26,2,0,253,-17);
      box(group,whiteFrame,46,26,2,0,253,17);
      box(group,whiteFrame,2,26,34,-23,253,0);
      box(group,whiteFrame,2,26,34,23,253,0);
      box(group,darkGlass,28,18,20,0,249,0);
      box(group,beaconMat,2.5,2.5,2.5,0,266,0);
    }else if(site.type==='cathay'){
      group.rotation.y=-0.12;
      box(group,stone,78,38,62,0,19,0);
      box(group,officeGlass,80,14,64,0,7,0);
      box(group,officeGlass,52,72,38,0,74,0);
      for(const sx of [-26,26])box(group,metal,1.4,160,1.4,sx,118,0);
      box(group,officeGlass,48,55,34,0,137.5,0);
      box(group,metal,50,2,36,0,110,0);
      box(group,officeGlass,44,33,30,0,181.5,0);
      box(group,metal,46,2,32,0,165,0);
      box(group,darkGlass,46,12,32,0,204,0);
      box(group,metal,48,2,34,0,210,0);
      box(group,beaconMat,2.5,2.5,2.5,0,212,0);
    }else if(site.type==='taozhu'){
      group.rotation.y=-0.12;
      add(group,new THREE.CylinderGeometry(36,38,6,24),stone,0,3,0);
      add(group,new THREE.CylinderGeometry(9,9,96,16),darkGlass,0,51,0);
      for(let level=0;level<20;level++){
        const y=8+level*4.4;
        const angle=level*(Math.PI/40);
        const wing=add(group,new THREE.BoxGeometry(44,3.2,14),officeGlass,0,y,0);
        wing.rotation.y=angle;
        const cos=Math.cos(angle),sin=Math.sin(angle);
        const g1=add(group,new THREE.BoxGeometry(10,1.4,13.6),greenGarden,17*cos,y-0.6,-17*sin);
        g1.rotation.y=angle;
        const g2=add(group,new THREE.BoxGeometry(10,1.4,13.6),greenGarden,-17*cos,y-0.6,17*sin);
        g2.rotation.y=angle;
      }
      const pergola=add(group,new THREE.BoxGeometry(46,3,16),whiteFrame,0,98,0);
      pergola.rotation.y=Math.PI/2;
      box(group,beaconMat,2,2,2,0,100,0);
    }else if(site.type==='miramar'){
      box(group,stone,96,28,70,0,14,0);
      box(group,officeGlass,88,14,62,0,21,0);
      box(group,stone,90,2,64,0,29,0);
      box(group,whiteFrame,3,38,3,-18,48,0);
      box(group,whiteFrame,3,38,3,18,48,0);
      box(group,whiteFrame,38,3,3,0,46,0);
      box(group,ferrisGreen,8,8,10,0,65,0);
      const segments=16,rOuter=35,rInner=24;
      for(let i=0;i<segments;i++){
        const a1=i*(Math.PI*2/segments),a2=(i+1)*(Math.PI*2/segments);
        const x1=rOuter*Math.cos(a1),y1=65+rOuter*Math.sin(a1);
        const x2=rOuter*Math.cos(a2),y2=65+rOuter*Math.sin(a2);
        const dx=x2-x1,dy=y2-y1,len=Math.hypot(dx,dy),ang=Math.atan2(dy,dx);
        const rim=add(group,new THREE.BoxGeometry(len,1.4,1.4),ferrisGreen,(x1+x2)/2,(y1+y2)/2,0);
        rim.rotation.z=ang;
        const ix1=rInner*Math.cos(a1),iy1=65+rInner*Math.sin(a1);
        const ix2=rInner*Math.cos(a2),iy2=65+rInner*Math.sin(a2);
        const idx=ix2-ix1,idy=iy2-iy1,ilen=Math.hypot(idx,idy),iang=Math.atan2(idy,idx);
        const irim=add(group,new THREE.BoxGeometry(ilen,1,1),whiteFrame,(ix1+ix2)/2,(iy1+iy2)/2,0);
        irim.rotation.z=iang;
        if(i%2===0){
          const spoke=add(group,new THREE.BoxGeometry(rOuter,1,1),whiteFrame,x1/2,65+rOuter*Math.sin(a1)/2,0);
          spoke.rotation.z=a1;
        }
        box(group,ferrisGreen,2.8,3,3.4,x1,y1,0);
      }
      box(group,beaconMat,2,2,2,0,101,0);
    }else if(site.type==='tmc'){
      box(group,stone,110,4,86,0,2,0);
      box(group,officeGlass,80,12,64,0,8,0);
      box(group,darkGlass,74,22,58,0,18,0);
      const canopy=add(group,new THREE.CylinderGeometry(22,46,20,6),metal,0,28,0);
      canopy.scale.set(1.2,1,0.9);
      add(group,new THREE.ConeGeometry(18,16,5),metal,-12,38,-6);
      add(group,new THREE.ConeGeometry(15,14,6),officeGlass,14,36,8);
    }else if(site.type==='megatower'){
      add(group,new THREE.CylinderGeometry(38,42,28,24),stone,0,14,0);
      box(group,officeGlass,72,14,56,0,8,0);
      const towerBody=add(group,new THREE.CylinderGeometry(28,32,162,24),officeGlass,0,109,0);
      towerBody.scale.set(1.15,1,0.9);
      for(let f=1;f<=6;f++){
        const ring=add(group,new THREE.CylinderGeometry(28.4,28.4,1.8,24),metal,0,28+f*24,0);
        ring.scale.set(1.15,1,0.9);
      }
      add(group,new THREE.CylinderGeometry(21,27,16,20),officeGlass,0,198,0);
      add(group,new THREE.CylinderGeometry(13,19,12,16),metal,0,212,0);
      add(group,new THREE.CylinderGeometry(1,3,10,8),metal,0,220,0);
      box(group,beaconMat,2.5,2.5,2.5,0,223,0);
    }
    // One draw per material instead of hundreds of hotel columns/tower details.
    group.updateMatrixWorld(true);
    const batches=new Map();
    for(const child of [...group.children]){
      const geometry=child.geometry.index?child.geometry.toNonIndexed():child.geometry.clone();
      geometry.applyMatrix4(child.matrix);
      if(!batches.has(child.material))batches.set(child.material,[]);
      batches.get(child.material).push(geometry);group.remove(child);child.geometry.dispose();
    }
    for(const [mat,parts] of batches){
      const geometry=new THREE.BufferGeometry();
      for(const [attribute,width] of [['position',3],['normal',3],['uv',2]]){
        const array=new Float32Array(parts.reduce((sum,g)=>sum+g.attributes.position.count*width,0));
        let offset=0;
        for(const part of parts){if(part.attributes[attribute])array.set(part.attributes[attribute].array,offset);offset+=part.attributes.position.count*width;}
        geometry.setAttribute(attribute,new THREE.BufferAttribute(array,width));
      }
      group.add(new THREE.Mesh(geometry,mat));parts.forEach(g=>g.dispose());
    }
  }
  const skipBuilding=(x,z)=>(typeof expandedAirportFootprint==='function'&&expandedAirportFootprint(x,z,40))||landmarkSites.some(s=>Math.abs(x-s.x)<s.radius&&Math.abs(z-s.z)<s.radius)||airports.some(a=>{
    if(Math.hypot(x-a.x,z-a.z)>a.length/2+500)return false;
    const p=runwayCoordinates(x,z,a);
    if(typeof airportSurroundingsContains==='function'&&airportSurroundingsContains(a,p))return true;
    return Math.abs(p.along)<a.length/2+80&&Math.abs(p.cross)<110;
  });
  function buffers(){return {p:[],n:[],uv:[],c:[]};}
  function tri(out,a,b,c,color,normal,uvs){
    const cr=color.r,cg=color.g,cb=color.b,nx=normal[0],ny=normal[1],nz=normal[2];
    const p=out.p,n=out.n,uv=out.uv,cl=out.c;
    p.push(a[0],a[1],a[2],b[0],b[1],b[2],c[0],c[1],c[2]);
    n.push(nx,ny,nz,nx,ny,nz,nx,ny,nz);
    if(uvs) uv.push(uvs[0][0],uvs[0][1],uvs[1][0],uvs[1][1],uvs[2][0],uvs[2][1]);
    else uv.push(a[0]*.25,a[2]*.25,b[0]*.25,b[2]*.25,c[0]*.25,c[2]*.25);
    cl.push(cr,cg,cb,cr,cg,cb,cr,cg,cb);
  }
  function triFlat(out,ax,ay,az,bx,by,bz,cx,cy,cz,cr,cg,cb,nx,ny,nz,u0,v0,u1,v1,u2,v2){
    out.p.push(ax,ay,az,bx,by,bz,cx,cy,cz);
    out.n.push(nx,ny,nz,nx,ny,nz,nx,ny,nz);
    out.uv.push(u0,v0,u1,v1,u2,v2);
    out.c.push(cr,cg,cb,cr,cg,cb,cr,cg,cb);
  }
  const white=new THREE.Color(0xffffff);
  function mesh(group,data,mat,name){
    if(!data.p.length)return;
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(data.p,3));
    g.setAttribute('normal',new THREE.Float32BufferAttribute(data.n,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(data.uv,2));
    g.setAttribute('color',new THREE.Float32BufferAttribute(data.c,3));g.computeBoundingSphere();
    const m=new THREE.Mesh(g,mat);m.name=name;m.receiveShadow=true;group.add(m);
  }
  function emitUpTri(out,p0,p1,p2,y,cr,cg,cb,uvScale=.055){
    if((p1[1]-p0[1])*(p2[0]-p0[0])-(p1[0]-p0[0])*(p2[1]-p0[1])>0){
      triFlat(out,p0[0],y,p0[1],p1[0],y,p1[1],p2[0],y,p2[1],cr,cg,cb,0,1,0,p0[0]*uvScale,p0[1]*uvScale,p1[0]*uvScale,p1[1]*uvScale,p2[0]*uvScale,p2[1]*uvScale);
    }else{
      triFlat(out,p0[0],y,p0[1],p2[0],y,p2[1],p1[0],y,p1[1],cr,cg,cb,0,1,0,p0[0]*uvScale,p0[1]*uvScale,p2[0]*uvScale,p2[1]*uvScale,p1[0]*uvScale,p1[1]*uvScale);
    }
  }
  function emitSlopedTri(out,ax,ay,az,bx,by,bz,cx,cy,cz,cr,cg,cb,u0,v0,u1,v1,u2,v2){
    const e1x=bx-ax,e1y=by-ay,e1z=bz-az,e2x=cx-ax,e2y=cy-ay,e2z=cz-az;
    let nx=e1y*e2z-e1z*e2y,ny=e1z*e2x-e1x*e2z,nz=e1x*e2y-e1y*e2x;
    const len=Math.hypot(nx,ny,nz);if(len<1e-5)return;
    nx/=len;ny/=len;nz/=len;
    if(ny<0){
      triFlat(out,ax,ay,az,cx,cy,cz,bx,by,bz,cr,cg,cb,-nx,-ny,-nz,u0,v0,u2,v2,u1,v1);
    }else{
      triFlat(out,ax,ay,az,bx,by,bz,cx,cy,cz,cr,cg,cb,nx,ny,nz,u0,v0,u1,v1,u2,v2);
    }
  }
  function polygon(out,points,y,color,uvScale=.055){
    const n=points.length,cr=color.r,cg=color.g,cb=color.b;
    if(n===3){
      emitUpTri(out,points[0],points[1],points[2],y,cr,cg,cb,uvScale);
      return;
    }
    if(n===4){
      const p0=points[0],p1=points[1],p2=points[2],p3=points[3];
      const c0=(p1[0]-p0[0])*(p2[1]-p1[1])-(p1[1]-p0[1])*(p2[0]-p1[0]);
      const c1=(p2[0]-p1[0])*(p3[1]-p2[1])-(p2[1]-p1[1])*(p3[0]-p2[0]);
      const c2=(p3[0]-p2[0])*(p0[1]-p3[1])-(p3[1]-p2[1])*(p0[0]-p3[0]);
      const c3=(p0[0]-p3[0])*(p1[1]-p0[1])-(p0[1]-p3[1])*(p1[0]-p0[0]);
      if((c0>=0&&c1>=0&&c2>=0&&c3>=0)||(c0<=0&&c1<=0&&c2<=0&&c3<=0)){
        emitUpTri(out,p0,p1,p2,y,cr,cg,cb,uvScale);
        emitUpTri(out,p0,p2,p3,y,cr,cg,cb,uvScale);
        return;
      }
    }
    const contour=points.map(p=>new THREE.Vector2(p[0],p[1]));
    for(const ids of THREE.ShapeUtils.triangulateShape(contour,[])){
      emitUpTri(out,points[ids[0]],points[ids[1]],points[ids[2]],y,cr,cg,cb,uvScale);
    }
  }
  function hash2(x,z,s){
    let n=Math.imul(Math.round(x*13.7)|0,374761393)^Math.imul(Math.round(z*17.3)|0,668265263)^Math.imul(s|0,2147483647);
    n=Math.imul(n^(n>>>13),1274126177);
    return ((n^(n>>>16))>>>0)/4294967296;
  }
  function polyInfo(points){
    const n=points.length;
    let area2=0,cx=0,cz=0,pos=0,neg=0;
    for(let i=0;i<n;i++){
      const a=points[i],b=points[(i+1)%n],c=points[(i+2)%n];
      cx+=a[0];cz+=a[1];
      area2+=a[0]*b[1]-b[0]*a[1];
      const cr=(b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]);
      if(cr>1e-4)pos++;else if(cr<-1e-4)neg++;
    }
    const area=Math.abs(area2)*.5;
    return {signedArea:area2*.5,area,cx:cx/n,cz:cz/n,convex:(pos===0||neg===0)&&area>=12};
  }
  function pointInPoly(px,pz,points){
    let inside=false;
    for(let i=0,j=points.length-1;i<points.length;j=i++){
      const xi=points[i][0],zi=points[i][1],xj=points[j][0],zj=points[j][1];
      if(((zi>pz)!==(zj>pz))&&(px<(xj-xi)*(pz-zi)/((zj-zi)||1e-9)+xi))inside=!inside;
    }
    return inside;
  }
  function minEdgeDist(px,pz,points){
    let best=1e9;
    for(let i=0;i<points.length;i++){
      const a=points[i],b=points[(i+1)%points.length],dx=b[0]-a[0],dz=b[1]-a[1],l2=dx*dx+dz*dz;
      if(l2<1e-6)continue;
      const t=Math.max(0,Math.min(1,((px-a[0])*dx+(pz-a[1])*dz)/l2));
      const d=Math.hypot(px-(a[0]+dx*t),pz-(a[1]+dz*t));
      if(d<best)best=d;
    }
    return best;
  }
  function extrudeWalls(target,points,y0,y1,cr,cg,cb,nSign,uScale,vScale,uOff){
    const v=(y1-y0)/vScale;
    for(let i=0;i<points.length;i++){
      const a=points[i],b=points[(i+1)%points.length],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
      if(length<.01)continue;
      const nx=nSign*dz/length,nz=-nSign*dx/length;
      const u1=uOff+length/uScale;
      triFlat(target,a[0],y0,a[1],b[0],y0,b[1],b[0],y1,b[1],cr,cg,cb,nx,0,nz,uOff,0,u1,0,u1,v);
      triFlat(target,a[0],y0,a[1],b[0],y1,b[1],a[0],y1,a[1],cr,cg,cb,nx,0,nz,uOff,0,u1,v,uOff,v);
    }
  }
  function emitHippedRoof(out,points,y0,ridgeH,cx,cz,cr,cg,cb){
    const yTop=y0+ridgeH;
    if(points.length===4){
      const p0=points[0],p1=points[1],p2=points[2],p3=points[3];
      const d01=Math.hypot(p1[0]-p0[0],p1[1]-p0[1]),d23=Math.hypot(p3[0]-p2[0],p3[1]-p2[1]);
      const d12=Math.hypot(p2[0]-p1[0],p2[1]-p1[1]),d30=Math.hypot(p0[0]-p3[0],p0[1]-p3[1]);
      let q0=p0,q1=p1,q2=p2,q3=p3;
      if(d01+d23<d12+d30){q0=p1;q1=p2;q2=p3;q3=p0;}
      const mAx=(q3[0]+q0[0])*.5,mAz=(q3[1]+q0[1])*.5,mBx=(q1[0]+q2[0])*.5,mBz=(q1[1]+q2[1])*.5;
      const rAx=mAx+(mBx-mAx)*.22,rAz=mAz+(mBz-mAz)*.22;
      const rBx=mBx+(mAx-mBx)*.22,rBz=mBz+(mAz-mBz)*.22;
      const rLen=Math.hypot(rBx-rAx,rBz-rAz);
      if(rLen>.75){
        const sU1=Math.hypot(q1[0]-q0[0],q1[1]-q0[1])/4.5,sU2=Math.hypot(q3[0]-q2[0],q3[1]-q2[1])/4.5;
        const sU3=Math.hypot(q0[0]-q3[0],q0[1]-q3[1])/4.5,sU4=Math.hypot(q2[0]-q1[0],q2[1]-q1[1])/4.5;
        const sV=Math.max(.6,Math.hypot(q0[0]-rAx,q0[1]-rAz,ridgeH)/4.5);
        // Side slope 1 (q0-q1 to rA-rB)
        emitSlopedTri(out,q0[0],y0,q0[1],q1[0],y0,q1[1],rBx,yTop,rBz,cr,cg,cb,0,0,sU1,0,sU1*.78,sV);
        emitSlopedTri(out,q0[0],y0,q0[1],rBx,yTop,rBz,rAx,yTop,rAz,cr,cg,cb,0,0,sU1*.78,sV,sU1*.22,sV);
        // Side slope 2 (q2-q3 to rB-rA)
        emitSlopedTri(out,q2[0],y0,q2[1],q3[0],y0,q3[1],rAx,yTop,rAz,cr,cg,cb,0,0,sU2,0,sU2*.78,sV);
        emitSlopedTri(out,q2[0],y0,q2[1],rAx,yTop,rAz,rBx,yTop,rBz,cr,cg,cb,0,0,sU2*.78,sV,sU2*.22,sV);
        // Hip ends
        emitSlopedTri(out,q3[0],y0,q3[1],q0[0],y0,q0[1],rAx,yTop,rAz,cr,cg,cb,0,0,sU3,0,sU3*.5,sV);
        emitSlopedTri(out,q1[0],y0,q1[1],q2[0],y0,q2[1],rBx,yTop,rBz,cr,cg,cb,0,0,sU4,0,sU4*.5,sV);
        return;
      }
    }
    for(let i=0;i<points.length;i++){
      const a=points[i],b=points[(i+1)%points.length];
      const eLen=Math.hypot(b[0]-a[0],b[1]-a[1])/4.5;
      const sV=Math.max(.5,Math.hypot((a[0]+b[0])*.5-cx,(a[1]+b[1])*.5-cz,ridgeH)/4.5);
      emitSlopedTri(out,a[0],y0,a[1],b[0],y0,b[1],cx,yTop,cz,cr,cg,cb,0,0,eLen,0,eLen*.5,sV);
    }
  }
  const tmpWallColor=new THREE.Color(),tmpRoofColor=new THREE.Color(),tmpCrownColor=new THREE.Color();
  function* build(key,data){
    const group=new THREE.Group();group.name='Taipei tile '+key;
    group.userData.masks=[];
    const BC=typeof BuildingCollision!=='undefined'?BuildingCollision:null;
    if(BC)BC.clearGroup('tp:'+key);
    const wallBufs=[buffers(),buffers(),buffers(),buffers()];
    const roofFlatBuf=buffers(),roofPitchedBuf=buffers();
    const roads=buffers(),curbs=buffers(),lines=buffers(),waters=buffers();
    let built=0;
    for(let bIdx=0;bIdx<data.b.length;bIdx++){
      const [x,z,h,tone,kind,coords]=data.b[bIdx];
      if(skipBuilding(x,z))continue;
      const points=[];
      let minX=1e9,minZ=1e9,maxX=-1e9,maxZ=-1e9;
      for(let i=0;i<coords.length;i+=2){
        const px=x+coords[i],pz=z+coords[i+1];
        points.push([px,pz]);
        if(px<minX)minX=px;if(px>maxX)maxX=px;
        if(pz<minZ)minZ=pz;if(pz>maxZ)maxZ=pz;
      }
      mask(group,minX-2,minZ-2,maxX+2,maxZ+2);
      const center=ground(x,z);
      let base=center;
      if(points.length<=4){
        const g0=ground(points[0][0],points[0][1]),g2=ground(points[2][0],points[2][1]);
        base=Math.min(center,g0,g2)-.45;
      }else{
        for(let i=0;i<points.length;i++){const gp=ground(points[i][0],points[i][1]);if(gp<base)base=gp;}
        base-=.25;
      }
      const bw=maxX-minX,bd=maxZ-minZ,info=polyInfo(points);
      const nSign=info.signedArea>=0?1:-1;
      // Deterministic multi-archetype classification using height, footprint & coordinate hash
      const hStyle=hash2(x,z,11+(tone|0)*3+(kind|0)*7);
      const hCol=hash2(x,z,29+bIdx);
      const hRoof=hash2(x,z,53+bIdx);
      const hRoof2=hash2(x,z,79+bIdx);
      const hCrown=hash2(x,z,101+bIdx);
      const hCrown2=hash2(x,z,131+bIdx);
      let style=0;
      if(h>=34){
        const r=Math.max(0,Math.min(.999,hStyle-(kind===1?.05:0)));
        style=r<.60?1:r<.95?3:0;
      }else if(h>=15){
        style=hStyle<.45?0:hStyle<.70?3:hStyle<.85?2:1;
      }else{
        style=hStyle<.38?2:hStyle<.76?0:hStyle<.90?3:1;
      }
      // Per-building rich palette color + subtle deterministic HSL jitter so neighbors never look identical
      const pal=stylePalettes[style];
      const baseWallCol=pal[Math.floor(hCol*pal.length)%pal.length];
      const jHue=(hash2(x,z,157)-.5)*.044;
      const jSat=(hash2(x,z,179)-.5)*.14;
      const jLit=(hash2(x,z,199)-.5)*.11;
      tmpWallColor.copy(baseWallCol).offsetHSL(jHue,jSat,jLit);
      if(h>85)tmpWallColor.multiplyScalar(.92);
      const cr=tmpWallColor.r,cg=tmpWallColor.g,cb=tmpWallColor.b;
      const top=center+h;
      let collisionTop=top;
      const [uScale,vScale]=wallUVScale[style];
      const uOff=Math.floor(hash2(x,z,223)*4)*.25;
      extrudeWalls(wallBufs[style],points,base,top,cr,cg,cb,nSign,uScale,vScale,uOff);

      // 3D Roof & Crown Silhouettes (batched directly into chunk buffers — zero extra draw calls!)
      const rHue=(hash2(x,z,241)-.5)*.036,rSat=(hash2(x,z,263)-.5)*.12,rLit=(hash2(x,z,283)-.5)*.10;
      if(h<=14&&hRoof<.45&&info.convex&&points.length<=10&&info.area>=14){
        // Low-rise 3D pitched/hipped roof cap (1.8m - 3.2m ridge height)
        const ridgeH=1.8+hRoof2*1.4;
        const rBase=roofPitchedPalette[Math.floor(hRoof2*roofPitchedPalette.length)%roofPitchedPalette.length];
        tmpRoofColor.copy(rBase).offsetHSL(rHue,rSat,rLit);
        emitHippedRoof(roofPitchedBuf,points,top,ridgeH,info.cx,info.cz,tmpRoofColor.r,tmpRoofColor.g,tmpRoofColor.b);
        collisionTop=top+ridgeH;
      }else if(h<=14&&hRoof>=.45&&hRoof<.66){
        // Low-rise colorful flat corrugated-metal roof (鐵皮平頂)
        const rBase=roofPitchedPalette[Math.floor(hRoof2*roofPitchedPalette.length)%roofPitchedPalette.length];
        tmpRoofColor.copy(rBase).offsetHSL(rHue,rSat,rLit);
        polygon(roofPitchedBuf,points,top,tmpRoofColor,.14);
      }else{
        // Flat Taiwanese rooftop (emerald waterproof / concrete / slate / solar / ochre)
        const rBase=roofFlatPalette[Math.floor(hRoof2*roofFlatPalette.length)%roofFlatPalette.length];
        tmpRoofColor.copy(rBase).offsetHSL(rHue,rSat,rLit);
        polygon(roofFlatBuf,points,top,tmpRoofColor,.055);
        // Mid/High-rise 3D stepped setback crowns & rooftop penthouses (~55% of h >= 18m)
        if(h>=18&&hRoof<.55){
          const crownStyle=style===1&&h<45?3:style;
          const [cuS,cvS]=wallUVScale[crownStyle];
          tmpCrownColor.copy(tmpWallColor).offsetHSL(0,0,hCrown>.5?.05:-.06);
          if(h>=45&&info.convex&&bw>=12&&bd>=12&&hRoof2<.68){
            // Stepped setback crown on skyscrapers
            const inset=.62+hCrown*.16;
            const crownH=Math.min(18,Math.max(5.5,h*(.10+hCrown*.08)));
            const insetPts=points.map(p=>[info.cx+(p[0]-info.cx)*inset,info.cz+(p[1]-info.cz)*inset]);
            extrudeWalls(wallBufs[style],insetPts,top,top+crownH,tmpCrownColor.r,tmpCrownColor.g,tmpCrownColor.b,nSign,uScale,vScale,uOff);
            polygon(roofFlatBuf,insetPts,top+crownH,tmpRoofColor,.055);
            collisionTop=top+crownH;
            if(h>=70&&bw>=16&&bd>=16){
              const inset2=.56,capH=3.5+hCrown2*3.5;
              const capPts=insetPts.map(p=>[info.cx+(p[0]-info.cx)*inset2,info.cz+(p[1]-info.cz)*inset2]);
              extrudeWalls(wallBufs[crownStyle],capPts,top+crownH,top+crownH+capH,tmpCrownColor.r*.92,tmpCrownColor.g*.92,tmpCrownColor.b*.92,nSign,cuS,cvS,uOff);
              polygon(roofFlatBuf,capPts,top+crownH+capH,tmpRoofColor,.055);
              collisionTop=top+crownH+capH;
            }
          }else if(info.convex&&info.area>=26){
            // Rooftop mechanical penthouse / stair-tower box (46%-60% inset, 2.5m-6.0m tall)
            const inset=.46+hCrown*.14,phH=2.5+hCrown2*3.5;
            const pRef=points[Math.floor(hash2(x,z,307)*points.length)%points.length];
            const ox=info.cx+(pRef[0]-info.cx)*.22,oz=info.cz+(pRef[1]-info.cz)*.22;
            const phPts=points.map(p=>[ox+(p[0]-ox)*inset,oz+(p[1]-oz)*inset]);
            const phCx=ox+(info.cx-ox)*inset,phCz=oz+(info.cz-oz)*inset;
            extrudeWalls(wallBufs[crownStyle],phPts,top,top+phH,tmpCrownColor.r,tmpCrownColor.g,tmpCrownColor.b,nSign,cuS,cvS,uOff);
            if(style===0&&h<34&&hCrown2<.30&&phPts.length<=6){
              // Authentic Taiwanese rooftop metal-sheet penthouse cap (頂樓加蓋)
              const pRidge=1.3+hCrown*.8;
              const pCol=roofPitchedPalette[Math.floor(hCrown*roofPitchedPalette.length)%roofPitchedPalette.length];
              tmpRoofColor.copy(pCol).offsetHSL(rHue,rSat,rLit);
              emitHippedRoof(roofPitchedBuf,phPts,top+phH,pRidge,phCx,phCz,tmpRoofColor.r,tmpRoofColor.g,tmpRoofColor.b);
              collisionTop=top+phH+pRidge;
            }else{
              polygon(roofFlatBuf,phPts,top+phH,tmpRoofColor,.055);
              collisionTop=top+phH;
            }
          }else if(!info.convex&&pointInPoly(info.cx,info.cz,points)){
            const rMin=minEdgeDist(info.cx,info.cz,points);
            if(rMin>=3.0){
              const half=Math.min(rMin*.65,6.5),phH=2.6+hCrown2*3.0;
              const phPts=[[info.cx-half,info.cz-half],[info.cx+half,info.cz-half],[info.cx+half,info.cz+half],[info.cx-half,info.cz+half]];
              extrudeWalls(wallBufs[crownStyle],phPts,top,top+phH,tmpCrownColor.r,tmpCrownColor.g,tmpCrownColor.b,1,cuS,cvS,uOff);
              polygon(roofFlatBuf,phPts,top+phH,tmpRoofColor,.055);
              collisionTop=top+phH;
            }
          }
        }
      }
      if(BC){const sx=bw*.06,sz=bd*.06;BC.add('tp:'+key,minX+sx,minZ+sz,maxX-sx,maxZ-sz,collisionTop,base);}
      built++;if(built%72===0)yield;
    }
    for(const coords of data.w){
      const points=[];for(let i=0;i<coords.length;i+=2)points.push([coords[i],coords[i+1]]);
      const y=Math.max(.1,Math.min(...points.map(p=>ground(...p))))+.16;
      polygon(waters,points,y,white);yield;
    }
    const bridgeColor=new THREE.Color(0xb8bec2),pierColor=new THREE.Color(0x959ba0);
    for(let r=0;r<data.r.length;r++){
      const [width,bridge,coords]=data.r[r];
      let cumDist=0;
      for(let i=2;i<coords.length;i+=2){
        const ax=coords[i-2],az=coords[i-1],bx=coords[i],bz=coords[i+1],dx=bx-ax,dz=bz-az,length=Math.hypot(dx,dz);
        if(length<.1)continue;
        mask(group,Math.min(ax,bx)-width/2,Math.min(az,bz)-width/2,Math.max(ax,bx)+width/2,Math.max(az,bz)+width/2);
        const sections=Math.max(1,Math.ceil(length/32));
        const nx=-dz/length,nz=dx/length;
        for(let part=0;part<sections;part++){
          const t=part/sections,u=(part+1)/sections;
          const x=ax+dx*t,z=az+dz*t,x2=ax+dx*u,z2=az+dz*u;
          const segLen=length/sections,v0=cumDist/26,v1=(cumDist+segLen)/26;
          cumDist+=segLen;
          // Keep runway and taxiway surfaces owned by the airport layer.
          if(typeof expandedAirportFootprint==='function'&&expandedAirportFootprint(x,z,12))continue;
          if(airports.some(a=>Math.hypot(x-a.x,z-a.z)<a.length/2+100&&Math.abs(runwayCoordinates(x,z,a).cross)<250))continue;
          const liftBridge=bridge?8:0,half=width/2;
          const lx1=x+nx*half,lz1=z+nz*half,rx1=x-nx*half,rz1=z-nz*half;
          const lx2=x2+nx*half,lz2=z2+nz*half,rx2=x2-nx*half,rz2=z2-nz*half;
          const yL1=ground(lx1,lz1)+.18+liftBridge,yR1=ground(rx1,rz1)+.18+liftBridge;
          const yR2=ground(rx2,rz2)+.18+liftBridge,yL2=ground(lx2,lz2)+.18+liftBridge;
          triFlat(roads,lx1,yL1,lz1,rx1,yR1,rz1,rx2,yR2,rz2,1,1,1,0,1,0,0,v0,1,v0,1,v1);
          triFlat(roads,lx1,yL1,lz1,rx2,yR2,rz2,lx2,yL2,lz2,1,1,1,0,1,0,0,v0,1,v1,0,v1);
          if(bridge||width>=11){
            const ch=bridge?1.05:.24,cw=bridge?.55:.42;
            for(const s of [-1,1]){
              const outOff=half+cw*.5,inOff=half-cw*.1;
              const pA=[x+nx*s*outOff,z+nz*s*outOff],pB=[x2+nx*s*outOff,z2+nz*s*outOff];
              const gA=ground(pA[0],pA[1])+liftBridge+.18,gB=ground(pB[0],pB[1])+liftBridge+.18;
              const iA=[x+nx*s*inOff,z+nz*s*inOff],iB=[x2+nx*s*inOff,z2+nz*s*inOff];
              triFlat(curbs,pA[0],gA+ch,pA[1],iA[0],gA+ch,iA[1],iB[0],gB+ch,iB[1],bridgeColor.r,bridgeColor.g,bridgeColor.b,0,1,0,0,0,1,0,1,1);
              triFlat(curbs,pA[0],gA+ch,pA[1],iB[0],gB+ch,iB[1],pB[0],gB+ch,pB[1],bridgeColor.r,bridgeColor.g,bridgeColor.b,0,1,0,0,0,1,1,0,1);
              triFlat(curbs,pA[0],gA-(bridge?.7:.15),pA[1],pB[0],gB-(bridge?.7:.15),pB[1],pB[0],gB+ch,pB[1],pierColor.r,pierColor.g,pierColor.b,nx*s,0,nz*s,0,0,1,0,1,1);
              triFlat(curbs,pA[0],gA-(bridge?.7:.15),pA[1],pB[0],gB+ch,pB[1],pA[0],gA+ch,pA[1],pierColor.r,pierColor.g,pierColor.b,nx*s,0,nz*s,0,0,1,1,0,1);
            }
            if(bridge&&part===0&&length>14){
              const mx=(x+x2)*.5,mz=(z+z2)*.5,gm=ground(mx,mz),pw=Math.min(2.4,width*.14);
              for(const [sx,sz] of [[-pw,-pw],[pw,-pw],[pw,pw],[-pw,pw]]){
                void sx;void sz;
              }
              triFlat(curbs,mx-pw,gm-.5,mz-pw,mx+pw,gm-.5,mz-pw,mx+pw,gm+liftBridge+.1,mz-pw,pierColor.r,pierColor.g,pierColor.b,0,0,-1,0,0,1,0,1,1);
              triFlat(curbs,mx-pw,gm-.5,mz-pw,mx+pw,gm+liftBridge+.1,mz-pw,mx-pw,gm+liftBridge+.1,mz-pw,pierColor.r,pierColor.g,pierColor.b,0,0,-1,0,0,1,1,0,1);
              triFlat(curbs,mx+pw,gm-.5,mz-pw,mx+pw,gm-.5,mz+pw,mx+pw,gm+liftBridge+.1,mz+pw,pierColor.r,pierColor.g,pierColor.b,1,0,0,0,0,1,0,1,1);
              triFlat(curbs,mx+pw,gm-.5,mz-pw,mx+pw,gm+liftBridge+.1,mz+pw,mx+pw,gm+liftBridge+.1,mz-pw,pierColor.r,pierColor.g,pierColor.b,1,0,0,0,0,1,1,0,1);
            }
          }
          // Pedestrian crosswalk zebra bars near major intersections
          if(i===2&&part===0&&!bridge&&width>=12&&length>=14){
            const cxA=ax+dx/length*1.5,czA=az+dz/length*1.5,cxB=ax+dx/length*4.5,czB=az+dz/length*4.5;
            for(let bar=-width*.4;bar<=width*.4;bar+=1.8){
              const a1=[cxA+nx*bar,czA+nz*bar],a2=[cxA+nx*(bar+.85),czA+nz*(bar+.85)];
              const b1=[cxB+nx*bar,czB+nz*bar],b2=[cxB+nx*(bar+.85),czB+nz*(bar+.85)];
              const yZ=ground(cxA,czA)+.22;
              tri(lines,[a1[0],yZ,a1[1]],[a2[0],yZ,a2[1]],[b2[0],yZ,b2[1]],white,[0,1,0]);
              tri(lines,[a1[0],yZ,a1[1]],[b2[0],yZ,b2[1]],[b1[0],yZ,b1[1]],white,[0,1,0]);
            }
          }
        }
      }
      if(r%12===0)yield;
    }
    // Winding may differ between OSM ways; all 4 facade styles use DoubleSide and only ~6 building draw calls per tile.
    for(let s=0;s<4;s++)mesh(group,wallBufs[s],wallMats[s],wallNames[s]);
    mesh(group,roofFlatBuf,roofFlat,'Taipei flat rooftops');mesh(group,roofPitchedBuf,roofPitched,'Taipei pitched & corrugated roofs');
    mesh(group,roads,asphalt,'Taipei streets and bridges');mesh(group,curbs,concreteCurb,'Taipei curbs and viaduct piers');mesh(group,lines,stripe,'Road markings');mesh(group,waters,water,'Taipei water');
    Object.assign(group.userData,{buildings:built,roads:data.r.length,routes:data.r.filter(r=>r[0]>=11&&r[2].length>=6)});root.add(group);loaded.set(key,group);
    stats.buildings+=built;stats.roads+=data.r.length;stats.tiles=loaded.size;
    stats.maskRevision++;
  }
  function dispose(key){
    const group=loaded.get(key);if(!group)return;
    stats.buildings-=group.userData.buildings;stats.roads-=group.userData.roads;
    for(const [key,rect] of group.userData.masks){const cell=masks.get(key);cell.delete(rect);if(!cell.size)masks.delete(key);}
    group.traverse(o=>o.geometry?.dispose());root.remove(group);loaded.delete(key);stats.tiles=loaded.size;
    if(typeof BuildingCollision!=='undefined')BuildingCollision.clearGroup('tp:'+key);
    stats.maskRevision++;
  }
  function request(tile){
    const key=tile[0];pending.add(key);stats.loading=pending.size;
    fetch('taipei-city/'+key+'.json?v=27').then(r=>{if(!r.ok)throw new Error(r.status);return r.json();})
      .then(data=>jobs.push({key,iterator:build(key,data)}))
      .catch(()=>{failed.set(key,clock+15);pending.delete(key);stats.loading=pending.size;});
  }
  const vehicleMat=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.46,metalness:.12});
  const vehicles=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),vehicleMat,64);
  vehicles.name='Taipei moving traffic';
  const cabins=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),darkGlass,64);
  const headlamps=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial({color:0xffe5ad}),128);
  const tailLamps=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial({color:0xef4736}),128);
  const tyre=new THREE.CylinderGeometry(.33,.33,.22,8);tyre.rotateZ(Math.PI/2);
  const tyres=new THREE.InstancedMesh(tyre,new THREE.MeshStandardMaterial({color:0x252b2e,roughness:.95}),256);
  root.add(vehicles,cabins,headlamps,tailLamps,tyres);
  const matrix=new THREE.Object3D(),cars=Array.from({length:64},(_,i)=>({route:null,t:Math.random(),pace:.85+Math.random()*.3}));
  for(let i=0;i<64;i++)vehicles.setColorAt(i,new THREE.Color(['#dedfdc','#c3b14a','#4a6573','#a8b2b2','#faf6e7','#ae4e43'][i%6]));
  let trafficTime=0;
  function traffic(dt,x,z,paused,mobile){
    trafficTime+=dt;if(trafficTime<.05)return;
    dt=trafficTime;trafficTime=0;
    const available=[...loaded.values()].filter(g=>g.visible).flatMap(g=>g.userData.routes);
    const count=Math.min(mobile?40:64,available.length);vehicles.count=cabins.count=count;
    stats.vehicles=count;
    headlamps.count=tailLamps.count=count*2;tyres.count=count*4;
    headlamps.visible=tailLamps.visible=day<.4;
    function instance(mesh,i,px,py,pz,w,h,d,angle){matrix.position.set(px,py,pz);matrix.scale.set(w,h,d);matrix.rotation.set(0,angle,0);matrix.updateMatrix();mesh.setMatrixAt(i,matrix.matrix);}
    for(let i=0;i<count;i++){
      const car=cars[i];
      // Route remains selected while its tile is loaded: no per-frame jumps.
      if(!car.route||!available.includes(car.route))car.route=available[Math.floor(Math.random()*available.length)];
      const [width,bridge,p]=car.route,points=[];let length=0;
      for(let n=2;n<p.length;n+=2){const segment=Math.hypot(p[n]-p[n-2],p[n+1]-p[n-1]);points.push(segment);length+=segment;}
      if(!paused)car.t=(car.t+(width>15?17:10)*car.pace*dt/Math.max(1,length))%1;
      let distance=car.t*length,j=0;while(j<points.length-1&&distance>points[j])distance-=points[j++];
      const f=distance/Math.max(.01,points[j]),n=j*2,dx=p[n+2]-p[n],dz=p[n+3]-p[n+1],norm=Math.max(.01,points[j]);
      const px=p[n]+dx*f-dz/norm*width*.23,pz=p[n+1]+dz*f+dx/norm*width*.23;
      const y=ground(px,pz)+(bridge?8:0)+.5,angle=Math.atan2(dx,dz),bus=i%9===0,long=bus?10:4.5;
      instance(vehicles,i,px,y+(bus?1:.5),pz,bus?2.35:1.8,bus?2:1,long,angle);
      instance(cabins,i,px,y+(bus?2:1.12),pz,bus?2.15:1.58,bus?.65:.52,long*.64,angle);
      for(let side=0;side<2;side++){
        const offset=(side?1:-1)*.67,ox=dz/norm*offset,oz=-dx/norm*offset;
        instance(headlamps,i*2+side,px+dx/norm*long*.51+ox,y+.42,pz+dz/norm*long*.51+oz,.35,.18,.1,angle);
        instance(tailLamps,i*2+side,px-dx/norm*long*.51+ox,y+.42,pz-dz/norm*long*.51+oz,.3,.2,.1,angle);
      }
      for(let wheel=0;wheel<4;wheel++){
        const ox=(wheel%2?1:-1)*(bus?1.18:.91),oz=(wheel<2?-1:1)*long*.32;
        instance(tyres,i*4+wheel,px+dz/norm*ox+dx/norm*oz,y-.05,pz-dx/norm*ox+dz/norm*oz,1,1,1,angle);
      }
    }
    for(const mesh of [vehicles,cabins,tyres,headlamps,tailLamps]){mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();}
  }
  function update(dt,x,z,quality,activeDay,wet,paused){
    clock+=Math.min(dt,.1);day=activeDay;
    const at=latLon(x,z),near=at.lat>24.90&&at.lat<25.22&&at.lon>121.35&&at.lon<121.74;
    root.visible=near;if(!near)return;
    const mobile=touchControls.mode.value==='mobile',range=mobile?4800:quality==='ultra'?11000:quality==='high'?9000:6500;
    const nightAmt=1-day,nightCurve=Math.pow(nightAmt,1.2);
    matApt.emissiveIntensity=nightAmt*.82;
    matGlass.emissiveIntensity=nightCurve*1.18;matGlass.envMapIntensity=.22+day*.85;
    matBrick.emissiveIntensity=nightAmt*.78;
    matCondo.emissiveIntensity=nightCurve*.92;matCondo.envMapIntensity=.12+day*.35;
    glass.emissiveIntensity=nightAmt*.95;
    officeGlass.emissiveIntensity=Math.pow(nightAmt,1.25)*1.28;officeGlass.envMapIntensity=.25+day*1.15;
    beaconMat.emissiveIntensity=(1-day)*(Math.sin(clock*4.5)>0?2.1:.15);
    ferrisGreen.emissiveIntensity=.45+(1-day)*1.25;
    asphalt.roughness=wet?.32:.86;asphalt.metalness=wet?.18:.02;
    asphalt.emissiveIntensity=Math.pow(1-day,1.25)*(wet?1.15:.92);
    stripe.emissiveIntensity=Math.pow(1-day,1.3)*.28;
    traffic(dt,x,z,paused,mobile);
    if(!index&&!indexRequest&&clock>=nextScan){
      indexRequest=true;fetch('taipei-city/index.json?v=27').then(r=>{if(!r.ok)throw new Error(r.status);return r.json();})
        .then(data=>{index=data;root.userData.coverage=data;})
        .catch(()=>{indexRequest=false;nextScan=clock+10;});
    }
    if(index&&clock>=nextScan){
      nextScan=clock+.5;
      const distances=index.tiles.map(t=>[t,Math.hypot(t[1]-x,t[2]-z)]).sort((a,b)=>a[1]-b[1]);
      for(const [tile,distance] of distances){
        const mesh=loaded.get(tile[0]);if(mesh)mesh.visible=distance<range+1150;
        if(distance<range+800&&!mesh&&!pending.has(tile[0])&&(failed.get(tile[0])??0)<clock&&pending.size<2)request(tile);
        if(mesh&&distance>range+4200)dispose(tile[0]);
      }
    }
    const end=performance.now()+(mobile?1.8:2.8);
    while(jobs.length&&performance.now()<end){
      const job=jobs[0];
      try{
        if(job.iterator.next().done){jobs.shift();pending.delete(job.key);stats.loading=pending.size;nextScan=0;}
      }catch(error){jobs.shift();pending.delete(job.key);failed.set(job.key,clock+15);console.warn('Optional Taipei tile:',error);}
    }
  }
  return {root,stats,inside,update,landmarks,landmarkSites,blocked};
}
