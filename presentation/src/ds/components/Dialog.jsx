import React from 'react';

/** Dialog — modal with a flat (no blur) dark scrim and a hard-shadow bordered panel. */
export function Dialog({ open, title, children, onClose, actions, style }) {
  if (!open) return null;
  return React.createElement('div', {
    style: { position: 'fixed', inset: 0, background: 'var(--surface-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
    onClick: onClose,
  }, React.createElement('div', {
    onClick: e => e.stopPropagation(),
    style: {
      background: 'var(--paper)', border: '3px solid var(--ink)', borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-hard-lg)', padding: 32, width: 420, fontFamily: 'var(--font-body)', ...style,
    },
  },
    title && React.createElement('div', { style: { font: 'var(--font-h4)', fontFamily: 'var(--font-display)', marginBottom: 12 } }, title),
    React.createElement('div', { style: { font: 'var(--font-body-lg)', color: 'var(--text-secondary)' } }, children),
    actions && React.createElement('div', { style: { display: 'flex', gap: 12, marginTop: 24, justifyContent: 'flex-end' } }, actions)
  ));
}
