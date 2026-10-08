// Builds dist/: copies the site and compiles content/cases/*.yml into dist/data/cases.json.
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const dist = path.join(root, 'dist');
const SECTIONS = ['neuro', 'hn', 'chest', 'cardiac', 'vascular', 'body', 'msk', 'breast', 'peds', 'nm'];

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(path.join(dist, 'data'), { recursive: true });
for (const item of ['index.html', 'assets', 'img', 'media', '_headers', '_redirects']) {
  const from = path.join(root, item);
  if (fs.existsSync(from)) fs.cpSync(from, path.join(dist, item), { recursive: true });
}

const dir = path.join(root, 'content', 'cases');
const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => /\.ya?ml$/i.test(f)) : [];
const cases = [];
let problems = 0;
for (const file of files) {
  let d;
  try { d = yaml.load(fs.readFileSync(path.join(dir, file), 'utf8')) || {}; }
  catch (e) { console.error(`✗ ${file}: could not read YAML (${e.message})`); problems++; continue; }
  if (d.draft) { console.log(`· ${file}: draft, skipped`); continue; }
  if (!d.title) { console.error(`✗ ${file}: missing title`); problems++; continue; }
  if (!SECTIONS.includes(d.section)) { console.error(`✗ ${file}: unknown section "${d.section}"`); problems++; continue; }
  const str = v => (v == null ? '' : String(v));
  const list = v => Array.isArray(v) ? v.map(str).map(x => x.trim()).filter(Boolean)
    : str(v).split(/[\n,]/).map(x => x.trim()).filter(Boolean);
  cases.push({
    id: file.replace(/\.ya?ml$/i, '').toLowerCase().replace(/[^a-z0-9-]+/g, '-'),
    sec: d.section,
    title: str(d.title),
    modality: list(d.modality),
    created: d.date ? new Date(d.date).toISOString() : '',
    images: (d.images || []).filter(im => im && im.image).map(im => ({ src: str(im.image), caption: str(im.caption) })),
    history: str(d.history), findings: str(d.findings), diagnosis: str(d.diagnosis), discussion: str(d.discussion),
    refs: str(d.references).split('\n').map(x => x.trim()).filter(Boolean),
  });
}
fs.writeFileSync(path.join(dist, 'data', 'cases.json'), JSON.stringify(cases));
console.log(`✓ Built ${cases.length} case(s) into dist/`);
if (problems) { console.error(`${problems} case file(s) had problems and were left out.`); }
