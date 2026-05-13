"""LAURA — health check endpoint"""

from fastapi import APIRouter
from datetime import datetime

router = APIRouter()


@router.get("/")
async def health():
    return {
        "status": "ok",
        "service": "LAURA backend",
        "timestamp": datetime.utcnow().isoformat(),
    }


@router.get("/ready")
async def ready():
    """Deeper check — database + redis reachable."""
    # TODO: add DB ping and Redis ping here
    return {"status": "ready"}
