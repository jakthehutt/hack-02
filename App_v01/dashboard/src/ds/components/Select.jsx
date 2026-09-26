import React from 'react';

/** Select — native select dressed in the same bordered control shell as Input. */
export function Select({ label, value, onChange, options = [], disabled = false, style }) {
  const [focused, setFocused] = React.useState(false);
  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 6, fontFamily: 'var(--font-body)', ...style } },
    label && React.createElement('label', { style: { font: 'var(--font-label)', color: 'var(--text-secondary)' } }, label),
    React.createElement('select', {
      value, disabled,
      onChange: e => onChange && onChange(e.target.value),
      onFocus: () => setFocused(true), onBlur: () => setFocused(false),
      style: {
        font: 'var(--font-body-lg)', padding: '12px 16px', borderRadius: 'var(--radius-md)',
        border: `2.5px solid ${focused ? 'var(--accent-primary)' : 'var(--black)'}`,
        outline: 'none', background: disabled ? 'var(--grey-50)' : 'var(--white)', color: 'var(--black)',
        boxShadow: focused ? 'var(--shadow-focus-ring)' : 'none', appearance: 'auto',
        transition: 'border-color var(--duration-fast) var(--ease-standard)',
      },
    }, options.map(o => React.createElement('option', { key: o.value ?? o, value: o.value ?? o }, o.label ?? o)))
  );
}
