#!/usr/bin/env python3
"""Shrink oversized textures inside a .vrm (GLB) file.

Usage: python3 -I tools/optimize_vrm.py in.vrm out.vrm [max_px=1024]
Re-encodes every embedded image larger than max_px (longest side) at max_px,
re-saves PNGs with optimisation, and rebuilds the binary chunk. Geometry,
skinning, spring bones, expressions and VRM meta (incl. license) are untouched.
"""
import io, json, struct, sys
from PIL import Image

src, dst = sys.argv[1], sys.argv[2]
max_px = int(sys.argv[3]) if len(sys.argv) > 3 else 1024
data = open(src, 'rb').read()
jlen = struct.unpack('<I', data[12:16])[0]
gltf = json.loads(data[20:20 + jlen])
bstart = 20 + jlen + 8
blen = struct.unpack('<I', data[20 + jlen:24 + jlen])[0]
binbuf = data[bstart:bstart + blen]

image_views = {im['bufferView']: i for i, im in enumerate(gltf['images']) if 'bufferView' in im}
new_bin = bytearray()
for vi, bv in enumerate(gltf['bufferViews']):
    off = bv.get('byteOffset', 0)
    chunk = binbuf[off:off + bv['byteLength']]
    if vi in image_views:
        im = gltf['images'][image_views[vi]]
        img = Image.open(io.BytesIO(chunk))
        w, h = img.size
        s = min(1.0, max_px / max(w, h))
        if s < 1.0:
            img = img.resize((max(1, int(w * s)), max(1, int(h * s))), Image.LANCZOS)
        out = io.BytesIO()
        if im.get('mimeType') == 'image/jpeg':
            img.convert('RGB').save(out, 'JPEG', quality=90)
        else:
            img.save(out, 'PNG', optimize=True)
        if len(out.getvalue()) < len(chunk) or s < 1.0:
            chunk = out.getvalue()
    while len(new_bin) % 4:
        new_bin.append(0)
    bv['byteOffset'] = len(new_bin)
    bv['byteLength'] = len(chunk)
    new_bin += chunk
while len(new_bin) % 4:
    new_bin.append(0)
gltf['buffers'][0]['byteLength'] = len(new_bin)
js = json.dumps(gltf, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
while len(js) % 4:
    js += b' '
total = 12 + 8 + len(js) + 8 + len(new_bin)
with open(dst, 'wb') as f:
    f.write(struct.pack('<III', 0x46546C67, 2, total))
    f.write(struct.pack('<II', len(js), 0x4E4F534A)); f.write(js)
    f.write(struct.pack('<II', len(new_bin), 0x004E4942)); f.write(new_bin)
print(f'{src}: {len(data)/1e6:.1f}MB -> {dst}: {total/1e6:.1f}MB')
