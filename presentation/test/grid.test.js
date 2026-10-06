import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PAGE, BODY, CELL, COLS, ROWS, GUTTER, MARGIN, HEADER, FOOTER, BAND_GAP, cellBox, contentBox, firstFree, overlaps, insideGrid } from '../src/report/grid.js';

const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≠ ${b}`);

test('the bands and the body fill the A4 page exactly', () => {
  close(MARGIN + HEADER + BAND_GAP + BODY.h + BAND_GAP + FOOTER + MARGIN, PAGE.h);
  close(2 * MARGIN + BODY.w, PAGE.w);
});

test('cells and gutters fill the body', () => {
  close(COLS * CELL.w + (COLS - 1) * GUTTER, BODY.w);
  close(ROWS * CELL.h + (ROWS - 1) * GUTTER, BODY.h);
  const full = cellBox({ x: 0, y: 0, w: COLS, h: ROWS });
  close(full.w, BODY.w);
  close(full.h, BODY.h);
});

test('a 2×2 block is about 59 × 58 mm', () => {
  const b = cellBox({ x: 0, y: 0, w: 2, h: 2 });
  assert.ok(Math.abs(b.w - 59.3) < 0.1 && Math.abs(b.h - 58.3) < 0.1, JSON.stringify(b));
});

test('content box subtracts padding, title and caption', () => {
  const plain = contentBox({ x: 0, y: 0, w: 3, h: 3 }, { title: false });
  const framed = contentBox({ x: 0, y: 0, w: 3, h: 3 }, { title: true, caption: true });
  close(plain.hMm - framed.hMm, 9);
  close(plain.wMm, framed.wMm);
  assert.equal(typeof framed.density, 'string');
});

test('overlap, grid bounds and first free slot', () => {
  assert.ok(overlaps({ x: 0, y: 0, w: 2, h: 2 }, { x: 1, y: 1, w: 2, h: 2 }));
  assert.ok(!overlaps({ x: 0, y: 0, w: 2, h: 2 }, { x: 2, y: 0, w: 2, h: 2 }));
  assert.ok(insideGrid({ x: 0, y: 7, w: 6, h: 1 }));
  assert.ok(!insideGrid({ x: 1, y: 0, w: 6, h: 1 }));
  assert.deepEqual(firstFree([{ x: 0, y: 0, w: 6, h: 1 }], 3, 2), { x: 0, y: 1, w: 3, h: 2 });
  assert.equal(firstFree([{ x: 0, y: 0, w: 6, h: 8 }], 1, 1), null);
});
