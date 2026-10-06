// A small Markdown subset for text blocks: paragraphs, "## " headings, "- " lists,
// **bold**, *italic* and ==highlight==. Enough for notes on a one-pager, nothing that can break layout.
import React from 'react';

function inline(text, key = 0) {
  const out = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|==[^=]+==)/g;
  let last = 0;
  let m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    const k = `${key}-${m.index}`;
    if (tok.startsWith('**')) out.push(<strong key={k}>{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith('==')) out.push(<mark key={k}>{tok.slice(2, -2)}</mark>);
    else out.push(<em key={k}>{tok.slice(1, -1)}</em>);
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ text, drop = false }) {
  const blocks = String(text || '').replace(/\r/g, '').split(/\n{2,}/).map(b => b.trim()).filter(Boolean);
  return blocks.map((b, i) => {
    const lines = b.split('\n');
    if (lines.every(l => /^\s*[-•]\s+/.test(l))) {
      return <ul key={i}>{lines.map((l, j) => <li key={j} data-drop={drop ? '' : undefined}>{inline(l.replace(/^\s*[-•]\s+/, ''), j)}</li>)}</ul>;
    }
    if (/^#{1,3}\s+/.test(b)) return <h3 key={i}>{inline(b.replace(/^#{1,3}\s+/, ''), i)}</h3>;
    return <p key={i}>{inline(lines.join(' '), i)}</p>;
  });
}

/**
 * Text that shrinks to fit its box: from `max` pt down to `min` pt. With `droppable`,
 * the last items (elements marked data-drop) are hidden one by one if it still
 * doesn't fit at `min`. Whatever still overflows is reported by the fit check.
 */
export function FitText({ children, max = 9, min = 6.5, className = 'fs-prose', style }) {
  const ref = React.useRef(null);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const box = el.parentElement;
    const over = () => el.scrollHeight > box.clientHeight + 0.5 || el.scrollWidth > box.clientWidth + 0.5;
    const droppable = [...el.querySelectorAll('[data-drop]')];
    droppable.forEach(n => { n.style.display = ''; });
    let size = max;
    el.style.fontSize = `${size}pt`;
    while (size > min && over()) {
      size = Math.max(min, +(size - 0.25).toFixed(2));
      el.style.fontSize = `${size}pt`;
    }
    // Still too much at the smallest size: drop items from the end, then grow back.
    while (over() && droppable.length > 1) droppable.pop().style.display = 'none';
    while (size < max) {
      el.style.fontSize = `${size + 0.25}pt`;
      if (over()) { el.style.fontSize = `${size}pt`; break; }
      size += 0.25;
    }
  });
  return <div ref={ref} className={className} style={{ fontSize: `${max}pt`, ...style }}>{children}</div>;
}
