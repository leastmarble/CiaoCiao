"""Wrap dist/ciaociao.html as a standalone home-screen web app in docs/ for GitHub Pages."""
import os,json
R=os.path.join(os.path.dirname(__file__),'..')
body=open(f'{R}/dist/ciaociao.html',encoding='utf8').read()
head='''<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="CiaoCiao">
<meta name="theme-color" content="#FF4D3A">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<link rel="icon" type="image/png" href="icon-192.png">
<link rel="manifest" href="manifest.webmanifest">
<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}
body::before{content:"";position:fixed;inset:0 0 auto;height:env(safe-area-inset-top,0px);background:linear-gradient(90deg,#FF4D3A,#FF9A2E);z-index:60}</style>
</head><body>'''
open(f'{R}/docs/index.html','w',encoding='utf8').write(head+body+'</body></html>')
json.dump({"name":"CiaoCiao","short_name":"CiaoCiao","description":"Learn to speak Italian: 150 essential phrases, game style.",
 "start_url":"./","scope":"./","display":"standalone","orientation":"portrait","background_color":"#EDF1FA","theme_color":"#FF4D3A",
 "icons":[{"src":"icon-192.png","sizes":"192x192","type":"image/png"},{"src":"icon-512.png","sizes":"512x512","type":"image/png","purpose":"any"}]},
 open(f'{R}/docs/manifest.webmanifest','w'),indent=1)
open(f'{R}/docs/.nojekyll','w').close()
print('docs/ built',round(os.path.getsize(f'{R}/docs/index.html')/1e6,2),'MB')
