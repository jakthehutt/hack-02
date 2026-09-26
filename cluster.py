"""Copy clusters, mother/daughter edges, and topic windows."""

from __future__ import annotations

import argparse
import json
import math
import re
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any, Iterable

from catalogue import DATA_DIR, source_meta
from extract import load_articles
from simhash import from_hex, hamming
from urls import normalize_url

EDGES_PATH = DATA_DIR / "edges.jsonl"
TOPICS_PATH = DATA_DIR / "topics.jsonl"
ARTICLES_PATH = DATA_DIR / "articles_clustered.jsonl"
HAMMING_MAX = 3
NGRAM_COSINE_MIN = 0.82
TOPIC_WINDOW = timedelta(hours=72)
ENTITY_RE = re.compile(r"\b[\wÀ-ÿ]{4,}\b", re.U)
RANK3_SOURCES = {
    "ria",
    "tass",
    "izvestia",
    "rg",
    "lenta_south_strategic",
}


class UnionFind:
    def __init__(self, items: Iterable[str]) -> None:
        self.parent = {item: item for item in items}

    def find(self, item: str) -> str:
        parent = self.parent[item]
        if parent != item:
            self.parent[item] = self.find(parent)
        return self.parent[item]

    def union(self, a: str, b: str) -> None:
        ra, rb = self.find(a), self.find(b)
        if ra != rb:
            self.parent[rb] = ra


def _dt(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def _ngrams(text: str, n: int = 4) -> dict[str, int]:
    compact = re.sub(r"\s+", " ", (text or "").lower())
    counts: dict[str, int] = defaultdict(int)
    if len(compact) < n:
        counts[compact] += 1
        return counts
    for i in range(len(compact) - n + 1):
        counts[compact[i : i + n]] += 1
    return counts


def _cosine(a: dict[str, int], b: dict[str, int]) -> float:
    if not a or not b:
        return 0.0
    keys = set(a) & set(b)
    num = sum(a[k] * b[k] for k in keys)
    na = math.sqrt(sum(v * v for v in a.values()))
    nb = math.sqrt(sum(v * v for v in b.values()))
    if na == 0 or nb == 0:
        return 0.0
    return num / (na * nb)


def _lead(article: dict[str, Any], n: int = 1500) -> str:
    extracted = article.get("extracted") or {}
    title = extracted.get("title") or ""
    text = extracted.get("text") or ""
    return f"{title}\n{text[:n]}"


GENERIC_ENTITIES = {
    "russland", "ukraine", "deutschland", "amerika", "china", "iran",
    "putin", "trump", "merz", "selensky", "nato", "europa", "berlin",
    "moskau", "kiew", "usa", "eu", "russian", "russia", "germany",
}


def _entities(text: str) -> set[str]:
    return {
        tok.lower()
        for tok in ENTITY_RE.findall(text or "")
        if tok[:1].isupper() and len(tok) >= 5 and tok.lower() not in GENERIC_ENTITIES
    }


def collapse_mirrors(articles: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by_key: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    for article in articles:
        key = (article.get("source_id") or "", article.get("text_sha256") or article["article_id"])
        by_key[key].append(article)
    kept: list[dict[str, Any]] = []
    for group in by_key.values():
        primary = group[0]
        for extra in group[1:]:
            extra["mirror_of"] = primary["article_id"]
        kept.append(primary)
    return kept


def citation_edges(articles: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by_url: dict[str, dict[str, Any]] = {}
    for article in articles:
        for key in (article.get("canonical_url"), article.get("url"), article.get("final_url")):
            if key:
                by_url[normalize_url(key)] = article
    edges: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()
    for article in articles:
        for link in article.get("outbound_links") or []:
            target = by_url.get(normalize_url(link.get("url") or ""))
            if target is None or target["article_id"] == article["article_id"]:
                continue
            if target.get("source_id") and target.get("source_id") == article.get("source_id"):
                continue
            pair = (target["article_id"], article["article_id"])
            if pair in seen:
                continue
            seen.add(pair)
            edges.append(
                _edge(
                    target,
                    article,
                    relation="citation",
                    rule="explicit_citation",
                    similarity=1.0,
                    example=(link.get("anchor") or link.get("url") or "")[:240],
                )
            )
    return edges


def _script(text: str) -> str:
    cyrillic = latin = 0
    for char in text[:2000]:
        if "\u0400" <= char <= "\u04FF":
            cyrillic += 1
        elif "A" <= char <= "Z" or "a" <= char <= "z":
            latin += 1
    return "cyr" if cyrillic > latin else "lat"


SALIENT_RE = re.compile(r"\b[A-Z][\wÀ-ÿ]{3,}\b|\b\d{3,}\b")
SALIENT_STOP = {
    "ukraine",
    "russland",
    "russia",
    "putin",
    "moskau",
    "moscow",
    "berlin",
    "europa",
    "europe",
    "deutschland",
    "germany",
    "nato",
    "usa",
    "amerika",
    "krieg",
    "selenskyj",
    "zelensky",
    "kremlin",
    "kreml",
}


def _salient(article: dict[str, Any]) -> set[str]:
    tokens: set[str] = set()
    for token in SALIENT_RE.findall(_lead(article, 800)):
        lower = token.lower()
        if lower in SALIENT_STOP:
            continue
        if token.isdigit() and len(token) == 4 and token.startswith(("19", "20")):
            continue
        tokens.add(lower)
    return tokens


def duplicate_pairs(articles: list[dict[str, Any]]) -> list[dict[str, Any]]:
    pairs: list[dict[str, Any]] = []
    by_hash: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for article in articles:
        by_hash[article.get("text_sha256") or article["article_id"]].append(article)
    for group in by_hash.values():
        if len(group) < 2:
            continue
        head = group[0]
        for other in group[1:]:
            relation = "mirror" if head.get("source_id") == other.get("source_id") else "near_duplicate"
            pairs.append(_edge(head, other, relation=relation, rule="text_sha256", similarity=1.0))

    ngram_cache: dict[str, dict[str, int]] = {}
    scripts = {article["article_id"]: _script(_lead(article, 400)) for article in articles}
    salient = {article["article_id"]: _salient(article) for article in articles}

    def ngrams_for(article: dict[str, Any]) -> dict[str, int]:
        cached = ngram_cache.get(article["article_id"])
        if cached is None:
            cached = _ngrams(_lead(article))
            ngram_cache[article["article_id"]] = cached
        return cached

    for i, left in enumerate(articles):
        left_hash = from_hex(left["simhash"]) if left.get("simhash") else None
        left_lang = (left.get("extracted") or {}).get("language")
        left_when = _dt(left.get("published_at"))
        for right in articles[i + 1 :]:
            if left["article_id"] == right["article_id"]:
                continue
            if left.get("text_sha256") and left.get("text_sha256") == right.get("text_sha256"):
                continue
            right_lang = (right.get("extracted") or {}).get("language")
            same_lang = bool(left_lang and right_lang and left_lang == right_lang)
            same_script = scripts[left["article_id"]] == scripts[right["article_id"]]
            right_hash = from_hex(right["simhash"]) if right.get("simhash") else None
            distance = (
                hamming(left_hash, right_hash) if left_hash is not None and right_hash is not None else 64
            )
            if same_lang and distance <= HAMMING_MAX:
                pairs.append(
                    _edge(
                        left,
                        right,
                        relation="near_duplicate",
                        rule="simhash",
                        similarity=1 - distance / 64,
                    )
                )
                continue
            if same_script and distance <= 12:
                similarity = _cosine(ngrams_for(left), ngrams_for(right))
                if similarity >= NGRAM_COSINE_MIN:
                    pairs.append(
                        _edge(
                            left,
                            right,
                            relation="near_duplicate" if same_lang else "translation",
                            rule="ngram_cosine",
                            similarity=similarity,
                        )
                    )
                    continue
            if same_script:
                continue
            shared = salient[left["article_id"]] & salient[right["article_id"]]
            if len(shared) < 4:
                continue
            right_when = _dt(right.get("published_at"))
            if left_when is None or right_when is None or abs(left_when - right_when) > timedelta(days=7):
                continue
            union = salient[left["article_id"]] | salient[right["article_id"]]
            pairs.append(
                _edge(
                    left,
                    right,
                    relation="translation",
                    rule="shared_entities",
                    similarity=len(shared) / max(len(union), 1),
                    example=" ".join(sorted(shared)[:8]),
                )
            )
    return pairs


def _lag_hours(parent: dict[str, Any], child: dict[str, Any]) -> float | None:
    a, b = _dt(parent.get("published_at")), _dt(child.get("published_at"))
    if a is None or b is None:
        return None
    return round((b - a).total_seconds() / 3600, 2)


def _edge(
    parent: dict[str, Any],
    child: dict[str, Any],
    *,
    relation: str,
    rule: str,
    similarity: float,
    example: str | None = None,
) -> dict[str, Any]:
    older, newer = parent, child
    parent_dt, child_dt = _dt(parent.get("published_at")), _dt(child.get("published_at"))
    if parent_dt and child_dt and child_dt < parent_dt and relation != "citation":
        older, newer = child, parent
    return {
        "from_article_id": older["article_id"],
        "to_article_id": newer["article_id"],
        "from_source_id": older.get("source_id"),
        "to_source_id": newer.get("source_id"),
        "relation": relation,
        "lag_hours": _lag_hours(older, newer),
        "similarity": round(similarity, 4),
        "rule": rule,
        "example_overlap": (example or _shared_quote(older, newer)),
    }


def _shared_quote(left: dict[str, Any], right: dict[str, Any]) -> str:
    a = re.findall(r".{40,120}", (_lead(left, 800)).replace("\n", " "))
    b_text = _lead(right, 800)
    for chunk in a[:12]:
        if chunk in b_text:
            return chunk[:240]
    return ((left.get("extracted") or {}).get("title") or "")[:240]


def build_copy_clusters(
    articles: list[dict[str, Any]],
    pairs: list[dict[str, Any]],
) -> dict[str, str]:
    uf = UnionFind(a["article_id"] for a in articles)
    for pair in pairs:
        if pair["relation"] in {"mirror", "near_duplicate", "translation"}:
            uf.union(pair["from_article_id"], pair["to_article_id"])
    mapping: dict[str, str] = {}
    roots: dict[str, str] = {}
    for article in articles:
        root = uf.find(article["article_id"])
        cluster_id = roots.setdefault(root, f"cluster_{root[:12]}")
        mapping[article["article_id"]] = cluster_id
        article["copy_cluster_id"] = cluster_id
    return mapping


def assign_mothers(
    articles: list[dict[str, Any]],
    pairs: list[dict[str, Any]],
    meta: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    by_id = {a["article_id"]: a for a in articles}
    by_cluster: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for article in articles:
        by_cluster[article["copy_cluster_id"]].append(article)

    citation_to: dict[str, list[str]] = defaultdict(list)
    for pair in pairs:
        if pair["relation"] == "citation":
            citation_to[pair["to_article_id"]].append(pair["from_article_id"])

    mothers: list[dict[str, Any]] = []
    for cluster_id, members in by_cluster.items():
        origin, rule = _pick_origin(members, citation_to, by_id, meta)
        if origin is None:
            continue
        origin["origin_rule"] = rule
        for member in members:
            if member["article_id"] == origin["article_id"]:
                continue
            if member.get("source_id") == origin.get("source_id"):
                continue
            origin_lang = (origin.get("extracted") or {}).get("language")
            member_lang = (member.get("extracted") or {}).get("language")
            relation = (
                "translation"
                if origin_lang and member_lang and origin_lang != member_lang
                else "near_duplicate"
            )
            mothers.append(
                _edge(
                    origin,
                    member,
                    relation=relation,
                    rule=rule,
                    similarity=1.0,
                )
            )
            mothers[-1]["copy_cluster_id"] = cluster_id
    return mothers


def _pick_origin(
    members: list[dict[str, Any]],
    citation_to: dict[str, list[str]],
    by_id: dict[str, dict[str, Any]],
    meta: dict[str, dict[str, Any]],
) -> tuple[dict[str, Any] | None, str]:
    member_ids = {m["article_id"] for m in members}
    cited_parents: list[dict[str, Any]] = []
    for member in members:
        for parent_id in citation_to.get(member["article_id"], []):
            parent = by_id.get(parent_id)
            if parent and parent["article_id"] in member_ids:
                cited_parents.append(parent)
        for credit in member.get("credits") or []:
            source_id = credit.get("resolved_source_id")
            if not source_id or source_id == member.get("source_id"):
                continue
            for other in members:
                if other.get("source_id") == source_id and other["article_id"] != member["article_id"]:
                    cited_parents.append(other)
    if cited_parents:
        cited_parents.sort(key=lambda a: _dt(a.get("published_at")) or datetime.max.replace(tzinfo=timezone.utc))
        return cited_parents[0], "citation_wins"

    wires = [m for m in members if m.get("source_id") in RANK3_SOURCES]
    if wires:
        wires.sort(key=lambda a: _dt(a.get("published_at")) or datetime.max.replace(tzinfo=timezone.utc))
        return wires[0], "rank3_wire"

    dated = [
        m
        for m in members
        if m.get("date_confidence") == "high" and _dt(m.get("published_at")) is not None
    ]
    if dated:
        dated.sort(key=lambda a: (_dt(a.get("published_at")), meta.get(a.get("source_id") or "", {}).get("rank", 99)))
        return dated[0], "earliest_reliable_date"

    members_sorted = sorted(
        members,
        key=lambda article: (
            meta.get(article.get("source_id") or "", {}).get("rank", 99),
            article["article_id"],
        ),
    )
    return members_sorted[0], "rank_tiebreak"


def build_topics(articles: list[dict[str, Any]], mother_edges: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by_cluster: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for article in articles:
        by_cluster[article["copy_cluster_id"]].append(article)

    cluster_rows: list[dict[str, Any]] = []
    origin_by_cluster = {}
    for edge in mother_edges:
        origin_by_cluster.setdefault(edge.get("copy_cluster_id"), edge["from_article_id"])

    for cluster_id, members in by_cluster.items():
        times = [_dt(m.get("published_at")) for m in members if _dt(m.get("published_at"))]
        start = min(times) if times else None
        entities: set[str] = set()
        for member in members:
            entities |= _entities(_lead(member, 800))
        origin_id = origin_by_cluster.get(cluster_id)
        origin = next((m for m in members if m["article_id"] == origin_id), members[0])
        cluster_rows.append(
            {
                "cluster_id": cluster_id,
                "start": start,
                "entities": entities,
                "origin": origin,
                "members": members,
            }
        )
    cluster_rows.sort(key=lambda row: row["start"] or datetime.max.replace(tzinfo=timezone.utc))

    used: set[str] = set()
    topics: list[dict[str, Any]] = []
    for i, row in enumerate(cluster_rows):
        if row["cluster_id"] in used:
            continue
        window_end = (row["start"] + TOPIC_WINDOW) if row["start"] else None
        group = [row]
        used.add(row["cluster_id"])
        for other in cluster_rows[i + 1 :]:
            if other["cluster_id"] in used:
                continue
            if row["start"] and other["start"] and window_end and other["start"] > window_end:
                break
            overlap = len(row["entities"] & other["entities"])
            if overlap >= 2 and _titles_close(row["origin"], other["origin"]):
                group.append(other)
                used.add(other["cluster_id"])
        topics.append(_topic_from_group(group, len(topics)))
    return topics


def _titles_close(a: dict[str, Any], b: dict[str, Any]) -> bool:
    return _cosine(_ngrams((a.get("extracted") or {}).get("title") or ""), _ngrams((b.get("extracted") or {}).get("title") or "")) >= 0.32


def _topic_from_group(group: list[dict[str, Any]], index: int) -> dict[str, Any]:
    members: list[dict[str, Any]] = []
    for row in group:
        members.extend(row["members"])
    times = [_dt(m.get("published_at")) for m in members if _dt(m.get("published_at"))]
    origins = [row["origin"] for row in group]
    origin = sorted(
        origins,
        key=lambda a: _dt(a.get("published_at")) or datetime.max.replace(tzinfo=timezone.utc),
    )[0]
    titles = [
        (m.get("extracted") or {}).get("title")
        for m in members
        if (m.get("extracted") or {}).get("title")
    ]
    entities: set[str] = set()
    for row in group:
        entities |= row["entities"]
    label, description = label_topic(titles[:5], origin)
    return {
        "topic_id": f"topic_{index:04d}_{origin['article_id'][:8]}",
        "window_start": min(times).isoformat() if times else None,
        "window_end": max(times).isoformat() if times else None,
        "label": label,
        "description": description,
        "entities": sorted(entities)[:40],
        "origin_source_id": origin.get("source_id"),
        "origin_article_id": origin["article_id"],
        "origin_rule": origin.get("origin_rule") or "earliest_cluster_origin",
        "downstream_source_ids": sorted(
            {
                member.get("source_id")
                for member in members
                if member.get("source_id") and member.get("source_id") != origin.get("source_id")
            }
        ),
        "members": [
            {
                "source_id": m.get("source_id"),
                "article_id": m["article_id"],
                "published_at": m.get("published_at"),
                "role": "origin" if m["article_id"] == origin["article_id"] else "relay",
            }
            for m in members
        ],
    }


def label_topic(titles: list[str], origin: dict[str, Any]) -> tuple[str, str]:
    """Heuristic stand-in for an editor agent: name the topic from representative titles."""
    clean = [re.sub(r"\s+", " ", t).strip() for t in titles if t]
    if not clean:
        clean = [(origin.get("extracted") or {}).get("title") or origin.get("source_id") or "untitled"]
    label = clean[0][:120]
    description = "Topic opened by {src}: {title}".format(
        src=origin.get("source_id"),
        title=clean[0][:200],
    )
    if len(clean) > 1:
        description += " Also seen as: " + " / ".join(clean[1:4])
    return label, description


def topic_echo_edges(
    topics: list[dict[str, Any]],
    by_id: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    edges: list[dict[str, Any]] = []
    for topic in topics:
        origin = by_id.get(topic["origin_article_id"])
        if origin is None:
            continue
        seen = {origin.get("copy_cluster_id")}
        for member in topic["members"]:
            article = by_id.get(member["article_id"])
            if article is None:
                continue
            cluster_id = article.get("copy_cluster_id")
            if not cluster_id or cluster_id in seen:
                continue
            seen.add(cluster_id)
            edges.append(
                _edge(
                    origin,
                    article,
                    relation="topic_echo",
                    rule="entity_window",
                    similarity=0.0,
                    example=topic.get("label"),
                )
            )
    return edges


def write_jsonl(path, rows: list[dict[str, Any]]) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=False, default=_json_default) + "\n")


def _json_default(value: Any) -> Any:
    if isinstance(value, set):
        return sorted(value)
    raise TypeError(type(value))


def cluster() -> dict[str, int]:
    articles = load_articles()
    if not articles:
        write_jsonl(EDGES_PATH, [])
        write_jsonl(TOPICS_PATH, [])
        return {"articles": 0, "edges": 0, "topics": 0}

    meta = source_meta()
    unique = collapse_mirrors(articles)
    cite = citation_edges(unique)
    dupes = duplicate_pairs(unique)
    pairs = cite + dupes
    build_copy_clusters(unique, pairs)
    mothers = assign_mothers(unique, pairs, meta)
    topics = build_topics(unique, mothers)
    topic_by_article = {
        member["article_id"]: topic["topic_id"]
        for topic in topics
        for member in topic["members"]
    }
    for article in unique:
        article["topic_id"] = topic_by_article.get(article["article_id"])

    by_id = {article["article_id"]: article for article in unique}
    echoes = topic_echo_edges(topics, by_id)
    edges = pairs + mothers + echoes
    write_jsonl(EDGES_PATH, edges)
    write_jsonl(TOPICS_PATH, topics)
    write_jsonl(ARTICLES_PATH, unique)

    queue = [
        {
            "topic_id": topic["topic_id"],
            "titles": [
                (next((m for m in unique if m["article_id"] == member["article_id"]), {}).get("extracted") or {}).get("title")
                for member in topic["members"][:5]
            ],
            "origin_source_id": topic["origin_source_id"],
        }
        for topic in topics
    ]
    write_jsonl(DATA_DIR / "topic_label_queue.jsonl", queue)
    return {"articles": len(unique), "edges": len(edges), "topics": len(topics)}


def main() -> None:
    parser = argparse.ArgumentParser(description="Cluster articles into copy groups and topics")
    parser.parse_args()
    stats = cluster()
    print(f"clustered {stats['articles']} articles → {stats['edges']} edges, {stats['topics']} topics")


if __name__ == "__main__":
    main()
