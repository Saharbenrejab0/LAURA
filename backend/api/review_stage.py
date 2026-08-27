"""
LAURA — Alignment review stage API

GET  /review-stage/queue?stage=<stage>   — LOAs currently actionable for this stage
POST /review-stage/{loa_id}/approve      — Approve one stage (sequence-validated)

Stages (sequential):
  local_alignment → global_function_review → global_brand_review

Once all three are approved, the LOA status advances to cmo_cfo_review.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session

from backend.models.database import get_db
from backend.api.ordering import newest_first
from backend.models.loa import LOA
from backend.models.user import User
from backend.models.review import LOAReviewStage, ALIGNMENT_STAGES
from backend.api.auth import get_current_user

router = APIRouter()

# ── Role → stage mapping ──────────────────────────────────────────────────────
# Role codes that are authorised to approve each stage.
STAGE_ROLES: dict[str, tuple[str, ...]] = {
    "local_alignment":        ("local_alignment",),
    "global_function_review": ("global_function_review",),
    "global_brand_review":    ("global_brand_review",),
}


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class ApproveBody(BaseModel):
    stage: str

    @field_validator("stage")
    @classmethod
    def valid_stage(cls, v: str) -> str:
        if v not in ALIGNMENT_STAGES:
            raise ValueError(f"stage must be one of: {', '.join(ALIGNMENT_STAGES)}")
        return v


# ── Helpers ───────────────────────────────────────────────────────────────────

def _stage_out(s: LOAReviewStage, db: Session | None = None) -> dict:
    """Serialize one stage row.

    `approvedByName` is what the stepper actually shows — the raw UUID in
    `approvedBy` is no use to a reviewer reading the approval history.
    """
    approver_name = None
    if s.approved_by and db is not None:
        approver = db.query(User).filter(User.id == s.approved_by).first()
        if approver:
            approver_name = approver.full_name or approver.email

    return {
        "id": str(s.id),
        "loaId": str(s.loa_id),
        "stage": s.stage,
        "status": s.status,
        "approvedBy": str(s.approved_by) if s.approved_by else None,
        "approvedByName": approver_name,
        "approvedAt": s.approved_at.isoformat() if s.approved_at else None,
    }


def _previous_stage(stage: str) -> Optional[str]:
    idx = ALIGNMENT_STAGES.index(stage)
    return ALIGNMENT_STAGES[idx - 1] if idx > 0 else None


def _all_stages_approved(loa_id: str, db: Session) -> bool:
    rows = db.query(LOAReviewStage).filter_by(loa_id=loa_id).all()
    approved = {r.stage for r in rows if r.status == "approved"}
    return all(s in approved for s in ALIGNMENT_STAGES)


def _current_stage(loa_id: str, db: Session) -> Optional[str]:
    """Return the first pending stage that is actionable, or None if all done."""
    rows = {r.stage: r for r in db.query(LOAReviewStage).filter_by(loa_id=loa_id).all()}
    for stage in ALIGNMENT_STAGES:
        row = rows.get(stage)
        if row is None or row.status == "pending":
            return stage
    return None  # all approved


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/review-stage/queue")
def get_reviewer_queue(
    stage: str = Query(..., description="One of: local_alignment, global_function_review, global_brand_review"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return LOAs whose alignment stage is currently actionable for the given stage.

    An LOA is in the queue for stage S when:
      - It has an LOAReviewStage row for S with status='pending'
      - If S is not the first stage, the preceding stage is already approved
    """
    if stage not in ALIGNMENT_STAGES:
        raise HTTPException(status_code=400, detail=f"Invalid stage. Must be one of: {', '.join(ALIGNMENT_STAGES)}")

    prev = _previous_stage(stage)

    # LOAs that have a pending row for this stage
    pending_stage_loa_ids = (
        db.query(LOAReviewStage.loa_id)
        .filter_by(stage=stage, status="pending")
        .subquery()
    )

    if prev:
        # The previous stage must already be approved
        approved_prev_loa_ids = (
            db.query(LOAReviewStage.loa_id)
            .filter_by(stage=prev, status="approved")
            .subquery()
        )
        loas = (
            db.query(LOA)
            .filter(LOA.id.in_(pending_stage_loa_ids))
            .filter(LOA.id.in_(approved_prev_loa_ids))
        )
        loas = newest_first(loas, LOA).all()
    else:
        # First stage — no prerequisite
        loas = (
            db.query(LOA)
            .filter(LOA.id.in_(pending_stage_loa_ids))
        )
        loas = newest_first(loas, LOA).all()

    # Attach stages info to each LOA
    result = []
    for loa in loas:
        stages = {
            r.stage: _stage_out(r, db)
            for r in db.query(LOAReviewStage).filter_by(loa_id=str(loa.id)).all()
        }
        result.append({
            "id": str(loa.id),
            "loa_draft_id": loa.loa_draft_id,
            "loa_number": loa.loa_number,
            "requestor_email": loa.requestor_email,
            "cluster": loa.cluster,
            "country": loa.country,
            "brand": loa.brand,
            "activity_type": loa.activity_type,
            "category": loa.category or [],
            "fy_2026_total": loa.fy_2026_total,
            "status": loa.status,
            "submitted_at": loa.submitted_at.isoformat() if loa.submitted_at else None,
            "stages": stages,
        })

    return {"stage": stage, "loas": result, "total": len(result)}


@router.get("/review-stage/{loa_id}/stages")
def get_loa_stages(
    loa_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return all LOAReviewStage rows for one LOA."""
    loa = db.query(LOA).filter(LOA.id == loa_id).first()
    if not loa:
        raise HTTPException(status_code=404, detail="LOA not found")

    rows = db.query(LOAReviewStage).filter_by(loa_id=loa_id).all()
    stages = {r.stage: _stage_out(r, db) for r in rows}

    return {
        "loaId": loa_id,
        "stages": stages,
        "currentStage": _current_stage(loa_id, db),
        "allApproved": _all_stages_approved(loa_id, db),
    }


@router.post("/review-stage/{loa_id}/approve")
def approve_stage(
    loa_id: str,
    body: ApproveBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Approve one alignment stage for a LOA.

    Rules enforced server-side:
    1. LOA must exist and have a pending row for this stage.
    2. The preceding stage (if any) must already be approved.
    3. The approver's role must match the stage (or be an admin with can_override_lock).
    """
    loa = db.query(LOA).filter(LOA.id == loa_id).first()
    if not loa:
        raise HTTPException(status_code=404, detail="LOA not found")

    stage = body.stage

    # Role check — allow matching role or can_override_lock admin
    role = current_user.role_obj
    role_code = (role.code if role else "") or ""
    allowed_roles = STAGE_ROLES.get(stage, ())
    can_approve = role_code in allowed_roles or (role and getattr(role, "can_override_lock", False))
    if not can_approve:
        raise HTTPException(
            status_code=403,
            detail=f"Your role ('{role_code}') is not authorised to approve stage '{stage}'.",
        )

    # Sequence check — previous stage must be approved
    prev = _previous_stage(stage)
    if prev:
        prev_row = db.query(LOAReviewStage).filter_by(loa_id=loa_id, stage=prev).first()
        if not prev_row or prev_row.status != "approved":
            raise HTTPException(
                status_code=409,
                detail=f"Stage '{prev}' must be approved before '{stage}' can be approved.",
            )

    # Get or verify the stage row exists
    stage_row = db.query(LOAReviewStage).filter_by(loa_id=loa_id, stage=stage).first()
    if not stage_row:
        raise HTTPException(status_code=404, detail=f"No review stage '{stage}' found for this LOA.")
    if stage_row.status == "approved":
        raise HTTPException(status_code=409, detail=f"Stage '{stage}' is already approved.")

    # Approve
    stage_row.status = "approved"
    stage_row.approved_by = current_user.id
    stage_row.approved_at = datetime.now(timezone.utc)
    db.flush()

    # Advancing the LOA is NOT this endpoint's job.
    #
    # These rows record WHO approved each local-alignment sub-gate and when. The
    # gate itself is the *_review_done booleans, which backend/api/loa.py reads —
    # that is the one system the nine-gate workflow runs on.
    #
    # This used to write `loa.status = "cmo_cfo_review"` here, unguarded, and it
    # was wrong twice over:
    #   - no status check, so approving a leftover stage row on an already
    #     `approved` LOA dragged it back to cmo_cfo_review
    #   - it skipped emea_review, global_review and emea_post_global_review
    #     entirely, jumping four gates the chain requires
    # Two approved LOAs still carry stage rows and were exposed to exactly that.
    #
    # Local alignment completing advances the LOA to `emea_review`, and that
    # transition lives in loa.py alongside every other one.
    if _all_stages_approved(loa_id, db) and loa.status == "local_alignment":
        loa.status = "emea_review"

    db.commit()
    db.refresh(stage_row)
    db.refresh(loa)

    return {
        "stage": _stage_out(stage_row, db),
        "loaStatus": loa.status,
        "allApproved": _all_stages_approved(loa_id, db),
    }
