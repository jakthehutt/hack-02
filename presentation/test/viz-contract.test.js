// Every visualization keeps the contract the studio, the recommender and the agent rely on.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { VIZ_DIR, vizIds, metas, bundle } from './helpers.js';
import { detectInsights } from '../src/report/insights.js';
import { presets, sizeLimits, fitsLimits } from '../src/report/spec.js';
import { parseSize, COLS, ROWS } from '../src/report/grid.js';

const JOBS = ['headline', 'trend', 'compare', 'flow', 'evidence', 'words'];
const TYPES = ['enum', 'multi', 'int', 'bool', 'text', 'series', 'source'];
const M = await metas();
const B = bundle();
const filters = { range: 'all', metric: 'share' };
const insights = detectInsights(B, filters);

for (const id of vizIds()) {
  test(`${id}: meta and view follow the contract`, () => {
    const meta = M[id];
    assert.ok(existsSync(path.join(VIZ_DIR, id, 'View.jsx')), 'has View.jsx');
    assert.equal(meta.id, id, 'id matches the folder');
    assert.ok(meta.title && meta.description, 'title and description');
    assert.ok(JOBS.includes(meta.job), `job is one of ${JOBS}`);
    const { min, max } = sizeLimits(meta);
    assert.ok(min.w >= 1 && min.h >= 1 && max.w <= COLS && max.h <= ROWS && min.w <= max.w && min.h <= max.h, 'sizes inside the grid');
    assert.ok(presets(meta).length === (meta.sizes.presets || []).length, 'every preset is within min/max');
    for (const [k, p] of Object.entries(meta.params || {})) {
      assert.ok(TYPES.includes(p.type), `param ${k} has a known type`);
      assert.ok(p.label, `param ${k} has a label`);
    }
    const ok = meta.requires(B);
    assert.ok(ok === true || typeof ok === 'string' || ok === false, 'requires returns true or a reason');
    for (const s of meta.suggest(B, insights, filters)) {
      assert.ok(fitsLimits(meta, typeof s.size === 'string' ? parseSize(s.size) : s.size), `suggested size ${s.size} fits`);
      assert.ok(s.reason && typeof s.score === 'number', 'suggestion has a reason and a score');
      for (const k of Object.keys(s.params || {})) assert.ok(k in (meta.params || {}), `suggested param ${k} is declared`);
    }
  });

  test(`${id}: meta.js stays plain (no JSX, CSS or bundle imports)`, () => {
    const src = readFileSync(path.join(VIZ_DIR, id, 'meta.js'), 'utf8');
    const imports = [...src.matchAll(/import\s[^'"]*['"]([^'"]+)['"]/g)].map(m => m[1]);
    for (const imp of imports) assert.ok(!/\.jsx$|\.css|@bundle|^react/.test(imp), `meta.js imports ${imp}`);
  });
}

test('pure report modules never import JSX, CSS or the bundle', () => {
  for (const f of ['grid.js', 'spec.js', 'insights.js', 'recommend.js', 'autolayout.js', 'lib.js', 'palette.js']) {
    const src = readFileSync(path.join(VIZ_DIR, '..', f), 'utf8');
    const imports = [...src.matchAll(/import\s[^'"]*['"]([^'"]+)['"]/g)].map(m => m[1]);
    for (const imp of imports) assert.ok(!/\.jsx$|\.css|@bundle|^react/.test(imp), `${f} imports ${imp}`);
  }
});
