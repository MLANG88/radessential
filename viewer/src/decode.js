// Turns a DICOM frame into raw pixel values. Compressed formats load their decoders only when first needed.
import dicomParser from 'dicom-parser';

export const TS_NAMES = {
  '1.2.840.10008.1.2': 'Implicit VR Little Endian', '1.2.840.10008.1.2.1': 'Explicit VR Little Endian',
  '1.2.840.10008.1.2.2': 'Explicit VR Big Endian', '1.2.840.10008.1.2.1.99': 'Deflated Little Endian',
  '1.2.840.10008.1.2.5': 'RLE Lossless', '1.2.840.10008.1.2.4.50': 'JPEG Baseline', '1.2.840.10008.1.2.4.51': 'JPEG Extended (12-bit)',
  '1.2.840.10008.1.2.4.57': 'JPEG Lossless', '1.2.840.10008.1.2.4.70': 'JPEG Lossless SV1',
  '1.2.840.10008.1.2.4.80': 'JPEG-LS Lossless', '1.2.840.10008.1.2.4.81': 'JPEG-LS Near-lossless',
  '1.2.840.10008.1.2.4.90': 'JPEG 2000 Lossless', '1.2.840.10008.1.2.4.91': 'JPEG 2000',
};
const UNCOMPRESSED = new Set(['1.2.840.10008.1.2', '1.2.840.10008.1.2.1', '1.2.840.10008.1.2.2']);
export const isSupported = ts => UNCOMPRESSED.has(ts) || ['1.2.840.10008.1.2.5', '1.2.840.10008.1.2.4.50', '1.2.840.10008.1.2.4.51', '1.2.840.10008.1.2.4.57', '1.2.840.10008.1.2.4.70',
  '1.2.840.10008.1.2.4.80', '1.2.840.10008.1.2.4.81', '1.2.840.10008.1.2.4.90', '1.2.840.10008.1.2.4.91'].includes(ts);

// Bytes of one compressed frame.
function encapsulatedFrame(m, index) {
  const el = m.pixel;
  if (!el.encapsulatedPixelData) throw new Error('Pixel data is not encapsulated');
  if (el.basicOffsetTable.length) return dicomParser.readEncapsulatedImageFrame(m.ds, el, index);
  if (m.frames === 1) return dicomParser.readEncapsulatedPixelDataFromFragments(m.ds, el, 0, el.fragments.length);
  if (el.fragments.length === m.frames) return dicomParser.readEncapsulatedPixelDataFromFragments(m.ds, el, index, 1);
  return dicomParser.readEncapsulatedImageFrame(m.ds, el, index, dicomParser.createJPEGBasicOffsetTable(m.ds, el));
}

const typed = (bytes, bits, signed) => {
  const copy = bytes.byteOffset % (bits / 8) ? bytes.slice() : bytes;
  const n = copy.byteLength / (bits / 8);
  if (bits === 8) return signed ? new Int8Array(copy.buffer, copy.byteOffset, n) : new Uint8Array(copy.buffer, copy.byteOffset, n);
  if (bits === 16) return signed ? new Int16Array(copy.buffer, copy.byteOffset, n) : new Uint16Array(copy.buffer, copy.byteOffset, n);
  if (bits === 32) return signed ? new Int32Array(copy.buffer, copy.byteOffset, n) : new Uint32Array(copy.buffer, copy.byteOffset, n);
  throw new Error(`${bits}-bit pixels are not supported`);
};

function uncompressed(m, index) {
  const { rows, cols, spp, bitsAllocated } = m;
  if (bitsAllocated === 1) { // bit-packed, frames contiguous
    const n = rows * cols, out = new Uint8Array(n), base = m.pixel.dataOffset, b0 = index * n, a = m.ds.byteArray;
    for (let i = 0; i < n; i++) { const b = b0 + i; out[i] = (a[base + (b >> 3)] >> (b & 7)) & 1; }
    return out;
  }
  if (m.photometric === 'YBR_FULL_422' && bitsAllocated === 8) { // Y1 Y2 Cb Cr per pixel pair → interleaved YBR_FULL
    const n = rows * cols, start = m.pixel.dataOffset + index * n * 2, a = m.ds.byteArray, out = new Uint8Array(n * 3);
    for (let p = 0, i = start; p < n; p += 2, i += 4) { out[p * 3] = a[i]; out[p * 3 + 3] = a[i + 1]; out[p * 3 + 1] = out[p * 3 + 4] = a[i + 2]; out[p * 3 + 2] = out[p * 3 + 5] = a[i + 3]; }
    return out;
  }
  const frameBytes = rows * cols * spp * bitsAllocated / 8;
  const start = m.pixel.dataOffset + index * frameBytes;
  let bytes = m.ds.byteArray.subarray(start, start + frameBytes);
  if (m.ts === '1.2.840.10008.1.2.2' && bitsAllocated > 8) {
    bytes = bytes.slice(); const w = bitsAllocated / 8;
    for (let i = 0; i < bytes.length; i += w) bytes.subarray(i, i + w).reverse();
  }
  return typed(bytes, bitsAllocated, m.pixelRep === 1);
}

// DICOM RLE (PS3.5 Annex G): up to 15 segments, one per byte plane, most significant first.
function rle(m, bytes) {
  const { rows, cols, spp, bitsAllocated } = m;
  const n = rows * cols, bpp = bitsAllocated / 8;
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const segs = dv.getUint32(0, true);
  const out = new Uint8Array(n * spp * bpp);
  for (let s = 0; s < segs; s++) {
    const start = dv.getUint32(4 + 4 * s, true), end = s + 1 < segs ? dv.getUint32(8 + 4 * s, true) : bytes.length;
    const sample = Math.floor(s / bpp), byteInSample = bpp - 1 - (s % bpp);
    // Output layout: interleaved samples, little-endian bytes.
    let o = 0, i = start;
    const put = v => { if (o < n) out[(o * spp + sample) * bpp + byteInSample] = v; o++; };
    while (i < end && o < n) {
      const c = (bytes[i++] << 24) >> 24;
      if (c >= 0) { for (let k = 0; k <= c && i < end; k++) put(bytes[i++]); }
      else if (c > -128) { const v = bytes[i++]; for (let k = 0; k < 1 - c; k++) put(v); }
    }
  }
  return typed(out, bitsAllocated, m.pixelRep === 1);
}

async function jpegBaseline(m, bytes) {
  const bmp = await createImageBitmap(new Blob([bytes], { type: 'image/jpeg' }));
  const c = new OffscreenCanvas(bmp.width, bmp.height), g = c.getContext('2d');
  g.drawImage(bmp, 0, 0);
  const rgba = g.getImageData(0, 0, bmp.width, bmp.height).data;
  const n = bmp.width * bmp.height;
  if (m.spp === 1) { const out = new Uint8Array(n); for (let i = 0; i < n; i++) out[i] = rgba[i * 4]; return { pixels: out }; }
  const out = new Uint8Array(n * 3); for (let i = 0; i < n; i++) { out[i * 3] = rgba[i * 4]; out[i * 3 + 1] = rgba[i * 4 + 1]; out[i * 3 + 2] = rgba[i * 4 + 2]; }
  return { pixels: out, photometric: 'RGB' };
}

async function jpeg12(m, bytes) {
  const { default: JpegImage } = await import('./vendor/jpeg12.js');
  const j = new JpegImage(); j.parse(bytes); j.colorTransform = false;
  return typed(m.bitsAllocated <= 8 ? j.getData(m.cols, m.rows) : new Uint8Array(j.getData16(m.cols, m.rows).buffer), m.bitsAllocated <= 8 ? 8 : 16, m.pixelRep === 1);
}

async function jpegLossless(m, bytes) {
  const { Decoder } = await import('jpeg-lossless-decoder-js');
  const d = new Decoder();
  const buf = d.decode(bytes.buffer, bytes.byteOffset, bytes.byteLength, m.bitsAllocated <= 8 ? 1 : 2);
  return typed(new Uint8Array(buf.buffer || buf), m.bitsAllocated <= 8 ? 8 : 16, m.pixelRep === 1);
}

const codecs = {};
async function wasmCodec(kind) {
  if (!codecs[kind]) codecs[kind] = (async () => {
    const mod = kind === 'j2k' ? await import('@cornerstonejs/codec-openjpeg/decodewasmjs') : await import('@cornerstonejs/codec-charls/decodewasmjs');
    const factory = mod.default || mod;
    const wasm = kind === 'j2k' ? 'openjpegwasm_decode.wasm' : 'charlswasm_decode.wasm';
    return factory({ locateFile: f => f.endsWith('.wasm') ? new URL('./codecs/' + wasm, import.meta.url).href : f });
  })();
  return codecs[kind];
}
async function wasmDecode(m, bytes, kind) {
  const codec = await wasmCodec(kind);
  const dec = kind === 'j2k' ? new codec.J2KDecoder() : new codec.JpegLSDecoder();
  try {
    dec.getEncodedBuffer(bytes.length).set(bytes);
    dec.decode();
    const info = dec.getFrameInfo();
    const out = dec.getDecodedBuffer().slice();
    const bits = info.bitsPerSample > 8 ? 16 : 8;
    const px = typed(out, bits, info.isSigned || m.pixelRep === 1);
    const res = { pixels: px };
    if (info.componentCount === 3) res.photometric = 'RGB';
    if (kind === 'jls' && info.componentCount === 3 && dec.getInterleaveMode && dec.getInterleaveMode() === 0) res.planar = 1;
    return res;
  } finally { dec.delete && dec.delete(); }
}

// Returns {pixels, photometric, planar} with photometric/planar overriding the header when the codec already converted colour.
export async function decodeFrame(m, index) {
  const ts = m.ts;
  if (UNCOMPRESSED.has(ts)) return m.photometric === 'YBR_FULL_422' ? { pixels: uncompressed(m, index), photometric: 'YBR_FULL', planar: 0 } : { pixels: uncompressed(m, index) };
  if (!isSupported(ts)) throw new Error(`Compression not supported: ${TS_NAMES[ts] || ts}`);
  const bytes = encapsulatedFrame(m, index);
  let r;
  if (ts === '1.2.840.10008.1.2.5') r = { pixels: rle(m, bytes), planar: 0 };
  else if (ts === '1.2.840.10008.1.2.4.50') r = m.bitsAllocated > 8 ? { pixels: await jpeg12(m, bytes) } : await jpegBaseline(m, bytes);
  else if (ts === '1.2.840.10008.1.2.4.51') r = m.bitsAllocated > 8 || m.spp === 1 ? { pixels: await jpeg12(m, bytes) } : await jpegBaseline(m, bytes);
  else if (ts === '1.2.840.10008.1.2.4.57' || ts === '1.2.840.10008.1.2.4.70') r = { pixels: await jpegLossless(m, bytes) };
  else if (ts === '1.2.840.10008.1.2.4.80' || ts === '1.2.840.10008.1.2.4.81') r = await wasmDecode(m, bytes, 'jls');
  else r = await wasmDecode(m, bytes, 'j2k');
  if (r.photometric === undefined && /^YBR/.test(m.photometric) && ts !== '1.2.840.10008.1.2.5') r.photometric = 'RGB';
  return r;
}
