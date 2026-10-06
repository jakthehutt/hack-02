import React from 'react';

/** Tag — bordered, outline-style label chip; optionally removable. Distinct from Badge (filled, no border). */
export function Tag({ children, onRemove, style }) {
  return React.createElement('span', {
    style: {
      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px 5px 14px', borderRadius: 'var(--radius-pill)',
      border: '2px solid var(--ink)', background: 'var(--paper)', font: 'var(--font-body-sm)', fontFamily: 'var(--font-body)', ...style,
    },
  }, children, onRemove && React.createElement('button', {
    onClick: onRemove, 'aria-label': 'Remove',
    style: { border: 'none', background: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'var(--ink)' },
  }, React.createElement('svg', { width: 12, height: 12, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 3, strokeLinecap: 'round' },
    React.createElement('line', { x1: 4, y1: 4, x2: 20, y2: 20 }), React.createElement('line', { x1: 20, y1: 4, x2: 4, y2: 20 }))));
}
