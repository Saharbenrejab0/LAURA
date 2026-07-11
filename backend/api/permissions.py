"""
Permissions API — Sprint 2.

Exposes endpoints related to permissions and the role/permission system.

Main endpoint: GET /loa/{loa_id}/my-permissions
  Returns what the currently logged-in user can do on a given LOA.

  Response format:
    {
      "loa_id": "...",
      "user_role": "france_marketer",
      "user_email": "flora@laura.local",
      "loa_status": "country_review",
      "can_view": true,
      "can_edit": true,
      "can_comment": true,
      "can_validate": false,
      "can_override_lock": false,
      "is_scope_match": true
    }

The frontend calls this endpoint when loading a LOA detail page to decide
which buttons/sections to show.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.models.database import get_db
from backend.api.auth import get_current_user
from backend.models.user import User
from backend.models.loa import LOA
from backend.models.role import Role
from backend.models.role_permission import RolePermission
from backend.models.permission import (
    Permission, implies,
    PERMISSION_VIEW, PERMISSION_COMMENT,
    PERMISSION_VALIDATE, PERMISSION_EDIT,
)

router = APIRouter(prefix="/permissions", tags=["permissions"])


def compute_permissions(user: User, loa: LOA, db: Session) -> dict:
    """
    Core permission computation: returns a dict describing what `user` can
    do on `loa`. Queries ALL matrix entries for this (role, status) pair.

    Rock 4: now includes can_delete and can_duplicate from the matrix.
    """
    role = user.role_obj
    result = {
        'loa_id': str(loa.id),
        'user_role': role.code if role else 'unknown',
        'user_email': user.email,
        'loa_status': loa.status,
        'is_scope_match': False,
        'is_author': (loa.requestor_email == user.email),
        'can_view': False,
        'can_edit': False,
        'can_comment': False,
        'can_validate': False,
        'can_delete': False,
        'can_duplicate': False,
        'can_override_lock': False,
    }

    if not role:
        return result

    result['can_override_lock'] = role.can_override_lock

    # 1. Scope check
    is_scope_match = role.matches_loa(loa)

    # Draft: private to author (super-admin can view)
    if loa.status == 'draft':
        if role.can_override_lock:
            result['is_scope_match'] = True
            result['can_view'] = True
            # Super-admin: also check matrix for delete/duplicate
            _apply_matrix_permissions(role, loa, db, result)
            return result
        if not result['is_author']:
            return result
        # Author of own draft
        result['is_scope_match'] = True
        result['can_view'] = True
        result['can_edit'] = True
        result['can_comment'] = True
        # Also check matrix for delete/duplicate
        _apply_matrix_permissions(role, loa, db, result)
        return result

    # Rejected: author can always edit to revise and resubmit
    if loa.status == 'rejected' and result['is_author']:
        result['is_scope_match'] = True
        result['can_view'] = True
        result['can_edit'] = True
        result['can_comment'] = True
        _apply_matrix_permissions(role, loa, db, result)
        return result

    result['is_scope_match'] = is_scope_match
    if not is_scope_match:
        return result

    # 2. Permission matrix lookup ? get ALL permissions for this (role, status)
    _apply_matrix_permissions(role, loa, db, result)
    return result


def _apply_matrix_permissions(role, loa, db, result):
    """Query all matrix entries for (role, status) and set flags in result."""
    rows = (
        db.query(Permission.code)
        .join(RolePermission, RolePermission.permission_id == Permission.id)
        .filter(
            RolePermission.role_id == role.id,
            RolePermission.loa_status == loa.status,
        )
        .all()
    )
    perm_codes = {r[0] for r in rows}

    if not perm_codes:
        return

    # Apply hierarchy via implies() for the standard 5 permissions
    for code in perm_codes:
        if implies(code, PERMISSION_VIEW):
            result['can_view'] = True
        if implies(code, PERMISSION_COMMENT):
            result['can_comment'] = True
        if implies(code, PERMISSION_VALIDATE):
            result['can_validate'] = True
        if implies(code, PERMISSION_EDIT):
            result['can_edit'] = True

    # delete and duplicate are standalone ? no hierarchy
    if 'delete' in perm_codes:
        result['can_delete'] = True
    if 'duplicate' in perm_codes:
        result['can_duplicate'] = True


@router.get("/loa/{loa_id}")
async def get_my_permissions_on_loa(
    loa_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Return the current user's permissions on a specific LOA.
    Frontend calls this on LOA detail page load to render the right UI.
    """
    loa = db.query(LOA).filter_by(id=loa_id).first()
    if not loa:
        raise HTTPException(status_code=404, detail="LOA not found")

    return compute_permissions(user, loa, db)


@router.get("/my-role")
async def get_my_role(user: User = Depends(get_current_user)):
    """
    Return basic info about the current user's role.
    Used by frontend to render generic UI (badges, profile, etc.)
    """
    role = user.role_obj
    return {
        'user_id': user.id,
        'email': user.email,
        'full_name': user.full_name,
        'role_code': role.code if role else None,
        'role_display_name': role.display_name if role else None,
        'role_scope_type': role.scope_type if role else None,
        'role_scope_value': role.scope_value if role else None,
        'can_override_lock': role.can_override_lock if role else False,
    }
