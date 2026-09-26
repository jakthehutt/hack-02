# Pravda in the pipeline: Early evidence of state-adjacent propaganda in AI training data

- **URL:** https://dfrlab.org/2026/04/08/pravda-in-the-pipeline/
- **Publisher / venue:** Digital Forensic Research Lab (Atlantic Council), 8 April 2026
- **Retrieved:** 2026-09-26
- **Cited in:** 2026-09-26-narrative-early-warning-prior-art.md §3; concept.md §5a

## What it was cited for

An audit of Common Crawl for propaganda-network content. The headline measurement is a steep increase in Pravda-network English-language articles present in the crawl: from 37 in November 2024 to roughly 40,000 in November 2025. The researchers also found an RT article about alleged US-Ukrainian biolabs archived at least seventeen times, and were able to elicit near-verbatim reproduction of it by seeding opening sentences into Llama 3.1 405B Base. A Chinese operation, Glassbridge, had press releases ingested while its main content largely was not, owing to JavaScript-dependent page construction.

Cited as the strongest quantified justification for treating collection as an adversarial problem. The authors are careful about what the evidence supports: presence in Common Crawl does not establish that any model ingested the content, the probed model has a December 2023 knowledge cutoff, completion probing cannot reconstruct training data exactly, and the model's publisher applies its own deduplication and filtering. Our concept relies only on the crawl-presence growth figure, which is a direct measurement.
