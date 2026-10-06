// Text measurement for views that size their content before drawing.
// Widths come back in the units of the size passed in (pt inside a pt viewBox).
import { FAMILY } from './fonts.js';

let ctx = null;
function context() {
  if (ctx === null) ctx = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : undefined;
  return ctx;
}

export function textWidth(str, size, { weight = 400, family = FAMILY.body, style = 'normal' } = {}) {
  const c = context();
  if (!c) return String(str).length * size * 0.55;
  c.font = `${style} ${weight} ${size}px "${family}"`;
  return c.measureText(String(str)).width;
}

/** Shorten to fit `max`, ending in an ellipsis. */
export function truncate(str, max, size, font) {
  const s = String(str);
  if (textWidth(s, size, font) <= max) return s;
  let lo = 0, hi = s.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (textWidth(s.slice(0, mid).trimEnd() + '…', size, font) <= max) lo = mid; else hi = mid - 1;
  }
  return lo ? s.slice(0, lo).trimEnd() + '…' : '';
}

/** Split a word that is wider than `max`: at its own hyphens first, then with a added hyphen. */
function splitWord(word, max, size, font) {
  if (textWidth(word, size, font) <= max) return [word];
  const hy = word.split(/(?<=-)/);
  if (hy.length > 1) return hy.flatMap(part => splitWord(part, max, size, font));
  const parts = [];
  let rest = word;
  while (textWidth(rest, size, font) > max && rest.length > 4) {
    let n = rest.length - 1;
    while (n > 2 && textWidth(rest.slice(0, n) + '-', size, font) > max) n--;
    parts.push(rest.slice(0, n) + '-');
    rest = rest.slice(n);
  }
  return [...parts, rest];
}

/** Greedy word wrap into at most `maxLines`; long words break, the last line is truncated if needed. */
export function wrap(str, max, size, font, maxLines = Infinity) {
  const words = String(str).split(/\s+/).filter(Boolean).flatMap(w => splitWord(w, max, size, font));
  const lines = [];
  let line = '';
  for (let i = 0; i < words.length; i++) {
    const glue = line && !line.endsWith('-') ? ' ' : '';
    const cand = line + glue + words[i];
    if (textWidth(cand, size, font) <= max || !line) {
      line = cand;
    } else {
      lines.push(line);
      line = words[i];
      if (lines.length === maxLines - 1) {
        line = words.slice(i).join(' ');
        break;
      }
    }
  }
  if (line) lines.push(line);
  return lines.map(l => (textWidth(l, size, font) > max ? truncate(l, max, size, font) : l));
}
