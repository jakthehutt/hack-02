import React from 'react';

const sizeMap = {
  sm: { padding: '8px 16px', font: 'var(--font-label)', radius: 'var(--radius-sm)' },
  md: { padding: '12px 22px', font: '600 15px/1 var(--font-body)', radius: 'var(--radius-md)' },
  lg: { padding: '16px 30px', font: '600 17px/1 var(--font-body)', radius: 'var(--radius-md)' },
};

function variantStyle(variant, disabled) {
  if (disabled) {
    return { background: 'var(--paper-deep)', color: 'var(--ink-faint)', border: '2.5px solid var(--ink-line)', boxShadow: 'none' };
  }
  switch (variant) {
    case 'primary':
      return { background: 'var(--accent-primary)', color: 'var(--text-on-accent)', border: '2.5px solid var(--accent-primary)', boxShadow: 'var(--shadow-hard-primary-md)', pressShadow: 'var(--shadow-hard-primary-press)' };
    case 'secondary':
      return { background: 'var(--paper)', color: 'var(--ink)', border: '2.5px solid var(--ink)', boxShadow: 'var(--shadow-hard-md)' };
    case 'ghost':
      return { background: 'transparent', color: 'var(--ink)', border: '2.5px solid transparent', boxShadow: 'none' };
    case 'danger':
      return { background: 'var(--semantic-danger)', color: 'var(--paper)', border: '2.5px solid var(--semantic-danger)', boxShadow: 'var(--shadow-hard-primary-md)', pressShadow: 'var(--shadow-hard-primary-press)' };
    default:
      return {};
  }
}

/**
 * Button — the core haptic control. Every press shrinks the hard shadow and
 * shifts the button toward it, then springs back on release.
 */
export function Button({ variant = 'primary', size = 'md', disabled = false, icon = null, children, onClick, style, ...rest }) {
  const s = sizeMap[size] || sizeMap.md;
  const { pressShadow = 'var(--shadow-hard-press)', ...v } = variantStyle(variant, disabled);
  const [pressed, setPressed] = React.useState(false);
  return React.createElement('button', {
    onClick: disabled ? undefined : onClick,
    disabled,
    onMouseDown: () => setPressed(true),
    onMouseUp: () => setPressed(false),
    onMouseLeave: () => setPressed(false),
    ...rest,
    style: {
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
      cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-body)',
      padding: s.padding, font: s.font, borderRadius: s.radius, ...v,
      transform: pressed && !disabled ? `translate(var(--press-translate),var(--press-translate)) scale(var(--press-scale))` : 'none',
      boxShadow: pressed && !disabled && v.boxShadow !== 'none' ? pressShadow : v.boxShadow,
      transition: `transform var(--duration-fast) var(--ease-out-back), box-shadow var(--duration-fast) var(--ease-standard), background var(--duration-fast) var(--ease-standard)`,
      ...style,
    },
  }, icon, children);
}
