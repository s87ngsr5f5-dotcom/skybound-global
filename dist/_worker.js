function community({env}) {
  const url = env.SUPPORT_URL || '';
  return Response.json({support: /^https:\/\//i.test(url) ? url : '', stats: !!env.STATS});
}

const events = new Set(['visit', 'debrief', 'support']);
async function event({request, env}) {
  const url = new URL(request.url);
  if (request.headers.get('origin') !== url.origin) return new Response(null,{status:403});
  const event = url.searchParams.get('event');
  if (!events.has(event)) return new Response(null,{status:400});
  if (!env.STATS) return new Response(null,{status:503});
  await env.STATS.prepare("INSERT INTO daily(day,event,count) VALUES(date('now','+8 hours'),?,1) ON CONFLICT(day,event) DO UPDATE SET count=count+1").bind(event).run();
  return new Response(null,{status:204});
}

function adminPage(content) {
  return `<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>營運後台 · SKYBOUND GLOBAL</title>
  <style>*{box-sizing:border-box}html{color-scheme:dark}body{margin:0;background:#0e1a21;color:#edf2f4;font:16px/1.55 system-ui,sans-serif;font-variant-numeric:tabular-nums}header,main{max-width:900px;margin:auto;padding:20px clamp(16px,5vw,48px)}header{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #40545e;letter-spacing:.08em}a{color:#9cdcea}h1{margin:12px 0 4px;font-size:clamp(26px,5vw,42px)}p{color:#b8cbd3}.metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:24px 0}.metrics div{border-top:2px solid #79becb;padding-top:8px}.metrics strong{display:block;font-size:clamp(23px,5vw,38px)}table{width:100%;border-collapse:collapse}th,td{padding:10px 4px;text-align:right;border-bottom:1px solid #344750}th:first-child,td:first-child{text-align:left}th{color:#a5c4cf}a:focus-visible{outline:2px solid #ffd27a}@media(max-width:480px){th,td,.metrics span{font-size:13px}}</style>
  <header><strong>SKYBOUND GLOBAL</strong><a href="https://skybound-air.pages.dev/">返回遊戲</a></header><main><h1>營運後台</h1>${content}</main></html>`;
}

async function admin({request,env}) {
  const headers = {'Cache-Control':'no-store','Content-Type':'text/html; charset=utf-8'};
  if (!env.ADMIN_PASSWORD || !env.STATS) return new Response(adminPage('<p>管理後台尚待設定。完成帳號與資料庫連接後，即可查看遊戲數據。</p>'),{status:503,headers});
  if (request.headers.get('Authorization') !== 'Basic '+btoa('admin:'+env.ADMIN_PASSWORD))
    return new Response('請登入管理帳號',{status:401,headers:{...headers,'WWW-Authenticate':'Basic realm="Skybound"'}});
  const {results} = await env.STATS.prepare("SELECT day, SUM(CASE WHEN event='visit' THEN count ELSE 0 END) visits,SUM(CASE WHEN event='debrief' THEN count ELSE 0 END) reports,SUM(CASE WHEN event='support' THEN count ELSE 0 END) clicks FROM daily WHERE day >= date('now','+8 hours','-29 days') GROUP BY day ORDER BY day DESC").all();
  const rows = results.map(r=>'<tr><td>'+String(r.day).replace(/[^0-9-]/g,'')+'</td><td>'+Number(r.visits)+'</td><td>'+Number(r.reports)+'</td><td>'+Number(r.clicks)+'</td></tr>').join('');
  const number = new Intl.NumberFormat('zh-TW');
  const metrics = [['visits','遊戲開啟'],['reports','劇情結算'],['clicks','支持開發點擊']].map(([key,label])=>{
    const total = results.reduce((sum,row)=>sum+Number(row[key]),0);
    return `<div><span>${label}</span><strong>${number.format(total)}</strong></div>`;
  }).join('');
  const content = `<p>近 30 天 · 台灣時間 · <a href="/admin">更新數據</a></p><section class="metrics" aria-label="期間總計">${metrics}</section><h2>每日紀錄</h2><table><thead><tr><th>日期</th><th>遊戲開啟</th><th>劇情結算</th><th>支持點擊</th></tr></thead><tbody>${rows || '<tr><td colspan="4">尚無紀錄</td></tr>'}</tbody></table><p>重新載入遊戲會再次計數。贊助金額請至收款平台核對。</p>`;
  return new Response(adminPage(content),{headers});
}

export default {
  async fetch(request,env) {
    const path = new URL(request.url).pathname.replace(/\/$/,'');
    const service = 'https://skybound-usage.skybound-global-ops.workers.dev';
    if (!env.STATS && new URL(request.url).origin !== service) {
      if (path === '/admin' && request.method === 'GET') {
        const headers = new Headers();
        if (request.headers.has('authorization')) headers.set('authorization',request.headers.get('authorization'));
        return fetch(service + '/admin',{headers,redirect:'manual'});
      }
      if (path === '/api/community' && request.method === 'GET') return fetch(service + path);
      if (path === '/api/event' && request.method === 'POST') {
        const url = new URL(request.url);
        if (request.headers.get('origin') !== url.origin) return new Response(null,{status:403});
        return fetch(service + path + url.search,{method:'POST',headers:{origin:service}});
      }
    }
    const context = {request,env};
    if (path === '/admin' && request.method === 'GET') return admin(context);
    if (path === '/api/community' && request.method === 'GET') return community(context);
    if (path === '/api/event' && request.method === 'POST') return event(context);
    if (['/admin','/api/event','/api/community'].includes(path)) return new Response(null,{status:405});
    return env.ASSETS ? env.ASSETS.fetch(request) : new Response(null,{status:404});
  }
};