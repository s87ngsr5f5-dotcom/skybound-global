from pathlib import Path
import urllib.request,urllib.parse,json,csv,io,math,datetime
root=Path.cwd();cache=root.parent/'osm-cache';cache.mkdir(exist_ok=True)
regions=[('MY_KUL',8,'馬來西亞吉隆坡',[(3.14,101.695,3.17,101.72)],'WMKK'),('ID_CGK',9,'印尼雅加達', [(-6.19,106.81,-6.16,106.84)],'WIII')]
for code,rid,name,boxes,ap in regions:
 path=cache/(code+'-pilot.json')
 if not path.exists():
  query='[out:json][timeout:90];('+''.join('way[building]('+','.join(map(str,b))+');way[highway~"^(primary|secondary|tertiary|residential)$"]('+','.join(map(str,b))+');' for b in boxes)+');out tags geom;'
  req=urllib.request.Request('https://overpass-api.de/api/interpreter',data=urllib.parse.urlencode({'data':query}).encode(),headers={'User-Agent':'SkyboundSceneryBuilder/1.0'})
  with urllib.request.urlopen(req,timeout=110) as r:path.write_bytes(r.read())
 print(code,len(json.loads(path.read_text(encoding='utf-8'))['elements']),flush=True)
for typ in ['airports','runways']:
 p=cache/(typ+'.csv')
 if not p.exists():
  with urllib.request.urlopen('https://raw.githubusercontent.com/davidmegginson/ourairports-data/main/'+typ+'.csv',timeout=60) as r:p.write_bytes(r.read())
 print('downloaded',typ,flush=True)

