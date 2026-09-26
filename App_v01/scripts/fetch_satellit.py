#!/usr/bin/env python3
"""Archive Satellit, the German successor of Sputnik/SNA, from the public Telegram preview.

snanews.de and de.sputniknews.com no longer resolve. Satellit (@satellit_de) is the
channel SNA pointed readers to after the March 2022 ban. Same date window as the
other archives: on or after 2026-05-26. Message text is passed through trafilatura.
"""
from __future__ import annotations

import json
import re
import sys
import time
from datetime import datetime, timezone
from html import unescape
from pathlib import Path

import trafilatura

sys.path.insert(0, str(Path(__file__).resolve().parent))
from fetch_de_sources import CUTOFF, OUT_DIR, append_jsonl, fetch_text  # noqa: E402

SOURCE = "sputnik_de"
CHANNEL = "satellit_de"
HOME = f"https://t.me/s/{CHANNEL}"
MIN_CHARS = 40

POST_SPLIT = re.compile(r'(?=<div class="tgme_widget_message_wrap )')
POST_ID = re.compile(rf'data-post="{CHANNEL}/(\d+)"')
POST_DATE = re.compile(r'<time[^>]*datetime="([^"]+)"')
POST_TEXT = re.compile(r'class="tgme_widget_message_text[^"]*"[^>]*>(.*?)</div>', re.S)
BEFORE = re.compile(r'data-before="(\d+)"')
TAGS = re.compile(r"<[^>]+>")


def messages(html: str) -> list[dict]:
    found = []
    for part in POST_SPLIT.split(html):
        id_match = POST_ID.search(part)
        if not id_match:
            continue
        date_match = POST_DATE.search(part)
        text_match = POST_TEXT.search(part)
        inner = text_match.group(1) if text_match else ""
        plain = unescape(TAGS.sub(" ", inner))
        plain = re.sub(r"\s+", " ", plain).strip()
        found.append(
            {
                "id": int(id_match.group(1)),
                "date": (date_match.group(1)[:10] if date_match else None),
                "html": inner,
                "plain": plain,
            }
        )
    return found


def extract_message(item: dict) -> dict:
    url = f"https://t.me/{CHANNEL}/{item['id']}"
    page = (
        "<!DOCTYPE html><html lang='de'><head>"
        f"<title>{item['plain'][:180]}</title></head><body><article>{item['html']}</article></body></html>"
    )
    raw = trafilatura.extract(
        page,
        url=url,
        output_format="json",
        with_metadata=True,
        include_comments=False,
        target_language="de",
        favor_precision=True,
    )
    text = item["plain"]
    title = item["plain"][:180] or None
    if raw:
        doc = json.loads(raw)
        if (doc.get("text") or "").strip():
            text = doc["text"].strip()
        title = doc.get("title") or title
    record = {
        "source": SOURCE,
        "outlet": "Satellit",
        "lineage": "Sputnik Deutschland / SNA",
        "message_id": item["id"],
        "url": url,
        "title": title,
        "author": "Satellit",
        "date": item["date"],
        "sitename": "Satellit",
        "language": "de",
        "word_count": len(text.split()),
        "text": text,
    }
    if item["date"] and item["date"] < CUTOFF:
        return "reject", {"url": url, "reason": "before_cutoff", "date": item["date"]}
    if len(text) < MIN_CHARS:
        return "reject", {"url": url, "reason": "too_short", "chars": len(text), "date": item["date"]}
    return "ok", record


def done_ids(path: Path) -> set[int]:
    seen: set[int] = set()
    if not path.exists():
        return seen
    with path.open(encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line:
                continue
            try:
                row = json.loads(line)
            except json.JSONDecodeError:
                continue
            if "message_id" in row:
                seen.add(int(row["message_id"]))
            else:
                match = re.search(rf"/{CHANNEL}/(\d+)", row.get("url", ""))
                if match:
                    seen.add(int(match.group(1)))
    return seen


def main() -> None:
    source_dir = OUT_DIR / SOURCE
    source_dir.mkdir(parents=True, exist_ok=True)
    articles = source_dir / "articles.jsonl"
    rejects = source_dir / "rejects.jsonl"
    errors = source_dir / "errors.jsonl"
    seen = done_ids(articles) | done_ids(rejects) | done_ids(errors)
    before: str | None = None
    counts = {"ok": 0, "reject": 0, "error": 0, "pages": 0}
    empty_pages = 0
    while True:
        url = HOME if before is None else f"{HOME}?before={before}"
        html = fetch_text(url, timeout=30)
        counts["pages"] += 1
        if not html:
            counts["error"] += 1
            append_jsonl(errors, {"url": url, "reason": "fetch_failed"})
            empty_pages += 1
            if empty_pages >= 3:
                break
            time.sleep(2)
            continue
        batch = messages(html)
        if not batch:
            empty_pages += 1
            if empty_pages >= 2:
                break
            time.sleep(1)
            continue
        empty_pages = 0
        fresh = [item for item in batch if item["id"] not in seen]
        oldest = min((item["date"] or "9999") for item in batch)
        for item in fresh:
            seen.add(item["id"])
            try:
                status, record = extract_message(item)
            except Exception as exc:
                status, record = "error", {"url": f"https://t.me/{CHANNEL}/{item['id']}", "reason": type(exc).__name__}
            counts[status] += 1
            if status == "ok":
                append_jsonl(articles, record)
            elif status == "reject":
                append_jsonl(rejects, record)
            else:
                append_jsonl(errors, record)
        next_before = BEFORE.search(html)
        print(
            f"page {counts['pages']} before={before} batch={len(batch)} "
            f"oldest={oldest} ok={counts['ok']} reject={counts['reject']}",
            flush=True,
        )
        if oldest < CUTOFF or not next_before:
            break
        new_before = next_before.group(1)
        if new_before == before:
            break
        before = new_before
        time.sleep(0.4)
    meta = {
        "source": SOURCE,
        "channel": f"https://t.me/{CHANNEL}",
        "why": "snanews.de and de.sputniknews.com do not resolve; Satellit is the German SNA/Sputnik successor",
        "extractor": f"trafilatura {trafilatura.__version__}",
        "cutoff": CUTOFF,
        **counts,
        "finished_at": datetime.now(timezone.utc).isoformat(),
    }
    (source_dir / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(meta, ensure_ascii=False, indent=2), flush=True)


if __name__ == "__main__":
    main()
