"""Closed lexical codebook.

A hit is a sentence that contains the pattern, in German or Russian.
It is a provenance signal about wording, not a finding that the sentence is false.
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
        r"kiewer regime|киевск\w* режим",
    ),
    Pattern(
        "russophobia",
        "frame",
        "Russophobie",
        r"russophob|russlandfeind|russlandhass|русофоб",
    ),
    Pattern(
        "ukraine_fascist",
        "frame",
        "Ukraine als faschistisch",
        r"(asow|asov|bander).{0,60}(faschist|nazi)|(faschist|nazi).{0,60}(asow|asov|bander|ukrain)|(?:азов|бандер)\w*.{0,60}(?:фашист|нацист)|(?:фашист|нацист)\w*.{0,60}(?:азов|бандер|украин)",
    ),
    Pattern(
        "vassal_proxy",
        "frame",
        "Vasall / Stellvertreterkrieg",
        r"stellvertreterkrieg|vasallenmodus|vasallenstaat|vasall(?:en)? der |прокси-войн|вассал",
    ),
    Pattern(
        "deindustrialization",
        "frame",
        "Deindustrialisierung",
        r"deindustrial|деиндустриал",
    ),
    Pattern(
        "afd_ban",
        "frame",
        "AfD-Verbot",
        r"afd-verbot|verbotsverfahren gegen die afd|запрет\w{0,3} адг|адг.{0,30}запрет",
    ),
    Pattern(
        "nord_stream",
        "frame",
        "Nord Stream",
        r"nord stream|nordstream|северн\w* поток",
    ),
    Pattern(
        "hormuz",
        "subject",
        "Straße von Hormus",
        r"straße von hormus|strasse von hormus|ормузск",
    ),
    Pattern(
        "sachsen_anhalt",
        "subject",
        "Sachsen-Anhalt",
        r"sachsen-anhalt|sachsen anhalt|саксон\w*-анхальт",
    ),
)
