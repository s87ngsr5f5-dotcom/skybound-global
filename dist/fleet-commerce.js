'use strict';
// One career document holds balance, ownership and receipt for each store item.
const FleetCommerce=(()=>{
 const planes={b38m:220000,b773:290000,b744:320000,sf748:340000,an124:400000,sa380:380000,b789:310000,a359:300000,b77f:340000,concorde:390000};
 const paints=[
  {id:'aurora',name:'極光青紫',price:18000,primary:'#153b51',accent:'#78e0b8',tail:'#644f96',text:'#315c72',label:'AURORA AIR'},
  {id:'sunset',name:'夕照銅金',price:22000,primary:'#482e29',accent:'#ffad67',tail:'#8b442d',text:'#733b2c',label:'HORIZON AIR'},
  {id:'polar',name:'冰川藍銀',price:26000,primary:'#164d72',accent:'#c8e9f4',tail:'#507e9a',text:'#164d72',label:'POLAR SKY'},
  {id:'nightgold',name:'夜航黑金',price:36000,primary:'#20252d',accent:'#e4bd70',tail:'#161d27',text:'#9d793c',label:'SKYBOUND ELITE'}
 ];
 const kits=[{id:'comfort',name:'客艙舒適套件',price:38000,desc:'飛行中因操縱造成的舒適度損失減少 25%；重落地扣分不變。'},
 {id:'groundcrew',name:'地勤快速登機套件',price:48000,desc:'完成空橋連接後，登機與下機速度增加 30%。'}];
 for(const p of fleet)if(planes[p.id]){p.purchasePrice=planes[p.id];hangarPrices[p.id]=planes[p.id];}
 let previewTheme=null;
 function owned(id){return Boolean(readCareer().owned?.[id]);}
 function paintOwned(id){return !paints.some(p=>p.id===id)||Boolean(readCareer().storePaints?.[id]);}
 function kitOwned(id){return Boolean(readCareer().storeKits?.[id]);}
 function purchase(kind,id){
  if(!['plane','paint','kit'].includes(kind))return {ok:false,message:'無效商品類型'};
  const item=kind==='plane'?fleet.find(p=>p.id===id&&p.purchasePrice):kind==='paint'?paints.find(p=>p.id===id):kits.find(p=>p.id===id);
  if(!item)return {ok:false,message:'找不到商品'};
  const c=readCareer(),key=kind==='plane'?'owned':kind==='paint'?'storePaints':'storeKits';
  if(c[key]?.[id])return {ok:true,already:true,message:'已擁有，不重複扣款'};
  const price=kind==='plane'?item.purchasePrice:item.price;
  if(c.money<price)return {ok:false,message:'還差 '+(price-c.money).toLocaleString()+' 金幣'};
  c.money-=price;(c[key]??={})[id]=true;
  (c.storeReceipts??={})[kind+':'+id]={price,time:new Date().toISOString()};
  try{localStorage.setItem(careerKey,JSON.stringify(c));}catch{return {ok:false,message:'無法儲存，未完成購買'};}
  try{localStorage.setItem('skybound.money',String(c.money));}catch{}
  if(typeof window!=='undefined')window.dispatchEvent(new Event('skybound:commerce-change'));
  return {ok:true,message:'已購買 · '+(item.name||id)};
 }
 function preview(planeId,theme){previewTheme=theme||null;window.dispatchEvent(new CustomEvent('skybound:shop-preview',{detail:{planeId,theme:previewTheme}}));}
 function paintDisplay(){return previewTheme;}
 let shopFilter='all';
 function renderShop(stage){
  const c=readCareer();
  const storePlanes=fleet.filter(p=>p.purchasePrice);
  const filteredPlanes=storePlanes.filter(p=>shopFilter==='all'||(shopFilter==='passenger'&&p.role==='passenger')||(shopFilter==='cargo'&&p.role==='cargo')||(shopFilter==='owned'&&owned(p.id)));
  const showPlanes=['all','passenger','cargo','owned'].includes(shopFilter)&&filteredPlanes.length>0;
  const showPaints=['all','paints','owned'].includes(shopFilter);
  const showKits=['all','kits','owned'].includes(shopFilter);
  const tabs=[
   ['all','🌟 全部商品'],
   ['passenger','✈️ 民航客機 ('+storePlanes.filter(p=>p.role==='passenger').length+')'],
   ['cargo','📦 貨運巨無霸 ('+storePlanes.filter(p=>p.role==='cargo').length+')'],
   ['paints','🎨 機隊塗裝 ('+paints.length+')'],
   ['kits','🛠 載客套件 ('+kits.length+')'],
   ['owned','✅ 已擁有']
  ];
  stage.innerHTML=`<section class="control-guide fleet-store"><h2>機庫商店</h2><p>餘額 ${c.money.toLocaleString()} 遊戲金幣 · 買下永久自由使用；任務提供指定機試飛。</p>
  <div class="mp-room-chips" style="margin:10px 0 14px">${tabs.map(([id,label])=>`<button type="button" class="mp-chip${shopFilter===id?' active':''}" data-shop-tab="${id}">${label}</button>`).join('')}</div>
  ${showPlanes?`<h3>購買飛機</h3><div class="store-grid">${filteredPlanes.map(p=>`<article><h4>${p.name}</h4><p>${p.type}</p><strong>${p.purchasePrice.toLocaleString()} 金幣</strong><p>${p.id==='b773'?'獨立 777 精細模型、可查看客艙':p.id==='sf748'?'獨立 747 貨機模型、機鼻貨門與貨艙':p.id==='an124'?'獨立大型運輸機模型、機鼻與坡道':'可操作機型、近距離機庫檢視'}</p><div class="actions"><button data-store-preview="${p.id}">3D 檢視</button><button data-store-trial="${p.id}">短程試飛</button>${p.role==='passenger'?`<button data-store-passenger="${p.id}">完整載客</button>`:''}<button data-store-kind="plane" data-store-id="${p.id}" ${owned(p.id)||c.money<p.purchasePrice?'disabled':''}>${owned(p.id)?'已擁有':'購買'}</button></div></article>`).join('')}</div>`:''}
  ${showPaints?`<h3>塗裝 · 購買後全機隊可用</h3><div class="store-grid">${paints.filter(p=>shopFilter!=='owned'||paintOwned(p.id)).map(p=>`<article><div class="paint-swatch" style="--paint-primary:${p.primary};--paint-accent:${p.accent};--paint-tail:${p.tail}" aria-label="${p.name}色票"></div><h4>${p.name}</h4><strong>${p.price.toLocaleString()} 金幣</strong><div class="actions"><button data-store-paint-preview="${p.id}">3D 預覽</button><button data-store-kind="paint" data-store-id="${p.id}" ${paintOwned(p.id)||c.money<p.price?'disabled':''}>${paintOwned(p.id)?'已擁有':'購買塗裝'}</button>${paintOwned(p.id)?`<button data-store-equip="${p.id}">套用</button>`:''}</div></article>`).join('')}</div>`:''}
  ${showKits?`<h3>載客改裝 · 全機隊套用</h3><div class="store-grid">${kits.filter(p=>shopFilter!=='owned'||kitOwned(p.id)).map(p=>`<article><h4>${p.name}</h4><p>${p.desc}</p><strong>${p.price.toLocaleString()} 金幣</strong><button data-store-kind="kit" data-store-id="${p.id}" ${kitOwned(p.id)||c.money<p.price?'disabled':''}>${kitOwned(p.id)?'已安裝':'購買並安裝'}</button></article>`).join('')}</div>`:''}
  <p id="storeFeedback" role="status"></p></section>`;
  stage.querySelectorAll?.('[data-shop-tab]')?.forEach(btn=>{btn.onclick=()=>{shopFilter=btn.dataset.shopTab||'all';renderShop(stage);};});
 }
 if(typeof document!=='undefined')document.addEventListener('click',e=>{
  let b=e.target.closest('[data-store-kind]');if(b){const r=purchase(b.dataset.storeKind,b.dataset.storeId);const out=document.getElementById('storeFeedback')||document.getElementById('commerceFeedback');if(out)out.textContent=r.message;return;}
  b=e.target.closest('[data-store-preview]');if(b){preview(b.dataset.storePreview);return;}
  b=e.target.closest('[data-store-paint-preview]');if(b){preview('b773',b.dataset.storePaintPreview);return;}
  b=e.target.closest('[data-store-equip]');if(b){if(paintOwned(b.dataset.storeEquip)){aircraftSkins.setSelectedTheme(b.dataset.storeEquip);previewTheme=null;window.dispatchEvent(new Event('skybound:commerce-change'));}return;}
  b=e.target.closest('[data-store-passenger]');if(b){window.dispatchEvent(new CustomEvent('skybound:trial-aircraft',{detail:{id:b.dataset.storePassenger,passenger:true}}));return;}
  b=e.target.closest('[data-store-trial]');if(b)window.dispatchEvent(new CustomEvent('skybound:trial-aircraft',{detail:{id:b.dataset.storeTrial}}));
 });
 return {planes,paints,kits,owned,paintOwned,kitOwned,purchase,renderShop,preview,paintDisplay,clearPreview(){previewTheme=null;}};
})();

