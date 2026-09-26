import React from 'react';

/** Tabs — segmented control; selected tab slides with an overshoot ease. Generous padding for a softer feel. */
export function Tabs({ items = [], value, onChange, style }) {
  return React.createElement('div', {
    style: {
      display: 'inline-flex', gap: 8, padding: 8, background: 'var(--surface-warm)', border: '2.5px solid var(--black)',
      borderRadius: 'var(--radius-lg)', fontFamily: 'var(--font-body)', ...style,
    },
  }, items.map(it => {
    const active = it === value || it.value === value;
    const label = it.label ?? it;
    const val = it.value ?? it;
    return React.createElement('button', {
      key: val, onClick: () => onChange && onChange(val),
      onMouseEnter: e => { if (!active) e.currentTarget.style.background = 'var(--white)'; },
      onMouseLeave: e => { if (!active) e.currentTarget.style.background = 'transparent'; },
      style: {
        padding: '12px 26px', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer',
        background: active ? 'var(--black)' : 'transparent', color: active ? 'var(--white)' : 'var(--black)',
        font: '600 15px/1 var(--font-body)',
        transition: 'background var(--duration-base) var(--ease-out-back), color var(--duration-base) var(--ease-standard), transform var(--duration-fast) var(--ease-out-back)',
        transform: active ? 'scale(1.02)' : 'scale(1)',
      },
    }, label);
  }));
}
