"""Pydantic v2 schema models — the typed contract shared with the mobile client.

The TypeScript interfaces in `mobile/lib/api.ts` mirror these field-for-field.
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# --------------------------------------------------------------------------
# Users  (mirrors the Supabase `users` table)
# --------------------------------------------------------------------------
class UserProfile(BaseModel):
    id: str
    name: Optional[str] = None
    email: Optional[str] = None
    university: Optional[str] = None
    semester: Optional[str] = None
    created_at: datetime = Field(default_factory=_utcnow)


# --------------------------------------------------------------------------
# Materials  (mirrors the Supabase `uploaded_materials` table)
# --------------------------------------------------------------------------
class FileFormat(str, Enum):
    """Supported ingest formats (value == lowercase extension, no dot)."""

    pdf = "pdf"
    docx = "docx"
    pptx = "pptx"
    txt = "txt"


class MaterialSummary(BaseModel):
    """One uploaded study material, scoped to a user.

    `format` is derived from `file_name` for the UI badge; the rest mirror the
    `uploaded_materials` columns.
    """

    id: str = Field(..., description="Server-generated UUID4 string.")
    user_id: str
    file_name: str
    file_url: Optional[str] = None
    chunk_count: int = Field(..., ge=0, description="Indexed text chunks.")
    format: FileFormat
    created_at: datetime = Field(default_factory=_utcnow)


class UploadResponse(BaseModel):
    """201 payload returned by POST /api/materials/upload."""

    status: str = "created"
    message: str
    material: MaterialSummary


# --------------------------------------------------------------------------
# Dashboard / session statistics
# --------------------------------------------------------------------------
class DashboardStats(BaseModel):
    """Aggregate metrics rendered on the mobile Home tab (per user)."""

    user: Optional[UserProfile] = None
    total_files_uploaded: int = Field(..., ge=0)
    active_quizzes_generated: int = Field(..., ge=0)
    study_velocity_hours: float = Field(..., ge=0)
    documents: List[MaterialSummary] = Field(default_factory=list)


# --------------------------------------------------------------------------
# AI Doubt Notebook  (mirrors the Supabase `doubt_notebook` table)
# --------------------------------------------------------------------------
class DoubtSaveRequest(BaseModel):
    material_id: Optional[str] = None
    question_text: str
    ai_answer_text: str


class DoubtItem(BaseModel):
    id: str
    user_id: str
    material_id: Optional[str] = None
    question_text: str
    ai_answer_text: str
    created_at: datetime = Field(default_factory=_utcnow)


# --------------------------------------------------------------------------
# Quiz / flashcard generation + exam grading (Phase 4)
# --------------------------------------------------------------------------
class GenerationType(str, Enum):
    """What the generator should produce from a material."""

    QUIZ = "QUIZ"
    FLASHCARDS = "FLASHCARDS"


class QuizQuestionItem(BaseModel):
    """A single graded multiple-choice question."""

    id: str
    question: str
    options: List[str]
    correct_index: int = Field(..., ge=0, description="Index into `options`.")
    topic_tag: str = Field(..., description="Sub-topic used for mastery tallies.")


class FlashcardItem(BaseModel):
    """A single front/back study flashcard (not graded)."""

    id: str
    front_prompt: str
    back_answer: str


class GenerateRequest(BaseModel):
    """POST /api/quiz/generate body."""

    material_id: Optional[str] = None
    generation_type: GenerationType = GenerationType.QUIZ
    count: int = Field(default=3, ge=1, le=20, description="Items to generate.")


class GenerationResult(BaseModel):
    """A generated assessment — exactly one of `questions` / `flashcards` is set."""

    id: str
    material_id: Optional[str] = None
    generation_type: GenerationType
    title: str
    questions: List[QuizQuestionItem] = Field(default_factory=list)
    flashcards: List[FlashcardItem] = Field(default_factory=list)


class ExamSubmissionPayload(BaseModel):
    """POST /api/quiz/submit body — maps question id -> selected option index."""

    material_id: str
    answers: dict[str, int] = Field(default_factory=dict)


class ExamResultResponse(BaseModel):
    """Graded exam result with per-topic mastery and remediation rows."""

    score: float = Field(..., ge=0, le=100, description="Overall percent correct.")
    total_questions: int = Field(..., ge=0)
    topic_mastery: dict[str, float] = Field(
        default_factory=dict,
        description="topic_tag -> fractional category percentage (0-100).",
    )
    weakness_recommendations: List[str] = Field(default_factory=list)


# --------------------------------------------------------------------------
# Chat
# --------------------------------------------------------------------------
class ChatMessage(BaseModel):
    role: str = Field(..., description="'user' | 'assistant' | 'system'.")
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    material_id: Optional[str] = None


class ChatResponse(BaseModel):
    reply: ChatMessage
    references: List[str] = Field(default_factory=list)
    # Citation: filename of the scoped source document, when chat is
    # restricted to a single material (None for global-scope answers).
    source: Optional[str] = None
    scoped: bool = False
