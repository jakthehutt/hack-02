import React from 'react';
import { Radar, Undo2, Redo2, Wand2, FolderOpen, Save, FileDown, Printer, FileCode2, Link2, CheckCircle2, AlertTriangle, ArrowLeft } from 'lucide-react';
import { Button, Toast } from '../ds/index.js';
import { REGISTRY, METAS } from '../report/registry.js';
import { Sheet } from '../report/sheet/Sheet.jsx';
import { recommend } from '../report/recommend.js';
import { TEMPLATES, fromTemplate } from '../report/templates.js';
import { measureFit } from '../report/fit.js';
import { standaloneHtml } from '../report/snapshot.js';
import { encodeSpec, presets } from '../report/spec.js';
import { reducer, initialState } from './state.js';
import { moved, resized, collides, placeNew } from './dnd.js';
import { DEV, saveLocal, slug, download, saveReport, renderPdf, readFile } from './io.js';
import { Gallery } from './Gallery.jsx';
import { Canvas } from './Canvas.jsx';
import { Inspector } from './Inspector.jsx';

const isTyping = el => el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);

export function Studio({ initialSpec, initialBundle, notice }) {
  const [state, dispatch] = React.useReducer(reducer, initialSpec, initialState);
  const [bundle, setBundle] = React.useState(initialBundle);
  const [fit, setFit] = React.useState(null);
  const [toast, setToast] = React.useState(notice ? { text: notice, tone: 'neutral' } : null);
  const [busy, setBusy] = React.useState(null);
  const [dragNew, setDragNew] = React.useState(null);
  const canvas = React.useRef(null);
  const fileInput = React.useRef(null);
  const { spec, selected } = state;

  const say = React.useCallback((text, tone = 'neutral') => setToast({ text, tone, at: Date.now() }), []);
  React.useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), toast.tone === 'danger' ? 5200 : 2800);
    return () => clearTimeout(id);
  }, [toast]);

  // Keep the work: in this browser, and in the address bar for sharing.
  React.useEffect(() => {
    saveLocal(spec);
    const id = setTimeout(() => history.replaceState(null, '', `${location.pathname}#spec=${encodeSpec(spec)}`), 300);
    return () => clearTimeout(id);
  }, [spec]);

  const rec = React.useMemo(() => recommend(bundle, spec.filters, METAS, { perJob: 3 }), [bundle, spec.filters]);
  const onFitChange = React.useCallback(sheet => { if (sheet) setFit(measureFit(sheet)); }, []);

  // Add a block where it fits: at a wanted cell, else the nearest free spot, else a smaller size.
  const add = React.useCallback((item, at) => {
    const meta = METAS[item.viz];
    const sizes = [item.size, ...presets(meta).filter(z => z.w * z.h < item.size.w * item.size.h).sort((a, b) => b.w * b.h - a.w * a.h), meta.sizes.min];
    const spot = placeNew(spec.blocks, meta, sizes, at);
    if (!spot) { say(`No room for ${meta.title}. Make space or shrink a block.`, 'danger'); return; }
    dispatch({ type: 'add', block: { viz: item.viz, ...spot, params: item.params } });
    if (spot.w !== item.size.w || spot.h !== item.size.h) say(`Placed at ${spot.w}×${spot.h}, the largest size with room.`);
  }, [spec.blocks, say]);

  // Dragging a gallery card onto the page.
  const startDragNew = React.useCallback((e, item) => {
    e.preventDefault();
    setDragNew({ item, x: e.clientX, y: e.clientY, moved: false });
  }, []);
  React.useEffect(() => {
    if (!dragNew) return;
    const move = e => setDragNew(d => d && { ...d, x: e.clientX, y: e.clientY, moved: d.moved || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4 });
    const up = e => {
      const hit = canvas.current?.candidateAt(e.clientX, e.clientY, dragNew.item.size);
      if (hit) add(dragNew.item, hit.cand);
      setDragNew(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up, { once: true });
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  }, [dragNew?.item, add]); // eslint-disable-line react-hooks/exhaustive-deps
  const ghostNew = dragNew?.moved ? canvas.current?.candidateAt(dragNew.x, dragNew.y, dragNew.item.size) : null;

  // Keyboard: undo/redo, delete, arrows move, shift+arrows resize.
  React.useEffect(() => {
    const onKey = e => {
      if (isTyping(document.activeElement)) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); dispatch({ type: e.shiftKey ? 'redo' : 'undo' }); return; }
      const b = spec.blocks.find(x => x.id === selected);
      if (!b) return;
      if (e.key === 'Escape') dispatch({ type: 'select', id: null });
      else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); dispatch({ type: 'remove', id: b.id }); }
      else if (e.key.startsWith('Arrow')) {
        e.preventDefault();
        const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
        const c = e.shiftKey ? resized(b, d[0], d[1], METAS[b.viz]) : moved(b, d[0], d[1]);
        if (!collides(spec.blocks, c, b.id)) dispatch({ type: 'update', id: b.id, patch: { x: c.x, y: c.y, w: c.w, h: c.h } });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [spec.blocks, selected]);

  const name = slug(spec.title);
  const sheetEl = () => canvas.current?.sheetElement();

  const actions = {
    template: id => {
      if (!id) return;
      dispatch({ type: 'replace', spec: fromTemplate(id, bundle, spec.filters) });
      say('Template applied. ⌘Z brings back what you had.');
    },
    auto: () => { dispatch({ type: 'replace', spec: fromTemplate('auto', bundle, spec.filters) }); say('Composed from what the data shows. ⌘Z undoes it.'); },
    open: async file => {
      try {
        const got = await readFile(file);
        if (got.kind === 'bundle') { setBundle(got.data); say(`Bundle ${got.data.meta?.bundle_id ?? file.name} loaded for this session.`); }
        else { dispatch({ type: 'replace', spec: got.data }); say(`Opened ${file.name}.`); }
      } catch (e) { say(String(e.message || e), 'danger'); }
    },
    save: async () => {
      if (DEV) {
        try { say(`Saved to ${await saveReport(name, spec)}`); } catch (e) { say(`Could not save: ${e.message}`, 'danger'); }
      } else download(`${name}.spec.json`, JSON.stringify(spec, null, 2), 'application/json');
    },
    html: async () => {
      setBusy('html');
      try { download(`${name}.html`, await standaloneHtml(sheetEl(), spec), 'text/html'); say('Exported a self-contained HTML page. It prints to one A4 page.'); }
      catch (e) { say(`Export failed: ${e.message}`, 'danger'); }
      setBusy(null);
    },
    pdf: async () => {
      setBusy('pdf');
      try {
        const { blob, fit: f } = await renderPdf(spec, bundle === initialBundle ? null : bundle);
        download(`${name}.pdf`, blob);
        say(f?.ok === false ? 'PDF saved, but something on it is cut off. See the red badges.' : 'PDF saved: one A4 page.', f?.ok === false ? 'danger' : 'neutral');
      } catch (e) { say(`PDF failed: ${e.message}`, 'danger'); }
      setBusy(null);
    },
    link: async () => {
      try { await navigator.clipboard.writeText(location.href); say('Link copied. It opens this exact page.'); }
      catch { say('Copy the address bar: it holds this page.'); }
    },
  };

  const clipped = fit ? fit.blocks.filter(b => !b.ok).length : 0;

  return (
    <>
      <div className="st-app" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) actions.open(f); }}>
        <header className="st-top">
          <a className="st-brand" href="./" title="Back to the dashboard"><Radar size={20} strokeWidth={2.5} />Foreshock <span>Report studio</span></a>
          <a className="st-back" href="./"><ArrowLeft size={14} />Dashboard</a>
          <div className="st-tools">
            <select className="st-input st-template" value="" onChange={e => actions.template(e.target.value)} aria-label="Start from a template">
              <option value="">Start from…</option>
              {TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
            <Button size="sm" variant="secondary" icon={<Wand2 size={15} />} onClick={actions.auto}>Auto-compose</Button>
            <span className="st-sep" />
            <button type="button" className="st-icon" onClick={() => dispatch({ type: 'undo' })} disabled={!state.past.length} aria-label="Undo" title="Undo (⌘Z)"><Undo2 size={16} /></button>
            <button type="button" className="st-icon" onClick={() => dispatch({ type: 'redo' })} disabled={!state.future.length} aria-label="Redo" title="Redo (⇧⌘Z)"><Redo2 size={16} /></button>
            <span className={`st-fit${clipped ? ' is-bad' : ''}`} role="status">
              {clipped ? <><AlertTriangle size={14} />{clipped} block{clipped > 1 ? 's' : ''} cut off</> : <><CheckCircle2 size={14} />Fits one A4 page</>}
            </span>
          </div>
          <div className="st-tools st-tools-end">
            <button type="button" className="st-icon" onClick={() => fileInput.current.click()} aria-label="Open" title="Open a spec, an exported HTML report or a bundle"><FolderOpen size={16} /></button>
            <input ref={fileInput} type="file" accept=".json,.html,application/json,text/html" hidden onChange={e => { const f = e.target.files?.[0]; if (f) actions.open(f); e.target.value = ''; }} />
            <button type="button" className="st-icon" onClick={actions.save} aria-label="Save" title={DEV ? 'Save to presentation/reports' : 'Download the spec'}><Save size={16} /></button>
            <button type="button" className="st-icon" onClick={actions.link} aria-label="Copy link" title="Copy a link to this page"><Link2 size={16} /></button>
            <button type="button" className="st-icon" onClick={actions.html} disabled={busy === 'html'} aria-label="Export HTML" title="Export a self-contained HTML page"><FileCode2 size={16} /></button>
            <Button size="sm" variant="secondary" icon={<Printer size={15} />} onClick={() => window.print()}>Print</Button>
            {DEV && <Button size="sm" variant="primary" icon={<FileDown size={15} />} onClick={actions.pdf} disabled={busy === 'pdf'}>{busy === 'pdf' ? 'Rendering…' : 'PDF'}</Button>}
          </div>
        </header>
        <Gallery bundle={bundle} filters={spec.filters} rec={rec} onAdd={item => add(item)} onDragStart={startDragNew} />
        <Canvas ref={canvas} spec={spec} bundle={bundle} selected={selected} dispatch={dispatch} fit={fit} ghostNew={ghostNew}
          onFitChange={onFitChange} onRejected={text => say(text, 'danger')} />
        <Inspector spec={spec} bundle={bundle} selected={selected} dispatch={dispatch} fit={fit} rec={rec} onToast={text => say(text, 'danger')} />
        {dragNew?.moved && (
          <div className="st-drag-chip" style={{ left: dragNew.x + 12, top: dragNew.y + 12 }}>{dragNew.item.title} · {dragNew.item.size.w}×{dragNew.item.size.h}</div>
        )}
        {toast && <div className="st-toast"><Toast tone={toast.tone}>{toast.text}</Toast></div>}
      </div>
      {/* What Print sends to the printer: the sheet alone, at true size. */}
      <div className="st-print-only" aria-hidden="true">
        <Sheet spec={spec} bundle={bundle} registry={REGISTRY} />
      </div>
    </>
  );
}
