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
    do on `loa`. Used both by the endpoint below and by the middleware.

    Returns:
        {
            'loa_id': str,
            'user_role': str,
            'user_email': str,
            'loa_status': str,
            'is_scope_match': bool,    # Does the user's role scope cover this LOA?
            'is_author': bool,         # Is the user the LOA's requestor?
            'can_view': bool,
            'can_edit': bool,
            'can_comment': bool,
            'can_validate': bool,
            'can_override_lock': bool, # True for super-admin only
        }
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
        'can_override_lock': False,
    }

    # No role assigned -> no permissions
    if not role:
        return result

    # Super-admin override flag — applies regardless of permission matrix
    result['can_override_lock'] = role.can_override_lock

    # 1. Scope check: does this role have visibility on this LOA?
    is_scope_match = role.matches_loa(loa)

    # Special case: 'draft' status is private to the author, regardless of role.
    # Only the author can see/edit a draft. Super-admin can view drafts too,
    # but not edit them (drafts belong to their creator).
    if loa.status == 'draft':
        if role.can_override_lock:
            result['is_scope_match'] = True
            result['can_view'] = True
            return result
        if not result['is_author']:
            return result
        # Author of their own draft — always full edit access
        result['is_scope_match'] = True
        result['can_view'] = True
        result['can_edit'] = True
        result['can_comment'] = True
        return result

    # Same logic for rejected — author can always edit to revise & resubmit
    if loa.status == 'rejected' and result['is_author']:
        result['is_scope_match'] = True
        result['can_view'] = True
        result['can_edit'] = True
        result['can_comment'] = True
        # Don't return — let matrix add validate if applicable
        # else: author of the draft has the access defined by the matrix below

    result['is_scope_match'] = is_scope_match
    if not is_scope_match:
        # Role scope doesn't cover this LOA -> no access
        return result

    # 2. Permission matrix lookup
    rp = (
        db.query(RolePermission, Permission)
        .join(Permission, RolePermission.permission_id == Permission.id)
        .filter(
            RolePermission.role_id == role.id,
            RolePermission.loa_status == loa.status,
        )
        .first()
    )

    if not rp:
        # No matrix entry for this (role, status) -> no permissions
        return result

    role_perm, perm = rp
    actual_code = perm.code

    # Derive boolean flags using the permission hierarchy
    result['can_view']     = implies(actual_code, PERMISSION_VIEW)
    result['can_comment']  = implies(actual_code, PERMISSION_COMMENT)
    result['can_validate'] = implies(actual_code, PERMISSION_VALIDATE)
    result['can_edit']     = implies(actual_code, PERMISSION_EDIT)

    return result


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
