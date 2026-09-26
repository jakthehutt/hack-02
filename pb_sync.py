"""Publish pipeline JSON files to PocketBase.

The crawl still writes data/*.jsonl. This module upserts those files into
the collections created by pb_migrations/. Missing output files are skipped.

    POCKETBASE_URL=http://127.0.0.1:8090 \\
    POCKETBASE_EMAIL=admin@example.com \\
    POCKETBASE_PASSWORD=changeme12345 \\
    python run.py sync
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx

from catalogue import DATA_DIR, iter_entries, load_catalogue
from codebook import Frame, load_codebook

DEFAULT_URL = "http://127.0.0.1:8090"
BATCH_SIZE = 20

TEXT_LIMITS = {
    "name": 500,
    "source_id": 200,
    "rank_label": 500,
    "rank_id": 200,
    "control": 200,
    "language": 32,
    "operator": 1000,
    "status": 2000,
    "label": 500,
    "frame_id": 200,
    "version": 64,
    "kind": 32,
    "pattern": 10000,
    "target": 200,
    "euvsdisinfo_id": 200,
    "title": 2000,
    "article_id": 128,
    "url": 2000,
    "excerpt": 5000,
    "text": 500000,
    "host": 255,
    "copy_cluster_id": 200,
    "topic_id": 200,
    "description": 5000,
    "origin_source_id": 200,
    "origin_article_id": 128,
    "origin_rule": 200,
    "example_overlap": 2000,
    "edge_key": 600,
    "from_article_id": 128,
    "to_article_id": 128,
    "from_source_id": 200,
    "to_source_id": 200,
    "relation": 64,
    "rule": 200,
    "quote": 2000,
    "claim_key": 500,
    "week": 16,
    "corpus": 64,
    "codebook_version": 64,
    "slug": 64,
}


@dataclass
class SyncSet:
    collection: str
    key_field: str
    records: list[dict[str, Any]] | None
    delete_missing: bool = True


def _text(value: Any, field: str) -> str:
    text = "" if value is None else str(value)
    limit = TEXT_LIMITS.get(field)
    if limit is not None and len(text) > limit:
        return text[:limit]
    return text


def _number(value: Any) -> float:
    if value is None or value == "":
        return 0
    return float(value)


def pb_date(value: str | None) -> str:
    """PocketBase stores datetimes as 'YYYY-MM-DD HH:MM:SS.mmmZ'."""
    if not value:
        return ""
    text = str(value).strip()
    if not text:
        return ""
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        return ""
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    else:
        parsed = parsed.astimezone(timezone.utc)
    return parsed.strftime("%Y-%m-%d %H:%M:%S.%f")[:-3] + "Z"


def _dedupe(records: list[dict[str, Any]], key_field: str) -> list[dict[str, Any]]:
    by_key: dict[str, dict[str, Any]] = {}
    for record in records:
        key = record.get(key_field)
        if not key:
            continue
        by_key[str(key)] = record
    return list(by_key.values())


def edge_key(row: dict[str, Any]) -> str:
    return "|".join(
        [
            str(row.get("from_article_id") or ""),
            str(row.get("to_article_id") or ""),
            str(row.get("relation") or ""),
            str(row.get("rule") or ""),
        ]
    )


def claim_key(row: dict[str, Any]) -> str:
    frame = row.get("frame_id") or "other"
    return "|".join(
        [
            str(row.get("article_id") or ""),
            str(frame),
            str(row.get("codebook_version") or ""),
        ]
    )


def source_record(rank: int, rank_block: dict[str, Any], entry: dict[str, Any]) -> dict[str, Any]:
    return {
        "source_id": _text(entry.get("id"), "source_id"),
        "name": _text(entry.get("name"), "name"),
        "rank": _number(rank),
        "rank_label": _text(rank_block.get("label"), "rank_label"),
        "rank_id": _text(rank_block.get("id"), "rank_id"),
        "control": _text(entry.get("control"), "control"),
        "language": _text(entry.get("language"), "language"),
        "operator": _text(entry.get("operator"), "operator"),
        "status": _text(entry.get("status"), "status"),
        "domains": entry.get("domains") or [],
        "channels": entry.get("channels") or [],
    }


def frame_record(frame: Frame) -> dict[str, Any]:
    return {
        "frame_id": _text(frame.id, "frame_id"),
        "version": _text(frame.version, "version"),
        "kind": _text(frame.kind, "kind"),
        "label": _text(frame.label, "label"),
        "pattern": _text(frame.pattern, "pattern"),
        "target": _text(frame.target, "target"),
        "euvsdisinfo_id": _text(frame.euvsdisinfo_id, "euvsdisinfo_id"),
        "status": _text(frame.status, "status"),
    }


def article_record(row: dict[str, Any]) -> dict[str, Any]:
    extracted = row.get("extracted") or {}
    return {
        "article_id": _text(row.get("article_id"), "article_id"),
        "source_id": _text(row.get("source_id"), "source_id"),
        "title": _text(extracted.get("title"), "title"),
        "url": _text(row.get("canonical_url") or row.get("url"), "url"),
        "language": _text(extracted.get("language"), "language"),
        "excerpt": _text(extracted.get("excerpt"), "excerpt"),
        "text": _text(extracted.get("text"), "text"),
        "published_at": pb_date(row.get("published_at")),
        "host": _text(row.get("host"), "host"),
        "rank": _number(row.get("rank")),
        "copy_cluster_id": _text(row.get("copy_cluster_id"), "copy_cluster_id"),
        "topic_id": _text(row.get("topic_id"), "topic_id"),
        "outbound_links": row.get("outbound_links") or [],
        "credits": row.get("credits") or [],
    }


def topic_record(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "topic_id": _text(row.get("topic_id"), "topic_id"),
        "label": _text(row.get("label"), "label"),
        "description": _text(row.get("description"), "description"),
        "origin_source_id": _text(row.get("origin_source_id"), "origin_source_id"),
        "origin_article_id": _text(row.get("origin_article_id"), "origin_article_id"),
        "origin_rule": _text(row.get("origin_rule"), "origin_rule"),
        "window_start": pb_date(row.get("window_start")),
        "window_end": pb_date(row.get("window_end")),
        "entities": row.get("entities") or [],
        "members": row.get("members") or [],
        "downstream_source_ids": row.get("downstream_source_ids") or [],
    }


def edge_record(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "edge_key": _text(edge_key(row), "edge_key"),
        "from_article_id": _text(row.get("from_article_id"), "from_article_id"),
        "to_article_id": _text(row.get("to_article_id"), "to_article_id"),
        "from_source_id": _text(row.get("from_source_id"), "from_source_id"),
        "to_source_id": _text(row.get("to_source_id"), "to_source_id"),
        "relation": _text(row.get("relation"), "relation"),
        "rule": _text(row.get("rule"), "rule"),
        "lag_hours": _number(row.get("lag_hours")),
        "similarity": _number(row.get("similarity")),
        "example_overlap": _text(row.get("example_overlap"), "example_overlap"),
    }


def claim_record(row: dict[str, Any]) -> dict[str, Any]:
    status = row.get("status") or ("other" if not row.get("frame_id") else "claim")
    return {
        "claim_key": _text(claim_key(row), "claim_key"),
        "status": _text(status, "status"),
        "frame_id": _text(row.get("frame_id"), "frame_id"),
        "kind": _text(row.get("kind"), "kind"),
        "label": _text(row.get("label"), "label"),
        "target": _text(row.get("target"), "target"),
        "quote": _text(row.get("quote"), "quote"),
        "article_id": _text(row.get("article_id"), "article_id"),
        "source_id": _text(row.get("source_id"), "source_id"),
        "rank": _number(row.get("rank")),
        "week": _text(row.get("week"), "week"),
        "copy_cluster_id": _text(row.get("copy_cluster_id"), "copy_cluster_id"),
        "corpus": _text(row.get("corpus"), "corpus"),
        "codebook_version": _text(row.get("codebook_version"), "codebook_version"),
        "url": _text(row.get("url"), "url"),
    }


def report_record(slug: str, payload: dict[str, Any]) -> dict[str, Any]:
    return {"slug": _text(slug, "slug"), "payload": payload}


def _read_jsonl(path: Path) -> list[dict[str, Any]] | None:
    if not path.exists():
        return None
    rows: list[dict[str, Any]] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.strip():
            rows.append(json.loads(line))
    return rows


def _read_json(path: Path) -> dict[str, Any] | None:
    if not path.exists():
        return None
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ValueError(f"{path} is not a JSON object")
    return payload


def collect_records(
    catalogue: dict[str, Any] | None = None,
    book: dict[str, Any] | None = None,
    data_dir: Path | None = None,
) -> list[SyncSet]:
    catalogue = catalogue if catalogue is not None else load_catalogue()
    book = book if book is not None else load_codebook()
    data_dir = data_dir if data_dir is not None else DATA_DIR

    sources = [
        source_record(rank, rank_block, entry)
        for rank, rank_block, entry in iter_entries(catalogue)
    ]
    frames = [frame_record(frame) for frame in book.get("frames") or []]

    articles = _read_jsonl(data_dir / "articles_clustered.jsonl")
    topics = _read_jsonl(data_dir / "topics.jsonl")
    edges = _read_jsonl(data_dir / "edges.jsonl")
    claims = _read_jsonl(data_dir / "claims.jsonl")
    others = _read_jsonl(data_dir / "frame_other.jsonl")

    claim_records: list[dict[str, Any]] | None
    if claims is None and others is None:
        claim_records = None
    else:
        claim_records = [claim_record(row) for row in (claims or [])]
        claim_records.extend(claim_record(row) for row in (others or []))

    report_rows: list[dict[str, Any]] = []
    report_files = 0
    for slug, filename in (
        ("frames_by_week", "frames_by_week.json"),
        ("sources_by_frame", "sources_by_frame.json"),
    ):
        payload = _read_json(data_dir / filename)
        if payload is None:
            continue
        report_files += 1
        report_rows.append(report_record(slug, payload))

    return [
        SyncSet("sources", "source_id", _dedupe(sources, "source_id")),
        SyncSet("frames", "frame_id", _dedupe(frames, "frame_id")),
        SyncSet(
            "articles",
            "article_id",
            None if articles is None else _dedupe([article_record(row) for row in articles], "article_id"),
        ),
        SyncSet(
            "topics",
            "topic_id",
            None if topics is None else _dedupe([topic_record(row) for row in topics], "topic_id"),
        ),
        SyncSet(
            "edges",
            "edge_key",
            None if edges is None else _dedupe([edge_record(row) for row in edges], "edge_key"),
        ),
        SyncSet(
            "claims",
            "claim_key",
            None if claim_records is None else _dedupe(claim_records, "claim_key"),
        ),
        SyncSet(
            "reports",
            "slug",
            None if report_files == 0 else report_rows,
            delete_missing=report_files == 2,
        ),
    ]


class PocketBaseClient:
    def __init__(self, url: str, email: str, password: str) -> None:
        self.url = url.rstrip("/")
        self._client = httpx.Client(timeout=180)
        self._token = self._auth(email, password)

    def close(self) -> None:
        self._client.close()

    def __enter__(self) -> PocketBaseClient:
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()

    def _auth(self, email: str, password: str) -> str:
        response = self._check(
            self._client.post(
                f"{self.url}/api/collections/_superusers/auth-with-password",
                json={"identity": email, "password": password},
            )
        )
        token = response.json().get("token")
        if not token:
            raise RuntimeError("PocketBase auth response did not include a token")
        return str(token)

    def _headers(self) -> dict[str, str]:
        return {"Authorization": self._token}

    def _check(self, response: httpx.Response) -> httpx.Response:
        if response.is_error:
            raise RuntimeError(
                f"PocketBase {response.status_code} {response.request.method} "
                f"{response.request.url}: {response.text}"
            )
        return response

    def list_keys(self, collection: str, key_field: str) -> dict[str, str]:
        found: dict[str, str] = {}
        page = 1
        while True:
            response = self._check(
                self._client.get(
                    f"{self.url}/api/collections/{collection}/records",
                    headers=self._headers(),
                    params={"page": page, "perPage": 200, "fields": f"id,{key_field}"},
                )
            )
            data = response.json()
            items = data.get("items") or []
            for item in items:
                key = item.get(key_field)
                if key:
                    found[str(key)] = item["id"]
            total_pages = int(data.get("totalPages") or 0)
            if page >= total_pages or not items:
                break
            page += 1
        return found

    def batch(self, requests: list[dict[str, Any]]) -> None:
        for start in range(0, len(requests), BATCH_SIZE):
            chunk = requests[start : start + BATCH_SIZE]
            self._check(
                self._client.post(
                    f"{self.url}/api/batch",
                    headers=self._headers(),
                    json={"requests": chunk},
                )
            )

    def replace(
        self,
        collection: str,
        key_field: str,
        records: list[dict[str, Any]],
        *,
        delete_missing: bool = True,
    ) -> dict[str, int]:
        existing = self.list_keys(collection, key_field)
        seen: set[str] = set()
        requests: list[dict[str, Any]] = []
        for record in records:
            key = str(record[key_field])
            seen.add(key)
            if key in existing:
                requests.append(
                    {
                        "method": "PATCH",
                        "url": f"/api/collections/{collection}/records/{existing[key]}",
                        "body": record,
                    }
                )
            else:
                requests.append(
                    {
                        "method": "POST",
                        "url": f"/api/collections/{collection}/records",
                        "body": record,
                    }
                )
        deleted = 0
        if delete_missing:
            for key, record_id in existing.items():
                if key in seen:
                    continue
                deleted += 1
                requests.append(
                    {
                        "method": "DELETE",
                        "url": f"/api/collections/{collection}/records/{record_id}",
                    }
                )
        self.batch(requests)
        return {"upserted": len(records), "deleted": deleted}

    def publish_sets(self, sets: list[SyncSet]) -> dict[str, Any]:
        stats: dict[str, Any] = {}
        for item in sets:
            if item.records is None:
                stats[item.collection] = "skipped"
                continue
            stats[item.collection] = self.replace(
                item.collection,
                item.key_field,
                item.records,
                delete_missing=item.delete_missing,
            )
        return stats


def publish(
    catalogue: dict[str, Any] | None = None,
    book: dict[str, Any] | None = None,
    data_dir: Path | None = None,
) -> dict[str, Any]:
    email = os.environ.get("POCKETBASE_EMAIL", "").strip()
    password = os.environ.get("POCKETBASE_PASSWORD", "")
    if not email or not password:
        raise RuntimeError("POCKETBASE_EMAIL and POCKETBASE_PASSWORD are required")
    url = os.environ.get("POCKETBASE_URL", DEFAULT_URL).strip() or DEFAULT_URL
    with PocketBaseClient(url, email, password) as client:
        return client.publish_sets(collect_records(catalogue, book, data_dir))


def format_stats(stats: dict[str, Any]) -> str:
    parts: list[str] = []
    for name, info in stats.items():
        if info == "skipped":
            parts.append(f"{name} skipped")
        else:
            parts.append(f"{name} {info['upserted']} upserted, {info['deleted']} deleted")
    return "; ".join(parts)
