// GET  /api/cases            → every open case plus cases fixed in the last 60 days (no photos)
// POST /api/cases { ... }    → new case; if a matching open case is nearby, returns it instead unless { force: true }
import { z } from 'zod';
import { json, rateLimited } from './_lib/ai';
import { q } from './_lib/db';
import { ISSUE_IDS } from '../src/lib/issues';
import { hamming, inGurugram, metresBetween } from '../src/lib/geo';

export const config = { runtime: 'edge' };

const SUMMARY = `id, issue, severity, title, lat, lng, locality, status, plus_ones AS "plusOnes", created_at AS "createdAt", updated_at AS "updatedAt", demo,
  (sample_photo IS NOT NULL OR EXISTS (SELECT 1 FROM photos p WHERE p.case_id = cases.id AND p.kind = 'before')) AS "hasPhoto",
  EXISTS (SELECT 1 FROM photos p WHERE p.case_id = cases.id AND p.kind = 'after') AS "hasAfter"`;

const NewCase = z.object({
  issue: z.enum(ISSUE_IDS),
  severity: z.number().int().min(1).max(5),
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(3).max(800),
  descriptionHi: z.string().trim().max(1000).optional().nullable(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  locality: z.string().trim().max(120).optional().nullable(),
  photo: z.string().max(1_400_000).optional().nullable(), // base64 JPEG, already blurred in the browser
  photoHash: z.string().regex(/^[0-9a-f]{16}$/).optional().nullable(),
  force: z.boolean().optional(),
});

export default async function handler(req: Request): Promise<Response> {
  try {
    if (req.method === 'GET') {
      const rows = await q(`SELECT ${SUMMARY} FROM cases WHERE status <> 'fixed' OR updated_at > NOW() - INTERVAL '60 days' ORDER BY created_at DESC LIMIT 500`);
      return new Response(JSON.stringify({ cases: rows }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 's-maxage=20, stale-while-revalidate=60' } });
    }
    if (req.method !== 'POST') return json({ error: 'Use GET or POST.' }, 405);
    if (rateLimited(req, 8, 10 * 60_000)) return json({ error: 'Too many reports from you just now. Try again in a few minutes.' }, 429);

    const parsed = NewCase.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return json({ error: 'Some details are missing or too long.', issues: parsed.error.issues.map((i) => i.path.join('.')) }, 400);
    const c = parsed.data;
    if (!inGurugram(c)) return json({ error: 'Nagrik covers Gurugram for now. This location is outside it.' }, 422);

    // Same problem already reported? Same kind, open, within 60 m; a similar photo makes it a near-certain match.
    if (!c.force) {
      const near = await q<{ id: number; lat: number; lng: number; photo_hash: string | null; title: string; plusOnes: number }>(
        `SELECT id, lat, lng, photo_hash, title, plus_ones AS "plusOnes" FROM cases
         WHERE issue = $1 AND status <> 'fixed' AND lat BETWEEN $2 - 0.0007 AND $2 + 0.0007 AND lng BETWEEN $3 - 0.0007 AND $3 + 0.0007`,
        [c.issue, c.lat, c.lng]);
      const matches = near
        .map((n) => ({ ...n, metres: Math.round(metresBetween(n, c)), photoDistance: c.photoHash && n.photo_hash ? hamming(c.photoHash, n.photo_hash) : null }))
        .filter((n) => n.metres <= 60)
        .sort((a, b) => a.metres - b.metres);
      if (matches.length) return json({ duplicateOf: matches.map(({ photo_hash: _h, ...m }) => ({ ...m, samePhoto: m.photoDistance !== null && m.photoDistance <= 12 })) }, 409);
    }

    const [row] = await q<{ id: number }>(
      `INSERT INTO cases (issue, severity, title, description, description_hi, lat, lng, locality, photo_hash) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [c.issue, c.severity, c.title, c.description, c.descriptionHi ?? null, c.lat, c.lng, c.locality ?? null, c.photoHash ?? null]);
    if (c.photo) await q(`INSERT INTO photos (case_id, kind, jpeg_base64) VALUES ($1, 'before', $2)`, [row.id, c.photo]);
    await q(`INSERT INTO events (case_id, kind) VALUES ($1, 'reported')`, [row.id]);
    return json({ id: row.id }, 201);
  } catch (e) {
    console.error(JSON.stringify({ route: 'cases', error: e instanceof Error ? e.message : String(e) }));
    return json({ error: 'Could not reach the database. Try again in a minute.' }, 503);
  }
}
