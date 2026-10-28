"""Brain vessel atlas from the TopBrain 2025 challenge release (USZ; open use, non-commercial, attribution).
Usage: python3 prep_tb.py <mr|ct> <case id> <out stem>
"""
import sys, json, numpy as np, nibabel as nib
from scipy import ndimage as ndi

mod, cid, stem = sys.argv[1], sys.argv[2], sys.argv[3]
R = '/tmp/claude-0/tb/TopBrain_Data_Release_Batches1n2_081425'
img_i = nib.as_closest_canonical(nib.load(f'{R}/imagesTr_topbrain_{mod}/topcow_{mod}_{cid}_0000.nii.gz'))
img = img_i.get_fdata().astype(np.float32)
lab = np.asarray(nib.as_closest_canonical(nib.load(f'{R}/labelsTr_topbrain_{mod}/topcow_{mod}_{cid}.nii.gz')).dataobj).astype(np.int16)
zooms = [float(z) for z in img_i.header.get_zooms()[:3]]
names = {}
for line in open(f'{R}/itksnap_labelmap_txt/labelmap_topbrain_{mod}.txt'):
    if line.startswith('#') or '"' not in line: continue
    k = int(line.split()[0]); n = line.split('"')[1]
    if k: names[k] = n

FULL = {'BA': ('Basilar artery', 'post'), 'P1P2': ('posterior cerebral artery, P1–P2', 'post'), 'ICA': ('internal carotid artery', 'ant'),
        'M1': ('middle cerebral artery, M1', 'ant'), 'Pcom': ('posterior communicating artery', 'comm'), 'Acom': ('Anterior communicating artery', 'comm'),
        'A1A2': ('anterior cerebral artery, A1–A2', 'ant'), 'A3': ('anterior cerebral artery, A3', 'ant'), '3rd-A2': ('Median (third) A2 segment', 'ant'),
        '3rd-A3': ('Median (third) A3 segment', 'ant'), 'M2': ('middle cerebral artery, M2', 'ant'), 'M3': ('middle cerebral artery, M3', 'ant'),
        'P3P4': ('posterior cerebral artery, P3–P4', 'post'), 'VA': ('vertebral artery', 'post'), 'SCA': ('superior cerebellar artery', 'post'),
        'AICA': ('anterior inferior cerebellar artery', 'post'), 'PICA': ('posterior inferior cerebellar artery', 'post'),
        'AChA': ('anterior choroidal artery', 'ant'), 'OA': ('ophthalmic artery', 'ant'), 'ECA': ('external carotid artery', 'eca'),
        'STA': ('superficial temporal artery', 'eca'), 'MaxA': ('maxillary artery', 'eca'), 'MMA': ('middle meningeal artery', 'eca'),
        'VoG': ('Vein of Galen', 'vein'), 'StS': ('Straight sinus', 'vein'), 'ICVs': ('Internal cerebral veins', 'vein'),
        'BVR': ('basal vein of Rosenthal', 'vein'), 'SSS': ('Superior sagittal sinus', 'vein')}
CATS = {'ant': ('Anterior circulation', '#ff5d55'), 'post': ('Posterior circulation', '#f6b24a'), 'comm': ('Communicating arteries', '#ff8fb8'),
        'eca': ('External carotid branches', '#9be15d'), 'vein': ('Deep veins and sinuses', '#4fa8ff')}
structs = []
for k, n in sorted(names.items()):
    if not (lab == k).any(): continue
    side = ''
    if n.startswith('R-'): side, n = 'Right ', n[2:]
    elif n.startswith('L-'): side, n = 'Left ', n[2:]
    nm, cat = FULL[n]
    structs.append({'id': k, 'key': names[k], 'name': (side + nm) if side else nm[0].upper() + nm[1:], 'cat': cat})

# crop to the head
thr = np.percentile(img, 60) if mod == 'mr' else -300
body = ndi.binary_opening(img.mean(axis=2) > (np.percentile(img.mean(axis=2), 30) if mod == 'mr' else -600), iterations=3)
xs, ys = np.where(body); pad = 6
x0, x1 = max(0, xs.min() - pad), xs.max() + pad + 1; y0, y1 = max(0, ys.min() - pad), ys.max() + pad + 1
img = img[x0:x1, y0:y1]; lab = lab[x0:x1, y0:y1]
disp = lambda a: np.transpose(a[::-1, ::-1, :], (2, 1, 0))
np.savez_compressed(stem + '.npz', img=disp(img), lab=disp(lab).astype(np.uint8), spacing=np.array([zooms[2], zooms[1], zooms[0]]))
json.dump({'structures': structs, 'cats': {k: {'name': v[0], 'color': v[1]} for k, v in CATS.items()},
           'modality': 'MR' if mod == 'mr' else 'CT', 'scroll': 'axial'}, open(stem + '.json', 'w'))
print(stem, disp(img).shape, len(structs))
