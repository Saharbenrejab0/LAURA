"""
LAURA Backend — FastAPI entry point
AI to Market × EssilorLuxottica
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import structlog

from backend.api import (
    health, auth, loa, draft, permissions, reference,
    admin, comments, duplicate, chat, templates,
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


# ── Preload heavy resources at startup ──
# Without this, the first user to trigger a Deep Search waits ~40s while
# the 2 GB sentence-transformers model loads from disk.
# With preload, the model is ready before the server accepts requests.
@app.on_event("startup")
async def preload_resources():
    try:
        logger.info("preloading_embedding_model")
        from backend.engines.rag import _get_embed_model
        _get_embed_model()
        logger.info("embedding_model_ready")
    except Exception as e:
        logger.warning("embedding_model_preload_failed", error=str(e))


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

logger.info("LAURA backend ready", environment=settings.ENVIRONMENT)
