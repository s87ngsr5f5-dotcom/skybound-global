'use strict';
// Sky map: Google Maps Satellite / Hybrid / Terrain slippy tile pyramid + Natural Earth shaded-relief satellite fallback.
// createSkyMap() is reused by the Asia/World overlay and by the free-flight airport picker. Read-only: never touches saves.
const skyMapCore=(()=>{
  const RAD=Math.PI/180,TAU=Math.PI*2;
  const mx=lon=>lon*RAD, my=lat=>Math.log(Math.tan(Math.PI/4+Math.max(-85,Math.min(85,lat))*RAD/2));
  const Y_MIN=my(-58),Y_MAX=my(84);
  let paths;

  // Shared Google Maps Satellite / Hybrid / Terrain Web Mercator tile cache across all map instances
  const tileCache=new Map();
  const LAYER_MODES=[
    {id:'hybrid',label:'🛰 Google 衛星混合',lyrs:'y'},
    {id:'satellite',label:'🌎 Google 純衛星',lyrs:'s'},
    {id:'terrain',label:'⛰ Google 地形圖',lyrs:'p'},
    {id:'vector',label:'🧭 離線衛星航圖',lyrs:''}
  ];
  let defaultLayerIdx=0;

  function getTileUrl(lyrs,z,x,y,useFallback){
    if(useFallback){
      return `https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
    }
    const srv=(x+y)&3;
    return `https://mt${srv}.google.com/vt/lyrs=${lyrs}&hl=zh-TW&x=${x}&y=${y}&z=${z}`;
  }

  function requestTile(lyrs,z,x,y,onLoad){
    if(!lyrs||typeof Image==='undefined') return null;
    const n=1<<z;
    if(y<0||y>=n) return null;
    const tx=((x%n)+n)%n;
    const key=`${lyrs}:${z}:${tx}:${y}`;
    let entry=tileCache.get(key);
    if(entry){
      tileCache.delete(key);
      tileCache.set(key,entry);
      if(entry.state==='loading'&&onLoad) entry.Waiters.add(onLoad);
      return entry;
    }
    const img=new Image();
    entry={img,state:'loading',Waiters:new Set(onLoad?[onLoad]:[]),z,x:tx,y};
    tileCache.set(key,entry);
    const finish=st=>{
      entry.state=st;
      for(const fn of entry.Waiters){try{fn();}catch{}}
      entry.Waiters.clear();
    };
    img.onload=()=>finish('ready');
    img.onerror=()=>{
      if(!entry.triedFallback){
        entry.triedFallback=true;
        img.src=getTileUrl(lyrs,z,tx,y,true);
      }else{
        finish('error');
      }
    };
    img.referrerPolicy='no-referrer';
    img.src=getTileUrl(lyrs,z,tx,y,false);
    while(tileCache.size>320){
      const oldestKey=tileCache.keys().next().value;
      const old=tileCache.get(oldestKey);
      if(old?.Waiters) old.Waiters.clear();
      tileCache.delete(oldestKey);
    }
    return entry;
  }

  function findAncestorTile(lyrs,z,x,y){
    const n=1<<z;
    const tx=((x%n)+n)%n;
    for(let pz=z-1;pz>=1;pz--){
      const shift=z-pz;
      const px=tx>>shift, py=y>>shift;
      const pEntry=tileCache.get(`${lyrs}:${pz}:${px}:${py}`);
      if(pEntry&&pEntry.state==='ready'){
        const scale=1<<shift;
        const subW=256/scale, subH=256/scale;
        const sxSrc=(tx&(scale-1))*subW;
        const sySrc=(y&(scale-1))*subH;
        return {img:pEntry.img,sx:sxSrc,sy:sySrc,sw:subW,sh:subH};
      }
    }
    return null;
  }

  function decode(list){
    const U=asiaMapData.u;
    return list.map(a=>{
      const n=a.length/2,out=new Float64Array(n*2);let x=a[0],y=a[1];
      out[0]=mx(x/U);out[1]=my(y/U);
      for(let i=1;i<n;i++){x+=a[i*2];y+=a[i*2+1];out[i*2]=mx(x/U);out[i*2+1]=my(y/U);}
      let minX=1e9,maxX=-1e9,minY=1e9,maxY=-1e9;
      for(let i=0;i<n;i++){const px=out[i*2],py=out[i*2+1];if(px<minX)minX=px;if(px>maxX)maxX=px;if(py<minY)minY=py;if(py>maxY)maxY=py;}
      out.box=[minX,maxX,minY,maxY];return out;
    });
  }
  function prepare(){
    if(paths||typeof asiaMapData==='undefined') return;
    paths={land:decode(asiaMapData.land),lakes:decode(asiaMapData.lakes),rivers:decode(asiaMapData.rivers),
      borders:decode(asiaMapData.borders),major:decode(asiaMapData.roadsMajor),secondary:decode(asiaMapData.roadsSecondary)};
  }
  function greatCircle(a,b,steps=96){
    const la1=a.lat*RAD,lo1=a.lon*RAD,la2=b.lat*RAD,lo2=b.lon*RAD;
    const d=2*Math.asin(Math.sqrt(Math.sin((la2-la1)/2)**2+Math.cos(la1)*Math.cos(la2)*Math.sin((lo2-lo1)/2)**2));
    if(!d) return [];
    const pts=[];let prev=null;
    for(let i=0;i<=steps;i++){
      const f=i/steps,A=Math.sin((1-f)*d)/Math.sin(d),B=Math.sin(f*d)/Math.sin(d);
      const x=A*Math.cos(la1)*Math.cos(lo1)+B*Math.cos(la2)*Math.cos(lo2);
      const y=A*Math.cos(la1)*Math.sin(lo1)+B*Math.cos(la2)*Math.sin(lo2);
      const z=A*Math.sin(la1)+B*Math.sin(la2);
      let lon=Math.atan2(y,x);
      if(prev!==null) while(lon-prev>Math.PI) lon-=TAU;
      while(prev!==null&&prev-lon>Math.PI) lon+=TAU;
      prev=lon;pts.push([lon,my(Math.atan2(z,Math.hypot(x,y))/RAD)]);
    }
    return pts;
  }
  const ease=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;

  function create(host,opts={}){
    prepare();
    const canvas=document.createElement('canvas');
    canvas.style.cssText='display:block;width:100%;height:100%;touch-action:none;outline:none';
    canvas.tabIndex=0;canvas.setAttribute('aria-label',opts.label||'世界衛星地圖');
    host.appendChild(canvas);
    const ctx=canvas.getContext('2d');
    const view={cx:mx(112),cy:my(28),k:1,minK:1};
    const sel={dep:null,dst:null,focus:null};
    let layerIdx=defaultLayerIdx;
    let w=0,h=0,dpr=1,raf=0,anim=0,pinch=0,moved=false,downAt=null,destroyed=false,pulse=0;
    const pad={r:0,b:0};
    const mid=()=>[(w-pad.r)/2,(h-pad.b)/2];
    const pointers=new Map();
    const airports=()=>typeof allAirports!=='undefined'?allAirports.filter(a=>!a.carrier&&Number.isFinite(a.lat)&&Number.isFinite(a.lon)):[];
    const sx=x=>(w-pad.r)/2+(x-view.cx)*view.k, sy=y=>(h-pad.b)/2-(y-view.cy)*view.k;
    const zoomLevel=()=>view.k/view.minK;

    // Pre-warm base z=1 & z=2 Google satellite tiles for smooth instant zoom transitions
    function prewarmBaseTiles(){
      const lyrs=LAYER_MODES[layerIdx].lyrs;
      if(!lyrs||typeof Image==='undefined') return;
      for(let ty=0;ty<2;ty++) for(let tx=0;tx<2;tx++) requestTile(lyrs,1,tx,ty,redraw);
      for(let ty=0;ty<4;ty++) for(let tx=0;tx<4;tx++) requestTile(lyrs,2,tx,ty,redraw);
    }

    function clamp(){
      const halfH=h/2/view.k;
      view.cy=Math.max(Y_MIN+halfH*.6,Math.min(Y_MAX-halfH*.6,view.cy));
      view.cx=((view.cx+Math.PI)%TAU+TAU)%TAU-Math.PI;
    }
    function worldK(){return Math.max(w/TAU,h/(Y_MAX-Y_MIN))*.98;}
    function resize(){
      if(destroyed) return;
      const nw=host.clientWidth,nh=host.clientHeight;if(!nw||!nh) return;
      const first=!w;dpr=Math.min(devicePixelRatio||1,2);
      const oldMin=view.minK;w=nw;h=nh;
      canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
      view.minK=worldK();
      if(first){showWorld(false);prewarmBaseTiles();}
      else view.k=Math.max(view.minK,view.k*(view.minK/(oldMin||view.minK)));
      redraw();
    }
    function trace(list,close,offsets){
      const [mxp,myp]=mid(),left=view.cx-mxp/view.k,right=view.cx+(w-mxp)/view.k,bottom=view.cy-(h-myp)/view.k,top=view.cy+myp/view.k;
      for(const p of list){
        const [minX,maxX,minY,maxY]=p.box;if(maxY<bottom||minY>top) continue;
        const n=p.length/2;
        for(const off of offsets){
          if(maxX+off<left||minX+off>right) continue;
          ctx.moveTo(sx(p[0]+off),sy(p[1]));
          for(let i=1;i<n;i++) ctx.lineTo(sx(p[i*2]+off),sy(p[i*2+1]));
          if(close) ctx.closePath();
        }
      }
    }
    function project(a){
      let x=mx(a.lon);const y=my(a.lat);
      const d=x-view.cx;if(d>Math.PI) x-=TAU;else if(d<-Math.PI) x+=TAU;
      return [sx(x),sy(y)];
    }
    function clusters(list,radius){
      const out=[];
      for(const a of list){
        const [x,y]=project(a);if(x<-30||y<-30||x>w+30||y>h+30) continue;
        const pinned=a===sel.dep||a===sel.dst||a===sel.focus;
        const hit=!pinned&&out.find(c=>!c.pinned&&Math.hypot(c.x-x,c.y-y)<radius);
        if(hit){hit.x=(hit.x*hit.items.length+x)/(hit.items.length+1);hit.y=(hit.y*hit.items.length+y)/(hit.items.length+1);hit.items.push(a);}
        else out.push({x,y,items:[a],pinned});
      }
      return out;
    }

    function drawSatelliteTiles(lyrs){
      if(!lyrs||typeof Image==='undefined') return 0;
      const worldPx=TAU*view.k;
      const tz=Math.max(1,Math.min(18,Math.round(Math.log2(Math.max(256,worldPx)/256))));
      const n=1<<tz;
      const [mxp,myp]=mid();
      const leftWx=view.cx-mxp/view.k, rightWx=view.cx+(w-mxp)/view.k;
      const topWy=view.cy+myp/view.k, botWy=view.cy-(h-myp)/view.k;

      const minTx=Math.floor(((leftWx+Math.PI)/TAU)*n);
      const maxTx=Math.floor(((rightWx+Math.PI)/TAU)*n);
      const minTy=Math.max(0,Math.floor(((Math.PI-topWy)/TAU)*n));
      const maxTy=Math.min(n-1,Math.floor(((Math.PI-botWy)/TAU)*n));

      let drawnCount=0;
      for(let ty=minTy;ty<=maxTy;ty++){
        const wyTop=Math.PI-(ty/n)*TAU;
        const wyBot=Math.PI-((ty+1)/n)*TAU;
        const py0=sy(wyTop), py1=sy(wyBot), ph=py1-py0;
        if(py1<-2||py0>h+2) continue;
        for(let tx=minTx;tx<=maxTx;tx++){
          const wx0=-Math.PI+(tx/n)*TAU;
          const wx1=-Math.PI+((tx+1)/n)*TAU;
          const px0=sx(wx0), px1=sx(wx1), pw=px1-px0;
          if(px1<-2||px0>w+2) continue;
          const entry=requestTile(lyrs,tz,tx,ty,redraw);
          if(entry&&entry.state==='ready'){
            ctx.drawImage(entry.img,px0,py0,pw+0.6,ph+0.6);
            drawnCount++;
          }else{
            const anc=findAncestorTile(lyrs,tz,tx,ty);
            if(anc){
              ctx.drawImage(anc.img,anc.sx,anc.sy,anc.sw,anc.sh,px0,py0,pw+0.6,ph+0.6);
              drawnCount++;
            }
          }
        }
      }
      return drawnCount;
    }

    let lastClusters=[];
    function draw(){
      raf=0;if(destroyed||!w||!paths) return;
      ctx.setTransform(dpr,0,0,dpr,0,0);
      const z=zoomLevel();
      const offs=[-TAU,0,TAU];

      // 1. Deep Ocean Bathymetry Satellite Base
      const sea=ctx.createLinearGradient(0,0,0,h);
      sea.addColorStop(0,'#04101e');
      sea.addColorStop(0.35,'#07213a');
      sea.addColorStop(0.7,'#092844');
      sea.addColorStop(1,'#051526');
      ctx.fillStyle=sea;ctx.fillRect(0,0,w,h);

      // 2. Offline NASA Blue Marble Shaded-Relief Satellite Base (always drawn underneath so zero blank gaps ever appear)
      ctx.lineJoin='round';ctx.lineCap='round';
      ctx.beginPath();trace(paths.land,true,offs);
      // Continental shelf shallow turquoise halo
      ctx.strokeStyle='rgba(26,120,156,0.38)';ctx.lineWidth=Math.min(8,2.2+z*0.35);ctx.stroke();
      // Multi-zone latitude satellite biome gradient (polar tundra -> temperate forest -> subtropical desert -> equatorial jungle)
      const yEq=sy(0), yN65=sy(my(65)), yS50=sy(my(-50));
      const spanY=Math.max(120,Math.abs(yS50-yN65));
      const landGrad=ctx.createLinearGradient(0,yEq-spanY*0.65,0,yEq+spanY*0.55);
      landGrad.addColorStop(0,'#5c6960');    // high-latitude tundra/boreal
      landGrad.addColorStop(0.24,'#2d4d2c'); // northern temperate forest
      landGrad.addColorStop(0.40,'#76684a'); // subtropical arid/steppe belt (Sahara / Middle East / Gobi)
      landGrad.addColorStop(0.55,'#1d4222'); // equatorial rainforest
      landGrad.addColorStop(0.75,'#6b5f44'); // southern arid/savannah
      landGrad.addColorStop(1,'#3a5238');    // southern temperate
      ctx.fillStyle=landGrad;ctx.fill();
      ctx.strokeStyle='rgba(155,198,162,0.55)';ctx.lineWidth=0.9;ctx.stroke();

      ctx.beginPath();trace(paths.lakes,true,offs);ctx.fillStyle='#08233b';ctx.fill();

      // 3. Live Google Maps Satellite / Hybrid / Terrain Tile Pyramid
      const curMode=LAYER_MODES[layerIdx];
      const tilesDrawn=drawSatelliteTiles(curMode.lyrs);
      canvas.dataset.mapLayer=curMode.id;
      canvas.dataset.satelliteTiles=String(tilesDrawn);

      // 4. Vector Overlays (subtle when Google Hybrid is active since Google Hybrid already includes roads & place labels)
      const isHybridTiles=curMode.id==='hybrid'&&tilesDrawn>0;
      const isSatTiles=curMode.id!=='vector'&&tilesDrawn>0;

      // Graticule grid
      ctx.strokeStyle=isSatTiles?'rgba(160,215,245,.09)':'rgba(180,220,245,.10)';
      ctx.lineWidth=1;ctx.beginPath();
      const step=z<3?30:z<12?10:2;
      for(let lon=-180;lon<=360;lon+=step){const x=sx(mx(lon));if(x>-2&&x<w+2){ctx.moveTo(x,0);ctx.lineTo(x,h);}}
      for(let lat=-60;lat<=84;lat+=step){const y=sy(my(lat));if(y>-2&&y<h+2){ctx.moveTo(0,y);ctx.lineTo(w,y);}}
      ctx.stroke();

      if(!isSatTiles&&z>=2){
        ctx.beginPath();trace(paths.rivers,false,offs);
        ctx.strokeStyle='rgba(78,162,218,.82)';ctx.lineWidth=Math.min(1.7,.5+z*.04);ctx.stroke();
      }
      ctx.beginPath();trace(paths.borders,false,offs);
      ctx.strokeStyle=isSatTiles?'rgba(255,235,150,.38)':'rgba(238,244,232,.52)';
      ctx.lineWidth=.85;ctx.setLineDash([4,3]);ctx.stroke();ctx.setLineDash([]);

      if(!isHybridTiles&&z>=5){
        ctx.beginPath();trace(paths.major,false,offs);
        ctx.strokeStyle=isSatTiles?'rgba(255,196,82,.55)':'rgba(247,200,106,.88)';
        ctx.lineWidth=Math.min(2.0,.6+z*.025);ctx.stroke();
      }
      if(!isHybridTiles&&z>=24){
        ctx.beginPath();trace(paths.secondary,false,offs);
        ctx.strokeStyle='rgba(255,236,190,.55)';ctx.lineWidth=.8;ctx.stroke();
      }

      // 5. Country & City Labels (when not already rendered by Google Hybrid tiles)
      ctx.textAlign='center';ctx.textBaseline='middle';
      if(!isHybridTiles){
        const maxRank=z<2?1:z<3.5?3:z<7?5:z<14?7:10;
        ctx.font='600 '+Math.round(10+Math.min(5,z*.35))+'px system-ui,"Noto Sans TC",sans-serif';
        for(const [name,lon,lat,rank] of asiaMapData.countries){
          if(rank>maxRank) continue;
          let x=mx(lon);const d=x-view.cx;if(d>Math.PI)x-=TAU;else if(d<-Math.PI)x+=TAU;
          const px=sx(x),py=sy(my(lat));if(px<-50||py<-20||px>w+50||py>h+20) continue;
          ctx.strokeStyle='rgba(4,14,22,.88)';ctx.lineWidth=3.2;ctx.strokeText(name,px,py);
          ctx.fillStyle='rgba(244,250,255,.94)';ctx.fillText(name,px,py);
        }
        if(z>=9){
          ctx.font='500 10px system-ui,sans-serif';
          for(const [name,lon,lat] of asiaMapData.cities){
            let x=mx(lon);const d=x-view.cx;if(d>Math.PI)x-=TAU;else if(d<-Math.PI)x+=TAU;
            const px=sx(x),py=sy(my(lat));if(px<0||py<0||px>w||py>h) continue;
            ctx.fillStyle='rgba(255,255,255,.88)';ctx.beginPath();ctx.arc(px,py,2,0,7);ctx.fill();
            ctx.strokeStyle='rgba(4,14,22,.88)';ctx.lineWidth=2.5;ctx.strokeText(name,px,py-8);ctx.fillStyle='#fff';ctx.fillText(name,px,py-8);
          }
        }
      }

      // 6. Great-Circle Flight Route Overlay
      const list=airports();
      if(sel.dep&&sel.dst&&sel.dep!==sel.dst){
        const pts=greatCircle(sel.dep,sel.dst);
        for(const off of [-TAU,0,TAU]){
          ctx.beginPath();pts.forEach(([x,y],i)=>i?ctx.lineTo(sx(x+off),sy(y)):ctx.moveTo(sx(x+off),sy(y)));
          ctx.strokeStyle='rgba(6,20,32,0.78)';ctx.lineWidth=5.2;ctx.stroke();
          ctx.strokeStyle='#ff9d3d';ctx.lineWidth=2.6;ctx.setLineDash([8,5]);ctx.stroke();ctx.setLineDash([]);
        }
      }

      // 7. Airports (clustered when zoomed out)
      lastClusters=clusters(list,z<7?30:z<16?18:0);
      ctx.font='700 11px system-ui,sans-serif';
      for(const c of lastClusters){
        if(c.items.length>1){
          ctx.beginPath();ctx.arc(c.x,c.y,12.5,0,7);ctx.fillStyle='rgba(255,222,106,.95)';ctx.fill();ctx.strokeStyle='#06141e';ctx.lineWidth=1.8;ctx.stroke();
          ctx.fillStyle='#0d1b26';ctx.textAlign='center';ctx.fillText(String(c.items.length),c.x,c.y+.5);continue;
        }
        const a=c.items[0],isDep=a===sel.dep,isDst=a===sel.dst,isFocus=a===sel.focus;
        const r=isFocus?7.8:isDep||isDst?6.8:4.4;
        ctx.beginPath();ctx.arc(c.x,c.y,r,0,7);ctx.fillStyle=isDep?'#ff9d3d':isDst?'#59c2ff':'#ffe27a';ctx.fill();ctx.strokeStyle='#06141e';ctx.lineWidth=1.6;ctx.stroke();
        if(isFocus){
          const t=(pulse%1);ctx.beginPath();ctx.arc(c.x,c.y,10+t*26,0,7);ctx.strokeStyle='rgba(255,255,255,'+(.85*(1-t))+')';ctx.lineWidth=2.2;ctx.stroke();
        }
        if(isFocus||((isDep||isDst)&&z>=2.5)||z>=6||list.length<8){
          ctx.textAlign='left';ctx.strokeStyle='rgba(4,14,22,.92)';ctx.lineWidth=3.2;
          const tag=a.code+(isDep?' 出發':isDst?' 目的':'');ctx.strokeText(tag,c.x+9,c.y);ctx.fillStyle='#fff';ctx.fillText(tag,c.x+9,c.y);ctx.textAlign='center';
        }
        if(isFocus||(z>=30&&(isDep||isDst))){
          const len=46,wid=7,hd=a.heading||0;
          ctx.save();ctx.translate(c.x,c.y);ctx.rotate(hd-Math.PI/2);
          ctx.fillStyle='rgba(24,30,38,.96)';ctx.fillRect(-len/2,-wid/2,len,wid);ctx.strokeStyle='#fff';ctx.lineWidth=1;ctx.strokeRect(-len/2,-wid/2,len,wid);
          ctx.fillStyle='#fff';ctx.fillRect(-len/2+4,-.5,len-8,1);ctx.restore();
        }
      }

      // 8. Scale Bar & Satellite Telemetry Badge
      const midLat=Math.atan(Math.sinh(view.cy))/RAD,kmPerPx=(40075*Math.cos(midLat*RAD))/(TAU*view.k);
      const nice=[1,2,5,10,20,50,100,200,500,1000,2000,5000,10000].find(v=>v/kmPerPx>70)||10000,bar=nice/kmPerPx;
      ctx.fillStyle='rgba(6,18,28,.78)';ctx.fillRect(12,h-34,bar+16,22);ctx.fillStyle='#fff';ctx.fillRect(20,h-18,bar,2);
      ctx.textAlign='left';ctx.font='11px system-ui,sans-serif';ctx.fillText(nice+' km',20,h-26);
      if(sel.focus&&host.offsetParent!==null){pulse+=.02;redraw();}
    }

    function redraw(){if(!raf&&!destroyed) raf=requestAnimationFrame(draw);}
    function setView(cx,cy,k){view.cx=cx;view.cy=cy;view.k=Math.max(view.minK,Math.min(view.minK*220,k));clamp();}
    function showWorld(animate=true,padTo){
      const target={cx:mx(112),cy:my(26),k:view.minK};
      if(animate) animateTo(target.cx,target.cy,target.k,1400,undefined,padTo||{r:0,b:0});else{if(padTo){pad.r=padTo.r;pad.b=padTo.b;}setView(target.cx,target.cy,target.k);redraw();}
    }
    function animateTo(cx,cy,k,ms=1500,done,padTo){
      cancelAnimationFrame(anim);
      let dx=cx-view.cx;if(dx>Math.PI)dx-=TAU;else if(dx<-Math.PI)dx+=TAU;
      const from={cx:view.cx,cy:view.cy,lk:Math.log(view.k)},to={cx:view.cx+dx,cy,lk:Math.log(Math.max(view.minK,k))};
      const dist=Math.hypot(dx*view.k,(cy-view.cy)*view.k),lift=Math.min(1.1,dist/(Math.max(w,h)*3));
      const t0=performance.now(),padFrom={r:pad.r,b:pad.b};
      const step=now=>{
        if(destroyed) return;
        const t=Math.min(1,(now-t0)/ms),e=ease(t),arc=Math.sin(Math.PI*t)*lift;
        if(padTo){pad.r=padFrom.r+(padTo.r-padFrom.r)*e;pad.b=padFrom.b+(padTo.b-padFrom.b)*e;}
        setView(from.cx+(to.cx-from.cx)*e,from.cy+(to.cy-from.cy)*e,Math.exp(from.lk+(to.lk-from.lk)*e-arc));
        draw();
        if(t<1) anim=requestAnimationFrame(step);else{anim=0;done&&done();}
      };
      anim=requestAnimationFrame(step);
    }
    function kForSpanKm(km){return Math.max(view.minK,Math.min(view.minK*220,w/(Math.max(km,180)/6371)));}
    function flyToAirport(a,spanKm=380,ms=1700,done,padTo){animateTo(mx(a.lon),my(a.lat),kForSpanKm(spanKm),ms,done,padTo);}
    function flyToBox(points,padKm=120,ms=1400){
      const lons=points.map(p=>p.lon),lats=points.map(p=>p.lat);
      const cLon=(Math.min(...lons)+Math.max(...lons))/2,cLat=(Math.min(...lats)+Math.max(...lats))/2;
      const spanKm=Math.max(padKm,(Math.max(...lons)-Math.min(...lons))*111*Math.cos(cLat*RAD)*1.8,(Math.max(...lats)-Math.min(...lats))*111*1.8);
      animateTo(mx(cLon),my(cLat),kForSpanKm(spanKm),ms);
    }
    function zoomAt(px,py,factor){
      cancelAnimationFrame(anim);const [mxp,myp]=mid();
      const wx=view.cx+(px-mxp)/view.k,wy=view.cy-(py-myp)/view.k;
      view.k=Math.max(view.minK,Math.min(view.minK*220,view.k*factor));
      view.cx=wx-(px-mxp)/view.k;view.cy=wy+(py-myp)/view.k;clamp();redraw();
    }
    function cycleLayer(){
      layerIdx=(layerIdx+1)%LAYER_MODES.length;
      defaultLayerIdx=layerIdx;
      prewarmBaseTiles();
      redraw();
      return LAYER_MODES[layerIdx];
    }
    function setLayer(id){
      const idx=LAYER_MODES.findIndex(m=>m.id===id);
      if(idx>=0){layerIdx=idx;defaultLayerIdx=idx;prewarmBaseTiles();redraw();}
      return LAYER_MODES[layerIdx];
    }
    function pick(px,py){
      let best=null,bd=22;
      for(const c of lastClusters){const d=Math.hypot(c.x-px,c.y-py);if(d<bd){bd=d;best=c;}}
      if(!best) return opts.onPick&&opts.onPick(null);
      if(best.items.length>1){flyToBox(best.items,60,900);return;}
      opts.onPick&&opts.onPick(best.items[0]);
    }
    canvas.addEventListener('pointerdown',e=>{
      cancelAnimationFrame(anim);canvas.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});moved=false;pinch=0;
      const r=canvas.getBoundingClientRect();downAt=[e.clientX-r.left,e.clientY-r.top];
    });
    canvas.addEventListener('pointermove',e=>{
      const p=pointers.get(e.pointerId);if(!p) return;
      if(pointers.size===1){
        const dx=e.clientX-p.x,dy=e.clientY-p.y;
        if(downAt&&Math.hypot(e.clientX-canvas.getBoundingClientRect().left-downAt[0],e.clientY-canvas.getBoundingClientRect().top-downAt[1])>5) moved=true;
        if(moved){view.cx-=dx/view.k;view.cy+=dy/view.k;clamp();redraw();}
      }else if(pointers.size===2){
        p.x=e.clientX;p.y=e.clientY;const [a,b]=[...pointers.values()],d=Math.hypot(a.x-b.x,a.y-b.y);
        const r=canvas.getBoundingClientRect();
        if(pinch) zoomAt((a.x+b.x)/2-r.left,(a.y+b.y)/2-r.top,d/pinch);
        pinch=d;moved=true;
      }
      p.x=e.clientX;p.y=e.clientY;
    });
    const up=e=>{
      const had=pointers.has(e.pointerId);pointers.delete(e.pointerId);pinch=0;
      if(had&&e.type==='pointerup'&&!moved&&downAt&&pointers.size===0) pick(downAt[0],downAt[1]);
    };
    canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',up);
    canvas.addEventListener('wheel',e=>{e.preventDefault();const r=canvas.getBoundingClientRect();zoomAt(e.clientX-r.left,e.clientY-r.top,Math.exp(-e.deltaY*.0015));},{passive:false});
    canvas.addEventListener('dblclick',e=>{const r=canvas.getBoundingClientRect();zoomAt(e.clientX-r.left,e.clientY-r.top,2);});
    const onResize=()=>{if(!host.isConnected){destroy();return;}resize();};
    addEventListener('resize',onResize);
    const ro=typeof ResizeObserver!=='undefined'?new ResizeObserver(()=>resize()):null;ro&&ro.observe(host);
    function destroy(){destroyed=true;cancelAnimationFrame(raf);cancelAnimationFrame(anim);removeEventListener('resize',onResize);ro&&ro.disconnect();canvas.remove();}
    resize();
    return {
      resize,redraw,destroy,showWorld,flyToAirport,flyToBox,animateTo,
      cycleLayer,setLayer,getLayer:()=>LAYER_MODES[layerIdx],
      zoomBy:f=>zoomAt(w/2,h/2,f),
      setSelection(o){Object.assign(sel,o);redraw();},
      get canvas(){return canvas;},get view(){return view;}
    };
  }
  return {create,requestTile,findAncestorTile,LAYER_MODES,ready:()=>typeof asiaMapData!=='undefined'};
})();

// Stand-alone full-screen overlay (button "🗺 亞洲地圖" in the route preview).
const asiaMap=(()=>{
  let overlay,map,layerBtn;
  const sel=id=>document.getElementById(id)?.value;
  function build(){
    overlay=document.createElement('div');overlay.id='asiaMapOverlay';overlay.hidden=true;
    overlay.setAttribute('role','dialog');overlay.setAttribute('aria-label','世界衛星地圖');
    overlay.style.cssText='position:fixed;inset:0;z-index:2147483000;background:#061524;user-select:none';
    const host=document.createElement('div');host.style.cssText='position:absolute;inset:0';
    const bar=document.createElement('div');
    bar.style.cssText='position:absolute;top:max(10px,env(safe-area-inset-top));left:10px;right:10px;display:flex;gap:8px;align-items:center;pointer-events:none;flex-wrap:wrap';
    const btn=(text,label,fn)=>{const b=document.createElement('button');b.type='button';b.textContent=text;b.setAttribute('aria-label',label);
      b.style.cssText='pointer-events:auto;min-width:44px;min-height:44px;border-radius:10px;border:1px solid rgba(255,255,255,.35);background:rgba(6,20,30,.78);color:#fff;font:600 14px system-ui,sans-serif;padding:0 12px;cursor:pointer';
      b.onclick=fn;return b;};
    const info=document.createElement('div');info.style.cssText='flex:1;color:#fff;font:600 13px system-ui,sans-serif;text-shadow:0 1px 3px #000;pointer-events:none;min-width:180px';
    info.textContent='🛰 Google 全球衛星地圖 · 拖曳移動、雙指或滾輪縮放';
    layerBtn=btn('🛰 Google 衛星混合','切換地圖圖層',()=>{const m=map.cycleLayer();layerBtn.textContent=m.label;});
    bar.append(btn('✕','關閉地圖',close),info,layerBtn,btn('＋','放大',()=>map.zoomBy(1.6)),btn('－','縮小',()=>map.zoomBy(1/1.6)),btn('⌂','回到世界',()=>map.showWorld(true)));
    const note=document.createElement('div');
    note.style.cssText='position:absolute;right:10px;bottom:max(8px,env(safe-area-inset-bottom));color:rgba(255,255,255,.78);font:10px system-ui,sans-serif;text-shadow:0 1px 2px #000;pointer-events:none';
    note.textContent='衛星圖資：Google Maps Satellite / Esri World Imagery · 航圖底料：Natural Earth';
    overlay.append(host,bar,note);document.body.append(overlay);
    map=skyMapCore.create(host,{label:'世界衛星地圖'});
    addEventListener('keydown',e=>{if(!overlay.hidden&&e.key==='Escape') close();});
  }
  function syncRoute(){
    const list=typeof allAirports!=='undefined'?allAirports:[];
    map.setSelection({dep:list.find(a=>a.code===sel('departure')),dst:list.find(a=>a.code===sel('destination'))});
  }
  function open(){
    if(!skyMapCore.ready()) return;
    if(!overlay) build();
    overlay.hidden=false;map.resize();syncRoute();map.showWorld(false);
    const list=typeof allAirports!=='undefined'?allAirports.filter(a=>!a.carrier):[];
    if(list.length) map.flyToBox(list,400,1200);
  }
  function close(){if(overlay) overlay.hidden=true;}
  document.addEventListener('click',e=>{if(e.target.closest?.('#openAsiaMap')){e.preventDefault();open();}});
  return {open,close,get ready(){return skyMapCore.ready();}};
})();
if(typeof module!=='undefined') module.exports={asiaMap,skyMapCore};
