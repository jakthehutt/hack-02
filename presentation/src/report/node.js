// What the Node scripts (report, suggest) use, loaded through Vite's SSR loader so
// the registry's import.meta.glob and the JSX views resolve exactly as in the browser.
export { REGISTRY, METAS, JOBS } from './registry.js';
export { normalizeSpec, validateSpec, presets, sizeLimits, SPEC_VERSION } from './spec.js';
export { recommend } from './recommend.js';
export { autolayout } from './autolayout.js';
export { detectInsights, plain } from './insights.js';
export * as templates from './templates.js';
export * as grid from './grid.js';
