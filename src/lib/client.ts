import type { Analysis, CaseDetail, CaseSummary } from './issues';

async function call<T>(url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data: T & { error?: string } }> {
  try {
    const res = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) } });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok && !data?.error, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: 'No connection. Check your internet and try again.' } as T & { error: string } };
  }
}

export const api = {
  analyze: (image: string) => call<{ analysis: Analysis; source: string; ms: number }>('/api/analyze', { method: 'POST', body: JSON.stringify({ image }) }),
  cases: () => call<{ cases: CaseSummary[] }>('/api/cases'),
  create: (body: Record<string, unknown>) => call<{ id?: number; duplicateOf?: { id: number; title: string; metres: number; plusOnes: number; samePhoto: boolean }[] }>('/api/cases', { method: 'POST', body: JSON.stringify(body) }),
  get: (id: number) => call<{ case: CaseDetail }>(`/api/case?id=${id}`),
  act: (id: number, body: Record<string, unknown>) => call<{ ok: boolean }>(`/api/case?id=${id}`, { method: 'POST', body: JSON.stringify(body) }),
  status: () => call<{ ai: boolean; db: boolean | string; cases?: { total: number; fixed: number; reports: number }; photoReader?: { calls: number; okRate: number; medianMs: number } }>('/api/status'),
};

/** Neighbourhood name for a point, from BigDataCloud's free browser endpoint. */
export async function placeName(lat: number, lng: number): Promise<string | null> {
  try {
    const u = new URL('https://api.bigdatacloud.net/data/reverse-geocode-client');
    u.search = new URLSearchParams({ latitude: String(lat), longitude: String(lng), localityLanguage: 'en' }).toString();
    const d = await (await fetch(u)).json();
    const parts = [d.locality, d.city].filter((x: string | undefined, i: number, a: (string | undefined)[]) => x && a.indexOf(x) === i);
    return parts.join(', ') || null;
  } catch { return null; }
}

export const photoUrl = (id: number, kind: 'before' | 'after' = 'before') => `/api/photo?id=${id}&kind=${kind}`;

export function ago(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d <= 0) return 'today';
  if (d === 1) return 'yesterday';
  if (d < 30) return `${d} days ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
