"""Local embedding simulation.

A real deployment would call a hosted embedding model. For Phase 1 we fake a
deterministic, dependency-free vector by hashing token n-grams into a fixed
dimensional bag-of-features. It is good enough to make cosine similarity
behave sensibly for nearest-neighbour retrieval in `memory.py`.
"""

from __future__ import annotations

import math
import re
from typing import List

_TOKEN_RE = re.compile(r"[a-z0-9]+")


def _tokenize(text: str) -> List[str]:
    return _TOKEN_RE.findall(text.lower())


class LocalEmbedder:
    """Hashing embedder producing L2-normalised vectors of fixed dimension."""

    def __init__(self, dimensions: int = 256) -> None:
        if dimensions <= 0:
            raise ValueError("dimensions must be positive")
        self.dimensions = dimensions

    def embed(self, text: str) -> List[float]:
        vec = [0.0] * self.dimensions
        tokens = _tokenize(text)
        for token in tokens:
            bucket = hash(token) % self.dimensions
            vec[bucket] += 1.0
        return _l2_normalise(vec)

    def embed_many(self, texts: List[str]) -> List[List[float]]:
        return [self.embed(t) for t in texts]


def _l2_normalise(vec: List[float]) -> List[float]:
    norm = math.sqrt(sum(v * v for v in vec))
    if norm == 0.0:
        return vec
    return [v / norm for v in vec]


def cosine_similarity(a: List[float], b: List[float]) -> float:
    """Cosine similarity of two equal-length vectors, clamped to [-1, 1]."""
    if len(a) != len(b):
        raise ValueError("vectors must share the same dimension")
    dot = sum(x * y for x, y in zip(a, b))
    return max(-1.0, min(1.0, dot))
