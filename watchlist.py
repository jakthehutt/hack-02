"""Join watchlist keywords to clustered topics and edges.

Usage:
    python watchlist.py
    python watchlist.py --config watchlist.json --query hormuz
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any

from catalogue import DATA_DIR

DEFAULT_CONFIG = Path(__file__).resolve().parent / "watchlist.json"
HITS_PATH = DATA_DIR / "watchlist_hits.jsonl"


def load_jsonl(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    rows: list[dict[str, Any]] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.strip():
            rows.append(json.loads(line))
    return rows


def article_blob(article: dict[str, Any]) -> str:
    extracted = article.get("extracted") or {}
    parts = [
        extracted.get("title") or "",
        extracted.get("excerpt") or "",
        extracted.get("text") or "",
        " ".join(article.get("entities") or []),
        article.get("url") or "",
    ]
    return " ".join(parts)


def match_article(article: dict[str, Any], regex: re.Pattern[str]) -> bool:
    return bool(regex.search(article_blob(article)))


def run_watchlist(
    queries: list[dict[str, str]],
    *,
    query_ids: set[str] | None = None,
) -> list[dict[str, Any]]:
    articles = load_jsonl(DATA_DIR / "articles_clustered.jsonl")
    topics = load_jsonl(DATA_DIR / "topics.jsonl")
    edges = load_jsonl(DATA_DIR / "edges.jsonl")
    topic_by_id = {t["topic_id"]: t for t in topics if t.get("topic_id")}

    if query_ids:
        queries = [q for q in queries if q.get("id") in query_ids]

    hits: list[dict[str, Any]] = []
    for query in queries:
        regex = re.compile(query["pattern"], re.IGNORECASE)
        matched = [a for a in articles if match_article(a, regex)]
        topic_ids = sorted({a.get("topic_id") for a in matched if a.get("topic_id")})
        article_ids = {a["article_id"] for a in matched}

        related_edges = [
            {
                "relation": e.get("relation"),
                "rule": e.get("rule"),
                "from_article_id": e.get("from_article_id"),
                "to_article_id": e.get("to_article_id"),
                "from_source_id": e.get("from_source_id"),
                "to_source_id": e.get("to_source_id"),
            }
            for e in edges
            if e.get("from_article_id") in article_ids or e.get("to_article_id") in article_ids
        ]

        topics_out: list[dict[str, Any]] = []
        for topic_id in topic_ids:
            topic = topic_by_id.get(topic_id) or {}
            member_ids = [m.get("article_id") for m in topic.get("members") or []]
            topics_out.append(
                {
                    "topic_id": topic_id,
                    "label": topic.get("label"),
                    "origin_source_id": topic.get("origin_source_id"),
                    "downstream_source_ids": topic.get("downstream_source_ids") or [],
                    "matched_article_ids": [
                        aid for aid in member_ids if aid in article_ids
                    ],
                    "member_count": len(member_ids),
                }
            )

        hits.append(
            {
                "query_id": query["id"],
                "label": query.get("label") or query["id"],
                "pattern": query["pattern"],
                "article_count": len(matched),
                "topic_count": len(topics_out),
                "propagating_topics": sum(
                    1 for t in topics_out if t.get("downstream_source_ids")
                ),
                "articles": [
                    {
                        "article_id": a["article_id"],
                        "source_id": a.get("source_id"),
                        "topic_id": a.get("topic_id"),
                        "url": a.get("canonical_url") or a.get("url"),
                        "title": (a.get("extracted") or {}).get("title"),
                        "published_at": a.get("published_at"),
                    }
                    for a in matched
                ],
                "topics": topics_out,
                "edges": related_edges,
            }
        )
    return hits


def write_hits(hits: list[dict[str, Any]], path: Path = HITS_PATH) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        for row in hits:
            handle.write(json.dumps(row, ensure_ascii=False) + "\n")


def main() -> None:
    parser = argparse.ArgumentParser(description="Filter clustered topics by narrative keywords")
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG)
    parser.add_argument("--query", action="append", dest="query_ids", help="Limit to query id (repeatable)")
    parser.add_argument("--pattern", help="Ad-hoc regex instead of config queries")
    parser.add_argument("--label", default="adhoc", help="Label for --pattern")
    args = parser.parse_args()

    if args.pattern:
        queries = [{"id": args.label, "label": args.label, "pattern": args.pattern}]
        query_ids = None
    else:
        config = json.loads(args.config.read_text(encoding="utf-8"))
        queries = config.get("queries") or []
        query_ids = set(args.query_ids) if args.query_ids else None

    hits = run_watchlist(queries, query_ids=query_ids)
    write_hits(hits)
    print(f"wrote {len(hits)} queries → {HITS_PATH}")
    for hit in hits:
        print(
            f"{hit['query_id']:24} articles={hit['article_count']:3} "
            f"topics={hit['topic_count']:3} propagating={hit['propagating_topics']}"
        )


if __name__ == "__main__":
    main()
