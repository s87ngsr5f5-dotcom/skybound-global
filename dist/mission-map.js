'use strict';
// WGS84 route overlay. Fetch only tiles visible in the current human-selected preview.
const MissionRouteMap=(()=>{
 const tileSize=256,cache=new Map();let resizeWatch;
 const provider=globalThis.skyboundMapProvider||{url:'https://tile.openstreetmap.org/{z}/{x}/{y}.png'};
 function world(ll,z){const lat=Math.max(-85.05112878,Math.min(85.05112878,ll.lat))*Math.PI/180,s=tileSize*2**z;return {x:(ll.lon+180)/360*s,y:(1-Math.log(Math.tan(lat)+1/Math.cos(lat))/Math.PI)/2*s};}
 function inverse(p,z){const s=tileSize*2**z;return {lon:p.x/s*360-180,lat:Math.atan(Math.sinh(Math.PI*(1-2*p.y/s)))*180/Math.PI};}
 function fit(points,w,h){
  let z=13;for(;z>3;z--){const a=points.map(p=>world(p,z));if(Math.max(...a.map(p=>p.x))-Math.min(...a.map(p=>p.x))<=w-120&&Math.max(...a.map(p=>p.y))-Math.min(...a.map(p=>p.y))<=h-90)break;}
  const a=points.map(p=>world(p,z)),x=(Math.min(...a.map(p=>p.x))+Math.max(...a.map(p=>p.x)))/2,y=(Math.min(...a.map(p=>p.y))+Math.max(...a.map(p=>p.y)))/2;
  return {z,x,y,left:x-w/2,top:y-h/2};
 }
 function tile(z,x,y,redraw){
  const n=2**z;if(y<0||y>=n)return null;x=(x%n+n)%n;const key=z+'/'+x+'/'+y;
  let e=cache.get(key);if(e){cache.delete(key);cache.set(key,e);if(e.state==='loading')e.listeners.add(redraw);return e;}
  const image=new Image();e={image,state:'loading',listeners:new Set([redraw])};cache.set(key,e);
  const done=state=>{e.state=state;for(const f of e.listeners)f();e.listeners.clear();};image.onload=()=>done('ready');image.onerror=()=>done('error');
  image.referrerPolicy='strict-origin-when-cross-origin';image.src=provider.url.replace('{z}',z).replace('{x}',x).replace('{y}',y);
  while(cache.size>64){const oldest=cache.keys().next().value;cache.get(oldest).listeners.clear();cache.delete(oldest);}
  return e;
 }
 function draw(canvas,ch,dep,dst,gates){
  if(!canvas||typeof canvas.getContext!=='function'||!dep)return;
  const ctx=canvas.getContext('2d');if(!ctx)return;resizeWatch?.disconnect();
  const pts=[dep,...gates,dst].filter(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.z));if(pts.length<2)return;
  const ll=pts.map(p=>latLon(p.x,p.z)),w=Math.max(280,Math.round(canvas.clientWidth||480)),h=220,dpr=Math.min(globalThis.devicePixelRatio||1,2);
  canvas.width=Math.round(w*dpr);canvas.height=h*dpr;const view=fit(ll,w,h),token={};canvas._mapToken=token;
  const project=p=>{const q=world(latLon(p.x,p.z),view.z);return [q.x-view.left,q.y-view.top];};
  const center=inverse(view,view.z);Object.assign(canvas.dataset||{},{mapCenterLat:center.lat.toFixed(6),mapCenterLon:center.lon.toFixed(6),mapZoom:String(view.z),routePoints:String(pts.length)});
  // Local georeferenced terrain is a resilient fallback; it never pretends to be downloaded OSM.
  const fallback=document.createElement('canvas');fallback.width=w;fallback.height=h;const fc=fallback.getContext('2d');
  fc.fillStyle='#264a5c';fc.fillRect(0,0,w,h);
  const tw=center.lat>=21.5&&center.lat<=26.5&&center.lon>=117&&center.lon<=123.5;
  if(typeof WorldAtlas!=='undefined'&&typeof WorldAtlas.drawVectorWorld==='function'){
   WorldAtlas.drawVectorWorld(fc,(lon,lat)=>{const q=world({lat,lon},view.z);return [q.x-view.left,q.y-view.top];},w,h,{showLabels:view.z<=4});
  }
  if(tw&&typeof regionalHeight==='function')for(let py=0;py<h;py+=7)for(let px=0;px<w;px+=7){const g=inverse({x:view.left+px,y:view.top+py},view.z),p=geoPoint(g.lat,g.lon),e=regionalHeight(p.x,p.z);fc.fillStyle=e<2?'#264a5c':e<180?'#b1bb8b':e<900?'#81996f':'#657d61';fc.fillRect(px,py,7,7);}
  function label(text,x,y,color){ctx.font='bold 12px system-ui';const width=ctx.measureText(text).width;const tx=Math.max(5,Math.min(w-width-12,x)),ty=Math.max(20,Math.min(h-34,y));ctx.fillStyle='rgba(10,25,34,.9)';ctx.fillRect(tx-4,ty-14,width+8,20);ctx.fillStyle=color;ctx.fillText(text,tx,ty);}
  function paint(){
   if(canvas._mapToken!==token||canvas.isConnected===false)return;
   ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);ctx.drawImage(fallback,0,0);
   let loaded=0,failed=0;
   if(provider.url)for(let y=Math.floor(view.top/tileSize);y<=Math.floor((view.top+h-1)/tileSize);y++)for(let x=Math.floor(view.left/tileSize);x<=Math.floor((view.left+w-1)/tileSize);x++){
    const e=tile(view.z,x,y,paint);if(e?.state==='ready'){ctx.drawImage(e.image,x*tileSize-view.left,y*tileSize-view.top,tileSize,tileSize);loaded++;}else if(e?.state==='error')failed++;
   }
   if(canvas.dataset)canvas.dataset.mapSource=loaded?'openstreetmap':tw?'local-terrain':'route-only';
   // Dark under-stroke keeps the exact same route visible over roads and forests.
   ctx.beginPath();pts.forEach((p,i)=>{const [x,y]=project(p);i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.lineJoin='round';ctx.lineWidth=6;ctx.strokeStyle='#092c46';ctx.stroke();ctx.lineWidth=3;ctx.strokeStyle='#42cbff';ctx.stroke();
   for(let i=0;i<pts.length-1;i++){const a=project(pts[i]),b=project(pts[i+1]),dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);if(len<20)continue;const x=(a[0]+b[0])/2,y=(a[1]+b[1])/2,ang=Math.atan2(dy,dx);ctx.save();ctx.translate(x,y);ctx.rotate(ang);ctx.beginPath();ctx.moveTo(5,0);ctx.lineTo(-4,-4);ctx.lineTo(-4,4);ctx.closePath();ctx.fillStyle='#c8f1ff';ctx.fill();ctx.restore();}
   gates.forEach((g,i)=>{const [x,y]=project(g);ctx.beginPath();ctx.arc(x,y,9,0,Math.PI*2);ctx.fillStyle='#ffce63';ctx.fill();ctx.lineWidth=2;ctx.strokeStyle='#19343e';ctx.stroke();ctx.font='bold 12px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#11212c';ctx.fillText(String(i+1),x,y);ctx.textAlign='left';ctx.textBaseline='alphabetic';});
   const [dx,dy]=project(dep),same=dep.code===dst?.code;ctx.beginPath();ctx.arc(dx,dy,7,0,Math.PI*2);ctx.fillStyle='#47e1bc';ctx.fill();ctx.strokeStyle='#143b36';ctx.lineWidth=2;ctx.stroke();label(dep.code+(same?' 起終點':' 起飛'),dx+11,dy+21,'#bbffe8');
   if(dst&&!same){const [x,y]=project(dst);ctx.beginPath();ctx.arc(x,y,7,0,Math.PI*2);ctx.fillStyle='#ffce63';ctx.fill();ctx.stroke();label(dst.code+' 抵達',x+11,y-9,'#ffe4ad');}
   label('北 ↑',w-43,23,'#f7fcff');
   const mpp=156543.03392*Math.cos(center.lat*Math.PI/180)/2**view.z,raw=mpp*80,power=10**Math.floor(Math.log10(raw)),metres=[1,2,5,10].map(v=>v*power).filter(v=>v<=raw).pop()||power;
   ctx.strokeStyle='#152e3e';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(14,h-17);ctx.lineTo(14+metres/mpp,h-17);ctx.stroke();ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.stroke();label(metres>=1000?metres/1000+' km':metres+' m',16,h-25,'#fff');
   const state=document.getElementById('missionMapState');if(state)state.textContent=loaded?(failed?'部分底圖未載入':'真實地圖 · 航點依實際座標'):(failed?(tw?'底圖暫不可用 · 顯示本地地形':'底圖暫不可用 · 保留航線'):(tw?'地圖載入中 · 暫顯本地地形':'地圖載入中 · 暫顯航線'));
  }
  paint();
  if(typeof ResizeObserver!=='undefined'){
   let previous=w;
   resizeWatch=new ResizeObserver(()=>{const next=Math.round(canvas.clientWidth);if(next>0&&Math.abs(next-previous)>8){previous=next;draw(canvas,ch,dep,dst,gates);}});resizeWatch.observe(canvas);
  }
 }
 return {world,inverse,fit,draw};
})();
