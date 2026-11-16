"""Reproducible OSM pilot districts; no invented footprint infill. ODbL-1.0."""
from pathlib import Path
import json,math,re,csv,datetime
ROOT=Path(__file__).resolve().parents[1];CACHE=ROOT.parent/'osm-cache';OUT=ROOT/'dist/world-city'
ORIGIN_LAT=25+(4+10.535/60)/60;ORIGIN_LON=121+(33+9.085/60)/60
SX=111319.49*math.cos(math.radians(ORIGIN_LAT));SZ=110772;SIZE=4800
REGIONS=[('MY_KUL',8,'吉隆坡市中心',[[3.14,101.695,3.17,101.72]],'WMKK'),('ID_CGK',9,'雅加達市中心',[[-6.19,106.81,-6.16,106.84]],'WIII')]
def xy(lat,lon):return (lon-ORIGIN_LON)*SX,(ORIGIN_LAT-lat)*SZ
def number(v):
 try:return float(re.search(r'[0-9]+(?:\.[0-9]+)?',str(v)).group())
 except:return None
idx=json.loads((OUT/'index.json').read_text(encoding='utf-8'));roads=json.loads((OUT/'roads/index.json').read_text(encoding='utf-8'))
manifest={'source':'https://www.openstreetmap.org/copyright','license':'ODbL-1.0','attribution':'© OpenStreetMap contributors','accessed':str(datetime.date.today()),'scope':'City-centre pilot districts only; way outlines, no multipolygon holes or complete national terrain','regions':{}}
for code,rid,name,boxes,airport in REGIONS:
 raw=json.loads((CACHE/(code+'-pilot.json')).read_text(encoding='utf-8'));tiles={};rt={};count=known=levels=estimate=0;provenance=[]
 for el in raw['elements']:
  pts=[xy(p['lat'],p['lon']) for p in el.get('geometry',[])];tags=el.get('tags',{})
  if len(pts)<2:continue
  cx=sum(p[0] for p in pts)/len(pts);cz=sum(p[1] for p in pts)/len(pts)
  tx,tz=math.floor(cx/SIZE),math.floor(cz/SIZE);key=f'{tx}_{tz}';ox,oz=(tx+.5)*SIZE,(tz+.5)*SIZE
  if tags.get('building') and tags['building']!='no' and len(pts)>3 and pts[0]==pts[-1]:
   pts=pts[:-1];h=number(tags.get('height'));lv=number(tags.get('building:levels'))
   if h:known+=1;method='height-tag'
   elif lv:h=lv*3.2;levels+=1;method='levels-times-3.2m'
   else:h=6.4 if tags['building'] in ('house','residential','yes') else 12.8;estimate+=1;method='estimated-default'
   h=max(3,min(600,h));kind=1 if h>=34 or tags['building'] in ('office','commercial') else 3 if tags.get('roof:shape') in ('gabled','hipped') else 2 if tags['building'] in ('industrial','warehouse') else 0
   coords=[round(v,2) for x,z in pts for v in (x-ox,z-oz)]
   tile=tiles.setdefault(key,{'x':ox,'z':oz,'r':rid,'b':[]})
   tile['b'].append([round(cx-ox,2),round(cz-oz,2),round(h,2),(el['id']%997)/997,kind,coords])
   count+=1;provenance.append([el['id'],method,tags.get('name','')])
  elif tags.get('highway'):
   # Assign each segment to its own tile so cross-tile roads remain continuous.
   for a,b in zip(pts,pts[1:]):
    mx,mz=(a[0]+b[0])/2,(a[1]+b[1])/2;tx,tz=math.floor(mx/SIZE),math.floor(mz/SIZE);rk=f'{tx}_{tz}';rx,rz=(tx+.5)*SIZE,(tz+.5)*SIZE
    tile=rt.setdefault(rk,{'x':rx,'z':rz,'r':rid,'s':[]})
    tile['s'].append([{'primary':14,'secondary':10,'tertiary':8}.get(tags['highway'],6),[round(a[0]-rx,2),round(a[1]-rz,2),round(b[0]-rx,2),round(b[1]-rz,2)]])
 for collection,index,folder,field in [(tiles,idx,OUT,'b'),(rt,roads,OUT/'roads','s')]:
  index['tiles']=[t for t in index['tiles'] if t[4]!=rid]
  for key,tile in collection.items():
   path=folder/(key+'.json');path.write_text(json.dumps(tile,separators=(',',':')),encoding='utf-8')
   index['tiles'].append([key,tile['x'],tile['z'],len(tile[field]),rid])
 counts={'buildingsKept':count,'taggedHeight':known,'levelsDerivedHeight':levels,'estimatedHeight':estimate}
 idx['regions'][code]={'id':rid,'name':name,'boxes':boxes,'counts':counts,'quality':'pilot-footprints','airport':airport}
 manifest['regions'][code]={**idx['regions'][code],'timestamp':raw.get('osm3s',{}).get('timestamp_osm_base'),'buildings':provenance}
 print(code,counts,flush=True)
idx['counts']['buildings']=sum(r['counts']['buildingsKept'] for r in idx['regions'].values())
(OUT/'index.json').write_text(json.dumps(idx,separators=(',',':')),encoding='utf-8')
(OUT/'roads/index.json').write_text(json.dumps(roads,separators=(',',':')),encoding='utf-8')
(OUT/'pilot-provenance.json').write_text(json.dumps(manifest,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
