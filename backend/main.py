"""
LAURA Backend — FastAPI entry point
AI to Market × EssilorLuxottica
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import structlog

from backend.api import loa, auth, health, permissions  
from backend.config import settings
from backend.api import reference

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

app.include_router(health.router, prefix="/health", tags=["health"])
app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(loa.router, prefix="/loa", tags=["loa"])
app.include_router(permissions.router)
app.include_router(reference.router)

logger.info("LAURA backend ready", environment=settings.ENVIRONMENT)
