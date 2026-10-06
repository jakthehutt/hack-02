// /sheet.html: one A4 report, nothing else. The renderer (scripts/report.mjs) loads
// this page headless, waits for __SHEET_READY__ and reads __FIT_REPORT__.
//
// The spec comes from, in order: window.__FORESHOCK__ (injected by the renderer),
// ?spec=/reports/x.spec.json, #spec=<base64url>, or reports/example.spec.json.
import React from 'react';
import { createRoot } from 'react-dom/client';
import '../report/sheet/print.css';
import bundle from '@bundle';
import example from '../../reports/example.spec.json';
import { installFonts } from '../report/fonts.js';
import { REGISTRY } from '../report/registry.js';
import { Sheet } from '../report/sheet/Sheet.jsx';
import { measureFit, markClipped } from '../report/fit.js';
import { standaloneHtml } from '../report/snapshot.js';
import { normalizeSpec, decodeSpec } from '../report/spec.js';

async function loadInput() {
  const injected = window.__FORESHOCK__;
  if (injected?.spec) return { spec: injected.spec, bundle: injected.bundle || bundle };
  const q = new URLSearchParams(location.search);
  if (q.get('spec')) {
    const res = await fetch(q.get('spec'));
    if (!res.ok) throw new Error(`Could not load ${q.get('spec')} (${res.status})`);
    return { spec: await res.json(), bundle };
  }
  if (location.hash.startsWith('#spec=')) return { spec: decodeSpec(location.hash.slice(6)), bundle };
  return { spec: example, bundle };
}

const frames = n => new Promise(r => { const step = k => (k ? requestAnimationFrame(() => step(k - 1)) : r()); step(n); });

async function main() {
  const input = await loadInput();
  const spec = normalizeSpec(input.spec);
  document.title = spec.title || 'Foreshock report';
  await installFonts();
  const el = document.getElementById('sheet-root');
  createRoot(el).render(<Sheet spec={spec} bundle={input.bundle} registry={REGISTRY} />);
  await frames(3);
  const sheet = el.querySelector('.fs-sheet');
  const report = measureFit(sheet);
  markClipped(sheet, report);
  window.__FIT_REPORT__ = report;
  window.__FORESHOCK_SNAPSHOT__ = () => standaloneHtml(sheet, spec);
  window.__SHEET_READY__ = true;
}

main().catch(e => {
  console.error(e);
  window.__FORESHOCK_ERROR__ = String(e?.stack || e);
  document.getElementById('sheet-root').textContent = `Could not draw this report: ${e?.message || e}`;
});
