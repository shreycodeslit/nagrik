import { issueLabel, SEVERITY, type IssueId } from './issues';

export interface Draft {
  issue: IssueId; severity: number; title: string; description: string; descriptionHi: string;
  locality: string | null; lat: number; lng: number; department: string; departmentHi: string; caseUrl?: string; reports?: number;
}

const mapLink = (d: Draft) => `https://maps.google.com/?q=${d.lat.toFixed(6)},${d.lng.toFixed(6)}`;

export function complaintText(d: Draft, lang: 'en' | 'hi'): string {
  const sev = SEVERITY.find((s) => s.n === d.severity);
  if (lang === 'hi') {
    return [
      `विषय: ${issueLabel(d.issue, 'hi')}${d.locality ? `, ${d.locality}` : ''}`,
      '',
      `नमस्ते, ${d.departmentHi} जी,`,
      d.descriptionHi || d.description,
      `गंभीरता: ${sev?.hi ?? d.severity}${d.reports && d.reports > 1 ? ` (${d.reports} नागरिकों ने रिपोर्ट किया)` : ''}`,
      `स्थान: ${d.locality ?? ''} ${mapLink(d)}`.trim(),
      d.caseUrl ? `फ़ोटो और स्थिति: ${d.caseUrl}` : '',
      '',
      'कृपया जल्द से जल्द इसे ठीक करवाएं और शिकायत संख्या साझा करें। धन्यवाद।',
    ].filter((l, i, a) => l || a[i - 1]).join('\n');
  }
  return [
    `Subject: ${issueLabel(d.issue)}${d.locality ? ` at ${d.locality}` : ''}`,
    '',
    `Dear ${d.department} team,`,
    d.description,
    `Severity: ${sev?.en ?? d.severity}${d.reports && d.reports > 1 ? ` (reported by ${d.reports} residents)` : ''}`,
    `Location: ${d.locality ? `${d.locality}, ` : ''}${mapLink(d)}`,
    d.caseUrl ? `Photo and status: ${d.caseUrl}` : '',
    '',
    'Please get this fixed and share the complaint number. Thank you.',
  ].filter((l, i, a) => l || a[i - 1]).join('\n');
}

export function followUpText(d: Draft, filedRef: string | null, daysOpen: number, lang: 'en' | 'hi'): string {
  if (lang === 'hi') {
    return `विषय: शिकायत ${filedRef ? `संख्या ${filedRef} ` : ''}पर ${daysOpen} दिन से कोई कार्रवाई नहीं\n\nनमस्ते,\n${issueLabel(d.issue, 'hi')} (${d.locality ?? mapLink(d)}) की शिकायत ${daysOpen} दिन पहले दर्ज की गई थी, पर समस्या अभी भी बनी हुई है। कृपया स्थिति बताएं और जल्द समाधान करें।${d.caseUrl ? `\nफ़ोटो: ${d.caseUrl}` : ''}\n\nधन्यवाद।`;
  }
  return `Subject: No action for ${daysOpen} days on complaint${filedRef ? ` ${filedRef}` : ''}\n\nHello,\nThe ${issueLabel(d.issue).toLowerCase()} at ${d.locality ?? mapLink(d)} was reported ${daysOpen} days ago and is still there. Please share the status and a date for the fix.${d.caseUrl ? `\nPhoto and status: ${d.caseUrl}` : ''}\n\nThank you.`;
}
