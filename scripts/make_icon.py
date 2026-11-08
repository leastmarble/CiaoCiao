"""Draw the CiaoCiao app icon (tomato-to-orange tile, white speech bubble, 'Ciao' in Fredoka Bold)."""
from PIL import Image, ImageDraw, ImageFont
import os
R=os.path.join(os.path.dirname(__file__),'..')
def icon(n):
    S=1024; im=Image.new('RGB',(S,S)); px=im.load()
    a,b=(255,77,58),(255,154,46)
    for y in range(S):
        for x in range(0,S):
            t=(x+y)/(2*S); px[x,y]=tuple(int(a[i]+(b[i]-a[i])*t) for i in range(3))
    d=ImageDraw.Draw(im)
    d.rounded_rectangle((150,230,874,700),radius=150,fill='white')
    d.polygon([(300,660),(260,830),(470,690)],fill='white')
    f=ImageFont.truetype(f'{R}/assets/Fredoka.ttf',250)
    ax=f.get_variation_axes(); f.set_variation_by_axes([100 if a['name'] in (b'Width','Width') else 700 for a in ax])
    bb=d.textbbox((0,0),'Ciao',font=f); w,h=bb[2]-bb[0],bb[3]-bb[1]; d.text(((S-w)/2-bb[0],465-h/2-bb[1]),'Ciao',font=f,fill=(255,77,58))
    return im.resize((n,n),Image.LANCZOS)
os.makedirs(f'{R}/docs',exist_ok=True)
for n,name in [(180,'apple-touch-icon.png'),(192,'icon-192.png'),(512,'icon-512.png')]:
    icon(n).save(f'{R}/docs/{name}',optimize=True)
print('icons ok')
