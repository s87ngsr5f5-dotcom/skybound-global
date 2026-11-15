const events = new Set(['visit', 'debrief', 'support']);
export async function onRequestPost({request, env}) {
  const url = new URL(request.url);
  if (request.headers.get('origin') !== url.origin) return new Response(null,{status:403});
  const event = url.searchParams.get('event');
  if (!events.has(event)) return new Response(null,{status:400});
  if (!env.STATS) return new Response(null,{status:503});
  await env.STATS.prepare("INSERT INTO daily(day,event,count) VALUES(date('now','+8 hours'),?,1) ON CONFLICT(day,event) DO UPDATE SET count=count+1").bind(event).run();
  return new Response(null,{status:204});
}
