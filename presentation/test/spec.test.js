import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSpec, validateSpec, encodeSpec, decodeSpec, blockParams } from '../src/report/spec.js';
import { metas } from './helpers.js';

const M = await metas();
const errors = spec => validateSpec(normalizeSpec(spec), M).filter(i => i.level === 'error').map(i => i.message);

test('normalize fills defaults and unique ids', () => {
  const s = normalizeSpec({ blocks: [{ viz: 'text' }, { id: 'b1', viz: 'text' }] });
  assert.equal(s.version, 1);
  assert.deepEqual(s.filters, { range: 'all', metric: 'share' });
  assert.notEqual(s.blocks[0].id, s.blocks[1].id);
});

test('a valid spec has no errors', () => {
  assert.deepEqual(errors({ blocks: [{ viz: 'kpi-row', x: 0, y: 0, w: 6, h: 1 }, { viz: 'heatmap', x: 0, y: 1, w: 6, h: 3 }] }), []);
});

test('validation names unknown viz, overlap, grid and size problems', () => {
  const e = errors({
    filters: { range: '7', metric: 'share' },
    blocks: [
      { id: 'a', viz: 'nope', x: 0, y: 0, w: 1, h: 1 },
      { id: 'b', viz: 'heatmap', x: 0, y: 1, w: 2, h: 2 },
      { id: 'c', viz: 'text', x: 1, y: 2, w: 2, h: 2 },
      { id: 'd', viz: 'text', x: 5, y: 7, w: 2, h: 1 },
    ],
  }).join('\n');
  for (const needle of ['filters.range', 'unknown viz "nope"', "outside heatmap's sizes", 'overlaps block "c"', 'leaves the 6×8 grid']) {
    assert.ok(e.includes(needle), `missing: ${needle}\n${e}`);
  }
});

test('specs survive the URL round trip, including non-Latin text', () => {
  const s = normalizeSpec({ title: 'Kiewer Regime · Москва „quote“', blocks: [{ viz: 'text', params: { md: 'ä ö ü ß' } }] });
  assert.deepEqual(decodeSpec(encodeSpec(s)), s);
});

test('block params fall back to viz defaults, functions included', () => {
  const p = blockParams(M.timeline, { params: {} }, { sources: [{ id: 'x', weekly_observed: true, series: [] }], series: [{ id: 's' }], weeks: [] }, { range: 'all', metric: 'count' });
  assert.equal(p.metric, 'count');
  assert.equal(p.source, 'x');
});
