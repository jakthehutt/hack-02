import React from 'react';
import { Card } from '../ds/index.js';
import { CardHead, ChartTip, TableToggle, useWidth } from './shared.jsx';
import { shortName } from './Heatmap.jsx';
import { fmtHours, fmtNum, fmtPct, fmtWeek } from '../data/derive.js';

export const SERIES_COLORS = [
  'var(--accent-700)',
  'var(--accent-500)',
  'var(--black)',
  'var(--accent-600)',
  'var(--grey-700)',
  'var(--amber-500)',
  'var(--green-500)',
  'var(--red-500)',
  'var(--grey-500)',
];

export const seriesColor = i => SERIES_COLORS[i % SERIES_COLORS.length];

function niceMax(v) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const f = v / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
}

function SeriesLegend({ series }) {
  return (
    <div className="stat-legend">
      {series.map((se, i) => (
        <span key={se.id}><i className="stat-dot" style={{ background: seriesColor(i) }} />{se.label}</span>
      ))}
    </div>
  );
}

function axisOf(row, metric, which) {
  if (!row.interval) return null;
  if (metric === 'share') {
    if (which === 'point') return row.interval.share;
    return row.interval[which];
  }
  const scale = row.total / 100;
  if (which === 'point') return row.n;
  return row.interval[which] * scale;
}

export function ForestPlot({ rows, metric, selectedId, onSelect }) {
  const [table, setTable] = React.useState(false);
  const [hover, setHover] = React.useState(null);
  const xs = rows.flatMap(r => [axisOf(r, metric, 'lo'), axisOf(r, metric, 'hi')].filter(v => v != null));
  const xMax = niceMax(Math.max(...xs, metric === 'share' ? 1 : 1));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(f => f * xMax);
  const fmtTick = v => (metric === 'share' ? `${+v.toFixed(v < 10 ? 1 : 0)}%` : fmtNum(Math.round(v)));

  return (
    <Card padding={28}>
      <CardHead
        title="Share with a 95% interval"
        sub="Wilson interval for the share of this outlet’s articles that match each frame. One article can match more than one frame, so the rows are not a partition."
      >
        <TableToggle value={table} onChange={setTable} />
      </CardHead>
      {rows.length === 0 ? <div className="empty">No series of this kind.</div> : table ? (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Frame</th>
                <th className="num">Low</th>
                <th className="num">Share</th>
                <th className="num">High</th>
                <th className="num">Hits</th>
                <th className="num">Articles</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.series.id}>
                  <td>{r.series.label}</td>
                  <td className="num">{r.interval ? fmtPct(r.interval.lo, 2) : '–'}</td>
                  <td className="num">{r.interval ? fmtPct(r.interval.share, 2) : '–'}</td>
                  <td className="num">{r.interval ? fmtPct(r.interval.hi, 2) : '–'}</td>
                  <td className="num">{fmtNum(r.n)}</td>
                  <td className="num">{fmtNum(r.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="forest">
          {rows.map(r => {
            const lo = axisOf(r, metric, 'lo');
            const hi = axisOf(r, metric, 'hi');
            const point = axisOf(r, metric, 'point');
            const on = r.series.id === selectedId;
            return (
              <button
                key={r.series.id}
                className={`forest-row${on ? ' is-on' : ''}`}
                onClick={() => onSelect(r.series.id)}
                onMouseEnter={() => setHover(r.series.id)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(r.series.id)}
                onBlur={() => setHover(null)}
              >
                <span className="forest-label">{r.series.label}</span>
                <span className="forest-track">
                  {r.interval ? (
                    <>
                      <span className="forest-ci" style={{ left: `${(lo / xMax) * 100}%`, width: `${Math.max(0, ((hi - lo) / xMax) * 100)}%`, background: on ? 'var(--accent-700)' : 'var(--black)' }} />
                      <span className="forest-dot" style={{ left: `${(point / xMax) * 100}%`, background: on ? 'var(--accent-primary)' : 'var(--black)' }} />
                    </>
                  ) : <span className="row-sub">n/c</span>}
                  {hover === r.series.id && r.interval && (
                    <ChartTip x={`${(point / xMax) * 100}%`} y={0} title={r.series.label}>
                      <div className="tip-row"><span className="v">{fmtPct(r.interval.share, 2)}</span><span className="k">{fmtPct(r.interval.lo, 1)} – {fmtPct(r.interval.hi, 1)}</span></div>
                      <div className="tip-row"><span className="v">{fmtNum(r.n)}</span><span className="k">of {fmtNum(r.total)} articles</span></div>
                    </ChartTip>
                  )}
                </span>
                <span className="mono forest-n">{r.interval ? (metric === 'share' ? fmtPct(r.share, 2) : fmtNum(r.n)) : '–'}</span>
              </button>
            );
          })}
          <div className="forest-row forest-axis" aria-hidden="true">
            <span />
            <span className="forest-track forest-ticks">
              {ticks.map(t => (
                <span key={t} style={{ left: `${(t / xMax) * 100}%` }}>{fmtTick(t)}</span>
              ))}
            </span>
            <span />
          </div>
        </div>
      )}
    </Card>
  );
}

export function VolumeShareChart({ model, seriesLabel }) {
  const [ref, width] = useWidth(640);
  const [hover, setHover] = React.useState(null);
  const [table, setTable] = React.useState(false);
  const points = model.points || [];
  const n = points.length;
  const H = 280;
  const M = { t: 16, r: 48, b: 32, l: 44 };
  const iw = Math.max(40, width - M.l - M.r);
  const ih = H - M.t - M.b;
  const volMax = niceMax(Math.max(...points.map(p => p.total || 0), 1));
  const shareMax = niceMax(Math.max(...points.map(p => p.share || 0), 1));
  const x = k => M.l + (n > 1 ? (k / (n - 1)) * iw : iw / 2);
  const yVol = v => M.t + ih - (v / volMax) * ih;
  const yShare = v => M.t + ih - (v / shareMax) * ih;
  const barW = n ? Math.max(3, (iw / n) * 0.55) : 4;

  let line = '';
  let pen = false;
  points.forEach((p, k) => {
    if (p.share == null) { pen = false; return; }
    line += `${pen ? 'L' : 'M'}${x(k).toFixed(1)},${yShare(p.share).toFixed(1)}`;
    pen = true;
  });

  return (
    <Card padding={28}>
      <CardHead
        title="Volume under the share"
        sub={model.observed
          ? `Bars are articles published that week. The line is the share that matched ${seriesLabel}. A high share in a thin week is a small count.`
          : 'This outlet’s week-by-week shape was not crawled. The figure is the crawled total for the whole window.'}
      >
        {model.observed && <TableToggle value={table} onChange={setTable} />}
      </CardHead>
      {!model.observed ? (
        <div className="empty">
          {model.total?.total
            ? <>Crawled total: <strong className="mono">{fmtNum(model.total.n)}</strong> matching articles, {fmtPct(model.total.share, 2)} of {fmtNum(model.total.total)}.</>
            : 'No crawled total for this frame.'}
        </div>
      ) : table ? (
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>Week</th><th className="num">Articles</th><th className="num">Hits</th><th className="num">Share</th></tr></thead>
            <tbody>
              {points.map(p => (
                <tr key={p.week.week}>
                  <td>{p.week.week} · {fmtWeek(p.week)}</td>
                  <td className="num">{fmtNum(p.total)}</td>
                  <td className="num">{fmtNum(p.n)}</td>
                  <td className="num">{p.share == null ? '–' : fmtPct(p.share, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="chart" ref={ref}>
          <svg height={H} role="img" aria-label={`${seriesLabel} volume and share`}>
            {[0, 0.5, 1].map(f => (
              <g key={f}>
                <line className="grid-line" x1={M.l} x2={width - M.r} y1={yVol(f * volMax)} y2={yVol(f * volMax)} />
                <text className="axis-text" x={M.l - 8} y={yVol(f * volMax) + 4} textAnchor="end">{fmtNum(Math.round(f * volMax))}</text>
                <text className="axis-text" x={width - M.r + 8} y={yShare(f * shareMax) + 4}>{+((f * shareMax).toFixed(1))}%</text>
              </g>
            ))}
            {points.map((p, k) => p.total > 0 && (
              <rect key={p.week.week} x={x(k) - barW / 2} y={yVol(p.total)} width={barW} height={Math.max(0, yVol(0) - yVol(p.total))} fill="var(--grey-200)" rx={2} />
            ))}
            {line && <path d={line} fill="none" stroke="var(--accent-primary)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />}
            {points.map((p, k) => (k % Math.max(1, Math.ceil(n / 6)) === 0) && (
              <text key={`t-${p.week.week}`} className="axis-text" x={x(k)} y={H - 8} textAnchor="middle">{fmtWeek(p.week)}</text>
            ))}
            {hover != null && points[hover] && (
              <line x1={x(hover)} x2={x(hover)} y1={M.t} y2={yVol(0)} stroke="var(--black)" strokeWidth={1} />
            )}
            <rect x={M.l} y={M.t} width={iw} height={ih} fill="transparent"
              onPointerMove={e => {
                const box = e.currentTarget.getBoundingClientRect();
                const k = Math.round(((e.clientX - box.left) / iw) * (n - 1));
                setHover(Math.max(0, Math.min(n - 1, k)));
              }}
              onPointerLeave={() => setHover(null)} />
          </svg>
          {hover != null && points[hover] && (
            <ChartTip x={Math.min(Math.max(x(hover), 110), width - 110)} y={M.t + 8} title={`${points[hover].week.week} · ${fmtWeek(points[hover].week)}`}>
              <div className="tip-row"><span className="v">{fmtNum(points[hover].total)}</span><span className="k">articles</span></div>
              <div className="tip-row"><span className="v">{fmtNum(points[hover].n)}</span><span className="k">frame hits</span></div>
              <div className="tip-row is-focus"><span className="v">{points[hover].share == null ? '–' : fmtPct(points[hover].share, 2)}</span><span className="k">share</span></div>
            </ChartTip>
          )}
        </div>
      )}
    </Card>
  );
}

export function CompositionChart({ model }) {
  const [ref, width] = useWidth(640);
  const [hover, setHover] = React.useState(null);
  const [table, setTable] = React.useState(false);
  const weeks = model.weeks || [];
  const n = weeks.length;
  const H = 280;
  const M = { t: 16, r: 16, b: 32, l: 44 };
  const iw = Math.max(40, width - M.l - M.r);
  const ih = H - M.t - M.b;
  const yMax = niceMax(Math.max(...weeks.map(w => Math.max(w.volume, w.hits)), model.volume || 0, 1));
  const y = v => M.t + ih - (v / yMax) * ih;
  const slot = n ? iw / n : iw;
  const barW = Math.max(4, slot * 0.72);

  if (!model.observed) {
    const hits = (model.totals || []).reduce((a, b) => a + b, 0);
    const span = Math.max(hits, model.volume || 0, 1);
    let cursor = 0;
    return (
      <Card padding={28}>
        <CardHead title="Match composition" sub="Frame hits for the whole crawl. Frames overlap, so the stack can run past the article count. Weekly bars are omitted because this outlet’s weeks were generated." />
        <div className="comp-total">
          <div className="comp-volume" style={{ width: `${((model.volume || 0) / span) * 100}%` }} />
          <div className="comp-stack">
            {model.series.map((se, i) => {
              const v = model.totals[i] || 0;
              const left = cursor;
              cursor += v;
              return v > 0 && <span key={se.id} title={se.label} style={{ left: `${(left / span) * 100}%`, width: `${(v / span) * 100}%`, background: seriesColor(i) }} />;
            })}
          </div>
        </div>
        <p className="note" style={{ marginTop: 'var(--space-3)' }}>{fmtNum(model.volume)} articles. The grey bar is that volume; the colour is frame hits ({fmtNum(hits)}).</p>
        <SeriesLegend series={model.series} />
      </Card>
    );
  }

  return (
    <Card padding={28}>
      <CardHead
        title="Match composition"
        sub="Stacked counts of frame matches, not shares. Frames overlap, so a stack can be taller than that week’s article count. The pale bar behind is article volume."
      >
        <TableToggle value={table} onChange={setTable} />
      </CardHead>
      {table ? (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr><th>Week</th><th className="num">Articles</th>{model.series.map(se => <th key={se.id} className="num">{se.label}</th>)}</tr>
            </thead>
            <tbody>
              {weeks.map(w => (
                <tr key={w.week.week}>
                  <td>{w.week.week}</td>
                  <td className="num">{fmtNum(w.volume)}</td>
                  {w.counts.map((c, i) => <td key={model.series[i].id} className="num">{fmtNum(c)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="chart" ref={ref}>
          <svg height={H} role="img" aria-label="Weekly frame hits stacked against article volume">
            {[0, 0.5, 1].map(f => (
              <g key={f}>
                <line className="grid-line" x1={M.l} x2={width - M.r} y1={y(f * yMax)} y2={y(f * yMax)} />
                <text className="axis-text" x={M.l - 8} y={y(f * yMax) + 4} textAnchor="end">{fmtNum(Math.round(f * yMax))}</text>
              </g>
            ))}
            {weeks.map((w, k) => {
              const x = M.l + k * slot + (slot - barW) / 2;
              let acc = 0;
              return (
                <g key={w.week.week}>
                  {w.volume > 0 && <rect x={x} y={y(w.volume)} width={barW} height={y(0) - y(w.volume)} fill="var(--grey-100)" rx={2} />}
                  {w.counts.map((c, i) => {
                    const yy = y(acc + c);
                    const h = y(acc) - yy;
                    acc += c;
                    return c > 0 && <rect key={model.series[i].id} x={x + barW * 0.18} y={yy} width={barW * 0.64} height={Math.max(0, h)} fill={seriesColor(i)} />;
                  })}
                  {(k % Math.max(1, Math.ceil(n / 6)) === 0) && (
                    <text className="axis-text" x={x + barW / 2} y={H - 8} textAnchor="middle">{fmtWeek(w.week)}</text>
                  )}
                </g>
              );
            })}
            <rect x={M.l} y={M.t} width={iw} height={ih} fill="transparent"
              onPointerMove={e => {
                const box = e.currentTarget.getBoundingClientRect();
                const k = Math.floor(((e.clientX - box.left) / iw) * n);
                setHover(Math.max(0, Math.min(n - 1, k)));
              }}
              onPointerLeave={() => setHover(null)} />
          </svg>
          {hover != null && weeks[hover] && (
            <ChartTip x={Math.min(Math.max(M.l + hover * slot + slot / 2, 120), width - 120)} y={M.t + 8} title={`${weeks[hover].week.week} · ${fmtWeek(weeks[hover].week)}`}>
              <div className="tip-row"><span className="v">{fmtNum(weeks[hover].volume)}</span><span className="k">articles</span></div>
              {model.series.map((se, i) => (
                <div key={se.id} className="tip-row">
                  <span className="tip-key" style={{ background: seriesColor(i), height: 8 }} />
                  <span className="v">{fmtNum(weeks[hover].counts[i])}</span>
                  <span className="k">{se.label}</span>
                </div>
              ))}
            </ChartTip>
          )}
        </div>
      )}
      <SeriesLegend series={model.series} />
    </Card>
  );
}

function ecdfPath(points, xOf, yOf) {
  if (!points.length) return '';
  return points.map((p, i) => `${i ? 'L' : 'M'}${xOf(p.lag).toFixed(1)},${yOf(p.p).toFixed(1)}`).join('');
}

export function LagEcdf({ ecdf }) {
  const [ref, width] = useWidth(640);
  const [hover, setHover] = React.useState(null);
  const [table, setTable] = React.useState(false);
  const H = 280;
  const M = { t: 16, r: 16, b: 36, l: 44 };
  const iw = Math.max(40, width - M.l - M.r);
  const ih = H - M.t - M.b;
  const maxLag = Math.max(...ecdf.observed.lags, ...ecdf.generated.lags, 1);
  const xMax = niceMax(maxLag);
  const x = v => M.l + (v / xMax) * iw;
  const y = p => M.t + ih - p * ih;
  const curves = [
    { id: 'observed', label: 'Observed', stroke: 'var(--accent-primary)', width: 2.5, ...ecdf.observed },
    { id: 'generated', label: 'Generated', stroke: 'var(--grey-500)', width: 1.75, ...ecdf.generated },
  ];

  return (
    <Card padding={28}>
      <CardHead
        title="Pickup lag"
        sub="Cumulative share of cross-outlet edges by absolute lag. The accent curve is observed. Grey is generated. Marks sit on each median."
      >
        <TableToggle value={table} onChange={setTable} />
      </CardHead>
      {table ? (
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>Set</th><th className="num">Edges</th><th className="num">Median</th><th className="num">Shortest</th><th className="num">Longest</th></tr></thead>
            <tbody>
              {curves.map(c => (
                <tr key={c.id}>
                  <td>{c.label}</td>
                  <td className="num">{fmtNum(c.n)}</td>
                  <td className="num">{fmtHours(c.median)}</td>
                  <td className="num">{c.lags.length ? fmtHours(c.lags[0]) : '–'}</td>
                  <td className="num">{c.lags.length ? fmtHours(c.lags[c.lags.length - 1]) : '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="chart" ref={ref}>
          <svg height={H} role="img" aria-label="Empirical distribution of pickup lag">
            {[0, 0.25, 0.5, 0.75, 1].map(p => (
              <g key={p}>
                <line className="grid-line" x1={M.l} x2={width - M.r} y1={y(p)} y2={y(p)} />
                <text className="axis-text" x={M.l - 8} y={y(p) + 4} textAnchor="end">{Math.round(p * 100)}%</text>
              </g>
            ))}
            {[0, 0.5, 1].map(f => (
              <text key={f} className="axis-text" x={x(f * xMax)} y={H - 10} textAnchor="middle">{fmtHours(f * xMax)}</text>
            ))}
            {curves.map(c => (
              <g key={c.id}>
                <path d={ecdfPath(c.points, x, y)} fill="none" stroke={c.stroke} strokeWidth={c.width} strokeLinejoin="round" />
                {c.median != null && (
                  <g>
                    <line x1={x(c.median)} x2={x(c.median)} y1={y(0)} y2={y(0.5)} stroke={c.stroke} strokeDasharray="3 3" />
                    <circle cx={x(c.median)} cy={y(0.5)} r={4} fill={c.stroke} stroke="var(--white)" strokeWidth={2} />
                  </g>
                )}
              </g>
            ))}
            <rect x={M.l} y={M.t} width={iw} height={ih} fill="transparent"
              onPointerMove={e => {
                const box = e.currentTarget.getBoundingClientRect();
                setHover(M.l + ((e.clientX - box.left) / box.width) * iw);
              }}
              onPointerLeave={() => setHover(null)} />
          </svg>
          {hover != null && (
            <ChartTip x={Math.min(Math.max(hover, 100), width - 100)} y={M.t + 8} title={fmtHours(((hover - M.l) / iw) * xMax)}>
              {curves.map(c => {
                const lag = ((hover - M.l) / iw) * xMax;
                const hit = c.points.filter(p => p.lag <= lag).length;
                return (
                  <div key={c.id} className="tip-row">
                    <span className="tip-key" style={{ background: c.stroke, height: 8 }} />
                    <span className="v">{c.n ? fmtPct((hit / c.n) * 100, 0) : '–'}</span>
                    <span className="k">{c.label}</span>
                  </div>
                );
              })}
            </ChartTip>
          )}
          <div className="stat-legend">
            {curves.map(c => (
              <span key={c.id}><i className="stat-dot" style={{ background: c.stroke }} />{c.label} · median {fmtHours(c.median)} · n {fmtNum(c.n)}</span>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

export function RankGradient({ model }) {
  const [ref, width] = useWidth(640);
  const [hover, setHover] = React.useState(null);
  const [table, setTable] = React.useState(false);
  const H = 320;
  const M = { t: 16, r: 16, b: 64, l: 44 };
  const iw = Math.max(40, width - M.l - M.r);
  const ih = H - M.t - M.b;
  const yMax = niceMax(Math.max(...model.dots.map(d => d.share), 1));
  const y = v => M.t + ih - (v / yMax) * ih;
  const ranks = model.ranks;
  const col = ranks.length ? iw / ranks.length : iw;
  const maxN = Math.max(...model.dots.map(d => d.n), 1);
  const radius = d => (d.n ? 4 + 11 * Math.sqrt(d.n / maxN) : 3);
  const byRank = Object.fromEntries(ranks.map(rank => [rank, model.dots.filter(d => d.rank === rank)]));

  const placed = model.dots.map(d => {
    const mates = byRank[d.rank];
    const sources = [...new Set(mates.map(m => m.source.id))];
    const si = sources.indexOf(d.source.id);
    const fi = model.series.findIndex(s => s.id === d.series.id);
    const cx = M.l + ranks.indexOf(d.rank) * col + col / 2 + (si - (sources.length - 1) / 2) * 16;
    return { ...d, cx, cy: y(d.share), r: radius(d), color: seriesColor(Math.max(0, fi)) };
  });

  return (
    <Card padding={28}>
      <CardHead
        title="Share by catalogue rank"
        sub="Each dot is one outlet’s all-window share for a frame. Size is the number of matching articles. The range filter does not slice these, so generated weekly curves are not used."
      >
        <TableToggle value={table} onChange={setTable} />
      </CardHead>
      {table ? (
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>Rank</th><th>Outlet</th><th>Frame</th><th className="num">Share</th><th className="num">Hits</th><th className="num">Articles</th></tr></thead>
            <tbody>
              {model.dots.map(d => (
                <tr key={`${d.source.id}-${d.series.id}`}>
                  <td>{d.rankLabel}</td>
                  <td>{shortName(d.source)}</td>
                  <td>{d.series.label}</td>
                  <td className="num">{fmtPct(d.share, 2)}</td>
                  <td className="num">{fmtNum(d.n)}</td>
                  <td className="num">{fmtNum(d.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="chart" ref={ref}>
          <svg height={H} role="img" aria-label="Frame share by catalogue rank">
            {[0, 0.5, 1].map(f => (
              <g key={f}>
                <line className="grid-line" x1={M.l} x2={width - M.r} y1={y(f * yMax)} y2={y(f * yMax)} />
                <text className="axis-text" x={M.l - 8} y={y(f * yMax) + 4} textAnchor="end">{+((f * yMax).toFixed(1))}%</text>
              </g>
            ))}
            {ranks.map((rank, i) => {
              const sample = byRank[rank][0];
              const label = sample?.rankLabel || `Rank ${rank}`;
              return (
                <text key={rank} className="axis-text" x={M.l + i * col + col / 2} y={H - 28} textAnchor="middle">
                  <tspan x={M.l + i * col + col / 2} dy="0">Rank {rank}</tspan>
                  <tspan x={M.l + i * col + col / 2} dy="14">{label.length > 28 ? `${label.slice(0, 27)}…` : label}</tspan>
                </text>
              );
            })}
            {placed.map(d => (
              <circle
                key={`${d.source.id}-${d.series.id}`}
                cx={d.cx}
                cy={d.cy}
                r={d.r}
                fill={d.color}
                fillOpacity={d.n ? 0.9 : 0.25}
                stroke="var(--white)"
                strokeWidth={1.5}
                onMouseEnter={() => setHover(d)}
                onMouseLeave={() => setHover(null)}
              >
                <title>{`${shortName(d.source)} · ${d.series.label} · ${fmtPct(d.share, 2)}`}</title>
              </circle>
            ))}
          </svg>
          {hover && (
            <ChartTip x={Math.min(Math.max(hover.cx, 120), width - 120)} y={hover.cy} title={hover.series.label}>
              <div className="tip-row is-focus"><span className="v">{fmtPct(hover.share, 2)}</span><span className="k">{shortName(hover.source)}</span></div>
              <div className="tip-row"><span className="v">{fmtNum(hover.n)}</span><span className="k">of {fmtNum(hover.total)} articles</span></div>
            </ChartTip>
          )}
          <SeriesLegend series={model.series} />
        </div>
      )}
    </Card>
  );
}
