# Nagrik

**Photo in, civic complaint out.** Photograph a pothole, garbage pile, broken streetlight or open manhole in Gurugram. Nagrik reads the photo, blurs faces and number plates, picks the right department, and writes the complaint in English or Hindi. It then tracks the case until it's fixed, on a public map.

Live: _add the Vercel link here_

## What it does

- **Reads the photo.** Gemini (free tier) picks one of 12 problem types, rates severity 1–5, writes a two-line description in English and Hindi, tells a main road from a sector road, and marks every face and number plate.
- **Privacy first.** Marked areas are pixelated in the browser, and you can tap to blur anything else. Only the blurred copy is saved.
- **Right department, every time.** Routing is a lookup table, not an AI guess: problem type + road type → MCG or GMDA wing, with WhatsApp, phone and online channels ([src/lib/directory.ts](src/lib/directory.ts), sources listed in the file).
- **Ready to send.** WhatsApp opens with the complaint already typed in; there's a copy button for anything else.
- **One problem, one case.** An open report of the same kind within 60 m becomes a +1 on the existing case. A 64-bit photo fingerprint flags near-identical photos.
- **Tracked to the end.** Reported → filed (with the complaint number) → acknowledged → fixed (needs an after photo). After 7 days open, Nagrik drafts a follow-up and points to CM Window, Haryana.
- **Works with no AI quota.** If the photo reader is unavailable, you pick the problem type yourself; sample photos come with saved answers.

## How it's built

```
browser: shrink photo · read GPS · ──▶ /api/analyze (Gemini vision, zod-checked JSON)
                                          │
browser: pixelate faces/plates ◀──────────┘
         routing table → department + channels → complaint (EN/HI)
         ──▶ /api/cases (duplicate check: same type, ≤60 m, photo fingerprint) ──▶ Postgres (Neon)
```

- React + TypeScript (Vite), Leaflet with OpenStreetMap tiles
- Vercel Edge Functions: `analyze`, `cases`, `case`, `photo`, `status`
- Postgres on Neon (free tier) over HTTP; blurred photos stored in the database
- Every AI call is logged (provider, time, prompt version, issue, confidence); the How it works page shows the success rate and median time from that log

## Tests

`npm test` runs the API end to end against a real Postgres: seeding, the photo reader (faked), saving, duplicate detection, the out-of-city check, validation, the full status flow with its timeline, photo serving and rate limiting. A small stand-in server translates the Neon driver's HTTP calls to a normal Postgres connection, so no cloud account is needed.

```bash
TEST_PG=postgresql://postgres@127.0.0.1:5432 npm test
```

## Deploy (free)

1. Neon: create a project and copy its connection string.
2. Vercel: import this repo and set `DATABASE_URL` and `GEMINI_API_KEY`. Tables and six sample reports are created on first use (`SEED_DEMO=false` to skip the samples).

## Honest limits

- Nagrik doesn't submit to government portals; they have no public API. You send the prepared complaint.
- Status updates come from residents, not from the city's systems.
- Gurugram only, for now.

Nagrik is an independent project, not a government service. Built by [Shrey Gupta](https://shreygupta-three.vercel.app).
