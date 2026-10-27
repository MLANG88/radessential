"""Build anatomy-viewer data (CT volume + label map + structure list) from a CT NIfTI and TotalSegmentator output.

Usage: python3 anatomy_build.py <name> <ct.nii.gz> <seg_total.nii> [<seg_lung_vessels.nii>] [--upsample]
Writes site/anatomy/<name>/{ct.bin.gz, labels.bin.gz, meta.json}
"""
import sys, json, gzip, os
import numpy as np, nibabel as nib
from scipy import ndimage as ndi

TOTAL = ['spleen', 'kidney_right', 'kidney_left', 'gallbladder', 'liver', 'stomach', 'pancreas', 'adrenal_gland_right', 'adrenal_gland_left', 'lung_upper_lobe_left', 'lung_lower_lobe_left', 'lung_upper_lobe_right', 'lung_middle_lobe_right', 'lung_lower_lobe_right', 'esophagus', 'trachea', 'thyroid_gland', 'small_bowel', 'duodenum', 'colon', 'urinary_bladder', 'prostate', 'kidney_cyst_left', 'kidney_cyst_right', 'sacrum', 'vertebrae_S1', 'vertebrae_L5', 'vertebrae_L4', 'vertebrae_L3', 'vertebrae_L2', 'vertebrae_L1', 'vertebrae_T12', 'vertebrae_T11', 'vertebrae_T10', 'vertebrae_T9', 'vertebrae_T8', 'vertebrae_T7', 'vertebrae_T6', 'vertebrae_T5', 'vertebrae_T4', 'vertebrae_T3', 'vertebrae_T2', 'vertebrae_T1', 'vertebrae_C7', 'vertebrae_C6', 'vertebrae_C5', 'vertebrae_C4', 'vertebrae_C3', 'vertebrae_C2', 'vertebrae_C1', 'heart', 'aorta', 'pulmonary_vein', 'brachiocephalic_trunk', 'subclavian_artery_right', 'subclavian_artery_left', 'common_carotid_artery_right', 'common_carotid_artery_left', 'brachiocephalic_vein_left', 'brachiocephalic_vein_right', 'atrial_appendage_left', 'superior_vena_cava', 'inferior_vena_cava', 'portal_vein_and_splenic_vein', 'iliac_artery_left', 'iliac_artery_right', 'iliac_vena_left', 'iliac_vena_right', 'humerus_left', 'humerus_right', 'scapula_left', 'scapula_right', 'clavicula_left', 'clavicula_right', 'femur_left', 'femur_right', 'hip_left', 'hip_right', 'spinal_cord', 'gluteus_maximus_left', 'gluteus_maximus_right', 'gluteus_medius_left', 'gluteus_medius_right', 'gluteus_minimus_left', 'gluteus_minimus_right', 'autochthon_left', 'autochthon_right', 'iliopsoas_left', 'iliopsoas_right', 'brain', 'skull', 'rib_left_1', 'rib_left_2', 'rib_left_3', 'rib_left_4', 'rib_left_5', 'rib_left_6', 'rib_left_7', 'rib_left_8', 'rib_left_9', 'rib_left_10', 'rib_left_11', 'rib_left_12', 'rib_right_1', 'rib_right_2', 'rib_right_3', 'rib_right_4', 'rib_right_5', 'rib_right_6', 'rib_right_7', 'rib_right_8', 'rib_right_9', 'rib_right_10', 'rib_right_11', 'rib_right_12', 'sternum', 'costal_cartilages']

ORD = {1: '1st', 2: '2nd', 3: '3rd'}
def ordinal(n): return ORD.get(n, f'{n}th')

def side(s):
    if s.endswith('_left'): return 'Left ', s[:-5]
    if s.endswith('_right'): return 'Right ', s[:-6]
    return '', s

NAMES = {
    'spleen': 'Spleen', 'kidney': 'kidney', 'gallbladder': 'Gallbladder', 'liver': 'Liver', 'stomach': 'Stomach', 'pancreas': 'Pancreas',
    'adrenal_gland': 'adrenal gland', 'esophagus': 'Esophagus', 'trachea': 'Trachea', 'thyroid_gland': 'Thyroid gland',
    'small_bowel': 'Small bowel', 'duodenum': 'Duodenum', 'colon': 'Colon', 'urinary_bladder': 'Urinary bladder', 'prostate': 'Prostate',
    'kidney_cyst': 'renal cyst', 'sacrum': 'Sacrum', 'heart': 'Heart', 'pulmonary_vein': 'Pulmonary veins',
    'brachiocephalic_trunk': 'Brachiocephalic trunk', 'subclavian_artery': 'subclavian artery', 'common_carotid_artery': 'common carotid artery',
    'brachiocephalic_vein': 'brachiocephalic vein', 'atrial_appendage': 'atrial appendage', 'superior_vena_cava': 'Superior vena cava',
    'inferior_vena_cava': 'Inferior vena cava', 'portal_vein_and_splenic_vein': 'Portal and splenic veins', 'iliac_artery': 'iliac artery',
    'iliac_vena': 'iliac vein', 'humerus': 'humerus', 'scapula': 'scapula', 'clavicula': 'clavicle', 'femur': 'femur', 'hip': 'hip bone',
    'spinal_cord': 'Spinal cord', 'gluteus_maximus': 'gluteus maximus', 'gluteus_medius': 'gluteus medius', 'gluteus_minimus': 'gluteus minimus',
    'autochthon': 'erector spinae', 'iliopsoas': 'iliopsoas', 'brain': 'Brain', 'skull': 'Skull', 'sternum': 'Sternum',
    'costal_cartilages': 'Costal cartilages',
    'lung_upper_lobe': 'upper lobe', 'lung_lower_lobe': 'lower lobe', 'lung_middle_lobe': 'middle lobe',
}

CATS = {
    'art': ('Arteries', '#ff5d55'), 'vein': ('Veins', '#4fa8ff'), 'heart': ('Heart', '#ff8fb8'),
    'lung': ('Lungs and airways', '#38d6c4'), 'gi': ('Gastrointestinal', '#f6b24a'), 'solid': ('Solid organs', '#b98cff'),
    'gu': ('Genitourinary', '#f2dc4b'), 'endo': ('Glands', '#9be15d'), 'bone': ('Bones', '#e9e3cc'), 'muscle': ('Muscles', '#ff9d7a'),
    'cns': ('Nervous system', '#c7f27a'),
}

def category(base):
    if base in ('aorta', 'brachiocephalic_trunk', 'subclavian_artery', 'common_carotid_artery', 'iliac_artery', 'lung_arteries') or base.startswith('aorta_'): return 'art'
    if base in ('pulmonary_vein', 'brachiocephalic_vein', 'superior_vena_cava', 'inferior_vena_cava', 'portal_vein_and_splenic_vein', 'iliac_vena', 'lung_veins'): return 'vein'
    if base in ('heart', 'atrial_appendage'): return 'heart'
    if base.startswith('lung_') or base == 'trachea': return 'lung'
    if base in ('esophagus', 'stomach', 'small_bowel', 'duodenum', 'colon', 'gallbladder'): return 'gi'
    if base in ('liver', 'spleen', 'pancreas'): return 'solid'
    if base in ('kidney', 'kidney_cyst', 'urinary_bladder', 'prostate'): return 'gu'
    if base in ('thyroid_gland', 'adrenal_gland'): return 'endo'
    if base in ('spinal_cord', 'brain'): return 'cns'
    if base in ('gluteus_maximus', 'gluteus_medius', 'gluteus_minimus', 'autochthon', 'iliopsoas'): return 'muscle'
    return 'bone'

def pretty(cls):
    if cls.startswith('vertebrae_'): return cls.split('_')[1] + ' vertebra'
    if cls.startswith('rib_'):
        _, s, n = cls.split('_'); return f'{s.capitalize()} {ordinal(int(n))} rib'
    sd, base = side(cls)
    nm = NAMES.get(base, base.replace('_', ' '))
    if base == 'atrial_appendage': return 'Left atrial appendage'
    if base.startswith('lung_') and sd: return f'{sd}{nm}'
    return (sd + nm) if sd else nm[0].upper() + nm[1:]

def base_of(cls):
    if cls.startswith('vertebrae_'): return 'vertebra'
    if cls.startswith('rib_'): return 'rib'
    return side(cls)[1]

def main():
    name, ct_p, seg_p = sys.argv[1:4]
    lv_p = sys.argv[4] if len(sys.argv) > 4 and not sys.argv[4].startswith('--') else None
    upsample = '--upsample' in sys.argv
    ct_img = nib.as_closest_canonical(nib.load(ct_p))
    seg_img = nib.as_closest_canonical(nib.load(seg_p))
    ct = ct_img.get_fdata().astype(np.float32)
    seg = np.asarray(seg_img.dataobj).astype(np.int16)
    assert ct.shape == seg.shape, (ct.shape, seg.shape)
    zooms = [float(z) for z in ct_img.header.get_zooms()[:3]]

    # ---- label table: start from total
    classes = {}  # new id -> class key
    out = np.zeros(seg.shape, np.uint8)
    nid = 0
    for i, cls in enumerate(TOTAL, start=1):
        if cls in ('aorta', 'skull', 'brain'): continue
        m = seg == i
        if m.sum() < 20: continue
        nid += 1; classes[nid] = cls; out[m] = nid

    # ---- lung vessels overlay (only inside lungs or empty)
    if lv_p:
        lv = np.asarray(nib.as_closest_canonical(nib.load(lv_p)).dataobj).astype(np.int16)
        lung_ids = [k for k, v in classes.items() if v.startswith('lung_')]
        inlung = np.isin(out, lung_ids) | (out == 0)
        for code, cls in [(1, 'lung_airways'), (3, 'lung_arteries'), (4, 'lung_veins')]:
            m = (lv == code) & inlung
            if m.sum() < 20: continue
            nid += 1; classes[nid] = cls; out[m] = nid

    # ---- aorta split into segments, per axial slice
    aorta = seg == (TOTAL.index('aorta') + 1)
    if aorta.sum() > 50:
        zs = np.where(aorta.any(axis=(0, 1)))[0]
        # hiatus: top of T12 vertebral body if present, else lowest heart slice
        t12 = seg == (TOTAL.index('vertebrae_T12') + 1)
        heart = seg == (TOTAL.index('heart') + 1)
        if t12.any(): hiatus = np.where(t12.any(axis=(0, 1)))[0].max()
        elif heart.any(): hiatus = np.where(heart.any(axis=(0, 1)))[0].min()
        else: hiatus = -1
        two = []
        for z in zs:
            lab, n = ndi.label(aorta[:, :, z])
            sizes = ndi.sum(np.ones_like(lab), lab, range(1, n + 1)) if n else []
            big = [k + 1 for k, s in enumerate(sizes) if s >= 15]
            if len(big) >= 2: two.append(z)
        lo2, hi2 = (min(two), max(two)) if two else (None, None)
        seg_ids = {}
        def sid(key):
            nonlocal nid
            if key not in seg_ids:
                nid += 1; classes[nid] = key; seg_ids[key] = nid
            return seg_ids[key]
        for z in zs:
            sl = aorta[:, :, z]
            if z <= hiatus:
                out[:, :, z][sl] = sid('aorta_abdominal'); continue
            lab, n = ndi.label(sl)
            if lo2 is not None and lo2 <= z <= hi2 and n >= 2:
                sizes = ndi.sum(np.ones_like(lab), lab, range(1, n + 1))
                order = np.argsort(sizes)[::-1][:2] + 1
                cents = [ndi.center_of_mass(lab == k) for k in order]
                # anterior = larger y in RAS
                ant = order[int(np.argmax([c[1] for c in cents]))]
                for k in range(1, n + 1):
                    key = 'aorta_ascending' if k == ant else 'aorta_descending'
                    out[:, :, z][lab == k] = sid(key)
            elif hi2 is not None and z > hi2:
                out[:, :, z][sl] = sid('aorta_arch')
            else:
                out[:, :, z][sl] = sid('aorta_descending')

    # ---- crop to body
    body = ct > -500
    proj = body.any(axis=2)
    xs, ys = np.where(proj)
    pad = 6
    x0, x1 = max(0, xs.min() - pad), min(ct.shape[0], xs.max() + pad + 1)
    y0, y1 = max(0, ys.min() - pad), min(ct.shape[1], ys.max() + pad + 1)
    ct = ct[x0:x1, y0:y1, :]; out = out[x0:x1, y0:y1, :]

    if upsample:
        f = zooms[0] / 1.5
        ct = ndi.zoom(ct, (f, f, 1), order=3)
        out = ndi.zoom(out, (f, f, 1), order=0)
        zooms = [1.5, 1.5, zooms[2]]

    # ---- to display order: vol[z, row(anterior->posterior), col(patient right->left)]
    ct_d = np.transpose(ct[::-1, ::-1, :], (2, 1, 0))
    lab_d = np.transpose(out[::-1, ::-1, :], (2, 1, 0))
    # 8-bit companding: fine steps in soft tissue, coarser in air and bone
    knots_hu = np.array([-1024, -200, 400, 2000], float); knots_v = np.array([0, 64, 224, 255], float)
    v = np.interp(np.clip(ct_d, -1024, 2000), knots_hu, knots_v)
    q = np.clip(np.round(v), 0, 255).astype(np.uint8)
    lut = np.round(np.interp(np.arange(256), knots_v, knots_hu)).astype(int).tolist()
    hu = q

    od = f'/home/claude/site/anatomy/{name}'
    os.makedirs(od, exist_ok=True)
    from PIL import Image
    Zs, Hs, Ws = hu.shape
    cols = int(np.ceil(np.sqrt(Zs * Hs / Ws)))
    rows = int(np.ceil(Zs / cols))
    def mosaic(vol, path):
        m = np.zeros((rows * Hs, cols * Ws), np.uint8)
        for z in range(Zs):
            r, c = divmod(z, cols); m[r * Hs:(r + 1) * Hs, c * Ws:(c + 1) * Ws] = vol[z]
        Image.fromarray(m, 'L').save(path, optimize=True)
    mosaic(hu, od + '/ct.png'); mosaic(lab_d, od + '/labels.png')
    for old in ('ct.bin.gz', 'labels.bin.gz'):
        if os.path.exists(od + '/' + old): os.remove(od + '/' + old)

    present = set(np.unique(lab_d).tolist()) - {0}
    seg_names = {'aorta_ascending': 'Ascending aorta', 'aorta_arch': 'Aortic arch', 'aorta_descending': 'Descending thoracic aorta',
                 'aorta_abdominal': 'Abdominal aorta', 'lung_airways': 'Bronchi', 'lung_arteries': 'Pulmonary arteries', 'lung_veins': 'Pulmonary veins'}
    structs = []
    for k, cls in classes.items():
        if k not in present: continue
        nm = seg_names.get(cls) or pretty(cls)
        b = base_of(cls)
        cat = category('aorta_x' if cls.startswith('aorta_') else b)
        structs.append({'id': k, 'key': cls, 'name': nm, 'cat': cat})
    # merge duplicate display names (pulmonary veins from two sources) onto one entry
    meta = {'lut': lut, 'cols': cols, 'shape': list(hu.shape), 'spacing': [zooms[2], zooms[1], zooms[0]], 'cats': {k: {'name': v[0], 'color': v[1]} for k, v in CATS.items()},
            'structures': structs}
    json.dump(meta, open(od + '/meta.json', 'w'), separators=(',', ':'))
    print(name, 'shape', hu.shape, 'spacing', meta['spacing'], 'structures', len(structs),
          'ct.png', os.path.getsize(od + '/ct.png') // 1024, 'KB', 'labels.png', os.path.getsize(od + '/labels.png') // 1024, 'KB')

if __name__ == '__main__':
    main()

def strip_outside(ct, thr=-500, keep_frac=0.04):
    """Set air to -1000 outside the patient on each axial slice (removes table, head holder and blankets). ct is RAS [x, y, z]."""
    import numpy as np
    from scipy import ndimage as ndi
    out = ct.copy()
    for z in range(ct.shape[2]):
        m = ndi.binary_opening(ct[:, :, z] > thr, iterations=3)
        lb, n = ndi.label(m)
        if n == 0: continue
        sizes = ndi.sum(m, lb, range(1, n + 1)); big = sizes.max()
        keep = np.isin(lb, [i + 1 for i, s in enumerate(sizes) if s >= keep_frac * big])
        keep = ndi.binary_dilation(ndi.binary_fill_holes(keep), iterations=2)
        out[:, :, z][~keep] = -1000
    return out
