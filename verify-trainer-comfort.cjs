const fs=require('fs'),vm=require('vm'),assert=require('assert');
for(const file of ['elevation','physics','regional-elevation','kinmen-elevation','region','fleet','benchmarks','operations'])vm.runInThisContext(fs.readFileSync('dist/'+file+'.js','utf8'),{filename:file});
const ap=allAirports.find(a=>a.code==='RCTP'),p=fleet.find(p=>p.id==='c172s');assert.equal(aircraftFastKmh(p),800);
for(const wind of [0,25,-25]){
 const f=makeRegionalFlight(ap,ap,p,'air',0,regionalRoute(ap,ap));Object.assign(f,{x:ap.x,y:ap.elevation+400,z:ap.z,ground:false,airborne:true,heading:0,bank:0,fastCruise:true,vx:wind,vz:-350,vy:-2,windVector:{x:wind,z:0}});
 const before=flightSpeeds(f).ias*3.6;const a={x:f.x,z:f.z};stepTrainer(f,{roll:0,pitch:0,rudder:0,trim:0,throttle:0});const s=flightSpeeds(f);assert(before>1000);assert(s.ias*3.6<=800.5,s.ias*3.6);assert(Math.abs((f.x-a.x)/simTick-f.vx)<.001);assert(Math.abs((f.z-a.z)/simTick-f.vz)<.001);assert(Math.abs(f.vx-wind)<.1);assert.equal(f.buffet,0);console.log('wind',wind,'IAS',s.ias*3.6,'GS',s.gs*3.6);
}
const f=makeRegionalFlight(ap,ap,p,'air',0,regionalRoute(ap,ap));Object.assign(f,{x:ap.x,z:ap.z,y:ap.elevation+500,ground:false,airborne:true,fastCruise:true,power:1,hold:{heading:ap.heading,altitude:ap.elevation+500}});
let peak=0;for(let i=0;i<120*120&&!f.ended;i++){const c=cruiseControls(f);stepTrainer(f,{roll:0,rudder:0,trim:0,...c});peak=Math.max(peak,flightSpeeds(f).ias*3.6);}
console.log('cruise',flightSpeeds(f).ias*3.6,'peak',peak,'ended',f.ended);assert(!f.ended);assert(peak<=801);assert(flightSpeeds(f).ias*3.6>=700);
// The relaxed envelope belongs only to game training; ordinary hard landings stay unchanged.
for(const training of [true,false]){
 const land=makeRegionalFlight(ap,ap,p,'air',0,regionalRoute(ap,ap));Object.assign(land,{ground:false,airborne:true,x:ap.x,z:ap.z,y:ap.elevation+p.gearHeight+.015,vx:Math.sin(ap.heading)*30,vz:-Math.cos(ap.heading)*30,vy:-6,pitch:0,bank:0,heading:ap.heading,shortMission:training?{assistedLanding:true}:null});stepTrainer(land,{roll:0,pitch:0,rudder:0,trim:0,throttle:0});assert.equal(land.landed,training);assert.equal(land.ended,!training);
}
console.log('PASS C172 real airspeed envelope, wind-relative displacement, no injected buffet, 700–800 cruise and training-only landing tolerance.');
