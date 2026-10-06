// Grid maths for dragging and resizing blocks on the sheet. Pure: pointer offsets
// in screen pixels go in, grid rectangles come out.
import { COLS, ROWS, CELL, GUTTER, BODY, PX_PER_MM, overlaps, insideGrid } from '../report/grid.js';
import { sizeLimits } from '../report/spec.js';

const pitch = { x: (CELL.w + GUTTER) * PX_PER_MM, y: (CELL.h + GUTTER) * PX_PER_MM };
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** Screen offset (px at this zoom) → whole cells. */
export const cellsFromPx = (dx, dy, zoom) => ({ dx: Math.round(dx / (pitch.x * zoom)), dy: Math.round(dy / (pitch.y * zoom)) });

/** The grid cell under a point given relative to the sheet's top-left corner, in screen px. */
export function cellAt(px, py, zoom) {
  const x = (px / zoom / PX_PER_MM - BODY.x) / (CELL.w + GUTTER);
  const y = (py / zoom / PX_PER_MM - BODY.y) / (CELL.h + GUTTER);
  return { x: Math.floor(x), y: Math.floor(y), inside: x >= 0 && y >= 0 && x < COLS && y < ROWS };
}

export function moved(block, dx, dy) {
  return { ...block, x: clamp(block.x + dx, 0, COLS - block.w), y: clamp(block.y + dy, 0, ROWS - block.h) };
}

export function resized(block, dw, dh, meta) {
  const { min, max } = sizeLimits(meta);
  const w = clamp(block.w + dw, min.w, Math.min(max.w, COLS - block.x));
  const h = clamp(block.h + dh, min.h, Math.min(max.h, ROWS - block.y));
  return { ...block, w, h };
}

export const collides = (blocks, cand, ignoreId) => blocks.some(b => b.id !== ignoreId && overlaps(b, cand));

/** Nearest free position for a w×h block to a wanted spot, or null if the page is full. */
export function nearestFree(blocks, cand, ignoreId) {
  let best = null;
  for (let y = 0; y + cand.h <= ROWS; y++) {
    for (let x = 0; x + cand.w <= COLS; x++) {
      const c = { ...cand, x, y };
      if (!insideGrid(c) || collides(blocks, c, ignoreId)) continue;
      const d = Math.abs(x - cand.x) + Math.abs(y - cand.y) * 1.2;
      if (!best || d < best.d) best = { c, d };
    }
  }
  return best?.c ?? null;
}

/** Where a block of `meta` can go: the wanted size near `at`, then its smaller presets. */
export function placeNew(blocks, meta, sizes, at = { x: 0, y: 0 }) {
  for (const z of sizes) {
    const spot = nearestFree(blocks, { x: at.x, y: at.y, w: z.w, h: z.h });
    if (spot) return spot;
  }
  return null;
}
