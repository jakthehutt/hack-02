import React from 'react';
import { movers, rangeBounds, fmtPct } from '../../../data/derive.js';
import { C } from '../../palette.js';
import { Svg, Text, TYPE, FONT, Empty } from '../../draw.jsx';
import { truncate, textWidth } from '../../text.js';

export default function SmallMultiples({ bundle, filters, box }) {
  const [lo, hi] = rangeBounds(bundle.weeks, filters.range);
  const all = movers(bundle, 'all', lo, hi);
  const W = box.wPt;
  const H = box.hPt;
  const noteH = 10;
  const cols = Math.max(1, Math.min(all.length, Math.floor(W / 92)));
  let rows = Math.ceil(all.length / cols);
  const minPanel = 34;
  const fitRows = Math.max(1, Math.floor((H - noteH) / minPanel));
  const shown = rows > fitRows ? all.slice(0, fitRows * cols) : all;
  rows = Math.ceil(shown.length / cols);
  if (!shown.length) return <Empty>No weekly data in this period.</Empty>;
  const gapX = 10;
  const gapY = 6;
  const pw = (W - (cols - 1) * gapX) / cols;
  const ph = (H - noteH - (rows - 1) * gapY) / rows;
  const max = Math.max(...shown.flatMap(m => m.spark.filter(v => v != null)), 0.0001);
  const headH = 10;

  return (
    <Svg box={box} label="Weekly share of every narrative, shared scale">
      {shown.map((m, k) => {
        const x0 = (k % cols) * (pw + gapX);
        const y0 = Math.floor(k / cols) * (ph + gapY);
        const n = m.spark.length;
        const ch = ph - headH - 2;
        const x = i => x0 + (n === 1 ? pw / 2 : (i / (n - 1)) * pw);
        const y = v => y0 + headH + ch - (v / max) * ch;
        let d = '';
        let pen = false;
        let last = null;
        m.spark.forEach((v, i) => {
          if (v == null) { pen = false; return; }
          d += `${pen ? 'L' : 'M'}${x(i).toFixed(2)},${y(v).toFixed(2)}`;
          pen = true;
          last = [x(i), y(v), v];
        });
        const up = m.delta >= 0;
        const value = last ? fmtPct(last[2]) : '–';
        const delta = `${up ? '+' : '−'}${Math.abs(m.delta).toFixed(1)}`;
        const right = `${value} ${delta}`;
        const rw = textWidth(right, TYPE.tiny, FONT.mono);
        const strong = k < 2 && Math.abs(m.delta) >= 1;
        return (
          <g key={m.series.id}>
            <Text x={x0} y={y0 + 7} size={TYPE.label} font={FONT.bodyMedium}>{truncate(m.series.label, pw - rw - 4, TYPE.label, FONT.bodyMedium)}</Text>
            <Text x={x0 + pw} y={y0 + 7} size={TYPE.tiny} font={FONT.mono} fill={C.inkSoft} anchor="end">{right}</Text>
            {m.split > 0 && m.split < n && <rect x={x(m.split) - (pw / Math.max(1, n - 1)) / 2} y={y0 + headH} width={x0 + pw - (x(m.split) - (pw / Math.max(1, n - 1)) / 2)} height={ch} fill={C.burgundyWash} />}
            <line x1={x0} x2={x0 + pw} y1={y0 + headH + ch} y2={y0 + headH + ch} stroke={C.inkLine} strokeWidth={0.5} />
            <path d={d} fill="none" stroke={strong ? C.burgundy : C.inkSoft} strokeWidth={strong ? 1.4 : 1} strokeLinejoin="round" strokeLinecap="round" />
            {last && <circle cx={last[0]} cy={last[1]} r={1.8} fill={strong ? C.burgundy : C.inkSoft} stroke={C.paper} strokeWidth={0.9} />}
          </g>
        );
      })}
      <Text x={0} y={H - 2} size={TYPE.tiny} fill={C.inkMuted}>
        {truncate(`Same scale, 0–${fmtPct(max)}. Shaded: last four weeks; numbers: latest week and change in pp.${all.length > shown.length ? ` +${all.length - shown.length} more.` : ''} Outlets with weekly counts only.`, W, TYPE.tiny)}
      </Text>
    </Svg>
  );
}
