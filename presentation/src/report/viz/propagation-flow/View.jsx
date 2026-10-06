import React from 'react';
import { propagationLinks, sourceById } from '../../../data/derive.js';
import { C } from '../../palette.js';
import { shortName, RANK_COLUMNS } from '../../lib.js';
import { Svg, Text, TYPE, FONT, Empty } from '../../draw.jsx';
import { truncate, textWidth } from '../../text.js';
import { ALL_RELATIONS } from './meta.js';

export default function PropagationFlow({ bundle, params, box }) {
  const edges = params.observedOnly ? bundle.edges.filter(e => !e.synthetic) : bundle.edges;
  const links = propagationLinks({ ...bundle, edges }, ALL_RELATIONS);
  if (!links.length) return <Empty>No pickups between outlets{params.observedOnly ? ' were observed' : ''}.</Empty>;
  const byId = sourceById(bundle);
  const nodes = [...bundle.upstream, ...bundle.sources];
  const W = box.wPt;
  const H = box.hPt;
  const headH = 11;
  const legendH = 11;
  const cols = RANK_COLUMNS.filter(c => nodes.some(n => n.rank === c.rank));
  const colGap = Math.max(18, W * 0.07);
  const nodeW = Math.min(92, (W - (cols.length - 1) * colGap) / cols.length);
  const colX = k => (cols.length === 1 ? (W - nodeW) / 2 : (k * (W - nodeW)) / (cols.length - 1));
  const maxPer = Math.max(...cols.map(c => nodes.filter(n => n.rank === c.rank).length));
  const room = H - headH - legendH - 4;
  const nodeH = Math.min(22, Math.max(11, room / maxPer - 4));
  const twoLines = nodeH >= 18;
  if (room / maxPer < 12) return <Empty>Too short for {maxPer} outlets in a column. Make this block taller.</Empty>;

  const deg = {};
  for (const l of links) {
    (deg[l.from] ||= { out: 0, in: 0 }).out += l.count;
    (deg[l.to] ||= { out: 0, in: 0 }).in += l.count;
  }
  const pos = {};
  cols.forEach((c, k) => {
    const members = nodes.filter(n => n.rank === c.rank);
    const gap = (room - members.length * nodeH) / (members.length + 1);
    members.forEach((n, i) => { pos[n.id] = { x: colX(k), y: headH + 2 + gap * (i + 1) + i * nodeH, col: k }; });
  });
  const maxCount = Math.max(1, ...links.map(l => l.count));
  const geom = l => {
    const a = pos[l.from];
    const b = pos[l.to];
    if (!a || !b) return null;
    const y1 = a.y + nodeH / 2;
    const y2 = b.y + nodeH / 2;
    if (b.col > a.col) {
      const x1 = a.x + nodeW;
      const x2 = b.x;
      const mx = (x1 + x2) / 2;
      return `M${x1.toFixed(1)},${y1.toFixed(1)} C${mx.toFixed(1)},${y1.toFixed(1)} ${mx.toFixed(1)},${y2.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`;
    }
    const x1 = a.x + nodeW;
    const x2 = b.x + nodeW;
    const bulge = Math.min(colGap * 0.9, 14 + Math.abs(y2 - y1) * 0.2);
    return `M${x1.toFixed(1)},${y1.toFixed(1)} C${(x1 + bulge).toFixed(1)},${y1.toFixed(1)} ${(x2 + bulge).toFixed(1)},${y2.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`;
  };
  const width = (l, max = 5) => 0.7 + Math.sqrt(l.count / maxCount) * max;
  const observedOf = l => l.edges.filter(e => !e.synthetic).length;
  const estimatedLinks = links.filter(l => observedOf(l) === 0);
  const observedLinks = links.filter(l => observedOf(l) > 0);

  return (
    <Svg box={box} label="Pickup routes between outlets">
      {cols.map((c, k) => {
        const room = nodeW + colGap * 0.8;
        const label = (textWidth(c.label.toUpperCase(), TYPE.tiny, FONT.monoMedium) <= room ? c.label : c.short).toUpperCase();
        const anchor = k === 0 ? 'start' : k === cols.length - 1 ? 'end' : 'middle';
        const x = k === 0 ? colX(k) : k === cols.length - 1 ? colX(k) + nodeW : colX(k) + nodeW / 2;
        return <Text key={c.label} x={x} y={7} size={TYPE.tiny} font={FONT.monoMedium} fill={C.inkMuted} anchor={anchor}>{label}</Text>;
      })}
      {estimatedLinks.map(l => {
        const d = geom(l);
        return d && <path key={l.key} d={d} fill="none" stroke={C.inkFaint} strokeWidth={width(l, 3.2)} strokeOpacity={0.75} strokeDasharray="3 2" />;
      })}
      {observedLinks.map(l => {
        const d = geom(l);
        return d && <path key={l.key} d={d} fill="none" stroke={C.burgundy} strokeWidth={width(l)} strokeOpacity={0.85} />;
      })}
      {nodes.map(n => {
        const p = pos[n.id];
        if (!p) return null;
        const d = deg[n.id] || { out: 0, in: 0 };
        const name = truncate(shortName(byId[n.id] || n), nodeW - 7, TYPE.label, FONT.bodyMedium);
        return (
          <g key={n.id}>
            <rect x={p.x} y={p.y} width={nodeW} height={nodeH} rx={2.2} fill={n.rank === 3 ? C.paperDeep : C.paper} stroke={C.ink} strokeWidth={0.75} />
            <Text x={p.x + 3.5} y={p.y + (twoLines ? 8 : nodeH / 2 + 2.5)} size={TYPE.label} font={FONT.bodyMedium}>{name}</Text>
            {twoLines && <Text x={p.x + 3.5} y={p.y + 16} size={TYPE.tiny} font={FONT.mono} fill={C.inkMuted}>{truncate(`out ${d.out} · in ${d.in}`, nodeW - 6, TYPE.tiny, FONT.mono)}</Text>}
          </g>
        );
      })}
      <g>
        <line x1={0} x2={12} y1={H - 4.5} y2={H - 4.5} stroke={C.burgundy} strokeWidth={2} />
        <Text x={15} y={H - 2} size={TYPE.tiny} fill={C.inkSoft}>observed pickups</Text>
        {!params.observedOnly && (
          <>
            <line x1={78} x2={90} y1={H - 4.5} y2={H - 4.5} stroke={C.inkFaint} strokeWidth={2} strokeDasharray="3 2" />
            <Text x={93} y={H - 2} size={TYPE.tiny} fill={C.inkSoft}>estimated</Text>
          </>
        )}
        <Text x={W} y={H - 2} size={TYPE.tiny} fill={C.inkMuted} anchor="end">width = number of pickups · {edges.length} in all</Text>
      </g>
    </Svg>
  );
}
