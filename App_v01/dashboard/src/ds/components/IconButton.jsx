import React from 'react';

const sizePx = { sm: 36, md: 44, lg: 52 };

/**
 * IconButton — square haptic control for a single icon action (close, toolbar,
 * step controls). Shares the same press signature as Button.
 */
export function IconButton({ variant = 'secondary', size = 'md', disabled = false, children, onClick, 'aria-label': ariaLabel, style, ...rest }) {
  const px = sizePx[size] || sizePx.md;
  const [pressed, setPressed] = React.useState(false);
  const filled = variant === 'primary';
  const shadow = filled
    ? (pressed ? 'var(--shadow-hard-primary-press)' : 'var(--shadow-hard-primary-sm)')
    : (pressed ? 'var(--shadow-hard-press)' : 'var(--shadow-hard-sm)');
  return React.createElement('button', {
    onClick: disabled ? undefined : onClick,
    disabled,
    'aria-label': ariaLabel,
    onMouseDown: () => setPressed(true),
    onMouseUp: () => setPressed(false),
    onMouseLeave: () => setPressed(false),
    ...rest,
    style: {
      width: px, height: px, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      borderRadius: 'var(--radius-md)', cursor: disabled ? 'not-allowed' : 'pointer',
      background: disabled ? 'var(--paper-deep)' : filled ? 'var(--accent-primary)' : 'var(--paper)',
      color: disabled ? 'var(--ink-faint)' : filled ? 'var(--text-on-accent)' : 'var(--ink)',
      border: `2.5px solid ${disabled ? 'var(--ink-line)' : filled ? 'var(--accent-primary)' : 'var(--ink)'}`,
      boxShadow: disabled ? 'none' : shadow,
      transform: pressed && !disabled ? 'translate(2px,2px) scale(var(--press-scale))' : 'none',
      transition: 'transform var(--duration-fast) var(--ease-out-back), box-shadow var(--duration-fast) var(--ease-standard)',
      ...style,
    },
  }, children);
}
