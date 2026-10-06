# Visualization contract

A visualization is one folder in `presentation/src/report/viz/<id>/` with two files.
`src/report/registry.js` finds it by itself; nothing else needs registering.
`npm test` (test/viz-contract.test.js) checks this contract.

## meta.js: plain ESM (Node imports it)

No JSX, CSS, React or `@bundle` imports. Import data helpers from `../../../data/derive.js`
and `../../lib.js`, findings from `../../insights.js`.

```js
export default {
  id: 'lag-dist',                       // = folder name
  title: 'How fast pickups travel',     // gallery card + default block title
  description: 'One sentence: what it shows and how to read it.',
  job: 'flow',                          // headline | trend | compare | flow | evidence | words
  frame: { title: true },               // optional; title: false hides the title row (KPIs do)
  sizes: { min: { w: 2, h: 2 }, max: { w: 6, h: 4 }, presets: ['3x2', '3x3', '6x2'] },
  params: {                             // the studio builds its form from this
    observedOnly: { type: 'bool', label: 'Observed pickups only', default: false },
  },
  requires: bundle => bundle.edges.length >= 5 || 'needs at least five pickups',
  usesEstimates: (bundle, params, filters) => !params.observedOnly && bundle.edges.some(e => e.synthetic),
  defaultTitle: (params, bundle, filters) => 'How fast pickups travel',   // optional
  suggest(bundle, insights, filters) {  // [] when it has nothing to say
    return [{ params: {}, size: '3x3', score: 0.45, reason: 'Median pickup lag 3.7 days over 10 observed pickups.' }];
  },
};
```

**Param types:** `enum` (`options: [{value, label}]`), `multi` (same, array value), `int` (`min`, `max`),
`bool`, `text` (`multiline`), `series` (a narrative id), `source` (an outlet id; `observedOnly`, `optional`).
`default` can be a value or `(bundle, filters) => value`.

**`suggest`** is what makes the gallery "recommended": return proposals only when the data makes
the view worth showing, with a `reason` sentence whose numbers you computed from the bundle,
and a `score` from 0 to 1 (headline ≈ 0.9, a strong spike ≈ 0.8–1, context ≈ 0.4). Sizes must be
within `min`/`max`; params must be declared.

## View.jsx: draws into a fixed box

```jsx
export default function LagDist({ bundle, params, filters, box }) { … }
```

- `params` already has defaults filled in. `filters` = `{ range, metric }` of the page.
  `rangeBounds(bundle.weeks, filters.range)` gives the week indexes `[lo, hi]`.
- `box` = `{ wMm, hMm, wPt, hPt, density }`, the space inside the frame. `density` is `xs | s | m | l`.
- **SVG in points:** wrap the drawing in `<Svg box={box} label="…">`. One SVG unit is one point,
  so `font-size={7}` is 7 pt on paper. Use `<Text>` (sets the font stack), `TYPE` and `FONT` from `../../draw.jsx`.
- **Decide before drawing.** Work out how many rows, ticks and labels fit from `box.hPt`/`box.wPt`;
  measure text with `textWidth`/`truncate`/`wrap` from `../../text.js`; show "+N more" rather than
  squeezing. Return `<Empty>…</Empty>` with a plain sentence when the block is too small or there is no data.
- **HTML views** (text-heavy) use pt font sizes and `FitText` from `../../markdown.jsx`
  (shrinks from max to 6.5 pt; items with `data-drop` are dropped from the end if still too long).
- **Colours:** literal values from `C` in `../../palette.js` (`ramp(t)` for magnitude). No CSS variables, no `color-mix()`:
  the HTML export must stand alone.
- **Estimated data:** dashed strokes (`strokeDasharray="3 2"`, `C.inkFaint`) or the hatch from
  `useHatch()` in `../../draw.jsx`, and `usesEstimates` in meta so the frame shows the chip.
- **No interaction, no animation**: paper has no hover. Label directly; a legend for 2+ series.
- Never import dashboard components (`src/components`, `src/views`) or `ds/`; they carry cards, hover and web fonts.

## Testing a new viz

```sh
npm run report -- --gallery --only lag-dist   # exit 0 at every preset, PNGs in reports/out/gallery/
npm test
```

Then add it to a real page (`--auto` will pick it if `suggest` scores it high enough) and look at the PNG.

## Worked example: a minimal ranked bar view

```jsx
import React from 'react';
import { C } from '../../palette.js';
import { Svg, Text, TYPE, FONT, Empty } from '../../draw.jsx';
import { truncate, textWidth } from '../../text.js';

export default function TopOutlets({ bundle, box }) {
  const rows = [...bundle.sources].sort((a, b) => b.article_count - a.article_count);
  const rowH = 13;
  const shown = rows.slice(0, Math.max(1, Math.floor((box.hPt - 10) / rowH)));
  if (box.wPt < 80) return <Empty>Too narrow. Make this block wider.</Empty>;
  const labelW = 70;
  const valueW = textWidth('99,999', TYPE.value, FONT.monoMedium) + 4;
  const max = Math.max(...shown.map(r => r.article_count), 1);
  const barW = box.wPt - labelW - valueW;
  return (
    <Svg box={box} label="Articles per outlet">
      {shown.map((r, k) => {
        const y = k * rowH;
        const len = (r.article_count / max) * barW;
        return (
          <g key={r.id}>
            <Text x={0} y={y + 9} size={TYPE.label} font={FONT.bodyMedium}>{truncate(r.name, labelW - 4, TYPE.label, FONT.bodyMedium)}</Text>
            <rect x={labelW} y={y + 3} width={len} height={7} rx={2} fill={k === 0 ? C.burgundy : C.burgundySoft} />
            <Text x={labelW + len + 3} y={y + 9} size={TYPE.value} font={FONT.monoMedium}>{r.article_count.toLocaleString('en-GB')}</Text>
          </g>
        );
      })}
      {rows.length > shown.length && <Text x={0} y={box.hPt - 2} size={TYPE.tiny} fill={C.inkMuted}>+{rows.length - shown.length} more</Text>}
    </Svg>
  );
}
```
