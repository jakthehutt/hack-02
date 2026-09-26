from typing import Any
from uuid import UUID, uuid4

from pydantic import BaseModel, Field, HttpUrl


class CheckRequest(BaseModel):
    url: HttpUrl
    options: dict[str, Any] | None = None


class FetchResult(BaseModel):
    status: str = "error"
    http_status: int | None = None
    title: str | None = None
    text_excerpt: str | None = None
    outbound_domains: list[str] = Field(default_factory=list)


class Signal(BaseModel):
    id: str
    weight: int
    summary: str
    evidence: dict[str, Any] = Field(default_factory=dict)


class EuResourceLink(BaseModel):
    country: str | None = None
    label: str
    url: str


class EuContext(BaseModel):
    inferred_targets: list[str] = Field(default_factory=list)
    language_hint: str | None = None
    topic_tags: list[str] = Field(default_factory=list)
    resources: list[EuResourceLink] = Field(default_factory=list)


class DuplicateHit(BaseModel):
    url: str
    similarity: float


class ReportMeta(BaseModel):
    checker_version: str
    seed_versions: dict[str, str] = Field(default_factory=dict)
    generated_at: str
    disclaimer: str = (
        "Automated signals only — not a fact-check. Unknown or low score does not mean content is true."
    )


class CheckReport(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    input_url: str
    final_url: str
    redirect_chain: list[str] = Field(default_factory=list)
    fetch: FetchResult = Field(default_factory=FetchResult)
    score: int = 0
    verdict_band: str = "low"
    signals: list[Signal] = Field(default_factory=list)
    eu_context: EuContext = Field(default_factory=EuContext)
    duplicates: list[DuplicateHit] = Field(default_factory=list)
    meta: ReportMeta
