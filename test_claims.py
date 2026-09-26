"""Codebook claims, the other queue, and the trailing-eight-week z-score."""

from __future__ import annotations

import json
import math
import unittest
from datetime import date
from pathlib import Path

from claims import (
    BASELINE_WEEKS,
    MIN_COUNT,
    assign_copy_clusters,
    frames_by_week,
    label_articles,
    sources_by_frame,
    trailing_z,
)
from codebook import Frame, active_frames, load_codebook


def _frame(frame_id: str, pattern: str, *, kind: str = "frame", status: str = "active") -> Frame:
    return Frame(
        id=frame_id,
        version="test",
        kind=kind,
        label=frame_id,
        pattern=pattern,
        target="Ziel",
        euvsdisinfo_id=None,
        status=status,
    )


def _article(article_id: str, text: str, **overrides):
    row = {
        "article_id": article_id,
        "source_id": "rt_de",
        "rank": 1,
        "url": f"https://de.rt.com/{article_id}",
        "published_at": "2026-06-15",
        "title": "Titel",
        "text": text,
        "language": "de",
        "corpus": "rt_de_archive",
        "copy_cluster_id": f"cluster_{article_id}",
        "simhash": None,
    }
    row.update(overrides)
    return row


LONG = (
    "Das Kiewer Regime hat nach Angaben der Redaktion die Verhandlungen erneut "
    "abgebrochen und neue Forderungen gestellt."
)


class CodebookTests(unittest.TestCase):
    def test_active_frames_skip_retired(self):
        path = Path(__file__).resolve().parent / "data" / "codebook.json"
        book = json.loads(path.read_text(encoding="utf-8"))
        book["frames"].append(
            {
                "id": "retired_probe",
                "version": book["version"],
                "kind": "frame",
                "label": "Retired",
                "pattern": "retiredprobe",
                "target": None,
                "euvsdisinfo_id": None,
                "status": "retired",
            }
        )
        tmp = path.with_name("codebook_test.json")
        tmp.write_text(json.dumps(book), encoding="utf-8")
        try:
            loaded = load_codebook(tmp)
        finally:
            tmp.unlink()
        ids = [frame.id for frame in active_frames(loaded)]
        self.assertNotIn("retired_probe", ids)
        self.assertIn("kiewer_regime", ids)
        self.assertEqual(loaded["version"], "2026-09-26")

    def test_shipped_codebook_matches_scanner_patterns(self):
        import sys

        app = Path(__file__).resolve().parent / "App_v01"
        sys.path.insert(0, str(app))
        from services.narratives.codebook import PATTERNS

        active = active_frames(load_codebook())
        self.assertEqual([pattern.id for pattern in PATTERNS], [frame.id for frame in active])


class ClaimTests(unittest.TestCase):
    def test_quote_frame_and_other_queue(self):
        frames = [_frame("kiewer_regime", "kiewer regime")]
        other_text = (
            "Die Regierung behauptet das Gegenteil der offiziellen Darstellung "
            "und nennt die Berichte eine gezielte Kampagne gegen die Opposition."
        )
        claims, others = label_articles(
            [_article("a", LONG), _article("b", other_text)],
            frames,
            codebook_version="test",
        )
        self.assertEqual([row["frame_id"] for row in claims], ["kiewer_regime"])
        self.assertEqual(claims[0]["target"], "Ziel")
        self.assertIn("Kiewer Regime", claims[0]["quote"])
        self.assertEqual(len(others), 1)
        self.assertEqual(others[0]["status"], "other")
        self.assertEqual(others[0]["article_id"], "b")
        self.assertNotIn("b", {row["article_id"] for row in claims})

    def test_retired_frame_does_not_count(self):
        text = (
            "Ein retiredprobe steht in diesem Satz, der lang genug ist, "
            "und die Regierung behauptet dazu eine ganz andere Fassung der Ereignisse."
        )
        frames = active_frames(
            {"version": "test", "frames": [_frame("retired_probe", "retiredprobe", status="retired")]}
        )
        claims, others = label_articles(
            [_article("a", text)],
            frames,
            codebook_version="test",
        )
        self.assertEqual(claims, [])
        self.assertEqual(len(others), 1)

    def test_at_most_five_claims(self):
        frames = [_frame(f"f{i}", "alpha") for i in range(6)]
        text = (
            "Alpha steht hier als das einzige Muster in einem Satz, der die "
            "Mindestlänge für ein Zitat deutlich überschreitet und sonst nichts sagt."
        )
        claims, others = label_articles([_article("a", text)], frames, codebook_version="test")
        self.assertEqual([row["frame_id"] for row in claims], ["f0", "f1", "f2", "f3", "f4"])
        self.assertEqual(others, [])

    def test_identical_text_counts_once(self):
        frames = [_frame("kiewer_regime", "kiewer regime")]
        articles = [_article("a", LONG), _article("b", LONG, url="https://freede.tech/a")]
        for article in articles:
            article["copy_cluster_id"] = None
            article["simhash"] = __import__("simhash").simhash64(article["text"])
        assign_copy_clusters(articles)
        self.assertEqual(articles[0]["copy_cluster_id"], articles[1]["copy_cluster_id"])
        claims, _others = label_articles(articles, frames, codebook_version="test")
        matrix = frames_by_week(claims, articles, frames, codebook_version="test")
        week = matrix["series"][0]["weeks"][0]
        self.assertEqual(week["n"], 1)
        self.assertEqual(week["volume"], 1)
        self.assertEqual(week["share"], 1.0)


class BurstTests(unittest.TestCase):
    def test_z_uses_previous_eight_weeks_only(self):
        shares = [0.10, 0.20, 0.10, 0.20, 0.10, 0.20, 0.10, 0.40, 0.90]
        counts = [10] * 9
        scores = trailing_z(shares, counts)
        self.assertEqual(scores[:BASELINE_WEEKS], [None] * BASELINE_WEEKS)
        window = shares[:BASELINE_WEEKS]
        mean = sum(window) / BASELINE_WEEKS
        variance = sum((value - mean) ** 2 for value in window) / BASELINE_WEEKS
        expected = (shares[-1] - mean) / math.sqrt(variance)
        self.assertAlmostEqual(scores[-1], expected, places=6)
        leaked = shares[1:]
        leaked_mean = sum(leaked) / BASELINE_WEEKS
        leaked_var = sum((value - leaked_mean) ** 2 for value in leaked) / BASELINE_WEEKS
        leaked_z = (shares[-1] - leaked_mean) / math.sqrt(leaked_var)
        self.assertNotAlmostEqual(scores[-1], leaked_z, places=2)

    def test_minimum_count_suppresses_z(self):
        shares = [0.1] * 8 + [0.9]
        counts = [10] * 8 + [MIN_COUNT - 1]
        self.assertIsNone(trailing_z(shares, counts)[-1])

    def test_matrix_dedupes_clusters_inside_a_week(self):
        frames = [_frame("kiewer_regime", "kiewer regime")]
        articles = [
            _article("a", LONG, copy_cluster_id="cluster_same"),
            _article("b", LONG, copy_cluster_id="cluster_same"),
            _article("c", "Ohne Treffer. " * 12, copy_cluster_id="cluster_other"),
        ]
        claims = [
            {
                "frame_id": "kiewer_regime",
                "source_id": "rt_de",
                "corpus": "rt_de_archive",
                "week": "2026-W25",
                "copy_cluster_id": "cluster_same",
            },
            {
                "frame_id": "kiewer_regime",
                "source_id": "rt_de",
                "corpus": "rt_de_archive",
                "week": "2026-W25",
                "copy_cluster_id": "cluster_same",
            },
        ]
        matrix = frames_by_week(claims, articles, frames, codebook_version="test")
        week = matrix["series"][0]["weeks"][0]
        self.assertEqual(week["week"], "2026-W25")
        self.assertEqual(week["n"], 1)
        self.assertEqual(week["volume"], 2)
        self.assertEqual(week["share"], 0.5)
        self.assertIsNone(week["z"])

    def test_source_matrix_skips_live_rt_de(self):
        frames = [_frame("kiewer_regime", "kiewer regime")]
        day = date(2026, 9, 20).isoformat()
        articles = [
            _article("arch", LONG, published_at=day),
            _article("live", LONG, corpus="live", published_at=day, source_id="rt_de"),
            _article("wire", LONG, corpus="live", published_at=day, source_id="pravda_de", rank=2),
        ]
        claims, _others = label_articles(articles, frames, codebook_version="test")
        matrix = sources_by_frame(claims, articles, frames, codebook_version="test")
        by_source = {row["source_id"]: row for row in matrix["sources"]}
        self.assertEqual(by_source["rt_de"]["corpus"], "rt_de_archive")
        self.assertEqual(by_source["rt_de"]["deduped_count"], 1)
        self.assertEqual(by_source["pravda_de"]["rank"], 2)
        self.assertEqual(by_source["pravda_de"]["frames"][0]["n"], 1)


if __name__ == "__main__":
    unittest.main()
