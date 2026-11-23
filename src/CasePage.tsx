import { useEffect, useRef, useState } from 'react';
import ChannelList from './ChannelList';
import MapView from './MapView';
import { ago, api, photoUrl } from './lib/client';
import { complaintText, followUpText } from './lib/complaint';
import { ESCALATION, routeFor } from './lib/directory';
import { base64Of, pixelate, prepare, toJpeg } from './lib/image';
import { issueLabel, SEVERITY, STATUS_LABEL, type CaseDetail, type Status } from './lib/issues';

const STEPS: Status[] = ['reported', 'filed', 'acknowledged', 'fixed'];
const EVENT_TEXT: Record<string, string> = { reported: 'Reported on Nagrik', plus_one: 'Another resident reported it', filed: 'Filed with the city', acknowledged: 'City acknowledged it', fixed: 'Marked fixed' };

export default function CasePage({ id }: { id: number }) {
  const [c, setC] = useState<CaseDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ref, setRef] = useState('');
  const [lang, setLang] = useState<'en' | 'hi'>('en');
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<'before' | 'after'>('before');
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => api.get(id).then((r) => (r.ok ? setC(r.data.case) : setError(r.data.error || 'Couldn’t load this report.')));
  useEffect(() => { load(); setView('before'); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  if (error) return <main className="case"><p className="error">{error}</p><a href="#map">Back to the map</a></main>;
  if (!c) return <main className="case"><p>Loading…</p></main>;

  const route = routeFor(c.issue, 'unknown');
  const caseUrl = `${window.location.origin}/#case-${c.id}`;
  const draft = { issue: c.issue, severity: c.severity, title: c.title, description: c.description, descriptionHi: c.descriptionHi || '', locality: c.locality, lat: c.lat, lng: c.lng, department: route.department, departmentHi: route.departmentHi, caseUrl, reports: c.plusOnes };
  const days = Math.floor((Date.now() - new Date(c.createdAt).getTime()) / 86400000);
  const stale = c.status !== 'fixed' && days >= 7;
  const text = stale ? followUpText(draft, c.filedRef, days, lang) : complaintText(draft, lang);
  const step = STEPS.indexOf(c.status);

  async function act(body: Record<string, unknown>) {
    setBusy(true); const r = await api.act(c!.id, body); setBusy(false);
    if (r.ok) load(); else setError(r.data.error || 'Couldn’t update.');
  }
  async function fixedPhoto(f: File) {
    setBusy(true);
    try { const p = await prepare(f); await act({ action: 'fixed', photo: base64Of(toJpeg(pixelate(p.canvas, []), 0.78)) }); }
    catch { setError('Couldn’t open that photo.'); setBusy(false); }
  }

  return (
    <main className="case">
      <a className="back" href="#map">All reports</a>
      <div className={`tape${c.status === 'fixed' ? ' is-fixed' : ''}`} aria-hidden="true" />
      <p className="kind">{issueLabel(c.issue)}{c.demo && <span className="demo">Sample report</span>}</p>
      <h1>{c.title}</h1>
      <p className="meta">{c.locality || 'Gurugram'} · reported {ago(c.createdAt)} · <b>{c.plusOnes}</b> resident{c.plusOnes === 1 ? '' : 's'} reported this · {SEVERITY.find((s) => s.n === c.severity)?.en}</p>

      <ol className="progress" aria-label="Progress">
        {STEPS.map((s, i) => <li key={s} className={i <= step ? 'done' : ''}><span>{STATUS_LABEL[s]}</span></li>)}
      </ol>

      {c.hasPhoto && (
        <figure className="photo">
          {c.hasAfter && <div className="tabs small" role="tablist">
            <button role="tab" aria-selected={view === 'before'} className={view === 'before' ? 'on' : ''} onClick={() => setView('before')}>Before</button>
            <button role="tab" aria-selected={view === 'after'} className={view === 'after' ? 'on' : ''} onClick={() => setView('after')}>After</button>
          </div>}
          <img src={photoUrl(c.id, view)} alt={`${view === 'before' ? 'Photo of' : 'After photo of'} ${c.title}`} onError={(e) => ((e.currentTarget.closest('figure') as HTMLElement).hidden = true)} />
        </figure>
      )}
      <p className="desc">{c.description}</p>

      <div className="actions">
        {c.status !== 'fixed' && <button className="primary" disabled={busy} onClick={() => act({ action: 'plus_one' })}>I see this too</button>}
        {c.status !== 'fixed' && <><input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) fixedPhoto(f); }} />
          <button disabled={busy} onClick={() => fileRef.current?.click()}>It’s fixed: add a photo</button></>}
      </div>

      {c.status !== 'fixed' && (
        <section className="step">
          <h2>{stale ? `Open for ${days} days: send a follow-up` : 'File it with the city'}</h2>
          <p className="why">{route.department}. {route.why}</p>
          <ChannelList channels={route.channels} text={text} />
          <div className="complaint">
            <div className="tabs small" role="tablist">
              <button role="tab" aria-selected={lang === 'en'} className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>English</button>
              <button role="tab" aria-selected={lang === 'hi'} className={lang === 'hi' ? 'on' : ''} onClick={() => setLang('hi')}>हिंदी</button>
              <button className="copy" onClick={() => navigator.clipboard.writeText(text).catch(() => {})}>Copy</button>
            </div>
            <pre>{text}</pre>
          </div>
          {c.status === 'reported' && (
            <form className="filed" onSubmit={(e) => { e.preventDefault(); act({ action: 'filed', ref: ref || null }); }}>
              <label className="field"><span>Filed it? Add the complaint number (optional)</span><input value={ref} onChange={(e) => setRef(e.target.value)} maxLength={60} placeholder="e.g. GMDA/2026/11/04512" /></label>
              <button disabled={busy}>Mark as filed</button>
            </form>
          )}
          {c.status === 'filed' && <button className="link" disabled={busy} onClick={() => act({ action: 'acknowledged' })}>The city replied or sent someone</button>}
          {stale && <p className="small">Still nothing after a follow-up? Escalate on <a href={ESCALATION.href} target="_blank" rel="noopener">{ESCALATION.label}</a>.</p>}
        </section>
      )}

      <section className="step">
        <h2>Timeline</h2>
        <ul className="timeline">
          {c.events.map((e, i) => <li key={i}><b>{EVENT_TEXT[e.kind] || e.kind}</b>{e.note && <span> · {e.note}</span>}<time>{ago(e.createdAt)}</time></li>)}
        </ul>
      </section>
      <MapView pin={{ lat: c.lat, lng: c.lng }} height={220} />
    </main>
  );
}
