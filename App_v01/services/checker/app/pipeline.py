import re
from datetime import datetime, timezone

from app.config import CHECKER_VERSION
from app.fetch import fetch_url
from app.models import CheckReport, EuContext, EuResourceLink, FetchResult, ReportMeta, Signal
from app.seeds import (
    hostname_from_url,
    load_eu_resources,
    load_eu_topics,
    load_hostname_patterns,
    load_source_media,
    match_registry,
    seed_versions,
)


def verdict_band(score: int) -> str:
    if score >= 75:
        return "severe"
    if score >= 50:
        return "high"
    if score >= 25:
        return "review"
    return "low"


def signal_hostname_patterns(host: str) -> list[Signal]:
    signals: list[Signal] = []
    for pat in load_hostname_patterns():
        if re.match(pat["regex"], host):
            signals.append(
                Signal(
                    id=pat["id"],
                    weight=int(pat.get("weight", 20)),
                    summary=pat.get("summary", "Hostname pattern match"),
                    evidence={"hostname": host, "regex": pat["regex"]},
                )
            )
    return signals


def signal_registry(host: str) -> list[Signal]:
    hits = match_registry(host)
    if not hits:
        return []
    best = max(hits, key=lambda h: h.get("confidence", 0))
    return [
        Signal(
            id="registry_hit",
            weight=40,
            summary=f"Domain matches curated list ({best.get('category', 'flagged')})",
            evidence={
                "domain": host,
                "category": best.get("category"),
                "network": best.get("network"),
                "confidence": best.get("confidence"),
                "source": best.get("source"),
            },
        )
    ]


def signal_source_lineage(outbound: list[str]) -> list[Signal]:
    flagged = sorted(set(outbound) & load_source_media())
    if not flagged:
        return []
    return [
        Signal(
            id="source_lineage",
            weight=min(15 + 5 * len(flagged), 35),
            summary="Page links to commonly monitored state/proxy media domains",
            evidence={"domains": flagged},
        )
    ]


def signal_eu_topics(text: str | None) -> tuple[list[Signal], list[str]]:
    if not text:
        return [], []
    lower = text.lower()
    tags: list[str] = []
    for item in load_eu_topics().get("tags", []):
        if any(kw in lower for kw in item.get("keywords", [])):
            tags.append(item["id"])
    if not tags:
        return [], []
    return [
        Signal(
            id="eu_topic_match",
            weight=min(5 * len(tags), 20),
            summary="Content matches EU-relevant disinformation topic keywords",
            evidence={"tags": tags},
        )
    ], tags


def infer_eu_targets(host: str, topic_tags: list[str]) -> list[str]:
    targets: list[str] = []
    # Subdomain keyword heuristic (Portal Kombat style + generic ccTLD)
    parts = host.split(".")
    if len(parts) >= 3 and parts[-2] == "news-pravda":
        targets.append(parts[0].upper()[:2] if len(parts[0]) == 2 else "EU")
    tld = parts[-1]
    eu_cc = {
        "fr", "de", "it", "es", "pl", "nl", "be", "at", "se", "fi", "dk", "ie", "pt", "gr", "ro", "bg", "hr", "sk", "si", "lt", "lv", "ee", "cy", "mt", "lu", "cz", "hu"
    }
    if tld in eu_cc:
        targets.append(tld.upper())
    if topic_tags and "EU" not in targets:
        targets.append("EU")
    return list(dict.fromkeys(targets))


def eu_resources_for(targets: list[str]) -> list[EuResourceLink]:
    data = load_eu_resources()
    links: list[EuResourceLink] = []
    for item in data.get("default", []):
        links.append(EuResourceLink(country=item.get("country"), label=item["label"], url=item["url"]))
    for t in targets:
        for item in data.get("by_country", {}).get(t, []):
            links.append(EuResourceLink(country=t, label=item["label"], url=item["url"]))
    # dedupe by url
    seen: set[str] = set()
    unique: list[EuResourceLink] = []
    for link in links:
        if link.url in seen:
            continue
        seen.add(link.url)
        unique.append(link)
    return unique


async def run_check(url: str, options: dict | None = None) -> CheckReport:
    options = options or {}
    follow = options.get("follow_redirects", True)
    max_redir = int(options.get("max_redirects", 5))

    input_url = str(url)
    final_url, chain, fetch = await fetch_url(input_url, follow_redirects=follow, max_redirects=max_redir)
    host = hostname_from_url(final_url)

    signals: list[Signal] = []
    signals.extend(signal_registry(host))
    signals.extend(signal_hostname_patterns(host))
    signals.extend(signal_source_lineage(fetch.outbound_domains))
    topic_signal, topic_tags = signal_eu_topics(fetch.text_excerpt)
    signals.extend(topic_signal)

    score = min(sum(s.weight for s in signals), 100)
    targets = infer_eu_targets(host, topic_tags)
    eu_context = EuContext(
        inferred_targets=targets,
        topic_tags=topic_tags,
        resources=eu_resources_for(targets),
    )

    now = datetime.now(timezone.utc).isoformat()
    return CheckReport(
        input_url=input_url,
        final_url=final_url,
        redirect_chain=chain,
        fetch=fetch,
        score=score,
        verdict_band=verdict_band(score),
        signals=signals,
        eu_context=eu_context,
        meta=ReportMeta(
            checker_version=CHECKER_VERSION,
            seed_versions=seed_versions(),
            generated_at=now,
        ),
    )
