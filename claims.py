"""Label articles with the versioned codebook and write claim counts.

One claim row per article hit (at most five). Weekly counts use distinct
copy-clusters, not raw articles. The trailing-eight-week z-score is computed
on the RT DE archive; the 14-day crawl does not have that baseline.

Sentences that look like a claim and match no active frame go to
data/frame_other.jsonl and are excluded from the counts.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
from collections import defaultdict
from datetime import date, datetime
from pathlib import Path
from typing import Any

from catalogue import DATA_DIR, source_meta
from cluster import UnionFind
from codebook import Frame, active_frames, load_codebook
from simhash import hamming, simhash64

ROOT = Path(__file__).resolve().parent
ARCHIVE_PATH = ROOT / "App_v01" / "crawler" / "data" / "rt_de" / "articles.jsonl"
CLAIMS_PATH = DATA_DIR / "claims.jsonl"
OTHER_PATH = DATA_DIR / "frame_other.jsonl"
FRAMES_BY_WEEK_PATH = DATA_DIR / "frames_by_week.json"
SOURCES_BY_FRAME_PATH = DATA_DIR / "sources_by_frame.json"

BASELINE_WEEKS = 8
MIN_COUNT = 5
MAX_CLAIMS = 5
HAMMING_MAX = 3

SENTENCE = re.compile(r"(?<=[.!?])\s+")
CLAIM_CUE = re.compile(
    r"\b("
    r"behauptet|behauptung|lüge|lügen|fälschung|"
    r"in wahrheit|in wirklichkeit|angeblich|sogenannt\w*|"
    r"propaganda|desinformation|kriegstreiber|marionette|"
    r"kolonie|besatzung|besatzer|genozid|völkermord|"
    r"zensur|gleichschaltung|diktatur|totalitär"
    r")\b",
    re.IGNORECASE,
)


def week_key(day: date) -> str:
    return day.strftime("%G-W%V")


def week_monday(key: str) -> date:
    year_s, week_s = key.split("-W")
    return date.fromisocalendar(int(year_s), int(week_s), 1)


def sentences(text: str) -> list[str]:
    clean = re.sub(r"\s+", " ", text).strip()
    parts = SENTENCE.split(clean)
    return [part.strip() for part in parts if 50 <= len(part) <= 360]


def usable_quote(sentence: str) -> bool:
    low = sentence.lower()
    if low.startswith("mehr zum thema"):
        return False
    if low.startswith("lesen sie auch"):
        return False
    return True


def _same_as_title(quote: str, title: str) -> bool:
    def norm(text: str) -> str:
        return re.sub(r"\W+", " ", text.lower()).strip()

    return norm(quote) == norm(title)


def _quote(title: str, text: str, regex: re.Pattern[str]) -> str | None:
    found = [
        sentence
        for sentence in sentences(f"{title}. {text}")
        if regex.search(sentence) and usable_quote(sentence)
    ]
    if not found:
        return None
    body = [sentence for sentence in found if not _same_as_title(sentence, title)]
    return (body or found)[0]


def _day(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(str(value)[:10])
    except ValueError:
        return None


def _load_jsonl(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    rows: list[dict[str, Any]] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.strip():
            rows.append(json.loads(line))
    return rows


def load_archive() -> list[dict[str, Any]]:
    articles: list[dict[str, Any]] = []
    for row in _load_jsonl(ARCHIVE_PATH):
        text = row.get("text") or ""
        if not text:
            continue
        articles.append(
            {
                "article_id": str(row.get("article_id")),
                "source_id": row.get("source") or "rt_de",
                "rank": 1,
                "url": row.get("url"),
                "published_at": row.get("date"),
                "title": row.get("title") or "",
                "text": text,
                "language": row.get("language") or "de",
                "corpus": "rt_de_archive",
                "copy_cluster_id": None,
                "simhash": simhash64(text),
            }
        )
    assign_copy_clusters(articles)
    return articles


def load_live() -> list[dict[str, Any]]:
    meta = source_meta()
    articles: list[dict[str, Any]] = []
    for row in _load_jsonl(DATA_DIR / "articles_clustered.jsonl"):
        extracted = row.get("extracted") or {}
        text = extracted.get("text") or ""
        if not text:
            continue
        source_id = row.get("source_id")
        articles.append(
            {
                "article_id": row["article_id"],
                "source_id": source_id,
                "rank": row.get("rank") if row.get("rank") is not None else (meta.get(source_id) or {}).get("rank"),
                "url": row.get("canonical_url") or row.get("url"),
                "published_at": row.get("published_at"),
                "title": extracted.get("title") or "",
                "text": text,
                "language": extracted.get("language"),
                "corpus": "live",
                "copy_cluster_id": row.get("copy_cluster_id") or row["article_id"],
                "simhash": None,
            }
        )
    return articles


def _same_language(left: dict[str, Any], right: dict[str, Any]) -> bool:
    left_lang, right_lang = left.get("language"), right.get("language")
    if not left_lang or not right_lang:
        return True
    return left_lang == right_lang


def assign_copy_clusters(articles: list[dict[str, Any]]) -> None:
    """Union same-language texts within Hamming distance 3. Singletons keep their own id."""
    if not articles:
        return
    uf = UnionFind(str(i) for i in range(len(articles)))
    by_hash: dict[str, list[int]] = defaultdict(list)
    for index, article in enumerate(articles):
        digest = hashlib.sha256((article.get("text") or "").encode("utf-8")).hexdigest()
        by_hash[digest].append(index)
    for group in by_hash.values():
        head = group[0]
        for other in group[1:]:
            uf.union(str(head), str(other))

    bands: list[dict[int, list[int]]] = [defaultdict(list) for _ in range(4)]
    for index, article in enumerate(articles):
        value = article.get("simhash")
        if value is None:
            continue
        for band in range(4):
            bands[band][(value >> (band * 16)) & 0xFFFF].append(index)

    seen: set[tuple[int, int]] = set()
    for band in bands:
        for group in band.values():
            if len(group) < 2:
                continue
            for i, left in enumerate(group):
                for right in group[i + 1 :]:
                    pair = (left, right) if left < right else (right, left)
                    if pair in seen:
                        continue
                    seen.add(pair)
                    left_art, right_art = articles[left], articles[right]
                    if not _same_language(left_art, right_art):
                        continue
                    left_hash, right_hash = left_art.get("simhash"), right_art.get("simhash")
                    if left_hash is None or right_hash is None:
                        continue
                    if hamming(left_hash, right_hash) <= HAMMING_MAX:
                        uf.union(str(left), str(right))

    roots: dict[str, str] = {}
    for index, article in enumerate(articles):
        root = uf.find(str(index))
        cluster_id = roots.setdefault(root, f"cluster_{articles[int(root)]['article_id']}")
        article["copy_cluster_id"] = cluster_id


def label_articles(
    articles: list[dict[str, Any]],
    frames: list[Frame],
    *,
    codebook_version: str,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    compiled = [(frame, frame.compile()) for frame in frames]
    claims: list[dict[str, Any]] = []
    others: list[dict[str, Any]] = []
    for article in articles:
        day = _day(article.get("published_at"))
        if day is None:
            continue
        hits: list[tuple[Frame, str]] = []
        for frame, regex in compiled:
            quote = _quote(article.get("title") or "", article.get("text") or "", regex)
            if quote is None:
                continue
            hits.append((frame, quote))
        hits.sort(key=lambda item: (0 if item[0].kind == "frame" else 1, frames.index(item[0])))
        for frame, quote in hits[:MAX_CLAIMS]:
            claims.append(
                {
                    "frame_id": frame.id,
                    "kind": frame.kind,
                    "label": frame.label,
                    "target": frame.target,
                    "euvsdisinfo_id": frame.euvsdisinfo_id,
                    "quote": quote,
                    "article_id": article["article_id"],
                    "source_id": article.get("source_id"),
                    "rank": article.get("rank"),
                    "week": week_key(day),
                    "copy_cluster_id": article.get("copy_cluster_id"),
                    "corpus": article.get("corpus"),
                    "codebook_version": codebook_version,
                    "url": article.get("url"),
                }
            )
        if hits:
            continue
        cue = _quote(article.get("title") or "", article.get("text") or "", CLAIM_CUE)
        if cue is None:
            continue
        others.append(
            {
                "status": "other",
                "quote": cue,
                "article_id": article["article_id"],
                "source_id": article.get("source_id"),
                "rank": article.get("rank"),
                "week": week_key(day),
                "copy_cluster_id": article.get("copy_cluster_id"),
                "corpus": article.get("corpus"),
                "codebook_version": codebook_version,
                "url": article.get("url"),
                "reason": "no_active_frame",
            }
        )
    return claims, others


def trailing_z(
    shares: list[float],
    counts: list[int],
    *,
    baseline: int = BASELINE_WEEKS,
    min_count: int = MIN_COUNT,
) -> list[float | None]:
    """Z of this week's share against the previous `baseline` weeks, excluding itself."""
    scores: list[float | None] = []
    for index, share in enumerate(shares):
        if counts[index] < min_count or index < baseline:
            scores.append(None)
            continue
        window = shares[index - baseline : index]
        mean = sum(window) / baseline
        variance = sum((value - mean) ** 2 for value in window) / baseline
        sd = math.sqrt(variance)
        if sd < 1e-12:
            scores.append(None)
            continue
        scores.append((share - mean) / sd)
    return scores


def _volume(
    articles: list[dict[str, Any]],
    *,
    corpus: str | None = None,
) -> dict[tuple[str, str], set[str]]:
    volume: dict[tuple[str, str], set[str]] = defaultdict(set)
    for article in articles:
        if corpus is not None and article.get("corpus") != corpus:
            continue
        day = _day(article.get("published_at"))
        cluster_id = article.get("copy_cluster_id")
        source_id = article.get("source_id")
        if day is None or not cluster_id or not source_id:
            continue
        volume[(source_id, week_key(day))].add(cluster_id)
    return volume


def frames_by_week(
    claims: list[dict[str, Any]],
    articles: list[dict[str, Any]],
    frames: list[Frame],
    *,
    codebook_version: str,
    source_id: str = "rt_de",
    corpus: str = "rt_de_archive",
) -> dict[str, Any]:
    scoped_claims = [
        row
        for row in claims
        if row.get("source_id") == source_id and row.get("corpus") == corpus
    ]
    volume = _volume(
        [row for row in articles if row.get("source_id") == source_id],
        corpus=corpus,
    )
    weeks = sorted({week for (_source, week) in volume})
    hits: dict[str, dict[str, set[str]]] = defaultdict(lambda: defaultdict(set))
    for row in scoped_claims:
        cluster_id = row.get("copy_cluster_id")
        if cluster_id and row.get("week"):
            hits[row["frame_id"]][row["week"]].add(cluster_id)

    series: list[dict[str, Any]] = []
    for frame in frames:
        counts = [len(hits[frame.id].get(week, ())) for week in weeks]
        shares = [
            (counts[i] / len(volume[(source_id, week)])) if volume[(source_id, week)] else 0.0
            for i, week in enumerate(weeks)
        ]
        scores = trailing_z(shares, counts)
        series.append(
            {
                "frame_id": frame.id,
                "kind": frame.kind,
                "label": frame.label,
                "target": frame.target,
                "euvsdisinfo_id": frame.euvsdisinfo_id,
                "weeks": [
                    {
                        "week": week,
                        "week_start": week_monday(week).isoformat(),
                        "n": counts[i],
                        "volume": len(volume[(source_id, week)]),
                        "share": round(shares[i], 4),
                        "z": None if scores[i] is None else round(scores[i], 2),
                    }
                    for i, week in enumerate(weeks)
                ],
            }
        )
    return {
        "codebook_version": codebook_version,
        "source_id": source_id,
        "corpus": corpus,
        "min_count": MIN_COUNT,
        "baseline_weeks": BASELINE_WEEKS,
        "method": (
            "deduped copy-clusters / source copy-clusters that week; "
            "z against the previous 8 weeks, only when n >= 5"
        ),
        "weeks": weeks,
        "series": series,
    }


def sources_by_frame(
    claims: list[dict[str, Any]],
    articles: list[dict[str, Any]],
    frames: list[Frame],
    *,
    codebook_version: str,
) -> dict[str, Any]:
    """rt_de is the archive. Other sources are the live crawl. Live rt_de is omitted."""
    chosen: dict[str, str] = {}
    for article in articles:
        source_id = article.get("source_id")
        corpus = article.get("corpus")
        if not source_id or not corpus:
            continue
        if source_id == "rt_de":
            if corpus == "rt_de_archive":
                chosen[source_id] = corpus
            continue
        chosen.setdefault(source_id, corpus)

    rows: list[dict[str, Any]] = []
    for source_id, corpus in chosen.items():
        clusters: set[str] = set()
        rank = None
        for article in articles:
            if article.get("source_id") != source_id or article.get("corpus") != corpus:
                continue
            if _day(article.get("published_at")) is None:
                continue
            if article.get("copy_cluster_id"):
                clusters.add(article["copy_cluster_id"])
            if rank is None and article.get("rank") is not None:
                rank = article.get("rank")
        if not clusters:
            continue
        hit_clusters: dict[str, set[str]] = defaultdict(set)
        for row in claims:
            if row.get("source_id") != source_id or row.get("corpus") != corpus:
                continue
            if row.get("copy_cluster_id"):
                hit_clusters[row["frame_id"]].add(row["copy_cluster_id"])
        denominator = len(clusters) or 1
        rows.append(
            {
                "source_id": source_id,
                "rank": rank,
                "corpus": corpus,
                "deduped_count": len(clusters),
                "frames": [
                    {
                        "frame_id": frame.id,
                        "kind": frame.kind,
                        "label": frame.label,
                        "target": frame.target,
                        "n": len(hit_clusters.get(frame.id, ())),
                        "share": round(len(hit_clusters.get(frame.id, ())) / denominator, 4),
                    }
                    for frame in frames
                ],
            }
        )
    rows.sort(key=lambda row: (row["rank"] if row["rank"] is not None else 99, row["source_id"]))
    return {
        "codebook_version": codebook_version,
        "min_count": MIN_COUNT,
        "note": (
            "rt_de is the May–Sep 2026 archive. Other sources are the 14-day crawl. "
            "Shares are deduped copy-clusters over that source's copy-clusters. "
            "The eight-week z-score is in frames_by_week.json."
        ),
        "sources": rows,
    }


def _write_jsonl(path: Path, rows: list[dict[str, Any]]) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=False) + "\n")


def _write_json(path: Path, payload: dict[str, Any]) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def build(
    articles: list[dict[str, Any]] | None = None,
    book: dict | None = None,
) -> dict[str, Any]:
    book = book if book is not None else load_codebook()
    frames = active_frames(book)
    if articles is None:
        articles = load_archive() + load_live()
    claims, others = label_articles(articles, frames, codebook_version=book["version"])
    by_week = frames_by_week(claims, articles, frames, codebook_version=book["version"])
    by_source = sources_by_frame(claims, articles, frames, codebook_version=book["version"])
    return {
        "claims": claims,
        "others": others,
        "frames_by_week": by_week,
        "sources_by_frame": by_source,
    }


def write_outputs(result: dict[str, Any]) -> None:
    _write_jsonl(CLAIMS_PATH, result["claims"])
    _write_jsonl(OTHER_PATH, result["others"])
    _write_json(FRAMES_BY_WEEK_PATH, result["frames_by_week"])
    _write_json(SOURCES_BY_FRAME_PATH, result["sources_by_frame"])


def _peak_line(series: dict[str, Any]) -> str:
    scored = [week for week in series["weeks"] if week["z"] is not None]
    if not scored:
        return f"{series['frame_id']:22} no week with n>={MIN_COUNT} and an 8-week baseline"
    peak = max(scored, key=lambda week: (week["z"], week["n"]))
    return (
        f"{series['kind']:7} {series['label']:28} "
        f"peak {peak['week']} n={peak['n']:3} share={peak['share']:.1%} z={peak['z']}"
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Codebook claims, other queue, and share matrices")
    parser.parse_args()
    started = datetime.now()
    result = build()
    write_outputs(result)
    print(
        f"claims {len(result['claims'])}  other {len(result['others'])}  "
        f"in {(datetime.now() - started).total_seconds():.1f}s"
    )
    print(f"wrote {CLAIMS_PATH}")
    print(f"wrote {OTHER_PATH}")
    print(f"wrote {FRAMES_BY_WEEK_PATH}")
    print(f"wrote {SOURCES_BY_FRAME_PATH}")
    for series in result["frames_by_week"]["series"]:
        print(_peak_line(series))


if __name__ == "__main__":
    main()
