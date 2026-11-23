// GET /api/status → which services are configured, and how the photo reader has done lately (from the ai_calls log)
import { generateJson, json } from './_lib/ai';
import { q } from './_lib/db';

declare const process: { env: Record<string, string | undefined> };
export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  const out: Record<string, unknown> = { ai: !!process.env.GEMINI_API_KEY, db: !!process.env.DATABASE_URL };
  if (out.db) {
    try {
      const [s] = await q(`SELECT COUNT(*)::int AS calls, COALESCE(AVG(ok::int), 0)::real AS "okRate", COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ms), 0)::int AS "medianMs"
        FROM ai_calls WHERE created_at > NOW() - INTERVAL '30 days'`);
      const [c] = await q(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status = 'fixed')::int AS fixed, COALESCE(SUM(plus_ones), 0)::int AS reports FROM cases`);
      Object.assign(out, { photoReader: s, cases: c });
    } catch (e) {
      out.db = 'unreachable';
      // Say why, without echoing the connection string
      if (new URL(req.url).searchParams.get('check') === '1') out.dbError = (e instanceof Error ? e.message : String(e)).replace(/postgres(ql)?:\/\/\S+/gi, '[connection string]');
    }
  }
  if (new URL(req.url).searchParams.get('check') === '1') {
    try { const r = await generateJson('Reply with JSON {"ok": true}.', 'ping', (raw) => raw); out.aiCheck = { provider: r.provider, ms: r.ms, earlierFailures: r.skipped }; }
    catch (e) { out.aiCheck = { error: e instanceof Error ? e.message : String(e) }; }
  }
  return json(out);
}
