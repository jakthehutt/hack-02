import React from 'react';
import { Trash2, Copy, Shuffle } from 'lucide-react';
import { METAS, JOBS } from '../report/registry.js';
import { presets, sizeLimits, fitsLimits, blockParams, RANGES, METRICS } from '../report/spec.js';
import { resolveBlock } from '../report/sheet/Block.jsx';
import { REGISTRY } from '../report/registry.js';
import { collides, nearestFree } from './dnd.js';

const RANGE_LABELS = { all: 'All weeks', 12: 'Last 12 wk', 4: 'Last 4 wk' };
const METRIC_LABELS = { share: 'Share %', count: 'Articles' };

function Field({ label, children, hint }) {
  return (
    <label className="st-field">
      <span className="st-field-label">{label}</span>
      {children}
      {hint && <span className="st-field-hint">{hint}</span>}
    </label>
  );
}

function Segmented({ value, options, onChange }) {
  return (
    <div className="st-seg" role="radiogroup">
      {options.map(o => (
        <button key={String(o.value)} type="button" role="radio" aria-checked={String(o.value) === String(value)} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

/** One input per declared param, from the viz's params schema. */
function ParamInput({ name, def, value, bundle, onChange }) {
  switch (def.type) {
    case 'enum':
      return def.options.length <= 3
        ? <Segmented value={value} options={def.options} onChange={v => onChange(typeof def.options[0].value === 'number' ? Number(v) : v)} />
        : <select className="st-input" value={value ?? ''} onChange={e => onChange(e.target.value)}>{def.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>;
    case 'multi':
      return (
        <div className="st-checks">
          {def.options.map(o => {
            const on = (value || []).includes(o.value);
            return (
              <label key={o.value} className="st-check">
                <input type="checkbox" checked={on} onChange={() => onChange(on ? value.filter(v => v !== o.value) : [...(value || []), o.value])} />{o.label}
              </label>
            );
          })}
        </div>
      );
    case 'int':
      return <input className="st-input" type="number" min={def.min} max={def.max} value={value ?? ''} onChange={e => onChange(Math.max(def.min ?? -Infinity, Math.min(def.max ?? Infinity, Number(e.target.value) || 0)))} />;
    case 'bool':
      return <label className="st-check"><input type="checkbox" checked={!!value} onChange={e => onChange(e.target.checked)} />{value ? 'On' : 'Off'}</label>;
    case 'text':
      return def.multiline
        ? <textarea className="st-input st-textarea" rows={6} value={value ?? ''} onChange={e => onChange(e.target.value)} />
        : <input className="st-input" value={value ?? ''} onChange={e => onChange(e.target.value)} />;
    case 'series':
      return <select className="st-input" value={value ?? ''} onChange={e => onChange(e.target.value)}>{bundle.series.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select>;
    case 'source': {
      const list = bundle.sources.filter(s => !def.observedOnly || s.weekly_observed);
      return (
        <select className="st-input" value={value ?? ''} onChange={e => onChange(e.target.value)}>
          {def.optional && <option value="">Any outlet</option>}
          {list.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      );
    }
    default:
      return <code>{name}: unsupported param type {def.type}</code>;
  }
}

const ISSUE_TEXT = {
  overflow: i => `Content is ${i.axis === 'y' ? 'taller' : 'wider'} than the block by ${i.mm} mm. Make the block ${i.axis === 'y' ? 'taller' : 'wider'}, or show less.`,
  'text-clipped': i => `“${i.text}” is cut off by ${i.mm} mm.`,
  'tiny-text': i => `Text below 6.5 pt (${i.pt} pt): “${i.text}”. Give the block more room.`,
  error: i => `It failed to draw: ${i.message}`,
};

function PageSettings({ spec, dispatch, fit }) {
  const used = spec.blocks.reduce((a, b) => a + b.w * b.h, 0);
  return (
    <>
      <h2 className="st-panel-title">Page</h2>
      <Field label="Title"><input className="st-input" value={spec.title} onChange={e => dispatch({ type: 'page', patch: { title: e.target.value } })} /></Field>
      <Field label="Subtitle"><input className="st-input" value={spec.subtitle} onChange={e => dispatch({ type: 'page', patch: { subtitle: e.target.value } })} /></Field>
      <Field label="Weeks"><Segmented value={spec.filters.range} options={RANGES.map(r => ({ value: r, label: RANGE_LABELS[r] }))} onChange={v => dispatch({ type: 'page', patch: { filters: { range: v } } })} /></Field>
      <Field label="Measure"><Segmented value={spec.filters.metric} options={METRICS.map(m => ({ value: m, label: METRIC_LABELS[m] }))} onChange={v => dispatch({ type: 'page', patch: { filters: { metric: v } } })} /></Field>
      <Field label="Paper" hint="Plain drops the tinted background for office printers that can't print to the edge.">
        <Segmented value={spec.page.paper} options={[{ value: 'tinted', label: 'Tinted' }, { value: 'plain', label: 'Plain' }]} onChange={v => dispatch({ type: 'page', patch: { page: { paper: v } } })} />
      </Field>
      <p className="st-meta">{spec.blocks.length} blocks · {used} of 48 cells used</p>
      {fit && fit.warnings.length > 0 && fit.warnings.map((w, i) => <p key={i} className="st-warn">{w.kind.replace(/-/g, ' ')}: “{w.text}”</p>)}
      <p className="st-hint">Select a block to change it. Drag a block to move it, drag its corner to resize. Arrow keys move the selected block, Shift + arrows resize it, Delete removes it.</p>
    </>
  );
}

export function Inspector({ spec, bundle, selected, dispatch, fit, rec, onToast }) {
  const block = spec.blocks.find(b => b.id === selected);
  if (!block) return <aside className="st-panel st-inspector" aria-label="Page settings"><div className="st-panel-scroll"><PageSettings spec={spec} dispatch={dispatch} fit={fit} /></div></aside>;

  const meta = METAS[block.viz];
  const r = resolveBlock(block, REGISTRY[block.viz], bundle, spec.filters);
  const params = meta ? blockParams(meta, block, bundle, spec.filters) : {};
  const report = fit?.blocks.find(b => b.id === block.id);
  const { min, max } = sizeLimits(meta);

  const resize = z => {
    const cand = { ...block, w: z.w, h: z.h, x: Math.min(block.x, 6 - z.w), y: Math.min(block.y, 8 - z.h) };
    const spot = collides(spec.blocks, cand, block.id) ? nearestFree(spec.blocks, cand, block.id) : cand;
    if (!spot) { onToast(`No free ${z.w}×${z.h} space on the page.`); return; }
    dispatch({ type: 'update', id: block.id, patch: { x: spot.x, y: spot.y, w: z.w, h: z.h } });
  };

  const swapTo = id => {
    const m = METAS[id];
    const lim = sizeLimits(m);
    const z = { w: Math.max(lim.min.w, Math.min(lim.max.w, block.w)), h: Math.max(lim.min.h, Math.min(lim.max.h, block.h)) };
    const cand = { ...block, ...z, x: Math.min(block.x, 6 - z.w), y: Math.min(block.y, 8 - z.h) };
    const spot = collides(spec.blocks, cand, block.id) ? nearestFree(spec.blocks, cand, block.id) : cand;
    if (!spot) { onToast(`${m.title} needs at least ${lim.min.w}×${lim.min.h}; there is no room.`); return; }
    const top = rec.suggestions.find(s => s.viz === id);
    dispatch({ type: 'update', id: block.id, patch: { viz: id, x: spot.x, y: spot.y, w: z.w, h: z.h, params: top?.params || {}, title: undefined } });
  };

  const alternatives = Object.values(METAS).filter(m => m.id !== block.viz && m.job === meta?.job && (m.requires?.(bundle) ?? true) === true);
  const sizes = [...presets(meta), { w: block.w, h: block.h }].filter((z, i, a) => a.findIndex(o => o.w === z.w && o.h === z.h) === i).sort((a, b) => a.w * a.h - b.w * b.h);

  return (
    <aside className="st-panel st-inspector" aria-label="Block settings">
      <div className="st-panel-scroll">
        <div className="st-insp-head">
          <div>
            {(() => { const job = JOBS.find(j => j.id === meta?.job)?.label ?? 'Block'; return job !== meta?.title && <div className="st-eyebrow">{job}</div>; })()}
            <h2 className="st-panel-title">{meta?.title ?? block.viz}</h2>
          </div>
          <div className="st-insp-actions">
            <button type="button" className="st-icon" title="Duplicate" aria-label="Duplicate block" onClick={() => {
              const spot = nearestFree(spec.blocks, { ...block, y: block.y + block.h });
              if (!spot) { onToast('No room for a copy.'); return; }
              dispatch({ type: 'add', block: { ...block, id: undefined, ...spot } });
            }}><Copy size={15} /></button>
            <button type="button" className="st-icon st-danger" title="Delete" aria-label="Delete block" onClick={() => dispatch({ type: 'remove', id: block.id })}><Trash2 size={15} /></button>
          </div>
        </div>
        {meta?.description && <p className="st-hint">{meta.description}</p>}

        {report && !report.ok && (
          <div className="st-issues" role="alert">
            {report.issues.map((i, k) => <p key={k}>{(ISSUE_TEXT[i.kind] || (x => x.kind))(i)}</p>)}
          </div>
        )}

        <Field label="Size" hint={`${min.w}×${min.h} up to ${max.w}×${max.h} cells`}>
          <div className="st-sizes">
            {sizes.map(z => (
              <button key={`${z.w}x${z.h}`} type="button" aria-pressed={z.w === block.w && z.h === block.h} disabled={!fitsLimits(meta, z)} onClick={() => resize(z)}>{z.w}×{z.h}</button>
            ))}
          </div>
        </Field>

        {meta?.frame?.title !== false && (
          <Field label="Title">
            <input className="st-input" value={typeof block.title === 'string' ? block.title : ''} placeholder={r.title}
              onChange={e => dispatch({ type: 'update', id: block.id, patch: { title: e.target.value || undefined } })} />
          </Field>
        )}
        <Field label="Caption" hint="One line under the block, e.g. a source or a caveat.">
          <input className="st-input" value={block.caption || ''} onChange={e => dispatch({ type: 'update', id: block.id, patch: { caption: e.target.value } })} />
        </Field>

        {Object.entries(meta?.params || {}).map(([name, def]) => (
          <Field key={name} label={def.label}>
            <ParamInput name={name} def={def} value={params[name]} bundle={bundle} onChange={v => dispatch({ type: 'params', id: block.id, patch: { [name]: v } })} />
          </Field>
        ))}

        {alternatives.length > 0 && (
          <Field label="Try another form">
            <div className="st-alts">
              {alternatives.map(m => <button key={m.id} type="button" onClick={() => swapTo(m.id)}><Shuffle size={13} />{m.title}</button>)}
            </div>
          </Field>
        )}
      </div>
    </aside>
  );
}
