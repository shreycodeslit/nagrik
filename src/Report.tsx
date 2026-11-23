import { useCallback, useEffect, useRef, useState } from 'react';
import MapView from './MapView';
import { api, placeName } from './lib/client';
import { complaintText } from './lib/complaint';
import { routeFor } from './lib/directory';
import { inGurugram } from './lib/geo';
import { base64Of, fingerprint, pixelate, prepare, tapBox, toJpeg, type Prepared } from './lib/image';
import { ISSUES, SEVERITY, type Analysis, type IssueId } from './lib/issues';
import { SAMPLES } from './lib/samples';
import ChannelList from './ChannelList';

type Stage = 'start' | 'reading' | 'review' | 'saving';
type Dup = { id: number; title: string; metres: number; plusOnes: number; samePhoto: boolean };

const blank = (): Analysis => ({ issue: 'other', confidence: 0, severity: 3, title: '', description: '', descriptionHi: '', roadType: 'unknown', hazards: [], privacyBoxes: [] });

export default function Report({ stats }: { stats: { total: number; fixed: number; reports: number } | null }) {
  const [stage, setStage] = useState<Stage>('start');
  const [prep, setPrep] = useState<Prepared | null>(null);
  const [boxes, setBoxes] = useState<number[][]>([]);
  const [shown, setShown] = useState<string>('');
  const [a, setA] = useState<Analysis>(blank);
  const [source, setSource] = useState<string>('');
  const [note, setNote] = useState<string | null>(null);
  const [where, setWhere] = useState<{ lat: number; lng: number } | null>(null);
  const [whereFrom, setWhereFrom] = useState<string>('');
  const [locality, setLocality] = useState('');
  const [lang, setLang] = useState<'en' | 'hi'>('en');
  const [dups, setDups] = useState<Dup[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [blurMode, setBlurMode] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Redraw the shown photo whenever the blur boxes change
  useEffect(() => { if (prep) setShown(toJpeg(pixelate(prep.canvas, boxes), 0.85)); }, [prep, boxes]);

  const locate = useCallback(async (p: { lat: number; lng: number }, from: string) => {
    setWhere(p); setWhereFrom(from);
    const name = await placeName(p.lat, p.lng);
    if (name) setLocality(name);
  }, []);

  const useMyLocation = () => {
    if (!navigator.geolocation) { setNote('This browser can’t share location. Drop the pin on the map instead.'); return; }
    navigator.geolocation.getCurrentPosition((pos) => locate({ lat: pos.coords.latitude, lng: pos.coords.longitude }, 'your location'),
      () => setNote('Location access was blocked. Drop the pin on the map instead.'), { enableHighAccuracy: true, timeout: 10000 });
  };

  async function start(file: Blob, sample?: typeof SAMPLES[number]) {
    setError(null); setNote(null); setDups(null); setStage('reading');
    try {
      const p = await prepare(file);
      setPrep(p); setBoxes([]); setA(blank());
      if (sample) { setA(sample.analysis); setSource('sample'); setWhere({ lat: sample.lat, lng: sample.lng }); setWhereFrom('sample'); setLocality(sample.locality); setStage('review'); return; }
      if (p.gps) locate(p.gps, 'the photo'); else { setWhere(null); setLocality(''); }
      const r = await api.analyze(base64Of(toJpeg(p.canvas, 0.75)));
      if (r.ok) {
        setA(r.data.analysis); setBoxes(r.data.analysis.privacyBoxes); setSource(r.data.source);
        if (r.data.analysis.notCivic) setNote('This doesn’t look like a public civic problem. If it is, pick the kind of problem below.');
      } else { setSource('manual'); setNote(r.data.error || 'The photo reader is unavailable. Pick the kind of problem below.'); }
      setStage('review');
    } catch {
      setStage('start'); setError('Couldn’t open that photo. Try a JPEG or PNG.');
    }
  }

  const route = routeFor(a.issue, a.roadType);
  const draft = { issue: a.issue, severity: a.severity, title: a.title, description: a.description || 'Please see the photo.', descriptionHi: a.descriptionHi, locality: locality || null, lat: where?.lat ?? 0, lng: where?.lng ?? 0, department: route.department, departmentHi: route.departmentHi };
  const text = where ? complaintText(draft, lang) : '';

  async function save(force = false) {
    if (!prep || !where) return;
    setStage('saving'); setError(null);
    const photo = base64Of(toJpeg(pixelate(prep.canvas, boxes), 0.78));
    const r = await api.create({ issue: a.issue, severity: a.severity, title: a.title || ISSUES.find((i) => i.id === a.issue)!.en, description: a.description || 'See photo.', descriptionHi: a.descriptionHi || null, lat: where.lat, lng: where.lng, locality: locality || null, photo, photoHash: fingerprint(prep.canvas), force });
    setStage('review');
    if (r.status === 409 && r.data.duplicateOf) { setDups(r.data.duplicateOf); return; }
    if (!r.ok || !r.data.id) { setError(r.data.error || 'Couldn’t save the report. Try again.'); return; }
    window.location.hash = `#case-${r.data.id}`;
  }

  async function plusOne(id: number) {
    const r = await api.act(id, { action: 'plus_one' });
    if (r.ok) window.location.hash = `#case-${id}`; else setError(r.data.error || 'Couldn’t add your report.');
  }

  function tapToBlur(e: React.MouseEvent<HTMLImageElement>) {
    if (!blurMode || !imgRef.current) return;
    const r = imgRef.current.getBoundingClientRect();
    setBoxes((b) => [...b, tapBox(e.clientX - r.left, e.clientY - r.top, r.width, r.height)]);
  }

  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { setCopied(false); }
  };

  if (stage === 'start' || !prep) {
    return (
      <main className="report">
        <section className="hero">
          <h1>See a civic problem? Photograph it.</h1>
          <p className="lede">Nagrik reads the photo, blurs faces and number plates, finds the right department in Gurugram and writes the complaint for you in English or Hindi.</p>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) start(f); e.target.value = ''; }} />
          <button className="big" onClick={() => fileRef.current?.click()} disabled={stage === 'reading'}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
            {stage === 'reading' ? 'Reading the photo…' : 'Take or upload a photo'}
          </button>
          {error && <p className="error">{error}</p>}
          {stats && stats.total > 0 && <p className="tally"><b>{stats.total}</b> problems reported in Gurugram so far, <b>{stats.fixed}</b> fixed. <a href="#map">See them on the map</a></p>}
        </section>
        <section className="samples" aria-label="Try a sample photo">
          <h2>No problem in front of you? Try a sample.</h2>
          <ul>
            {SAMPLES.map((s) => (
              <li key={s.file}>
                <button onClick={async () => { try { const b = await (await fetch(s.file)).blob(); start(b, s); } catch { setError('Couldn’t load the sample.'); } }}>
                  <img src={s.file} alt="" loading="lazy" onError={(e) => ((e.currentTarget.closest('li') as HTMLElement).hidden = true)} />
                  <span>{s.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </main>
    );
  }

  return (
    <main className="report flow">
      <div className="tape" aria-hidden="true" />
      <section className="step">
        <h2>The photo</h2>
        <div className={`photo${blurMode ? ' blurring' : ''}`}>
          <img ref={imgRef} src={shown} alt="Your photo, with faces and number plates blurred" onClick={tapToBlur} />
        </div>
        <div className="row-actions">
          <p className="hint">{boxes.length ? `${boxes.length} area${boxes.length === 1 ? '' : 's'} blurred.` : 'No faces or number plates found.'} Only the blurred photo is saved.</p>
          <button className="link" onClick={() => setBlurMode((b) => !b)} aria-pressed={blurMode}>{blurMode ? 'Done blurring' : 'Blur something else'}</button>
          {boxes.length > 0 && <button className="link" onClick={() => setBoxes((b) => b.slice(0, -1))}>Undo last blur</button>}
        </div>
        {blurMode && <p className="hint strong">Tap anything on the photo to blur it.</p>}
      </section>

      <section className="step">
        <div className="step-head">
          <h2>What’s wrong</h2>
          <p className="by">{source === 'sample' ? 'Sample, read earlier by Gemini' : source === 'gemini' ? `Read by Gemini (free tier), ${Math.round(a.confidence * 100)}% sure` : source === 'manual' ? 'Pick it yourself' : ''}</p>
        </div>
        {note && <p className="note">{note}</p>}
        <label className="field"><span>Problem</span>
          <select value={a.issue} onChange={(e) => setA({ ...a, issue: e.target.value as IssueId })}>
            {ISSUES.map((i) => <option key={i.id} value={i.id}>{i.en}</option>)}
          </select>
        </label>
        <fieldset className="severity">
          <legend>How bad is it?</legend>
          <div>
            {SEVERITY.map((s) => (
              <label key={s.n} className={a.severity >= s.n ? 'on' : ''} style={{ ['--lvl' as string]: s.n }}>
                <input type="radio" name="sev" value={s.n} checked={a.severity === s.n} onChange={() => setA({ ...a, severity: s.n as Analysis['severity'] })} />
                <span className="sr">{s.en}</span>
              </label>
            ))}
          </div>
          <p>{SEVERITY.find((s) => s.n === a.severity)?.en}</p>
        </fieldset>
        <label className="field"><span>Short title</span><input value={a.title} onChange={(e) => setA({ ...a, title: e.target.value })} placeholder="e.g. Open manhole beside the bus stop" maxLength={120} /></label>
        <label className="field"><span>What you see</span><textarea rows={3} value={a.description} onChange={(e) => setA({ ...a, description: e.target.value })} placeholder="What, how big, and why it’s a risk" maxLength={800} /></label>
        {a.hazards.length > 0 && <p className="hazards">{a.hazards.map((h) => <span key={h}>{h}</span>)}</p>}
        <label className="field inline"><span>Road</span>
          <select value={a.roadType} onChange={(e) => setA({ ...a, roadType: e.target.value as Analysis['roadType'] })}>
            <option value="internal">Sector or colony road</option><option value="main">Main road</option><option value="unknown">Not sure</option>
          </select>
        </label>
      </section>

      <section className="step">
        <div className="step-head">
          <h2>Where</h2>
          {where && <p className="by">From {whereFrom}. Drag the pin if it’s off.</p>}
        </div>
        {!where && (
          <div className="where-empty">
            <p>This photo has no location in it.</p>
            <button onClick={useMyLocation}>Use my location</button>
            <button className="link" onClick={() => locate({ lat: 28.4595, lng: 77.0266 }, 'the map')}>Drop the pin myself</button>
          </div>
        )}
        {where && <>
          <MapView pin={where} onPin={(p) => locate(p, 'the map')} height={260} />
          <label className="field"><span>Area or landmark</span><input value={locality} onChange={(e) => setLocality(e.target.value)} placeholder="e.g. Sector 29 market, near the gate" maxLength={120} /></label>
          {!inGurugram(where) && <p className="error">Nagrik covers Gurugram for now. You can still copy the complaint, but it can’t go on the map.</p>}
        </>}
      </section>

      {where && (
        <section className="step">
          <div className="step-head">
            <h2>Send it to</h2>
            <p className="by">{route.body}</p>
          </div>
          <p className="dept">{route.department}</p>
          <p className="why">{route.why}</p>
          <ChannelList channels={route.channels} text={text} />
          <div className="complaint">
            <div className="tabs small" role="tablist">
              <button role="tab" aria-selected={lang === 'en'} className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>English</button>
              <button role="tab" aria-selected={lang === 'hi'} className={lang === 'hi' ? 'on' : ''} onClick={() => setLang('hi')}>हिंदी</button>
              <button className="copy" onClick={copy}>{copied ? 'Copied' : 'Copy complaint'}</button>
            </div>
            <pre>{text}</pre>
          </div>
        </section>
      )}

      <section className="step final">
        {dups ? (
          <div className="dups">
            <h2>Someone already reported this</h2>
            {dups.map((d) => (
              <div key={d.id} className="dup">
                <p><b>{d.title}</b>, {d.metres} m away{d.samePhoto ? ', with a very similar photo' : ''}. {d.plusOnes} report{d.plusOnes === 1 ? '' : 's'} so far.</p>
                <button className="primary" onClick={() => plusOne(d.id)}>Add my report to it</button>
                <a href={`#case-${d.id}`}>See it</a>
              </div>
            ))}
            <button className="link" onClick={() => save(true)}>It’s a different problem, save mine separately</button>
          </div>
        ) : (
          <>
            <p className="hint">Saving puts the blurred photo and the problem on the public map, so neighbours can add their reports and see when it’s fixed.</p>
            <div className="row-actions">
              <button className="primary" disabled={!where || !inGurugram(where) || stage === 'saving' || !prep} onClick={() => save()}>{stage === 'saving' ? 'Saving…' : 'Save to the public map'}</button>
              <button className="link" onClick={() => { setStage('start'); setPrep(null); }}>Start over</button>
            </div>
          </>
        )}
        {error && <p className="error">{error}</p>}
      </section>
    </main>
  );
}
