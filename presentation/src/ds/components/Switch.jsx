import React from 'react';

/** Switch — pill toggle, thumb springs across on change. */
export function Switch({ checked = false, onChange, disabled = false, label, style }) {
  return React.createElement('label', { style: { display: 'inline-flex', alignItems: 'center', gap: 10, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-body)', ...style } },
    React.createElement('span', {
      onClick: () => !disabled && onChange && onChange(!checked),
      style: {
        width: 48, height: 28, borderRadius: 'var(--radius-pill)', position: 'relative', flexShrink: 0,
        border: `2.5px solid ${disabled ? 'var(--ink-faint)' : checked ? 'var(--accent-primary)' : 'var(--ink)'}`,
        background: checked ? (disabled ? 'var(--ink-faint)' : 'var(--accent-primary)') : 'var(--paper)',
        transition: 'background var(--duration-fast) var(--ease-standard), border-color var(--duration-fast) var(--ease-standard)',
      },
    }, React.createElement('span', {
      style: {
        position: 'absolute', top: 2, left: checked ? 22 : 2, width: 20, height: 20, borderRadius: '50%',
        background: checked ? 'var(--paper)' : 'var(--ink)', transition: 'left var(--duration-base) var(--ease-out-back)',
      },
    })),
    label && React.createElement('span', { style: { font: 'var(--font-body-md)' } }, label)
  );
}
