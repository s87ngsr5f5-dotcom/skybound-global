const fs=require('fs'),vm=require('vm'),assert=require('assert');
vm.runInThisContext(fs.readFileSync('dist/mission-map.js','utf8'));
for(const ll of [{lat:25.069,lon:121.55},{lat:23.56,lon:119.62},{lat:35.77,lon:140.39},{lat:1.35,lon:103.99}]){
 for(const z of [3,8,13]){const p=MissionRouteMap.world(ll,z),back=MissionRouteMap.inverse(p,z);assert(Math.abs(back.lat-ll.lat)<1e-8);assert(Math.abs(back.lon-ll.lon)<1e-8);}
}
const points=[{lat:25.069,lon:121.55},{lat:25.08,lon:121.6},{lat:25.11,lon:121.63}];
for(const w of [280,480,820]){const f=MissionRouteMap.fit(points,w,220);for(const ll of points){const p=MissionRouteMap.world(ll,f.z);assert(p.x-f.left>=45&&p.x-f.left<=w-45);assert(p.y-f.top>=35&&p.y-f.top<=185);}const a=MissionRouteMap.world(points[0],f.z),b=MissionRouteMap.world(points[2],f.z);assert(b.x>a.x&&b.y<a.y);}
for(const n of ['index.html','iphone.html']){const s=fs.readFileSync('dist/'+n,'utf8');assert(s.indexOf('mission-map.js')<s.indexOf('campaign-story.js'));assert(s.includes('aircraft-v077-180.png'));}
console.log('PASS real-map projection, WGS84 round trips, north/east orientation, phone/desktop route fit and script ordering.');

require('./verify-asia-map.cjs');
