'use strict';
function createTaiwanCity(scene,ground,airports){
  const root=new THREE.Group();root.name='Taiwan all-island 3D cities';scene.add(root);
  const taipeiBox={s:24.97,w:121.43,n:25.14,e:121.65};
  const insideTaipei=(lat,lon)=>lat>=taipeiBox.s&&lat<=taipeiBox.n&&lon>=taipeiBox.w&&lon<=taipeiBox.e;
  const inside=(lat,lon)=>!insideTaipei(lat,lon)&&lat>=21.8&&lat<=26.4&&lon>=118.1&&lon<=122.2;

  let index=null,indexRequest=false,clock=0,day=1,nextScan=0;
  const loaded=new Map(),pending=new Set(),failed=new Map(),jobs=[],masks=new Map();
  const stats={buildings:0,tiles:0,loading:0,landmarks:0,maskRevision:0,ready:false};
  const mask=(g,x1,z1,x2,z2)=>{
    const r=[x1,z1,x2,z2],c1=Math.floor(x1/320),c2=Math.floor(x2/320),r1=Math.floor(z1/320),r2=Math.floor(z2/320);
    for(let rz=r1;rz<=r2;rz++)for(let cx=c1;cx<=c2;cx++){
      const k=cx+':'+rz;if(!masks.has(k))masks.set(k,new Set());masks.get(k).add(r);g.userData.masks.push([k,r]);
    }
  };
  const blocked=(x,z)=>{
    const cell=masks.get(Math.floor(x/320)+':'+Math.floor(z/320));
    if(!cell)return false;
    for(const [x1,z1,x2,z2] of cell)if(x>=x1&&x<=x2&&z>=z1&&z<=z2)return true;
    return false;
  };

  function texture(draw,srgb){
    const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
    draw(canvas.getContext('2d'),256);
    const tex=new THREE.CanvasTexture(canvas);
    tex.wrapS=tex.wrapT=THREE.RepeatWrapping;
    tex.anisotropy=8;
    if(srgb)tex.colorSpace=THREE.SRGBColorSpace;
    return tex;
  }

  // Taipei-grade sky & horizon equirectangular environment reflection for glass skyscrapers
  const reflCanvas=document.createElement('canvas');reflCanvas.width=256;reflCanvas.height=128;
  const rx=reflCanvas.getContext('2d');
  const rg=rx.createLinearGradient(0,0,0,128);
  rg.addColorStop(0,'#4688c2');rg.addColorStop(0.45,'#9bc9ea');rg.addColorStop(0.51,'#eef6fd');
  rg.addColorStop(0.55,'#556775');rg.addColorStop(1,'#27343e');
  rx.fillStyle=rg;rx.fillRect(0,0,256,128);
  rx.fillStyle='rgba(255,250,235,0.7)';rx.beginPath();rx.arc(192,38,16,0,Math.PI*2);rx.fill();
  const reflectedMap=new THREE.CanvasTexture(reflCanvas);
  reflectedMap.mapping=THREE.EquirectangularReflectionMapping;
  reflectedMap.colorSpace=THREE.SRGBColorSpace;

  // 1. Taiwanese Tile & Balcony Apartment (wallApt): ceramic mosaic tile grid, recessed dark aluminum windows,
  // white/silver balcony railings, exterior AC units, and warm-lit 1F arcade/storefront (騎樓)
  const aptTex=texture(c=>{
    c.fillStyle='#f3f0e8';c.fillRect(0,0,256,256);
    // Fine ceramic mosaic tile grid with subtle tile-to-tile tonal variation
    for(let ty=0;ty<256;ty+=6){
      const shift=(ty%12===0)?0:6;
      for(let tx=0;tx<256;tx+=12){
        const v=((tx*13+ty*29)%17);
        c.fillStyle=v<4?'#ece7dc':v<8?'#f7f4ee':'#f2eee6';
        c.fillRect(tx+shift,ty,11,5);
      }
      c.fillStyle='rgba(120,112,102,0.18)';c.fillRect(0,ty,256,1);
    }
    for(let ty=0;ty<256;ty+=6){
      const shift=(ty%12===0)?0:6;
      c.fillStyle='rgba(120,112,102,0.14)';
      for(let tx=shift;tx<256;tx+=12)c.fillRect(tx,ty,1,6);
    }
    // 7 upper residential stories (y=0..216, 31px each) + 1F 騎樓 arcade storefront at bottom (y=217..256)
    for(let row=0;row<7;row++){
      const y=row*31;
      // Floor slab ledge & subtle balcony underside shadow
      c.fillStyle='#d2ccc0';c.fillRect(0,y+26,256,3);
      c.fillStyle='rgba(40,42,46,0.22)';c.fillRect(0,y+29,256,2);
      for(let col=0;col<5;col++){
        const x=5+col*50;
        // Recessed balcony opening shadow
        c.fillStyle='rgba(36,42,48,0.22)';c.fillRect(x-1,y+3,40,23);
        // Recessed dark aluminum window frame
        c.fillStyle='#2a3239';c.fillRect(x+2,y+4,34,18);
        // Split glass panes with subtle sky bounce
        const bright=(row*5+col*3)%4===0;
        c.fillStyle=bright?'#7ea0b5':'#506d7e';
        c.fillRect(x+4,y+6,14,14);c.fillRect(x+20,y+6,14,14);
        c.fillStyle='rgba(230,244,255,0.28)';
        c.fillRect(x+5,y+7,5,11);c.fillRect(x+21,y+7,5,11);
        c.fillStyle='#1f262c';c.fillRect(x+18,y+6,2,14);
        // White/silver balcony railing & vertical balusters
        c.fillStyle='#eceff2';c.fillRect(x,y+15,38,2);c.fillRect(x,y+23,38,2);
        c.fillStyle='#cfd6dc';
        for(let rx=x+2;rx<=x+36;rx+=6)c.fillRect(rx,y+17,1,6);
        // Exterior mini-split AC compressor unit on ~65% of balconies
        if((row*7+col*11)%3!==0){
          c.fillStyle='#f4f6f8';c.fillRect(x+24,y+16,12,8);
          c.fillStyle='#c4ccd2';c.fillRect(x+24,y+16,12,1);
          c.fillStyle='#3a4249';c.fillRect(x+26,y+18,5,4);
          c.fillStyle='#78828a';c.fillRect(x+32,y+18,3,4);
        }
      }
    }
    // 1F Taiwanese arcade / storefront (騎樓) at bottom of texture (maps to v=0 ground level)
    c.fillStyle='#d8d2c6';c.fillRect(0,217,256,5);
    c.fillStyle='#343a40';c.fillRect(0,222,256,34);
    for(let col=0;col<4;col++){
      const sx=col*64;
      // Arcade structural column
      c.fillStyle='#ece7dc';c.fillRect(sx,222,11,34);
      c.fillStyle='#c9c2b5';c.fillRect(sx+9,222,2,34);
      // Warm-lit shopfront interior & glass bay
      const sg=c.createLinearGradient(sx+13,225,sx+13,254);
      sg.addColorStop(0,'#f6dfb0');sg.addColorStop(0.55,'#d9b478');sg.addColorStop(1,'#6d5a42');
      c.fillStyle=sg;c.fillRect(sx+13,226,48,26);
      // Shopfront mullions & subtle signage fascia
      c.fillStyle='#2a2f34';c.fillRect(sx+29,226,2,26);c.fillRect(sx+45,226,2,26);
      c.fillStyle=col%3===0?'#d96b4e':col%3===1?'#4d8978':'#d9a441';
      c.fillRect(sx+12,219,50,6);
      c.fillStyle='rgba(255,255,255,0.65)';c.fillRect(sx+18,221,36,2);
    }
  },true);

  const aptNight=texture(c=>{
    c.fillStyle='#000';c.fillRect(0,0,256,256);
    for(let row=0;row<7;row++){
      const y=row*31;
      for(let col=0;col<5;col++){
        const h=(row*11+col*17)%13;
        if(h<5)continue;
        const x=5+col*50;
        c.fillStyle=h<8?'#ffd584':h<11?'#f7e8c2':'#a4c7e0';
        c.fillRect(x+4,y+6,14,14);c.fillRect(x+20,y+6,14,14);
      }
    }
    // Warm-lit 1F 騎樓 storefronts at night
    for(let col=0;col<4;col++){
      const sx=col*64;
      c.fillStyle=col%2===0?'#ffda90':'#ffe8b5';
      c.fillRect(sx+13,226,48,26);
      c.fillStyle='#ffe2a8';c.fillRect(sx+14,220,46,4);
    }
  },true);

  // 2. Modern Glass Curtain-Wall Tower (wallGlass): reflective tinted curtain-wall grid, mullions,
  // spandrel bands, diagonal sky reflection highlights (high-value base so vertexColors tint vividly)
  const glassTex=texture(c=>{
    c.fillStyle='#d4e2ec';c.fillRect(0,0,256,256);
    for(let row=0;row<8;row++){
      const y=row*32;
      // Horizontal metallic spandrel band
      c.fillStyle='#788896';c.fillRect(0,y,256,7);
      c.fillStyle='#b8c6d2';c.fillRect(0,y+6,256,1);
      for(let col=0;col<8;col++){
        const x=col*32;
        const v=(row*5+col*7)%9;
        // Bright neutral-cool vision glass pane
        c.fillStyle=v<2?'#eaf4fc':v<5?'#d4e6f4':v<7?'#bfd6e8':'#cde0ef';
        c.fillRect(x+2,y+7,28,24);
        // Subtle interior ceiling/blind gradation
        c.fillStyle='rgba(24,38,52,0.14)';c.fillRect(x+2,y+7,28,5);
        // Vertical mullion + specular highlight edge
        c.fillStyle='#34424e';c.fillRect(x,y+7,2,25);
        c.fillStyle='#e2ecf4';c.fillRect(x+2,y+7,1,24);
        c.fillStyle='#465664';c.fillRect(x+15,y+7,1,24);
      }
    }
    // Diagonal sky reflection highlight sweeps across curtain wall
    c.fillStyle='rgba(255,255,255,0.24)';
    c.beginPath();c.moveTo(0,96);c.lineTo(96,0);c.lineTo(148,0);c.lineTo(0,148);c.fill();
    c.beginPath();c.moveTo(116,256);c.lineTo(256,116);c.lineTo(256,162);c.lineTo(162,256);c.fill();
  },true);

  const glassRough=texture(c=>{
    c.fillStyle='#363636';c.fillRect(0,0,256,256);
    for(let y=0;y<256;y+=32){
      c.fillStyle='#c4c4c4';c.fillRect(0,y,256,7);
      for(let x=0;x<256;x+=32){c.fillStyle='#b0b0b0';c.fillRect(x,y,2,32);}
    }
  },false);

  const glassNight=texture(c=>{
    c.fillStyle='#000';c.fillRect(0,0,256,256);
    for(let row=0;row<8;row++){
      const y=row*32;
      const floorActive=(row*7+3)%5!==0;
      for(let col=0;col<8;col++){
        if(!floorActive&&((row+col)%3!==0))continue;
        const h=(row*13+col*19)%11;
        if(h<4)continue;
        const x=col*32;
        c.fillStyle=h<6?'#ffe4a4':h<9?'#d4ebff':'#fff1cb';
        c.fillRect(x+3,y+8,26,22);
      }
    }
  },true);

  // 3. Red-Brick / Minnan / Heritage Townhouse 透天厝 (wallBrick): masonry courses, framed windows
  // with awnings/shutters, horizontal cornice trims, traditional shopfront ground floor
  const brickTex=texture(c=>{
    c.fillStyle='#f0eae2';c.fillRect(0,0,256,256);
    // Running-bond brick/terracotta masonry courses (high-value neutral so vertexColors tint richly)
    for(let y=0;y<256;y+=8){
      const shift=(y%16===0)?0:10;
      for(let x=-10;x<256;x+=20){
        const k=((x*7+y*13)&15);
        c.fillStyle=k<4?'#dfd6cb':k<8?'#ece4da':k<12?'#f6f1ea':'#e6ddd2';
        c.fillRect(x+shift,y,19,7);
      }
      c.fillStyle='#cfc5b8';c.fillRect(0,y+7,256,1);
    }
    // 4 upper townhouse stories (y=0..192, 48px each) + traditional shopfront 1F (y=192..256)
    for(let row=0;row<4;row++){
      const y=row*48;
      // Horizontal cornice belt trim
      c.fillStyle='#f9f6f0';c.fillRect(0,y+42,256,4);
      c.fillStyle='rgba(70,56,48,0.28)';c.fillRect(0,y+46,256,2);
      for(let col=0;col<4;col++){
        const x=10+col*64;
        // Corrugated metal / painted awning above window (遮雨棚)
        c.fillStyle='#b8c0c4';c.fillRect(x-3,y+6,46,6);
        c.fillStyle='rgba(36,30,28,0.28)';c.fillRect(x-2,y+12,44,3);
        // Window frame + wooden shutters
        c.fillStyle='#8c7a68';c.fillRect(x-4,y+13,6,24);c.fillRect(x+38,y+13,6,24);
        c.fillStyle='#ede6dc';c.fillRect(x+2,y+13,36,24);
        c.fillStyle='#333c44';c.fillRect(x+5,y+16,30,18);
        c.fillStyle=(row+col)%3===0?'#6d8596':'#4b5f6e';
        c.fillRect(x+6,y+17,13,16);c.fillRect(x+21,y+17,13,16);
        // Sill
        c.fillStyle='#f4efe6';c.fillRect(x,y+36,40,3);
      }
    }
    // Traditional Taiwanese 透天厝 ground-floor shopfront & wooden lintel bay
    c.fillStyle='#e8dfd4';c.fillRect(0,192,256,6);
    c.fillStyle='#4a3d35';c.fillRect(0,198,256,58);
    for(let col=0;col<3;col++){
      const sx=8+col*84;
      c.fillStyle='#ebe4d8';c.fillRect(sx-8,198,10,58);
      // Warm transom + wood-framed shopfront glass/door
      c.fillStyle='#b98552';c.fillRect(sx+4,202,68,8);
      c.fillStyle='#e6c690';c.fillRect(sx+6,212,64,42);
      c.fillStyle='#5c4534';c.fillRect(sx+26,212,3,42);c.fillRect(sx+48,212,3,42);
      c.fillStyle='rgba(40,28,20,0.25)';c.fillRect(sx+6,238,64,16);
    }
  },true);

  const brickNight=texture(c=>{
    c.fillStyle='#000';c.fillRect(0,0,256,256);
    for(let row=0;row<4;row++){
      const y=row*48;
      for(let col=0;col<4;col++){
        if((row*5+col*9)%7<3)continue;
        const x=10+col*64;
        c.fillStyle=(row+col)%2===0?'#ffd07a':'#ffe4aa';
        c.fillRect(x+6,y+17,13,16);c.fillRect(x+21,y+17,13,16);
      }
    }
    for(let col=0;col<3;col++){
      const sx=8+col*84;
      c.fillStyle='#ffd890';c.fillRect(sx+6,212,64,34);
    }
  },true);

  // 4. Modern Granite / White-Stucco Residence (wallCondo): clean architectural panels,
  // deep cantilevered balcony bands, dark floor-to-ceiling window mullions
  const condoTex=texture(c=>{
    c.fillStyle='#f3f3f1';c.fillRect(0,0,256,256);
    // Crisp architectural stone cladding joints & subtle granite grain
    for(let i=0;i<900;i++){
      c.fillStyle=i%2?'rgba(0,0,0,0.035)':'rgba(255,255,255,0.05)';
      c.fillRect((i*67)%256,(i*113)%256,2,2);
    }
    c.fillStyle='rgba(90,94,100,0.16)';
    for(let y=0;y<256;y+=32)c.fillRect(0,y,256,1);
    for(let x=0;x<256;x+=64)c.fillRect(x,0,1,256);
    // 8 sleek modern residential stories
    for(let row=0;row<8;row++){
      const y=row*32;
      // Deep cantilevered balcony overhang shadow
      c.fillStyle='rgba(28,34,40,0.34)';c.fillRect(0,y+1,256,4);
      for(let col=0;col<4;col++){
        const x=6+col*64;
        // Dark modern sliding glass doors & mullions
        c.fillStyle='#2a323b';c.fillRect(x,y+5,52,20);
        c.fillStyle=(row*3+col*5)%5===0?'#94b0c2':'#6a8598';
        c.fillRect(x+2,y+6,15,18);c.fillRect(x+19,y+6,15,18);c.fillRect(x+36,y+6,14,18);
        c.fillStyle='rgba(235,246,255,0.26)';
        c.fillRect(x+3,y+7,4,15);c.fillRect(x+20,y+7,4,15);
        // Cantilevered balcony glass balustrade & crisp architectural slab fascia
        c.fillStyle='rgba(175,204,222,0.52)';c.fillRect(x-2,y+17,56,7);
        c.fillStyle='#ffffff';c.fillRect(x-3,y+24,58,5);
        c.fillStyle='#c8cdd2';c.fillRect(x-3,y+16,58,1);
      }
    }
  },true);

  const condoNight=texture(c=>{
    c.fillStyle='#000';c.fillRect(0,0,256,256);
    for(let row=0;row<8;row++){
      const y=row*32;
      for(let col=0;col<4;col++){
        const h=(row*9+col*13)%11;
        if(h<4)continue;
        const x=6+col*64;
        c.fillStyle=h<8?'#ffe0a3':'#fff0cc';
        c.fillRect(x+2,y+6,15,16);c.fillRect(x+19,y+6,15,16);c.fillRect(x+36,y+6,14,16);
        // Warm modern indirect balcony cove glow
        c.fillStyle='rgba(255,214,148,0.45)';c.fillRect(x,y+22,52,2);
      }
    }
  },true);

  // 5. Hsinchu/Taichung/Tainan Sci-Park & Industrial Cleanroom (techWall):
  // corrugated metal panels, cleanroom ribbon windows, crisp horizontal louvers & vents
  const techTex=texture(c=>{
    c.fillStyle='#eaedf0';c.fillRect(0,0,256,256);
    // Vertical corrugated metal ribs & architectural panel seams
    for(let x=0;x<256;x+=8){
      c.fillStyle='#d6dde3';c.fillRect(x,0,2,256);
      c.fillStyle='#f6f8fa';c.fillRect(x+2,0,1,256);
    }
    c.fillStyle='#a8b4be';
    for(let x=0;x<256;x+=32)c.fillRect(x,0,2,256);
    for(let y=0;y<256;y+=64){
      // Cleanroom ribbon window band
      c.fillStyle='#243642';c.fillRect(0,y+14,256,18);
      for(let x=0;x<256;x+=32){
        c.fillStyle=(x/32+y/64)%3===0?'#6e94ad':'#4a6c82';
        c.fillRect(x+2,y+16,28,14);
        c.fillStyle='rgba(235,248,255,0.28)';c.fillRect(x+4,y+17,10,4);
      }
      // Crisp horizontal HVAC louvers & exhaust vents
      c.fillStyle='#b8c2ca';c.fillRect(0,y+42,256,14);
      c.fillStyle='#5c6872';
      for(let ly=y+44;ly<y+55;ly+=3)c.fillRect(4,ly,248,1);
      for(let vx=16;vx<256;vx+=64){
        c.fillStyle='#78848e';c.fillRect(vx,y+43,22,12);
        c.fillStyle='#3c464e';
        for(let ly=y+45;ly<y+54;ly+=3)c.fillRect(vx+2,ly,18,1);
      }
    }
  },true);

  const techNight=texture(c=>{
    c.fillStyle='#000';c.fillRect(0,0,256,256);
    for(let y=0;y<256;y+=64){
      for(let x=0;x<256;x+=32){
        if(((x*3+y*5)%7)<2)continue;
        c.fillStyle='#dcf0ff';
        c.fillRect(x+2,y+16,28,14);
      }
    }
  },true);

  // Landmark high-rise glass curtain wall (non-vertexColors for iconic landmarks)
  const officeTex=texture(c=>{
    c.fillStyle='#264354';c.fillRect(0,0,256,256);
    for(let y=0;y<256;y+=32){
      c.fillStyle='#192c38';c.fillRect(0,y,256,6);
      c.fillStyle='#345a70';c.fillRect(0,y+6,256,26);
      for(let x=0;x<256;x+=16){
        c.fillStyle=(x/16+y/32)%5===0?'#5285a0':'#2f5368';
        c.fillRect(x+2,y+7,12,24);
        c.fillStyle='#14232d';c.fillRect(x,y+6,2,26);
      }
    }
  },true);
  const officeRough=glassRough;
  const officeNight=glassNight;

  // Flat roof texture (neutral bright base for vertexColors: emerald waterproof, weathered concrete,
  // parapet walls, rooftop HVAC chillers & signature Taiwanese stainless water tanks)
  const roofFlatTex=texture(c=>{
    c.fillStyle='#e8eae8';c.fillRect(0,0,256,256);
    // Subtle waterproof membrane seams & weathered patches
    c.fillStyle='rgba(0,0,0,0.06)';
    for(let i=0;i<14;i++)c.fillRect((i*47)%212,(i*73)%212,34,28);
    c.fillStyle='rgba(255,255,255,0.08)';
    for(let y=32;y<224;y+=32)c.fillRect(14,y,228,2);
    // Parapet border wall & inner drop shadow
    c.fillStyle='#b8bcba';
    c.fillRect(0,0,256,12);c.fillRect(0,244,256,12);c.fillRect(0,0,12,256);c.fillRect(244,0,12,256);
    c.fillStyle='rgba(0,0,0,0.20)';c.fillRect(12,12,232,5);c.fillRect(12,12,5,232);
    // Rooftop stairwell / elevator penthouse pad
    c.fillStyle='#f0f0ec';c.fillRect(156,26,72,54);
    c.fillStyle='rgba(0,0,0,0.22)';c.fillRect(160,80,72,6);c.fillRect(228,30,5,54);
    // Rooftop HVAC chiller boxes
    for(const [ax,ay] of [[32,168],[74,168],[116,174]]){
      c.fillStyle='#969fa8';c.fillRect(ax,ay,32,24);
      c.fillStyle='#464f58';c.beginPath();c.arc(ax+16,ay+12,8,0,Math.PI*2);c.fill();
      c.fillStyle='#78848e';c.beginPath();c.arc(ax+16,ay+12,3,0,Math.PI*2);c.fill();
    }
    // Signature Taiwanese cylindrical stainless steel water tanks (水塔)
    const drawTank=(cx,cy,r)=>{
      c.fillStyle='rgba(0,0,0,0.30)';c.beginPath();c.ellipse(cx+r*0.22,cy+r*0.24,r*1.04,r*0.88,0,0,Math.PI*2);c.fill();
      const g=c.createRadialGradient(cx-r*0.32,cy-r*0.32,r*0.1,cx,cy,r);
      g.addColorStop(0,'#ffffff');g.addColorStop(0.35,'#e2e7ec');g.addColorStop(0.75,'#a4aeb8');g.addColorStop(1,'#6a747e');
      c.fillStyle=g;c.beginPath();c.arc(cx,cy,r,0,Math.PI*2);c.fill();
    };
    drawTank(58,68,22);drawTank(108,64,18);drawTank(72,118,16);
  },true);

  // Pitched roof texture (neutral bright base for vertexColors: Minnan terracotta tiles / corrugated metal / slate)
  const roofPitchedTex=texture(c=>{
    c.fillStyle='#ecebe8';c.fillRect(0,0,256,256);
    // Overlapping tile courses + vertical barrel-tile / corrugated ribs
    for(let y=0;y<256;y+=16){
      c.fillStyle='rgba(0,0,0,0.20)';c.fillRect(0,y,256,3);
      c.fillStyle='rgba(255,255,255,0.22)';c.fillRect(0,y+3,256,2);
      const off=(y%32===0)?0:6;
      for(let x=off;x<256;x+=12){
        c.fillStyle='rgba(0,0,0,0.13)';c.fillRect(x,y+2,2,14);
        c.fillStyle='rgba(255,255,255,0.16)';c.fillRect(x+4,y+3,2,12);
      }
    }
  },true);

  // 5 distinct PBR building wall materials + 2 distinct roof materials (all vertexColors: true for city tiles)
  const wallApt=new THREE.MeshStandardMaterial({vertexColors:true,map:aptTex,roughness:0.78,metalness:0.04,emissive:0xffe2ad,emissiveMap:aptNight,emissiveIntensity:0,side:THREE.DoubleSide});
  const wallGlass=new THREE.MeshPhysicalMaterial({
    vertexColors:true,map:glassTex,roughnessMap:glassRough,roughness:0.24,metalness:0.58,
    clearcoat:0.85,clearcoatRoughness:0.12,envMap:reflectedMap,envMapIntensity:1.15,
    emissive:0xffe6b8,emissiveMap:glassNight,emissiveIntensity:0,side:THREE.DoubleSide
  });
  const wallBrick=new THREE.MeshStandardMaterial({vertexColors:true,map:brickTex,roughness:0.86,metalness:0.02,emissive:0xffd794,emissiveMap:brickNight,emissiveIntensity:0,side:THREE.DoubleSide});
  const wallCondo=new THREE.MeshStandardMaterial({vertexColors:true,map:condoTex,roughness:0.62,metalness:0.14,emissive:0xffe4b2,emissiveMap:condoNight,emissiveIntensity:0,side:THREE.DoubleSide});
  const techWall=new THREE.MeshStandardMaterial({vertexColors:true,map:techTex,roughness:0.42,metalness:0.44,emissive:0xdcf0ff,emissiveMap:techNight,emissiveIntensity:0,side:THREE.DoubleSide});
  const roofFlat=new THREE.MeshStandardMaterial({vertexColors:true,map:roofFlatTex,roughness:0.82,metalness:0.08});
  const roofPitched=new THREE.MeshStandardMaterial({vertexColors:true,map:roofPitchedTex,roughness:0.72,metalness:0.12,side:THREE.DoubleSide});

  // Landmark shared materials (non-vertexColors for BoxGeometry/CylinderGeometry landmark primitives)
  const wall=new THREE.MeshStandardMaterial({color:0xebe2d2,map:aptTex,roughness:0.78,metalness:0.04,emissive:0xffe2ad,emissiveMap:aptNight,emissiveIntensity:0,side:THREE.DoubleSide});
  const officeGlass=new THREE.MeshPhysicalMaterial({
    map:officeTex,roughnessMap:officeRough,color:0x3f657a,metalness:.80,roughness:.22,
    clearcoat:1.0,clearcoatRoughness:.09,envMap:reflectedMap,envMapIntensity:1.15,
    emissiveMap:officeNight,emissive:0xffdfab,emissiveIntensity:0,side:THREE.DoubleSide
  });
  const stone=new THREE.MeshStandardMaterial({color:0xd8d2c6,roughness:.76});
  const graniteRed=new THREE.MeshStandardMaterial({color:0xa84638,roughness:.74});
  const darkGlass=new THREE.MeshPhysicalMaterial({color:0x1a303d,metalness:.85,roughness:.18,clearcoat:1,envMap:reflectedMap,envMapIntensity:1.1,emissive:0xffdfa6,emissiveIntensity:0});
  const metal=new THREE.MeshStandardMaterial({color:0xb8c2c9,roughness:.34,metalness:.68});
  const darkBasalt=new THREE.MeshStandardMaterial({color:0x2e343a,roughness:.78});
  const pagodaRed=new THREE.MeshStandardMaterial({color:0xa62620,roughness:.68});
  const pagodaGreen=new THREE.MeshStandardMaterial({color:0x2e6f56,roughness:.62});
  const gold=new THREE.MeshStandardMaterial({color:0xddb24d,roughness:.35,metalness:.72});
  const whiteFrame=new THREE.MeshStandardMaterial({color:0xf2f5f7,roughness:.45});
  const beaconMat=new THREE.MeshStandardMaterial({color:0xff2820,emissive:0xff2218,emissiveIntensity:0,roughness:.25});

  // Procedural Taiwan PBR multi-lane asphalt + highway markings + night streetlamp & traffic glow
  const twRoadDay=texture(c=>{
    c.fillStyle='#8d9092';c.fillRect(0,0,256,256);
    c.fillStyle='#31363b';c.fillRect(10,0,236,256);
    for(let i=0;i<2400;i++){
      c.fillStyle=i%2?'#292d31':'#3a3f45';
      c.fillRect(10+((i*73)%236),(i*139)%256,2,2);
    }
    for(const lx of [52,96,160,204]){
      const wg=c.createLinearGradient(lx-14,0,lx+14,0);
      wg.addColorStop(0,'rgba(20,22,25,0)');wg.addColorStop(.5,'rgba(18,20,23,0.42)');wg.addColorStop(1,'rgba(20,22,25,0)');
      c.fillStyle=wg;c.fillRect(lx-14,0,28,256);
    }
    c.fillStyle='#eae8d9';c.fillRect(16,0,3,256);c.fillRect(237,0,3,256);
    c.fillStyle='#ebba3b';c.fillRect(124,0,3,256);c.fillRect(129,0,3,256);
    c.fillStyle='#f0f0e8';
    for(let y=8;y<256;y+=64){c.fillRect(72,y,3,34);c.fillRect(181,y,3,34);}
  },true);
  const twRoadNight=texture(c=>{
    c.fillStyle='#000';c.fillRect(0,0,256,256);
    for(const sy of [64,192]){
      for(const sx of [26,230]){
        const g=c.createRadialGradient(sx,sy,2,sx,sy,78);
        g.addColorStop(0,'rgba(255,220,165,0.92)');
        g.addColorStop(0.32,'rgba(255,175,90,0.48)');
        g.addColorStop(0.75,'rgba(215,120,48,0.14)');
        g.addColorStop(1,'rgba(0,0,0,0)');
        c.fillStyle=g;c.fillRect(0,sy-80,256,160);
      }
    }
    c.fillStyle='rgba(255,204,88,0.38)';c.fillRect(124,0,8,256);
    for(let y=16;y<256;y+=64){
      c.fillStyle='rgba(255,244,210,0.88)';c.fillRect(46,y,3,5);c.fillRect(58,y,3,5);
      c.fillStyle='rgba(255,58,42,0.88)';c.fillRect(194,y+24,3,5);c.fillRect(206,y+24,3,5);
    }
  },true);
  twRoadDay.wrapS=twRoadNight.wrapS=THREE.ClampToEdgeWrapping??THREE.RepeatWrapping;
  const roadMat=new THREE.MeshStandardMaterial({color:0xffffff,map:twRoadDay,roughness:.84,emissive:0xffd596,emissiveMap:twRoadNight,emissiveIntensity:0,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3});
  const roadCurbMat=new THREE.MeshStandardMaterial({color:0xb8bec2,roughness:.85,vertexColors:true});

  // Rich real-world Taiwan architectural color palettes (40+ vivid authentic colors)
  const PAL_APT=['#f0e6d2','#e6d5b8','#c97859','#dfb08c','#b5cbb8','#b8cad8','#d6b685','#c47668','#ebd9a7','#e6e8ea','#d49280','#d4c2a8'].map(h=>new THREE.Color(h));
  const PAL_GLASS=['#467da8','#3b7c74','#96b8d0','#aa9375','#395a78','#4a8f8e','#5a6c7d','#78adc9'].map(h=>new THREE.Color(h));
  const PAL_BRICK=['#bc5440','#ce7050','#cc8e52','#dfd2bc','#d48974','#d1a65a','#9f5c4f','#ebe4d8'].map(h=>new THREE.Color(h));
  const PAL_CONDO=['#eef0f3','#b8aea2','#69717a','#dcd0bc','#7a8fa4','#cbbba4','#e4dfd5'].map(h=>new THREE.Color(h));
  const PAL_TECH=['#e0e6ec','#c8d4de','#d5dce0','#b9cad6','#e6e2da','#9eb5c4'].map(h=>new THREE.Color(h));
  const PAL_ROOF_FLAT=['#4c8460','#58926a','#9ea3a8','#8b9299','#525b64','#b8905a','#447858','#a8a296'].map(h=>new THREE.Color(h));
  const PAL_ROOF_PITCHED=['#b5503c','#3b7a6e','#486e90','#9e4a3d','#4c8460','#525b64','#b8905a','#c66246'].map(h=>new THREE.Color(h));
  const PAL_ROOF_MINNAN=['#b5503c','#c45a40','#9e4a3d','#b8905a','#525b64','#3b7a6e'].map(h=>new THREE.Color(h));

  // Deterministic coordinate/index hash & subtle per-building RGB/HSL jitter (zero-alloc)
  function hashBuilding(x,z,salt){
    let h=(Math.imul(Math.round(x*2),374761393)^Math.imul(Math.round(z*2),668265263)^Math.imul((salt|0)+17,2246822519))>>>0;
    h=Math.imul(h^(h>>>13),1274126177)>>>0;
    return (h^(h>>>16))>>>0;
  }
  const tmpWallCol=new THREE.Color(),tmpRoofCol=new THREE.Color(),tmpCrownCol=new THREE.Color();
  function pickJitteredColor(pal,h,out,brightScale=1){
    const base=pal[h%pal.length];
    // Deterministic subtle per-building lightness & warm/cool channel jitter so neighbors never match flatly
    const jL=(((h>>>8)&255)/255-0.5)*0.11;
    const jW=(((h>>>16)&255)/255-0.5)*0.055;
    const jG=(((h>>>24)&255)/255-0.5)*0.032;
    const clamp01=v=>v<0.06?0.06:(v>1?1:v);
    out.r=clamp01((base.r+jL+jW)*brightScale);
    out.g=clamp01((base.g+jL+jG)*brightScale);
    out.b=clamp01((base.b+jL-jW)*brightScale);
    return out;
  }
  // Regional character weights across Taiwan (Kinmen, Penghu, Tainan, Hualien/Taitung, Hsinchu, Taichung, Kaohsiung, Taoyuan)
  function getTaiwanRegion(lat,lon){
    if(lon<118.65)return 1; // Kinmen: strong Minnan red-brick & terracotta pitched roofs
    if(lon<119.85&&lat>=23.15&&lat<=23.85)return 2; // Penghu: coral-lime stone, stucco & coastal terracotta/blue roofs
    if(lat>=22.82&&lat<=23.40&&lon>=120.00&&lon<=120.48)return 3; // Tainan: historic Minnan townhouses + southern sun
    if(lon>121.05&&lat<24.38)return 4; // Hualien & Taitung: east-coast low-rise brick/stucco & vibrant pitched roofs
    if(lat>=24.70&&lat<=24.88&&lon>=120.90&&lon<=121.10)return 5; // Hsinchu / Zhubei: Sci-Park & modern condos/glass
    if(lat>=24.06&&lat<=24.26&&lon>=120.54&&lon<=120.78)return 6; // Taichung: modern granite condos & glass CBD + warm apts
    if(lat>=22.52&&lat<=22.76&&lon>=120.22&&lon<=120.44)return 7; // Kaohsiung: harbor glass skyline + vivid warm apts
    return 0; // Taoyuan & general western/northern Taiwan
  }

  // Build iconic Taiwan Landmarks outside Taipei at true Google Maps/OSM coordinates & 1:1 heights
  const landmarks=new THREE.Group();landmarks.name='Taiwan regional landmarks';root.add(landmarks);
  const landmarkSites=[
    {name:'高雄85大樓',lat:22.61106,lon:120.30350,radius:72,type:'k85'},
    {name:'高雄遠雄THE ONE',lat:22.60855,lon:120.30345,radius:55,type:'theone'},
    {name:'高雄長谷世貿50層大樓',lat:22.64302,lon:120.31483,radius:45,type:'changgu'},
    {name:'高雄流行音樂中心海音館',lat:22.61770,lon:120.28770,radius:110,type:'kmc'},
    {name:'高雄漢來大飯店',lat:22.61960,lon:120.29660,radius:58,type:'hilai'},
    {name:'高雄展覽館',lat:22.60950,lon:120.29830,radius:125,type:'kec'},
    {name:'左營蓮池潭龍虎塔',lat:22.68150,lon:120.29290,radius:65,type:'dragontiger'},
    {name:'臺中商業銀行總部(台中之鑽)',lat:24.16040,lon:120.64220,radius:52,type:'taichungdiamond'},
    {name:'台中聯聚中雍大廈',lat:24.16230,lon:120.64580,radius:48,type:'lanchu'},
    {name:'台中大安國王大樓',lat:24.15060,lon:120.66440,radius:48,type:'daanking'},
    {name:'臺中國家歌劇院',lat:24.16280,lon:120.64040,radius:95,type:'ntt'},
    {name:'台南香格里拉遠東飯店',lat:22.99670,lon:120.21430,radius:52,type:'shangrila'},
    {name:'台南奇美博物館',lat:22.93460,lon:120.22610,radius:120,type:'chimei'},
    {name:'嘉義故宮南院',lat:23.47240,lon:120.29230,radius:130,type:'npm_south'},
    {name:'竹北高鐵豐邑雲智匯大樓',lat:24.81950,lon:121.02800,radius:55,type:'hsinchu_tower'},
    {name:'桃園藝文特區中悅世界與總圖生命樹',lat:25.01680,lon:121.30050,radius:75,type:'taoyuan_hub'},
    {name:'宜蘭蘭陽博物館',lat:24.86860,lon:121.83230,radius:65,type:'lanyang'},
    {name:'金門莒光樓',lat:24.42490,lon:118.31830,radius:45,type:'juguang'},
    {name:'澎湖西瀛虹橋',lat:23.56880,lon:119.56080,radius:95,type:'rainbowbridge'},
    // International Landmarks & Taiwan-Grade 3D City Clusters
    {name:'東京晴空塔 Tokyo Skytree',lat:35.71006,lon:139.81070,radius:95,type:'tokyo_skytree'},
    {name:'東京鐵塔 Tokyo Tower',lat:35.65858,lon:139.74543,radius:85,type:'tokyo_tower'},
    {name:'東京灣彩虹大橋 Rainbow Bridge',lat:35.63660,lon:139.76330,radius:220,type:'suspension_bridge'},
    {name:'東京丸之內與羽田灣岸摩天樓群',lat:35.61800,lon:139.75800,radius:180,type:'intl_city_cluster',seed:101,count:96,span:2600,maxH:245},
    {name:'東京羽田空港城區與京濱工業帶',lat:35.55800,lon:139.74200,radius:150,type:'intl_city_cluster',seed:102,count:84,span:2200,maxH:140},
    {name:'成田山新勝寺大塔與表參道城區',lat:35.78580,lon:140.31830,radius:140,type:'intl_city_cluster',seed:103,count:76,span:2100,maxH:125,pagoda:true},
    {name:'香港國際金融中心 IFC & 中銀大廈',lat:22.28520,lon:114.15810,radius:180,type:'hk_central'},
    {name:'香港環球貿易廣場 ICC & 九龍站天際線',lat:22.30340,lon:114.16020,radius:180,type:'hk_icc'},
    {name:'香港青馬大橋 Tsing Ma Bridge',lat:22.35140,lon:114.07360,radius:240,type:'suspension_bridge'},
    {name:'香港東涌與赤鱲角灣岸城區',lat:22.28900,lon:113.94100,radius:160,type:'intl_city_cluster',seed:201,count:82,span:2100,maxH:185},
    {name:'沖繩那霸首里城與國際通都會群',lat:26.21450,lon:127.68400,radius:160,type:'okinawa_naha'},
    {name:'首爾樂天世界塔 Lotte World Tower',lat:37.51250,lon:127.10250,radius:120,type:'seoul_lotte'},
    {name:'N首爾塔與南山天際線',lat:37.55120,lon:126.98820,radius:140,type:'seoul_ntower'},
    {name:'仁川跨海大橋 Incheon Bridge',lat:37.41380,lon:126.56550,radius:260,type:'suspension_bridge'},
    {name:'仁川松島國際都市摩天樓群',lat:37.44200,lon:126.48600,radius:170,type:'intl_city_cluster',seed:301,count:88,span:2400,maxH:230},
    {name:'新加坡濱海灣金沙酒店 Marina Bay Sands',lat:1.28340,lon:103.86070,radius:180,type:'sg_mbs'},
    {name:'新加坡樟宜星耀與金融區摩天樓群',lat:1.34500,lon:103.96200,radius:165,type:'intl_city_cluster',seed:401,count:86,span:2300,maxH:210},
    {name:'馬尼拉灣摩天輪與 BGC 金融摩天樓群',lat:14.53500,lon:121.00200,radius:175,type:'manila_skyline'},
    {name:'大阪城天守閣與商業園區 OBP',lat:34.68730,lon:135.52620,radius:165,type:'osaka_castle'},
    {name:'大阪梅田藍天大廈與中之島摩天樓群',lat:34.70550,lon:135.48960,radius:180,type:'osaka_umeda'},
    {name:'關西國際機場聯絡橋 Sky Gate Bridge',lat:34.42300,lon:135.27800,radius:240,type:'suspension_bridge'},
    {name:'泉佐野臨空城塔與關西灣岸都會區',lat:34.41100,lon:135.30100,radius:165,type:'intl_city_cluster',seed:601,count:86,span:2300,maxH:256},
    {name:'曼谷大皇宮金塔與鄭王廟河岸群',lat:13.75000,lon:100.49130,radius:175,type:'bangkok_palace'},
    {name:'曼谷王權 MahaNakhon 像素大廈與是隆金融區',lat:13.72360,lon:100.52830,radius:185,type:'bangkok_mahanakhon'},
    {name:'曼谷蘇凡納布空港新城都會群',lat:13.71500,lon:100.71800,radius:160,type:'intl_city_cluster',seed:701,count:84,span:2300,maxH:165},
    {name:'東京灣國際貨櫃港與跨海航道船隊',lat:35.60200,lon:139.77800,radius:180,type:'harbor_fleet',seed:501},
    {name:'香港維多利亞港郵輪與貨櫃船隊',lat:22.29350,lon:114.16650,radius:180,type:'harbor_fleet',seed:502},
    {name:'新加坡海峽錨地超級貨輪船隊',lat:1.26800,lon:103.87800,radius:180,type:'harbor_fleet',seed:503},
    {name:'馬尼拉灣海港船隊',lat:14.55200,lon:120.97200,radius:180,type:'harbor_fleet',seed:504},
    {name:'大阪灣神戶港國際貨櫃船隊',lat:34.56500,lon:135.34500,radius:180,type:'harbor_fleet',seed:505},
    {name:'暹羅灣曼谷海港貨輪船隊',lat:13.45500,lon:100.62500,radius:180,type:'harbor_fleet',seed:506},
    {name:'Formosa Aero Secret Sanctum',lat:25.05850,lon:121.58200,radius:40,type:'secret_monolith'}
  ];

  const landmarkGroups=[];
  function addMesh(parent,geo,mat,x,y,z){const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);parent.add(m);return m;}
  function box(parent,mat,w,h,d,x,y,z){return addMesh(parent,new THREE.BoxGeometry(w,h,d),mat,x,y,z);}
  function cyl(parent,mat,rt,rb,h,seg,x,y,z){return addMesh(parent,new THREE.CylinderGeometry(rt,rb,h,seg),mat,x,y,z);}

  function isInAirportSafetyZone(wx,wz){
    if(!Array.isArray(airports)) return false;
    for(const ap of airports){
      const dx=wx-ap.x,dz=wz-ap.z;
      const reach=(ap.length||3000)/2+1100;
      if(Math.abs(dx)>reach||Math.abs(dz)>reach) continue;
      const s=Math.sin(ap.heading||0),c=Math.cos(ap.heading||0);
      const along=dx*s-dz*c,cross=dx*c+dz*s;
      if(Math.abs(along)<(ap.length||3000)/2+920&&Math.abs(cross)<Math.abs(ap.apron||180)+390) return true;
    }
    return false;
  }

  function placeGroundedBuilding(g,baseY,siteX,siteZ,bx,bz,bw,bh,bd,matPick,withCrown=false,groupId='intl:city'){
    const wx=siteX+bx,wz=siteZ+bz;
    if(isInAirportSafetyZone(wx,wz)) return false;
    const gy=ground(wx,wz);
    if(!Number.isFinite(gy)||gy<1.35) return false; // Never place land buildings in the sea
    const ly=gy-baseY;
    const plinth=6;
    box(g,matPick,bw,bh+plinth,bd,bx,ly+(bh-plinth)/2,bz);
    if(withCrown||bh>115){
      box(g,whiteFrame,bw+1.6,3.2,bd+1.6,bx,ly+bh+1.6,bz);
      box(g,beaconMat,1.9,1.9,1.9,bx,ly+bh+4.2,bz);
    }
    if(typeof BuildingCollision!=='undefined'&&bh>26){
      BuildingCollision.add(groupId,wx-bw*.45,wz-bd*.45,wx+bw*.45,wz+bd*.45,gy+bh,gy-plinth);
    }
    return true;
  }

  function addObstacleBox(wx,wz,w,h,d,groupId='tw:landmarks'){
    if(typeof BuildingCollision==='undefined'||isInAirportSafetyZone(wx,wz)) return;
    const gy=Math.max(1.2,ground(wx,wz));
    BuildingCollision.add(groupId,wx-w*.5,wz-d*.5,wx+w*.5,wz+d*.5,gy+h,gy-2);
  }

  const hasWorldOsmCities=typeof createWorldCity==='function';
  for(const site of landmarkSites){
    const p=geoPoint(site.lat,site.lon);site.x=p.x;site.z=p.z;
    const baseY=site.type==='harbor_fleet'||site.type==='suspension_bridge'?0:Math.max(1.2,ground(p.x,p.z));
    const g=new THREE.Group();g.name=site.name;g.position.set(p.x,baseY,p.z);
    landmarks.add(g);landmarkGroups.push(g);
    if(site.type==='k85'){
      box(g,stone,98,34,64,0,17,0);
      for(const s of [-1,1]){
        box(g,officeGlass,32,122,54,s*27,95,0);
        for(const cz of [-26,26])box(g,stone,3.5,122,3.5,s*27,95,cz);
        box(g,beaconMat,1.8,1.8,1.8,s*27,157,0);
      }
      box(g,stone,86,14,56,0,163,0);
      box(g,officeGlass,48,142,48,0,234,0);
      box(g,darkGlass,52,126,44,0,234,0);
      box(g,stone,40,16,40,0,313,0);
      box(g,officeGlass,32,14,32,0,328,0);
      cyl(g,stone,6,28,16,4,0,343,0).rotation.y=Math.PI/4;
      cyl(g,metal,.9,2.8,34,8,0,366,0);
      box(g,beaconMat,2.5,2.5,2.5,0,384,0);
    }else if(site.type==='theone'){
      box(g,stone,58,24,48,0,12,0);
      box(g,officeGlass,44,175,38,0,111,0);
      for(const s of [-22.5,22.5])for(const sz of [-19.5,19.5])box(g,whiteFrame,2.4,230,2.4,s,115,sz);
      box(g,darkGlass,38,52,32,0,224,0);
      box(g,whiteFrame,40,8,34,0,254,0);
      cyl(g,metal,1,3,14,8,0,264,0);
      box(g,beaconMat,2,2,2,0,271,0);
    }else if(site.type==='changgu'){
      cyl(g,graniteRed,24,26,42,8,0,21,0);
      cyl(g,officeGlass,20,24,140,8,0,112,0);
      cyl(g,graniteRed,14,20,32,8,0,198,0);
      cyl(g,officeGlass,6,14,14,8,0,221,0);
      cyl(g,metal,.6,1.8,16,8,0,236,0);
      box(g,beaconMat,1.8,1.8,1.8,0,245,0);
    }else if(site.type==='kmc'){
      for(const [ox,oz,h,r] of [[-48,8,58,15],[-24,-10,36,18],[46,-6,42,14]]){
        cyl(g,whiteFrame,r,r*1.12,h,6,ox,h/2,oz);
        cyl(g,officeGlass,r*.88,r*.98,h-4,6,ox,h/2,oz);
      }
      const hall=cyl(g,whiteFrame,44,58,24,6,8,12,18);hall.scale.set(1.3,1,.9);
      const cap=cyl(g,officeGlass,30,42,8,6,8,26,18);cap.scale.set(1.25,1,.85);
      box(g,beaconMat,1.6,1.6,1.6,-48,60,8);
    }else if(site.type==='hilai'){
      box(g,stone,72,38,52,0,19,0);
      box(g,graniteRed,52,110,38,0,93,0);
      box(g,officeGlass,44,110,42,0,93,0);
      box(g,stone,36,28,28,0,162,0);
      cyl(g,gold,4,14,14,8,0,183,0);
      box(g,beaconMat,1.8,1.8,1.8,0,191,0);
    }else if(site.type==='kec'){
      for(let i=-3;i<=3;i++){
        const h=14+6*Math.cos(i*.55);
        const seg=box(g,metal,24,h,92,i*24,h/2,0);
        seg.rotation.z=Math.sin(i*.6)*.12;
      }
      box(g,officeGlass,156,11,76,0,6,0);
    }else if(site.type==='dragontiger'){
      for(const s of [-1,1]){
        const px=s*18;
        cyl(g,stone,9,10,4,12,px,2,0);
        for(let t=0;t<7;t++){
          const y=4+t*4.5,r=7.2-t*.48;
          cyl(g,pagodaRed,r*.85,r*.9,3.2,8,px,y+1.6,0);
          cyl(g,pagodaGreen,r*.45,r*1.12,1.6,8,px,y+3.8,0);
        }
        cyl(g,gold,.2,1.2,5,8,px,38,0);
      }
      box(g,pagodaRed,36,2.2,4,0,3,6);
    }else if(site.type==='taichungdiamond'){
      box(g,stone,62,22,48,0,11,0);
      for(const s of [-14,14]){
        box(g,officeGlass,22,188,36,s,116,0);
        box(g,metal,24,4,38,s,132,0);
        box(g,metal,24,4,38,s,186,0);
      }
      box(g,darkGlass,26,22,30,0,164,0);
      box(g,officeGlass,44,18,32,0,214,0);
      box(g,beaconMat,2,2,2,0,226,0);
    }else if(site.type==='lanchu'){
      box(g,stone,54,24,44,0,12,0);
      box(g,officeGlass,42,148,36,0,98,0);
      for(const sx of [-20,20])for(const sz of [-17,17])box(g,stone,4,162,4,sx,94,sz);
      box(g,stone,36,16,30,0,180,0);
      box(g,beaconMat,1.8,1.8,1.8,0,192,0);
    }else if(site.type==='daanking'){
      box(g,stone,52,20,46,0,10,0);
      box(g,officeGlass,38,128,34,0,84,0);
      for(const s of [-18,18])box(g,whiteFrame,6,144,24,s,92,0);
      cyl(g,metal,1,12,24,4,0,164,0).rotation.y=Math.PI/4;
      box(g,beaconMat,1.8,1.8,1.8,0,178,0);
    }else if(site.type==='ntt'){
      box(g,whiteFrame,108,26,64,0,13,0);
      for(const sx of [-32,0,32]){
        const arch=cyl(g,whiteFrame,18,22,28,16,sx,14,0);
        arch.scale.set(1,1,1.3);
        box(g,officeGlass,16,20,66,sx,12,0);
      }
      box(g,pagodaGreen,96,1.6,52,0,26.8,0);
    }else if(site.type==='shangrila'){
      box(g,stone,66,22,58,0,11,0);
      cyl(g,stone,23,25,36,24,0,40,0);
      cyl(g,officeGlass,19,22,74,24,0,95,0);
      cyl(g,metal,14,18,16,24,0,140,0);
      box(g,beaconMat,1.8,1.8,1.8,0,152,0);
    }else if(site.type==='chimei'){
      box(g,whiteFrame,150,22,68,0,11,0);
      box(g,whiteFrame,54,28,74,0,14,0);
      box(g,officeGlass,42,16,76,0,12,0);
      for(let i=-3;i<=3;i++)cyl(g,whiteFrame,1.6,1.8,22,12,i*7,11,36);
      cyl(g,gold,18,20,16,24,0,34,0);
      addMesh(g,new THREE.SphereGeometry(18,24,14,0,Math.PI*2,0,Math.PI/2),gold,0,42,0);
      cyl(g,gold,.5,1.5,12,8,0,64,0);
    }else if(site.type==='npm_south'){
      const leftW=box(g,darkGlass,86,20,44,-34,12,-8);leftW.rotation.y=.22;
      const rightW=box(g,metal,86,24,44,34,14,10);rightW.rotation.y=-.18;
      const bridge=box(g,whiteFrame,92,4,8,0,6,34);bridge.rotation.y=-.35;
    }else if(site.type==='hsinchu_tower'){
      box(g,stone,56,16,44,0,8,0);
      cyl(g,officeGlass,21,24,116,18,0,74,0).scale.set(1.25,1,.85);
      cyl(g,metal,19,21,8,18,0,136,0).scale.set(1.25,1,.85);
      box(g,beaconMat,1.6,1.6,1.6,0,143,0);
    }else if(site.type==='taoyuan_hub'){
      for(const s of [-28,28]){
        box(g,stone,30,134,30,s,67,0);
        box(g,officeGlass,26,126,32,s,67,0);
        cyl(g,gold,3,13,18,8,s,143,0);
        box(g,beaconMat,1.6,1.6,1.6,s,154,0);
      }
      cyl(g,officeGlass,26,16,32,16,0,16,24);
      cyl(g,metal,30,28,3,16,0,33,24);
    }else if(site.type==='lanyang'){
      const wedge=box(g,darkBasalt,72,32,34,0,10,0);
      wedge.rotation.z=-.35;
      const stripeG=box(g,officeGlass,68,6,35,0,13,0);
      stripeG.rotation.z=-.35;
    }else if(site.type==='juguang'){
      box(g,stone,36,5,36,0,2.5,0);
      box(g,pagodaRed,22,12,18,0,11,0);
      cyl(g,pagodaGreen,6,18,8,4,0,21,0).rotation.y=Math.PI/4;
      box(g,pagodaRed,12,8,12,0,27,0);
      cyl(g,pagodaGreen,2,12,7,4,0,34,0).rotation.y=Math.PI/4;
    }else if(site.type==='rainbowbridge'){
      for(let i=-8;i<=8;i++){
        const t=i/8,y=18*(1-t*t),a=Math.atan2(-36*t/8,18);
        const seg=box(g,pagodaRed,16,1.8,2.6,i*12,y+3,0);
        seg.rotation.z=a*.42;
      }
      box(g,stone,196,2.2,6,0,2,0);
    }else if(site.type==='tokyo_skytree'){
      box(g,stone,88,28,88,0,14,0);
      cyl(g,whiteFrame,18,34,350,6,0,175,0);
      cyl(g,officeGlass,24,22,22,18,0,350,0);
      cyl(g,whiteFrame,10,16,100,12,0,400,0);
      cyl(g,officeGlass,16,15,16,18,0,450,0);
      cyl(g,metal,2.2,9,184,12,0,542,0);
      box(g,beaconMat,3,3,3,0,635,0);
    }else if(site.type==='tokyo_tower'){
      for(const sx of [-28,28])for(const sz of [-28,28]){
        const leg=box(g,pagodaRed,7,125,7,sx*.6,62,sz*.6);
        leg.rotation.z=sx>0?.18:-.18;leg.rotation.x=sz>0?-.18:.18;
      }
      box(g,whiteFrame,42,16,42,0,122,0);
      cyl(g,pagodaRed,5,14,130,4,0,192,0).rotation.y=Math.PI/4;
      box(g,whiteFrame,22,12,22,0,252,0);
      cyl(g,pagodaRed,1.4,4.8,76,8,0,295,0);
      box(g,beaconMat,2.5,2.5,2.5,0,334,0);
    }else if(site.type==='suspension_bridge'){
      for(const sx of [-190,190]){
        box(g,whiteFrame,14,148,26,sx,74,0);
        box(g,whiteFrame,16,6,28,sx,115,0);
        box(g,beaconMat,2.2,2.2,2.2,sx,150,0);
      }
      box(g,roadMat,680,4.5,24,0,46,0);
      for(let i=-12;i<=12;i++){
        const t=(Math.abs(i)%6)/6,cy=48+88*t*t;
        box(g,whiteFrame,2.2,cy-46,2.2,i*26,46+(cy-46)/2,11);
        box(g,whiteFrame,2.2,cy-46,2.2,i*26,46+(cy-46)/2,-11);
      }
    }else if(site.type==='hk_central'){
      // IFC 2 (415m) + Bank of China prism (367m) + Central Harbourfront towers
      box(g,stone,74,30,74,0,11,0);
      box(g,officeGlass,52,375,52,0,200,0);
      for(const s of [-25,25])box(g,whiteFrame,4.5,398,14,s,206,0);
      cyl(g,metal,12,26,24,8,0,400,0);
      box(g,beaconMat,2.8,2.8,2.8,0,415,0);
      // Bank of China Tower nearby
      placeGroundedBuilding(g,baseY,site.x,site.z,125,45,44,295,44,darkGlass,true,'intl:hk_central');
      if(!hasWorldOsmCities)for(let i=0;i<36;i++){
        const a=i*2.39996,r=140+((i*53)%780);
        const bx=Math.cos(a)*r,bz=Math.sin(a)*r;
        const bh=65+((i*41)%195),bw=24+((i*17)%22);
        placeGroundedBuilding(g,baseY,site.x,site.z,bx,bz,bw,bh,bw,i%2?officeGlass:darkGlass,bh>140,'intl:hk_central');
      }
    }else if(site.type==='hk_icc'){
      box(g,stone,82,36,82,0,14,0);
      box(g,officeGlass,58,438,58,0,235,0);
      box(g,whiteFrame,60,18,60,0,462,0);
      box(g,beaconMat,3,3,3,0,484,0);
      if(!hasWorldOsmCities)for(let i=0;i<32;i++){
        const a=i*2.39996,r=135+((i*61)%680);
        const bx=Math.cos(a)*r,bz=Math.sin(a)*r,bh=58+((i*37)%165);
        placeGroundedBuilding(g,baseY,site.x,site.z,bx,bz,26,bh,24,i%3?officeGlass:wall,bh>140,'intl:hk_icc');
      }
    }else if(site.type==='okinawa_naha'){
      // Shuri Castle vermilion hall + Naha Kokusai-dori city blocks
      box(g,stone,74,16,56,0,4,0);
      box(g,pagodaRed,48,18,32,0,21,0);
      cyl(g,pagodaRed,16,32,10,4,0,35,0).rotation.y=Math.PI/4;
      cyl(g,gold,1.2,2.5,6,6,0,42,0);
      if(!hasWorldOsmCities){
        for(let i=0;i<54;i++){
          const a=i*2.39996,r=120+((i*73)%1350);
          const bx=Math.cos(a)*r,bz=Math.sin(a)*r,bh=24+((i*29)%88),bw=22+((i*13)%18);
          placeGroundedBuilding(g,baseY,site.x,site.z,bx,bz,bw,bh,bw,i%3===0?officeGlass:wall,false,'intl:okinawa');
        }
        box(g,roadMat,1400,1.4,18,0,0.8,90);
      }
    }else if(site.type==='seoul_lotte'){
      box(g,stone,78,24,78,0,6,0);
      cyl(g,officeGlass,11,36,515,16,0,258,0);
      cyl(g,whiteFrame,10,13,40,12,0,535,0);
      box(g,beaconMat,3,3,3,0,556,0);
      if(!hasWorldOsmCities)for(let i=0;i<38;i++){
        const a=i*2.39996,r=140+((i*67)%860);
        const bx=Math.cos(a)*r,bz=Math.sin(a)*r,bh=55+((i*43)%155);
        placeGroundedBuilding(g,baseY,site.x,site.z,bx,bz,26,bh,26,i%2?officeGlass:darkGlass,bh>130,'intl:seoul_lotte');
      }
    }else if(site.type==='seoul_ntower'){
      box(g,stone,44,24,44,0,6,0);
      cyl(g,whiteFrame,7.5,9.5,145,16,0,82,0);
      cyl(g,officeGlass,18,16,18,20,0,162,0);
      cyl(g,metal,1.2,3.2,68,10,0,204,0);
      box(g,beaconMat,2.4,2.4,2.4,0,239,0);
    }else if(site.type==='sg_mbs'){
      // Marina Bay Sands 3 iconic towers + SkyPark ship deck + Supertrees + CBD
      box(g,stone,200,12,72,0,0,0);
      for(const sx of [-68,0,68]){
        box(g,officeGlass,28,194,46,sx,97,0);
        box(g,whiteFrame,30,194,4,sx,97,22);
      }
      box(g,whiteFrame,210,9,54,18,198,0);
      cyl(g,officeGlass,24,14,16,16,95,8,65);
      // Supertrees
      for(const [tx,tz,th] of [[-85,-95,48],[-35,-115,52],[25,-105,45]]){
        cyl(g,pagodaRed,2.5,5.5,th,10,tx,th/2,tz);
        cyl(g,gold,16,4,5,12,tx,th,tz);
      }
      if(!hasWorldOsmCities)for(let i=0;i<44;i++){
        const a=i*2.39996,r=160+((i*71)%980);
        const bx=Math.cos(a)*r,bz=Math.sin(a)*r,bh=75+((i*47)%185);
        placeGroundedBuilding(g,baseY,site.x,site.z,bx,bz,28,bh,26,i%2?officeGlass:darkGlass,bh>145,'intl:sg_mbs');
      }
    }else if(site.type==='manila_skyline'){
      // MOA Eye Ferris Wheel + Makati/BGC high-rises
      cyl(g,whiteFrame,55,55,4,24,-120,62,80).rotation.x=Math.PI/2;
      box(g,metal,6,70,12,-120,30,80);
      if(!hasWorldOsmCities)for(let i=0;i<68;i++){
        const a=i*2.39996,r=85+((i*79)%1450);
        const bx=Math.cos(a)*r,bz=Math.sin(a)*r,bh=42+((i*53)%195),bw=24+((i*19)%22);
        const matPick=i%3===0?darkGlass:i%2?officeGlass:wall;
        placeGroundedBuilding(g,baseY,site.x,site.z,bx,bz,bw,bh,bw,matPick,bh>150,'intl:manila');
      }
    }else if(site.type==='osaka_castle'){
      // Osaka Castle Tenshukaku: stone fortress wall + 5-tier white/gold castle keep + surrounding park towers
      box(g,stone,140,18,140,0,7,0);
      box(g,darkBasalt,110,12,110,0,22,0);
      for(let t=0;t<5;t++){
        const w=68-t*10,y=28+t*11;
        box(g,whiteFrame,w,10,w,0,y+5,0);
        box(g,pagodaGreen,w+10,2.6,w+10,0,y+10.5,0);
        box(g,gold,w*0.35,1.8,w+11,0,y+8,0);
      }
      cyl(g,gold,1.2,3.5,10,8,0,88,0);
      addObstacleBox(site.x,site.z,130,92,130,'landmark:osaka_castle');
      if(!hasWorldOsmCities)for(let i=0;i<36;i++){
        const a=i*2.39996,r=220+((i*67)%920);
        const bx=Math.cos(a)*r,bz=Math.sin(a)*r,bh=48+((i*41)%155);
        placeGroundedBuilding(g,baseY,site.x,site.z,bx,bz,26,bh,24,i%2?officeGlass:darkGlass,bh>130,'intl:osaka_castle');
      }
    }else if(site.type==='osaka_umeda'){
      // Umeda Sky Building (Twin Towers + Floating Garden Observatory Ring) + Abeno Harukas supertall
      box(g,officeGlass,28,175,28,-28,85,0);
      box(g,officeGlass,28,175,28,28,85,0);
      box(g,whiteFrame,88,12,56,0,164,0);
      cyl(g,gold,18,18,14,20,0,164,0);
      addObstacleBox(site.x,site.z,92,178,60,'landmark:osaka_umeda');
      // Abeno Harukas 300m stepped glass tower nearby
      box(g,darkGlass,54,140,48,180,68,-140);
      box(g,officeGlass,44,240,40,180,118,-140);
      box(g,officeGlass,34,300,32,180,148,-140);
      addObstacleBox(site.x+180,site.z-140,56,304,50,'landmark:abeno_harukas');
      if(!hasWorldOsmCities)for(let i=0;i<54;i++){
        const a=i*2.39996,r=150+((i*73)%1180);
        const bx=Math.cos(a)*r,bz=Math.sin(a)*r,bh=55+((i*47)%185);
        placeGroundedBuilding(g,baseY,site.x,site.z,bx,bz,26,bh,26,i%3===0?darkGlass:officeGlass,bh>145,'intl:osaka_umeda');
      }
    }else if(site.type==='bangkok_palace'){
      // Wat Arun (Temple of Dawn) & Grand Palace Golden Chedis along Chao Phraya River
      box(g,stone,130,10,130,0,3,0);
      // Central Khmer-style Prang spire (82m) + 4 corner satellite prangs
      for(let t=0;t<6;t++){
        const r=32-t*4.5,y=8+t*11.5;
        cyl(g,whiteFrame,r*0.72,r,12,12,0,y+6,0);
        cyl(g,gold,r*0.8,r*0.85,2.4,12,0,y+11,0);
      }
      cyl(g,gold,0.8,3.2,18,10,0,86,0);
      for(const [cx,cz] of [[-48,-48],[48,-48],[-48,48],[48,48]]){
        cyl(g,whiteFrame,6,14,38,10,cx,22,cz);
        cyl(g,gold,1,4,12,8,cx,46,cz);
      }
      // Golden Grand Palace Spire nearby
      cyl(g,gold,2,22,68,16,135,36,-75);
      box(g,pagodaRed,58,18,36,135,14,10);
      box(g,gold,64,6,42,135,25,10);
      addObstacleBox(site.x,site.z,140,95,140,'landmark:bangkok_palace');
      if(!hasWorldOsmCities)for(let i=0;i<42;i++){
        const a=i*2.39996,r=210+((i*69)%1050);
        const bx=Math.cos(a)*r,bz=Math.sin(a)*r,bh=38+((i*43)%140);
        placeGroundedBuilding(g,baseY,site.x,site.z,bx,bz,24,bh,24,i%2?wall:officeGlass,bh>120,'intl:bangkok_palace');
      }
    }else if(site.type==='bangkok_mahanakhon'){
      // King Power Mahanakhon (314m Pixelated Ribbon Glass Skyscraper) + Silom/Sathorn CBD
      box(g,darkGlass,46,110,46,0,53,0);
      box(g,officeGlass,38,95,38,5,152,-4);
      box(g,darkGlass,44,110,44,0,252,0);
      box(g,whiteFrame,48,10,48,0,310,0);
      addObstacleBox(site.x,site.z,52,316,52,'landmark:bangkok_mahanakhon');
      if(!hasWorldOsmCities)for(let i=0;i<58;i++){
        const a=i*2.39996,r=115+((i*73)%1280);
        const bx=Math.cos(a)*r,bz=Math.sin(a)*r,bh=52+((i*53)%195);
        placeGroundedBuilding(g,baseY,site.x,site.z,bx,bz,26,bh,26,i%2?officeGlass:darkGlass,bh>150,'intl:bangkok_cbd');
      }
    }else if(site.type==='intl_city_cluster'){
      const cnt=site.count||80,span=site.span||2200,maxH=site.maxH||180,sd=site.seed||101;
      if(!hasWorldOsmCities&&baseY>=1.0&&!isInAirportSafetyZone(site.x,site.z)){
        const roadLen=Math.min(1800,span*0.62);
        box(g,roadMat,roadLen,0.6,22,0,0.4,0);
        box(g,roadMat,22,0.6,roadLen,0,0.4,0);
        box(g,gold,roadLen*0.92,0.7,1.4,0,0.5,0);
        box(g,gold,1.4,0.7,roadLen*0.92,0,0.5,0);
      }
      if(site.pagoda&&!isInAirportSafetyZone(site.x,site.z)&&baseY>=1.2){
        box(g,stone,32,10,32,0,-1,0);
        for(let t=0;t<5;t++){
          const y=4+t*8.5,r=14-t*1.6;
          box(g,pagodaRed,r*1.5,5.5,r*1.5,0,y+2.5,0);
          cyl(g,pagodaGreen,r*.5,r*1.4,3,4,0,y+6.8,0).rotation.y=Math.PI/4;
        }
        cyl(g,gold,.5,1.8,12,8,0,52,0);
      }
      if(!hasWorldOsmCities)for(let i=1;i<=cnt;i++){
        const h1=Math.sin(i*12.9898+sd)*43758.5453,u1=h1-Math.floor(h1);
        const h2=Math.sin(i*78.233+sd*1.7)*43758.5453,u2=h2-Math.floor(h2);
        const h3=Math.sin(i*37.719+sd*2.3)*43758.5453,u3=h3-Math.floor(h3);
        const r=95+Math.pow(u1,.72)*(span*.5);
        const ang=u2*Math.PI*2;
        const bx=Math.cos(ang)*r,bz=Math.sin(ang)*r;
        const distRatio=1-Math.min(1,r/(span*.55));
        const bh=Math.round(22+(maxH-22)*Math.pow(u3,1.35)*(0.45+0.55*distRatio));
        const bw=18+Math.round((u1*22)%18),bd=18+Math.round((u2*22)%18);
        const matPick=bh>95?(i%2?officeGlass:darkGlass):(i%3===0?officeGlass:wall);
        placeGroundedBuilding(g,baseY,site.x,site.z,bx,bz,bw,bh,bd,matPick,bh>115,'intl:'+sd);
      }
    }else if(site.type==='harbor_fleet'){
      // 3D International Harbor Fleet: Container ships, cruise liners & illuminated wakes on water
      const seaY=-baseY,sd=site.seed||401,cnt=site.count||8;
      for(let i=0;i<cnt;i++){
        const a=i*(Math.PI*2/cnt)+(sd%7)*0.35;
        const r=180+((i*230+sd*31)%1150);
        const sx=Math.cos(a)*r,sz=Math.sin(a)*r;
        const wx=site.x+sx,wz=site.z+sz;
        if(ground(wx,wz)>0.4||isInAirportSafetyZone(wx,wz))continue;
        const isCruise=(i%4===0);
        const shipLen=isCruise?240:210+((i*37)%95);
        const shipW=isCruise?34:30;
        // Hull at sea level
        box(g,isCruise?whiteFrame:darkBasalt,shipW,12,shipLen,sx,seaY+5,sz);
        if(isCruise){
          box(g,officeGlass,shipW*0.86,22,shipLen*0.76,sx,seaY+22,sz);
          box(g,whiteFrame,shipW*0.9,4,shipLen*0.82,sx,seaY+35,sz);
          cyl(g,pagodaRed,4.5,6.5,14,10,sx,seaY+43,sz-18);
        }else{
          // Container stacks + bridge superstructure
          for(let c=-2;c<=1;c++){
            const cMat=(c+i)%2===0?pagodaRed:(c%2?pagodaGreen:gold);
            box(g,cMat,shipW*0.84,13,34,sx,seaY+17.5,sz+c*40);
          }
          box(g,whiteFrame,shipW*0.78,24,18,sx,seaY+23,sz+shipLen*0.34);
          box(g,beaconMat,2,2,2,sx,seaY+37,sz+shipLen*0.34);
        }
      }
    }else if(site.type==='secret_monolith'){
      cyl(g,gold,18,18,3,24,0,145,0).rotation.x=Math.PI/2;
      box(g,darkBasalt,8,38,3,0,145,0);
      box(g,beaconMat,2.4,2.4,2.4,0,168,0);
    }
    g.updateMatrixWorld(true);
    const batches=new Map();
    for(const child of [...g.children]){
      const geom=child.geometry.index?child.geometry.toNonIndexed():child.geometry.clone();
      geom.applyMatrix4(child.matrix);
      if(!batches.has(child.material))batches.set(child.material,[]);
      batches.get(child.material).push(geom);
      g.remove(child);child.geometry.dispose();
    }
    for(const [mat,parts] of batches){
      const geom=new THREE.BufferGeometry();
      for(const [attr,w] of [['position',3],['normal',3],['uv',2]]){
        const arr=new Float32Array(parts.reduce((s,pt)=>s+pt.attributes.position.count*w,0));
        let off=0;
        for(const pt of parts){if(pt.attributes[attr])arr.set(pt.attributes[attr].array,off);off+=pt.attributes.position.count*w;}
        geom.setAttribute(attr,new THREE.BufferAttribute(arr,w));
      }
      const mesh=new THREE.Mesh(geom,mat);mesh.receiveShadow=true;
      g.add(mesh);parts.forEach(pt=>pt.dispose());
    }
  }
  stats.landmarks=landmarkSites.length;
  if(typeof BuildingCollision!=='undefined'&&typeof THREE.Box3==='function'){
    landmarkSites.forEach((site,i)=>{
      try{
        const g=landmarkGroups[i];if(!g)return;
        const box=new THREE.Box3().setFromObject(g);
        const h=box.max.y-g.position.y;
        if(Number.isFinite(h)&&h>8){const gy=ground(site.x,site.z);BuildingCollision.addCircle('tw:landmarks',site.x,site.z,site.radius*.5,gy+h,gy-2);}
      }catch(e){}
    });
  }

  const skipBuilding=(x,z)=>{
    const ll=latLon(x,z);
    if(ll.lat>=taipeiBox.s&&ll.lat<=taipeiBox.n&&ll.lon>=taipeiBox.w&&ll.lon<=taipeiBox.e)return true;
    if(landmarkSites.some(s=>Math.abs(x-s.x)<s.radius&&Math.abs(z-s.z)<s.radius))return true;
    return isInAirportSafetyZone(x,z);
  };

  function buffers(){return {p:[],n:[],uv:[],c:[]};}
  function tri(out,a,b,c,col,normal,uvs){
    const cr=col.r,cg=col.g,cb=col.b,nx=normal[0],ny=normal[1],nz=normal[2];
    out.p.push(a[0],a[1],a[2],b[0],b[1],b[2],c[0],c[1],c[2]);
    out.n.push(nx,ny,nz,nx,ny,nz,nx,ny,nz);
    if(uvs) out.uv.push(uvs[0][0],uvs[0][1],uvs[1][0],uvs[1][1],uvs[2][0],uvs[2][1]);
    else out.uv.push(a[0]*.25,a[2]*.25,b[0]*.25,b[2]*.25,c[0]*.25,c[2]*.25);
    out.c.push(cr,cg,cb,cr,cg,cb,cr,cg,cb);
  }
  function triFlat(out,ax,ay,az,bx,by,bz,cx,cy,cz,cr,cg,cb,nx,ny,nz,u0,v0,u1,v1,u2,v2){
    out.p.push(ax,ay,az,bx,by,bz,cx,cy,cz);
    out.n.push(nx,ny,nz,nx,ny,nz,nx,ny,nz);
    out.uv.push(u0,v0,u1,v1,u2,v2);
    out.c.push(cr,cg,cb,cr,cg,cb,cr,cg,cb);
  }
  function addLayerMesh(group,data,mat,name){
    if(!data.p.length)return;
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(data.p,3));
    g.setAttribute('normal',new THREE.Float32BufferAttribute(data.n,3));
    g.setAttribute('uv',new THREE.Float32BufferAttribute(data.uv,2));
    g.setAttribute('color',new THREE.Float32BufferAttribute(data.c,3));
    g.computeBoundingSphere();
    const m=new THREE.Mesh(g,mat);m.name=name;m.receiveShadow=true;group.add(m);
  }
  function emitUpTri(out,p0,p1,p2,y,cr,cg,cb,minX,minZ,invW,invD){
    const u0=invW?(p0[0]-minX)*invW:p0[0]*.08,v0=invD?(p0[1]-minZ)*invD:p0[1]*.08;
    const u1=invW?(p1[0]-minX)*invW:p1[0]*.08,v1=invD?(p1[1]-minZ)*invD:p1[1]*.08;
    const u2=invW?(p2[0]-minX)*invW:p2[0]*.08,v2=invD?(p2[1]-minZ)*invD:p2[1]*.08;
    if((p1[1]-p0[1])*(p2[0]-p0[0])-(p1[0]-p0[0])*(p2[1]-p0[1])>0){
      triFlat(out,p0[0],y,p0[1],p1[0],y,p1[1],p2[0],y,p2[1],cr,cg,cb,0,1,0,u0,v0,u1,v1,u2,v2);
    }else{
      triFlat(out,p0[0],y,p0[1],p2[0],y,p2[1],p1[0],y,p1[1],cr,cg,cb,0,1,0,u0,v0,u2,v2,u1,v1);
    }
  }
  function polygon(out,points,y,col,minX,minZ,invW,invD){
    const n=points.length,cr=col.r,cg=col.g,cb=col.b;
    if(n===3){
      emitUpTri(out,points[0],points[1],points[2],y,cr,cg,cb,minX,minZ,invW,invD);
      return;
    }
    if(n===4){
      const p0=points[0],p1=points[1],p2=points[2],p3=points[3];
      const c0=(p1[0]-p0[0])*(p2[1]-p1[1])-(p1[1]-p0[1])*(p2[0]-p1[0]);
      const c1=(p2[0]-p1[0])*(p3[1]-p2[1])-(p2[1]-p1[1])*(p3[0]-p2[0]);
      const c2=(p3[0]-p2[0])*(p0[1]-p3[1])-(p3[1]-p2[1])*(p0[0]-p3[0]);
      const c3=(p0[0]-p3[0])*(p1[1]-p0[1])-(p0[1]-p3[1])*(p1[0]-p0[0]);
      if((c0>=0&&c1>=0&&c2>=0&&c3>=0)||(c0<=0&&c1<=0&&c2<=0&&c3<=0)){
        emitUpTri(out,p0,p1,p2,y,cr,cg,cb,minX,minZ,invW,invD);
        emitUpTri(out,p0,p2,p3,y,cr,cg,cb,minX,minZ,invW,invD);
        return;
      }
    }
    const contour=points.map(p=>new THREE.Vector2(p[0],p[1]));
    for(const ids of THREE.ShapeUtils.triangulateShape(contour,[])){
      emitUpTri(out,points[ids[0]],points[ids[1]],points[ids[2]],y,cr,cg,cb,minX,minZ,invW,invD);
    }
  }
  function extrudeRingWalls(out,pts,y0,y1,cr,cg,cb,uScale,vScale){
    const v=(y1-y0)/vScale;
    for(let i=0;i<pts.length;i++){
      const a=pts[i],b=pts[(i+1)%pts.length],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);
      if(len<.05)continue;
      const nx=dz/len,nz=-dx/len,u=len/uScale;
      triFlat(out,a[0],y0,a[1],b[0],y0,b[1],b[0],y1,b[1],cr,cg,cb,nx,0,nz,0,0,u,0,u,v);
      triFlat(out,a[0],y0,a[1],b[0],y1,b[1],a[0],y1,a[1],cr,cg,cb,nx,0,nz,0,0,u,v,0,v);
    }
  }

  function* buildTile(key,data){
    const group=new THREE.Group();group.name='Taiwan city tile '+key;
    group.userData.masks=[];
    const BC=typeof BuildingCollision!=='undefined'?BuildingCollision:null;
    if(BC)BC.clearGroup('tw:'+key);
    const aptBuf=buffers(),glassBuf=buffers(),brickBuf=buffers(),condoBuf=buffers(),techBuf=buffers();
    const roofFlatBuf=buffers(),roofPitchedBuf=buffers();
    let built=0;
    for(const [x,z,h,tone,kind,coords] of data.b){
      if(skipBuilding(x,z))continue;
      const center=ground(x,z);
      if(center<0.35)continue;
      const points=[];
      let minX=1e9,minZ=1e9,maxX=-1e9,maxZ=-1e9,sumX=0,sumZ=0;
      for(let i=0;i<coords.length;i+=2){
        const px=x+coords[i],pz=z+coords[i+1];
        points.push([px,pz]);
        sumX+=px;sumZ+=pz;
        if(px<minX)minX=px;if(px>maxX)maxX=px;
        if(pz<minZ)minZ=pz;if(pz>maxZ)maxZ=pz;
      }
      if(points.length<3)continue;
      const cx=sumX/points.length,cz=sumZ/points.length;
      const fw=maxX-minX,fd=maxZ-minZ,area=fw*fd;
      mask(group,minX-2,minZ-2,maxX+2,maxZ+2);
      let base=center;
      if(points.length<=4){
        const g0=ground(points[0][0],points[0][1]),g2=ground(points[2][0],points[2][1]);
        base=Math.min(center,g0,g2)-2.4;
      }else{
        for(let i=0;i<points.length;i++){const gp=ground(points[i][0],points[i][1]);if(gp<base)base=gp;}
        base-=2.4;
      }
      const top=center+h;
      if(BC){const sx=fw*.06,sz=fd*.06;BC.add('tw:'+key,minX+sx,minZ+sz,maxX-sx,maxZ-sz,top,base);}

      // Deterministic regional & architectural archetype assignment across 5 PBR wall buckets
      const ll=latLon(x,z);
      const region=getTaiwanRegion(ll.lat,ll.lon);
      const bhHash=hashBuilding(x,z,tone);
      const styleRoll=bhHash%100;
      const isTech=(kind===2)||(h>=6&&h<=24&&Math.min(fw,fd)>=24&&area>=950&&styleRoll<(region===5?64:32));
      const glassProb=(region===5||region===6||region===7)?66:54;
      const isGlass=!isTech&&((kind===1&&h>=20)||(h>=38&&styleRoll<glassProb)||(h>=28&&styleRoll<28));
      const condoProb=(region===5||region===6)?58:45;
      const isCondo=!isTech&&!isGlass&&(h>=24||(h>=16&&styleRoll<condoProb));
      const brickProb=region===1?72:region===2?60:(region===3||region===4)?46:28;
      const isBrick=!isTech&&!isGlass&&!isCondo&&h<=18&&styleRoll<brickProb;

      let target,pal,uScale,vScale;
      if(isGlass){target=glassBuf;pal=PAL_GLASS;uScale=16.0;vScale=28.0;}
      else if(isTech){target=techBuf;pal=PAL_TECH;uScale=20.0;vScale=18.0;}
      else if(isCondo){target=condoBuf;pal=PAL_CONDO;uScale=16.0;vScale=25.6;}
      else if(isBrick){target=brickBuf;pal=PAL_BRICK;uScale=15.0;vScale=18.5;}
      else{target=aptBuf;pal=PAL_APT;uScale=15.5;vScale=24.0;}

      pickJitteredColor(pal,bhHash,tmpWallCol,h>95?.93:1);
      const cr=tmpWallCol.r,cg=tmpWallCol.g,cb=tmpWallCol.b;

      // 3D pitched/hipped roofs for low-rise Taiwanese houses (h <= 13m, ~45% overall, higher in Minnan/East/Islands)
      const pitchProb=region===1?78:region===2?68:(region===3||region===4)?58:(isBrick?60:42);
      const pitched=!isGlass&&!isTech&&h<=13.0&&points.length>=3&&points.length<=10&&fw<=34&&fd<=34&&(((bhHash>>>5)%100)<pitchProb);
      const wallTop=pitched?(top-Math.min(1.6,h*.14)):top;

      const roofHash=(bhHash^0x9e3779b9)>>>0;
      if(pitched){
        const rPal=(region===1||region===3||isBrick)?PAL_ROOF_MINNAN:PAL_ROOF_PITCHED;
        pickJitteredColor(rPal,roofHash,tmpRoofCol,1);
        const rr=tmpRoofCol.r,rg=tmpRoofCol.g,rb=tmpRoofCol.b;
        const rPeak=top+Math.min(2.4,Math.max(1.1,Math.min(fw,fd)*.17));
        const rux=fw>=fd?Math.max(0,fw*.24):0;
        const ruz=fd>fw?Math.max(0,fd*.24):0;
        const r0=[cx-rux,rPeak,cz-ruz],r1=[cx+rux,rPeak,cz+ruz];
        for(let i=0;i<points.length;i++){
          const a=points[i],b=points[(i+1)%points.length];
          const pA=(((a[0]-cx)*rux+(a[1]-cz)*ruz)>=0)?r1:r0;
          const pB=(((b[0]-cx)*rux+(b[1]-cz)*ruz)>=0)?r1:r0;
          const triR=(aa,bb,cc)=>{
            const u1x=bb[0]-aa[0],u1y=bb[1]-aa[1],u1z=bb[2]-aa[2];
            const v1x=cc[0]-aa[0],v1y=cc[1]-aa[1],v1z=cc[2]-aa[2];
            let nx=u1y*v1z-u1z*v1y,ny=u1z*v1x-u1x*v1z,nz=u1x*v1y-u1y*v1x;
            const nl=Math.hypot(nx,ny,nz)||1;nx/=nl;ny/=nl;nz/=nl;
            if(ny<0){
              triFlat(roofPitchedBuf,aa[0],aa[1],aa[2],cc[0],cc[1],cc[2],bb[0],bb[1],bb[2],rr,rg,rb,-nx,-ny,-nz,aa[0]*.16,aa[2]*.16,cc[0]*.16,cc[2]*.16,bb[0]*.16,bb[2]*.16);
            }else{
              triFlat(roofPitchedBuf,aa[0],aa[1],aa[2],bb[0],bb[1],bb[2],cc[0],cc[1],cc[2],rr,rg,rb,nx,ny,nz,aa[0]*.16,aa[2]*.16,bb[0]*.16,bb[2]*.16,cc[0]*.16,cc[2]*.16);
            }
          };
          const ea=[a[0],wallTop,a[1]],eb=[b[0],wallTop,b[1]];
          if(pA===pB){triR(ea,eb,pA);}else{triR(ea,eb,pB);triR(ea,pB,pA);}
        }
      }else{
        pickJitteredColor(PAL_ROOF_FLAT,roofHash,tmpRoofCol,isTech?1.08:1);
        polygon(roofFlatBuf,points,wallTop,tmpRoofCol,minX,minZ,1/Math.max(fw,4),1/Math.max(fd,4));

        // 3D rooftop penthouses / stair towers / stepped crowns for mid/high-rise buildings (h >= 18m, ~55%)
        if(h>=18&&fw>=8&&fd>=8&&(((bhHash>>>7)%100)<56)){
          const crownHash=(bhHash^0x85ebca6b)>>>0;
          if(h>=34||((bhHash>>>11)%3===0)){
            // Stepped architectural crown / mechanical penthouse inset from building footprint
            const inset=h>=45?0.68:0.62;
            const ch=Math.min(8.5,Math.max(2.6,h*0.085));
            const crownPts=[];
            let cMinX=1e9,cMinZ=1e9,cMaxX=-1e9,cMaxZ=-1e9;
            for(let i=0;i<points.length;i++){
              const px=cx+(points[i][0]-cx)*inset,pz=cz+(points[i][1]-cz)*inset;
              crownPts.push([px,pz]);
              if(px<cMinX)cMinX=px;if(px>cMaxX)cMaxX=px;
              if(pz<cMinZ)cMinZ=pz;if(pz>cMaxZ)cMaxZ=pz;
            }
            const cTone=isGlass?0.90:0.94;
            extrudeRingWalls(target,crownPts,wallTop,wallTop+ch,cr*cTone,cg*cTone,cb*cTone,uScale,vScale);
            pickJitteredColor(PAL_ROOF_FLAT,crownHash,tmpCrownCol,0.96);
            polygon(roofFlatBuf,crownPts,wallTop+ch,tmpCrownCol,cMinX,cMinZ,1/Math.max(cMaxX-cMinX,3),1/Math.max(cMaxZ-cMinZ,3));
            // Upper mechanical spire core on tall towers (h >= 54m)
            if(h>=54&&fw>=14&&fd>=14){
              const ch2=Math.min(4.8,Math.max(2.4,h*0.04));
              const corePts=points.map(p=>[cx+(p[0]-cx)*0.36,cz+(p[1]-cz)*0.36]);
              extrudeRingWalls(isGlass?condoBuf:target,corePts,wallTop+ch,wallTop+ch+ch2,cr*0.86,cg*0.86,cb*0.86,uScale,vScale);
              polygon(roofFlatBuf,corePts,wallTop+ch+ch2,tmpCrownCol,cMinX,cMinZ,1/Math.max(cMaxX-cMinX,3),1/Math.max(cMaxZ-cMinZ,3));
            }
          }else{
            // Classic Taiwanese rooftop stairwell tower / elevator machine room (樓梯間/機房)
            const pw=Math.min(fw*0.34,6.8),pd=Math.min(fd*0.34,6.0);
            const ox=(((crownHash&255)/255)-0.5)*fw*0.22;
            const oz=((((crownHash>>>8)&255)/255)-0.5)*fd*0.22;
            const px0=cx+ox-pw*0.5,px1=cx+ox+pw*0.5,pz0=cz+oz-pd*0.5,pz1=cz+oz+pd*0.5;
            const ph=2.6+((crownHash>>>16)%16)*0.12;
            const phPts=[[px0,pz0],[px1,pz0],[px1,pz1],[px0,pz1]];
            const phBuf=isCondo?condoBuf:aptBuf;
            extrudeRingWalls(phBuf,phPts,wallTop,wallTop+ph,Math.min(1,cr*1.04),Math.min(1,cg*1.04),Math.min(1,cb*1.04),12,18);
            pickJitteredColor(PAL_ROOF_FLAT,crownHash,tmpCrownCol,1.02);
            polygon(roofFlatBuf,phPts,wallTop+ph,tmpCrownCol,px0,pz0,1/Math.max(pw,2),1/Math.max(pd,2));
          }
        }
      }
      extrudeRingWalls(target,points,base,wallTop,cr,cg,cb,uScale,vScale);
      built++;if(built%260===0)yield;
    }
    addLayerMesh(group,aptBuf,wallApt,'Taiwan tile apartments');
    addLayerMesh(group,glassBuf,wallGlass,'Taiwan glass towers');
    addLayerMesh(group,brickBuf,wallBrick,'Taiwan brick townhouses');
    addLayerMesh(group,condoBuf,wallCondo,'Taiwan modern condos');
    addLayerMesh(group,techBuf,techWall,'Taiwan tech & industrial');
    addLayerMesh(group,roofFlatBuf,roofFlat,'Taiwan flat rooftops');
    addLayerMesh(group,roofPitchedBuf,roofPitched,'Taiwan pitched rooftops');
    group.userData.buildings=built;
    root.add(group);loaded.set(key,group);
    stats.buildings+=built;stats.tiles=loaded.size;stats.maskRevision++;
  }

  function disposeTile(key){
    const group=loaded.get(key);if(!group)return;
    stats.buildings-=group.userData.buildings||0;
    for(const [k,rect] of group.userData.masks){const cell=masks.get(k);if(cell){cell.delete(rect);if(!cell.size)masks.delete(k);}}
    group.traverse(o=>o.geometry?.dispose());
    if(typeof BuildingCollision!=='undefined')BuildingCollision.clearGroup('tw:'+key);
    root.remove(group);loaded.delete(key);stats.tiles=loaded.size;stats.maskRevision++;
  }

  function requestTile(tile){
    const key=tile[0];pending.add(key);stats.loading=pending.size;
    fetch('taiwan-city/'+key+'.json?v=61').then(r=>{if(!r.ok)throw new Error(r.status);return r.json();})
      .then(data=>jobs.push({key,iterator:buildTile(key,data)}))
      .catch(()=>{failed.set(key,clock+15);pending.delete(key);stats.loading=pending.size;});
  }

  // GPU-instanced multi-million settlement blocks (bottomless 2-group unit box = sides + roof = only 6 draw calls total)
  let settlementsMeta=null,settlementRequest=false;
  const loadedChunks=new Map(),pendingChunks=new Set();
  let lastInfillX=1e9,lastInfillZ=1e9,lastInfillRev=-1,lastInfillRange=0,chunkRevision=0,lastChunkRev=-1;
  function createInfillBoxGeometry(){
    const g=new THREE.BufferGeometry();
    // 4 walls (+x, -x, +z, -z) [0..23] + 1 roof (+y) [24..29]
    const pos=new Float32Array([
      0.5,0,-0.5, 0.5,0,0.5, 0.5,1,0.5,   0.5,0,-0.5, 0.5,1,0.5, 0.5,1,-0.5,
      -0.5,0,0.5, -0.5,0,-0.5, -0.5,1,-0.5, -0.5,0,0.5, -0.5,1,-0.5, -0.5,1,0.5,
      -0.5,0,0.5, 0.5,0,0.5, 0.5,1,0.5,   -0.5,0,0.5, 0.5,1,0.5, -0.5,1,0.5,
      0.5,0,-0.5, -0.5,0,-0.5, -0.5,1,-0.5, 0.5,0,-0.5, -0.5,1,-0.5, 0.5,1,-0.5,
      -0.5,1,0.5, 0.5,1,0.5, 0.5,1,-0.5,  -0.5,1,0.5, 0.5,1,-0.5, -0.5,1,-0.5
    ]);
    const norm=new Float32Array([
      1,0,0, 1,0,0, 1,0,0,   1,0,0, 1,0,0, 1,0,0,
      -1,0,0, -1,0,0, -1,0,0, -1,0,0, -1,0,0, -1,0,0,
      0,0,1, 0,0,1, 0,0,1,   0,0,1, 0,0,1, 0,0,1,
      0,0,-1, 0,0,-1, 0,0,-1, 0,0,-1, 0,0,-1, 0,0,-1,
      0,1,0, 0,1,0, 0,1,0,   0,1,0, 0,1,0, 0,1,0
    ]);
    const uv=new Float32Array([
      0,0, 1,0, 1,1,  0,0, 1,1, 0,1,
      0,0, 1,0, 1,1,  0,0, 1,1, 0,1,
      0,0, 1,0, 1,1,  0,0, 1,1, 0,1,
      0,0, 1,0, 1,1,  0,0, 1,1, 0,1,
      0,0, 1,0, 1,1,  0,0, 1,1, 0,1
    ]);
    g.setAttribute('position',new THREE.BufferAttribute(pos,3));
    g.setAttribute('normal',new THREE.BufferAttribute(norm,3));
    g.setAttribute('uv',new THREE.BufferAttribute(uv,2));
    g.addGroup(0,24,0);
    g.addGroup(24,6,1);
    g.computeBoundingSphere();
    return g;
  }
  function createInfillPitchedGeometry(){
    const g=new THREE.BufferGeometry();
    const pos=new Float32Array([
      0.5,0,-0.5, 0.5,0,0.5, 0.5,0.72,0.5,   0.5,0,-0.5, 0.5,0.72,0.5, 0.5,0.72,-0.5,
      -0.5,0,0.5, -0.5,0,-0.5, -0.5,0.72,-0.5, -0.5,0,0.5, -0.5,0.72,-0.5, -0.5,0.72,0.5,
      -0.5,0,0.5, 0.5,0,0.5, 0.5,0.72,0.5,   -0.5,0,0.5, 0.5,0.72,0.5, -0.5,0.72,0.5,
      0.5,0,-0.5, -0.5,0,-0.5, -0.5,0.72,-0.5, 0.5,0,-0.5, -0.5,0.72,-0.5, 0.5,0.72,-0.5,
      -0.5,0.72,0.5, 0.5,0.72,0.5, 0.25,1.02,0,   -0.5,0.72,0.5, 0.25,1.02,0, -0.25,1.02,0,
      0.5,0.72,-0.5, -0.5,0.72,-0.5, -0.25,1.02,0, 0.5,0.72,-0.5, -0.25,1.02,0, 0.25,1.02,0,
      0.5,0.72,0.5, 0.5,0.72,-0.5, 0.25,1.02,0,
      -0.5,0.72,-0.5, -0.5,0.72,0.5, -0.25,1.02,0
    ]);
    const n=pos.length/3,norm=new Float32Array(pos.length),uv=new Float32Array(n*2);
    for(let i=0;i<pos.length;i+=9){
      const ux=pos[i+3]-pos[i],uy=pos[i+4]-pos[i+1],uz=pos[i+5]-pos[i+2];
      const vx=pos[i+6]-pos[i],vy=pos[i+7]-pos[i+1],vz=pos[i+8]-pos[i+2];
      let nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;
      const nl=Math.hypot(nx,ny,nz)||1;nx/=nl;ny/=nl;nz/=nl;
      norm[i]=norm[i+3]=norm[i+6]=nx;norm[i+1]=norm[i+4]=norm[i+7]=ny;norm[i+2]=norm[i+5]=norm[i+8]=nz;
    }
    for(let i=0;i<n;i+=6){uv[i*2]=0;uv[i*2+1]=0;uv[i*2+2]=1;uv[i*2+3]=0;uv[i*2+4]=1;uv[i*2+5]=1;if(i+3<n){uv[i*2+6]=0;uv[i*2+7]=0;uv[i*2+8]=1;uv[i*2+9]=1;uv[i*2+10]=0;uv[i*2+11]=1;}}
    g.setAttribute('position',new THREE.BufferAttribute(pos,3));
    g.setAttribute('normal',new THREE.BufferAttribute(norm,3));
    g.setAttribute('uv',new THREE.BufferAttribute(uv,2));
    g.addGroup(0,24,0);
    g.addGroup(24,18,1);
    g.computeBoundingSphere();
    return g;
  }
  const infillGeo=createInfillBoxGeometry();
  const infillHouseGeo=createInfillPitchedGeometry();
  // Vivid multi-archetype suburban infill materials (pitched houses with terracotta & teal-green roofs, glass offices & sci-park tech)
  const infillWallMat=new THREE.MeshStandardMaterial({color:0xffffff,map:aptTex,roughness:0.78,metalness:0.04,emissive:0xffe2ad,emissiveMap:aptNight,emissiveIntensity:0});
  const infillBrickWallMat=new THREE.MeshStandardMaterial({color:0xffffff,map:brickTex,roughness:0.86,metalness:0.02,emissive:0xffd794,emissiveMap:brickNight,emissiveIntensity:0});
  const infillRoofMat=new THREE.MeshStandardMaterial({color:0x9eb8a8,map:roofFlatTex,roughness:0.82,metalness:0.08});
  const infillHouseRoofMat=new THREE.MeshStandardMaterial({color:0xd86b4c,map:roofPitchedTex,roughness:0.72,metalness:0.10});
  const infillTealRoofMat=new THREE.MeshStandardMaterial({color:0x428f7e,map:roofPitchedTex,roughness:0.68,metalness:0.18});
  const infillOfficeMat=new THREE.MeshPhysicalMaterial({color:0xffffff,map:glassTex,roughnessMap:glassRough,roughness:0.24,metalness:0.58,clearcoat:0.82,clearcoatRoughness:0.14,envMap:reflectedMap,envMapIntensity:1.1,emissive:0xffe6b8,emissiveMap:glassNight,emissiveIntensity:0});
  const infillTechMat=new THREE.MeshStandardMaterial({color:0xffffff,map:techTex,roughness:0.42,metalness:0.44,emissive:0xdcf0ff,emissiveMap:techNight,emissiveIntensity:0});
  const INFILL_WARM_PAL=['#f0e6d2','#e6d5b8','#c97859','#dfb08c','#d6b685','#ebd9a7','#d49280','#ce7050','#cc8e52','#d48974','#ebe4d8','#d1a65a'].map(h=>new THREE.Color(h));
  const INFILL_COOL_PAL=['#b5cbb8','#b8cad8','#e6e8ea','#eef0f3','#f0e6d2','#dfd2bc','#e4dfd5','#d4c2a8'].map(h=>new THREE.Color(h));
  const MAX_RES_INST=3600,MAX_RES_ALT_INST=2400,MAX_OFF_INST=1600,MAX_TECH_INST=1600;
  const infillRes=new THREE.InstancedMesh(infillHouseGeo,[infillWallMat,infillHouseRoofMat],MAX_RES_INST);
  const infillResAlt=new THREE.InstancedMesh(infillHouseGeo,[infillBrickWallMat,infillTealRoofMat],MAX_RES_ALT_INST);
  const infillOffice=new THREE.InstancedMesh(infillGeo,[infillOfficeMat,infillRoofMat],MAX_OFF_INST);
  const infillTech=new THREE.InstancedMesh(infillGeo,[infillTechMat,infillRoofMat],MAX_TECH_INST);
  for(const im of [infillRes,infillResAlt,infillOffice,infillTech]){
    im.count=0;im.frustumCulled=false;im.receiveShadow=true;im.name='Taiwan multi-million infill';
    root.add(im);
  }
  const dummyObj=new THREE.Object3D();
  function ensureSettlementChunks(x,z,range){
    if(!settlementsMeta?.chunks)return;
    const chunkSz=settlementsMeta.chunkSize||24000;
    for(const [ck,cx,cz] of settlementsMeta.chunks){
      const d=Math.hypot(cx-x,cz-z);
      if(d<range+chunkSz*0.78&&!loadedChunks.has(ck)&&!pendingChunks.has(ck)&&pendingChunks.size<4){
        pendingChunks.add(ck);
        fetch('taiwan-city/settlements/'+ck+'.json?v=61').then(r=>{if(!r.ok)throw new Error(r.status);return r.json();})
          .then(data=>{loadedChunks.set(ck,data.tiles||{});pendingChunks.delete(ck);chunkRevision++;})
          .catch(()=>{pendingChunks.delete(ck);});
      }else if(loadedChunks.has(ck)&&d>chunkSz*1.65){
        loadedChunks.delete(ck);chunkRevision++;
      }
    }
  }
  function refreshInfill(x,z,range){
    if(!settlementsMeta)return;
    const cellSz=settlementsMeta.cellSize||120,tileSz=settlementsMeta.tileSize||4800,chunkSz=settlementsMeta.chunkSize||24000;
    const maxR=Math.min(range,9000),maxR2=maxR*maxR;
    const tx0=Math.floor((x-maxR)/tileSz),tx1=Math.floor((x+maxR)/tileSz);
    const tz0=Math.floor((z-maxR)/tileSz),tz1=Math.floor((z+maxR)/tileSz);
    let nRes=0,nResAlt=0,nOff=0,nTech=0;
    const BC=typeof BuildingCollision!=='undefined'?BuildingCollision:null;
    if(BC)BC.clearGroup('tw:infill');
    for(let tx=tx0;tx<=tx1;tx++){
      for(let tz=tz0;tz<=tz1;tz++){
        const k=tx+'_'+tz;
        const sx=Math.floor(((tx+0.5)*tileSz)/chunkSz),sz=Math.floor(((tz+0.5)*tileSz)/chunkSz);
        const chunk=loadedChunks.get(sx+'_'+sz)||settlementsMeta.tiles;
        const rows=chunk?.[k];
        if(!rows)continue;
        for(let i=0;i<rows.length;i+=3){
          const gx=rows[i],gz=rows[i+1],flags=rows[i+2];
          const cellCx=(gx+0.5)*cellSz,cellCz=(gz+0.5)*cellSz;
          const ddx=cellCx-x,ddz=cellCz-z;
          const d2=ddx*ddx+ddz*ddz;
          if(d2>maxR2)continue;
          const kind=flags&3,dens=(flags>>2)&3,angIdx=(flags>>4)&31,hTier=(flags>>9)&7,slots=(flags>>12)&31;
          const ang=(angIdx/31)*Math.PI;
          const cosA=Math.cos(ang),sinA=Math.sin(ang);
          const count=d2<(3600*3600)?slots:Math.min(slots,dens>=2?8:4);
          let seed=(Math.imul(gx,73856093)^Math.imul(gz,19349663))>>>0;
          for(let s=0;s<count;s++){
            seed=(Math.imul(seed,1664525)+1013904223)>>>0;
            const u=((seed&0xffff)/65536-0.5)*(cellSz*0.84);
            const v=(((seed>>>16)&0xffff)/65536-0.5)*(cellSz*0.84);
            const bx=cellCx+u*cosA-v*sinA,bz=cellCz+u*sinA+v*cosA;
            if(blocked(bx,bz)||skipBuilding(bx,bz))continue;
            const gy=ground(bx,bz);
            if(gy<0.9)continue;
            if(Math.abs(ground(bx+8,bz)-gy)>4.2||Math.abs(ground(bx,bz+8)-gy)>4.2)continue;
            seed=(Math.imul(seed,1664525)+1013904223)>>>0;
            const r1=(seed&255)/255,r2=((seed>>>8)&255)/255,r3=((seed>>>16)&255)/255;
            const bh=(kind===2?(8.5+r1*8.5):(hTier>=5?(18+r1*26):(dens>=2?(11+r1*13):(8.5+r1*6.5))));
            const bw=kind===2?(16+r2*18):(dens>=3?(12+r2*12):(8.5+r2*7.5));
            const bd=kind===2?(14+r3*14):(dens>=3?(11+r3*10):(8.0+r3*6.5));
            const ih=hashBuilding(bx,bz,seed>>>24);
            dummyObj.position.set(bx,gy-1.8,bz);
            dummyObj.rotation.set(0,-ang+((seed&1)?0:Math.PI*0.5),0);
            dummyObj.scale.set(bw,bh+1.8,bd);
            dummyObj.updateMatrix();
            if(BC&&d2<2500*2500){const hr=Math.max(bw,bd)*.42;BC.add('tw:infill',bx-hr,bz-hr,bx+hr,bz+hr,gy+bh,gy-2);}
            if(kind===2&&nTech<MAX_TECH_INST){
              pickJitteredColor(PAL_TECH,ih,tmpWallCol,1);
              infillTech.setMatrixAt(nTech,dummyObj.matrix);infillTech.setColorAt(nTech,tmpWallCol);nTech++;
            }else if((kind===1||bh>=28)&&nOff<MAX_OFF_INST){
              pickJitteredColor((ih&1)?PAL_GLASS:PAL_CONDO,ih,tmpWallCol,1);
              infillOffice.setMatrixAt(nOff,dummyObj.matrix);infillOffice.setColorAt(nOff,tmpWallCol);nOff++;
            }else if(((ih>>>4)%10)<4&&nResAlt<MAX_RES_ALT_INST){
              pickJitteredColor(INFILL_COOL_PAL,ih,tmpWallCol,1);
              infillResAlt.setMatrixAt(nResAlt,dummyObj.matrix);infillResAlt.setColorAt(nResAlt,tmpWallCol);nResAlt++;
            }else if(nRes<MAX_RES_INST){
              pickJitteredColor(INFILL_WARM_PAL,ih,tmpWallCol,1);
              infillRes.setMatrixAt(nRes,dummyObj.matrix);infillRes.setColorAt(nRes,tmpWallCol);nRes++;
            }
          }
        }
      }
    }
    infillRes.count=nRes;infillRes.instanceMatrix.needsUpdate=true;if(infillRes.instanceColor)infillRes.instanceColor.needsUpdate=true;
    infillResAlt.count=nResAlt;infillResAlt.instanceMatrix.needsUpdate=true;if(infillResAlt.instanceColor)infillResAlt.instanceColor.needsUpdate=true;
    infillOffice.count=nOff;infillOffice.instanceMatrix.needsUpdate=true;if(infillOffice.instanceColor)infillOffice.instanceColor.needsUpdate=true;
    infillTech.count=nTech;infillTech.instanceMatrix.needsUpdate=true;if(infillTech.instanceColor)infillTech.instanceColor.needsUpdate=true;
    stats.activeInfill=nRes+nResAlt+nOff+nTech;
  }

  let roadsMeta=null,roadIndexReq=false;
  const loadedRoadChunks=new Map(),pendingRoadChunks=new Set();
  function* buildRoadChunk(ck,data){
    const group=new THREE.Group();group.name='Taiwan highway chunk '+ck;
    const roads=buffers(),curbs=buffers(),bridgeColor={r:.72,g:.74,b:.76},pierColor={r:.58,g:.61,b:.63};
    const arr=data.r||[];
    for(let r=0;r<arr.length;r++){
      const [width,bridge,coords]=arr[r];
      let cumDist=0;
      const half=width*.5,liftBridge=bridge?8:0;
      for(let i=2;i<coords.length;i+=2){
        const ax=coords[i-2],az=coords[i-1],bx=coords[i],bz=coords[i+1],dx=bx-ax,dz=bz-az,length=Math.hypot(dx,dz);
        if(length<.2)continue;
        const nx=-dz/length,nz=dx/length;
        const sections=Math.max(1,Math.ceil(length/55));
        for(let part=0;part<sections;part++){
          const t=part/sections,u=(part+1)/sections;
          const x=ax+dx*t,z=az+dz*t,x2=ax+dx*u,z2=az+dz*u;
          const segLen=length/sections,v0=cumDist/32,v1=(cumDist+segLen)/32;
          cumDist+=segLen;
          if(airports.some(a=>Math.hypot(x-a.x,z-a.z)<a.length/2+110&&Math.abs(runwayCoordinates(x,z,a).cross)<260))continue;
          const g1=ground(x,z),g2=ground(x2,z2);
          if(!bridge&&g1<.2&&g2<.2)continue;
          const y1=Math.max(.35,g1)+.24+liftBridge,y2=Math.max(.35,g2)+.24+liftBridge;
          const lx1=x+nx*half,lz1=z+nz*half,rx1=x-nx*half,rz1=z-nz*half;
          const lx2=x2+nx*half,lz2=z2+nz*half,rx2=x2-nx*half,rz2=z2-nz*half;
          triFlat(roads,lx1,y1,lz1,rx1,y1,rz1,rx2,y2,rz2,1,1,1,0,1,0,0,v0,1,v0,1,v1);
          triFlat(roads,lx1,y1,lz1,rx2,y2,rz2,lx2,y2,lz2,1,1,1,0,1,0,0,v0,1,v1,0,v1);
          if(bridge){
            for(const s of [-1,1]){
              const outOff=half+.5,inOff=half-.1;
              triFlat(curbs,x+nx*s*outOff,y1+1.0,z+nz*s*outOff,x+nx*s*inOff,y1+1.0,z+nz*s*inOff,x2+nx*s*inOff,y2+1.0,z2+nz*s*inOff,bridgeColor.r,bridgeColor.g,bridgeColor.b,0,1,0,0,0,1,0,1,1);
              triFlat(curbs,x+nx*s*outOff,y1+1.0,z+nz*s*outOff,x2+nx*s*inOff,y2+1.0,z2+nz*s*inOff,x2+nx*s*outOff,y2+1.0,z2+nz*s*outOff,bridgeColor.r,bridgeColor.g,bridgeColor.b,0,1,0,0,0,1,1,0,1);
            }
            if(part===0&&length>20){
              const mx=(x+x2)*.5,mz=(z+z2)*.5,gm=ground(mx,mz),pw=1.6;
              triFlat(curbs,mx-pw,gm-.5,mz-pw,mx+pw,gm-.5,mz-pw,mx+pw,y1,mz-pw,pierColor.r,pierColor.g,pierColor.b,0,0,-1,0,0,1,0,1,1);
              triFlat(curbs,mx-pw,gm-.5,mz-pw,mx+pw,y1,mz-pw,mx-pw,y1,mz-pw,pierColor.r,pierColor.g,pierColor.b,0,0,-1,0,0,1,1,0,1);
            }
          }
        }
      }
      if(r%90===0)yield;
    }
    addLayerMesh(group,roads,roadMat,'Taiwan highways and streets');
    addLayerMesh(group,curbs,roadCurbMat,'Taiwan highway bridge parapets');
    root.add(group);loadedRoadChunks.set(ck,group);
  }
  function ensureRoadChunks(x,z,range){
    if(!roadsMeta?.chunks)return;
    const maxD=Math.max(14000,range*1.85);
    for(const [ck,cx,cz] of roadsMeta.chunks){
      const d=Math.hypot(cx-x,cz-z);
      const existing=loadedRoadChunks.get(ck);
      if(existing)existing.visible=d<maxD+8000;
      if(d<maxD&&!existing&&!pendingRoadChunks.has(ck)&&pendingRoadChunks.size<3){
        pendingRoadChunks.add(ck);
        fetch('taiwan-city/roads/'+ck+'.json?v=62').then(r=>{if(!r.ok)throw new Error(r.status);return r.json();})
          .then(data=>jobs.push({key:'r_'+ck,iterator:buildRoadChunk(ck,data),isRoad:ck}))
          .catch(()=>{pendingRoadChunks.delete(ck);});
      }else if(existing&&d>maxD+18000){
        existing.traverse(o=>o.geometry?.dispose());
        root.remove(existing);loadedRoadChunks.delete(ck);
      }
    }
  }

  function update(dt,x,z,quality,activeDay,wet){
    clock+=Math.min(dt,.1);day=activeDay;
    const at=latLon(x,z);
    const inTaiwan=at.lat>21.6&&at.lat<26.6&&at.lon>117.9&&at.lon<122.4;
    const near=inTaiwan||landmarkSites.some(s=>Math.hypot(s.x-x,s.z-z)<65000);
    root.visible=near;if(!near)return;
    const mobile=touchControls.mode.value==='mobile';
    const range=mobile?5000:quality==='ultra'?12000:quality==='high'?9600:7400;
    const sunHeight=Math.max(0,Math.min(1,day));
    const dusk=1-sunHeight;
    const nightApt=Math.pow(dusk,1.15)*0.86;
    const nightBrick=Math.pow(dusk,1.15)*0.80;
    const nightCondo=Math.pow(dusk,1.10)*0.92;
    const nightGlass=Math.pow(dusk,1.25)*1.28;
    const nightTech=Math.pow(dusk,1.10)*0.70;
    const envInt=0.28+sunHeight*1.15;
    wallApt.emissiveIntensity=nightApt;
    wallBrick.emissiveIntensity=nightBrick;
    wallCondo.emissiveIntensity=nightCondo;
    wallGlass.emissiveIntensity=nightGlass;
    techWall.emissiveIntensity=nightTech;
    wall.emissiveIntensity=nightApt;
    infillWallMat.emissiveIntensity=nightApt;
    infillBrickWallMat.emissiveIntensity=nightBrick;
    infillOfficeMat.emissiveIntensity=nightGlass;
    infillTechMat.emissiveIntensity=nightTech;
    darkGlass.emissiveIntensity=dusk*0.92;
    officeGlass.emissiveIntensity=nightGlass;
    wallGlass.envMapIntensity=officeGlass.envMapIntensity=infillOfficeMat.envMapIntensity=envInt;
    roadMat.roughness=wet?.28:.84;roadMat.metalness=wet?.22:.02;
    roadMat.emissiveIntensity=Math.pow(1-day,1.25)*(wet?1.25:1.05);
    beaconMat.emissiveIntensity=(Math.sin(clock*4.5)>0?2.1:.15)*(0.45+(1-day)*1.4);
    for(let i=0;i<landmarkGroups.length;i++){
      const g=landmarkGroups[i];
      const d=Math.hypot(g.position.x-x,g.position.z-z);
      const show=d<Math.max(28000,range*2.4);
      g.visible=show;
      if(show&&!g.userData.grounded){
        g.position.y=ground(g.position.x,g.position.z);
        g.userData.grounded=true;
      }
    }
    if(!index&&!indexRequest&&clock>=nextScan){
      indexRequest=true;
      fetch('taiwan-city/index.json?v=61').then(r=>{if(!r.ok)throw new Error(r.status);return r.json();})
        .then(data=>{
          index=data;stats.ready=true;root.userData.coverage=data;
          stats.infillCapacity=data.counts?.infillBuildings||0;
          stats.taiwanTotalBuildings=data.counts?.taiwanTotalBuildings||data.counts?.buildings||0;
        })
        .catch(()=>{indexRequest=false;nextScan=clock+12;});
    }
    if(!roadIndexReq){
      roadIndexReq=true;
      fetch('taiwan-city/roads/index.json?v=62').then(r=>{if(!r.ok)throw new Error(r.status);return r.json();})
        .then(data=>{roadsMeta=data;stats.roads=data.roads||0;ensureRoadChunks(x,z,range);})
        .catch(()=>{roadIndexReq=false;});
    }
    if(!settlementsMeta&&!settlementRequest){
      settlementRequest=true;
      fetch('taiwan-city/settlements.json?v=61').then(r=>{if(!r.ok)throw new Error(r.status);return r.json();})
        .then(data=>{settlementsMeta=data;chunkRevision++;ensureSettlementChunks(x,z,range);})
        .catch(()=>{settlementRequest=false;});
    }
    if(index&&clock>=nextScan){
      nextScan=clock+.45;
      const distances=index.tiles.map(t=>[t,Math.hypot(t[1]-x,t[2]-z)]).sort((a,b)=>a[1]-b[1]);
      for(const [tile,distance] of distances){
        const mesh=loaded.get(tile[0]);if(mesh)mesh.visible=distance<range+4200;
        if(distance<range+3600&&!mesh&&!pending.has(tile[0])&&(failed.get(tile[0])??0)<clock&&pending.size<4)requestTile(tile);
        if(mesh&&distance>range+7500)disposeTile(tile[0]);
      }
      ensureSettlementChunks(x,z,range);
      ensureRoadChunks(x,z,range);
    }
    if(settlementsMeta&&(Math.hypot(x-lastInfillX,z-lastInfillZ)>280||stats.maskRevision!==lastInfillRev||chunkRevision!==lastChunkRev||range!==lastInfillRange)){
      lastInfillX=x;lastInfillZ=z;lastInfillRev=stats.maskRevision;lastChunkRev=chunkRevision;lastInfillRange=range;
      refreshInfill(x,z,range);
    }
    const end=performance.now()+(mobile?4.0:8.0);
    while(jobs.length&&performance.now()<end){
      const job=jobs[0];
      try{
        if(job.iterator.next().done){
          jobs.shift();
          if(job.isRoad)pendingRoadChunks.delete(job.isRoad);
          else{pending.delete(job.key);stats.loading=pending.size;}
          nextScan=0;
        }
      }catch(error){
        jobs.shift();
        if(job.isRoad)pendingRoadChunks.delete(job.isRoad);
        else{pending.delete(job.key);failed.set(job.key,clock+15);}
        console.warn('Taiwan tile:',error);
      }
    }
  }
  return {root,stats,inside,update,landmarks,landmarkSites,blocked};
}
if(typeof module!=='undefined')module.exports={createTaiwanCity};
