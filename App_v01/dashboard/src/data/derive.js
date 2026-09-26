// Pure selectors over the dashboard data. No React, no fetching.

export const RANGE_PRESETS = [
  { value: 'all', label: 'All weeks' },
  { value: '12', label: 'Last 12 wk' },
  { value: '4', label: 'Last 4 wk' },
];

export const KIND_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'frame', label: 'Frames' },
  { value: 'subject', label: 'Subjects' },
];

export const METRIC_OPTIONS = [
  { value: 'share', label: 'Share %' },
  { value: 'count', label: 'Articles' },
];

export const RELATIONS = [
  { id: 'citation', label: 'Citation', note: 'Explicit link or named attribution' },
  { id: 'topic_echo', label: 'Topic echo', note: 'Same entities within the time window' },
  { id: 'near_duplicate', label: 'Near-duplicate', note: 'SimHash text match' },
];

export function rangeBounds(weeks, range) {
  const hi = weeks.length - 1;
  if (range === 'all') return [0, hi];
  return [Math.max(0, hi - Number(range) + 1), hi];
}

const sum = (arr, lo, hi) => {
  let s = 0;
  for (let i = lo; i <= hi; i++) s += arr[i] || 0;
  return s;
};

/** Weeks a source was actually crawled; outside this span values are unknown, not zero. */
export function coveredWeeks(source, weeks) {
  return weeks.map(w => w.end >= source.date_span.min && w.start <= source.date_span.max);
}

export function seriesById(data) {
  return Object.fromEntries(data.series.map(s => [s.id, s]));
}

export function sourceById(data) {
  const all = [...data.sources, ...data.upstream];
  return Object.fromEntries(all.map(s => [s.id, s]));
}

export function visibleSeries(data, kind) {
  return data.series.filter(s => kind === 'all' || s.kind === kind);
}

/** Sources sorted by catalogue rank, then volume. */
export function rankedSources(data) {
  return [...data.sources].sort((a, b) => (a.rank - b.rank) || (b.article_count - a.article_count));
}

export function cell(source, seriesId, lo, hi) {
  const s = source.series.find(x => x.id === seriesId);
  const n = s ? sum(s.weekly_n, lo, hi) : 0;
  const total = sum(source.weekly_articles, lo, hi);
  return { n, total, share: total ? (n / total) * 100 : null };
}

export function metricValue(c, metric) {
  return metric === 'share' ? c.share : (c.total ? c.n : null);
}

/** One line per source for a series: weekly value or null outside the crawl span. */
export function timeline(data, seriesId, metric, lo, hi) {
  return rankedSources(data).map(src => {
    const cover = coveredWeeks(src, data.weeks);
    const s = src.series.find(x => x.id === seriesId);
    const points = [];
    for (let i = lo; i <= hi; i++) {
      const tot = src.weekly_articles[i] || 0;
      const n = s ? s.weekly_n[i] || 0 : 0;
      const known = cover[i] && tot > 0;
      points.push({ i, n, total: tot, value: !known ? null : metric === 'share' ? (n / tot) * 100 : n });
    }
    return { source: src, points };
  });
}

function meanStd(xs) {
  if (!xs.length) return [0, 0];
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  const v = xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length;
  return [m, Math.sqrt(v)];
}

/** Weeks where a series' share jumped well above its own baseline in that source. */
export function spikes(data, kind, lo, hi, { minN = 4, minZ = 1.8 } = {}) {
  const out = [];
  const byId = seriesById(data);
  for (const src of data.sources) {
    const cover = coveredWeeks(src, data.weeks);
    for (const s of src.series) {
      if (kind !== 'all' && byId[s.id].kind !== kind) continue;
      const shares = [];
      for (let i = 0; i < data.weeks.length; i++) {
        const tot = src.weekly_articles[i];
        if (cover[i] && tot) shares.push({ i, share: (s.weekly_n[i] / tot) * 100, n: s.weekly_n[i] });
      }
      if (shares.length < 4) continue;
      const [m, sd] = meanStd(shares.map(x => x.share));
      if (!sd) continue;
      for (const x of shares) {
        if (x.i < lo || x.i > hi || x.n < minN) continue;
        const z = (x.share - m) / sd;
        if (z >= minZ) out.push({ source: src, series: byId[s.id], week: data.weeks[x.i], i: x.i, n: x.n, share: x.share, baseline: m, z });
      }
    }
  }
  return out.sort((a, b) => b.z - a.z);
}

/** Share in the last `recent` weeks vs the weeks before, pooled over all sources. */
export function movers(data, kind, lo, hi, recent = 4) {
  const split = Math.max(lo + 1, hi - recent + 1);
  return visibleSeries(data, kind).map(se => {
    let nA = 0, tA = 0, nB = 0, tB = 0;
    const spark = [];
    for (let i = lo; i <= hi; i++) {
      let n = 0, t = 0;
      for (const src of data.sources) {
        const s = src.series.find(x => x.id === se.id);
        n += s ? s.weekly_n[i] || 0 : 0;
        t += src.weekly_articles[i] || 0;
      }
      spark.push(t ? (n / t) * 100 : 0);
      if (i < split) { nA += n; tA += t; } else { nB += n; tB += t; }
    }
    const before = tA ? (nA / tA) * 100 : 0;
    const after = tB ? (nB / tB) * 100 : 0;
    return { series: se, before, after, delta: after - before, spark, split: split - lo };
  }).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

export function kpis(data, kind, lo, hi) {
  const ids = new Set(visibleSeries(data, kind).map(s => s.id));
  let articles = 0, hits = 0, active = 0;
  for (const src of data.sources) {
    const a = sum(src.weekly_articles, lo, hi);
    articles += a;
    if (a) active++;
    for (const s of src.series) if (ids.has(s.id)) hits += sum(s.weekly_n, lo, hi);
  }
  const lags = data.edges.filter(e => e.from_source_id !== e.to_source_id && e.lag_hours > 0).map(e => e.lag_hours).sort((a, b) => a - b);
  const medianLag = lags.length ? lags[Math.floor(lags.length / 2)] : null;
  return { articles, hits, active, sources: data.sources.length, edges: data.edges.length, medianLag, hitRate: articles ? (hits / articles) * 100 : 0 };
}

/** Aggregate source-to-source edges into links for the propagation map. */
export function propagationLinks(data, relations) {
  const map = new Map();
  for (const e of data.edges) {
    if (e.from_source_id === e.to_source_id || !relations.has(e.relation)) continue;
    const key = `${e.from_source_id}>${e.to_source_id}`;
    if (!map.has(key)) map.set(key, { key, from: e.from_source_id, to: e.to_source_id, edges: [] });
    map.get(key).edges.push(e);
  }
  return [...map.values()].map(l => {
    const lags = l.edges.map(e => Math.abs(e.lag_hours)).sort((a, b) => a - b);
    const byRel = {};
    for (const e of l.edges) byRel[e.relation] = (byRel[e.relation] || 0) + 1;
    return { ...l, count: l.edges.length, medianLag: lags[Math.floor(lags.length / 2)], byRel };
  });
}

export function lagHistogram(edges, bins = [0, 6, 12, 24, 48, 96, 168, Infinity]) {
  return bins.slice(0, -1).map((b, k) => {
    const top = bins[k + 1];
    const inBin = edges.filter(e => Math.abs(e.lag_hours) >= b && Math.abs(e.lag_hours) < top);
    return { from: b, to: top, count: inBin.length, edges: inBin };
  });
}

// Formatting
const dayFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
export const fmtWeek = w => dayFmt.format(new Date(w.start + 'T00:00:00'));
export const fmtDate = d => dayFmt.format(new Date(d + 'T00:00:00'));
export const fmtNum = n => (n == null ? '–' : n.toLocaleString('en-GB'));
export const fmtPct = (v, d = 1) => (v == null ? '–' : `${v.toFixed(d)}%`);
export const fmtHours = h => (h == null ? '–' : h < 48 ? `${Math.round(h)}h` : `${(h / 24).toFixed(1)}d`);
export const fmtValue = (v, metric) => (metric === 'share' ? fmtPct(v, 2) : fmtNum(v));
