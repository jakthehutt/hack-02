import React from 'react';

/** Checkbox — square, thick-bordered; check fills with the accent color and a white mark, scale-pops on toggle. */
export function Checkbox({ label, checked = false, onChange, disabled = false, style }) {
  return React.createElement('label', {
    style: { display: 'inline-flex', alignItems: 'center', gap: 10, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-body)', ...style },
  },
    React.createElement('span', {
      onClick: () => !disabled && onChange && onChange(!checked),
      style: {
        width: 24, height: 24, borderRadius: 'var(--radius-sm)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        border: `2.5px solid ${disabled ? 'var(--grey-300)' : 'var(--black)'}`,
        background: checked ? (disabled ? 'var(--grey-300)' : 'var(--accent-primary)') : 'var(--white)',
        transition: 'transform var(--duration-fast) var(--ease-out-back), background var(--duration-fast) var(--ease-standard)',
        transform: checked ? 'scale(1.05)' : 'scale(1)',
      },
    }, checked && React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: '#fff', strokeWidth: 3, strokeLinecap: 'round', strokeLinejoin: 'round' },
      React.createElement('polyline', { points: '20 6 9 17 4 12' }))),
    label && React.createElement('span', { style: { font: 'var(--font-body-md)', color: disabled ? 'var(--text-muted)' : 'var(--black)' } }, label)
  );
}
