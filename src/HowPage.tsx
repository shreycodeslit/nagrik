import { useEffect, useState } from 'react';
import { api } from './lib/client';
import { CHECKED_ON, ESCALATION, routeFor, SOURCES } from './lib/directory';
import { ISSUES } from './lib/issues';

export default function HowPage() {
  const [s, setS] = useState<Awaited<ReturnType<typeof api.status>>['data'] | null>(null);
  useEffect(() => { api.status().then((r) => r.ok && setS(r.data)); }, []);
  const pr = s?.photoReader;
  return (
    <main className="how">
      <h1>How Nagrik works</h1>
      <p className="lede">A photo goes in; a complaint the right department can act on comes out. AI does the looking. Plain rules do the routing, so the department is never a guess.</p>

      <ol className="pipeline">
        <li><b>In your browser:</b> the photo is shrunk to 1280 px, and its GPS location is read if it has one.</li>
        <li><b>Photo reader:</b> Gemini (free tier) picks one of {ISSUES.length} problem types, rates severity from 1 to 5, writes a two-line description in English and Hindi, says whether it’s a main road, and marks every face and number plate. Its reply must match a strict schema.</li>
        <li><b>Privacy:</b> the marked areas are pixelated in your browser, and you can blur anything else with a tap. Only the blurred photo is saved.</li>
        <li><b>Routing:</b> a lookup table turns problem type and road type into the department and its WhatsApp, phone and online channels.</li>
        <li><b>Duplicates:</b> an open report of the same kind within 60 m becomes one case with more reports, not a new one. A photo fingerprint (a 64-bit difference hash) flags near-identical photos.</li>
        <li><b>Tracking:</b> every case goes reported → filed → acknowledged → fixed. After 7 days open, Nagrik writes a follow-up, then points to {ESCALATION.label}.</li>
      </ol>

      {pr && pr.calls > 0 && (
        <div className="stats">
          <div><b>{pr.calls}</b><span>photos read in the last 30 days</span></div>
          <div><b>{Math.round(pr.okRate * 100)}%</b><span>answered by the photo reader (the rest fell back to picking by hand)</span></div>
          <div><b>{(pr.medianMs / 1000).toFixed(1)} s</b><span>median time to read a photo</span></div>
        </div>
      )}

      <h2>Who fixes what in Gurugram</h2>
      <div className="table-wrap">
        <table className="grid">
          <thead><tr><th>Problem</th><th>Department</th><th>Body</th></tr></thead>
          <tbody>{ISSUES.filter((i) => i.id !== 'other').map((i) => { const r = routeFor(i.id, 'unknown'); return <tr key={i.id}><td>{i.en}</td><td>{r.department}</td><td>{r.body}</td></tr>; })}</tbody>
        </table>
      </div>
      <p className="small">MCG is the Municipal Corporation of Gurugram; GMDA is the Gurugram Metropolitan Development Authority. Numbers and channels checked in {CHECKED_ON}: {SOURCES.map((x, i) => <span key={x.url}>{i ? '; ' : ''}<a href={x.url} target="_blank" rel="noopener">{x.label}</a></span>)}.</p>

      <h2>What it doesn’t do</h2>
      <ul className="limits">
        <li>It doesn’t file for you. City portals have no public way to submit automatically, so Nagrik writes the complaint and opens WhatsApp with it typed in; you send it.</li>
        <li>Status updates come from residents, not from the city’s systems.</li>
        <li>It covers Gurugram only for now.</li>
        <li>The free AI tier may use photos to improve Google’s products, which is one more reason faces and plates are blurred in the saved copy.</li>
      </ul>
    </main>
  );
}
