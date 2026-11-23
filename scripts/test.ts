// End-to-end test of the API against a real local Postgres.
// The Neon driver speaks HTTP, so a tiny stand-in server here translates its requests to a normal Postgres connection.
// Gemini is faked; everything else (SQL, duplicates, photos, timeline) is real.
// Run: TEST_PG=postgresql://postgres@127.0.0.1:5499 npm test
import http from 'node:http';
import pg from 'pg';
import { neonConfig } from '@neondatabase/serverless';
import { routeFor } from '../src/lib/directory';
import { complaintText } from '../src/lib/complaint';
import { ISSUES } from '../src/lib/issues';
import { toAnalysis } from '../api/_lib/vision';

const base = process.env.TEST_PG || 'postgresql://postgres@127.0.0.1:5499';
let failures = 0;
const ok = (cond: unknown, label: string) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${label}`); if (!cond) failures++; };

// ---------- pure logic ----------
for (const i of ISSUES) {
  const r = routeFor(i.id, 'unknown');
  ok(r.channels.length >= 2 && r.channels[0].kind === 'whatsapp', `route for ${i.id} starts with WhatsApp and has a backup`);
}
ok(routeFor('pothole', 'main').body === 'GMDA' && routeFor('pothole', 'internal').body === 'MCG', 'main roads go to GMDA, sector roads to MCG');
const txt = complaintText({ issue: 'pothole', severity: 4, title: 't', description: 'Deep pothole.', descriptionHi: 'गड्ढा', locality: 'Sector 29', lat: 28.46, lng: 77.06, department: 'Engineering wing', departmentHi: 'इंजीनियरिंग', reports: 3 }, 'en');
ok(txt.includes('maps.google.com/?q=28.460000,77.060000') && txt.includes('reported by 3 residents'), 'complaint has a map link and the report count');
const messy = toAnalysis({ issue: 'unicorn', confidence: 7, severity: 9, title: 'x', description: 'y', roadType: 'highway', privacyBoxes: [[10, 10, 5, 50], [100, 100, 300, 2000]] });
ok(messy.issue === 'other' && messy.confidence === 0.5 && messy.severity === 3 && messy.roadType === 'unknown', 'bad model fields fall back to safe values');
ok(messy.privacyBoxes.length === 1 && messy.privacyBoxes[0][3] === 1000, 'privacy boxes are clamped and empty ones dropped');

// ---------- API against Postgres ----------
const admin = new pg.Client({ connectionString: `${base}/postgres` });
await admin.connect();
await admin.query('DROP DATABASE IF EXISTS nagrik_test');
await admin.query('CREATE DATABASE nagrik_test');
await admin.end();
const pool = new pg.Pool({ connectionString: `${base}/nagrik_test` });
// Another app's tables with the same plain names (as in a shared Neon database) must not get in the way
await pool.query('CREATE TABLE photos (id SERIAL PRIMARY KEY, post_id INTEGER, data BYTEA); CREATE TABLE events (id SERIAL PRIMARY KEY, title TEXT)');
const raw = { getTypeParser: () => (v: string) => v };

const server = http.createServer(async (req, res) => {
  let body = ''; for await (const c of req) body += c;
  try {
    const { query, params } = JSON.parse(body);
    const r = await pool.query({ text: query, values: params, rowMode: 'array', types: raw as never });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ command: r.command, rowCount: r.rowCount, fields: r.fields.map((f) => ({ name: f.name, dataTypeID: f.dataTypeID })), rows: r.rows }));
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: (e as Error).message, code: (e as { code?: string }).code }));
  }
});
await new Promise<void>((r) => server.listen(4455, r));
neonConfig.fetchEndpoint = () => 'http://127.0.0.1:4455/sql';
process.env.DATABASE_URL = 'postgresql://user:pass@ep-test.local/nagrik_test';
process.env.GEMINI_API_KEY = 'fake';

const realFetch = globalThis.fetch;
globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
  if (String(url).includes('generativelanguage.googleapis.com')) {
    const text = JSON.stringify({ issue: 'pothole', confidence: 0.92, severity: 4, title: 'Deep pothole in the left lane', description: 'A pothole a metre wide.', descriptionHi: 'एक मीटर चौड़ा गड्ढा।', roadType: 'main', hazards: ['bikes swerving'], privacyBoxes: [[100, 200, 180, 260]] });
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), { status: 200 });
  }
  return realFetch(url, init);
}) as typeof fetch;

const H = (path: string) => import(`../api/${path}.ts`).then((m) => m.default as (r: Request) => Promise<Response>);
const req = (url: string, method = 'GET', body?: unknown, ip = '10.0.0.1') => new Request(`http://local${url}`, { method, headers: { 'x-forwarded-for': ip, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
const [cases, kase, analyze, photo, status] = await Promise.all(['cases', 'case', 'analyze', 'photo', 'status'].map(H));

let r = await cases(req('/api/cases'));
let d = await r.json();
ok(r.status === 200 && d.cases.length === 6 && d.cases.every((c: { demo: boolean }) => c.demo), 'fresh database is seeded with 6 sample reports, alongside another app\'s photos and events tables');

r = await analyze(req('/api/analyze', 'POST', { image: 'aGVsbG8=' }));
d = await r.json();
ok(r.status === 200 && d.analysis.issue === 'pothole' && d.analysis.privacyBoxes.length === 1 && d.source === 'gemini', 'photo reader returns a validated analysis');

const tinyJpeg = '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';
const fresh = { issue: 'streetlight', severity: 3, title: 'Streetlight out near the temple', description: 'Two poles dark.', lat: 28.4401, lng: 77.0601, locality: 'Sector 40', photo: tinyJpeg, photoHash: 'ffee0011aabbccdd' };
r = await cases(req('/api/cases', 'POST', fresh));
d = await r.json();
ok(r.status === 201 && d.id > 6, 'a new report is saved');
const newId = d.id;

r = await cases(req('/api/cases', 'POST', { ...fresh, lat: 28.4402, photoHash: 'ffee0011aabbccdf' }));
d = await r.json();
ok(r.status === 409 && d.duplicateOf[0].id === newId && d.duplicateOf[0].metres <= 15 && d.duplicateOf[0].samePhoto, 'same problem 11 m away is caught as a duplicate, with a matching photo');

r = await cases(req('/api/cases', 'POST', { ...fresh, issue: 'garbage', lat: 28.4402 }));
ok(r.status === 201, 'a different kind of problem at the same spot is a new report');

r = await cases(req('/api/cases', 'POST', { ...fresh, lat: 19.07, lng: 72.87 }));
ok(r.status === 422, 'a report outside Gurugram is refused');

r = await cases(req('/api/cases', 'POST', { ...fresh, title: '' }));
ok(r.status === 400, 'missing title is refused');

await kase(req(`/api/case?id=${newId}`, 'POST', { action: 'plus_one' }));
await kase(req(`/api/case?id=${newId}`, 'POST', { action: 'filed', ref: 'GMDA/2026/11/1234' }));
r = await kase(req(`/api/case?id=${newId}`, 'POST', { action: 'fixed' }));
ok(r.status === 400, 'marking fixed needs an after photo');
await kase(req(`/api/case?id=${newId}`, 'POST', { action: 'fixed', photo: tinyJpeg }));
r = await kase(req(`/api/case?id=${newId}`));
d = (await r.json()).case;
ok(d.status === 'fixed' && d.plusOnes === 2 && d.filedRef === 'GMDA/2026/11/1234' && d.hasAfter, 'case moves through plus one, filed and fixed');
ok(d.events.map((e: { kind: string }) => e.kind).join(',') === 'reported,plus_one,filed,fixed', 'timeline records every step in order');

r = await photo(req(`/api/photo?id=${newId}&kind=after`));
const bytes = new Uint8Array(await r.arrayBuffer());
ok(r.status === 200 && r.headers.get('content-type') === 'image/jpeg' && bytes[0] === 0xff && bytes[1] === 0xd8, 'after photo is served as a real JPEG');
r = await photo(req('/api/photo?id=1'));
ok(r.status === 302 && r.headers.get('location')?.endsWith('/samples/garbage.jpg'), 'sample reports redirect to their sample photo');

r = await status(req('/api/status'));
d = await r.json();
ok(d.cases.total === 8 && d.cases.fixed === 2 && d.photoReader.calls >= 1, 'status counts cases and logged AI calls');

let last = 0;
for (let i = 0; i < 10; i++) last = (await cases(req('/api/cases', 'POST', { ...fresh, lat: 28.42 + i * 0.01 }, '10.9.9.9'))).status;
ok(last === 429, 'too many reports from one visitor are rate limited');

server.close(); await pool.end();
console.log(failures ? `\n${failures} failed` : '\nAll passed');
process.exit(failures ? 1 : 0);
