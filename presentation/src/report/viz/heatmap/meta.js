import { cell, metricValue, rankedSources, rangeBounds, fmtPct, fmtNum } from '../../../data/derive.js';
import { shortName } from '../../lib.js';

export const METRIC_PARAM = {
  type: 'enum',
  label: 'Measure',
  options: [{ value: 'share', label: 'Share of articles' }, { value: 'count', label: 'Articles' }],
  default: (bundle, filters) => filters.metric,
};

/** The strongest outlet × narrative pairing in the period. */
export function topCell(bundle, filters, metric = filters.metric) {
  const [lo, hi] = rangeBounds(bundle.weeks, filters.range);
  let best = null;
  for (const src of rankedSources(bundle)) {
    for (const se of bundle.series) {
      const v = metricValue(cell(src, se.id, lo, hi, bundle.weeks), metric);
      if (v != null && (!best || v > best.value)) best = { source: src, series: se, value: v };
    }
  }
  return best;
}

export default {
  id: 'heatmap',
  title: 'Which outlet carries which narrative',
  description: 'Outlets (rows, by catalogue rank) × narratives (columns), shaded by share of each outlet’s articles or by article count.',
  job: 'compare',
  sizes: { min: { w: 4, h: 3 }, max: { w: 6, h: 6 }, presets: ['6x3', '6x4', '4x3', '4x4', '6x5'] },
  params: { metric: METRIC_PARAM },
  requires: bundle => bundle.sources.length > 1 && bundle.series.length > 1,
  defaultTitle: params => (params.metric === 'count' ? 'Matching articles per outlet and narrative' : 'Which outlet carries which narrative'),
  suggest(bundle, insights, filters) {
    const top = topCell(bundle, filters);
    if (!top) return [];
    const v = filters.metric === 'count' ? `${fmtNum(top.value)} articles` : `${fmtPct(top.value)} of its articles`;
    return [{
      params: {},
      size: '6x3',
      score: 0.8,
      reason: `${shortName(top.source)} carries “${top.series.label}” at ${v}, the strongest pairing of ${bundle.sources.length} outlets × ${bundle.series.length} narratives.`,
    }];
  },
};
