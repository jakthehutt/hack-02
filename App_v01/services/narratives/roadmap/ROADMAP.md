# Roadmap

Not part of `python -m services.narratives`. The weekly report still counts codebook wording, not these five DSN narratives.

## Smoke test, 26 Sep 2026

24 hand-checked German sentences (`gold_dsn.json`), 14 of them endorsements. Too small to pick a model. Intervals overlap.

| Method | Precision | Recall | F1 | Denial marked as endorsement |
|---|---|---|---|---|
| NLI, long statement | 0 | 0 | 0 | 0 |
| NLI, one short hypothesis | 0.50 | 0.07 | 0.12 | 0 |
| NLI, hypothesis ensemble | 0.75 | 0.21 | 0.33 | 0 |
| NLI, fine-tuned last two layers | 0.71 | 0.36 | 0.48 | 0 |
| MiniLM cosine to the statement | 0.44 | 0.57 | 0.50 | 2 |
| MiniLM kNN, training sentences as the bank | 0.47 | 0.64 | 0.55 | 2 |
| MiniLM kNN inside the test set | 0.67 | 0.86 | 0.75 | 1 |

The last row is optimistic: neighbours are other test sentences. Three training sentences have cosine ≥ 0.8 to the test set. A retrain that drops them was stopped before it saved weights.

Logs from that run are in `runs/` (gitignored). Weights, if present locally, are in `../checkpoints/` (gitignored).

## Scripts

From `App_v01`, with `requirements-ml.txt` installed:

| Command | What it does |
|---|---|
| `python -m services.narratives.roadmap.eval_ml` | Score the smoke test again |
| `python -m services.narratives.roadmap.finetune_dsn` | Fine-tune; drops near-copies of the smoke test |
| `python -m services.narratives.roadmap.llm_classify` | Local Ollama judge, quote must be verbatim |
| `python -m services.narratives.roadmap.mine_candidates` | Unlabeled pool for a larger test set |

## Not done

- A labeled set of at least 300 sentences, two annotators.
- Topic filter, then stance. One NLI argmax confuses sanctions with deindustrialisation, and Ukraine with militarisation.
- Simhash dedup before cross-source shares (`dedup.py` is written, not wired into the scan). Pravda republishes RT, so those counts are high.
- Peaks that ignore weeks with only a few articles.
- Putting any model score into the weekly report.
