# Report spec

One JSON file per report. The studio edits it, the agent writes it, `npm run report` draws it.
Code: `presentation/src/report/spec.js` (normalize + validate), `grid.js` (geometry).

```json
{
  "version": 1,
  "title": "Narrative brief",
  "subtitle": "Sachsen-Anhalt spiked in RT DE: 10.6% in the week of 24 Aug, usually 4.0%",
  "filters": { "range": "all", "metric": "share" },
  "page": { "paper": "tinted" },
  "blocks": [
    { "id": "kpis",  "viz": "kpi-row",     "x": 0, "y": 0, "w": 6, "h": 1 },
    { "id": "trend", "viz": "timeline",    "x": 0, "y": 1, "w": 6, "h": 3, "params": { "source": "rt_de", "series": "sachsen_anhalt" } },
    { "id": "map",   "viz": "heatmap",     "x": 0, "y": 4, "w": 4, "h": 3 },
    { "id": "find",  "viz": "key-findings","x": 4, "y": 4, "w": 2, "h": 3, "params": { "count": 3 } },
    { "id": "how",   "viz": "text",        "x": 0, "y": 7, "w": 6, "h": 1, "title": "How to read this",
      "params": { "md": "**Share** is matching articles per 100 the outlet published." } }
  ]
}
```

| Key | Values |
|---|---|
| `version` | `1` |
| `title` | Page title (18 pt, one line; long titles are truncated with a warning) |
| `subtitle` | One line under the title; good place for the headline insight. Default: "DE · RU influence monitor · share of articles" |
| `filters.range` | `"all"`, `"12"` or `"4"` (last N weeks). Short ranges only use outlets with observed weekly counts. |
| `filters.metric` | `"share"` (per 100 articles) or `"count"` (articles) |
| `page.paper` | `"tinted"` (brand paper, full bleed) or `"plain"` (no background, for office printers) |
| `date` | Optional ISO date for the footer; default today |
| `blocks[]` | See below |

## Blocks

| Key | Meaning |
|---|---|
| `id` | Unique, short |
| `viz` | A registered viz id (`npm run suggest -- --json` → `vizzes`) |
| `x`, `y` | Top-left cell, 0-based. Columns 0–5, rows 0–7 |
| `w`, `h` | Size in cells, within the viz's `sizes.min`/`max` |
| `params` | Viz params; missing ones take the viz defaults |
| `title` | Optional override; `false` hides the title row |
| `caption` | Optional one line under the block (6.5 pt) |

Blocks may not overlap or leave the grid.

## The grid

A4 portrait, 12 mm margins, a 16 mm header band, a 6 mm footer band with the provenance line.
Body: 6 columns × 8 rows of 27.7 × 27.1 mm cells with 4 mm gutters.

| Size | Real size | Good for |
|---|---|---|
| 6×1 | 186 × 27 mm | KPI row, a one-line note |
| 2×1 / 1×1 | 59 × 27 / 28 × 27 mm | single numbers |
| 3×2 | 91 × 58 mm | small ranked list, short notes |
| 3×3 | 91 × 89 mm | ranked bars, quotes, findings, forest plot |
| 6×2 | 186 × 58 mm | small multiples, a compact timeline, flow map |
| 6×3 | 186 × 89 mm | timeline, heatmap, flow map |

A typical page: `kpi-row` 6×1, a trend 6×2–6×3, a compare block 6×3 or two 3×3, then evidence/words.

## Templates (`src/report/templates.js`)

`auto` (from insights), `overview`, `narratives`, `origin`, `sources`. Use them through
`npm run report -- --auto` / `--from-dashboard '{"view": …}'`, add `--save-spec` to get an
editable spec in `reports/`.

## Output and the fit report

`reports/out/<name>.pdf` (one A4 page, fonts embedded), `.png` (2×, clipped blocks outlined red),
`.html` (self-contained, no scripts, prints to one page, embeds the spec), `.fit.json`:

```json
{ "ok": false, "pages": 1,
  "fit": { "ok": false, "blocks": [
    { "id": "find", "viz": "key-findings", "ok": false,
      "issues": [{ "kind": "overflow", "axis": "y", "mm": 3.2 }], "warnings": [] } ],
    "warnings": [{ "kind": "title-truncated", "text": "…" }] },
  "errors": [] }
```

| Issue | Fix |
|---|---|
| `overflow` (y/x, mm) | Bigger preset, fewer items (`count`, mode), shorter text |
| `text-clipped` | The view ran out of room: bigger block or a less dense mode |
| `tiny-text` (< 6.5 pt) | Give the block more room; never accept it |
| `error` | The view threw; read the message, check params (ids must exist in the bundle) |
| warnings `title-truncated` etc. | Shorten the title/caption (not fatal, but fix it) |
