export function onRequestGet({env}) {
  const url = env.SUPPORT_URL || '';
  return Response.json({support: /^https:\/\//i.test(url) ? url : '', stats: !!env.STATS});
}
