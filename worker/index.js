// RadEssential worker: serves the static site and the /api/ddx differential-diagnosis endpoint.
// The model runs on Cloudflare Workers AI (free daily allocation on the Workers Free plan); no API key is stored anywhere.

// Primary: Google Gemma 4 26B (vision). Fallbacks if it is unavailable or rejects the request.
const MODELS = ['@cf/google/gemma-4-26b-a4b-it', '@cf/google/gemma-3-12b-it', '@cf/meta/llama-4-scout-17b-16e-instruct'];
const MAX_TEXT = 4000;
const MAX_IMAGES = 4; // per conversation
const MAX_TURNS = 16;
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
Keep it concise (under about 350 words). Do not add a disclaimer; the page shows one.
This is a conversation. On follow-up turns the user may add findings, history, labs, prior imaging or more images, correct earlier information, or ask a question.
- If they add or change information: begin with a "### What changed" section (one to three bullets on how the new information shifts the picture, naming diagnoses that moved up, moved down or dropped out), then give the complete updated answer in the same sections as above, taking all information so far into account. Newer information overrides older information where they conflict.
- If they only ask a question (for example about a sign, a discriminator or the next test), answer it directly and briefly in Markdown without repeating the full differential.`;

const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

async function ddx(request, env) {
  if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405);
  if (!env.AI) return json({ error: 'The AI service is not configured for this site.' }, 503);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Invalid request.' }, 400); }
  const okImg = im => typeof im === 'string' && /^data:image\/(png|jpe?g|webp);base64,/.test(im) && im.length <= MAX_IMAGE_BYTES;
  // Accept a chat history ({messages:[{role,text,images}]}) or the original single-turn form ({findings, images}).
  let turns = Array.isArray(body.messages)
    ? (body.messages.length > MAX_TURNS ? [body.messages[0], ...body.messages.slice(-(MAX_TURNS - 2))] : body.messages).map(m => ({ role: m && m.role === 'assistant' ? 'assistant' : 'user', text: String(m && m.text || '').slice(0, MAX_TEXT).trim(), images: Array.isArray(m && m.images) ? m.images : [] }))
    : [{ role: 'user', text: String(body.findings || '').slice(0, MAX_TEXT).trim(), images: Array.isArray(body.images) ? body.images : [] }];
  while (turns.length && turns[0].role !== 'user') turns.shift();
  if (!turns.length || turns[turns.length - 1].role !== 'user') return json({ error: 'The last message must come from the user.' }, 400);
  let nImg = 0;
  for (const t of turns) {
    if (t.role === 'assistant') { t.images = []; continue; }
    for (const im of t.images) if (!okImg(im)) return json({ error: 'Images must be PNG, JPEG or WebP under about 1 MB each.' }, 400);
    nImg += t.images.length;
  }
  if (nImg > MAX_IMAGES) return json({ error: `Up to ${MAX_IMAGES} images per case.` }, 400);
  const last = turns[turns.length - 1];
  if (!last.text && !last.images.length) return json({ error: 'Describe the findings or add an image.' }, 400);
  const first = turns.findIndex(t => t.role === 'user');
  const toMsg = (t, i) => {
    if (t.role === 'assistant') return { role: 'assistant', content: t.text || '(no answer)' };
    const lead = i === first ? (t.text ? `Case and imaging findings:\n${t.text}` : `No text was given; interpret the attached image${t.images.length > 1 ? 's' : ''}.`)
      : (t.text ? `Update or follow-up:\n${t.text}` : `Additional image${t.images.length > 1 ? 's' : ''} attached; update the differential.`);
    return { role: 'user', content: t.images.length ? [{ type: 'text', text: lead }, ...t.images.map(url => ({ type: 'image_url', image_url: { url } }))] : lead };
  };
  const messages = [{ role: 'system', content: SYSTEM }, ...turns.map(toMsg)];

  // Non-streaming call with server-side checks: reasoning models (Gemma 4) can spend the token budget on hidden
  // "thinking" and return no visible text, so an empty answer falls through to the next model.
  const pick = out => {
    if (!out) return '';
    if (typeof out === 'string') return out;
    const c = out.choices?.[0]?.message?.content ?? out.choices?.[0]?.text;
    const v = out.response ?? out.result?.response ?? (Array.isArray(c) ? c.map(x => x.text || '').join('') : c);
    return typeof v === 'string' ? v : (v ? JSON.stringify(v) : '');
  };
  const clean = t => t.replace(/<think>[\s\S]*?(<\/think>|$)/g, '').trim();
  const attempts = [];
  for (const model of MODELS) {
    const variants = model.includes('gemma-4')
      ? [{ chat_template_kwargs: { enable_thinking: false } }, { reasoning_effort: 'low' }, {}]
      : [{}];
    for (const extra of variants) {
      try {
        const out = await env.AI.run(model, { messages, max_tokens: 2048, temperature: 0.3, ...extra });
        const text = clean(pick(out));
        if (text) {
          const sse = `data: ${JSON.stringify({ response: text })}\n\ndata: [DONE]\n\n`;
          return new Response(sse, { headers: { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-store', 'x-model': model } });
        }
        attempts.push(`${model}${Object.keys(extra).length ? ' ' + Object.keys(extra)[0] : ''}: empty (keys ${Object.keys(out || {}).join(',')})`);
      } catch (e) {
        attempts.push(`${model}${Object.keys(extra).length ? ' ' + Object.keys(extra)[0] : ''}: ${String(e && e.message || e).slice(0, 120)}`);
      }
    }
  }
  const detail = attempts.join(' | ');
  const quota = /quota|neuron|429|daily/i.test(detail);
  return json({ error: quota ? 'The free AI allowance for today has been used. Please try again later.' : 'The AI service could not answer. Please try again.', detail: detail.slice(0, 900) }, quota ? 429 : 502);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/ddx') return ddx(request, env);
    return env.ASSETS.fetch(request);
  },
};
export { SYSTEM };
