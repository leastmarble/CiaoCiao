"""Inline every MP3 into src/app.html -> dist/ciaociao.html (one self-contained file)."""
import json,base64,glob,os
R=os.path.join(os.path.dirname(__file__),'..')
d={os.path.basename(f)[:-4]:base64.b64encode(open(f,'rb').read()).decode() for f in sorted(glob.glob(f'{R}/audio/*.mp3'))}
s=open(f'{R}/src/app.html').read(); assert s.count('/*AUDIO*/')==1
open(f'{R}/dist/ciaociao.html','w').write(s.replace('/*AUDIO*/',json.dumps(d,separators=(',',':'))))
print(len(d),'clips',round(os.path.getsize(f'{R}/dist/ciaociao.html')/1e6,2),'MB')
# Also refresh the GitHub Pages home-screen build in docs/
import subprocess,sys
subprocess.run([sys.executable,f'{R}/scripts/build_pages.py'],check=True)
