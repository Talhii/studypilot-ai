"""Semantic memory — document-scoped chunk cache + cosine retrieval.

Phase 2: every uploaded material is segmented into overlapping character chunks
and persisted in a process-global runtime cache keyed by the material's UUID
(`_MATERIAL_CHUNKS`). Chat retrieval can be scoped to a single material or run
across the whole cache.
"""

from __future__ import annotations

import threading
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

from app.rag.embeddings import LocalEmbedder, cosine_similarity

# Chunking parameters (characters).
CHUNK_SIZE: int = 500
CHUNK_OVERLAP: int = 100

# Global in-memory cache: material UUID -> ordered list of text chunks.
_MATERIAL_CHUNKS: Dict[str, List[str]] = {}

_lock = threading.RLock()
_embedder = LocalEmbedder()


@dataclass
class RetrievedChunk:
    material_id: str
    text: str
    score: float


def chunk_text(
    text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP
) -> List[str]:
    """Split text into sequential chunks with a sliding-window overlap.

    Whitespace is normalised first so chunk sizes are predictable regardless of
    how the source formatting laid out newlines and spacing.
    """
    cleaned = " ".join(text.split())
    if not cleaned:
        return []
    if len(cleaned) <= chunk_size:
        return [cleaned]

    step = max(1, chunk_size - overlap)
    chunks: List[str] = []
    start = 0
    while start < len(cleaned):
        chunk = cleaned[start : start + chunk_size].strip()
        if chunk:
            chunks.append(chunk)
        if start + chunk_size >= len(cleaned):
            break
        start += step
    return chunks


def ingest_material(material_id: str, text: str) -> int:
    """Chunk a material's text and persist it. Returns the chunk count."""
    chunks = chunk_text(text)
    with _lock:
        _MATERIAL_CHUNKS[material_id] = chunks
    return len(chunks)


def get_material_chunks(material_id: str) -> List[str]:
    """Return the cached chunks for a single material (empty if unknown)."""
    with _lock:
        return list(_MATERIAL_CHUNKS.get(material_id, []))


def _search_pool(
    material_id: Optional[str], allowed_material_ids: Optional[List[str]]
) -> List[Tuple[str, str]]:
    """Build the (material_id, chunk) search pool.

    Scoped strictly to one material when `material_id` is supplied. Otherwise
    the pool spans the whole cache, optionally restricted to a user's own
    material ids via `allowed_material_ids` (None = no restriction).
    """
    allowed = set(allowed_material_ids) if allowed_material_ids is not None else None
    with _lock:
        if material_id is not None:
            return [(material_id, c) for c in _MATERIAL_CHUNKS.get(material_id, [])]
        return [
            (mid, chunk)
            for mid, chunks in _MATERIAL_CHUNKS.items()
            if allowed is None or mid in allowed
            for chunk in chunks
        ]


def search(
    query: str,
    material_id: Optional[str] = None,
    top_k: int = 3,
    min_score: float = 0.0,
    allowed_material_ids: Optional[List[str]] = None,
) -> List[RetrievedChunk]:
    """Cosine nearest-neighbour search over the (optionally scoped) pool."""
    pool = _search_pool(material_id, allowed_material_ids)
    if not pool:
        return []

    query_vec = _embedder.embed(query)
    # Embeddings are recomputed per query for the Phase 2 mock; a real backend
    # would persist chunk vectors alongside the text.
    scored = [
        RetrievedChunk(
            material_id=mid,
            text=chunk,
            score=cosine_similarity(query_vec, _embedder.embed(chunk)),
        )
        for mid, chunk in pool
    ]
    scored = [s for s in scored if s.score >= min_score]
    scored.sort(key=lambda s: s.score, reverse=True)
    return scored[:top_k]


def reset() -> None:
    """Clear the cache (test/util helper)."""
    with _lock:
        _MATERIAL_CHUNKS.clear()
