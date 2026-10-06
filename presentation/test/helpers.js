import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const bundle = () => JSON.parse(readFileSync(path.join(ROOT, '../bundles/latest.json'), 'utf8'));
export const VIZ_DIR = path.join(ROOT, 'src/report/viz');
export const vizIds = () => readdirSync(VIZ_DIR, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name).sort();

/** Every viz meta, imported directly: meta.js files must be plain ESM. */
export async function metas() {
  const out = {};
  for (const id of vizIds()) out[id] = (await import(path.join(VIZ_DIR, id, 'meta.js'))).default;
  return out;
}
