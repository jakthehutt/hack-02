"""URL normalization and catalogue host indexing."""

from __future__ import annotations

import hashlib
import re
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

TRACKING_PARAMS = {
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "fbclid",
    "gclid",
    "mc_cid",
    "mc_eid",
    "yclid",
    "igshid",
    "_ga",
}


def normalize_host(host: str | None) -> str:
    if not host:
        return ""
    host = host.strip().lower()
    if host.startswith("www."):
        host = host[4:]
    return host.rstrip(".")


def normalize_url(url: str) -> str:
    raw = (url or "").strip()
    if not raw:
        return ""
    if raw.startswith("//"):
        raw = "https:" + raw
    parsed = urlparse(raw)
    scheme = parsed.scheme.lower() if parsed.scheme else "https"
    if scheme not in {"http", "https"}:
        return raw
    host = normalize_host(parsed.hostname or parsed.netloc)
    path = parsed.path or "/"
    if path != "/" and path.endswith("/"):
        path = path.rstrip("/")
    query_pairs = [
        (k, v)
        for k, v in parse_qsl(parsed.query, keep_blank_values=True)
        if k.lower() not in TRACKING_PARAMS
    ]
    query = urlencode(sorted(query_pairs), doseq=True)
    return urlunparse((scheme, host, path, "", query, ""))


def article_id_for(url: str) -> str:
    return hashlib.sha256(normalize_url(url).encode("utf-8")).hexdigest()


def sha256_text(text: str) -> str:
    return hashlib.sha256((text or "").encode("utf-8")).hexdigest()


def host_from_url(url: str) -> str:
    return normalize_host(urlparse(url).hostname)


ARTICLE_PATH_HINT = re.compile(
    r"/(20\d{2}|news|artikel|article|story|politik|welt|meinung|"
    r"nachrichten|debatte|kommentar|video|wirtschaft|sport)/",
    re.I,
)

LIST_PATH_HINT = re.compile(
    r"/(tag|tags|category|kategorie|author|autor|page|seite|search|suche|"
    r"feed|rss|sitemap)(/|$)",
    re.I,
)


def looks_like_article_url(url: str, path_re: str | None = None) -> bool:
    parsed = urlparse(url)
    path = parsed.path or "/"
    if path in {"", "/"}:
        return False
    if LIST_PATH_HINT.search(path):
        return False
    suffix = path.rsplit(".", 1)[-1].lower() if "." in path.split("/")[-1] else ""
    if suffix in {"xml", "jpg", "jpeg", "png", "gif", "css", "js", "pdf", "zip"}:
        return False
    if path_re and re.search(path_re, path):
        return True
    if ARTICLE_PATH_HINT.search(path):
        return True
    parts = [p for p in path.split("/") if p]
    if len(parts) >= 2:
        return True
    slug = parts[-1] if parts else ""
    return len(slug) >= 16
