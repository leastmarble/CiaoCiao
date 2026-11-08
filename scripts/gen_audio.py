"""Generate one MP3 per phrase per voice with Kokoro (Sara = woman, Nicola = man).
Usage: node scripts/extract_phrases.js && python3 scripts/gen_audio.py [--only ID,ID]"""
import json,subprocess,os,sys,numpy as np,soundfile as sf
from kokoro_onnx import Kokoro
R=os.path.join(os.path.dirname(__file__),'..')
k=Kokoro(f"{R}/models/kokoro.onnx",f"{R}/models/voices.bin")
P=json.load(open(f"{R}/audio/phrases.json"))
only=set(sys.argv[sys.argv.index('--only')+1].split(',')) if '--only' in sys.argv else None
for v,tag in [("if_sara","f"),("im_nicola","m")]:
  for p in P:
    if only and p['id'] not in only: continue
    t=p["it"].replace("…","").strip()
    if not t.endswith(('.','?','!')): t+="."
    s,sr=k.create(t,voice=v,speed=0.92,lang="it")
    s=np.asarray(s,dtype=np.float32); idx=np.where(np.abs(s)>0.01)[0]
    if len(idx): s=s[max(0,idx[0]-int(.03*sr)):idx[-1]+int(.12*sr)]
    s=np.concatenate([np.zeros(int(.05*sr),np.float32),s,np.zeros(int(.08*sr),np.float32)])
    w=f"{R}/audio/{tag}_{p['id']}.wav"; sf.write(w,s,sr)
    subprocess.run(["ffmpeg","-loglevel","error","-y","-i",w,"-ac","1","-ar","24000","-b:a","40k",w[:-4]+".mp3"],check=True); os.remove(w)
print("done")
