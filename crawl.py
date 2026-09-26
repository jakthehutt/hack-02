"""Discover and politely fetch article HTML from catalogue targets."""

from __future__ import annotations

import argparse
import json
import re
import time
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeout
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Callable
from urllib.parse import urljoin, urlparse

import httpx
from lxml import html as lxml_html

from catalogue import DATA_DIR, ROOT, expand_targets
from urls import looks_like_article_url, normalize_url, sha256_text

USER_AGENT = (
    "NarrativePropagationResearch/0.1 "
    "(academic corpus collection; contact: local-research)"
)
REQUEST_INTERVAL_S = 1.0
TIMEOUT_S = 20.0
MAX_URLS_PER_SOURCE = 200
LOOKBACK_DAYS = 14
ADAPTERS_DIR = ROOT / "adapters"
RAW_DIR = DATA_DIR / "raw"
HOMEPAGE_DIR = DATA_DIR / "homepages"

LASTMOD_RE = re.compile(r"(\d{4}-\d{2}-\d{2})")
DISCOVERY_TIMEOUT_S = 25.0


def _run_with_timeout(fn: Callable, timeout: float, *args: Any, **kwargs: Any) -> Any:
    with ThreadPoolExecutor(max_workers=1) as pool:
        future = pool.submit(fn, *args, **kwargs)
        return future.result(timeout=timeout)


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
        for attempt in range(3):
            try:
                response = self.client.get(url)
                self._last[host] = time.monotonic()
                if response.status_code in {429, 500, 502, 503, 504} and attempt < 2:
                    time.sleep(2 ** attempt)
                    continue
                return response
            except httpx.HTTPError as exc:
                self._last[host] = time.monotonic()
                if attempt == 2:
                    _append_jsonl(
                        DATA_DIR / "fetches.jsonl",
                        {
                            "url": url,
                            "error": str(exc),
                            "status": "fetch_failed",
                            "fetched_at": datetime.now(timezone.utc).isoformat(),
                        },
                    )
                    return None
                time.sleep(2 ** attempt)
        return None


def _cutoff() -> datetime:
    return datetime.now(timezone.utc) - timedelta(days=LOOKBACK_DAYS)


def _parse_lastmod(value: str | None) -> datetime | None:
    if not value:
        return None
    match = LASTMOD_RE.search(value)
    if not match:
        return None
    try:
        return datetime.fromisoformat(match.group(1)).replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def discover_urls(client: PoliteClient, target: dict[str, Any]) -> list[str]:
    adapter = load_adapter(target["source_id"])
    base = f"https://{target['host']}"
    path = target.get("path") or "/"
    start = urljoin(base, path)
    path_re = adapter.get("article_path_re")
    found: list[str] = []
    seen: set[str] = set()
    cutoff = _cutoff()

    def consider(url: str, lastmod: str | None = None) -> None:
        url = normalize_url(urljoin(start, url))
        if not url or url in seen:
            return
        if urlparse(url).hostname not in {target["host"], f"www.{target['host']}"}:
            return
        if not looks_like_article_url(url, path_re):
            return
        lastmod_dt = _parse_lastmod(lastmod)
        if lastmod_dt and lastmod_dt < cutoff:
            return
        seen.add(url)
        found.append(url)

    from trafilatura.sitemaps import sitemap_search
    from trafilatura.feeds import find_feed_urls

    try:
        sitemap_urls = _run_with_timeout(
            sitemap_search,
            DISCOVERY_TIMEOUT_S,
            start,
            sleep_time=0.4,
            max_sitemaps=4,
        ) or []
        for item in sitemap_urls:
            if isinstance(item, str):
                consider(item)
            elif isinstance(item, (tuple, list)) and item:
                consider(item[0], item[1] if len(item) > 1 else None)
            if len(found) >= MAX_URLS_PER_SOURCE:
                return found[:MAX_URLS_PER_SOURCE]
    except (Exception, FuturesTimeout) as exc:
        _append_jsonl(
            DATA_DIR / "discovery.jsonl",
            {"host": target["host"], "stage": "sitemap", "error": str(exc)},
        )

    try:
        feed_urls = _run_with_timeout(find_feed_urls, DISCOVERY_TIMEOUT_S, start) or []
        for feed_url in feed_urls:
            response = client.get(feed_url)
            if response is None or response.status_code >= 400:
                continue
            for href in re.findall(r"<link[^>]+href=['\"]([^'\"]+)['\"]", response.text, re.I):
                consider(href)
            for href in re.findall(r"<guid[^>]*>([^<]+)</guid>", response.text, re.I):
                consider(href)
            if len(found) >= MAX_URLS_PER_SOURCE:
                return found[:MAX_URLS_PER_SOURCE]
    except (Exception, FuturesTimeout) as exc:
        _append_jsonl(
            DATA_DIR / "discovery.jsonl",
            {"host": target["host"], "stage": "feed", "error": str(exc)},
        )

    homepage_paths = adapter.get("homepage_paths") or ["/"]
    saved_homepage = False
    for homepage_path in homepage_paths:
        page_url = urljoin(base, homepage_path)
        response = client.get(page_url)
        if response is None:
            continue
        HOMEPAGE_DIR.mkdir(parents=True, exist_ok=True)
        if not saved_homepage:
            (HOMEPAGE_DIR / f"{target['source_id']}__{target['host']}.html").write_bytes(response.content)
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
                    "homepage_path": str(HOMEPAGE_DIR / f"{target['source_id']}__{target['host']}.html"),
                },
            )
            continue
        try:
            tree = lxml_html.fromstring(response.content)
        except Exception:
            continue
        tree.make_links_absolute(str(response.url))
        for href in tree.xpath("//a/@href"):
            consider(str(href))
            if len(found) >= MAX_URLS_PER_SOURCE:
                return found[:MAX_URLS_PER_SOURCE]

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
    return found[:MAX_URLS_PER_SOURCE]


def _looks_like_block_page(response: httpx.Response) -> bool:
    text = response.text[:4000].lower()
    needles = ("access denied", "just a moment", "cf-challenge", "captcha", "dns-sperre")
    return any(n in text for n in needles) and len(response.text) < 8000


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
    client = PoliteClient()
    per_source: dict[str, int] = {}
    grouped: dict[str, list[dict[str, Any]]] = {}
    for target in targets:
        grouped.setdefault(target["source_id"], []).append(target)
    try:
        for source_id, hosts in grouped.items():
            remaining = cap - per_source.get(source_id, 0)
            if remaining <= 0:
                continue
            for target in hosts:
                urls = discover_urls(client, target)[:remaining]
                _append_jsonl(
                    DATA_DIR / "discovery.jsonl",
                    {
                        "host": target["host"],
                        "source_id": source_id,
                        "stage": "summary",
                        "url_count": len(urls),
                    },
                )
                if not urls:
                    continue
                for url in urls:
                    fetch_article(client, url, source_id)
                    per_source[source_id] = per_source.get(source_id, 0) + 1
                break
    finally:
        client.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Discover and fetch catalogue articles")
    parser.add_argument("--all", action="store_true", help="Crawl every expandable host, not only the MVP slice")
    parser.add_argument("--max-per-source", type=int, default=MAX_URLS_PER_SOURCE)
    args = parser.parse_args()
    crawl(mvp_only=not args.all, max_per_source=args.max_per_source)


if __name__ == "__main__":
    main()
