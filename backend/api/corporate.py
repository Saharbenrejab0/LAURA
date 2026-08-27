"""
LAURA — Corporate Review API (Task 5).

The final gate: a corporate reviewer clears the LOAs sitting at
`corporate_review`. Three verdicts:

  POST /corporate/approve/{loa_id}  → assign IA code (2026-XXXX) + status 'approved'
  POST /corporate/hold/{loa_id}     → status 'on_hold'
  POST /corporate/rework/{loa_id}   → status 'emea_final_review' (back one step)

Authorization: the acting user must be able to 'validate' the LOA at its
current status, OR be a super-admin (can_override_lock). This mirrors the
permission model used everywhere else without hard-coding a role.
"""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.models.database import get_db
from backend.api.auth import get_current_user
from backend.api.permissions import compute_permissions
from backend.models.user import User
from backend.models.loa import LOA

from backend.services.cycle_service import assert_cycle_open_for_writes

router = APIRouter(prefix="/corporate", tags=["corporate"])

IA_YEAR = 2026


def _authorize(db: Session, loa_id: str, user: User) -> LOA:
    """Load the LOA and confirm the user may action it (validate OR admin)."""
    loa = db.query(LOA).filter(LOA.id == loa_id).first()
    if not loa:
        raise HTTPException(status_code=404, detail="LOA not found")
    perms = compute_permissions(user, loa, db)
    if not (perms.get("can_validate") or perms.get("can_override_lock")):
        raise HTTPException(
            status_code=403,
            detail="You cannot action this LOA at corporate review.",
        )
    # A closed cycle is an archive — nothing inside it changes again. All three
    # corporate actions (approve / hold / rework) funnel through here, so one
    # guard covers them.
    assert_cycle_open_for_writes(db, loa.cycle_id, action="actioned")
    return loa


def _next_ia_code(db: Session) -> str:
    """Next sequential IA code for the year, format YYYY-XXXX (4-digit, padded)."""
    prefix = f"{IA_YEAR}-"
    rows = db.query(LOA.ia_code).filter(LOA.ia_code.like(f"{prefix}%")).all()
    max_seq = 0
    for (code,) in rows:
        tail = (code or "")[len(prefix):]
        if tail.isdigit():
            max_seq = max(max_seq, int(tail))
    return f"{prefix}{max_seq + 1:04d}"


@router.post("/approve/{loa_id}")
async def approve(
    loa_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    loa = _authorize(db, loa_id, user)
    if not loa.ia_code:                       # keep an existing code if re-approved
        loa.ia_code = _next_ia_code(db)
    loa.status = "approved"
    loa.approved_at = datetime.utcnow()
    db.commit()
    db.refresh(loa)
    return {"id": str(loa.id), "status": loa.status, "ia_code": loa.ia_code}


@router.post("/hold/{loa_id}")
async def hold(
    loa_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    loa = _authorize(db, loa_id, user)
    loa.status = "on_hold"
    db.commit()
    db.refresh(loa)
    return {"id": str(loa.id), "status": loa.status, "ia_code": loa.ia_code}


@router.post("/rework/{loa_id}")
async def rework(
    loa_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    loa = _authorize(db, loa_id, user)
    loa.status = "emea_final_review"
    db.commit()
    db.refresh(loa)
    return {"id": str(loa.id), "status": loa.status, "ia_code": loa.ia_code}
