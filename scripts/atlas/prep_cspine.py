"""Cervical spine MRI atlas from the Spine Generic public database (Cohen-Adad J et al., Sci Data 2021;8:219; CC BY 4.0).
Spinal cord: expert-corrected segmentation from the dataset. Vertebrae and discs: TotalSegmentator MR models (vertebrae_mr, total_mr),
discs named from the dataset's manual disc labels.
Usage: python3 prep_cspine.py <subject> <seg dir> <out stem>
"""
import sys, json, numpy as np, nibabel as nib
from scipy import ndimage as ndi
from totalsegmentator.map_to_binary import class_map

sub, sdir, stem = sys.argv[1:4]
D = f'/tmp/claude-0/sg/data/{sub}'
ld = lambda p: nib.as_closest_canonical(nib.load(p))
t2i = ld(f'{D}/{sub}_T2w.nii.gz'); img = t2i.get_fdata().astype(np.float32)
cord = np.asarray(ld(f'{D}/{sub}_T2w_label-SC_seg.nii.gz').dataobj) > 0.5
dl = np.asarray(ld(f'{D}/{sub}_T2w_label-discs_dlabel.nii.gz').dataobj).astype(int)
vmr = np.asarray(ld(f'{sdir}/vmr.nii').dataobj).astype(int)
tmr = np.asarray(ld(f'{sdir}/tmr.nii').dataobj).astype(int)
zooms = [float(z) for z in t2i.header.get_zooms()[:3]]

out = np.zeros(img.shape, np.uint8); structs = []; nid = 0
CATS = {'bone': ('Vertebrae', '#e9e3cc'), 'disc': ('Intervertebral discs', '#57c7ff'), 'cns': ('Spinal cord and brain', '#c7f27a')}
def add(m, key, name, cat):
    global nid
    if m.sum() < 30: return
    nid += 1; out[m] = nid; structs.append({'id': nid, 'key': key, 'name': name, 'cat': cat})
# vertebrae
vm = class_map['vertebrae_mr']
for k, n in vm.items():
    if not n.startswith('vertebrae_'): continue
    add(vmr == k, n, n.split('_')[1] + ' vertebra', 'bone')
# discs: split total_mr disc mask into components, name by the nearest manual disc label (SCT convention: value v = disc below vertebra v-1)
tm = {v: k for k, v in class_map['total_mr'].items()}
discs = tmr == tm['intervertebral_discs']
lb, n = ndi.label(discs)
pts = {int(v): np.argwhere(dl == v).mean(0) for v in np.unique(dl) if v > 0}
order = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'T1', 'T2', 'T3', 'T4', 'T5']
for c in range(1, n + 1):
    m = lb == c
    if m.sum() < 30: continue
    cen = np.argwhere(m).mean(0)
    best = min(pts.items(), key=lambda kv: np.linalg.norm((kv[1] - cen) * zooms)) if pts else None
    if best is None or np.linalg.norm((best[1] - cen) * zooms) > 12: continue
    v = best[0]  # disc between vertebra index v-1 and v
    if v < 2 or v > len(order): continue
    add(m & (out == 0), f'disc_{v}', f'{order[v - 2]}–{order[v - 1]} disc', 'disc')
add(cord, 'cord', 'Spinal cord', 'cns')
add((tmr == tm['brain']) & (out == 0), 'brain', 'Brainstem and cerebellum', 'cns')

# display order like CT: [z (inferior->superior), row (anterior->posterior), col (patient right->left)]
disp = lambda a: np.transpose(a[::-1, ::-1, :], (2, 1, 0))
img_d, lab_d = disp(img), disp(out)
# crop empty background
nz = img_d > np.percentile(img_d, 40)
ys = np.where(nz.any(axis=(0, 2)))[0]; xs = np.where(nz.any(axis=(0, 1)))[0]
img_d = img_d[:, ys.min():ys.max() + 1, xs.min():xs.max() + 1]; lab_d = lab_d[:, ys.min():ys.max() + 1, xs.min():xs.max() + 1]
img_d = np.clip(img_d, 0, np.percentile(img_d, 99.8))
np.savez_compressed(stem + '.npz', img=img_d, lab=lab_d, spacing=np.array([zooms[2], zooms[1], zooms[0]]))
json.dump({'structures': structs, 'cats': {k: {'name': v[0], 'color': v[1]} for k, v in CATS.items()}, 'modality': 'MR', 'scroll': 'axial'},
          open(stem + '.json', 'w'))
print(stem, img_d.shape, [s['name'] for s in structs])
