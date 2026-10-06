import React from 'react';
import { C } from '../../palette.js';
import { Svg, Text, TYPE, FONT, Empty, useHatch } from '../../draw.jsx';
import { textWidth, truncate } from '../../text.js';
import { rankedRows } from './meta.js';

// Stacked rows (label line, then a full-width bar) when they fit; otherwise
// one line per row with the label in a left column.
const STACKED_ROW = 21;
const COMPACT_ROW = 12.5;

export default function RankedBars({ bundle, params, filters, box }) {
  const data = rankedRows(bundle, params, filters);
  const hatch = useHatch();
  const W = box.wPt;
  const H = box.hPt;
  const noteH = 10;
  const avail = H - noteH;
  const stacked = Math.floor(avail / STACKED_ROW) >= Math.min(data.rows.length, 4);
  const fit = Math.max(1, Math.floor(avail / (stacked ? STACKED_ROW : COMPACT_ROW)));
  const rows = data.rows.slice(0, fit);
  const hidden = data.rows.length - rows.length;
  if (!rows.length) return <Empty>Nothing to rank in this period.</Empty>;
  const rowH = Math.min(stacked ? 26 : 16, avail / rows.length);

  const valueW = Math.max(...rows.map(r => textWidth(r.display, TYPE.value, FONT.monoMedium))) + 5;
  const labelW = stacked ? 0 : Math.min(W * 0.4, Math.max(...rows.map(r => textWidth(r.label, TYPE.label, FONT.bodyMedium))) + 6);
  const barX = labelW;
  const barW = W - labelW - valueW;
  if (barW < 30) return <Empty>Too narrow for bars. Make this block wider.</Empty>;
  const thick = stacked ? Math.min(7.5, rowH - 13) : Math.min(7, rowH * 0.55);

  const diverging = data.kind === 'diverging';
  const maxAbs = Math.max(...rows.map(r => Math.abs(r.value)), ...rows.map(r => r.baseline || 0), 0.0001);
  const half = (barW - valueW) / 2;
  const zeroX = diverging ? barX + valueW + half : barX;
  const scale = v => (diverging ? (v / maxAbs) * half : (v / maxAbs) * barW);

  return (
    <Svg box={box} label={`Ranked bars: ${params.mode}`}>
      {hatch.defs}
      {rows.map((r, k) => {
        const y = k * rowH;
        const barY = stacked ? y + 10.5 : y + (rowH - thick) / 2;
        const len = Math.max(r.value === 0 ? 0 : 1.2, Math.abs(scale(r.value)));
        const x0 = diverging && r.value < 0 ? zeroX - len : zeroX;
        const fill = diverging ? (r.value >= 0 ? C.burgundy : C.blue) : k === 0 ? C.burgundy : C.burgundySoft;
        const obsLen = r.estimated ? (len * r.observed) / r.value : len;
        const valueX = diverging && r.value < 0 ? x0 - 3 : x0 + len + 3;
        const rx = Math.min(2, thick / 2);
        let label;
        if (stacked) {
          const main = truncate(r.label, W * 0.62, TYPE.label, FONT.bodyMedium);
          const mainW = textWidth(main, TYPE.label, FONT.bodyMedium);
          const sub = r.sub ? truncate(`  ${r.sub}`, W - mainW, TYPE.tiny) : '';
          label = (
            <Text x={0} y={y + 7.2} size={TYPE.label} font={FONT.bodyMedium}>
              {main}{sub && <tspan fontSize={TYPE.tiny} fontWeight={400} fill={C.inkMuted}>{sub}</tspan>}
            </Text>
          );
        } else {
          label = <Text x={0} y={y + rowH / 2 + 2.5} size={TYPE.label} font={FONT.bodyMedium}>{truncate(r.label, labelW - 5, TYPE.label, FONT.bodyMedium)}</Text>;
        }
        return (
          <g key={r.id}>
            {label}
            <rect x={x0} y={barY} width={len} height={thick} rx={rx} fill={r.estimated ? C.inkFaint : fill} />
            {r.estimated && (
              <>
                <rect x={x0} y={barY} width={len} height={thick} rx={rx} fill={hatch.fill} />
                {obsLen > 0 && <rect x={x0} y={barY} width={obsLen} height={thick} rx={rx} fill={C.burgundy} />}
              </>
            )}
            {diverging && <line x1={zeroX} x2={zeroX} y1={barY - 2} y2={barY + thick + 2} stroke={C.inkSoft} strokeWidth={0.75} />}
            {r.baseline != null && (
              <line x1={zeroX + scale(r.baseline)} x2={zeroX + scale(r.baseline)} y1={barY - 1.8} y2={barY + thick + 1.8} stroke={C.ink} strokeWidth={1.1} />
            )}
            <Text x={valueX} y={barY + thick / 2 + 2.6} size={TYPE.value} font={FONT.monoMedium} anchor={diverging && r.value < 0 ? 'end' : 'start'}>{r.display}</Text>
          </g>
        );
      })}
      <Text x={0} y={H - 2} size={TYPE.tiny} fill={C.inkMuted}>
        {truncate([hidden > 0 ? `+${hidden} more` : '', data.note].filter(Boolean).join(' · '), W, TYPE.tiny)}
      </Text>
    </Svg>
  );
}
