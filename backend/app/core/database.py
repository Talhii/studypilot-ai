"""Persistence layer.

A small repository abstraction over the four Supabase tables (`users`,
`uploaded_materials`, `quizzes`, `doubt_notebook`). When SUPABASE_URL + key are
configured the `SupabaseDatabase` talks to Postgres; otherwise an
`InMemoryDatabase` keeps the app fully runnable with zero credentials. Both
implement the same interface, so the routers never branch on the backend.

All access methods are scoped by `user_id` so a request can only ever touch the
authenticated user's rows.
"""

from __future__ import annotations

import logging
import threading
import uuid
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Dict, List, Optional

from app import config
from app.models.schemas import DoubtItem, FileFormat, MaterialSummary, UserProfile

logger = logging.getLogger("studypilot.database")

try:  # Optional — absence forces the in-memory backend.
    from supabase import create_client
except ImportError:  # pragma: no cover - exercised only without the dep
    create_client = None  # type: ignore[assignment]


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _format_from_name(file_name: str) -> FileFormat:
    ext = file_name.rsplit(".", 1)[-1].lower() if "." in file_name else "txt"
    try:
        return FileFormat(ext)
    except ValueError:
        return FileFormat.txt


# ==========================================================================
# Interface
# ==========================================================================
class Database(ABC):
    # --- users -----------------------------------------------------------
    @abstractmethod
    def get_or_create_user(
        self,
        user_id: str,
        name: Optional[str] = None,
        email: Optional[str] = None,
        university: Optional[str] = None,
        semester: Optional[str] = None,
    ) -> UserProfile: ...

    @abstractmethod
    def get_user(self, user_id: str) -> Optional[UserProfile]: ...

    # --- uploaded_materials ---------------------------------------------
    @abstractmethod
    def insert_material(self, material: MaterialSummary) -> MaterialSummary: ...

    @abstractmethod
    def list_materials(self, user_id: str) -> List[MaterialSummary]: ...

    @abstractmethod
    def get_material(
        self, user_id: str, material_id: str
    ) -> Optional[MaterialSummary]: ...

    # --- quizzes ---------------------------------------------------------
    @abstractmethod
    def insert_quiz_result(
        self,
        user_id: str,
        material_id: Optional[str],
        score: float,
        topic_mastery: Dict[str, float],
    ) -> None: ...

    @abstractmethod
    def count_quizzes(self, user_id: str) -> int: ...

    # --- doubt_notebook --------------------------------------------------
    @abstractmethod
    def insert_doubt(
        self,
        user_id: str,
        material_id: Optional[str],
        question_text: str,
        ai_answer_text: str,
    ) -> DoubtItem: ...

    @abstractmethod
    def list_doubts(self, user_id: str) -> List[DoubtItem]: ...

    # --- metrics ---------------------------------------------------------
    @abstractmethod
    def study_velocity_hours(self, user_id: str) -> float: ...


# ==========================================================================
# In-memory implementation (default)
# ==========================================================================
class InMemoryDatabase(Database):
    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._users: Dict[str, UserProfile] = {}
        self._materials: Dict[str, Dict[str, MaterialSummary]] = {}
        self._quizzes: Dict[str, List[dict]] = {}
        self._doubts: Dict[str, List[DoubtItem]] = {}

    def get_or_create_user(
        self, user_id, name=None, email=None, university=None, semester=None
    ) -> UserProfile:
        with self._lock:
            user = self._users.get(user_id)
            if user is None:
                user = UserProfile(
                    id=user_id,
                    name=name or "Student",
                    email=email,
                    university=university,
                    semester=semester,
                    created_at=_utcnow(),
                )
                self._users[user_id] = user
            return user

    def get_user(self, user_id) -> Optional[UserProfile]:
        with self._lock:
            return self._users.get(user_id)

    def insert_material(self, material: MaterialSummary) -> MaterialSummary:
        with self._lock:
            self._materials.setdefault(material.user_id, {})[material.id] = material
        return material

    def list_materials(self, user_id) -> List[MaterialSummary]:
        with self._lock:
            items = list(self._materials.get(user_id, {}).values())
        return sorted(items, key=lambda m: m.created_at, reverse=True)

    def get_material(self, user_id, material_id) -> Optional[MaterialSummary]:
        with self._lock:
            return self._materials.get(user_id, {}).get(material_id)

    def insert_quiz_result(self, user_id, material_id, score, topic_mastery) -> None:
        with self._lock:
            self._quizzes.setdefault(user_id, []).append(
                {
                    "id": str(uuid.uuid4()),
                    "material_id": material_id,
                    "score": score,
                    "topic_mastery": topic_mastery,
                    "created_at": _utcnow(),
                }
            )

    def count_quizzes(self, user_id) -> int:
        with self._lock:
            return len(self._quizzes.get(user_id, []))

    def insert_doubt(
        self, user_id, material_id, question_text, ai_answer_text
    ) -> DoubtItem:
        doubt = DoubtItem(
            id=str(uuid.uuid4()),
            user_id=user_id,
            material_id=material_id,
            question_text=question_text,
            ai_answer_text=ai_answer_text,
            created_at=_utcnow(),
        )
        with self._lock:
            self._doubts.setdefault(user_id, []).append(doubt)
        return doubt

    def list_doubts(self, user_id) -> List[DoubtItem]:
        with self._lock:
            items = list(self._doubts.get(user_id, []))
        return sorted(items, key=lambda d: d.created_at, reverse=True)

    def study_velocity_hours(self, user_id) -> float:
        with self._lock:
            chunks = sum(
                m.chunk_count for m in self._materials.get(user_id, {}).values()
            )
            quizzes = len(self._quizzes.get(user_id, []))
        return round(chunks * 0.1 + quizzes * 0.5, 2)


# ==========================================================================
# Supabase implementation
# ==========================================================================
class SupabaseDatabase(Database):
    def __init__(self, url: str, key: str) -> None:
        self._client = create_client(url, key)

    # --- mapping helpers -------------------------------------------------
    @staticmethod
    def _user_from_row(row: dict) -> UserProfile:
        return UserProfile(
            id=row["id"],
            name=row.get("name"),
            email=row.get("email"),
            university=row.get("university"),
            semester=row.get("semester"),
            created_at=row.get("created_at") or _utcnow(),
        )

    @staticmethod
    def _material_from_row(row: dict) -> MaterialSummary:
        file_name = row.get("file_name", "untitled")
        return MaterialSummary(
            id=row["id"],
            user_id=row["user_id"],
            file_name=file_name,
            file_url=row.get("file_url"),
            chunk_count=row.get("chunk_count") or 0,
            format=_format_from_name(file_name),
            created_at=row.get("created_at") or _utcnow(),
        )

    @staticmethod
    def _doubt_from_row(row: dict) -> DoubtItem:
        return DoubtItem(
            id=row["id"],
            user_id=row["user_id"],
            material_id=row.get("material_id"),
            question_text=row.get("question_text", ""),
            ai_answer_text=row.get("ai_answer_text", ""),
            created_at=row.get("created_at") or _utcnow(),
        )

    # --- users -----------------------------------------------------------
    def get_or_create_user(
        self, user_id, name=None, email=None, university=None, semester=None
    ) -> UserProfile:
        found = (
            self._client.table("users").select("*").eq("id", user_id).limit(1).execute()
        )
        if found.data:
            return self._user_from_row(found.data[0])
        row = {
            "id": user_id,
            "name": name or "Student",
            "email": email,
            "university": university,
            "semester": semester,
        }
        created = self._client.table("users").insert(row).execute()
        return self._user_from_row(created.data[0] if created.data else row)

    def get_user(self, user_id) -> Optional[UserProfile]:
        res = (
            self._client.table("users").select("*").eq("id", user_id).limit(1).execute()
        )
        return self._user_from_row(res.data[0]) if res.data else None

    # --- uploaded_materials ---------------------------------------------
    def insert_material(self, material: MaterialSummary) -> MaterialSummary:
        self._client.table("uploaded_materials").insert(
            {
                "id": material.id,
                "user_id": material.user_id,
                "file_name": material.file_name,
                "file_url": material.file_url,
                "chunk_count": material.chunk_count,
            }
        ).execute()
        return material

    def list_materials(self, user_id) -> List[MaterialSummary]:
        res = (
            self._client.table("uploaded_materials")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .execute()
        )
        return [self._material_from_row(r) for r in (res.data or [])]

    def get_material(self, user_id, material_id) -> Optional[MaterialSummary]:
        res = (
            self._client.table("uploaded_materials")
            .select("*")
            .eq("user_id", user_id)
            .eq("id", material_id)
            .limit(1)
            .execute()
        )
        return self._material_from_row(res.data[0]) if res.data else None

    # --- quizzes ---------------------------------------------------------
    def insert_quiz_result(self, user_id, material_id, score, topic_mastery) -> None:
        self._client.table("quizzes").insert(
            {
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "material_id": material_id,
                "score": score,
                "topic_mastery": topic_mastery,
            }
        ).execute()

    def count_quizzes(self, user_id) -> int:
        res = (
            self._client.table("quizzes")
            .select("id", count="exact")
            .eq("user_id", user_id)
            .execute()
        )
        if res.count is not None:
            return res.count
        return len(res.data or [])

    # --- doubt_notebook --------------------------------------------------
    def insert_doubt(
        self, user_id, material_id, question_text, ai_answer_text
    ) -> DoubtItem:
        doubt_id = str(uuid.uuid4())
        res = (
            self._client.table("doubt_notebook")
            .insert(
                {
                    "id": doubt_id,
                    "user_id": user_id,
                    "material_id": material_id,
                    "question_text": question_text,
                    "ai_answer_text": ai_answer_text,
                }
            )
            .execute()
        )
        if res.data:
            return self._doubt_from_row(res.data[0])
        return DoubtItem(
            id=doubt_id,
            user_id=user_id,
            material_id=material_id,
            question_text=question_text,
            ai_answer_text=ai_answer_text,
        )

    def list_doubts(self, user_id) -> List[DoubtItem]:
        res = (
            self._client.table("doubt_notebook")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .execute()
        )
        return [self._doubt_from_row(r) for r in (res.data or [])]

    # --- metrics ---------------------------------------------------------
    def study_velocity_hours(self, user_id) -> float:
        res = (
            self._client.table("uploaded_materials")
            .select("chunk_count")
            .eq("user_id", user_id)
            .execute()
        )
        chunks = sum((r.get("chunk_count") or 0) for r in (res.data or []))
        return round(chunks * 0.1 + self.count_quizzes(user_id) * 0.5, 2)


# ==========================================================================
# Factory + singleton
# ==========================================================================
def _build_database() -> Database:
    if config.supabase_enabled() and create_client is not None:
        try:
            database = SupabaseDatabase(config.SUPABASE_URL, config.SUPABASE_KEY)
            logger.info("Database: Supabase backend enabled.")
            return database
        except Exception as exc:  # noqa: BLE001 - fall back rather than crash boot
            logger.warning("Supabase init failed (%s); using in-memory.", exc)
    logger.info("Database: in-memory backend (no Supabase configured).")
    return InMemoryDatabase()


db: Database = _build_database()
