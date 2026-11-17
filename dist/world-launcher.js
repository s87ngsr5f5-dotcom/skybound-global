'use strict';
// Free-flight entry: opens on a world map, pick an airport, animated zoom-in, then choose aircraft / time / weather and fly.
// Re-uses the existing hubFf* form controls and the existing "立即起飛" handler, so flight logic is unchanged.
const skyLauncher=(()=>{
  let current=null;
  function css(){
    if(document.getElementById('wlStyle')) return;
    const s=document.createElement('style');s.id='wlStyle';
    s.textContent=`
.wl-root{position:relative;height:clamp(480px,78vh,800px);border-radius:16px;overflow:hidden;border:1px solid rgba(140,200,235,.28);background:#16435f;margin-bottom:12px}
.wl-map{position:absolute;inset:0}
.wl-top{position:absolute;left:10px;right:10px;top:10px;display:flex;flex-direction:column;gap:6px;pointer-events:none;z-index:2;transition:opacity .35s}
.wl-top>*{pointer-events:auto}
.wl-root.wl-entered .wl-top{opacity:0;pointer-events:none}.wl-root.wl-entered .wl-top>*{pointer-events:none}
.wl-title{color:#fff;font:700 15px system-ui,"Noto Sans TC",sans-serif;text-shadow:0 1px 4px #000}
.wl-title small{display:block;font-weight:500;font-size:12px;color:#cfe6f5;margin-top:2px}
.wl-chips{overflow-x:auto;padding-bottom:4px;scrollbar-width:thin}
.wl-chips .mp-room-chips{display:flex;flex-wrap:nowrap;gap:6px}
.wl-chips .mp-chip{flex:0 0 auto;white-space:nowrap;background:rgba(6,20,30,.78);backdrop-filter:blur(3px)}
.wl-zoom{position:absolute;right:10px;bottom:34px;display:flex;flex-direction:column;gap:6px;z-index:2;transition:opacity .35s}
.wl-root.wl-entered .wl-zoom{opacity:0;pointer-events:none}
.wl-btn{min-width:44px;min-height:44px;border-radius:10px;border:1px solid rgba(255,255,255,.35);background:rgba(6,20,30,.78);color:#fff;font:600 16px system-ui,sans-serif;padding:0 12px;cursor:pointer}
.wl-btn:hover{background:rgba(20,50,72,.9)}
.wl-card{position:absolute;left:12px;bottom:12px;width:min(380px,calc(100% - 24px));background:rgba(8,18,28,.93);border:1px solid rgba(140,200,235,.35);border-radius:14px;padding:14px;color:#e8f4fb;z-index:3;transform:translateY(130%);transition:transform .35s}
.wl-card.open{transform:none}
.wl-card h3{margin:0 0 2px;font-size:17px}.wl-card p{margin:2px 0 10px;font-size:12.5px;color:#a9c7da}
.wl-card .wl-row{display:flex;gap:8px;flex-wrap:wrap}
.wl-card .wl-go{flex:1 1 100%;background:#e8c27c;color:#1b1406;border-color:#e8c27c;font-weight:800}
.wl-card .wl-x{position:absolute;right:8px;top:8px;min-width:34px;min-height:34px;padding:0}
.wl-sheet{position:absolute;z-index:4;background:rgba(8,16,26,.96);border:1px solid rgba(140,200,235,.3);color:#e8f4fb;overflow:auto;transition:transform .5s cubic-bezier(.2,.8,.2,1);padding:12px}
.wl-sheet .hub-panel-card{background:transparent;border:0;padding:0;box-shadow:none}
.wl-sheet .hub-form-grid{grid-template-columns:1fr!important}
.wl-sheet .wl-head{display:flex;gap:8px;align-items:center;margin-bottom:10px}
.wl-sheet .wl-head strong{flex:1;font-size:15px}
.wl-sheet .actions{position:sticky;bottom:-12px;margin:12px -12px -12px!important;padding:10px 12px;background:rgba(8,16,26,.98);border-top:1px solid rgba(140,200,235,.25);display:flex;flex-wrap:wrap;gap:8px}
.wl-sheet #hubSpeedSummary{flex:1 1 100%;margin:0;font-size:12px;color:#a9c7da}
.wl-sheet .wl-timebar{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}
.wl-sheet .wl-timebar button{min-height:36px;border-radius:9px;border:1px solid rgba(160,210,240,.4);background:rgba(20,48,70,.7);color:#fff;padding:0 10px;cursor:pointer}
@media(min-width:900px){.wl-sheet{top:0;bottom:0;right:0;width:400px;border-radius:0;transform:translateX(105%)}.wl-sheet.open{transform:none}}
@media(max-width:899px){.wl-sheet{left:0;right:0;bottom:0;max-height:64%;border-radius:16px 16px 0 0;transform:translateY(105%)}.wl-sheet.open{transform:none}}
@media(prefers-reduced-motion:reduce){.wl-card,.wl-sheet,.wl-top,.wl-zoom{transition:none}}
`;
    document.head.appendChild(s);
  }
  const $=id=>document.getElementById(id);
  const find=code=>(typeof allAirports!=='undefined'?allAirports:[]).find(a=>a.code===code);
  const fire=(el,type='change')=>el&&el.dispatchEvent(new Event(type,{bubbles:true}));
  function enhance(stage){
    if(!skyMapCore.ready()||!stage) return;
    const panel=stage.querySelector('.hub-section-panel'),card=panel?.querySelector('.hub-panel-card');
    if(!panel||!card||panel.querySelector('.wl-root')) return;
    current?.destroy();css();
    const banner=panel.querySelector('.hub-online-banner');if(banner) banner.hidden=true;
    const chipsRow=card.querySelector('.mp-room-chips');
    const root=document.createElement('div');root.className='wl-root';
    root.innerHTML=`<div class="wl-map"></div>
      <div class="wl-top"><div class="wl-title">🌍 選擇起飛機場<small>點地圖上的黃點（數字是聚合的機場，點一下會放大）</small></div><div class="wl-chips"></div></div>
      <div class="wl-zoom"><button type="button" class="wl-btn" data-wl="in" aria-label="放大">＋</button><button type="button" class="wl-btn" data-wl="out" aria-label="縮小">－</button><button type="button" class="wl-btn" data-wl="world" aria-label="回到世界地圖">🌍</button></div>
      <div class="wl-card" role="dialog" aria-label="機場資訊"></div>
      <div class="wl-sheet" aria-label="飛行設定"></div>`;
    panel.prepend(root);
    if(chipsRow) root.querySelector('.wl-chips').appendChild(chipsRow);
    const sheet=root.querySelector('.wl-sheet'),infoCard=root.querySelector('.wl-card');
    sheet.innerHTML='<div class="wl-head"><button type="button" class="wl-btn" data-wl="back">← 回到地圖</button><strong></strong></div>';
    sheet.appendChild(card);
    card.querySelector('small')?.closest('div')?.setAttribute('hidden','');   // leftover "快速帶入" caption; the chips now live on the map
    // quick times of day next to the time input
    const timeInput=$('hubFfTime');
    if(timeInput){
      const bar=document.createElement('div');bar.className='wl-timebar';
      bar.innerHTML='<button type="button" data-time="06:30">🌅 日出</button><button type="button" data-time="12:00">☀ 正午</button><button type="button" data-time="17:45">🌇 黃昏</button><button type="button" data-time="22:00">🌙 夜間</button>';
      timeInput.closest('label').after(bar);
    }
    const map=skyMapCore.create(root.querySelector('.wl-map'),{label:'選擇機場的世界地圖',onPick});
    let picked=null,entered=false;
    const depSel=()=>$('hubFfDeparture'),dstSel=()=>$('hubFfDestination');
    function sync(){map.setSelection({dep:find(depSel()?.value),dst:find(dstSel()?.value)});}
    function padFor(){const r=root.getBoundingClientRect();return r.width>=900?{r:400,b:0}:{r:0,b:Math.round(r.height*.5)};}
    function onPick(a,quiet){
      if(entered) return;
      picked=a;
      if(!a){infoCard.classList.remove('open');map.setSelection({focus:null});return;}
      infoCard.innerHTML=`<button type="button" class="wl-btn wl-x" data-wl="close" aria-label="關閉">✕</button><h3>${a.code} · ${a.name}</h3>
        <p>跑道 ${a.designator||''} · ${Math.round(a.length||0)} × ${Math.round(a.width||0)} m · 標高 ${Math.round(a.elevation||0)} m</p>
        <div class="wl-row"><button type="button" class="wl-btn wl-go" data-wl="enter">✈ 從這裡起飛 → 選機型與時間</button>
        <button type="button" class="wl-btn" data-wl="dst">設為目的地</button></div>`;
      infoCard.classList.add('open');map.setSelection({focus:a});
      if(!quiet) map.animateTo(Math.PI/180*a.lon,Math.log(Math.tan(Math.PI/4+a.lat*Math.PI/360)),Math.max(map.view.k,map.view.minK*6),900);
    }
    function enter(a){
      if(!a||entered) return;entered=true;
      const dep=depSel();if(dep&&[...dep.options].some(o=>o.value===a.code)){dep.value=a.code;fire(dep);}
      infoCard.classList.remove('open');root.classList.add('wl-entered');
      sheet.querySelector('.wl-head strong').textContent='🛫 '+a.code+' '+a.name;
      sync();map.setSelection({focus:a});
      map.flyToAirport(a,380,1700,()=>{sheet.classList.add('open');},padFor());
    }
    function back(){
      if(!entered) return;entered=false;
      sheet.classList.remove('open');root.classList.remove('wl-entered');
      map.setSelection({focus:null});sync();map.showWorld(true,{r:0,b:0});
    }
    root.addEventListener('click',e=>{
      const b=e.target.closest('[data-wl]');
      if(b){
        const k=b.dataset.wl;
        if(k==='in') map.zoomBy(1.7);else if(k==='out') map.zoomBy(1/1.7);
        else if(k==='world'){infoCard.classList.remove('open');map.setSelection({focus:null});map.showWorld(true);}
        else if(k==='close'){infoCard.classList.remove('open');map.setSelection({focus:null});}
        else if(k==='enter') enter(picked);
        else if(k==='dst'&&picked){const d=dstSel();if(d){d.value=picked.code;fire(d);}sync();}
        else if(k==='back') back();
        return;
      }
      const t=e.target.closest('[data-time]');
      if(t&&timeInput){timeInput.value=t.dataset.time;fire(timeInput,'input');fire(timeInput);return;}
      if(e.target.closest('[data-world-hub]')){ // quick route chip: the hub handler fills the selects first, then we follow them
        setTimeout(()=>{sync();const d=find(depSel()?.value),x=find(dstSel()?.value);if(d&&x){map.flyToBox([d,x],300,1300);onPick(d,true);}},0);
      }
    });
    const onSel=e=>{if(e.target.id==='hubFfDeparture'||e.target.id==='hubFfDestination') sync();};
    document.addEventListener('change',onSel);
    const onKey=e=>{if(e.key==='Escape'&&root.isConnected){if(entered) back();else infoCard.classList.remove('open');}};
    document.addEventListener('keydown',onKey);
    sync();
    current={destroy(){map.destroy();document.removeEventListener('change',onSel);document.removeEventListener('keydown',onKey);}};
    // Start on the whole world once the stage has a real size.
    requestAnimationFrame(()=>{map.resize();map.showWorld(false);});
  }
  return {enhance};
})();
if(typeof window!=='undefined') window.skyLauncher=skyLauncher;
if(typeof module!=='undefined') module.exports={skyLauncher};
