import React from 'react';
import { Card } from '../ds/index.js';
import { CardHead, ChartTip, TableToggle, useWidth } from './shared.jsx';
import { shortName } from './Heatmap.jsx';
import { timeline, fmtWeek, fmtValue, fmtNum } from '../data/derive.js';

const H = 300;
const M = { t: 16, r: 56, b: 30, l: 44 };

function niceMax(v) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const f = v / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
}

/**
 * Weekly curve of one narrative across every outlet. The focused outlet is
 * drawn in the accent; the rest stay as grey context so the shape reads first.
 */
export function Timeline({ data, series, metric, lo, hi, focus, onFocus }) {
  const [ref, width] = useWidth(800);
  const [hover, setHover] = React.useState(null);
  const [table, setTable] = React.useState(false);
  const lines = timeline(data, series.id, metric, lo, hi);
  const weeks = data.weeks.slice(lo, hi + 1);
  const n = weeks.length;

  const all = lines.flatMap(l => l.points.map(p => p.value)).filter(v => v != null);
  const yMax = niceMax(Math.max(...all, metric === 'share' ? 1 : 5));
  const iw = width - M.l - M.r;
  const ih = H - M.t - M.b;
  const x = i => M.l + (n > 1 ? (i / (n - 1)) * iw : iw / 2);
  const y = v => M.t + ih - (v / yMax) * ih;

  const path = pts => {
    let d = '', pen = false;
    pts.forEach((p, k) => {
      if (p.value == null) { pen = false; return; }
      d += `${pen ? 'L' : 'M'}${x(k).toFixed(1)},${y(p.value).toFixed(1)}`;
      pen = true;
    });
    return d;
  };

  const focused = lines.find(l => l.source.id === focus) || lines[0];
  const others = lines.filter(l => l !== focused);
  const peak = focused.points.reduce((best, p, k) => (p.value != null && (best == null || p.value > best.p.value) ? { p, k } : best), null);
  const area = (() => {
    const segs = [];
    let cur = [];
    focused.points.forEach((p, k) => {
      if (p.value == null) { if (cur.length) segs.push(cur); cur = []; } else cur.push(k);
    });
    if (cur.length) segs.push(cur);
    return segs.map(s => `M${x(s[0])},${y(0)}` + s.map(k => `L${x(k)},${y(focused.points[k].value)}`).join('') + `L${x(s[s.length - 1])},${y(0)}Z`).join('');
  })();

  const ticks = [0, 0.25, 0.5, 0.75, 1].map(f => f * yMax);
  const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(iw / 70))));

  const onMove = e => {
    const box = e.currentTarget.getBoundingClientRect();
    const k = Math.round(((e.clientX - box.left - M.l) / iw) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, k)));
  };
  const onKey = e => {
    if (e.key === 'ArrowRight') setHover(h => Math.min(n - 1, (h ?? -1) + 1));
    else if (e.key === 'ArrowLeft') setHover(h => Math.max(0, (h ?? n) - 1));
    else if (e.key === 'Escape') setHover(null);
    else return;
    e.preventDefault();
  };

  const totals = Object.fromEntries(lines.map(l => [l.source.id, l.observed ? l.points.reduce((a, p) => a + (p.n || 0), 0) : null]));

  return (
    <Card padding={28}>
      <CardHead
        title={series.label}
        sub={`Weekly ${metric === 'share' ? 'share of articles' : 'article count'} · ${fmtWeek(weeks[0])} – ${fmtWeek(weeks[n - 1])}. Lines show outlets crawled week by week. Gaps are weeks with nothing crawled.`}
      >
        <TableToggle value={table} onChange={setTable} />
      </CardHead>

      {table ? (
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>Week</th>{lines.map(l => <th key={l.source.id} className="num">{shortName(l.source)}</th>)}</tr></thead>
            <tbody>
              {weeks.map((w, k) => (
                <tr key={w.week}><td>{w.week} · {fmtWeek(w)}</td>{lines.map(l => <td key={l.source.id} className="num">{fmtValue(l.points[k].value, metric)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="chart" ref={ref}>
          <svg height={H} role="img" aria-label={`${series.label} per week, ${focused.source.name} highlighted`}>
            {ticks.map(t => (
              <g key={t}>
                <line className="grid-line" x1={M.l} x2={width - M.r} y1={y(t)} y2={y(t)} />
                <text className="axis-text" x={M.l - 8} y={y(t) + 4} textAnchor="end">{metric === 'share' ? `${+t.toFixed(2)}%` : t}</text>
              </g>
            ))}
            <line className="axis-line" x1={M.l} x2={width - M.r} y1={y(0)} y2={y(0)} />
            {weeks.map((w, k) => (k % every === 0 || (k === n - 1 && (n - 1) % every >= every / 2)) && (
              <text key={w.week} className="axis-text" x={x(k)} y={H - 8} textAnchor="middle">{fmtWeek(w)}</text>
            ))}

            {others.map(l => (
              <path key={l.source.id} d={path(l.points)} fill="none" stroke="var(--grey-300)" strokeWidth={1.5}
                strokeLinejoin="round" strokeLinecap="round" style={{ transition: 'd var(--duration-slow) var(--ease-standard)' }} />
            ))}
            <path d={area} fill="var(--accent-50)" style={{ transition: 'd var(--duration-slow) var(--ease-standard)' }} />
            <path d={path(focused.points)} fill="none" stroke="var(--accent-primary)" strokeWidth={2.5}
              strokeLinejoin="round" strokeLinecap="round" style={{ transition: 'd var(--duration-slow) var(--ease-standard)' }} />

            {/* Direct label for the focused outlet at its last known point */}
            {(() => {
              const k = focused.points.map(p => p.value != null).lastIndexOf(true);
              if (k < 0) return null;
              return <text x={x(k) + 8} y={y(focused.points[k].value) + 4} style={{ font: '600 12px var(--font-body)', fill: 'var(--accent-700)' }}>{shortName(focused.source)}</text>;
            })()}

            {peak && peak.p.value > 0 && (
              <g transform={`translate(${x(peak.k)},${y(peak.p.value)})`}>
                <circle r={6} fill="var(--accent-primary)" stroke="var(--white)" strokeWidth={2.5} />
                <g transform={`translate(0,-14)`}>
                  <rect x={-38} y={-15} width={76} height={20} rx={6} fill="var(--black)" />
                  <text y={-1} textAnchor="middle" style={{ font: '600 11px var(--font-mono)', fill: 'var(--white)' }}>peak {fmtValue(peak.p.value, metric)}</text>
                </g>
              </g>
            )}

            {hover != null && (
              <g pointerEvents="none">
                <line x1={x(hover)} x2={x(hover)} y1={M.t} y2={y(0)} stroke="var(--black)" strokeWidth={1} />
                {lines.map(l => l.points[hover].value != null && (
                  <circle key={l.source.id} cx={x(hover)} cy={y(l.points[hover].value)} r={l === focused ? 5 : 3.5}
                    fill={l === focused ? 'var(--accent-primary)' : 'var(--grey-500)'} stroke="var(--white)" strokeWidth={2} />
                ))}
              </g>
            )}

            <rect x={M.l - 10} y={M.t} width={iw + 20} height={ih} fill="transparent" tabIndex={0}
              aria-label="Scrub weeks with the arrow keys"
              onPointerMove={onMove} onPointerLeave={() => setHover(null)} onKeyDown={onKey}
              onFocus={() => setHover(h => h ?? n - 1)} onBlur={() => setHover(null)} style={{ outline: 'none', cursor: 'crosshair' }} />
          </svg>

          {hover != null && (
            <ChartTip x={Math.min(Math.max(x(hover), 110), width - 110)} y={M.t + 8} title={`${weeks[hover].week} · week of ${fmtWeek(weeks[hover])}`}>
              {[...lines].sort((a, b) => (b.points[hover].value ?? -1) - (a.points[hover].value ?? -1)).map(l => (
                <div key={l.source.id} className={`tip-row${l === focused ? ' is-focus' : ''}`}>
                  <span className="tip-key" style={{ background: l === focused ? 'var(--accent-400)' : 'var(--grey-500)' }} />
                  <span className="v">{l.points[hover].value == null ? '–' : fmtValue(l.points[hover].value, metric)}</span>
                  <span className="k">{shortName(l.source)}</span>
                </div>
              ))}
            </ChartTip>
          )}
        </div>
      )}

      <div className="legend" role="group" aria-label="Focus an outlet">
        {lines.map(l => (
          <button key={l.source.id} className="chip" aria-pressed={l === focused} onClick={() => onFocus(l.source.id)}>
            <span className="swatch" />{shortName(l.source)}<span className="n">{l.observed ? fmtNum(totals[l.source.id]) : (l.span?.total ? fmtNum(l.span.n) : 'n/c')}</span>
          </button>
        ))}
      </div>
    </Card>
  );
}
