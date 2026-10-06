# Print rules for the A4 sheet

## Type (pt; one SVG unit = one pt)

| Use | Size | Face |
|---|---|---|
| Page title | 18 | Geist 800, burgundy |
| Block title | 9 | Geist 600 |
| Body, notes, findings | 8 (FitText may shrink to 6.5) | Inter 400 |
| Labels in charts | 7 | Inter 500 |
| Axis ticks | 7 | IBM Plex Mono 400 |
| Values at bar ends / line ends | 7.5 | IBM Plex Mono 500 |
| Footnotes, legends, sub-labels | 6.5 (the floor) | Inter 400, ink-muted |
| KPI figures | 16–28 | IBM Plex Mono 500 |

Nothing below 6.5 pt. Fonts are self-hosted (Geist, Inter, IBM Plex Mono incl. Cyrillic), never Google Fonts.

## Colour (literal hex from `palette.js`)

- Ink `#14110f` for text and axes; ink-muted `#6a615a` for secondary text; ink-line `#d0cbc6` for gridlines.
- Burgundy `#7a1f2b` is the accent: the one series, bar or route the block is about. Everything else is gray or burgundy-soft.
- Magnitude: the sequential `ramp(t)` (paper-deep → burgundy), labels flip to paper above 0.65.
- Diverging (rises vs falls): burgundy vs sovereign blue `#003399`, with a neutral zero line.
- Text never takes a series colour; a coloured mark beside it carries identity.
- Status colours (success, warning, danger) are not series colours.

## Form

- One axis. Never two y-scales; split into two panels instead.
- Emphasis beats rainbow: highlight one series, gray the rest.
- ≥ 2 series → a legend; ≤ 4 → also label directly at the line end.
- Label selectively: the endpoint, the peak, the one that matters; not every point.
- Thin marks: lines 1.5–1.8 pt for the focus and 0.8 pt for context; bars ≤ 9 pt thick with 2 pt rounded ends; gridlines 0.5 pt.
- Estimated data: dashed lines or the 45° hatch, and the block shows the "Estimated" chip. The footer always states what is observed.

## Look at the PNG and check

- [ ] Nothing outlined in red; the terminal says "1 page, everything fits".
- [ ] No label collides with another label, a line or the block edge.
- [ ] Every chart with 2+ series has a legend; every axis has units (%, articles, hours).
- [ ] No block is mostly empty (a near-empty block means wrong mode, wrong range or too big; resize or swap it).
- [ ] The page reads top to bottom: headline → trend → comparison → evidence → findings.
- [ ] The title and subtitle are each one line, and the subtitle states the headline finding.
- [ ] Numbers in text match the drawn values and the `suggest` output.
