// Regression snapshot of the dashboard: the landing page and every view as text and PNG.
//
//   node scripts/snapshot-dashboard.mjs --dist dist --out /tmp/snap-new
//   node scripts/snapshot-dashboard.mjs --compare /tmp/snap-old /tmp/snap-new
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { launchBrowser } from './lib/browser.mjs';
import { serveStatic } from './lib/serve.mjs';

const VIEWS = ['Overview', 'Narratives', 'Origin', 'Sources'];
const SETTLE_MS = 1500; // count-up numbers and mount animations finish well inside this

const { values, positionals } = parseArgs({
  options: { dist: { type: 'string' }, out: { type: 'string' }, compare: { type: 'boolean' } },
  allowPositionals: true,
});

if (values.compare) {
  const [a, b] = positionals;
  let same = true;
  for (const name of readdirSync(a).sort()) {
    const equal = readFileSync(path.join(a, name)).equals(readFileSync(path.join(b, name)));
    if (!equal) same = false;
    console.log(`${equal ? 'same' : 'DIFF'}  ${name}`);
  }
  process.exit(same ? 0 : 1);
}

const dist = path.resolve(values.dist ?? 'dist');
const out = path.resolve(values.out ?? 'snapshot');
mkdirSync(out, { recursive: true });

const server = await serveStatic(dist);
const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

async function capture(name) {
  await page.waitForTimeout(SETTLE_MS);
  // Finish every animation; the propagation map's flow dash loops forever, so park it at its start.
  await page.evaluate(() => document.getAnimations().forEach(a => {
    try { a.finish(); } catch { a.pause(); a.currentTime = 0; }
  }));
  writeFileSync(path.join(out, `${name}.txt`), await page.evaluate(() => document.body.innerText));
  await page.screenshot({ path: path.join(out, `${name}.png`), fullPage: true });
}

await page.goto(`${server.url}/`);
await capture('0-landing');
await page.evaluate(() => sessionStorage.setItem('foreshock.entered', '1'));
await page.reload();
for (const [i, view] of VIEWS.entries()) {
  await page.getByRole('navigation', { name: 'Sections' }).getByRole('button', { name: view, exact: true }).click();
  await capture(`${i + 1}-${view.toLowerCase()}`);
}

await browser.close();
await server.close();
console.log(`snapshot → ${out}`);
