import { spikes, rangeBounds, fmtPct, weeklyObserved, fmtWeek } from '../../../data/derive.js';
import { shortName } from '../../lib.js';
import { METRIC_PARAM } from '../heatmap/meta.js';

const observedSources = bundle => bundle.sources.filter(weeklyObserved);

/** The narrative to put in front: the biggest spike for this outlet, else its largest share. */
export function defaultSeries(bundle, filters, sourceId) {
  const [lo, hi] = rangeBounds(bundle.weeks, filters.range);
  const sp = spikes(bundle, 'all', lo, hi).find(s => !sourceId || s.source.id === sourceId);
  if (sp) return sp.series.id;
  const src = bundle.sources.find(s => s.id === sourceId) || observedSources(bundle)[0];
  return [...(src?.series || [])].sort((a, b) => b.share_pct - a.share_pct)[0]?.id ?? bundle.series[0]?.id;
}

export default {
  id: 'timeline',
  title: 'One narrative, week by week',
  description: 'Weekly share (or count) of one narrative in one outlet, against the outlet’s other narratives in gray, with spike weeks marked.',
  job: 'trend',
  sizes: { min: { w: 2, h: 2 }, max: { w: 6, h: 5 }, presets: ['6x3', '6x2', '3x3', '4x3', '3x2'] },
  params: {
    source: { type: 'source', label: 'Outlet', observedOnly: true, default: bundle => observedSources(bundle)[0]?.id },
    series: { type: 'series', label: 'Narrative', default: (bundle, filters) => defaultSeries(bundle, filters, observedSources(bundle)[0]?.id) },
    metric: METRIC_PARAM,
    context: { type: 'bool', label: 'Other narratives in gray', default: true },
  },
  requires: bundle => observedSources(bundle).length > 0 && bundle.weeks.length >= 4 || 'needs an outlet with observed weekly counts',
  defaultTitle(params, bundle) {
    const se = bundle.series.find(s => s.id === params.series);
    const src = bundle.sources.find(s => s.id === params.source);
    return se && src ? `“${se.label}” in ${shortName(src)}, week by week` : 'One narrative, week by week';
  },
  suggest(bundle, insights, filters) {
    const [lo, hi] = rangeBounds(bundle.weeks, filters.range);
    const sp = spikes(bundle, 'all', lo, hi);
    const seen = new Set();
    const out = [];
    for (const s of sp) {
      const key = `${s.source.id}:${s.series.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        params: { source: s.source.id, series: s.series.id },
        size: '6x3',
        score: Math.min(1, 0.55 + s.z / 10),
        reason: `${shortName(s.source)}: “${s.series.label}” jumped to ${fmtPct(s.share)} in the week of ${fmtWeek(s.week)}, against a usual ${fmtPct(s.baseline)} (z ${s.z.toFixed(1)}).`,
      });
      if (out.length === 2) break;
    }
    return out;
  },
};
