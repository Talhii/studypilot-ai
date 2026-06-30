"""StudyPilot AI — FastAPI application entry point.

Run locally:
    uvicorn main:app --reload --port 8000
or:
    python main.py
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import __version__, config
from app.api import (
    doubts_router,
    materials_router,
    quiz_router,
    stats_router,
)

app = FastAPI(
    title="StudyPilot AI",
    description="AI Learning Companion backend — Firebase auth + Supabase.",
    version=__version__,
)

# CORS — open in Phase 1 so the Expo client on any LAN IP can reach the API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(materials_router)
app.include_router(stats_router)
app.include_router(quiz_router)
app.include_router(doubts_router)


@app.get("/", tags=["health"])
async def root() -> dict[str, str]:
    return {"service": "studypilot-ai", "version": __version__, "status": "ok"}


@app.get("/health", tags=["health"])
async def health() -> dict[str, str]:
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host=config.HOST, port=config.PORT, reload=True)
