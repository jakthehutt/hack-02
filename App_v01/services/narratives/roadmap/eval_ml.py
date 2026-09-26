"""Score the narrative models on gold_dsn.json and write a run file per method.

gold_dsn.json is a smoke test. It is not a training set and it is too small
to decide which method is better. The kNN bank is train_dsn.json, not the
gold sentences themselves.

    python -m services.narratives.roadmap.eval_ml
"""

from __future__ import annotations

import json

import numpy as np

from services.narratives.roadmap.config import (
    CHECKPOINT,
    COSINE_FLOOR,
    EMB_NAME,
    ENSEMBLE,
    GOLD,
    HYPOTHESES,
    NARRATIVES,
    TRAIN,
    set_seed,
)
from services.narratives.roadmap.leak import cosine_hits, load_encoder
from services.narratives.roadmap.metrics import evaluate, write_run
from services.narratives.roadmap.nli import filtered_checkpoint, load_nli, predict_items


def _as_lists(mapping: dict[int, str]) -> dict[int, list[str]]:
    return {narrative: [text] for narrative, text in mapping.items()}


def _cosine_predict(gold: list[dict], matrix: np.ndarray, labels: list[int]) -> list[dict]:
    preds = []
    for row in matrix:
        top = int(row.argmax())
        score = float(row[top])
        if score >= COSINE_FLOOR:
            preds.append(
                {"narrative": labels[top], "stance": "befuerwortet", "score": round(score, 3), "detail": ""}
            )
        else:
            preds.append({"narrative": None, "stance": "none", "score": round(score, 3), "detail": ""})
    return preds


def _embed_block(encoder, gold: list[dict], train_rows: list[dict], statements: list[str], statement_ids: list[int]):
    gold_matrix = np.asarray(encoder.encode([item["text"] for item in gold], normalize_embeddings=True))
    bank = [row for row in train_rows if row["stance"] == "befuerwortet" and row.get("narrative")]
    bank_matrix = np.asarray(encoder.encode([row["text"] for row in bank], normalize_embeddings=True))
    statement_matrix = np.asarray(encoder.encode(statements, normalize_embeddings=True))
    cosine_preds = _cosine_predict(gold, gold_matrix @ statement_matrix.T, statement_ids)
    knn_preds = _cosine_predict(gold, gold_matrix @ bank_matrix.T, [row["narrative"] for row in bank])

    befuer = [index for index, item in enumerate(gold) if item["stance"] == "befuerwortet"]
    loo = []
    for index, row in enumerate(gold_matrix):
        best_i = None
        best_sim = -1.0
        for other in befuer:
            if other == index:
                continue
            sim = float(row @ gold_matrix[other])
            if sim > best_sim:
                best_sim = sim
                best_i = other
        if best_i is not None and best_sim >= COSINE_FLOOR:
            loo.append(
                {
                    "narrative": gold[best_i]["narrative"],
                    "stance": "befuerwortet",
                    "score": round(best_sim, 3),
                    "detail": gold[best_i]["id"],
                }
            )
        else:
            loo.append({"narrative": None, "stance": "none", "score": round(max(best_sim, 0.0), 3), "detail": ""})
    return cosine_preds, knn_preds, loo


def _print_misses(gold: list[dict], preds: list[dict]) -> None:
    for item, pred in zip(gold, preds):
        ok = (item["stance"] == "none" and pred["stance"] == "none") or (
            pred["narrative"] == item["narrative"] and pred["stance"] == item["stance"]
        )
        if ok:
            continue
        print(
            f"  MISS {item['id']} gold={item['narrative']}/{item['stance']} "
            f"pred={pred['narrative']}/{pred['stance']} {pred['score']}"
        )


def filtered_only() -> None:
    set_seed()
    gold = json.loads(GOLD.read_text(encoding="utf-8"))
    filtered = filtered_checkpoint()
    if filtered is None:
        raise SystemExit("no filtered checkpoint")
    tokenizer, model = load_nli(filtered)
    preds = predict_items(model, tokenizer, gold, _as_lists(HYPOTHESES), allow_abgelehnt=True)
    evaluate("nli-finetuned-filtered", "gold_dsn", gold, preds, extra={"checkpoint": str(filtered)})
    _print_misses(gold, preds)


def main() -> None:
    set_seed()
    gold = json.loads(GOLD.read_text(encoding="utf-8"))
    train_rows = json.loads(TRAIN.read_text(encoding="utf-8"))
    narratives = json.loads(NARRATIVES.read_text(encoding="utf-8"))["narratives"]
    statements = [item["narrative_statement"] for item in narratives]
    statement_ids = [item["id"] for item in narratives]
    print(f"gold {len(gold)} train {len(train_rows)} model {EMB_NAME}")

    encoder = load_encoder()
    leaks = cosine_hits(train_rows, gold, encoder)
    write_run("leak-cosine", {"split": "gold_dsn", "threshold": 0.8, "hits": leaks, "n_hits": len(leaks)})
    print(f"leak cosine>=0.8  {len(leaks)} train rows")
    for hit in leaks:
        print(f"  {hit['cosine']} {hit['gold_id']}  {hit['train_text'][:90]}")
    cosine_preds, knn_preds, loo_preds = _embed_block(encoder, gold, train_rows, statements, statement_ids)
    del encoder

    evaluate("minilm-cosine-statement", "gold_dsn", gold, cosine_preds)
    _print_misses(gold, cosine_preds)
    evaluate("minilm-knn-train", "gold_dsn", gold, knn_preds, extra={"bank": "train_dsn.json befuerwortet"})
    _print_misses(gold, knn_preds)
    evaluate("minilm-loo-gold", "gold_dsn", gold, loo_preds, extra={"note": "optimistic; exemplars are the test set"})
    _print_misses(gold, loo_preds)

    tokenizer, model = load_nli(None)
    statement_map = {narrative: [text] for narrative, text in zip(statement_ids, statements)}
    statement_preds = predict_items(model, tokenizer, gold, statement_map, allow_abgelehnt=True)
    evaluate("nli-statement", "gold_dsn", gold, statement_preds)
    _print_misses(gold, statement_preds)
    short_preds = predict_items(model, tokenizer, gold, _as_lists(HYPOTHESES), allow_abgelehnt=True)
    evaluate("nli-short", "gold_dsn", gold, short_preds)
    _print_misses(gold, short_preds)
    ensemble_preds = predict_items(model, tokenizer, gold, ENSEMBLE, allow_abgelehnt=True)
    evaluate("nli-ensemble", "gold_dsn", gold, ensemble_preds)
    _print_misses(gold, ensemble_preds)
    del model

    if (CHECKPOINT / "config.json").exists():
        tokenizer, model = load_nli(CHECKPOINT)
        tuned_preds = predict_items(model, tokenizer, gold, _as_lists(HYPOTHESES), allow_abgelehnt=True)
        evaluate("nli-finetuned", "gold_dsn", gold, tuned_preds, extra={"checkpoint": str(CHECKPOINT)})
        _print_misses(gold, tuned_preds)
        del model

    filtered = filtered_checkpoint()
    if filtered is not None:
        tokenizer, model = load_nli(filtered)
        filtered_preds = predict_items(model, tokenizer, gold, _as_lists(HYPOTHESES), allow_abgelehnt=True)
        evaluate("nli-finetuned-filtered", "gold_dsn", gold, filtered_preds, extra={"checkpoint": str(filtered)})
        _print_misses(gold, filtered_preds)


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == "filtered":
        filtered_only()
    else:
        main()
