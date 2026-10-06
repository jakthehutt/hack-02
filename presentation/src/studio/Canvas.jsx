import React from 'react';
import { Sheet } from '../report/sheet/Sheet.jsx';
import { REGISTRY, METAS } from '../report/registry.js';
import { cellBox, PAGE, PX_PER_MM, COLS, ROWS } from '../report/grid.js';
import { cellsFromPx, cellAt, moved, resized, collides } from './dnd.js';

const SHEET = { w: PAGE.w * PX_PER_MM, h: PAGE.h * PX_PER_MM };
const mm = v => `${+v.toFixed(3)}mm`;

/**
 * The true-size A4 sheet, zoomed to fit, with an editing layer on top: select,
 * drag to move, drag the corner to resize, drop new blocks from the gallery.
 * The layer sits inside the sheet body (class fs-noexport), so exports never see it.
 */
export const Canvas = React.forwardRef(function Canvas({ spec, bundle, selected, dispatch, fit, ghostNew, onFitChange, onRejected }, ref) {
  const wrap = React.useRef(null);
  const paper = React.useRef(null);
  const [avail, setAvail] = React.useState({ w: 900, h: 1100 });
  const [drag, setDrag] = React.useState(null);

  React.useLayoutEffect(() => {
    const ro = new ResizeObserver(([e]) => setAvail({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(wrap.current);
    return () => ro.disconnect();
  }, []);
  const zoom = Math.max(0.3, Math.min((avail.w - 56) / SHEET.w, (avail.h - 56) / SHEET.h, 1.6));

  // While dragging, the sheet draws the block where it would land, so views re-fit live.
  const live = drag?.cand && drag.ok ? { ...spec, blocks: spec.blocks.map(b => (b.id === drag.id ? { ...b, ...drag.cand } : b)) } : spec;

  // Fit check after every change that reaches the sheet.
  React.useEffect(() => {
    let id = requestAnimationFrame(() => { id = requestAnimationFrame(() => onFitChange(paper.current?.querySelector('.fs-sheet'))); });
    return () => cancelAnimationFrame(id);
  }, [live, onFitChange]);

  React.useImperativeHandle(ref, () => ({
    /** Where a new block of `size` would land under the pointer, or null. */
    candidateAt(clientX, clientY, size) {
      const r = paper.current?.getBoundingClientRect();
      if (!r || clientX < r.left || clientX > r.right || clientY < r.top || clientY > r.bottom) return null;
      const c = cellAt(clientX - r.left, clientY - r.top, zoom);
      const x = Math.max(0, Math.min(COLS - size.w, c.x - Math.floor((size.w - 1) / 2)));
      const y = Math.max(0, Math.min(ROWS - size.h, c.y));
      const cand = { x, y, w: size.w, h: size.h };
      return { cand, ok: !collides(spec.blocks, cand) };
    },
    sheetElement: () => paper.current?.querySelector('.fs-sheet'),
  }), [spec.blocks, zoom]);

  const start = (e, block, mode) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    dispatch({ type: 'select', id: block.id });
    setDrag({ id: block.id, mode, x0: e.clientX, y0: e.clientY, orig: block, cand: null, ok: true });
  };
  const move = e => {
    if (!drag) return;
    const { dx, dy } = cellsFromPx(e.clientX - drag.x0, e.clientY - drag.y0, zoom);
    const b = drag.orig;
    const raw = drag.mode === 'move' ? moved(b, dx, dy) : resized(b, dx, dy, METAS[b.viz]);
    const cand = { x: raw.x, y: raw.y, w: raw.w, h: raw.h };
    const same = cand.x === b.x && cand.y === b.y && cand.w === b.w && cand.h === b.h;
    setDrag({ ...drag, cand: same ? null : cand, ok: !collides(spec.blocks, cand, b.id) });
  };
  const end = () => {
    if (!drag) return;
    if (drag.cand && drag.ok) dispatch({ type: 'update', id: drag.id, patch: drag.cand });
    else if (drag.cand) onRejected('That spot is taken. Move the other block first, or drop somewhere free.');
    setDrag(null);
  };

  const issues = Object.fromEntries((fit?.blocks || []).filter(b => !b.ok).map(b => [b.id, b.issues.length]));
  const ghost = drag?.cand ? { ...drag.cand, ok: drag.ok } : ghostNew;

  return (
    <div className="st-canvas" ref={wrap} onPointerDown={e => { if (e.target === e.currentTarget) dispatch({ type: 'select', id: null }); }}>
      <div className="st-paper-frame" style={{ width: SHEET.w * zoom, height: SHEET.h * zoom }}>
        <div className="st-paper" ref={paper} style={{ transform: `scale(${zoom})` }}>
          <Sheet spec={live} bundle={bundle} registry={REGISTRY}>
            <div className="st-layer fs-noexport" onPointerMove={move} onPointerUp={end} onPointerCancel={end}
              onPointerDown={e => { if (e.target === e.currentTarget) dispatch({ type: 'select', id: null }); }}>
              {(drag || ghostNew) && Array.from({ length: COLS * ROWS }, (_, i) => {
                const c = cellBox({ x: i % COLS, y: Math.floor(i / COLS), w: 1, h: 1 });
                return <div key={i} className="st-cell" style={{ left: mm(c.x), top: mm(c.y), width: mm(c.w), height: mm(c.h) }} />;
              })}
              {live.blocks.map(b => {
                const c = cellBox(b);
                const sel = b.id === selected;
                return (
                  <div key={b.id} className="st-hit" data-selected={sel ? '' : undefined} data-issue={issues[b.id] ? '' : undefined}
                    style={{ left: mm(c.x), top: mm(c.y), width: mm(c.w), height: mm(c.h) }}
                    onPointerDown={e => start(e, b, 'move')} onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
                    {sel && <span className="st-hit-label">{b.viz} · {b.w}×{b.h}</span>}
                    {issues[b.id] && <span className="st-hit-issue" title="Something in this block doesn't fit. See the inspector.">!</span>}
                    {sel && <span className="st-handle" onPointerDown={e => start(e, b, 'resize')} onPointerMove={move} onPointerUp={end} title="Drag to resize" />}
                  </div>
                );
              })}
              {ghost && (() => {
                const c = cellBox(ghost);
                return <div className="st-ghost" data-bad={ghost.ok ? undefined : ''} style={{ left: mm(c.x), top: mm(c.y), width: mm(c.w), height: mm(c.h) }} />;
              })()}
            </div>
          </Sheet>
        </div>
      </div>
    </div>
  );
});
