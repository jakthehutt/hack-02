import React from 'react';

/** Tooltip — small black label that appears above a trigger on hover. */
export function Tooltip({ label, children, style }) {
  const [show, setShow] = React.useState(false);
  return React.createElement('span', {
    style: { position: 'relative', display: 'inline-flex', ...style },
    onMouseEnter: () => setShow(true), onMouseLeave: () => setShow(false),
  },
    children,
    show && React.createElement('span', {
      style: {
        position: 'absolute', bottom: 'calc(100% + 8px)', left: '50%', transform: 'translateX(-50%)',
        background: 'var(--black)', color: 'var(--white)', padding: '6px 12px', borderRadius: 'var(--radius-sm)',
        font: 'var(--font-body-sm)', whiteSpace: 'nowrap', fontFamily: 'var(--font-body)', zIndex: 10,
      },
    }, label)
  );
}
