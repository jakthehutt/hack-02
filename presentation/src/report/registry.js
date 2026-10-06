// Every visualization the reports can use. Dropping a folder with meta.js and
// View.jsx into ./viz adds one; nothing else needs registering.
const metaModules = import.meta.glob('./viz/*/meta.js', { eager: true });
const viewModules = import.meta.glob('./viz/*/View.jsx', { eager: true });

export const REGISTRY = {};
for (const [path, mod] of Object.entries(metaModules)) {
  const dir = path.slice(0, path.lastIndexOf('/'));
  const meta = mod.default;
  REGISTRY[meta.id] = { meta, View: viewModules[`${dir}/View.jsx`]?.default ?? null };
}

export const METAS = Object.fromEntries(Object.entries(REGISTRY).map(([id, r]) => [id, r.meta]));

// The order a story reads in, and the order the gallery groups by.
export const JOBS = [
  { id: 'headline', label: 'Headline numbers' },
  { id: 'trend', label: 'Over time' },
  { id: 'compare', label: 'Compare' },
  { id: 'flow', label: 'Who repeats whom' },
  { id: 'evidence', label: 'Evidence' },
  { id: 'words', label: 'Words' },
];
