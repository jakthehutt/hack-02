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

/** True only when the outlet's week-by-week counts were crawled, not generated. */
export function weeklyObserved(source) {
  return source?.weekly_observed === true;
}

export function fullSpan(weeks, lo, hi) {
  return lo <= 0 && hi >= weeks.length - 1;
}

/** Average of the two central values when the count is even. */
export function median(values) {
  const xs = [...values].filter(v => v != null && Number.isFinite(v)).sort((a, b) => a - b);
  if (!xs.length) return null;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
}

/**
 * All-weeks cells use the reported totals.
 * A shorter range sums weekly counts only when those weeks were observed.
 */
export function cell(source, seriesId, lo, hi, weeks) {
  const s = source.series.find(x => x.id === seriesId);
  const full = !weeks || fullSpan(weeks, lo, hi);
  if (!full && !weeklyObserved(source)) {
    return { n: null, total: null, share: null, generated: true };
  }
  if (full) {
    const n = s ? s.article_count || 0 : 0;
    const total = source.article_count || 0;
    const share = !total ? null : (s && s.share_pct != null ? s.share_pct : (n / total) * 100);
    return { n, total, share, generated: false };
  }
  const n = s ? sum(s.weekly_n, lo, hi) : 0;
  const total = sum(source.weekly_articles, lo, hi);
  return { n, total, share: total ? (n / total) * 100 : null, generated: false };
}

export function metricValue(c, metric) {
  return metric === 'share' ? c.share : (c.total ? c.n : null);
}

/** One line per source for a series. Generated weekly curves stay blank. */
export function timeline(data, seriesId, metric, lo, hi) {
  return rankedSources(data).map(src => {
    const observed = weeklyObserved(src);
    const cover = coveredWeeks(src, data.weeks);
    const s = src.series.find(x => x.id === seriesId);
    const points = [];
    for (let i = lo; i <= hi; i++) {
      const tot = src.weekly_articles[i] || 0;
      const n = s ? s.weekly_n[i] || 0 : 0;
      const known = observed && cover[i] && tot > 0;
      points.push({
        i,
        n: known ? n : null,
        total: known ? tot : null,
        value: !known ? null : metric === 'share' ? (n / tot) * 100 : n,
      });
    }
    return { source: src, observed, points, span: cell(src, seriesId, lo, hi, data.weeks) };
  });
}

/** Same rule as claims.trailing_z: previous `baseline` weeks, current week excluded. */
export const TRAILING_BASELINE = 8;
export const TRAILING_MIN_N = 5;

export function trailingZ(shares, counts, baseline = TRAILING_BASELINE, minCount = TRAILING_MIN_N) {
  return shares.map((share, index) => {
    if ((counts[index] || 0) < minCount || index < baseline) return null;
    const window = shares.slice(index - baseline, index);
    const mean = window.reduce((a, b) => a + b, 0) / baseline;
    const variance = window.reduce((a, b) => a + (b - mean) ** 2, 0) / baseline;
    const sd = Math.sqrt(variance);
    if (sd < 1e-12) return null;
    return (share - mean) / sd;
  });
}

/**
 * Weeks whose share sits above the previous eight publishing weeks.
 * Only outlets with observed weekly counts are scored.
 */
export function spikes(data, kind, lo, hi, { minN = TRAILING_MIN_N, minZ = 1.8 } = {}) {
  const out = [];
  const byId = seriesById(data);
  for (const src of data.sources) {
    if (!weeklyObserved(src)) continue;
    const cover = coveredWeeks(src, data.weeks);
    for (const s of src.series) {
      if (!byId[s.id] || (kind !== 'all' && byId[s.id].kind !== kind)) continue;
      const idx = [];
      const shares = [];
      const counts = [];
      for (let i = 0; i < data.weeks.length; i++) {
        const tot = src.weekly_articles[i] || 0;
        if (!(cover[i] && tot)) continue;
        idx.push(i);
        counts.push(s.weekly_n[i] || 0);
        shares.push((counts[counts.length - 1] / tot) * 100);
      }
      const zs = trailingZ(shares, counts, TRAILING_BASELINE, minN);
      zs.forEach((z, k) => {
        const i = idx[k];
        if (z == null || i < lo || i > hi || z < minZ) return;
        const window = shares.slice(k - TRAILING_BASELINE, k);
        const baseline = window.reduce((a, b) => a + b, 0) / TRAILING_BASELINE;
        out.push({ source: src, series: byId[s.id], week: data.weeks[i], i, n: counts[k], share: shares[k], baseline, z });
      });
    }
  }
  return out.sort((a, b) => b.z - a.z);
}

/** Highest trailing-z week for one outlet and frame, including scores under the spike cutoff. */
export function focusTrailing(data, sourceId, seriesId, lo, hi) {
  return spikes(data, 'all', lo, hi, { minZ: -Infinity }).find(s => s.source.id === sourceId && s.series.id === seriesId) || null;
}

/** Share in the last `recent` weeks vs the weeks before, pooled over observed weekly series. */
export function movers(data, kind, lo, hi, recent = 4) {
  const split = Math.max(lo + 1, hi - recent + 1);
  return visibleSeries(data, kind).map(se => {
    let nA = 0, tA = 0, nB = 0, tB = 0;
    const spark = [];
    for (let i = lo; i <= hi; i++) {
      let n = 0, t = 0;
      for (const src of data.sources) {
        if (!weeklyObserved(src)) continue;
        const cover = coveredWeeks(src, data.weeks);
        if (!cover[i]) continue;
        const tot = src.weekly_articles[i] || 0;
        if (!tot) continue;
        const s = src.series.find(x => x.id === se.id);
        n += s ? s.weekly_n[i] || 0 : 0;
        t += tot;
      }
      spark.push(t ? (n / t) * 100 : null);
      if (i < split) { nA += n; tA += t; } else { nB += n; tB += t; }
    }
    const before = tA ? (nA / tA) * 100 : 0;
    const after = tB ? (nB / tB) * 100 : 0;
    return { series: se, before, after, delta: after - before, spark, split: split - lo };
  }).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

export function kpis(data, kind, lo, hi) {
  const ids = new Set(visibleSeries(data, kind).map(s => s.id));
  const full = fullSpan(data.weeks, lo, hi);
  let articles = 0, hits = 0, active = 0;
  for (const src of data.sources) {
    if (!full && !weeklyObserved(src)) continue;
    let a = 0;
    let h = 0;
    if (full) {
      a = src.article_count || 0;
      for (const s of src.series) if (ids.has(s.id)) h += s.article_count || 0;
    } else {
      a = sum(src.weekly_articles, lo, hi);
      for (const s of src.series) if (ids.has(s.id)) h += sum(s.weekly_n, lo, hi);
    }
    articles += a;
    hits += h;
    if (a) active++;
  }
  const lags = data.edges
    .filter(e => !e.synthetic && e.from_source_id !== e.to_source_id && e.lag_hours != null)
    .map(e => Math.abs(e.lag_hours));
  const observedEdges = data.edges.filter(e => !e.synthetic).length;
  return {
    articles,
    hits,
    active,
    sources: data.sources.length,
    edges: data.edges.length,
    observedEdges,
    medianLag: median(lags),
    hitsPer100: articles ? (hits / articles) * 100 : 0,
    full,
  };
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
    const lags = l.edges.map(e => Math.abs(e.lag_hours));
    const byRel = {};
    for (const e of l.edges) byRel[e.relation] = (byRel[e.relation] || 0) + 1;
    return { ...l, count: l.edges.length, medianLag: median(lags), byRel };
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

/** Wilson score interval for a proportion, in percent. */
export function wilsonInterval(hits, total, z = 1.96) {
  if (!total || hits == null) return null;
  const n = total;
  const phat = Math.min(1, Math.max(0, hits / n));
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = (phat + z2 / (2 * n)) / denom;
  const margin = (z / denom) * Math.sqrt((phat * (1 - phat) + z2 / (4 * n)) / n);
  return {
    share: phat * 100,
    lo: Math.max(0, (center - margin) * 100),
    hi: Math.min(100, (center + margin) * 100),
    n: hits,
    total,
  };
}

export function forestRows(data, source, kind, lo, hi) {
  if (!source) return [];
  return visibleSeries(data, kind).map(se => {
    const c = cell(source, se.id, lo, hi, data.weeks);
    return { series: se, ...c, interval: c.total ? wilsonInterval(c.n, c.total) : null };
  });
}

/** Weekly volume and share for one frame. Unobserved outlets return the crawled total only. */
export function volumeShare(data, source, seriesId, lo, hi) {
  if (!source) return { observed: false, points: [], total: null };
  if (!weeklyObserved(source)) {
    return { observed: false, points: [], total: cell(source, seriesId, 0, data.weeks.length - 1, data.weeks) };
  }
  const s = source.series.find(x => x.id === seriesId);
  const cover = coveredWeeks(source, data.weeks);
  const points = [];
  for (let i = lo; i <= hi; i++) {
    const tot = source.weekly_articles[i] || 0;
    const n = s ? s.weekly_n[i] || 0 : 0;
    const known = cover[i] && tot > 0;
    points.push({ i, week: data.weeks[i], n, total: tot, share: known ? (n / tot) * 100 : null });
  }
  return { observed: true, points, total: null };
}

/** Stacked frame-hit counts. Shares are not stacked, because frames overlap. */
export function matchComposition(data, source, kind, lo, hi) {
  const series = visibleSeries(data, kind);
  if (!source) return { observed: false, series, weeks: [], totals: [] };
  if (!weeklyObserved(source)) {
    return {
      observed: false,
      series,
      weeks: [],
      totals: series.map(se => cell(source, se.id, 0, data.weeks.length - 1, data.weeks).n || 0),
      volume: source.article_count || 0,
    };
  }
  const weeks = [];
  for (let i = lo; i <= hi; i++) {
    const counts = series.map(se => {
      const row = source.series.find(x => x.id === se.id);
      return row ? row.weekly_n[i] || 0 : 0;
    });
    weeks.push({
      week: data.weeks[i],
      counts,
      volume: source.weekly_articles[i] || 0,
      hits: counts.reduce((a, b) => a + b, 0),
    });
  }
  return { observed: true, series, weeks, totals: [], volume: null };
}

function lagGroup(edges, synthetic) {
  const lags = edges
    .filter(e => !!e.synthetic === synthetic && e.from_source_id !== e.to_source_id && e.lag_hours != null)
    .map(e => Math.abs(e.lag_hours))
    .sort((a, b) => a - b);
  return {
    lags,
    points: lags.map((lag, i) => ({ lag, p: (i + 1) / lags.length })),
    median: median(lags),
    n: lags.length,
  };
}

export function lagEcdf(edges) {
  return { observed: lagGroup(edges, false), generated: lagGroup(edges, true) };
}

/** All-window shares by catalogue rank. Does not slice generated weeks. */
export function rankGradient(data, kind) {
  const series = visibleSeries(data, kind);
  const dots = [];
  for (const src of rankedSources(data)) {
    for (const se of series) {
      const row = src.series.find(x => x.id === se.id);
      const n = row ? row.article_count || 0 : 0;
      const total = src.article_count || 0;
      if (!total || !n) continue;
      const share = row && row.share_pct != null ? row.share_pct : (n / total) * 100;
      dots.push({
        source: src,
        series: se,
        n,
        total,
        share,
        rank: src.rank,
        rankLabel: src.rank_label || `Rank ${src.rank}`,
      });
    }
  }
  const ranks = [...new Set(dots.map(d => d.rank))].sort((a, b) => a - b);
  return { ranks, dots, series };
}
