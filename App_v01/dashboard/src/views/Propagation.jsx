import React from 'react';
import { ArrowRight, MousePointerClick } from 'lucide-react';
import { Card, Badge, Checkbox, Switch, Button } from '../ds/index.js';
import { CardHead } from '../components/shared.jsx';
import { PropagationMap, LagHistogram } from '../components/PropagationMap.jsx';
import { shortName } from '../components/Heatmap.jsx';
import { RELATIONS, propagationLinks, lagHistogram, sourceById, fmtHours } from '../data/derive.js';

function RelationBars({ byRel, total }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      {RELATIONS.map(r => {
        const n = byRel[r.id] || 0;
        return (
          <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '110px 1fr 28px', alignItems: 'center', gap: 'var(--space-3)' }}>
            <span style={{ font: 'var(--font-label)' }}>{r.label}</span>
            <span style={{ height: 10, background: 'var(--grey-50)', borderRadius: 4 }}>
              <span style={{ display: 'block', height: '100%', width: `${total ? (n / total) * 100 : 0}%`, background: 'var(--black)', borderRadius: 4, transition: 'width var(--duration-slow) var(--ease-out-back)' }} />
            </span>
            <span className="mono" style={{ textAlign: 'right', fontWeight: 700, fontSize: 'var(--text-xs)' }}>{n}</span>
          </div>
        );
      })}
    </div>
  );
}

function Detail({ selection, links, byId, onClear }) {
  if (!selection) {
    const total = links.reduce((a, l) => a + l.count, 0);
    const top = [...links].sort((a, b) => b.count - a.count).slice(0, 4);
    const fastest = [...links].sort((a, b) => a.medianLag - b.medianLag)[0];
    return (
      <>
        <p className="note"><MousePointerClick size={16} style={{ flexShrink: 0 }} />Click an outlet or a link to see what flows through it.</p>
        <div style={{ margin: 'var(--space-5) 0' }}>
          <div className="eyebrow" style={{ marginBottom: 'var(--space-3)' }}>Busiest routes</div>
          {top.map(l => (
            <div key={l.key} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-2) 0', borderTop: '1.5px solid var(--grey-100)' }}>
              <span className="row-title" style={{ fontSize: 'var(--text-xs)' }}>{shortName(byId[l.from])}</span>
              <ArrowRight size={14} />
              <span className="row-title" style={{ fontSize: 'var(--text-xs)' }}>{shortName(byId[l.to])}</span>
              <span className="mono" style={{ marginLeft: 'auto', fontWeight: 700 }}>{l.count}</span>
            </div>
          ))}
        </div>
        {fastest && <p className="note">Fastest route: {shortName(byId[fastest.from])} → {shortName(byId[fastest.to])}, median {fmtHours(fastest.medianLag)}.</p>}
        <div className="eyebrow" style={{ marginTop: 'var(--space-5)', marginBottom: 'var(--space-3)' }}>By relation · {total} edges</div>
        <RelationBars byRel={links.reduce((acc, l) => { for (const [k, v] of Object.entries(l.byRel)) acc[k] = (acc[k] || 0) + v; return acc; }, {})} total={total} />
      </>
    );
  }

  const rel = selection.type === 'link' ? [selection] : links.filter(l => l.from === selection.id || l.to === selection.id);
  const edges = rel.flatMap(l => l.edges);
  const byRel = edges.reduce((a, e) => ({ ...a, [e.relation]: (a[e.relation] || 0) + 1 }), {});
  const examples = edges.filter(e => e.example_overlap).slice(0, 3);
  const title = selection.type === 'link'
    ? <>{shortName(byId[selection.from])} <ArrowRight size={18} style={{ verticalAlign: -3 }} /> {shortName(byId[selection.to])}</>
    : byId[selection.id].name;
  const lags = edges.map(e => Math.abs(e.lag_hours)).sort((a, b) => a - b);

  return (
    <>
      <div style={{ font: 'var(--font-h4)', fontSize: 'var(--text-lg)', marginBottom: 'var(--space-2)' }}>{title}</div>
      <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginBottom: 'var(--space-5)' }}>
        <Badge tone="primary">{edges.length} edges</Badge>
        {lags.length > 0 && <Badge>median {fmtHours(lags[Math.floor(lags.length / 2)])}</Badge>}
        {selection.type === 'node' && <Badge>rank {byId[selection.id].rank}</Badge>}
      </div>
      <RelationBars byRel={byRel} total={edges.length} />
      {selection.type === 'node' && (
        <div style={{ marginTop: 'var(--space-5)' }}>
          <div className="eyebrow" style={{ marginBottom: 'var(--space-2)' }}>Routes</div>
          {rel.map(l => (
            <div key={l.key} className="row-sub" style={{ display: 'flex', gap: 'var(--space-2)', padding: '3px 0' }}>
              <span>{l.from === selection.id ? `→ ${shortName(byId[l.to])}` : `← ${shortName(byId[l.from])}`}</span>
              <span className="mono" style={{ marginLeft: 'auto' }}>{l.count} · {fmtHours(l.medianLag)}</span>
            </div>
          ))}
        </div>
      )}
      {examples.length > 0 && (
        <div style={{ marginTop: 'var(--space-5)' }}>
          <div className="eyebrow" style={{ marginBottom: 'var(--space-2)' }}>Observed overlap</div>
          {examples.map((e, i) => (
            <div key={i} className="quote" style={{ padding: 'var(--space-3) var(--space-4)', marginBottom: 'var(--space-2)', borderWidth: 2 }}>
              <div style={{ font: 'var(--font-body-sm)' }}>“{e.example_overlap.trim()}”</div>
              <div className="quote-meta"><span>{e.relation.replace('_', ' ')}</span><span className="mono">{e.rule}</span><span className="mono">{fmtHours(Math.abs(e.lag_hours))}</span></div>
            </div>
          ))}
        </div>
      )}
      <div style={{ marginTop: 'var(--space-6)' }}><Button variant="secondary" size="sm" onClick={onClear}>Clear selection</Button></div>
    </>
  );
}

export function Propagation({ data }) {
  const [relations, setRelations] = React.useState(() => new Set(RELATIONS.map(r => r.id)));
  const [observedOnly, setObservedOnly] = React.useState(false);
  const [selection, setSelection] = React.useState(null);

  const scoped = React.useMemo(() => ({ ...data, edges: data.edges.filter(e => !observedOnly || !e.synthetic) }), [data, observedOnly]);
  const links = propagationLinks(scoped, relations);
  const byId = sourceById(data);
  const nodes = [...data.upstream, ...data.sources];
  const liveSel = selection?.type === 'link' ? links.find(l => l.key === selection.key) : selection;

  const flatEdges = links.flatMap(l => l.edges);
  const hl = liveSel ? new Set((liveSel.type === 'link' ? [liveSel] : links.filter(l => l.from === liveSel.id || l.to === liveSel.id)).flatMap(l => l.edges)) : null;

  const toggle = id => setRelations(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  return (
    <>
      <div className="filters">
        {RELATIONS.map(r => <Checkbox key={r.id} label={r.label} checked={relations.has(r.id)} onChange={() => toggle(r.id)} />)}
        <span style={{ width: 1, height: 28, background: 'var(--grey-200)', margin: '0 var(--space-2)' }} />
        <Switch checked={observedOnly} onChange={setObservedOnly} label={`Observed edges only (${data.edges.filter(e => !e.synthetic).length})`} />
      </div>

      <div className="grid grid-2">
        <Card padding={28}>
          <CardHead title="How content travels" sub="Links are pickups between outlets; width is the number of edges, and flow speed tracks median lag." />
          {links.length ? (
            <PropagationMap nodes={nodes} links={links} selected={liveSel} onSelect={setSelection} />
          ) : <div className="empty">No edges match. Turn a relation back on.</div>}
        </Card>
        <Card padding={28}>
          <CardHead title={selection ? 'Selection' : 'Summary'} />
          <Detail selection={liveSel} links={links} byId={byId} onClear={() => setSelection(null)} />
        </Card>
      </div>

      <Card padding={28}>
        <CardHead title="Pickup lag" sub={hl ? 'Edges in the current selection are shown in the accent.' : 'Hours between the origin article and the relay. Hover a bar for counts.'} />
        <LagHistogram bins={lagHistogram(flatEdges)} highlight={hl} />
        <p className="note">Edges with a negative lag (the relay was published first, e.g. a cited source updated later) are counted by absolute lag.</p>
      </Card>
    </>
  );
}
