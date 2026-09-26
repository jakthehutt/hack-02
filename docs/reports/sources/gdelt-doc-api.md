# GDELT DOC 2.0 API

- **URL:** https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/
- **Publisher / venue:** The GDELT Project
- **Retrieved:** 2026-09-26
- **Cited in:** 2026-09-26-narrative-early-warning-prior-art.md §9; concept.md §7

## What it was cited for

GDELT monitors print, broadcast and web news in over 100 languages worldwide, updating every 15 minutes, with historical archives reaching back to 1979. The DOC 2.0 API returns, per matching article, the headline, URL, outlet domain, source country, language and publication time, and includes a timeline mode that reports the volume of coverage matching a query by day, hour or 15-minute bucket, with 15-minute resolution available for spans under 72 hours. Secondary guidance records two limits that constrain any design built on it: the document index covers roughly a rolling three months, and queries are capped at 250 articles.

Cited as the free baseline our frame-level detector has to be compared against, since it answers the topic-volume question cheaply and at scale. The rolling window and the article cap are why it cannot serve as our corpus, and both should be confirmed against current GDELT documentation before the benchmark is built on them.
