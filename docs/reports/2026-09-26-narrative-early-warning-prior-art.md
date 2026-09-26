# Prior art and feasibility check: narrative early-warning for DACH political discourse

**Date:** 2026-09-26 · **Author:** Jakob Hutter (with Claude Opus 5) · **Purpose:** verify the factual claims underlying [`docs/concept.md`](../concept.md) before they are presented as recommendations.

Each section states a claim the concept rests on, the source checked, the verdict, and — where relevant — the attempt to break it.

---

## 1. Claim: "Russian media outlets spike on topics before those topics appear in domestic discourse."

**Verdict: conditionally false as stated — and already tested.**

Yang, McCabe & Hindman (2024, *The International Journal of Press/Politics*) analysed 4.7M English-language articles from RT, Sputnik and 67 other news outlets shared on Facebook, 2017–2021, using Granger causality plus impulse-response functions. Findings:

- RT and Sputnik **Granger-cause** coverage across *all* categories of US media (centre, left, right, far-right) **on their high-priority geopolitical issues** (Middle East, armed conflict, international statecraft).
- On **US domestic** matters they **follow** rather than lead, particularly relative to centre and far-right outlets.
- Two reciprocal relationships were found (right-wing and far-right US media leading additional RT/Sputnik coverage).

**Verdict revised 2026-09-26 after internal challenge.** The first version of this section concluded that the hypothesis was "conditionally false" because all three of our case examples were domestic. **That classification was wrong.** Ceuta is a Spanish exclave: the crisis concerns Spain–Morocco relations, the EU external border and EU migration policy. It belongs on the international-statecraft side of the axis, i.e. the category where Yang et al. found Russian outlets *do* lead. The France wildfires are a domestic event carrying an explicitly geopolitical frame (EU sanctions on Russia). Only the Paris bedbug case is unambiguously domestic.

**Attempt to break the source's applicability:** three limits, each of which reduces how much weight it can carry against us. (1) The downstream is US media and "domestic" means *US* domestic politics, so transferring the category to European cases requires an explicit mapping. (2) The window is 2017–2021, i.e. before the architecture we study existed — the EU broadcasting prohibition, Portal Kombat/Pravda and Doppelgänger all date from 2022. (3) The unit is topic coverage volume between news outlets, whereas our downstream is a parliament with a different agenda mechanism.

**Corrected verdict: the hypothesis is unproven for our setting, and this is the baseline to beat rather than a refutation.** What survives, and is strengthened, is the change of analytical unit: the injected frame in every case *relocates* the story across the domestic↔geopolitical axis, so that axis is the variable under attack rather than a property we can classify once. This is now the basis of the framing-drift detector in `concept.md` §4.

Sources: [S01](sources/yang-mccabe-hindman-2024-lead-or-follow.md)

---

## 2. Claim: our three case examples are real, and they share a common structure.

**Verdict: all three verified; the shared structure is the most useful finding of this review.**

| Case | Status | Documented path |
|---|---|---|
| Paris bed bugs, 2023 | Real infestation (H2 2023). French minister Jean-Noël Barrot stated in March 2024 that the polemic was "in a very large part amplified by accounts linked to the Kremlin"; the injected frame tied the infestation to the arrival of Ukrainian refugees. | amplification of a genuine local event + refugee frame |
| Ceuta, July–August 2026 | Real border crisis. Spanish PM Sánchez publicly accused Russia and Israel of spreading disinformation. Analysts traced origin to **Rybar** (Telegram channel with reported links to Russian intelligence), then "repeater" accounts including Pravda-network-linked accounts; >1,500 items across the pro-Russian network, ~300 in its Spanish edition. European Commission dated the amplification push from 30 July. | Telegram origin → repeater/laundering layer → far-right domestic accounts |
| France wildfires, summer 2026 | Real fires (June 2026 hottest on record in Western Europe per Copernicus). Injected frames: (a) EU sanctions on Russia caused the fire-fighting failure; (b) fabricated petitions showing French citizens turning against support for Ukraine. Fake content first appeared on Russian channels on the **MAX** messaging platform, then amplified by the Pravda network and pro-Kremlin Telegram, then by pro-Russian politicians. | Messenger origin → laundering → political amplification |

**The structure:** in every case the *event* is genuine and was going to be reported anyway; what is injected is the **causal attribution frame**. Note that the events differ in kind — one municipal public-health story, one EU-level border and foreign-policy crisis, one national civil-protection emergency — yet the injected frames all point the same way, toward the war, sanctions, refugees and EU failure. The events are interchangeable carriers; the target messages are a small and stable set. That asymmetry is what licenses the change of analytical unit from keyword to claim-frame, and it is the single most consequential correction to the original concept.

Sources: [S06](sources/rferl-2024-bedbugs-kremlin-amplification.md), [S07](sources/detector-media-2026-ceuta-fakes.md), [S08](sources/irish-times-2026-ceuta-russia-linked-accounts.md), [S09](sources/ukrinform-2026-wildfires-propaganda.md), [S10](sources/stopfake-2026-wildfires-sanctions-manipulation.md)

---

## 3. Claim: naive web collection in this domain ingests adversarial content by design.

**Verdict: verified, with hard numbers — this is the strongest justification for the A3 track.**

- **Pravda network / Portal Kombat.** VIGINUM identified Portal Kombat in February 2024 (operating since February 2022). The Pravda successor network runs roughly **182 domains across 74 countries, publishing ~155 stories per day**, with deliberate SEO to raise visibility in search results and therefore in retrieval-augmented systems.
- **NewsGuard audit:** 10 major chatbots repeated Pravda-network narratives ~**33%** of the time, citing Pravda sites as legitimate sources. *Contested:* other researchers report far lower rates (~5%) and argue the alarm outpaces the evidence. **Do not present 33% as settled.**
- **DFRLab, April 2026 ("Pravda in the pipeline"), audit of Common Crawl:** Pravda-network English-language articles in Common Crawl rose from **37 (Nov 2024) to ~40,000 (Nov 2025)**. An RT article on alleged US-Ukrainian biolabs was archived ≥17 times and could be reproduced near-verbatim by text-completion probing of Llama 3.1 405B Base. DFRLab's own caveats: presence in Common Crawl does not prove model ingestion; the probed model has a Dec 2023 cutoff; completion probing cannot reconstruct training data precisely.
- **Doppelgänger** (attributed to the Russian firm Social Design Agency, from 2022) clones real outlet domains; German targets include *Der Spiegel*, *Bild*, *T-Online*, *Die Welt*, *FAZ*, *Der Tagesspiegel*, *Süddeutsche Zeitung*. CeMAS detected Doppelgänger-linked activity around the 2025 German election.

**Attempt to break it:** the LLM-grooming *effect* on model outputs is genuinely disputed and should be labelled as such. But the two facts our design depends on are not disputed: the laundering layer is large and crawler-optimised, and it clones legitimate domains. Both are collection-time problems regardless of whether any model was measurably poisoned. So `cluster` (source de-duplication) and `quarantine` (content-as-data) are justified on the undisputed facts alone.

Sources: [S11](sources/newsguard-2025-pravda-network-ai-infection.md), [S12](sources/dfrlab-2026-pravda-in-the-pipeline.md), [S13](sources/eu-disinfolab-doppelganger.md), [S14](sources/bsi-doppelgaenger-lagebericht.md)

---

## 4. Claim: hostile content reaching an LLM extraction step is a recognised, benchmarkable security class.

**Verdict: verified.** OWASP's Top 10 for LLM Applications (2025) puts prompt injection at LLM01 and explicitly foregrounds **indirect** prompt injection and multimodal injection, with root causes framed as excessive functionality, excessive permissions and excessive autonomy; recommended mitigations are defence-in-depth: input validation, output filtering, privilege restriction, human-in-the-loop for sensitive operations. **AgentDojo** provides the evaluation pattern worth copying: 97 user tasks and 629 security cases, executed live, reporting *benign utility*, *utility under attack* and *attack success rate* — i.e. it measures security **and** whether the agent still does its job. Our `eval` harness should report the same triple rather than attack-success-rate alone.

Sources: [S15](sources/owasp-llm-top10-2025.md), [S16](sources/agentdojo-benchmark.md)

---

## 5. Claim: there is usable existing infrastructure for the Austrian/German half.

**Verdict: verified, and it saves substantial time.**

- **ParlaMint** (CLARIN flagship): comparable parliamentary corpora for 29 European countries/regions, >1bn words, TEI-encoded, metadata on ~24k speakers, linguistically annotated to Universal Dependencies syntax and named entities; derived plain-text and CoNLL-U formats, TSV speech metadata. **ParlaMint-AT** (prepared by ÖAW/ACDH-CH) covers Austria **1996–2022**.
- **Gap:** 2022 → 2026 is not in ParlaMint. It must come from the Austrian Parliament's own open data — the *Stenographische Protokolle* datasets for Nationalrat and Bundesrat, with JSON metadata descriptions and filter/API result lists released under **CC BY 4.0**.
- **SpeakGer**: metadata-enriched speech corpus of German federal **and state** parliaments — the natural extension path beyond Austria.

**Attempt to break it:** the 1996–2022 / 2022–2026 seam is a real integration cost (two schemas, two annotation states) and the concept should not pretend otherwise. Also unverified: whether ParlaMint 5.0 extends AT past 2022 — the ACDH-CH corpus page states 1996–2022, and I did not find a 5.0-specific AT end date. **Check before relying on it.**

Sources: [S02](sources/parlamint-clarin.md), [S03](sources/parlamint-at-acdh.md), [S04](sources/parlament-gv-at-open-data.md), [S05](sources/speakger-corpus.md)

---

## 6. Claim: there is usable existing ground truth and a German-language NLP baseline.

**Verdict: partially — with a circularity warning.**

- **EUvsDisinfo dataset** (Leite et al., CIKM 2024): ~**18k** articles labelled misinformation / not, multilingual, largest such resource by article count and language count; built from URLs cited in EUvsDisinfo debunk articles. Top disinformation publishers: Sputnik 15.7%, RT 11.3%, RIA Novosti 4.7%, Tsargrad 2.1%, Ukraina.ru 1.6%. Collection code is published.
- **EUvsDisinfo** itself is the EEAS East StratCom Task Force's project (est. 2015) and provides a per-case credible/disinformation verdict. Researchers report that the underlying data is not directly available for analysis and has typically been scraped.
- **SemEval-2025 Task 10** supplies a fine-grained, topic-specific **narrative taxonomy** plus entity-framing and narrative-extraction subtasks for the Ukraine-Russia war and climate-change domains, in Bulgarian, English, Hindi, Portuguese and Russian — **German is not covered**, which is simultaneously a limitation and a contribution opening.
- **CLEF CheckThat! 2025** Task 2 (claim normalization) covers **German** among 13 monolingual languages: transforming informal posts into concise, self-contained, verifiable statements. This is the right formalism for our claim register. The 2026 edition moves toward source retrieval for scientific claims, numerical/temporal fact-checking with reasoning, and full fact-checking article generation.

**The circularity warning (my own, not from a source):** labels derived from EUvsDisinfo debunks can only ever detect narratives EUvsDisinfo has already catalogued. Any *forewarning* claim built on that label source is unfalsifiable without a prospective, time-frozen holdout. This is recorded as risk #2 in `concept.md` §9.

Sources: [S17](sources/leite-2024-euvsdisinfo-dataset.md), [S18](sources/euvsdisinfo-about.md), [S19](sources/semeval-2025-task10.md), [S20](sources/clef-checkthat-2025-2026.md)

---

## 7. Claim: the data we want is legally collectable.

**Verdict: mostly yes, with one item requiring actual legal review.**

- **EU DSM Directive 2019/790, Art. 3** permits reproductions and extractions by **research organisations** and cultural heritage institutions, for the purposes of **scientific research**, from works to which they have **lawful access**. Art. 2(2) defines TDM broadly ("any automated analytical technique… to generate information… patterns, trends and correlations"). This is the basis to cite for news collection — and it is why the institutional (AIES) affiliation is load-bearing rather than decorative.
- **Council Regulation (EU) 2022/350** (2 March 2022) prohibits operators from broadcasting, or enabling/facilitating/contributing to the broadcast of, RT and Sputnik content in the EU, by any means, until Russia ends the aggression and the propaganda. **Unverified and needs a lawyer:** whether and how research analysis and archiving sit outside "broadcasting/distribution". The practical consequence is the same either way — do not redistribute, and expect EU-side blocking to make those domains unreliable to fetch. Treating the laundering layer as the primary observable avoids most of this.
- **DSA Art. 40** researcher access to non-public platform data: delegated act adopted **July 2025**, Data Access Portal available **28 October 2025**, notifications from Digital Services Coordinators around **80 working days** after submission, first decisions expected **late February 2026**. Reporting describes implementation as inconsistent, narrow and contested, with researchers refused broad access on privacy/confidentiality grounds. **Conclusion: a multi-month institutional process, not a hackathon input.**
- **Telegram**: research tooling is mature (Telethon; `pytopicgram` packages collection for reproducibility). Practical limits: ~1–2s between history requests is stable; `GetParticipants` returns ~200 per call and floods after ~20–30 calls/hour on large groups. Public channels only; ethics framework required.

Sources: [S21](sources/dsm-directive-art3-tdm.md), [S22](sources/council-reg-2022-350-rt-sputnik.md), [S23](sources/dsa-art40-data-access.md), [S24](sources/pytopicgram-telegram-collection.md)

---

## 8. Claim: commercial tools already do this.

**Verdict: they do something adjacent, and none of it is a substitute.**

Blackbird.AI (Constellation; positioned highest for both Potential to Execute and Potential for Market Disruption in Gartner's **June 2026** Emerging Market Quadrant for Narrative Intelligence, and named "Company to Beat" for disinformation narrative intelligence), Alethea (Artemis AI; early warning of narrative threats, coordination analysis, synthetic-media detection), Graphika (network mapping), Logically (PRISMα). These are comms/risk products: proprietary scores, dashboards, enterprise pricing, social-first and English-first.

What they do not provide, and what a quantitative political-science pipeline requires: a citable per-record provenance chain, a documented estimator with confidence intervals, a reproducible offline archive, German-language parliamentary text as the downstream measurement point, and published false-positive rates at the study's actual prevalence. That gap is the project.

Sources: [S25](sources/gartner-blackbird-narrative-intelligence.md), [S26](sources/blackbird-ai-platform.md), [S27](sources/alethea-artemis.md)

---

## 9. Free baseline for coverage volume

**GDELT** monitors print, broadcast and web news in 100+ languages, updating **every 15 minutes**, with archives back to 1979. The **DOC 2.0 API** includes a timeline mode returning coverage volume by day/hour/15-minute bucket (15-minute resolution for spans under 72 hours), returning headline, URL, outlet domain, source country, language and publish time. Constraints that shape our design: the DOC index covers roughly a **rolling three months** and queries are capped at **250 articles**. Good enough to serve as the "topic volume" baseline our frame-level detector must beat; not sufficient as a corpus.

Sources: [S28](sources/gdelt-doc-api.md)

---

## 10. Not verified / open

- **"Jev"** — the A3 brief's "Jev tooling", "Jev semantic linter" and "Jev quickstart" could not be resolved to any identifiable product. Check the original brief; do not build against a guess.
- Whether the AIES study's published output exists publicly in a citable form — no matching publication surfaced in search. Confirm internally what can be cited and what is embargoed.
- Whether ParlaMint 5.0 extends ParlaMint-AT beyond 2022.
- Legal status of research archiving of RT/Sputnik content under Reg. 2022/350.
- The magnitude of the LLM-grooming effect (NewsGuard 33% vs ~5% in other work) — disputed; do not rely on it for any claim.

---

## Sources

Local cards in [`sources/`](sources/); see [`sources/INDEX.md`](sources/INDEX.md). Primary URLs:

- S01 https://journals.sagepub.com/doi/full/10.1177/19401612241271074 (paywalled; abstract and metadata retrieved via Semantic Scholar)
- S02 https://www.clarin.si/repository/xmlui/handle/11356/2004
- S03 https://www.oeaw.ac.at/acdh/research/dh-research-infrastructure/resources/corpora/parlamint-at-corpus
- S04 https://www.parlament.gv.at/recherchieren/open-data/daten-und-lizenz/stenographische-protkolle/index.html
- S05 https://arxiv.org/html/2410.17886v1
- S06 https://www.rferl.org/a/russian-disinformation-paris-bedbug-scare/32844452.html
- S07 https://en.detector.media/post/the-kremlins-migrant-weapon-in-ceuta-british-prisoners-in-the-ukrainian-armed-forces-and-a-missile-in-poland-a-review-of-russian-fake-news-from-july-29-to-august-4-2026
- S08 https://www.irishtimes.com/world/europe/2026/08/07/russia-linked-accounts-spread-far-right-narrative-online-during-ceuta-crisis-analysis-finds/
- S09 https://www.ukrinform.net/rubric-factcheck/4149314-russian-propaganda-exploiting-french-wildfires-to-discredit-support-for-ukraine.html
- S10 https://www.stopfake.org/en/manipulation-the-scale-of-europe-s-wildfires-was-caused-by-eu-sanctions-against-russia/
- S11 https://www.newsguardtech.com/special-reports/moscow-based-global-news-network-infected-western-artificial-intelligence-russian-propaganda/
- S12 https://dfrlab.org/2026/04/08/pravda-in-the-pipeline/
- S13 https://www.disinfo.eu/doppelganger/
- S14 https://medien.bsi.bund.de/lagebericht/en/doppelgaenger-desinformationskampagne/
- S15 https://genai.owasp.org/llm-top-10/
- S16 https://invariantlabs.ai/blog/agentdojo
- S17 https://arxiv.org/abs/2406.12614
- S18 https://euvsdisinfo.eu/about/
- S19 https://aclanthology.org/2025.semeval-1.331/
- S20 https://link.springer.com/chapter/10.1007/978-3-032-04354-2_13
- S21 https://academic.oup.com/book/39840/chapter/339978513
- S22 https://www.consilium.europa.eu/en/press/press-releases/2022/03/02/eu-imposes-sanctions-on-state-owned-outlets-rtrussia-today-and-sputnik-s-broadcasting-in-the-eu/
- S23 https://www.techpolicy.press/unpacking-the-eus-digital-services-act-delegated-act-on-data-access-/
- S24 https://www.sciencedirect.com/science/article/pii/S2352711025001086
- S25 https://www.gartner.com/en/documents/8172229
- S26 https://blackbird.ai/
- S27 https://blackbird.ai/blog/narrative-intelligence-platforms-communications-teams/
- S28 https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/
