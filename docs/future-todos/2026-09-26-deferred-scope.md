# Deferred scope — parked on 2026-09-26

Items deliberately cut from the hackathon prototype in [`docs/concept.md`](../concept.md) §7.
Parked, not abandoned. Check items off or delete this file once picked back up.

## Platform / social-media data
- [ ] Apply for VLOP data via the **DSA Art. 40 Data Access Portal** (live since 28 Oct 2025; ~80 working days to notification via the Digital Services Coordinator). Multi-month, institutional, refusable — start it early precisely *because* it is slow, but do not design the prototype around it.
- [ ] Reddit, LinkedIn, X ingestion. Each has its own licensing and cost posture; none is needed to test the revised hypothesis.
- [ ] L0 (origin layer) Telegram collection at scale, including the ~330 documented German-language pro-Kremlin channels. Blocked on the ethics/legal review below.

## Legal and ethics review (blocking for specific layers)
- [ ] Qualified opinion on whether research analysis and archiving of RT/Sputnik content sits outside the broadcasting/distribution prohibition in **Council Regulation (EU) 2022/350**.
- [ ] Confirm the project qualifies as a "research organisation" with "lawful access" under **DSM Directive Art. 3** — this is the stated legal basis for news collection and it needs to be true, not assumed.
- [ ] Ethics framework for Telegram collection (public channels only, retention, pseudonymisation of non-public figures).
- [ ] Publication policy for person-level output. Automated attribution of a sitting MP is the highest-liability artifact this system can emit; decide the human-review gate and the right of reply before any such output exists.

## Method work that the prototype only stubs
- [ ] **Prospective holdout design.** Freeze the claim register at date T, evaluate on T+1…T+n. Without this, "early warning" is not a supportable description of the system — it is retrospective description.
- [ ] Sitting-day-aligned null model for the publication-cadence confound (L1 publishes ~155 items/day; parliament sits ~2 days/week).
- [ ] Temporal-contamination control: quantify how much measured performance on 2023–2026 cases comes from the model already knowing these were attributed influence operations.
- [ ] Automatic expansion of the claim register (originally roadmap step 5). Needs the manual register to work first, or it will expand into noise.
- [ ] Extend to German federal and state parliaments via **SpeakGer**; other ParlaMint countries after that.
- [ ] Reconcile the ParlaMint-AT (1996–2022) and `parlament.gv.at` (2022→) schemas into one speech table. Confirm first whether a later ParlaMint release already extends the Austrian end date.

## Open factual questions
- [ ] Resolve what **"Jev"** refers to in the A3 brief ("Jev tooling", "Jev semantic linter", "Jev quickstart"). Unidentified; do not build against a guess.
- [ ] Confirm what of the AIES study is publicly citable and what is embargoed.
- [ ] Verify the claimed existence of an EUvsDisinfo MCP server for programmatic case access.
