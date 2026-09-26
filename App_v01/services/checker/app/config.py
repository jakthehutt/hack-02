from pathlib import Path

# app/config.py → checker → services → App_v01 → repo root
REPO_ROOT = Path(__file__).resolve().parents[4]
SEEDS_DIR = REPO_ROOT / "data" / "seeds"
RULES_DIR = Path(__file__).resolve().parents[1] / "rules"
CHECKER_VERSION = "0.1.0-hackathon"
