import React from 'react';
import { Plus, GripVertical, Sparkles, LayoutGrid } from 'lucide-react';
import { JOBS, METAS } from '../report/registry.js';
import { presets } from '../report/spec.js';
import { Preview } from './Preview.jsx';

function Card({ item, bundle, filters, onAdd, onDragStart }) {
  return (
    <div
      className="st-card"
      onPointerDown={e => { if (e.button === 0 && !e.target.closest('button')) onDragStart(e, item); }}
      title="Drag onto the page, or press +"
    >
      <div className="st-card-head">
        <GripVertical size={14} className="st-grip" aria-hidden="true" />
        <div className="st-card-title">{item.title}</div>
        <span className="st-size">{item.size.w}×{item.size.h}</span>
        <button type="button" className="st-icon" onClick={() => onAdd(item)} aria-label={`Add ${item.title}`}><Plus size={15} /></button>
      </div>
      <Preview viz={item.viz} params={item.params} size={item.size} bundle={bundle} filters={filters} />
      {item.reason && <p className="st-reason">{item.reason}</p>}
    </div>
  );
}

export function Gallery({ bundle, filters, rec, onAdd, onDragStart }) {
  const [tab, setTab] = React.useState('suggested');
  const all = React.useMemo(() => JOBS.map(job => ({
    job,
    items: Object.values(METAS).filter(m => m.job === job.id).map(m => {
      const ok = m.requires ? m.requires(bundle) : true;
      const top = rec.suggestions.find(s => s.viz === m.id);
      return {
        key: m.id, viz: m.id, title: m.title, params: top?.params || {},
        size: top?.size || presets(m)[0] || m.sizes.min,
        reason: ok === true ? m.description : `Not available: ${typeof ok === 'string' ? ok : 'not enough data'}`,
        disabled: ok !== true,
      };
    }),
  })).filter(g => g.items.length), [bundle, rec]);

  return (
    <aside className="st-panel st-gallery" aria-label="Visualizations">
      <div className="st-tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'suggested'} onClick={() => setTab('suggested')}><Sparkles size={14} />Suggested</button>
        <button role="tab" aria-selected={tab === 'all'} onClick={() => setTab('all')}><LayoutGrid size={14} />All</button>
      </div>
      <div className="st-panel-scroll">
        {tab === 'suggested' ? (
          <>
            <p className="st-hint">Ranked by what this bundle shows. Drag one onto the page.</p>
            {rec.suggestions.map(s => <Card key={s.key} item={s} bundle={bundle} filters={filters} onAdd={onAdd} onDragStart={onDragStart} />)}
            {rec.unavailable.length > 0 && (
              <div className="st-unavailable">
                {rec.unavailable.map(u => <p key={u.viz}><strong>{METAS[u.viz]?.title}</strong>: {u.reason}</p>)}
              </div>
            )}
          </>
        ) : all.map(g => (
          <section key={g.job.id} className="st-group">
            <h3 className="st-group-title">{g.job.label}</h3>
            {g.items.map(it => (it.disabled
              ? <p key={it.key} className="st-unavailable"><strong>{it.title}</strong>: {it.reason.replace('Not available: ', '')}</p>
              : <Card key={it.key} item={it} bundle={bundle} filters={filters} onAdd={onAdd} onDragStart={onDragStart} />))}
          </section>
        ))}
      </div>
    </aside>
  );
}
