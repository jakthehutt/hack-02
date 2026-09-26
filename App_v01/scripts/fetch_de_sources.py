#!/usr/bin/env python3
"""Archive German-language catalogue sources with trafilatura.

Same window as the RT DE run: publication date on or after 2026-05-26.
RT DE is not collected. Rank-3 Russian wires are not collected: they are
upstream sources, not German editions.

trafilatura.fetch_url advertises zstd and then leaves Cloudflare zstd bodies
compressed, so pages are downloaded as gzip and passed to trafilatura.extract.
Safe to re-run: URLs already in articles.jsonl are not fetched again.
"""
from __future__ import annotations

import argparse
import gzip
import json
import re
import socket
import sys
import urllib.error
import urllib.request

# Prefer IPv4. Several of these hosts hang on IPv6 long enough to stall the crawl.
_orig_getaddrinfo = socket.getaddrinfo


def _ipv4_getaddrinfo(*args, **kwargs):
    results = _orig_getaddrinfo(*args, **kwargs)
    v4 = [item for item in results if item[0] == socket.AF_INET]
    return v4 or results


socket.getaddrinfo = _ipv4_getaddrinfo
socket.setdefaulttimeout(30)
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from html import unescape
from pathlib import Path
from threading import Lock

import trafilatura

REPO = Path(__file__).resolve().parents[1]
CATALOGUE = REPO / "data" / "seeds" / "de_ru_propaganda_catalogue.json"
OUT_DIR = REPO / "data" / "runs" / "de_sources_2026-05-26_2026-09-26"
CUTOFF = "2026-05-26"
MIN_CHARS = 80
WORKERS = 8
UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
)

LOC_DATE = re.compile(
    r"<loc>\s*(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?\s*</loc>"
    r"(?:\s*<lastmod>\s*(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?\s*</lastmod>)?",
    re.I | re.S,
)
FEED_LINK = re.compile(
    r"<link>(?:\s*<!\[CDATA\[)?(.*?)(?:\]\]>)?(?:\s*)</link>",
    re.I | re.S,
)

# Sitemap files that actually cover the window. Generic sitemap indexes on
# NewsFront contain years of Russian posts; do not walk those.
SITEMAPS = {
    "pravda_de": [
        "https://germany.news-pravda.com/sitemap_news_6.xml.gz",
        "https://germany.news-pravda.com/sitemap_news_7.xml.gz",
    ],
    "anti_spiegel": [
        "https://anti-spiegel.ru/wp-sitemap-posts-post-7.xml",
    ],
    "apolut": [
        "https://apolut.net/sitemap-posts.xml",
    ],
    "newsfront_de": [
        f"https://news-front.su/post-sitemap{i}.xml" for i in range(460, 470)
    ],
}
FEEDS = {
    "auf1": ["https://auf1.tv/feed"],
}
# German vhost is dead; the sanctioned site that still answers is Russian.
TARGET_LANG = {
    "pravda_de": "de",
    "anti_spiegel": "de",
    "apolut": "de",
    "auf1": "de",
    "klagemauer": "de",
    "newsfront_de": None,
}

WRITE_LOCK = Lock()


def fetch_bytes(url: str, timeout: int = 25) -> bytes | None:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": UA,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Encoding": "gzip",
            "Accept-Language": "de,en;q=0.8",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            data = response.read()
            encoding = (response.headers.get("Content-Encoding") or "").lower()
    except (urllib.error.URLError, TimeoutError, ConnectionError, OSError):
        return None
    if data[:2] == b"\x1f\x8b" or "gzip" in encoding:
        try:
            data = gzip.decompress(data)
        except (OSError, EOFError, gzip.BadGzipFile):
            return None
    return data


def fetch_text(url: str, timeout: int = 25) -> str | None:
    data = fetch_bytes(url, timeout=timeout)
    if not data:
        return None
    return data.decode("utf-8", "replace")


def host_resolves(host: str) -> bool:
    try:
        socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM)
    except socket.gaierror:
        return False
    return True


def sitemap_urls(xml: str) -> list[tuple[str, str | None]]:
    found: list[tuple[str, str | None]] = []
    for loc, lastmod in LOC_DATE.findall(xml):
        url = unescape(loc.strip())
        if not url.startswith("http") or url.endswith((".xml", ".xml.gz")):
            continue
        stamp = lastmod.strip()[:10] if lastmod else None
        found.append((url, stamp))
    return found


def in_window(stamp: str | None, url: str) -> bool:
    if stamp:
        return stamp >= CUTOFF
    match = re.search(r"/(20\d{2})/(\d{2})/(\d{2})/", url)
    if match:
        return "-".join(match.groups()) >= CUTOFF
    return False


def discover_sitemaps(source_id: str) -> list[str]:
    urls: list[str] = []
    seen: set[str] = set()
    for sitemap in SITEMAPS.get(source_id, []):
        print(f"{source_id} reading {sitemap}", flush=True)
        xml = fetch_text(sitemap, timeout=45)
        if not xml:
            print(f"{source_id} sitemap failed {sitemap}", flush=True)
            continue
        for url, stamp in sitemap_urls(xml):
            if url in seen or not in_window(stamp, url):
                continue
            seen.add(url)
            urls.append(url)
    return urls


def discover_feeds(source_id: str) -> list[str]:
    urls: list[str] = []
    seen: set[str] = set()
    for feed in FEEDS.get(source_id, []):
        xml = fetch_text(feed)
        if not xml:
            continue
        for loc in FEED_LINK.findall(xml):
            url = unescape(loc.strip())
            if url in seen or not url.startswith("http") or url.rstrip("/") in {
                "https://auf1.tv",
            }:
                continue
            if url.endswith("/feed"):
                continue
            seen.add(url)
            urls.append(url)
    return urls


def discover_kla() -> list[str]:
    html = fetch_text("https://www.kla.tv/de") or ""
    ids = [int(n) for n in re.findall(r"https://www\.kla\.tv/(\d{4,6})", html)]
    ids += [int(n) for n in re.findall(r"/video\.kla\.tv/\d{4}/\d{2}/(\d+)/", html)]
    if not ids:
        return []
    start = max(ids)
    # IDs are roughly chronological. A few hundred covers the four-month window
    # with room for gaps; the date filter drops anything older.
    return [f"https://www.kla.tv/{i}" for i in range(start, start - 900, -1)]


def already_done(source_dir: Path) -> set[str]:
    done: set[str] = set()
    for name in ("articles.jsonl", "rejects.jsonl", "errors.jsonl"):
        path = source_dir / name
        if not path.exists():
            continue
        with path.open(encoding="utf-8") as handle:
            for line in handle:
                line = line.strip()
                if not line:
                    continue
                try:
                    done.add(json.loads(line)["url"])
                except (json.JSONDecodeError, KeyError):
                    continue
    return done


def append_jsonl(path: Path, record: dict) -> None:
    with WRITE_LOCK:
        with path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(record, ensure_ascii=False) + "\n")


def harvest(source_id: str, url: str) -> tuple[str, dict]:
    html = fetch_text(url)
    if not html or ("<html" not in html[:1500].lower() and "<!doctype" not in html[:300].lower()):
        return "error", {"url": url, "reason": "fetch_failed"}
    raw = trafilatura.extract(
        html,
        url=url,
        output_format="json",
        with_metadata=True,
        include_comments=False,
        include_tables=False,
        favor_precision=True,
        target_language=TARGET_LANG.get(source_id),
    )
    if not raw:
        return "error", {"url": url, "reason": "extract_failed"}
    doc = json.loads(raw)
    text = (doc.get("text") or "").strip()
    date = (doc.get("date") or "")[:10]
    record = {
        "source": source_id,
        "url": doc.get("url") or url,
        "title": doc.get("title"),
        "author": doc.get("author"),
        "date": date or None,
        "description": doc.get("description"),
        "categories": doc.get("categories"),
        "tags": doc.get("tags"),
        "sitename": doc.get("sitename"),
        "language": doc.get("language"),
        "word_count": len(text.split()),
        "text": text,
    }
    if date and date < CUTOFF:
        return "reject", {"url": url, "reason": "before_cutoff", "date": date, "title": record["title"]}
    if len(text) < MIN_CHARS:
        return "reject", {
            "url": url,
            "reason": "too_short",
            "date": date or None,
            "chars": len(text),
            "title": record["title"],
        }
    return "ok", record


def run_source(source_id: str, urls: list[str], workers: int = WORKERS) -> dict:
    source_dir = OUT_DIR / source_id
    source_dir.mkdir(parents=True, exist_ok=True)
    articles = source_dir / "articles.jsonl"
    rejects = source_dir / "rejects.jsonl"
    errors = source_dir / "errors.jsonl"
    (source_dir / "urls.txt").write_text("\n".join(urls) + ("\n" if urls else ""), encoding="utf-8")
    done = already_done(source_dir)
    pending = [url for url in urls if url not in done]
    print(
        f"{source_id}: discovered {len(urls)} pending {len(pending)} already {len(done)} workers={workers}",
        flush=True,
    )
    counts = {"ok": 0, "reject": 0, "error": 0}
    if not pending:
        return counts
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {pool.submit(harvest, source_id, url): url for url in pending}
        for index, future in enumerate(as_completed(futures), start=1):
            url = futures[future]
            try:
                status, record = future.result()
            except Exception as exc:
                status, record = "error", {"url": url, "reason": type(exc).__name__, "detail": str(exc)}
            counts[status] += 1
            if status == "ok":
                append_jsonl(articles, record)
            elif status == "reject":
                append_jsonl(rejects, record)
            else:
                append_jsonl(errors, record)
            if index % 100 == 0 or index == len(pending):
                print(
                    f"{source_id} {index}/{len(pending)} "
                    f"ok={counts['ok']} reject={counts['reject']} error={counts['error']}",
                    flush=True,
                )
    return counts


def catalogue_notes() -> dict:
    data = json.loads(CATALOGUE.read_text(encoding="utf-8"))
    skipped = []
    unreachable = []
    for rank in data["ranks"]:
        for entry in rank["entries"]:
            if entry["id"] == "rt_de":
                skipped.append({"id": entry["id"], "reason": "excluded for this run"})
                continue
            if rank["rank"] == 3:
                skipped.append({"id": entry["id"], "reason": "upstream Russian wire, not a German edition"})
                continue
            if entry["id"] in SITEMAPS or entry["id"] in FEEDS or entry["id"] == "klagemauer":
                continue
            hosts = []
            for domain in entry.get("domains") or []:
                host = domain["host"]
                if domain.get("role") == "parent":
                    continue
                hosts.append(host)
            if not hosts and not entry.get("domains"):
                unreachable.append({"id": entry["id"], "reason": "no stable domain (Telegram only)"})
                continue
            dead = [host for host in hosts if not host_resolves(host)]
            if dead and len(dead) == len(hosts):
                unreachable.append({"id": entry["id"], "hosts": dead, "reason": "dns_failed"})
            elif hosts:
                unreachable.append({
                    "id": entry["id"],
                    "hosts": hosts,
                    "reason": "no article sitemap in this run (diplomatic page, clone snapshot, or feedless site)",
                })
    return {"skipped": skipped, "unreachable": unreachable}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--only",
        nargs="*",
        help="source ids to harvest (default: all configured)",
    )
    parser.add_argument("--workers", type=int, default=WORKERS, help="parallel downloads per source")
    args = parser.parse_args()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    order = ["anti_spiegel", "apolut", "auf1", "klagemauer", "newsfront_de", "pravda_de"]
    if args.only:
        order = [source for source in order if source in args.only]
    notes = catalogue_notes()
    results = {}
    for source_id in order:
        if source_id == "klagemauer":
            urls = discover_kla()
        elif source_id in FEEDS:
            urls = discover_feeds(source_id)
        else:
            urls = discover_sitemaps(source_id)
        counts = run_source(source_id, urls, workers=args.workers)
        results[source_id] = {"discovered": len(urls), **counts}
    manifest = {
        "extractor": f"trafilatura {trafilatura.__version__}",
        "download": "gzip via urllib; trafilatura.extract for the article body",
        "cutoff": CUTOFF,
        "excluded": "rt_de",
        "results": results,
        **notes,
        "finished_at": datetime.now(timezone.utc).isoformat(),
    }
    (OUT_DIR / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(manifest, ensure_ascii=False, indent=2), flush=True)
    if any(item["error"] for item in results.values()):
        sys.exit(2)


if __name__ == "__main__":
    main()
