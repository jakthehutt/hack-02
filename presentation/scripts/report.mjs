// Render report specs to an A4 PDF, a PNG and a self-contained HTML file.
//
//   npm run report -- reports/x.spec.json [more.spec.json…]
//   npm run report -- --auto                      compose from what the data shows
//   npm run report -- --from-dashboard '{"view":"narratives","range":"4"}'
//   npm run report -- --gallery [--only heatmap]  every viz at every preset size
//
// Options: --bundle <path>  --out <dir> (default reports/out)  --formats pdf,png,html
//          --no-build (reuse .render-dist)  --save-spec (write composed specs to reports/)
// Exit codes: 0 everything fits on one page; 2 something was clipped; 1 an error.
import path from 'node:path';
import { parseArgs } from 'node:util';
import { ROOT, bundlePath, readJson, loadReportModules, buildSite, openRenderer, renderSpec, describe, writeJson } from './lib/render-core.mjs';

const { values: opt, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    auto: { type: 'boolean' },
    'from-dashboard': { type: 'string' },
    gallery: { type: 'boolean' },
    only: { type: 'string' },
    bundle: { type: 'string' },
    out: { type: 'string', default: path.join(ROOT, 'reports/out') },
    formats: { type: 'string', default: 'pdf,png,html' },
    'no-build': { type: 'boolean' },
    'save-spec': { type: 'boolean' },
    date: { type: 'string' },
  },
});

const today = new Date().toISOString().slice(0, 10);
const bundleFile = bundlePath(opt.bundle);
const bundle = readJson(bundleFile);
const mods = await loadReportModules();
const formats = opt.formats.split(',').map(s => s.trim()).filter(Boolean);

// Jobs: [{ name, spec }]
const jobs = [];
for (const file of positionals) {
  const name = path.basename(file).replace(/\.spec\.json$|\.json$/, '');
  jobs.push({ name, spec: readJson(path.resolve(file)) });
}
if (opt.auto) jobs.push({ name: `${today}-auto`, spec: mods.templates.auto(bundle) });
if (opt['from-dashboard']) {
  const state = JSON.parse(opt['from-dashboard']);
  jobs.push({ name: `${today}-${state.view || 'overview'}`, spec: mods.templates.fromDashboard(bundle, state) });
}
if (opt.gallery) {
  for (const g of mods.templates.gallery(bundle, opt.only ? opt.only.split(',') : null)) jobs.push({ name: `gallery/${g.name}`, spec: g.spec });
}
if (!jobs.length) {
  console.error('Nothing to render. Pass spec files, --auto, --from-dashboard or --gallery.');
  process.exit(1);
}

let failed = false;
const valid = [];
for (const job of jobs) {
  const spec = mods.normalizeSpec({ ...(opt.date ? { date: opt.date } : {}), ...job.spec });
  const problems = mods.validateSpec(spec, mods.METAS);
  for (const p of problems) console.log(`${p.level === 'error' ? '✗' : '!'} ${job.name}: ${p.block ? `block "${p.block}": ` : ''}${p.message}`);
  if (problems.some(p => p.level === 'error')) { failed = true; continue; }
  if (opt['save-spec'] && !positionals.length) writeJson(path.join(ROOT, 'reports', `${job.name.replace('/', '-')}.spec.json`), spec);
  valid.push({ ...job, spec });
}
if (!valid.length) process.exit(1);

if (!opt['no-build']) await buildSite();
const r = await openRenderer();
let clipped = false;
try {
  for (const job of valid) {
    const outBase = path.join(opt.out, job.name);
    const res = await renderSpec(r, { spec: job.spec, bundle: opt.bundle ? bundle : null, outBase, formats });
    const rel = p => { const r = path.relative(process.cwd(), p); return r.startsWith('..') ? p : r; };
    const status = res.ok ? '✓' : '✗';
    console.log(`${status} ${job.name}: ${res.pages ?? '–'} page${res.pages === 1 ? '' : 's'}, ${res.fit.ok ? 'everything fits' : 'something is cut off'} → ${Object.values(res.files).map(rel).join(', ')}`);
    for (const line of describe(res)) console.log(`    ${line}`);
    if (!res.fit.ok || res.pages > 1) clipped = true;
    if (res.errors.length) failed = true;
  }
} finally {
  await r.close();
}
process.exit(failed ? 1 : clipped ? 2 : 0);
