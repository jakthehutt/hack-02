import { movers, rangeBounds, weeklyObserved, fmtPct } from '../../../data/derive.js';

export default {
  id: 'small-multiples',
  title: 'Every narrative, week by week',
  description: 'One small chart per narrative on a shared scale: weekly share in outlets with observed weeks, the last four weeks shaded.',
  job: 'trend',
  sizes: { min: { w: 3, h: 2 }, max: { w: 6, h: 6 }, presets: ['6x2', '6x3', '3x3', '3x4', '4x3'] },
  params: {},
  requires: bundle => (bundle.sources.some(weeklyObserved) && bundle.weeks.length >= 6) || 'needs an outlet with observed weekly counts',
  suggest(bundle, insights, filters) {
    const [lo, hi] = rangeBounds(bundle.weeks, filters.range);
    if (hi - lo < 5) return [];
    const m = movers(bundle, 'all', lo, hi)[0];
    return [{
      params: {},
      size: '6x2',
      score: 0.58,
      reason: `All ${bundle.series.length} narratives on one scale; the biggest move: “${m.series.label}”, ${fmtPct(m.before)} → ${fmtPct(m.after)}.`,
    }];
  },
};
