"""Auth — resolve the active user from the request headers.

The frontend sends the validated Firebase identity either as `X-User-ID` (the
uid) or as `Authorization: Bearer <id-token>`. When firebase-admin is installed
and credentials are configured, Bearer tokens are verified server-side;
otherwise the uid header is trusted. For local dev with no auth wired,
`AUTH_DEV_FALLBACK` resolves a fixed dev user so the app keeps working.
"""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import Header, HTTPException, status

from app import config

logger = logging.getLogger("studypilot.auth")

try:  # Optional — only needed to verify Bearer ID tokens.
    import firebase_admin
    from firebase_admin import auth as firebase_auth
except ImportError:  # pragma: no cover
    firebase_admin = None  # type: ignore[assignment]
    firebase_auth = None  # type: ignore[assignment]

_firebase_ready = False


def _ensure_firebase() -> bool:
    """Lazily init the default firebase-admin app from ambient credentials."""
    global _firebase_ready
    if firebase_admin is None:
        return False
    if _firebase_ready:
        return True
    try:
        if not firebase_admin._apps:  # type: ignore[attr-defined]
            firebase_admin.initialize_app()
        _firebase_ready = True
    except Exception as exc:  # noqa: BLE001
        logger.warning("firebase-admin not configured (%s).", exc)
        return False
    return True


def _verify_bearer(token: str) -> Optional[str]:
    if _ensure_firebase() and firebase_auth is not None:
        try:
            decoded = firebase_auth.verify_id_token(token)
            return decoded.get("uid")
        except Exception as exc:  # noqa: BLE001
            logger.warning("Bearer token verification failed: %s", exc)
    return None


async def get_current_user_id(
    x_user_id: Optional[str] = Header(default=None, alias="X-User-ID"),
    authorization: Optional[str] = Header(default=None),
) -> str:
    """FastAPI dependency returning the active user's id."""
    if x_user_id:
        return x_user_id.strip()

    if authorization and authorization.lower().startswith("bearer "):
        uid = _verify_bearer(authorization[7:].strip())
        if uid:
            return uid

    if config.AUTH_DEV_FALLBACK:
        return config.DEV_USER_ID

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Missing or invalid user identity (X-User-ID or Bearer token).",
    )
