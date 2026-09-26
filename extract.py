"""Extract article records from saved HTML with trafilatura."""

from __future__ import annotations

import argparse
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from lxml import html as lxml_html

from catalogue import DATA_DIR, host_index
from simhash import as_hex, simhash64
from urls import article_id_for, host_from_url, normalize_url, sha256_text

RAW_DIR = DATA_DIR / "raw"
ARTICLES_DIR = DATA_DIR / "articles"
MIN_CHARS = 400
URL_DATE_RE = re.compile(r"/(20\d{2})[/-](\d{1,2})[/-](\d{1,2})(?:/|$)")
TIME_RE = re.compile(
    r'<time[^>]+datetime=["\']([^"\']+)["\']',
    re.I,
)
META_DATE_RE = re.compile(
    r'<meta[^>]+(?:property|name)=["\'](?:article:published_time|og:updated_time|pubdate|publish-date|date)["\'][^>]+content=["\']([^"\']+)["\']',
    re.I,
)
CREDIT_RE = re.compile(
    r"(?:Quelle|Source|Источник)\s*[:：]\s*([^\n.]{2,80})",
    re.I,
)


def _load_fetches() -> dict[str, dict[str, Any]]:
    path = DATA_DIR / "fetches.jsonl"
    by_raw: dict[str, dict[str, Any]] = {}
    if not path.exists():
        return by_raw
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        row = json.loads(line)
        raw_path = row.get("raw_path")
        if raw_path:
            by_raw[raw_path] = row
    return by_raw


def _parse_date(value: str | None) -> datetime | None:
    if not value:
        return None
    value = value.strip()
    for candidate in (value, value.replace("Z", "+00:00")):
        try:
            parsed = datetime.fromisoformat(candidate)
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            return parsed
        except ValueError:
            continue
    match = re.search(r"(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})", value)
    if not match:
        return None
    try:
        return datetime(
            int(match.group(1)),
            int(match.group(2)),
            int(match.group(3)),
            tzinfo=timezone.utc,
        )
    except ValueError:
        return None


def resolve_published_at(html: str, extracted_date: str | None, url: str) -> tuple[str | None, str, str]:
    html_match = TIME_RE.search(html)
    if html_match:
        parsed = _parse_date(html_match.group(1))
        if parsed:
            return parsed.isoformat(), "html_time", "high"
    meta_match = META_DATE_RE.search(html)
    if meta_match:
        parsed = _parse_date(meta_match.group(1))
        if parsed:
            return parsed.isoformat(), "meta", "high"
    parsed = _parse_date(extracted_date)
    if parsed:
        return parsed.isoformat(), "trafilatura", "high"
    url_match = URL_DATE_RE.search(url)
    if url_match:
        try:
            parsed = datetime(
                int(url_match.group(1)),
                int(url_match.group(2)),
                int(url_match.group(3)),
                tzinfo=timezone.utc,
            )
            return parsed.isoformat(), "url", "low"
        except ValueError:
            pass
    return None, "missing", "low"


def outbound_links(html: str, page_url: str, index: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    links: list[dict[str, Any]] = []
    seen: set[str] = set()
    try:
        tree = lxml_html.fromstring(html.encode("utf-8", errors="ignore"))
    except Exception:
        return links
    try:
        tree.make_links_absolute(page_url)
    except Exception:
        pass
    for node in tree.xpath("//a[@href]"):
        href = normalize_url(str(node.get("href") or ""))
        if not href or href in seen:
            continue
        seen.add(href)
        host = host_from_url(href)
        meta = index.get(host)
        links.append(
            {
                "url": href,
                "host": host,
                "resolved_source_id": meta["source_id"] if meta else None,
                "anchor": " ".join((node.text_content() or "").split())[:240],
            }
        )
    return links


def extract_credits(text: str, index: dict[str, dict[str, Any]]) -> list[dict[str, str]]:
    credits: list[dict[str, str]] = []
    lead = (text or "")[:1500]
    names = {
        "rt de": "rt_de",
        "rt deutsch": "rt_de",
        "ria novosti": "ria",
        "риа новости": "ria",
        "tass": "tass",
        "тасс": "tass",
        "sputnik": "sputnik_de",
        "sna": "sputnik_de",
        "newsfront": "newsfront_de",
        "news-front": "newsfront_de",
        "anti-spiegel": "anti_spiegel",
        "izvestia": "izvestia",
        "известия": "izvestia",
    }
    for match in CREDIT_RE.finditer(lead):
        raw = match.group(1).strip()
        lower = raw.lower()
        source_id = None
        for needle, sid in names.items():
            if needle in lower:
                source_id = sid
                break
        credits.append({"raw": raw, "resolved_source_id": source_id, "span": match.group(0)})
    lower_lead = lead.lower()
    for needle, sid in names.items():
        if needle in lower_lead and not any(c.get("resolved_source_id") == sid for c in credits):
            credits.append({"raw": needle, "resolved_source_id": sid, "span": needle})
    return credits


def extract_file(
    path: Path,
    fetch_row: dict[str, Any] | None,
    index: dict[str, dict[str, Any]],
) -> dict[str, Any] | None:
    import trafilatura

    html = path.read_text(encoding="utf-8", errors="ignore")
    url = (fetch_row or {}).get("final_url") or (fetch_row or {}).get("url") or ""
    dumped = trafilatura.extract(
        html,
        url=url or None,
        output_format="json",
        with_metadata=True,
        include_links=True,
        include_comments=False,
        favor_precision=True,
    )
    if not dumped:
        return None
    extracted = json.loads(dumped)
    text = extracted.get("text") or ""
    if len(text) < MIN_CHARS:
        return None
    pagetype = str(extracted.get("pagetype") or "article").lower()
    if pagetype in {"author", "category", "page", "list"}:
        return None

    page_url = extracted.get("source") or url
    host = host_from_url(page_url) or host_from_url(url)
    meta = index.get(host) or {}
    published_at, date_source, date_confidence = resolve_published_at(
        html, extracted.get("date"), page_url
    )
    record = {
        "article_id": article_id_for(page_url or url),
        "source_id": (fetch_row or {}).get("source_id") or meta.get("source_id"),
        "rank": meta.get("rank"),
        "control": meta.get("control"),
        "host": host,
        "domain_role": meta.get("role"),
        "url": url,
        "canonical_url": extracted.get("source") or normalize_url(page_url or url),
        "mirror_of": None,
        "extracted": {
            "title": extracted.get("title"),
            "author": extracted.get("author"),
            "date": extracted.get("date"),
            "sitename": extracted.get("sitename"),
            "categories": extracted.get("categories"),
            "tags": extracted.get("tags"),
            "fingerprint": extracted.get("fingerprint"),
            "excerpt": extracted.get("excerpt") or extracted.get("description"),
            "text": text,
            "language": extracted.get("language"),
            "image": extracted.get("image"),
            "pagetype": extracted.get("pagetype"),
        },
        "fetched_at": (fetch_row or {}).get("fetched_at"),
        "http_status": (fetch_row or {}).get("http_status", 200),
        "final_url": (fetch_row or {}).get("final_url") or page_url,
        "published_at": published_at,
        "date_source": date_source,
        "date_confidence": date_confidence,
        "text_sha256": sha256_text(text),
        "simhash": as_hex(simhash64(text)),
        "char_len": len(text),
        "embedding_id": None,
        "outbound_links": outbound_links(html, page_url or url, index),
        "credits": extract_credits(text, index),
        "copy_cluster_id": None,
        "topic_id": None,
        "raw_path": str(path),
    }
    return record


def extract_all() -> int:
    ARTICLES_DIR.mkdir(parents=True, exist_ok=True)
    for stale in ARTICLES_DIR.glob("*.jsonl"):
        stale.unlink()
    fetches = _load_fetches()
    index = host_index()
    by_source: dict[str, list[dict[str, Any]]] = {}
    seen: set[str] = set()
    if not RAW_DIR.exists():
        return 0
    for html_path in RAW_DIR.rglob("*.html"):
        fetch_row = fetches.get(str(html_path))
        if fetch_row is None:
            source_id = html_path.parent.name
            fetch_row = {"source_id": source_id, "http_status": 200, "raw_path": str(html_path)}
        record = extract_file(html_path, fetch_row, index)
        if record is None:
            continue
        if record["article_id"] in seen:
            continue
        seen.add(record["article_id"])
        by_source.setdefault(record.get("source_id") or "unknown", []).append(record)
    count = 0
    for source_id, rows in by_source.items():
        out = ARTICLES_DIR / f"{source_id}.jsonl"
        with out.open("w", encoding="utf-8") as handle:
            for record in rows:
                handle.write(json.dumps(record, ensure_ascii=False) + "\n")
        count += len(rows)
    return count


def load_articles() -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    if not ARTICLES_DIR.exists():
        return rows
    for path in ARTICLES_DIR.glob("*.jsonl"):
        for line in path.read_text(encoding="utf-8").splitlines():
            if line.strip():
                rows.append(json.loads(line))
    return rows


def main() -> None:
    parser = argparse.ArgumentParser(description="Extract articles from saved HTML")
    parser.parse_args()
    n = extract_all()
    print(f"extracted {n} articles into {ARTICLES_DIR}")


if __name__ == "__main__":
    main()
