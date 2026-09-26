"""Versioned codebook. Only status=active frames are counted."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CODEBOOK_PATH = ROOT / "data" / "codebook.json"
KINDS = {"frame", "subject"}
STATUSES = {"active", "retired"}


@dataclass(frozen=True)
class Frame:
    id: str
    version: str
    kind: str
    label: str
    pattern: str
    target: str | None
    euvsdisinfo_id: str | None
    status: str

    def compile(self) -> re.Pattern[str]:
        return re.compile(self.pattern, re.IGNORECASE)


def load_codebook(path: Path | None = None) -> dict:
    raw = json.loads((path or CODEBOOK_PATH).read_text(encoding="utf-8"))
    version = str(raw.get("version") or "")
    if not version:
        raise ValueError("codebook is missing version")
    frames: list[Frame] = []
    seen: set[str] = set()
    for entry in raw.get("frames") or []:
        frame_id = str(entry.get("id") or "")
        if not frame_id or frame_id in seen:
            raise ValueError(f"duplicate or empty frame id: {frame_id!r}")
        seen.add(frame_id)
        kind = entry.get("kind")
        status = entry.get("status")
        pattern = entry.get("pattern")
        if kind not in KINDS:
            raise ValueError(f"{frame_id}: kind must be frame or subject")
        if status not in STATUSES:
            raise ValueError(f"{frame_id}: status must be active or retired")
        if not pattern:
            raise ValueError(f"{frame_id}: pattern is required")
        frame = Frame(
            id=frame_id,
            version=str(entry.get("version") or version),
            kind=kind,
            label=str(entry.get("label") or frame_id),
            pattern=str(pattern),
            target=entry.get("target"),
            euvsdisinfo_id=entry.get("euvsdisinfo_id"),
            status=status,
        )
        frame.compile()
        frames.append(frame)
    return {"version": version, "note": raw.get("note"), "frames": frames}


def active_frames(book: dict | None = None) -> list[Frame]:
    book = book if book is not None else load_codebook()
    return [frame for frame in book["frames"] if frame.status == "active"]
