"""
LAURA — Admin API (Sprint 3)
=============================
Super-admin-only endpoints for the dashboard.
All routes require can_override_lock = True on the user's role.

Endpoints:
  GET  /admin/stats         → LOA counts by status, total budget, user count
  GET  /admin/users         → all users with their role info
  PATCH /admin/users/{id}   → change a user's role
  GET  /admin/roles         → all roles with user count
"""

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func as sql_func
from pydantic import BaseModel
from typing import Optional

from backend.models.database import get_db
from backend.api.auth import get_current_user
from backend.models.user import User
from backend.models.role import Role
from backend.models.loa import LOA

router = APIRouter(prefix="/admin", tags=["admin"])


# ── Guard: super-admin only ────────────────────────────────────────────
async def require_super_admin(
    user: User = Depends(get_current_user),
):
    """Dependency that blocks non-super-admins."""
    role = user.role_obj
    if not role or not role.can_override_lock:
        raise HTTPException(
            status_code=403,
            detail="Super-admin access required.",
        )
    return user


# ── GET /admin/stats ───────────────────────────────────────────────────
@router.get("/stats")
async def get_dashboard_stats(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_super_admin),
):
    """
    Dashboard summary: LOA counts by status, total FY26 budget, user/role counts.
    """
    # LOAs by status
    status_rows = (
        db.query(LOA.status, sql_func.count(LOA.id))
        .group_by(LOA.status)
        .all()
    )
    loas_by_status = {status: count for status, count in status_rows}

    # Total budget
    total_budget = db.query(
        sql_func.coalesce(sql_func.sum(LOA.fy_2026_total), 0)
    ).scalar()

    # Locked LOAs
    locked_count = db.query(sql_func.count(LOA.id)).filter(
        LOA.is_locked == True
    ).scalar()

    # User & role counts
    total_users = db.query(sql_func.count(User.id)).scalar()
    total_roles = db.query(sql_func.count(Role.id)).scalar()
    total_loas = db.query(sql_func.count(LOA.id)).scalar()

    return {
        "total_loas": total_loas,
        "total_budget_fy26": total_budget,
        "locked_count": locked_count,
        "total_users": total_users,
        "total_roles": total_roles,
        "loas_by_status": loas_by_status,
    }


# ── GET /admin/users ──────────────────────────────────────────────────
@router.get("/users")
async def get_all_users(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_super_admin),
):
    """Return all users with their role info."""
    users = db.query(User).order_by(User.full_name).all()
    result = []
    for u in users:
        role = u.role_obj
        result.append({
            "id": str(u.id),
            "email": u.email,
            "full_name": u.full_name,
            "is_active": u.is_active,
            "role_id": u.role_id,
            "role_code": role.code if role else None,
            "role_display_name": role.display_name if role else None,
            "role_scope_type": role.scope_type if role else None,
            "role_scope_value": role.scope_value if role else None,
            "can_override_lock": role.can_override_lock if role else False,
            "last_login": u.last_login.isoformat() if u.last_login else None,
            "created_at": u.created_at.isoformat() if u.created_at else None,
        })
    return result


# ── PATCH /admin/users/{user_id} ──────────────────────────────────────
class UpdateUserRole(BaseModel):
    role_id: int


@router.patch("/users/{user_id}")
async def update_user_role(
    user_id: str,
    body: UpdateUserRole,
    db: Session = Depends(get_db),
    admin: User = Depends(require_super_admin),
):
    """Change a user's role. Super-admin only."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    role = db.query(Role).filter(Role.id == body.role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    old_role_code = user.role_obj.code if user.role_obj else "none"
    user.role_id = body.role_id
    db.commit()
    db.refresh(user)

    return {
        "user_id": str(user.id),
        "email": user.email,
        "full_name": user.full_name,
        "old_role": old_role_code,
        "new_role": role.code,
        "new_role_display_name": role.display_name,
    }


# ── GET /admin/roles ──────────────────────────────────────────────────
@router.get("/roles")
async def get_all_roles(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_super_admin),
):
    """Return all roles with user count per role."""
    roles = db.query(Role).order_by(Role.id).all()

    # Count users per role in one query
    user_counts = dict(
        db.query(User.role_id, sql_func.count(User.id))
        .group_by(User.role_id)
        .all()
    )

    result = []
    for r in roles:
        result.append({
            "id": r.id,
            "code": r.code,
            "display_name": r.display_name,
            "description": r.description,
            "scope_type": r.scope_type,
            "scope_value": r.scope_value,
            "can_override_lock": r.can_override_lock,
            "user_count": user_counts.get(r.id, 0),
        })
    return result
