'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const idx=JSON.parse(fs.readFileSync('dist/world-city/index.json','utf8'));
const provenance=JSON.parse(fs.readFileSync('dist/world-city/pilot-provenance.json','utf8'));
for(const [code,n] of [['MY_KUL',6184],['ID_CGK',17260]]){
 const reg=idx.regions[code],tiles=idx.tiles.filter(t=>t[4]===reg.id);let count=0;
 for(const t of tiles){const d=JSON.parse(fs.readFileSync('dist/world-city/'+t[0]+'.json','utf8'));assert.equal(d.r,reg.id);
  for(const b of d.b){count++;assert(b[2]>=3&&b[2]<=600);assert(b[5].length>=6&&b[5].every(Number.isFinite));}
 }
 assert.equal(count,n);assert.equal(provenance.regions[code].buildings.length,n);
 const c=reg.counts;assert.equal(c.taggedHeight+c.levelsDerivedHeight+c.estimatedHeight,n);
}
const context={console,Math,Number,Array,Object,String,Map,Set,Uint16Array,atob:s=>Buffer.from(s,'base64').toString('binary')};vm.createContext(context);
for(const f of ['elevation','physics','regional-elevation','region','pilot-elevation'])vm.runInContext(fs.readFileSync('dist/'+f+'.js','utf8'),context);
for(const code of ['WMKK','WIII']){const a=context.allAirports.find(a=>a.code===code);assert(a&&a.length>3000);assert(Math.abs(context.regionalHeight(a.x,a.z)-a.elevation)<1);}
for(const [lat,lon] of [[3.155,101.7075],[-6.175,106.825]]){const p=context.geoPoint(lat,lon);assert(Number.isFinite(context.pilotTerrainHeight(p.x,p.z)));}
for(const reg of vm.runInContext('internationalRegions',context)){assert(reg.center&&reg.bounds.every(Number.isFinite));}
console.log('Pilot cities: 23,444 footprints, height provenance, DEM samples and both airport surfaces passed');
