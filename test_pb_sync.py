"""Payload shaping for the PocketBase sync. No server."""

from __future__ import annotations

import json
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from codebook import Frame
from pb_sync import (
    article_record,
    claim_key,
    claim_record,
    collect_records,
    edge_key,
    edge_record,
    pb_date,
    source_record,
)


CATALOGUE = {
    "ranks": [
        {
            "rank": 1,
            "id": "state_german",
            "label": "Official German services",
            "entries": [
                {
                    "id": "rt_de",
                    "name": "RT DE",
                    "control": "state_media",
                    "language": "de",
                    "operator": "ANO TV-Novosti",
                    "status": "banned",
                    "domains": [{"host": "de.rt.com", "role": "primary"}],
                    "channels": ["Telegram"],
                }
            ],
        }
    ]
}

BOOK = {
    "version": "2026-09-26",
    "frames": [
        Frame(
            id="russophobia",
            version="2026-09-26",
            kind="frame",
            label="Russophobie",
            pattern="russophob",
            target="Russland",
            euvsdisinfo_id=None,
            status="active",
        )
    ],
}


class KeyTests(unittest.TestCase):
    def test_edge_key_uses_endpoints_relation_and_rule(self):
        row = {
            "from_article_id": "a" * 64,
            "to_article_id": "b" * 64,
            "relation": "citation",
            "rule": "explicit_citation",
        }
        self.assertEqual(edge_key(row), f"{'a' * 64}|{'b' * 64}|citation|explicit_citation")
        self.assertEqual(edge_record(row)["edge_key"], edge_key(row))
        self.assertEqual(edge_record(row)["lag_hours"], 0)

    def test_claim_key_uses_frame_and_other_rows_use_other(self):
        claim = {
            "article_id": "a" * 64,
            "frame_id": "russophobia",
            "codebook_version": "2026-09-26",
            "quote": "Russophobie.",
        }
        other = {
            "article_id": "b" * 64,
            "status": "other",
            "codebook_version": "2026-09-26",
            "quote": "Angeblich.",
        }
        self.assertEqual(claim_key(claim), f"{'a' * 64}|russophobia|2026-09-26")
        self.assertEqual(claim_key(other), f"{'b' * 64}|other|2026-09-26")
        self.assertEqual(claim_record(claim)["status"], "claim")
        self.assertEqual(claim_record(other)["status"], "other")


class RecordTests(unittest.TestCase):
    def test_source_record_maps_catalogue_entry(self):
        rank_block = CATALOGUE["ranks"][0]
        record = source_record(1, rank_block, rank_block["entries"][0])
        self.assertEqual(record["source_id"], "rt_de")
        self.assertEqual(record["rank"], 1)
        self.assertEqual(record["rank_label"], "Official German services")
        self.assertEqual(record["domains"][0]["host"], "de.rt.com")

    def test_article_record_flattens_extracted_fields_and_formats_date(self):
        record = article_record(
            {
                "article_id": "a" * 64,
                "source_id": "rt_de",
                "url": "https://de.rt.com/story",
                "canonical_url": "https://de.rt.com/story?utm=1",
                "published_at": "2026-09-26T17:20:00+00:00",
                "host": "de.rt.com",
                "rank": 1,
                "extracted": {
                    "title": "Titel",
                    "excerpt": "Kurz",
                    "text": "Lang",
                    "language": "de",
                },
                "outbound_links": [{"url": "https://de.rt.com/other"}],
                "credits": [],
            }
        )
        self.assertEqual(record["title"], "Titel")
        self.assertEqual(record["url"], "https://de.rt.com/story?utm=1")
        self.assertEqual(record["text"], "Lang")
        self.assertEqual(record["published_at"], "2026-09-26 17:20:00.000Z")
        self.assertEqual(pb_date(None), "")

    def test_collect_skips_missing_outputs_and_keeps_catalogue(self):
        with TemporaryDirectory() as tmp:
            sets = {
                item.collection: item
                for item in collect_records(CATALOGUE, BOOK, Path(tmp))
            }
        self.assertEqual(sets["sources"].records[0]["source_id"], "rt_de")
        self.assertEqual(sets["frames"].records[0]["frame_id"], "russophobia")
        self.assertIsNone(sets["articles"].records)
        self.assertIsNone(sets["topics"].records)
        self.assertIsNone(sets["edges"].records)
        self.assertIsNone(sets["claims"].records)
        self.assertIsNone(sets["reports"].records)

    def test_collect_shapes_present_files_and_partial_reports(self):
        with TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "articles_clustered.jsonl").write_text(
                json.dumps(
                    {
                        "article_id": "c" * 64,
                        "source_id": "ria",
                        "url": "https://ria.ru/story",
                        "published_at": "2026-09-18T13:55:00+00:00",
                        "extracted": {"title": "Заголовок", "text": "Текст", "language": "ru"},
                    }
                )
                + "\n",
                encoding="utf-8",
            )
            (root / "frames_by_week.json").write_text(
                json.dumps({"codebook_version": "2026-09-26", "series": []}) + "\n",
                encoding="utf-8",
            )
            sets = {
                item.collection: item
                for item in collect_records(CATALOGUE, BOOK, root)
            }
        self.assertEqual(sets["articles"].records[0]["title"], "Заголовок")
        self.assertEqual(sets["articles"].records[0]["published_at"], "2026-09-18 13:55:00.000Z")
        self.assertEqual(sets["reports"].records[0]["slug"], "frames_by_week")
        self.assertFalse(sets["reports"].delete_missing)
        self.assertIsNone(sets["claims"].records)


if __name__ == "__main__":
    unittest.main()
