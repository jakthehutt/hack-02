import React from 'react';
import { LayoutGrid, Activity, Share2, Database, Radar } from 'lucide-react';
import { Tabs, Toast } from './ds/index.js';
import { useDashboardData } from './data/index.js';
import { RANGE_PRESETS, METRIC_OPTIONS, rangeBounds, fmtWeek, seriesById, sourceById } from './data/derive.js';
import { Overview } from './views/Overview.jsx';
import { Narratives } from './views/Narratives.jsx';
import { Origin } from './views/Propagation.jsx';
import { Sources } from './views/Sources.jsx';

const VIEWS = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid, title: 'This week', lede: 'How many outlets we scanned, which narratives showed up, where they spiked, and who repeated whom.' },
  { id: 'narratives', label: 'Narratives', icon: Activity, title: 'One narrative', lede: 'One story, week by week, and the sentences that matched.' },
  { id: 'origin', label: 'Origin', icon: Share2, title: 'Who influences whom', lede: 'Links are pickups between outlets.' },
  { id: 'sources', label: 'Sources', icon: Database, title: 'Outlets', lede: 'Every outlet in the crawl, and how much of it we kept.' },
];

// Views that the time and measure filters apply to.
const FILTERED = { overview: ['range', 'metric'], narratives: ['range', 'metric'], sources: ['range'] };

export default function App() {
  const { data } = useDashboardData();
  const [view, setView] = React.useState('overview');
  const [range, setRange] = React.useState('all');
  const [metric, setMetric] = React.useState('share');
  const kind = 'all';
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

  const go = id => {
    setView(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const drill = next => {
    const f = { ...focus, ...next };
    setFocus(f);
    go('narratives');
    setToast(`${series[f.series].label} · ${sources[f.source].name.split(' (')[0]}`);
  };

  const shows = FILTERED[view] || [];

  return (
    <div className="app">
      <nav className="sidebar" aria-label="Sections">
        <div className="wordmark"><Radar size={22} strokeWidth={2.5} />Foreshock</div>
        <div className="wordmark-sub">DE · RU influence monitor</div>
        {VIEWS.map(x => (
          <button key={x.id} className="nav-item" aria-current={view === x.id ? 'page' : undefined} onClick={() => go(x.id)}>
            <x.icon size={18} strokeWidth={2.25} />{x.label}
          </button>
        ))}
        <div className="sidebar-foot">
          Window <strong>{fmtWeek(data.weeks[0])} – {fmtWeek(data.weeks[data.weeks.length - 1])} {data.weeks[data.weeks.length - 1].end.slice(0, 4)}</strong><br />
          {data.sources.length} outlets · {data.series.length} narratives<br />
          <span style={{ display: 'inline-block', marginTop: 8 }}>RT DE weeks and {data.edges.filter(e => !e.synthetic).length} pickups were seen in the crawl. Other weekly curves and the remaining pickups are estimated.</span>
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
              {shows.includes('metric') && <div className="filter-group"><span className="filter-label">Measure</span><Tabs items={METRIC_OPTIONS} value={metric} onChange={setMetric} /></div>}
            </div>
          )}
        </header>

        <div className="content" key={view}>
          {view === 'overview' && <Overview data={data} filters={filters} focus={focus} onDrill={drill} onOpen={go} />}
          {view === 'narratives' && <Narratives data={data} filters={filters} focus={focus} setFocus={setFocus} />}
          {view === 'origin' && <Origin data={data} />}
          {view === 'sources' && <Sources data={data} filters={filters} onOpen={id => drill({ source: id })} />}
        </div>
      </main>

      {toast && <div className="toast-wrap"><Toast>{toast}</Toast></div>}
    </div>
  );
}
