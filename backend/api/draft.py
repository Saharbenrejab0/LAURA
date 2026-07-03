"""
LAURA - Field-level autosave endpoint  (slice 3)

PATCH /loa/{loa_id}/field
    Update a single field on a LOA. Used by the inline-edit pattern on the
    draft page: every blur on a field sends one of these. Returns the
    updated value + a provenance marker so the UI can show the green dot.

The existing PATCH /loa/{loa_id} accepts a full payload, which is fine for
form submits but heavy for autosave. This endpoint is purpose-built for
the "click a cell, edit, blur, done" pattern.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.api.auth import get_current_user
from backend.api.permission_middleware import require_permission
from backend.models.database import get_db
from backend.models.loa import LOA
from backend.models.user import User

router = APIRouter()


class FieldUpdate(BaseModel):
    field: str
    value: Any
    # If the value came from a Laura suggestion the frontend tells us, so we
    # can stamp provenance correctly.
    source: str = "manual"  # "manual" | "laura_accepted" | "laura_edited"


# Fields the field-level endpoint refuses to touch. Identity, lifecycle,
# audit, computed totals. These go through dedicated endpoints (submit,
# duplicate, approve) - never inline edits.
_PROTECTED = frozenset({
    "id", "loa_number", "loa_draft_id",
    "requestor_email", "status", "is_demo", "is_locked",
    "submitted_at", "approved_at", "created_at", "updated_at",
    "cmo_approved", "cfo_approved", "cmo_comment", "rejection_reason",
    "ai_suggestion_used", "ai_suggestion_log_id",
    "fy_2025_total", "fy_2026_total", "avg_investment_per_door",
    "ppt_slide_required",
    "duplicated_from_id",
})


@router.patch("/loa/{loa_id}/field")
def update_loa_field(
    loa_id: str,
    body: FieldUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    _: dict = Depends(require_permission("edit")),
):
    loa = db.query(LOA).filter(LOA.id == loa_id).first()
    if not loa:
        raise HTTPException(status_code=404, detail="LOA not found")

    if body.field in _PROTECTED:
        raise HTTPException(
            status_code=400,
            detail=f"Field '{body.field}' is not editable inline",
        )

    if not hasattr(loa, body.field):
        raise HTTPException(status_code=400, detail=f"Unknown field '{body.field}'")

    if loa.is_locked:
        role = user.role_obj
        if not role or not role.can_override_lock:
            raise HTTPException(
                status_code=423,
                detail="LOA is locked. Only a super-admin can edit it while locked.",
            )

    # Apply the change
    setattr(loa, body.field, body.value)
    loa.updated_at = datetime.utcnow()

    # Recompute derived totals if a financial field changed
    if hasattr(loa, "calculate_totals") and body.field.startswith(("fy_", "q1_", "q2_", "q3_", "q4_")):
        loa.calculate_totals()

    db.commit()
    db.refresh(loa)

    return {
        "ok": True,
        "field": body.field,
        "value": getattr(loa, body.field),
        "source": body.source,
        "updated_at": loa.updated_at.isoformat(),
    }
