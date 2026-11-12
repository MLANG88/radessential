"""Original schematic figures for the spinal stenosis grading pages (RadEssential).
Drawn from the published grade definitions; not traced from any image.
Usage: python3 scripts/figures/stenosis_figs.py <out dir>   (writes fig-stenosis-*.svg)
"""
import math, sys, os

OUT = sys.argv[1] if len(sys.argv) > 1 else 'img'
FONT = 'Helvetica Neue, Helvetica, Arial, sans-serif'
INK, MUTED, ACCENT = '#0d1a23', '#566874', '#007590'
CSF, CORD, ROOT, FAT = '#cfe9f5', '#9aa8b2', '#46545f', '#f6e3a6'
BONE, BONE_LN, DISC, LIG = '#ece5d6', '#b9ad93', '#b8c4cc', '#7c8c97'
T2HI = '#ffffff'
GRADE = {0: ('#1f7a4d', '#e1f3e9'), 1: ('#8a6d00', '#fff4cf'), 2: ('#b5530b', '#fde6d4'), 3: ('#b42318', '#fde3e1')}


def text(x, y, s, size=14, weight=400, fill=INK, anchor='start'):
    s = s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    return f'<text x="{x:.1f}" y="{y:.1f}" font-family="{FONT}" font-size="{size}" font-weight="{weight}" fill="{fill}" text-anchor="{anchor}">{s}</text>'


def poly(pts, fill, stroke='none', sw=1.5, close=True):
    d = 'M' + ' L'.join(f'{x:.1f},{y:.1f}' for x, y in pts) + (' Z' if close else '')
    return f'<path d="{d}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}" stroke-linejoin="round"/>'


def frame(title, sub, panels, w=1200, panel_h=360, note=None):
    """panels: list of (grade_key, label, lines[], svg_body_fn(x0, y0, w, h))"""
    n = len(panels)
    top = 100
    h = top + panel_h + 120 + (28 if note else 0)
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">',
           f'<rect width="{w}" height="{h}" fill="#ffffff"/>', f'<rect width="{w}" height="6" fill="{ACCENT}"/>',
           text(32, 48, title, 26, 700), text(32, 74, sub, 14, 400, MUTED)]
    gap = 16
    pw = (w - 64 - gap * (n - 1)) / n
    for i, (g, label, lines, body) in enumerate(panels):
        x0 = 32 + i * (pw + gap)
        col, bg = GRADE[g]
        out.append(f'<rect x="{x0:.1f}" y="{top}" width="{pw:.1f}" height="{panel_h + 100}" rx="14" fill="{bg}"/>')
        out.append(f'<rect x="{x0 + 14:.1f}" y="{top + 14}" width="{pw - 28:.1f}" height="{panel_h - 28}" rx="10" fill="#ffffff"/>')
        out.append(f'<clipPath id="clip{i}"><rect x="{x0 + 14:.1f}" y="{top + 14}" width="{pw - 28:.1f}" height="{panel_h - 28}" rx="10"/></clipPath>')
        out.append(f'<g clip-path="url(#clip{i})">' + body(x0 + 14, top + 14, pw - 28, panel_h - 28) + '</g>')
        out.append(text(x0 + 16, top + panel_h + 26, label, 18, 700, col))
        for k, ln in enumerate(lines):
            out.append(text(x0 + 16, top + panel_h + 50 + k * 19, ln, 13.5, 400, INK))
    if note:
        out.append(text(32, h - 18, note, 12.5, 400, MUTED))
    out.append('</svg>')
    return '\n'.join(out)


def bump(y, yc, amp, width):
    return amp * math.exp(-((y - yc) / width) ** 2)


# ---------- 1. Cervical central canal, sagittal (Kang) ----------
def cervical_canal(ant, post, indent, signal):
    def body(x0, y0, w, h):
        cx, top, bot = x0 + w / 2, y0 + 18, y0 + h - 18
        canal_l, canal_r = cx - 62, cx + 62
        cord_l, cord_r = cx - 26, cx + 26
        yc = (top + bot) / 2
        s = []
        # vertebral bodies (anterior = left) and disc
        s.append(f'<rect x="{x0 + 8:.1f}" y="{top:.1f}" width="{canal_l - x0 - 8:.1f}" height="{yc - 22 - top:.1f}" rx="6" fill="{BONE}" stroke="{BONE_LN}"/>')
        s.append(f'<rect x="{x0 + 8:.1f}" y="{yc + 22:.1f}" width="{canal_l - x0 - 8:.1f}" height="{bot - yc - 22:.1f}" rx="6" fill="{BONE}" stroke="{BONE_LN}"/>')
        s.append(f'<rect x="{x0 + 8:.1f}" y="{yc - 20:.1f}" width="{canal_l - x0 - 8:.1f}" height="40" fill="{DISC}"/>')
        # posterior elements (right)
        s.append(f'<rect x="{canal_r:.1f}" y="{top:.1f}" width="{x0 + w - 8 - canal_r:.1f}" height="{yc - 30 - top:.1f}" rx="6" fill="{BONE}" stroke="{BONE_LN}"/>')
        s.append(f'<rect x="{canal_r:.1f}" y="{yc + 30:.1f}" width="{x0 + w - 8 - canal_r:.1f}" height="{bot - yc - 30:.1f}" rx="6" fill="{BONE}" stroke="{BONE_LN}"/>')
        # CSF column
        s.append(f'<rect x="{canal_l:.1f}" y="{top:.1f}" width="{canal_r - canal_l:.1f}" height="{bot - top:.1f}" fill="{CSF}"/>')
        ys = [top + i * (bot - top) / 80 for i in range(81)]
        aL = [canal_l + bump(y, yc, ant, 16) for y in ys]          # disc–osteophyte from anterior
        aR = [canal_r - bump(y, yc, post, 14) for y in ys]         # ligamentum flavum from posterior
        s.append(poly([(canal_l - 2, ys[0])] + list(zip(aL, ys)) + [(canal_l - 2, ys[-1])], DISC, LIG, 1.2))
        s.append(poly([(canal_r + 2, ys[0])] + list(zip(aR, ys)) + [(canal_r + 2, ys[-1])], LIG, LIG, 1.2))
        # cord, deformed only when indent=True
        cl = [max(cord_l, a + 1.5) if indent else cord_l for a in aL]
        cr = [min(cord_r, a - 1.5) if indent else cord_r for a in aR]
        s.append(poly(list(zip(cl, ys)) + list(zip(cr, ys))[::-1], CORD, '#7d8b95', 1.2))
        if signal:
            s.append(f'<ellipse cx="{(cl[40] + cr[40]) / 2:.1f}" cy="{yc:.1f}" rx="5" ry="20" fill="{T2HI}" stroke="#c9d3d9"/>')
            s.append(text(cx, bot + 2, 'T2 cord signal', 12, 700, '#b42318', 'middle'))
        s.append(text(x0 + 10, top + 14, 'A', 12, 700, MUTED))
        s.append(text(x0 + w - 10, top + 14, 'P', 12, 700, MUTED, 'end'))
        return '\n'.join(s)
    return body


def fig_cervical_canal():
    return frame('Cervical central canal stenosis: Kang grades', 'Sagittal T2 · Kang et al., AJR 2011 · schematic, not to scale', [
        (0, 'Grade 0 · none', ['No canal stenosis'], cervical_canal(3, 2, False, False)),
        (1, 'Grade 1 · mild', ['Obliteration of more than 50%', 'of the subarachnoid space', 'No cord deformity'], cervical_canal(36, 30, False, False)),
        (2, 'Grade 2 · moderate', ['Cord deformity (compression)', 'No cord signal change'], cervical_canal(52, 44, True, False)),
        (3, 'Grade 3 · severe', ['Increased T2 signal in the cord', 'at the compressed level'], cervical_canal(52, 44, True, True)),
    ], note='A CSF cleft between a compressing structure and a deformed cord does not downgrade to grade 1. Any cord signal change is grade 3.')


# ---------- 2. Cervical foramen, axial (Kim) ----------
def cervical_foramen(gap, root_w=18):
    def body(x0, y0, w, h):
        s = []
        cy = y0 + h / 2 + 6
        x_in, x_out = x0 + 46, x0 + w - 10
        mid = x0 + w * 0.48
        # canal (left) with cord edge
        s.append(f'<rect x="{x0 + 6:.1f}" y="{cy - 70:.1f}" width="{x_in - x0 - 6:.1f}" height="140" rx="10" fill="{CSF}"/>')
        s.append(f'<rect x="{x0 + 6:.1f}" y="{cy - 46:.1f}" width="22" height="92" rx="10" fill="{CORD}"/>')
        xs = [x_in + i * (x_out - x_in) / 80 for i in range(81)]
        half = lambda x: (gap / 2) + (32 - gap / 2) * (1 - math.exp(-((x - mid) / 26) ** 2))  # channel half-height
        top_wall = [cy - half(x) for x in xs]
        bot_wall = [cy + half(x) for x in xs]
        s.append(poly([(x_in, cy - 95)] + list(zip(xs, top_wall)) + [(x_out, cy - 95)], BONE, BONE_LN))
        s.append(poly([(x_in, cy + 95)] + list(zip(xs, bot_wall)) + [(x_out, cy + 95)], BONE, BONE_LN))
        s.append(text(mid, cy - 74, 'Uncovertebral joint', 11.5, 600, MUTED, 'middle'))
        s.append(text(mid, cy + 88, 'Superior articular process', 11.5, 600, MUTED, 'middle'))
        # nerve root band, squeezed where the channel is narrower than the root
        rt = [cy - min(root_w / 2, half(x) - 1) for x in xs]
        rb = [cy + min(root_w / 2, half(x) - 1) for x in xs]
        s.append(poly(list(zip(xs, rt)) + list(zip(xs, rb))[::-1], ROOT))
        # measurements: narrowest foramen (red) vs extraforaminal root (teal)
        xr = x_out - 20
        s.append(f'<line x1="{mid:.1f}" y1="{cy - gap / 2:.1f}" x2="{mid:.1f}" y2="{cy + gap / 2:.1f}" stroke="#d92d20" stroke-width="2.5"/>')
        s.append(f'<line x1="{xr:.1f}" y1="{cy - root_w / 2:.1f}" x2="{xr:.1f}" y2="{cy + root_w / 2:.1f}" stroke="#3cc6da" stroke-width="3"/>')
        s.append(text(mid, y0 + 16, 'narrowest foramen', 11.5, 700, '#d92d20', 'middle'))
        s.append(text(xr, y0 + 32, 'extraforaminal root', 11.5, 700, ACCENT, 'end'))
        s.append(text(x0 + 10, cy - 76, 'Canal', 11, 700, MUTED))
        return '\n'.join(s)
    return body


def fig_cervical_foramen():
    return frame('Cervical foraminal stenosis: Kim grades', 'Axial T2 · Kim et al., Korean J Radiol 2015 · reference = width of the extraforaminal root · schematic', [
        (0, 'Grade 0 · none', ['Narrowest foramen wider than', 'the extraforaminal root'], cervical_foramen(30)),
        (1, 'Grade 1 · non-severe', ['Foramen ≤ root width', 'but more than 50% of it'], cervical_foramen(13)),
        (3, 'Grade 2 · severe', ['Foramen ≤ 50% of the', 'extraforaminal root width'], cervical_foramen(6)),
    ], note='If the extraforaminal root is not seen, use the contralateral root, or the distance from the vertebral artery to the superior articular process (Seo et al., 2023).')


# ---------- 3. Lumbar central canal, axial (Lee) ----------
def lumbar_central(push, squeeze, roots):
    """push: posterior disc bulge into the canal (px); squeeze: posterolateral ligamentum flavum/facet narrowing (px);
    roots: 'separate' | 'some' | 'bundle'."""
    def body(x0, y0, w, h):
        s = []
        cx = x0 + w / 2
        s.append(f'<rect x="{x0:.1f}" y="{y0:.1f}" width="{w:.1f}" height="{h:.1f}" fill="#fbf0c9"/>')  # epidural fat
        disc_back = y0 + 104                      # posterior margin of the disc, anterior = top
        cy, rx0, ry0 = y0 + 168, 64, 50           # normal dural sac
        # vertebral body / disc
        db = lambda x: disc_back + push * math.exp(-((x - cx) / 48) ** 2)
        xs = [x0 + i * w / 60 for i in range(61)]
        s.append(poly([(x0, y0)] + [(x, db(x)) for x in xs] + [(x0 + w, y0)], DISC, LIG, 1.2))
        s.append(text(cx, y0 + 40, 'disc', 12, 600, '#4b5a64', 'middle'))
        # posterior elements: facets + lamina with ligamentum flavum lining
        lam = [(x0, y0 + 150), (cx - 76 + squeeze, y0 + 140), (cx - 56 + squeeze * .6, y0 + 214), (cx, y0 + 262), (cx + 56 - squeeze * .6, y0 + 214), (cx + 76 - squeeze, y0 + 140), (x0 + w, y0 + 150), (x0 + w, y0 + h), (x0, y0 + h)]
        s.append(poly(lam, BONE, BONE_LN))
        lf_in = [(cx - 76 + squeeze, y0 + 140), (cx - 56 + squeeze * .6, y0 + 214), (cx, y0 + 262), (cx + 56 - squeeze * .6, y0 + 214), (cx + 76 - squeeze, y0 + 140)]
        lf_out = [(cx + 76 - squeeze + 12, y0 + 142), (cx + 60 - squeeze * .6 + 10, y0 + 222), (cx, y0 + 276), (cx - 60 + squeeze * .6 - 10, y0 + 222), (cx - 76 + squeeze - 12, y0 + 142)]
        s.append(poly(lf_in + lf_out, LIG))
        s.append(text(cx, y0 + h - 14, 'lamina', 12, 600, MUTED, 'middle'))
        s.append(text(x0 + 8, y0 + 132, 'facet', 11, 600, MUTED))
        # dural sac: ellipse flattened by the disc in front and narrowed by the flavum laterally
        rx = rx0 - squeeze * 0.7
        pts = []
        for i in range(90):
            t = 2 * math.pi * i / 90
            x = cx + rx * math.cos(t)
            y = cy + ry0 * math.sin(t)
            y = max(y, db(x) + 3)
            pts.append((x, y))
        ys = [p[1] for p in pts]
        top_y, bot_y = min(ys), max(ys)
        s.append(poly(pts, CSF, '#7fb0c4', 1.6))
        # rootlets, layered dorsally (supine)
        def dot(x, y, r=4.8):
            s.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r}" fill="{ROOT}"/>')
        if roots == 'separate':
            span = rx * 0.7
            for row, (n, dy) in enumerate([(7, 0.62), (6, 0.36), (4, 0.12)]):
                for k in range(n):
                    x = cx - span * (1 - row * 0.12) + k * 2 * span * (1 - row * 0.12) / (n - 1)
                    y = top_y + (bot_y - top_y) * (1 - (1 - dy) * 0.5) - 12 * row * 0
                    dot(x, top_y + (bot_y - top_y) * (0.86 - 0.22 * row))
        elif roots == 'some':
            for x in (-0.66, -0.4, 0.4, 0.66):
                dot(cx + rx * x, top_y + (bot_y - top_y) * 0.62)
            for k in range(10):
                a = 2 * math.pi * k / 10
                dot(cx + 11 * math.cos(a), top_y + (bot_y - top_y) * 0.6 + 7 * math.sin(a), 5.2)
            dot(cx, top_y + (bot_y - top_y) * 0.6, 5.2)
        elif roots == 'aggregate':  # roots clumped, only a thin rim of CSF left
            inner = [(cx + (x - cx) * 0.8, (top_y + bot_y) / 2 + (y - (top_y + bot_y) / 2) * 0.72) for x, y in pts]
            s.append(poly(inner, '#5d6b75'))
            for k in range(12):
                a = 2 * math.pi * k / 12
                dot(cx + rx * 0.42 * math.cos(a), (top_y + bot_y) / 2 + 3 + (bot_y - top_y) * 0.2 * math.sin(a), 4.6)
        else:  # cauda equina as one bundle filling the compressed sac, no CSF between roots
            s.append(poly(pts, '#5d6b75', '#7fb0c4', 1.6))
            for k in range(7):
                dot(cx - 27 + k * 9, (top_y + bot_y) / 2 + 2, 4.6)
            for k in range(5):
                dot(cx - 18 + k * 9, (top_y + bot_y) / 2 + 11, 4.6)
        s.append(text(x0 + 8, y0 + 18, 'A', 12, 700, '#4b5a64'))
        return '\n'.join(s)
    return body


def fig_lumbar_central():
    return frame('Lumbar central canal stenosis: Lee grades', 'Axial T2 · Lee et al., Skeletal Radiol 2011 · schematic, not to scale', [
        (0, 'Grade 0 · none', ['Anterior CSF space', 'not obliterated'], lumbar_central(4, 0, 'separate')),
        (1, 'Grade 1 · mild', ['Anterior CSF mildly obliterated', 'All roots clearly separated'], lumbar_central(30, 4, 'separate')),
        (2, 'Grade 2 · moderate', ['Some roots aggregated', '(cannot be separated)'], lumbar_central(48, 16, 'some')),
        (3, 'Grade 3 · severe', ['Marked sac compression', 'Roots form one bundle'], lumbar_central(66, 28, 'bundle')),
    ], note='Grade 0 vs 1 is the hard call: use consecutive sagittal T2 images to see whether the ventral CSF is obliterated (Seo et al., 2023).')


# ---------- 4. Neural foramen, sagittal (Lee lumbar; Park cervical) ----------
def foramen_sag(sides, deform=False, partial=None, rim=None):
    """Sagittal neural foramen (anterior = left). The exiting root sits in the upper foramen, ringed by fat.
    sides: subset of 'udap' (up, down, anterior, posterior) where the fat is obliterated (Lee).
    partial: fraction 0–1 of the root circumference with fat obliterated, centred posteriorly (Park)."""
    def body(x0, y0, w, h):
        s = [f'<rect x="{x0:.1f}" y="{y0:.1f}" width="{w:.1f}" height="{h:.1f}" fill="{BONE}"/>']
        cx, cy = x0 + w / 2, y0 + h * 0.42
        rr = 15
        # disc at the anteroinferior margin of the foramen
        s.append(text(cx, y0 + 26, 'pedicle', 12, 600, '#8a7d62', 'middle'))
        s.append(text(cx, y0 + h - 14, 'pedicle', 12, 600, '#8a7d62', 'middle'))
        s.append(text(x0 + w - 10, cy + 6, 'facet', 12, 600, '#8a7d62', 'end'))
        s.append(text(x0 + 10, cy - 30, 'vertebral', 12, 600, '#8a7d62'))
        s.append(text(x0 + 10, cy - 15, 'body', 12, 600, '#8a7d62'))
        def base(t):   # inverted teardrop: roomy below the root
            up, down, side = 38, 92, 44
            sn = math.sin(t)
            return (up if sn > 0 else down) * abs(sn) ** 1.4 + side * (1 - abs(sn) ** 1.4)
        dirs = {'u': math.pi / 2, 'd': -math.pi / 2, 'a': math.pi, 'p': 0}
        def R(t):
            r = base(t)
            for k in sides:
                d = math.atan2(math.sin(t - dirs[k]), math.cos(t - dirs[k]))
                r = min(r, rr + 1.5 + (r - rr - 1.5) * (1 - math.exp(-(d / 0.5) ** 2)))
            if rim is not None:
                return rr + rim
            if partial:
                d = abs(math.atan2(math.sin(t), math.cos(t)))
                if d < math.pi * partial:
                    r = rr + 1.5
            return r
        pts = [(cx + R(2 * math.pi * i / 180) * math.cos(2 * math.pi * i / 180), cy - R(2 * math.pi * i / 180) * math.sin(2 * math.pi * i / 180)) for i in range(180)]
        if rim != 0:
            s.append(poly(pts, FAT, '#c9ad55', 1.4))
        s.append(f'<path d="M{x0:.1f},{cy + 48:.1f} L{cx - 18:.1f},{cy + 48:.1f} Q{cx - 4:.1f},{cy + 50:.1f} {cx - 6:.1f},{cy + 70:.1f} L{cx - 10:.1f},{cy + 96:.1f} L{x0:.1f},{cy + 96:.1f} Z" fill="{DISC}" stroke="{LIG}" stroke-width="1.2"/>')
        s.append(text(x0 + 10, cy + 78, 'disc', 12, 600, '#4b5a64'))
        rx, ry = (rr + 8, rr - 8) if deform else (rr, rr)
        s.append(f'<ellipse cx="{cx:.1f}" cy="{cy:.1f}" rx="{rx}" ry="{ry}" fill="{ROOT}"/>')
        s.append(text(x0 + 10, y0 + 18, 'A', 12, 700, '#4b5a64'))
        s.append(text(x0 + w - 10, y0 + 18, 'P', 12, 700, '#4b5a64', 'end'))
        return '\n'.join(s)
    return body


def fig_lumbar_foramen():
    return frame('Lumbar foraminal stenosis: Lee grades', 'Sagittal T1 · Lee et al., AJR 2010 · yellow = perineural fat, dark = exiting root · schematic', [
        (0, 'Grade 0 · none', ['Fat surrounds the root'], foramen_sag('')),
        (1, 'Grade 1 · mild', ['Fat obliterated in one opposing', 'pair: vertical or transverse'], foramen_sag('ud')),
        (2, 'Grade 2 · moderate', ['Fat obliterated in all four', 'directions, root not deformed'], foramen_sag('udap')),
        (3, 'Grade 3 · severe', ['Root collapse or', 'morphologic change'], foramen_sag('udap', deform=True)),
    ], note='Obliteration on one side only, with the opposite side preserved, is not stenosis. A collapsed root is grade 3 even if some fat is still visible.')


def fig_cervical_foramen_park():
    return frame('Cervical foraminal stenosis: Park grades', 'Oblique sagittal T2 · Park et al., Br J Radiol 2013 · at the point of maximal narrowing · yellow = fat, dark = root · schematic', [
        (0, 'Grade 0 · none', ['No perineural fat obliteration'], foramen_sag('')),
        (1, 'Grade 1 · mild', ['Fat obliteration < 50% of', 'the root circumference', 'No root deformity'], foramen_sag('', partial=0.32)),
        (2, 'Grade 2 · moderate', ['Fat obliteration > 50% of', 'the root circumference', 'No root deformity'], foramen_sag('', partial=0.8)),
        (3, 'Grade 3 · severe', ['Root collapse or morphologic', 'change, often with severe', 'fat obliteration'], foramen_sag('udap', deform=True)),
    ])


# ---------- Kaiser Permanente Northern California reporting scheme (Mamlouk) ----------
KP = 'Normal / mild / moderate / severe, as in the Kaiser Permanente Northern California reporting guide (Mamlouk)'


def cervical_foramen_kp(frac):
    """Axial cervical foramen at the nerve level; frac = fraction of the foramen effaced."""
    def body(x0, y0, w, h):
        s = []
        cy = y0 + h / 2 + 4
        x_in, x_out = x0 + 46, x0 + w - 10
        mid = x0 + w * 0.5
        H = 30                                   # normal half-height of the foramen
        gap_half = max(0.0, H * (1 - frac))
        s.append(f'<rect x="{x0 + 6:.1f}" y="{cy - 70:.1f}" width="{x_in - x0 - 6:.1f}" height="140" rx="10" fill="{CSF}"/>')
        s.append(f'<rect x="{x0 + 6:.1f}" y="{cy - 46:.1f}" width="22" height="92" rx="10" fill="{CORD}"/>')
        xs = [x_in + i * (x_out - x_in) / 80 for i in range(81)]
        half = lambda x: gap_half + (H - gap_half) * (1 - math.exp(-((x - mid) / 30) ** 2))
        # foramen contents (fat and veins) then walls
        s.append(poly([(x, cy - H) for x in xs] + [(x, cy + H) for x in xs][::-1], FAT))
        s.append(poly([(x_in, cy - 95)] + [(x, cy - half(x)) for x in xs] + [(x_out, cy - 95)], BONE, BONE_LN))
        s.append(poly([(x_in, cy + 95)] + [(x, cy + half(x)) for x in xs] + [(x_out, cy + 95)], BONE, BONE_LN))
        s.append(text(mid, cy - 76, 'Uncovertebral joint', 11.5, 600, MUTED, 'middle'))
        s.append(text(mid, cy + 90, 'Facet (superior articular process)', 11.5, 600, MUTED, 'middle'))
        rw = 16
        rt = [cy - max(1.2, min(rw / 2, half(x) - 1)) for x in xs]
        rb = [cy + max(1.2, min(rw / 2, half(x) - 1)) for x in xs]
        s.append(poly(list(zip(xs, rt)) + list(zip(xs, rb))[::-1], ROOT))
        # dashed outline of the normal foramen at the nerve level
        s.append(f'<rect x="{mid - 26:.1f}" y="{cy - H:.1f}" width="52" height="{2 * H}" fill="none" stroke="#d92d20" stroke-width="1.6" stroke-dasharray="5 4"/>')
        lab = 'no effacement' if frac == 0 else ('complete effacement' if frac >= 1 else f'≈{round(frac * 100)}% effaced')
        s.append(text(mid, y0 + 18, lab, 13, 700, '#d92d20', 'middle'))
        s.append(text(x0 + 10, cy - 76, 'Canal', 11, 700, MUTED))
        return '\n'.join(s)
    return body


def fig_cervical_canal_kp():
    return frame('Cervical central canal stenosis', 'Sagittal T2 · ' + KP + ' · schematic', [
        (0, 'Normal', ['No CSF effacement'], cervical_canal(3, 2, False, False)),
        (1, 'Mild', ['Partial CSF effacement:', 'ventral, dorsal, or both'], cervical_canal(20, 16, False, False)),
        (2, 'Moderate', ['Complete CSF effacement,', '± slight cord indentation'], cervical_canal(39, 39, True, False)),
        (3, 'Severe', ['Complete CSF effacement and', 'frank cord compression'], cervical_canal(56, 50, True, False)),
    ], note='Cord signal change (myelopathy) can occur with moderate or severe stenosis and is reported separately from the grade.')


def fig_cervical_foramen_kp():
    return frame('Cervical foraminal stenosis', 'Axial T2 at the nerve level · ' + KP + ' · schematic', [
        (0, 'Normal', ['No foraminal effacement'], cervical_foramen_kp(0)),
        (1, 'Mild', ['Less than 50% of the foramen', 'effaced at the nerve level'], cervical_foramen_kp(0.35)),
        (2, 'Moderate', ['More than 50% of the foramen', 'effaced at the nerve level'], cervical_foramen_kp(0.72)),
        (3, 'Severe', ['Complete foraminal', 'effacement'], cervical_foramen_kp(1.0)),
    ], note='Judge the percentage as an average over the few axial slices at the level of the nerve. Dashed box = expected size of the foramen.')


def fig_lumbar_central_kp():
    return frame('Lumbar central canal stenosis', 'Axial T2 · ' + KP + ' · schematic', [
        (0, 'Normal', ['No CSF effacement'], lumbar_central(4, 0, 'separate')),
        (1, 'Mild', ['Some CSF effacement; nerve', 'roots clearly separable'], lumbar_central(28, 4, 'separate')),
        (2, 'Moderate', ['Roots aggregated, near-total', 'CSF effacement'], lumbar_central(50, 16, 'aggregate')),
        (3, 'Severe', ['Total CSF effacement', 'and sac deformity'], lumbar_central(68, 28, 'bundle')),
    ], note='Based on Lee et al., Skeletal Radiol 2011. Use consecutive sagittal T2 images when normal vs mild is unclear.')


def fig_lumbar_foramen_kp():
    return frame('Lumbar foraminal stenosis', 'Sagittal T1 · ' + KP + ' · yellow = fat, dark = nerve root · schematic', [
        (0, 'Normal', ['No fat effacement;', 'keyhole appearance'], foramen_sag('')),
        (1, 'Mild', ['Some fat effacement in the', 'vertical or transverse direction'], foramen_sag('ud')),
        (2, 'Moderate', ['Near-total effacement', 'of fat'], foramen_sag('', rim=4)),
        (3, 'Severe', ['Total effacement of fat', 'and/or nerve deformity'], foramen_sag('', deform=True, rim=0)),
    ], note='Based on Lee et al., AJR 2010 and Wildermuth et al., Radiology 1998. Mild panel shows vertical narrowing (pedicle above, disc below); transverse narrowing is graded the same.')


os.makedirs(OUT, exist_ok=True)
for name, fn in [('fig-stenosis-cervical-canal', fig_cervical_canal_kp), ('fig-stenosis-cervical-foramen', fig_cervical_foramen_kp),
                 ('fig-stenosis-lumbar-central', fig_lumbar_central_kp), ('fig-stenosis-lumbar-foramen', fig_lumbar_foramen_kp)]:
    open(os.path.join(OUT, name + '.svg'), 'w').write(fn())
    print(name)
