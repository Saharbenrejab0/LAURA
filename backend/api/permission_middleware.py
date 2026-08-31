"""
Permission middleware — Sprint 2.

Provides `require_permission(action)` dependency for FastAPI routes.

Usage:
    from backend.api.permission_middleware import require_permission

    @router.post("/loa/{loa_id}/approve")
    async def approve_loa(
        loa_id: str,
        _: None = Depends(require_permission('validate')),
        ...
    ):
        # If we got here, the user has 'validate' permission on this LOA.

The middleware:
  1. Loads the LOA by ID (from the path parameter)
  2. Loads the current user (from auth)
  3. Computes permissions via `compute_permissions`
  4. Checks the required permission flag (e.g. can_validate)
  5. Raises 403 Forbidden if denied
"""
from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session

from backend.models.database import get_db
from backend.api.auth import get_current_user
from backend.api.permissions import compute_permissions
from backend.models.user import User
from backend.models.loa import LOA


PERMISSION_FLAG_MAP = {
    'view':     'can_view',
    'comment':  'can_comment',
    'edit':     'can_edit',
    'validate': 'can_validate',
}


def require_permission(action: str):
    """
    FastAPI dependency that ensures the current user has the required
    permission on the LOA referenced by the path parameter `loa_id`.

    Args:
        action: one of 'view', 'comment', 'edit', 'validate'

    Returns:
        A FastAPI dependency callable.
    """
    if action not in PERMISSION_FLAG_MAP:
        raise ValueError(f"Unknown permission action: {action}")

    flag = PERMISSION_FLAG_MAP[action]

    async def _check(
        request: Request,
        user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        loa_id = request.path_params.get('loa_id') or request.path_params.get('id')
        if not loa_id:
            raise HTTPException(
                status_code=500,
                detail="require_permission requires a 'loa_id' or 'id' path parameter",
            )

        loa = db.query(LOA).filter_by(id=loa_id).first()
        if not loa:
            raise HTTPException(status_code=404, detail="LOA not found")

        perms = compute_permissions(user, loa, db)

        if not perms.get(flag):
            # Build a clear error message
            raise HTTPException(
                status_code=403,
                detail={
                    'error': 'Permission denied',
                    'required_action': action,
                    'user_role': perms.get('user_role'),
                    'loa_status': perms.get('loa_status'),
                    'message': f"Your role '{perms.get('user_role')}' cannot '{action}' a LOA in status '{perms.get('loa_status')}'.",
                },
            )

        return perms  # available to the endpoint if needed

    return _check
