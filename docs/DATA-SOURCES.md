# Data sources (EU disinfo — general)

Use these to refresh `data/seeds/`. **Verify licensing** before redistributing third-party lists in production.

## Official & multilateral

| Source | Use in checker |
|--------|----------------|
| [EUvsDisinfo](https://euvsdisinfo.eu/) | Narrative tags, debunk references (manual/API scrape policy) |
| [EEAS disinformation](https://www.eeas.europa.eu/eeas/disinformation_en) | Context links in EU panel |
| [EDMO hub network](https://edmo.eu/about/edmo-european-hub-network/) | Per-country resource links in `eu_resources.json` |

## Technical IO tracking

| Source | Use in checker |
|--------|----------------|
| [VIGINUM Portal Kombat CSV (GitHub)](https://github.com/VIGINUM-FR/Rapports-Techniques/tree/main/202402%20-%20Portal%20Kombat) | `known_io_domain` seed |
| ASP Pravda database (see ASP report) | Supplement Pravda/Portal Kombat |
| [DFRLab](https://dfrlab.org/) | Case studies for test URLs |

## German-language Russian propaganda (ranked)

Full catalogue, high control to low: [DE-RU-PROPAGANDA-CATALOGUE.md](DE-RU-PROPAGANDA-CATALOGUE.md).

Seed: `App_v01/data/seeds/de_ru_propaganda_catalogue.json`.

RT DE corpus (26 May–26 Sep 2026, 3 729 articles) and its collector live in the crawler model: `App_v01/crawler/`. Articles are `crawler/data/rt_de/articles.jsonl`. Re-run with `python App_v01/scripts/fetch_rt_de.py`.

| Rank | What it is | Checker use |
|------|------------|-------------|
| 1 | RT DE, Sputnik/SNA, embassy/MFA | `state_media` in `registry_domains.json` |
| 2 | Doppelgänger, Pravda DE, NewsFront DE, Voice of Europe | `known_io_domain` (Doppelgänger hosts are the 25 May 2024 snapshot) |
| 3 | RIA, TASS, Izvestia, RG, 16th-package wires | `source_media_domains.json` lineage only |
| 4–5 | Röper, Lipp, DACH relays | Catalogue only. Not scored as state media. |

**Note:** Presence of a link is **provenance signal**, not automatic “false.”

## State & proxy media (lineage checks)

Outbound link domains commonly flagged in EU monitoring live in `source_media_domains.json` (RT DE mirrors, `snanews.de`, NewsFront, RRN, plus `rt.com`, `sputniknews.com`, `tass.com`, `ria.ru`, `tsargrad.tv`).

## Fact-check corpora (debunked domains / URLs)

- National EDMO hubs (Greek, Romanian, Baltic hubs often publish domain-level findings)
- [EFCSN / fact-checking network members](https://efcsn.com/)

## Test sets (build your own)

Maintain in `data/seeds/test_urls.json`:

- `tier_a_mainstream_eu` — AFP, Reuters, Tagesschau, Le Monde, etc.
- `tier_b_known_io` — from VIGINUM + published investigations
- `tier_c_borderline` — aggregators, partisan but domestic outlets

## Refresh cadence (post-hackathon)

| Asset | Cadence |
|-------|---------|
| VIGINUM CSV | Weekly |
| Hostname patterns | When new phase reported |
| EU resources links | Quarterly |
| Gold test URLs | Before each demo |
