"""Discover and politely fetch article HTML from catalogue targets."""

from __future__ import annotations

import argparse
import gzip
import json
import time
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from typing import Any
from urllib.parse import urljoin, urlparse
from xml.etree import ElementTree

import httpx
from lxml import html as lxml_html

from catalogue import DATA_DIR, LOOKBACK_DAYS, ROOT, expand_targets
from urls import looks_like_article_url, normalize_url, sha256_text, url_published_at

USER_AGENT = (
    "NarrativePropagationResearch/0.1 "
    "(academic corpus collection; contact: local-research)"
)
REQUEST_INTERVAL_S = 1.0
TIMEOUT_S = 12.0
MAX_URLS_PER_SOURCE = 200
MAX_SITEMAPS = 4
MAX_XML_BYTES = 5_000_000
ADAPTERS_DIR = ROOT / "adapters"
RAW_DIR = DATA_DIR / "raw"
HOMEPAGE_DIR = DATA_DIR / "homepages"
SITEMAP_GUESSES = (
    "/sitemap.xml",
    "/sitemap_index.xml",
    "/sitemap-index.xml",
    "/sitemap_news.xml",
    "/news-sitemap.xml",
)
DEFAULT_FEED_PATHS = ("/feed", "/rss", "/rss.xml", "/atom.xml")


def load_adapter(source_id: str) -> dict[str, Any]:
    path = ADAPTERS_DIR / f"{source_id}.json"
    if not path.exists():
        path = ADAPTERS_DIR / "_default.json"
    return json.loads(path.read_text(encoding="utf-8"))


def _append_jsonl(path: Path, row: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(row, ensure_ascii=False) + "\n")


class PoliteClient:
    def __init__(self) -> None:
        self._last: dict[str, float] = {}
        self.client = httpx.Client(
            headers={"User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml,*/*;q=0.8"},
            follow_redirects=True,
            timeout=TIMEOUT_S,
        )

    def close(self) -> None:
        self.client.close()

    def get(self, url: str) -> httpx.Response | None:
        host = urlparse(url).hostname or ""
        wait = REQUEST_INTERVAL_S - (time.monotonic() - self._last.get(host, 0.0))
        if wait > 0:
            time.sleep(wait)
        last_error = "unknown"
        for attempt in range(2):
            try:
                response = self.client.get(url)
                self._last[host] = time.monotonic()
                if response.status_code in {429, 500, 502, 503, 504} and attempt == 0:
                    time.sleep(1)
                    continue
                return response
            except httpx.HTTPError as exc:
                last_error = str(exc)
                self._last[host] = time.monotonic()
                if attempt == 0:
                    time.sleep(1)
                    continue
        _append_jsonl(
            DATA_DIR / "fetches.jsonl",
            {
                "url": url,
                "error": last_error,
                "status": "fetch_failed",
                "fetched_at": datetime.now(timezone.utc).isoformat(),
            },
        )
        return None


def _cutoff() -> datetime:
    return datetime.now(timezone.utc) - timedelta(days=LOOKBACK_DAYS)


def _parse_lastmod(value: str | None) -> datetime | None:
    if not value:
        return None
    text = value.strip()
    if not text:
        return None
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed
    except ValueError:
        pass
    try:
        parsed = parsedate_to_datetime(text)
        if parsed is not None:
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            return parsed
    except (TypeError, ValueError, IndexError, OverflowError):
        pass
    if len(text) >= 10 and text[4] == "-" and text[7] == "-":
        try:
            return datetime.fromisoformat(text[:10]).replace(tzinfo=timezone.utc)
        except ValueError:
            return None
    return None


def _xml_local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1].lower()


def _body_text(response: httpx.Response) -> str:
    raw = response.content[:MAX_XML_BYTES]
    if raw[:2] == b"\x1f\x8b":
        try:
            raw = gzip.decompress(raw)
        except gzip.BadGzipFile:
            return ""
    encoding = response.encoding or "utf-8"
    return raw.decode(encoding, errors="ignore")


def parse_sitemap(text: str) -> tuple[list[tuple[str, str | None]], list[tuple[str, str | None]]]:
    """Return (child sitemaps, page urls) as (loc, lastmod) pairs."""
    sample = text.lstrip()[:800].lower()
    if not sample or "<html" in sample:
        return [], []
    if "<urlset" not in sample and "<sitemapindex" not in sample and "<url>" not in sample:
        return [], []
    try:
        root = ElementTree.fromstring(text)
    except ElementTree.ParseError:
        return [], []
    children: list[tuple[str, str | None]] = []
    pages: list[tuple[str, str | None]] = []
    for node in root.iter():
        name = _xml_local(node.tag)
        if name not in {"sitemap", "url"}:
            continue
        loc = None
        lastmod = None
        for child in list(node):
            child_name = _xml_local(child.tag)
            if child_name == "loc" and child.text:
                loc = child.text.strip()
            elif child_name == "lastmod" and child.text:
                lastmod = child.text.strip()
        if not loc:
            continue
        if name == "sitemap" or loc.lower().split("?", 1)[0].endswith((".xml", ".xml.gz")):
            children.append((loc, lastmod))
        else:
            pages.append((loc, lastmod))
    return children, pages


def parse_feed(text: str) -> list[tuple[str, str | None]]:
    sample = text.lstrip()[:300].lower()
    if not sample or "<html" in sample or ("<rss" not in sample and "<feed" not in sample and "<item" not in sample):
        return []
    try:
        root = ElementTree.fromstring(text)
    except ElementTree.ParseError:
        return []
    items: list[tuple[str, str | None]] = []
    for node in root.iter():
        name = _xml_local(node.tag)
        if name not in {"item", "entry"}:
            continue
        link = None
        when = None
        for child in list(node):
            child_name = _xml_local(child.tag)
            if child_name == "link":
                href = (child.get("href") or "").strip()
                if href:
                    link = href
                elif child.text and child.text.strip().startswith(("http://", "https://")):
                    link = child.text.strip()
            elif child_name in {"pubdate", "published", "date"} and child.text:
                when = child.text.strip()
            elif child_name == "updated" and child.text and when is None:
                when = child.text.strip()
            elif child_name == "guid" and child.text and child.text.strip().startswith(("http://", "https://")):
                link = link or child.text.strip()
        if link:
            items.append((link, when))
    return items


def _ok_urls() -> set[str]:
    path = DATA_DIR / "fetches.jsonl"
    found: set[str] = set()
    if not path.exists():
        return found
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        try:
            row = json.loads(line)
        except json.JSONDecodeError:
            continue
        if row.get("status") != "ok":
            continue
        for key in ("url", "final_url"):
            if row.get(key):
                found.add(normalize_url(row[key]))
    return found


def discover_urls(client: PoliteClient, target: dict[str, Any], limit: int = MAX_URLS_PER_SOURCE) -> list[str]:
    adapter = load_adapter(target["source_id"])
    base = f"https://{target['host']}"
    path = target.get("path") or "/"
    start = urljoin(base, path)
    path_re = adapter.get("article_path_re")
    prefix = (target.get("path") or "/").rstrip("/")
    dated: list[tuple[datetime, str]] = []
    undated: list[str] = []
    seen: set[str] = set()
    cutoff = _cutoff()

    def full() -> bool:
        return len(dated) + len(undated) >= limit

    def consider(url: str, lastmod: str | None = None, *, allow_undated: bool = True) -> None:
        url = normalize_url(urljoin(start, url))
        if not url or url in seen or full():
            return
        host = urlparse(url).hostname or ""
        if host not in {target["host"], f"www.{target['host']}"}:
            return
        if prefix:
            article_path = urlparse(url).path or "/"
            if article_path != prefix and not article_path.startswith(prefix + "/"):
                return
        if not looks_like_article_url(url, path_re):
            return
        published = _parse_lastmod(lastmod)
        if published is None:
            parts = url_published_at(url)
            if parts:
                published = datetime(*parts, tzinfo=timezone.utc)
        if published is not None and published < cutoff:
            return
        if published is None and not allow_undated:
            return
        seen.add(url)
        if published is None:
            undated.append(url)
        else:
            dated.append((published, url))

    sitemap_locs = [urljoin(base, guess) for guess in SITEMAP_GUESSES]
    robots = client.get(urljoin(base, "/robots.txt"))
    if robots is not None and robots.status_code < 400:
        for line in robots.text.splitlines():
            if line.lower().startswith("sitemap:"):
                sitemap_locs.append(line.split(":", 1)[1].strip())

    seen_sitemaps: set[str] = set()
    queue = list(dict.fromkeys(sitemap_locs))
    fetched_sitemaps = 0
    while queue and fetched_sitemaps < MAX_SITEMAPS and not full():
        sitemap_url = queue.pop(0)
        if sitemap_url in seen_sitemaps:
            continue
        seen_sitemaps.add(sitemap_url)
        response = client.get(sitemap_url)
        fetched_sitemaps += 1
        if response is None or response.status_code >= 400:
            continue
        children, pages = parse_sitemap(_body_text(response))
        for loc, lastmod in pages:
            consider(loc, lastmod, allow_undated=False)
            if full():
                break
        news = [item for item in children if "news" in item[0].lower()]
        rest = [item for item in children if item not in news]
        news.sort(
            key=lambda item: _parse_lastmod(item[1]) or datetime.min.replace(tzinfo=timezone.utc),
            reverse=True,
        )
        queue = [item[0] for item in news if item[0] not in seen_sitemaps] + queue + [
            item[0] for item in rest if item[0] not in seen_sitemaps
        ]

    feed_paths = list(adapter.get("feed_paths") or [])
    for feed_path in DEFAULT_FEED_PATHS:
        if feed_path not in feed_paths:
            feed_paths.append(feed_path)
    seen_feeds: set[str] = set()

    def consume_feed(feed_url: str) -> None:
        feed_url = normalize_url(urljoin(base, feed_url))
        if not feed_url or feed_url in seen_feeds or full():
            return
        seen_feeds.add(feed_url)
        response = client.get(feed_url)
        if response is None or response.status_code >= 400:
            return
        for href, when in parse_feed(_body_text(response)):
            consider(href, when, allow_undated=True)
            if full():
                return

    for feed_path in feed_paths:
        consume_feed(urljoin(base, feed_path))

    homepage_paths = adapter.get("homepage_paths") or ["/"]
    saved_homepage = False
    if not full():
        for homepage_path in homepage_paths:
            page_url = urljoin(base, homepage_path)
            response = client.get(page_url)
            if response is None:
                continue
            HOMEPAGE_DIR.mkdir(parents=True, exist_ok=True)
            page_path = HOMEPAGE_DIR / f"{target['source_id']}__{target['host']}.html"
            if not saved_homepage and response.status_code < 400 and not _looks_like_block_page(response):
                page_path.write_bytes(response.content[:MAX_XML_BYTES])
                saved_homepage = True
            if response.status_code >= 400 or _looks_like_block_page(response):
                _append_jsonl(
                    DATA_DIR / "discovery.jsonl",
                    {
                        "host": target["host"],
                        "source_id": target["source_id"],
                        "stage": "homepage",
                        "status": "unreachable" if response.status_code >= 400 else "block_page",
                        "http_status": response.status_code,
                        "homepage_path": str(page_path),
                    },
                )
                continue
            try:
                tree = lxml_html.fromstring(response.content)
            except Exception:
                continue
            tree.make_links_absolute(str(response.url))
            for href in tree.xpath(
                "//link[contains(@rel,'alternate') and (contains(@type,'rss') or contains(@type,'atom'))]/@href"
            ):
                consume_feed(str(href))
            for href in tree.xpath("//a/@href"):
                consider(str(href), allow_undated=True)
                if full():
                    break

    dated.sort(key=lambda item: item[0], reverse=True)
    found = [url for _, url in dated] + undated
    found = found[:limit]
    if not found:
        _append_jsonl(
            DATA_DIR / "discovery.jsonl",
            {
                "host": target["host"],
                "source_id": target["source_id"],
                "stage": "all",
                "status": "empty",
                "note": "Inspect saved homepage and add or edit adapters/{source_id}.json",
                "homepage_saved": saved_homepage,
            },
        )
    return found


def _looks_like_block_page(response: httpx.Response) -> bool:
    text = response.text[:4000].lower()
    needles = ("access denied", "just a moment", "cf-challenge", "captcha", "dns-sperre")
    return any(needle in text for needle in needles) and len(response.text) < 8000


def fetch_article(client: PoliteClient, url: str, source_id: str) -> Path | None:
    response = client.get(url)
    fetched_at = datetime.now(timezone.utc).isoformat()
    if response is None:
        return None
    digest = sha256_text(normalize_url(str(response.url)))
    raw_path = RAW_DIR / source_id / f"{digest}.html"
    raw_path.parent.mkdir(parents=True, exist_ok=True)
    if response.status_code == 200 and response.content:
        raw_path.write_bytes(response.content)
    _append_jsonl(
        DATA_DIR / "fetches.jsonl",
        {
            "url": url,
            "final_url": str(response.url),
            "source_id": source_id,
            "http_status": response.status_code,
            "fetched_at": fetched_at,
            "raw_path": str(raw_path) if response.status_code == 200 else None,
            "status": "ok" if response.status_code == 200 else "fetch_failed",
        },
    )
    if response.status_code != 200:
        return None
    return raw_path


def crawl(mvp_only: bool = True, max_per_source: int | None = None) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    targets = expand_targets(mvp_only=mvp_only)
    cap = max_per_source or MAX_URLS_PER_SOURCE
    already_ok = _ok_urls()
    client = PoliteClient()
    grouped: dict[str, list[dict[str, Any]]] = {}
    for target in targets:
        grouped.setdefault(target["source_id"], []).append(target)
    try:
        for source_id, hosts in grouped.items():
            saved = list((RAW_DIR / source_id).glob("*.html")) if (RAW_DIR / source_id).exists() else []
            remaining = cap - len(saved)
            if remaining <= 0:
                print(f"{source_id}: already have {len(saved)} pages", flush=True)
                continue
            for target in hosts:
                urls = discover_urls(client, target, limit=cap)
                fresh = [url for url in urls if normalize_url(url) not in already_ok][:remaining]
                _append_jsonl(
                    DATA_DIR / "discovery.jsonl",
                    {
                        "host": target["host"],
                        "source_id": source_id,
                        "stage": "summary",
                        "url_count": len(fresh),
                        "discovered": len(urls),
                    },
                )
                print(
                    f"{source_id} {target['host']}: {len(fresh)} new / {len(urls)} discovered",
                    flush=True,
                )
                if not fresh:
                    continue
                for url in fresh:
                    fetch_article(client, url, source_id)
                    already_ok.add(normalize_url(url))
                break
    finally:
        client.close()


def fetch_citations(max_urls: int = 24) -> int:
    """Fetch catalogue article URLs cited in already extracted bodies."""
    from extract import load_articles

    articles = load_articles()
    client = PoliteClient()
    seen: set[str] = set()
    fetched = 0
    try:
        for article in articles:
            for link in article.get("outbound_links") or []:
                source_id = link.get("resolved_source_id")
                if not source_id or source_id == article.get("source_id"):
                    continue
                url = normalize_url(link.get("url") or "")
                if not url or url in seen or not looks_like_article_url(url):
                    continue
                seen.add(url)
                fetch_article(client, url, source_id)
                fetched += 1
                if fetched >= max_urls:
                    return fetched
    finally:
        client.close()
    return fetched


def main() -> None:
    parser = argparse.ArgumentParser(description="Discover and fetch catalogue articles")
    parser.add_argument("--all", action="store_true", help="Crawl every expandable host, not only the MVP slice")
    parser.add_argument("--max-per-source", type=int, default=MAX_URLS_PER_SOURCE)
    parser.add_argument("--citations", action="store_true", help="Fetch article URLs cited by extracted bodies")
    args = parser.parse_args()
    if args.citations:
        print(f"fetched {fetch_citations()} cited articles")
        return
    crawl(mvp_only=not args.all, max_per_source=args.max_per_source)


if __name__ == "__main__":
    main()
