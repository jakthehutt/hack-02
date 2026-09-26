# Narrative monitor

Ready for the demo. The report is a weekly share of fixed German wording, with a quote. It is not a verdict that a sentence is false.

From `App_v01`:

```bash
python -m services.narratives
```

| File | Role |
|---|---|
| `codebook.py` | Closed list of German patterns |
| `scan.py` | Sentence match, weekly share, peak z-score, one quote |
| `crawler/data/rt_de/narratives_report.json` | RT DE weekly series |
| `crawler/data/narratives_cross.json` | Same patterns across German sources |

Sources: RT DE, Sputnik DE, Pravda DE, Anti-Spiegel, Apolut, Klagemauer, AUF1.

A hit is the share of that source's articles in the week. Volume is an agenda signal. Anti-Spiegel is one file dump dated a single day, so it has no timeline.

## Roadmap

[`roadmap/`](roadmap/ROADMAP.md) is the next stage: DSN narratives 1–5, stance, dedup of Pravda reprints, a larger labeled set. The scanner does not import it. Model weights and eval logs are gitignored.
