// Where specs come from and go to: the browser, the repo (dev server only) and files.
import { specFromHtml } from '../report/snapshot.js';

export const DEV = import.meta.env.DEV;
const KEY = 'foreshock.studio.spec';

export function loadLocal() {
  try { const s = localStorage.getItem(KEY); return s ? JSON.parse(s) : null; } catch { return null; }
}
export function saveLocal(spec) {
  try { localStorage.setItem(KEY, JSON.stringify(spec)); } catch { /* private mode or full: the spec still lives in the URL and the file */ }
}

export const slug = s => String(s || 'report').toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').slice(0, 60) || 'report';

export function download(name, content, type) {
  const url = URL.createObjectURL(content instanceof Blob ? content : new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

async function ok(res) {
  if (!res.ok) throw new Error((await res.text()) || `${res.status} ${res.statusText}`);
  return res;
}

/** Dev server only: the spec files in presentation/reports. */
export const listReports = async () => (await ok(await fetch('/__reports'))).json();
export const loadReport = async name => (await ok(await fetch(`/__reports/${encodeURIComponent(name)}`))).json();
export async function saveReport(name, spec) {
  await ok(await fetch(`/__reports/${encodeURIComponent(name)}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(spec, null, 2) }));
  return `reports/${name}.spec.json`;
}

/** Dev server only: the same PDF the report CLI makes. */
export async function renderPdf(spec, bundle) {
  const res = await ok(await fetch('/__render', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ spec, bundle }) }));
  return { blob: await res.blob(), fit: JSON.parse(res.headers.get('x-foreshock-fit') || 'null') };
}

/** A dropped or opened file: a spec, an exported HTML report or another bundle. */
export async function readFile(file) {
  const text = await file.text();
  if (/\.html?$/i.test(file.name) || text.trimStart().startsWith('<')) {
    const spec = specFromHtml(text);
    if (!spec) throw new Error(`${file.name} is not an exported Foreshock report`);
    return { kind: 'spec', data: spec };
  }
  const json = JSON.parse(text);
  if (Array.isArray(json.blocks)) return { kind: 'spec', data: json };
  if (Array.isArray(json.weeks) && Array.isArray(json.sources)) return { kind: 'bundle', data: json };
  throw new Error(`${file.name} is neither a report spec nor a bundle`);
}
