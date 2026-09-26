"""Records produced by the crawler."""

from __future__ import annotations

from pathlib import Path
from typing import Iterator

from pydantic import BaseModel, Field


class Article(BaseModel):
    """One fetched article. The RT DE corpus is a JSONL file of these records."""

    source: str
    article_id: int | None = None
    section: str | None = None
    url: str
    title: str | None = None
    author: str | None = None
    date: str | None = None
    description: str | None = None
    categories: str | None = None
    tags: str | None = None
    sitename: str | None = None
    language: str | None = None
    word_count: int = 0
    text: str = ""


class CrawlMeta(BaseModel):
    source_home: str
    extractor: str
    cutoff: str
    cutoff_meaning: str
    skipped_sections: list[str] = Field(default_factory=list)
    discovered_urls: int = 0
    article_count: int = 0
    written_this_run: int = 0
    rejected_this_run: int = 0
    errors_this_run: int = 0
    articles_file: str
    finished_at: str


def iter_articles(path: Path) -> Iterator[Article]:
    with path.open(encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if line:
                yield Article.model_validate_json(line)
