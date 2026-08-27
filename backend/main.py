"""
LAURA Backend — FastAPI entry point
AI to Market × EssilorLuxottica
"""

import asyncio
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import structlog

from backend.api import (
    health, auth, loa, draft, permissions, reference,
    admin, comments, duplicate, chat, templates, corporate, review, cycles,
    historical, review_stage, reference_tables,
)
from backend.config import settings

logger = structlog.get_logger()

app = FastAPI(
    title="LAURA API",
    description="LOA Automation & Review Agent — AI to Market × EssilorLuxottica",
    version="0.1.0",
    docs_url="/docs" if settings.ENVIRONMENT == "development" else None,
    redoc_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://laura.vercel.app"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)

# Serve uploaded photos (execution images, title backgrounds, overview images)
_uploads_dir = Path(__file__).resolve().parent / "uploads"
_uploads_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(_uploads_dir)), name="uploads")


# ── Assign role_id to demo CMO / CFO accounts ──
# Demo accounts were seeded with only the legacy `user.role` string ("approver").
# This idempotent migration ensures the regional_cmo / regional_cfo roles exist
# and assigns them to the known demo + real CMO/CFO users so that
# /permissions/my-role returns the correct role_code for UI role-locking.
@app.on_event("startup")
async def fix_demo_user_roles():
    try:
        from backend.models.database import SessionLocal
        from backend.models.user import User
        from backend.models.role import Role

        ROLE_DEFINITIONS = {
            "regional_cmo": {"display_name": "Regional CMO", "scope_type": "all", "can_override_lock": False},
            "regional_cfo": {"display_name": "Regional CFO", "scope_type": "all", "can_override_lock": False},
        }
        ROLE_ASSIGNMENTS = {
            "regional-cmo@laura-demo.local": "regional_cmo",
            "regional-cfo@laura-demo.local": "regional_cfo",
            "alexandra@essilor.com":         "regional_cmo",
            "giulia@essilor.com":            "regional_cfo",
        }

        db = SessionLocal()
        try:
            # Ensure roles exist (self-contained — no prior seed required)
            role_objs: dict[str, Role] = {}
            for code, attrs in ROLE_DEFINITIONS.items():
                role = db.query(Role).filter_by(code=code).first()
                if not role:
                    role = Role(code=code, description=None, **attrs)
                    db.add(role)
                    db.flush()
                    logger.info("role_created", code=code)
                role_objs[code] = role

            # Assign role_id to demo / real CMO+CFO users that lack it
            for email, role_code in ROLE_ASSIGNMENTS.items():
                user = db.query(User).filter(User.email == email).first()
                if user and user.role_id is None:
                    user.role_id = role_objs[role_code].id
                    logger.info("demo_role_fixed", email=email, role_code=role_code)

            db.commit()
        finally:
            db.close()
    except Exception as e:
        logger.warning("fix_demo_roles_failed", error=str(e))


# ── Preload heavy resources at startup ──
# Without this, the first user to trigger a Deep Search waits ~40s while
# the 2 GB sentence-transformers model loads from disk.
# With preload, the model is ready before the server accepts requests.
async def _load_model_background() -> None:
    """Load the embedding model in a thread pool after the server is already live."""
    try:
        from backend.engines.rag import _get_embed_model
        await asyncio.to_thread(_get_embed_model)
        logger.info("embedding_model_ready")
    except Exception as e:
        logger.warning("embedding_model_preload_failed", error=str(e))


@app.on_event("startup")
async def preload_resources():
    # Fire-and-forget: startup event returns immediately so uvicorn binds the port
    # and accepts requests right away. The model finishes loading in the background.
    # The first /chat/ask that arrives before it's ready will trigger a lazy load,
    # but all other endpoints (LOA, review, auth) are completely unaffected.
    asyncio.create_task(_load_model_background())
    logger.info("embedding_model_preload_scheduled")


app.include_router(health.router, prefix="/health", tags=["health"])
app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(loa.router, prefix="/loa", tags=["loa"])
app.include_router(draft.router, tags=["draft"])
app.include_router(permissions.router)
app.include_router(reference.router)
app.include_router(admin.router)
app.include_router(comments.router, tags=["comments"])
app.include_router(duplicate.router, tags=["duplicate"])
app.include_router(chat.router, tags=["chat"])
app.include_router(templates.router, tags=["templates"])
app.include_router(corporate.router)
app.include_router(review.router, tags=["review"])
app.include_router(review_stage.router, tags=["review-stage"])
app.include_router(cycles.router)
app.include_router(historical.router)
app.include_router(reference_tables.router, prefix="/api/reference")

logger.info("LAURA backend ready", environment=settings.ENVIRONMENT)
