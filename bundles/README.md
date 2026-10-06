# Bundles: the contract between analysis and presentation

A bundle is one JSON file holding everything a reader needs to show the analysis results.
The pipeline writes bundles. Frontends (`presentation/`, or anything else) read them.
Neither side imports the other's code or reads the other's internal files.

```
pipeline ──python run.py bundle──► bundles/<date>.json ──--promote──► bundles/latest.json ──► readers
```

## Producing a bundle

```sh
.venv/bin/python run.py bundle            # writes bundles/<date>.json and prints what changed against latest.json
.venv/bin/python run.py bundle --promote  # also replaces latest.json, which is what readers load
```

`bundle.py` (stdlib only) reads the scan reports, the crawl manifest, `data/edges.jsonl`, the codebook, the catalogue and `narratives.json`.
It never overwrites `latest.json` without `--promote`, so a routine run can't silently change what readers show.
Only `latest.json` is tracked in git; dated bundles are local.

## Shape (`meta.schema_version: 1`)

| Key | Content |
|---|---|
| `meta` | `schema_version`, `bundle_id`, `generated` (ISO date), `method`, `window {start, end}`, `synthetic_note` |
| `weeks[]` | `{week: "2026-W22", start, end}` in order. Every weekly array below is aligned to this list. |
| `series[]` | Narratives (frames and subjects): `{id, kind: "frame" \| "subject", label, target, pattern (regex), status}` |
| `sources[]` | Outlets: `{id, rank, rank_label, name, control, language, script, article_count, date_span, weekly_articles[], weekly_observed, crawl {discovered, ok, reject, error}, series[]}` |
| `sources[].series[]` | `{id, article_count, share_pct, peak {week, week_start, n, share_pct, z} \| null, weekly_n[], quotes[{date, week, url, title, section, quote}]}` |
| `upstream[]` | Wire services that appear only as pickup origins: `{id, rank, rank_label, name, control, language}` |
| `edges[]` | Pickups between outlets: `{from_source_id, to_source_id, relation: citation \| topic_echo \| near_duplicate, lag_hours, similarity, rule, example_overlap, synthetic}` |
| `dsn_narratives[]`, `dsn_meta` | Reference narratives from the DSN report |

**Units.** `share_pct` and `peak.share_pct` are percentages (0–100). `lag_hours` is in hours.

## Observed vs estimated

Some values are estimated, and every estimate is flagged. A reader must keep the flag visible.

- `sources[].weekly_observed: false`: that outlet's `weekly_articles` and `series[].weekly_n` are estimated from its observed totals and peak. Totals, shares, peaks and quotes are observed.
- `edges[].synthetic: true`: the pickup is estimated from assumed flows between outlets.
- `crawl.reject` and `crawl.error` are split 70/30 from the unexplained gap when the crawl manifest has no counts.

## Versioning

- Adding a key keeps `schema_version: 1`. Readers must ignore keys they don't know.
- Renaming, removing or changing the meaning of a key means `schema_version: 2`. Readers support both versions for one release.
