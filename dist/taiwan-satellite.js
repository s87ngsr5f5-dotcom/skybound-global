'use strict';

let taiwanAtlas;
function loadTaiwanAtlas(){
  return taiwanAtlas??=new THREE.TextureLoader().loadAsync('satellite/overview.webp').then(texture=>{
    texture.colorSpace=THREE.SRGBColorSpace;
    document.getElementById('satelliteCredit').hidden=false;
    return texture;
  });
}
function satelliteTileURL(tile,variant){
  if(taiwanSatelliteData.baked.includes(tile.key)){
    return 'satellite/'+tile.key+(variant==='low'?'-low':'')+'.webp';
  }
  const {x,y:z}=tile.origin.value;
  const northwest=latLon(x,z), southeast=latLon(x+11520,z+11520);
  const size=variant==='high'?1152:288;
  const query=new URLSearchParams({
    service:'WMS',request:'GetMap',version:'1.3.0',
    layers:'esa-worldcover-s2rgbnir-10m-2021-v2_tcc',styles:'default',format:'image/jpeg',
    crs:'EPSG:4326',time:'2021-01-01',width:size,height:size,
    bbox:[southeast.lat,northwest.lon,northwest.lat,southeast.lon].map(value=>value.toFixed(9)).join(',')
  });
  return 'https://titiler.terrascope.be/wms?'+query;
}
function createTaiwanSatellite(makeMaterial,renderer,onLoaded){
  const span=11520, catalog=new Set(taiwanSatelliteData.tiles);
  const tiles=new Map(), loader=new THREE.TextureLoader();
  const isLowMem=typeof navigator!=='undefined'&&(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent||'')||(navigator.deviceMemory&&navigator.deviceMemory<=4));
  let location='',queue=[],loading=0;

  // Single Floating Ultra-HD z=15 Close-Up Clipmap Satellite Patch (2,400m x 2,400m, ~2.3m/px, ONLY 1 GPU texture!)
  const detailSpan=2400;
  const detailUniforms={
    image:{value:null},
    ready:{value:0},
    bounds:{value:new THREE.Vector4(0,0,detailSpan,detailSpan)}
  };
  let detailCenterX=1e12, detailCenterZ=1e12, detailLoading=false, detailTexture=null;
  function updateDetailClipmap(px,pz,quality){
    if(quality==='low'||typeof document==='undefined'||typeof Image==='undefined'||typeof latLon!=='function') return;
    // Skip inside Taipei's native 10m Sentinel-2 box
    if(px>-18000&&px<18000&&pz>-16000&&pz<15000){detailUniforms.ready.value=0;return;}
    if(detailLoading||Math.hypot(px-detailCenterX,pz-detailCenterZ)<780) return;
    if(typeof terrainHeight==='function'&&terrainHeight(px,pz)<0.15&&!chunkHasLand(Math.floor(px/span),Math.floor(pz/span))) return;
    detailLoading=true;
    const x0=px-detailSpan*0.5, z0=pz-detailSpan*0.5;
    const nw=latLon(x0,z0), se=latLon(x0+detailSpan,z0+detailSpan);
    const minLon=Math.min(nw.lon,se.lon), maxLon=Math.max(nw.lon,se.lon);
    const minLat=Math.min(nw.lat,se.lat), maxLat=Math.max(nw.lat,se.lat);
    const lonSpan=Math.max(0.002,maxLon-minLon), latSpan=Math.max(0.002,maxLat-minLat);
    let tz=isLowMem?14:15;
    let tx0=lonToTileX(minLon,tz), tx1=lonToTileX(maxLon,tz);
    let ty0=latToTileY(maxLat,tz), ty1=latToTileY(minLat,tz);
    while(tz>12&&((tx1-tx0+1)>5||(ty1-ty0+1)>5)){
      tz--;
      tx0=lonToTileX(minLon,tz); tx1=lonToTileX(maxLon,tz);
      ty0=latToTileY(maxLat,tz); ty1=latToTileY(minLat,tz);
    }
    const dim=isLowMem?512:1024;
    const canvas=document.createElement('canvas');
    canvas.width=dim; canvas.height=dim;
    const ctx=canvas.getContext('2d');
    if(!ctx){detailLoading=false;return;}
    ctx.clearRect(0,0,dim,dim);
    ctx.imageSmoothingEnabled=true;
    try{ctx.imageSmoothingQuality='high';}catch{}
    const jobs=[], n=1<<tz;
    for(let ty=ty0;ty<=ty1;ty++){
      if(ty<0||ty>=n) continue;
      for(let tx=tx0;tx<=tx1;tx++) jobs.push({tx:((tx%n)+n)%n,rawTx:tx,ty});
    }
    if(!jobs.length){detailLoading=false;return;}
    let rem=jobs.length, ok=0;
    const doneOne=()=>{
      rem--;
      if(rem>0) return;
      detailLoading=false;
      if(ok===0) return;
      const tex=new THREE.CanvasTexture(canvas);
      tex.colorSpace=THREE.SRGBColorSpace;
      tex.anisotropy=Math.min(16,renderer.capabilities.getMaxAnisotropy());
      tex.needsUpdate=true;
      if(detailTexture) detailTexture.dispose();
      detailTexture=tex;
      detailCenterX=px; detailCenterZ=pz;
      detailUniforms.image.value=tex;
      detailUniforms.bounds.value.set(x0,z0,detailSpan,detailSpan);
      detailUniforms.ready.value=1;
      onLoaded();
    };
    for(const job of jobs){
      const img=new Image();
      img.crossOrigin='anonymous';
      img.referrerPolicy='no-referrer';
      let fb=false;
      img.onload=()=>{
        const tLonL=tileXToLon(job.rawTx,tz), tLonR=tileXToLon(job.rawTx+1,tz);
        const tLatT=tileYToLat(job.ty,tz), tLatB=tileYToLat(job.ty+1,tz);
        const u0=((tLonL-minLon)/lonSpan)*dim, u1=((tLonR-minLon)/lonSpan)*dim;
        const v0=((maxLat-tLatT)/latSpan)*dim, v1=((maxLat-tLatB)/latSpan)*dim;
        try{ctx.drawImage(img,u0,v0,(u1-u0)+0.8,(v1-v0)+0.8);ok++;}catch{}
        doneOne();
      };
      img.onerror=()=>{
        if(!fb){fb=true;img.src=`https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${tz}/${job.ty}/${job.tx}`;}
        else doneOne();
      };
      img.src=`https://mt${(job.tx+job.ty)&3}.google.com/vt/lyrs=s&x=${job.tx}&y=${job.ty}&z=${tz}`;
    }
  }

  function lonToTileX(lon,z){return Math.floor(((lon+180)/360)*(1<<z));}
  function latToTileY(lat,z){
    const r=Math.max(-85,Math.min(85,lat))*Math.PI/180;
    return Math.floor((1-Math.log(Math.tan(r)+1/Math.cos(r))/Math.PI)*0.5*(1<<z));
  }
  function tileXToLon(tx,z){return (tx/(1<<z))*360-180;}
  function tileYToLat(ty,z){
    const n=Math.PI-(2*Math.PI*ty)/(1<<z);
    return (180/Math.PI)*Math.atan(0.5*(Math.exp(n)-Math.exp(-n)));
  }
  const satPixelMaps=new Map();
  let satSampleCanvas=null, satSampleCtx=null;
  if(typeof window!=='undefined'){
    window.__SKYBOUND_SAT_REVISION=0;
    window.__SKYBOUND_SAT_SAMPLER=(x,z)=>{
      const col=Math.floor(x/span), row=Math.floor(z/span);
      const pm=satPixelMaps.get(col+'_'+row);
      if(!pm) return null;
      const u=Math.max(0,Math.min(63,Math.floor(((x-col*span)/span)*64)));
      const v=Math.max(0,Math.min(63,Math.floor(((z-row*span)/span)*64)));
      const idx=(v*64+u)*4;
      return {r:pm[idx],g:pm[idx+1],b:pm[idx+2],a:pm[idx+3]};
    };
  }
  function chunkHasLand(col,row){
    const x0=col*span,z0=row*span;
    // 3x3 grid catches narrow peninsulas, straits, islands & bays (e.g. San Francisco Bay, Hong Kong, Manhattan)
    for(let gy=0;gy<3;gy++){
      for(let gx=0;gx<3;gx++){
        const px=x0+span*(0.12+gx*0.38), pz=z0+span*(0.12+gy*0.38);
        if(typeof terrainHeight==='function'&&terrainHeight(px,pz)>0.2) return true;
        if(typeof latLon==='function'&&typeof WorldAtlas!=='undefined'&&WorldAtlas.countryAt){
          const ll=latLon(px,pz);
          if(WorldAtlas.countryAt(ll.lon,ll.lat)) return true;
        }
      }
    }
    return false;
  }
  function loadGlobalGoogleTile(tile,variant,done){
    if(typeof document==='undefined'||typeof Image==='undefined'||typeof latLon!=='function'){done(null);return;}
    const {x:x0,y:z0}=tile.origin.value;
    const nw=latLon(x0,z0), se=latLon(x0+span,z0+span);
    const minLon=Math.min(nw.lon,se.lon), maxLon=Math.max(nw.lon,se.lon);
    const minLat=Math.min(nw.lat,se.lat), maxLat=Math.max(nw.lat,se.lat);
    const lonSpan=Math.max(0.005,maxLon-minLon), latSpan=Math.max(0.005,maxLat-minLat);
    // Memory-safe 3 LOD rings (ultra-sharp z=15 detail is handled by the single floating detailClipmap texture!)
    let tz=variant==='high'?(isLowMem?12:13):variant==='low'?11:10;
    const maxSpan=variant==='high'?(isLowMem?4:5):variant==='low'?3:2;
    let tx0=lonToTileX(minLon,tz), tx1=lonToTileX(maxLon,tz);
    let ty0=latToTileY(maxLat,tz), ty1=latToTileY(minLat,tz);
    while(tz>7&&((tx1-tx0+1)>maxSpan||(ty1-ty0+1)>maxSpan)){
      tz--;
      tx0=lonToTileX(minLon,tz); tx1=lonToTileX(maxLon,tz);
      ty0=latToTileY(maxLat,tz); ty1=latToTileY(minLat,tz);
    }
    const dim=variant==='high'?(isLowMem?512:768):variant==='low'?(isLowMem?256:512):256;
    const canvas=document.createElement('canvas');
    canvas.width=dim; canvas.height=dim;
    const ctx=canvas.getContext('2d');
    if(!ctx){done(null);return;}
    ctx.clearRect(0,0,dim,dim);
    ctx.imageSmoothingEnabled=true;
    try{ctx.imageSmoothingQuality='high';}catch{}
    const jobs=[];
    const n=1<<tz;
    for(let ty=ty0;ty<=ty1;ty++){
      if(ty<0||ty>=n) continue;
      for(let tx=tx0;tx<=tx1;tx++){
        jobs.push({tx:((tx%n)+n)%n,rawTx:tx,ty});
      }
    }
    if(!jobs.length){done(null);return;}
    let remaining=jobs.length, loadedCount=0;
    const finishOne=()=>{
      remaining--;
      if(remaining>0) return;
      if(loadedCount===0){done(null);return;}
      // Capture lightweight 64x64 color lookup so 3D scenery aligns trees/buildings/water to actual Google Satellite pixels!
      try{
        if(!satSampleCanvas){
          satSampleCanvas=document.createElement('canvas');
          satSampleCanvas.width=64; satSampleCanvas.height=64;
          satSampleCtx=satSampleCanvas.getContext('2d',{willReadFrequently:true});
        }
        if(satSampleCtx&&typeof satSampleCtx.getImageData==='function'){
          satSampleCtx.clearRect(0,0,64,64);
          satSampleCtx.drawImage(canvas,0,0,64,64);
          satPixelMaps.set(tile.key,satSampleCtx.getImageData(0,0,64,64).data);
          while(satPixelMaps.size>64){satPixelMaps.delete(satPixelMaps.keys().next().value);}
          if(typeof window!=='undefined') window.__SKYBOUND_SAT_REVISION=(window.__SKYBOUND_SAT_REVISION||0)+1;
        }
      }catch{}
      const texture=new THREE.CanvasTexture(canvas);
      texture.colorSpace=THREE.SRGBColorSpace;
      texture.anisotropy=Math.min(16,renderer.capabilities.getMaxAnisotropy());
      texture.needsUpdate=true;
      done(texture);
    };
    for(const job of jobs){
      const img=new Image();
      img.crossOrigin='anonymous';
      img.referrerPolicy='no-referrer';
      let triedFallback=false;
      img.onload=()=>{
        const tLonL=tileXToLon(job.rawTx,tz), tLonR=tileXToLon(job.rawTx+1,tz);
        const tLatT=tileYToLat(job.ty,tz), tLatB=tileYToLat(job.ty+1,tz);
        const u0=((tLonL-minLon)/lonSpan)*dim;
        const u1=((tLonR-minLon)/lonSpan)*dim;
        const v0=((maxLat-tLatT)/latSpan)*dim;
        const v1=((maxLat-tLatB)/latSpan)*dim;
        try{
          ctx.drawImage(img,u0,v0,(u1-u0)+0.8,(v1-v0)+0.8);
          loadedCount++;
        }catch{}
        finishOne();
      };
      img.onerror=()=>{
        if(!triedFallback){
          triedFallback=true;
          img.src=`https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${tz}/${job.ty}/${job.tx}`;
        }else finishOne();
      };
      img.src=`https://mt${(job.tx+job.ty)&3}.google.com/vt/lyrs=s&x=${job.tx}&y=${job.ty}&z=${tz}`;
    }
  }

  function process(){
    const maxConcurrent=isLowMem?4:6;
    while(loading<maxConcurrent&&queue.length){
      const [tile,variant]=queue.shift();
      if(tile.variant!==variant||tile.loading) continue;
      loading++;
      tile.loading=true;
      if(tile.isGlobal){
        loadGlobalGoogleTile(tile,variant,texture=>{
          if(texture&&tiles.get(tile.key)===tile&&tile.variant===variant){
            tile.texture?.dispose();
            tile.loadedVariant=variant;
            tile.texture=tile.image.value=texture;
            tile.ready.value=1;
            onLoaded();
          }else if(texture) texture.dispose();
          finish(tile,variant);
        });
      }else{
        loader.load(satelliteTileURL(tile,variant),texture=>{
          if(tiles.get(tile.key)===tile&&tile.variant===variant){
            texture.colorSpace=THREE.SRGBColorSpace;
            texture.anisotropy=Math.min(16,renderer.capabilities.getMaxAnisotropy());
            tile.texture?.dispose();
            tile.loadedVariant=variant;
            tile.texture=tile.image.value=texture;
            tile.ready.value=1;
            onLoaded();
          }else texture.dispose();
          finish(tile,variant);
        },undefined,()=>finish(tile,variant));
      }
    }
  }
  function finish(tile,variant){
    loading--;
    tile.loading=false;
    if(tiles.get(tile.key)===tile&&tile.variant&&tile.variant!==variant) queue.unshift([tile,tile.variant]);
    process();
  }
  function update(col,row,quality,lookX=0,lookZ=0){
    const dirBucket=Math.round(Math.atan2(lookX,lookZ)*2);
    const id=col+':'+row+':'+quality+':'+dirBucket;
    if(id===location) return;
    location=id;
    queue=[];
    const active=new Set(), candidates=[];
    const rad=isLowMem?(quality==='low'?2:3):(quality==='low'?3:quality==='balanced'?4:5);
    const lookLen=Math.hypot(lookX,lookZ)||1;
    const lx=lookX/lookLen, lz=lookZ/lookLen;
    for(let z=row-rad;z<=row+rad;z++){
      for(let x=col-rad;x<=col+rad;x++){
        const key=x+'_'+z;
        const dx=x-col, dz=z-row;
        const dist2=dx*dx+dz*dz;
        const inCatalog=catalog.has(key);
        const isGlobal=!inCatalog&&quality!=='low'&&dist2<=rad*rad+2&&chunkHasLand(x,z);
        if(!inCatalog&&!isGlobal) continue;
        active.add(key);
        // Forward-biased priority: load tiles in your line of sight FIRST!
        const ahead=(dx*lx+dz*lz)/(Math.sqrt(dist2)||1);
        const priority=dist2*(ahead>0?(1-0.38*ahead):(1+0.25*Math.abs(ahead)));
        candidates.push({key,x,z,isGlobal,distance:dist2,priority});
      }
    }
    for(const [key,tile] of tiles){
      if(active.has(key)) continue;
      tile.texture?.dispose();
      tile.material.dispose();
      tiles.delete(key);
    }
    candidates.sort((a,b)=>a.priority-b.priority);
    const maxGlobal=isLowMem?20:42;
    const trimmed=candidates.filter((c,i)=>!c.isGlobal||i<maxGlobal);
    const highTiles=quality==='ultra'?9:quality==='high'?6:quality==='satellite'?5:quality==='balanced'?4:0;
    const effectiveHigh=isLowMem?Math.min(4,highTiles):highTiles;
    trimmed.forEach(({key,x,z,isGlobal,distance},index)=>{
      let tile=tiles.get(key);
      if(!tile){
        tile={key,isGlobal,image:{value:null},ready:{value:0},origin:{value:new THREE.Vector2(x*span,z*span)}};
        tile.material=makeMaterial(tile);
        tiles.set(key,tile);
      }
      // Keep a low-resolution middle ring between the local imagery and far horizon imagery.
      const imageryRadiusSquared=quality==='ultra'?13:quality==='high'?8:2;
      let variant;
      if(isGlobal){
        variant=index<effectiveHigh&&distance<=2&&renderer.capabilities.maxTextureSize>=1152?'high':distance<=10?'low':'horizon';
      }else{
        variant=distance>imageryRadiusSquared?null:index<effectiveHigh&&renderer.capabilities.maxTextureSize>=1152?'high':'low';
      }
      if(tile.variant!==variant){
        tile.variant=variant;
        if(variant) queue.push([tile,variant]);
        else{
          tile.ready.value=0;
          tile.texture?.dispose();
          tile.texture=null;
          tile.image.value=null;
        }
      }else if(variant&&(!tile.texture||tile.loadedVariant!==variant)&&!tile.loading) queue.push([tile,variant]);
    });
    process();
  }
  return {update,updateDetailClipmap,detailUniforms,material:(col,row)=>tiles.get(col+'_'+row)?.material};
}
