// The A4 sheet in millimetres. Everything on the sheet is placed from these numbers,
// so a report is the same size on screen, in the PDF and on paper.

export const PAGE = { w: 210, h: 297 };
export const MARGIN = 12;
export const HEADER = 16;
export const FOOTER = 6;
export const BAND_GAP = 3;
export const COLS = 6;
export const ROWS = 8;
export const GUTTER = 4;

export const BODY = {
  x: MARGIN,
  y: MARGIN + HEADER + BAND_GAP,
  w: PAGE.w - 2 * MARGIN,
  h: PAGE.h - 2 * MARGIN - HEADER - FOOTER - 2 * BAND_GAP,
};
export const CELL = {
  w: (BODY.w - (COLS - 1) * GUTTER) / COLS,
  h: (BODY.h - (ROWS - 1) * GUTTER) / ROWS,
};

// Block frame: padding inside the border, a fixed title row and an optional caption row,
// so the box a visualization draws into is known before anything renders.
export const FRAME = { pad: 2.4, title: 5, caption: 4 };

export const PT_PER_MM = 72 / 25.4;
export const PX_PER_MM = 96 / 25.4;
export const mmToPt = mm => mm * PT_PER_MM;
export const ptToMm = pt => pt / PT_PER_MM;

/** Block position and size in mm, relative to the body grid. */
export function cellBox({ x, y, w, h }) {
  return {
    x: x * (CELL.w + GUTTER),
    y: y * (CELL.h + GUTTER),
    w: w * CELL.w + (w - 1) * GUTTER,
    h: h * CELL.h + (h - 1) * GUTTER,
  };
}

/** The box a visualization gets inside its frame, in mm and pt. */
export function contentBox(block, { title = true, caption = false } = {}) {
  const b = cellBox(block);
  const wMm = b.w - 2 * FRAME.pad;
  const hMm = b.h - 2 * FRAME.pad - (title ? FRAME.title : 0) - (caption ? FRAME.caption : 0);
  return { wMm, hMm, wPt: mmToPt(wMm), hPt: mmToPt(hMm), density: density(wMm, hMm) };
}

/** Coarse size class, so a view can decide how much to show. */
export function density(wMm, hMm) {
  const short = Math.min(wMm, hMm);
  if (short < 22) return 'xs';
  if (short < 45) return 's';
  if (short < 80) return 'm';
  return 'l';
}

export const sizeKey = ({ w, h }) => `${w}x${h}`;
export const parseSize = key => {
  const [w, h] = String(key).split('x').map(Number);
  return { w, h };
};

/** Every grid cell a block covers. */
export function cellsOf({ x, y, w, h }) {
  const out = [];
  for (let r = y; r < y + h; r++) for (let c = x; c < x + w; c++) out.push(r * COLS + c);
  return out;
}

export const insideGrid = ({ x, y, w, h }) => x >= 0 && y >= 0 && w >= 1 && h >= 1 && x + w <= COLS && y + h <= ROWS;

export function overlaps(a, b) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** First top-left slot where a w×h block fits among `blocks`, or null. */
export function firstFree(blocks, w, h) {
  for (let y = 0; y + h <= ROWS; y++) {
    for (let x = 0; x + w <= COLS; x++) {
      const cand = { x, y, w, h };
      if (!blocks.some(b => overlaps(b, cand))) return cand;
    }
  }
  return null;
}
