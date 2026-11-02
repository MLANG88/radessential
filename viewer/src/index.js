// RadEssential DICOM viewer. Mounted by assets/app.js on the /viewer page.
// Files are read with the browser's File API and never uploaded.
// One or two viewports: load a second study with "Compare study" to read side by side, with optional linked scrolling.
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
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

const ICON = {
  wl: '<path d="M12 3a9 9 0 100 18z" fill="currentColor"/><circle cx="12" cy="12" r="9"/>',
  pan: '<path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/>',
  zoom: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21M8 10.5h5M10.5 8v5"/>',
  scroll: '<rect x="6" y="3" width="12" height="18" rx="2"/><path d="M12 7v10M9.5 9.5L12 7l2.5 2.5M9.5 14.5L12 17l2.5-2.5"/>',
  length: '<path d="M4 20L20 4M4 20l2-5M4 20l5-2M20 4l-5 2M20 4l-2 5"/>',
  fs: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  fsx: '<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>',
};
const svg = k => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[k]}</svg>`;
const VP_HTML = n => `<div class="dv-vp" data-vp="${n}">
  <canvas></canvas>
  <div class="dv-ov tl"></div><div class="dv-ov tr"></div><div class="dv-ov bl"></div><div class="dv-ov br"></div>
  <div class="dv-or t"></div><div class="dv-or b"></div><div class="dv-or l"></div><div class="dv-or r"></div>
  <div class="dv-msg" hidden></div>
  <div class="dv-empty" hidden>Choose a series on the left, or <button type="button" class="dv-linkbtn" data-act="compare-load">add a study</button></div>
  <input type="range" class="dv-slider" min="0" max="0" value="0" aria-label="Image">
</div>`;

export function mount(root) {
  root.innerHTML = `<div class="dv">
  <div class="dv-drop" id="dv-drop">
    <svg viewBox="0 0 24 24" aria-hidden="true" class="dv-dropicon"><path d="M12 15V3M7 8l5-5 5 5M4 15v4a2 2 0 002 2h12a2 2 0 002-2v-4"/></svg>
    <b>Drop DICOM files or a folder here</b>
    <span>CT, MR, radiographs, ultrasound and most other modalities. Uncompressed, RLE, JPEG, JPEG-LS and JPEG 2000.</span>
    <div class="dv-dropbtns"><button type="button" class="btn pri" id="dv-pick">Choose files</button><button type="button" class="btn" id="dv-pickdir">Choose a folder</button></div>
    <small>Files open on this device only. Nothing is uploaded or stored.</small>
    <input type="file" id="dv-files" multiple hidden><input type="file" id="dv-dir" webkitdirectory multiple hidden>
    <input type="file" id="dv-cfiles" multiple hidden><input type="file" id="dv-cdir" webkitdirectory multiple hidden>
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
      </div>
      <div class="dv-grp dv-cmp">
        <span class="dv-mwrap"><button type="button" class="dv-btn" id="dv-compare" aria-haspopup="menu" aria-expanded="false" title="Load another study and show it side by side">Compare study ▾</button>
          <span class="dv-menu" role="menu" hidden><button type="button" role="menuitem" data-pick="cdir">Choose a folder</button><button type="button" role="menuitem" data-pick="cfiles">Choose files</button></span></span>
        <button type="button" class="dv-btn" id="dv-layout" aria-pressed="false" title="Show one or two viewports (C)">Side by side</button>
        <button type="button" class="dv-btn" id="dv-link" aria-pressed="true" title="Scroll both viewports together (L)" hidden>Link scroll</button>
      </div>
      <div class="dv-grp dv-end">
        <button type="button" class="dv-btn dv-fsbtn" id="dv-fs" aria-pressed="false" title="Full screen (F)">${svg('fs')}<span>Full screen</span></button>
        <span class="dv-mwrap"><button type="button" class="dv-btn" id="dv-add" aria-haspopup="menu" aria-expanded="false" title="Add more series from the same or another study">Add files ▾</button>
          <span class="dv-menu" role="menu" hidden><button type="button" role="menuitem" data-pick="dir">Choose a folder</button><button type="button" role="menuitem" data-pick="files">Choose files</button></span></span><button type="button" class="dv-btn" id="dv-close">Close all</button>
      </div>
    </div>
    <div class="dv-main">
      <div class="dv-series" id="dv-series" aria-label="Series"></div>
      <div class="dv-stage" id="dv-stage" data-n="1">${VP_HTML(0)}${VP_HTML(1)}</div>
    </div>
    <div class="dv-status" id="dv-status"></div>
  </div>
  <div class="dv-busy" id="dv-busy" hidden><span></span></div>
</div>`;
  const $ = s => root.querySelector(s);
  const stage = $('#dv-stage');
  const S = {
    files: [], series: [], tool: touchFirst() ? 'scroll' : 'wl', showInfo: false, play: null, measures: new Map(), draft: null,
    cache: new Map(), cacheBytes: 0, destroyed: false, layout: 1, active: 0, link: true, studyOrder: [],
  };
  // Viewport state: each pane keeps its own series, slice, window, zoom and pan.
  const VPS = [...stage.querySelectorAll('.dv-vp')].map((el, n) => {
    const ic = document.createElement('canvas');
    const cv = el.querySelector('canvas');
    return { n, el, cv, ctx: cv.getContext('2d'), ic, ictx: ic.getContext('2d'), si: -1, ii: 0, wl: null, invert: false, zoom: 1, pan: [0, 0],
      painted: '', token: 0, offset: null, q: s => el.querySelector(s) };
  });
  const A = () => VPS[S.active];
  const curOf = vp => S.series[vp.si]?.images[vp.ii];
  const cur = () => curOf(A());

  /* ---------- loading ---------- */
  const busy = t => { const b = $('#dv-busy'); b.hidden = !t; b.firstElementChild.textContent = t || ''; };
  async function readEntries(entry, out) {
    if (entry.isFile) { out.push(await new Promise((res, rej) => entry.file(res, rej))); return; }
    if (!entry.isDirectory) return;
    const reader = entry.createReader();
    for (;;) { const batch = await new Promise((res, rej) => reader.readEntries(res, rej)); if (!batch.length) break; for (const e of batch) await readEntries(e, out); }
  }
  // compare: true when the files are a second study for the right-hand viewport.
  async function load(fileList, compare = false) {
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
    const added = [];
    for (const m of parsed) { const k = m.ds.string('x00080018') + '|' + m.file; if (!seen.has(k)) { S.files.push(m); added.push(m); seen.add(k); } }
    if (!S.files.length) { status(`No DICOM images found in ${files.length} file${files.length > 1 ? 's' : ''}.`, true); $('#dv-drop').classList.add('err'); return; }
    if (!added.length) { status(`Those files are already open${skipped ? ` (${skipped} skipped as not images)` : ''}.`); return; }
    const keep = VPS.map(vp => S.series[vp.si]?.uid);
    S.series = buildSeries(S.files);
    for (const f of added) if (f.studyUid && !S.studyOrder.includes(f.studyUid)) S.studyOrder.push(f.studyUid);
    for (const s of S.series) if (s.first.studyUid && !S.studyOrder.includes(s.first.studyUid)) S.studyOrder.push(s.first.studyUid);
    // Order series by the order their studies were opened, so the first study stays on top.
    const so = u => { const i = S.studyOrder.indexOf(u); return i < 0 ? 1e9 : i; };
    S.series.sort((a, b) => so(a.first.studyUid) - so(b.first.studyUid) || (a.number ?? 1e9) - (b.number ?? 1e9) || a.label.localeCompare(b.label));
    VPS.forEach((vp, i) => { vp.si = keep[i] ? S.series.findIndex(s => s.uid === keep[i]) : -1; });
    $('#dv-drop').hidden = true; $('#dv-app').hidden = false;
    const nImg = S.series.reduce((a, s) => a + s.images.length, 0), nStudies = new Set(S.series.map(s => s.first.studyUid || s.uid)).size;
    status(`${nStudies > 1 ? nStudies + ' studies, ' : ''}${S.series.length} series, ${nImg} images${skipped ? `. Skipped ${skipped} file${skipped > 1 ? 's that were not images' : ' that was not an image'}.` : '.'}`);
    renderSeriesList();
    const firstNew = S.series.findIndex(s => added.some(f => s.images[0]?.f.seriesUid === f.seriesUid));
    if (compare || (S.layout === 2 && VPS[1].si < 0)) {
      if (VPS[0].si < 0) setSeries(VPS[0], 0);
      setLayout(2);
      setActive(1);
      setSeries(VPS[1], firstNew >= 0 ? firstNew : 0, { match: true });
    } else {
      if (VPS[0].si < 0) setSeries(VPS[0], firstNew >= 0 ? firstNew : 0);
      VPS.forEach(vp => { if (vp.si >= 0) show(vp); });
    }
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
      for (const vp of VPS.slice(0, S.layout)) {
        const imgs = S.series[vp.si]?.images || [];
        for (const d of [1, -1, 2, -2, 3, -3, 4, 5, 6]) { const im = imgs[vp.ii + d]; if (im && !S.destroyed) await getDecoded(im).catch(() => {}); }
      }
    }, 60);
  }

  /* ---------- series list, grouped by study ---------- */
  const studyKey = s => s.first.studyUid || s.uid;
  function renderSeriesList() {
    const el = $('#dv-series');
    const keys = [...new Set(S.series.map(studyKey))];
    let html = '';
    keys.forEach((k, si) => {
      const list = S.series.map((s, i) => [s, i]).filter(([s]) => studyKey(s) === k), f = list[0][0].first;
      if (keys.length > 1) html += `<div class="dv-study"><b>Study ${si + 1}</b><small>${esc([f.modality, f.studyDesc, S.showInfo ? dicomDate(f.studyDate) : ''].filter(Boolean).join(' · '))}</small></div>`;
      html += list.map(([s, i]) => `<button type="button" class="dv-th" data-i="${i}" title="Show in the selected viewport"><canvas width="96" height="96"></canvas><b>${esc(s.label)}</b><small>${esc([s.modality, Number.isFinite(s.number) ? 'Se ' + s.number : '', s.images.length + ' img'].filter(Boolean).join(' · '))}</small><span class="dv-tags"></span></button>`).join('');
    });
    el.innerHTML = html;
    el.querySelectorAll('.dv-th').forEach(b => b.onclick = () => setSeries(A(), +b.dataset.i, { match: S.layout === 2 }));
    markSeries();
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
  function markSeries() {
    root.querySelectorAll('.dv-th').forEach(b => {
      const i = +b.dataset.i, on = VPS.slice(0, S.layout).filter(vp => vp.si === i);
      b.classList.toggle('cur', A().si === i);
      b.querySelector('.dv-tags').innerHTML = S.layout === 2 ? on.map(vp => `<i>${vp.n ? 'Right' : 'Left'}</i>`).join('') : '';
    });
    root.querySelector('.dv-th.cur')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  /* ---------- slice positions for linked scrolling ---------- */
  function seriesGeom(s) {
    if (s._g !== undefined) return s._g;
    const ref = s.images.find(im => im.f.orientation && im.f.position)?.f;
    if (!ref || s.images.some(im => !im.f.position)) return (s._g = null);
    const normal = cross(ref.orientation.slice(0, 3), ref.orientation.slice(3));
    return (s._g = { normal, pos: s.images.map(im => dot(im.f.position, normal)) });
  }
  const posOf = vp => { const s = S.series[vp.si], g = s && seriesGeom(s); return g ? g.pos[vp.ii] : null; };
  const sameFrame = (a, b) => a.first.studyUid && a.first.studyUid === b.first.studyUid;
  function linkable(a, b) {
    const ga = seriesGeom(a), gb = seriesGeom(b);
    if (ga && gb) return Math.abs(dot(ga.normal, gb.normal)) > 0.9 ? 'pos' : null;
    return a.images.length > 1 && b.images.length > 1 ? 'frac' : null;
  }
  // Move `vp` to the slice that matches `src`. Offset is the position difference captured when the link was set.
  function follow(vp, src) {
    const a = S.series[src.si], b = S.series[vp.si]; if (!a || !b || vp === src) return;
    const mode = linkable(a, b); if (!mode) return;
    // Offsets are stored on the right-hand pane: posRight·sgn = posLeft + R.offset; idxRight = scaled idxLeft + R.offsetIdx.
    const R = VPS[1], toRight = vp === R;
    let i;
    if (mode === 'pos') {
      const ga = seriesGeom(a), gb = seriesGeom(b), sgn = Math.sign(dot(ga.normal, gb.normal)) || 1, p = ga.pos[src.ii], off = R.offset || 0;
      const target = toRight ? (p + off) * sgn : p * sgn - off;
      let best = 0, bd = Infinity; gb.pos.forEach((q, k) => { const d = Math.abs(q - target); if (d < bd) { bd = d; best = k; } }); i = best;
    } else {
      const na = a.images.length - 1, nb = b.images.length - 1, off = R.offsetIdx || 0;
      i = toRight ? Math.round(src.ii / Math.max(1, na) * nb) + off : Math.round((src.ii - off) / Math.max(1, na) * nb);
    }
    setImage(vp, i, true);
  }
  // Align the two panes at their current slices (called when the link is turned on or a series changes).
  function captureOffset() {
    const [L, R] = VPS; const a = S.series[L.si], b = S.series[R.si]; if (!a || !b) return;
    const mode = linkable(a, b);
    if (mode === 'pos') {
      const ga = seriesGeom(a), gb = seriesGeom(b), sgn = Math.sign(dot(ga.normal, gb.normal)) || 1;
      R.offset = gb.pos[R.ii] * sgn - ga.pos[L.ii];
    } else if (mode === 'frac') {
      R.offsetIdx = R.ii - Math.round(L.ii / Math.max(1, a.images.length - 1) * (b.images.length - 1));
    }
  }
  function linkNote() {
    if (S.layout < 2) return;
    const a = S.series[VPS[0].si], b = S.series[VPS[1].si];
    const mode = a && b ? linkable(a, b) : null;
    const lb = $('#dv-link'); lb.disabled = !mode;
    lb.title = !mode ? 'These series are in different planes, so they can\'t scroll together' : 'Scroll both viewports together (L). To realign, turn it off, line the slices up, and turn it on again.';
  }

  /* ---------- viewport control ---------- */
  function setActive(n) {
    S.active = n; VPS.forEach(vp => vp.el.classList.toggle('on', vp.n === n && S.layout === 2));
    const vp = A();
    $('#dv-inv').setAttribute('aria-pressed', vp.invert);
    const s = S.series[vp.si]; $('#dv-play').disabled = !s || s.images.length < 2;
    markSeries();
  }
  function setSeries(vp, i, opt = {}) {
    stopPlay();
    const s = S.series[i]; if (!s) return;
    vp.si = i; vp.wl = null; vp.zoom = 1; vp.pan = [0, 0]; vp.painted = ''; vp.offset = 0; vp.offsetIdx = 0;
    vp.ii = Math.floor((s.images.length - 1) / 2) * (s.images.length > 3 && s.first.modality !== 'US' ? 1 : 0);
    const other = VPS[1 - vp.n];
    if (opt.match && S.layout === 2 && other.si >= 0) {
      const o = S.series[other.si], mode = linkable(o, s);
      if (mode === 'pos' && sameFrame(o, s)) { VPS[1].offset = 0; follow(vp, other); }
      else if (mode) { vp.ii = Math.round(other.ii / Math.max(1, o.images.length - 1) * (s.images.length - 1)); }
      captureOffset();
    }
    const sl = vp.q('.dv-slider'); sl.max = s.images.length - 1; sl.value = vp.ii; sl.hidden = s.images.length < 2;
    vp.q('.dv-empty').hidden = true;
    if (vp === A()) setActive(vp.n); else markSeries();
    linkNote();
    show(vp);
  }
  function setImage(vp, i, fromLink) {
    const s = S.series[vp.si]; if (!s) return;
    i = Math.max(0, Math.min(s.images.length - 1, i));
    if (i === vp.ii) return;
    vp.ii = i; vp.q('.dv-slider').value = i; show(vp);
    if (!fromLink && S.layout === 2 && S.link) follow(VPS[1 - vp.n], vp);
  }
  function setLayout(n) {
    S.layout = n; stage.dataset.n = n;
    $('#dv-layout').setAttribute('aria-pressed', n === 2); $('#dv-layout').textContent = n === 2 ? 'Single view' : 'Side by side';
    $('#dv-link').hidden = n < 2;
    VPS[1].el.hidden = n < 2;
    if (n === 2 && VPS[1].si < 0) { VPS[1].q('.dv-empty').hidden = false; draw(VPS[1], null); VPS[1].q('.dv-slider').hidden = true; VPS[1].el.querySelectorAll('.dv-ov,.dv-or').forEach(e => { e.innerHTML = ''; }); }
    if (n === 1 && S.active === 1) { setActive(0); }
    setActive(S.active);
    linkNote();
    requestAnimationFrame(() => VPS.forEach(resize));
  }

  /* ---------- drawing ---------- */
  async function show(vp) {
    const img = curOf(vp); if (!img) return;
    const token = ++vp.token, m = img.f;
    let d;
    try { d = await getDecoded(img); }
    catch (e) { if (token === vp.token) { msg(vp, `Can't display this image. ${e.message || ''}`); draw(vp, null); updateOverlay(vp); } return; }
    if (token !== vp.token || S.destroyed) return;
    msg(vp, '');
    if (!vp.wl) vp.wl = m.wc != null && m.ww ? { c: m.wc, w: m.ww } : (m.modality === 'CT' ? { c: 40, w: 400 } : autoWindow(m, d));
    const key = `${vp.si}|${vp.ii}|${vp.wl.c}|${vp.wl.w}|${vp.invert}`;
    if (vp.painted !== key) {
      if (vp.ic.width !== m.cols || vp.ic.height !== m.rows) { vp.ic.width = m.cols; vp.ic.height = m.rows; }
      const id = vp.ictx.createImageData(m.cols, m.rows);
      paint(m, d, vp.wl, vp.invert, id); vp.ictx.putImageData(id, 0, 0);
      vp.painted = key;
    }
    draw(vp, m); updateOverlay(vp); prefetch();
  }
  function msg(vp, t) { const el = vp.q('.dv-msg'); el.hidden = !t; el.textContent = t; }
  function aspect(m) { return m.spacing ? m.spacing[0] / m.spacing[1] : 1; }
  function geom(vp, m) {
    const W = vp.cv.width, H = vp.cv.height, a = aspect(m), iw = m.cols, ih = m.rows * a;
    const fit = Math.min(W / iw, H / ih), k = fit * vp.zoom, dpr = devicePixelRatio || 1;
    const x0 = W / 2 + vp.pan[0] * dpr - iw * k / 2, y0 = H / 2 + vp.pan[1] * dpr - ih * k / 2;
    return { k, a, x0, y0, iw, ih, dpr, fit };
  }
  const toImg = (vp, m, sx, sy) => { const g = geom(vp, m); return [(sx * g.dpr - g.x0) / g.k, (sy * g.dpr - g.y0) / g.k / g.a]; };
  function resize(vp) {
    if (vp.el.hidden) return;
    const r = vp.el.getBoundingClientRect(), dpr = devicePixelRatio || 1;
    const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
    if (vp.cv.width !== w || vp.cv.height !== h) { vp.cv.width = w; vp.cv.height = h; }
    draw(vp, curOf(vp)?.f); if (curOf(vp) && vp.wl) updateOverlay(vp);
  }
  function lengthMM(m, p, q) {
    const dx = q[0] - p[0], dy = q[1] - p[1];
    if (m.spacing) return { v: Math.hypot(dx * m.spacing[1], dy * m.spacing[0]), u: 'mm' };
    return { v: Math.hypot(dx, dy), u: 'px' };
  }
  function draw(vp, m) {
    const ctx = vp.ctx, cv = vp.cv;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, cv.width, cv.height);
    if (!m || !vp.painted) return;
    const g = geom(vp, m);
    ctx.imageSmoothingEnabled = g.k < 3; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(vp.ic, g.x0, g.y0, g.iw * g.k, g.ih * g.k);
    const lines = [...(S.measures.get(vp.si + ':' + vp.ii) || []), ...(S.draft && S.draft.vp === vp ? [S.draft.line] : [])];
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
  function updateOverlay(vp) {
    const s = S.series[vp.si], img = curOf(vp); if (!img) return; const m = img.f;
    const line = a => a.filter(Boolean).map(x => `<div>${esc(x)}</div>`).join('');
    const keys = [...new Set(S.series.map(studyKey))], stn = keys.length > 1 ? `Study ${keys.indexOf(studyKey(s)) + 1}` : '';
    vp.q('.dv-ov.tl').innerHTML = line([stn, m.seriesDesc || s.label, [Number.isFinite(m.seriesNumber) ? 'Se ' + m.seriesNumber : '', `Im ${vp.ii + 1}/${s.images.length}`].filter(Boolean).join('  '), m.frames > 1 ? `Frame ${img.frame + 1}/${m.frames}` : '', m.modality]);
    vp.q('.dv-ov.tr').innerHTML = S.showInfo ? line([m.patientName, m.patientId && 'ID ' + m.patientId, [dicomDate(m.birthDate), m.sex, m.age].filter(Boolean).join('  '), dicomDate(m.studyDate), m.studyDesc, m.institution]) : '';
    const g = geom(vp, m), color = m.spp === 3 || /^(RGB|YBR|PALETTE)/.test(m.photometric);
    vp.q('.dv-ov.bl').innerHTML = line([color ? '' : `W ${fmt(vp.wl?.w)}  L ${fmt(vp.wl?.c)}`, `Zoom ${fmt(g.k / g.dpr * 100)}%`, vp.invert ? 'Inverted' : '']);
    vp.q('.dv-ov.br').innerHTML = line([m.sliceThickness ? `Thk ${fmt(m.sliceThickness, 2)} mm` : '', m.sliceLocation != null ? `Loc ${fmt(m.sliceLocation, 1)} mm` : '', `${m.cols} × ${m.rows}`]);
    const o = m.orientation;
    const rowDir = o && o.slice(0, 3), colDir = o && o.slice(3);
    const neg = v => v && v.map(x => -x);
    vp.q('.dv-or.r').textContent = orientLabel(rowDir); vp.q('.dv-or.l').textContent = orientLabel(neg(rowDir));
    vp.q('.dv-or.b').textContent = orientLabel(colDir); vp.q('.dv-or.t').textContent = orientLabel(neg(colDir));
  }

  /* ---------- interaction ---------- */
  const setTool = t => { S.tool = t; root.querySelectorAll('.dv-tool').forEach(b => b.setAttribute('aria-pressed', b.dataset.tool === t)); stage.dataset.tool = t; };
  setTool(S.tool);
  root.querySelectorAll('.dv-tool').forEach(b => b.onclick = () => setTool(b.dataset.tool));
  let wheelAcc = 0;
  for (const vp of VPS) {
    const cv = vp.cv, ptrs = new Map(); let drag = null;
    const repaint = () => { if (curOf(vp)) show(vp); };
    const dist = () => { const [a, b] = [...ptrs.values()]; return Math.hypot(a[0] - b[0], a[1] - b[1]); };
    const mid = () => { const [a, b] = [...ptrs.values()]; return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; };
    const zoomAt = (m, f, sx, sy) => {
      const nz = Math.max(0.1, Math.min(40, vp.zoom * f)); f = nz / vp.zoom;
      const r = cv.getBoundingClientRect(), cx = sx - r.width / 2, cy = sy - r.height / 2;
      vp.pan = [cx - (cx - vp.pan[0]) * f, cy - (cy - vp.pan[1]) * f]; vp.zoom = nz; draw(vp, m); updateOverlay(vp);
    };
    vp.zoomAt = zoomAt;
    const applyDrag = (kind, dx, dy, e) => {
      const m = curOf(vp)?.f; if (!m) return;
      if (kind === 'wl') {
        if (m.spp === 3 || m.palette) return;
        const k = Math.max(0.5, (vp.wl?.w || 400) / 250);
        vp.wl = { c: vp.wl.c + dy * k, w: Math.max(1, vp.wl.w + dx * k) }; $('#dv-preset').value = ''; repaint();
      } else if (kind === 'pan') { vp.pan[0] += dx; vp.pan[1] += dy; draw(vp, m); updateOverlay(vp); }
      else if (kind === 'zoom') { zoomAt(m, Math.exp(-dy * 0.01), drag.sx, drag.sy); }
      else if (kind === 'scroll') { drag.acc += dy; const st = Math.max(4, Math.min(16, vp.el.clientHeight / Math.max(1, S.series[vp.si].images.length))); while (Math.abs(drag.acc) >= st) { setImage(vp, vp.ii + Math.sign(drag.acc)); drag.acc -= Math.sign(drag.acc) * st; } }
      else if (kind === 'length') { const r = cv.getBoundingClientRect(); S.draft = { vp, line: [drag.p0, toImg(vp, m, e.clientX - r.left, e.clientY - r.top)] }; draw(vp, m); }
    };
    cv.addEventListener('contextmenu', e => e.preventDefault());
    cv.addEventListener('pointerdown', e => {
      if (S.active !== vp.n) setActive(vp.n);
      const m = curOf(vp)?.f; if (!m) return;
      cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, [e.clientX, e.clientY]);
      const r = cv.getBoundingClientRect();
      if (ptrs.size === 2) { drag = { kind: 'pinch', d0: dist(), z0: vp.zoom, c0: mid(), pan0: [...vp.pan] }; S.draft = null; return; }
      const kind = e.button === 1 ? 'pan' : e.button === 2 ? 'zoom' : (e.shiftKey ? 'pan' : e.ctrlKey || e.metaKey ? 'zoom' : S.tool);
      drag = { kind, x: e.clientX, y: e.clientY, sx: e.clientX - r.left, sy: e.clientY - r.top, acc: 0 };
      if (kind === 'length') drag.p0 = toImg(vp, m, drag.sx, drag.sy);
    });
    cv.addEventListener('pointermove', e => {
      if (!ptrs.has(e.pointerId) || !drag) return;
      ptrs.set(e.pointerId, [e.clientX, e.clientY]);
      const m = curOf(vp)?.f; if (!m) return;
      if (drag.kind === 'pinch') {
        if (ptrs.size < 2) return;
        const r = cv.getBoundingClientRect(), c = mid(), f = dist() / Math.max(1, drag.d0);
        vp.zoom = drag.z0; vp.pan = [...drag.pan0];
        zoomAt(m, f, drag.c0[0] - r.left, drag.c0[1] - r.top);
        vp.pan[0] += c[0] - drag.c0[0]; vp.pan[1] += c[1] - drag.c0[1]; draw(vp, m); updateOverlay(vp);
        return;
      }
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
      applyDrag(drag.kind, dx, dy, e);
    });
    const end = e => {
      ptrs.delete(e.pointerId);
      if (drag?.kind === 'length' && S.draft?.vp === vp) {
        const m = curOf(vp)?.f, L = m && lengthMM(m, S.draft.line[0], S.draft.line[1]);
        if (L && L.v > 0.5) { const k = vp.si + ':' + vp.ii; S.measures.set(k, [...(S.measures.get(k) || []), S.draft.line]); }
        S.draft = null; draw(vp, m); VPS.forEach(o => { if (o !== vp && o.si === vp.si && o.ii === vp.ii) draw(o, curOf(o)?.f); });
      }
      if (!ptrs.size) drag = null; else if (drag?.kind === 'pinch') drag = null;
    };
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
    cv.addEventListener('wheel', e => {
      const m = curOf(vp)?.f; if (!m) return; e.preventDefault();
      if (S.active !== vp.n) setActive(vp.n);
      const r = cv.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) { zoomAt(m, Math.exp(-e.deltaY * 0.0025), e.clientX - r.left, e.clientY - r.top); return; }
      wheelAcc += e.deltaMode === 1 ? e.deltaY * 30 : e.deltaY;
      const st = 50; while (Math.abs(wheelAcc) >= st) { setImage(vp, vp.ii + Math.sign(wheelAcc)); wheelAcc -= Math.sign(wheelAcc) * st; }
      if (Math.abs(e.deltaY) >= 1 && Math.abs(e.deltaY) < st && e.deltaMode === 0 && Math.abs(wheelAcc) < 1) wheelAcc = 0;
    }, { passive: false });
    vp.q('.dv-slider').oninput = e => { if (S.active !== vp.n) setActive(vp.n); setImage(vp, +e.target.value); };
    vp.el.addEventListener('pointerdown', () => { if (S.active !== vp.n) setActive(vp.n); });
  }
  stage.addEventListener('click', e => { if (e.target.closest('[data-act="compare-load"]')) $('#dv-cdir').click(); });
  $('#dv-preset').onchange = e => {
    const vp = A(), v = e.target.value, img = curOf(vp); if (!img || v === '') return;
    getDecoded(img).then(d => {
      const m = img.f;
      vp.wl = v === 'file' ? (m.wc != null && m.ww ? { c: m.wc, w: m.ww } : autoWindow(m, d)) : v === 'auto' ? autoWindow(m, d) : v === 'full' ? fullWindow(m, stats(d)) : { w: PRESETS[+v][1], c: PRESETS[+v][2] };
      show(vp);
    });
  };
  const toggleInvert = () => { const vp = A(); vp.invert = !vp.invert; $('#dv-inv').setAttribute('aria-pressed', vp.invert); show(vp); };
  const reset = () => { const vp = A(); vp.wl = null; vp.zoom = 1; vp.pan = [0, 0]; vp.invert = false; $('#dv-inv').setAttribute('aria-pressed', 'false'); $('#dv-preset').value = ''; show(vp); };
  function stopPlay() { if (S.play) { clearInterval(S.play); S.play = null; } $('#dv-play').setAttribute('aria-pressed', 'false'); $('#dv-play').textContent = 'Play'; }
  function togglePlay() {
    if (S.play) return stopPlay();
    const vp = A(), s = S.series[vp.si]; if (!s || s.images.length < 2) return;
    const fps = s.first.frameTime ? Math.min(60, 1000 / s.first.frameTime) : 12;
    S.play = setInterval(() => setImage(vp, vp.ii + 1 >= s.images.length ? 0 : vp.ii + 1), 1000 / fps);
    $('#dv-play').setAttribute('aria-pressed', 'true'); $('#dv-play').textContent = 'Stop';
  }
  $('#dv-inv').onclick = toggleInvert; $('#dv-reset').onclick = reset; $('#dv-play').onclick = togglePlay;
  $('#dv-clear').onclick = () => { const vp = A(); for (const k of [...S.measures.keys()]) if (k.startsWith(vp.si + ':')) S.measures.delete(k); VPS.forEach(o => draw(o, curOf(o)?.f)); };
  $('#dv-info').onclick = e => { S.showInfo = !S.showInfo; e.currentTarget.setAttribute('aria-pressed', S.showInfo); VPS.forEach(updateOverlay); renderSeriesList(); };
  // Folder-or-files menus for "Compare study" and "Add files". DICOM usually arrives as a folder, so that comes first.
  const closeMenus = () => root.querySelectorAll('.dv-menu').forEach(m => { m.hidden = true; m.previousElementSibling.setAttribute('aria-expanded', 'false'); });
  root.querySelectorAll('.dv-mwrap > .dv-btn').forEach(b => b.onclick = e => {
    e.stopPropagation(); const m = b.nextElementSibling, open = m.hidden; closeMenus();
    if (open) { m.hidden = false; b.setAttribute('aria-expanded', 'true'); m.querySelector('button').focus(); }
  });
  root.querySelectorAll('[data-pick]').forEach(b => b.onclick = () => { closeMenus(); $('#dv-' + b.dataset.pick).click(); });
  const onDocClick = e => { if (!e.target.closest?.('.dv-mwrap')) closeMenus(); };
  document.addEventListener('click', onDocClick);
  const toggleLayout = () => {
    if (S.layout === 1) {
      setLayout(2);
      if (VPS[1].si < 0) {
        const others = S.series.map((s, i) => i).filter(i => i !== VPS[0].si);
        if (others.length) { setActive(1); setSeries(VPS[1], others[0], { match: true }); }
        else status('Only one series is open. Use "Compare study" to load another study, or pick a series for the right-hand pane.');
      } else { captureOffset(); show(VPS[1]); }
    } else setLayout(1);
  };
  $('#dv-layout').onclick = toggleLayout;
  const toggleLink = () => { if ($('#dv-link').disabled) return; S.link = !S.link; $('#dv-link').setAttribute('aria-pressed', S.link); if (S.link) captureOffset(); };
  $('#dv-link').onclick = toggleLink;

  // Full screen: real full screen where the browser allows it, otherwise a fixed full-window mode. Same button exits.
  const dvRoot = root.querySelector('.dv');
  const isFs = () => document.fullscreenElement === dvRoot || dvRoot.classList.contains('dv-max');
  const syncFs = () => {
    const on = isFs(), b = $('#dv-fs');
    b.setAttribute('aria-pressed', on); b.title = on ? 'Exit full screen (F or Esc)' : 'Full screen (F)';
    b.innerHTML = svg(on ? 'fsx' : 'fs') + `<span>${on ? 'Exit full screen' : 'Full screen'}</span>`;
    document.documentElement.classList.toggle('dv-lock', dvRoot.classList.contains('dv-max'));
    requestAnimationFrame(() => VPS.forEach(resize));
  };
  const toggleFs = () => {
    if (document.fullscreenElement) { document.exitFullscreen().catch(() => {}); return; }
    if (dvRoot.classList.contains('dv-max')) { dvRoot.classList.remove('dv-max'); syncFs(); return; }
    if (dvRoot.requestFullscreen) dvRoot.requestFullscreen().catch(() => { dvRoot.classList.add('dv-max'); syncFs(); });
    else { dvRoot.classList.add('dv-max'); syncFs(); }
  };
  $('#dv-fs').onclick = toggleFs;
  const closeAll = () => {
    stopPlay(); if (isFs()) toggleFs();
    S.files = []; S.series = []; S.studyOrder = []; S.cache.clear(); S.cacheBytes = 0; S.measures.clear();
    VPS.forEach(vp => { vp.si = -1; vp.painted = ''; }); setLayout(1); S.active = 0;
    $('#dv-app').hidden = true; $('#dv-drop').hidden = false; $('#dv-drop').classList.remove('err'); $('#dv-drop small').textContent = 'Files open on this device only. Nothing is uploaded or stored.';
  };
  $('#dv-close').onclick = closeAll;
  $('#dv-pick').onclick = () => $('#dv-files').click(); $('#dv-pickdir').onclick = () => $('#dv-dir').click(); 
  $('#dv-files').onchange = e => { load(e.target.files); e.target.value = ''; };
  $('#dv-dir').onchange = e => { load(e.target.files); e.target.value = ''; };
  $('#dv-cfiles').onchange = e => { load(e.target.files, true); e.target.value = ''; };
  $('#dv-cdir').onchange = e => { load(e.target.files, true); e.target.value = ''; };
  const onKey = e => {
    if ($('#dv-app').hidden || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName) && document.activeElement.type !== 'range') return;
    if (e.key === 'Escape' && root.querySelector('.dv-menu:not([hidden])')) { e.preventDefault(); closeMenus(); return; }
    if (e.key === 'Escape' && dvRoot.classList.contains('dv-max')) { e.preventDefault(); toggleFs(); return; }
    const vp = A(), s = S.series[vp.si];
    const act = { f: toggleFs, F: toggleFs, c: toggleLayout, C: toggleLayout, l: toggleLink, L: toggleLink, Tab: S.layout === 2 ? () => setActive(1 - S.active) : null }[e.key];
    if (act) { e.preventDefault(); act(); return; }
    if (!s) return;
    const nav = { ArrowDown: () => setImage(vp, vp.ii + 1), ArrowRight: () => setImage(vp, vp.ii + 1), ArrowUp: () => setImage(vp, vp.ii - 1), ArrowLeft: () => setImage(vp, vp.ii - 1),
      PageDown: () => setImage(vp, vp.ii + 10), PageUp: () => setImage(vp, vp.ii - 10), Home: () => setImage(vp, 0), End: () => setImage(vp, s.images.length - 1),
      i: toggleInvert, I: toggleInvert, r: reset, R: reset, ' ': togglePlay }[e.key];
    if (nav) { e.preventDefault(); nav(); }
    else if (/^[1-9]$/.test(e.key) && PRESETS[+e.key - 1]) { const sel = $('#dv-preset'); sel.value = String(+e.key - 1); sel.onchange({ target: sel }); }
  };
  document.addEventListener('keydown', onKey);
  // Drop anywhere on the viewer. Dropping onto the right-hand pane in side-by-side view loads a comparison study.
  const prevent = e => { e.preventDefault(); dvRoot.classList.toggle('dv-over', e.type === 'dragover'); };
  dvRoot.addEventListener('dragover', prevent); dvRoot.addEventListener('dragleave', prevent);
  dvRoot.addEventListener('drop', async e => {
    e.preventDefault(); dvRoot.classList.remove('dv-over');
    const compare = S.layout === 2 && !!e.target.closest?.('.dv-vp[data-vp="1"]');
    const items = [...(e.dataTransfer.items || [])].map(i => i.webkitGetAsEntry && i.webkitGetAsEntry()).filter(Boolean);
    if (items.length) { const out = []; busy('Reading folder…'); for (const it of items) await readEntries(it, out); load(out, compare); }
    else load(e.dataTransfer.files, compare);
  });
  setLayout(1);
  const ro = new ResizeObserver(() => VPS.forEach(resize)); VPS.forEach(vp => ro.observe(vp.el));
  const onFs = () => syncFs(); document.addEventListener('fullscreenchange', onFs);
  return {
    load,
    destroy() {
      S.destroyed = true; stopPlay(); ro.disconnect(); document.removeEventListener('keydown', onKey); document.removeEventListener('fullscreenchange', onFs); document.removeEventListener('click', onDocClick);
      document.documentElement.classList.remove('dv-lock'); S.cache.clear();
    },
  };
}
