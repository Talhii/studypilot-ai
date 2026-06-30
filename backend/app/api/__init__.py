"""API routers for StudyPilot AI."""

from app.api.doubts import router as doubts_router
from app.api.materials import router as materials_router
from app.api.quiz import router as quiz_router
from app.api.stats import router as stats_router

__all__ = [
    "doubts_router",
    "materials_router",
    "quiz_router",
    "stats_router",
]
