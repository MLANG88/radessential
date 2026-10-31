// RadEssential worker: serves the static site and the /api/ddx differential-diagnosis endpoint.
// The model runs on Cloudflare Workers AI (free daily allocation on the Workers Free plan); no API key is stored anywhere.

// Primary: Google Gemma 4 26B (vision). Fallbacks if it is unavailable or rejects the request.
const MODELS = ['@cf/google/gemma-4-26b-a4b-it', '@cf/google/gemma-3-12b-it', '@cf/meta/llama-4-scout-17b-16e-instruct'];
const MAX_TEXT = 4000;
const MAX_IMAGES = 4;
const MAX_IMAGE_BYTES = 1_500_000; // per image, as base64 data URL length

const SYSTEM = `You are a board-certified radiologist helping another radiologist build a differential diagnosis.
Work only from the findings and images provided. Do not invent findings that were not described or are not visible.
If images are provided, first describe what you can actually see (modality, plane, sequence or phase if identifiable, location, key features), and say plainly when image quality, a single slice, or missing context limits interpretation.
Rank diagnoses by likelihood given any age, sex, history and imaging features in the text. Always include critical "do not miss" diagnoses when they are plausible.
Use standard radiology terminology. Be concise. Never give treatment advice; recommend imaging or work-up steps only.
Respond with JSON only, no markdown, matching exactly this shape:
{"image_description": string (empty if no image),
 "summary": string (one or two sentences restating the key findings),
 "differential": [{"diagnosis": string, "likelihood": "most likely" | "likely" | "possible" | "less likely", "supporting": string, "against": string}],
 "do_not_miss": [string],
 "discriminating_features": [string],
 "next_steps": [string],
 "limitations": string}
Give 3 to 7 entries in "differential", ordered from most to least likely.`;

const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

function parseModelJSON(text) {
  if (typeof text !== 'string') return text && typeof text === 'object' ? text : null;
  const t = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  try { return JSON.parse(t); } catch {}
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch {} }
  return null;
}

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
      const out = await env.AI.run(model, { messages, max_tokens: 1400, temperature: 0.2 });
      const raw = out && (out.response ?? out.result?.response ?? out.choices?.[0]?.message?.content);
      const parsed = parseModelJSON(raw);
      if (parsed && Array.isArray(parsed.differential)) return json({ ok: true, model, result: parsed });
      if (raw) return json({ ok: true, model, text: typeof raw === 'string' ? raw : JSON.stringify(raw) });
      lastErr = new Error('Empty model response');
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
export { parseModelJSON, SYSTEM };
