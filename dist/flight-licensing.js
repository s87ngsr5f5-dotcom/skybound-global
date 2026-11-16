'use strict';
// Game qualifications only. Career inventory and each run receipt commit together.
const FlightLicensing=(()=>{
 const ratings=[
  {id:'private',name:'私人飛行駕照',exam:20,requires:null,desc:'教練機起飛、三航點、穩定飛行與返場。'},
  {id:'commercial',name:'商用飛行駕照',exam:21,requires:'private',desc:'噴射機航線、限速與平穩返場。'},
  {id:'instrument',name:'儀表飛行資格',exam:22,requires:'commercial',desc:'低能見度航點導航與精準落地。'},
  {id:'tactical',name:'戰術飛行資格',exam:23,requires:'private',desc:'戰機限速轉彎、導航與返場。'}
 ];
 const has=id=>!id||Boolean(readCareer().licenses?.[id]);
 const name=id=>ratings.find(r=>r.id===id)?.name||'無駕照要求';
 const access=ch=>has(ch.requiredLicense);
 const rewardLabel=ch=>ch.grantLicense?'通過取得 '+name(ch.grantLicense):ch.rewardAircraft?'首通解鎖 '+(fleet.find(p=>p.id===ch.rewardAircraft)?.name||ch.rewardAircraft):'金幣 '+ch.rewardMoney.toLocaleString();
 function skillOk(ch,f){
  const speed=(typeof flightSpeeds==='function'?flightSpeeds(f).ias:(f.speed||0))*3.6;
  const agl=f.y-(typeof terrainHeight==='function'?terrainHeight(f.x,f.z):0);
  const turn=ch.skill==='turn',bank=Math.abs(f.bank||0),g=Math.abs(f.g??f.gForce??1);
  return !f.ground&&!f.ended&&speed>=ch.speedBand[0]&&speed<=ch.speedBand[1]&&agl>=ch.aglBand[0]&&agl<=ch.aglBand[1]&&g<=ch.maxSafeG&&Math.abs(f.pitch||0)<.18&&(turn?bank>=.349&&bank<=.785:bank<.18);
 }
 function landingOk(ch,f,st){
  return !f.ended&&f.ground&&st.wasAirborne&&st.nearAirport&&Math.hypot(f.vx||0,f.vz||0)<3&&!!f.touchdown&&Number.isFinite(f.touchdown.verticalSpeed)&&Math.abs(f.touchdown.verticalSpeed)<=ch.maxSink;
 }
 function build(base){
  const data=[
   [20,'EXAM.01','私人駕照考試','c172s','RCSS',null,'private',12000,'0','09:00',18000,'level',45,true,null],
   [21,'EXAM.02','商用駕照考試','b38m','RCTP','private','commercial',22000,'0','10:00',30000,'level',75,true,null],
   [22,'EXAM.03','儀表資格考試','a223','RCKH','commercial','instrument',30000,'fog','17:00',30000,'level',90,true,null],
   [23,'EXAM.04','戰術資格考試','sf16','RCYU','private','tactical',25000,'0','11:00',42000,'turn',35,true,null],
   [24,'PPL.01','澎湖島嶼導航','c172s','RCQC','private',null,18000,'0','16:00',20000,'level',60,false,null],
   [25,'PPL.02','松山側風返場','c172s','RCSS','private',null,24000,'5.144','10:00',18000,'level',45,true,null],
   [26,'PPL.03','桃園晨間巡航','da40','RCTP','private',null,22000,'clouds','06:00',22000,'level',70,false,null],
   [27,'CPL.01','747 機長甄選','b744','RCTP','commercial',null,38000,'0','13:00',36000,'level',90,true,'b744'],
   [28,'CPL.02','香港海岸調度','b773','VHHH','commercial',null,46000,'clouds','15:00',36000,'level',90,false,null],
   [29,'CPL.03','樟宜夜間返場','sa380','WSSS','commercial',null,54000,'0','21:00',36000,'level',75,true,null],
   [30,'IFR.01','777F 低能見度返場','b77f','RCTP','instrument',null,58000,'fog','17:30',36000,'level',90,true,'b77f'],
   [31,'IFR.02','安托諾夫重型機甄選','an124','RCTP','instrument',null,65000,'5.144','07:00',38000,'level',105,true,'an124'],
   [32,'IFR.03','成田雨後精準進場','b789','RJAA','instrument',null,72000,'wet','19:00',36000,'level',105,true,null],
   [33,'TAC.01','花蓮戰術轉彎航線','sf16','RCYU','tactical',null,38000,'0','10:00',44000,'turn',45,false,null],
   [34,'TAC.02','幻象海岸返場','m2000','RCYU','tactical',null,52000,'5.144','16:00',42000,'turn',40,true,null],
   [35,'TAC.03','雄貓夜航甄選','f14b','RCYU','tactical',null,60000,'0','20:00',44000,'turn',50,true,'f14b']
  ];
  return data.map(([id,code,title,aircraft,departure,requiredLicense,grantLicense,rewardMoney,weather,time,objectiveDistM,skill,skillDuration,finishLanding,rewardAircraft])=>{
   const tactical=requiredLicense==='tactical'||grantLicense==='tactical',basic=grantLicense==='private'||requiredLicense==='private'&&grantLicense!=='commercial'&&grantLicense!=='tactical';
   const ch={...base,id,code,title,aircraft,departure,destination:departure,requiredLicense,grantLicense,rewardMoney,rewardAircraft,weather,time,objectiveDistM,skill,skillDuration,finishLanding,localCircuit:true,licensedMission:true,isExam:!!grantLicense,lesson:'free',startType:'runway',rewardXp:grantLicense?450:320,parTimeS:600,durationLabel:'約 5–10 分鐘',maxSafeG:tactical?5:basic?2.5:2,maxSink:basic?3:2.5,speedBand:tactical?[450,1100]:basic?[95,250]:[220,650],aglBand:tactical?[250,3000]:basic?[120,1400]:[200,2400]};
   ch.image=tactical?'assets/campaign/ch6.jpg':basic?'assets/campaign/ch1.jpg':'assets/campaign/ch2.jpg';
   ch.subtitle=grantLicense?'飛行資格考試':name(requiredLicense)+'專屬任務';
   ch.skillLabel=`${skill==='turn'?'20–45° 轉彎':'平穩飛行'}累計 ${skillDuration} 秒 · IAS ${ch.speedBand.join('–')} km/h · 離地 ${ch.aglBand.join('–')} m`;
   ch.story=`依序通過三個航點，再完成${ch.skillLabel}。${finishLanding?'返場落地，下降率不超過 '+ch.maxSink+' m/s，對正跑道並停住。':'保持飛行至訓練完成。'}全程過載不超過 ${ch.maxSafeG}G。`;
   ch.targetText='三航點 → 操控檢定'+(finishLanding?' → 返場停住':'');ch.radio=[{delay:2,speaker:grantLicense?'考試教官':'任務中心',text:ch.story}];
   const passed=(f,st)=>!f.ended&&st.gatesPassed>=3&&st.stableS>=skillDuration&&st.maxG<=ch.maxSafeG;
   ch.stages=[1,2,3].map(i=>({label:'通過航點 '+i,check:(f,st)=>!f.ended&&st.gatesPassed>=i}));
   ch.stages.push({label:ch.skillLabel,check:(f,st)=>passed(f,st)});
   if(finishLanding)ch.stages.push({label:'返場落地，下降率 ≤ '+ch.maxSink+' m/s 並停住',check:(f,st)=>landingOk(ch,f,st)});
   ch.winCondition=(f,st)=>passed(f,st)&&(finishLanding?landingOk(ch,f,st):!f.ground);
   return ch;
  });
 }
 function failure(ch,f,st){
  if(st.maxG>ch.maxSafeG)return '操縱過載 '+st.maxG.toFixed(1)+'G，超過本關 '+ch.maxSafeG+'G。請重試。';
  if(ch.finishLanding&&f.landed&&st.wasAirborne&&f.touchdown&&Math.abs(f.touchdown.verticalSpeed)>ch.maxSink)return '落地下降率超過 '+ch.maxSink+' m/s。請減小下降率後重試。';
  return null;
 }
 function award(ch,st,money,f){
  if(!access(ch)||!st.runId||!f||!ch.winCondition(f,st))return {ok:false,message:'資格或完成條件未達成'};
  const c=readCareer();c.licenseReceipts??={};
  if(c.licenseReceipts[st.runId])return {ok:true,already:true,money:0,license:null};
  if(ch.grantLicense)(c.licenses??={})[ch.grantLicense]={earnedAt:new Date().toISOString(),exam:ch.id};
  if(ch.rewardAircraft)(c.owned??={})[ch.rewardAircraft]=true;
  c.money+=money;c.licenseReceipts[st.runId]={mission:ch.id,money,license:ch.grantLicense||null,aircraft:ch.rewardAircraft||null,time:new Date().toISOString()};
  try{localStorage.setItem(careerKey,JSON.stringify(c));}catch{return {ok:false,message:'無法儲存獎勵；請保留本頁並重試結算。'};}
  try{localStorage.setItem('skybound.money',String(c.money));}catch{}
  if(typeof window!=='undefined')window.dispatchEvent(new Event('skybound:commerce-change'));
  return {ok:true,money,license:ch.grantLicense?name(ch.grantLicense):null};
 }
 function render(stage){stage.innerHTML=`<section class="control-guide license-school"><h2>飛行駕照</h2><p>遊戲內資格，不代表真實航空執照。原有任務仍可直接玩。</p><div class="store-grid">${ratings.map(r=>`<article><h3>${r.name}</h3><strong>${has(r.id)?'已取得':'未取得'}</strong><p>${r.desc}</p><p>先修：${r.requires?name(r.requires):'無'} · 首通金幣獎勵</p><button data-chapter-id="${r.exam}" ${has(r.requires)?'':'disabled'}>${has(r.id)?'再次挑戰':'查看考試'}</button></article>`).join('')}</div><p>已取得的資格會保存在目前瀏覽器。進階任務獎品與要求請見任務列表。</p></section>`;}
 return {ratings,has,name,access,rewardLabel,build,skillOk,landingOk,failure,award,render};
})();
