import React from 'react';
import { ExternalLink, Quote } from 'lucide-react';
import { Card, Badge, Tag } from '../ds/index.js';
import { CardHead, Highlighted, Sparkline } from '../components/shared.jsx';
import { Timeline } from '../components/Timeline.jsx';
import { VolumeShareChart } from '../components/StatCharts.jsx';
import { shortName } from '../components/Heatmap.jsx';
import { cell, visibleSeries, rankedSources, fmtDate, fmtPct, fmtNum, fmtWeek, movers, focusTrailing, weeklyObserved, volumeShare } from '../data/derive.js';

function NarrativeRail({ data, kind, lo, hi, value, onChange }) {
  const mv = Object.fromEntries(movers(data, kind, lo, hi).map(m => [m.series.id, m]));
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 'var(--space-4)' }} role="radiogroup" aria-label="Narrative">
      {visibleSeries(data, kind).map(se => {
        const on = se.id === value;
        const m = mv[se.id];
        return (
          <button key={se.id} role="radio" aria-checked={on} onClick={() => onChange(se.id)}
            style={{
              textAlign: 'left', cursor: 'pointer', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)',
              border: `var(--border-width-md) solid ${on ? 'var(--accent-primary)' : 'var(--ink)'}`,
              background: on ? 'var(--accent-primary-soft)' : 'var(--paper)',
              boxShadow: on ? 'var(--shadow-hard-accent-md)' : 'var(--shadow-hard-sm)',
              transform: on ? 'translate(-2px,-2px)' : 'none', font: 'inherit', color: 'inherit',
              transition: 'transform var(--duration-fast) var(--ease-out-back), box-shadow var(--duration-fast) var(--ease-standard), background var(--duration-fast) var(--ease-standard)',
              display: 'flex', flexDirection: 'column', gap: 'var(--space-2)',
            }}>
            <span className="eyebrow">{se.target}</span>
            <span className="row-title">{se.label}</span>
            {m && <Sparkline values={m.spark} width={150} height={26} />}
          </button>
        );
      })}
    </div>
  );
}

function Carriers({ data, series, lo, hi, focus, onFocus }) {
  const rows = rankedSources(data).map(src => ({ src, ...cell(src, series.id, lo, hi, data.weeks) })).sort((a, b) => (b.share ?? -1) - (a.share ?? -1));
  const max = Math.max(0.01, ...rows.map(r => r.share || 0));
  return (
    <Card padding={28}>
      <CardHead title="Which outlets are running it" sub="Share of each outlet’s articles in range. Click to focus." />
      <div className="list">
        {rows.map((r, k) => {
          const on = r.src.id === focus;
          return (
            <button key={r.src.id} className="list-row" style={{ gridTemplateColumns: '120px 1fr 64px' }} onClick={() => onFocus(r.src.id)} aria-pressed={on}>
              <span className="row-title" style={{ fontSize: 'var(--text-xs)', color: on ? 'var(--burgundy)' : undefined }}>{shortName(r.src)}</span>
              <span style={{ height: 14, background: 'var(--paper-deep)', borderRadius: 4, overflow: 'hidden' }}>
                <span style={{
                  display: 'block', height: '100%', borderRadius: 4,
                  width: r.total ? `${((r.share || 0) / max) * 100}%` : 0,
                  background: on ? 'var(--accent-primary)' : 'var(--ink)',
                  transition: `width var(--duration-slow) var(--ease-out-back) ${k * 30}ms, background var(--duration-fast)`,
                }} />
              </span>
              <span className="mono" style={{ textAlign: 'right', fontSize: 'var(--text-xs)' }}>{r.total ? fmtPct(r.share, 2) : 'n/c'}</span>
            </button>
          );
        })}
      </div>
      <p className="note" style={{ marginTop: 'var(--space-3)' }}>n/c means this outlet has no observed weekly counts in the range. All weeks uses the crawled total.</p>
    </Card>
  );
}

function Evidence({ data, series, focus, onlyFocus, setOnlyFocus }) {
  const quotes = data.sources.flatMap(src => {
    const s = src.series.find(x => x.id === series.id);
    return (s?.quotes || []).map(q => ({ ...q, source: src }));
  }).filter(q => !onlyFocus || q.source.id === focus).sort((a, b) => b.date.localeCompare(a.date));
  const focusSrc = data.sources.find(s => s.id === focus);
  return (
    <Card padding={28}>
      <CardHead title="Evidence" sub="Sentences that matched this narrative. Matches are highlighted.">
        {onlyFocus
          ? <Tag onRemove={() => setOnlyFocus(false)}>{shortName(focusSrc)}</Tag>
          : <button className="chip" onClick={() => setOnlyFocus(true)}>Only {shortName(focusSrc)}</button>}
      </CardHead>
      {quotes.length === 0 ? (
        <div className="empty">No matching sentence from {shortName(focusSrc)} in the sample. Try another outlet.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', maxHeight: 560, overflow: 'auto', padding: '2px 6px 6px 2px' }}>
          {quotes.map((q, i) => (
            <figure key={q.url + i} className="quote" style={{ margin: 0, animationDelay: `${i * 40}ms` }}>
              <blockquote><Quote size={14} strokeWidth={3} style={{ color: 'var(--accent-primary)', marginRight: 6, verticalAlign: -1 }} /><Highlighted text={q.quote} pattern={series.pattern} /></blockquote>
              <figcaption className="quote-meta">
                <Badge tone={q.source.id === focus ? 'primary' : 'neutral'}>{shortName(q.source)}</Badge>
                <span className="mono">{fmtDate(q.date)}</span>
                <a href={q.url} target="_blank" rel="noreferrer noopener">{q.title} <ExternalLink size={12} style={{ verticalAlign: -1 }} /></a>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </Card>
  );
}

export function Narratives({ data, filters, focus, setFocus }) {
  const { lo, hi, kind, metric } = filters;
  const [onlyFocus, setOnlyFocus] = React.useState(false);
  const list = visibleSeries(data, kind);
  const series = list.find(s => s.id === focus.series) || list[0];
  if (!series) return <div className="empty">No narratives to show.</div>;
  const peakSrc = data.sources.find(s => s.id === focus.source) || rankedSources(data)[0];
  const observed = peakSrc && weeklyObserved(peakSrc);
  const trail = observed ? focusTrailing(data, focus.source, series.id, lo, hi) : null;
  const volume = volumeShare(data, peakSrc, series.id, lo, hi);

  return (
    <>
      <NarrativeRail data={data} kind={kind} lo={lo} hi={hi} value={series.id} onChange={id => setFocus({ ...focus, series: id })} />
      {observed && trail && (
        <p className="note" style={{ margin: 0 }}>
          Loudest week for {shortName(peakSrc)}: week of <strong className="mono" style={{ color: 'var(--text-primary)' }}>{fmtWeek(trail.week)}</strong>, {fmtNum(trail.n)} matching articles, {fmtPct(trail.share, 2)} of what it published.
        </p>
      )}
      {observed && !trail && (
        <p className="note" style={{ margin: 0 }}>
          Not enough earlier weeks to compare {shortName(peakSrc)} with its usual level.
        </p>
      )}
      {!observed && peakSrc && (
        <p className="note" style={{ margin: 0 }}>
          Week-by-week counts for {shortName(peakSrc)} are estimated. Shares use the crawled total when the range is all weeks.
        </p>
      )}
      <Timeline data={data} series={series} metric={metric} lo={lo} hi={hi} focus={focus.source} onFocus={id => setFocus({ ...focus, source: id })} />
      <VolumeShareChart model={volume} seriesLabel={series.label} />
      <div className="grid grid-2">
        <Evidence data={data} series={series} focus={focus.source} onlyFocus={onlyFocus} setOnlyFocus={setOnlyFocus} />
        <Carriers data={data} series={series} lo={lo} hi={hi} focus={focus.source} onFocus={id => setFocus({ ...focus, source: id })} />
      </div>
    </>
  );
}
