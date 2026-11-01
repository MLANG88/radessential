// RadEssential DICOM viewer. Mounted by assets/app.js on the /viewer page.
// Files are read with the browser's File API and never uploaded.
import { parseFile, buildSeries, orientLabel } from './dicom.js';
import { decodeFrame } from './decode.js';
import { paint, autoWindow, fullWindow, stats } from './render.js';

const PRESETS = [ // CT window presets, W/L in HU (Radiopaedia, "Windowing (CT)")
  ['Brain', 80, 40], ['Subdural', 200, 75], ['Stroke', 40, 40], ['Temporal bone', 2800, 600],
  ['Soft tissue', 400, 50], ['Lung', 1500, -600], ['Mediastinum', 350, 50], ['Liver', 150, 30], ['Bone', 1800, 400],
];
const CACHE_BYTES = 800 * 1024 * 1024;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (v, d = 0) => v == null || !Number.isFinite(v) ? '' : (+v.toFixed(d)).toString();
const dicomDate = s => /^\d{8}$/.test(s) ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6)}` : s;
const touchFirst = () => matchMedia('(pointer:coarse)').matches;

const ICON = {
  wl: '<path d="M12 3a9 9 0 100 18z" fill="currentColor"/><circle cx="12" cy="12" r="9"/>',
  pan: '<path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/>',
  zoom: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21M8 10.5h5M10.5 8v5"/>',
  scroll: '<rect x="6" y="3" width="12" height="18" rx="2"/><path d="M12 7v10M9.5 9.5L12 7l2.5 2.5M9.5 14.5L12 17l2.5-2.5"/>',
  length: '<path d="M4 20L20 4M4 20l2-5M4 20l5-2M20 4l-5 2M20 4l-2 5"/>',
};
const svg = k => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[k]}</svg>`;

export function mount(root) {
  root.innerHTML = `<div class="dv">
  <div class="dv-drop" id="dv-drop">
    <svg viewBox="0 0 24 24" aria-hidden="true" class="dv-dropicon"><path d="M12 15V3M7 8l5-5 5 5M4 15v4a2 2 0 002 2h12a2 2 0 002-2v-4"/></svg>
    <b>Drop DICOM files or a folder here</b>
    <span>CT, MR, radiographs, ultrasound and most other modalities. Uncompressed, RLE, JPEG, JPEG-LS and JPEG 2000.</span>
    <div class="dv-dropbtns"><button type="button" class="btn pri" id="dv-pick">Choose files</button><button type="button" class="btn" id="dv-pickdir">Choose a folder</button></div>
    <small>Files open on this device only. Nothing is uploaded or stored.</small>
    <input type="file" id="dv-files" multiple hidden><input type="file" id="dv-dir" webkitdirectory multiple hidden>
  </div>
  <div class="dv-app" id="dv-app" hidden tabindex="-1">
    <div class="dv-bar" role="toolbar" aria-label="Viewer tools">
      <div class="dv-grp">${[['wl', 'Window/level'], ['scroll', 'Scroll'], ['pan', 'Pan'], ['zoom', 'Zoom'], ['length', 'Measure length']].map(([k, t]) => `<button type="button" class="dv-tool" data-tool="${k}" title="${t}" aria-label="${t}">${svg(k)}</button>`).join('')}</div>
      <select id="dv-preset" aria-label="Window preset"><option value="">Window…</option><option value="file">From file</option><option value="auto">Auto</option><option value="full">Full range</option><optgroup label="CT">${PRESETS.map(([n, w, l], i) => `<option value="${i}">${n} (${w}/${l})</option>`).join('')}</optgroup></select>
      <div class="dv-grp">
        <button type="button" class="dv-btn" id="dv-inv" aria-pressed="false" title="Invert (I)">Invert</button>
        <button type="button" class="dv-btn" id="dv-play" aria-pressed="false" title="Play (Space)">Play</button>
        <button type="button" class="dv-btn" id="dv-reset" title="Reset view (R)">Reset</button>
        <button type="button" class="dv-btn" id="dv-clear" title="Clear measurements on this series">Clear</button>
        <button type="button" class="dv-btn" id="dv-info" aria-pressed="false" title="Show patient name, ID and dates">Patient info</button>
        <button type="button" class="dv-btn" id="dv-fs" title="Full screen (F)">Full screen</button>
      </div>
      <div class="dv-grp dv-end"><button type="button" class="dv-btn" id="dv-add">Add files</button><button type="button" class="dv-btn" id="dv-close">Close all</button></div>
    </div>
    <div class="dv-main">
      <div class="dv-series" id="dv-series" aria-label="Series"></div>
      <div class="dv-stage" id="dv-stage">
        <canvas id="dv-cv"></canvas>
        <div class="dv-ov tl" id="ov-tl"></div><div class="dv-ov tr" id="ov-tr"></div><div class="dv-ov bl" id="ov-bl"></div><div class="dv-ov br" id="ov-br"></div>
        <div class="dv-or t" id="or-t"></div><div class="dv-or b" id="or-b"></div><div class="dv-or l" id="or-l"></div><div class="dv-or r" id="or-r"></div>
        <div class="dv-msg" id="dv-msg" hidden></div>
        <input type="range" class="dv-slider" id="dv-slider" min="0" max="0" value="0" aria-label="Image">
      </div>
    </div>
    <div class="dv-status" id="dv-status"></div>
  </div>
  <div class="dv-busy" id="dv-busy" hidden><span></span></div>
</div>`;
  const $ = s => root.querySelector(s);
  const cv = $('#dv-cv'), ctx = cv.getContext('2d'), stage = $('#dv-stage');
  const ic = document.createElement('canvas'), ictx = ic.getContext('2d');
  const S = {
    files: [], series: [], si: 0, ii: 0, tool: touchFirst() ? 'scroll' : 'wl', wl: null, invert: false, zoom: 1, pan: [0, 0],
    showInfo: false, play: null, measures: new Map(), draft: null, cache: new Map(), cacheBytes: 0, painted: '', destroyed: false,
  };
  const cur = () => S.series[S.si]?.images[S.ii];

  /* ---------- loading ---------- */
  const busy = t => { const b = $('#dv-busy'); b.hidden = !t; b.firstElementChild.textContent = t || ''; };
  async function readEntries(entry, out) {
    if (entry.isFile) { out.push(await new Promise((res, rej) => entry.file(res, rej))); return; }
    if (!entry.isDirectory) return;
    const reader = entry.createReader();
    for (;;) { const batch = await new Promise((res, rej) => reader.readEntries(res, rej)); if (!batch.length) break; for (const e of batch) await readEntries(e, out); }
  }
  async function load(fileList) {
    const files = [...fileList].filter(f => f.size > 132 || !/\./.test(f.name));
    if (!files.length) return;
    let done = 0, skipped = 0;
    const parsed = [];
    busy(`Reading 0 of ${files.length} files…`);
    const queue = files.slice();
    await Promise.all(Array.from({ length: 6 }, async () => {
      while (queue.length) {
        const f = queue.shift();
        try { const m = parseFile(f.webkitRelativePath || f.name, await f.arrayBuffer()); if (m) parsed.push(m); else skipped++; } catch { skipped++; }
        if (++done % 10 === 0 || done === files.length) busy(`Reading ${done} of ${files.length} files…`);
      }
    }));
    busy('');
    const seen = new Set(S.files.map(f => f.ds.string('x00080018') + '|' + f.file));
    for (const m of parsed) { const k = m.ds.string('x00080018') + '|' + m.file; if (!seen.has(k)) { S.files.push(m); seen.add(k); } }
    if (!S.files.length) { status(`No DICOM images found in ${files.length} file${files.length > 1 ? 's' : ''}.`, true); $('#dv-drop').classList.add('err'); return; }
    const prevUid = S.series[S.si]?.uid;
    S.series = buildSeries(S.files);
    S.si = Math.max(0, S.series.findIndex(s => s.uid === prevUid));
    $('#dv-drop').hidden = true; $('#dv-app').hidden = false;
    const nImg = S.series.reduce((a, s) => a + s.images.length, 0);
    status(`${S.series.length} series, ${nImg} images${skipped ? `. Skipped ${skipped} file${skipped > 1 ? 's that were not images' : ' that was not an image'}.` : '.'}`);
    renderSeriesList();
    selectSeries(S.si, true);
    $('#dv-app').focus({ preventScroll: true });
  }
  function status(t, err) { const el = $('#dv-status'); el.textContent = t; el.classList.toggle('err', !!err); if (err) { const d = $('#dv-drop'); d.querySelector('small').textContent = t; } }

  /* ---------- decoding cache ---------- */
  async function getDecoded(img) {
    const key = img.f.file + '#' + img.frame + '#' + S.files.indexOf(img.f);
    if (S.cache.has(key)) return S.cache.get(key);
    const p = decodeFrame(img.f, img.frame).then(d => {
      const n = d.pixels.length;
      if (n < img.f.rows * img.f.cols) throw new Error('Decoded image is smaller than expected');
      S.cacheBytes += d.pixels.byteLength;
      while (S.cacheBytes > CACHE_BYTES && S.cache.size > 1) { const [k, v] = S.cache.entries().next().value; S.cache.delete(k); v.then(x => { S.cacheBytes -= x.pixels.byteLength; }, () => {}); }
      return d;
    });
    S.cache.set(key, p);
    p.catch(() => S.cache.delete(key));
    return p;
  }
  let prefetchT = 0;
  function prefetch() {
    clearTimeout(prefetchT);
    prefetchT = setTimeout(async () => {
      const imgs = S.series[S.si]?.images || [];
      for (const d of [1, -1, 2, -2, 3, -3, 4, 5, 6]) { const im = imgs[S.ii + d]; if (im && !S.destroyed) await getDecoded(im).catch(() => {}); }
    }, 60);
  }

  /* ---------- series list ---------- */
  function renderSeriesList() {
    const el = $('#dv-series');
    el.innerHTML = S.series.map((s, i) => `<button type="button" class="dv-th${i === S.si ? ' cur' : ''}" data-i="${i}"><canvas width="96" height="96"></canvas><b>${esc(s.label)}</b><small>${esc([s.modality, Number.isFinite(s.number) ? 'Se ' + s.number : '', s.images.length + ' img'].filter(Boolean).join(' · '))}</small></button>`).join('');
    el.querySelectorAll('.dv-th').forEach(b => b.onclick = () => selectSeries(+b.dataset.i));
    S.series.forEach(async (s, i) => {
      const img = s.images[Math.floor(s.images.length / 2)];
      try {
        const d = await getDecoded(img); const m = img.f;
        const wl = m.wc != null && m.ww ? { c: m.wc, w: m.ww } : autoWindow(m, d);
        const t = document.createElement('canvas'); t.width = m.cols; t.height = m.rows;
        const id = t.getContext('2d').createImageData(m.cols, m.rows); paint(m, d, wl, false, id); t.getContext('2d').putImageData(id, 0, 0);
        const c = el.querySelector(`.dv-th[data-i="${i}"] canvas`); if (!c) return;
        const g = c.getContext('2d'), k = Math.min(96 / m.cols, 96 / m.rows);
        g.fillStyle = '#000'; g.fillRect(0, 0, 96, 96); g.drawImage(t, (96 - m.cols * k) / 2, (96 - m.rows * k) / 2, m.cols * k, m.rows * k);
      } catch { /* thumbnail stays black */ }
    });
  }
  function selectSeries(i, keepWl) {
    stopPlay();
    S.si = i; const s = S.series[i];
    S.ii = 0;
    S.wl = null; S.zoom = 1; S.pan = [0, 0];
    if (!keepWl) S.invert = false;
    $('#dv-inv').setAttribute('aria-pressed', S.invert);
    const sl = $('#dv-slider'); sl.max = s.images.length - 1; sl.value = 0; sl.hidden = s.images.length < 2;
    $('#dv-play').disabled = s.images.length < 2;
    root.querySelectorAll('.dv-th').forEach(b => b.classList.toggle('cur', +b.dataset.i === i));
    root.querySelector('.dv-th.cur')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    show();
  }
  function setImage(i) {
    const s = S.series[S.si]; if (!s) return;
    i = Math.max(0, Math.min(s.images.length - 1, i));
    if (i === S.ii) return;
    S.ii = i; $('#dv-slider').value = i; show();
  }

  /* ---------- drawing ---------- */
  let showToken = 0;
  async function show() {
    const img = cur(); if (!img) return;
    const token = ++showToken, m = img.f;
    let d;
    try { d = await getDecoded(img); }
    catch (e) { if (token === showToken) { msg(`Can't display this image. ${e.message || ''}`); draw(null); updateOverlay(); } return; }
    if (token !== showToken || S.destroyed) return;
    msg('');
    if (!S.wl) S.wl = m.wc != null && m.ww ? { c: m.wc, w: m.ww } : (m.modality === 'CT' ? { c: 40, w: 400 } : autoWindow(m, d));
    const key = `${S.si}|${S.ii}|${S.wl.c}|${S.wl.w}|${S.invert}`;
    if (S.painted !== key) {
      if (ic.width !== m.cols || ic.height !== m.rows) { ic.width = m.cols; ic.height = m.rows; }
      const id = ictx.createImageData(m.cols, m.rows);
      paint(m, d, S.wl, S.invert, id); ictx.putImageData(id, 0, 0);
      S.painted = key;
    }
    draw(m); updateOverlay(); prefetch();
  }
  function msg(t) { const el = $('#dv-msg'); el.hidden = !t; el.textContent = t; }
  function aspect(m) { return m.spacing ? m.spacing[0] / m.spacing[1] : 1; }
  function geom(m) {
    const W = cv.width, H = cv.height, a = aspect(m), iw = m.cols, ih = m.rows * a;
    const fit = Math.min(W / iw, H / ih), k = fit * S.zoom, dpr = devicePixelRatio || 1;
    const x0 = W / 2 + S.pan[0] * dpr - iw * k / 2, y0 = H / 2 + S.pan[1] * dpr - ih * k / 2;
    return { k, a, x0, y0, iw, ih, dpr, fit };
  }
  const toImg = (m, sx, sy) => { const g = geom(m); return [(sx * g.dpr - g.x0) / g.k, (sy * g.dpr - g.y0) / g.k / g.a]; };
  function resize() {
    const r = stage.getBoundingClientRect(), dpr = devicePixelRatio || 1;
    const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    draw(cur()?.f); if (cur() && S.wl) updateOverlay();
  }
  function lengthMM(m, p, q) {
    const dx = q[0] - p[0], dy = q[1] - p[1];
    if (m.spacing) return { v: Math.hypot(dx * m.spacing[1], dy * m.spacing[0]), u: 'mm' };
    return { v: Math.hypot(dx, dy), u: 'px' };
  }
  function draw(m) {
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, cv.width, cv.height);
    if (!m || !S.painted) return;
    const g = geom(m);
    ctx.imageSmoothingEnabled = g.k < 3; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(ic, g.x0, g.y0, g.iw * g.k, g.ih * g.k);
    const lines = [...(S.measures.get(S.si + ':' + S.ii) || []), ...(S.draft ? [S.draft] : [])];
    ctx.lineWidth = 1.5 * g.dpr; ctx.font = `${12 * g.dpr}px system-ui,sans-serif`;
    for (const [p, q] of lines) {
      const P = [g.x0 + p[0] * g.k, g.y0 + p[1] * g.k * g.a], Q = [g.x0 + q[0] * g.k, g.y0 + q[1] * g.k * g.a];
      ctx.strokeStyle = '#ffd34d'; ctx.beginPath(); ctx.moveTo(...P); ctx.lineTo(...Q); ctx.stroke();
      for (const X of [P, Q]) { ctx.beginPath(); ctx.arc(X[0], X[1], 2.5 * g.dpr, 0, 7); ctx.fillStyle = '#ffd34d'; ctx.fill(); }
      const L = lengthMM(m, p, q), t = `${fmt(L.v, L.v < 10 ? 1 : 0)} ${L.u}`;
      const tx = Q[0] + 8 * g.dpr, ty = Q[1] - 6 * g.dpr;
      ctx.lineWidth = 3 * g.dpr; ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.strokeText(t, tx, ty); ctx.fillStyle = '#ffd34d'; ctx.fillText(t, tx, ty); ctx.lineWidth = 1.5 * g.dpr;
    }
  }
  function updateOverlay() {
    const s = S.series[S.si], img = cur(); if (!img) return; const m = img.f;
    const line = a => a.filter(Boolean).map(x => `<div>${esc(x)}</div>`).join('');
    $('#ov-tl').innerHTML = line([m.seriesDesc || s.label, [Number.isFinite(m.seriesNumber) ? 'Se ' + m.seriesNumber : '', `Im ${S.ii + 1}/${s.images.length}`].filter(Boolean).join('  '), m.frames > 1 ? `Frame ${img.frame + 1}/${m.frames}` : '', m.modality]);
    $('#ov-tr').innerHTML = S.showInfo ? line([m.patientName, m.patientId && 'ID ' + m.patientId, [dicomDate(m.birthDate), m.sex, m.age].filter(Boolean).join('  '), dicomDate(m.studyDate), m.studyDesc, m.institution]) : '';
    const g = geom(m), color = m.spp === 3 || /^(RGB|YBR|PALETTE)/.test(m.photometric);
    $('#ov-bl').innerHTML = line([color ? '' : `W ${fmt(S.wl?.w)}  L ${fmt(S.wl?.c)}`, `Zoom ${fmt(g.k / g.dpr * 100)}%`, S.invert ? 'Inverted' : '']);
    $('#ov-br').innerHTML = line([m.sliceThickness ? `Thk ${fmt(m.sliceThickness, 2)} mm` : '', m.sliceLocation != null ? `Loc ${fmt(m.sliceLocation, 1)} mm` : '', `${m.cols} × ${m.rows}`]);
    const o = m.orientation;
    const rowDir = o && o.slice(0, 3), colDir = o && o.slice(3);
    const neg = v => v && v.map(x => -x);
    $('#or-r').textContent = orientLabel(rowDir); $('#or-l').textContent = orientLabel(neg(rowDir));
    $('#or-b').textContent = orientLabel(colDir); $('#or-t').textContent = orientLabel(neg(colDir));
  }

  /* ---------- interaction ---------- */
  const setTool = t => { S.tool = t; root.querySelectorAll('.dv-tool').forEach(b => b.setAttribute('aria-pressed', b.dataset.tool === t)); stage.dataset.tool = t; };
  setTool(S.tool);
  root.querySelectorAll('.dv-tool').forEach(b => b.onclick = () => setTool(b.dataset.tool));
  const ptrs = new Map(); let drag = null, wheelAcc = 0;
  const repaint = () => { const m = cur()?.f; if (!m) return; show(); };
  function applyDrag(kind, dx, dy, e) {
    const m = cur()?.f; if (!m) return;
    if (kind === 'wl') {
      if (m.spp === 3 || m.palette) return;
      const k = Math.max(0.5, (S.wl?.w || 400) / 250);
      S.wl = { c: S.wl.c + dy * k, w: Math.max(1, S.wl.w + dx * k) }; $('#dv-preset').value = ''; repaint();
    } else if (kind === 'pan') { S.pan[0] += dx; S.pan[1] += dy; draw(m); updateOverlay(); }
    else if (kind === 'zoom') { zoomAt(m, Math.exp(-dy * 0.01), drag.sx, drag.sy); }
    else if (kind === 'scroll') { drag.acc += dy; const st = Math.max(4, Math.min(16, stage.clientHeight / Math.max(1, S.series[S.si].images.length))); while (Math.abs(drag.acc) >= st) { setImage(S.ii + Math.sign(drag.acc)); drag.acc -= Math.sign(drag.acc) * st; } }
    else if (kind === 'length') { const r = cv.getBoundingClientRect(); S.draft = [drag.p0, toImg(m, e.clientX - r.left, e.clientY - r.top)]; draw(m); }
  }
  function zoomAt(m, f, sx, sy) {
    const nz = Math.max(0.1, Math.min(40, S.zoom * f)); f = nz / S.zoom;
    const r = cv.getBoundingClientRect(), cx = sx - r.width / 2, cy = sy - r.height / 2;
    S.pan = [cx - (cx - S.pan[0]) * f, cy - (cy - S.pan[1]) * f]; S.zoom = nz; draw(m); updateOverlay();
  }
  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('pointerdown', e => {
    const m = cur()?.f; if (!m) return;
    cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, [e.clientX, e.clientY]);
    const r = cv.getBoundingClientRect();
    if (ptrs.size === 2) { drag = { kind: 'pinch', d0: dist(), z0: S.zoom, c0: mid(), pan0: [...S.pan] }; S.draft = null; return; }
    const kind = e.button === 1 ? 'pan' : e.button === 2 ? 'zoom' : (e.shiftKey ? 'pan' : e.ctrlKey || e.metaKey ? 'zoom' : S.tool);
    drag = { kind, x: e.clientX, y: e.clientY, sx: e.clientX - r.left, sy: e.clientY - r.top, acc: 0 };
    if (kind === 'length') drag.p0 = toImg(m, drag.sx, drag.sy);
  });
  const dist = () => { const [a, b] = [...ptrs.values()]; return Math.hypot(a[0] - b[0], a[1] - b[1]); };
  const mid = () => { const [a, b] = [...ptrs.values()]; return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; };
  cv.addEventListener('pointermove', e => {
    if (!ptrs.has(e.pointerId) || !drag) return;
    ptrs.set(e.pointerId, [e.clientX, e.clientY]);
    const m = cur()?.f; if (!m) return;
    if (drag.kind === 'pinch') {
      if (ptrs.size < 2) return;
      const r = cv.getBoundingClientRect(), c = mid(), f = dist() / Math.max(1, drag.d0);
      S.zoom = drag.z0; S.pan = [...drag.pan0];
      zoomAt(m, f, drag.c0[0] - r.left, drag.c0[1] - r.top);
      S.pan[0] += c[0] - drag.c0[0]; S.pan[1] += c[1] - drag.c0[1]; draw(m); updateOverlay();
      return;
    }
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
    applyDrag(drag.kind, dx, dy, e);
  });
  const end = e => {
    ptrs.delete(e.pointerId);
    if (drag?.kind === 'length' && S.draft) {
      const m = cur()?.f, L = m && lengthMM(m, S.draft[0], S.draft[1]);
      if (L && L.v > 0.5) { const k = S.si + ':' + S.ii; S.measures.set(k, [...(S.measures.get(k) || []), S.draft]); }
      S.draft = null; draw(m);
    }
    if (!ptrs.size) drag = null; else if (drag?.kind === 'pinch') drag = null;
  };
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  cv.addEventListener('wheel', e => {
    const m = cur()?.f; if (!m) return; e.preventDefault();
    const r = cv.getBoundingClientRect();
    if (e.ctrlKey || e.metaKey) { zoomAt(m, Math.exp(-e.deltaY * 0.0025), e.clientX - r.left, e.clientY - r.top); return; }
    wheelAcc += e.deltaMode === 1 ? e.deltaY * 30 : e.deltaY;
    const st = 50; while (Math.abs(wheelAcc) >= st) { setImage(S.ii + Math.sign(wheelAcc)); wheelAcc -= Math.sign(wheelAcc) * st; }
    if (Math.abs(e.deltaY) >= 1 && Math.abs(e.deltaY) < st && e.deltaMode === 0 && Math.abs(wheelAcc) < 1) wheelAcc = 0;
  }, { passive: false });
  $('#dv-slider').oninput = e => setImage(+e.target.value);
  $('#dv-preset').onchange = e => {
    const v = e.target.value, img = cur(); if (!img || v === '') return;
    S.cache.get(img.f.file + '#' + img.frame + '#' + S.files.indexOf(img.f))?.then(d => {
      const m = img.f;
      S.wl = v === 'file' ? (m.wc != null && m.ww ? { c: m.wc, w: m.ww } : autoWindow(m, d)) : v === 'auto' ? autoWindow(m, d) : v === 'full' ? fullWindow(m, stats(d)) : { w: PRESETS[+v][1], c: PRESETS[+v][2] };
      repaint();
    });
  };
  const toggleInvert = () => { S.invert = !S.invert; $('#dv-inv').setAttribute('aria-pressed', S.invert); repaint(); };
  const reset = () => { S.wl = null; S.zoom = 1; S.pan = [0, 0]; S.invert = false; $('#dv-inv').setAttribute('aria-pressed', 'false'); $('#dv-preset').value = ''; repaint(); };
  function stopPlay() { if (S.play) { clearInterval(S.play); S.play = null; } $('#dv-play').setAttribute('aria-pressed', 'false'); $('#dv-play').textContent = 'Play'; }
  function togglePlay() {
    if (S.play) return stopPlay();
    const s = S.series[S.si]; if (!s || s.images.length < 2) return;
    const fps = s.first.frameTime ? Math.min(60, 1000 / s.first.frameTime) : 12;
    S.play = setInterval(() => setImage(S.ii + 1 >= s.images.length ? 0 : S.ii + 1), 1000 / fps);
    $('#dv-play').setAttribute('aria-pressed', 'true'); $('#dv-play').textContent = 'Stop';
  }
  $('#dv-inv').onclick = toggleInvert; $('#dv-reset').onclick = reset; $('#dv-play').onclick = togglePlay;
  $('#dv-clear').onclick = () => { for (const k of [...S.measures.keys()]) if (k.startsWith(S.si + ':')) S.measures.delete(k); draw(cur()?.f); };
  $('#dv-info').onclick = e => { S.showInfo = !S.showInfo; e.currentTarget.setAttribute('aria-pressed', S.showInfo); updateOverlay(); };
  const dvRoot = root.querySelector('.dv');
  $('#dv-fs').onclick = () => document.fullscreenElement ? document.exitFullscreen() : dvRoot.requestFullscreen?.().catch(() => dvRoot.classList.toggle('dv-max'));
  if (!dvRoot.requestFullscreen) $('#dv-fs').onclick = () => { dvRoot.classList.toggle('dv-max'); resize(); };
  const closeAll = () => { stopPlay(); S.files = []; S.series = []; S.cache.clear(); S.cacheBytes = 0; S.measures.clear(); S.painted = ''; $('#dv-app').hidden = true; $('#dv-drop').hidden = false; $('#dv-drop').classList.remove('err'); $('#dv-drop small').textContent = 'Files open on this device only. Nothing is uploaded or stored.'; };
  $('#dv-close').onclick = closeAll;
  $('#dv-pick').onclick = () => $('#dv-files').click(); $('#dv-pickdir').onclick = () => $('#dv-dir').click(); $('#dv-add').onclick = () => $('#dv-files').click();
  $('#dv-files').onchange = e => { load(e.target.files); e.target.value = ''; };
  $('#dv-dir').onchange = e => { load(e.target.files); e.target.value = ''; };
  const onKey = e => {
    if ($('#dv-app').hidden || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName) && document.activeElement.type !== 'range') return;
    const k = e.key, s = S.series[S.si]; if (!s) return;
    const act = { ArrowDown: () => setImage(S.ii + 1), ArrowRight: () => setImage(S.ii + 1), ArrowUp: () => setImage(S.ii - 1), ArrowLeft: () => setImage(S.ii - 1),
      PageDown: () => setImage(S.ii + 10), PageUp: () => setImage(S.ii - 10), Home: () => setImage(0), End: () => setImage(s.images.length - 1),
      i: toggleInvert, I: toggleInvert, r: reset, R: reset, ' ': togglePlay, f: () => $('#dv-fs').click(), F: () => $('#dv-fs').click() }[k];
    if (act) { e.preventDefault(); act(); }
    else if (/^[1-9]$/.test(k) && PRESETS[+k - 1]) { const sel = $('#dv-preset'); sel.value = String(+k - 1); sel.onchange({ target: sel }); }
  };
  document.addEventListener('keydown', onKey);
  // Drop anywhere on the viewer.
  const prevent = e => { e.preventDefault(); dvRoot.classList.toggle('dv-over', e.type === 'dragover'); };
  dvRoot.addEventListener('dragover', prevent); dvRoot.addEventListener('dragleave', prevent);
  dvRoot.addEventListener('drop', async e => {
    e.preventDefault(); dvRoot.classList.remove('dv-over');
    const items = [...(e.dataTransfer.items || [])].map(i => i.webkitGetAsEntry && i.webkitGetAsEntry()).filter(Boolean);
    if (items.length) { const out = []; busy('Reading folder…'); for (const it of items) await readEntries(it, out); load(out); }
    else load(e.dataTransfer.files);
  });
  const ro = new ResizeObserver(resize); ro.observe(stage);
  const onFs = () => resize(); document.addEventListener('fullscreenchange', onFs);
  return {
    load,
    destroy() { S.destroyed = true; stopPlay(); ro.disconnect(); document.removeEventListener('keydown', onKey); document.removeEventListener('fullscreenchange', onFs); S.cache.clear(); },
  };
}
