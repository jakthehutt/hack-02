import { kpis, fmtNum, rangeBounds } from '../../../data/derive.js';

export const KPI_ITEMS = [
  { value: 'outlets', label: 'Outlets scanned' },
  { value: 'hits', label: 'Matching articles' },
  { value: 'articles', label: 'Articles scanned' },
  { value: 'per100', label: 'Matches per 100' },
  { value: 'pickups', label: 'Pickups seen' },
  { value: 'delay', label: 'Typical delay' },
];

export default {
  id: 'kpi-row',
  title: 'Headline numbers',
  description: 'The period in three or four numbers: outlets, matching articles, observed pickups, typical delay.',
  job: 'headline',
  frame: { title: false },
  sizes: { min: { w: 2, h: 1 }, max: { w: 6, h: 2 }, presets: ['6x1', '4x1', '3x1', '2x1', '6x2'] },
  params: {
    items: { type: 'multi', label: 'Numbers', options: KPI_ITEMS, default: ['outlets', 'hits', 'pickups', 'delay'] },
  },
  requires: bundle => bundle.sources.length > 0,
  suggest(bundle, insights, filters) {
    const [lo, hi] = rangeBounds(bundle.weeks, filters.range);
    const k = kpis(bundle, 'all', lo, hi);
    return [{
      params: {},
      size: '6x1',
      score: 0.9,
      reason: `${fmtNum(k.hits)} matching articles across ${k.sources} outlets: the numbers a reader looks for first.`,
    }];
  },
};
