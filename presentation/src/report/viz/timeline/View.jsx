import React from 'react';
import { coveredWeeks, rangeBounds, spikes, weeklyObserved, fmtPct, fmtNum, fmtWeek } from '../../../data/derive.js';
import { C } from '../../palette.js';
import { shortName } from '../../lib.js';
import { Svg, Text, TYPE, FONT, Empty, ticks } from '../../draw.jsx';
import { textWidth } from '../../text.js';

function seriesPoints(bundle, src, seriesId, metric, lo, hi) {
  const cover = coveredWeeks(src, bundle.weeks);
  const s = src.series.find(x => x.id === seriesId);
  const out = [];
  for (let i = lo; i <= hi; i++) {
    const tot = src.weekly_articles[i] || 0;
    const n = s ? s.weekly_n[i] || 0 : 0;
    out.push(cover[i] && tot > 0 ? (metric === 'share' ? (n / tot) * 100 : n) : null);
  }
  return out;
}

function path(values, x, y) {
  let d = '';
  let pen = false;
  values.forEach((v, k) => {
    if (v == null) { pen = false; return; }
    d += `${pen ? 'L' : 'M'}${x(k).toFixed(2)},${y(v).toFixed(2)}`;
    pen = true;
  });
  return d;
}

export default function Timeline({ bundle, params, filters, box }) {
  const src = bundle.sources.find(s => s.id === params.source);
  const focus = bundle.series.find(s => s.id === params.series);
  if (!src || !focus) return <Empty>Pick an outlet and a narrative.</Empty>;
  if (!weeklyObserved(src)) return <Empty>Weekly counts for {shortName(src)} are estimated, so they are not drawn. Pick an outlet with observed weeks.</Empty>;

  const metric = params.metric;
  const [lo, hi] = rangeBounds(bundle.weeks, filters.range);
  const n = hi - lo + 1;
  const main = seriesPoints(bundle, src, focus.id, metric, lo, hi);
  const others = params.context ? bundle.series.filter(s => s.id !== focus.id).map(s => seriesPoints(bundle, src, s.id, metric, lo, hi)) : [];
  const fmt = v => (metric === 'share' ? fmtPct(v) : fmtNum(Math.round(v)));

  const W = box.wPt;
  const H = box.hPt;
  const legendH = 12;
  const axisSize = TYPE.axis;
  const max = Math.max(...main.filter(v => v != null), ...others.flat().filter(v => v != null), 0.0001);
  const t = ticks(max, H > 150 ? 4 : 3);
  const tickLabel = v => (metric === 'share' ? `${+v.toFixed(1)}%` : fmtNum(v));
  const left = Math.max(...t.values.map(v => textWidth(tickLabel(v), axisSize, FONT.mono))) + 4;
  const lastVal = [...main].reverse().find(v => v != null);
  const right = textWidth(lastVal != null ? fmt(lastVal) : '', TYPE.value, FONT.monoMedium) + 8;
  const top = legendH + 8;
  const bottom = 12;
  const iw = W - left - right;
  const ih = H - top - bottom;
  if (iw < 60 || ih < 30) return <Empty>Too small for a weekly chart.</Empty>;

  const x = k => left + (n === 1 ? iw / 2 : (k / (n - 1)) * iw);
  const y = v => top + ih - (v / t.top) * ih;

  // Spike weeks for this outlet and narrative.
  const sp = spikes(bundle, 'all', lo, hi).filter(s => s.source.id === src.id && s.series.id === focus.id);
  const peak = sp[0];

  // Week labels: as many as fit without touching.
  const labelW = textWidth('22 Sept', axisSize, FONT.body) + 6;
  const every = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(iw / labelW))));

  const area = path(main, x, y);
  const firstK = main.findIndex(v => v != null);
  const lastK = main.length - 1 - [...main].reverse().findIndex(v => v != null);

  return (
    <Svg box={box} label={`${focus.label} in ${src.name}, weekly`}>
      {/* legend */}
      <g>
        <line x1={0} x2={12} y1={6} y2={6} stroke={C.burgundy} strokeWidth={1.8} strokeLinecap="round" />
        <Text x={16} y={8.4} size={TYPE.label} font={FONT.bodyMedium}>{focus.label}</Text>
        {others.length > 0 && (() => {
          const x0 = 16 + textWidth(focus.label, TYPE.label, FONT.bodyMedium) + 12;
          return (
            <g>
              <line x1={x0} x2={x0 + 12} y1={6} y2={6} stroke={C.inkFaint} strokeWidth={0.9} />
              <Text x={x0 + 16} y={8.4} size={TYPE.label} fill={C.inkSoft}>other {others.length} narratives</Text>
            </g>
          );
        })()}
        {sp.length > 0 && (
          <g>
            <circle cx={W - textWidth('spike week (z ≥ 1.8)', TYPE.label) - 8} cy={6} r={2.6} fill={C.burgundy} stroke={C.paper} strokeWidth={1.2} />
            <Text x={W} y={8.4} size={TYPE.label} fill={C.inkSoft} anchor="end">spike week (z ≥ 1.8)</Text>
          </g>
        )}
      </g>

      {/* grid + y axis */}
      {t.values.map(v => (
        <g key={v}>
          <line x1={left} x2={left + iw} y1={y(v)} y2={y(v)} stroke={v === 0 ? C.inkFaint : C.inkLine} strokeWidth={v === 0 ? 0.75 : 0.5} />
          <Text x={left - 4} y={y(v) + 2.4} size={axisSize} font={FONT.mono} fill={C.inkMuted} anchor="end">{tickLabel(v)}</Text>
        </g>
      ))}
      {/* x labels */}
      {(() => {
        const ks = [];
        for (let k = 0; k < n; k += every) ks.push(k);
        if (ks[ks.length - 1] !== n - 1) {
          if ((x(n - 1) - x(ks[ks.length - 1])) < labelW) ks.pop();
          ks.push(n - 1);
        }
        return ks;
      })().map(k => (
        <Text key={k} x={x(k)} y={H - 2} size={axisSize} fill={C.inkMuted} anchor={k === 0 ? 'start' : k === n - 1 ? 'end' : 'middle'}>
          {fmtWeek(bundle.weeks[lo + k])}
        </Text>
      ))}

      {/* context lines */}
      {others.map((vals, i) => (
        <path key={i} d={path(vals, x, y)} fill="none" stroke={C.inkFaint} strokeWidth={0.8} strokeLinejoin="round" strokeLinecap="round" />
      ))}
      {/* focus area + line */}
      {firstK >= 0 && (
        <path d={`${area}L${x(lastK).toFixed(2)},${y(0).toFixed(2)}L${x(firstK).toFixed(2)},${y(0).toFixed(2)}Z`} fill={C.burgundy} fillOpacity={0.08} />
      )}
      <path d={area} fill="none" stroke={C.burgundy} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
      {sp.map(s => (
        <circle key={s.i} cx={x(s.i - lo)} cy={y(main[s.i - lo])} r={2.8} fill={C.burgundy} stroke={C.paper} strokeWidth={1.4} />
      ))}
      {peak && (() => {
        const px = x(peak.i - lo);
        const label = `${fmt(main[peak.i - lo])} · ${fmtWeek(peak.week)}`;
        const w = textWidth(label, TYPE.label, FONT.monoMedium);
        const anchor = px + w / 2 > left + iw ? 'end' : px - w / 2 < left ? 'start' : 'middle';
        return <Text x={px} y={Math.max(top - 2, y(main[peak.i - lo]) - 6)} size={TYPE.label} font={FONT.monoMedium} anchor={anchor}>{label}</Text>;
      })()}
      {lastVal != null && (
        <g>
          <circle cx={x(lastK)} cy={y(lastVal)} r={2.4} fill={C.burgundy} stroke={C.paper} strokeWidth={1.2} />
          <Text x={x(lastK) + 5} y={y(lastVal) + 2.6} size={TYPE.value} font={FONT.monoMedium}>{fmt(lastVal)}</Text>
        </g>
      )}
    </Svg>
  );
}
