from pathlib import Path
import csv,json,urllib.request,gzip,struct
root=Path.cwd();cache=root.parent/'osm-cache';out=root/'dist/world-city'
for key in ['N02E101','N03E101','S07E106']:
 path=cache/(key+'.hgt.gz')
 if not path.exists():
  with urllib.request.urlopen('https://s3.amazonaws.com/elevation-tiles-prod/skadi/'+key[:3]+'/'+key+'.hgt.gz',timeout=60) as r:path.write_bytes(r.read())
 raw=gzip.decompress(path.read_bytes());n=int((len(raw)/2)**.5);samples=[]
 for y in range(121):
  for x in range(121):
   v=struct.unpack_from('>h',raw,2*(round(y*(n-1)/120)*n+round(x*(n-1)/120)))[0];samples.append(max(0,v))
 (out/(key+'-elevation.json')).write_text(json.dumps({'key':key,'size':121,'heights':samples},separators=(',',':')))
 print(key,n,flush=True)
airports=list(csv.DictReader((cache/'airports.csv').open(encoding='utf-8')));runways=list(csv.DictReader((cache/'runways.csv').open(encoding='utf-8')))
result=[]
for code,name in [('WMKK','吉隆坡國際'),('WIII','雅加達蘇加諾哈達')]:
 a=next(a for a in airports if a['ident']==code);r=max((r for r in runways if r['airport_ident']==code and r['closed']=='0'),key=lambda r:float(r['length_ft'] or 0))
 result.append({'code':code,'name':name,'lat':float(a['latitude_deg']),'lon':float(a['longitude_deg']),'elevation':float(a['elevation_ft'])*.3048,'length':float(r['length_ft'])*.3048,'width':float(r['width_ft'])*.3048,'heading':float(r['le_heading_degT']),'designator':r['le_ident'],'reciprocal':r['he_ident'],'runway':r})
(root/'work-qa-fleet100/pilot-airports.json').write_text(json.dumps(result,ensure_ascii=False),encoding='utf-8');print(json.dumps(result,ensure_ascii=False),flush=True)
