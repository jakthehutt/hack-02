import { forestRows, rangeBounds, weeklyObserved, fullSpan } from '../../../data/derive.js';
import { shortName } from '../../lib.js';

const biggest = bundle => [...bundle.sources].sort((a, b) => b.article_count - a.article_count)[0]?.id;

export default {
  id: 'forest-plot',
  title: 'Shares with their uncertainty',
  description: 'For one outlet: each narrative’s share of its articles with a 95% Wilson interval, so readers can see which differences are more than noise.',
  job: 'compare',
  sizes: { min: { w: 3, h: 3 }, max: { w: 6, h: 6 }, presets: ['3x3', '3x4', '6x3', '4x4'] },
  params: {
    source: { type: 'source', label: 'Outlet', default: biggest },
  },
  requires: bundle => bundle.sources.length > 0,
  defaultTitle: (params, bundle) => {
    const src = bundle.sources.find(s => s.id === params.source);
    return src ? `${shortName(src)}: shares with 95% intervals` : 'Shares with 95% intervals';
  },
  suggest(bundle, insights, filters) {
    const [lo, hi] = rangeBounds(bundle.weeks, filters.range);
    const id = insights.find(i => i.kind === 'spike')?.source || biggest(bundle);
    const src = bundle.sources.find(s => s.id === id);
    if (!src || (!fullSpan(bundle.weeks, lo, hi) && !weeklyObserved(src))) return [];
    const rows = forestRows(bundle, src, 'all', lo, hi).filter(r => r.interval);
    if (rows.length < 3) return [];
    return [{ params: { source: id }, size: '3x3', score: 0.4, reason: `${shortName(src)}: ${rows.length} narrative shares with 95% intervals, so readers see which gaps are real.` }];
  },
};
