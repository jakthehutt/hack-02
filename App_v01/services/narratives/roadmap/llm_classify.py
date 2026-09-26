"""Label German text with the five DSN narratives using a local Ollama model.

The prompt is built from narratives.json and was written once, before looking
at scores. The quote the model returns must appear verbatim in the input.

    python -m services.narratives.roadmap.llm_classify
    python -m services.narratives.roadmap.llm_classify --model qwen3:8b
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import time
from pathlib import Path

import httpx

from services.narratives.roadmap.config import GOLD, NARRATIVES
from services.narratives.roadmap.metrics import scores

HERE = Path(__file__).resolve().parent
CACHE = HERE / ".llm_cache" / "responses.jsonl"
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
DEFAULT_MODEL = os.environ.get("OLLAMA_MODEL", "gemma4:e2b-mxfp8")
PROMPT_VERSION = "v1"


def load_narratives() -> list[dict]:
    return json.loads(NARRATIVES.read_text(encoding="utf-8"))["narratives"]


def dump(name: str, gold: list[dict], preds: list[dict]) -> None:
    print(f"\n== {name}")
    print(json.dumps(scores(gold, preds), ensure_ascii=False))
    for item, pred in zip(gold, preds):
        ok = (item["stance"] == "none" and pred["stance"] == "none") or (
            pred["narrative"] == item["narrative"] and pred["stance"] == item["stance"]
        )
        if ok:
            continue
        print(
            f"  MISS {item['id']} gold={item['narrative']}/{item['stance']} "
            f"pred={pred['narrative']}/{pred['stance']} {pred['score']} {pred.get('detail', '')}"
        )

INSTRUCTIONS = """Du bist ein sorgfältiger Annotator für Desinformationsforschung.
Du bekommst einen deutschen Text und eine Liste von Narrativen mit Codierregeln.

Für jedes Narrativ entscheidest du:
- "befuerwortet": Der Text vertritt oder stützt das Narrativ (siehe "Befürwortet").
- "abgelehnt": Der Text widerspricht dem Narrativ ausdrücklich (siehe "Abgelehnt").
- Sonst gib das Narrativ nicht aus.

Regeln:
- Nur das Thema zu erwähnen reicht nicht. Es muss eine Aussage zum Narrativ geben.
- Zitate Dritter zählen, wenn die zitierte Person die Aussage vertritt.
- Ein Text kann mehrere Narrative betreffen.
- "quote" ist ein wörtlicher Ausschnitt aus dem Text, der die Entscheidung belegt.
- "confidence" liegt zwischen 0 und 1.
- Wenn kein Narrativ passt, gib eine leere Liste zurück.

Narrative:
"""

SCHEMA = {
    "type": "object",
    "properties": {
        "matches": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "narrative": {"type": "integer", "enum": [1, 2, 3, 4, 5]},
                    "stance": {"type": "string", "enum": ["befuerwortet", "abgelehnt"]},
                    "quote": {"type": "string"},
                    "confidence": {"type": "number"},
                },
                "required": ["narrative", "stance", "quote", "confidence"],
            },
        }
    },
    "required": ["matches"],
}


def system_prompt(narratives: list[dict]) -> str:
    blocks = []
    for item in narratives:
        guidelines = item["narrative_guidelines"].replace("**", "")
        blocks.append(f"[{item['id']}] {item['narrative_statement']}\n{guidelines}")
    return INSTRUCTIONS + "\n\n".join(blocks)


def norm(text: str) -> str:
    return re.sub(r"\W+", " ", text.lower()).strip()


def load_cache() -> dict[str, dict]:
    if not CACHE.exists():
        return {}
    cache = {}
    for line in CACHE.open(encoding="utf-8"):
        if line.strip():
            row = json.loads(line)
            cache[row["key"]] = row["response"]
    return cache


def cache_key(model: str, system: str, text: str) -> str:
    payload = f"{PROMPT_VERSION}\n{model}\n{system}\n{text}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def ask(client: httpx.Client, model: str, system: str, text: str) -> dict:
    body = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": f"Text:\n{text}"},
        ],
        "format": SCHEMA,
        "stream": False,
        "think": False,
        "options": {"temperature": 0, "seed": 7},
    }
    response = client.post(f"{OLLAMA_URL}/api/chat", json=body)
    response.raise_for_status()
    return json.loads(response.json()["message"]["content"])


def grounded(matches: list[dict], text: str) -> tuple[list[dict], int]:
    """Drop matches whose quote is not in the text."""
    haystack = norm(text)
    kept = [match for match in matches if norm(match.get("quote") or "") and norm(match["quote"]) in haystack]
    return kept, len(matches) - len(kept)


def classify(texts: list[str], model: str, narratives: list[dict]) -> list[dict]:
    system = system_prompt(narratives)
    cache = load_cache()
    CACHE.parent.mkdir(parents=True, exist_ok=True)
    results = []
    with httpx.Client(timeout=300) as client, CACHE.open("a", encoding="utf-8") as sink:
        for text in texts:
            key = cache_key(model, system, text)
            if key not in cache:
                started = time.time()
                cache[key] = ask(client, model, system, text)
                sink.write(json.dumps({"key": key, "model": model, "response": cache[key]}, ensure_ascii=False) + "\n")
                sink.flush()
                print(f"  {time.time() - started:5.1f}s  {text[:70]}")
            matches, dropped = grounded(cache[key].get("matches") or [], text)
            results.append({"matches": matches, "dropped_ungrounded": dropped})
    return results


def to_single(result: dict) -> dict:
    """Collapse multi-label output to the single label gold_dsn.json uses."""
    matches = result["matches"]
    for stance in ("befuerwortet", "abgelehnt"):
        picked = [match for match in matches if match["stance"] == stance]
        if picked:
            best = max(picked, key=lambda match: match.get("confidence") or 0)
            others = ",".join(f"{m['narrative']}/{m['stance'][:5]}" for m in matches if m is not best)
            return {
                "narrative": best["narrative"],
                "stance": stance,
                "score": round(float(best.get("confidence") or 0), 2),
                "detail": f"also={others}" if others else "",
            }
    return {"narrative": None, "stance": "none", "score": 0.0, "detail": ""}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", default=DEFAULT_MODEL)
    args = parser.parse_args()

    gold = json.loads(GOLD.read_text(encoding="utf-8"))
    narratives = load_narratives()
    started = time.time()
    results = classify([item["text"] for item in gold], args.model, narratives)
    preds = [to_single(result) for result in results]
    dropped = sum(result["dropped_ungrounded"] for result in results)
    dump(f"llm {args.model} prompt {PROMPT_VERSION}", gold, preds)
    print(f"ungrounded quotes dropped {dropped}  wall {time.time() - started:.0f}s")
    summary = scores(gold, preds)
    summary["model"] = args.model
    print(json.dumps(summary, ensure_ascii=False))


if __name__ == "__main__":
    main()
