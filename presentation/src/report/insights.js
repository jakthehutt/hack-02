// What stands out in a bundle, as findings with a plain-language sentence each.
// Pure and deterministic: the recommender ranks visualizations by these, and the
// key-findings block prints the sentences, so no number in a report is typed by hand.
import { spikes, movers, propagationLinks, rangeBounds, sourceById, fmtPct, fmtNum, fmtWeek, RELATIONS } from '../data/derive.js';
import { shortName, provenance, clamp } from './lib.js';

const ALL_RELATIONS = new Set(RELATIONS.map(r => r.id));

export function detectSpikes(bundle, lo, hi) {
  return spikes(bundle, 'all', lo, hi).slice(0, 5).map((s, k) => ({
    id: `spike-${s.source.id}-${s.series.id}-${s.week.week}`,
    kind: 'spike',
    salience: clamp(0.55 + (s.z - 1.8) / 6, 0.5, 1) - k * 0.03,
    source: s.source.id,
    series: s.series.id,
    week: s.week.week,
    weekStart: s.week.start,
    share: s.share,
    baseline: s.baseline,
    z: s.z,
    n: s.n,
    headline: `${s.series.label} spiked in ${shortName(s.source)}: ${fmtPct(s.share)} in the week of ${fmtWeek(s.week)}, usually ${fmtPct(s.baseline)}`,
    sentence: `**${s.series.label}** in ${shortName(s.source)}: ${fmtPct(s.share)} of articles in the week of ${fmtWeek(s.week)}, against a usual ${fmtPct(s.baseline)} (z ${s.z.toFixed(1)}, ${s.n} articles).`,
  }));
}

export function detectMovers(bundle, lo, hi) {
  if (hi - lo < 5) return [];
  return movers(bundle, 'all', lo, hi)
    .filter(m => Math.abs(m.delta) >= 0.5)
    .slice(0, 3)
    .map(m => ({
      id: `mover-${m.series.id}`,
      kind: 'mover',
      salience: clamp(0.4 + Math.abs(m.delta) / 12, 0.4, 0.9),
      series: m.series.id,
      before: m.before,
      after: m.after,
      delta: m.delta,
      headline: `${m.series.label} ${m.delta > 0 ? 'rose' : 'fell'} to ${fmtPct(m.after)} of articles in the last four weeks`,
      sentence: `**${m.series.label}** ${m.delta > 0 ? 'rose' : 'fell'} from ${fmtPct(m.before)} to ${fmtPct(m.after)} of articles in the last four weeks (${m.delta > 0 ? '+' : '−'}${Math.abs(m.delta).toFixed(1)} pp, outlets with weekly counts).`,
    }));
}

/** The narrative with the most matching articles over the whole window. */
export function detectDominant(bundle) {
  const totals = bundle.series.map(se => ({
    se,
    n: bundle.sources.reduce((a, src) => a + (src.series.find(x => x.id === se.id)?.article_count || 0), 0),
    outlets: bundle.sources.filter(src => (src.series.find(x => x.id === se.id)?.article_count || 0) > 0).length,
  })).sort((a, b) => b.n - a.n);
  const all = totals.reduce((a, t) => a + t.n, 0);
  const top = totals[0];
  if (!top || !all) return [];
  return [{
    id: `dominant-${top.se.id}`,
    kind: 'dominant',
    salience: clamp(0.45 + top.n / all, 0.5, 0.85),
    series: top.se.id,
    n: top.n,
    of: all,
    outlets: top.outlets,
    headline: `${top.se.label} is the most common narrative, in ${top.outlets} of ${bundle.sources.length} outlets`,
    sentence: `**${top.se.label}** is the most common narrative: ${fmtNum(top.n)} of ${fmtNum(all)} narrative matches (${fmtPct((top.n / all) * 100, 0)}), in ${top.outlets} of ${bundle.sources.length} outlets.`,
  }];
}

/** The outlet most pickups start from. Says how much of it is observed. */
export function detectHub(bundle) {
  const links = propagationLinks(bundle, ALL_RELATIONS);
  if (!links.length) return [];
  const out = {};
  for (const l of links) {
    out[l.from] ||= { total: 0, observed: 0 };
    out[l.from].total += l.count;
    out[l.from].observed += l.edges.filter(e => !e.synthetic).length;
  }
  const [id, d] = Object.entries(out).sort((a, b) => b[1].total - a[1].total)[0];
  const src = sourceById(bundle)[id];
  const total = links.reduce((a, l) => a + l.count, 0);
  const mostlyEstimated = d.observed < d.total / 2;
  return [{
    id: `hub-${id}`,
    kind: 'hub',
    salience: mostlyEstimated ? 0.45 : 0.75,
    source: id,
    total: d.total,
    observed: d.observed,
    of: total,
    estimated: mostlyEstimated,
    sentence: `${src ? shortName(src) : id} is where most pickups start: ${d.total} of ${total} links between outlets${mostlyEstimated ? `, but only ${d.observed} of them were observed; the rest are estimated` : ` (${d.observed} observed)`}.`,
  }];
}

export function detectProvenance(bundle) {
  const p = provenance(bundle);
  const estimatedShare = 1 - (p.observedSources / Math.max(1, bundle.sources.length) + p.realEdges / Math.max(1, p.edges)) / 2;
  return [{
    id: 'provenance',
    kind: 'provenance',
    salience: clamp(0.25 + estimatedShare * 0.3, 0.25, 0.5),
    observedSources: p.observedSources,
    realEdges: p.realEdges,
    edges: p.edges,
    sentence: `Weekly counts were observed for ${p.observedSources} of ${bundle.sources.length} outlets and ${p.realEdges} of ${p.edges} pickups; everything else marked as estimated is modelled from observed totals.`,
  }];
}

/** All findings for a bundle and filters, most salient first. */
export function detectInsights(bundle, filters = {}) {
  const [lo, hi] = rangeBounds(bundle.weeks, filters.range ?? 'all');
  return [
    ...detectSpikes(bundle, lo, hi),
    ...detectMovers(bundle, lo, hi),
    ...detectDominant(bundle),
    ...detectHub(bundle),
    ...detectProvenance(bundle),
  ].sort((a, b) => b.salience - a.salience);
}

/** Sentence without the **bold** markers, for plain-text output. */
export const plain = s => s.replace(/\*\*/g, '');
