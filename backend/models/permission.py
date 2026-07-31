"""
Permission model.

A Permission represents what a user can do on a LOA. There are 4 permissions
in LAURA, with a clear hierarchy:

  - view      (level 1): can see the LOA in read-only mode
  - comment   (level 2): can add comments per section; cannot modify content
  - validate  (level 2): can click Approve / Reject / Approve-with-comment
                         (sibling of comment, NOT a parent of edit)
  - edit      (level 3): can modify the LOA content

Hierarchy semantics:
  - If a role has 'edit', it implicitly can also 'view' and 'comment'.
  - If a role has 'comment', it implicitly can also 'view'.
  - If a role has 'validate', it implicitly can also 'view'.
  - 'validate' and 'edit' are NOT compatible — they live in different worlds.

The hierarchy is checked in code via the `hierarchy_level` field.
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, func
from sqlalchemy.orm import relationship

from backend.models.database import Base


class Permission(Base):
    __tablename__ = 'permission'

    id = Column(Integer, primary_key=True)
    code = Column(String(20), nullable=False, unique=True, index=True)
    display_name = Column(String(50), nullable=False)
    description = Column(Text, nullable=True)
    hierarchy_level = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, server_default=func.now())

    role_permissions = relationship('RolePermission', back_populates='permission')

    def __repr__(self):
        return f"<Permission {self.code}>"


# Constants for code-side use
PERMISSION_VIEW = 'view'
PERMISSION_COMMENT = 'comment'
PERMISSION_VALIDATE = 'validate'
PERMISSION_EDIT = 'edit'
PERMISSION_ADVANCE_PHASE = 'advance_phase'

ALL_PERMISSION_CODES = [
    PERMISSION_VIEW,
    PERMISSION_COMMENT,
    PERMISSION_VALIDATE,
    PERMISSION_EDIT,
    PERMISSION_ADVANCE_PHASE,
]


def implies(actual_permission: str, required_permission: str) -> bool:
    """
    Check whether `actual_permission` is sufficient for `required_permission`.

    Hierarchy rules:
      - advance_phase: super-permission, implies edit, comment, view, validate
      - edit:          implies comment, view (NOT validate — different axis)
      - validate:      implies view (NOT comment or edit — separate axis)
      - comment:       implies view
      - view:          only implies view

    The 'advance_phase' permission is special: it's granted to people who
    have responsibility for moving a LOA from one phase to another
    (Vanessa, super-admins). It includes edit because someone who can
    advance a phase necessarily needs to be able to edit too.

    Examples:
      implies('advance_phase', 'edit')     -> True
      implies('advance_phase', 'validate') -> True
      implies('edit', 'view')              -> True
      implies('edit', 'comment')           -> True
      implies('edit', 'validate')          -> False  (different axis)
      implies('validate', 'view')          -> True
      implies('validate', 'edit')          -> False
    """
    if actual_permission == required_permission:
        return True

    # advance_phase is a super-permission
    if actual_permission == 'advance_phase':
        return required_permission in ('view', 'comment', 'edit', 'validate', 'advance_phase')

    if required_permission == PERMISSION_VIEW:
        return actual_permission in (
            PERMISSION_VIEW, PERMISSION_COMMENT,
            PERMISSION_VALIDATE, PERMISSION_EDIT,
        )

    if required_permission == PERMISSION_COMMENT:
        return actual_permission == PERMISSION_EDIT

    if required_permission == PERMISSION_VALIDATE:
        return False

    if required_permission == PERMISSION_EDIT:
        return False

    return False