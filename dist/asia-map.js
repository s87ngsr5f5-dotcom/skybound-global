'use strict';
// Asia 2D map: real coastlines, lakes, rivers, borders and major roads (Natural Earth, public domain).
// Opens as a full-screen overlay from the route-preview panel. Read-only: never touches saves or flight state.
const asiaMap=(()=>{
  let overlay,canvas,ctx,info,paths,raf=0,w=0,h=0,dpr=1;
  const view={cx:0,cy:0,k:1,minK:1};   // cx,cy: Mercator centre (radians); k: pixels per radian
  const pointers=new Map();
  let pinch=0,moved=false;
  const RAD=Math.PI/180;
  const mx=lon=>lon*RAD, my=lat=>Math.log(Math.tan(Math.PI/4+Math.max(-85,Math.min(85,lat))*RAD/2));
  function decode(list){
    const U=asiaMapData.u;
    return list.map(a=>{
      const n=a.length/2,out=new Float64Array(n*2);let x=a[0],y=a[1];
      out[0]=mx(x/U);out[1]=my(y/U);
      for(let i=1;i<n;i++){x+=a[i*2];y+=a[i*2+1];out[i*2]=mx(x/U);out[i*2+1]=my(y/U);}
      return out;
    });
  }
  function prepare(){
    if(paths) return;
    paths={land:decode(asiaMapData.land),lakes:decode(asiaMapData.lakes),rivers:decode(asiaMapData.rivers),
      borders:decode(asiaMapData.borders),major:decode(asiaMapData.roadsMajor),secondary:decode(asiaMapData.roadsSecondary)};
  }
  function fit(){
    // Show mainland and maritime Asia first (about 60E-150E, 12S-58N).
    const x0=mx(58),x1=mx(152),y0=my(-12),y1=my(58);
    view.k=Math.min(w/(x1-x0),h/(y1-y0));view.minK=view.k*.8;
    view.cx=(x0+x1)/2;view.cy=(y0+y1)/2;
  }
  const sx=x=>w/2+(x-view.cx)*view.k, sy=y=>h/2-(y-view.cy)*view.k;
  function trace(list,close){
    const left=view.cx-w/2/view.k,right=view.cx+w/2/view.k,bottom=view.cy-h/2/view.k,top=view.cy+h/2/view.k;
    for(const p of list){
      const n=p.length/2;let minX=1e9,maxX=-1e9,minY=1e9,maxY=-1e9;
      // Cheap bounding test (paths are short after simplification).
      for(let i=0;i<n;i++){const x=p[i*2],y=p[i*2+1];if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;}
      if(maxX<left||minX>right||maxY<bottom||minY>top) continue;
      ctx.moveTo(sx(p[0]),sy(p[1]));
      for(let i=1;i<n;i++) ctx.lineTo(sx(p[i*2]),sy(p[i*2+1]));
      if(close) ctx.closePath();
    }
  }
  function greatCircle(a,b,steps=72){
    const la1=a.lat*RAD,lo1=a.lon*RAD,la2=b.lat*RAD,lo2=b.lon*RAD;
    const d=2*Math.asin(Math.sqrt(Math.sin((la2-la1)/2)**2+Math.cos(la1)*Math.cos(la2)*Math.sin((lo2-lo1)/2)**2));
    if(!d) return [[lo1,my(a.lat)]];
    const pts=[];
    for(let i=0;i<=steps;i++){
      const f=i/steps,A=Math.sin((1-f)*d)/Math.sin(d),B=Math.sin(f*d)/Math.sin(d);
      const x=A*Math.cos(la1)*Math.cos(lo1)+B*Math.cos(la2)*Math.cos(lo2);
      const y=A*Math.cos(la1)*Math.sin(lo1)+B*Math.cos(la2)*Math.sin(lo2);
      const z=A*Math.sin(la1)+B*Math.sin(la2);
      pts.push([Math.atan2(y,x),my(Math.atan2(z,Math.hypot(x,y))/RAD)]);
    }
    return pts;
  }
  const selected=id=>document.getElementById(id)?.value;
  function draw(){
    raf=0;if(!ctx) return;
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.fillStyle='#16435f';ctx.fillRect(0,0,w,h);           // sea
    const zoom=view.k/view.minK*.8;                           // 1 at the opening view
    ctx.lineJoin='round';ctx.lineCap='round';
    ctx.beginPath();trace(paths.land,true);ctx.fillStyle='#5f8a63';ctx.fill();
    ctx.strokeStyle='#7fae7f';ctx.lineWidth=1;ctx.stroke();
    ctx.beginPath();trace(paths.lakes,true);ctx.fillStyle='#16435f';ctx.fill();   // lakes are water
    ctx.beginPath();trace(paths.rivers,false);ctx.strokeStyle='rgba(86,160,214,.85)';ctx.lineWidth=Math.min(1.6,.6+zoom*.15);ctx.stroke();
    ctx.beginPath();trace(paths.borders,false);ctx.strokeStyle='rgba(235,240,230,.55)';ctx.lineWidth=.8;ctx.setLineDash([4,3]);ctx.stroke();ctx.setLineDash([]);
    if(zoom>=1.4){
      ctx.beginPath();trace(paths.major,false);ctx.strokeStyle='rgba(247,200,106,.9)';ctx.lineWidth=Math.min(2.2,.7+zoom*.12);ctx.stroke();
    }
    if(zoom>=4){
      ctx.beginPath();trace(paths.secondary,false);ctx.strokeStyle='rgba(255,236,190,.65)';ctx.lineWidth=.8;ctx.stroke();
    }
    // Labels
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.font='600 '+Math.round(11+Math.min(4,zoom))+'px system-ui,"Noto Sans TC",sans-serif';
    for(const [name,lon,lat,rank] of asiaMapData.countries){
      if(rank>(zoom>=2.5?9:zoom>=1.4?5:3)) continue;
      const x=sx(mx(lon)),y=sy(my(lat));if(x<-40||y<-20||x>w+40||y>h+20) continue;
      ctx.strokeStyle='rgba(6,20,30,.8)';ctx.lineWidth=3;ctx.strokeText(name,x,y);
      ctx.fillStyle='rgba(240,248,255,.92)';ctx.fillText(name,x,y);
    }
    if(zoom>=2){
      ctx.font='500 10px system-ui,sans-serif';
      for(const [name,lon,lat] of asiaMapData.cities){
        const x=sx(mx(lon)),y=sy(my(lat));if(x<0||y<0||x>w||y>h) continue;
        ctx.fillStyle='rgba(255,255,255,.85)';ctx.beginPath();ctx.arc(x,y,2,0,7);ctx.fill();
        ctx.strokeStyle='rgba(6,20,30,.8)';ctx.lineWidth=2.5;ctx.strokeText(name,x,y-8);ctx.fillStyle='#fff';ctx.fillText(name,x,y-8);
      }
    }
    // Game airports + selected route
    const list=typeof allAirports!=='undefined'?allAirports.filter(a=>!a.carrier&&a.lat!==undefined):[];
    const dep=list.find(a=>a.code===selected('departure')),dst=list.find(a=>a.code===selected('destination'));
    if(dep&&dst&&dep!==dst){
      const pts=greatCircle(dep,dst);
      ctx.beginPath();pts.forEach(([x,y],i)=>i?ctx.lineTo(sx(x),sy(y)):ctx.moveTo(sx(x),sy(y)));
      ctx.strokeStyle='#ff9d3d';ctx.lineWidth=2.4;ctx.setLineDash([8,5]);ctx.stroke();ctx.setLineDash([]);
    }
    ctx.font='700 11px system-ui,sans-serif';
    for(const a of list){
      const x=sx(mx(a.lon)),y=sy(my(a.lat));if(x<-20||y<-20||x>w+20||y>h+20) continue;
      const hot=a===dep||a===dst;
      ctx.beginPath();ctx.arc(x,y,hot?6:3.6,0,7);ctx.fillStyle=hot?'#ff9d3d':'#ffe27a';ctx.fill();
      ctx.strokeStyle='#06141e';ctx.lineWidth=1.4;ctx.stroke();
      if(hot||zoom>=1.6||list.length<14){
        ctx.textAlign='left';ctx.strokeStyle='rgba(6,20,30,.9)';ctx.lineWidth=3;ctx.strokeText(a.code,x+8,y);ctx.fillStyle='#fff';ctx.fillText(a.code,x+8,y);ctx.textAlign='center';
      }
    }
    // Scale bar
    const midLat=Math.atan(Math.sinh(view.cy))/RAD,kmPerPx=(40075*Math.cos(midLat*RAD))/(2*Math.PI*view.k);
    const nice=[10,20,50,100,200,500,1000,2000,3000].find(v=>v/kmPerPx>70)||3000,bar=nice/kmPerPx;
    ctx.fillStyle='rgba(6,20,30,.7)';ctx.fillRect(12,h-34,bar+16,22);ctx.fillStyle='#fff';ctx.fillRect(20,h-18,bar,2);
    ctx.textAlign='left';ctx.font='11px system-ui,sans-serif';ctx.fillText(nice+' km',20,h-26);
  }
  const redraw=()=>{if(!raf) raf=requestAnimationFrame(draw);};
  function resize(){
    if(!overlay||overlay.hidden) return;
    dpr=Math.min(devicePixelRatio||1,2);w=overlay.clientWidth;h=overlay.clientHeight;
    canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);canvas.style.width=w+'px';canvas.style.height=h+'px';
    redraw();
  }
  function zoomAt(px,py,factor){
    const nk=Math.max(view.minK,Math.min(view.minK*120,view.k*factor));
    const wx=view.cx+(px-w/2)/view.k,wy=view.cy-(py-h/2)/view.k;
    view.k=nk;view.cx=wx-(px-w/2)/view.k;view.cy=wy+(py-h/2)/view.k;redraw();
  }
  function build(){
    overlay=document.createElement('div');overlay.id='asiaMapOverlay';overlay.hidden=true;
    overlay.setAttribute('role','dialog');overlay.setAttribute('aria-label','亞洲地圖');
    overlay.style.cssText='position:fixed;inset:0;z-index:2147483000;background:#16435f;touch-action:none;user-select:none';
    canvas=document.createElement('canvas');canvas.style.cssText='display:block;touch-action:none';
    const bar=document.createElement('div');
    bar.style.cssText='position:absolute;top:max(10px,env(safe-area-inset-top));left:10px;right:10px;display:flex;gap:8px;align-items:center;pointer-events:none';
    const btn=(text,label,fn)=>{const b=document.createElement('button');b.type='button';b.textContent=text;b.setAttribute('aria-label',label);
      b.style.cssText='pointer-events:auto;min-width:44px;min-height:44px;border-radius:10px;border:1px solid rgba(255,255,255,.35);background:rgba(6,20,30,.72);color:#fff;font:600 16px system-ui,sans-serif;padding:0 12px';
      b.onclick=fn;return b;};
    info=document.createElement('div');info.style.cssText='flex:1;color:#fff;font:600 13px system-ui,sans-serif;text-shadow:0 1px 3px #000;pointer-events:none';
    info.textContent='亞洲地圖 · 拖曳移動、雙指或滾輪縮放';
    bar.append(btn('✕','關閉亞洲地圖',close),info,btn('＋','放大',()=>zoomAt(w/2,h/2,1.6)),btn('－','縮小',()=>zoomAt(w/2,h/2,1/1.6)),btn('⌂','重設視角',()=>{fit();redraw();}));
    const note=document.createElement('div');
    note.style.cssText='position:absolute;right:10px;bottom:max(8px,env(safe-area-inset-bottom));color:rgba(255,255,255,.7);font:10px system-ui,sans-serif;text-shadow:0 1px 2px #000;pointer-events:none';
    note.textContent='資料：Natural Earth（公有領域）· 公路為主要幹道';
    overlay.append(canvas,bar,note);document.body.append(overlay);
    ctx=canvas.getContext('2d');
    canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});moved=false;pinch=0;});
    canvas.addEventListener('pointermove',e=>{
      const p=pointers.get(e.pointerId);if(!p) return;
      if(pointers.size===1){
        const dx=e.clientX-p.x,dy=e.clientY-p.y;if(Math.abs(dx)+Math.abs(dy)>2) moved=true;
        view.cx-=dx/view.k;view.cy+=dy/view.k;redraw();
      }else if(pointers.size===2){
        p.x=e.clientX;p.y=e.clientY;const [a,b]=[...pointers.values()],d=Math.hypot(a.x-b.x,a.y-b.y);
        if(pinch) zoomAt((a.x+b.x)/2,(a.y+b.y)/2,d/pinch);
        pinch=d;moved=true;
      }
      p.x=e.clientX;p.y=e.clientY;
    });
    const up=e=>{pointers.delete(e.pointerId);pinch=0;};
    canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',up);
    canvas.addEventListener('wheel',e=>{e.preventDefault();zoomAt(e.clientX,e.clientY,Math.exp(-e.deltaY*.0015));},{passive:false});
    canvas.addEventListener('dblclick',e=>zoomAt(e.clientX,e.clientY,2));
    addEventListener('resize',resize);
    addEventListener('keydown',e=>{if(!overlay.hidden&&e.key==='Escape') close();});
  }
  function open(){
    if(typeof asiaMapData==='undefined') return;
    prepare();if(!overlay) build();
    overlay.hidden=false;resize();fit();redraw();
  }
  function close(){if(overlay) overlay.hidden=true;}
  document.addEventListener('click',e=>{if(e.target.closest?.('#openAsiaMap')){e.preventDefault();open();}});
  return {open,close,get ready(){return typeof asiaMapData!=='undefined';}};
})();
if(typeof module!=='undefined') module.exports={asiaMap};
