"""Turn raw Cycles turntable frames into web-ready WebP frames.

- keeps only a soft elliptical contact shadow under the bottle (the shadow catcher
  also picks up wide, faint light falloff we don't want on the page)
- crops every frame to one shared box so the bottle never jumps
- writes RGBA WebP so the frames sit on any page background

Usage: python3 render/postprocess.py <raw_dir> <out_dir> [--width 720]
"""
import argparse
import glob
import os

import numpy as np
from PIL import Image, ImageFilter

ap = argparse.ArgumentParser()
ap.add_argument("raw")
ap.add_argument("out")
ap.add_argument("--width", type=int, default=720)
ap.add_argument("--quality", type=int, default=84)
args = ap.parse_args()

files = sorted(glob.glob(os.path.join(args.raw, "f*.png")))
assert files, "no frames"
os.makedirs(args.out, exist_ok=True)

# shared crop from the union of solid (bottle) pixels
union = None
for f in files:
    a = np.asarray(Image.open(f))[..., 3] > 250
    union = a if union is None else union | a
ys, xs = np.nonzero(union)
x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
H, W = union.shape
bw, bh = x1 - x0, y1 - y0
cx = (x0 + x1) / 2
# frame: bottle height + 9% headroom + room for the shadow below; width fits 3:4
top = max(0, int(y0 - bh * 0.09))
bottom = min(H, int(y1 + bh * 0.09))
ch = bottom - top
cw = int(ch * 3 / 4)
left = max(0, int(cx - cw / 2))
right = min(W, left + cw)
box = (left, top, right, bottom)

# elliptical shadow mask centred on the base
yy, xx = np.mgrid[0:H, 0:W]
base_y = y1
ex, ey = bw * 0.95, bh * 0.07
d = ((xx - cx) / ex) ** 2 + ((yy - base_y) / ey) ** 2
shadow_mask = np.clip(1.25 - d, 0, 1) ** 1.6
shadow_mask[yy < base_y - bh * 0.06] = 0

for i, f in enumerate(files):
    im = np.asarray(Image.open(f)).astype(np.float32)
    a = im[..., 3] / 255
    solid = a > 0.985
    # anti-aliased silhouette: pixels within 3 px of the bottle keep their colour and alpha
    near = np.asarray(Image.fromarray((solid * 255).astype("uint8")).filter(ImageFilter.MaxFilter(7))) > 0
    sh = ~near
    a2 = np.where(sh, a * shadow_mask * 0.85, a)
    im[..., 3] = a2 * 255
    im[sh, 0], im[sh, 1], im[sh, 2] = 28, 20, 12
    out = Image.fromarray(np.clip(im, 0, 255).astype("uint8"), "RGBA").crop(box)
    h = int(out.height * args.width / out.width)
    out = out.resize((args.width, h), Image.LANCZOS)
    out.save(os.path.join(args.out, f"{i:02d}.webp"), "WEBP", quality=args.quality, method=6)
print("box", box, "->", args.width, "px wide,", len(files), "frames")
