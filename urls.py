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
    "ref",
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


URL_DATE_RE = re.compile(
    r"/(20\d{2})(?:[/-](\d{1,2})[/-](\d{1,2})|(\d{2})(\d{2}))(?:/|-|$)"
)

ARTICLE_PATH_HINT = re.compile(
    r"/(20\d{2}|news|artikel|article|story|politik|welt|meinung|"
    r"nachrichten|debatte|kommentar|video|wirtschaft|sport|"
    r"international|gesellschaft|europa|russland|ukraine)/",
    re.I,
)

LIST_PATH_HINT = re.compile(
    r"/(tag|tags|category|kategorie|author|autor|page|seite|search|suche|"
    r"feed|rss|sitemap|about|contacts?|kontakt\w*|impressum|newsletter|"
    r"unterstuetzen)(/|$)",
    re.I,
)
DATE_ONLY_PATH = re.compile(r"^/20\d{2}(?:\d{4}|/\d{1,2}/\d{1,2})$")


def usable_path_re(path_re: str | None) -> str | None:
    """Ignore placeholder patterns that match every path."""
    if path_re is None:
        return None
    text = path_re.strip()
    if text in {"", "/", ".*", "^/", "^.*$", "^/$"}:
        return None
    return text


def url_published_at(url: str) -> tuple[int, int, int] | None:
    match = URL_DATE_RE.search(urlparse(url).path or "")
    if not match:
        return None
    year = int(match.group(1))
    if match.group(2):
        month, day = int(match.group(2)), int(match.group(3))
    else:
        month, day = int(match.group(4)), int(match.group(5))
    try:
        if not (1 <= month <= 12 and 1 <= day <= 31):
            return None
    except ValueError:
        return None
    return year, month, day


def looks_like_article_url(url: str, path_re: str | None = None) -> bool:
    parsed = urlparse(url)
    path = parsed.path or "/"
    if path in {"", "/"}:
        return False
    if DATE_ONLY_PATH.fullmatch(path):
        return False
    parts = [p for p in path.split("/") if p]
    if LIST_PATH_HINT.search(path):
        return False
    if parts and parts[-1].lower() in {"ueber-uns", "ueber-anti-spiegel", "kontaktformular"}:
        return False
    suffix = path.rsplit(".", 1)[-1].lower() if "." in path.split("/")[-1] else ""
    if suffix in {"xml", "jpg", "jpeg", "png", "gif", "webp", "css", "js", "pdf", "zip", "mp3", "mp4"}:
        return False
    pattern = usable_path_re(path_re)
    if pattern and re.search(pattern, path):
        return True
    if ARTICLE_PATH_HINT.search(path):
        return True
    if url_published_at(url):
        return True
    parts = [p for p in path.split("/") if p]
    if len(parts) >= 2 and re.search(r"\d", parts[-1]):
        return True
    slug = parts[-1] if parts else ""
    return "-" in slug and len(slug) >= 16
