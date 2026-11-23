// POST /api/analyze { image: base64 JPEG } → what the problem is, how bad, a description, and where faces/plates are.
import { generateJson, json, rateLimited, respondLater } from './_lib/ai';
import { q } from './_lib/db';
import { PROMPT_VERSION, SYSTEM, toAnalysis } from './_lib/vision';

export const config = { runtime: 'edge' };
const MAX_B64 = 2_000_000; // ~1.5 MB of JPEG

// Answers start streaming at once, so a slow free-tier model can't hit the Edge 25-second start limit
export default function handler(req: Request): Response {
  return respondLater(() => handle(req));
}

async function handle(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);
  if (rateLimited(req, 12, 10 * 60_000)) return json({ error: 'Too many photos from you just now. Try again in a few minutes.' }, 429);
  let image = '';
  try { const b = await req.json(); image = typeof b.image === 'string' ? b.image : ''; } catch { return json({ error: 'Send JSON with an "image" field.' }, 400); }
  if (!image) return json({ error: 'No photo received.' }, 400);
  if (image.length > MAX_B64) return json({ error: 'That photo is too large.' }, 413);

  try {
    const r = await generateJson(SYSTEM, 'Describe the civic problem in this photo.', toAnalysis, { mime: 'image/jpeg', data: image });
    log(r.provider, true, r.ms, r.data.issue, r.data.confidence);
    return json({ analysis: r.data, source: r.provider, ms: r.ms, promptVersion: PROMPT_VERSION });
  } catch (e) {
    console.error(JSON.stringify({ route: 'analyze', error: e instanceof Error ? e.message : String(e) }));
    log(null, false, null, null, null);
    return json({ error: 'The photo reader is busy or out of free quota. Pick the problem yourself below.' }, 503);
  }
}

function log(provider: string | null, ok: boolean, ms: number | null, issue: string | null, confidence: number | null) {
  // Observability: one row per AI call, so the README can say how often it works and how fast. Never blocks the reply.
  q('INSERT INTO nagrik_ai_calls (route, provider, ok, ms, prompt_version, issue, confidence) VALUES ($1,$2,$3,$4,$5,$6,$7)', ['analyze', provider, ok, ms, PROMPT_VERSION, issue, confidence]).catch(() => {});
}
