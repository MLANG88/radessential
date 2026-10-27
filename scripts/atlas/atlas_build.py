"""Generic atlas exporter.

Input: an .npz written by a prep_* script with
  img    float32 [Z, H, W]  display order: z = scroll axis (index 0 = bottom/first), row = top->bottom, col = left->right on screen
  lab    uint8   [Z, H, W]  structure ids (0 = background)
  spacing  [sz, sy, sx] mm
and a sidecar JSON (same stem) with
  {"structures":[{"id","key","name","cat"}], "cats":{key:{name,color}}, "modality":"CT"|"MR", "scroll":"axial"|"sagittal"}

Writes site/anatomy/<name>/: meta.json, ct_<k>.webp (lossy image chunks), lab_<k>.webp (lossless label chunks).

Usage: python3 atlas_build.py <name> <prep.npz> [--up 2] [--q 90] [--chunk 24]
"""
import sys, json, os, math
import numpy as np
from scipy import ndimage as ndi
from PIL import Image

def arg(flag, default, cast):
    return cast(sys.argv[sys.argv.index(flag) + 1]) if flag in sys.argv else default

def upsample_labels(lab, f):
    """Smooth in-plane label upsampling: per-label linear interpolation of its indicator, argmax with 0.5 floor."""
    Z, H, W = lab.shape
    out = np.zeros((Z, int(round(H * f)), int(round(W * f))), np.uint8)
    best = np.full(out.shape, 0.5, np.float32)
    for k in np.unique(lab):
        if k == 0: continue
        m = lab == k
        zz, yy, xx = np.where(m)
        z0, z1 = zz.min(), zz.max() + 1
        y0, y1 = max(0, yy.min() - 2), min(H, yy.max() + 3)
        x0, x1 = max(0, xx.min() - 2), min(W, xx.max() + 3)
        sub = m[z0:z1, y0:y1, x0:x1].astype(np.float32)
        up = ndi.zoom(sub, (1, f, f), order=1, grid_mode=True, mode='nearest')
        Y0, X0 = int(round(y0 * f)), int(round(x0 * f))
        Y1, X1 = min(out.shape[1], Y0 + up.shape[1]), min(out.shape[2], X0 + up.shape[2])
        up = up[:, :Y1 - Y0, :X1 - X0]
        b = best[z0:z1, Y0:Y1, X0:X1]; o = out[z0:z1, Y0:Y1, X0:X1]
        win = up > b
        b[win] = up[win]; o[win] = k
    return out

def main():
    name, npz = sys.argv[1], sys.argv[2]
    up = arg('--up', 2.0, float); q = arg('--q', 90, int); chunk = arg('--chunk', 24, int)
    side = json.load(open(npz[:-4] + '.json'))
    d = np.load(npz)
    img, lab, spacing = d['img'].astype(np.float32), d['lab'].astype(np.uint8), [float(s) for s in d['spacing']]
    modality = side.get('modality', 'CT')

    if modality == 'CT':
        knots_hu = np.array([-1024, -200, 400, 2000], float); knots_v = np.array([0, 64, 224, 255], float)
        lut = np.round(np.interp(np.arange(256), knots_v, knots_hu)).astype(int).tolist()
        to8 = lambda a: np.clip(np.round(np.interp(np.clip(a, -1024, 2000), knots_hu, knots_v)), 0, 255).astype(np.uint8)
    else:
        lo, hi = np.percentile(img[img > np.percentile(img, 5)], [0.5, 99.7])
        lut = list(range(256))
        to8 = lambda a: np.clip(np.round((a - lo) / (hi - lo) * 255), 0, 255).astype(np.uint8)

    if up != 1:
        img = ndi.zoom(img, (1, up, up), order=3, grid_mode=True, mode='nearest')
        lab = upsample_labels(lab, up)
        spacing = [spacing[0], spacing[1] / up, spacing[2] / up]
    im8 = to8(img)
    Z, H, W = im8.shape

    od = f'/home/claude/site/anatomy/{name}'
    os.makedirs(od, exist_ok=True)
    for f in os.listdir(od): os.remove(os.path.join(od, f))
    chunks = []
    for k, z0 in enumerate(range(0, Z, chunk)):
        n = min(chunk, Z - z0)
        cols = int(math.ceil(math.sqrt(n * H / W)))
        rows = int(math.ceil(n / cols))
        mi = np.zeros((rows * H, cols * W), np.uint8); ml = np.zeros_like(mi)
        for i in range(n):
            r, c = divmod(i, cols)
            mi[r * H:(r + 1) * H, c * W:(c + 1) * W] = im8[z0 + i]
            ml[r * H:(r + 1) * H, c * W:(c + 1) * W] = lab[z0 + i]
        Image.fromarray(mi, 'L').convert('RGB').save(f'{od}/ct_{k}.webp', quality=q, method=6)
        Image.fromarray(ml, 'L').convert('RGB').save(f'{od}/lab_{k}.webp', lossless=True, quality=100, method=6)
        chunks.append({'ct': f'ct_{k}.webp', 'lab': f'lab_{k}.webp', 'z0': z0, 'n': n, 'cols': cols})

    present = set(np.unique(lab).tolist()) - {0}
    structs = [s for s in side['structures'] if s['id'] in present]
    meta = {'v': 2, 'modality': modality, 'scroll': side.get('scroll', 'axial'), 'lut': lut, 'shape': [Z, H, W], 'spacing': spacing,
            'chunks': chunks, 'cats': side['cats'], 'structures': structs}
    for k in ('levels', 'orient'):
        if k in side: meta[k] = side[k]
    json.dump(meta, open(od + '/meta.json', 'w'), separators=(',', ':'))
    tot = sum(os.path.getsize(os.path.join(od, f)) for f in os.listdir(od))
    print(name, 'shape', meta['shape'], 'spacing', [round(s, 3) for s in spacing], 'structures', len(structs), 'chunks', len(chunks), 'total', tot // 1024, 'KB')

if __name__ == '__main__':
    main()
