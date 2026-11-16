"""Give local JS/CSS one deployment identity; never change saves or remote URLs."""
import os,re
from pathlib import Path
from urllib.parse import urlsplit,urlunsplit,parse_qsl,urlencode

def stamp_html(text,build):
    def stamp(match):
        attr,url=match.groups()
        p=urlsplit(url)
        if p.scheme or p.netloc:return match.group(0)
        query=[(k,v) for k,v in parse_qsl(p.query,keep_blank_values=True) if k!='build']
        query.append(('build',build))
        return attr+'="'+urlunsplit((p.scheme,p.netloc,p.path,urlencode(query),p.fragment))+'"'
    return re.sub(r'(src|href)="([^"<>]+\.(?:js|css)(?:\?[^"<>]*)?)"',stamp,text)

if __name__=='__main__':
    build=os.environ['GITHUB_SHA'][:12]
    for name in ['index.html','iphone.html']:
        p=Path('dist')/name;p.write_text(stamp_html(p.read_text(encoding='utf-8'),build),encoding='utf-8')
    print('Stamped game assets:',build)
