import React from 'react';

/** Card — bordered surface with the hard offset shadow; lifts slightly on hover. The default content container. */
export function Card({ children, padding = 28, interactive = false, style }) {
  const [hover, setHover] = React.useState(false);
  const lift = interactive && hover;
  return React.createElement('div', {
    onMouseEnter: () => interactive && setHover(true),
    onMouseLeave: () => interactive && setHover(false),
    style: {
      background: 'var(--surface-card)', border: '2.5px solid var(--ink)', borderRadius: 'var(--radius-lg)',
      boxShadow: lift ? 'var(--shadow-hard-lg)' : 'var(--shadow-hard-md)',
      transform: lift ? 'translate(-2px,-2px)' : 'none',
      transition: 'box-shadow var(--duration-base) var(--ease-out-back), transform var(--duration-base) var(--ease-out-back)',
      padding, fontFamily: 'var(--font-body)', ...style,
    },
  }, children);
}
