import React from 'react';
import { Card } from '../ds/index.js';
import { CardHead, ChartTip, TableToggle, rampColor, rampInk } from './shared.jsx';
import { cell, fmtNum, fmtPct, metricValue, fmtValue, rankedSources } from '../data/derive.js';

/**
 * Source × narrative matrix. Rows follow the catalogue rank so the
 * state → covert → relay gradient reads top to bottom.
 */
export function Heatmap({ data, seriesList, lo, hi, metric, selected, onSelect }) {
  const [tip, setTip] = React.useState(null);
  const [table, setTable] = React.useState(false);
  const wrap = React.useRef(null);
  const sources = rankedSources(data);

  const rows = sources.map(src => ({
    src,
    cells: seriesList.map(se => ({ se, ...cell(src, se.id, lo, hi, data.weeks) })),
  }));
  const vals = rows.flatMap(r => r.cells.map(c => metricValue(c, metric))).filter(v => v != null && v > 0);
  const max = Math.max(...vals, 0.0001);
  const scale = v => (v == null ? null : metric === 'share' ? v / max : Math.sqrt(v / max));
  const labelCut = [...vals].sort((a, b) => b - a)[Math.floor(vals.length * 0.25)] ?? Infinity;

  const show = (e, r, c) => {
    const box = wrap.current.getBoundingClientRect();
    const t = e.currentTarget.getBoundingClientRect();
    setTip({ x: t.left - box.left + t.width / 2, y: t.top - box.top, r, c });
  };

  return (
    <Card padding={28}>
      <CardHead
        title="Where each narrative lives"
        sub={`${metric === 'share' ? 'Share of each outlet’s articles' : 'Articles'} matching a frame, by source. Click a cell to trace it over time.`}
      >
        <div className="scale-legend" aria-hidden="true">
          <span>0</span><span className="scale-bar" /><span className="mono">{fmtValue(max, metric)}</span>
        </div>
        <TableToggle value={table} onChange={setTable} />
      </CardHead>

      {table ? (
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>Source</th>{seriesList.map(se => <th key={se.id} className="num">{se.label}</th>)}</tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.src.id}>
                  <td>{r.src.name}</td>
                  {r.cells.map(c => <td key={c.se.id} className="num">{c.total ? fmtValue(metricValue(c, metric), metric) : '–'}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="chart heatmap-wrap" ref={wrap} onMouseLeave={() => setTip(null)}>
          <div className="heatmap" style={{ gridTemplateColumns: `minmax(150px, 190px) repeat(${seriesList.length}, minmax(44px, 1fr))` }}>
            <div />
            {seriesList.map(se => (
              <div key={se.id} lang="de" className={`hm-col-head${selected.series === se.id ? ' is-active' : ''}`}>
                {se.label}
              </div>
            ))}
            {rows.map((r, ri) => (
              <React.Fragment key={r.src.id}>
                <div className="hm-row-head">
                  <span className="name" title={r.src.name}><span className="hm-rank">R{r.src.rank}</span>{shortName(r.src)}</span>
                  <span className="meta">{fmtNum(r.cells[0]?.total)} articles</span>
                </div>
                {r.cells.map((c, ci) => {
                  const v = metricValue(c, metric);
                  const empty = !c.total;
                  const t = scale(v);
                  const isSel = selected.series === c.se.id && selected.source === r.src.id;
                  return (
                    <button
                      key={c.se.id}
                      className={`hm-cell${empty ? ' is-empty' : ''}${isSel ? ' is-selected' : ''}`}
                      style={empty ? { animationDelay: `${(ri + ci) * 18}ms` } : { background: rampColor(t), color: rampInk(t), animationDelay: `${(ri + ci) * 18}ms` }}
                      onMouseEnter={e => show(e, r, c)}
                      onFocus={e => show(e, r, c)}
                      onBlur={() => setTip(null)}
                      onClick={() => !empty && onSelect(r.src.id, c.se.id)}
                      aria-label={`${r.src.name}, ${c.se.label}: ${empty ? (c.generated ? 'weekly counts not observed' : 'not crawled in range') : fmtValue(v, metric)}`}
                      disabled={empty}
                    >
                      {empty ? '' : (v >= labelCut || isSel) && v > 0 ? (metric === 'share' ? v.toFixed(1) : fmtNum(v)) : ''}
                    </button>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
          {tip && (
            <ChartTip x={tip.x} y={tip.y} title={tip.c.se.label}>
              <div className="tip-row is-focus"><span className="v">{tip.c.total ? fmtPct(tip.c.share, 2) : '–'}</span><span className="k">{tip.r.src.name}</span></div>
              <div className="tip-row"><span className="v">{fmtNum(tip.c.n)}</span><span className="k">of {fmtNum(tip.c.total)} articles</span></div>
              {!tip.c.total && <div className="tip-row"><span className="k">{tip.c.generated ? 'Weekly counts for this outlet are generated. All weeks shows the crawled total.' : 'Not crawled in this range'}</span></div>}
            </ChartTip>
          )}
        </div>
      )}
    </Card>
  );
}

export function shortName(src) {
  return src.name.split(' (')[0].split(' / ')[0];
}
