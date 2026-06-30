"""AI Doubt Notebook router.

Lets a student bookmark a chat answer as a "doubt" to revise later, and fetch
their saved history. Rows are tied to the authenticated user.
"""

from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.auth import get_current_user_id
from app.core.database import db
from app.models.schemas import DoubtItem, DoubtSaveRequest

router = APIRouter(prefix="/api/doubts", tags=["doubts"])


@router.post(
    "/save",
    response_model=DoubtItem,
    status_code=status.HTTP_201_CREATED,
    summary="Save a chat Q/A into the user's doubt notebook.",
)
async def save_doubt(
    payload: DoubtSaveRequest,
    user_id: str = Depends(get_current_user_id),
) -> DoubtItem:
    if not payload.question_text.strip() or not payload.ai_answer_text.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Both question_text and ai_answer_text are required.",
        )
    db.get_or_create_user(user_id)
    return db.insert_doubt(
        user_id=user_id,
        material_id=payload.material_id,
        question_text=payload.question_text.strip(),
        ai_answer_text=payload.ai_answer_text.strip(),
    )


@router.get(
    "",
    response_model=List[DoubtItem],
    summary="List the user's saved doubts (newest first).",
)
async def list_doubts(
    user_id: str = Depends(get_current_user_id),
) -> List[DoubtItem]:
    return db.list_doubts(user_id)
