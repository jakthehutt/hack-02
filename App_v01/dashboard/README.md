# Foreshock — dashboard

React + Vite front end for the narrative scan. The components in `src/ds/` come from the
Keypad design system (claude.ai/design); colors and type follow the brand palette in
`src/ds/tokens` (Paper, Burgundy, Ink, Sovereign Blue; Geist, Inter, IBM Plex Mono).

```
npm install
npm run dev
```

## Data

The backend isn't wired yet. Every view reads from one hook, `src/data/index.js`, which
currently returns `src/data/fixture.json`. Replace its body with the real fetch and keep
the returned shape.

The fixture comes from `scripts/build_fixture.py` (run from the repo root:
`python3 App_v01/dashboard/scripts/build_fixture.py . App_v01/dashboard/src/data/fixture.json`).
Totals, peaks, quotes, RT DE weekly counts and the 10 edges in `data/edges.jsonl` are real.
Weekly curves for the other outlets, edges flagged `synthetic`, and some crawl
reject/error counts are generated.

## Layout

- `src/ds/` — design system tokens and components (import only via `ds/index.js`)
- `src/data/derive.js` — pure selectors (ranges, shares, spikes, movers, propagation links)
- `src/components/` — charts: heatmap, timeline, propagation map, lag histogram
- `src/views/` — Overview, Narratives, Propagation, Sources, Codebook
