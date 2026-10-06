// Print colours as literal hex. The design-system tokens use color-mix(), which a
// standalone HTML file or an SVG attribute can't rely on, so the mixed steps are
// computed here once, in OKLab like the CSS they mirror (src/ds/tokens/colors.css).

const BASE = {
  paper: '#faf8f4',
  paperDeep: '#efeae1',
  burgundy: '#7a1f2b',
  burgundyDeep: '#5e141e',
  ink: '#14110f',
  inkMuted: '#6a615a',
  blue: '#003399',
  success: '#2f6b3f',
  danger: '#a3261e',
  warning: '#8a5a12',
};

const toLin = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGam = c => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

function hexToOklab(hex) {
  const [r, g, b] = [1, 3, 5].map(i => toLin(parseInt(hex.slice(i, i + 2), 16) / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function oklabToHex([L, A, B]) {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  const rgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return '#' + rgb.map(c => Math.round(Math.max(0, Math.min(1, toGam(c))) * 255).toString(16).padStart(2, '0')).join('');
}

/** color-mix(in oklab, a p, b): p is the weight of `a`, 0..1. */
export function mix(a, b, p) {
  const x = hexToOklab(a);
  const y = hexToOklab(b);
  return oklabToHex(x.map((v, i) => v * p + y[i] * (1 - p)));
}

export const C = {
  ...BASE,
  inkSoft: mix(BASE.ink, BASE.inkMuted, 0.5),
  inkFaint: mix(BASE.inkMuted, BASE.paper, 0.5),
  inkLine: mix(BASE.inkMuted, BASE.paper, 0.28),
  burgundySoft: mix(BASE.burgundy, BASE.paper, 0.6),
  burgundyTint: mix(BASE.burgundy, BASE.paper, 0.14),
  burgundyWash: mix(BASE.burgundy, BASE.paper, 0.06),
};

/** Sequential burgundy ramp on 0..1, the same steps as the dashboard heatmap. */
export function ramp(t) {
  if (t == null) return C.paperDeep;
  const p = Math.max(0, Math.min(1, t));
  if (p === 0) return C.paperDeep;
  return mix(BASE.burgundy, BASE.paperDeep, Math.max(0.08, p));
}

/** Text on a ramp cell flips to paper where both reach equal contrast. */
export const rampInk = t => (t != null && t > 0.65 ? C.paper : C.ink);
