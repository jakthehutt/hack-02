import React from 'react';
import { LayoutGrid, Activity, Share2, Database, BookOpen, Radar, ChartColumn } from 'lucide-react';
import { Tabs, Toast } from './ds/index.js';
import { useDashboardData } from './data/index.js';
import { RANGE_PRESETS, KIND_OPTIONS, METRIC_OPTIONS, rangeBounds, fmtWeek, seriesById, sourceById } from './data/derive.js';
import { Overview } from './views/Overview.jsx';
import { Narratives } from './views/Narratives.jsx';
import { Propagation } from './views/Propagation.jsx';
import { Sources } from './views/Sources.jsx';
import { Codebook } from './views/Codebook.jsx';
import { Statistics } from './views/Statistics.jsx';

const VIEWS = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid, title: 'Narrative radar', lede: 'Which pro-Kremlin frames German-language outlets are running, where they spike, and how they travel.' },
  { id: 'statistics', label: 'Statistics', icon: ChartColumn, title: 'Statistics', lede: 'Shares with uncertainty, how volume and wording move together, and which lags were actually observed.' },
  { id: 'narratives', label: 'Narratives', icon: Activity, title: 'Narrative timeline', lede: 'Follow one frame week by week across every outlet, with the sentences that triggered it.' },
  { id: 'propagation', label: 'Propagation', icon: Share2, title: 'Propagation', lede: 'Citations, topic echoes and near-duplicates between Russian wires and German-language relays.' },
  { id: 'sources', label: 'Sources', icon: Database, title: 'Sources', lede: 'Every outlet in the catalogue, its crawl coverage, and how much of it the extractor kept.' },
  { id: 'codebook', label: 'Codebook', icon: BookOpen, title: 'Codebook', lede: 'The patterns behind every count, and the DSN reference narratives they map to.' },
];

// Views that the time/kind/metric filters apply to.
const FILTERED = { overview: ['range', 'kind', 'metric'], statistics: ['range', 'kind', 'metric'], narratives: ['range', 'kind', 'metric'], sources: ['range'] };

export default function App() {
  const { data } = useDashboardData();
  const [view, setView] = React.useState('overview');
  const [range, setRange] = React.useState('all');
  const [kind, setKind] = React.useState('all');
  const [metric, setMetric] = React.useState('share');
  const [focus, setFocus] = React.useState({ source: 'rt_de', series: 'kiewer_regime' });
  const [toast, setToast] = React.useState(null);

  React.useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(id);
  }, [toast]);

  const [lo, hi] = rangeBounds(data.weeks, range);
  const filters = { lo, hi, kind, metric };
  const v = VIEWS.find(x => x.id === view);
  const series = seriesById(data);
  const sources = sourceById(data);

  const drill = next => {
    const f = { ...focus, ...next };
    setFocus(f);
    setView('narratives');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setToast(`${series[f.series].label} · ${sources[f.source].name.split(' (')[0]}`);
  };

  const shows = FILTERED[view] || [];

  return (
    <div className="app">
      <nav className="sidebar" aria-label="Sections">
        <div className="wordmark"><Radar size={22} strokeWidth={2.5} />Narrative radar</div>
        <div className="wordmark-sub">DE · RU influence monitor</div>
        {VIEWS.map(x => (
          <button key={x.id} className="nav-item" aria-current={view === x.id ? 'page' : undefined} onClick={() => setView(x.id)}>
            <x.icon size={18} strokeWidth={2.25} />{x.label}
          </button>
        ))}
        <div className="sidebar-foot">
          Window <strong>{fmtWeek(data.weeks[0])} – {fmtWeek(data.weeks[data.weeks.length - 1])} {data.weeks[data.weeks.length - 1].end.slice(0, 4)}</strong><br />
          {data.sources.length} outlets · {data.series.length} series<br />
          <span style={{ display: 'inline-block', marginTop: 8 }}>RT DE weeks and {data.edges.filter(e => !e.synthetic).length} edges are observed. Other weekly curves and the remaining edges are generated.</span>
        </div>
      </nav>

      <main className="main">
        <header className="topbar">
          <div>
            <div className="eyebrow">{v.label}</div>
            <h1 className="page-title">{v.title}</h1>
            <p className="page-lede">{v.lede}</p>
          </div>
          {shows.length > 0 && (
            <div className="filters" role="group" aria-label="Filters">
              {shows.includes('range') && <div className="filter-group"><span className="filter-label">Range</span><Tabs items={RANGE_PRESETS} value={range} onChange={setRange} /></div>}
              {shows.includes('kind') && <div className="filter-group"><span className="filter-label">Series</span><Tabs items={KIND_OPTIONS} value={kind} onChange={setKind} /></div>}
              {shows.includes('metric') && <div className="filter-group"><span className="filter-label">Measure</span><Tabs items={METRIC_OPTIONS} value={metric} onChange={setMetric} /></div>}
            </div>
          )}
        </header>

        <div className="content" key={view}>
          {view === 'overview' && <Overview data={data} filters={filters} focus={focus} onDrill={drill} />}
          {view === 'statistics' && <Statistics data={data} filters={filters} focus={focus} setFocus={setFocus} />}
          {view === 'narratives' && <Narratives data={data} filters={filters} focus={focus} setFocus={setFocus} />}
          {view === 'propagation' && <Propagation data={data} />}
          {view === 'sources' && <Sources data={data} filters={filters} onOpen={id => drill({ source: id })} />}
          {view === 'codebook' && <Codebook data={data} />}
        </div>
      </main>

      {toast && <div className="toast-wrap"><Toast>{toast}</Toast></div>}
    </div>
  );
}
