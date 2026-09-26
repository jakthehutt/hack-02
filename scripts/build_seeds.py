"""Build checker seed JSON from sources.json plus EU topic/resource lists."""

from __future__ import annotations

import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOGUE = ROOT / "sources.json"
SEEDS = ROOT / "data" / "seeds"

VERSION = "2026-09-26"

# Apex hosts that should match subdomains (Portal Kombat / Pravda, RRN).
SUFFIX_HOSTS = {
    "news-pravda.com",
    "rrn.media",
}


def _hosts_for(entry: dict) -> list[tuple[str, str]]:
    rows: list[tuple[str, str]] = []
    for domain in entry.get("domains") or []:
        host = (domain.get("host") or "").lower().strip()
        if not host:
            continue
        rows.append((host, domain.get("role") or "unknown"))
        for alias in domain.get("aliases") or []:
            alias_host = (alias or "").lower().strip()
            if alias_host:
                rows.append((alias_host, "alias"))
    return rows


def registry_entries(catalogue: dict) -> list[dict]:
    entries: list[dict] = []
    seen: set[str] = set()
    for rank_block in catalogue.get("ranks", []):
        rank = int(rank_block["rank"])
        if rank not in {1, 2}:
            continue
        category = "state_media" if rank == 1 else "known_io_domain"
        for entry in rank_block.get("entries", []):
            if rank == 1 and entry.get("control") == "official_diplomatic":
                category_here = "official"
            else:
                category_here = category
            for host, role in _hosts_for(entry):
                if host in seen:
                    continue
                seen.add(host)
                match = "suffix" if host in SUFFIX_HOSTS else "exact"
                entries.append(
                    {
                        "domain": host,
                        "match": match,
                        "category": category_here,
                        "network": entry["id"],
                        "confidence": 0.95 if rank == 1 else 0.85,
                        "source": "sources.json",
                        "role": role,
                    }
                )
    return entries


def source_media_domains(catalogue: dict) -> list[str]:
    hosts: set[str] = set()
    extra = {
        "rt.com",
        "sputniknews.com",
        "tass.com",
        "ria.ru",
        "tsargrad.tv",
        "snanews.de",
        "news-front.info",
        "news-front.su",
        "rrn.media",
    }
    hosts |= extra
    for rank_block in catalogue.get("ranks", []):
        rank = int(rank_block["rank"])
        if rank > 3:
            continue
        for entry in rank_block.get("entries", []):
            for host, _role in _hosts_for(entry):
                hosts.add(host)
    return sorted(hosts)


def eu_topics() -> dict:
    return {
        "version": VERSION,
        "disclaimer": "Keyword tags are topical, not a finding that the page is false.",
        "tags": [
            {
                "id": "ukraine_war",
                "keywords": [
                    "ukraine",
                    "ukrain",
                    "donbas",
                    "donbass",
                    "kiewer regime",
                    "kiev regime",
                    "zelensky",
                    "selenskyj",
                ],
            },
            {
                "id": "nord_stream",
                "keywords": ["nord stream", "nordstream", "nord-stream"],
            },
            {
                "id": "energy_sanctions",
                "keywords": [
                    "deindustrial",
                    "sanktionen",
                    "sanctions",
                    "gaspreis",
                    "energiekrise",
                ],
            },
            {
                "id": "migration",
                "keywords": ["migration", "asyl", "flüchtling", "refugee", "grenz"],
            },
            {
                "id": "elections",
                "keywords": [
                    "wahl",
                    "election",
                    "afd-verbot",
                    "verbotsverfahren",
                    "beobachter",
                    "wahlfälschung",
                ],
            },
            {
                "id": "hormuz",
                "keywords": ["hormus", "hormuz", "straße von hormus", "strait of hormuz"],
            },
            {
                "id": "nato_proxy",
                "keywords": [
                    "stellvertreterkrieg",
                    "vasallen",
                    "nato",
                    "proxy war",
                ],
            },
            {
                "id": "russophobia",
                "keywords": ["russophob", "russlandfeind", "russlandhass"],
            },
        ],
    }


def eu_resources() -> dict:
    return {
        "version": VERSION,
        "default": [
            {
                "country": "EU",
                "label": "EEAS — Tackling disinformation",
                "url": "https://www.eeas.europa.eu/eeas/disinformation_en",
            },
            {
                "country": "EU",
                "label": "EUvsDisinfo",
                "url": "https://euvsdisinfo.eu/",
            },
            {
                "country": "EU",
                "label": "EDMO hub network",
                "url": "https://edmo.eu/about/edmo-european-hub-network/",
            },
        ],
        "by_country": {
            "DE": [
                {
                    "label": "Correctiv (EFCSN)",
                    "url": "https://correctiv.org/",
                },
                {
                    "label": "ARD Faktenfinder",
                    "url": "https://www.tagesschau.de/faktenfinder",
                },
            ],
            "FR": [
                {
                    "label": "VIGINUM",
                    "url": "https://www.sgdsn.gouv.fr/viginum",
                }
            ],
        },
    }


def test_urls() -> dict:
    return {
        "version": VERSION,
        "tier_a_mainstream_eu": [
            "https://www.tagesschau.de/",
            "https://www.reuters.com/",
            "https://www.lemonde.fr/",
        ],
        "tier_b_known_io": [
            "https://germany.news-pravda.com/",
            "https://de.rt.com/",
        ],
        "tier_c_borderline": [
            "https://www.anti-spiegel.ru/",
            "https://apolut.net/",
        ],
    }


def main() -> None:
    catalogue = json.loads(CATALOGUE.read_text(encoding="utf-8"))
    SEEDS.mkdir(parents=True, exist_ok=True)

    registry = {
        "version": catalogue.get("version", VERSION),
        "disclaimer": catalogue.get("disclaimer"),
        "entries": registry_entries(catalogue),
    }
    (SEEDS / "registry_domains.json").write_text(
        json.dumps(registry, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    media = {
        "version": catalogue.get("version", VERSION),
        "note": "Outbound-link lineage list. A hit is provenance, not a truth verdict.",
        "domains": source_media_domains(catalogue),
    }
    (SEEDS / "source_media_domains.json").write_text(
        json.dumps(media, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    (SEEDS / "eu_topic_keywords.json").write_text(
        json.dumps(eu_topics(), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    (SEEDS / "eu_resources.json").write_text(
        json.dumps(eu_resources(), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    (SEEDS / "test_urls.json").write_text(
        json.dumps(test_urls(), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    dest = SEEDS / "de_ru_propaganda_catalogue.json"
    shutil.copyfile(CATALOGUE, dest)
    app_seeds = ROOT / "App_v01" / "data" / "seeds"
    app_seeds.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(dest, app_seeds / "de_ru_propaganda_catalogue.json")
    print(f"wrote seeds to {SEEDS}")


if __name__ == "__main__":
    main()
