"""Original explanatory figures for BI-RADS, C-RADS and CAD-RADS 2.0 (SVG)."""
import math, random, os
OUT = '/home/claude/site/img/'
random.seed(7)

INK = '#0f1b24'; MUTED = '#566874'; LINE = '#dbe3e7'; SUNK = '#f1f5f7'; TEAL = '#007590'; NAVY = '#0d1a23'
OK, OKB = '#1f7a4d', '#e1f3e9'; WARN, WARNB = '#985c00', '#fcefd7'; CRIT, CRITB = '#b0281e', '#fbe4e1'; INFO, INFOB = '#245d8f', '#e3eef8'
GREY, GREYB = '#566874', '#eef2f4'
FONT = "Helvetica Neue, Helvetica, Arial, sans-serif"

def esc(s): return str(s).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')

class SVG:
    def __init__(s, w, h): s.w, s.h, s.p = w, h, []
    def add(s, x): s.p.append(x)
    def rect(s, x, y, w, h, fill='none', stroke='none', rx=0, sw=1, extra=''):
        s.add(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}" {extra}/>')
    def text(s, x, y, t, size=14, weight=400, fill=INK, anchor='start', italic=False):
        st = ' font-style="italic"' if italic else ''
        s.add(f'<text x="{x}" y="{y}" font-family="{FONT}" font-size="{size}" font-weight="{weight}" fill="{fill}" text-anchor="{anchor}"{st}>{esc(t)}</text>')
    def lines(s, x, y, arr, size=13, lh=17, **k):
        for i, t in enumerate(arr): s.text(x, y + i * lh, t, size, **k)
    def circle(s, cx, cy, r, fill='none', stroke='none', sw=1, extra=''):
        s.add(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r:.1f}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}" {extra}/>')
    def path(s, d, fill='none', stroke=INK, sw=1.5, extra=''):
        s.add(f'<path d="{d}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round" {extra}/>')
    def line(s, x1, y1, x2, y2, stroke=LINE, sw=1, extra=''):
        s.add(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{stroke}" stroke-width="{sw}" stroke-linecap="round" {extra}/>')
    def header(s, title, sub):
        s.rect(0, 0, s.w, s.h, '#ffffff')
        s.rect(0, 0, s.w, 6, TEAL)
        s.text(32, 48, title, 26, 700, NAVY)
        s.text(32, 74, sub, 14, 400, MUTED)
    def badge(s, x, y, w, h, label, fg, bg, size=18):
        s.rect(x, y, w, h, bg, fg, 8, 1.5)
        s.text(x + w / 2, y + h / 2 + size * 0.36, label, size, 700, fg, 'middle')
    def save(s, name, defs=''):
        svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {s.w} {s.h}" width="{s.w}" height="{s.h}"><defs>{defs}</defs>' + ''.join(s.p) + '</svg>'
        open(OUT + name + '.svg', 'w').write(svg)

def blob(cx, cy, r, n=9, jit=0.25, seed=None):
    rnd = random.Random(seed)
    pts = []
    for i in range(n):
        a = 2 * math.pi * i / n
        rr = r * (1 + rnd.uniform(-jit, jit))
        pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
    d = f'M{pts[0][0]:.1f},{pts[0][1]:.1f} '
    for i in range(n):
        p0 = pts[i]; p1 = pts[(i + 1) % n]
        mx, my = (p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2
        d += f'Q{p0[0]:.1f},{p0[1]:.1f} {mx:.1f},{my:.1f} '
    return d + 'Z'

# ---------------------------------------------------------------- BI-RADS categories
def birads_categories():
    rows = [
        ('0', 'Incomplete', 'Needs additional imaging or priors', None, 'Recall for additional imaging', GREY, GREYB),
        ('1', 'Negative', 'Essentially 0%', (0, 0), 'Routine screening', OK, OKB),
        ('2', 'Benign', 'Essentially 0%', (0, 0), 'Routine screening', OK, OKB),
        ('3', 'Probably benign', '>0% to ≤2%', (0, 2), 'Short-interval follow-up (6 months)', WARN, WARNB),
        ('4A', 'Low suspicion', '>2% to ≤10%', (2, 10), 'Tissue diagnosis', CRIT, CRITB),
        ('4B', 'Moderate suspicion', '>10% to ≤50%', (10, 50), 'Tissue diagnosis', CRIT, CRITB),
        ('4C', 'High suspicion', '>50% to <95%', (50, 95), 'Tissue diagnosis', CRIT, CRITB),
        ('5', 'Highly suggestive', '≥95%', (95, 100), 'Tissue diagnosis', CRIT, CRITB),
        ('6', 'Known malignancy', 'Biopsy-proven', None, 'Surgical excision when appropriate', INFO, INFOB),
    ]
    W, top, rh = 1200, 150, 54
    s = SVG(W, top + rh * len(rows) + 250)
    s.header('BI-RADS assessment categories', 'ACR BI-RADS Atlas, 5th edition · mammography, ultrasound and MRI (4A/4B/4C for mammography and US only)')
    cx = [32, 120, 420, 790]
    for i, h in enumerate(['CATEGORY', 'ASSESSMENT', 'LIKELIHOOD OF MALIGNANCY', 'MANAGEMENT']):
        s.text(cx[i], top - 16, h, 11, 700, MUTED)
    bx, bw = 420, 330
    for i, (c, a, l, rng, m, fg, bg) in enumerate(rows):
        y = top + i * rh
        if i % 2 == 0: s.rect(20, y, W - 40, rh, SUNK, rx=8)
        s.badge(cx[0] + 4, y + 9, 64, rh - 18, c, fg, bg)
        s.text(cx[1], y + 32, a, 17, 700, INK)
        s.text(cx[3], y + 32, m, 15, 600, fg)
        if rng:
            s.rect(bx, y + 16, bw, 10, '#e4eaee', rx=5)
            x0 = bx + bw * rng[0] / 100; x1 = bx + bw * rng[1] / 100
            s.rect(x0, y + 16, max(4, x1 - x0), 10, fg, rx=5)
            s.text(bx, y + 44, l, 12.5, 600, fg)
        else:
            s.text(bx, y + 32, l, 13.5, 400, MUTED, italic=True)
    y = top + rh * len(rows) + 8
    s.text(bx, y + 4, '0%', 11, 400, MUTED); s.text(bx + bw, y + 4, '100%', 11, 400, MUTED, 'end')
    # breast composition
    y0 = y + 40
    s.line(32, y0 - 10, W - 32, y0 - 10)
    s.text(32, y0 + 18, 'BREAST COMPOSITION (MAMMOGRAPHY)', 11, 700, MUTED)
    comp = [('a', 'Almost entirely fatty', 0.06), ('b', 'Scattered fibroglandular density', 0.25),
            ('c', 'Heterogeneously dense; may obscure small masses', 0.55), ('d', 'Extremely dense; lowers sensitivity', 0.85)]
    for i, (k, d, frac) in enumerate(comp):
        x = 32 + i * 290
        # breast outline (CC view-like half oval)
        s.path(f'M{x+10},{y0+40} Q{x+10},{y0+150} {x+80},{y0+160} Q{x+150},{y0+150} {x+150},{y0+40}', '#3b434a', '#2a3036', 1)
        rnd = random.Random(i + 3)
        n = int(500 * frac)
        for _ in range(n):
            px = rnd.uniform(x + 18, x + 142); py = rnd.uniform(y0 + 44, y0 + 150)
            # keep inside rough outline
            if (px - (x + 80)) ** 2 / 70 ** 2 + (py - (y0 + 40)) ** 2 / 118 ** 2 < 1:
                s.circle(px, py, rnd.uniform(2, 5), '#e9eef1', extra='opacity="0.75"')
        s.text(x + 170, y0 + 80, k, 28, 700, TEAL)
        s.lines(x + 170, y0 + 104, wrap(d, 16), 12.5, 16, fill=INK)
    s.save('fig-birads-categories')

def wrap(t, n):
    out, cur = [], ''
    for w in t.split():
        if len(cur) + len(w) + 1 > n and cur: out.append(cur); cur = w
        else: cur = (cur + ' ' + w).strip()
    if cur: out.append(cur)
    return out

# ---------------------------------------------------------------- BI-RADS mammography lexicon
def birads_mammo():
    W = 1200
    s = SVG(W, 1000)
    s.header('BI-RADS mammography lexicon', 'Mass descriptors and calcifications at a glance · ACR BI-RADS Atlas, 5th edition')
    def card(x, y, w, h, title, tone=TEAL):
        s.rect(x, y, w, h, '#ffffff', LINE, 12, 1.2)
        s.text(x + 16, y + 26, title, 12, 700, tone)
    # Mass shape
    card(32, 100, 360, 190, 'MASS · SHAPE')
    for i, (lbl, kind) in enumerate([('Oval', 'oval'), ('Round', 'round'), ('Irregular', 'irr')]):
        cx = 92 + i * 120; cy = 185
        if kind == 'oval': s.add(f'<ellipse cx="{cx}" cy="{cy}" rx="44" ry="28" fill="#cfd8dd" stroke="{INK}" stroke-width="1.5"/>')
        elif kind == 'round': s.circle(cx, cy, 33, '#cfd8dd', INK, 1.5)
        else: s.path(blob(cx, cy, 36, 11, 0.32, 4), '#cfd8dd', INK, 1.5)
        s.text(cx, 255, lbl, 14, 600, INK, 'middle')
    # Margin
    card(408, 100, 760, 190, 'MASS · MARGIN  (suspicion rises from left to right)')
    marg = ['Circumscribed', 'Obscured', 'Microlobulated', 'Indistinct', 'Spiculated']
    for i, lbl in enumerate(marg):
        cx = 482 + i * 150; cy = 185
        if lbl == 'Circumscribed': s.circle(cx, cy, 32, '#cfd8dd', INK, 1.6)
        elif lbl == 'Obscured':
            s.circle(cx, cy, 32, '#cfd8dd', INK, 1.6)
            s.path(blob(cx + 22, cy - 6, 28, 9, 0.3, 9), '#e9eef1', '#9fb0ba', 1, 'opacity="0.95"')
        elif lbl == 'Microlobulated':
            d = ''
            for k in range(73):
                a = 2 * math.pi * k / 72; r = 32 + 3.2 * math.sin(14 * a)
                d += ('M' if k == 0 else 'L') + f'{cx + r * math.cos(a):.1f},{cy + r * math.sin(a):.1f} '
            s.path(d + 'Z', '#cfd8dd', INK, 1.4)
        elif lbl == 'Indistinct':
            s.circle(cx, cy, 32, '#cfd8dd', extra='filter="url(#blur)"')
            s.circle(cx, cy, 24, '#b9c6cd')
        else:
            for k in range(16):
                a = 2 * math.pi * k / 16 + 0.1; r2 = 52 + (k % 3) * 6
                s.line(cx + 24 * math.cos(a), cy + 24 * math.sin(a), cx + r2 * math.cos(a), cy + r2 * math.sin(a), INK, 1.4)
            s.path(blob(cx, cy, 26, 10, 0.18, 2), '#cfd8dd', INK, 1.4)
        s.text(cx, 255, lbl, 14, 600, CRIT if lbl == 'Spiculated' else INK, 'middle')
    s.text(32, 318, 'Density: high · equal · low · fat-containing (fat-containing masses are benign, e.g. lipoma, hamartoma, oil cyst)', 13.5, 400, MUTED)
    # Calcifications benign
    card(32, 340, 1136, 210, 'CALCIFICATIONS · TYPICALLY BENIGN', OK)
    ben = ['Skin', 'Vascular', 'Coarse "popcorn"', 'Large rod-like', 'Round', 'Rim', 'Dystrophic', 'Milk of calcium', 'Suture']
    for i, lbl in enumerate(ben):
        cx = 92 + i * 124; cy = 440; r = random.Random(i)
        if lbl == 'Skin':
            for k in range(5):
                x = cx - 30 + k * 15 + r.uniform(-3, 3); y = cy + r.uniform(-20, 20)
                s.circle(x, y, 6, 'none', INK, 3)
        elif lbl == 'Vascular':
            s.path(f'M{cx-45},{cy-25} C{cx-10},{cy-5} {cx+10},{cy+5} {cx+45},{cy+25}', 'none', INK, 2.5, 'stroke-dasharray="10 5"')
            s.path(f'M{cx-45},{cy-13} C{cx-10},{cy+7} {cx+10},{cy+17} {cx+45},{cy+37}', 'none', INK, 2.5, 'stroke-dasharray="7 6"')
        elif lbl.startswith('Coarse'):
            s.path(blob(cx, cy, 34, 9, 0.3, 5), '#cfd8dd', '#8b9aa3', 1)
            for k in range(6): s.path(blob(cx + r.uniform(-20, 20), cy + r.uniform(-18, 18), r.uniform(6, 10), 7, 0.4, k), INK, INK, 1)
        elif lbl == 'Large rod-like':
            for k in range(4):
                x = cx - 30 + k * 18
                s.line(x, cy - 30 + r.uniform(-4, 4), x + 14, cy + 30, INK, 5)
        elif lbl == 'Round':
            for k in range(8): s.circle(cx + r.uniform(-30, 30), cy + r.uniform(-28, 28), r.uniform(3, 6), INK)
        elif lbl == 'Rim':
            s.circle(cx, cy, 26, 'none', INK, 3.5)
            s.circle(cx + 30, cy + 26, 10, 'none', INK, 2.5)
        elif lbl == 'Dystrophic':
            for k in range(4): s.path(blob(cx + r.uniform(-24, 24), cy + r.uniform(-22, 22), r.uniform(7, 13), 6, 0.5, k + 20), INK, INK, 1)
        elif lbl == 'Milk of calcium':
            for k, (dx, dy) in enumerate([(-22, -14), (18, 10)]):
                x0, y0 = cx + dx, cy + dy
                s.circle(x0, y0, 15, 'none', '#8b9aa3', 1)
                s.path(f'M{x0-14},{y0+4} Q{x0},{y0+18} {x0+14},{y0+4} Z', INK, INK, 1)
            s.text(cx, cy + 50, 'teacup on ML view', 10.5, 400, MUTED, 'middle', True)
        elif lbl == 'Suture':
            s.path(f'M{cx-40},{cy+10} L{cx-10},{cy-4} L{cx+10},{cy+8} L{cx+40},{cy-6}', 'none', INK, 3.5)
            s.circle(cx - 10, cy - 4, 5, INK); s.circle(cx + 10, cy + 8, 5, INK)
        for j, t in enumerate(wrap(lbl, 14)): s.text(cx, 510 + j * 15, t, 12.5, 600, INK, 'middle')
    # Suspicious
    card(32, 568, 1136, 220, 'CALCIFICATIONS · SUSPICIOUS MORPHOLOGY  (fine linear or fine-linear branching carries the highest suspicion)', CRIT)
    sus = ['Amorphous', 'Coarse heterogeneous', 'Fine pleomorphic', 'Fine linear or fine-linear branching']
    for i, lbl in enumerate(sus):
        cx = 170 + i * 280; cy = 670; r = random.Random(30 + i)
        if lbl == 'Amorphous':
            for k in range(40): s.circle(cx + r.gauss(0, 22), cy + r.gauss(0, 16), r.uniform(1, 1.8), '#5c6970')
        elif lbl.startswith('Coarse'):
            for k in range(16): s.path(blob(cx + r.gauss(0, 24), cy + r.gauss(0, 16), r.uniform(3, 6), 6, 0.45, k + 40), INK, INK, 0.8)
        elif lbl == 'Fine pleomorphic':
            for k in range(26):
                x, y = cx + r.gauss(0, 24), cy + r.gauss(0, 16)
                if k % 3 == 0: s.line(x, y, x + r.uniform(-5, 5), y + r.uniform(-5, 5), INK, 2)
                else: s.path(blob(x, y, r.uniform(1.5, 3), 5, 0.5, k + 60), INK, INK, 0.6)
        else:
            def branch(x, y, a, L, d):
                if d == 0 or L < 6: return
                x2, y2 = x + L * math.cos(a), y + L * math.sin(a)
                s.line(x, y, x2, y2, INK, 2.2, 'stroke-dasharray="5 3"')
                branch(x2, y2, a - 0.45, L * 0.7, d - 1); branch(x2, y2, a + 0.4, L * 0.65, d - 1)
            branch(cx - 60, cy + 20, -0.25, 44, 4)
        for j, t in enumerate(wrap(lbl, 22)): s.text(cx, 735 + j * 16, t, 13.5, 600, CRIT if 'linear' in lbl else INK, 'middle')
    # Distribution
    card(32, 806, 1136, 180, 'CALCIFICATION DISTRIBUTION  (diffuse and regional are usually benign; linear and segmental suggest ductal disease)')
    dist = ['Diffuse', 'Regional', 'Grouped', 'Linear', 'Segmental']
    for i, lbl in enumerate(dist):
        x = 80 + i * 220; y = 852; r = random.Random(80 + i)
        s.path(f'M{x},{y} Q{x},{y+80} {x+70},{y+86} Q{x+140},{y+80} {x+140},{y}', '#eef2f4', '#9fb0ba', 1.2)
        pts = []
        if lbl == 'Diffuse': pts = [(x + r.uniform(12, 128), y + r.uniform(6, 72)) for _ in range(34)]
        elif lbl == 'Regional': pts = [(x + r.uniform(60, 125), y + r.uniform(6, 50)) for _ in range(22)]
        elif lbl == 'Grouped': pts = [(x + 70 + r.gauss(0, 7), y + 36 + r.gauss(0, 6)) for _ in range(10)]
        elif lbl == 'Linear': pts = [(x + 40 + t * 7 + r.uniform(-1.5, 1.5), y + 12 + t * 5 + r.uniform(-1.5, 1.5)) for t in range(10)]
        else:
            s.path(f'M{x+70},{y+84} L{x+20},{y+8} L{x+80},{y+8} Z', 'none', TEAL, 1, 'stroke-dasharray="4 3"')
            pts = []
            for _ in range(28):
                t = r.uniform(0.1, 1); px = x + 70 + (r.uniform(-50, 10)) * t; py = y + 84 - 76 * t
                pts.append((px, py))
        for px, py in pts: s.circle(px, py, 2.2, INK)
        s.text(x + 70, y + 108, lbl, 13.5, 600, CRIT if lbl in ('Linear', 'Segmental') else INK, 'middle')
    s.save('fig-birads-mammo', '<filter id="blur"><feGaussianBlur stdDeviation="4"/></filter>')

# ---------------------------------------------------------------- BI-RADS US + MRI
def birads_us_mri():
    W = 1200
    s = SVG(W, 870)
    s.header('BI-RADS ultrasound and MRI lexicon', 'Key descriptors · ACR BI-RADS Atlas, 5th edition')
    def card(x, y, w, h, title, tone=TEAL):
        s.rect(x, y, w, h, '#ffffff', LINE, 12, 1.2); s.text(x + 16, y + 26, title, 12, 700, tone)
    # orientation
    card(32, 100, 360, 200, 'US · ORIENTATION')
    for i, (lbl, rot) in enumerate([('Parallel', 0), ('Not parallel', 90)]):
        cx = 120 + i * 180; cy = 195
        s.rect(cx - 70, 140, 140, 120, '#2b3238', rx=6)
        s.line(cx - 70, 150, cx + 70, 150, '#cfd8dd', 1.5)
        cy = 205
        s.add(f'<ellipse cx="{cx}" cy="{cy}" rx="42" ry="22" transform="rotate({rot} {cx} {cy})" fill="#0e1214" stroke="#9fb0ba" stroke-width="1.2"/>')
        s.text(cx, 286, lbl, 14, 600, CRIT if rot else INK, 'middle')
    # echo pattern
    card(408, 100, 760, 200, 'US · ECHO PATTERN')
    pats = [('Anechoic', '#050607'), ('Hypoechoic', '#2e3539'), ('Isoechoic', '#6f7a80'), ('Hyperechoic', '#d6dde1'), ('Heterogeneous', None), ('Complex cystic and solid', 'cx')]
    for i, (lbl, col) in enumerate(pats):
        x = 430 + i * 122; y = 132
        s.rect(x, y, 104, 104, '#6f7a80', rx=6)
        if col is None:
            r = random.Random(5)
            s.circle(x + 52, y + 52, 38, '#4a5358')
            for _ in range(40): s.circle(x + 52 + r.uniform(-28, 28), y + 52 + r.uniform(-28, 28), r.uniform(2, 5), r.choice(['#20262a', '#a9b4ba']))
        elif col == 'cx':
            s.circle(x + 52, y + 52, 38, '#050607'); s.path(blob(x + 44, y + 62, 17, 8, 0.25, 3), '#7c878d', '#7c878d', 1)
        else:
            s.circle(x + 52, y + 52, 38, col, '#9fb0ba' if col == '#6f7a80' else 'none', 1, 'stroke-dasharray="3 3"' if col == '#6f7a80' else '')
        for j, t in enumerate(wrap(lbl, 13)): s.text(x + 52, y + 128 + j * 15, t, 12.5, 600, INK, 'middle')
    # margin
    card(32, 316, 560, 220, 'US · MARGIN')
    s.text(48, 364, 'Circumscribed', 14, 700, OK)
    s.circle(110, 430, 36, '#2e3539', INK, 1.5)
    s.text(196, 364, 'Not circumscribed:', 14, 700, CRIT)
    nc = ['Indistinct', 'Angular', 'Microlobulated', 'Spiculated']
    for i, lbl in enumerate(nc):
        cx = 238 + i * 92; cy = 430
        if lbl == 'Indistinct':
            s.circle(cx, cy, 30, '#2e3539', extra='filter="url(#blur2)"')
        elif lbl == 'Angular':
            s.path(f'M{cx-30},{cy+6} L{cx-12},{cy-28} L{cx+4},{cy-12} L{cx+30},{cy-22} L{cx+22},{cy+26} L{cx-8},{cy+20} Z', '#2e3539', INK, 1.4)
        elif lbl == 'Microlobulated':
            d = ''
            for k in range(73):
                a = 2 * math.pi * k / 72; r = 28 + 3 * math.sin(14 * a)
                d += ('M' if k == 0 else 'L') + f'{cx + r * math.cos(a):.1f},{cy + r * math.sin(a):.1f} '
            s.path(d + 'Z', '#2e3539', INK, 1.2)
        else:
            for k in range(14):
                a = 2 * math.pi * k / 14
                s.line(cx + 20 * math.cos(a), cy + 20 * math.sin(a), cx + 40 * math.cos(a), cy + 40 * math.sin(a), INK, 1.3)
            s.circle(cx, cy, 22, '#2e3539', INK, 1.2)
        s.text(cx, 500, lbl, 12, 600, INK, 'middle')
    # posterior features
    card(608, 316, 560, 220, 'US · POSTERIOR FEATURES')
    post = [('None', None), ('Enhancement', '#c7d0d5'), ('Shadowing', '#16191b'), ('Combined', 'mix')]
    for i, (lbl, col) in enumerate(post):
        x = 628 + i * 134; y = 350
        s.rect(x, y, 118, 140, '#6f7a80', rx=6)
        cx = x + 59
        s.circle(cx, y + 42, 24, '#2e3539' if lbl != 'Enhancement' else '#050607')
        if col == 'mix':
            s.rect(cx - 22, y + 66, 22, 74, '#16191b'); s.rect(cx, y + 66, 22, 74, '#c7d0d5')
        elif col: s.rect(cx - 22, y + 66, 44, 74, col, extra='opacity="0.9"')
        s.text(cx, y + 162, lbl, 12.5, 600, INK, 'middle')
    # MRI kinetics
    card(32, 552, 640, 300, 'MRI · KINETIC CURVE (signal intensity over time)')
    gx, gy, gw, gh = 92, 600, 520, 200
    s.line(gx, gy, gx, gy + gh, INK, 1.5); s.line(gx, gy + gh, gx + gw, gy + gh, INK, 1.5)
    s.text(gx - 12, gy + gh / 2, 'SI', 12, 700, MUTED, 'end')
    s.text(gx + gw, gy + gh + 22, 'time', 12, 600, MUTED, 'end')
    s.line(gx + 150, gy, gx + 150, gy + gh, LINE, 1, 'stroke-dasharray="4 4"')
    s.text(gx + 75, gy + gh + 22, 'Initial phase', 11.5, 600, MUTED, 'middle')
    s.text(gx + 335, gy + gh + 22, 'Delayed phase', 11.5, 600, MUTED, 'middle')
    peak = (gx + 150, gy + 70)
    s.path(f'M{gx},{gy+gh} Q{gx+60},{gy+gh-20} {peak[0]},{peak[1]}', 'none', INK, 2.5)
    for lbl, endy, col in [('Persistent  (type 1)', gy + 18, OK), ('Plateau  (type 2)', gy + 72, WARN), ('Washout  (type 3)', gy + 140, CRIT)]:
        s.path(f'M{peak[0]},{peak[1]} Q{gx+300},{(peak[1]+endy)/2} {gx+gw-110},{endy}', 'none', col, 3)
        s.text(gx + gw - 100, endy + 5, lbl, 12.5, 700, col)
    s.text(gx + 14, gy + 30, 'initial rise: slow · medium · fast', 11, 400, MUTED, italic=True)
    # MRI other
    card(688, 552, 480, 300, 'MRI · OTHER DESCRIPTORS')
    items = [('Background parenchymal enhancement', 'Minimal · mild · moderate · marked; symmetric or asymmetric'),
             ('Amount of fibroglandular tissue', 'a almost entirely fat · b scattered · c heterogeneous · d extreme'),
             ('Focus', 'Tiny dot of enhancement, too small to characterize'),
             ('Non-mass enhancement · distribution', 'Focal · linear · segmental · regional · multiple regions · diffuse'),
             ('Non-mass enhancement · internal', 'Homogeneous · heterogeneous · clumped · clustered ring')]
    for i, (h, d) in enumerate(items):
        y = 600 + i * 50
        s.text(706, y, h, 13.5, 700, INK)
        s.text(706, y + 19, d, 12.5, 400, MUTED)
    s.save('fig-birads-us-mri', '<filter id="blur2"><feGaussianBlur stdDeviation="3.5"/></filter>')

# ---------------------------------------------------------------- C-RADS
def crads():
    W = 1200
    s = SVG(W, 860)
    s.header('C-RADS: CT colonography reporting', 'Colonic (C) and extracolonic (E) categories · Zalis et al., Radiology 2005')
    rows = [('C0', 'Inadequate study', 'Poor prep or insufflation, cannot exclude ≥10 mm lesion; or awaiting priors', 'Repeat or complete the study', GREY, GREYB, None),
            ('C1', 'Normal or benign', 'No polyp ≥6 mm; lipoma, inverted diverticulum, diverticulosis', 'Routine screening every 5–10 years', OK, OKB, 'none'),
            ('C2', 'Intermediate polyp', '6–9 mm polyp(s), fewer than 3; or indeterminate finding', 'Surveillance (≥3 years) or colonoscopy', WARN, WARNB, 'small'),
            ('C3', 'Possibly advanced adenoma', 'Polyp ≥10 mm, or 3 or more polyps of 6–9 mm', 'Colonoscopy', CRIT, CRITB, 'large'),
            ('C4', 'Colonic mass, likely malignant', 'Lumen-compromising mass or extracolonic invasion', 'Surgical consultation', CRIT, CRITB, 'mass')]
    top, rh = 120, 92
    for i, (c, t, d, m, fg, bg, ic) in enumerate(rows):
        y = top + i * rh
        s.rect(32, y, 1136, rh - 10, bg if i else SUNK, rx=12)
        s.badge(48, y + 20, 70, 42, c, fg, '#ffffff', 20)
        s.text(140, y + 34, t, 17, 700, INK)
        s.lines(140, y + 56, wrap(d, 52), 13, 17, fill=MUTED)
        s.text(1150, y + 48, m, 14.5, 700, fg, 'end')
        # icon: colon wall with polyp
        x0, yb = 560, y + 66
        if ic:
            s.path(f'M{x0},{yb} Q{x0+60},{yb-6} {x0+120},{yb} T{x0+240},{yb}', 'none', '#b07a6a', 5)
            if ic == 'small': s.path(f'M{x0+100},{yb-2} Q{x0+112},{yb-24} {x0+124},{yb-2}', '#d9a294', '#8c5a4c', 1.5)
            if ic == 'large': s.path(f'M{x0+90},{yb-2} Q{x0+120},{yb-50} {x0+150},{yb-2}', '#d9a294', '#8c5a4c', 1.5)
            if ic == 'mass':
                s.path(f'M{x0+60},{yb-2} Q{x0+70},{yb-60} {x0+120},{yb-58} Q{x0+175},{yb-56} {x0+180},{yb-2}', '#c98778', '#8c5a4c', 1.5)
                s.path(f'M{x0+60},{y+12} Q{x0+120},{y+30} {x0+180},{y+12}', 'none', '#b07a6a', 5)
            if ic in ('small', 'large'):
                sz = '6–9 mm' if ic == 'small' else '≥10 mm'
                px, py = (x0 + 112, yb - 30) if ic == 'small' else (x0 + 120, yb - 56)
                s.text(px, py, sz, 12, 700, fg, 'middle')
    y = top + 5 * rh + 14
    s.text(32, y, 'EXTRACOLONIC FINDINGS', 12, 700, MUTED)
    ex = [('E0', 'Limited exam', 'Artifact severely limits soft tissues', GREY, GREYB),
          ('E1', 'Normal or variant', 'e.g. retroaortic left renal vein', OK, OKB),
          ('E2', 'Clinically unimportant', 'Simple liver or renal cyst, gallstones, vertebral hemangioma. No work-up', OK, OKB),
          ('E3', 'Likely unimportant, incompletely characterized', 'e.g. minimally complex or hyperattenuating renal cyst. Work-up per local practice', WARN, WARNB),
          ('E4', 'Potentially important', 'Solid renal mass, adenopathy, aortic aneurysm, non-calcified lung nodule ≥1 cm. Communicate', CRIT, CRITB)]
    for i, (c, t, d, fg, bg) in enumerate(ex):
        x = 32 + i * 230; yy = y + 16
        s.rect(x, yy, 218, 214, bg, rx=12)
        s.badge(x + 14, yy + 14, 56, 34, c, fg, '#ffffff', 17)
        s.lines(x + 14, yy + 76, wrap(t, 22), 14.5, 18, weight=700, fill=INK)
        n = len(wrap(t, 22))
        s.lines(x + 14, yy + 82 + n * 18, wrap(d, 28), 12.5, 16, fill=MUTED)
    s.save('fig-crads')

# ---------------------------------------------------------------- CAD-RADS 2.0 stenosis
def cadrads_stenosis():
    W = 1200
    s = SVG(W, 560)
    s.header('CAD-RADS 2.0: stenosis category', 'Highest-grade stenosis in a vessel >1.5 mm · stable chest pain management · Cury et al., JCCT 2022')
    cats = [('0', '0%', 'No plaque or stenosis', 'No further cardiac testing', 0, OK, OKB),
            ('1', '1–24%', 'Minimal; or plaque without stenosis', 'Preventive therapy, risk-factor control', 15, OK, OKB),
            ('2', '25–49%', 'Mild', 'Preventive therapy, risk-factor control', 38, OK, OKB),
            ('3', '50–69%', 'Moderate', 'Consider functional testing (CT-FFR, stress CTP)', 60, WARN, WARNB),
            ('4A', '70–99%', 'Severe, 1–2 vessels', 'Invasive angiography or functional assessment', 82, CRIT, CRITB),
            ('4B', 'LM ≥50% or 3-vessel ≥70%', 'Severe, high-risk anatomy', 'Invasive angiography', 85, CRIT, CRITB),
            ('5', '100%', 'Total occlusion', 'Invasive angiography and/or viability', 100, CRIT, CRITB)]
    cw = 162
    for i, (c, pct, d, m, sten, fg, bg) in enumerate(cats):
        x = 32 + i * cw; y = 104
        s.rect(x, y, cw - 10, 430, bg, rx=12)
        s.badge(x + 14, y + 14, 56, 40, c, fg, '#ffffff', 21)
        # vessel
        vx, vy, vw, vh = x + 14, y + 74, cw - 38, 64
        s.rect(vx, vy, vw, vh, '#f6e3df', '#c98f84', 10, 1.5)
        half = (vh - 12) / 2 * sten / 100
        mid = vx + vw / 2
        lumen_top, lumen_bot = vy + 6, vy + vh - 6
        if sten < 100:
            pd = (f'M{vx+6},{lumen_top} L{mid-38},{lumen_top} Q{mid},{lumen_top+half*2} {mid+38},{lumen_top} L{vx+vw-6},{lumen_top} '
                 f'L{vx+vw-6},{lumen_bot} L{vx+6},{lumen_bot} Z')
            s.path(pd, '#c0392b', 'none', 0, 'opacity="0.85"')
            if sten > 0:
                s.path(f'M{mid-38},{lumen_top} Q{mid},{lumen_top+half*2} {mid+38},{lumen_top} Z', '#e9c46a', '#a07d2a', 1)
        else:
            s.path(f'M{vx+6},{lumen_top} L{mid-30},{lumen_top} Q{mid-20},{(lumen_top+lumen_bot)/2} {mid-30},{lumen_bot} L{vx+6},{lumen_bot} Z', '#c0392b', 'none', 0, 'opacity="0.85"')
            s.rect(mid - 30, lumen_top, 60, lumen_bot - lumen_top, '#e9c46a', '#a07d2a', 4, 1)
        if c == '4B':
            s.text(vx + vw / 2, vy + vh + 18, 'or left main', 10.5, 600, CRIT, 'middle', True)
        lines_pct = wrap(pct, 14)
        for j, t in enumerate(lines_pct): s.text(x + 14, y + 184 + j * 22, t, 19 if len(lines_pct) == 1 else 15, 800, fg)
        yy = y + 184 + len(lines_pct) * 22 + 6
        s.lines(x + 14, yy, wrap(d, 17), 13, 16, weight=700, fill=INK)
        yy += len(wrap(d, 17)) * 16 + 18
        s.line(x + 14, yy - 10, x + cw - 24, yy - 10, LINE)
        s.lines(x + 14, yy + 8, wrap(m, 18), 12.5, 16, fill=fg, weight=600)
    s.text(32, 548, 'N: non-diagnostic study; additional or alternative evaluation. Acute chest pain pathways differ; see the consensus document.', 12, 400, MUTED)
    s.save('fig-cadrads-stenosis')

# ---------------------------------------------------------------- CAD-RADS 2.0 plaque + modifiers
def cadrads_plaque():
    W = 1200
    s = SVG(W, 650)
    s.header('CAD-RADS 2.0: plaque burden and modifiers', 'Written after the stenosis category, e.g. CAD-RADS 3/P2/HRP/I+ · Cury et al., JCCT 2022')
    s.text(32, 116, 'PLAQUE BURDEN (choose one method; institution-specific)', 12, 700, MUTED)
    hdr = ['', 'Descriptor', 'CAC score', 'Segment involvement score', 'Visual']
    cols = [32, 140, 340, 520, 800]
    for i, h in enumerate(hdr): s.text(cols[i], 146, h.upper(), 11, 700, MUTED)
    rows = [('P1', 'Mild', '1–100', '1–2', 'Mild amount of plaque'), ('P2', 'Moderate', '101–300', '3–4', 'Moderate amount'),
            ('P3', 'Severe', '301–999', '5–7', 'Severe amount'), ('P4', 'Extensive', '≥1000', '≥8', 'Extensive amount')]
    tones = [(OK, OKB), (WARN, WARNB), (CRIT, CRITB), (CRIT, CRITB)]
    for i, r in enumerate(rows):
        y = 158 + i * 48; fg, bg = tones[i]
        s.rect(32, y, 1136, 42, bg if i % 2 == 0 else '#ffffff', rx=8)
        s.badge(40, y + 6, 60, 30, r[0], fg, '#ffffff', 16)
        for j in range(1, 5): s.text(cols[j], y + 27, r[j], 15, 700 if j < 4 else 400, INK if j < 4 else MUTED)
        # bar
        s.rect(1010, y + 15, 140, 12, '#e4eaee', rx=6); s.rect(1010, y + 15, 35 * (i + 1), 12, fg, rx=6)
    # modifiers
    y0 = 370
    s.text(32, y0, 'MODIFIERS', 12, 700, MUTED)
    mods = [('N', 'Non-diagnostic segment(s)'), ('HRP', 'High-risk plaque (≥2 features)'), ('I+  I−  I±', 'Ischemia by CT-FFR or stress CTP'),
            ('S', 'Stent present'), ('G', 'Bypass graft present'), ('E', 'Exception: non-atherosclerotic cause')]
    for i, (m, d) in enumerate(mods):
        x = 32 + (i % 3) * 380; y = y0 + 16 + (i // 3) * 56
        s.rect(x, y, 368, 46, SUNK, rx=10)
        s.text(x + 16, y + 30, m, 17, 800, TEAL)
        s.text(x + 30 + max(28, 10.5 * len(m)), y + 29, d, 13.5, 500, INK)
    # HRP features
    y1 = 510
    s.text(32, y1, 'HIGH-RISK PLAQUE FEATURES (2 or more = HRP)', 12, 700, MUTED)
    feats = [('Low-attenuation plaque', '<30 HU'), ('Positive remodeling', 'remodeling index ≥1.1'), ('Spotty calcification', '<3 mm'), ('Napkin-ring sign', 'low-attenuation core, high-attenuation rim')]
    for i, (t, sub) in enumerate(feats):
        x = 32 + i * 290; y = y1 + 14
        s.rect(x, y, 278, 110, '#ffffff', LINE, 12, 1.2)
        cx, cy = x + 52, y + 55
        # vessel cross-section icons
        if i == 0:
            s.circle(cx, cy, 34, '#e9c46a', '#a07d2a', 1); s.circle(cx + 8, cy, 18, '#c0392b'); s.path(blob(cx - 18, cy, 12, 7, 0.2, 2), '#3b434a', 'none', 0)
        elif i == 1:
            s.add(f'<ellipse cx="{cx}" cy="{cy}" rx="40" ry="26" fill="#e9c46a" stroke="#a07d2a" stroke-width="1"/>'); s.circle(cx, cy, 14, '#c0392b')
        elif i == 2:
            s.circle(cx, cy, 34, '#e9c46a', '#a07d2a', 1); s.circle(cx + 6, cy, 16, '#c0392b')
            s.circle(cx - 20, cy - 10, 4, '#ffffff', INK, 1); s.circle(cx - 22, cy + 10, 3, '#ffffff', INK, 1)
        else:
            s.circle(cx, cy, 36, '#f2f2f2', '#9aa', 1); s.circle(cx, cy, 30, '#5a5f63'); s.circle(cx + 8, cy, 14, '#c0392b')
        s.lines(x + 104, y + 46, wrap(t, 18), 14, 17, weight=700, fill=INK)
        s.lines(x + 104, y + 48 + 17 * len(wrap(t, 18)), wrap(sub, 22), 12, 15, fill=MUTED)
    s.save('fig-cadrads-plaque')

if __name__ == '__main__':
    birads_categories(); birads_mammo(); birads_us_mri(); crads(); cadrads_stenosis(); cadrads_plaque()
    print('ok')
