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
  let curCol=0,curRow=0,curLx=0,curLz=0;

  // Tiny reused 8x8 offscreen canvas for zero-GC blank/white placeholder tile detection
  let whiteCheckCanvas=null, whiteCheckCtx=null;
  function isBlankWhiteTile(img){
    if(!img||typeof document==='undefined') return false;
    try{
      if(!whiteCheckCanvas){
        whiteCheckCanvas=document.createElement('canvas');
        whiteCheckCanvas.width=8; whiteCheckCanvas.height=8;
        whiteCheckCtx=whiteCheckCanvas.getContext('2d',{willReadFrequently:true});
      }
      if(!whiteCheckCtx||typeof whiteCheckCtx.getImageData!=='function') return false;
      whiteCheckCtx.clearRect(0,0,8,8);
      whiteCheckCtx.drawImage(img,0,0,8,8);
      const d=whiteCheckCtx.getImageData(0,0,8,8).data;
      let nearWhite=0, opaque=0;
      let sumR=0, sumG=0, sumB=0, sumSqR=0, sumSqG=0, sumSqB=0;
      for(let i=0;i<256;i+=4){
        const r=d[i], g=d[i+1], b=d[i+2], a=d[i+3];
        if(a<=16) continue;
        opaque++;
        if(r>232&&g>232&&b>232&&Math.abs(r-g)<8&&Math.abs(g-b)<8) nearWhite++;
        sumR+=r; sumG+=g; sumB+=b;
        sumSqR+=r*r; sumSqG+=g*g; sumSqB+=b*b;
      }
      if(opaque===0) return true;
      if(nearWhite/opaque>0.85) return true;
      const mr=sumR/opaque, mg=sumG/opaque, mb=sumB/opaque;
      const varRGB=((sumSqR/opaque-mr*mr)+(sumSqG/opaque-mg*mg)+(sumSqB/opaque-mb*mb))/3;
      if(mr>205&&mg>200&&mb>190&&Math.abs(mr-mg)<16&&Math.abs(mr-mb)<24&&varRGB<3.5) return true;
      return false;
    }catch{
      return false;
    }
  }

  function tilePriority(tile){
    const dx=tile.col-curCol, dz=tile.row-curRow;
    const dist2=dx*dx+dz*dz;
    if(dist2===0) return -1;
    const ahead=(dx*curLx+dz*curLz)/Math.sqrt(dist2);
    return dist2*(ahead>0?(1-0.42*ahead):(1+0.28*Math.abs(ahead)));
  }

  // Zero-stutter throttled GPU upload queue: strictly at most 1 texture commit per animation frame,
  // prioritized closest-first (detailUniforms > midDetailUniforms > closest/forward regional tile)
  const pendingUploads=[];
  let uploadRafId=0;
  function flushOneUpload(){
    uploadRafId=0;
    while(pendingUploads.length){
      let bestIdx=0, bestPrio=Infinity;
      for(let i=0;i<pendingUploads.length;i++){
        const item=pendingUploads[i];
        const p=typeof item.getPriority==='function'?item.getPriority():item.priority;
        if(p<bestPrio){bestPrio=p;bestIdx=i;}
      }
      const [job]=pendingUploads.splice(bestIdx,1);
      if(job.commit()) break;
    }
    if(pendingUploads.length&&typeof requestAnimationFrame==='function'){
      uploadRafId=requestAnimationFrame(flushOneUpload);
    }
  }
  function enqueueUpload(job){
    for(let i=pendingUploads.length-1;i>=0;i--){
      if(pendingUploads[i].key===job.key){
        pendingUploads[i].cancel?.();
        pendingUploads.splice(i,1);
      }
    }
    pendingUploads.push(job);
    if(typeof requestAnimationFrame==='function'){
      if(!uploadRafId) uploadRafId=requestAnimationFrame(flushOneUpload);
    }else{
      flushOneUpload();
    }
  }
  function cancelPendingUpload(key){
    for(let i=pendingUploads.length-1;i>=0;i--){
      if(pendingUploads[i].key===key){
        pendingUploads[i].cancel?.();
        pendingUploads.splice(i,1);
      }
    }
  }

  // Dual-Ring Seamless Close-Up Google Satellite Cascade (ONLY 2 floating GPU textures!):
  // Ring 0: Ultra-Close Detail Clipmap (1,000m @ z=17 ~0.55m/px desktop | 1,200m @ z=16 ~1.1m/px mobile)
  // Ring 1: Mid-Range HD Clipmap (4,800m @ z=15 ~2.3m/px desktop | z=14 mobile)
  const detailSpan=isLowMem?1200:1000;
  const detailUniforms={
    image:{value:null},
    ready:{value:0},
    bounds:{value:new THREE.Vector4(0,0,detailSpan,detailSpan)}
  };
  const midSpan=4800;
  const midDetailUniforms={
    image:{value:null},
    ready:{value:0},
    bounds:{value:new THREE.Vector4(0,0,midSpan,midSpan)}
  };
  let detailPixelMap=null, detailPixelBounds=null;
  let midPixelMap=null, midPixelBounds=null;
  let satSampleCanvas=null, satSampleCtx=null;
  function clipmapHasLand(px,pz,boxSpan){
    if(terrainHeight(px,pz)>=0.15) return true;
    const c0=Math.floor(px/span), r0=Math.floor(pz/span);
    if(chunkHasLand(c0,r0)) return true;
    const half=boxSpan*0.5;
    const seen=new Set([c0+'_'+r0]);
    for(const [cx,cz] of [[px-half,pz-half],[px+half,pz-half],[px-half,pz+half],[px+half,pz+half]]){
      const cc=Math.floor(cx/span), cr=Math.floor(cz/span), k=cc+'_'+cr;
      if(seen.has(k)) continue;
      seen.add(k);
      if(chunkHasLand(cc,cr)) return true;
    }
    return false;
  }
  function createClipmapRing({ringKey,ringPriority,ringSpan,refreshDist,targetZoom,minZoom,dim,uniforms,onPixelMap}){
    let centerX=1e12, centerZ=1e12, ringLoading=false, ringTexture=null, retryAfter=0;
    return function updateRing(px,pz,quality){
      if(quality==='low'||typeof document==='undefined'||typeof Image==='undefined'||typeof latLon!=='function') return;
      if(ringLoading||Math.hypot(px-centerX,pz-centerZ)<refreshDist) return;
      if(retryAfter&&Date.now()<retryAfter) return;
      if(typeof terrainHeight==='function'&&!clipmapHasLand(px,pz,ringSpan)) return;
      ringLoading=true;
      const x0=px-ringSpan*0.5, z0=pz-ringSpan*0.5;
      const nw=latLon(x0,z0), se=latLon(x0+ringSpan,z0+ringSpan);
      const minLon=Math.min(nw.lon,se.lon), maxLon=Math.max(nw.lon,se.lon);
      const minLat=Math.min(nw.lat,se.lat), maxLat=Math.max(nw.lat,se.lat);
      const lonSpan=Math.max(0.0005,maxLon-minLon), latSpan=Math.max(0.0005,maxLat-minLat);
      let tz=targetZoom;
      let tx0=lonToTileX(minLon,tz), tx1=lonToTileX(maxLon,tz);
      let ty0=latToTileY(maxLat,tz), ty1=latToTileY(minLat,tz);
      while(tz>minZoom&&((tx1-tx0+1)>6||(ty1-ty0+1)>6)){
        tz--;
        tx0=lonToTileX(minLon,tz); tx1=lonToTileX(maxLon,tz);
        ty0=latToTileY(maxLat,tz); ty1=latToTileY(minLat,tz);
      }
      const canvas=document.createElement('canvas');
      canvas.width=dim; canvas.height=dim;
      const ctx=canvas.getContext('2d');
      if(!ctx){ringLoading=false;return;}
      ctx.clearRect(0,0,dim,dim);
      ctx.imageSmoothingEnabled=true;
      try{ctx.imageSmoothingQuality='high';}catch{}
      const jobs=[], n=1<<tz;
      const midTx=(tx0+tx1)*0.5, midTy=(ty0+ty1)*0.5;
      for(let ty=ty0;ty<=ty1;ty++){
        if(ty<0||ty>=n) continue;
        for(let tx=tx0;tx<=tx1;tx++){
          const d2=(tx-midTx)*(tx-midTx)+(ty-midTy)*(ty-midTy);
          jobs.push({tx:((tx%n)+n)%n,rawTx:tx,ty,d2});
        }
      }
      if(!jobs.length){ringLoading=false;return;}
      jobs.sort((a,b)=>a.d2-b.d2);
      let rem=jobs.length, ok=0;
      const doneOne=()=>{
        rem--;
        if(rem>0) return;
        ringLoading=false;
        if(ok===0){retryAfter=Date.now()+6000;return;}
        retryAfter=0;
        centerX=px; centerZ=pz;
        // Capture crisp 64x64 pixel buffer for 3-tier cascading 3D ground clutter & scenery classification
        try{
          if(!satSampleCanvas){
            satSampleCanvas=document.createElement('canvas');
            satSampleCanvas.width=64; satSampleCanvas.height=64;
            satSampleCtx=satSampleCanvas.getContext('2d',{willReadFrequently:true});
          }
          if(satSampleCtx&&typeof satSampleCtx.getImageData==='function'){
            satSampleCtx.clearRect(0,0,64,64);
            satSampleCtx.drawImage(canvas,0,0,64,64);
            onPixelMap(satSampleCtx.getImageData(0,0,64,64).data,{x0,z0,span:ringSpan});
            if(typeof window!=='undefined') window.__SKYBOUND_SAT_REVISION=(window.__SKYBOUND_SAT_REVISION||0)+1;
          }
        }catch{}
        enqueueUpload({
          key:ringKey,
          priority:ringPriority,
          commit:()=>{
            const tex=new THREE.CanvasTexture(canvas);
            tex.colorSpace=THREE.SRGBColorSpace;
            if(THREE.ClampToEdgeWrapping!==undefined){
              tex.wrapS=THREE.ClampToEdgeWrapping;
              tex.wrapT=THREE.ClampToEdgeWrapping;
            }
            tex.anisotropy=Math.min(16,renderer.capabilities.getMaxAnisotropy());
            tex.needsUpdate=true;
            if(ringTexture) ringTexture.dispose();
            ringTexture=tex;
            uniforms.image.value=tex;
            uniforms.bounds.value.set(x0,z0,ringSpan,ringSpan);
            uniforms.ready.value=1;
            onLoaded();
            return true;
          }
        });
      };
      for(const job of jobs){
        const img=new Image();
        img.crossOrigin='anonymous';
        img.referrerPolicy='no-referrer';
        let fb=false;
        img.onload=()=>{
          if(isBlankWhiteTile(img)){
            if(!fb){fb=true;img.src=`https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${tz}/${job.ty}/${job.tx}`;return;}
            doneOne();
            return;
          }
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
    };
  }
  const updateRing0Clipmap=createClipmapRing({
    ringKey:'ring0',
    ringPriority:-2000,
    ringSpan:detailSpan,
    refreshDist:isLowMem?380:280,
    targetZoom:isLowMem?16:17,
    minZoom:12,
    dim:isLowMem?512:1024,
    uniforms:detailUniforms,
    onPixelMap:(data,bounds)=>{detailPixelMap=data;detailPixelBounds=bounds;}
  });
  const updateMidDetailClipmap=createClipmapRing({
    ringKey:'ring1',
    ringPriority:-1000,
    ringSpan:midSpan,
    refreshDist:1300,
    targetZoom:isLowMem?14:15,
    minZoom:11,
    dim:isLowMem?512:1024,
    uniforms:midDetailUniforms,
    onPixelMap:(data,bounds)=>{midPixelMap=data;midPixelBounds=bounds;}
  });
  function updateDetailClipmap(px,pz,quality){
    updateRing0Clipmap(px,pz,quality);
    updateMidDetailClipmap(px,pz,quality);
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
  function samplePixelBuffer(buf,bounds,x,z){
    if(!buf||!bounds) return null;
    const dx=x-bounds.x0, dz=z-bounds.z0, ds=bounds.span;
    if(dx<0||dx>=ds||dz<0||dz>=ds) return null;
    const u=Math.max(0,Math.min(63,Math.floor((dx/ds)*64)));
    const v=Math.max(0,Math.min(63,Math.floor((dz/ds)*64)));
    const idx=(v*64+u)*4;
    if(buf[idx+3]<=32) return null;
    return {r:buf[idx],g:buf[idx+1],b:buf[idx+2],a:buf[idx+3]};
  }
  if(typeof window!=='undefined'){
    window.__SKYBOUND_SAT_REVISION=0;
    window.__SKYBOUND_SAT_SAMPLER=(x,z)=>{
      // 3-Tier Cascade: Ring 0 (1km ~15m/px) -> Ring 1 (4.8km ~75m/px) -> Ring 2 Regional (11.5km ~180m/px)
      const ring0=samplePixelBuffer(detailPixelMap,detailPixelBounds,x,z);
      if(ring0) return ring0;
      const ring1=samplePixelBuffer(midPixelMap,midPixelBounds,x,z);
      if(ring1) return ring1;
      const col=Math.floor(x/span), row=Math.floor(z/span);
      const pm=satPixelMaps.get(col+'_'+row);
      if(!pm) return null;
      const u=Math.max(0,Math.min(63,Math.floor(((x-col*span)/span)*64)));
      const v=Math.max(0,Math.min(63,Math.floor(((z-row*span)/span)*64)));
      const idx=(v*64+u)*4;
      if(pm[idx+3]<=32) return null;
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
    // 4-ring regional LOD cascade out to ~100 km horizon (Ring 0 z=17 & Ring 1 z=15 handled by floating clipmaps!)
    let tz=variant==='high'?(isLowMem?12:14):variant==='mid'?(isLowMem?11:12):variant==='low'?11:11;
    const maxSpan=variant==='high'?(isLowMem?4:5):variant==='mid'?(isLowMem?3:4):variant==='low'?3:2;
    let tx0=lonToTileX(minLon,tz), tx1=lonToTileX(maxLon,tz);
    let ty0=latToTileY(maxLat,tz), ty1=latToTileY(minLat,tz);
    while(tz>7&&((tx1-tx0+1)>maxSpan||(ty1-ty0+1)>maxSpan)){
      tz--;
      tx0=lonToTileX(minLon,tz); tx1=lonToTileX(maxLon,tz);
      ty0=latToTileY(maxLat,tz); ty1=latToTileY(minLat,tz);
    }
    const dim=variant==='high'?(isLowMem?512:1024):variant==='mid'?(isLowMem?256:512):variant==='low'?(isLowMem?256:384):256;
    const canvas=document.createElement('canvas');
    canvas.width=dim; canvas.height=dim;
    const ctx=canvas.getContext('2d');
    if(!ctx){done(null);return;}
    // Keep unloaded or skipped blank sub-tiles transparent (alpha=0) with zero edge seams between adjacent 11.5km grid tiles
    ctx.clearRect(0,0,dim,dim);
    ctx.imageSmoothingEnabled=true;
    try{ctx.imageSmoothingQuality='high';}catch{}
    const jobs=[];
    const n=1<<tz;
    const midTx=(tx0+tx1)*0.5, midTy=(ty0+ty1)*0.5;
    for(let ty=ty0;ty<=ty1;ty++){
      if(ty<0||ty>=n) continue;
      for(let tx=tx0;tx<=tx1;tx++){
        const d2=(tx-midTx)*(tx-midTx)+(ty-midTy)*(ty-midTy);
        jobs.push({tx:((tx%n)+n)%n,rawTx:tx,ty,d2});
      }
    }
    if(!jobs.length){done(null);return;}
    jobs.sort((a,b)=>a.d2-b.d2);
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
          const maxPixelMaps=isLowMem?48:160;
          while(satPixelMaps.size>maxPixelMaps){satPixelMaps.delete(satPixelMaps.keys().next().value);}
          if(typeof window!=='undefined') window.__SKYBOUND_SAT_REVISION=(window.__SKYBOUND_SAT_REVISION||0)+1;
        }
      }catch{}
      done(canvas);
    };
    for(const job of jobs){
      const img=new Image();
      img.crossOrigin='anonymous';
      img.referrerPolicy='no-referrer';
      let triedFallback=false;
      img.onload=()=>{
        if(isBlankWhiteTile(img)){
          if(!triedFallback){
            triedFallback=true;
            img.src=`https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${tz}/${job.ty}/${job.tx}`;
            return;
          }
          finishOne();
          return;
        }
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
    const maxConcurrent=isLowMem?4:8;
    while(loading<maxConcurrent&&queue.length){
      const [tile,variant]=queue.shift();
      if(tile.variant!==variant||tile.loading) continue;
      loading++;
      tile.loading=true;
      if(tile.isGlobal){
        loadGlobalGoogleTile(tile,variant,canvas=>{
          if(canvas&&tiles.get(tile.key)===tile&&tile.variant===variant){
            tile.pendingVariant=variant;
            enqueueUpload({
              key:tile.key,
              getPriority:()=>tilePriority(tile),
              cancel:()=>{if(tile.pendingVariant===variant) tile.pendingVariant=null;},
              commit:()=>{
                if(tile.pendingVariant===variant) tile.pendingVariant=null;
                if(tiles.get(tile.key)!==tile||tile.variant!==variant) return false;
                const texture=new THREE.CanvasTexture(canvas);
                texture.colorSpace=THREE.SRGBColorSpace;
                if(THREE.ClampToEdgeWrapping!==undefined){
                  texture.wrapS=THREE.ClampToEdgeWrapping;
                  texture.wrapT=THREE.ClampToEdgeWrapping;
                }
                texture.anisotropy=Math.min(16,renderer.capabilities.getMaxAnisotropy());
                texture.needsUpdate=true;
                tile.texture?.dispose();
                tile.loadedVariant=variant;
                tile.texture=tile.image.value=texture;
                tile.ready.value=1;
                onLoaded();
                return true;
              }
            });
          }
          finish(tile,variant);
        });
      }else{
        loader.load(satelliteTileURL(tile,variant),texture=>{
          if(tiles.get(tile.key)===tile&&tile.variant===variant){
            tile.pendingVariant=variant;
            enqueueUpload({
              key:tile.key,
              getPriority:()=>tilePriority(tile),
              cancel:()=>{
                if(tile.pendingVariant===variant) tile.pendingVariant=null;
                texture.dispose();
              },
              commit:()=>{
                if(tile.pendingVariant===variant) tile.pendingVariant=null;
                if(tiles.get(tile.key)!==tile||tile.variant!==variant){
                  texture.dispose();
                  return false;
                }
                texture.colorSpace=THREE.SRGBColorSpace;
                texture.anisotropy=Math.min(16,renderer.capabilities.getMaxAnisotropy());
                tile.texture?.dispose();
                tile.loadedVariant=variant;
                tile.texture=tile.image.value=texture;
                tile.ready.value=1;
                onLoaded();
                return true;
              }
            });
          }else texture.dispose();
          finish(tile,variant);
        },undefined,()=>finish(tile,variant));
      }
    }
  }
  function finish(tile,variant){
    loading--;
    tile.loading=false;
    if(tiles.get(tile.key)===tile&&tile.variant&&tile.variant!==variant){
      queue.push([tile,tile.variant]);
      queue.sort((a,b)=>tilePriority(a[0])-tilePriority(b[0]));
    }
    process();
  }
  function update(col,row,quality,lookX=0,lookZ=0){
    const lookLen=Math.hypot(lookX,lookZ)||1;
    const lx=lookX/lookLen, lz=lookZ/lookLen;
    curCol=col; curRow=row; curLx=lx; curLz=lz;
    const dirBucket=Math.round(Math.atan2(lookX,lookZ)*2);
    const id=col+':'+row+':'+quality+':'+dirBucket;
    if(id===location) return;
    location=id;
    queue=[];
    const candidates=[];
    // Desktop high/ultra streams 4 regional satellite rings out to ~92-100 km radius; mobile stays capped to prevent OOM!
    const rad=isLowMem?(quality==='low'?2:3):(quality==='low'?3:quality==='balanced'?5:quality==='satellite'?7:8);
    const imageryRadiusSquared=quality==='ultra'?13:quality==='high'?8:2;
    for(let z=row-rad;z<=row+rad;z++){
      for(let x=col-rad;x<=col+rad;x++){
        const key=x+'_'+z;
        const dx=x-col, dz=z-row;
        const dist2=dx*dx+dz*dz;
        const inCatalog=catalog.has(key)&&dist2<=imageryRadiusSquared;
        const isGlobal=!catalog.has(key)&&quality!=='low'&&dist2<=rad*rad+4&&chunkHasLand(x,z);
        if(!inCatalog&&!isGlobal) continue;
        // Forward-biased closest-first priority: load tiles nearest & directly in front of you FIRST!
        const ahead=(dx*lx+dz*lz)/(Math.sqrt(dist2)||1);
        const priority=dist2===0?-1:dist2*(ahead>0?(1-0.42*ahead):(1+0.28*Math.abs(ahead)));
        candidates.push({key,x,z,isGlobal,distance:dist2,priority});
      }
    }
    candidates.sort((a,b)=>a.priority-b.priority);
    const maxGlobal=isLowMem?20:(quality==='ultra'?160:quality==='high'?128:quality==='satellite'?88:48);
    let globalCount=0;
    const trimmed=candidates.filter(c=>!c.isGlobal||(globalCount++<maxGlobal));
    const active=new Set(trimmed.map(c=>c.key));
    for(const [key,tile] of tiles){
      if(active.has(key)) continue;
      cancelPendingUpload(key);
      tile.pendingVariant=null;
      tile.texture?.dispose();
      tile.material.dispose();
      tiles.delete(key);
    }
    const highTiles=quality==='ultra'?9:quality==='high'?6:quality==='satellite'?5:quality==='balanced'?4:0;
    const effectiveHigh=isLowMem?Math.min(4,highTiles):highTiles;
    trimmed.forEach(({key,x,z,isGlobal,distance},index)=>{
      let tile=tiles.get(key);
      if(!tile){
        tile={key,col:x,row:z,isGlobal,pendingVariant:null,image:{value:null},ready:{value:0},origin:{value:new THREE.Vector2(x*span,z*span)}};
        tile.material=makeMaterial(tile);
        tiles.set(key,tile);
      }
      // 4-ring regional satellite cascade: high (<=17km) -> mid (<=36km) -> low (<=62km) -> horizon (<=100km)
      let variant;
      if(isGlobal){
        if(index<effectiveHigh&&distance<=2&&renderer.capabilities.maxTextureSize>=1152) variant='high';
        else if(distance<=10) variant='mid';
        else if(distance<=29) variant='low';
        else variant='horizon';
      }else{
        variant=distance>imageryRadiusSquared?null:index<effectiveHigh&&renderer.capabilities.maxTextureSize>=1152?'high':'low';
      }
      if(tile.variant!==variant){
        tile.variant=variant;
        if(variant) queue.push([tile,variant]);
        else{
          cancelPendingUpload(key);
          tile.pendingVariant=null;
          tile.ready.value=0;
          tile.texture?.dispose();
          tile.texture=null;
          tile.image.value=null;
        }
      }else if(variant&&(!tile.texture||tile.loadedVariant!==variant)&&tile.pendingVariant!==variant&&!tile.loading) queue.push([tile,variant]);
    });
    queue.sort((a,b)=>tilePriority(a[0])-tilePriority(b[0]));
    process();
  }
  return {update,updateDetailClipmap,updateMidDetailClipmap,detailUniforms,midDetailUniforms,material:(col,row)=>tiles.get(col+'_'+row)?.material};
}
