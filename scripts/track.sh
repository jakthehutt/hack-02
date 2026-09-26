#!/usr/bin/env bash
# Refresh crawl → cluster, then optional RT DE narrative scan + watchlist.
#
# crontab example (daily 06:15 local):
#   15 6 * * * /Users/pete/Code/hackathonmisinofrmation/scripts/track.sh >> /Users/pete/Code/hackathonmisinofrmation/data/track.log 2>&1
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f "$ROOT/.venv/bin/activate" ]]; then
  # shellcheck disable=SC1091
  source "$ROOT/.venv/bin/activate"
fi

MAX_PER_SOURCE="${MAX_PER_SOURCE:-200}"
RUN_CRAWL="${RUN_CRAWL:-1}"
RUN_RT_DE="${RUN_RT_DE:-1}"
RUN_WATCHLIST="${RUN_WATCHLIST:-1}"

python "$ROOT/run.py" expand
if [[ "$RUN_CRAWL" == "1" ]]; then
  python "$ROOT/run.py" crawl --max-per-source "$MAX_PER_SOURCE"
fi
python "$ROOT/run.py" extract
python "$ROOT/run.py" cluster

if [[ "$RUN_RT_DE" == "1" ]]; then
  python "$ROOT/App_v01/scripts/fetch_rt_de.py"
  PYTHONPATH="$ROOT/App_v01" python -m services.narratives
fi

if [[ "$RUN_WATCHLIST" == "1" ]]; then
  python "$ROOT/watchlist.py"
fi
