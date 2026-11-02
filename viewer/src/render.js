// Converts decoded pixel values to RGBA for display, applying rescale, window/level and inversion.

export function stats(d) {
  if (d.min !== undefined) return d;
  const p = d.pixels; let mn = Infinity, mx = -Infinity;
  for (let i = 0; i < p.length; i++) { const v = p[i]; if (v < mn) mn = v; if (v > mx) mx = v; }
  d.min = mn; d.max = mx;
  return d;
}

// Window from the 0.5th to 99.5th percentile of modality values; used when the file has no window.
export function autoWindow(m, d) {
  stats(d);
  const { min, max } = d, p = d.pixels, bins = 1024, h = new Uint32Array(bins), span = (max - min) || 1;
  const step = Math.max(1, Math.floor(p.length / 200000));
  let n = 0;
  for (let i = 0; i < p.length; i += step) { h[Math.min(bins - 1, ((p[i] - min) / span * bins) | 0)]++; n++; }
  let lo = 0, hi = bins - 1, acc = 0;
  for (; lo < bins; lo++) { acc += h[lo]; if (acc > n * 0.005) break; }
  acc = 0; for (; hi > 0; hi--) { acc += h[hi]; if (acc > n * 0.005) break; }
  const a = (min + lo / bins * span) * m.slope + m.intercept, b = (min + (hi + 1) / bins * span) * m.slope + m.intercept;
  const w = Math.max(1, b - a);
  return { c: a + w / 2, w };
}

export function fullWindow(m, d) {
  stats(d);
  const a = d.min * m.slope + m.intercept, b = d.max * m.slope + m.intercept;
  return { c: (a + b) / 2, w: Math.max(1, b - a) };
}

const clamp8 = v => v < 0 ? 0 : v > 255 ? 255 : v;

// Writes into imageData (cols × rows). wl in modality units, DICOM linear (C.11.2.1.2) function.
export function paint(m, d, wl, invert, imageData) {
  const out = imageData.data, n = m.rows * m.cols, p = d.pixels;
  const photometric = d.photometric || m.photometric, planar = d.planar ?? m.planar;
  if (m.spp === 3 || photometric === 'RGB' || /^YBR/.test(photometric)) {
    const ybr = /^YBR/.test(photometric);
    const scale = m.bitsAllocated > 8 && !(p instanceof Uint8Array) ? 255 / ((1 << m.bitsStored) - 1) : 1;
    for (let i = 0; i < n; i++) {
      let r, g, b;
      if (planar === 1) { r = p[i]; g = p[i + n]; b = p[i + 2 * n]; } else { r = p[i * 3]; g = p[i * 3 + 1]; b = p[i * 3 + 2]; }
      if (scale !== 1) { r *= scale; g *= scale; b *= scale; }
      if (ybr) { const y = r, cb = g - 128, cr = b - 128; r = y + 1.402 * cr; g = y - 0.344136 * cb - 0.714136 * cr; b = y + 1.772 * cb; }
      if (invert) { r = 255 - r; g = 255 - g; b = 255 - b; }
      const o = i * 4; out[o] = clamp8(r); out[o + 1] = clamp8(g); out[o + 2] = clamp8(b); out[o + 3] = 255;
    }
    return;
  }
  if (photometric === 'PALETTE COLOR' && m.palette) {
    const L = m.palette, last = L.n - 1;
    for (let i = 0; i < n; i++) {
      let j = p[i] - L.first; j = j < 0 ? 0 : j > last ? last : j;
      const o = i * 4; let r = L.r[j], g = L.g[j], b = L.b[j];
      if (invert) { r = 255 - r; g = 255 - g; b = 255 - b; }
      out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = 255;
    }
    return;
  }
  stats(d);
  const inv = (photometric === 'MONOCHROME1') !== !!invert;
  const { c, w } = wl, lo = c - 0.5 - (w - 1) / 2, ww = Math.max(1, w - 1);
  const map = v => { const x = v * m.slope + m.intercept; let y = x <= lo ? 0 : x > lo + ww ? 255 : ((x - (c - 0.5)) / ww + 0.5) * 255; y = clamp8(y) | 0; return inv ? 255 - y : y; };
  const range = d.max - d.min;
  const mask = m.pixelRep === 0 && m.bitsStored < m.bitsAllocated && m.bitsAllocated <= 16 ? (1 << m.bitsStored) - 1 : 0;
  if (range <= 1 << 20) {
    const lut = new Uint8Array(range + 1);
    for (let v = 0; v <= range; v++) lut[v] = map(d.min + v);
    for (let i = 0; i < n; i++) { const v = mask ? p[i] & mask : p[i]; const y = lut[(v - d.min)] ?? 0; const o = i * 4; out[o] = out[o + 1] = out[o + 2] = y; out[o + 3] = 255; }
  } else {
    for (let i = 0; i < n; i++) { const y = map(p[i]); const o = i * 4; out[o] = out[o + 1] = out[o + 2] = y; out[o + 3] = 255; }
  }
}
