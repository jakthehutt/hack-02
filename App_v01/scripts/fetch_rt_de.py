#!/usr/bin/env python3
"""Run the RT DE crawler. Corpus lands in crawler/data/rt_de/."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from crawler.rt_de import main

if __name__ == "__main__":
    main()
