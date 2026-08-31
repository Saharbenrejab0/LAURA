"""
LAURA — Cycles API

GET    /cycles                       — all cycles + LOA counts, budget, verdicts
GET    /cycles?status=closed         — filter by lifecycle state
GET    /cycles/{id}                  — one cycle with its stats
GET    /cycles/{id}/loas             — the cycle's LOAs (review deck source)
POST   /cycles/{id}/status           — advance the lifecycle (admin)
POST   /cycles/{id}/close            — close + export + announce (admin)
GET    /cycles/{id}/export/excel     — download the cycle workbook
GET    /cycles/{id}/notifications    — close-announcement audit trail
"""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session

from backend.models.database import get_db
from backend.api.ordering import newest_first
from backend.models.loa import LOA
from backend.models.loa_cycle import LoaCycle, CYCLE_STATUSES
from backend.models.review import CycleCloseNotification
from backend.models.user import User
from backend.api.auth import get_current_user
from backend.services.cycle_service import (
    cycle_stats, user_reviewed_count, close_cycle, generate_cycle_excel, cycle_export_path,
    generate_cycle_code, can_view_cycle,
)

router = APIRouter(prefix="/cycles", tags=["cycles"])

XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

_ADMIN_ROLES = {"admin", "approver", "super_admin"}


def _require_admin(user: User) -> None:
    role = (user.role or "").lower()
    is_admin = role in _ADMIN_ROLES or (
        user.role_obj is not None and getattr(user.role_obj, "can_override_lock", False)
    )
    if not is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")


def _get_cycle(cycle_id: str, db: Session, user: Optional[User] = None) -> LoaCycle:
    cycle = db.query(LoaCycle).filter(LoaCycle.id == cycle_id).first()
    if not cycle:
        raise HTTPException(status_code=404, detail="Cycle not found")
    # An emergency cycle nobody named you on does not exist as far as you are
    # concerned — 404 rather than 403, so the reply cannot confirm it is there.
    if user is not None and not can_view_cycle(cycle, user):
        raise HTTPException(status_code=404, detail="Cycle not found")
    return cycle


def _days_remaining(cycle: LoaCycle) -> Optional[int]:
    if not cycle.end_date:
        return None
    now = datetime.utcnow()
    # Negative when past end_date — frontend renders each case distinctly.
    return (cycle.end_date.replace(tzinfo=None) - now).days


def _cycle_out(cycle: LoaCycle, stats: dict, reviewed_by_current_user: int = 0) -> dict:
    return {
        "id": str(cycle.id),
        "code": cycle.code,
        "name": cycle.name,
        "cycleType": cycle.cycle_type,
        "status": cycle.status,
        "isActive": cycle.status == "open",
        "isClosed": cycle.status == "closed",
        "startDate": cycle.start_date.isoformat() if cycle.start_date else None,
        "endDate": cycle.end_date.isoformat() if cycle.end_date else None,
        "daysRemaining": _days_remaining(cycle) if cycle.status == "open" else None,
        "createdBy": cycle.created_by,
        "createdAt": cycle.created_at.isoformat() if cycle.created_at else None,
        "closedAt": cycle.closed_at.isoformat() if cycle.closed_at else None,
        "closedBy": cycle.closed_by,
        "isTest": bool(cycle.is_test),
        "emergencyReason": cycle.emergency_reason,
        "authorizedEmails": cycle.authorized_emails or [],
        "reviewedByCurrentUser": reviewed_by_current_user,
        **stats,
    }


# ── List / detail ────────────────────────────────────────────────────────────

@router.get("")
def list_cycles(
    status: Optional[str] = Query(None, description="draft | open | under_review | closed"),
    cycle_type: Optional[str] = Query(None, description="normal | emergency"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """All cycles with their LOA count, budget and verdict tallies.

    This powers the Past Cycles archive, so the counts are computed per cycle
    rather than left to the client.
    """
    if status and status not in CYCLE_STATUSES:
        raise HTTPException(
            status_code=422,
            detail=f"status must be one of {', '.join(CYCLE_STATUSES)}",
        )

    q = db.query(LoaCycle)
    if status:
        q = q.filter(LoaCycle.status == status)
    if cycle_type:
        q = q.filter(LoaCycle.cycle_type == cycle_type)

    # Newest-first (shared rule). start_date is the tiebreaker so cycles
    # created in the same batch still read in period order.
    cycles = newest_first(q, LoaCycle, LoaCycle.start_date.desc().nullslast()).all()
    return [
        _cycle_out(
            c,
            cycle_stats(db, c.id),
            reviewed_by_current_user=user_reviewed_count(db, c.id, current_user.id),
        )
        for c in cycles
        if can_view_cycle(c, current_user)
    ]


@router.get("/{cycle_id}")
def get_cycle(
    cycle_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cycle = _get_cycle(cycle_id, db, current_user)
    out = _cycle_out(
        cycle,
        cycle_stats(db, cycle.id),
        reviewed_by_current_user=user_reviewed_count(db, cycle.id, current_user.id),
    )
    out["exportAvailable"] = cycle_export_path(cycle) is not None
    return out


@router.get("/{cycle_id}/loas")
def get_cycle_loas(
    cycle_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """The cycle's LOAs. Same shape the review deck consumes."""
    from backend.api.review import _loa_out

    _get_cycle(cycle_id, db, current_user)
    loas = newest_first(
        db.query(LOA).filter(LOA.cycle_id == cycle_id), LOA
    ).all()
    return [_loa_out(l) for l in loas]


# ── Create ───────────────────────────────────────────────────────────────────

class CreateCycleBody(BaseModel):
    name: str
    cycle_type: str = "normal"
    # Emergency cycles have no fixed window — an admin opens and closes them by
    # hand — so the dates are optional and defaulted below for that type only.
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    is_test: bool = False
    # Emergency only — both mandatory, validated in the endpoint where the type
    # is known. A pydantic-level `required` would break normal-cycle creation.
    reason: Optional[str] = None
    authorized_emails: Optional[list[str]] = None

    @field_validator("cycle_type")
    @classmethod
    def valid_type(cls, v: str) -> str:
        if v not in ("normal", "emergency"):
            raise ValueError("cycle_type must be normal or emergency")
        return v


def _parse_date(raw: str, field: str) -> datetime:
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00")).replace(tzinfo=None)
    except ValueError:
        raise HTTPException(status_code=422, detail=f"{field} must be an ISO date")


@router.post("", status_code=201)
def create_cycle(
    body: CreateCycleBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a cycle in `draft`. Opening it is a separate, deliberate step.

    New cycles never start open: an admin sets the window first, then opens it,
    so a mistyped date cannot immediately begin accepting submissions.
    """
    _require_admin(current_user)

    if body.cycle_type == "emergency":
        # No fixed window: it runs until an admin closes it. The columns are NOT
        # NULL, so a nominal year-long span stands in — the UI never shows it and
        # the lifecycle, not the calendar, is what gates an emergency cycle.
        start = _parse_date(body.start_date, "start_date") if body.start_date else datetime.utcnow()
        end = _parse_date(body.end_date, "end_date") if body.end_date else start + timedelta(days=365)
    else:
        if not body.start_date or not body.end_date:
            raise HTTPException(
                status_code=422,
                detail="A normal cycle needs a submission window — both start_date and end_date.",
            )
        start = _parse_date(body.start_date, "start_date")
        end = _parse_date(body.end_date, "end_date")
    if end <= start:
        raise HTTPException(status_code=422, detail="end_date must be after start_date")

    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="name is required")

    emails: Optional[list[str]] = None
    reason: Optional[str] = None
    if body.cycle_type == "emergency":
        reason = (body.reason or "").strip()
        if not reason:
            raise HTTPException(
                status_code=422,
                detail="An emergency cycle needs a reason — it is the audit trail for going off-cycle.",
            )
        emails = sorted({
            e.strip().lower() for e in (body.authorized_emails or []) if e and e.strip()
        })
        if not emails:
            raise HTTPException(
                status_code=422,
                detail="An emergency cycle needs at least one involved person.",
            )

    cycle = LoaCycle(
        name=name,
        code=generate_cycle_code(db, body.cycle_type, start),
        cycle_type=body.cycle_type,
        status="draft",
        is_active=False,
        start_date=start,
        end_date=end,
        is_test=bool(body.is_test),
        created_by=current_user.email,
        emergency_reason=reason,
        authorized_emails=emails,
    )
    db.add(cycle)
    db.commit()
    db.refresh(cycle)
    return _cycle_out(cycle, cycle_stats(db, cycle.id))


class UpdateCycleBody(BaseModel):
    """Every field optional — only what is sent gets changed."""
    name: Optional[str] = None
    end_date: Optional[str] = None
    authorized_emails: Optional[list[str]] = None
    reason: Optional[str] = None


@router.patch("/{cycle_id}")
def update_cycle(
    cycle_id: str,
    body: UpdateCycleBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Edit a cycle in place.

    What may change narrows as the cycle advances, because the earlier fields are
    what its LOAs were filed under:
      - name             : always
      - end_date         : only while draft or open — extending a deadline
      - authorized_emails: emergency only, at any time, since revoking access is
                           itself a thing an admin needs to do after the fact
      - start_date, type : never. They are the cycle's identity.
    """
    _require_admin(current_user)
    cycle = _get_cycle(cycle_id, db, current_user)

    if body.name is not None:
        name = body.name.strip()
        if not name:
            raise HTTPException(status_code=422, detail="name cannot be empty")
        cycle.name = name

    if body.end_date is not None:
        if cycle.status not in ("draft", "open"):
            raise HTTPException(
                status_code=409,
                detail=f"The window cannot be changed once a cycle is {cycle.status}.",
            )
        end = _parse_date(body.end_date, "end_date")
        if cycle.start_date and end <= cycle.start_date:
            raise HTTPException(status_code=422, detail="end_date must be after start_date")
        cycle.end_date = end

    if body.reason is not None:
        if cycle.cycle_type != "emergency":
            raise HTTPException(status_code=422, detail="Only emergency cycles carry a reason.")
        reason = body.reason.strip()
        if not reason:
            raise HTTPException(status_code=422, detail="The reason cannot be emptied.")
        cycle.emergency_reason = reason

    if body.authorized_emails is not None:
        if cycle.cycle_type != "emergency":
            raise HTTPException(
                status_code=422,
                detail="Only emergency cycles restrict visibility.",
            )
        emails = sorted({e.strip().lower() for e in body.authorized_emails if e and e.strip()})
        if not emails:
            raise HTTPException(
                status_code=422,
                detail="An emergency cycle needs at least one involved person.",
            )
        cycle.authorized_emails = emails

    db.commit()
    db.refresh(cycle)
    return _cycle_out(cycle, cycle_stats(db, cycle.id))


# ── Lifecycle ────────────────────────────────────────────────────────────────

class StatusBody(BaseModel):
    status: str
    # Moving a cycle backwards is a real operation, but never an accidental one:
    # the caller has to say so outright.
    confirm_reopen: bool = False

    @field_validator("status")
    @classmethod
    def valid_status(cls, v: str) -> str:
        if v not in CYCLE_STATUSES:
            raise ValueError(f"status must be one of {', '.join(CYCLE_STATUSES)}")
        return v


@router.post("/{cycle_id}/status")
def set_cycle_status(
    cycle_id: str,
    body: StatusBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Move a cycle along its lifecycle.

    Closing is deliberately NOT allowed here — it has side effects (export,
    announcement), so it goes through POST /cycles/{id}/close.
    """
    _require_admin(current_user)
    cycle = _get_cycle(cycle_id, db, current_user)

    if body.status == "closed":
        raise HTTPException(
            status_code=400,
            detail="Use POST /cycles/{id}/close to close a cycle.",
        )
    if CYCLE_STATUSES.index(body.status) < CYCLE_STATUSES.index(cycle.status):
        # Going backwards lets new LOAs into a cycle reviewers already worked
        # through, and a closed one has been exported and announced. It stays
        # possible — mistakes happen — but only when asked for by name.
        if not body.confirm_reopen:
            raise HTTPException(
                status_code=409,
                detail=(f'"{cycle.name}" is {cycle.status}. Moving it back to {body.status} '
                        "reopens work that was closed — resend with confirm_reopen."),
            )
        if cycle.status == "closed":
            # Live again, so no longer a closed record.
            cycle.closed_at = None
            cycle.closed_by = None

    # Only one normal cycle may be open — the DB enforces this too, but a clear
    # 409 beats a raw integrity error.
    if body.status == "open" and cycle.cycle_type == "normal":
        clash = (
            db.query(LoaCycle)
            .filter(
                LoaCycle.cycle_type == "normal",
                LoaCycle.status == "open",
                LoaCycle.id != cycle.id,
            )
            .first()
        )
        if clash:
            raise HTTPException(
                status_code=409,
                detail=f'"{clash.name}" is already open. Close or pause it first.',
            )

    cycle.apply_status(body.status)
    db.commit()
    db.refresh(cycle)
    return _cycle_out(cycle, cycle_stats(db, cycle.id))


@router.post("/{cycle_id}/close")
async def close_cycle_endpoint(
    cycle_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Close a cycle: freeze it, export the workbook, announce it on Teams."""
    _require_admin(current_user)
    cycle = _get_cycle(cycle_id, db)
    return await close_cycle(db, cycle, current_user)


# ── Export ───────────────────────────────────────────────────────────────────

@router.get("/{cycle_id}/export/excel")
def download_cycle_excel(
    cycle_id: str,
    regenerate: bool = Query(False, description="rebuild from current data"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Download the cycle workbook — LOA lines plus the summary pivot.

    Closed cycles serve the file written at close time so the archive is a
    faithful snapshot; open cycles always rebuild, since their data moves.
    """
    cycle = _get_cycle(cycle_id, db, current_user)

    path = None if regenerate else cycle_export_path(cycle)
    if path is None or cycle.status != "closed":
        path = generate_cycle_excel(db, cycle)

    if not path.exists():
        raise HTTPException(status_code=404, detail="Export not available")

    return FileResponse(
        path=str(path),
        media_type=XLSX_MIME,
        filename=path.name,
    )


@router.delete("/{cycle_id}")
def delete_test_cycle(
    cycle_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a throwaway cycle and every LOA inside it.

    Guarded by `is_test`: a real review period can never be deleted this way,
    however the request is formed. That flag is the safety rail — without it
    this endpoint would be a one-call way to destroy live submissions.
    """
    _require_admin(current_user)
    cycle = _get_cycle(cycle_id, db, current_user)

    # Two cases are safe: a test cycle, whose LOAs are throwaway by definition,
    # and any cycle holding zero LOAs, where there is nothing to destroy. A real
    # cycle with real submissions can never be deleted here, however the request
    # is formed — that is the safety rail.
    loa_count = db.query(LOA).filter(LOA.cycle_id == cycle.id).count()
    if not cycle.is_test and loa_count > 0:
        raise HTTPException(
            status_code=403,
            detail=(f'"{cycle.name}" holds {loa_count} LOA{"" if loa_count == 1 else "s"}. '
                    "Only an empty cycle, or one flagged is_test, can be deleted."),
        )

    from backend.models.review import (
        ReviewVerdict, ReviewComment, ReviewSubmission,
        LOAPhoto, CycleTitleConfig, CycleCloseNotification,
    )

    loa_ids = [r[0] for r in db.query(LOA.id).filter(LOA.cycle_id == cycle.id).all()]

    # Review artefacts first — several have no cascade to loas.
    deleted = {}
    for model in (ReviewVerdict, ReviewComment, ReviewSubmission,
                  LOAPhoto, CycleTitleConfig, CycleCloseNotification):
        deleted[model.__tablename__] = (
            db.query(model).filter(model.cycle_id == cycle.id)
            .delete(synchronize_session=False)
        )

    deleted["loas"] = (
        db.query(LOA).filter(LOA.cycle_id == cycle.id)
        .delete(synchronize_session=False)
    )
    db.delete(cycle)
    db.commit()

    return {
        "deleted": True,
        "cycleId": str(cycle.id),
        "cycleName": cycle.name,
        "loasDeleted": len(loa_ids),
        "rowsDeleted": deleted,
    }


@router.get("/{cycle_id}/notifications")
def get_cycle_notifications(
    cycle_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Audit trail of close announcements for this cycle."""
    _get_cycle(cycle_id, db, current_user)
    rows = (
        db.query(CycleCloseNotification)
        .filter(CycleCloseNotification.cycle_id == cycle_id)
        .order_by(CycleCloseNotification.sent_at.desc())
        .all()
    )
    return [
        {
            "id": str(n.id),
            "sentAt": n.sent_at.isoformat() if n.sent_at else None,
            "sentBy": n.sent_by,
            "recipients": n.recipients or [],
            "results": n.results or {},
            "teamsMessageId": n.teams_message_id,
            "excelFilePath": n.excel_file_path,
            "delivered": bool(n.webhook_delivered),
            "error": n.webhook_error,
        }
        for n in rows
    ]
