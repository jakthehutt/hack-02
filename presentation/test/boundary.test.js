// The presentation layer reads bundles only: no pipeline paths, no Python.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKIP = new Set(['node_modules', 'dist', '.render-dist', '.vite', 'out', 'test']);
const FORBIDDEN = [/App_v01/, /\bdata\/(articles|raw|edges|topics|codebook)/, /\.py\b/, /narratives_cross|narratives_report/];

function* files(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) yield* files(p);
    else if (/\.(js|jsx|mjs|json|html|css)$/.test(name) && name !== 'package-lock.json') yield p;
  }
}

test('nothing in presentation/ reaches into the pipeline', () => {
  const hits = [];
  for (const f of files(root)) {
    const text = readFileSync(f, 'utf8');
    for (const re of FORBIDDEN) if (re.test(text)) hits.push(`${path.relative(root, f)} ~ ${re}`);
  }
  assert.deepEqual(hits, []);
});
