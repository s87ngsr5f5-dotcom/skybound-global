(async () => {
  const endpoint = new URL('api/', document.baseURI);
  let config;
  try {
    const response = await fetch(new URL('community', endpoint));
    if (!response.ok) return;
    config = await response.json();
  } catch { return; }
  function count(event) {
    if (config.stats) fetch(new URL('event?event=' + event, endpoint), {method:'POST', keepalive:true}).catch(() => {});
  }
  count('visit');
  window.addEventListener('skybound:debrief', () => count('debrief'));
  if (!config.support) return;
  function install() {
    const item = document.getElementById('supportDevelopment');
    if (!item) return false;
    const link = item.querySelector('a');
    link.href = config.support;
    link.addEventListener('click', () => count('support'));
    item.hidden = false;
    return true;
  }
  if (!install()) {
    const observer = new MutationObserver(() => { if (install()) observer.disconnect(); });
    observer.observe(document.body,{childList:true});
  }
})();
