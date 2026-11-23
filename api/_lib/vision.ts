import { z } from 'zod';
import { ISSUES, ISSUE_IDS, type Analysis } from '../../src/lib/issues';

export const PROMPT_VERSION = 'vision-v2';

export const SYSTEM = `You look at a photo a resident in an Indian city took of a civic problem, and describe it for a complaint to the municipal corporation.
Pick exactly one issue id from this list:
${ISSUES.map((i) => `- ${i.id}: ${i.en}`).join('\n')}

Return JSON:
{"issue": id, "confidence": 0-1, "severity": 1-5, "title": string, "description": string, "descriptionHi": string,
 "roadType": "main" | "internal" | "unknown", "hazards": string[], "privacyBoxes": [[ymin, xmin, ymax, xmax], ...], "notCivic": boolean}

- severity: 1 minor, 2 noticeable, 3 needs fixing soon, 4 risky (could injure someone or damage vehicles), 5 dangerous right now (open manhole on a footpath, live wire, deep water on a busy road).
- title: under 10 words, what and where in the frame ("Overflowing bins beside the market road").
- description: 2 short factual sentences a municipal engineer can act on: what you see, rough size or extent, and the risk. No guessing at causes or blame. descriptionHi: the same in simple Hindi (Devanagari).
- roadType: "main" for wide multi-lane or divided roads, "internal" for sector, colony or lane roads, "unknown" if you can't tell.
- hazards: up to 3 short risks you can see ("two-wheelers swerving", "near a school gate").
- privacyBoxes: every human face and every readable vehicle number plate, as boxes on a 0–1000 scale of the image height and width. Empty list if none.
- notCivic: true if the photo shows no public civic problem (a selfie, a screenshot, food, a private home interior). Then use issue "other" and confidence below 0.3.
Return only the JSON.`;

const Box = z.tuple([z.number(), z.number(), z.number(), z.number()]);
const Reply = z.object({
  issue: z.enum(ISSUE_IDS).catch('other'),
  confidence: z.number().min(0).max(1).catch(0.5),
  severity: z.number().int().min(1).max(5).catch(3),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(600),
  descriptionHi: z.string().trim().max(800).catch(''),
  roadType: z.enum(['main', 'internal', 'unknown']).catch('unknown'),
  hazards: z.array(z.string().max(80)).max(5).catch([]),
  privacyBoxes: z.array(Box).max(30).catch([]),
  notCivic: z.boolean().optional().catch(false),
});

export function toAnalysis(raw: unknown): Analysis {
  const r = Reply.parse(raw);
  const clamp = (n: number) => Math.max(0, Math.min(1000, n));
  return {
    ...r,
    severity: r.severity as Analysis['severity'],
    privacyBoxes: r.privacyBoxes.map((b) => [clamp(b[0]), clamp(b[1]), clamp(b[2]), clamp(b[3])] as [number, number, number, number]).filter((b) => b[2] > b[0] && b[3] > b[1]),
  };
}
