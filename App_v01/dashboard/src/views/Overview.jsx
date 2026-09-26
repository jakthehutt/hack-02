import React from 'react';
import { FileText, Crosshair, Radio as RadioIcon, Timer, TrendingUp, Zap } from 'lucide-react';
import { Card, Badge } from '../ds/index.js';
import { AnimatedNumber, CardHead, Sparkline } from '../components/shared.jsx';
import { Heatmap, shortName } from '../components/Heatmap.jsx';
import { kpis, spikes, movers, visibleSeries, fmtWeek, fmtPct } from '../data/derive.js';

function Kpi({ icon: Icon, label, value, decimals, suffix, foot }) {
  return (
    <Card interactive padding={24}>
      <div className="kpi-label"><Icon size={14} strokeWidth={2.5} />{label}</div>
      <div className="kpi-value">
        {value == null ? '–' : <AnimatedNumber value={value} decimals={decimals} />}
        {suffix && value != null && <small>{suffix}</small>}
      </div>
      {foot && <div className="kpi-foot">{foot}</div>}
    </Card>
  );
}

export function Overview({ data, filters, focus, onDrill }) {
  const { lo, hi, kind, metric } = filters;
  const k = kpis(data, kind, lo, hi);
  const seriesList = visibleSeries(data, kind);
  const sp = spikes(data, kind, lo, hi).slice(0, 6);
  const mv = movers(data, kind, lo, hi).slice(0, 6);
  const lagH = k.medianLag;

  return (
    <>
      <div className="grid grid-kpi">
        <Kpi icon={FileText} label="Articles scanned" value={k.articles}
          foot={k.full
            ? <>{k.active} of {k.sources} outlets active</>
            : <>{k.active} of {k.sources} outlets have observed weeks in range</>} />
        <Kpi icon={Crosshair} label="Frame hits" value={k.hits}
          foot={<>{k.hitsPer100.toFixed(1)} per 100 articles</>} />
        <Kpi icon={RadioIcon} label="Propagation edges" value={k.edges}
          foot={<>{k.observedEdges} observed · rest generated</>} />
        <Kpi icon={Timer} label="Median pickup lag" value={lagH == null ? null : (lagH >= 48 ? lagH / 24 : lagH)} decimals={1} suffix={lagH == null ? null : (lagH >= 48 ? 'days' : 'hours')}
          foot={<>observed edges, first publish to relay</>} />
      </div>

      <Heatmap data={data} seriesList={seriesList} lo={lo} hi={hi} metric={metric} selected={focus}
        onSelect={(source, series) => onDrill({ source, series })} />

      <div className="grid grid-2-even">
        <Card padding={28}>
          <CardHead title="Spikes" sub="Trailing eight-week z-score of weekly share, current week excluded, at least 5 articles, z ≥ 1.8. Only outlets whose weekly counts were observed." />
          {sp.length === 0 ? <div className="empty">No spikes in this range. Widen the range or show all kinds.</div> : (
            <div className="list">
              {sp.map(s => (
                <button key={`${s.source.id}-${s.series.id}-${s.i}`} className="list-row" style={{ gridTemplateColumns: 'auto 1fr auto' }}
                  onClick={() => onDrill({ source: s.source.id, series: s.series.id })}>
                  <Badge tone={s.z >= 3 ? 'danger' : 'warning'}><Zap size={11} strokeWidth={3} style={{ marginRight: 4 }} />z {s.z.toFixed(1)}</Badge>
                  <div>
                    <div className="row-title">{s.series.label} <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>in</span> {shortName(s.source)}</div>
                    <div className="row-sub">Week of {fmtWeek(s.week)} · {s.n} articles</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="mono" style={{ fontWeight: 700 }}>{fmtPct(s.share, 1)}</div>
                    <div className="row-sub mono">base {fmtPct(s.baseline, 1)}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>

        <Card padding={28}>
          <CardHead title="Movers" sub="Pooled share among outlets with observed weekly counts. The shaded band is the last 4 weeks, against the weeks before. Gaps are weeks with no crawled volume." />
          <div className="list">
            {mv.map(m => (
              <button key={m.series.id} className="list-row" style={{ gridTemplateColumns: '1fr auto auto' }}
                onClick={() => onDrill({ series: m.series.id })}>
                <div>
                  <div className="row-title">{m.series.label}</div>
                  <div className="row-sub">{m.series.kind === 'frame' ? 'Frame' : 'Subject'} · {m.series.target}</div>
                </div>
                <Sparkline values={m.spark} split={m.split} />
                <div style={{ textAlign: 'right', minWidth: 76 }}>
                  <div className={`mono ${m.delta >= 0 ? 'delta-up' : 'delta-down'}`}>
                    {m.delta >= 0 ? <TrendingUp size={13} strokeWidth={3} style={{ verticalAlign: -1, marginRight: 3 }} /> : null}
                    {m.delta >= 0 ? '+' : '−'}{Math.abs(m.delta).toFixed(2)}pp
                  </div>
                  <div className="row-sub mono">{fmtPct(m.after, 2)}</div>
                </div>
              </button>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
