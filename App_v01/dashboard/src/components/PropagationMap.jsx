import React from 'react';
import { useWidth } from './shared.jsx';
import { shortName } from './Heatmap.jsx';
import { fmtHours } from '../data/derive.js';

const H = 400;
const NODE_H = 46;

// Columns follow the direction content usually travels: Moscow wires, then
// official German services, covert networks, Russia-based operators, DACH relays.
const fit = (label, w) => {
  const max = Math.floor((w - 22) / 7.2);
  return label.length > max ? label.slice(0, max - 1) + '…' : label;
};

export const COLUMNS = [
  { label: 'Upstream wires', test: s => s.rank === 3 },
  { label: 'State German', test: s => s.rank === 1 },
  { label: 'Covert networks', test: s => s.rank === 2 },
  { label: 'Operators in RU', test: s => s.rank === 4 },
  { label: 'DACH relays', test: s => s.rank === 5 },
];

export function PropagationMap({ nodes, links, selected, onSelect }) {
  const [ref, width] = useWidth(900);
  const [hover, setHover] = React.useState(null);

  // Nodes shrink to leave at least 40px of link run between columns.
  const NODE_W = Math.max(96, Math.min(168, (width - 16 - (COLUMNS.length - 1) * 40) / COLUMNS.length));
  const colX = k => 8 + k * ((width - NODE_W - 16) / (COLUMNS.length - 1));
  const pos = {};
  COLUMNS.forEach((c, k) => {
    const members = nodes.filter(c.test);
    const gap = (H - 40 - members.length * NODE_H) / (members.length + 1);
    members.forEach((n, i) => { pos[n.id] = { x: colX(k), y: 40 + gap * (i + 1) + i * NODE_H, col: k }; });
  });

  const maxCount = Math.max(1, ...links.map(l => l.count));
  const deg = {};
  for (const l of links) {
    deg[l.from] = deg[l.from] || { out: 0, in: 0 };
    deg[l.to] = deg[l.to] || { out: 0, in: 0 };
    deg[l.from].out += l.count;
    deg[l.to].in += l.count;
  }

  const active = hover || selected;
  const isLit = l => !active || (active.type === 'link' ? active.key === l.key : l.from === active.id || l.to === active.id);
  const nodeLit = id => !active || (active.type === 'node' ? active.id === id || links.some(l => isLit(l) && (l.from === id || l.to === id)) : active.from === id || active.to === id);

  const geom = l => {
    const a = pos[l.from], b = pos[l.to];
    if (!a || !b) return null;
    const y1 = a.y + NODE_H / 2, y2 = b.y + NODE_H / 2;
    if (b.col > a.col) {
      const x1 = a.x + NODE_W, x2 = b.x, mx = (x1 + x2) / 2;
      return `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
    }
    // Same column or backwards: loop out to the right.
    const x1 = a.x + NODE_W, x2 = b.x + NODE_W, bulge = 60 + Math.abs(y2 - y1) * 0.25;
    return `M${x1},${y1} C${x1 + bulge},${y1} ${x2 + bulge},${y2} ${x2},${y2}`;
  };

  return (
    <div className="chart" ref={ref}>
      <svg height={H} role="img" aria-label="Who influences whom">
        {COLUMNS.map((c, k) => (
          <text key={c.label} className="col-label" x={colX(k) + NODE_W / 2} y={16} textAnchor="middle">{c.label}</text>
        ))}

        {links.map(l => {
          const d = geom(l);
          if (!d) return null;
          const w = 1.5 + Math.sqrt(l.count / maxCount) * 9;
          const lit = isLit(l);
          const hot = active && lit;
          return (
            <g key={l.key}>
              <path className="prop-link" d={d} stroke={hot ? 'var(--accent-primary)' : 'var(--black)'} strokeWidth={w}
                strokeOpacity={lit ? (hot ? 0.9 : 0.22) : 0.06} />
              {lit && <path className="prop-flow" d={d} stroke={hot ? 'var(--white)' : 'var(--accent-primary)'} strokeWidth={Math.max(2, w * 0.35)}
                style={{ animationDuration: `${Math.max(0.5, Math.min(2.4, Math.log2(l.medianLag + 2) / 3))}s` }} />}
              <path d={d} fill="none" stroke="transparent" strokeWidth={Math.max(16, w + 10)} style={{ cursor: 'pointer' }}
                onPointerEnter={() => setHover({ type: 'link', ...l })} onPointerLeave={() => setHover(null)}
                onClick={() => onSelect(selected?.key === l.key ? null : { type: 'link', ...l })} />
            </g>
          );
        })}

        {nodes.map(n => {
          const p = pos[n.id];
          if (!p) return null;
          const lit = nodeLit(n.id);
          const sel = selected?.type === 'node' && selected.id === n.id;
          const d = deg[n.id] || { in: 0, out: 0 };
          return (
            <g key={n.id} className="prop-node" transform={`translate(${p.x},${p.y})`} opacity={lit ? 1 : 0.35} tabIndex={0} role="button"
              aria-label={`${n.name}: ${d.out} out, ${d.in} in`} aria-pressed={sel}
              onPointerEnter={() => setHover({ type: 'node', id: n.id })} onPointerLeave={() => setHover(null)}
              onFocus={() => setHover({ type: 'node', id: n.id })} onBlur={() => setHover(null)}
              onClick={() => onSelect(sel ? null : { type: 'node', id: n.id })}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(sel ? null : { type: 'node', id: n.id }); } }}
              style={{ transition: 'opacity var(--duration-base) var(--ease-standard)' }}>
              <rect x={sel ? 2 : 4} y={sel ? 2 : 4} width={NODE_W} height={NODE_H} rx={12} fill="var(--black)" />
              <rect className="body" width={NODE_W} height={NODE_H} rx={12} fill={sel ? 'var(--accent-primary)' : n.rank === 3 ? 'var(--beige-100)' : 'var(--white)'}
                stroke="var(--black)" strokeWidth={2.5} transform={sel ? 'translate(2,2)' : undefined} />
              <g transform={sel ? 'translate(2,2)' : undefined}>
                <text x={12} y={19} style={{ font: '600 13px var(--font-body)', fill: sel ? 'var(--white)' : 'var(--black)' }}>{fit(shortName(n), NODE_W)}<title>{n.name}</title></text>
                <text x={12} y={35} style={{ font: '500 11px var(--font-mono)', fill: sel ? 'var(--white)' : 'var(--text-muted)' }}>
                  {d.out ? `↗ ${d.out}` : ''}{d.out && d.in ? '  ' : ''}{d.in ? `↘ ${d.in}` : ''}{!d.in && !d.out ? 'no pickups' : ''}
                </text>
              </g>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function LagHistogram({ bins, highlight }) {
  const [ref, width] = useWidth(400);
  const [hover, setHover] = React.useState(null);
  const h = 170, m = { t: 12, b: 34, l: 8, r: 8 };
  const max = Math.max(1, ...bins.map(b => b.count));
  const bw = (width - m.l - m.r) / bins.length;
  const label = b => (b.to === Infinity ? `${fmtHours(b.from)}+` : `<${fmtHours(b.to)}`);
  return (
    <div className="chart" ref={ref} onMouseLeave={() => setHover(null)}>
      <svg height={h} role="img" aria-label="Delay before another outlet repeats it">
        <line className="axis-line" x1={m.l} x2={width - m.r} y1={h - m.b} y2={h - m.b} />
        {bins.map((b, k) => {
          const bh = (b.count / max) * (h - m.t - m.b);
          const hi = highlight ? b.edges.filter(e => highlight.has(e)).length : 0;
          const hh = (hi / max) * (h - m.t - m.b);
          const x = m.l + k * bw + (bw - Math.min(bw - 4, 72)) / 2;
          const w = Math.min(bw - 4, 72);
          return (
            <g key={k} onPointerEnter={() => setHover(k)}>
              <rect className="bar-rect" x={x} y={h - m.b - bh} width={w} height={bh} rx={4} fill={highlight ? 'var(--grey-200)' : 'var(--black)'}
                style={{ transition: 'y var(--duration-slow) var(--ease-out-back), height var(--duration-slow) var(--ease-out-back)' }} />
              {hi > 0 && <rect x={x} y={h - m.b - hh} width={w} height={hh} rx={4} fill="var(--accent-primary)" style={{ transition: 'all var(--duration-slow) var(--ease-out-back)' }} />}
              <rect x={x - 2} y={m.t} width={bw} height={h - m.t - m.b} fill="transparent" />
              <text className="axis-text" x={x + w / 2} y={h - m.b + 16} textAnchor="middle">{label(b)}</text>
              {(hover === k) && <text x={x + w / 2} y={h - m.b - bh - 6} textAnchor="middle" style={{ font: '700 12px var(--font-mono)' }}>{highlight ? `${hi}/` : ''}{b.count}</text>}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
