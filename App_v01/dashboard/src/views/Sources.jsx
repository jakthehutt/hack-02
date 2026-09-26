import React from 'react';
import { Card, Badge, Tag, Tooltip } from '../ds/index.js';
import { CardHead } from '../components/shared.jsx';
import { coveredWeeks, fmtDate, fmtNum, fmtWeek, rankedSources } from '../data/derive.js';

function Coverage({ source, weeks, lo, hi }) {
  const cover = coveredWeeks(source, weeks);
  const max = Math.max(1, ...source.weekly_articles);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 40 }} aria-label="Weekly article volume">
      {weeks.map((w, i) => {
        const v = source.weekly_articles[i];
        const inRange = i >= lo && i <= hi;
        return (
          <Tooltip key={w.week} label={`${fmtWeek(w)} · ${cover[i] ? fmtNum(v) + ' articles' : 'not crawled'}`} style={{ flex: 1, height: '100%', alignItems: 'flex-end' }}>
            <span style={{
              display: 'block', width: '100%', borderRadius: '3px 3px 0 0',
              height: cover[i] && v ? `${Math.max(6, (v / max) * 100)}%` : 3,
              background: !cover[i] ? 'var(--grey-100)' : inRange ? 'var(--black)' : 'var(--grey-300)',
              transition: 'height var(--duration-slow) var(--ease-out-back), background var(--duration-fast)',
            }} />
          </Tooltip>
        );
      })}
    </div>
  );
}

function CrawlStack({ crawl }) {
  const parts = [
    { k: 'ok', label: 'Extracted', v: crawl.ok, c: 'var(--black)' },
    { k: 'reject', label: 'Rejected', v: crawl.reject, c: 'var(--grey-300)' },
    { k: 'error', label: 'Errors', v: crawl.error, c: 'var(--semantic-danger)' },
  ];
  const yieldPct = crawl.discovered ? (crawl.ok / crawl.discovered) * 100 : 0;
  return (
    <div>
      <div className="stack">{parts.map(p => p.v > 0 && <span key={p.k} style={{ flexGrow: p.v, background: p.c }} />)}</div>
      <div style={{ display: 'flex', gap: 'var(--space-4)', marginTop: 'var(--space-2)', flexWrap: 'wrap' }}>
        {parts.map(p => (
          <span key={p.k} className="row-sub" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: p.c }} />{p.label} <strong className="mono" style={{ color: 'var(--text-primary)' }}>{fmtNum(p.v)}</strong>
          </span>
        ))}
        <span className="row-sub" style={{ marginLeft: 'auto' }}>yield <strong className="mono" style={{ color: 'var(--text-primary)' }}>{yieldPct.toFixed(0)}%</strong></span>
      </div>
    </div>
  );
}

export function Sources({ data, filters, onOpen }) {
  const { lo, hi } = filters;
  const list = rankedSources(data);
  const partial = s => s.date_span.distinct_days < 30;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 'var(--space-6)' }}>
      {list.map(s => (
        <Card key={s.id} interactive padding={24}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)', alignItems: 'flex-start' }}>
            <div>
              <div className="eyebrow">Rank {s.rank} · {s.rank_label}</div>
              <h3 className="card-title" style={{ marginTop: 'var(--space-1)' }}>{s.name}</h3>
            </div>
            {partial(s) ? <Badge tone="warning">Partial</Badge> : <Badge tone="success">Full window</Badge>}
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)', margin: 'var(--space-4) 0', flexWrap: 'wrap' }}>
            <Tag>{s.control.replace(/_/g, ' ')}</Tag>
            <Tag>{s.language.toUpperCase()}</Tag>
            <Tag>{fmtDate(s.date_span.min)} – {fmtDate(s.date_span.max)}</Tag>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
            <span className="kpi-value" style={{ fontSize: 'var(--text-xl)' }}>{fmtNum(s.article_count)}</span>
            <span className="row-sub">articles over {s.date_span.distinct_days} days</span>
          </div>
          <Coverage source={s} weeks={data.weeks} lo={lo} hi={hi} />
          <div style={{ marginTop: 'var(--space-5)' }}>
            <CardHead title="Crawl" />
            <div style={{ marginTop: 'calc(-1 * var(--space-3))' }}><CrawlStack crawl={s.crawl} /></div>
          </div>
          <button className="chip" style={{ marginTop: 'var(--space-5)' }} onClick={() => onOpen(s.id)}>See narratives in {s.name.split(' (')[0].split(' / ')[0]} →</button>
        </Card>
      ))}
    </div>
  );
}
