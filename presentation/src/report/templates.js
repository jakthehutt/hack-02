// Ready-made specs, composed from the current bundle each time, so "this week's
// brief" or "this dashboard view on paper" is one call with no hand-typed numbers.
import { METAS } from './registry.js';
import { recommend } from './recommend.js';
import { autolayout } from './autolayout.js';
import { detectInsights } from './insights.js';
import { firstFree } from './grid.js';
import { presets, normalizeSpec, SPEC_VERSION } from './spec.js';
import { weeklyObserved, rangeBounds, fullSpan } from '../data/derive.js';
import { shortName } from './lib.js';
import { rankedRows } from './viz/ranked-bars/meta.js';

const filtersOf = (state = {}) => ({ range: state.range || 'all', metric: state.metric || 'share' });

/**
 * A short range only uses outlets with observed weekly counts. When that leaves fewer
 * than three, outlet comparisons would be near-empty: say so, and compare narratives instead.
 */
function sparse(bundle, f) {
  const [lo, hi] = rangeBounds(bundle.weeks, f.range);
  const observed = bundle.sources.filter(weeklyObserved);
  if (fullSpan(bundle.weeks, lo, hi) || observed.length >= 3) return null;
  const names = observed.map(shortName).join(' and ') || 'no outlet';
  const which = observed.length === 1 ? 'the one outlet' : 'the outlets';
  return { observed, note: `${hi - lo + 1} weeks cover ${names} only, ${which} with weekly counts. All weeks covers all ${bundle.sources.length}.` };
}
const headline = (bundle, filters) => detectInsights(bundle, filters).find(i => i.headline)?.headline ?? '';
const spec = (title, subtitle, filters, blocks) => normalizeSpec({ version: SPEC_VERSION, title, subtitle, filters, blocks });

export const TEMPLATES = [
  { id: 'auto', label: 'Compose from the data', description: 'The strongest findings, packed onto one page.' },
  { id: 'overview', label: 'Overview brief', description: 'Headline numbers, the outlet × narrative map, spikes, movers and pickups.' },
  { id: 'narratives', label: 'One narrative', description: 'One narrative week by week, who carries it and what they wrote.' },
  { id: 'origin', label: 'Who repeats whom', description: 'Pickup routes between outlets, the busiest ones and how fast they travel.' },
  { id: 'sources', label: 'Outlets', description: 'Every outlet, how much of it matches, and one outlet with uncertainty.' },
];

export function auto(bundle, filters = filtersOf()) {
  const { suggestions } = recommend(bundle, filters, METAS);
  return spec('Narrative brief', headline(bundle, filters), filters, autolayout(suggestions, METAS));
}

const VIEWS = {
  overview(bundle, f) {
    const thin = sparse(bundle, f);
    return spec('Overview', headline(bundle, f), f, [
      { id: 'kpis', viz: 'kpi-row', x: 0, y: 0, w: 6, h: 1 },
      thin
        ? { id: 'weekly', viz: 'small-multiples', x: 0, y: 1, w: 6, h: 3, caption: thin.note }
        : { id: 'map', viz: 'heatmap', x: 0, y: 1, w: 6, h: 3, params: { metric: f.metric } },
      { id: 'spikes', viz: 'ranked-bars', x: 0, y: 4, w: 3, h: 2, params: { mode: 'spikes' } },
      { id: 'movers', viz: 'ranked-bars', x: 3, y: 4, w: 3, h: 2, params: { mode: 'movers' } },
      { id: 'flow', viz: 'propagation-flow', x: 0, y: 6, w: 6, h: 2 },
    ]);
  },
  narratives(bundle, f, state) {
    const series = bundle.series.find(s => s.id === state.series) || bundle.series[0];
    const observed = bundle.sources.filter(weeklyObserved);
    const source = observed.find(s => s.id === state.source) || observed[0];
    // Over a short range only outlets with weekly counts remain; with fewer than three
    // carriers, compare this narrative with the others instead.
    const carriers = rankedRows(bundle, { mode: 'carriers', series: series.id, metric: f.metric }, f).rows.length;
    const compare = carriers >= 3 ? { mode: 'carriers', series: series.id, metric: f.metric } : { mode: 'narratives', metric: f.metric };
    const blocks = [
      ...(source ? [{ id: 'trend', viz: 'timeline', x: 0, y: 0, w: 6, h: 3, params: { source: source.id, series: series.id, metric: f.metric } }] : []),
      { id: 'carriers', viz: 'ranked-bars', x: 0, y: source ? 3 : 0, w: 3, h: 3, params: compare },
      { id: 'quotes', viz: 'quotes', x: 3, y: source ? 3 : 0, w: 3, h: 3, params: { series: series.id, source: state.source || '' } },
      { id: 'findings', viz: 'key-findings', x: 0, y: source ? 6 : 3, w: 6, h: 2 },
    ];
    return spec(`“${series.label}”`, series.target ? `Narrative about ${series.target}` : '', f, blocks);
  },
  origin(bundle, f) {
    return spec('Who repeats whom', headline(bundle, f), f, [
      { id: 'flow', viz: 'propagation-flow', x: 0, y: 0, w: 6, h: 4 },
      { id: 'routes', viz: 'ranked-bars', x: 0, y: 4, w: 3, h: 3, params: { mode: 'routes' } },
      { id: 'kpis', viz: 'kpi-row', x: 3, y: 4, w: 3, h: 1, params: { items: ['pickups', 'delay'] } },
      { id: 'findings', viz: 'key-findings', x: 3, y: 5, w: 3, h: 2, params: { count: 2 } },
      { id: 'how', viz: 'text', x: 0, y: 7, w: 6, h: 1, title: 'How pickups are counted', params: { md: '**Citation**: explicit link or named attribution. **Topic echo**: the same entities within the time window. **Near-duplicate**: SimHash text match. Dashed routes are estimated, not observed.' } },
    ]);
  },
  sources(bundle, f, state) {
    const thin = sparse(bundle, f);
    if (thin) {
      const src = thin.observed.find(s => s.id === state.source) || thin.observed[0];
      return spec('Outlets', thin.note, f, [
        { id: 'kpis', viz: 'kpi-row', x: 0, y: 0, w: 6, h: 1, params: { items: ['outlets', 'articles', 'hits', 'per100'] } },
        ...(src ? [{ id: 'forest', viz: 'forest-plot', x: 0, y: 1, w: 3, h: 4, params: { source: src.id } }] : []),
        { id: 'narratives', viz: 'ranked-bars', x: 3, y: 1, w: 3, h: 4, params: { mode: 'narratives', metric: f.metric } },
        { id: 'weekly', viz: 'small-multiples', x: 0, y: 5, w: 6, h: 3 },
      ]);
    }
    const src = bundle.sources.find(s => s.id === state.source) || bundle.sources[0];
    return spec('Outlets', `${bundle.sources.length} outlets in the crawl, ranked from state media to DACH relays`, f, [
      { id: 'kpis', viz: 'kpi-row', x: 0, y: 0, w: 6, h: 1, params: { items: ['outlets', 'articles', 'hits', 'per100'] } },
      { id: 'outlets', viz: 'ranked-bars', x: 0, y: 1, w: 3, h: 4, params: { mode: 'outlets', metric: f.metric } },
      { id: 'forest', viz: 'forest-plot', x: 3, y: 1, w: 3, h: 4, params: { source: src.id } },
      { id: 'map', viz: 'heatmap', x: 0, y: 5, w: 6, h: 3, params: { metric: f.metric } },
    ]);
  },
};

/** The dashboard's current view ({view, range, metric, series, source}) as a page. */
export function fromDashboard(bundle, state = {}) {
  const f = filtersOf(state);
  const make = VIEWS[state.view] || VIEWS.overview;
  return make(bundle, f, state);
}

export function fromTemplate(id, bundle, state = {}) {
  return id === 'auto' ? auto(bundle, filtersOf(state)) : fromDashboard(bundle, { ...state, view: id });
}

/** Contact sheets: every viz at each of its preset sizes, as many pages as needed. */
export function gallery(bundle, only = null) {
  const f = filtersOf();
  const { suggestions } = recommend(bundle, f, METAS, { perJob: 99 });
  const pages = [];
  for (const meta of Object.values(METAS).sort((a, b) => a.id.localeCompare(b.id))) {
    if (only && !only.includes(meta.id)) continue;
    const params = suggestions.find(s => s.viz === meta.id)?.params || {};
    const sizes = presets(meta);
    let blocks = [];
    let n = 1;
    const flush = () => {
      pages.push({ name: n === 1 ? meta.id : `${meta.id}-${n}`, spec: spec(meta.title, `${meta.id} · ${sizes.map(z => `${z.w}×${z.h}`).join(', ')}`, f, blocks) });
      blocks = [];
      n++;
    };
    for (const z of sizes) {
      let slot = firstFree(blocks, z.w, z.h);
      if (!slot) { flush(); slot = firstFree(blocks, z.w, z.h); }
      blocks.push({ id: `${meta.id}-${z.w}x${z.h}`, viz: meta.id, ...slot, params, title: `${meta.title} · ${z.w}×${z.h}` });
    }
    if (blocks.length) flush();
  }
  return pages;
}
