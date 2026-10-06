import { test } from 'node:test';
import assert from 'node:assert/strict';
import { autolayout } from '../src/report/autolayout.js';
import { recommend } from '../src/report/recommend.js';
import { overlaps, insideGrid, COLS, ROWS } from '../src/report/grid.js';
import { fitsLimits } from '../src/report/spec.js';
import { bundle, metas } from './helpers.js';

const M = await metas();
const B = bundle();

for (const range of ['all', '12', '4']) {
  test(`auto layout (${range} weeks) is valid, full and deterministic`, () => {
    const { suggestions } = recommend(B, { range, metric: 'share' }, M);
    const blocks = autolayout(suggestions, M);
    assert.ok(blocks.length >= 3, 'at least three blocks');
    blocks.forEach((b, i) => {
      assert.ok(insideGrid(b), `${b.id} inside grid`);
      assert.ok(fitsLimits(M[b.viz], b), `${b.id} ${b.viz} ${b.w}x${b.h} within its sizes`);
      blocks.slice(i + 1).forEach(o => assert.ok(!overlaps(b, o), `${b.id} overlaps ${o.id}`));
    });
    const used = blocks.reduce((a, b) => a + b.w * b.h, 0);
    assert.ok(used >= COLS * ROWS - 2, `page is filled (${used} of ${COLS * ROWS} cells)`);
    assert.equal(blocks.find(b => b.y === 0 && b.x === 0)?.viz, 'kpi-row', 'headline numbers lead');
    assert.deepEqual(autolayout(recommend(B, { range, metric: 'share' }, M).suggestions, M), blocks);
  });
}

test('one block per job before any repeats', () => {
  const { suggestions } = recommend(B, { range: 'all', metric: 'share' }, M);
  const blocks = autolayout(suggestions, M);
  const vizzes = blocks.map(b => b.viz);
  assert.ok(new Set(vizzes.filter(v => v !== 'kpi')).size >= 4, vizzes.join(', '));
});
