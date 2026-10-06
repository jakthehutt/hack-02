import React from 'react';
import { forestRows, rangeBounds, fmtNum } from '../../../data/derive.js';
import { C } from '../../palette.js';
import { shortName } from '../../lib.js';
import { Svg, Text, TYPE, FONT, Empty, ticks } from '../../draw.jsx';
import { textWidth, truncate } from '../../text.js';

export default function ForestPlot({ bundle, params, filters, box }) {
  const src = bundle.sources.find(s => s.id === params.source);
  if (!src) return <Empty>Pick an outlet.</Empty>;
  const [lo, hi] = rangeBounds(bundle.weeks, filters.range);
  const rows = forestRows(bundle, src, 'all', lo, hi).filter(r => r.interval).sort((a, b) => b.interval.share - a.interval.share);
  if (!rows.length) return <Empty>Weekly counts for {shortName(src)} are estimated, so there is nothing to show for part of the window. Pick “All weeks”.</Empty>;
  const W = box.wPt;
  const H = box.hPt;
  const axisH = 12;
  const noteH = 9;
  const fit = Math.max(1, Math.floor((H - axisH - noteH) / 11));
  const shown = rows.slice(0, fit);
  const rowH = Math.min(18, (H - axisH - noteH) / shown.length);
  const labelW = Math.min(W * 0.4, Math.max(...shown.map(r => textWidth(r.series.label, TYPE.label, FONT.bodyMedium))) + 6);
  const valueW = textWidth('10.0% (8.8–11.4)', TYPE.tiny, FONT.mono) + 4;
  const plotX = labelW;
  const plotW = W - labelW - valueW;
  if (plotW < 40) return <Empty>Too narrow. Make this block wider.</Empty>;
  const t = ticks(Math.max(...shown.map(r => r.interval.hi)), plotW > 120 ? 4 : 2);
  const x = v => plotX + (v / t.top) * plotW;
  const axisY = shown.length * rowH + 2;
  return (
    <Svg box={box} label={`Narrative shares with 95% intervals for ${src.name}`}>
      {t.values.map(v => (
        <g key={v}>
          <line x1={x(v)} x2={x(v)} y1={0} y2={axisY} stroke={v === 0 ? C.inkFaint : C.inkLine} strokeWidth={0.5} />
          <Text x={x(v)} y={axisY + 8} size={TYPE.axis} font={FONT.mono} fill={C.inkMuted} anchor="middle">{`${+v.toFixed(1)}%`}</Text>
        </g>
      ))}
      {shown.map((r, k) => {
        const cy = k * rowH + rowH / 2;
        const iv = r.interval;
        return (
          <g key={r.series.id}>
            <Text x={0} y={cy + 2.5} size={TYPE.label} font={FONT.bodyMedium}>{truncate(r.series.label, labelW - 5, TYPE.label, FONT.bodyMedium)}</Text>
            <line x1={x(iv.lo)} x2={x(iv.hi)} y1={cy} y2={cy} stroke={C.ink} strokeWidth={1.1} strokeLinecap="round" />
            <circle cx={x(iv.share)} cy={cy} r={2.6} fill={k === 0 ? C.burgundy : C.inkSoft} stroke={C.paper} strokeWidth={1.2} />
            <Text x={W} y={cy + 2.3} size={TYPE.tiny} font={FONT.mono} fill={C.inkSoft} anchor="end">
              {`${iv.share.toFixed(1)}% (${iv.lo.toFixed(1)}–${iv.hi.toFixed(1)})`}
            </Text>
          </g>
        );
      })}
      <Text x={0} y={H - 2} size={TYPE.tiny} fill={C.inkMuted}>
        {truncate(`${fmtNum(rows[0].total)} articles. Dot: share; line: 95% Wilson interval. Narratives overlap, so rows don’t add up.${rows.length > shown.length ? ` +${rows.length - shown.length} more.` : ''}`, W, TYPE.tiny)}
      </Text>
    </Svg>
  );
}
