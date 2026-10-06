// The fit check: after the sheet has drawn (fonts loaded), find anything that
// doesn't fit its block. The sheet itself can never spill onto a second page;
// this says whether something was cut off to make that true.
import { PX_PER_MM } from './grid.js';

const MIN_PT = 6.5;
const PX_PER_PT = 96 / 72;

const round = v => Math.round(v * 10) / 10;

export function measureFit(sheet) {
  const scale = sheet.getBoundingClientRect().width / (210 * PX_PER_MM); // studio zoom, 1 elsewhere
  const blocks = [];
  for (const el of sheet.querySelectorAll('.fs-blk')) {
    const issues = [];
    const labelOverlaps = [];
    const body = el.querySelector('.fs-blk-body');
    const failed = el.querySelector('[data-render-error]');
    if (failed) issues.push({ kind: 'error', message: failed.dataset.renderError });

    // HTML content taller or wider than the box (layout px, not affected by zoom).
    const dy = body.scrollHeight - body.clientHeight;
    const dx = body.scrollWidth - body.clientWidth;
    if (dy > 1) issues.push({ kind: 'overflow', axis: 'y', mm: round(dy / PX_PER_MM) });
    if (dx > 1) issues.push({ kind: 'overflow', axis: 'x', mm: round(dx / PX_PER_MM) });

    // SVG text that runs past its drawing (SVGs clip it silently).
    const tol = 0.5 * PX_PER_PT * scale;
    for (const svg of body.querySelectorAll('svg')) {
      const r = svg.getBoundingClientRect();
      for (const t of svg.querySelectorAll('text')) {
        const b = t.getBoundingClientRect();
        if (!b.width) continue;
        const over = Math.max(r.left - b.left, b.right - r.right, r.top - b.top, b.bottom - r.bottom);
        if (over > tol) issues.push({ kind: 'text-clipped', text: t.textContent.slice(0, 48), mm: round(over / scale / PX_PER_MM) });
        const size = parseFloat(t.getAttribute('font-size') || getComputedStyle(t).fontSize);
        if (size < MIN_PT - 0.01) issues.push({ kind: 'tiny-text', text: t.textContent.slice(0, 48), pt: size });
      }
    }
    // Labels drawn on top of each other (a warning: the renderer can't know intent).
    for (const svg of body.querySelectorAll('svg')) {
      const boxes = [...svg.querySelectorAll('text')].map(t => ({ t, r: t.getBoundingClientRect() })).filter(b => b.r.width && b.r.height);
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i].r;
          const b = boxes[j].r;
          const ix = Math.min(a.right, b.right) - Math.max(a.left, b.left);
          const iy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          if (ix <= 0 || iy <= 0) continue;
          const small = Math.min(a.width * a.height, b.width * b.height);
          // Glyph boxes include line gap, so only count real overlaps of the inked area.
          if (ix * iy > 0.25 * small && iy > 0.45 * Math.min(a.height, b.height)) {
            labelOverlaps.push({ kind: 'label-overlap', text: `"${boxes[i].t.textContent.slice(0, 30)}" × "${boxes[j].t.textContent.slice(0, 30)}"` });
          }
        }
      }
    }

    // HTML text below the floor.
    for (const node of body.querySelectorAll('*:not(svg *)')) {
      if (!node.childNodes.length || ![...node.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
      const px = parseFloat(getComputedStyle(node).fontSize);
      if (px / PX_PER_PT < MIN_PT - 0.01) issues.push({ kind: 'tiny-text', text: node.textContent.slice(0, 48), pt: round(px / PX_PER_PT) });
    }

    const title = el.querySelector('.fs-blk-title > span');
    const warnings = labelOverlaps.slice(0, 5);
    if (title && title.scrollWidth > title.clientWidth + 1) warnings.push({ kind: 'title-truncated', text: title.textContent });
    const cap = el.querySelector('.fs-blk-cap');
    if (cap && cap.scrollWidth > cap.clientWidth + 1) warnings.push({ kind: 'caption-truncated', text: cap.textContent });

    blocks.push({ id: el.dataset.blockId, viz: el.dataset.viz, ok: issues.length === 0, issues, warnings });
  }
  const pageWarnings = [];
  for (const [sel, kind] of [['.fs-title', 'title-truncated'], ['.fs-subtitle', 'subtitle-truncated'], ['.fs-foot-prov', 'provenance-truncated']]) {
    const el = sheet.querySelector(sel);
    if (el && el.scrollWidth > el.clientWidth + 1) pageWarnings.push({ kind, text: el.textContent });
  }
  return { ok: blocks.every(b => b.ok), blocks, warnings: pageWarnings };
}

/** Mark blocks that failed the check, so a screenshot can outline them. */
export function markClipped(sheet, report) {
  const bad = new Set(report.blocks.filter(b => !b.ok).map(b => b.id));
  for (const el of sheet.querySelectorAll('.fs-blk')) {
    if (bad.has(el.dataset.blockId)) el.setAttribute('data-clipped', '');
    else el.removeAttribute('data-clipped');
  }
}
