"""Label RT DE articles with the codebook and write a weekly report.

Usage (from App_v01):

    python -m services.narratives
"""

from __future__ import annotations

import json
import math
import re
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path

from services.narratives.codebook import PATTERNS

# Same rule as claims.trailing_z. Kept local so the scanner does not import the crawl stack.
BASELINE_WEEKS = 8
MIN_COUNT = 5


def trailing_z(shares: list[float], counts: list[int], baseline: int = BASELINE_WEEKS, min_count: int = MIN_COUNT) -> list[float | None]:
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

ROOT = Path(__file__).resolve().parents[2]
ARTICLES = ROOT / "crawler" / "data" / "rt_de" / "articles.jsonl"
REPORT = ROOT / "crawler" / "data" / "rt_de" / "narratives_report.json"
RUN = ROOT / "data" / "runs" / "de_sources_2026-05-26_2026-09-26"
CROSS_REPORT = ROOT / "crawler" / "data" / "narratives_cross.json"

SOURCES: tuple[tuple[str, Path], ...] = (
    ("rt_de", ARTICLES),
    ("sputnik_de", RUN / "sputnik_de" / "articles.jsonl"),
    ("pravda_de", RUN / "pravda_de" / "articles.jsonl"),
    ("newsfront_de", RUN / "newsfront_de" / "articles.jsonl"),
    ("anti_spiegel", RUN / "anti_spiegel" / "articles.jsonl"),
    ("apolut", RUN / "apolut" / "articles.jsonl"),
    ("klagemauer", RUN / "klagemauer" / "articles.jsonl"),
    ("auf1", RUN / "auf1" / "articles.jsonl"),
)

SENTENCE = re.compile(r"(?<=[.!?])\s+")


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


def _pick_quotes(hits: list[dict]) -> list[dict]:
    """Prefer a body sentence over a headline that only repeats the title."""
    body = [hit for hit in hits if not _same_as_title(hit["quote"], hit.get("title") or "")]
    titles = [hit for hit in hits if hit not in body]
    body.sort(key=lambda hit: len(hit["quote"]))
    titles.sort(key=lambda hit: len(hit["quote"]))
    ordered = body + titles
    quotes: list[dict] = []
    seen: set[str] = set()
    for hit in ordered:
        key = re.sub(r"\W+", " ", hit["quote"].lower())[:90]
        if key in seen:
            continue
        seen.add(key)
        quotes.append(hit)
        if len(quotes) == 3:
            break
    return quotes


def load_rows(path: Path) -> list[dict]:
    rows: list[dict] = []
    for line in path.open(encoding="utf-8"):
        line = line.strip()
        if line:
            rows.append(json.loads(line))
    return rows


def body_script(rows: list[dict]) -> str:
    cyrillic = 0
    letters = 0
    for row in rows[:40]:
        for char in row.get("text") or "":
            if not char.isalpha():
                continue
            letters += 1
            if "\u0400" <= char <= "\u04ff":
                cyrillic += 1
    if letters == 0:
        return "unknown"
    return "ru" if cyrillic / letters > 0.4 else "de"


def date_span(rows: list[dict]) -> dict:
    days = sorted({row["date"][:10] for row in rows if row.get("date")})
    if not days:
        return {"min": None, "max": None, "distinct_days": 0, "timeline": False, "note": "no dates"}
    start = date.fromisoformat(days[0])
    end = date.fromisoformat(days[-1])
    span_days = (end - start).days
    timeline = span_days >= 28 and len(days) >= 8
    note = None
    if len(days) == 1:
        note = f"every item is dated {days[0]}"
        timeline = False
    elif span_days < 14:
        note = f"dates only run {days[0]} to {days[-1]}"
        timeline = False
    return {
        "min": days[0],
        "max": days[-1],
        "distinct_days": len(days),
        "timeline": timeline,
        "note": note,
    }


def scan_rows(rows: list[dict], source: str) -> dict:
    dated = [row for row in rows if row.get("date") and len(row["date"]) >= 10]
    weeks = sorted({week_key(date.fromisoformat(row["date"][:10])) for row in dated})
    if not dated or not weeks:
        return {
            "source": source,
            "script": "unknown",
            "method": "sentence regex from services/narratives/codebook.py; German and Russian wording; one quote required",
            "cutoff": "2026-05-26",
            "article_count": 0,
            "date_span": date_span(dated),
            "weeks": [],
            "series": [],
        }
    volume = {week: 0 for week in weeks}
    for row in dated:
        volume[week_key(date.fromisoformat(row["date"][:10]))] += 1

    compiled = [(pattern, re.compile(pattern.pattern, re.IGNORECASE)) for pattern in PATTERNS]
    hits: dict[str, list[dict]] = defaultdict(list)
    for row in dated:
        blob_sentences = sentences(f"{row.get('title') or ''}. {row.get('text') or ''}")
        for pattern, regex in compiled:
            quote = next(
                (sentence for sentence in blob_sentences if regex.search(sentence) and usable_quote(sentence)),
                None,
            )
            if quote is None:
                continue
            hits[pattern.id].append(
                {
                    "date": row["date"][:10],
                    "week": week_key(date.fromisoformat(row["date"][:10])),
                    "url": row.get("url"),
                    "title": row.get("title"),
                    "section": row.get("section"),
                    "quote": quote,
                }
            )

    series = []
    for pattern in PATTERNS:
        matched = hits[pattern.id]
        weekly_n = [sum(1 for hit in matched if hit["week"] == week) for week in weeks]
        weekly_share = [
            round(100 * count / volume[week], 2) if volume[week] else 0
            for week, count in zip(weeks, weekly_n)
        ]
        scores = trailing_z([share / 100 for share in weekly_share], weekly_n)
        scored = [i for i, score in enumerate(scores) if score is not None]
        if scored:
            peak_i = max(scored, key=lambda i: (scores[i], weekly_n[i]))
        else:
            peak_i = max(range(len(weeks)), key=lambda i: (weekly_n[i], weekly_share[i]))
        peak_week = weeks[peak_i]
        peak_hits = [hit for hit in matched if hit["week"] == peak_week]
        quotes = _pick_quotes(peak_hits)
        series.append(
            {
                "id": pattern.id,
                "kind": pattern.kind,
                "label": pattern.label,
                "article_count": len(matched),
                "share_pct": round(100 * len(matched) / len(dated), 2),
                "weekly_n": weekly_n,
                "weekly_share_pct": weekly_share,
                "peak": {
                    "week": peak_week,
                    "week_start": week_monday(peak_week).isoformat(),
                    "n": weekly_n[peak_i],
                    "share_pct": weekly_share[peak_i],
                    "z": None if scores[peak_i] is None else round(scores[peak_i], 2),
                },
                "quotes": quotes,
            }
        )

    span = date_span(dated)
    return {
        "source": source,
        "script": body_script(dated),
        "method": "sentence regex from services/narratives/codebook.py; German and Russian wording; one quote required",
        "cutoff": "2026-05-26",
        "article_count": len(dated),
        "date_span": span,
        "weeks": [
            {
                "week": week,
                "start": week_monday(week).isoformat(),
                "end": (week_monday(week) + timedelta(days=6)).isoformat(),
                "articles": volume[week],
            }
            for week in weeks
        ],
        "series": series,
    }


def scan() -> dict:
    return scan_rows(load_rows(ARTICLES), "rt_de")


def _print_source(report: dict) -> None:
    span = report["date_span"]
    print(
        f"\n{report['source']}  n={report['article_count']}  script={report['script']}  "
        f"{span['min']}..{span['max']}  timeline={span['timeline']}"
    )
    if span["note"]:
        print(f"  note: {span['note']}")
    for series in report["series"]:
        peak = series["peak"]
        z_text = "–" if peak["z"] is None else f"{peak['z']:.2f}"
        print(
            f"  {series['kind']:7} {series['label']:28} "
            f"n={series['article_count']:4} share={series['share_pct']:5.1f}%  "
            f"peak {peak['week_start']} {peak['share_pct']:5.1f}% z={z_text}"
        )


def main() -> None:
    reports = []
    for source, path in SOURCES:
        if not path.exists():
            print(f"missing {source}: {path}")
            continue
        report = scan_rows(load_rows(path), source)
        reports.append(report)
        _print_source(report)
        if source == "rt_de":
            REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    # Cross file keeps counts and one quote per pattern. Full weekly series stay on RT only.
    cross = {
        "method": reports[0]["method"] if reports else "",
        "sources": [
            {
                "source": report["source"],
                "script": report["script"],
                "article_count": report["article_count"],
                "date_span": report["date_span"],
                "series": [
                    {
                        "id": series["id"],
                        "kind": series["kind"],
                        "label": series["label"],
                        "article_count": series["article_count"],
                        "share_pct": series["share_pct"],
                        "peak": series["peak"],
                        "quote": (series["quotes"] or [None])[0],
                    }
                    for series in report["series"]
                ],
            }
            for report in reports
        ],
    }
    CROSS_REPORT.write_text(json.dumps(cross, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nwrote {REPORT}")
    print(f"wrote {CROSS_REPORT}")


if __name__ == "__main__":
    main()
