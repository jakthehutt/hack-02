import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectInsights, plain } from '../src/report/insights.js';
import { recommend } from '../src/report/recommend.js';
import { spikes, rangeBounds } from '../src/data/derive.js';
import { bundle, metas } from './helpers.js';

const B = bundle();

test('findings are sorted, deterministic and carry their numbers', () => {
  const a = detectInsights(B, { range: 'all' });
  assert.deepEqual(detectInsights(B, { range: 'all' }), a);
  a.slice(1).forEach((x, i) => assert.ok(a[i].salience >= x.salience));
  for (const i of a) assert.match(plain(i.sentence), /\d/, `${i.kind} has a number`);
});

test('the top spike is the one derive.spikes ranks first', () => {
  const [lo, hi] = rangeBounds(B.weeks, 'all');
  const top = spikes(B, 'all', lo, hi)[0];
  const found = detectInsights(B, { range: 'all' }).find(i => i.kind === 'spike');
  assert.equal(found.series, top.series.id);
  assert.equal(found.source, top.source.id);
});

test('provenance always reports what is estimated', () => {
  const p = detectInsights(B, {}).find(i => i.kind === 'provenance');
  assert.equal(p.realEdges, B.edges.filter(e => !e.synthetic).length);
  assert.equal(p.observedSources, B.sources.filter(s => s.weekly_observed).length);
});

test('a viz whose data requirement fails is listed as unavailable, not suggested', async () => {
  const M = await metas();
  const noWeeks = { ...B, sources: B.sources.map(s => ({ ...s, weekly_observed: false })) };
  const r = recommend(noWeeks, { range: 'all', metric: 'share' }, M);
  assert.ok(r.unavailable.some(u => u.viz === 'timeline'));
  assert.ok(!r.suggestions.some(s => s.viz === 'timeline'));
});
