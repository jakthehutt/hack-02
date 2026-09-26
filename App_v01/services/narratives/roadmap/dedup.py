"""Near-duplicate articles via 64-bit SimHash, hamming distance <= 3.

Four bands of 16 bits: any pair within distance 3 shares a band, so the
search stays linear in the corpus instead of comparing every pair.
"""

from __future__ import annotations

import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from simhash import hamming, simhash64

from services.narratives.roadmap.config import HAMMING_MAX

BANDS = 4
BAND_BITS = 16
MIN_CHARS = 80


def lead(row: dict) -> str:
    title = row.get("title") or ""
    text = row.get("text") or ""
    return f"{title}\n{text[:1500]}"


class _Union:
    def __init__(self, size: int) -> None:
        self.parent = list(range(size))

    def find(self, item: int) -> int:
        while self.parent[item] != item:
            self.parent[item] = self.parent[self.parent[item]]
            item = self.parent[item]
        return item

    def union(self, left: int, right: int) -> None:
        left_root = self.find(left)
        right_root = self.find(right)
        if left_root != right_root:
            self.parent[right_root] = left_root


def _earlier(left: dict, right: dict) -> bool:
    left_date = left["date"] or "9999-99-99"
    right_date = right["date"] or "9999-99-99"
    if left_date != right_date:
        return left_date < right_date
    return left["order"] < right["order"]


def dedup_sources(loaded: list[tuple[str, list[dict]]]) -> tuple[dict[str, list[dict]], dict]:
    records: list[dict] = []
    for order, (source, rows) in enumerate(loaded):
        for row in rows:
            records.append(
                {
                    "source": source,
                    "order": order,
                    "date": (row.get("date") or "")[:10],
                    "row": row,
                    "hash": None,
                }
            )
            text = lead(row)
            if len(text) >= MIN_CHARS:
                records[-1]["hash"] = simhash64(text)

    groups = _Union(len(records))
    buckets: dict[tuple[int, int], list[int]] = defaultdict(list)
    for index, record in enumerate(records):
        if record["hash"] is None:
            continue
        for band in range(BANDS):
            piece = (record["hash"] >> (band * BAND_BITS)) & 0xFFFF
            buckets[(band, piece)].append(index)
    for members in buckets.values():
        if len(members) < 2:
            continue
        for left_i, left in enumerate(members):
            for right in members[left_i + 1 :]:
                if hamming(records[left]["hash"], records[right]["hash"]) <= HAMMING_MAX:
                    groups.union(left, right)

    clusters: dict[int, list[int]] = defaultdict(list)
    for index in range(len(records)):
        clusters[groups.find(index)].append(index)

    keep: set[int] = set()
    edges: dict[tuple[str, str], int] = defaultdict(int)
    for members in clusters.values():
        keeper = members[0]
        for candidate in members[1:]:
            if _earlier(records[candidate], records[keeper]):
                keeper = candidate
        keep.add(keeper)
        keeper_source = records[keeper]["source"]
        for candidate in members:
            if candidate == keeper:
                continue
            edges[(keeper_source, records[candidate]["source"])] += 1

    grouped: dict[str, list[dict]] = {source: [] for source, _ in loaded}
    raw = {source: 0 for source, _ in loaded}
    dropped = {source: 0 for source, _ in loaded}
    for index, record in enumerate(records):
        raw[record["source"]] += 1
        if index in keep:
            grouped[record["source"]].append(record["row"])
        else:
            dropped[record["source"]] += 1
    stats = {
        "hamming_max": HAMMING_MAX,
        "raw": len(records),
        "kept": len(keep),
        "dropped": len(records) - len(keep),
        "by_source": {
            source: {"raw": raw[source], "kept": len(grouped[source]), "dropped": dropped[source]}
            for source, _ in loaded
        },
        "republication_edges": [
            {"keeper": keeper, "copy": copy, "n": count}
            for (keeper, copy), count in sorted(edges.items(), key=lambda item: -item[1])
        ],
    }
    return grouped, stats
