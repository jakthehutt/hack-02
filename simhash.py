"""64-bit SimHash over character 3-grams."""

from __future__ import annotations

import hashlib


def _tokens(text: str) -> list[str]:
    compact = " ".join((text or "").lower().split())
    if len(compact) < 3:
        return [compact]
    return [compact[i : i + 3] for i in range(len(compact) - 2)]


def simhash64(text: str) -> int:
    counts = [0] * 64
    for token in _tokens(text):
        digest = hashlib.md5(token.encode("utf-8")).digest()
        value = int.from_bytes(digest[:8], "big")
        for i in range(64):
            counts[i] += 1 if (value >> i) & 1 else -1
    out = 0
    for i, count in enumerate(counts):
        if count >= 0:
            out |= 1 << i
    return out


def hamming(a: int, b: int) -> int:
    return (a ^ b).bit_count()


def as_hex(value: int) -> str:
    return f"{value:016x}"


def from_hex(value: str) -> int:
    return int(value, 16)
