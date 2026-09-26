"""Expand sources.json into crawl targets and a host→source index."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Iterable

from urls import normalize_host

ROOT = Path(__file__).resolve().parent
CATALOGUE_PATH = ROOT / "sources.json"
DATA_DIR = ROOT / "data"

MVP_SOURCE_IDS = (
    "rt_de",
    "sputnik_de",
    "pravda_de",
    "newsfront_de",
    "anti_spiegel",
    "apolut",
    "ria",
    "tass",
)

PREFERRED_ROLES = (
    "primary",
    "german_edition",
    "successor",
    "sanctioned_mirror",
    "multilingual_hub",
    "ministry",
    "embassy",
    "eu_listed",
    "older_apex",
    "eu_16th_package",
    "observed_mirror",
    "observed_german_desk",
    "pre_ban_german_edition",
)

SKIP_ROLES_UNTIL_PRIMARY_FAILS = {
    "clone",
    "fake_portal",
    "sanctioned_mirror_suffix",
    "parent",
    "network_suffix",
    "proxy_often_cited",
    "earlier_german_domain",
}

NO_STABLE_DOMAIN_SOURCES = {"alina_lipp", "aam"}


def load_catalogue(path: Path | None = None) -> dict[str, Any]:
    return json.loads((path or CATALOGUE_PATH).read_text(encoding="utf-8"))


def _role_rank(role: str) -> int:
    try:
        return PREFERRED_ROLES.index(role)
    except ValueError:
        return 100 + (0 if role not in SKIP_ROLES_UNTIL_PRIMARY_FAILS else 50)


def iter_entries(catalogue: dict[str, Any] | None = None) -> Iterable[tuple[int, dict, dict]]:
    catalogue = catalogue or load_catalogue()
    for rank_block in catalogue.get("ranks", []):
        rank = int(rank_block["rank"])
        for entry in rank_block.get("entries", []):
            yield rank, rank_block, entry


def expand_targets(
    catalogue: dict[str, Any] | None = None,
    *,
    mvp_only: bool = False,
    include_aliases: bool = False,
) -> list[dict[str, Any]]:
    """Emit crawl targets. Alias/clone hosts are omitted unless include_aliases."""
    catalogue = catalogue or load_catalogue()
    targets: list[dict[str, Any]] = []
    skipped: list[dict[str, Any]] = []

    for rank, rank_block, entry in iter_entries(catalogue):
        source_id = entry["id"]
        if mvp_only and source_id not in MVP_SOURCE_IDS:
            continue
        domains = entry.get("domains") or []
        if not domains:
            skipped.append(
                {
                    "source_id": source_id,
                    "reason": "no_stable_domain",
                    "channels": entry.get("channels") or [],
                }
            )
            continue

        hosts: list[dict[str, Any]] = []
        for domain in domains:
            host = normalize_host(domain.get("host"))
            role = domain.get("role") or "unknown"
            aliases = [normalize_host(a) for a in domain.get("aliases") or []]
            record = {
                "source_id": source_id,
                "name": entry.get("name"),
                "rank": rank,
                "rank_id": rank_block.get("id"),
                "control": entry.get("control"),
                "language": entry.get("language"),
                "host": host,
                "path": domain.get("path") or "/",
                "role": role,
                "aliases": aliases,
                "imitates": domain.get("imitates"),
            }
            skip_now = role in SKIP_ROLES_UNTIL_PRIMARY_FAILS and not include_aliases
            if skip_now:
                skipped.append({**record, "reason": "deferred_until_primary_fails"})
                continue
            hosts.append(record)

        hosts.sort(key=lambda h: (_role_rank(h["role"]), h["host"]))
        targets.extend(hosts)

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    payload = {
        "mvp_only": mvp_only,
        "include_aliases": include_aliases,
        "targets": targets,
        "skipped": skipped,
    }
    (DATA_DIR / "targets.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return targets


def host_index(catalogue: dict[str, Any] | None = None) -> dict[str, dict[str, Any]]:
    """Map every known hostname (including aliases) to its source metadata."""
    catalogue = catalogue or load_catalogue()
    index: dict[str, dict[str, Any]] = {}
    for rank, rank_block, entry in iter_entries(catalogue):
        for domain in entry.get("domains") or []:
            meta = {
                "source_id": entry["id"],
                "name": entry.get("name"),
                "rank": rank,
                "rank_id": rank_block.get("id"),
                "control": entry.get("control"),
                "language": entry.get("language"),
                "role": domain.get("role"),
            }
            host = normalize_host(domain.get("host"))
            if host:
                index[host] = meta
            for alias in domain.get("aliases") or []:
                alias_host = normalize_host(alias)
                if alias_host:
                    index[alias_host] = {**meta, "role": "alias", "alias_of": host}
    return index


def source_meta(catalogue: dict[str, Any] | None = None) -> dict[str, dict[str, Any]]:
    catalogue = catalogue or load_catalogue()
    out: dict[str, dict[str, Any]] = {}
    for rank, rank_block, entry in iter_entries(catalogue):
        out[entry["id"]] = {
            "source_id": entry["id"],
            "name": entry.get("name"),
            "rank": rank,
            "rank_id": rank_block.get("id"),
            "control": entry.get("control"),
            "language": entry.get("language"),
        }
    return out


if __name__ == "__main__":
    rows = expand_targets(mvp_only=True)
    print(f"wrote {len(rows)} MVP targets to {DATA_DIR / 'targets.json'}")
