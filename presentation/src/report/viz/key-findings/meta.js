import { detectInsights } from '../../insights.js';

export default {
  id: 'key-findings',
  title: 'Key findings',
  description: 'The findings the data shows most clearly, as sentences computed from the bundle: spikes, movers, the most common narrative, where pickups start, what is estimated.',
  job: 'words',
  sizes: { min: { w: 2, h: 2 }, max: { w: 6, h: 6 }, presets: ['3x3', '6x2', '3x2', '3x4', '2x3'] },
  params: {
    count: { type: 'int', label: 'Findings', min: 1, max: 8, default: 4 },
    provenance: { type: 'bool', label: 'Include what is estimated', default: true },
  },
  requires: () => true,
  suggest(bundle, insights) {
    const n = insights.filter(i => i.kind !== 'provenance').length;
    return n ? [{ params: {}, size: '3x3', score: 0.5, reason: `${n} findings stand out; this block states them in sentences with their numbers.` }] : [];
  },
};

/** The findings a key-findings block shows, one per narrative × kind where possible. */
export function pickFindings(bundle, filters, { count = 4, provenance = true } = {}) {
  const all = detectInsights(bundle, filters);
  const out = [];
  const seen = new Set();
  for (const i of all) {
    if (i.kind === 'provenance') continue;
    const key = `${i.kind}:${i.series ?? i.source ?? i.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(i);
    if (out.length >= count) break;
  }
  if (provenance) out.push(...all.filter(i => i.kind === 'provenance'));
  return out;
}
