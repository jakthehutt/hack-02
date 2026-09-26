"""Shared constants for the narrative ML checks.

Thresholds and the short hypotheses are fixed here so training and evaluation
use the same text and the same cutoffs.
"""

from __future__ import annotations

import random
from pathlib import Path

import numpy as np
import torch

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[3]
GOLD = HERE / "gold_dsn.json"
TRAIN = HERE / "train_dsn.json"
NARRATIVES = REPO / "narratives.json"
RUNS = HERE / "runs"
WEIGHTS = HERE.parent / "checkpoints"
CHECKPOINT = WEIGHTS / "dsn-nli"
FILTERED = WEIGHTS / "dsn-nli-filtered"

NLI_NAME = "MoritzLaurer/mDeBERTa-v3-base-xnli-multilingual-nli-2mil7"
NLI_REVISION = "b5113eb38ab63efdd7f280f8c144ea8b13f978ce"
EMB_NAME = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
EMB_REVISION = "e8f8c211226b894fcb81acc59f3b34ba3efd5f42"

MAX_LENGTH = 256
ENTAIL_FLOOR = 0.50
COSINE_FLOOR = 0.45
LEAK_COSINE = 0.80
SEED = 7
BOOTSTRAP_DRAWS = 1000

EPOCHS = 6
LR = 2e-5
BATCH = 8
INFER_BATCH = 16

PEAK_MIN_N = 5
HAMMING_MAX = 3
SCAN_CUTOFF = "2026-05-26"
SCAN_METHOD = (
    "German wording only; one quote required; "
    "simhash dedup (hamming<=3) before shares; peak requires n>=5"
)

# One hypothesis per narrative. The fine-tune was trained on these sentences.
HYPOTHESES = {
    1: "Die Unterstützung der Ukraine ist sinnlos.",
    2: "Sanktionen gegen Russland schaden Europa selbst.",
    3: "Ohne russisches Gas droht Europa im Winter eine Versorgungskrise.",
    4: "Der Verzicht auf russische Energie führt zur Deindustrialisierung Europas.",
    5: "Die EU militarisiert sich und treibt Europa in einen Krieg mit Russland.",
}

# Short guideline points, scored separately. Max entailment is the ensemble.
ENSEMBLE = {
    1: [
        HYPOTHESES[1],
        "Der Krieg gegen Russland ist für die Ukraine nicht zu gewinnen.",
        "Geld und Waffen für die Ukraine sind Verschwendung.",
        "Weitere Lieferungen verlängern nur das Leid.",
    ],
    2: [
        HYPOTHESES[2],
        "Die Sanktionen gegen Russland wirken wie ein Bumerang.",
        "Sanktionen verursachen die Teuerung im eigenen Land.",
        "Die Sanktionen schaden dem eigenen Land mehr als Russland.",
    ],
    3: [
        HYPOTHESES[3],
        "Ohne russisches Gas droht Europa ein Blackout im Winter.",
        "Die Gasspeicher laufen ohne russisches Gas leer.",
        "LNG aus Übersee ersetzt russisches Pipelinegas nicht.",
    ],
    4: [
        HYPOTHESES[4],
        "Hohe Energiepreise zerstören die europäische Industrie.",
        "Unternehmen wandern ab, weil Europa auf russische Energie verzichtet.",
        "Europas Wohlstand hängt an billiger russischer Energie.",
    ],
    5: [
        HYPOTHESES[5],
        "Die EU wird von einem Friedensprojekt zu einer Kriegsunion.",
        "Die russische Bedrohung ist ein Vorwand für die Aufrüstung.",
        "Neutrale Staaten werden schrittweise in die NATO gedrängt.",
    ],
}


def set_seed(seed: int = SEED) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)


def versions() -> dict:
    import transformers

    return {
        "nli": {"name": NLI_NAME, "revision": NLI_REVISION},
        "embedding": {"name": EMB_NAME, "revision": EMB_REVISION},
        "torch": torch.__version__,
        "transformers": transformers.__version__,
        "seed": SEED,
        "max_length": MAX_LENGTH,
        "entail_floor": ENTAIL_FLOOR,
        "cosine_floor": COSINE_FLOOR,
        "leak_cosine": LEAK_COSINE,
    }
