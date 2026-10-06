// Small pure helpers the report views share. They mirror the dashboard's
// (components/Heatmap.jsx shortName, components/shared.jsx compilePattern,
// components/PropagationMap.jsx COLUMNS) without importing its React/CSS.
import { fmtWeek, rangeBounds } from '../data/derive.js';

export const shortName = src => src.name.split(' (')[0].split(' / ')[0];

/** Codebook regexes the way the Python side matches them: case-insensitive, Unicode \w. */
export function compilePattern(pattern, flags = 'giu') {
  if (!pattern) return null;
  const unicode = pattern.replace(/\\w/g, '[\\p{L}\\p{N}_]');
  try { return new RegExp(unicode, flags); } catch {
    try { return new RegExp(pattern, flags.replace('u', '')); } catch { return null; }
  }
}

// Columns follow the direction content usually travels.
export const RANK_COLUMNS = [
  { label: 'Upstream wires', short: 'Wires', rank: 3 },
  { label: 'State German', short: 'State DE', rank: 1 },
  { label: 'Covert networks', short: 'Covert', rank: 2 },
  { label: 'Operators in RU', short: 'RU ops', rank: 4 },
  { label: 'DACH relays', short: 'Relays', rank: 5 },
];

const longDay = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
export const fmtLongDate = d => longDay.format(new Date(d + 'T00:00:00'));

/** The weeks a report covers, from its filters. */
export function period(bundle, filters = {}) {
  const [lo, hi] = rangeBounds(bundle.weeks, filters.range ?? 'all');
  const first = bundle.weeks[lo];
  const last = bundle.weeks[hi];
  return { lo, hi, first, last, label: `${fmtWeek(first)} – ${fmtLongDate(last.end)}`, weeks: hi - lo + 1 };
}

/** ISO week label without the year: "2026-W37" → "W37". */
export const weekLabel = w => w.week.split('-')[1];

/** What in this bundle is estimated, said in one line for the sheet footer. */
export function provenance(bundle) {
  const observed = bundle.sources.filter(s => s.weekly_observed);
  const realEdges = bundle.edges.filter(e => !e.synthetic).length;
  const names = observed.length && observed.length <= 2 ? ` (${observed.map(shortName).join(', ')})` : '';
  const sentence = `Observed weekly counts: ${observed.length} of ${bundle.sources.length} outlets${names}. Observed pickups: ${realEdges} of ${bundle.edges.length}. Dashed or hatched = estimated.`;
  return { sentence, observedSources: observed.length, realEdges, edges: bundle.edges.length };
}

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** Round a maximum up to 1, 2, 2.5 or 5 × 10^n for axis ticks. */
export function niceMax(v) {
  if (!(v > 0)) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const f = v / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
}
