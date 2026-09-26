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

ROOT = Path(__file__).resolve().parents[2]
ARTICLES = ROOT / "crawler" / "data" / "rt_de" / "articles.jsonl"
REPORT = ROOT / "crawler" / "data" / "rt_de" / "narratives_report.json"

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


def z_scores(shares: list[float]) -> list[float]:
    mean = sum(shares) / len(shares)
    variance = sum((share - mean) ** 2 for share in shares) / len(shares)
    sd = math.sqrt(variance) or 1e-9
    return [(share - mean) / sd for share in shares]


def scan() -> dict:
    rows: list[dict] = []
    for line in ARTICLES.open(encoding="utf-8"):
        line = line.strip()
        if line:
            rows.append(json.loads(line))

    dated = [row for row in rows if row.get("date")]
    weeks = sorted({week_key(date.fromisoformat(row["date"])) for row in dated})
    volume = {week: 0 for week in weeks}
    for row in dated:
        volume[week_key(date.fromisoformat(row["date"]))] += 1

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
                    "date": row["date"],
                    "week": week_key(date.fromisoformat(row["date"])),
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
        scores = z_scores(weekly_share)
        peak_i = max(range(len(weeks)), key=lambda i: (scores[i], weekly_n[i]))
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
                    "z": round(scores[peak_i], 2),
                },
                "quotes": quotes,
            }
        )

    return {
        "source": "rt_de",
        "method": "sentence regex from services/narratives/codebook.py; one quote required",
        "cutoff": "2026-05-26",
        "article_count": len(dated),
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


def main() -> None:
    report = scan()
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"articles {report['article_count']}  weeks {len(report['weeks'])}")
    print(f"wrote {REPORT}")
    for series in report["series"]:
        peak = series["peak"]
        print(
            f"{series['kind']:7} {series['label']:28} "
            f"n={series['article_count']:4} share={series['share_pct']:5.1f}%  "
            f"peak {peak['week']} {peak['share_pct']:5.1f}% z={peak['z']}"
        )


if __name__ == "__main__":
    main()
