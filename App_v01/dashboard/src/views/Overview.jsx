import React from 'react';
import { FileText, Library, Share2, Timer, TrendingUp, Zap } from 'lucide-react';
import { Card, Badge } from '../ds/index.js';
import { AnimatedNumber, CardHead, Sparkline } from '../components/shared.jsx';
import { Heatmap, shortName } from '../components/Heatmap.jsx';
import { Origin } from './Propagation.jsx';
import { kpis, spikes, movers, visibleSeries, fmtWeek, fmtPct, fmtNum } from '../data/derive.js';

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

export function Overview({ data, filters, focus, onDrill, onOpen }) {
  const { lo, hi, kind, metric } = filters;
  const k = kpis(data, kind, lo, hi);
  const seriesList = visibleSeries(data, kind);
  const sp = spikes(data, kind, lo, hi).slice(0, 6);
  const mv = movers(data, kind, lo, hi).slice(0, 6);
  const lagH = k.medianLag;

  return (
    <>
      <section className="story-beat">
        <h2 className="story-title">This week</h2>
        <p className="story-lead">
          <strong className="mono">{fmtNum(k.hits)}</strong> articles in the scanned outlets matched a tracked pro-Kremlin narrative, across <strong className="mono">{fmtNum(k.sources)}</strong> outlets scanned.
        </p>
        <div className="grid grid-kpi">
          <Kpi icon={Library} label="Outlets scanned" value={k.sources}
            foot={<>{k.active} published in this range</>} />
          <Kpi icon={FileText} label="Matching articles" value={k.hits}
            foot={<>{k.hitsPer100.toFixed(1)} per 100 articles scanned</>} />
          <Kpi icon={Share2} label="Pickups between outlets" value={k.observedEdges}
            foot={<>seen in the crawl</>} />
          <Kpi icon={Timer} label="Typical delay" value={lagH == null ? null : (lagH >= 48 ? lagH / 24 : lagH)} decimals={1} suffix={lagH == null ? null : (lagH >= 48 ? 'days' : 'hours')}
            foot={<>from first publish to the outlet that repeated it</>} />
        </div>
      </section>

      <section className="story-beat">
        <h2 className="story-title">What this page is</h2>
        <p className="story-copy">
          This screen is the week. <button type="button" className="text-link" onClick={() => onOpen('narratives')}>Narratives</button> is one story and the sentences that matched. <button type="button" className="text-link" onClick={() => onOpen('origin')}>Origin</button> is who repeated whom. <button type="button" className="text-link" onClick={() => onOpen('sources')}>Sources</button> is the outlet list.
        </p>
        <p className="story-copy">These are the crawled outlets (Apolut, Anti-Spiegel, RT DE, and the rest), not the German mainstream.</p>
      </section>

      <section className="story-beat">
        <Heatmap data={data} seriesList={seriesList} lo={lo} hi={hi} metric={metric} selected={focus}
          onSelect={(source, series) => onDrill({ source, series })} />
      </section>

      <section className="story-beat">
        <div className="grid grid-2-even">
          <Card padding={28}>
            <CardHead title="Spikes" sub="A narrative’s share jumped above its recent weeks." />
            {sp.length === 0 ? <div className="empty">No spikes in this range. Widen the range.</div> : (
              <div className="list">
                {sp.map(s => (
                  <button key={`${s.source.id}-${s.series.id}-${s.i}`} className="list-row" style={{ gridTemplateColumns: 'auto 1fr auto' }}
                    onClick={() => onDrill({ source: s.source.id, series: s.series.id })}>
                    <Badge tone={s.z >= 3 ? 'danger' : 'warning'}><Zap size={11} strokeWidth={3} style={{ marginRight: 4 }} />Spike</Badge>
                    <div>
                      <div className="row-title">{s.series.label} <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>in</span> {shortName(s.source)}</div>
                      <div className="row-sub">Week of {fmtWeek(s.week)} · {s.n} matching articles</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="mono" style={{ fontWeight: 700 }}>{fmtPct(s.share, 1)}</div>
                      <div className="row-sub mono">usual {fmtPct(s.baseline, 1)}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Card>

          <Card padding={28}>
            <CardHead title="Movers" sub="Share in the last four weeks versus the weeks before." />
            <div className="list">
              {mv.map(m => (
                <button key={m.series.id} className="list-row" style={{ gridTemplateColumns: '1fr auto auto' }}
                  onClick={() => onDrill({ series: m.series.id })}>
                  <div>
                    <div className="row-title">{m.series.label}</div>
                    <div className="row-sub">{m.series.target}</div>
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
      </section>

      <section className="story-beat">
        <h2 className="story-title">Who influences whom</h2>
        <Origin data={data} preview onOpen={() => onOpen('origin')} />
      </section>

      <p className="note">
        How we count. Articles match a narrative when the text hits a simple pattern. Narratives are not split into national and geopolitical. Links on the map are pickups between outlets.
      </p>
    </>
  );
}
