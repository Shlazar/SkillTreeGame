# crop.py in.png out.png x y w h [k]: cut a box out of a screenshot and blow it up k times (nearest)
import sys
from PIL import Image
a = sys.argv
im = Image.open(a[1]); x, y, w, h = map(int, a[3:7]); k = int(a[7]) if len(a) > 7 else 3
im.crop((x, y, x + w, y + h)).resize((w * k, h * k), Image.NEAREST).save(a[2])
