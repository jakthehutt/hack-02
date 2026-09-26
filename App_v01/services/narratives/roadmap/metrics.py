"""Scores for a single predicted narrative, plus a run log."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

from services.narratives.roadmap.config import BOOTSTRAP_DRAWS, RUNS, SEED, versions

NARRATIVE_IDS = (1, 2, 3, 4, 5)


def _rates(tp: int, fp: int, fn: int) -> tuple[float, float, float]:
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    return precision, recall, f1


def _one(gold: list[dict], preds: list[dict]) -> dict:
    tp = fp = fn = dangerous = exact = 0
    confusion: dict[str, int] = {}
    per = {narrative: {"tp": 0, "fp": 0, "fn": 0} for narrative in NARRATIVE_IDS}
    for item, pred in zip(gold, preds):
        gold_hit = item["stance"] == "befuerwortet"
        pred_hit = pred["stance"] == "befuerwortet" and pred["narrative"] == item["narrative"]
        pred_any = pred["stance"] == "befuerwortet"
        if gold_hit and pred_hit:
            tp += 1
        elif pred_any and not (gold_hit and pred["narrative"] == item["narrative"]):
            fp += 1
        if gold_hit and not pred_hit:
            fn += 1
        if item["stance"] == "abgelehnt" and pred_any and pred["narrative"] == item["narrative"]:
            dangerous += 1
        same = pred["narrative"] == item["narrative"] and pred["stance"] == item["stance"]
        if same or (item["stance"] == "none" and pred["stance"] == "none"):
            exact += 1
        gold_key = "none" if item["stance"] == "none" or item["narrative"] is None else f"{item['narrative']}:{item['stance']}"
        pred_key = "none" if pred["stance"] == "none" or pred["narrative"] is None else f"{pred['narrative']}:{pred['stance']}"
        confusion[f"{gold_key}->{pred_key}"] = confusion.get(f"{gold_key}->{pred_key}", 0) + 1
        for narrative in NARRATIVE_IDS:
            gold_pos = gold_hit and item["narrative"] == narrative
            pred_pos = pred["stance"] == "befuerwortet" and pred["narrative"] == narrative
            if gold_pos and pred_pos:
                per[narrative]["tp"] += 1
            elif pred_pos and not gold_pos:
                per[narrative]["fp"] += 1
            elif gold_pos and not pred_pos:
                per[narrative]["fn"] += 1
    precision, recall, f1 = _rates(tp, fp, fn)
    per_out = {}
    for narrative, counts in per.items():
        p, r, f = _rates(counts["tp"], counts["fp"], counts["fn"])
        per_out[str(narrative)] = {
            **counts,
            "precision": round(p, 2),
            "recall": round(r, 2),
            "f1": round(f, 2),
        }
    return {
        "tp": tp,
        "fp": fp,
        "fn": fn,
        "dangerous_abgelehnt_as_befuerwortet": dangerous,
        "dangerous_rate": round(dangerous / len(gold), 4) if gold else 0.0,
        "precision": round(precision, 2),
        "recall": round(recall, 2),
        "f1": round(f1, 2),
        "exact": exact,
        "n": len(gold),
        "per_narrative": per_out,
        "confusion": confusion,
    }


def bootstrap(gold: list[dict], preds: list[dict]) -> dict:
    rng = np.random.default_rng(SEED)
    size = len(gold)
    f1s = []
    recalls = []
    for _ in range(BOOTSTRAP_DRAWS):
        picked = rng.integers(0, size, size)
        summary = _one([gold[i] for i in picked], [preds[i] for i in picked])
        f1s.append(summary["f1"])
        recalls.append(summary["recall"])
    return {
        "draws": BOOTSTRAP_DRAWS,
        "f1_low": round(float(np.quantile(f1s, 0.025)), 2),
        "f1_high": round(float(np.quantile(f1s, 0.975)), 2),
        "recall_low": round(float(np.quantile(recalls, 0.025)), 2),
        "recall_high": round(float(np.quantile(recalls, 0.975)), 2),
    }


def scores(gold: list[dict], preds: list[dict], with_bootstrap: bool = False) -> dict:
    summary = _one(gold, preds)
    if with_bootstrap and gold:
        summary["bootstrap_95"] = bootstrap(gold, preds)
    return summary


def write_run(method: str, payload: dict) -> Path:
    RUNS.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S")
    path = RUNS / f"{stamp}_{method}.json"
    payload = {
        "method": method,
        "created": datetime.now(timezone.utc).isoformat(),
        "versions": versions(),
        **payload,
    }
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return path


def evaluate(method: str, split: str, gold: list[dict], preds: list[dict], extra: dict | None = None) -> dict:
    summary = scores(gold, preds, with_bootstrap=True)
    rows = []
    for item, pred in zip(gold, preds):
        rows.append(
            {
                "id": item.get("id"),
                "gold_narrative": item.get("narrative"),
                "gold_stance": item.get("stance"),
                "pred_narrative": pred.get("narrative"),
                "pred_stance": pred.get("stance"),
                "score": pred.get("score"),
            }
        )
    path = write_run(
        method,
        {"split": split, "summary": summary, "predictions": rows, "extra": extra or {}},
    )
    print(f"{method} {json.dumps({k: summary[k] for k in ('precision', 'recall', 'f1', 'dangerous_abgelehnt_as_befuerwortet', 'exact', 'n')}, ensure_ascii=False)}")
    ci = summary["bootstrap_95"]
    print(f"  f1 95% CI {ci['f1_low']}–{ci['f1_high']}  recall {ci['recall_low']}–{ci['recall_high']}  wrote {path.name}")
    return summary
