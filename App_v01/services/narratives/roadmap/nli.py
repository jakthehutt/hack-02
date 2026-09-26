"""Batched XNLI scoring against one or many short hypotheses."""

from __future__ import annotations

from pathlib import Path

import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer

from services.narratives.roadmap.config import (
    ENTAIL_FLOOR,
    FILTERED,
    INFER_BATCH,
    MAX_LENGTH,
    NLI_NAME,
    NLI_REVISION,
)


def _label_index(model, name: str) -> int:
    for key, label in model.config.id2label.items():
        if str(label).lower() == name:
            return int(key)
    raise KeyError(name)


def load_nli(checkpoint: Path | None = None):
    tokenizer = AutoTokenizer.from_pretrained(NLI_NAME, revision=NLI_REVISION, local_files_only=True)
    adapter = None if checkpoint is None else checkpoint / "trainable.pt"
    if adapter is not None and adapter.exists():
        model = AutoModelForSequenceClassification.from_pretrained(
            NLI_NAME, revision=NLI_REVISION, local_files_only=True
        )
        blob = torch.load(adapter, map_location="cpu", weights_only=True)
        state = {name: tensor.float() for name, tensor in blob["state"].items()}
        model.load_state_dict(state, strict=False)
    elif checkpoint is not None and (checkpoint / "config.json").exists():
        tokenizer = AutoTokenizer.from_pretrained(checkpoint, local_files_only=True)
        model = AutoModelForSequenceClassification.from_pretrained(checkpoint, local_files_only=True)
    else:
        model = AutoModelForSequenceClassification.from_pretrained(
            NLI_NAME, revision=NLI_REVISION, local_files_only=True
        )
    model.float()
    model.eval()
    return tokenizer, model


def save_adapter(model, directory: Path) -> Path:
    directory.mkdir(parents=True, exist_ok=True)
    last = model.config.num_hidden_layers
    keep = {last - 2, last - 1}
    state = {}
    marker = "encoder.layer."
    for name, param in model.named_parameters():
        take = name.startswith("classifier.")
        if marker in name:
            index = int(name.split(marker, 1)[1].split(".", 1)[0])
            take = index in keep
        if take:
            state[name] = param.detach().to(dtype=torch.float16).cpu()
    path = directory / "trainable.pt"
    torch.save(
        {"base": NLI_NAME, "revision": NLI_REVISION, "layers": sorted(keep), "state": state},
        path,
    )
    return path


def pairwise_probs(model, tokenizer, premises: list[str], hypotheses: list[str]) -> list[tuple[float, float]]:
    entail_i = _label_index(model, "entailment")
    contradict_i = _label_index(model, "contradiction")
    out: list[tuple[float, float]] = []
    with torch.no_grad():
        for start in range(0, len(premises), INFER_BATCH):
            batch_p = premises[start : start + INFER_BATCH]
            batch_h = hypotheses[start : start + INFER_BATCH]
            inputs = tokenizer(
                batch_p,
                batch_h,
                padding=True,
                truncation=True,
                max_length=MAX_LENGTH,
                return_tensors="pt",
            )
            probs = torch.softmax(model(**inputs).logits.float(), dim=-1)
            for row in probs:
                out.append((float(row[entail_i]), float(row[contradict_i])))
    return out


def predict_items(model, tokenizer, items: list[dict], hypotheses: dict[int, list[str]], allow_abgelehnt: bool = True) -> list[dict]:
    premises: list[str] = []
    hyps: list[str] = []
    index: list[tuple[int, int]] = []
    for item_i, item in enumerate(items):
        for narrative, options in hypotheses.items():
            for hypothesis in options:
                premises.append(item["text"])
                hyps.append(hypothesis)
                index.append((item_i, narrative))
    probs = pairwise_probs(model, tokenizer, premises, hyps) if premises else []
    grouped: list[list[tuple[int, float, float]]] = [[] for _ in items]
    for (item_i, narrative), (entail, contradict) in zip(index, probs):
        grouped[item_i].append((narrative, entail, contradict))
    preds = []
    for rows in grouped:
        best_for = None
        best_against = None
        for narrative, entail, contradict in rows:
            if entail >= ENTAIL_FLOOR and entail >= contradict and (best_for is None or entail > best_for[0]):
                best_for = (entail, narrative)
            if (
                allow_abgelehnt
                and contradict >= ENTAIL_FLOOR
                and contradict > entail
                and (best_against is None or contradict > best_against[0])
            ):
                best_against = (contradict, narrative)
        if best_for is not None:
            preds.append(
                {
                    "narrative": best_for[1],
                    "stance": "befuerwortet",
                    "score": round(best_for[0], 3),
                    "detail": "",
                }
            )
        elif best_against is not None:
            preds.append(
                {
                    "narrative": best_against[1],
                    "stance": "abgelehnt",
                    "score": round(best_against[0], 3),
                    "detail": "",
                }
            )
        else:
            preds.append({"narrative": None, "stance": "none", "score": 0.0, "detail": ""})
    return preds


def filtered_checkpoint() -> Path | None:
    if (FILTERED / "trainable.pt").exists():
        return FILTERED
    return None
