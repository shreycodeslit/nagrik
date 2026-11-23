// The civic problems Nagrik recognises. The AI must pick one of these ids.
export const ISSUES = [
  { id: 'garbage', en: 'Garbage pile or overflowing bin', hi: 'कूड़े का ढेर / भरा हुआ कूड़ादान' },
  { id: 'dumping', en: 'Illegal dumping (debris, construction waste)', hi: 'मलबा / अवैध डंपिंग' },
  { id: 'pothole', en: 'Pothole or broken road', hi: 'सड़क में गड्ढा / टूटी सड़क' },
  { id: 'streetlight', en: 'Streetlight not working', hi: 'स्ट्रीटलाइट खराब' },
  { id: 'manhole', en: 'Open or broken manhole', hi: 'खुला / टूटा मैनहोल' },
  { id: 'sewage', en: 'Sewage overflow or blocked drain', hi: 'सीवर ओवरफ्लो / नाली जाम' },
  { id: 'waterlogging', en: 'Waterlogging', hi: 'जलभराव' },
  { id: 'water_leak', en: 'Water pipe leak', hi: 'पानी की पाइप लीक' },
  { id: 'footpath', en: 'Footpath blocked or broken', hi: 'फुटपाथ पर कब्ज़ा / टूटा फुटपाथ' },
  { id: 'tree', en: 'Fallen or dangerous tree', hi: 'गिरा हुआ / खतरनाक पेड़' },
  { id: 'stray_animal', en: 'Dead or injured stray animal', hi: 'मृत / घायल आवारा पशु' },
  { id: 'other', en: 'Something else', hi: 'कुछ और' },
] as const;

export type IssueId = typeof ISSUES[number]['id'];
export const ISSUE_IDS = ISSUES.map((i) => i.id) as [IssueId, ...IssueId[]];
export const issueLabel = (id: string, lang: 'en' | 'hi' = 'en') => ISSUES.find((i) => i.id === id)?.[lang] ?? id;

export const SEVERITY = [
  { n: 1, en: 'Minor', hi: 'मामूली' },
  { n: 2, en: 'Noticeable', hi: 'ध्यान देने योग्य' },
  { n: 3, en: 'Needs fixing soon', hi: 'जल्द ठीक होना चाहिए' },
  { n: 4, en: 'Risky', hi: 'खतरनाक' },
  { n: 5, en: 'Dangerous now', hi: 'तुरंत खतरा' },
] as const;

export type Status = 'reported' | 'filed' | 'acknowledged' | 'fixed';
export const STATUS_LABEL: Record<Status, string> = { reported: 'Reported here', filed: 'Filed with the city', acknowledged: 'City acknowledged', fixed: 'Fixed' };

/** What the vision model returns for a photo. Boxes are [ymin, xmin, ymax, xmax] on a 0–1000 scale. */
export interface Analysis {
  issue: IssueId;
  confidence: number;
  severity: 1 | 2 | 3 | 4 | 5;
  title: string;
  description: string;
  descriptionHi: string;
  roadType: 'main' | 'internal' | 'unknown';
  hazards: string[];
  privacyBoxes: [number, number, number, number][];
  notCivic?: boolean;
}

export interface CaseSummary {
  id: number; issue: IssueId; severity: number; title: string; lat: number; lng: number;
  locality: string | null; status: Status; plusOnes: number; createdAt: string; updatedAt: string; demo: boolean; hasPhoto: boolean; hasAfter: boolean;
}
export interface CaseDetail extends CaseSummary {
  description: string; descriptionHi: string | null; city: string; filedRef: string | null;
  events: { kind: string; note: string | null; createdAt: string }[];
}
