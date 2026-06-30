"""Quiz pipeline router — generation, exam grading and chat (per user).

- POST /api/quiz/generate  -> QUIZ or FLASHCARDS for one of the user's materials
- POST /api/quiz/submit    -> grade an exam; persist score + mastery to `quizzes`
- POST /api/quiz/chat      -> RAG-grounded tutor turn, scoped to the user's docs
"""

from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.auth import get_current_user_id
from app.core.database import db
from app.models.schemas import (
    ChatRequest,
    ChatResponse,
    ExamResultResponse,
    ExamSubmissionPayload,
    GenerateRequest,
    GenerationResult,
    GenerationType,
)
from app.rag import memory as rag_memory
from app.services.orchestrator import orchestrator
from app.services.weakness import grade_exam
from app.store import quiz_keys

router = APIRouter(prefix="/api/quiz", tags=["quiz"])


@router.post(
    "/generate",
    response_model=GenerationResult,
    status_code=status.HTTP_201_CREATED,
    summary="Generate a QUIZ or FLASHCARDS set from a user's material.",
)
async def generate(
    request: GenerateRequest,
    user_id: str = Depends(get_current_user_id),
) -> GenerationResult:
    source_title = "General Knowledge"
    chunks: List[str] = []
    if request.material_id:
        material = db.get_material(user_id, request.material_id)
        if material is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Material '{request.material_id}' not found.",
            )
        source_title = material.file_name
        chunks = rag_memory.get_material_chunks(request.material_id)

    result = await orchestrator.generate(
        request, source_title=source_title, chunks=chunks
    )

    # Persist the quiz answer key (transient grading state) for /submit.
    if result.generation_type == GenerationType.QUIZ and request.material_id:
        quiz_keys.save(user_id, request.material_id, result.questions)
    return result


@router.post(
    "/submit",
    response_model=ExamResultResponse,
    summary="Grade an exam and persist the result to the user's history.",
)
async def submit_exam(
    payload: ExamSubmissionPayload,
    user_id: str = Depends(get_current_user_id),
) -> ExamResultResponse:
    # Empty/unknown key -> zeroed result (no crash).
    questions = quiz_keys.get(user_id, payload.material_id)
    result = grade_exam(questions, payload.answers)

    db.get_or_create_user(user_id)
    db.insert_quiz_result(
        user_id=user_id,
        material_id=payload.material_id,
        score=result.score,
        topic_mastery=result.topic_mastery,
    )
    return result


@router.post(
    "/chat",
    response_model=ChatResponse,
    summary="Document-scoped conversational tutor turn (RAG-grounded).",
)
async def quiz_chat(
    request: ChatRequest,
    user_id: str = Depends(get_current_user_id),
) -> ChatResponse:
    if not request.messages:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="At least one message is required.",
        )

    # Restrict global-scope retrieval to the user's own materials.
    user_materials = db.list_materials(user_id)
    allowed_ids = [m.id for m in user_materials]

    source_filename = None
    if request.material_id:
        match = next(
            (m for m in user_materials if m.id == request.material_id), None
        )
        if match is not None:
            source_filename = match.file_name

    return await orchestrator.chat(
        request.messages,
        material_id=request.material_id,
        source_filename=source_filename,
        allowed_material_ids=allowed_ids,
    )
