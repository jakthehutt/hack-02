# Lessons log

Append-only. Dated entries: what was done, why, what was learned including dead ends, open questions.
Read this before assuming you know the repo's history.

---

## 2026-09-26 — Concept refinement and prior-art verification (no code yet)

**Done.** Turned a rough one-page idea into a reviewable concept plus a verified evidence base. Repo had
no commits before this. Created:
- `docs/concept.md` — the refined concept (tracks A3 + B3, hypothesis, benchmark plan, 72h scope, risks).
- `docs/reports/2026-09-26-narrative-early-warning-prior-art.md` — claim-by-claim verification with verdicts.
- `docs/reports/sources/` — 28 source cards + `INDEX.md`.
- `docs/future-todos/2026-09-26-deferred-scope.md` — what was cut and why.

**Why.** The original concept rested on one empirical hypothesis and several assumptions about tooling,
data and legality, none of which had been checked. Checking them changed the design substantially, which
is cheaper to discover now than during the build.

**What was learned — the four findings that changed the design.**

1. *The hypothesis was already tested and is conditionally false as stated.* Yang, McCabe & Hindman (2024)
   found RT/Sputnik Granger-cause US coverage on **geopolitical** topics but **follow** on **domestic** ones.
   All three of our case examples are domestic. Reframed: what leads is not the topic but the **causal
   attribution frame** attached to a real, locally generated event.
2. *Therefore the unit of analysis cannot be a keyword.* "Waldbrände" is exogenous and everywhere;
   "sanctions on Russia caused the fire deaths" is the rare, attributable object. The planned keyword/topic
   database was replaced by a claim-frame register with normalised claim text.
3. *The base rate makes the product spec, not just the evaluation.* At 400/12,000 = 3.33% prevalence, a
   90%-sensitivity / 90%-specificity detector yields 23.7% precision — 3.2 false alarms per true hit.
   80% precision at 90% recall requires **99.2% specificity**. This is now the headline benchmark number.
4. *The A3 security angle is not decoration.* DFRLab's Common Crawl audit found Pravda-network English
   articles rising from 37 (Nov 2024) to ~40,000 (Nov 2025), and Doppelgänger clones real outlet domains.
   Naive collection ingests a flooding operation and counts 182 clone domains as 182 independent sources.
   Source clustering and treating fetched text as data-never-instructions are validity requirements for
   the science, not just hardening.

**Dead ends and things that did not pan out.**
- *Using RT directly as the upstream source* — the original plan. Council Reg. (EU) 2022/350 prohibits
  broadcasting/distribution of RT and Sputnik in the EU, EU-side blocking makes the domains unreliable to
  fetch, and the research-exception question needs a lawyer. The laundering layer is both legally simpler
  and the better measurement point, so this was a productive dead end.
- *DSA Art. 40 platform data as a near-term input* — portal is live but the process runs ~80 working days
  through a Digital Services Coordinator with documented refusals. Moved to deferred work.
- *SemEval-2025 Task 10 as a drop-in German model* — the taxonomy is reusable but German is not among its
  five languages. CLEF CheckThat! 2025 claim normalization does cover German; that became the formalism.
- *Full-text of the Yang et al. paper* — sagepub returns HTTP 403 to automated fetching. Abstract and
  metadata came from the Semantic Scholar API instead. The methodological summary is abstract-level only
  and must not be cited as if the paper had been read.
- *Finding a published AIES study to cite* — nothing surfaced in search. Unresolved; may be unpublished
  or embargoed.

**Open questions carried forward.** Which layer pair is the primary claim (L1→L4 parliament is novel but
cadence-confounded; L1→L3 media is cleaner but less novel); whether the AIES coding scheme separates
narrative congruence from attribution; what "Jev" in the A3 brief refers to; whether to submit to one
track or both. Full list in `docs/concept.md` §10 and `docs/future-todos/`.

**Convention note.** No `CLAUDE.md` in this repo yet — nothing is implemented, so there are no commands or
tooling rules to record. Create it with the first code.

---

## 2026-09-26 (Nachtrag) — Korrektur: Ceuta ist keine Innenpolitik

**Auslöser.** Rückmeldung zum Entwurf: "Ceuta ist EU-Politik, nicht Innenpolitik." Zutreffend.

**Was falsch war.** Der erste Entwurf hat alle drei Fallbeispiele als "domestic" eingeordnet und daraus
geschlossen, Yang et al. (2024) würden die Hypothese widerlegen. Ceuta ist eine spanische Exklave; die Krise
betrifft die Beziehungen Spanien–Marokko, die EU-Außengrenze und die EU-Migrationspolitik — also genau die
Statecraft-Kategorie, in der Yang et al. einen **Führungseffekt** der russischen Outlets finden. Die
Waldbrände sind ein innenpolitisches Ereignis mit explizit geopolitischem Frame. Nur die Pariser Bettwanzen
sind eindeutig innenpolitisch.

**Zwei weitere Annahmen, die bei der Prüfung nicht gehalten haben.**
- Die US-Taxonomie ("domestic" = *US-*Innenpolitik) wurde stillschweigend auf europäische Fälle übertragen.
- Der Untersuchungszeitraum 2017–2021 liegt **vor** der Architektur, die wir untersuchen: EU-Sendeverbot,
  Portal Kombat/Pravda und Doppelgänger stammen alle aus 2022. Die gemessene Lead/Follow-Struktur muss die
  heutige Lage nicht beschreiben.

**Korrigiertes Urteil.** Die Hypothese ist für unser Setting **unbelegt, nicht widerlegt**. Yang et al. sind
die zu schlagende Baseline, kein Gegenbeweis. Das ist eine schwächere Behauptung als im ersten Entwurf und
die richtige.

**Was die Korrektur gebracht hat — der eigentliche Fund.** Der injizierte Frame bleibt in keinem Fall in der
Kategorie des Ereignisses, sondern **verschiebt die Geschichte über die Achse innenpolitisch↔geopolitisch**:
Bettwanzen werden zu einer Geflüchteten-Geschichte, Waldbrände zu einer Sanktions-Geschichte. Diese Achse ist
also nicht eine Eigenschaft, die man einmal klassifiziert, sondern die **angegriffene Variable**. Daraus folgt
ein zweistufiger Detektor, der im ersten Entwurf fehlte: billiges Screening auf **Framing-Drift** über alles,
teure Claim-Extraktion nur auf Kandidaten (`concept.md` §4). Die Ereignisse sind austauschbare Träger, die
Zielbotschaften ein kleines stabiles Set — diese Asymmetrie ist der Hebel.

**Lehre für die Arbeitsweise.** Die Fallbeispiele wurden in eine Kategorie eines fremden Papers einsortiert,
ohne die Einordnung selbst zu prüfen. Wenn eine Quelle ein bedingtes Ergebnis liefert, ist die Zuordnung der
eigenen Fälle zu diesen Bedingungen der eigentliche Analyseschritt — nicht Formsache.
