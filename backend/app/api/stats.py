"""Session statistics router — powers the mobile Home dashboard (per user)."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.core.auth import get_current_user_id
from app.core.database import db
from app.models.schemas import DashboardStats

router = APIRouter(prefix="/api/student", tags=["stats"])


@router.get(
    "/dashboard-stats",
    response_model=DashboardStats,
    summary="Aggregate study metrics, profile and documents for the user.",
)
async def dashboard_stats(
    user_id: str = Depends(get_current_user_id),
) -> DashboardStats:
    user = db.get_or_create_user(user_id)
    documents = db.list_materials(user_id)
    return DashboardStats(
        user=user,
        total_files_uploaded=len(documents),
        active_quizzes_generated=db.count_quizzes(user_id),
        study_velocity_hours=db.study_velocity_hours(user_id),
        documents=documents,
    )
