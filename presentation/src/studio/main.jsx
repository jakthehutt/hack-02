// /studio.html: compose A4 reports from the gallery, or from the dashboard's current view.
//
// Starts from, in order: ?from=dashboard&view=…&range=…&metric=…&series=…&source=…,
// ?spec=/reports/x.spec.json, ?template=<id>, #spec=<base64url>, the last session
// in this browser, or a page composed from what the data shows.
import React from 'react';
import { createRoot } from 'react-dom/client';
import '../ds/index.js';
import '../report/sheet/print.css';
import './studio.css';
import bundle from '@bundle';
import { installFonts } from '../report/fonts.js';
import { fromDashboard, fromTemplate } from '../report/templates.js';
import { decodeSpec } from '../report/spec.js';
import { loadLocal } from './io.js';
import { Studio } from './Studio.jsx';

async function startingSpec() {
  const q = new URLSearchParams(location.search);
  if (q.get('from') === 'dashboard') {
    const state = Object.fromEntries(['view', 'range', 'metric', 'series', 'source'].map(k => [k, q.get(k) || undefined]));
    history.replaceState(null, '', location.pathname);
    return { spec: fromDashboard(bundle, state), notice: `The ${state.view || 'overview'} view as an A4 page. Arrange it, then print or export.` };
  }
  if (q.get('spec')) {
    const res = await fetch(q.get('spec'));
    if (res.ok) return { spec: await res.json(), notice: `Opened ${q.get('spec')}` };
  }
  if (q.get('template')) return { spec: fromTemplate(q.get('template'), bundle, {}) };
  if (location.hash.startsWith('#spec=')) {
    try { return { spec: decodeSpec(location.hash.slice(6)) }; } catch { /* a damaged link: fall through */ }
  }
  const saved = loadLocal();
  if (saved?.blocks) return { spec: saved, notice: 'Welcome back: this is where you left off.' };
  return { spec: fromTemplate('auto', bundle, {}), notice: 'Composed from what the data shows. Drag in more from the gallery.' };
}

async function main() {
  const { spec, notice } = await startingSpec();
  await installFonts();
  createRoot(document.getElementById('root')).render(<React.StrictMode><Studio initialSpec={spec} initialBundle={bundle} notice={notice} /></React.StrictMode>);
}

main();
