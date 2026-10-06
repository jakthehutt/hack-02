// Scaffold a new report visualization: src/report/viz/<id>/{meta.js, View.jsx}.
// The registry picks the folder up by itself.
//
//   npm run new-viz -- lag-dist --job flow --title "How fast pickups travel"
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { ROOT } from './lib/render-core.mjs';

const JOBS = ['headline', 'trend', 'compare', 'flow', 'evidence', 'words'];
const { values: opt, positionals } = parseArgs({
  allowPositionals: true,
  options: { job: { type: 'string', default: 'compare' }, title: { type: 'string' } },
});
const id = positionals[0];
if (!id || !/^[a-z][a-z0-9-]*$/.test(id)) {
  console.error('Usage: npm run new-viz -- <id> --job <job> [--title "…"]   (id: lowercase, digits, dashes)');
  process.exit(1);
}
if (!JOBS.includes(opt.job)) {
  console.error(`--job must be one of ${JOBS.join(', ')}`);
  process.exit(1);
}
const dir = path.join(ROOT, 'src/report/viz', id);
if (existsSync(dir)) {
  console.error(`${path.relative(process.cwd(), dir)} already exists.`);
  process.exit(1);
}
const title = opt.title || id.replace(/-/g, ' ').replace(/^\w/, c => c.toUpperCase());

const meta = `// ${title}. Contract: .claude/skills/foreshock-report/references/viz-contract.md
// Plain ESM only: no JSX, CSS, React or '@bundle' imports (Node loads this file).
import { rangeBounds } from '../../../data/derive.js';

export default {
  id: '${id}',
  title: '${title.replace(/'/g, "\\'")}',
  description: 'TODO: one sentence a reader of the gallery understands: what it shows and how to read it.',
  job: '${opt.job}',
  sizes: { min: { w: 2, h: 2 }, max: { w: 6, h: 4 }, presets: ['3x2', '3x3', '6x2'] },
  params: {
    // metric: { type: 'enum', label: 'Measure', options: [{ value: 'share', label: 'Share' }, { value: 'count', label: 'Articles' }], default: (bundle, filters) => filters.metric },
  },
  // true, or a sentence saying what is missing.
  requires: bundle => bundle.sources.length > 0 || 'needs at least one outlet',
  // true when the block draws estimated data: its frame then shows an "Estimated" chip.
  usesEstimates: () => false,
  // Proposals for the gallery and auto-compose: [{ params, size: 'WxH', score: 0..1, reason }].
  // The reason is a sentence with real numbers computed here, never typed.
  suggest(bundle, insights, filters) {
    const [lo, hi] = rangeBounds(bundle.weeks, filters.range);
    return [{ params: {}, size: '3x3', score: 0.3, reason: \`TODO: why this view matters for weeks \${lo + 1}–\${hi + 1}.\` }];
  },
};
`;

const view = `import React from 'react';
import { rangeBounds } from '../../../data/derive.js';
import { C } from '../../palette.js';
import { Svg, Text, TYPE, FONT, Empty } from '../../draw.jsx';
import { truncate } from '../../text.js';

// Draw into box.wPt × box.hPt points (1 SVG unit = 1 pt). Decide how much to show from
// the box BEFORE drawing; text never below TYPE.tiny (6.5 pt); colours from C only.
export default function ${id.replace(/(^|-)(\w)/g, (_, __, c) => c.toUpperCase())}({ bundle, params, filters, box }) {
  const [lo, hi] = rangeBounds(bundle.weeks, filters.range);
  if (hi < lo) return <Empty>No weeks in this range.</Empty>;
  const W = box.wPt;
  const H = box.hPt;
  return (
    <Svg box={box} label="${title.replace(/"/g, '\\"')}">
      <rect x={0} y={0} width={W} height={H} fill={C.burgundyWash} />
      <Text x={W / 2} y={H / 2} size={TYPE.body} font={FONT.bodyMedium} anchor="middle">
        {truncate('TODO: draw ${id}', W - 8, TYPE.body, FONT.bodyMedium)}
      </Text>
    </Svg>
  );
}
`;

mkdirSync(dir, { recursive: true });
writeFileSync(path.join(dir, 'meta.js'), meta);
writeFileSync(path.join(dir, 'View.jsx'), view);
const rel = path.relative(process.cwd(), dir);
console.log(`Created ${rel}/meta.js and ${rel}/View.jsx (job: ${opt.job}).
Next:
  1. Fill in meta.js (description, sizes, params, requires, suggest) and draw View.jsx.
  2. npm run report -- --gallery --only ${id}      # every preset size, checks fit
  3. Look at reports/out/gallery/${id}*.png
  4. npm test                                    # contract tests`);
