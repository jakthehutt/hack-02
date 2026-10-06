"""Publish the analysis results as a bundle: one JSON file any frontend can read.

The bundle is the only contract between the pipeline and its readers; see
bundles/README.md for the shape. This stage knows nothing about who reads it.

Observed: source catalogue, per-source totals, per-series totals/peaks/quotes,
RT DE weekly counts, the edges in data/edges.jsonl, the DSN narratives.
Estimated (flagged in the bundle): weekly curves for outlets without observed
weeks (sources[].weekly_observed = false), extra propagation edges
(edges[].synthetic = true), crawl reject/error counts where the manifest is empty.

    python run.py bundle            # write bundles/<generated>.json, diff against latest
    python run.py bundle --promote  # also replace bundles/latest.json
"""

from __future__ import annotations

import argparse
import json
import math
import random
from datetime import date
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent
BUNDLES_DIR = ROOT / "bundles"
LATEST_PATH = BUNDLES_DIR / "latest.json"
SCHEMA_VERSION = 1

INPUTS = {
    "cross": "App_v01/crawler/data/narratives_cross.json",
    "rt": "App_v01/crawler/data/rt_de/narratives_report.json",
    "catalogue": "sources.json",
    "manifest": "App_v01/data/runs/de_sources_2026-05-26_2026-09-26/manifest.json",
    "dsn": "narratives.json",
    "codebook": "data/codebook.json",
    "edges": "data/edges.jsonl",
}

# Assumed pickup volume between outlet pairs, used only for estimated edges.
ESTIMATED_FLOWS = [
    ("ria", "rt_de", 14), ("ria", "sputnik_de", 11), ("tass", "rt_de", 9), ("tass", "sputnik_de", 7),
    ("ria", "newsfront_de", 12), ("tass", "newsfront_de", 5), ("ria", "pravda_de", 16), ("tass", "pravda_de", 10),
    ("ria", "anti_spiegel", 4), ("rt_de", "anti_spiegel", 6), ("rt_de", "apolut", 5), ("rt_de", "klagemauer", 3),
    ("anti_spiegel", "apolut", 3), ("sputnik_de", "auf1", 2), ("rt_de", "auf1", 2), ("newsfront_de", "pravda_de", 4),
]
RELATIONS = ["citation", "topic_echo", "near_duplicate"]
RELATION_RULES = {"citation": "explicit_citation", "topic_echo": "entity_window", "near_duplicate": "simhash"}


def _read_json(root: Path, key: str) -> Any:
    return json.loads((root / INPUTS[key]).read_text(encoding="utf-8"))


def _read_jsonl(root: Path, key: str) -> list[dict]:
    text = (root / INPUTS[key]).read_text(encoding="utf-8")
    return [json.loads(line) for line in text.splitlines() if line.strip()]


def week_index(weeks: list[dict], day: str) -> int | None:
    for i, w in enumerate(weeks):
        if w["start"] <= day <= w["end"]:
            return i
    return None


def estimate_weekly(rng: random.Random, total: int, n_weeks: int, lo: int, hi: int) -> list[int]:
    """Spread an outlet's total over weeks lo..hi with a noisy shape."""
    out = [0] * n_weeks
    if total <= 0 or hi < lo:
        return out
    idx = list(range(lo, hi + 1))
    base = [max(0.05, 1 + 0.6 * math.sin(i * 0.9 + rng.random() * 3) + rng.gauss(0, 0.35)) for i in idx]
    s = sum(base)
    alloc = [int(round(total * b / s)) for b in base]
    for k, i in enumerate(idx):
        out[i] = alloc[k]
    return out


def estimate_series_weekly(rng: random.Random, se: dict, totals: list[int], weeks: list[dict], lo: int, hi: int) -> list[int]:
    """Weekly hits that follow the outlet's weekly volume at the series' observed share,
    with the observed peak week pinned to its observed peak share. Never exceeds the week total."""
    out = [0] * len(weeks)
    if not se["article_count"]:
        return out
    share = se["share_pct"] / 100
    p = se.get("peak") or {}
    pi = week_index(weeks, p["week_start"]) if p.get("n") else None
    raw = [0.0] * len(weeks)
    for i in range(lo, hi + 1):
        raw[i] = totals[i] * share * rng.lognormvariate(0, 0.45)
    if pi is not None and lo <= pi <= hi:
        raw[pi] = min(p["n"], se["article_count"], max(raw[pi], totals[pi] * p["share_pct"] / 100))
    rest = [i for i in range(lo, hi + 1) if i != pi]
    target = se["article_count"] - (raw[pi] if pi is not None and lo <= pi <= hi else 0)
    s = sum(raw[i] for i in rest)
    if s > 0 and target > 0:
        for i in rest:
            raw[i] *= target / s
    for i in range(lo, hi + 1):
        out[i] = min(totals[i], int(round(raw[i])))
    return out


def estimate_crawl_gaps(ok: int, result: dict) -> dict:
    """Split an unexplained discovered-vs-kept gap 70/30 into rejects and errors."""
    discovered = max(result.get("discovered") or 0, ok)
    reject = result.get("reject") or 0
    error = result.get("error") or 0
    if discovered > ok and not (reject or error):
        gap = discovered - ok
        reject = int(gap * 0.7)
        error = gap - reject
    return {"discovered": discovered, "ok": ok, "reject": reject, "error": error}


def estimate_edges(rng: random.Random) -> list[dict]:
    edges = []
    for a, b, n in ESTIMATED_FLOWS:
        for _ in range(n):
            rel = rng.choices(RELATIONS, weights=[0.45, 0.4, 0.15])[0]
            lag = round(abs(rng.lognormvariate(2.6 if a in ("ria", "tass") else 3.2, 0.8)), 2)
            similarity = 1.0 if rel == "citation" else (round(rng.uniform(0.86, 0.99), 4) if rel == "near_duplicate" else 0.0)
            edges.append({"from_source_id": a, "to_source_id": b, "relation": rel, "lag_hours": lag,
                          "similarity": similarity, "rule": RELATION_RULES[rel],
                          "example_overlap": None, "synthetic": True})
    return edges


def build_bundle(root: Path = ROOT, generated: str | None = None) -> dict:
    rng = random.Random(7)
    cross = _read_json(root, "cross")
    rt = _read_json(root, "rt")
    catalogue = _read_json(root, "catalogue")
    manifest = _read_json(root, "manifest")
    dsn = _read_json(root, "dsn")
    codebook = _read_json(root, "codebook")
    edges_real = _read_jsonl(root, "edges")

    weeks = [{"week": w["week"], "start": w["start"], "end": w["end"]} for w in rt["weeks"]]
    n_weeks = len(weeks)

    cat = {}
    for r in catalogue["ranks"]:
        for e in r["entries"]:
            cat[e["id"]] = {"rank": r["rank"], "rank_label": r["label"], "name": e["name"],
                            "control": e.get("control"), "language": e.get("language")}

    sources = []
    series_meta = {}
    for src in cross["sources"]:
        sid = src["source"]
        span = src["date_span"]
        lo = week_index(weeks, span["min"]) or 0
        hi = week_index(weeks, span["max"])
        hi = n_weeks - 1 if hi is None else hi
        observed = sid == "rt_de"
        if observed:
            totals = [w["articles"] for w in rt["weeks"]]
        else:
            totals = estimate_weekly(rng, src["article_count"], n_weeks, lo, hi)
        rt_series = {s["id"]: s for s in rt["series"]} if observed else {}
        ser = []
        for se in src["series"]:
            series_meta[se["id"]] = {"id": se["id"], "kind": se["kind"], "label": se["label"]}
            if observed:
                weekly = rt_series[se["id"]]["weekly_n"]
                quotes = rt_series[se["id"]]["quotes"]
            else:
                weekly = estimate_series_weekly(rng, se, totals, weeks, lo, hi)
                quotes = [se["quote"]] if se.get("quote") else []
            ser.append({
                "id": se["id"],
                "article_count": se["article_count"],
                "share_pct": se["share_pct"],
                "peak": se["peak"] if se["article_count"] else None,
                "weekly_n": weekly,
                "quotes": quotes,
            })
        sources.append({
            "id": sid,
            **cat.get(sid, {"rank": None, "name": sid}),
            "script": src["script"],
            "article_count": src["article_count"],
            "date_span": span,
            "weekly_articles": totals,
            "weekly_observed": observed,
            "crawl": estimate_crawl_gaps(src["article_count"], manifest["results"].get(sid, {})),
            "series": ser,
        })

    # Upstream wires appear only as edge origins.
    upstream = [{"id": k, **cat[k]} for k in ("ria", "tass")]
    edges = [{**e, "synthetic": False} for e in edges_real] + estimate_edges(rng)

    frames = {f["id"]: f for f in codebook["frames"]}
    series = []
    for sid, m in series_meta.items():
        f = frames.get(sid, {})
        series.append({**m, "target": f.get("target"), "pattern": f.get("pattern"), "status": f.get("status", "active")})

    generated = generated or date.today().isoformat()
    return {
        "meta": {
            "schema_version": SCHEMA_VERSION,
            "bundle_id": generated,
            "generated": generated,
            "method": cross["method"],
            "window": {"start": weeks[0]["start"], "end": weeks[-1]["end"]},
            "synthetic_note": "Totals, peaks, quotes, RT DE weekly counts and the unflagged edges come from pipeline output. Weekly curves for outlets with weekly_observed = false, edges flagged synthetic, and some crawl reject/error counts are estimated.",
        },
        "weeks": weeks,
        "series": series,
        "sources": sources,
        "upstream": upstream,
        "edges": edges,
        "dsn_narratives": dsn["narratives"],
        "dsn_meta": dsn["meta"],
    }


def dump(bundle: dict) -> str:
    return json.dumps(bundle, ensure_ascii=False, indent=1)


def diff_summary(old: dict, new: dict) -> list[str]:
    """What a reader of `old` would see change if `new` replaced it."""
    lines = []
    old_src = {s["id"]: s for s in old.get("sources", [])}
    new_src = {s["id"]: s for s in new.get("sources", [])}
    for sid in sorted(old_src.keys() - new_src.keys()):
        lines.append(f"outlet removed: {sid}")
    for sid in sorted(new_src.keys() - old_src.keys()):
        lines.append(f"outlet added: {sid}")
    for sid in sorted(old_src.keys() & new_src.keys()):
        a, b = old_src[sid]["article_count"], new_src[sid]["article_count"]
        if a != b:
            lines.append(f"articles {sid}: {a} → {b}")
    old_ser = {s["id"] for s in old.get("series", [])}
    new_ser = {s["id"] for s in new.get("series", [])}
    for k in sorted(old_ser - new_ser):
        lines.append(f"series removed: {k}")
    for k in sorted(new_ser - old_ser):
        lines.append(f"series added: {k}")

    def count_quotes(b: dict) -> int:
        return sum(len(se["quotes"]) for s in b.get("sources", []) for se in s["series"])

    for label, a, b in [
        ("weeks", len(old.get("weeks", [])), len(new.get("weeks", []))),
        ("edges", len(old.get("edges", [])), len(new.get("edges", []))),
        ("observed edges", sum(not e.get("synthetic") for e in old.get("edges", [])), sum(not e.get("synthetic") for e in new.get("edges", []))),
        ("quotes", count_quotes(old), count_quotes(new)),
    ]:
        if a != b:
            lines.append(f"{label}: {a} → {b}")
    return lines


def publish(promote: bool = False, root: Path = ROOT, out_dir: Path = BUNDLES_DIR) -> dict:
    bundle = build_bundle(root)
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / f"{bundle['meta']['bundle_id']}.json"
    path.write_text(dump(bundle), encoding="utf-8")
    latest = out_dir / LATEST_PATH.name
    changes = diff_summary(json.loads(latest.read_text(encoding="utf-8")), bundle) if latest.exists() else ["no latest.json yet"]
    if promote:
        latest.write_text(dump(bundle), encoding="utf-8")
    return {"path": path, "promoted": promote, "changes": changes}


def format_publish(result: dict) -> str:
    head = f"wrote {result['path'].relative_to(ROOT) if result['path'].is_relative_to(ROOT) else result['path']}"
    head += " and promoted it to latest.json" if result["promoted"] else " (latest.json unchanged; --promote to replace it)"
    body = result["changes"] or ["no changes against latest.json"]
    return "\n".join([head, *("  " + line for line in body)])


def main() -> None:
    parser = argparse.ArgumentParser(description="Publish the analysis bundle")
    parser.add_argument("--promote", action="store_true", help="also replace bundles/latest.json")
    args = parser.parse_args()
    print(format_publish(publish(promote=args.promote)))


if __name__ == "__main__":
    main()
