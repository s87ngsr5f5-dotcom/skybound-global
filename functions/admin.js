export async function onRequestGet({request,env}) {
  const headers = {'Cache-Control':'no-store','Content-Type':'text/html; charset=utf-8'};
  if (!env.ADMIN_PASSWORD || !env.STATS) return new Response('管理後台尚待設定',{status:503,headers});
  if (request.headers.get('Authorization') !== 'Basic '+btoa('admin:'+env.ADMIN_PASSWORD))
    return new Response('請登入管理帳號',{status:401,headers:{...headers,'WWW-Authenticate':'Basic realm="Skybound"'}});
  const {results} = await env.STATS.prepare("SELECT day, SUM(CASE WHEN event='visit' THEN count ELSE 0 END) visits,SUM(CASE WHEN event='debrief' THEN count ELSE 0 END) reports,SUM(CASE WHEN event='support' THEN count ELSE 0 END) clicks FROM daily WHERE day >= date('now','+8 hours','-29 days') GROUP BY day ORDER BY day DESC").all();
  const rows = results.map(r=>'<tr><td>'+String(r.day).replace(/[^0-9-]/g,'')+'</td><td>'+Number(r.visits)+'</td><td>'+Number(r.reports)+'</td><td>'+Number(r.clicks)+'</td></tr>').join('');
  return new Response('<!doctype html><html lang="zh-Hant"><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><title>SKYBOUND 營運後台</title><style>body{font:16px system-ui;color:#ebf1f3;background:#142631;margin:5vw}table{border-collapse:collapse}th,td{padding:12px 8px;text-align:left;border-bottom:1px solid #60747d}</style><h1>營運後台</h1><p>近 30 天 · 台灣時間 · 重新整理可更新</p><table><tr><th>日期</th><th>開啟遊戲次數</th><th>劇情結算次數</th><th>支持開發點擊</th></tr>'+rows+'</table>'+(rows?'':'<p>尚無事件</p>')+'<p>重新載入會再次計數。實際款項請至金流平台核對。</p></html>',{headers});
}
