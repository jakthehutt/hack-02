"""Drop training sentences that are near a gold sentence.

Substring overlap still aborts the run. Cosine overlap is removed from the
training pool instead, because several paraphrases share the same claim.
"""

from __future__ import annotations

import json
import re

import numpy as np
from sentence_transformers import SentenceTransformer

from services.narratives.roadmap.config import EMB_NAME, EMB_REVISION, GOLD, LEAK_COSINE


def norm(text: str) -> str:
    return " ".join(re.findall(r"\w+", text.lower()))


def assert_no_substring_leak(rows: list[dict]) -> None:
    gold = json.loads(GOLD.read_text(encoding="utf-8"))
    blocked = [norm(item["text"]) for item in gold]
    for row in rows:
        key = norm(row["text"])
        for gold_key in blocked:
            if key in gold_key or gold_key in key or key[:48] == gold_key[:48]:
                raise SystemExit(f"training row overlaps gold: {row['text'][:120]}")


def _embed(encoder, texts: list[str]) -> np.ndarray:
    if not texts:
        return np.zeros((0, 1), dtype=np.float32)
    return np.asarray(encoder.encode(texts, normalize_embeddings=True))


def load_encoder():
    return SentenceTransformer(EMB_NAME, revision=EMB_REVISION, local_files_only=True)


def cosine_hits(train_rows: list[dict], gold: list[dict], encoder, threshold: float = LEAK_COSINE) -> list[dict]:
    train_matrix = _embed(encoder, [row["text"] for row in train_rows])
    gold_matrix = _embed(encoder, [item["text"] for item in gold])
    hits = []
    if len(train_matrix) == 0 or len(gold_matrix) == 0:
        return hits
    sims = gold_matrix @ train_matrix.T
    for train_i, row in enumerate(train_rows):
        gold_i = int(sims[:, train_i].argmax())
        score = float(sims[gold_i, train_i])
        if score >= threshold:
            hits.append(
                {
                    "train_text": row["text"],
                    "gold_id": gold[gold_i].get("id"),
                    "cosine": round(score, 3),
                }
            )
    return hits


def drop_leaks(train_rows: list[dict], gold: list[dict], encoder, threshold: float = LEAK_COSINE) -> tuple[list[dict], list[dict]]:
    hits = cosine_hits(train_rows, gold, encoder, threshold)
    blocked = {hit["train_text"] for hit in hits}
    kept = [row for row in train_rows if row["text"] not in blocked]
    return kept, hits
