---
name: foreshock-report
description: Create A4 one-page data reports (PDF + self-contained HTML) from Foreshock analysis bundles, turn a dashboard view into a printable sheet, or add a new visualization to the report gallery. Use when asked for a report, brief, one-pager, worksheet, printable/PDF/A4 version of the results or the dashboard, "this week's brief", or a new chart type for reports. Works only in presentation/ and never touches the analysis pipeline.
---

# Foreshock reports

A report is **data**: a JSON spec of blocks on a 6 × 8 grid. The renderer draws it on one A4 page
and refuses to let it spill. You never write layout CSS. You pick registered visualizations, size
them, give them params, and let the renderer check that everything fits.

```
bundles/latest.json ──► npm run suggest ──► you write reports/<date>-<slug>.spec.json
     (the only data)        (what stands out)              │
                                                          ▼
                     npm run report ──► reports/out/<name>.pdf · .html · .png · .fit.json
```

Everything runs from `presentation/` (`cd presentation` first; `npm ci` once).

## Ground rules

- **Read bundles only.** Never edit the Python pipeline, `bundles/`, or anything outside `presentation/` and this skill. If data is missing, say so; don't invent it.
- **No hand-typed numbers.** Every number in a title, caption or text block comes from `npm run suggest -- --json` (insight sentences, reasons) or is drawn by a viz from the bundle. Prefer the `key-findings` block over writing findings yourself.
- **Estimated stays marked.** Some weekly curves and most pickups are estimated (`weekly_observed: false`, `edges[].synthetic: true`). Views mark them and the footer says so. Never hide or remove that.
- **One page, nothing cut off.** `npm run report` exits 2 if anything is clipped or below 6.5 pt. Fix it and render again; don't hand over a report with exit 2.
- **Look at it.** Read the PNG before you say you're done.

## Commands (in `presentation/`)

| Command | What it does |
|---|---|
| `npm run suggest` / `-- --json` | Insights (with sentences), ranked block suggestions (viz, size, params, reason), the viz catalogue with params |
| `npm run report -- <spec.json>…` | Render specs → `reports/out/<name>.{pdf,png,html,fit.json}` |
| `npm run report -- --auto [--save-spec]` | Compose a page from what the data shows |
| `npm run report -- --from-dashboard '{"view":"narratives","range":"4","metric":"share","series":"kiewer_regime","source":"rt_de"}'` | A dashboard view as a page (views: overview, narratives, origin, sources) |
| `npm run report -- --gallery [--only <id>]` | Every viz at every preset size (fit regression and visual catalogue) |
| `npm run new-viz -- <id> --job <job>` | Scaffold a new visualization |
| `npm test` | Contract, layout, insight and boundary tests |
| `npm run dev` | Dashboard at `/`, studio at `/studio.html` (one-click PDF, saves into `reports/`) |

Useful flags: `--bundle <path>` (another bundle), `--formats pdf,png` (skip HTML), `--no-build` (reuse the last build; only when no source changed).

## A. Compose a report

1. `npm run suggest -- --json` and read `insights` (most salient first) and `suggestions`.
2. Decide the story before the layout: **one headline** (the top insight), then 3–5 blocks that support it, in reading order (headline → trend → compare → flow → evidence → words). If the user just wants "a report", `npm run report -- --auto --save-spec` is a good first draft to edit.
3. Write `reports/<YYYY-MM-DD>-<slug>.spec.json` (format: [references/spec.md](references/spec.md)). Use suggested sizes and params; the `kpi-row` 6×1 at the top is almost always right; finish with `key-findings`.
4. `npm run report -- reports/<file>.spec.json`
5. If it exits 1, the spec is invalid; the message names the block. If it exits 2, read the `.fit.json` (or the terminal lines) and fix: give the block a larger preset, choose fewer items (e.g. `key-findings` `count`), shorten a title or caption, or change the mode. Then render again.
6. Read `reports/out/<file>.png` and check it against [references/print-rules.md](references/print-rules.md).
7. Hand over the PDF, HTML and spec paths, plus the headline in one sentence.

## B. A dashboard view on paper

Use `--from-dashboard` with the view and the user's filters, then adjust the saved spec if they want changes. In the dashboard, the "A4 report" button opens the same page in the studio.

## C. Add a visualization to the gallery

1. Pick the **job** it does: headline, trend, compare, flow, evidence or words. Check the catalogue (`npm run suggest -- --json` → `vizzes`) so you don't duplicate an existing form, and that the form suits the job (one axis, no dual-axis; sequential colour for magnitude).
2. `npm run new-viz -- <id> --job <job> --title "<Title>"`
3. Implement `meta.js` and `View.jsx` following [references/viz-contract.md](references/viz-contract.md). Compute everything from the bundle with `src/data/derive.js`; size content from the box before drawing; mark estimated data.
4. `npm run report -- --gallery --only <id>` and read every PNG in `reports/out/gallery/<id>*.png`. It must exit 0 at every preset; drop presets that can't be made legible.
5. `npm test` (the contract test checks your meta, sizes, params and suggestions).
6. Make sure `suggest()` returns a reason with real numbers, so the viz shows up under "Suggested" when it matters.

## Before you hand over

- [ ] Exit code 0, one page, no clipped blocks, no console errors.
- [ ] You looked at the PNG: no overlapping labels, legends present for 2+ series, nothing empty or near-empty.
- [ ] The title/subtitle states the headline; every number traces to `suggest` output or a viz.
- [ ] Estimated data is still marked; the provenance footer is visible.
