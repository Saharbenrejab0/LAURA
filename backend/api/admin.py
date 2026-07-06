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


# ── Valid statuses (single source of truth) ─────────────────────────────
VALID_STATUSES = [
    'draft', 'emea_review', 'global_review', 'cmo_cfo_review',
    'global_functions_review', 'corporate_review', 'approved', 'rejected',
]


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
    active_statuses = ['emea_review', 'global_brand_review', 'emea_brand_rework',
                       'global_functions_review', 'emea_functions_rework',
                       'cmo_cfo_review', 'emea_cmo_rework', 'corporate_review']
    pipeline_count = (
        db.query(sql_func.count(LOA.id))
        .filter(LOA.status.in_(active_statuses))
        .scalar() or 0
    )

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

        existing = db.query(RolePermission).filter_by(
            role_id=role.id, loa_status=entry.loa_status
        ).first()

        # 'none' = delete the entry (revoke access)
        if entry.permission_code == 'none':
            if existing:
                db.delete(existing)
                deleted += 1
            continue

        perm = db.query(Permission).filter_by(code=entry.permission_code).first()
        if not perm:
            continue

        if existing:
            existing.permission_id = perm.id
            updated += 1
        else:
            rp = RolePermission(
                role_id=role.id,
                loa_status=entry.loa_status,
                permission_id=perm.id,
            )
            db.add(rp)
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
