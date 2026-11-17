from pathlib import Path
import sys,mimetypes
from urllib.parse import urlparse,unquote
sys.path.insert(0,str(Path.cwd().parent/'browser-qa'))
from playwright.sync_api import sync_playwright
out=Path('work-qa-map077');out.mkdir(exist_ok=True)
with sync_playwright() as p:
 for engine in (['webkit'] if '--offline' in sys.argv else ['chromium','webkit']):
  b=p.chromium.launch(channel='msedge') if engine=='chromium' else p.webkit.launch()
  page=b.new_page(viewport={'width':844,'height':390},is_mobile=True,has_touch=True);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  def local(route):
   rel=unquote(urlparse(route.request.url).path).lstrip('/') or 'index.html';f=Path('dist')/rel
   if f.is_file():route.fulfill(path=str(f.resolve()),content_type=mimetypes.guess_type(str(f))[0] or 'application/octet-stream')
   else:route.fulfill(status=404,body='missing')
  page.route('http://127.0.0.1:8803/**',local)
  if engine=='webkit':page.route('https://tile.openstreetmap.org/**',lambda r:r.abort())
  page.goto('http://127.0.0.1:8803',wait_until='domcontentloaded',timeout=120000);page.wait_for_function('window.SkyboundCampaign',timeout=120000)
  assert page.locator('.dispatch-photo').get_attribute('src')=='assets/brand/hero-v077.jpg'
  assert page.locator('link[rel=apple-touch-icon]').get_attribute('href').endswith('aircraft-v077-180.png')
  page.locator('[data-hub-tab=campaign]').click(force=True);page.locator('[data-chapter-id="20"]').click(force=True)
  page.locator('#campaignRouteCanvas').scroll_into_view_if_needed();page.wait_for_timeout(4000)
  print(engine,page.locator('#campaignRouteCanvas').evaluate('(e)=>({...e.dataset})'),page.locator('#missionMapState').text_content(),flush=True)
  assert page.locator('#campaignRouteCanvas').get_attribute('data-route-points')=='5'
  assert page.locator('.mission-map-attribution').is_visible()
  if engine=='chromium':
   page.wait_for_function('document.querySelector("#campaignRouteCanvas").dataset.mapSource==="openstreetmap"',timeout=25000)
   page.screenshot(path=str(out/'actual-map-phone.png'),timeout=15000)
  else:
   assert page.locator('#campaignRouteCanvas').get_attribute('data-map-source')=='local-terrain'
   page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(700)
   assert page.locator('#campaignRouteCanvas').bounding_box()['width']<=390
  assert not errors,errors;print(engine,'PASS no page errors',flush=True);b.close()
