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
      background: disabled ? 'var(--grey-100)' : filled ? 'var(--accent-primary)' : 'var(--white)',
      color: disabled ? 'var(--grey-300)' : filled ? 'var(--white)' : 'var(--black)',
      border: `2.5px solid ${disabled ? 'var(--grey-200)' : 'var(--black)'}`,
      boxShadow: disabled ? 'none' : pressed ? 'var(--shadow-hard-press)' : 'var(--shadow-hard-sm)',
      transform: pressed && !disabled ? 'translate(2px,2px) scale(var(--press-scale))' : 'none',
      transition: 'transform var(--duration-fast) var(--ease-out-back), box-shadow var(--duration-fast) var(--ease-standard)',
      ...style,
    },
  }, children);
}
