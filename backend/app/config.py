"""Runtime configuration for the StudyPilot AI backend.

Values are intentionally plain constants for Phase 1. They are the single
source of truth shared by the routers, the AI orchestrator and the RAG layer.
"""

from __future__ import annotations

import os


def _load_dotenv() -> None:
    """Load KEY=VALUE lines from `backend/.env` into the environment.

    Dependency-free so users can drop their ANTHROPIC_API_KEY / SUPABASE_* into
    a `.env` file and just restart — no terminal env-var juggling. Existing
    environment variables always win (never overridden).
    """
    env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
    try:
        with open(env_path, "r", encoding="utf-8-sig") as handle:
            for raw in handle:
                line = raw.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, _, value = line.partition("=")
                key = key.strip()
                value = value.strip().strip('"').strip("'")
                if key and key not in os.environ:
                    os.environ[key] = value
    except FileNotFoundError:
        pass
    except OSError:
        pass


_load_dotenv()

# --- Server ---------------------------------------------------------------
HOST: str = "0.0.0.0"
PORT: int = 8000

# CORS — wide open in Phase 1 so the Expo dev client (any LAN IP) can reach us.
CORS_ORIGINS: list[str] = ["*"]

# --- File ingest ----------------------------------------------------------
# Extensions accepted by POST /api/materials/upload.
ALLOWED_EXTENSIONS: set[str] = {".pdf", ".docx", ".pptx", ".txt"}
MAX_UPLOAD_BYTES: int = 25 * 1024 * 1024  # 25 MB soft cap

# --- AI orchestrator ------------------------------------------------------
# Phase 3: the orchestrator runs live Anthropic Claude when ANTHROPIC_API_KEY is
# present, and falls back to the deterministic local mock when it is blank or
# missing (so the app still runs with zero credentials).
DEFAULT_AI_PROVIDER: str = "claude"

# Read once at import. Blank/missing => mock path.
ANTHROPIC_API_KEY: str = os.environ.get("ANTHROPIC_API_KEY", "").strip()

# Live chat model. The originally specced `claude-3-5-sonnet-20241022` was
# retired (2025-10-28) and now 404s; `claude-sonnet-4-6` is its documented
# drop-in successor — the current stable Sonnet (same speed/intelligence tier).
LIVE_CHAT_MODEL: str = "claude-sonnet-4-6"
LIVE_MAX_TOKENS: int = 1024


def anthropic_live_enabled() -> bool:
    """True when a usable Anthropic API key is configured."""
    return bool(ANTHROPIC_API_KEY)


# --- Persistence (Supabase) ----------------------------------------------
# When SUPABASE_URL + a key are set the backend persists to Postgres/Supabase;
# otherwise it falls back to an in-memory database so it still runs locally.
SUPABASE_URL: str = os.environ.get("SUPABASE_URL", "").strip()
SUPABASE_KEY: str = (
    os.environ.get("SUPABASE_KEY", "").strip()
    or os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
)


def supabase_enabled() -> bool:
    return bool(SUPABASE_URL and SUPABASE_KEY)


# --- Auth (Firebase) ------------------------------------------------------
# Routers expect the validated Firebase identity via `X-User-ID` (the uid) or
# an `Authorization: Bearer <id-token>` header (verified when firebase-admin is
# configured). For local dev with no auth wired, fall back to a fixed user so
# the app keeps working.
AUTH_DEV_FALLBACK: bool = (
    os.environ.get("AUTH_DEV_FALLBACK", "true").strip().lower() != "false"
)
DEV_USER_ID: str = os.environ.get("DEV_USER_ID", "dev-user").strip() or "dev-user"
