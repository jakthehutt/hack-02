# German-language Russian propaganda, ranked

Rank is **who controls the outlet**, from the Russian state down to people in Germany, Austria, and Switzerland who relay it. Audience size does not move an outlet up or down.

A hit in this catalogue is a provenance signal. It is not a finding that a particular article is false. German partisan media is not listed unless investigators have documented a relay of Russian state content or a personal operational tie.

Machine-readable copy: `App_v01/data/seeds/de_ru_propaganda_catalogue.json`. Stable hostnames from ranks 1–2 are also in `registry_domains.json`.

## Rank 1 — The Russian state, in German

| Outlet | Who runs it | Where to look | Why this rank |
|---|---|---|---|
| **RT DE** | ANO TV-Novosti, presidential administration | `de.rt.com`, `deutsch.rt.com`, `rtde.xyz`, and the `rtde.site` / `.team` / `.live` / `.life` / `.website` mirrors on the Bundesnetzagentur block list. `freede.tech` was serving the same articles in January 2025. | Official German state broadcaster. EU distribution ban since 2 March 2022. About 4 million visits in January 2025 across the site and twelve mirrors. |
| **Sputnik Deutschland / SNA / Satellit** | MIA Rossiya Segodnya | `sputniknews.com`, historical `de.sputniknews.com`, successor `snanews.de` | Same ban, second official German newsroom. Editors kept working from Berlin; the public name became Satellit. |
| **MFA and Embassy in Berlin** | Russian state | `mid.ru`, `germany.mid.ru` | Official speech, not a covert brand. Smaller audience, same author. |

Sources: [Regulation (EU) 2022/350](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32022R0350), [Bundesnetzagentur DNS block list (24 Feb 2025)](https://www.bundesnetzagentur.de/DE/Fachthemen/Digitales/Schutz/Netzneutralitaet/DNSsperren/AnordnungenGesetzlich_EU-Sanktionen.pdf), [bpb, Russland-Analysen 467](https://www.bpb.de/themen/europa/russland-analysen/nr-467/563546/analyse-die-russische-propaganda-wirkt/).

## Rank 2 — Covert operations aimed at Germany

These are not signed RT. Domains die after they are named. The table is the Federal Foreign Office snapshot of 25 May 2024 plus the VIGINUM Pravda nodes, not a live allow-list of every alias.

### Doppelgänger (RRN)

Attributed to Social Design Agency and Structura by the EU, France, the United States, and Meta. The Federal Foreign Office counted 50,000+ inauthentic German X accounts and 1.8 million posts in six weeks, and 12,970 articles on the fake portals from March 2023 to 25 May 2024.

**Clones of real German news sites** (content was never on the real site; other clicks bounce to the genuine `.de` domain):

| Fake host (plus aliases) | Impersonates |
|---|---|
| `bild.pics` (`.beauty`, `.eu.com`, `.ws`) | bild.de |
| `spiegel.ltd` (`.ink`, `.work`, `.life`, `.live`) | spiegel.de |
| `welt.ltd` (`.pm`, `.media`, `.ws`) | welt.de |
| `faz.ltd` (`.lol`, `.life`, `.agency`) | faz.net |
| `sueddeutsche.ltd` (`.co`, `.cc`, `.online`, `.me`) | sueddeutsche.de |
| `t-online.life` (`.cfd`, `.today`, `.online`) | t-online.de |
| `morgenpost.ltd` | morgenpost.de |
| `tagesspiegel.ltd` (`.co`) | tagesspiegel.de |
| `nd-aktuell.net` (`.co`, `.pro`, `.lol`) | nd-aktuell.de |

**Invented German portals** (shared templates, often no imprint): `rrn.media/de`, `meisterurian.io`, `arbeitspause.org`, `wanderfalke.net`, `grenzezank.com`, `besuchszweck.org`, `derbayerischelowe.info`, `grunehummel.com`, `miastagebuch.com`, `derglaube.com`, `kaputteampel.com`, `deintelligenz.com`, `hauynescherben.net`, `brennendefrage.com`, `derleitstern.com`, `derrattenfanger.net`.

Sources: [Auswärtiges Amt, 5 June 2024](https://www.auswaertiges-amt.de/resource/blob/2682484/2da31936d1cbeb9faec49df74d8bbe2e/technischer-berichtdesinformationskampagne-doppelgaenger-1-data.pdf), [EU DisinfoLab](https://www.disinfo.eu/doppelganger-operation/), [Qurium](https://www.qurium.org/alerts/under-the-hood-of-a-doppelganger).

### Pravda Deutschland (Portal Kombat)

VIGINUM’s network of machine-translated sites. German edition: `germany.news-pravda.com`. Earlier domain: `pravda-de.com` (registered 18 February 2024). Parent suffix: `news-pravda.com`. No masthead, no authors. The pages restack Telegram and Russian media into German.

Source: [VIGINUM Portal Kombat](https://www.sgdsn.gouv.fr/files/files/Publications/20240212_NP_SGDSN_VIGINUM_PORTAL-KOMBAT-NETWORK_ENG_VF.pdf), [dekoder](https://www.dekoder.org/de/article/russland-propaganda-pravda-deutschland-frankreich/).

### NewsFront, German desk

Crimea-based LLC Media Group NewsFront (Konstantin Knyrik). US sanctions describe direction by the FSB. EU broadcast ban effective 8 April 2025. German edition observed at `de.news-front.info`; the domain on the EU list is `news-front.su`.

Sources: [Council notice, Feb 2025](https://eur-lex.europa.eu/eli/C/2025/1466/oj/eng), [tagesschau / WDR, 24 Aug 2023](https://www.tagesschau.de/investigativ/wdr/russland-propaganda-newsfront-eu-usa-sanktionen-ukraine-100.html).

### Voice of Europe — German politics, English site

Prague outlet sanctioned in May 2024 with Viktor Medvedchuk and Artem Marchevskyi. The site is in English. It is here because Czech intelligence and EU governments described it as a vehicle for paying and platforming EU candidates, including German ones (`voiceofeurope.com`).

Sources: [Reuters, 27 May 2024](https://www.reuters.com/world/europe/eu-sanctions-voice-europe-related-businessmen-czech-ministry-says-2024-05-27/), [tagesschau](https://www.tagesschau.de/inland/innenpolitik/voice-of-europe-sanktionen-eu-afd-100.html).

## Rank 3 — Russian wires that the German desks translate

Not German outlets. A link from a German page to one of these is lineage.

| Outlet | Domain | Status |
|---|---|---|
| RIA Novosti | `ria.ru` | EU broadcast ban, May 2024 |
| TASS | `tass.com` | State news agency |
| Izvestia | `iz.ru` | EU broadcast ban, May 2024 |
| Rossiyskaya Gazeta | `rg.ru` | EU broadcast ban, May 2024 |
| Lenta, SouthFront, Strategic Culture, EADaily, Fondsk, RuBaltic, Krasnaya Zvezda | `lenta.ru`, `southfront.press`, `strategic-culture.su`, `eadaily.com`, `fondsk.ru`, `rubaltic.ru`, `tvzvezda.ru` | EU broadcast ban effective 8 April 2025 |
| Tsargrad | `tsargrad.tv` | Proxy frequently cited by the German desks |

## Rank 4 — German voices produced in Russia

Researchers tie these people to Russian state media. They do not run RT.

| Outlet | What is documented | Domain |
|---|---|---|
| **Anti-Spiegel**, Thomas Röper (St. Petersburg) | Guest on Russian state media and RT DE; presents himself as a correspondent from occupied Ukraine. State funding of the site is **not** established here. | `anti-spiegel.ru` |
| **Neues aus Russland**, Alina Lipp | Sold material to Russian state media; correspondent reporting from occupied areas. Mainly Telegram. | No stable news domain in this catalogue |

Source: [bpb, Russland-Analysen Nr. 456](https://www.bpb.de/system/files/dokument_pdf/Russland-Analysen_Nr._456.pdf).

## Rank 5 — Relays in Germany, Austria, and Switzerland

These are domestic outlets. Do not mark them as Russian state media.

| Outlet | What is documented |
|---|---|
| **Apolut** (Ken Jebsen), `apolut.net` | Personal tie to Ivan Rodionov, former RT DE editor-in-chief; attendance at Kremlin-affiliated events. |
| **Klagemauer.TV** | Promoted RT DE and passed on Lipp and Röper. |
| **Alles Ausser Mainstream** (Bodo Schiffmann) | Telegram channel temporarily carried RT DE after the EU ban. |
| **AUF1** (Stefan Magnet, Austria), `auf1.tv` | Personal political trip to Moscow with FPÖ figures. Proximity only; bottom of the list on purpose. |

Same source: Russland-Analysen Nr. 456.

## Left out on purpose

- German opposition, conspiracist, or partisan sites with no documented operational tie.
- Doppelgänger alias domains registered after 25 May 2024. Refresh from the Foreign Office method, Qurium, and EU DisinfoLab rather than freezing this list.
- Claims that appear only on secondary wikis.

## How the checker should use this

| Rank | Registry category | Score meaning |
|---|---|---|
| 1 | `state_media` | The URL is the Russian state speaking German |
| 2 | `known_io_domain` | The URL is a documented covert operation; say which network and which snapshot date |
| 3 | lineage list (`source_media_domains.json`) | The page points at a sanctioned wire |
| 4–5 | catalogue only | Cite the bpB finding in the evidence panel; do not apply the state-media weight |
