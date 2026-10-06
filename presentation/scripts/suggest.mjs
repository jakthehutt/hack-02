// What the data shows and what to put on a page, ranked, with reasons.
//
//   npm run suggest                      readable table
//   npm run suggest -- --json            for agents: insights, suggestions, unavailable
//   npm run suggest -- --range 4 --metric count --bundle ../bundles/2026-10-06.json
import { parseArgs } from 'node:util';
import { bundlePath, readJson, loadReportModules } from './lib/render-core.mjs';

const { values: opt } = parseArgs({
  options: {
    json: { type: 'boolean' },
    bundle: { type: 'string' },
    range: { type: 'string', default: 'all' },
    metric: { type: 'string', default: 'share' },
  },
});

const bundle = readJson(bundlePath(opt.bundle));
const m = await loadReportModules();
const filters = { range: opt.range, metric: opt.metric };
const { insights, suggestions, unavailable } = m.recommend(bundle, filters, m.METAS, { perJob: 4 });

if (opt.json) {
  console.log(JSON.stringify({
    bundle: bundle.meta?.bundle_id,
    filters,
    insights,
    suggestions: suggestions.map(s => ({ ...s, size: `${s.size.w}x${s.size.h}` })),
    unavailable,
    vizzes: Object.values(m.METAS).map(v => ({ id: v.id, job: v.job, title: v.title, description: v.description, sizes: v.sizes, params: Object.fromEntries(Object.entries(v.params || {}).map(([k, p]) => [k, { type: p.type, label: p.label, ...(p.options ? { options: p.options.map(o => o.value) } : {}) }])) })),
  }, null, 2));
} else {
  console.log(`Bundle ${bundle.meta?.bundle_id} · range ${filters.range} · ${filters.metric}\n`);
  console.log('What stands out');
  for (const i of insights) console.log(`  ${i.salience.toFixed(2)}  ${i.kind.padEnd(10)} ${m.plain(i.sentence)}`);
  console.log('\nSuggested blocks (viz · size · params)');
  for (const s of suggestions) {
    const params = Object.keys(s.params).length ? ` ${JSON.stringify(s.params)}` : '';
    console.log(`  ${s.score.toFixed(2)}  ${s.viz} ${s.size.w}×${s.size.h}${params}\n        ${s.reason}`);
  }
  if (unavailable.length) {
    console.log('\nNot available for this bundle');
    for (const u of unavailable) console.log(`  ${u.viz}: ${u.reason}`);
  }
}
