import React from 'react';

const toneMap = {
  neutral: { bg: 'var(--surface-inverse)', fg: 'var(--text-inverse)', shadow: 'var(--shadow-hard-primary-sm)' },
  success: { bg: 'var(--semantic-success-soft)', fg: 'var(--semantic-success)', shadow: 'var(--shadow-hard-sm)' },
  danger: { bg: 'var(--semantic-danger-soft)', fg: 'var(--semantic-danger)', shadow: 'var(--shadow-hard-sm)' },
};

/** Toast — brief bottom-of-screen confirmation; slides up with overshoot ease. */
export function Toast({ tone = 'neutral', children, style }) {
  const t = toneMap[tone] || toneMap.neutral;
  return React.createElement('div', {
    style: {
      display: 'inline-flex', alignItems: 'center', gap: 10, padding: '14px 20px', borderRadius: 'var(--radius-md)',
      background: t.bg, color: t.fg, font: 'var(--font-body-md)', fontWeight: 600, fontFamily: 'var(--font-body)',
      boxShadow: t.shadow, ...style,
    },
  }, children);
}
