// How fast pickups travel. Contract: .claude/skills/foreshock-report/references/viz-contract.md
// Plain ESM only: no JSX, CSS, React or '@bundle' imports (Node loads this file).
import { median, fmtHours } from '../../../data/derive.js';

export const BINS = [0, 6, 12, 24, 48, 96, 168, Infinity];
export const BIN_LABELS = ['<6 h', '6–12 h', '12–24 h', '1–2 d', '2–4 d', '4–7 d', '7 d+'];

const pickups = (bundle, observedOnly) => bundle.edges.filter(e =>
  e.from_source_id !== e.to_source_id && e.lag_hours != null && (!observedOnly || !e.synthetic));

/** Pickups per lag bin, split into observed and estimated. */
export function lagBins(bundle, observedOnly = false) {
  const edges = pickups(bundle, observedOnly);
  const bins = BINS.slice(0, -1).map((from, k) => ({ from, to: BINS[k + 1], label: BIN_LABELS[k], observed: 0, estimated: 0 }));
  for (const e of edges) {
    const h = Math.abs(e.lag_hours);
    const bin = bins.find(b => h >= b.from && h < b.to);
    if (bin) bin[e.synthetic ? 'estimated' : 'observed'] += 1;
  }
  const lags = s => edges.filter(e => !!e.synthetic === s).map(e => Math.abs(e.lag_hours));
  return { bins, observedMedian: median(lags(false)), estimatedMedian: median(lags(true)), observed: lags(false).length, estimated: lags(true).length };
}

export default {
  id: 'lag-dist',
  title: 'How fast pickups travel',
  description: 'Hours from first publication to the outlet that repeated it, binned: observed pickups solid, estimated ones hatched, with the observed median.',
  job: 'flow',
  sizes: { min: { w: 2, h: 2 }, max: { w: 6, h: 4 }, presets: ['3x2', '3x3', '6x2', '2x2'] },
  params: {
    observedOnly: { type: 'bool', label: 'Observed pickups only', default: false },
  },
  requires: bundle => pickups(bundle, false).length >= 5 || 'needs at least five pickups with a lag',
  usesEstimates: (bundle, params) => !params.observedOnly && bundle.edges.some(e => e.synthetic),
  suggest(bundle) {
    const d = lagBins(bundle);
    if (!d.observed) return [];
    const fast = d.bins.slice(0, 3).reduce((a, b) => a + b.observed, 0);
    return [{
      params: {},
      size: '3x2',
      score: 0.42,
      reason: `Observed pickups take a median ${fmtHours(d.observedMedian)}; ${fast} of ${d.observed} happen within a day.`,
    }];
  },
};
