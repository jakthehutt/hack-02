"""Collect RT DE articles from the public sitemap with trafilatura.

Window: publication date on or after 2026-05-26 (four months before 2026-09-26).
Video clips, tag pages, and podcast episode pages are not articles and are skipped.
Safe to re-run: URLs already written to articles.jsonl are not fetched again.
"""

from __future__ import annotations

import json
import re
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock

import trafilatura
from trafilatura.settings import use_config

from crawler.models import Article, CrawlMeta, iter_articles

PACKAGE = Path(__file__).resolve().parent
OUT_DIR = PACKAGE / "data" / "rt_de"
ARTICLES = OUT_DIR / "articles.jsonl"
REJECTS = OUT_DIR / "rejects.jsonl"
ERRORS = OUT_DIR / "errors.jsonl"
URLS = OUT_DIR / "urls.txt"
META = OUT_DIR / "meta.json"

HOME = "https://de.rt.com/"
SITEMAP = "https://de.rt.com/sitemap_2026.xml"
NEWS = "https://de.rt.com/newssitemap.xml"
CUTOFF = "2026-05-26"
MIN_ID = 280800  # ~15 May 2026; date filter drops anything still before the cutoff
SKIP_SECTIONS = {"tag", "kurzclips", "podcast", "programme"}
WORKERS = 8
MIN_CHARS = 80

CONFIG = use_config()
CONFIG.set("DEFAULT", "DOWNLOAD_TIMEOUT", "25")

WRITE_LOCK = Lock()


def load_articles(path: Path | None = None):
    return iter_articles(path or ARTICLES)


def article_id(url: str) -> int | None:
    slug = url.rstrip("/").rsplit("/", 1)[-1]
    match = re.match(r"^(\d+)-", slug)
    return int(match.group(1)) if match else None


def section_of(url: str) -> str:
    path = url.replace(HOME, "").strip("/")
    return path.split("/", 1)[0] if path else ""


def discover_urls() -> list[str]:
    seen: set[str] = set()
    urls: list[str] = []

    def add(url: str) -> None:
        if url in seen:
            return
        parts = url.replace(HOME, "").strip("/").split("/")
        if not parts or parts[0] in SKIP_SECTIONS:
            return
        aid = article_id(url)
        if aid is None or aid < MIN_ID:
            return
        seen.add(url)
        urls.append(url)

    yearly = trafilatura.fetch_url(SITEMAP, config=CONFIG)
    if not yearly:
        raise SystemExit(f"failed to fetch {SITEMAP}")
    for loc, _lastmod in re.findall(r"<loc>(.*?)</loc>\s*<lastmod>(.*?)</lastmod>", yearly):
        add(loc)

    news = trafilatura.fetch_url(NEWS, config=CONFIG)
    if not news:
        raise SystemExit(f"failed to fetch {NEWS}")
    news_added = 0
    for loc in re.findall(r"<loc>(.*?)</loc>", news):
        before = len(urls)
        add(loc)
        news_added += len(urls) - before
    print(f"news sitemap contributed {news_added}", flush=True)

    urls.sort(key=lambda u: article_id(u) or 0)
    return urls


def already_done() -> set[str]:
    done: set[str] = set()
    if not ARTICLES.exists():
        return done
    for article in load_articles():
        done.add(article.url)
    return done


def append_jsonl(path: Path, record: dict) -> None:
    with WRITE_LOCK:
        with path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(record, ensure_ascii=False) + "\n")


def harvest(url: str) -> tuple[str, dict]:
    downloaded = trafilatura.fetch_url(url, config=CONFIG)
    if not downloaded:
        return "error", {"url": url, "reason": "fetch_failed"}
    raw = trafilatura.extract(
        downloaded,
        url=url,
        output_format="json",
        with_metadata=True,
        include_comments=False,
        include_tables=False,
        favor_precision=True,
        target_language="de",
        config=CONFIG,
    )
    if not raw:
        return "error", {"url": url, "reason": "extract_failed"}
    doc = json.loads(raw)
    text = (doc.get("text") or "").strip()
    date = (doc.get("date") or "")[:10]
    article = Article(
        source="rt_de",
        article_id=article_id(url),
        section=section_of(url),
        url=doc.get("url") or url,
        title=doc.get("title"),
        author=doc.get("author"),
        date=date or None,
        description=doc.get("description"),
        categories=doc.get("categories") or None,
        tags=doc.get("tags") or None,
        sitename=doc.get("sitename"),
        language=doc.get("language"),
        word_count=len(text.split()),
        text=text,
    )
    if date and date < CUTOFF:
        return "reject", {
            "url": url,
            "reason": "before_cutoff",
            "date": date,
            "title": article.title,
        }
    if len(text) < MIN_CHARS:
        return "reject", {
            "url": url,
            "reason": "too_short",
            "date": date or None,
            "chars": len(text),
            "title": article.title,
        }
    return "ok", article.model_dump()


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    urls = discover_urls()
    URLS.write_text("\n".join(urls) + "\n", encoding="utf-8")
    done = already_done()
    pending = [url for url in urls if url not in done]
    print(f"discovered {len(urls)} pending {len(pending)} already {len(done)}", flush=True)

    counts = {"ok": 0, "reject": 0, "error": 0}
    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        futures = {pool.submit(harvest, url): url for url in pending}
        for index, future in enumerate(as_completed(futures), start=1):
            url = futures[future]
            try:
                status, record = future.result()
            except Exception as exc:  # keep the crawl moving
                status, record = "error", {"url": url, "reason": type(exc).__name__, "detail": str(exc)}
            counts[status] += 1
            if status == "ok":
                append_jsonl(ARTICLES, record)
            elif status == "reject":
                append_jsonl(REJECTS, record)
            else:
                append_jsonl(ERRORS, record)
            if index % 50 == 0 or index == len(pending):
                print(
                    f"{index}/{len(pending)} ok={counts['ok']} reject={counts['reject']} error={counts['error']}",
                    flush=True,
                )

    article_count = sum(1 for _ in load_articles()) if ARTICLES.exists() else 0
    meta = CrawlMeta(
        source_home=HOME,
        extractor=f"trafilatura {trafilatura.__version__}",
        cutoff=CUTOFF,
        cutoff_meaning="publication date on or after this day; four months before 2026-09-26",
        skipped_sections=sorted(SKIP_SECTIONS),
        discovered_urls=len(urls),
        article_count=article_count,
        written_this_run=counts["ok"],
        rejected_this_run=counts["reject"],
        errors_this_run=counts["error"],
        articles_file=str(ARTICLES.relative_to(PACKAGE.parent)),
        finished_at=datetime.now(timezone.utc).isoformat(),
    )
    META.write_text(meta.model_dump_json(indent=2) + "\n", encoding="utf-8")
    print(meta.model_dump_json(indent=2), flush=True)
    if counts["error"]:
        sys.exit(2)
