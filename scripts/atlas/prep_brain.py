"""Prepare the CerebrA brain atlas (Manera AL et al., Sci Data 2020;7:237, CC0) on the MNI-ICBM152 2009c symmetric T1 template."""
import json, csv, numpy as np, nibabel as nib
from scipy import ndimage as ndi

B = '/tmp/claude-0/brain'
t1 = nib.as_closest_canonical(nib.load(f'{B}/mni/mni_icbm152_nlin_sym_09c/mni_icbm152_t1_tal_nlin_sym_09c.nii'))
lab_img = nib.as_closest_canonical(nib.load(f'{B}/cerebra/mni_icbm152_CerebrA_tal_nlin_sym_09c.nii'))
img = t1.get_fdata().astype(np.float32)
img2 = nib.as_closest_canonical(nib.load(f'{B}/mni/mni_icbm152_nlin_sym_09c/mni_icbm152_t2_tal_nlin_sym_09c.nii')).get_fdata().astype(np.float32)
lab = np.asarray(lab_img.dataobj).astype(np.int16)
assert img.shape == lab.shape, (img.shape, lab.shape)
wm_p = f'{B}/mni/mni_icbm152_nlin_sym_09c/mni_icbm152_wm_tal_nlin_sym_09c.nii'
wm = nib.as_closest_canonical(nib.load(wm_p)).get_fdata() if __import__('os').path.exists(wm_p) else None

NAME = {
 'Caudal Anterior Cingulate': ('caudal anterior cingulate gyrus', 'limbic'), 'Caudal Middle Frontal': ('caudal middle frontal gyrus', 'frontal'),
 'Cuneus': ('cuneus', 'occipital'), 'Entorhinal': ('entorhinal cortex', 'limbic'), 'Fusiform': ('fusiform gyrus', 'temporal'),
 'Inferior Parietal': ('inferior parietal lobule', 'parietal'), 'Inferior temporal': ('inferior temporal gyrus', 'temporal'),
 'Isthmus Cingulate': ('isthmus of cingulate gyrus', 'limbic'), 'Lateral Occipital': ('lateral occipital cortex', 'occipital'),
 'Lateral Orbitofrontal': ('lateral orbitofrontal cortex', 'frontal'), 'Lingual': ('lingual gyrus', 'occipital'),
 'Medial Orbitofrontal': ('medial orbitofrontal cortex', 'frontal'), 'Middle Temporal': ('middle temporal gyrus', 'temporal'),
 'Parahippocampal': ('parahippocampal gyrus', 'limbic'), 'Paracentral': ('paracentral lobule', 'frontal'),
 'Pars Opercularis': ('pars opercularis (inferior frontal gyrus)', 'frontal'), 'Pars Orbitalis': ('pars orbitalis (inferior frontal gyrus)', 'frontal'),
 'Pars Triangularis': ('pars triangularis (inferior frontal gyrus)', 'frontal'), 'Pericalcarine': ('pericalcarine cortex', 'occipital'),
 'Postcentral': ('postcentral gyrus', 'parietal'), 'Posterior Cingulate': ('posterior cingulate gyrus', 'limbic'),
 'Precentral': ('precentral gyrus', 'frontal'), 'Precuneus': ('precuneus', 'parietal'),
 'Rostral Anterior Cingulate': ('rostral anterior cingulate gyrus', 'limbic'), 'Rostral Middle Frontal': ('rostral middle frontal gyrus', 'frontal'),
 'Superior Frontal': ('superior frontal gyrus', 'frontal'), 'Superior Parietal': ('superior parietal lobule', 'parietal'),
 'Superior Temporal': ('superior temporal gyrus', 'temporal'), 'Supramarginal': ('supramarginal gyrus', 'parietal'),
 'Transverse Temporal': ('transverse temporal gyrus (Heschl)', 'temporal'), 'Insula': ('insula', 'insula'),
 'Brainstem': ('brainstem', 'stem'), 'Third Ventricle': ('Third ventricle', 'csf'), 'Fourth Ventricle': ('Fourth ventricle', 'csf'),
 'Optic Chiasm': ('optic chiasm and tract', 'stem'), 'Lateral Ventricle': ('lateral ventricle', 'csf'),
 'Inferior Lateral Ventricle': ('temporal horn of lateral ventricle', 'csf'), 'Cerebellum Gray Matter': ('cerebellar cortex', 'cereb'),
 'Cerebellum White Matter': ('cerebellar white matter', 'cereb'), 'Thalamus': ('thalamus', 'deep'), 'Caudate': ('caudate nucleus', 'deep'),
 'Putamen': ('putamen', 'deep'), 'Pallidum': ('globus pallidus', 'deep'), 'Hippocampus': ('hippocampus', 'limbic'), 'Amygdala': ('amygdala', 'limbic'),
 'Accumbens Area': ('nucleus accumbens', 'deep'), 'Ventral Diencephalon': ('ventral diencephalon (hypothalamus)', 'deep'),
 'Basal Forebrain': ('basal forebrain', 'deep'), 'Vermal lobules I-V': ('vermis, lobules I–V', 'cereb'),
 'Vermal lobules VI-VII': ('vermis, lobules VI–VII', 'cereb'), 'Vermal lobules VIII-X': ('vermis, lobules VIII–X', 'cereb'),
}
CATS = {'frontal': ('Frontal lobe', '#ff7a6b'), 'parietal': ('Parietal lobe', '#f6b24a'), 'temporal': ('Temporal lobe', '#57c7ff'),
        'occipital': ('Occipital lobe', '#b98cff'), 'limbic': ('Limbic and cingulate', '#ff8fb8'), 'insula': ('Insula', '#9be15d'),
        'deep': ('Deep grey nuclei', '#f2dc4b'), 'wm': ('White matter', '#e9e3cc'), 'csf': ('Ventricles', '#38d6c4'),
        'cereb': ('Cerebellum', '#ffa36b'), 'stem': ('Brainstem and optic pathway', '#c7f27a')}

rows = list(csv.DictReader(open(f'{B}/cerebra/CerebrA_LabelDetails.csv', encoding='utf-8-sig')))
out = np.zeros(lab.shape, np.uint8); structs = []; nid = 0
xs_mid = lab.shape[0] / 2
for r in rows:
    nm, cat = NAME[r['Label Name'].strip()]
    midline = r['Label Name'].strip() in ('Brainstem', 'Third Ventricle', 'Fourth Ventricle', 'Optic Chiasm', 'Vermal lobules I-V', 'Vermal lobules VI-VII', 'Vermal lobules VIII-X')
    for sd, col in (('Right', 'RH Label'), ('Left', 'LH Labels')):
        m = lab == int(r[col])
        if not m.any(): continue
        # verify hemisphere from centroid (canonical RAS: x increases to the right)
        cx = np.argwhere(m)[:, 0].mean()
        actual = 'Right' if cx > xs_mid else 'Left'
        if not midline and actual != sd: print('side swap', nm, sd, '->', actual); sd = actual
        if midline:
            existing = [s for s in structs if s['key'] == r['Label Name']]
            if existing: out[m] = existing[0]['id']; continue
            name = nm[0].upper() + nm[1:]
        else:
            name = f'{sd} {nm}'
        nid += 1; out[m] = nid
        structs.append({'id': nid, 'key': r['Label Name'], 'name': name, 'cat': cat})
# cerebral white matter: unlabelled voxels inside the brain with WM probability > 0.5
if wm is not None:
    for sd, sel in (('Right', slice(int(xs_mid), None)), ('Left', slice(0, int(xs_mid)))):
        m = np.zeros(lab.shape, bool); m[sel] = (wm[sel] > 0.5) & (out[sel] == 0)
        nid += 1; out[m] = nid; structs.append({'id': nid, 'key': f'wm_{sd}', 'name': f'{sd} cerebral white matter', 'cat': 'wm'})

# crop to head
head = img > np.percentile(img, 60) * 0.15
proj = ndi.binary_fill_holes(head.any(axis=2))
xs, ys = np.where(proj); zz = np.where(head.any(axis=(0, 1)))[0]
brain_z = np.where(out.any(axis=(0, 1)))[0]
pad = 4
x0, x1 = max(0, xs.min() - pad), xs.max() + pad + 1
y0, y1 = max(0, ys.min() - pad), ys.max() + pad + 1
z0, z1 = max(0, brain_z.min() - 12), min(img.shape[2], brain_z.max() + 6)
img = img[x0:x1, y0:y1, z0:z1]; img2 = img2[x0:x1, y0:y1, z0:z1]; out = out[x0:x1, y0:y1, z0:z1]
disp = lambda a: np.transpose(a[::-1, ::-1, :], (2, 1, 0))
zooms = [float(z) for z in t1.header.get_zooms()[:3]]
np.savez_compressed('/tmp/claude-0/prep/brain.npz', img=disp(img), img2=disp(img2), lab=disp(out), spacing=np.array([zooms[2], zooms[1], zooms[0]]))
json.dump({'structures': structs, 'cats': {k: {'name': v[0], 'color': v[1]} for k, v in CATS.items()}, 'modality': 'MR', 'scroll': 'axial', 'series': ['T1', 'T2']},
          open('/tmp/claude-0/prep/brain.json', 'w'))
print('brain', disp(img).shape, len(structs))
