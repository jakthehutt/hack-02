import React from 'react';
import { C } from '../../palette.js';
import { kpis, fmtNum, rangeBounds } from '../../../data/derive.js';
import { KPI_ITEMS } from './meta.js';

export function itemFor(id, k) {
  const lag = k.medianLag;
  switch (id) {
    case 'outlets': return { value: fmtNum(k.sources), foot: `${k.active} published in this range` };
    case 'hits': return { value: fmtNum(k.hits), foot: `${k.hitsPer100.toFixed(1)} per 100 articles scanned` };
    case 'articles': return { value: fmtNum(k.articles), foot: k.full ? 'all outlets, whole window' : 'outlets with observed weeks' };
    case 'per100': return { value: k.hitsPer100.toFixed(1), foot: 'matching articles per 100 scanned' };
    case 'pickups': return { value: fmtNum(k.observedEdges), foot: `seen in the crawl, of ${fmtNum(k.edges)} incl. estimated` };
    case 'delay': return lag == null
      ? { value: '–', foot: 'no observed pickups' }
      : { value: lag >= 48 ? (lag / 24).toFixed(1) : String(Math.round(lag)), unit: lag >= 48 ? 'days' : 'hours', foot: 'first publish to the outlet that repeated it' };
    default: return { value: '–', foot: '' };
  }
}

export default function KpiRow({ bundle, params, filters, box }) {
  const [lo, hi] = rangeBounds(bundle.weeks, filters.range);
  const k = kpis(bundle, 'all', lo, hi);
  // Each number needs ~40mm; drop from the end rather than squeeze.
  const fit = Math.max(1, Math.floor((box.wMm + 3) / 40));
  const ids = (params.items || []).filter(id => KPI_ITEMS.some(o => o.value === id)).slice(0, fit);
  const valuePt = Math.max(14, Math.min(26, box.hMm * 0.95));
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${ids.length}, minmax(0, 1fr))`, height: '100%' }}>
      {ids.map((id, i) => {
        const it = itemFor(id, k);
        return (
          <div key={id} style={{ padding: '0.6mm 3mm', borderLeft: i ? `0.5pt solid ${C.inkLine}` : 'none', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minWidth: 0 }}>
            <div className="fs-label" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{KPI_ITEMS.find(o => o.value === id).label}</div>
            <div className="fs-mono" style={{ fontSize: `${valuePt}pt`, fontWeight: 500, lineHeight: 1, color: C.ink, fontVariantNumeric: 'proportional-nums' }}>
              {it.value}{it.unit && <span style={{ fontSize: '0.42em', marginLeft: '0.25em', color: C.inkMuted, fontFamily: "'Foreshock Inter'" }}>{it.unit}</span>}
            </div>
            <div style={{ fontSize: '6.5pt', lineHeight: 1.25, color: C.inkMuted, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{it.foot}</div>
          </div>
        );
      })}
    </div>
  );
}
