// Search-engine pages. Run by build.mjs after dist/ is copied.
// For each reference entry, section, atlas and tool, writes dist/<route>.html: the normal app shell with its own
// title, description, canonical URL, social preview tags and structured data, and the page content already in place
// so search engines and link previews can read it without running JavaScript. Also writes sitemap.xml and robots.txt.
// The reference content comes from assets/app.js, so there is still only one place to edit an entry.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

export const SITE = 'https://radessential.com';
const NAME = 'RadEssential';
const OG_IMAGE = `${SITE}/img/og-card.png`;

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const text = html => String(html ?? '').replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ').trim();
const clip = (s, n = 155) => s.length <= n ? s : s.slice(0, s.lastIndexOf(' ', n - 1)).replace(/[\s,;:.–—-]+$/, '') + '…';
const paths = html => html.replace(/href="#([^"]*)"/g, 'href="/$1"');
const ld = obj => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;

// Evaluate the data half of app.js (helpers + entries), stopping before anything that touches the page.
function loadContent(root) {
  const src = fs.readFileSync(path.join(root, 'assets', 'app.js'), 'utf8');
  const cut = src.indexOf('/* ---------- routing');
  if (cut < 0) throw new Error('seo: routing marker not found in app.js');
  const ctx = vm.createContext({ URL, document: { baseURI: SITE + '/' } });
  const data = vm.runInContext(src.slice(0, cut) + '\n;({E, SECTIONS, CALC_LINKS})', ctx);
  const block = src.slice(src.indexOf('const ATLAS=['), src.indexOf('];', src.indexOf('const ATLAS=[')));
  const atlas = [...block.matchAll(/\{id:'([^']+)'[^\n]*?title:'([^']+)',sub:'([^']+)'/g)].map(m => ({ id: m[1], title: m[2], sub: m[3] }));
  return { ...data, atlas };
}

const SEC_IMG = { neuro: 'brain', hn: 'neck', chest: 'thoracic', body: 'abdomen', incid: 'pet', msk: 'kneexr', breast: 'breast' };
const IMGV = k => k ? ` style="--img:url('/img/sec-${k}.webp')"` : '';
const FOOT = `<p class="foot">Radessential summarizes published classification systems for practicing radiologists. Summaries are condensed; confirm details against the cited source before relying on them for patient care.</p>`;

function head({ title, desc, route, type = 'website', extra = '' }) {
  const url = SITE + '/' + route;
  return `<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="${type}">
<meta property="og:site_name" content="${NAME}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${OG_IMAGE}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
${extra}`;
}

export function writeSeo(root, dist) {
  const { E, SECTIONS, CALC_LINKS, atlas } = loadContent(root);
  const shell = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  if (!/<!--seo[\s\S]*?<!--\/seo-->/.test(shell) || !shell.includes('<main id="view"></main>')) throw new Error('seo: index.html markers missing');
  const byId = Object.fromEntries(E.map(e => [e.id, e]));
  const secName = id => id === 'calc' ? 'Calculators' : SECTIONS.find(s => s.id === id).name;
  const inSec = id => id === 'calc' ? [...E.filter(e => e.sec === 'calc'), ...CALC_LINKS.map(i => byId[i])].filter(Boolean) : E.filter(e => e.sec === id);

  // A static index of every page, placed in the side nav until the app draws its own.
  const navHtml = `<a class="home" href="/">Index</a>` + SECTIONS.map(s => `<div class="navh"><a href="/sec-${s.id}">${esc(secName(s.id))}</a></div><div class="items">${inSec(s.id).map(e => `<a href="/${e.id}">${e.title}</a>`).join('')}</div>`).join('')
    + `<div class="navh"><a href="/anatomy">Atlas</a></div><div class="items">${atlas.map(a => `<a href="/anatomy-${a.id}">${esc(a.title)}</a>`).join('')}</div>`
    + `<div class="navh"><a href="/ddx">Differential generator</a></div>`;

  const page = (file, tags, main) => {
    const html = shell.replace(/<!--seo[\s\S]*?<!--\/seo-->\n?/, tags)
      .replace('<nav class="nav" id="nav" aria-label="Index"></nav>', `<nav class="nav" id="nav" aria-label="Index">${navHtml}</nav>`)
      .replace('<main id="view"></main>', `<main id="view">${main}</main>`);
    fs.writeFileSync(path.join(dist, file), html);
  };
  const urls = [''];

  // Home
  page('index.html', head({
    title: `${NAME}: radiology quick reference`,
    desc: 'Radiology classifications, node stations, incidental-finding algorithms and calculators for the reading room, each cited to its primary publication or society white paper.',
    route: '',
    extra: ld({ '@context': 'https://schema.org', '@type': 'WebSite', name: NAME, url: SITE + '/', description: 'Radiology quick reference for the reading room.' }),
  }), '');

  // Reference entries
  for (const e of E) {
    const list = inSec(e.sec), i = list.indexOf(e), prev = list[i - 1], next = list[i + 1];
    const fm = e.body.match(/^<details class="figs"[\s\S]*?<\/details>/), figTop = fm ? fm[0] : '', rest = fm ? e.body.slice(fm[0].length) : e.body;
    const desc = clip(text(e.lede));
    const pm = q => `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(q)}`;
    const main = paths(`<article class="wrap entry">
<header class="ebanner"${IMGV(SEC_IMG[e.sec])}><div class="crumb"><a href="#">Index</a> / <a href="#sec-${e.sec}">${secName(e.sec)}</a></div>
<div class="ehead"><h1>${e.title}</h1></div>
<div class="meta"><span class="tag v">${e.ver}</span>${e.tags.map(t => `<span class="tag">${t}</span>`).join('')}</div></header>
${figTop}<p class="lede">${e.lede}</p>
${rest}
<section class="src"><h3>Sources</h3><ol>${e.refs.map(r => `<li>${r.c}${r.q ? `<span class="lk"><a href="${pm(r.q)}" target="_blank" rel="noopener">PubMed ↗</a></span>` : ''}</li>`).join('')}</ol></section>
<div class="pager">${prev ? `<a href="#${prev.id}"><small>Previous</small>${prev.title}</a>` : '<span></span>'}${next ? `<a class="nx" href="#${next.id}"><small>Next</small>${next.title}</a>` : ''}</div>
${FOOT}</article>`);
    page(`${e.id}.html`, head({
      title: `${text(e.title)} | ${NAME}`, desc, route: e.id, type: 'article',
      extra: ld({
        '@context': 'https://schema.org', '@type': 'MedicalWebPage', name: text(e.title), headline: text(e.title), description: desc,
        url: `${SITE}/${e.id}`, inLanguage: 'en', audience: { '@type': 'MedicalAudience', audienceType: 'Clinician' },
        citation: e.refs.map(r => text(r.c)), isPartOf: { '@type': 'WebSite', name: NAME, url: SITE + '/' },
        breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [
          { '@type': 'ListItem', position: 1, name: secName(e.sec), item: `${SITE}/sec-${e.sec}` },
          { '@type': 'ListItem', position: 2, name: text(e.title), item: `${SITE}/${e.id}` }] },
      }),
    }), main);
    urls.push(e.id);
  }

  // Section lists
  for (const s of SECTIONS) {
    const list = inSec(s.id), name = secName(s.id);
    const main = paths(`<div class="wrap"><header class="ebanner"${IMGV(SEC_IMG[s.id])}><div class="crumb"><a href="#">Index</a></div><div class="ehead"><h1>${name}</h1></div></header>
<ul class="seclist">${list.map(e => `<li><a href="#${e.id}"><b>${e.title}</b><small>${e.ver}</small></a></li>`).join('')}</ul>${FOOT}</div>`);
    page(`sec-${s.id}.html`, head({
      title: `${name} | ${NAME}`,
      desc: clip(`${name} radiology reference: ${list.map(e => text(e.title)).join(', ')}.`),
      route: `sec-${s.id}`,
    }), main);
    urls.push(`sec-${s.id}`);
  }

  // Atlas and tools: tags only; the app draws these pages.
  page('anatomy.html', head({ title: `Cross-sectional anatomy atlas | ${NAME}`, desc: clip(`Interactive labeled anatomy: ${atlas.map(a => a.title).join(', ')}.`), route: 'anatomy' }), '');
  urls.push('anatomy');
  for (const a of atlas) {
    page(`anatomy-${a.id}.html`, head({ title: `${a.title} anatomy atlas | ${NAME}`, desc: clip(`Interactive labeled ${a.title} anatomy. ${a.sub.replace(/ · /g, ', ')}.`), route: `anatomy-${a.id}` }), '');
    urls.push(`anatomy-${a.id}`);
  }
  page('ddx.html', head({ title: `Radiology differential generator | ${NAME}`, desc: 'Describe imaging findings and get a ranked radiology differential diagnosis with discriminating features. Educational aid.', route: 'ddx' }), '');
  urls.push('ddx');

  fs.writeFileSync(path.join(dist, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${SITE}/${u}</loc></url>`).join('\n')}
</urlset>
`);
  fs.writeFileSync(path.join(dist, 'robots.txt'), `User-agent: *
Disallow: /api/
Sitemap: ${SITE}/sitemap.xml
`);
  return urls.length;
}
