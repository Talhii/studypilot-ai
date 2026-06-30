"""Ephemeral quiz answer-key cache.

A generated quiz's correct answers must be remembered between `generate` and
`submit` so the server can grade a submission that only carries selected option
indices. This is transient grading state — not part of the persisted schema —
so it stays in-memory regardless of the database backend, keyed by
(user_id, material_id) for isolation.
"""

from __future__ import annotations

import threading
from typing import Dict, List, Tuple

from app.models.schemas import QuizQuestionItem


class QuizKeyCache:
    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._keys: Dict[Tuple[str, str], List[QuizQuestionItem]] = {}

    def save(
        self, user_id: str, material_id: str, questions: List[QuizQuestionItem]
    ) -> None:
        with self._lock:
            self._keys[(user_id, material_id)] = list(questions)

    def get(self, user_id: str, material_id: str) -> List[QuizQuestionItem]:
        with self._lock:
            return list(self._keys.get((user_id, material_id), []))


# Process-wide singleton.
quiz_keys = QuizKeyCache()
