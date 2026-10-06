import { cell, rangeBounds, spikes, movers, propagationLinks, rankedSources, sourceById, fmtPct, fmtNum, fmtWeek, fmtHours, RELATIONS, fullSpan } from '../../../data/derive.js';
import { shortName } from '../../lib.js';
import { plain } from '../../insights.js';
import { METRIC_PARAM } from '../heatmap/meta.js';

export const MODES = [
  { value: 'spikes', label: 'Biggest spikes' },
  { value: 'movers', label: 'Movers (last 4 weeks)' },
  { value: 'narratives', label: 'Narratives' },
  { value: 'outlets', label: 'Outlets' },
  { value: 'carriers', label: 'Outlets carrying one narrative' },
  { value: 'routes', label: 'Pickup routes' },
];

const ALL_RELATIONS = new Set(RELATIONS.map(r => r.id));
const pct = v => fmtPct(v);

/**
 * The rows a mode ranks: [{ id, label, sub, value, display, baseline?, estimated?, observed? }].
 * `kind` is 'bar' (from zero) or 'diverging' (around zero).
 */
export function rankRows(bundle, params, filters) {
  const [lo, hi] = rangeBounds(bundle.weeks, filters.range);
  const metric = params.metric || filters.metric;
  const full = fullSpan(bundle.weeks, lo, hi);
  const note = full ? '' : 'outlets with weekly counts only';
  switch (params.mode) {
    case 'spikes':
      return {
        kind: 'bar', unit: '%', note: 'tick = the usual share over the eight weeks before',
        rows: spikes(bundle, 'all', lo, hi).map(s => ({
          id: `${s.source.id}-${s.series.id}-${s.i}`, label: s.series.label, sub: `${shortName(s.source)} · week of ${fmtWeek(s.week)} · z ${s.z.toFixed(1)}`,
          value: s.share, display: pct(s.share), baseline: s.baseline,
        })),
      };
    case 'movers':
      return {
        kind: 'diverging', unit: 'pp', note: 'last four weeks vs the weeks before, outlets with weekly counts',
        rows: movers(bundle, 'all', lo, hi).map(m => ({
          id: m.series.id, label: m.series.label, sub: `${pct(m.before)} → ${pct(m.after)}`,
          value: m.delta, display: `${m.delta >= 0 ? '+' : '−'}${Math.abs(m.delta).toFixed(1)} pp`,
        })),
      };
    case 'narratives': {
      const rows = bundle.series.map(se => {
        let n = 0, t = 0;
        for (const src of bundle.sources) {
          const c = cell(src, se.id, lo, hi, bundle.weeks);
          if (c.total == null) continue;
          n += c.n; t += c.total;
        }
        const value = metric === 'share' ? (t ? (n / t) * 100 : 0) : n;
        return { id: se.id, label: se.label, sub: se.target || '', value, display: metric === 'share' ? pct(value) : fmtNum(value) };
      });
      return { kind: 'bar', note: metric === 'share' ? `matching articles per 100 scanned${note ? `, ${note}` : ''}` : note, rows };
    }
    case 'outlets': {
      const rows = rankedSources(bundle).map(src => {
        let n = 0, t = null;
        for (const se of bundle.series) {
          const c = cell(src, se.id, lo, hi, bundle.weeks);
          if (c.total == null) continue;
          n += c.n; t = c.total;
        }
        if (t == null) return null;
        const value = metric === 'share' ? (t ? (n / t) * 100 : 0) : n;
        return { id: src.id, label: shortName(src), sub: `R${src.rank} · ${fmtNum(t)} articles`, value, display: metric === 'share' ? pct(value) : fmtNum(value) };
      }).filter(Boolean);
      return { kind: 'bar', note: metric === 'share' ? `narrative matches per 100 articles${note ? `, ${note}` : ''}` : note, rows };
    }
    case 'carriers': {
      const se = bundle.series.find(s => s.id === params.series) || bundle.series[0];
      const rows = rankedSources(bundle).map(src => {
        const c = cell(src, se.id, lo, hi, bundle.weeks);
        if (c.total == null) return null;
        const value = metric === 'share' ? c.share ?? 0 : c.n;
        return { id: src.id, label: shortName(src), sub: `${fmtNum(c.n)} of ${fmtNum(c.total)} articles`, value, display: metric === 'share' ? pct(value) : fmtNum(value) };
      }).filter(Boolean);
      return { kind: 'bar', note, rows };
    }
    case 'routes': {
      const byId = sourceById(bundle);
      const rows = propagationLinks(bundle, ALL_RELATIONS).map(l => {
        const observed = l.edges.filter(e => !e.synthetic).length;
        return {
          id: l.key, label: `${byId[l.from] ? shortName(byId[l.from]) : l.from} → ${byId[l.to] ? shortName(byId[l.to]) : l.to}`,
          sub: `${observed} observed · median lag ${fmtHours(l.medianLag)}`,
          value: l.count, display: fmtNum(l.count), observed, estimated: observed < l.count,
        };
      });
      return { kind: 'bar', note: 'hatched = estimated pickups', rows };
    }
    default:
      return { kind: 'bar', rows: [] };
  }
}

const sorted = r => ({ ...r, rows: r.kind === 'diverging' ? r.rows : [...r.rows].sort((a, b) => b.value - a.value) });
export const rankedRows = (bundle, params, filters) => sorted(rankRows(bundle, params, filters));

const TITLES = {
  spikes: () => 'Biggest spikes',
  movers: () => 'What moved in the last four weeks',
  narratives: p => (p.metric === 'count' ? 'Narratives by matching articles' : 'Narratives by share of articles'),
  outlets: p => (p.metric === 'count' ? 'Outlets by narrative matches' : 'Outlets by share of narrative matches'),
  carriers: (p, bundle) => `Who carries “${bundle.series.find(s => s.id === p.series)?.label ?? '…'}”`,
  routes: () => 'Busiest pickup routes',
};

export default {
  id: 'ranked-bars',
  title: 'Ranked bars',
  description: 'One ranked list, six ways: biggest spikes (with the usual level), movers (diverging), narratives, outlets, the outlets carrying one narrative, or pickup routes.',
  job: 'compare',
  sizes: { min: { w: 2, h: 2 }, max: { w: 6, h: 6 }, presets: ['3x3', '3x2', '6x2', '3x4', '2x3', '6x3'] },
  params: {
    mode: { type: 'enum', label: 'Rank', options: MODES, default: 'narratives' },
    series: { type: 'series', label: 'Narrative (carriers)', default: bundle => bundle.series[0]?.id },
    metric: METRIC_PARAM,
  },
  requires: bundle => bundle.series.length > 1,
  defaultTitle: (params, bundle) => (TITLES[params.mode] || TITLES.narratives)(params, bundle),
  usesEstimates: (bundle, params) => params.mode === 'routes' && bundle.edges.some(e => e.synthetic),
  suggest(bundle, insights) {
    const out = [];
    const sp = insights.filter(i => i.kind === 'spike');
    const mv = insights.filter(i => i.kind === 'mover');
    const dom = insights.find(i => i.kind === 'dominant');
    const hub = insights.find(i => i.kind === 'hub');
    if (sp.length >= 2) out.push({ params: { mode: 'spikes' }, size: '3x3', score: 0.6 + sp[0].salience * 0.15, reason: `${sp.length} spike weeks; the biggest: ${plain(sp[0].sentence)}` });
    if (mv.length) out.push({ params: { mode: 'movers' }, size: '3x3', score: 0.5 + mv[0].salience * 0.2, reason: plain(mv[0].sentence) });
    if (dom) {
      out.push({ params: { mode: 'narratives' }, size: '3x3', score: 0.55, reason: plain(dom.sentence) });
      out.push({ params: { mode: 'carriers', series: dom.series }, size: '3x3', score: 0.45, reason: `Which outlets carry the most common narrative, “${bundle.series.find(s => s.id === dom.series)?.label}”.` });
    }
    out.push({ params: { mode: 'outlets' }, size: '3x3', score: 0.42, reason: 'How much of each outlet’s output matches a tracked narrative.' });
    if (hub) out.push({ params: { mode: 'routes' }, size: '3x3', score: 0.38, reason: plain(hub.sentence) });
    return out;
  },
};
