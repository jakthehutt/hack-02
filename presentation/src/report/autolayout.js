// Pack suggestions onto the 6 × 8 grid in story order. Pure and deterministic:
// the same bundle always gives the same page.
import { COLS, ROWS, overlaps, insideGrid, firstFree } from './grid.js';
import { presets, sizeLimits, fitsLimits, nextBlockId } from './spec.js';

export const STORY = ['headline', 'trend', 'compare', 'flow', 'evidence', 'words'];

const area = z => z.w * z.h;

/** Sizes a block may take, largest first, never larger than the one suggested. */
function sizesFor(s, meta) {
  const list = [s.size, ...presets(meta), sizeLimits(meta).min]
    .filter(z => fitsLimits(meta, z) && area(z) <= area(s.size))
    .sort((a, b) => area(b) - area(a) || b.w - a.w);
  const seen = new Set();
  return list.filter(z => { const k = `${z.w}x${z.h}`; if (seen.has(k)) return false; seen.add(k); return true; });
}

/** Pick one block per job in story order, then the best of the rest, avoiding repeats of one viz. */
function choose(suggestions, maxBlocks, perJob) {
  const chosen = [];
  const jobs = {};
  for (const job of STORY) {
    const s = suggestions.find(x => x.job === job);
    if (s) { chosen.push(s); jobs[job] = 1; }
  }
  const rest = suggestions
    .filter(s => !chosen.includes(s))
    .map(s => ({ s, score: s.score * (chosen.some(c => c.viz === s.viz) ? 0.6 : 1) }))
    .sort((a, b) => b.score - a.score);
  for (const { s } of rest) {
    if (chosen.length >= maxBlocks) break;
    if ((jobs[s.job] || 0) >= perJob) continue;
    chosen.push(s);
    jobs[s.job] = (jobs[s.job] || 0) + 1;
  }
  return chosen;
}

/**
 * Shrink the least important blocks (never the headline) until the page can hold
 * them all, dropping the least important when nothing can shrink any more.
 */
function budget(items, cells) {
  const total = () => items.reduce((a, it) => a + area(it.size), 0);
  while (total() > cells && items.length) {
    const shrinkable = items
      .filter(it => it.s.job !== 'headline' && it.sizes.some(z => area(z) < area(it.size)))
      .sort((a, b) => a.s.score - b.s.score);
    if (shrinkable.length) {
      const it = shrinkable[0];
      it.size = it.sizes.find(z => area(z) < area(it.size));
    } else {
      const drop = [...items].filter(it => it.s.job !== 'headline').sort((a, b) => a.s.score - b.s.score)[0] || items[items.length - 1];
      items.splice(items.indexOf(drop), 1);
    }
  }
  return items;
}

/**
 * @param suggestions ranked output of recommend()
 * @param metas registry metas
 * @param opts.maxBlocks most blocks on the page before gaps are filled
 * @param opts.perJob how many blocks of one job at most
 */
export function autolayout(suggestions, metas, { maxBlocks = 6, perJob = 2 } = {}) {
  const items = choose(suggestions, maxBlocks, perJob)
    .filter(s => metas[s.viz])
    .map(s => ({ s, sizes: sizesFor(s, metas[s.viz]), size: s.size }));
  budget(items, COLS * ROWS);
  items.sort((a, b) => STORY.indexOf(a.s.job) - STORY.indexOf(b.s.job) || b.s.score - a.s.score);

  const blocks = [];
  for (const it of items) {
    for (const z of it.sizes.filter(z => area(z) <= area(it.size))) {
      const slot = firstFree(blocks, z.w, z.h);
      if (slot) {
        blocks.push({ id: nextBlockId(blocks), viz: it.s.viz, ...slot, params: { ...it.s.params } });
        break;
      }
    }
  }
  fillHoles(blocks, metas);
  grow(blocks, metas);
  return blocks;
}

/** Let blocks take empty cells to their right and below, within their max size. */
export function grow(blocks, metas, all = blocks) {
  let changed = true;
  while (changed) {
    changed = false;
    for (const b of blocks) {
      const { max } = sizeLimits(metas[b.viz]);
      for (const cand of [{ ...b, h: b.h + 1 }, { ...b, w: b.w + 1 }]) {
        if (cand.w > max.w || cand.h > max.h || !insideGrid(cand)) continue;
        if (all.some(o => o !== b && overlaps(o, cand))) continue;
        Object.assign(b, cand);
        changed = true;
        break;
      }
    }
  }
  return blocks;
}

/** Fill what is still empty: key findings where 2×2 fits, single numbers in smaller gaps. */
export function fillHoles(blocks, metas) {
  const fillers = [
    { viz: 'key-findings', params: () => ({}) },
    { viz: 'kpi', params: k => ({ item: ['articles', 'per100', 'hits', 'delay'][k % 4] }) },
  ];
  let k = 0;
  for (const f of fillers) {
    const meta = metas[f.viz];
    if (!meta) continue;
    const { min } = sizeLimits(meta);
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const slot = { x, y, w: min.w, h: min.h };
        if (!insideGrid(slot) || blocks.some(o => overlaps(o, slot))) continue;
        if (f.viz === 'key-findings' && blocks.some(b => b.viz === 'key-findings')) continue;
        const b = { id: nextBlockId(blocks), viz: f.viz, ...slot, params: f.params(k++) };
        blocks.push(b);
        grow([b], metas, blocks);
      }
    }
  }
  return blocks;
}
