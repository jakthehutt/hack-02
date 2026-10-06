// Shared by the report CLI and the studio's dev plugin: build the site once, serve it,
// and print specs to PDF / PNG / standalone HTML with a fit report.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, createServer } from 'vite';
import { launchBrowser } from './browser.mjs';
import { serveStatic } from './serve.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const DIST = path.join(ROOT, '.render-dist');

/** The bundle the presentation reads by default (same rule as vite.config.js). */
export function bundlePath(explicit) {
  if (explicit) return path.resolve(explicit);
  if (process.env.FORESHOCK_BUNDLE) return path.resolve(process.env.FORESHOCK_BUNDLE);
  return path.resolve(ROOT, '../bundles/latest.json');
}

export const readJson = p => JSON.parse(readFileSync(p, 'utf8'));

/** The report modules (registry, spec, templates…) loaded in Node through Vite SSR. */
export async function loadReportModules() {
  const server = await createServer({
    root: ROOT, configFile: path.join(ROOT, 'vite.config.js'), logLevel: 'error',
    server: { middlewareMode: true, hmr: false }, appType: 'custom',
    // No dependency pre-bundling: nothing is served to a browser, and closing mid-optimize logs noise.
    optimizeDeps: { noDiscovery: true, include: [], disabled: true },
  });
  try {
    return await server.ssrLoadModule('/src/report/node.js');
  } finally {
    await server.close();
  }
}

export async function buildSite({ quiet = true } = {}) {
  await build({ root: ROOT, configFile: path.join(ROOT, 'vite.config.js'), logLevel: quiet ? 'error' : 'info', build: { outDir: DIST, emptyOutDir: true } });
  return DIST;
}

/** A served build and a browser, ready to render many specs. Close it when done. */
export async function openRenderer({ dist = DIST, url } = {}) {
  const server = url ? null : await serveStatic(dist);
  const browser = await launchBrowser();
  return {
    url: url ?? server.url,
    browser,
    async close() { await browser.close(); if (server) await server.close(); },
  };
}

const countPages = buf => (buf.toString('latin1').match(/\/Type\s*\/Page(?![s\w])/g) || []).length;

/**
 * Render one spec. Writes <outBase>.pdf/.png/.html/.fit.json for the formats asked for,
 * and returns { ok, pages, fit, files, errors }.
 */
export async function renderSpec(r, { spec, bundle = null, outBase, formats = ['pdf', 'png', 'html'] }) {
  mkdirSync(path.dirname(outBase), { recursive: true });
  const ctx = await r.browser.newContext({ viewport: { width: 794, height: 1123 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e?.message || e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  try {
    await page.emulateMedia({ media: 'print' });
    await page.addInitScript(input => { window.__FORESHOCK__ = input; }, { spec, bundle });
    await page.goto(`${r.url}/sheet.html`);
    await page.waitForFunction(() => window.__SHEET_READY__ || window.__FORESHOCK_ERROR__, null, { timeout: 60000 });
    const failed = await page.evaluate(() => window.__FORESHOCK_ERROR__);
    if (failed) throw new Error(failed);
    const fit = await page.evaluate(() => window.__FIT_REPORT__);
    const files = {};
    let pages = null;
    let extraPages = 0;

    if (formats.includes('pdf')) {
      // Chrome should give one page; if rounding ever adds a blank second one, say so and trim it.
      let buf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
      pages = countPages(buf);
      if (pages > 1) {
        extraPages = pages - 1;
        buf = await page.pdf({ preferCSSPageSize: true, printBackground: true, pageRanges: '1' });
        pages = countPages(buf);
      }
      writeFileSync((files.pdf = `${outBase}.pdf`), buf);
    }
    if (formats.includes('png')) {
      if (!fit.ok) await page.evaluate(() => document.documentElement.setAttribute('data-show-clips', ''));
      await page.locator('.fs-sheet').screenshot({ path: (files.png = `${outBase}.png`) });
      await page.evaluate(() => document.documentElement.removeAttribute('data-show-clips'));
    }
    if (formats.includes('html')) {
      writeFileSync((files.html = `${outBase}.html`), await page.evaluate(() => window.__FORESHOCK_SNAPSHOT__()));
    }
    const result = {
      ok: fit.ok && errors.length === 0 && (pages == null || pages === 1),
      pages,
      extraPagesTrimmed: extraPages,
      fit,
      errors,
      files,
    };
    writeFileSync((files.fit = `${outBase}.fit.json`), JSON.stringify(result, null, 2));
    return result;
  } finally {
    await ctx.close();
  }
}

/** One line per problem, for the terminal. */
export function describe(result) {
  const lines = [];
  for (const b of result.fit.blocks) {
    for (const i of b.issues) {
      if (i.kind === 'overflow') lines.push(`block "${b.id}" (${b.viz}): content ${i.axis === 'y' ? 'taller' : 'wider'} than its box by ${i.mm} mm`);
      else if (i.kind === 'text-clipped') lines.push(`block "${b.id}" (${b.viz}): text cut off by ${i.mm} mm: "${i.text}"`);
      else if (i.kind === 'tiny-text') lines.push(`block "${b.id}" (${b.viz}): text below 6.5 pt (${i.pt} pt): "${i.text}"`);
      else lines.push(`block "${b.id}" (${b.viz}): ${i.message || i.kind}`);
    }
    for (const w of b.warnings) lines.push(`(warning) block "${b.id}": ${w.kind.replace(/-/g, ' ')}: ${w.kind === 'label-overlap' ? w.text : `"${w.text}"`}`);
  }
  for (const w of result.fit.warnings) lines.push(`(warning) page ${w.kind.replace(/-/g, ' ')}: "${w.text}"`);
  if (result.extraPagesTrimmed) lines.push(`(warning) Chrome produced ${result.extraPagesTrimmed + 1} pages; trimmed to 1`);
  for (const e of result.errors) lines.push(`console error: ${e}`);
  return lines;
}

export const writeJson = (p, v) => { mkdirSync(path.dirname(p), { recursive: true }); writeFileSync(p, JSON.stringify(v, null, 2) + '\n'); };
