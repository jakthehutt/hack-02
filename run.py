"""Run expand → crawl → extract → cluster."""

from __future__ import annotations

import argparse
import os

from catalogue import expand_targets
from claims import build, write_outputs
from cluster import cluster
from crawl import crawl
from extract import extract_all
from pb_sync import format_stats, publish


def main() -> None:
    parser = argparse.ArgumentParser(description="Narrative propagation pipeline")
    parser.add_argument(
        "command",
        choices=["expand", "crawl", "extract", "cluster", "claims", "sync", "all"],
    )
    parser.add_argument("--all-sources", action="store_true")
    parser.add_argument("--max-per-source", type=int, default=200)
    args = parser.parse_args()

    mvp_only = not args.all_sources
    if args.command in {"expand", "all"}:
        rows = expand_targets(mvp_only=mvp_only)
        print(f"expanded {len(rows)} targets")
    if args.command in {"crawl", "all"}:
        crawl(mvp_only=mvp_only, max_per_source=args.max_per_source)
        print("crawl finished")
    if args.command in {"extract", "all"}:
        n = extract_all()
        print(f"extracted {n} articles")
    if args.command in {"cluster", "all"}:
        stats = cluster()
        print(
            f"clustered {stats['articles']} articles → "
            f"{stats['edges']} edges, {stats['topics']} topics"
        )
    if args.command == "claims":
        result = build()
        write_outputs(result)
        print(f"claims {len(result['claims'])}  other {len(result['others'])}")
    if args.command == "sync" or (args.command == "all" and os.environ.get("POCKETBASE_EMAIL")):
        print(format_stats(publish()))


if __name__ == "__main__":
    main()
