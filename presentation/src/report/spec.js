// A report is data: this JSON spec is what the studio edits, the agent writes and the
// renderer draws. Pure; `metas` is the registry's { [vizId]: meta } map.
import { COLS, ROWS, insideGrid, overlaps, parseSize } from './grid.js';

export const SPEC_VERSION = 1;
export const RANGES = ['all', '12', '4'];
export const METRICS = ['share', 'count'];

const DEFAULTS = {
  version: SPEC_VERSION,
  page: { paper: 'tinted' },
  title: 'Foreshock report',
  subtitle: '',
  filters: { range: 'all', metric: 'share' },
  blocks: [],
};

/** Fill defaults and drop unknown top-level keys, without judging the content. */
export function normalizeSpec(raw = {}) {
  const spec = {
    ...DEFAULTS,
    ...raw,
    page: { ...DEFAULTS.page, ...(raw.page || {}) },
    filters: { ...DEFAULTS.filters, ...(raw.filters || {}) },
  };
  const seen = new Set();
  spec.blocks = (raw.blocks || []).map((b, i) => {
    let id = String(b.id ?? `b${i + 1}`);
    while (seen.has(id)) id += '_';
    seen.add(id);
    return { id, viz: b.viz, x: b.x | 0, y: b.y | 0, w: b.w | 0 || 1, h: b.h | 0 || 1, params: { ...(b.params || {}) },
      ...(b.title !== undefined ? { title: b.title } : {}), ...(b.caption ? { caption: b.caption } : {}) };
  });
  return spec;
}

/** Size limits a viz allows, as {min:{w,h}, max:{w,h}}. */
export function sizeLimits(meta) {
  const s = meta?.sizes || {};
  return { min: s.min || { w: 1, h: 1 }, max: s.max || { w: COLS, h: ROWS } };
}

export function fitsLimits(meta, { w, h }) {
  const { min, max } = sizeLimits(meta);
  return w >= min.w && h >= min.h && w <= max.w && h <= max.h;
}

/** Presets as {w,h}, filtered to what the viz allows. */
export function presets(meta) {
  return (meta?.sizes?.presets || []).map(parseSize).filter(s => fitsLimits(meta, s));
}

/** Problems with a spec: [{level: 'error' | 'warning', block?, message}]. */
export function validateSpec(spec, metas) {
  const issues = [];
  const err = (message, block) => issues.push({ level: 'error', ...(block ? { block } : {}), message });
  if (spec.version !== SPEC_VERSION) err(`version must be ${SPEC_VERSION}`);
  if (!RANGES.includes(spec.filters.range)) err(`filters.range must be one of ${RANGES.join(', ')}`);
  if (!METRICS.includes(spec.filters.metric)) err(`filters.metric must be one of ${METRICS.join(', ')}`);
  spec.blocks.forEach((b, i) => {
    const meta = metas[b.viz];
    if (!meta) { err(`unknown viz "${b.viz}" (known: ${Object.keys(metas).sort().join(', ')})`, b.id); return; }
    if (!insideGrid(b)) err(`x=${b.x} y=${b.y} w=${b.w} h=${b.h} leaves the ${COLS}×${ROWS} grid`, b.id);
    if (!fitsLimits(meta, b)) {
      const { min, max } = sizeLimits(meta);
      err(`${b.w}×${b.h} is outside ${b.viz}'s sizes (min ${min.w}×${min.h}, max ${max.w}×${max.h})`, b.id);
    }
    for (const other of spec.blocks.slice(i + 1)) {
      if (overlaps(b, other)) err(`overlaps block "${other.id}"`, b.id);
    }
    for (const key of Object.keys(b.params)) {
      if (meta.params && !(key in meta.params)) issues.push({ level: 'warning', block: b.id, message: `unknown param "${key}" for ${b.viz}` });
    }
  });
  return issues;
}

/** A block's params with the viz defaults filled in. */
export function blockParams(meta, block, bundle, filters) {
  const out = { ...block.params };
  for (const [key, def] of Object.entries(meta?.params || {})) {
    if (out[key] === undefined) out[key] = typeof def.default === 'function' ? def.default(bundle, filters) : def.default;
  }
  return out;
}

export function nextBlockId(blocks) {
  let n = blocks.length + 1;
  const ids = new Set(blocks.map(b => b.id));
  while (ids.has(`b${n}`)) n++;
  return `b${n}`;
}

// Specs travel in URLs as base64url JSON.
export function encodeSpec(spec) {
  const bytes = new TextEncoder().encode(JSON.stringify(spec));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeSpec(text) {
  const bin = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0))));
}
