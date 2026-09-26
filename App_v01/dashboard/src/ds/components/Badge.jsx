import React from 'react';

const toneMap = {
  neutral: { bg: 'var(--paper-deep)', fg: 'var(--ink)' },
  primary: { bg: 'var(--accent-primary-soft-strong)', fg: 'var(--accent-primary)' },
  success: { bg: 'var(--semantic-success-soft)', fg: 'var(--semantic-success)' },
  danger: { bg: 'var(--semantic-danger-soft)', fg: 'var(--semantic-danger)' },
  warning: { bg: 'var(--semantic-warning-soft)', fg: 'var(--semantic-warning)' },
};

/** Badge — small filled-pill status indicator (score result, live state). No border. Pops in on mount. */
export function Badge({ tone = 'neutral', children, style }) {
  const t = toneMap[tone] || toneMap.neutral;
  const [in_, setIn] = React.useState(false);
  React.useEffect(() => { const id = requestAnimationFrame(() => setIn(true)); return () => cancelAnimationFrame(id); }, []);
  return React.createElement('span', {
    style: {
      display: 'inline-flex', alignItems: 'center', padding: '4px 12px', borderRadius: 'var(--radius-pill)',
      background: t.bg, color: t.fg, font: 'var(--font-label)', fontSize: 'var(--text-2xs)', letterSpacing: 'var(--tracking-label)',
      textTransform: 'uppercase', fontFamily: 'var(--font-body)',
      transform: in_ ? 'scale(1)' : 'scale(0.7)', opacity: in_ ? 1 : 0,
      transition: 'transform var(--duration-base) var(--ease-out-back), opacity var(--duration-fast) var(--ease-standard)',
      ...style,
    },
  }, children);
}
