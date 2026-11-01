// Reads DICOM files, groups them into series and sorts each series into anatomical order.
// Everything runs in the browser; no file data leaves the device.
import dicomParser from 'dicom-parser';

const TAG = {
  sopClass: 'x00080016', modality: 'x00080060', studyDate: 'x00080020', studyDesc: 'x00081030', seriesDesc: 'x0008103e',
  institution: 'x00080080', patientName: 'x00100010', patientId: 'x00100020', birthDate: 'x00100030', sex: 'x00100040', age: 'x00101010',
  sliceThickness: 'x00180050', seriesUid: 'x0020000e', studyUid: 'x0020000d', seriesNumber: 'x00200011', instanceNumber: 'x00200013',
  position: 'x00200032', orientation: 'x00200037', sliceLocation: 'x00201041', spp: 'x00280002', photometric: 'x00280004',
  frames: 'x00280008', rows: 'x00280010', cols: 'x00280011', pixelSpacing: 'x00280030', imagerPixelSpacing: 'x00181164',
  bitsAllocated: 'x00280100', bitsStored: 'x00280101', pixelRep: 'x00280103', planar: 'x00280006',
  center: 'x00281050', width: 'x00281051', intercept: 'x00281052', slope: 'x00281053', pixelData: 'x7fe00010',
  transferSyntax: 'x00020010', frameTime: 'x00181063',
};

const str = (ds, t) => { try { return (ds.string(t) || '').trim(); } catch { return ''; } };
const num = (ds, t, i = 0) => { const v = ds.floatString(t, i); return Number.isFinite(v) ? v : null; };
const nums = (ds, t, n) => { const s = str(ds, t); if (!s) return null; const a = s.split('\\').map(Number); return a.length >= n && a.every(Number.isFinite) ? a : null; };
const int = (ds, t, d = null) => { const v = ds.uint16(t); return v == null ? d : v; };

export const personName = s => s.replace(/\^+/g, ' ').trim();

// Parse one file. Returns null for files that are not images (DICOMDIR, reports, non-DICOM).
export function parseFile(name, buffer) {
  const bytes = new Uint8Array(buffer);
  let ds;
  try { ds = dicomParser.parseDicom(bytes); } catch { return null; }
  const pixel = ds.elements[TAG.pixelData];
  const rows = int(ds, TAG.rows), cols = int(ds, TAG.cols);
  if (!pixel || !rows || !cols) return null;
  const frames = Math.max(1, parseInt(str(ds, TAG.frames), 10) || 1);
  const meta = {
    file: name, ds, pixel, rows, cols, frames,
    ts: str(ds, TAG.transferSyntax) || '1.2.840.10008.1.2',
    modality: str(ds, TAG.modality), studyDate: str(ds, TAG.studyDate), studyDesc: str(ds, TAG.studyDesc), seriesDesc: str(ds, TAG.seriesDesc),
    institution: str(ds, TAG.institution), patientName: personName(str(ds, TAG.patientName)), patientId: str(ds, TAG.patientId),
    birthDate: str(ds, TAG.birthDate), sex: str(ds, TAG.sex), age: str(ds, TAG.age),
    seriesUid: str(ds, TAG.seriesUid) || 'series-' + name, studyUid: str(ds, TAG.studyUid),
    seriesNumber: parseInt(str(ds, TAG.seriesNumber), 10), instanceNumber: parseInt(str(ds, TAG.instanceNumber), 10),
    position: nums(ds, TAG.position, 3), orientation: nums(ds, TAG.orientation, 6), sliceLocation: num(ds, TAG.sliceLocation),
    sliceThickness: num(ds, TAG.sliceThickness),
    spacing: nums(ds, TAG.pixelSpacing, 2) || nums(ds, TAG.imagerPixelSpacing, 2),
    spp: int(ds, TAG.spp, 1), photometric: str(ds, TAG.photometric) || 'MONOCHROME2', planar: int(ds, TAG.planar, 0),
    bitsAllocated: int(ds, TAG.bitsAllocated, 16), bitsStored: int(ds, TAG.bitsStored, 16), pixelRep: int(ds, TAG.pixelRep, 0),
    slope: num(ds, TAG.slope) ?? 1, intercept: num(ds, TAG.intercept) ?? 0,
    wc: num(ds, TAG.center), ww: num(ds, TAG.width), frameTime: num(ds, TAG.frameTime),
  };
  if (!(meta.slope)) meta.slope = 1;
  if (meta.photometric === 'PALETTE COLOR') meta.palette = readPalette(ds);
  return meta;
}

// Palette colour lookup tables (PS3.3 C.7.6.3.1.5), scaled to 0–255.
function readPalette(ds) {
  const out = {};
  for (const [c, d, t] of [['r', 'x00281101', 'x00281201'], ['g', 'x00281102', 'x00281202'], ['b', 'x00281103', 'x00281203']]) {
    const el = ds.elements[t]; if (!el || !ds.elements[d]) return null;
    const n = ds.uint16(d, 0) || 65536, first = ds.uint16(d, 1), bits = ds.uint16(d, 2);
    const raw = ds.byteArray.subarray(el.dataOffset, el.dataOffset + el.length);
    const lut = new Uint8Array(n);
    if (el.length === n) lut.set(raw.subarray(0, n));
    else { const dv = new DataView(raw.buffer, raw.byteOffset, raw.byteLength); let mx = 0; for (let i = 0; i < n; i++) mx = Math.max(mx, dv.getUint16(i * 2, true)); const sh = bits === 16 || mx > 255 ? 8 : 0; for (let i = 0; i < n; i++) lut[i] = dv.getUint16(i * 2, true) >> sh; }
    out[c] = lut; out.first = first; out.n = n;
  }
  return out;
}

const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// Group parsed files into series of images (one image per frame) and sort each series.
export function buildSeries(files) {
  const map = new Map();
  for (const f of files) {
    if (!map.has(f.seriesUid)) map.set(f.seriesUid, []);
    map.get(f.seriesUid).push(f);
  }
  const series = [];
  for (const [uid, list] of map) {
    const ref = list.find(f => f.orientation);
    const normal = ref ? cross(ref.orientation.slice(0, 3), ref.orientation.slice(3)) : null;
    const key = f => normal && f.position ? dot(f.position, normal) : null;
    const sortable = normal && list.every(f => f.position);
    list.sort((a, b) => sortable ? key(a) - key(b)
      : (Number.isFinite(a.instanceNumber) && Number.isFinite(b.instanceNumber) ? a.instanceNumber - b.instanceNumber : a.file.localeCompare(b.file, undefined, { numeric: true })));
    // Head-first convention: show superior/first instance at the top of the stack when positions run the other way.
    if (sortable && list.length > 1 && Number.isFinite(list[0].instanceNumber) && Number.isFinite(list.at(-1).instanceNumber) && list[0].instanceNumber > list.at(-1).instanceNumber) list.reverse();
    const images = [];
    for (const f of list) for (let i = 0; i < f.frames; i++) images.push({ f, frame: i });
    const first = list[0];
    series.push({
      uid, images, first,
      label: first.seriesDesc || first.modality || 'Series',
      number: first.seriesNumber,
      modality: first.modality,
    });
  }
  series.sort((a, b) => (a.first.studyUid || '').localeCompare(b.first.studyUid || '') || (a.number ?? 1e9) - (b.number ?? 1e9) || a.label.localeCompare(b.label));
  return series;
}

// Patient-orientation letters for a direction cosine, e.g. [1,0,0] → "L".
export function orientLabel(v) {
  if (!v) return '';
  const ax = [['L', 'R'], ['P', 'A'], ['H', 'F']];
  const order = [0, 1, 2].sort((i, j) => Math.abs(v[j]) - Math.abs(v[i]));
  let s = '';
  for (const i of order) { if (Math.abs(v[i]) < 0.25) break; s += v[i] > 0 ? ax[i][0] : ax[i][1]; if (s.length === 2) break; }
  return s;
}
