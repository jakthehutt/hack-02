import React from 'react';
import { cellBox, contentBox } from '../grid.js';
import { blockParams } from '../spec.js';

const mm = v => `${+v.toFixed(3)}mm`;

/** Keeps one broken view from taking the sheet down; the fit check reports it. */
class Guard extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (!this.state.error) return this.props.children;
    return <div className="fs-empty fs-error" data-render-error={String(this.state.error?.message || this.state.error)}>This block failed to draw: {String(this.state.error?.message || this.state.error)}</div>;
  }
}

/** Resolve what a block shows: its params, title and the box its view draws into. */
export function resolveBlock(block, entry, bundle, filters) {
  const meta = entry?.meta;
  const frame = meta?.frame || {};
  const showTitle = block.title !== false && frame.title !== false;
  const caption = block.caption || '';
  const params = meta ? blockParams(meta, block, bundle, filters) : { ...block.params };
  const title = typeof block.title === 'string' && block.title ? block.title : (meta?.defaultTitle?.(params, bundle, filters) ?? meta?.title ?? block.viz);
  return {
    meta,
    params,
    title,
    showTitle,
    caption,
    bare: frame.border === false,
    box: cellBox(block),
    content: contentBox(block, { title: showTitle, caption: !!caption }),
    estimated: !!meta?.usesEstimates?.(bundle, params, filters),
  };
}

export function Block({ block, bundle, filters, registry }) {
  const entry = registry[block.viz];
  const r = resolveBlock(block, entry, bundle, filters);
  const View = entry?.View;
  return (
    <section
      className="fs-blk"
      data-block-id={block.id}
      data-viz={block.viz}
      data-bare={r.bare ? '' : undefined}
      style={{ left: mm(r.box.x), top: mm(r.box.y), width: mm(r.box.w), height: mm(r.box.h) }}
    >
      {r.showTitle && (
        <h3 className="fs-blk-title">
          <span>{r.title}</span>
          {r.estimated && <span className="fs-chip" title="Contains estimated data">Estimated</span>}
        </h3>
      )}
      <div className="fs-blk-body" style={{ width: mm(r.content.wMm), height: mm(r.content.hMm) }}>
        {View
          ? <Guard key={JSON.stringify(r.params)}><View bundle={bundle} params={r.params} filters={filters} box={r.content} /></Guard>
          : <div className="fs-empty fs-error" data-render-error={`unknown viz ${block.viz}`}>Unknown visualization “{block.viz}”</div>}
      </div>
      {r.caption && <p className="fs-blk-cap">{r.caption}</p>}
    </section>
  );
}
