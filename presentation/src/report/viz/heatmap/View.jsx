import React from 'react';
import { cell, metricValue, rankedSources, rangeBounds, fmtNum } from '../../../data/derive.js';
import { C, ramp, rampInk } from '../../palette.js';
import { shortName, clamp } from '../../lib.js';
import { Svg, Text, TYPE, FONT, Empty } from '../../draw.jsx';
import { textWidth, truncate, wrap } from '../../text.js';

const GAP = 1.5;

export default function Heatmap({ bundle, params, filters, box }) {
  const metric = params.metric;
  const [lo, hi] = rangeBounds(bundle.weeks, filters.range);
  const series = bundle.series;
  const W = box.wPt;
  const H = box.hPt;

  const rowW = clamp(W * 0.22, 64, 104);
  const colW = (W - rowW) / series.length;
  const headSize = TYPE.tiny;
  const headLines = series.map(se => wrap(se.label, colW - 3, headSize, FONT.bodyMedium, 3));
  const headH = Math.max(...headLines.map(l => l.length)) * headSize * 1.18 + 4;
  const legendH = 11;

  const all = rankedSources(bundle);
  const minRowH = 11;
  const room = Math.floor((H - headH - legendH) / minRowH);
  const sources = all.slice(0, Math.max(1, room));
  const hidden = all.length - sources.length;
  const rowH = Math.min(26, (H - headH - legendH) / sources.length);
  if (rowH < 8) return <Empty>Too small for {all.length} outlets. Make this block taller.</Empty>;

  const rows = sources.map(src => ({ src, cells: series.map(se => ({ se, ...cell(src, se.id, lo, hi, bundle.weeks) })) }));
  const vals = rows.flatMap(r => r.cells.map(c => metricValue(c, metric))).filter(v => v != null && v > 0);
  const max = Math.max(...vals, 0.0001);
  const scale = v => (v == null ? null : metric === 'share' ? v / max : Math.sqrt(v / max));
  const fmt = v => (metric === 'share' ? (v < 0.05 ? '<0.1' : v.toFixed(1)) : fmtNum(v));
  const valueSize = rowH >= 13 && colW >= 26 ? TYPE.axis : TYPE.tiny;
  const labelAll = colW >= 20 && rowH >= 10;
  const cut = [...vals].sort((a, b) => b - a)[Math.floor(vals.length * 0.25)] ?? Infinity;
  const anyGenerated = rows.some(r => r.cells.some(c => c.generated));

  return (
    <Svg box={box} label={`Heatmap of ${sources.length} outlets by ${series.length} narratives`}>
      {series.map((se, ci) => headLines[ci].map((line, li) => (
        <Text key={`${se.id}${li}`} x={rowW + ci * colW + colW / 2} y={headH - 3 - (headLines[ci].length - 1 - li) * headSize * 1.18}
          size={headSize} font={FONT.bodyMedium} fill={C.inkSoft} anchor="middle">{line}</Text>
      )))}
      {rows.map((r, ri) => {
        const y = headH + ri * rowH;
        const name = truncate(shortName(r.src), rowW - 16, TYPE.axis, FONT.bodyMedium);
        const meta = `R${r.src.rank} · ${fmtNum(r.src.article_count)} art.`;
        const twoLines = rowH >= 16;
        return (
          <g key={r.src.id}>
            <Text x={0} y={y + (twoLines ? rowH / 2 - 1 : rowH / 2 + 2.4)} size={TYPE.axis} font={FONT.bodyMedium}>{name}</Text>
            {twoLines && <Text x={0} y={y + rowH / 2 + 6.4} size={TYPE.tiny} font={FONT.mono} fill={C.inkMuted}>{meta}</Text>}
            {r.cells.map((c, ci) => {
              const v = metricValue(c, metric);
              const x = rowW + ci * colW;
              const empty = v == null;
              const t = scale(v);
              const show = !empty && v > 0 && (labelAll || v >= cut);
              return (
                <g key={c.se.id}>
                  <rect x={x + GAP / 2} y={y + GAP / 2} width={colW - GAP} height={rowH - GAP} rx={1.2}
                    fill={empty ? C.paperDeep : ramp(t)} />
                  {empty && <Text x={x + colW / 2} y={y + rowH / 2 + 2.3} size={TYPE.tiny} fill={C.inkFaint} anchor="middle">–</Text>}
                  {show && (
                    <Text x={x + colW / 2} y={y + rowH / 2 + valueSize * 0.34} size={valueSize} font={FONT.mono} anchor="middle" fill={rampInk(t)}>
                      {fmt(v)}
                    </Text>
                  )}
                </g>
              );
            })}
          </g>
        );
      })}
      <Legend x={W} y={H - 3} max={max} metric={metric} note={[
        hidden ? `+${hidden} more outlets` : '',
        anyGenerated ? '– weeks not observed in this range' : '',
      ].filter(Boolean).join(' · ')} />
    </Svg>
  );
}

function Legend({ x, y, max, metric, note }) {
  const barW = 46;
  const maxLabel = metric === 'share' ? `${max.toFixed(1)}%` : fmtNum(Math.round(max));
  const lw = textWidth(maxLabel, TYPE.tiny, FONT.mono);
  const x1 = x - lw - 3 - barW;
  const steps = 8;
  return (
    <g>
      {note && <Text x={0} y={y} size={TYPE.tiny} fill={C.inkMuted}>{note}</Text>}
      <Text x={x1 - 3} y={y} size={TYPE.tiny} font={FONT.mono} fill={C.inkMuted} anchor="end">0</Text>
      {Array.from({ length: steps }, (_, i) => (
        <rect key={i} x={x1 + (i * barW) / steps} y={y - 5.2} width={barW / steps + 0.2} height={5} fill={ramp((i + 1) / steps)} />
      ))}
      <Text x={x} y={y} size={TYPE.tiny} font={FONT.mono} fill={C.inkMuted} anchor="end">{maxLabel}</Text>
    </g>
  );
}
