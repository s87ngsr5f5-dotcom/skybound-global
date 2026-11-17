from pathlib import Path
import sys,json
sys.path.insert(0,str(Path.cwd().parent/'browser-qa'))
from playwright.sync_api import sync_playwright
out=Path('work-qa-licenses');out.mkdir(exist_ok=True)
with sync_playwright() as p:
 for engine in ['chromium','webkit']:
  b=p.chromium.launch(channel='msedge') if engine=='chromium' else p.webkit.launch()
  page=b.new_page(viewport={'width':844,'height':390},is_mobile=True,has_touch=True)
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  def flight_hook(route):
   s=Path('dist/flight.js').read_text(encoding='utf-8').replace('  const buildingGeo = new THREE.BoxGeometry();','window.licenseFlightQA={get flight(){return flight},pause(){paused=true}};const buildingGeo = new THREE.BoxGeometry();')
   route.fulfill(status=200,content_type='application/javascript',body=s)
  def story_hook(route):
   s=Path('dist/campaign-story.js').read_text(encoding='utf-8').replace('  globalScope.SkyboundCampaign = {','  globalScope.licenseStateQA={get active(){return activeMission}};globalScope.SkyboundCampaign = {')
   route.fulfill(status=200,content_type='application/javascript',body=s)
  def local_asset(route):
   from urllib.parse import urlparse,unquote
   import mimetypes
   rel=unquote(urlparse(route.request.url).path).lstrip('/') or 'index.html'
   if rel=='flight.js':return flight_hook(route)
   if rel=='campaign-story.js':return story_hook(route)
   f=Path('dist')/rel
   if f.is_file():route.fulfill(path=str(f.resolve()),content_type=mimetypes.guess_type(str(f))[0] or 'application/octet-stream')
   else:route.fulfill(status=404,body='missing')
  page.route('http://127.0.0.1:8803/**',local_asset)
  page.route('https://tile.openstreetmap.org/**',lambda r:r.abort())
  page.goto('http://127.0.0.1:8803',wait_until='domcontentloaded',timeout=120000)
  page.wait_for_function('window.licenseStateQA && window.licenseFlightQA',timeout=120000)
  page.wait_for_timeout(1500)
  assert page.evaluate('SkyboundCampaign.allChapters.length')==35
  page.locator('[data-hub-tab=licenses]').click(force=True)
  assert page.locator('.license-school article').count()==4
  assert page.locator('.license-school [data-chapter-id="21"]').is_disabled()
  page.evaluate('SkyboundCampaign.startChapter(27)')
  assert not page.evaluate('!!licenseFlightQA.flight')
  page.locator('.license-school [data-chapter-id="20"]').click()
  assert page.locator('#hubLaunchChapterBtn').is_enabled()
  page.locator('#hubLaunchChapterBtn').click()
  page.wait_for_timeout(1000)
  assert page.evaluate("licenseFlightQA.flight.aircraft.id==='c172s'")
  page.evaluate('''()=>{licenseFlightQA.pause();const f=licenseFlightQA.flight,a=allAirports.find(a=>a.code==='RCSS'),m=licenseStateQA.active;Object.assign(m,{gatesPassed:3,stableS:20,wasAirborne:true,maxG:12,stageIdx:4});Object.assign(f,{x:a.x,z:a.z,y:a.elevation,ground:true,landed:true,vx:0,vy:0,vz:0,g:1,pitch:0,bank:0,touchdown:{along:0,cross:0,verticalSpeed:-5.5,speed:50},arrivalTaxi:[parkingPoint(a)],taxiIndex:0});}''')
  page.wait_for_function("FlightLicensing.has('private')",timeout=15000)
  print(engine,'pre debrief errors',errors,flush=True)
  page.locator('#storyDebrief').wait_for(state='visible',timeout=15000)
  assert '私人' in page.locator('#storyDebriefBreakdown').text_content()
  print(engine,'passed',page.evaluate('({licenses:readCareer().licenses,receipts:readCareer().licenseReceipts})'),flush=True)
  page.reload(wait_until='domcontentloaded',timeout=120000)
  page.wait_for_function('window.licenseStateQA && window.licenseFlightQA',timeout=120000)
  page.locator('[data-hub-tab=licenses]').click(force=True)
  assert page.locator('.license-school [data-chapter-id="21"]').is_enabled()
  page.evaluate('SkyboundCampaign.startChapter(21)')
  page.wait_for_timeout(1000)
  assert page.evaluate("licenseFlightQA.flight.aircraft.id==='b38m' && licenseFlightQA.flight.missionLoaner==='b38m'")
  print(engine,'commercial mission loan passed; errors',errors,flush=True)
  assert not errors,errors
  b.close()
