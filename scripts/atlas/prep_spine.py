"""Prepare a SPIDER lumbar spine MRI case (van der Graaf JW et al., Sci Data 2024;11:264, CC BY 4.0) for atlas_build.py.

SPIDER labels: vertebrae 1..n numbered from the most caudal lumbar vertebra (1 = L5), discs 200+k below vertebra k, 100 = spinal canal.
Display: sagittal slices, superior up, anterior left; scroll runs across the sagittal stack.
"""
import sys, json, numpy as np, SimpleITK as sitk
from scipy import ndimage as ndi

case = sys.argv[1] if len(sys.argv) > 1 else '209_t2'
D = '/tmp/claude-0/spider'
im = sitk.ReadImage(f'{D}/images/{case}.mha'); mk = sitk.ReadImage(f'{D}/masks/{case}.mha')
a = sitk.GetArrayFromImage(im).astype(np.float32); l = sitk.GetArrayFromImage(mk).astype(np.int16)
sx, sy, sz = im.GetSpacing()          # array is [z, y, x]; x = sagittal slice axis
# to [x(slice), z(row, flipped so superior is up), y(col)]
a = np.transpose(a, (2, 0, 1))[:, ::-1, :]; l = np.transpose(l, (2, 0, 1))[:, ::-1, :]
# square in-plane pixels: resample rows from sz to sy
f = sz / sy
a = ndi.zoom(a, (1, f, 1), order=3);
lr = np.zeros((l.shape[0], a.shape[1], l.shape[2]), np.int16)
for k in np.unique(l):
    if k == 0: continue
    up = ndi.zoom((l == k).astype(np.float32), (1, f, 1), order=1)[:, :a.shape[1], :]
    lr[up > 0.5] = k
l = lr

def vname(k):
    if k <= 5: return f'L{6 - k}'
    return f'T{18 - k}'
structs, out, nid = [], np.zeros(l.shape, np.uint8), 0
CATS = {'bone': ('Vertebrae', '#e9e3cc'), 'disc': ('Intervertebral discs', '#57c7ff'), 'cns': ('Spinal canal', '#c7f27a')}
present = sorted(int(k) for k in np.unique(l) if k)
for k in present:
    if k < 100: nm, cat = f'{vname(k)} vertebra', 'bone'
    elif k == 100: nm, cat = 'Spinal canal (thecal sac)', 'cns'
    else:
        v = k - 200
        below = 'S1' if v == 1 else vname(v - 1)
        nm, cat = f'{vname(v)}–{below} disc', 'disc'
    nid += 1; out[l == k] = nid
    structs.append({'id': nid, 'key': str(k), 'name': nm, 'cat': cat})
# crop around the labelled spine: 40 mm margin front/back, 25 mm above/below
ys = np.where(out.any(axis=(0, 2)))[0]; xs = np.where(out.any(axis=(0, 1)))[0]
my, mx = int(25 / sy), int(40 / sy)
y0, y1 = max(0, ys.min() - my), min(a.shape[1], ys.max() + 2 * my + 1)
x0, x1 = max(0, xs.min() - mx), min(a.shape[2], xs.max() + mx + 1)
a = a[:, y0:y1, x0:x1]; out = out[:, y0:y1, x0:x1]
# intensity: clip bright fat so marrow, discs and CSF keep contrast
hi = np.percentile(a[out > 0], 99.5) * 1.15
a = np.clip(a, 0, hi)
np.savez_compressed('/tmp/claude-0/prep/spine.npz', img=a, lab=out, spacing=np.array([sx, sy, sy]))
json.dump({'structures': structs, 'cats': {k: {'name': v[0], 'color': v[1]} for k, v in CATS.items()}, 'modality': 'MR', 'scroll': 'sagittal'},
          open('/tmp/claude-0/prep/spine.json', 'w'))
print(case, a.shape, [s['name'] for s in structs])
