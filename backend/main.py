"""
LAURA Backend — FastAPI entry point
AI to Market × EssilorLuxottica
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import structlog

from backend.api import loa, auth, health
from backend.models.database import init_db
from backend.config import settings

logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    logger.info("LAURA backend starting", environment=settings.ENVIRONMENT)
    await init_db()
    yield
    logger.info("LAURA backend shutting down")


app = FastAPI(
    title="LAURA API",
    description="LOA Automation & Review Agent — AI to Market × EssilorLuxottica",
    version="0.1.0",
    lifespan=lifespan,
    # Disable docs in production (security requirement)
    docs_url="/docs" if settings.ENVIRONMENT == "development" else None,
    redoc_url=None,
)

# CORS — only allow known origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)

# Routes
app.include_router(health.router, prefix="/health", tags=["health"])
app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(loa.router, prefix="/loa", tags=["loa"])
