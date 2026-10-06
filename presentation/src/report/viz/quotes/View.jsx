import React from 'react';
import { C } from '../../palette.js';
import { fmtDate } from '../../../data/derive.js';
import { shortName, compilePattern } from '../../lib.js';
import { FitText } from '../../markdown.jsx';
import { Empty } from '../../draw.jsx';
import { quotesFor } from './meta.js';

function Marked({ text, pattern }) {
  const re = compilePattern(pattern);
  if (!re) return text;
  const out = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (!m[0]) continue;
    out.push(text.slice(last, m.index), <mark key={m.index}>{m[0]}</mark>);
    last = m.index + m[0].length;
  }
  out.push(text.slice(last));
  return out;
}

const clip = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);

export default function Quotes({ bundle, params, filters, box }) {
  const se = bundle.series.find(s => s.id === params.series);
  if (!se) return <Empty>Pick a narrative.</Empty>;
  const all = quotesFor(bundle, se.id, params.source, filters);
  if (!all.length) return <Empty>No matched sentences for “{se.label}” in this period.</Empty>;
  // Budget lines at 7.5 pt: ~1.3 mm per character-width step, ~3.6 mm per line.
  const perLine = Math.max(20, box.wMm / 1.45);
  let lines = Math.floor(box.hMm / 3.7);
  const shown = [];
  for (const q of all) {
    const need = Math.ceil(Math.min(q.quote.length, 240) / perLine) + 1.4;
    if (shown.length && need > lines) break;
    shown.push(q);
    lines -= need;
  }
  return (
    <FitText max={7.5}>
      {shown.map((q, i) => (
        <div key={i} data-drop="" style={{ marginTop: i ? '1.6mm' : 0, paddingLeft: '2mm', borderLeft: `0.75pt solid ${C.burgundySoft}` }}>
          <p lang="de" style={{ hyphens: 'auto' }}>„<Marked text={clip(q.quote, 240)} pattern={se.pattern} />“</p>
          <p style={{ fontSize: '6.5pt', color: C.inkMuted, marginTop: '0.4mm', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            <strong style={{ color: C.inkSoft, fontWeight: 600 }}>{shortName(q.source)}</strong> · {fmtDate(q.date)} · <span lang="de">{q.title}</span>
          </p>
        </div>
      ))}
      {all.length > shown.length && <p style={{ marginTop: '1.4mm', fontSize: '6.5pt', color: C.inkMuted }}>+{all.length - shown.length} more in the dashboard</p>}
    </FitText>
  );
}
