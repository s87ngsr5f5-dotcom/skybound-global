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
  let location='',queue=[],loading=0;

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
  function chunkHasLand(col,row){
    const x0=col*span,z0=row*span;
    const pts=[[x0+span*.5,z0+span*.5],[x0+span*.15,z0+span*.15],[x0+span*.85,z0+span*.15],[x0+span*.15,z0+span*.85],[x0+span*.85,z0+span*.85]];
    for(const [px,pz] of pts){
      if(typeof terrainHeight==='function'&&terrainHeight(px,pz)>0.25) return true;
      if(typeof latLon==='function'&&typeof WorldAtlas!=='undefined'&&WorldAtlas.countryAt){
        const ll=latLon(px,pz);
        if(WorldAtlas.countryAt(ll.lon,ll.lat)) return true;
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
    let tz=variant==='high'?13:11;
    let tx0=lonToTileX(minLon,tz), tx1=lonToTileX(maxLon,tz);
    let ty0=latToTileY(maxLat,tz), ty1=latToTileY(minLat,tz);
    while(tz>6&&((tx1-tx0+1)>4||(ty1-ty0+1)>4)){
      tz--;
      tx0=lonToTileX(minLon,tz); tx1=lonToTileX(maxLon,tz);
      ty0=latToTileY(maxLat,tz); ty1=latToTileY(minLat,tz);
    }
    const dim=variant==='high'?512:256;
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
    while(loading<4&&queue.length){
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
  function update(col,row,quality){
    const id=col+':'+row+':'+quality;
    if(id===location) return;
    location=id;
    queue=[];
    const active=new Set(), candidates=[];
    for(let z=row-3;z<=row+3;z++){
      for(let x=col-3;x<=col+3;x++){
        const key=x+'_'+z;
        const inCatalog=catalog.has(key);
        const isGlobal=!inCatalog&&quality!=='low'&&chunkHasLand(x,z);
        if(!inCatalog&&!isGlobal) continue;
        active.add(key);
        candidates.push({key,x,z,isGlobal,distance:(x-col)**2+(z-row)**2});
      }
    }
    for(const [key,tile] of tiles){
      if(active.has(key)) continue;
      tile.texture?.dispose();
      tile.material.dispose();
      tiles.delete(key);
    }
    candidates.sort((a,b)=>a.distance-b.distance);
    const highTiles=quality==='ultra'?9:quality==='high'?6:quality==='satellite'?5:quality==='balanced'?4:0;
    candidates.forEach(({key,x,z,isGlobal,distance},index)=>{
      let tile=tiles.get(key);
      if(!tile){
        tile={key,isGlobal,image:{value:null},ready:{value:0},origin:{value:new THREE.Vector2(x*span,z*span)}};
        tile.material=makeMaterial(tile);
        tiles.set(key,tile);
      }
      // Keep a low-resolution middle ring between the local imagery and island atlas.
      const imageryRadiusSquared=quality==='ultra'?13:quality==='high'?8:2;
      const variant=distance>imageryRadiusSquared?null:index<highTiles&&renderer.capabilities.maxTextureSize>=1152?'high':'low';
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
  return {update,material:(col,row)=>tiles.get(col+'_'+row)?.material};
}
