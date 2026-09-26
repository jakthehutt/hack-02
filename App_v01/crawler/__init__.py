"""Crawler model: one record per fetched article."""

from crawler.models import Article, CrawlMeta, iter_articles

__all__ = ["Article", "CrawlMeta", "iter_articles"]
