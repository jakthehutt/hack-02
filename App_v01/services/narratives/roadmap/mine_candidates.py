"""Build an unlabeled sentence pool for the next evaluation set.

About 40% are embedding neighbours of the guideline hypotheses, 30% are
codebook hits, 30% are random sentences from the same articles. Stance is
left empty for two annotators. This file is not a metric.

    python -m services.narratives.roadmap.mine_candidates
"""

from __future__ import annotations

import json
import random
import re
from pathlib import Path

import numpy as np

from services.narratives.roadmap.config import ENSEMBLE, GOLD, SEED
from services.narratives.roadmap.leak import load_encoder, norm
from services.narratives.scan import PATTERNS, SOURCES, load_rows, sentences, usable_quote

OUT = Path(__file__).resolve().parent / "candidates" / "pool.jsonl"
GATE = re.compile(
    r"ukrain|sanktion|gas|energie|deindustrial|milit|nato|frier|blackout|r[uü]stung|neutralit",
    re.IGNORECASE,
)
EMBED_N = 120
REGEX_N = 90
RANDOM_N = 90


def _gold_keys() -> list[str]:
    gold = json.loads(GOLD.read_text(encoding="utf-8"))
    return [norm(item["text"]) for item in gold]


def _blocked(text: str, gold_keys: list[str]) -> bool:
    key = norm(text)
    return any(key in gold or gold in key or key[:48] == gold[:48] for gold in gold_keys)


def _record(source: str, row: dict, sentence: str) -> dict:
    return {
        "source": source,
        "url": row.get("url"),
        "date": (row.get("date") or "")[:10],
        "title": row.get("title"),
        "text": sentence,
        "article": row.get("url") or row.get("article_id"),
    }


def collect() -> tuple[list[dict], list[dict], list[dict]]:
    gold_keys = _gold_keys()
    compiled = [(pattern.id, re.compile(pattern.pattern, re.IGNORECASE)) for pattern in PATTERNS]
    regex_hits: list[dict] = []
    gate_hits: list[dict] = []
    reservoir: list[dict] = []
    seen = 0
    regex_n: dict[tuple[str, str], int] = {}
    gate_n: dict[str, int] = {}
    rng = random.Random(SEED)
    taken: set[str] = set()
    for source, path in SOURCES:
        if not path.exists():
            continue
        for row in load_rows(path):
            blob = sentences(f"{row.get('title') or ''}. {row.get('text') or ''}")
            for sentence in blob:
                if not usable_quote(sentence) or _blocked(sentence, gold_keys):
                    continue
                key = norm(sentence)
                if key in taken:
                    continue
                item = _record(source, row, sentence)
                matched = next((pattern_id for pattern_id, regex in compiled if regex.search(sentence)), None)
                if matched is not None and regex_n.get((source, matched), 0) < 40:
                    item["pattern"] = matched
                    regex_hits.append(item)
                    regex_n[(source, matched)] = regex_n.get((source, matched), 0) + 1
                    taken.add(key)
                    continue
                if GATE.search(sentence) and gate_n.get(source, 0) < 600:
                    gate_hits.append(item)
                    gate_n[source] = gate_n.get(source, 0) + 1
                    taken.add(key)
                    continue
                seen += 1
                if len(reservoir) < 2000:
                    reservoir.append(item)
                else:
                    slot = rng.randrange(seen)
                    if slot < 2000:
                        reservoir[slot] = item
    return regex_hits, gate_hits, reservoir


def pick_embed(gate_hits: list[dict], encoder) -> list[dict]:
    if not gate_hits:
        return []
    prototypes = []
    owners = []
    for narrative, options in ENSEMBLE.items():
        for hypothesis in options:
            prototypes.append(hypothesis)
            owners.append(narrative)
    sentence_matrix = np.asarray(encoder.encode([item["text"] for item in gate_hits], normalize_embeddings=True))
    prototype_matrix = np.asarray(encoder.encode(prototypes, normalize_embeddings=True))
    sims = sentence_matrix @ prototype_matrix.T
    best: dict[int, list[tuple[float, int]]] = {narrative: [] for narrative in ENSEMBLE}
    for sentence_i in range(len(gate_hits)):
        for prototype_i, narrative in enumerate(owners):
            best[narrative].append((float(sims[sentence_i, prototype_i]), sentence_i))
    for narrative in best:
        best[narrative].sort(reverse=True)
    chosen: list[dict] = []
    used: set[int] = set()
    cursors = {narrative: 0 for narrative in ENSEMBLE}
    while len(chosen) < EMBED_N:
        progressed = False
        for narrative in ENSEMBLE:
            cursor = cursors[narrative]
            while cursor < len(best[narrative]) and best[narrative][cursor][1] in used:
                cursor += 1
            cursors[narrative] = cursor
            if cursor >= len(best[narrative]):
                continue
            score, sentence_i = best[narrative][cursor]
            cursors[narrative] = cursor + 1
            used.add(sentence_i)
            item = dict(gate_hits[sentence_i])
            item["bucket"] = "embed"
            item["seed_narrative"] = narrative
            item["seed_score"] = round(score, 3)
            chosen.append(item)
            progressed = True
            if len(chosen) >= EMBED_N:
                break
        if not progressed:
            break
    return chosen


def sample(items: list[dict], count: int, bucket: str) -> list[dict]:
    rng = random.Random(SEED)
    pool = list(items)
    rng.shuffle(pool)
    picked = []
    for item in pool:
        if len(picked) >= count:
            break
        row = dict(item)
        row["bucket"] = bucket
        picked.append(row)
    return picked


def main() -> None:
    regex_hits, gate_hits, reservoir = collect()
    print(f"regex {len(regex_hits)} gate {len(gate_hits)} reservoir {len(reservoir)}")
    encoder = load_encoder()
    embed = pick_embed(gate_hits, encoder)
    del encoder
    used = {norm(item["text"]) for item in embed}
    articles = {item["article"] for item in embed}
    regex_pool = [item for item in regex_hits if norm(item["text"]) not in used]
    regex = sample(regex_pool, REGEX_N, "regex")
    used.update(norm(item["text"]) for item in regex)
    articles.update(item["article"] for item in regex)
    random_pool = [item for item in reservoir if item["article"] in articles and norm(item["text"]) not in used]
    if len(random_pool) < RANDOM_N:
        random_pool = [item for item in reservoir if norm(item["text"]) not in used]
    random_rows = sample(random_pool, RANDOM_N, "random")
    pool = embed + regex + random_rows
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", encoding="utf-8") as handle:
        for index, item in enumerate(pool, start=1):
            handle.write(
                json.dumps(
                    {
                        "id": f"c{index:04d}",
                        "text": item["text"],
                        "source": item["source"],
                        "url": item["url"],
                        "date": item["date"],
                        "bucket": item["bucket"],
                        "seed_narrative": item.get("seed_narrative"),
                        "pattern": item.get("pattern"),
                        "narratives": [],
                        "stance": None,
                        "attributed": None,
                    },
                    ensure_ascii=False,
                )
                + "\n"
            )
    counts = {bucket: sum(1 for item in pool if item["bucket"] == bucket) for bucket in ("embed", "regex", "random")}
    print(f"wrote {OUT} n={len(pool)} {counts}")


if __name__ == "__main__":
    main()
