import React from 'react';
import { kpis, rangeBounds, coveredWeeks, weeklyObserved } from '../../../data/derive.js';
import { C } from '../../palette.js';
import { KPI_ITEMS } from '../kpi-row/meta.js';
import { itemFor } from '../kpi-row/View.jsx';

/** Weekly matching articles summed over outlets with observed weeks. */
function weeklyHits(bundle, lo, hi) {
  const out = [];
  for (let i = lo; i <= hi; i++) {
    let n = 0, seen = false;
    for (const src of bundle.sources) {
      if (!weeklyObserved(src) || !coveredWeeks(src, bundle.weeks)[i]) continue;
      seen = true;
      for (const s of src.series) n += s.weekly_n[i] || 0;
    }
    out.push(seen ? n : null);
  }
  return out;
}

function Spark({ values, w, h }) {
  const known = values.filter(v => v != null);
  if (known.length < 3) return null;
  const max = Math.max(...known, 1);
  const step = w / (values.length - 1);
  let d = '';
  let pen = false;
  let last = null;
  values.forEach((v, i) => {
    if (v == null) { pen = false; return; }
    const x = i * step;
    const y = h - 1.5 - (v / max) * (h - 3);
    d += `${pen ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`;
    pen = true;
    last = [x, y];
  });
  return (
    <svg width={`${(w / 72) * 25.4}mm`} height={`${(h / 72) * 25.4}mm`} viewBox={`-2 -2 ${w + 4} ${h + 4}`} style={{ overflow: 'visible' }}>
      <path d={d} fill="none" stroke={C.inkSoft} strokeWidth={1} strokeLinejoin="round" />
      {last && <circle cx={last[0]} cy={last[1]} r={2} fill={C.burgundy} stroke={C.paper} strokeWidth={1} />}
    </svg>
  );
}

export default function Kpi({ bundle, params, filters, box }) {
  const [lo, hi] = rangeBounds(bundle.weeks, filters.range);
  const k = kpis(bundle, 'all', lo, hi);
  const it = itemFor(params.item, k);
  const label = KPI_ITEMS.find(o => o.value === params.item)?.label ?? params.item;
  const valuePt = Math.max(14, Math.min(30, Math.min(box.hMm * 0.85, box.wMm * 0.5)));
  const spark = ['hits', 'per100', 'articles'].includes(params.item) && box.wMm > 40 ? weeklyHits(bundle, lo, hi) : null;
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '0.4mm 1mm' }}>
      <div className="fs-label" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '2mm' }}>
        <div className="fs-mono" style={{ fontSize: `${valuePt}pt`, fontWeight: 500, lineHeight: 1, fontVariantNumeric: 'proportional-nums', whiteSpace: 'nowrap' }}>
          {it.value}{it.unit && <span style={{ fontSize: '0.42em', marginLeft: '0.25em', color: C.inkMuted }}>{it.unit}</span>}
        </div>
        {spark && <Spark values={spark} w={Math.min(72, (box.wMm - 30) * 2.4)} h={18} />}
      </div>
      <div style={{ fontSize: '6.5pt', lineHeight: 1.25, color: C.inkMuted, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {it.foot}{spark ? ' · weekly, observed outlets' : ''}
      </div>
    </div>
  );
}
