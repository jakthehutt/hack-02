// Rank what to show for a bundle: every registered viz whose data requirements hold
// proposes blocks with a reason; the best come first, at most a few per job.
import { detectInsights } from './insights.js';
import { parseSize } from './grid.js';
import { fitsLimits, presets } from './spec.js';

/**
 * @returns {{ insights, suggestions: [{key, viz, job, title, params, size:{w,h}, score, reason}], unavailable: [{viz, reason}] }}
 */
export function recommend(bundle, filters, metas, { perJob = 3 } = {}) {
  const insights = detectInsights(bundle, filters);
  const raw = [];
  const unavailable = [];
  for (const meta of Object.values(metas)) {
    const ok = meta.requires ? meta.requires(bundle) : true;
    if (ok !== true) {
      unavailable.push({ viz: meta.id, reason: typeof ok === 'string' ? ok : 'not enough data' });
      continue;
    }
    for (const s of meta.suggest?.(bundle, insights, filters) || []) {
      let size = typeof s.size === 'string' ? parseSize(s.size) : s.size;
      if (!size || !fitsLimits(meta, size)) size = presets(meta)[0] || meta.sizes.min;
      const params = s.params || {};
      raw.push({
        key: `${meta.id}:${JSON.stringify(params)}`,
        viz: meta.id,
        job: meta.job,
        title: meta.defaultTitle ? meta.defaultTitle({ ...defaults(meta, bundle, filters), ...params }, bundle, filters) : meta.title,
        params,
        size,
        score: s.score ?? 0.3,
        reason: s.reason || meta.description,
      });
    }
  }
  const seen = new Set();
  const perJobCount = {};
  const suggestions = [];
  for (const s of raw.sort((a, b) => b.score - a.score)) {
    if (seen.has(s.key)) continue;
    seen.add(s.key);
    perJobCount[s.job] = (perJobCount[s.job] || 0) + 1;
    if (perJobCount[s.job] > perJob) continue;
    suggestions.push(s);
  }
  return { insights, suggestions, unavailable };
}

function defaults(meta, bundle, filters) {
  const out = {};
  for (const [k, def] of Object.entries(meta.params || {})) out[k] = typeof def.default === 'function' ? def.default(bundle, filters) : def.default;
  return out;
}
