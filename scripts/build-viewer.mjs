// Bundles viewer/src into assets/viewer/ (committed, so the site build needs no extra tools).
// Run after changing viewer/src:  npm install && npm run build:viewer
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const out = path.join(root, 'assets', 'viewer');
fs.rmSync(out, { recursive: true, force: true });
await build({
  entryPoints: [path.join(root, 'viewer', 'src', 'index.js')],
  outdir: out, bundle: true, format: 'esm', splitting: true, minify: true, target: 'es2020',
  platform: 'browser', external: ['fs', 'path'], entryNames: 'viewer', chunkNames: 'chunk-[hash]', legalComments: 'linked',
});
fs.mkdirSync(path.join(out, 'codecs'), { recursive: true });
for (const [pkg, file] of [['@cornerstonejs/codec-openjpeg', 'openjpegwasm_decode.wasm'], ['@cornerstonejs/codec-charls', 'charlswasm_decode.wasm']]) {
  fs.copyFileSync(path.join(root, 'node_modules', pkg, 'dist', file), path.join(out, 'codecs', file));
}
for (const f of fs.readdirSync(out)) console.log(f.padEnd(36), fs.statSync(path.join(out, f)).isFile() ? (fs.statSync(path.join(out, f)).size / 1024).toFixed(0) + ' KB' : '');
