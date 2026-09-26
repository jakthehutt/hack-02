"""Closed lexical codebook for the first RT DE pass.

A hit is a sentence that contains the pattern. It is a provenance signal
about wording, not a finding that the sentence is false.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Pattern:
    id: str
    kind: str  # "frame" is a claim wording; "subject" is what the article is about
    label: str
    pattern: str


PATTERNS: tuple[Pattern, ...] = (
    Pattern(
        "kiewer_regime",
        "frame",
        "Kiewer Regime",
        r"kiewer regime",
    ),
    Pattern(
        "russophobia",
        "frame",
        "Russophobie",
        r"russophob|russlandfeind|russlandhass",
    ),
    Pattern(
        "ukraine_fascist",
        "frame",
        "Ukraine als faschistisch",
        r"(asow|asov|bander).{0,60}(faschist|nazi)|(faschist|nazi).{0,60}(asow|asov|bander|ukrain)",
    ),
    Pattern(
        "vassal_proxy",
        "frame",
        "Vasall / Stellvertreterkrieg",
        r"stellvertreterkrieg|vasallenmodus|vasallenstaat|vasall(?:en)? der ",
    ),
    Pattern(
        "deindustrialization",
        "frame",
        "Deindustrialisierung",
        r"deindustrial",
    ),
    Pattern(
        "afd_ban",
        "frame",
        "AfD-Verbot",
        r"afd-verbot|verbotsverfahren gegen die afd",
    ),
    Pattern(
        "nord_stream",
        "frame",
        "Nord Stream",
        r"nord stream|nordstream",
    ),
    Pattern(
        "hormuz",
        "subject",
        "Straße von Hormus",
        r"straße von hormus|strasse von hormus",
    ),
    Pattern(
        "sachsen_anhalt",
        "subject",
        "Sachsen-Anhalt",
        r"sachsen-anhalt|sachsen anhalt",
    ),
)
