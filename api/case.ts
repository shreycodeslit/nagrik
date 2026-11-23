// GET  /api/case?id=5                         → one case with its timeline
// POST /api/case?id=5 { action, ref?, photo? } → plus_one | filed | acknowledged | fixed
import { z } from 'zod';
import { json, rateLimited } from './_lib/ai';
import { q } from './_lib/db';

export const config = { runtime: 'edge' };

const Action = z.object({
  action: z.enum(['plus_one', 'filed', 'acknowledged', 'fixed']),
  ref: z.string().trim().max(60).optional().nullable(),
  photo: z.string().max(1_400_000).optional().nullable(),
});

export default async function handler(req: Request): Promise<Response> {
  const id = Number(new URL(req.url).searchParams.get('id'));
  if (!Number.isInteger(id) || id < 1) return json({ error: 'Which case? Add ?id=' }, 400);
  try {
    if (req.method === 'GET') {
      const [c] = await q(`SELECT id, issue, severity, title, description, description_hi AS "descriptionHi", lat, lng, locality, city, status, filed_ref AS "filedRef",
          plus_ones AS "plusOnes", created_at AS "createdAt", updated_at AS "updatedAt", demo,
          (sample_photo IS NOT NULL OR EXISTS (SELECT 1 FROM nagrik_photos p WHERE p.case_id = nagrik_cases.id AND p.kind = 'before')) AS "hasPhoto",
          EXISTS (SELECT 1 FROM nagrik_photos p WHERE p.case_id = nagrik_cases.id AND p.kind = 'after') AS "hasAfter"
        FROM nagrik_cases WHERE id = $1`, [id]);
      if (!c) return json({ error: 'No such case.' }, 404);
      const events = await q(`SELECT kind, note, created_at AS "createdAt" FROM nagrik_events WHERE case_id = $1 ORDER BY created_at`, [id]);
      return json({ case: { ...c, events } });
    }
    if (req.method !== 'POST') return json({ error: 'Use GET or POST.' }, 405);
    if (rateLimited(req, 20, 10 * 60_000)) return json({ error: 'Too many updates from you just now.' }, 429);
    const p = Action.safeParse(await req.json().catch(() => null));
    if (!p.success) return json({ error: 'Unknown action.' }, 400);
    const { action, ref, photo } = p.data;
    const [exists] = await q<{ status: string }>(`SELECT status FROM nagrik_cases WHERE id = $1`, [id]);
    if (!exists) return json({ error: 'No such case.' }, 404);

    if (action === 'plus_one') {
      await q(`UPDATE nagrik_cases SET plus_ones = plus_ones + 1, updated_at = NOW() WHERE id = $1`, [id]);
      await q(`INSERT INTO nagrik_events (case_id, kind) VALUES ($1, 'plus_one')`, [id]);
    } else if (action === 'fixed') {
      if (!photo) return json({ error: 'Add a photo showing it fixed.' }, 400);
      await q(`INSERT INTO nagrik_photos (case_id, kind, jpeg_base64) VALUES ($1, 'after', $2)`, [id, photo]);
      await q(`UPDATE nagrik_cases SET status = 'fixed', updated_at = NOW() WHERE id = $1`, [id]);
      await q(`INSERT INTO nagrik_events (case_id, kind, note) VALUES ($1, 'fixed', 'After photo added')`, [id]);
    } else {
      await q(`UPDATE nagrik_cases SET status = $2, filed_ref = COALESCE($3, filed_ref), updated_at = NOW() WHERE id = $1 AND status <> 'fixed'`, [id, action, ref ?? null]);
      await q(`INSERT INTO nagrik_events (case_id, kind, note) VALUES ($1, $2, $3)`, [id, action, ref ? `Complaint no. ${ref}` : null]);
    }
    return json({ ok: true });
  } catch (e) {
    console.error(JSON.stringify({ route: 'case', error: e instanceof Error ? e.message : String(e) }));
    return json({ error: 'Could not reach the database. Try again in a minute.' }, 503);
  }
}
