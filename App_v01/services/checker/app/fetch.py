import re
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup

from app.models import FetchResult

USER_AGENT = "EU-Disinfo-Checker-Hackathon/0.1 (+research; contact: team@example.com)"
MAX_BODY_BYTES = 1_500_000


def extract_text(html: str) -> tuple[str | None, str | None]:
    soup = BeautifulSoup(html, "html.parser")
    title = soup.title.string.strip() if soup.title and soup.title.string else None
    for tag in soup(["script", "style", "noscript"]):
        tag.decompose()
    paragraphs = [p.get_text(" ", strip=True) for p in soup.find_all("p")]
    text = " ".join(p for p in paragraphs if len(p) > 40)
    if not text:
        text = soup.get_text(" ", strip=True)
    text = re.sub(r"\s+", " ", text).strip()
    return title, text[:8000] if text else None


def outbound_domains(html: str, base_url: str) -> list[str]:
    soup = BeautifulSoup(html, "html.parser")
    found: set[str] = set()
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if href.startswith(("mailto:", "javascript:", "#")):
            continue
        parsed = urlparse(str(httpx.URL(base_url).join(href)))
        if parsed.hostname:
            found.add(parsed.hostname.lower())
    return sorted(found)


async def fetch_url(url: str, follow_redirects: bool = True, max_redirects: int = 5) -> tuple[str, list[str], FetchResult]:
    chain: list[str] = [url]
    try:
        async with httpx.AsyncClient(
            follow_redirects=follow_redirects,
            max_redirects=max_redirects,
            timeout=httpx.Timeout(12.0),
            headers={"User-Agent": USER_AGENT},
        ) as client:
            resp = await client.get(url)
            final = str(resp.url)
            if final not in chain:
                chain.append(final)
            if resp.status_code >= 400:
                return final, chain, FetchResult(
                    status="error",
                    http_status=resp.status_code,
                )
            content_type = resp.headers.get("content-type", "")
            if "html" not in content_type and "text" not in content_type:
                return final, chain, FetchResult(
                    status="ok",
                    http_status=resp.status_code,
                )
            raw = resp.content[:MAX_BODY_BYTES]
            html = raw.decode(resp.encoding or "utf-8", errors="replace")
            title, text = extract_text(html)
            domains = outbound_domains(html, final)
            excerpt = text[:500] if text else None
            return final, chain, FetchResult(
                status="ok",
                http_status=resp.status_code,
                title=title,
                text_excerpt=excerpt,
                outbound_domains=domains,
            )
    except httpx.TimeoutException:
        return url, chain, FetchResult(status="timeout")
    except httpx.TooManyRedirects:
        return url, chain, FetchResult(status="error")
    except httpx.HTTPError:
        return url, chain, FetchResult(status="error")
