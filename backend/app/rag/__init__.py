"""Retrieval-augmented-generation layer (local simulation for Phase 1/2)."""

from app.rag.embeddings import LocalEmbedder, cosine_similarity
from app.rag.memory import (
    CHUNK_OVERLAP,
    CHUNK_SIZE,
    RetrievedChunk,
    chunk_text,
    get_material_chunks,
    ingest_material,
    search,
)

__all__ = [
    "LocalEmbedder",
    "cosine_similarity",
    "CHUNK_OVERLAP",
    "CHUNK_SIZE",
    "RetrievedChunk",
    "chunk_text",
    "get_material_chunks",
    "ingest_material",
    "search",
]
