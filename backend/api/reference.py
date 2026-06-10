"""
LAURA — Reference data API
==========================

Single endpoint that serves all dropdown / cascade / business-rule data
to the frontend. Frontend fetches once, caches in localStorage with a 24h TTL,
and re-fetches when REFERENCE_DATA_VERSION changes.

This is the single contract between backend reference_data.py and the UI.
NEVER expose individual lists through separate endpoints — keep it one payload.
"""

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from backend.reference_data import (
    get_all_reference_data,
    REFERENCE_DATA_VERSION,
)


router = APIRouter(prefix="/reference-data", tags=["reference"])


@router.get("/")
def get_reference_data():
    """
    Returns the full reference-data payload.

    Response shape:
    {
      "version": "v2.0",
      "source": "LAURA Dropdown Rules CLIENT v2 (June 2026)",
      "clusters": [...],
      "cluster_cascade": {...},
      "activity_types": [...],
      "event_types": [...],
      "event_purposes": [...],
      "categories": [...],
      "brands_by_category": {...},
      "capex_opex": [...],
      "adv_selling": [...],
      "cot_options": [...],
      "loa_statuses": [...],
      "status_labels": {...},
      "rules": {...}
    }

    Frontend should:
      1. Cache this in localStorage under key `laura.reference_data.v2.0`
      2. On every app load, fetch /reference-data/version (lightweight)
      3. If returned version != cached version → refetch full payload
    """
    payload = get_all_reference_data()
    return JSONResponse(
        content=payload,
        headers={
            # Allow the frontend to do conditional caching
            "Cache-Control": "public, max-age=86400",  # 24h
            "X-Reference-Data-Version": REFERENCE_DATA_VERSION,
        },
    )


@router.get("/version")
def get_reference_data_version():
    """
    Lightweight endpoint — returns just the version string.
    Frontend uses this to decide whether to refetch the full payload.
    Avoids transferring ~30KB on every app load.
    """
    return {"version": REFERENCE_DATA_VERSION}