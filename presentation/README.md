# Foreshock presentation

Everything visual in Foreshock: the dashboard, the report studio and the A4 renderer.
It reads one thing from the analysis: a **bundle** (`../bundles/latest.json`, documented in
[`../bundles/README.md`](../bundles/README.md)). It never reads pipeline files or imports
pipeline code, and the pipeline knows nothing about this folder. `npm test` checks both directions.

```
pipeline ──python run.py bundle --promote──► bundles/latest.json ──► presentation/
                                                                      ├─ /              dashboard
                                                                      ├─ /studio.html   report studio
                                                                      ├─ /sheet.html    bare A4 page
                                                                      └─ npm run report → PDF · HTML · PNG
```

```sh
npm ci
npm run dev        # dashboard at /, studio at /studio.html (one-click PDF, saves into reports/)
npm run build      # static site in dist/: index.html, studio.html, sheet.html
npm test           # contracts, layout, insights, boundary
```

`FORESHOCK_BUNDLE=/path/to/bundle.json npm run build` builds against another bundle.

## Dashboard

`index.html` → `src/main.jsx`, `src/App.jsx`, `src/views/`, `src/components/`, `src/ds/` (the Keypad
design system). Its data hook `src/data/index.js` imports the bundle; `src/data/derive.js` holds the
pure selectors every view and report shares. The **A4 report** button in the top bar opens the
current view (view, weeks, measure, focused narrative and outlet) in the studio.

## Reports: one A4 page, always

A report is a JSON spec of blocks on a 6 × 8 grid (`reports/*.spec.json`; format in
[`.claude/skills/foreshock-report/references/spec.md`](../.claude/skills/foreshock-report/references/spec.md)).
The same spec is drawn by the studio, `/sheet.html` and the CLI, so screen, PDF, HTML and paper match.

How "always one A4 page" holds:

1. Everything on the sheet is in mm and pt (`src/report/grid.js`): 210 × 297 mm, 12 mm margins, cells of 27.7 × 27.1 mm.
2. Each visualization gets a fixed box and decides how much to show before drawing (rows, ticks, labels, "+N more").
   Text blocks shrink to fit, down to 6.5 pt.
3. After drawing, a fit check (`src/report/fit.js`) finds content taller or wider than its box, SVG text cut off,
   text under 6.5 pt and overlapping labels.
4. The sheet clips at its edge and `@page { size: A4; margin: 0 }` makes print and PDF exactly one page;
   the renderer still checks the PDF's page count.
5. `npm run report` exits 2 and outlines the block in red in the PNG when anything was cut off.

### Commands

```sh
npm run suggest [-- --json]                       # what the data shows, ranked blocks with reasons
npm run report -- reports/example.spec.json       # → reports/out/example.{pdf,png,html,fit.json}
npm run report -- --auto [--save-spec]            # compose a page from the data
npm run report -- --from-dashboard '{"view":"overview","range":"12","metric":"share"}'
npm run report -- --gallery [--only heatmap]      # every viz at every preset size
npm run new-viz -- <id> --job <job>               # scaffold a new visualization
```

PDF rendering uses your installed Google Chrome through `playwright-core` (nothing to download).
Elsewhere set `FORESHOCK_CHROME=/path/to/chrome` or run `npx playwright install chromium`.

The exported HTML is one file with no scripts: the sheet, its CSS and the fonts it uses as data URIs,
plus the spec in `<script type="application/json" id="foreshock-spec">`, so the studio can open it again.
It prints to one A4 page from any browser (turn off the browser's own headers and footers if it adds them).

### Studio

`studio.html` → `src/studio/`. Left: the gallery, ranked by what the bundle shows (`src/report/recommend.js`
over `src/report/insights.js`), each card a live preview with its reason. Middle: the true-size sheet; drag
blocks, drag a corner to resize, drop gallery cards. Right: the inspector (params, size presets, title,
caption, "try another form", fit problems in plain language). Undo/redo, keyboard moves, templates,
auto-compose, open a spec/exported HTML/bundle, print, export HTML; in `npm run dev` also one-click PDF
and saving into `reports/` (`scripts/vite-report-plugin.mjs`). The page lives in the URL hash, so a link
reopens it.

### Visualizations

One folder per viz in `src/report/viz/<id>/`: `meta.js` (plain ESM: sizes, params, data requirement,
suggestions with reasons) and `View.jsx` (draws into its box in pt). The registry finds folders by itself.
Contract: [`viz-contract.md`](../.claude/skills/foreshock-report/references/viz-contract.md).

| Job | Viz |
|---|---|
| Headline | `kpi-row`, `kpi` |
| Trend | `timeline`, `small-multiples` |
| Compare | `heatmap`, `ranked-bars` (spikes, movers, narratives, outlets, carriers, routes), `forest-plot` |
| Flow | `propagation-flow`, `lag-dist` |
| Evidence | `quotes` |
| Words | `key-findings`, `text` |

Estimated data (weekly curves of outlets without observed weeks, synthetic pickups) is drawn dashed or
hatched, blocks that show it carry an "Estimated" chip, and every sheet's footer says what was observed.

## Agent skill

`.claude/skills/foreshock-report/` teaches Claude Code to compose reports with these commands and to add
visualizations to the gallery. Ask for "a one-page brief of this week" or "a new chart for the reports".
