import React from 'react';
import { Radar } from 'lucide-react';
import { period, provenance, fmtLongDate } from '../lib.js';
import { Block } from './Block.jsx';

const today = () => new Date().toISOString().slice(0, 10);

/**
 * One A4 page. Everything inside is sized in mm/pt and styled only by print.css,
 * so the same markup is the PDF, the printout and the exported HTML.
 * `children` render inside the body grid (the studio puts its editing layer there).
 */
export function Sheet({ spec, bundle, registry, children }) {
  const p = period(bundle, spec.filters);
  const prov = provenance(bundle);
  const measure = spec.filters.metric === 'count' ? 'article counts' : 'share of articles';
  return (
    <div className="fs-sheet" data-paper={spec.page?.paper || 'tinted'} lang="en">
      <header className="fs-head">
        <div className="fs-head-text">
          <h1 className="fs-title">{spec.title}</h1>
          <p className="fs-subtitle">{spec.subtitle || `DE · RU influence monitor · ${measure}`}</p>
        </div>
        <div className="fs-brand">
          <div className="fs-wordmark"><Radar size="3.8mm" strokeWidth={2.75} aria-hidden="true" />Foreshock</div>
          <div className="fs-brand-meta">{p.label} · {p.weeks} wk</div>
        </div>
      </header>
      <main className="fs-body">
        {spec.blocks.map(b => <Block key={b.id} block={b} bundle={bundle} filters={spec.filters} registry={registry} />)}
        {children}
      </main>
      <footer className="fs-foot">
        <span className="fs-foot-prov">{prov.sentence}</span>
        <span className="fs-foot-src fs-mono">bundle {bundle.meta?.bundle_id ?? '–'} · {fmtLongDate(spec.date || today())}</span>
      </footer>
    </div>
  );
}
