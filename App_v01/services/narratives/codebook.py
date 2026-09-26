"""Closed lexical codebook.

Patterns are loaded from data/codebook.json. Only status=active entries are
exported. A hit is a sentence that contains the pattern. It is a provenance
signal about wording, not a finding that the sentence is false.
"""

from __future__ import annotations

import sys
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from codebook import active_frames, load_codebook


@dataclass(frozen=True)
class Pattern:
    id: str
    kind: str  # "frame" is a claim wording; "subject" is what the article is about
    label: str
    pattern: str


def _patterns() -> tuple[Pattern, ...]:
    return tuple(
        Pattern(frame.id, frame.kind, frame.label, frame.pattern)
        for frame in active_frames(load_codebook())
    )


PATTERNS: tuple[Pattern, ...] = _patterns()
