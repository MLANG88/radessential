// RadEssential worker: serves the static site and the /api/ddx differential-diagnosis endpoint.
// The model runs on Cloudflare Workers AI (free daily allocation on the Workers Free plan); no API key is stored anywhere.

// Primary: Google Gemma 4 26B (vision). Fallbacks if it is unavailable or rejects the request.
const MODELS = ['@cf/google/gemma-4-26b-a4b-it', '@cf/google/gemma-3-12b-it', '@cf/meta/llama-4-scout-17b-16e-instruct'];
const MAX_TEXT = 4000;
const MAX_IMAGES = 4;
const MAX_IMAGE_BYTES = 1_500_000; // per image, as base64 data URL length

const SYSTEM = `You are an experienced radiologist helping a colleague think through a case. Write like a helpful expert answer in a search assistant: clear, well organised, readable at a glance.
Work only from what the user describes and what is visible in any attached images. Never invent findings. If images are attached, start by briefly saying what you can see (modality, plane, sequence or phase if identifiable, location, key features) and note any limits, such as a single slice or poor quality.
Format the answer in Markdown with these sections, using ### headings:
### Key findings
One or two sentences.
### Differential diagnosis
A numbered list ordered from most to least likely, 3 to 6 items. Each item: **Diagnosis** — *likelihood (most likely / likely / possible / less likely)* — one or two sentences on the features for and against.
### Don't miss
Short bullets of critical diagnoses to exclude, if any are plausible.
### Helpful discriminators
Short bullets: features or sequences that separate the leading options.
### Suggested next steps
Short bullets: imaging, comparison or work-up only. Never give treatment advice.
Keep it concise (under about 350 words). Do not add a disclaimer; the page shows one.`;

const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

async function ddx(request, env) {
  if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405);
  if (!env.AI) return json({ error: 'The AI service is not configured for this site.' }, 503);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Invalid request.' }, 400); }
  const findings = String(body.findings || '').slice(0, MAX_TEXT).trim();
  const ctx = body.context || {};
  const images = Array.isArray(body.images) ? body.images.slice(0, MAX_IMAGES) : [];
  for (const im of images) {
    if (typeof im !== 'string' || !/^data:image\/(png|jpe?g|webp);base64,/.test(im) || im.length > MAX_IMAGE_BYTES)
      return json({ error: 'Images must be PNG, JPEG or WebP under about 1 MB each.' }, 400);
  }
  if (!findings && !images.length) return json({ error: 'Describe the findings or add an image.' }, 400);

  const userText = findings ? `Case and imaging findings:\n${findings}` : `No text was given; interpret the attached image${images.length > 1 ? 's' : ''}.`;
  const content = images.length
    ? [{ type: 'text', text: userText }, ...images.map(url => ({ type: 'image_url', image_url: { url } }))]
    : userText;
  const messages = [{ role: 'system', content: SYSTEM }, { role: 'user', content }];

  let lastErr;
  for (const model of MODELS) {
    try {
      const stream = await env.AI.run(model, { messages, max_tokens: 1400, temperature: 0.3, stream: true });
      if (!stream || typeof stream.getReader !== 'function') throw new Error('No stream');
      return new Response(stream, { headers: { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-store', 'x-model': model } });
    } catch (e) { lastErr = e; }
  }
  const msg = String(lastErr && lastErr.message || lastErr);
  const quota = /quota|limit|neuron|429|capacity/i.test(msg);
  return json({ error: quota ? 'The free AI allowance for today has been used. Please try again later.' : 'The AI service could not answer. Please try again.', detail: msg.slice(0, 300) }, quota ? 429 : 502);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/ddx') return ddx(request, env);
    return env.ASSETS.fetch(request);
  },
};
export { SYSTEM };
