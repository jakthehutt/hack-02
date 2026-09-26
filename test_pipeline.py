"""Unit tests for discovery parsing and mother/daughter rules. No network."""

from __future__ import annotations

import unittest
from datetime import datetime, timedelta, timezone

from crawl import parse_feed, parse_sitemap
from extract import extract_credits, resolve_published_at
from cluster import _pick_origin, citation_edges
from urls import looks_like_article_url, url_published_at


def _article(**overrides):
    row = {
        "article_id": "a" * 64,
        "source_id": "rt_de",
        "url": "https://de.rt.com/international/11111-slug",
        "canonical_url": "https://de.rt.com/international/11111-slug",
        "published_at": "2026-09-20T08:00:00+00:00",
        "date_confidence": "high",
        "text_sha256": "hash-a",
        "simhash": "0" * 16,
        "extracted": {"title": "Titel", "text": "Text " * 80, "language": "de"},
        "outbound_links": [],
        "credits": [],
    }
    row.update(overrides)
    return row


class UrlTests(unittest.TestCase):
    def test_placeholder_path_pattern_does_not_match_every_page(self):
        self.assertFalse(looks_like_article_url("https://example.com/about", "/"))
        self.assertFalse(looks_like_article_url("https://example.com/impressum", "/"))

    def test_ria_style_date(self):
        self.assertEqual(url_published_at("https://ria.ru/20260926/story-1.html"), (2026, 9, 26))

    def test_slash_date(self):
        self.assertEqual(url_published_at("https://apolut.net/2026/09/20/titel/"), (2026, 9, 20))


class DiscoveryTests(unittest.TestCase):
    def test_sitemap_keeps_lastmod_and_nested_maps(self):
        xml = """<?xml version="1.0"?>
        <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          <sitemap><loc>https://de.rt.com/news.xml</loc><lastmod>2026-09-25</lastmod></sitemap>
        </sitemapindex>"""
        children, pages = parse_sitemap(xml)
        self.assertEqual(children, [("https://de.rt.com/news.xml", "2026-09-25")])
        self.assertEqual(pages, [])

    def test_sitemap_pages(self):
        xml = """<urlset>
          <url><loc><![CDATA[https://de.rt.com/international/12345-titel]]></loc><lastmod>2026-09-24T01:00:00Z</lastmod></url>
        </urlset>"""
        children, pages = parse_sitemap(xml)
        self.assertEqual(children, [])
        self.assertEqual(pages[0][0], "https://de.rt.com/international/12345-titel")
        self.assertEqual(pages[0][1], "2026-09-24T01:00:00Z")

    def test_rss_link_text(self):
        xml = """<rss><channel><item>
          <link>https://de.rt.com/europa/22222-titel</link>
          <pubDate>Thu, 25 Sep 2026 08:00:00 GMT</pubDate>
        </item></channel></rss>"""
        items = parse_feed(xml)
        self.assertEqual(items, [("https://de.rt.com/europa/22222-titel", "Thu, 25 Sep 2026 08:00:00 GMT")])


class ExtractTests(unittest.TestCase):
    def test_meta_attribute_order_and_json_ld(self):
        html = """<html><head>
          <meta content="2026-09-22T10:00:00+00:00" property="article:published_time">
          <script type="application/ld+json">{"datePublished":"2026-09-21T10:00:00+00:00"}</script>
        </head><body><p>x</p></body></html>"""
        published, source, confidence = resolve_published_at(html, None, "https://de.rt.com/international/1-x")
        self.assertEqual(source, "meta")
        self.assertEqual(confidence, "high")
        self.assertTrue(published.startswith("2026-09-22"))

    def test_credit_line_only(self):
        credits = extract_credits("TASS hat gestern etwas gesagt. Quelle: RIA Novosti.", {})
        self.assertEqual(len(credits), 1)
        self.assertEqual(credits[0]["resolved_source_id"], "ria")


class LineageTests(unittest.TestCase):
    def test_citation_requires_the_linked_article(self):
        mother = _article(
            article_id="m" * 64,
            source_id="ria",
            url="https://ria.ru/20260920/story-1.html",
            canonical_url="https://ria.ru/20260920/story-1.html",
        )
        unrelated = _article(
            article_id="u" * 64,
            source_id="tass",
            url="https://tass.com/politics/999",
            canonical_url="https://tass.com/politics/999",
            published_at="2026-09-20T09:00:00+00:00",
        )
        daughter = _article(
            article_id="d" * 64,
            credits=[{"raw": "TASS", "resolved_source_id": "tass", "span": "Quelle: TASS"}],
            outbound_links=[
                {
                    "url": "https://ria.ru/20260920/story-1.html",
                    "host": "ria.ru",
                    "resolved_source_id": "ria",
                    "anchor": "RIA",
                }
            ],
        )
        edges = citation_edges([mother, unrelated, daughter])
        self.assertEqual(len(edges), 1)
        self.assertEqual(edges[0]["from_article_id"], mother["article_id"])
        self.assertEqual(edges[0]["to_article_id"], daughter["article_id"])
        self.assertNotEqual(edges[0]["from_source_id"], "tass")

    def test_low_confidence_date_does_not_beat_rank(self):
        early = _article(
            article_id="e" * 64,
            source_id="apolut",
            published_at="2026-09-01T00:00:00+00:00",
            date_confidence="low",
        )
        higher = _article(
            article_id="h" * 64,
            source_id="anti_spiegel",
            published_at=None,
            date_confidence="low",
        )
        origin, rule = _pick_origin(
            [early, higher],
            {},
            {early["article_id"]: early, higher["article_id"]: higher},
            {"apolut": {"rank": 5}, "anti_spiegel": {"rank": 4}},
        )
        self.assertEqual(rule, "rank_tiebreak")
        self.assertEqual(origin["source_id"], "anti_spiegel")

    def test_reliable_earlier_date_wins(self):
        first = _article(article_id="1" * 64, source_id="apolut", published_at="2026-09-18T00:00:00+00:00")
        second = _article(
            article_id="2" * 64,
            source_id="rt_de",
            published_at="2026-09-20T00:00:00+00:00",
        )
        origin, rule = _pick_origin(
            [second, first],
            {},
            {first["article_id"]: first, second["article_id"]: second},
            {"apolut": {"rank": 5}, "rt_de": {"rank": 1}},
        )
        self.assertEqual(rule, "earliest_reliable_date")
        self.assertEqual(origin["article_id"], first["article_id"])
        self.assertLess(
            datetime.fromisoformat(origin["published_at"]),
            datetime.now(timezone.utc) - timedelta(days=0),
        )


if __name__ == "__main__":
    unittest.main()
