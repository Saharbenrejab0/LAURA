"""
LAURA — Admin API (Dashboard v2)

Super-admin-only endpoints for the admin dashboard.
All routes require can_override_lock = True on the user's role.

Endpoints:
  GET   /admin/stats                → LOA counts, budgets, pipeline metrics
  GET   /admin/users                → all users with role info
  PATCH /admin/users/{user_id}/role → change a user's role
  GET   /admin/roles                → all roles
  GET   /admin/permission-matrix    → full role × status × permission matrix
  PATCH /admin/permission-matrix    → batch upsert matrix entries
  POST  /admin/loa/{loa_id}/force-status → override LOA status
  GET   /admin/activity             → recent workflow transitions
"""

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func as sql_func, text, desc
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from backend.models.database import get_db
from backend.api.auth import get_current_user
from backend.models.user import User
from backend.models.role import Role
from backend.models.loa import LOA
from backend.models.permission import Permission
from backend.models.role_permission import RolePermission

router = APIRouter(prefix="/admin", tags=["admin"])


# ── Valid statuses ─────────────────────────────────────────────────────
# Derived from the workflow itself, not re-typed. The hand-written copy that
# used to live here had drifted: it was missing `local_alignment`,
# `emea_post_global_review` and `emea_final_review`, and contained
# `global_functions_review`, which no LOA has ever had.
#
# That list drives the Admin Console's Roles & permissions columns AND the PATCH
# filter, so the drift meant three live review stages were unmanageable and any
# edit to them was dropped while reporting success.
from backend.api.loa import WORKFLOW_ORDER as _WORKFLOW_ORDER

VALID_STATUSES = [*_WORKFLOW_ORDER, 'rejected', 'returned']


# ── Guard: super-admin only ────────────────────────────────────────────
async def require_super_admin(
    user: User = Depends(get_current_user),
):
    role = user.role_obj
    if not role or not role.can_override_lock:
        raise HTTPException(status_code=403, detail="Super-admin access required.")
    return user


# ── Schemas ─────────────────────────────────────────────────────────────
class RoleAssignment(BaseModel):
    role_code: str


class CreateUserRequest(BaseModel):
    email: str
    full_name: str
    password: str
    role_code: str
    is_active: bool = True


class MatrixEntry(BaseModel):
    role_code: str
    loa_status: str
    permission_code: str  # 'view', 'comment', 'validate', 'edit', 'advance_phase', or 'none' to delete


class MatrixBatchUpdate(BaseModel):
    entries: list[MatrixEntry]


class ForceStatusRequest(BaseModel):
    new_status: str
    reason: str = ""


# ═══════════════════════════════════════════════════════════════════════
# GET /admin/stats — Dashboard metrics
# ═══════════════════════════════════════════════════════════════════════
@router.get("/stats")
async def get_dashboard_stats(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_super_admin),
):
    # LOA counts by status
    status_counts_raw = (
        db.query(LOA.status, sql_func.count(LOA.id))
        .group_by(LOA.status)
        .all()
    )
    status_counts = {s: c for s, c in status_counts_raw}

    # Total FY2026 budget
    total_fy26 = db.query(sql_func.sum(LOA.fy_2026_total)).scalar() or 0

    # Budget by cluster
    cluster_budgets_raw = (
        db.query(LOA.cluster, sql_func.sum(LOA.fy_2026_total))
        .group_by(LOA.cluster)
        .order_by(desc(sql_func.sum(LOA.fy_2026_total)))
        .all()
    )
    cluster_budgets = [{"cluster": c, "total": round(t or 0, 2)} for c, t in cluster_budgets_raw]

    # Budget by activity type (top 10)
    activity_budgets_raw = (
        db.query(LOA.activity_type, sql_func.sum(LOA.fy_2026_total))
        .group_by(LOA.activity_type)
        .order_by(desc(sql_func.sum(LOA.fy_2026_total)))
        .limit(10)
        .all()
    )
    activity_budgets = [{"activity": a, "total": round(t or 0, 2)} for a, t in activity_budgets_raw]

    # Counts
    total_loas = db.query(sql_func.count(LOA.id)).scalar() or 0
    total_users = db.query(sql_func.count(User.id)).scalar() or 0
    locked_count = db.query(sql_func.count(LOA.id)).filter(LOA.is_locked == True).scalar() or 0

    # Pipeline: LOAs in active review (not draft, not terminal)
    active_statuses = [
        'local_alignment', 'emea_review', 'global_review',
        'emea_post_global_review', 'cmo_cfo_review', 'emea_final_review', 'corporate_review',
    ]
    pipeline_count = (
        db.query(sql_func.count(LOA.id))
        .filter(LOA.status.in_(active_statuses))
        .scalar() or 0
    )

    # LOAs by source (laura_created / historical_import / demo_seed)
    source_counts_raw = (
        db.query(LOA.source, sql_func.count(LOA.id))
        .group_by(LOA.source)
        .all()
    )
    source_counts = {s: c for s, c in source_counts_raw}

    # High-value LOAs: fy_2026_total above the alert threshold, highest first
    BUDGET_ALERT_THRESHOLD = 50_000
    high_value_raw = (
        db.query(LOA)
        .filter(LOA.fy_2026_total > BUDGET_ALERT_THRESHOLD)
        .order_by(desc(LOA.fy_2026_total))
        .limit(20)
        .all()
    )
    high_value_loas = [{
        "id": str(loa.id),
        "cycle_id": str(loa.cycle_id) if loa.cycle_id else None,
        "draft_id": loa.loa_draft_id,
        "cluster": loa.cluster,
        "country": loa.country,
        "brand": loa.brand,
        "fy_2026_total": loa.fy_2026_total,
        "status": loa.status,
    } for loa in high_value_raw]

    # Recent LOAs (last 10 updated)
    recent_loas = (
        db.query(LOA)
        .order_by(desc(LOA.updated_at))
        .limit(10)
        .all()
    )
    recent = [{
        "id": str(loa.id),
        "draft_id": loa.loa_draft_id,
        "status": loa.status,
        "cluster": loa.cluster,
        "country": loa.country,
        "brand": loa.brand,
        "fy_2026_total": loa.fy_2026_total,
        "updated_at": str(loa.updated_at) if loa.updated_at else None,
        "requestor_email": loa.requestor_email,
    } for loa in recent_loas]

    return {
        "status_counts": status_counts,
        "total_loas": total_loas,
        "total_fy26": round(total_fy26, 2),
        "total_users": total_users,
        "locked_count": locked_count,
        "pipeline_count": pipeline_count,
        "cluster_budgets": cluster_budgets,
        "activity_budgets": activity_budgets,
        "recent_loas": recent,
        "source_counts": source_counts,
        "high_value_loas": high_value_loas,
    }


# ═══════════════════════════════════════════════════════════════════════
# GET /admin/users — All users
# ═══════════════════════════════════════════════════════════════════════
@router.get("/users")
async def get_users(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_super_admin),
):
    users = db.query(User).all()
    result = []
    for u in users:
        role = u.role_obj
        result.append({
            "id": str(u.id),
            "email": u.email,
            "full_name": u.full_name,
            "is_active": u.is_active,
            "role_code": role.code if role else None,
            "role_name": role.display_name if role else "No role",
            "scope_type": role.scope_type if role else None,
            "can_override_lock": role.can_override_lock if role else False,
            "created_at": str(u.created_at) if u.created_at else None,
        })
    return result


# ═══════════════════════════════════════════════════════════════════════
# PATCH /admin/users/{user_id}/role — Change user role
# ═══════════════════════════════════════════════════════════════════════
@router.patch("/users/{user_id}/role")
async def change_user_role(
    user_id: str,
    body: RoleAssignment,
    db: Session = Depends(get_db),
    admin: User = Depends(require_super_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    role = db.query(Role).filter_by(code=body.role_code).first()
    if not role:
        raise HTTPException(status_code=400, detail=f"Role '{body.role_code}' not found")

    user.role_id = role.id
    db.commit()
    db.refresh(user)
    return {"user_id": user_id, "new_role": role.code, "new_role_name": role.display_name}


# ═══════════════════════════════════════════════════════════════════════
# POST /admin/users — Create a new user
# ═══════════════════════════════════════════════════════════════════════
@router.post("/users", status_code=201)
async def create_user(
    body: CreateUserRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_super_admin),
):
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=400, detail="Email already in use.")

    role = db.query(Role).filter_by(code=body.role_code).first()
    if not role:
        raise HTTPException(status_code=400, detail=f"Role '{body.role_code}' not found.")

    from backend.api.auth import hash_password
    new_user = User(
        email=body.email,
        full_name=body.full_name,
        hashed_password=hash_password(body.password),
        role="editor",          # legacy field — kept for backward compat
        role_id=role.id,
        is_active=body.is_active,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {
        "id":            str(new_user.id),
        "email":         new_user.email,
        "full_name":     new_user.full_name,
        "is_active":     new_user.is_active,
        "role_code":     role.code,
        "role_name":     role.display_name,
        "scope_type":    role.scope_type,
        "scope_value":   role.scope_value,
        "created_at":    str(new_user.created_at) if new_user.created_at else None,
    }


# ═══════════════════════════════════════════════════════════════════════
# PATCH /admin/users/{user_id}/deactivate — Soft-deactivate a user
# ═══════════════════════════════════════════════════════════════════════
@router.patch("/users/{user_id}/deactivate")
async def deactivate_user(
    user_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_super_admin),
):
    if str(admin.id) == user_id:
        raise HTTPException(status_code=400, detail="Cannot deactivate yourself.")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    user.is_active = False
    db.commit()
    return {"user_id": user_id, "is_active": False}


# ═══════════════════════════════════════════════════════════════════════
# PATCH /admin/users/{user_id}/reactivate — Re-activate a deactivated user
# ═══════════════════════════════════════════════════════════════════════
@router.patch("/users/{user_id}/reactivate")
async def reactivate_user(
    user_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_super_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    user.is_active = True
    db.commit()
    return {"user_id": user_id, "is_active": True}


# ═══════════════════════════════════════════════════════════════════════
# GET /admin/roles — All roles
# ═══════════════════════════════════════════════════════════════════════
@router.get("/roles")
async def get_roles(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_super_admin),
):
    roles = db.query(Role).order_by(Role.code).all()
    result = []
    for r in roles:
        user_count = db.query(sql_func.count(User.id)).filter(User.role_id == r.id).scalar() or 0
        result.append({
            "id": r.id,
            "code": r.code,
            "display_name": r.display_name,
            "scope_type": r.scope_type,
            "scope_value": r.scope_value,
            "can_override_lock": r.can_override_lock,
            "user_count": user_count,
        })
    return result


# ═══════════════════════════════════════════════════════════════════════
# GET /admin/permission-matrix — Full matrix
# ═══════════════════════════════════════════════════════════════════════
@router.get("/permission-matrix")
async def get_permission_matrix(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_super_admin),
):
    rows = (
        db.query(RolePermission, Role, Permission)
        .join(Role, RolePermission.role_id == Role.id)
        .join(Permission, RolePermission.permission_id == Permission.id)
        .all()
    )

    matrix = {}
    for rp, role, perm in rows:
        if role.code not in matrix:
            matrix[role.code] = {"role_code": role.code, "role_name": role.display_name, "permissions": {}}
        matrix[role.code]["permissions"][rp.loa_status] = perm.code

    return {
        "statuses": VALID_STATUSES,
        "matrix": list(matrix.values()),
    }


@router.get("/permissions")
async def list_permissions(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_super_admin),
):
    """
    The permission vocabulary, for the Admin Console's Roles & permissions grid.

    Read-only, and additive: no schema change. The console needs the full set of
    permission codes to offer in a cell, not only the ones some role happens to
    hold already — deriving the options from existing grants would make a
    never-yet-granted permission unassignable.
    """
    perms = db.query(Permission).order_by(Permission.id).all()
    return [
        {"code": p.code, "display_name": p.display_name, "description": p.description}
        for p in perms
    ]


# ═══════════════════════════════════════════════════════════════════════
# PATCH /admin/permission-matrix — Batch upsert
# ═══════════════════════════════════════════════════════════════════════
@router.patch("/permission-matrix")
async def update_permission_matrix(
    body: MatrixBatchUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_super_admin),
):
    updated = 0
    created = 0
    deleted = 0

    for entry in body.entries:
        role = db.query(Role).filter_by(code=entry.role_code).first()
        if not role:
            continue

        if entry.loa_status not in VALID_STATUSES:
            continue

        # A (role, status) pair legitimately holds SEVERAL grants — the seed gives
        # marketers edit+delete+duplicate on `draft`. `.first()` therefore cannot
        # stand in for "the grant": revoking with it deleted one row and left the
        # rest, so the cell read as empty while the permission was still live.
        existing_all = db.query(RolePermission).filter_by(
            role_id=role.id, loa_status=entry.loa_status
        ).all()

        # 'none' = revoke access on this cell entirely
        if entry.permission_code == 'none':
            for row in existing_all:
                db.delete(row)
                deleted += 1
            continue

        perm = db.query(Permission).filter_by(code=entry.permission_code).first()
        if not perm:
            continue

        # Setting a cell means "this is now the grant", so any other grant on the
        # same pair goes with it — otherwise the grid shows one value while the
        # database holds several.
        if any(r.permission_id == perm.id for r in existing_all):
            for row in existing_all:
                if row.permission_id != perm.id:
                    db.delete(row)
                    deleted += 1
            updated += 1
        else:
            for row in existing_all:
                db.delete(row)
                deleted += 1
            db.add(RolePermission(
                role_id=role.id,
                loa_status=entry.loa_status,
                permission_id=perm.id,
            ))
            created += 1

    db.commit()
    return {"updated": updated, "created": created, "deleted": deleted}


# ═══════════════════════════════════════════════════════════════════════
# POST /admin/loa/{loa_id}/force-status — Override workflow
# ═══════════════════════════════════════════════════════════════════════
@router.post("/loa/{loa_id}/force-status")
async def force_loa_status(
    loa_id: str,
    body: ForceStatusRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_super_admin),
):
    loa = db.query(LOA).filter(LOA.id == loa_id).first()
    if not loa:
        raise HTTPException(status_code=404, detail="LOA not found")

    if body.new_status not in VALID_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status '{body.new_status}'. Valid: {VALID_STATUSES}",
        )

    old_status = loa.status
    loa.status = body.new_status

    if body.new_status == 'approved' and not loa.approved_at:
        loa.approved_at = datetime.utcnow()

    db.commit()
    db.refresh(loa)

    return {
        "loa_id": str(loa.id),
        "draft_id": loa.loa_draft_id,
        "old_status": old_status,
        "new_status": body.new_status,
        "forced_by": admin.email,
        "reason": body.reason,
    }


class CycleStartRequest(BaseModel):
    cycle_type: str
    start_date: str
    end_date: str
    name: str | None = None
    authorized_emails: list[str] | None = None


@router.post("/cycle/start")
async def start_cycle(
    body: CycleStartRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_super_admin),
):
    from backend.models.loa_cycle import LoaCycle
    from datetime import datetime
    import uuid as uuid_lib

    if body.cycle_type not in ("normal", "emergency"):
        raise HTTPException(status_code=422, detail="cycle_type must be normal or emergency")

    try:
        start = datetime.fromisoformat(body.start_date)
        end = datetime.fromisoformat(body.end_date)
    except ValueError:
        raise HTTPException(status_code=422, detail="dates must be ISO format YYYY-MM-DD")

    db.query(LoaCycle).filter(
        LoaCycle.cycle_type == body.cycle_type, LoaCycle.is_active == True
    ).update({"is_active": False})

    cycle = LoaCycle(
        id=uuid_lib.uuid4(),
        name=body.name or f"{body.cycle_type.title()} cycle - {start.strftime('%b %d')} to {end.strftime('%b %d, %Y')}",
        cycle_type=body.cycle_type,
        start_date=start,
        end_date=end,
        is_active=True,
        created_by=admin.email,
        authorized_emails=body.authorized_emails,
    )
    db.add(cycle)
    db.commit()
    db.refresh(cycle)

    return {
        "id": str(cycle.id), "name": cycle.name, "cycle_type": cycle.cycle_type,
        "start_date": cycle.start_date.isoformat(), "end_date": cycle.end_date.isoformat(),
        "is_active": cycle.is_active,
    }


@router.get("/cycle/active")
async def get_active_cycles(
    db: Session = Depends(get_db),
    admin: User = Depends(require_super_admin),
):
    from backend.models.loa_cycle import LoaCycle
    cycles = db.query(LoaCycle).filter(LoaCycle.is_active == True).all()
    return [
        {
            "id": str(c.id), "name": c.name, "cycle_type": c.cycle_type,
            "start_date": c.start_date.isoformat(), "end_date": c.end_date.isoformat(),
        }
        for c in cycles
    ]


@router.get("/cycle/current")
async def get_current_cycle_context(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Auth-only cycle context for the tracker (readable by every role).

    Unlike /cycle/active (super-admin only), this powers the tracker's cycle
    banner and scope tabs for ALL authenticated users, and tells the current
    user whether they may open an emergency LOA (email ∈ authorized_emails of
    the active emergency cycle). Returns:
      - active[]  : currently open cycles (normal + emergency)
      - past[]    : closed cycles, newest first, with per-cycle LOA counts
      - can_create_emergency / emergency_cycle : Task 2 authorization
    """
    from backend.models.loa_cycle import LoaCycle
    from backend.services.cycle_service import can_view_cycle

    def _fmt(c):
        return {
            "id": str(c.id), "name": c.name, "code": c.code,
            "cycle_type": c.cycle_type, "status": c.status,
            "start_date": c.start_date.isoformat(), "end_date": c.end_date.isoformat(),
        }

    # An emergency cycle is confidential — it must not even appear in the
    # tracker's cycle context for someone who is not named on it.
    active = [
        c for c in db.query(LoaCycle).filter(LoaCycle.is_active == True).all()
        if can_view_cycle(c, user)
    ]

    # Past cycles for the "Past Cycles" dropdown, with LOA counts.
    past_cycles = [
        c for c in (
            db.query(LoaCycle)
            .filter(LoaCycle.status == "closed")
            .order_by(desc(LoaCycle.created_at).nullslast(), LoaCycle.start_date.desc().nullslast())
            .all()
        )
        if can_view_cycle(c, user)
    ]
    counts = dict(
        db.query(LOA.cycle_id, sql_func.count(LOA.id))
        .filter(LOA.cycle_id.isnot(None))
        .group_by(LOA.cycle_id)
        .all()
    )
    past = []
    for c in past_cycles:
        row = _fmt(c)
        row["loa_count"] = int(counts.get(c.id, 0))
        past.append(row)

    # Emergency authorization for the current user.
    emergency = next((c for c in active if c.cycle_type == "emergency"), None)
    can_create_emergency = False
    emergency_out = None
    if emergency is not None:
        emails = emergency.authorized_emails or []
        can_create_emergency = bool(
            user.email and any(user.email.lower() == str(e).lower() for e in emails)
        )
        emergency_out = {
            "id": str(emergency.id),
            "name": emergency.name,
            "code": emergency.code,
            "reason": emergency.emergency_reason,
            "end_date": emergency.end_date.isoformat(),
        }

    # The one question the "New LOA" button needs answered: is a normal window
    # taking submissions right now?
    normal = next((c for c in active if c.cycle_type == "normal"), None)

    return {
        "active": [_fmt(c) for c in active],
        "past": past,
        "can_submit": normal is not None and normal.status == "open",
        "can_create_emergency": can_create_emergency,
        "emergency_cycle": emergency_out,
    }
