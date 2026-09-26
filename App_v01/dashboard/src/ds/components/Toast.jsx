import React from 'react';

const toneMap = {
  neutral: { bg: 'var(--black)', fg: 'var(--white)' },
  success: { bg: 'var(--semantic-success)', fg: '#fff' },
  danger: { bg: 'var(--semantic-danger)', fg: '#fff' },
};

/** Toast — brief bottom-of-screen confirmation; slides up with overshoot ease. */
export function Toast({ tone = 'neutral', children, style }) {
  const t = toneMap[tone] || toneMap.neutral;
  return React.createElement('div', {
    style: {
      display: 'inline-flex', alignItems: 'center', gap: 10, padding: '14px 20px', borderRadius: 'var(--radius-md)',
      background: t.bg, color: t.fg, font: 'var(--font-body-md)', fontWeight: 600, fontFamily: 'var(--font-body)',
      boxShadow: 'var(--shadow-hard-sm)', ...style,
    },
  }, children);
}
