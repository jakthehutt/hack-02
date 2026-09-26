import json
from functools import lru_cache
from pathlib import Path
from urllib.parse import urlparse

import yaml

from app.config import RULES_DIR, SEEDS_DIR


@lru_cache
def load_registry() -> dict:
    path = SEEDS_DIR / "registry_domains.json"
    return json.loads(path.read_text(encoding="utf-8"))


@lru_cache
def load_source_media() -> set[str]:
    data = json.loads((SEEDS_DIR / "source_media_domains.json").read_text(encoding="utf-8"))
    return {d.lower() for d in data.get("domains", [])}


@lru_cache
def load_eu_topics() -> dict:
    return json.loads((SEEDS_DIR / "eu_topic_keywords.json").read_text(encoding="utf-8"))


@lru_cache
def load_eu_resources() -> dict:
    return json.loads((SEEDS_DIR / "eu_resources.json").read_text(encoding="utf-8"))


@lru_cache
def load_hostname_patterns() -> list[dict]:
    path = RULES_DIR / "hostname_patterns.yaml"
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    return data.get("patterns", [])


def seed_versions() -> dict[str, str]:
    versions: dict[str, str] = {}
    for name in (
        "registry_domains.json",
        "source_media_domains.json",
        "eu_topic_keywords.json",
        "eu_resources.json",
        "de_ru_propaganda_catalogue.json",
    ):
        p = SEEDS_DIR / name
        if p.exists():
            data = json.loads(p.read_text(encoding="utf-8"))
            versions[name] = data.get("version", "unknown")
    hp = RULES_DIR / "hostname_patterns.yaml"
    if hp.exists():
        data = yaml.safe_load(hp.read_text(encoding="utf-8"))
        versions["hostname_patterns.yaml"] = data.get("version", "unknown")
    return versions


def hostname_from_url(url: str) -> str:
    host = urlparse(url).hostname or ""
    return host.lower()


def match_registry(host: str) -> list[dict]:
    registry = load_registry()
    hits: list[dict] = []
    for entry in registry.get("entries", []):
        domain = entry["domain"].lower()
        mode = entry.get("match", "exact")
        if mode == "suffix" and (host == domain or host.endswith("." + domain)):
            hits.append(entry)
        elif mode == "exact" and host == domain:
            hits.append(entry)
    return hits
