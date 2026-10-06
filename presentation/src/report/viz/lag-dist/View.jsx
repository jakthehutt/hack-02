import React from 'react';
import { fmtHours } from '../../../data/derive.js';
import { C } from '../../palette.js';
import { Svg, Text, TYPE, FONT, Empty, useHatch, ticks } from '../../draw.jsx';
import { textWidth } from '../../text.js';
import { lagBins, BINS } from './meta.js';

export default function LagDist({ bundle, params, box }) {
  const d = lagBins(bundle, params.observedOnly);
  const hatch = useHatch(C.paper, 0.9);
  const W = box.wPt;
  const H = box.hPt;
  const total = d.bins.reduce((a, b) => a + b.observed + b.estimated, 0);
  if (!total) return <Empty>No pickups with a lag{params.observedOnly ? ' were observed' : ''}.</Empty>;

  // The median's label shares the legend row when there is room, else gets a row of its own.
  const legendW = 12 + textWidth(`observed (${d.observed})`, TYPE.tiny) + (params.observedOnly || !d.estimated ? 0 : 22 + textWidth(`estimated (${d.estimated})`, TYPE.tiny));
  const medText = d.observedMedian != null ? `median ${fmtHours(d.observedMedian)} (observed)` : '';
  const medRow = medText && legendW + textWidth(medText, TYPE.tiny, FONT.monoMedium) + 24 > W ? 1 : 0;
  const legendH = 11 + medRow * 9;
  const axisH = 11;
  const t = ticks(Math.max(...d.bins.map(b => b.observed + b.estimated)), H > 120 ? 4 : 2);
  const left = Math.max(...t.values.map(v => textWidth(String(v), TYPE.axis, FONT.mono))) + 4;
  const top = legendH + 6;
  const iw = W - left;
  const ih = H - top - axisH;
  if (iw < 90 || ih < 28) return <Empty>Too small for the lag histogram.</Empty>;
  const n = d.bins.length;
  const band = iw / n;
  const barW = Math.min(18, band * 0.7);
  const y = v => top + ih - (v / t.top) * ih;
  // Every other bin label when they would touch.
  const labelEvery = band < textWidth('12–24 h', TYPE.tiny) + 3 ? 2 : 1;
  // The observed median sits inside its bin, placed proportionally.
  const medX = h => {
    const k = d.bins.findIndex(b => h >= b.from && h < b.to);
    if (k < 0) return null;
    const b = d.bins[k];
    const frac = b.to === Infinity ? 0.5 : (h - b.from) / (b.to - b.from);
    return left + band * (k + frac);
  };
  const mx = d.observedMedian != null ? medX(d.observedMedian) : null;
  const medLabel = medText;
  const medLabelW = textWidth(medLabel, TYPE.tiny, FONT.monoMedium);
  const medY = 7.2 + medRow * 9;

  return (
    <Svg box={box} label="Pickup lag distribution">
      {hatch.defs}
      <g>
        <rect x={0} y={1.5} width={9} height={6} rx={1.5} fill={C.burgundy} />
        <Text x={12} y={7.2} size={TYPE.tiny} fill={C.inkSoft}>observed ({d.observed})</Text>
        {!params.observedOnly && d.estimated > 0 && (() => {
          const x0 = 12 + textWidth(`observed (${d.observed})`, TYPE.tiny) + 10;
          return (
            <g>
              <rect x={x0} y={1.5} width={9} height={6} rx={1.5} fill={C.inkFaint} />
              <rect x={x0} y={1.5} width={9} height={6} rx={1.5} fill={hatch.fill} />
              <Text x={x0 + 12} y={7.2} size={TYPE.tiny} fill={C.inkSoft}>estimated ({d.estimated})</Text>
            </g>
          );
        })()}
      </g>
      {t.values.map(v => (
        <g key={v}>
          <line x1={left} x2={W} y1={y(v)} y2={y(v)} stroke={v === 0 ? C.inkFaint : C.inkLine} strokeWidth={v === 0 ? 0.75 : 0.5} />
          <Text x={left - 4} y={y(v) + 2.4} size={TYPE.axis} font={FONT.mono} fill={C.inkMuted} anchor="end">{v}</Text>
        </g>
      ))}
      {d.bins.map((b, k) => {
        const cx = left + band * k + band / 2;
        const x = cx - barW / 2;
        const yo = y(b.observed);
        const ye = y(b.observed + b.estimated);
        const sum = b.observed + b.estimated;
        return (
          <g key={b.label}>
            {b.estimated > 0 && (
              <>
                <rect x={x} y={ye} width={barW} height={yo - ye} rx={1.5} fill={C.inkFaint} />
                <rect x={x} y={ye} width={barW} height={yo - ye} rx={1.5} fill={hatch.fill} />
              </>
            )}
            {b.observed > 0 && <rect x={x} y={yo} width={barW} height={y(0) - yo} rx={1.5} fill={C.burgundy} />}
            {sum > 0 && ih > 50 && <Text x={cx} y={ye - 2.5} size={TYPE.tiny} font={FONT.mono} fill={C.inkSoft} anchor="middle">{sum}</Text>}
            {k % labelEvery === 0 && <Text x={cx} y={H - 2} size={TYPE.tiny} fill={C.inkMuted} anchor="middle">{b.label}</Text>}
          </g>
        );
      })}
      {mx != null && (
        <g>
          <line x1={mx} x2={mx} y1={top - 2} y2={y(0)} stroke={C.ink} strokeWidth={0.9} strokeDasharray="2 1.5" />
          {/* The median's label sits in the legend row, so it can't collide with bar values. */}
          <line x1={W - medLabelW - 14} x2={W - medLabelW - 4} y1={medY - 2.7} y2={medY - 2.7} stroke={C.ink} strokeWidth={0.9} strokeDasharray="2 1.5" />
          <Text x={W} y={medY} size={TYPE.tiny} font={FONT.monoMedium} anchor="end">{medLabel}</Text>
        </g>
      )}
    </Svg>
  );
}
