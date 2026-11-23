import { useEffect, useMemo, useState } from 'react';
import MapView from './MapView';
import { ago, api, photoUrl } from './lib/client';
import { issueLabel, STATUS_LABEL, type CaseSummary } from './lib/issues';

type Filter = 'open' | 'fixed' | 'all';

export default function MapPage() {
  const [cases, setCases] = useState<CaseSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('open');
  useEffect(() => { api.cases().then((r) => (r.ok ? setCases(r.data.cases) : setError(r.data.error || 'Couldn’t load reports.'))); }, []);
  const shown = useMemo(() => (cases || []).filter((c) => filter === 'all' || (filter === 'fixed' ? c.status === 'fixed' : c.status !== 'fixed')), [cases, filter]);
  const counts = { open: (cases || []).filter((c) => c.status !== 'fixed').length, fixed: (cases || []).filter((c) => c.status === 'fixed').length };

  return (
    <main className="mappage">
      <h1>Problems reported in Gurugram</h1>
      <div className="filters">
        <div className="tabs" role="tablist">
          {(['open', 'fixed', 'all'] as Filter[]).map((f) => (
            <button key={f} role="tab" aria-selected={filter === f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>
              {f === 'open' ? `Open ${counts.open}` : f === 'fixed' ? `Fixed ${counts.fixed}` : 'All'}
            </button>
          ))}
        </div>
        <p className="legend"><span className="dot amber" /> open <span className="dot sky" /> city acknowledged <span className="dot fixed" /> fixed · bigger dot, more reports</p>
      </div>
      {error && <p className="error">{error}</p>}
      <MapView cases={shown} onOpen={(id) => (window.location.hash = `#case-${id}`)} height={420} />
      <ul className="case-list">
        {shown.map((c) => (
          <li key={c.id}>
            <a href={`#case-${c.id}`}>
              {c.hasPhoto ? <img src={photoUrl(c.id)} alt="" loading="lazy" onError={(e) => (e.currentTarget.style.visibility = 'hidden')} /> : <span className="noimg" />}
              <div>
                <p className="cl-title">{c.title}</p>
                <p className="cl-meta">{issueLabel(c.issue)} · {c.locality || 'Gurugram'} · {ago(c.createdAt)}</p>
                <p className={`cl-status s-${c.status}`}>{STATUS_LABEL[c.status]} · {c.plusOnes} report{c.plusOnes === 1 ? '' : 's'}</p>
              </div>
            </a>
          </li>
        ))}
      </ul>
      {cases && !shown.length && <p className="empty">Nothing here yet. <a href="#">Report the first one</a>.</p>}
    </main>
  );
}
