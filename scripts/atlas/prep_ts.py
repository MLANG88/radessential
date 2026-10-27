"""Prepare a TotalSegmentator-dataset case (ct.nii.gz + segmentations/*.nii.gz, expert-reviewed masks) for atlas_build.py.

Usage: python3 prep_ts.py <case_dir> <out_stem> <z_lo_mm_from_bottom|landmark> <z_hi>
  z bounds are slice indices in canonical (RAS) z.
"""
import sys, json, os
import numpy as np, nibabel as nib
from scipy import ndimage as ndi
sys.path.insert(0, '/home/claude')
from anatomy_build import TOTAL, CATS, category, pretty, base_of, strip_outside

SEG_NAMES = {'aorta_ascending': 'Ascending aorta', 'aorta_arch': 'Aortic arch', 'aorta_descending': 'Descending thoracic aorta',
             'aorta_abdominal': 'Abdominal aorta'}

def main():
    case, stem, zlo, zhi = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
    lv_path = sys.argv[5] if len(sys.argv) > 5 else None
    ct_img = nib.as_closest_canonical(nib.load(f'{case}/ct.nii.gz'))
    ct = strip_outside(ct_img.get_fdata().astype(np.float32))
    zooms = [float(z) for z in ct_img.header.get_zooms()[:3]]
    out = np.zeros(ct.shape, np.uint8)
    classes = {}; nid = 0
    masks = {}; zext = {}
    KEEP = ('aorta', 'vertebrae_T12', 'heart')
    for cls in TOTAL:
        p = f'{case}/segmentations/{cls}.nii.gz'
        if not os.path.exists(p): continue
        m = np.asarray(nib.as_closest_canonical(nib.load(p)).dataobj) > 0
        if m[:, :, zlo:zhi + 1].sum() < 30: continue
        z = np.where(m.any(axis=(0, 1)))[0]; zext[cls] = (z.min(), z.max())
        if cls in KEEP: masks[cls] = m
        if cls in ('aorta', 'skull', 'brain'): continue
        nid += 1; classes[nid] = cls; out[m] = nid
        del m
    aorta = masks.get('aorta')
    if aorta is not None:
        zs = np.where(aorta.any(axis=(0, 1)))[0]
        t12 = masks.get('vertebrae_T12'); heart = masks.get('heart')
        if t12 is not None: hiatus = np.where(t12.any(axis=(0, 1)))[0].max()
        elif heart is not None: hiatus = np.where(heart.any(axis=(0, 1)))[0].min()
        else: hiatus = -1
        two = []
        for z in zs:
            lab, n = ndi.label(aorta[:, :, z])
            if n >= 2:
                sizes = ndi.sum(np.ones_like(lab), lab, range(1, n + 1))
                if sum(s >= 15 for s in sizes) >= 2: two.append(z)
        # longest contiguous run of two-lumen slices above the hiatus = ascending + descending
        two = [z for z in two if z > hiatus]
        lo2 = hi2 = None
        if two:
            runs, cur = [], [two[0]]
            for z in two[1:]:
                if z == cur[-1] + 1: cur.append(z)
                else: runs.append(cur); cur = [z]
            runs.append(cur); r = max(runs, key=len); lo2, hi2 = r[0], r[-1]
        ids = {}
        def sid(key):
            nonlocal nid
            if key not in ids:
                nid += 1; classes[nid] = key; ids[key] = nid
            return ids[key]
        for z in zs:
            sl = aorta[:, :, z]
            if z <= hiatus: out[:, :, z][sl] = sid('aorta_abdominal'); continue
            if hi2 is not None and z > hi2: out[:, :, z][sl] = sid('aorta_arch'); continue
            lab, n = ndi.label(sl)
            if lo2 is not None and lo2 <= z <= hi2 and n >= 2:
                sizes = ndi.sum(np.ones_like(lab), lab, range(1, n + 1))
                order = np.argsort(sizes)[::-1][:2] + 1
                cents = [ndi.center_of_mass(lab == k) for k in order]
                ant = order[int(np.argmax([c[1] for c in cents]))]
                for k in range(1, n + 1):
                    out[:, :, z][lab == k] = sid('aorta_ascending' if k == ant else 'aorta_descending')
            else:
                # below the two-lumen run but above the hiatus: descending; above with one lumen: ascending/root
                out[:, :, z][sl] = sid('aorta_descending' if (lo2 is None or z < lo2) else 'aorta_arch')

    # anatomical refinements by level
    EXTRA = {}
    if lv_path:
        lv = np.asarray(nib.as_closest_canonical(nib.load(lv_path)).dataobj).astype(np.int16)
        idof = lambda c: next((k for k, v in classes.items() if v == c), None)
        heart_id = idof('heart'); pv_id = idof('pulmonary_vein')
        lung_ids = [k for k, v in classes.items() if v.startswith('lung_')]
        inlung = np.isin(out, lung_ids)
        def newlab(mask, key, name, cat):
            nonlocal nid
            if mask.sum() < 30: return
            nid += 1; classes[nid] = key; EXTRA[key] = (name, cat); out[mask] = nid
        art = lv == 3
        central = art & ((out == heart_id) | (out == 0)) if heart_id else art & (out == 0)
        # keep only the part connected to the heart-contained trunk
        lb, n = ndi.label(central)
        if n:
            sizes = ndi.sum(central, lb, range(1, n + 1)); keepc = lb == (np.argmax(sizes) + 1)
            newlab(keepc, 'pulmonary_trunk', 'Pulmonary trunk and arteries', 'art')
        newlab(art & inlung, 'lung_arteries', 'Pulmonary arteries (in lung)', 'art')
        vein = (lv == 4) & inlung
        if pv_id: out[vein] = pv_id
        else: newlab(vein, 'lung_veins', 'Pulmonary veins', 'vein')
        newlab((lv == 1) & inlung, 'lung_airways', 'Bronchi', 'lung')
    def zr(cls):
        return zext.get(cls)
    def split(cls, zcut, key, name, cat):
        nonlocal nid
        ids = [k for k, v in classes.items() if v == cls]
        if not ids or zcut is None: return
        sl = out[:, :, :zcut] == ids[0]
        if sl.sum() < 30: return
        nid += 1; classes[nid] = key; EXTRA[key] = (name, cat); out[:, :, :zcut][sl] = nid
    def rename_above(cls, zcut, key, name, cat):
        nonlocal nid
        ids = [k for k, v in classes.items() if v == cls]
        if not ids or zcut is None: return
        sl = out[:, :, zcut:] == ids[0]
        if sl.sum() < 30: return
        nid += 1; classes[nid] = key; EXTRA[key] = (name, cat); out[:, :, zcut:][sl] = nid
    l1 = zr('vertebrae_L1'); s1 = zr('vertebrae_S1')
    split('spinal_cord', l1[0] if l1 else None, 'cauda_equina', 'Cauda equina and thecal sac', 'cns')
    sac = zr('sacrum')
    if sac: split('colon', int(sac[0] + 0.5 * (sac[1] - sac[0])), 'rectum', 'Rectum', 'gi')
    for sd in ('left', 'right'):
        S = sd.capitalize()
        hip = zr(f'hip_{sd}')
        rename_above(f'iliopsoas_{sd}', hip[1] + 1 if hip else None, f'psoas_{sd}', f'{S} psoas major', 'muscle')
        split(f'iliac_artery_{sd}', s1[1] if s1 else None, f'ext_iliac_artery_{sd}', f'{S} external iliac artery', 'art')
        split(f'iliac_vena_{sd}', s1[1] if s1 else None, f'ext_iliac_vein_{sd}', f'{S} external iliac vein', 'vein')

    ct = ct[:, :, zlo:zhi + 1]; out = out[:, :, zlo:zhi + 1]
    body = ct > -400
    lbl, n = ndi.label(body.any(axis=2))
    if n > 1:
        sizes = ndi.sum(np.ones_like(lbl), lbl, range(1, n + 1)); keep = lbl == (np.argmax(sizes) + 1)
    else: keep = lbl > 0
    xs, ys = np.where(keep); pad = 5
    x0, x1 = max(0, xs.min() - pad), min(ct.shape[0], xs.max() + pad + 1)
    y0, y1 = max(0, ys.min() - pad), min(ct.shape[1], ys.max() + pad + 1)
    ct = ct[x0:x1, y0:y1]; out = out[x0:x1, y0:y1]
    # display order [z, row anterior->posterior, col patient right->left]
    img = np.transpose(ct[::-1, ::-1, :], (2, 1, 0)); lab = np.transpose(out[::-1, ::-1, :], (2, 1, 0))
    structs = []
    for k, cls in classes.items():
        if cls in EXTRA: nm, cat = EXTRA[cls]
        else:
            nm = SEG_NAMES.get(cls) or pretty(cls)
            cat = category('aorta_x' if cls.startswith('aorta_') else base_of(cls))
            if cls.startswith('iliac_artery_'): nm = nm.replace('iliac artery', 'common iliac artery')
            if cls.startswith('iliac_vena_'): nm = nm.replace('iliac vein', 'common iliac vein')
        structs.append({'id': k, 'key': cls, 'name': nm, 'cat': cat})
    np.savez_compressed(stem + '.npz', img=img, lab=lab, spacing=np.array([zooms[2], zooms[1], zooms[0]]))
    json.dump({'structures': structs, 'cats': {k: {'name': v[0], 'color': v[1]} for k, v in CATS.items()}, 'modality': 'CT', 'scroll': 'axial'},
              open(stem + '.json', 'w'))
    print(stem, img.shape, len(structs))

if __name__ == '__main__':
    main()
