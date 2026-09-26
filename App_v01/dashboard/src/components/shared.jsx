import React from 'react';
import { Switch } from '../ds/index.js';

/** Counts up to `value` with an ease-out, like the Keypad admin stat cards. */
export function AnimatedNumber({ value, decimals = 0, duration = 900 }) {
  const [n, setN] = React.useState(0);
  const from = React.useRef(0);
  React.useEffect(() => {
    const start = from.current;
    let t0 = null, id;
    const step = ts => {
      if (t0 == null) t0 = ts;
      const p = Math.min(1, (ts - t0) / duration);
      const v = start + (value - start) * (1 - Math.pow(1 - p, 3));
      setN(v);
      if (p < 1) id = requestAnimationFrame(step);
      else from.current = value;
    };
    id = requestAnimationFrame(step);
    return () => { cancelAnimationFrame(id); from.current = value; };
  }, [value, duration]);
  return n.toLocaleString('en-GB', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/** Width of a container, tracked with ResizeObserver. */
export function useWidth(fallback = 600) {
  const ref = React.useRef(null);
  const [w, setW] = React.useState(fallback);
  React.useLayoutEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(200, e.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

export function CardHead({ title, sub, children }) {
  return (
    <div className="card-head">
      <div>
        <h3 className="card-title">{title}</h3>
        {sub && <p className="card-sub">{sub}</p>}
      </div>
      {children && <div className="card-tools">{children}</div>}
    </div>
  );
}

export function TableToggle({ value, onChange }) {
  return <Switch checked={value} onChange={onChange} label="Table" style={{ font: 'var(--font-body-sm)' }} />;
}

/** Positioned tooltip inside a `.chart` container. */
export function ChartTip({ x, y, title, children }) {
  return (
    <div className="chart-tip" style={{ left: x, top: y }} role="status">
      {title && <div className="tip-title">{title}</div>}
      {children}
    </div>
  );
}

export function Sparkline({ values, width = 120, height = 32, split }) {
  const known = values.filter(v => v != null && Number.isFinite(v));
  const max = Math.max(...known, 0.0001);
  const step = values.length > 1 ? width / (values.length - 1) : width;
  const yOf = v => height - 2 - (v / max) * (height - 4);
  let d = '';
  let pen = false;
  let last = null;
  values.forEach((v, i) => {
    if (v == null || !Number.isFinite(v)) { pen = false; return; }
    const x = i * step;
    const y = yOf(v);
    d += `${pen ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
    pen = true;
    last = [x, y];
  });
  return (
    <svg width={width} height={height} aria-hidden="true" style={{ overflow: 'visible' }}>
      {split != null && split > 0 && (
        <rect x={split * step} y={0} width={Math.max(0, width - split * step)} height={height} fill="var(--burgundy-wash)" rx={4} />
      )}
      {d && <path d={d} fill="none" stroke="var(--ink)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
      {last && <circle cx={last[0]} cy={last[1]} r={3.5} fill="var(--accent-primary)" stroke="var(--paper)" strokeWidth={2} />}
    </svg>
  );
}

/** Sequential accent ramp on a 0..1 value, built from tokens only. */
export function rampColor(t) {
  if (t == null) return 'var(--paper-deep)';
  const p = Math.round(Math.max(0, Math.min(1, t)) * 100);
  if (p === 0) return 'var(--paper-deep)';
  return `color-mix(in oklab, var(--burgundy) ${Math.max(8, p)}%, var(--paper-deep))`;
}
// Ink and Paper have equal contrast (~4.2:1) at 65% Burgundy; flip there.
export const rampInk = t => (t != null && t > 0.65 ? 'var(--paper)' : 'var(--text-primary)');

/**
 * Compile a codebook pattern the way the Python side matches it (case-insensitive).
 * Python's \w is Unicode-aware; JS's is ASCII-only even with /u, so widen it for Cyrillic.
 */
export function compilePattern(pattern, flags = 'giu') {
  const unicode = pattern.replace(/\\w/g, '[\\p{L}\\p{N}_]');
  try { return new RegExp(unicode, flags); } catch {
    try { return new RegExp(pattern, flags.replace('u', '')); } catch { return null; }
  }
}

/** Highlight regex matches of a frame pattern inside a quote. */
export function Highlighted({ text, pattern }) {
  const re = pattern && compilePattern(pattern);
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
