"""The published bundle keeps its contract, and the pipeline stays blind to its readers."""

from __future__ import annotations

import json
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from bundle import LATEST_PATH, ROOT, SCHEMA_VERSION, build_bundle, diff_summary, dump, publish

TOP_KEYS = {"meta", "weeks", "series", "sources", "upstream", "edges", "dsn_narratives", "dsn_meta"}
SOURCE_KEYS = {"id", "rank", "name", "article_count", "date_span", "weekly_articles", "weekly_observed", "crawl", "series"}
SERIES_KEYS = {"id", "article_count", "share_pct", "peak", "weekly_n", "quotes"}
EDGE_KEYS = {"from_source_id", "to_source_id", "relation", "lag_hours", "synthetic"}


def check_shape(case: unittest.TestCase, b: dict) -> None:
    case.assertTrue(TOP_KEYS <= b.keys())
    case.assertEqual(b["meta"]["schema_version"], SCHEMA_VERSION)
    case.assertTrue(b["meta"]["bundle_id"])
    n_weeks = len(b["weeks"])
    series_ids = {s["id"] for s in b["series"]}
    for src in b["sources"]:
        case.assertTrue(SOURCE_KEYS <= src.keys(), src["id"])
        case.assertIsInstance(src["weekly_observed"], bool)
        case.assertEqual(len(src["weekly_articles"]), n_weeks)
        for se in src["series"]:
            case.assertTrue(SERIES_KEYS <= se.keys())
            case.assertIn(se["id"], series_ids)
            case.assertEqual(len(se["weekly_n"]), n_weeks)
            case.assertTrue(0 <= se["share_pct"] <= 100, "share_pct is a percentage")
    for e in b["edges"]:
        case.assertTrue(EDGE_KEYS <= e.keys())
        case.assertIsInstance(e["synthetic"], bool)


class BundleShapeTest(unittest.TestCase):
    def test_latest_keeps_the_contract(self) -> None:
        check_shape(self, json.loads(LATEST_PATH.read_text(encoding="utf-8")))

    def test_export_keeps_the_contract(self) -> None:
        check_shape(self, build_bundle(generated="2026-01-01"))

    def test_estimates_are_flagged(self) -> None:
        b = build_bundle(generated="2026-01-01")
        self.assertTrue(any(e["synthetic"] for e in b["edges"]))
        self.assertTrue(any(not e["synthetic"] for e in b["edges"]))
        self.assertEqual([s["id"] for s in b["sources"] if s["weekly_observed"]], ["rt_de"])

    def test_export_is_deterministic(self) -> None:
        self.assertEqual(dump(build_bundle(generated="x")), dump(build_bundle(generated="x")))

    def test_publish_leaves_latest_alone_without_promote(self) -> None:
        with TemporaryDirectory() as tmp:
            out = Path(tmp)
            (out / "latest.json").write_text('{"sources": [{"id": "gone", "article_count": 1, "series": []}]}', encoding="utf-8")
            result = publish(out_dir=out)
            self.assertIn("outlet removed: gone", result["changes"])
            self.assertIn("gone", (out / "latest.json").read_text(encoding="utf-8"))
            publish(promote=True, out_dir=out)
            self.assertNotIn("gone", (out / "latest.json").read_text(encoding="utf-8"))

    def test_diff_summary_names_changes(self) -> None:
        old = {"sources": [{"id": "a", "article_count": 1, "series": []}], "series": [{"id": "x"}]}
        new = {"sources": [{"id": "a", "article_count": 2, "series": []}], "series": [{"id": "y"}]}
        self.assertEqual(diff_summary(old, new), ["articles a: 1 → 2", "series removed: x", "series added: y"])


class BoundaryTest(unittest.TestCase):
    """The pipeline never refers to the presentation layer."""

    def test_no_pipeline_file_mentions_presentation(self) -> None:
        skip = {"presentation", "node_modules", ".venv", ".git", "__pycache__"}
        offenders = []
        for path in ROOT.rglob("*.py"):
            rel = path.relative_to(ROOT)
            if skip & set(rel.parts) or path.name == "test_bundle.py":
                continue
            text = path.read_text(encoding="utf-8", errors="ignore")
            if "presentation/" in text or "dashboard" in text.lower():
                offenders.append(str(rel))
        self.assertEqual(offenders, [])


if __name__ == "__main__":
    unittest.main()
