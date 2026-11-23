import { useEffect, useState } from 'react';
import CasePage from './CasePage';
import HowPage from './HowPage';
import MapPage from './MapPage';
import Report from './Report';
import { api } from './lib/client';

function useHash() {
  const [h, setH] = useState(window.location.hash);
  useEffect(() => { const f = () => { setH(window.location.hash); window.scrollTo(0, 0); }; window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f); }, []);
  return h;
}

export default function App() {
  const hash = useHash();
  const [stats, setStats] = useState<{ total: number; fixed: number; reports: number } | null>(null);
  useEffect(() => { api.status().then((r) => r.ok && r.data.cases && setStats(r.data.cases)); }, [hash]);
  const caseId = hash.match(/^#case-(\d+)$/)?.[1];
  const page = caseId ? 'case' : hash === '#map' ? 'map' : hash === '#how' ? 'how' : 'report';

  return (
    <div className="page">
      <header className="top">
        <a className="mark" href="#" aria-label="Nagrik, report a problem"><span className="mark-sign" aria-hidden="true">न</span>Nagrik</a>
        <nav aria-label="Main">
          <a href="#" aria-current={page === 'report' ? 'page' : undefined}>Report</a>
          <a href="#map" aria-current={page === 'map' ? 'page' : undefined}>Map</a>
          <a href="#how" aria-current={page === 'how' ? 'page' : undefined}>How it works</a>
        </nav>
      </header>
      {page === 'case' ? <CasePage id={Number(caseId)} /> : page === 'map' ? <MapPage /> : page === 'how' ? <HowPage /> : <Report stats={stats} />}
      <footer className="foot">
        <p>Nagrik is an independent project, not a government service. Built by <a href="https://shreygupta-three.vercel.app" target="_blank" rel="noopener">Shrey Gupta</a> · <a href="https://github.com/shreycodeslit/nagrik" target="_blank" rel="noopener">Code on GitHub</a></p>
      </footer>
    </div>
  );
}
