import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reducer, initialState } from '../src/studio/state.js';
import { moved, resized, nearestFree, collides, cellAt, cellsFromPx, placeNew } from '../src/studio/dnd.js';
import { PX_PER_MM, BODY, CELL, GUTTER } from '../src/report/grid.js';

const meta = { sizes: { min: { w: 2, h: 2 }, max: { w: 4, h: 4 } } };

test('undo and redo walk the history; selecting is not a step', () => {
  let s = initialState({ blocks: [] });
  s = reducer(s, { type: 'add', block: { viz: 'text', x: 0, y: 0, w: 2, h: 2 } });
  s = reducer(s, { type: 'select', id: null });
  s = reducer(s, { type: 'update', id: s.spec.blocks[0].id, patch: { x: 2 } });
  assert.equal(s.spec.blocks[0].x, 2);
  s = reducer(s, { type: 'undo' });
  assert.equal(s.spec.blocks[0].x, 0);
  s = reducer(s, { type: 'undo' });
  assert.equal(s.spec.blocks.length, 0);
  s = reducer(s, { type: 'redo' });
  assert.equal(s.spec.blocks.length, 1);
});

test('moves and resizes stay on the grid and inside the viz limits', () => {
  const b = { id: 'a', x: 4, y: 6, w: 2, h: 2 };
  assert.deepEqual(moved(b, 5, 5), { ...b, x: 4, y: 6 });
  assert.deepEqual(moved(b, -9, -1), { ...b, x: 0, y: 5 });
  assert.deepEqual(resized({ ...b, x: 0, y: 0 }, 9, 9, meta), { ...b, x: 0, y: 0, w: 4, h: 4 });
  assert.deepEqual(resized(b, -5, -5, meta), b);
});

test('collisions and the nearest free spot', () => {
  const blocks = [{ id: 'a', x: 0, y: 0, w: 6, h: 2 }];
  assert.ok(collides(blocks, { x: 1, y: 1, w: 2, h: 2 }));
  assert.ok(!collides(blocks, { x: 0, y: 0, w: 2, h: 2 }, 'a'));
  assert.deepEqual(nearestFree(blocks, { x: 1, y: 1, w: 2, h: 2 }), { x: 1, y: 2, w: 2, h: 2 });
  assert.equal(nearestFree([{ id: 'f', x: 0, y: 0, w: 6, h: 8 }], { x: 0, y: 0, w: 1, h: 1 }), null);
  assert.deepEqual(placeNew([{ id: 'f', x: 0, y: 0, w: 6, h: 7 }], meta, [{ w: 3, h: 3 }, { w: 3, h: 1 }]), { x: 0, y: 7, w: 3, h: 1 });
});

test('screen pixels map to cells at any zoom', () => {
  for (const zoom of [0.5, 1, 1.7]) {
    const px = (BODY.x + 2 * (CELL.w + GUTTER) + 1) * PX_PER_MM * zoom;
    const py = (BODY.y + 3 * (CELL.h + GUTTER) + 1) * PX_PER_MM * zoom;
    assert.deepEqual(cellAt(px, py, zoom), { x: 2, y: 3, inside: true });
    assert.deepEqual(cellsFromPx((CELL.w + GUTTER) * PX_PER_MM * zoom * 2.4, 0, zoom), { dx: 2, dy: 0 });
  }
  assert.equal(cellAt(1, 1, 1).inside, false);
});
