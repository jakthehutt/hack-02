# EUvsDisinfo: A Dataset for Multilingual Detection of Pro-Kremlin Disinformation in News Articles

- **URL:** https://arxiv.org/abs/2406.12614
- **Publisher / venue:** João A. Leite et al., CIKM 2024 (ACM); code at https://github.com/joaoaleite/euvsdisinfo
- **Retrieved:** 2026-09-26
- **Cited in:** 2026-09-26-narrative-early-warning-prior-art.md §6; concept.md §7

## What it was cited for

A multilingual dataset of roughly 18,000 news articles labelled as containing misinformation or not, described by the authors as the largest such resource in both article count and number of distinct languages, with the broadest topical and temporal coverage. It is constructed from the URLs cited inside the debunk articles published by the EUvsDisinfo project, which supplies the labels. The reported distribution of disinformation publishers is led by Sputnik at 15.7 percent, RT at 11.3 percent, RIA Novosti at 4.7 percent, Tsargrad at 2.1 percent and Ukraina.ru at 1.6 percent. Collection and replication code is public.

Cited as our fastest route to labelled multilingual training and evaluation data, and as the baseline other work in this area is measured against. The structural caveat we recorded ourselves: because labels derive from published debunks, models trained on it can only recognise narratives that were already catalogued, which is why any forward-looking claim needs a time-frozen holdout.
