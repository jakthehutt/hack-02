"""One-off: snapshot the pipeline outputs into a dashboard mock fixture.

Real: source catalogue, per-source totals, per-series totals/peaks/quotes, RT DE weekly
counts, the 10 edges in data/edges.jsonl, the DSN narratives.
Synthetic (flagged): weekly curves for non-RT sources, extra propagation edges, crawl
reject/error counts where the manifest was still empty.
"""
import json, math, random, sys
from pathlib import Path

ROOT = Path(sys.argv[1])
OUT = Path(sys.argv[2])
rng = random.Random(7)

cross = json.loads((ROOT / "App_v01/crawler/data/narratives_cross.json").read_text())
rt = json.loads((ROOT / "App_v01/crawler/data/rt_de/narratives_report.json").read_text())
catalogue = json.loads((ROOT / "sources.json").read_text())
manifest = json.loads((ROOT / "App_v01/data/runs/de_sources_2026-05-26_2026-09-26/manifest.json").read_text())
dsn = json.loads((ROOT / "narratives.json").read_text())
codebook = json.loads((ROOT / "data/codebook.json").read_text())
edges_real = [json.loads(l) for l in (ROOT / "data/edges.jsonl").read_text().splitlines() if l.strip()]

weeks = [{"week": w["week"], "start": w["start"], "end": w["end"]} for w in rt["weeks"]]
W = len(weeks)

cat = {}
for r in catalogue["ranks"]:
    for e in r["entries"]:
        cat[e["id"]] = {"rank": r["rank"], "rank_label": r["label"], "name": e["name"], "control": e.get("control"), "language": e.get("language")}


def week_index(date):
    for i, w in enumerate(weeks):
        if w["start"] <= date <= w["end"]:
            return i
    return None


def spread(total, lo, hi, peak_i=None, peak_n=None):
    """Distribute `total` over weeks lo..hi with a noisy shape and an optional pinned peak."""
    out = [0] * W
    if total <= 0 or hi < lo:
        return out
    idx = list(range(lo, hi + 1))
    base = [max(0.05, 1 + 0.6 * math.sin(i * 0.9 + rng.random() * 3) + rng.gauss(0, 0.35)) for i in idx]
    rest = total - (peak_n or 0) if peak_i is not None and lo <= peak_i <= hi else total
    s = sum(base)
    alloc = [int(round(rest * b / s)) for b in base]
    for k, i in enumerate(idx):
        out[i] = alloc[k]
    if peak_i is not None and lo <= peak_i <= hi and peak_n:
        out[peak_i] = peak_n
        cap = peak_n - 1
        for i in idx:
            if i != peak_i and out[i] > cap:
                out[i] = cap
    return out


def series_weeks(se, totals, lo, hi):
    """Weekly hits that follow the outlet's weekly volume at the series' real share,
    with the real peak week pinned to its real peak share. Never exceeds the week total."""
    out = [0] * W
    if not se["article_count"]:
        return out
    share = se["share_pct"] / 100
    p = se.get("peak") or {}
    pi = week_index(p["week_start"]) if p.get("n") else None
    raw = [0.0] * W
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


sources = []
series_meta = {}
for src in cross["sources"]:
    sid = src["source"]
    span = src["date_span"]
    lo = week_index(span["min"]) or 0
    hi = week_index(span["max"])
    hi = W - 1 if hi is None else hi
    if sid == "rt_de":
        totals = [w["articles"] for w in rt["weeks"]]
    else:
        totals = spread(src["article_count"], lo, hi)
    ser = []
    rt_series = {s["id"]: s for s in rt["series"]} if sid == "rt_de" else {}
    for se in src["series"]:
        series_meta[se["id"]] = {"id": se["id"], "kind": se["kind"], "label": se["label"]}
        if sid == "rt_de":
            weekly = rt_series[se["id"]]["weekly_n"]
            quotes = rt_series[se["id"]]["quotes"]
        else:
            weekly = series_weeks(se, totals, lo, hi)
            quotes = [se["quote"]] if se.get("quote") else []
        ser.append({
            "id": se["id"],
            "article_count": se["article_count"],
            "share_pct": se["share_pct"],
            "peak": se["peak"] if se["article_count"] else None,
            "weekly_n": weekly,
            "quotes": quotes,
        })
    res = manifest["results"].get(sid, {})
    ok = src["article_count"]
    discovered = max(res.get("discovered") or 0, ok)
    reject = res.get("reject") or 0
    error = res.get("error") or 0
    if discovered > ok and not (reject or error):
        gap = discovered - ok
        reject = int(gap * 0.7)
        error = gap - reject
    sources.append({
        "id": sid,
        **cat.get(sid, {"rank": None, "name": sid}),
        "script": src["script"],
        "article_count": src["article_count"],
        "date_span": span,
        "weekly_articles": totals,
        "weekly_observed": sid == "rt_de",
        "crawl": {"discovered": discovered, "ok": ok, "reject": reject, "error": error},
        "series": ser,
    })

# Upstream wires appear only as edge origins.
upstream = [{"id": k, **cat[k]} for k in ("ria", "tass")]

edges = [{**e, "synthetic": False} for e in edges_real]
flows = [("ria", "rt_de", 14), ("ria", "sputnik_de", 11), ("tass", "rt_de", 9), ("tass", "sputnik_de", 7),
         ("ria", "newsfront_de", 12), ("tass", "newsfront_de", 5), ("ria", "pravda_de", 16), ("tass", "pravda_de", 10),
         ("ria", "anti_spiegel", 4), ("rt_de", "anti_spiegel", 6), ("rt_de", "apolut", 5), ("rt_de", "klagemauer", 3),
         ("anti_spiegel", "apolut", 3), ("sputnik_de", "auf1", 2), ("rt_de", "auf1", 2), ("newsfront_de", "pravda_de", 4)]
rels = ["citation", "topic_echo", "near_duplicate"]
for a, b, n in flows:
    for _ in range(n):
        rel = rng.choices(rels, weights=[0.45, 0.4, 0.15])[0]
        lag = round(abs(rng.lognormvariate(2.6 if a in ("ria", "tass") else 3.2, 0.8)), 2)
        edges.append({"from_source_id": a, "to_source_id": b, "relation": rel, "lag_hours": lag,
                      "similarity": 1.0 if rel == "citation" else (round(rng.uniform(0.86, 0.99), 4) if rel == "near_duplicate" else 0.0),
                      "rule": {"citation": "explicit_citation", "topic_echo": "entity_window", "near_duplicate": "simhash"}[rel],
                      "example_overlap": None, "synthetic": True})

frames = {f["id"]: f for f in codebook["frames"]}
series = []
for sid, m in series_meta.items():
    f = frames.get(sid, {})
    series.append({**m, "target": f.get("target"), "pattern": f.get("pattern"), "status": f.get("status", "active")})

fixture = {
    "meta": {
        "generated": "2026-09-26",
        "method": cross["method"],
        "window": {"start": weeks[0]["start"], "end": weeks[-1]["end"]},
        "synthetic_note": "Mock fixture for the dashboard. Totals, peaks, quotes, RT DE weekly counts and the first 10 edges come from pipeline output. Weekly curves for other sources, edges flagged synthetic, and some crawl reject/error counts are generated.",
    },
    "weeks": weeks,
    "series": series,
    "sources": sources,
    "upstream": upstream,
    "edges": edges,
    "dsn_narratives": dsn["narratives"],
    "dsn_meta": dsn["meta"],
}
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(fixture, ensure_ascii=False, indent=1))
print("wrote", OUT, len(edges), "edges", len(sources), "sources")
