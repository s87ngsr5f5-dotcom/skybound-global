from pathlib import Path
import sys,json
sys.path.insert(0,str(Path.cwd().parent/'browser-qa'))
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 for engine in ['chromium','webkit']:
  b=p.chromium.launch(channel='msedge') if engine=='chromium' else p.webkit.launch()
  page=b.new_page(viewport={'width':844,'height':390},is_mobile=True,has_touch=True)
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  def hook(route):
   s=Path('dist/flight.js').read_text(encoding='utf-8').replace('  const buildingGeo = new THREE.BoxGeometry();','window.storeQA={scene,parkingBeacon,pause(){paused=true},get flight(){return flight}};const buildingGeo = new THREE.BoxGeometry();')
   route.fulfill(status=200,content_type='application/javascript',body=s)
  page.route('**/flight.js*',hook)
  page.goto('http://127.0.0.1:8803',wait_until='domcontentloaded',timeout=120000)
  page.wait_for_function('window.storeQA',timeout=120000)
  page.wait_for_timeout(2500)
  assert not errors,errors
  page.locator('[data-hub-tab=shop]').click(force=True)
  assert page.locator('[data-store-preview]').count()>=9
  page.locator('[data-store-passenger=a223]').count()
  page.evaluate("window.dispatchEvent(new CustomEvent('skybound:trial-aircraft',{detail:{id:'b773',passenger:true}}))")
  page.wait_for_timeout(2500)
  print(engine,'flight',page.evaluate('({id:storeQA.flight?.aircraft.id,loan:storeQA.flight?.missionLoaner,service:!!storeQA.flight?.service})'),flush=True)
  assert page.evaluate("storeQA.flight?.aircraft.id==='b773' && !!storeQA.flight?.service")
  page.evaluate('''()=>{storeQA.pause();const f=storeQA.flight;const g=parkingPoint(f.destination);f.arrivalTaxi=[g];f.taxiIndex=0;Object.assign(f,{ground:true,landed:true,touchdown:{along:0,cross:0,verticalSpeed:-1,speed:70},phase:'arrival',x:g.x+150,z:g.z+100,y:f.destination.elevation,vx:0,vz:0,throttle:0});}''')
  page.wait_for_timeout(1000)
  print('errors',errors,flush=True);print(engine,'parking',page.evaluate('({visible:storeQA.parkingBeacon.visible,position:storeQA.parkingBeacon.position.toArray(),goal:arrivalParkingTarget(storeQA.flight)})'),flush=True)
  assert page.evaluate('storeQA.parkingBeacon.visible')
  assert not errors,errors
  b.close()



