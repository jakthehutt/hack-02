import { rangeBounds } from '../../../data/derive.js';
import { shortName } from '../../lib.js';

/** Quotes for a narrative, the focus outlet's first, newest first, inside the period. */
export function quotesFor(bundle, seriesId, sourceId, filters) {
  const [lo, hi] = rangeBounds(bundle.weeks, filters.range);
  const from = bundle.weeks[lo].start;
  const to = bundle.weeks[hi].end;
  const seen = new Set();
  const out = [];
  for (const src of bundle.sources) {
    const row = src.series.find(s => s.id === seriesId);
    for (const q of row?.quotes || []) {
      if (q.date < from || q.date > to || seen.has(q.quote)) continue;
      seen.add(q.quote);
      out.push({ ...q, source: src });
    }
  }
  return out.sort((a, b) => (b.source.id === sourceId) - (a.source.id === sourceId) || b.date.localeCompare(a.date));
}

export default {
  id: 'quotes',
  title: 'What the articles said',
  description: 'Sentences that matched a narrative, with the matching words highlighted, the outlet and the date.',
  job: 'evidence',
  sizes: { min: { w: 2, h: 2 }, max: { w: 6, h: 6 }, presets: ['3x3', '3x2', '6x2', '3x4', '2x3'] },
  params: {
    series: { type: 'series', label: 'Narrative', default: bundle => bundle.series[0]?.id },
    source: { type: 'source', label: 'Outlet first', optional: true, default: '' },
  },
  requires: bundle => bundle.sources.some(s => s.series.some(se => se.quotes?.length)) || 'needs quotes in the bundle',
  defaultTitle: (params, bundle) => `Quoted: “${bundle.series.find(s => s.id === params.series)?.label ?? '…'}”`,
  suggest(bundle, insights, filters) {
    const focus = insights.find(i => i.kind === 'spike') || insights.find(i => i.kind === 'dominant');
    if (!focus) return [];
    const qs = quotesFor(bundle, focus.series, focus.source, filters);
    if (!qs.length) return [];
    const se = bundle.series.find(s => s.id === focus.series);
    return [{
      params: { series: focus.series, ...(focus.source ? { source: focus.source } : {}) },
      size: '3x3',
      score: 0.52,
      reason: `${qs.length} matched sentence${qs.length === 1 ? '' : 's'} for “${se.label}”${focus.source ? `, ${shortName(bundle.sources.find(s => s.id === focus.source))} first` : ''}: the evidence behind the number.`,
    }];
  },
};
