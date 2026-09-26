import React from 'react';

/**
 * Radio — used heavily as the quiz answer-option control: a full bordered row,
 * not just a dot, so tapping anywhere on the option selects it.
 */
export function Radio({ label, selected = false, onSelect, disabled = false, style }) {
  return React.createElement('label', {
    onClick: () => !disabled && onSelect && onSelect(),
    style: {
      display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', cursor: disabled ? 'not-allowed' : 'pointer',
      borderRadius: 'var(--radius-md)', border: `2.5px solid ${selected ? 'var(--accent-primary)' : 'var(--black)'}`,
      background: selected ? 'var(--accent-primary-soft)' : 'var(--white)', fontFamily: 'var(--font-body)',
      transform: selected ? 'scale(1.015)' : 'scale(1)',
      transition: 'border-color var(--duration-fast) var(--ease-standard), background var(--duration-fast) var(--ease-standard), transform var(--duration-fast) var(--ease-out-back)',
      ...style,
    },
  },
    React.createElement('span', {
      style: {
        width: 22, height: 22, borderRadius: '50%', border: `2.5px solid ${selected ? 'var(--accent-primary)' : 'var(--black)'}`,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      },
    }, selected && React.createElement('span', { style: { width: 11, height: 11, borderRadius: '50%', background: 'var(--accent-primary)' } })),
    React.createElement('span', { style: { font: 'var(--font-body-lg)', color: 'var(--black)' } }, label)
  );
}
