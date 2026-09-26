"""Fine-tune the last two encoder layers and the classifier.

gold_dsn.json is a blocklist, not a score. Sentences that copy it are refused.
Sentences with MiniLM cosine >= 0.8 to any gold sentence are left out.
The run writes the trainable weights only, in fp16.

    python -m services.narratives.roadmap.finetune_dsn
"""

from __future__ import annotations

import json

import torch
from torch.utils.data import DataLoader, Dataset
from transformers import AutoModelForSequenceClassification, AutoTokenizer

from services.narratives.roadmap.config import (
    BATCH,
    EPOCHS,
    FILTERED,
    GOLD,
    HYPOTHESES,
    LR,
    MAX_LENGTH,
    NLI_NAME,
    NLI_REVISION,
    TRAIN,
    set_seed,
)
from services.narratives.roadmap.leak import assert_no_substring_leak, drop_leaks, load_encoder
from services.narratives.roadmap.metrics import scores
from services.narratives.roadmap.nli import predict_items, save_adapter


def pairs_from(rows: list[dict]) -> list[dict]:
    built = []
    for row in rows:
        for narrative, hypothesis in HYPOTHESES.items():
            if row["stance"] == "befuerwortet" and row["narrative"] == narrative:
                label = 0
            elif row["stance"] == "abgelehnt" and row["narrative"] == narrative:
                label = 2
            else:
                label = 1
            built.append({"premise": row["text"], "hypothesis": hypothesis, "label": label})
    return built


class PairSet(Dataset):
    def __init__(self, pairs: list[dict], tokenizer) -> None:
        self.pairs = pairs
        self.tokenizer = tokenizer

    def __len__(self) -> int:
        return len(self.pairs)

    def __getitem__(self, index: int) -> dict:
        row = self.pairs[index]
        encoded = self.tokenizer(
            row["premise"],
            row["hypothesis"],
            truncation=True,
            max_length=MAX_LENGTH,
            padding="max_length",
            return_tensors="pt",
        )
        item = {key: value.squeeze(0) for key, value in encoded.items()}
        item["labels"] = torch.tensor(row["label"])
        return item


def freeze_except_last_layers(model) -> None:
    for param in model.parameters():
        param.requires_grad = False
    for layer in model.deberta.encoder.layer[-2:]:
        for param in layer.parameters():
            param.requires_grad = True
    for param in model.classifier.parameters():
        param.requires_grad = True


def main() -> None:
    set_seed()
    rows = json.loads(TRAIN.read_text(encoding="utf-8"))
    gold = json.loads(GOLD.read_text(encoding="utf-8"))
    assert_no_substring_leak(rows)
    encoder = load_encoder()
    rows, leaks = drop_leaks(rows, gold, encoder)
    del encoder
    print(f"dropped {len(leaks)} train rows with cosine>=0.8 to gold; {len(rows)} remain")
    for hit in leaks:
        print(f"  {hit['cosine']} {hit['gold_id']}  {hit['train_text'][:90]}")

    train_pairs = []
    for pair in pairs_from(rows):
        copies = 4 if pair["label"] != 1 else 1
        train_pairs.extend([pair] * copies)
    counts = {0: 0, 1: 0, 2: 0}
    for pair in train_pairs:
        counts[pair["label"]] += 1
    print(f"premises {len(rows)} pairs {len(train_pairs)} labels {counts}")

    tokenizer = AutoTokenizer.from_pretrained(NLI_NAME, revision=NLI_REVISION, local_files_only=True)
    model = AutoModelForSequenceClassification.from_pretrained(
        NLI_NAME, revision=NLI_REVISION, local_files_only=True
    )
    model.float()
    freeze_except_last_layers(model)
    trainable = sum(param.numel() for param in model.parameters() if param.requires_grad)
    print(f"trainable params {trainable}")
    loader = DataLoader(PairSet(train_pairs, tokenizer), batch_size=BATCH, shuffle=True)
    optimizer = torch.optim.AdamW((param for param in model.parameters() if param.requires_grad), lr=LR)
    model.train()
    for epoch in range(EPOCHS):
        total = 0.0
        seen = 0
        skipped = 0
        for batch in loader:
            labels = batch.pop("labels")
            optimizer.zero_grad()
            logits = model(**batch).logits
            loss = torch.nn.functional.cross_entropy(logits.float(), labels)
            if not torch.isfinite(loss):
                skipped += 1
                continue
            loss.backward()
            torch.nn.utils.clip_grad_norm_((param for param in model.parameters() if param.requires_grad), 1.0)
            optimizer.step()
            total += float(loss.detach()) * labels.size(0)
            seen += labels.size(0)
        print(f"epoch {epoch + 1} loss {total / max(seen, 1):.4f} skipped {skipped}")

    model.eval()
    train_hits = [
        {"text": row["text"], "narrative": row["narrative"], "stance": row["stance"]}
        for row in rows
        if row["stance"] == "befuerwortet"
    ]
    train_summary = scores(
        train_hits,
        predict_items(model, tokenizer, train_hits, {narrative: [text] for narrative, text in HYPOTHESES.items()}),
    )
    print("train", json.dumps({key: train_summary[key] for key in ("precision", "recall", "f1", "n")}, ensure_ascii=False))
    path = save_adapter(model, FILTERED)
    print(f"wrote {path}")


if __name__ == "__main__":
    main()
