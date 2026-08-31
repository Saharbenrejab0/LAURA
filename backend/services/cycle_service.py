"""
Cycle resolution + close pipeline.

Single place that answers "which cycle does this LOA belong to?", so the rule
cannot drift between the LOA creation endpoint, the draft endpoint and any
future importer.
"""
from __future__ import annotations

import os
from datetime import datetime
from pathlib import Path
from typing import Optional

import httpx
import structlog
from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.models.loa import LOA
from backend.models.loa_cycle import LoaCycle
from backend.models.review import ReviewVerdict, CycleCloseNotification
from backend.models.user import User

logger = structlog.get_logger()

_EXPORT_DIR = Path(__file__).resolve().parent.parent / "uploads" / "cycle-exports"
_EXPORT_DIR.mkdir(parents=True, exist_ok=True)


# --------------------------------------------------------------------------- #
# Cycle resolution                                                             #
# --------------------------------------------------------------------------- #

def get_open_cycle(db: Session, cycle_type: str = "normal") -> Optional[LoaCycle]:
    """The cycle new LOAs of this type are assigned to, or None."""
    return (
        db.query(LoaCycle)
        .filter(LoaCycle.cycle_type == cycle_type, LoaCycle.status == "open")
        .order_by(LoaCycle.start_date.desc())
        .first()
    )


def generate_cycle_code(db: Session, cycle_type: str, start_date: datetime) -> str:
    """Stable reference code for a new cycle.

    normal    → {YEAR}-Q{Q}-N{seq}   e.g. 2026-Q3-N1
    emergency → {YEAR}-EX{seq}       e.g. 2026-EX2

    Same format the cycle_code_column migration back-filled, so codes issued by
    the app and by the migration live in one sequence. The counter walks past
    codes that are already taken rather than counting rows, so a deleted test
    cycle can never cause a re-issue of a code another row still holds.
    """
    year = start_date.year
    if cycle_type == "emergency":
        prefix = f"{year}-EX"
    else:
        prefix = f"{year}-Q{(start_date.month - 1) // 3 + 1}-N"

    taken = {
        row[0] for row in
        db.query(LoaCycle.code).filter(LoaCycle.code.like(f"{prefix}%")).all()
    }
    seq = 1
    while f"{prefix}{seq}" in taken:
        seq += 1
    return f"{prefix}{seq}"


# --------------------------------------------------------------------------- #
# Emergency cycle visibility                                                   #
# --------------------------------------------------------------------------- #

def _is_admin(user: User) -> bool:
    role = getattr(user, "role_obj", None)
    return role is not None and bool(getattr(role, "can_override_lock", False))


def can_view_cycle(cycle: LoaCycle, user: User) -> bool:
    """Whether this user may see the cycle at all.

    Normal cycles are open to everyone. An emergency cycle is confidential: only
    the people named on it — plus admins, who need it to run the thing — can see
    the cycle or anything inside it.
    """
    if cycle.cycle_type != "emergency":
        return True
    if _is_admin(user):
        return True
    emails = cycle.authorized_emails or []
    email = (user.email or "").lower()
    return bool(email) and any(str(e).strip().lower() == email for e in emails)


def hidden_cycle_ids(db: Session, user: User) -> list:
    """Emergency cycles this user is NOT authorised for.

    Returned as an exclusion list because that is the shape the LOA query needs:
    an LOA disappears only when it sits in an emergency cycle the user is not
    named on — everything else stays visible.
    """
    if _is_admin(user):
        return []
    return [
        c.id
        for c in db.query(LoaCycle).filter(LoaCycle.cycle_type == "emergency").all()
        if not can_view_cycle(c, user)
    ]


def resolve_cycle_for_new_loa(db: Session, is_emergency: bool = False) -> LoaCycle:
    """Cycle a newly created LOA belongs to.

    The submitter never picks this — an LOA belongs to whichever window was
    open when it was created. Raises 409 when nothing is open, because
    creating an unlinked LOA is exactly the state this whole brick removes.
    """
    cycle_type = "emergency" if is_emergency else "normal"
    cycle = get_open_cycle(db, cycle_type)

    if cycle is None and is_emergency:
        # An emergency LOA with no emergency window falls back to the normal
        # one rather than being rejected — it still needs somewhere to live.
        cycle = get_open_cycle(db, "normal")

    if cycle is None:
        raise HTTPException(
            status_code=409,
            detail="No active cycle. An admin must open a cycle before LOAs can be created.",
        )
    return cycle


def assert_cycle_open_for_writes(db: Session, cycle_id, action: str = "modified") -> None:
    """Guard mutations against closed cycles. Closed data is frozen."""
    if cycle_id is None:
        return
    cycle = db.query(LoaCycle).filter(LoaCycle.id == cycle_id).first()
    if cycle is not None and cycle.status == "closed":
        raise HTTPException(
            status_code=423,
            detail=f'Cycle "{cycle.name}" is closed. Its LOAs cannot be {action}.',
        )


def assert_cycle_accepts_submissions(db: Session, cycle_id) -> None:
    """The submission window. Drafting stays possible outside it; submitting does not.

    An LOA created before the window shut would otherwise slip into review after
    the cycle stopped taking work, which is the whole point of `under_review`.
    """
    if cycle_id is None:
        return
    cycle = db.query(LoaCycle).filter(LoaCycle.id == cycle_id).first()
    if cycle is None or cycle.status == "open":
        return
    reason = {
        "draft": "has not opened yet",
        "under_review": "has closed submissions and is now in review",
        "closed": "is closed",
    }.get(cycle.status, f"is {cycle.status}")
    raise HTTPException(
        status_code=423,
        detail=f'Cycle "{cycle.name}" {reason}. New submissions are not accepted.',
    )


# --------------------------------------------------------------------------- #
# Cycle statistics                                                             #
# --------------------------------------------------------------------------- #

def _clean_brand(raw: str) -> str:
    """Strip HB/LB/Essilor prefix for display: 'HB - Ray-Ban' → 'Ray-Ban'.

    # TODO: when the official brands reference list lands in data-foundations,
    # match against that canonical list instead of stripping raw-text prefixes.
    """
    if not raw:
        return raw
    s = raw.strip()
    for prefix in ("HB - ", "LB - ", "Essilor - ", "HB-", "LB-", "Essilor-"):
        if s.startswith(prefix):
            s = s[len(prefix):].strip()
            break
    if s in ("all HB", "all LB", "all HB + all LB"):
        return "Multi-brand"
    return s


def cycle_stats(db: Session, cycle_id) -> dict:
    """LOA count, budget, verdict tallies, brands and clusters for one cycle."""
    total, budget = (
        db.query(func.count(LOA.id), func.coalesce(func.sum(LOA.fy_2026_total), 0.0))
        .filter(LOA.cycle_id == cycle_id)
        .one()
    )

    decisions = dict(
        db.query(ReviewVerdict.decision, func.count(func.distinct(ReviewVerdict.loa_id)))
        .filter(ReviewVerdict.cycle_id == cycle_id)
        .group_by(ReviewVerdict.decision)
        .all()
    )

    # Fall back to the LOA's own workflow status when no reviewer verdict was
    # recorded — historical cycles predate the review module.
    if not decisions:
        statuses = dict(
            db.query(LOA.status, func.count(LOA.id))
            .filter(LOA.cycle_id == cycle_id)
            .group_by(LOA.status)
            .all()
        )
        decisions = {
            "approved": int(statuses.get("approved", 0)),
            "rejected": int(statuses.get("rejected", 0)),
        }

    # Top brands by budget — normalized, top 5 + overflow count.
    brand_rows = (
        db.query(LOA.brand, func.coalesce(func.sum(LOA.fy_2026_total), 0.0).label("bgt"))
        .filter(LOA.cycle_id == cycle_id, LOA.brand.isnot(None), LOA.brand != "")
        .group_by(LOA.brand)
        .order_by(func.coalesce(func.sum(LOA.fy_2026_total), 0.0).desc())
        .all()
    )
    # Collapse normalized names so 'HB - Ray-Ban' and 'Ray-Ban' count as one.
    seen_brands: dict[str, float] = {}
    for raw_brand, bgt in brand_rows:
        clean = _clean_brand(raw_brand)
        seen_brands[clean] = seen_brands.get(clean, 0.0) + float(bgt)
    sorted_brands = sorted(seen_brands.items(), key=lambda x: x[1], reverse=True)
    top5 = [b for b, _ in sorted_brands[:5]]
    overflow = max(0, len(sorted_brands) - 5)
    brands_in_scope = top5 + ([f"+{overflow} more"] if overflow else [])

    # Distinct clusters in scope.
    cluster_rows = (
        db.query(func.distinct(LOA.cluster))
        .filter(LOA.cycle_id == cycle_id, LOA.cluster.isnot(None), LOA.cluster != "")
        .all()
    )
    clusters_in_scope = sorted(r[0] for r in cluster_rows)

    return {
        "totalLoas": int(total or 0),
        "totalBudget": float(budget or 0.0),
        "approved": int(decisions.get("approved", 0)),
        "rejected": int(decisions.get("rejected", 0)),
        "brandsInScope": brands_in_scope,
        "clustersInScope": clusters_in_scope,
    }


def user_reviewed_count(db: Session, cycle_id, reviewer_id) -> int:
    """LOAs in this cycle where the given user has cast a verdict."""
    return int(
        db.query(func.count(func.distinct(ReviewVerdict.loa_id)))
        .filter(
            ReviewVerdict.cycle_id == cycle_id,
            ReviewVerdict.reviewer_id == reviewer_id,
        )
        .scalar()
        or 0
    )


# --------------------------------------------------------------------------- #
# Excel export                                                                 #
# --------------------------------------------------------------------------- #

def generate_cycle_excel(db: Session, cycle: LoaCycle) -> Path:
    """Write the cycle's workbook to disk and return its path.

    Reuses backend.engines.excel so the file is byte-for-byte the layout the
    CFO spreadsheet view is built from — data sheet plus summary pivot.
    """
    from backend.engines.excel import loas_to_rows, build_workbook, safe_filename

    loas = db.query(LOA).filter(LOA.cycle_id == cycle.id).all()
    rows = loas_to_rows(loas)

    wb = build_workbook(rows, title="LOA Lines", include_summary=True)
    stamp = datetime.utcnow().strftime("%Y%m%d")
    filename = f"{safe_filename(f'cycle_{cycle.name}')}_{stamp}.xlsx"
    path = _EXPORT_DIR / filename
    wb.save(str(path))

    logger.info("cycle_excel_generated", cycle_id=str(cycle.id),
                path=str(path), loas=len(loas))
    return path


def cycle_export_path(cycle: LoaCycle) -> Optional[Path]:
    """Most recent export on disk for this cycle, if one was generated."""
    from backend.engines.excel import safe_filename
    prefix = safe_filename(f"cycle_{cycle.name}")
    matches = sorted(_EXPORT_DIR.glob(f"{prefix}_*.xlsx"))
    return matches[-1] if matches else None


# --------------------------------------------------------------------------- #
# Close pipeline                                                               #
# --------------------------------------------------------------------------- #

def _cycle_recipients(db: Session, cycle_id) -> list[dict]:
    """Everyone who reviewed in this cycle, plus the standing CMO/CFO roles."""
    reviewer_ids = [
        r[0] for r in
        db.query(ReviewVerdict.reviewer_id).filter(ReviewVerdict.cycle_id == cycle_id).distinct()
    ]
    users = db.query(User).filter(User.id.in_(reviewer_ids)).all() if reviewer_ids else []

    stakeholders = (
        db.query(User)
        .filter(func.lower(User.role).in_(["cmo", "cfo", "admin", "approver"]))
        .all()
    )

    seen, out = set(), []
    for u in [*users, *stakeholders]:
        if u.id in seen:
            continue
        seen.add(u.id)
        out.append({"id": str(u.id), "email": u.email, "role": u.role})
    return out


async def trigger_n8n_webhook(event: str, payload: dict) -> tuple[bool, Optional[str], Optional[str]]:
    """POST to the n8n workflow. Returns (delivered, message_id, error).

    Never raises: a cycle must still close cleanly when the integration is
    unconfigured or down. The outcome is recorded on the notification row.
    """
    # A dedicated cycle URL wins; otherwise fall back to the shared workflow.
    url = os.getenv("N8N_CYCLE_WEBHOOK_URL") or os.getenv("N8N_WEBHOOK_URL", "")
    if not url:
        return False, None, "N8N_WEBHOOK_URL is not configured"
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.post(url, json={"event": event, **payload})
            resp.raise_for_status()
            body = {}
            try:
                body = resp.json()
            except Exception:
                pass
            if not isinstance(body, dict):
                body = {}
            return True, body.get("teams_message_id") or body.get("id"), None
    except Exception as exc:
        # Nothing in here may raise: closing a cycle must not depend on n8n.
        # NB: `event` is structlog's reserved first argument — never pass it
        # as a keyword or the logger call itself throws.
        try:
            logger.warning("n8n_webhook_failed", webhook_event=event, error=str(exc))
        except Exception:
            pass
        return False, None, str(exc)


async def close_cycle(db: Session, cycle: LoaCycle, closed_by: User) -> dict:
    """Freeze a cycle: set status, export the workbook, announce it.

    The status change is committed before the announcement, so a webhook
    failure can never leave a half-closed cycle.
    """
    if cycle.status == "closed":
        raise HTTPException(status_code=409, detail="Cycle is already closed.")

    stats = cycle_stats(db, cycle.id)

    cycle.apply_status("closed")
    cycle.closed_at = datetime.utcnow()
    cycle.closed_by = closed_by.email
    db.commit()
    db.refresh(cycle)

    excel_path: Optional[Path] = None
    try:
        excel_path = generate_cycle_excel(db, cycle)
    except Exception as exc:
        logger.warning("cycle_excel_failed", cycle_id=str(cycle.id), error=str(exc))

    base_url = os.getenv("PUBLIC_BASE_URL", "http://localhost:3000")
    api_url = os.getenv("PUBLIC_API_URL", "http://localhost:8000")

    # Everything from here is best-effort: the cycle is already closed, and no
    # announcement failure may turn that into a 500 for the caller.
    try:
        recipients = _cycle_recipients(db, cycle.id)
    except Exception as exc:
        logger.warning("cycle_recipients_failed", cycle_id=str(cycle.id), error=str(exc))
        recipients = []

    delivered, message_id, error = await trigger_n8n_webhook("cycle_closed", {
        "cycle_id": str(cycle.id),
        "cycle_name": cycle.name,
        "cycle_type": cycle.cycle_type,
        "results": {
            "total_loas": stats["totalLoas"],
            "approved": stats["approved"],
            "rejected": stats["rejected"],
            "total_budget": stats["totalBudget"],
        },
        "excel_url": f"{api_url}/cycles/{cycle.id}/export/excel" if excel_path else None,
        "review_url": f"{base_url}/?view=review&cycle={cycle.id}",
        "closed_by": closed_by.full_name or closed_by.email,
        "closed_at": cycle.closed_at.isoformat(),
        "recipients": [r["email"] for r in recipients],
    })

    # The audit row records what happened either way — a cycle closed while
    # the integration was down still has to be traceable.
    try:
        db.add(CycleCloseNotification(
            cycle_id=cycle.id,
            sent_by=closed_by.email,
            recipients=recipients,
            results=stats,
            teams_message_id=message_id,
            excel_file_path=str(excel_path) if excel_path else None,
            webhook_delivered=delivered,
            webhook_error=error,
        ))
        db.commit()
    except Exception as exc:
        db.rollback()
        logger.warning("cycle_notification_record_failed",
                       cycle_id=str(cycle.id), error=str(exc))

    logger.info("cycle_closed", cycle_id=str(cycle.id),
                delivered=delivered, loas=stats["totalLoas"])

    return {
        "id": str(cycle.id),
        "name": cycle.name,
        "status": cycle.status,
        "closedAt": cycle.closed_at.isoformat(),
        "closedBy": cycle.closed_by,
        "results": stats,
        "excelGenerated": excel_path is not None,
        "notification": {
            "delivered": delivered,
            "recipients": len(recipients),
            "error": error,
        },
    }
