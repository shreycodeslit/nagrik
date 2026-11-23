// GET /api/photo?id=5&kind=before|after → the (already blurred) JPEG, or a redirect to the demo sample
import { q } from './_lib/db';

export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  const u = new URL(req.url);
  const id = Number(u.searchParams.get('id'));
  const kind = u.searchParams.get('kind') === 'after' ? 'after' : 'before';
  if (!Number.isInteger(id) || id < 1) return new Response('Bad id', { status: 400 });
  try {
    const [p] = await q<{ jpeg_base64: string }>(`SELECT jpeg_base64 FROM photos WHERE case_id = $1 AND kind = $2 ORDER BY id DESC LIMIT 1`, [id, kind]);
    if (p) {
      const bin = atob(p.jpeg_base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return new Response(bytes, { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=86400, immutable' } });
    }
    if (kind === 'before') {
      const [c] = await q<{ sample_photo: string | null }>(`SELECT sample_photo FROM cases WHERE id = $1`, [id]);
      if (c?.sample_photo) return Response.redirect(new URL(c.sample_photo, u.origin).toString(), 302);
    }
    return new Response('No photo', { status: 404 });
  } catch {
    return new Response('Database unavailable', { status: 503 });
  }
}
