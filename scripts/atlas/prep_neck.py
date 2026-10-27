"""Head and neck CT atlas: TotalSegmentator-dataset case with expert-reviewed masks, plus TotalSegmentator head/neck task outputs
for structures the dataset does not cover. Auto labels only fill voxels the reviewed masks leave empty (or the skull mask).

Usage: python3 prep_neck.py <case_dir> <task_dir>
"""
import sys, json, os, glob
import numpy as np, nibabel as nib
from scipy import ndimage as ndi
sys.path.insert(0, '/home/claude')
from anatomy_build import TOTAL, pretty, base_of, strip_outside

case, tdir = sys.argv[1], sys.argv[2]
CATS = {'art': ('Arteries', '#ff5d55'), 'vein': ('Veins', '#4fa8ff'), 'aero': ('Airway and pharynx', '#38d6c4'),
        'endo': ('Glands', '#9be15d'), 'gi': ('Oesophagus', '#f6b24a'), 'muscle': ('Muscles', '#ff9d7a'), 'bone': ('Bones and cartilage', '#e9e3cc'),
        'cns': ('Brain, cord and nerves', '#c7f27a'), 'orbit': ('Orbit', '#b98cff'), 'sinus': ('Sinuses and cavities', '#57c7ff')}

def sided(key):
    for sd in ('left', 'right'):
        if key.endswith('_' + sd): return sd.capitalize() + ' ', key[:-len(sd) - 1]
    return '', key

AUTO = {  # task: {class: (name, cat)}
 'headneck_bones_vessels': {'larynx_air': ('Laryngeal airway', 'aero'), 'thyroid_cartilage': ('Thyroid cartilage', 'bone'), 'hyoid': ('Hyoid bone', 'bone'),
    'cricoid_cartilage': ('Cricoid cartilage', 'bone'), 'zygomatic_arch': ('zygomatic arch', 'bone'), 'styloid_process': ('styloid process', 'bone'),
    'internal_carotid_artery': ('internal carotid artery', 'art'), 'internal_jugular_vein': ('internal jugular vein', 'vein')},
 'head_glands_cavities': {'eye': ('globe', 'orbit'), 'eye_lens': ('lens', 'orbit'), 'optic_nerve': ('optic nerve', 'orbit'), 'parotid_gland': ('parotid gland', 'endo'),
    'submandibular_gland': ('submandibular gland', 'endo'), 'nasopharynx': ('Nasopharynx', 'aero'), 'oropharynx': ('Oropharynx', 'aero'), 'hypopharynx': ('Hypopharynx', 'aero'),
    'nasal_cavity': ('nasal cavity', 'sinus'), 'auditory_canal': ('external auditory canal', 'sinus'), 'soft_palate': ('Soft palate', 'aero'), 'hard_palate': ('Hard palate', 'bone')},
 'headneck_muscles': {'sternocleidomastoid': ('sternocleidomastoid', 'muscle'), 'superior_pharyngeal_constrictor': ('Superior pharyngeal constrictor', 'muscle'),
    'middle_pharyngeal_constrictor': ('Middle pharyngeal constrictor', 'muscle'), 'inferior_pharyngeal_constrictor': ('Inferior pharyngeal constrictor', 'muscle'),
    'trapezius': ('trapezius', 'muscle'), 'platysma': ('platysma', 'muscle'), 'levator_scapulae': ('levator scapulae', 'muscle'),
    'anterior_scalene': ('anterior scalene', 'muscle'), 'middle_scalene': ('middle scalene', 'muscle'), 'posterior_scalene': ('posterior scalene', 'muscle'),
    'sterno_thyroid': ('sternothyroid', 'muscle'), 'thyrohyoid': ('thyrohyoid', 'muscle'), 'prevertebral': ('prevertebral muscles (longus)', 'muscle')},
 'head_muscles': {'masseter': ('masseter', 'muscle'), 'temporalis': ('temporalis', 'muscle'), 'lateral_pterygoid': ('lateral pterygoid', 'muscle'),
    'medial_pterygoid': ('medial pterygoid', 'muscle'), 'tongue': ('Tongue', 'muscle'), 'digastric': ('digastric', 'muscle')},
 'craniofacial_structures': {'mandible': ('Mandible', 'bone'), 'teeth_lower': ('Mandibular teeth', 'bone'), 'teeth_upper': ('Maxillary teeth', 'bone'),
    'sinus_maxillary': ('Maxillary sinus', 'sinus'), 'sinus_frontal': ('Frontal sinus', 'sinus')},
}
GT_CAT = {'thyroid_gland': 'endo', 'trachea': 'aero', 'esophagus': 'gi', 'spinal_cord': 'cns', 'brain': 'cns',
          'common_carotid_artery': 'art', 'subclavian_artery': 'art', 'brachiocephalic_trunk': 'art', 'aorta': 'art',
          'brachiocephalic_vein': 'vein', 'superior_vena_cava': 'vein', 'autochthon': 'muscle', 'lung_upper_lobe': 'aero'}

ct_img = nib.as_closest_canonical(nib.load(f'{case}/ct.nii.gz'))
ct = strip_outside(ct_img.get_fdata().astype(np.float32), keep_frac=0.3); zooms = [float(z) for z in ct_img.header.get_zooms()[:3]]
out = np.zeros(ct.shape, np.uint8); structs = []; nid = 0
def add(mask, key, name, cat):
    global nid
    nid += 1; out[mask] = nid; structs.append({'id': nid, 'key': key, 'name': name, 'cat': cat}); return nid
skull_id = None
for cls in TOTAL:
    p = f'{case}/segmentations/{cls}.nii.gz'
    if not os.path.exists(p): continue
    m = np.asarray(nib.as_closest_canonical(nib.load(p)).dataobj) > 0
    if m.sum() < 40: continue
    sd, base = sided(cls)
    if cls.startswith('vertebrae_') or cls.startswith('rib_'): nm, cat = pretty(cls), 'bone'
    elif cls == 'skull': nm, cat = 'Skull', 'bone'
    elif cls == 'brain': nm, cat = 'Brain', 'cns'
    elif base.startswith('lung_'): nm, cat = pretty(cls), 'aero'
    else:
        nm = pretty(cls); cat = GT_CAT.get(base, 'bone')
    i = add(m, cls, nm, cat)
    if cls == 'skull': skull_id = i
gt_mask = (out > 0) & (out != (skull_id or 0))
for task, cmap in AUTO.items():
    p = f'{tdir}/{task}.nii'
    if not os.path.exists(p): print('missing', task); continue
    from totalsegmentator.map_to_binary import class_map
    tm = np.asarray(nib.as_closest_canonical(nib.load(p)).dataobj).astype(np.int16)
    for idx, cls in class_map[task].items():
        sd, base = sided(cls)
        if base not in cmap: continue
        m = (tm == idx) & ~gt_mask
        if m.sum() < 40: continue
        nm, cat = cmap[base]
        add(m, cls, (sd + nm) if sd else nm, cat)

# reviewed skull mask includes the mandible: give skull voxels below the hard palate to the mandible
ids = {x['key']: x['id'] for x in structs}
if skull_id and 'mandible' in ids:
    ref = [ids[k] for k in ('hard_palate', 'sinus_maxillary') if k in ids]
    if ref:
        zref = min(np.where(np.isin(out, ref).any(axis=(0, 1)))[0].min() for _ in [0])
        sk = out[:, :, :zref] == skull_id
        out[:, :, :zref][sk] = ids['mandible']
# crop: body, from 15 mm above the orbits (or top) to the bottom
body = ct > -300
proj = ndi.binary_opening(body.mean(axis=2) > 0.05, iterations=4)
lbl, n = ndi.label(proj); sizes = ndi.sum(np.ones_like(lbl), lbl, range(1, n + 1)); keep = lbl == (np.argmax(sizes) + 1)
xs, ys = np.where(keep); pad = 5
x0, x1 = max(0, xs.min() - pad), xs.max() + pad + 1; y0, y1 = max(0, ys.min() - pad), ys.max() + pad + 1
ct = ct[x0:x1, y0:y1]; out = out[x0:x1, y0:y1]
disp = lambda a: np.transpose(a[::-1, ::-1, :], (2, 1, 0))
np.savez_compressed('/tmp/claude-0/prep/neck.npz', img=disp(ct), lab=disp(out), spacing=np.array([zooms[2], zooms[1], zooms[0]]))
json.dump({'structures': structs, 'cats': {k: {'name': v[0], 'color': v[1]} for k, v in CATS.items()}, 'modality': 'CT', 'scroll': 'axial'},
          open('/tmp/claude-0/prep/neck.json', 'w'))
print('neck', disp(ct).shape, len(structs))
