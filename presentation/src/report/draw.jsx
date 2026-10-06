// Drawing primitives for print views. SVG user units are points (1/72 in), so a
// font-size of 7 is 7pt on paper; colours are literal hex from palette.js.
import React from 'react';
import { FAMILY } from './fonts.js';
import { C } from './palette.js';

export const TYPE = { tiny: 6.5, axis: 7, label: 7, body: 8, value: 7.5, title: 9 };
const STACK = {
  [FAMILY.body]: `'${FAMILY.body}', 'Inter', 'Helvetica Neue', Arial, sans-serif`,
  [FAMILY.mono]: `'${FAMILY.mono}', 'IBM Plex Mono', Menlo, monospace`,
  [FAMILY.display]: `'${FAMILY.display}', 'Geist', '${FAMILY.body}', 'Helvetica Neue', Arial, sans-serif`,
};

export const FONT = {
  body: { family: FAMILY.body, weight: 400 },
  bodyMedium: { family: FAMILY.body, weight: 500 },
  bodyBold: { family: FAMILY.body, weight: 600 },
  mono: { family: FAMILY.mono, weight: 400 },
  monoMedium: { family: FAMILY.mono, weight: 500 },
  display: { family: FAMILY.display, weight: 600 },
};

const r2 = v => +v.toFixed(2);
export const mm = v => `${+v.toFixed(3)}mm`;

/** An SVG that fills a view's box exactly, in pt. */
export function Svg({ box, label, children }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={mm(box.wMm)} height={mm(box.hMm)}
      viewBox={`0 0 ${r2(box.wPt)} ${r2(box.hPt)}`} role="img" aria-label={label}>
      {children}
    </svg>
  );
}

export function Text({ x, y, size = TYPE.label, font = FONT.body, fill = C.ink, anchor = 'start', baseline, children, ...rest }) {
  return (
    <text x={r2(x)} y={r2(y)} fontSize={size} fontFamily={STACK[font.family] || font.family} fontWeight={font.weight}
      fill={fill} textAnchor={anchor} dominantBaseline={baseline} {...rest}>
      {children}
    </text>
  );
}

/** 45° hatch for estimated marks, drawn over any fill. */
export function useHatch(color = C.paper, opacity = 0.75) {
  const id = 'fs-hatch-' + React.useId().replace(/[^a-zA-Z0-9]/g, '');
  const defs = (
    <defs>
      <pattern id={id} width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="3" stroke={color} strokeWidth="1.1" strokeOpacity={opacity} />
      </pattern>
    </defs>
  );
  return { fill: `url(#${id})`, defs };
}

/** Clean ticks from 0 to a rounded max. */
export function ticks(max, count = 4) {
  const raw = max / count;
  const p = 10 ** Math.floor(Math.log10(raw || 1));
  const step = [1, 2, 2.5, 5, 10].map(f => f * p).find(s => s >= raw) || raw;
  const top = Math.ceil(max / step) * step || step;
  const out = [];
  for (let v = 0; v <= top + step / 2; v += step) out.push(+v.toFixed(10));
  return { top, values: out, step };
}

/** Plain-language "no data here" for a view. */
export function Empty({ children }) {
  return <div className="fs-empty">{children}</div>;
}
