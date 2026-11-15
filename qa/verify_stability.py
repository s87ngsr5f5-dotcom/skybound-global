import sys,json
from pathlib import Path
sys.path.insert(0,str(Path.cwd().parent/'browser-qa'))
from playwright.sync_api import sync_playwright,expect
with sync_playwright() as p:
 for mobile in [False,True]:
  b=p.chromium.launch(channel='msedge')
  page=b.new_page(viewport={'width':844,'height':390} if mobile else {'width':1440,'height':900},has_touch=mobile,is_mobile=mobile)
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto('http://127.0.0.1:8803/',wait_until='domcontentloaded',timeout=120000)
  page.wait_for_function("!!document.querySelector('#titleHub')",timeout=120000)
  if mobile:page.locator('#deviceMode').select_option('mobile')
  page.locator('[data-hub-tab=freeflight]').click()
  expect(page.locator('#hubSpeedSummary')).to_contain_text('km/h')
  page.locator('#hubOpenAdvancedPlanBtn').click()
  expect(page.locator('#plan')).to_be_visible()
  page.locator('#backToHubBtn').click()
  page.locator('[data-hub-tab=freeflight]').click()
  page.select_option('#hubFfAircraft','c172s')
  page.select_option('#hubFfStartType','runway')
  page.locator('#hubFreeFlyBtn').click()
  page.wait_for_function("document.body.classList.contains('flight-ui')",timeout=45000)
  page.locator('#mobilePause').evaluate('e=>e.click()')
  expect(page.locator('#mobilePause')).to_have_attribute('aria-pressed','true')
  page.locator('#mobilePause').evaluate('e=>e.click()')
  expect(page.locator('#mobilePause')).to_have_attribute('aria-pressed','false')
  page.locator('#menu').click()
  # Force a locked-aircraft validation failure through the actual start button.
  page.evaluate("document.querySelector('#titleHub').hidden=true;document.body.classList.remove('title-hub-open');document.querySelector('#aircraft').value='f22a';document.querySelector('#fly').click()")
  expect(page.locator('#plan')).to_be_visible()
  expect(page.locator('#message')).to_have_attribute('role','alert')
  assert page.locator('#message').inner_text()
  assert not errors,errors
  print(json.dumps({'mobile':mobile,'advancedPlan':True,'startPauseResume':True,'failedStartRecovered':True,'errors':errors}),flush=True)
  b.close()
