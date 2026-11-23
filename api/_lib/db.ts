// Postgres on Neon (free tier), over HTTP so it works from Vercel Edge Functions.
import { neon } from '@neondatabase/serverless';

declare const process: { env: Record<string, string | undefined> };

let ready: Promise<void> | null = null;

export function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  return neon(url);
}

export async function q<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  await ensureSchema();
  return (await db().query(text, params)) as T[];
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS cases (
     id SERIAL PRIMARY KEY,
     issue TEXT NOT NULL,
     severity SMALLINT NOT NULL CHECK (severity BETWEEN 1 AND 5),
     title TEXT NOT NULL,
     description TEXT NOT NULL,
     description_hi TEXT,
     lat DOUBLE PRECISION NOT NULL,
     lng DOUBLE PRECISION NOT NULL,
     locality TEXT,
     city TEXT NOT NULL DEFAULT 'Gurugram',
     status TEXT NOT NULL DEFAULT 'reported' CHECK (status IN ('reported','filed','acknowledged','fixed')),
     filed_ref TEXT,
     plus_ones INTEGER NOT NULL DEFAULT 1,
     photo_hash TEXT,
     sample_photo TEXT,
     demo BOOLEAN NOT NULL DEFAULT FALSE,
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
  `CREATE INDEX IF NOT EXISTS cases_open_idx ON cases (status, issue)`,
  `CREATE TABLE IF NOT EXISTS photos (
     id SERIAL PRIMARY KEY,
     case_id INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
     kind TEXT NOT NULL CHECK (kind IN ('before','after')),
     jpeg_base64 TEXT NOT NULL,
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
  `CREATE INDEX IF NOT EXISTS photos_case_idx ON photos (case_id, kind)`,
  `CREATE TABLE IF NOT EXISTS events (
     id SERIAL PRIMARY KEY,
     case_id INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
     kind TEXT NOT NULL,
     note TEXT,
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
  `CREATE TABLE IF NOT EXISTS ai_calls (
     id SERIAL PRIMARY KEY,
     route TEXT NOT NULL, provider TEXT, ok BOOLEAN NOT NULL, ms INTEGER, prompt_version TEXT, issue TEXT, confidence REAL,
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
];

// Sample reports so the map isn't empty on a fresh database. Marked demo, and fictional.
const DEMO = [
  { issue: 'garbage', severity: 3, title: 'Overflowing bins at the market corner', description: 'Three community bins are full and garbage has spilled onto the road next to the vegetable stalls.', lat: 28.4672, lng: 77.0641, locality: 'Sector 29 market', status: 'filed', plus: 6, days: 9, photo: '/samples/garbage.jpg' },
  { issue: 'pothole', severity: 4, title: 'Deep pothole on the service lane', description: 'A pothole about a metre wide in the left lane; two-wheelers swerve into traffic to avoid it.', lat: 28.4956, lng: 77.0889, locality: 'DLF Phase 3, service lane', status: 'reported', plus: 11, days: 4, photo: '/samples/pothole.jpg' },
  { issue: 'streetlight', severity: 3, title: 'Four streetlights out on the park road', description: 'The stretch along the park has been dark for a week; walkers use phone torches after 7 pm.', lat: 28.4419, lng: 77.0524, locality: 'Sector 46', status: 'acknowledged', plus: 3, days: 12, photo: '/samples/streetlight.jpg' },
  { issue: 'waterlogging', severity: 4, title: 'Water collects at the underpass after rain', description: 'Knee-deep water after every heavy shower; the drain inlets are choked with silt.', lat: 28.4823, lng: 77.0782, locality: 'Near IFFCO Chowk', status: 'filed', plus: 18, days: 20, photo: '/samples/waterlogging.jpg' },
  { issue: 'manhole', severity: 5, title: 'Open manhole beside the bus stop', description: 'The cover is missing and the opening is next to where people wait for buses. Someone has put a branch in it as a warning.', lat: 28.4594, lng: 77.0266, locality: 'Sohna Road, near the bus stop', status: 'fixed', plus: 9, days: 15, photo: '/samples/manhole.jpg' },
  { issue: 'dumping', severity: 2, title: 'Construction debris dumped on the green belt', description: 'A truckload of broken bricks and cement bags left on the green belt overnight.', lat: 28.4109, lng: 77.0427, locality: 'Sector 49, green belt', status: 'reported', plus: 2, days: 2, photo: '/samples/dumping.jpg' },
];

export function ensureSchema(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      const sql = db();
      for (const s of SCHEMA) await sql.query(s);
      if (process.env.SEED_DEMO === 'false') return;
      const [{ n }] = (await sql.query('SELECT COUNT(*)::int AS n FROM cases')) as { n: number }[];
      if (n > 0) return;
      for (const d of DEMO) {
        const [{ id }] = (await sql.query(
          `INSERT INTO cases (issue, severity, title, description, lat, lng, locality, status, plus_ones, sample_photo, demo, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,TRUE, NOW() - make_interval(days => $11), NOW() - make_interval(days => GREATEST($11 - 3, 0))) RETURNING id`,
          [d.issue, d.severity, `${d.title} (demo)`, d.description, d.lat, d.lng, d.locality, d.status, d.plus, d.photo, d.days],
        )) as { id: number }[];
        await sql.query(`INSERT INTO events (case_id, kind, note, created_at) VALUES ($1, 'reported', NULL, NOW() - make_interval(days => $2))`, [id, d.days]);
        if (d.status !== 'reported') await sql.query(`INSERT INTO events (case_id, kind, note, created_at) VALUES ($1, 'filed', 'Filed on WhatsApp', NOW() - make_interval(days => $2))`, [id, d.days - 1]);
        if (d.status === 'acknowledged' || d.status === 'fixed') await sql.query(`INSERT INTO events (case_id, kind, note, created_at) VALUES ($1, 'acknowledged', NULL, NOW() - make_interval(days => $2))`, [id, Math.max(d.days - 5, 1)]);
        if (d.status === 'fixed') await sql.query(`INSERT INTO events (case_id, kind, note, created_at) VALUES ($1, 'fixed', 'New cover fitted', NOW() - make_interval(days => 3))`, [id]);
      }
    })().catch((e) => { ready = null; throw e; });
  }
  return ready;
}
