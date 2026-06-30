"""Core infrastructure: persistence (Supabase) and auth (Firebase)."""

from app.core.database import db
from app.core.auth import get_current_user_id

__all__ = ["db", "get_current_user_id"]
