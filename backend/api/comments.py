"""
LAURA — Comment endpoints  (Rock 2 — enriched)

POST   /loa/{loa_id}/comments           — create a comment (field or LOA level)
GET    /loa/{loa_id}/comments           — list comments, filtered by visibility
GET    /loa/{loa_id}/comments/summary   — counts for badges (unresolved, blocking, by field)
PATCH  /comments/{comment_id}           — edit content (author only, within 5 min)
POST   /comments/{comment_id}/resolve   — mark resolved
POST   /comments/{comment_id}/reopen    — unresolve
DELETE /comments/{comment_id}           — soft delete (author or super-admin)
GET    /comments/mine                   — my comments across all LOAs
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session

from backend.models.database import get_db
from backend.models.loa import LOA
from backend.models.user import User
from backend.models.comment import (
    Comment,
    ANCHOR_LOA, ANCHOR_FIELD,
    ALLOWED_SEVERITIES, SEVERITY_NOTE,
    VIS_LOA_PARTICIPANTS,
    FIELD_TO_SECTION,
    derive_section,
)
from backend.api.auth import get_current_user
from backend.services.comment_visibility import (
    default_visibility,
    filter_visible_comments,
    can_resolve_comment,
    can_reopen_comment,
    allowed_severities,
)

router = APIRouter()

# Edit window: authors can edit their own comments within this duration.
EDIT_WINDOW = timedelta(minutes=5)


# ═══════════════════════════════════════════════════════════════════════
# Pydantic schemas
# ═══════════════════════════════════════════════════════════════════════

class CommentCreate(BaseModel):
    content: str
    anchor_type: str = ANCHOR_LOA          # "loa" or "field"
    field_key: Optional[str] = None        # required if anchor_type == "field"
    severity: str = SEVERITY_NOTE          # "note", "suggestion", "blocking"
    visibility: Optional[str] = None       # auto-determined if not set
    # Legacy compat: if frontend sends 'section' instead of field_key, map it
    section: Optional[str] = None

    @field_validator("content")
    @classmethod
    def content_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Comment content cannot be empty")
        if len(v) > 5000:
            raise ValueError("Comment content cannot exceed 5000 characters")
        return v.strip()

    @field_validator("anchor_type")
    @classmethod
    def valid_anchor(cls, v: str) -> str:
        if v not in (ANCHOR_LOA, ANCHOR_FIELD):
            raise ValueError(f"anchor_type must be '{ANCHOR_LOA}' or '{ANCHOR_FIELD}'")
        return v

    @field_validator("severity")
    @classmethod
    def valid_severity(cls, v: str) -> str:
        if v not in ALLOWED_SEVERITIES:
            raise ValueError(f"severity must be one of {sorted(ALLOWED_SEVERITIES)}")
        return v


class CommentEdit(BaseModel):
    content: str

    @field_validator("content")
    @classmethod
    def content_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Comment content cannot be empty")
        if len(v) > 5000:
            raise ValueError("Comment content cannot exceed 5000 characters")
        return v.strip()


# ═══════════════════════════════════════════════════════════════════════
# Helper: enrich comment dict with viewer-specific metadata
# ═══════════════════════════════════════════════════════════════════════

def _enrich(comment: Comment, user: User, loa: LOA) -> dict:
    """Add can_resolve / can_reopen / can_edit flags to the comment dict."""
    d = comment.to_dict()
    d["can_resolve"] = not comment.resolved and can_resolve_comment(user, comment, loa)
    d["can_reopen"] = comment.resolved and can_reopen_comment(user, comment, loa)
    d["can_edit"] = (
        user.email == comment.author_email
        and comment.created_at
        and (datetime.utcnow() - comment.created_at) < EDIT_WINDOW
        and not comment.deleted_at
    )
    d["can_delete"] = (
        user.email == comment.author_email
        or (user.role_obj and user.role_obj.code == "super_admin")
    )
    return d


# ═══════════════════════════════════════════════════════════════════════
# POST /loa/{loa_id}/comments — create
# ═══════════════════════════════════════════════════════════════════════

@router.post("/loa/{loa_id}/comments")
def create_comment(
    loa_id: str,
    body: CommentCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    loa = db.query(LOA).filter(LOA.id == loa_id).first()
    if not loa:
        raise HTTPException(status_code=404, detail="LOA not found")

    # Lock guard
    role = user.role_obj
    if loa.is_locked and not (role and role.can_override_lock):
        raise HTTPException(status_code=423, detail="LOA is locked")

    # Permission guard: user must have at least 'comment' rights.
    # Uses compute_permissions (single source of truth) instead of
    # _check_workflow_permission, which only covers validate/advance actions.
    from backend.api.permissions import compute_permissions
    perms = compute_permissions(user, loa, db)
    if not perms.get("can_comment"):
        raise HTTPException(
            status_code=403,
            detail="You do not have permission to comment on this LOA at this step.",
        )
    permission_used = "comment"
    if permission_used not in ("comment", "edit", "validate", "advance_phase"):
        raise HTTPException(
            status_code=403,
            detail=f"Your permission '{permission_used}' is not enough to comment.",
        )

    # Severity permission check
    user_severities = allowed_severities(user)
    if body.severity not in user_severities:
        raise HTTPException(
            status_code=403,
            detail=f"Your role cannot set severity '{body.severity}'. Allowed: {user_severities}",
        )

    # Resolve anchor + section
    anchor_type = body.anchor_type
    field_key = body.field_key

    # Legacy compat: if frontend sends section but not field_key, treat as field
    if not field_key and body.section:
        field_key = body.section
        anchor_type = ANCHOR_FIELD

    # Validate field_key if anchor_type is 'field'
    if anchor_type == ANCHOR_FIELD and not field_key:
        raise HTTPException(
            status_code=400,
            detail="field_key is required when anchor_type is 'field'",
        )

    section = derive_section(anchor_type, field_key)

    # Visibility: auto-determine from author role, or use explicit override
    visibility = body.visibility or default_visibility(user)

    # Build the comment
    role_code = user.effective_role_code if hasattr(user, "effective_role_code") else "unknown"
    role_display = role.display_name if role else (user.role or "Unknown")

    comment = Comment(
        loa_id=loa.id,
        anchor_type=anchor_type,
        field_key=field_key,
        section=section,
        author_email=user.email,
        author_name=user.full_name or user.email.split("@")[0],
        author_role=role_display,
        content=body.content,
        content_format="plain_text",
        written_at_status=loa.status,
        visibility=visibility,
        severity=body.severity,
        resolved=False,
        metadata_={
            "author_role_code": role_code,
        },
    )

    db.add(comment)
    db.commit()
    db.refresh(comment)
    return _enrich(comment, user, loa)


# ═══════════════════════════════════════════════════════════════════════
# GET /loa/{loa_id}/comments — list (visibility-filtered)
# ═══════════════════════════════════════════════════════════════════════

@router.get("/loa/{loa_id}/comments")
def list_comments(
    loa_id: str,
    section: Optional[str] = None,
    field_key: Optional[str] = None,
    anchor_type: Optional[str] = None,
    resolved: Optional[bool] = None,
    severity: Optional[str] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    loa = db.query(LOA).filter(LOA.id == loa_id).first()
    if not loa:
        raise HTTPException(status_code=404, detail="LOA not found")

    query = (
        db.query(Comment)
        .filter(Comment.loa_id == loa.id)
        .filter(Comment.deleted_at.is_(None))
    )

    if section:
        query = query.filter(Comment.section == section)
    if field_key:
        query = query.filter(Comment.field_key == field_key)
    if anchor_type:
        query = query.filter(Comment.anchor_type == anchor_type)
    if resolved is not None:
        query = query.filter(Comment.resolved == resolved)
    if severity:
        query = query.filter(Comment.severity == severity)

    all_comments = query.order_by(Comment.created_at.asc()).all()

    # Filter by visibility
    visible = filter_visible_comments(user, all_comments, loa)

    return {
        "loa_id": loa_id,
        "loa_status": loa.status,
        "total": len(visible),
        "comments": [_enrich(c, user, loa) for c in visible],
    }


# ═══════════════════════════════════════════════════════════════════════
# GET /loa/{loa_id}/comments/summary — badge counts
# ═══════════════════════════════════════════════════════════════════════

@router.get("/loa/{loa_id}/comments/summary")
def comments_summary(
    loa_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Returns counts for UI badges:
      - total unresolved
      - total blocking unresolved
      - per-field unresolved count (for field badges)
      - per-section unresolved count
    """
    loa = db.query(LOA).filter(LOA.id == loa_id).first()
    if not loa:
        raise HTTPException(status_code=404, detail="LOA not found")

    all_comments = (
        db.query(Comment)
        .filter(Comment.loa_id == loa.id)
        .filter(Comment.deleted_at.is_(None))
        .all()
    )

    visible = filter_visible_comments(user, all_comments, loa)

    unresolved = [c for c in visible if not c.resolved]
    blocking = [c for c in unresolved if c.severity == "blocking"]

    # Per-field counts (for badges on InlineEditField)
    by_field: dict[str, int] = {}
    for c in unresolved:
        if c.field_key:
            by_field[c.field_key] = by_field.get(c.field_key, 0) + 1

    # Per-section counts
    by_section: dict[str, int] = {}
    for c in unresolved:
        sec = c.section or "general"
        by_section[sec] = by_section.get(sec, 0) + 1

    # Per-status group
    by_status: dict[str, int] = {}
    for c in unresolved:
        st = c.written_at_status or "unknown"
        by_status[st] = by_status.get(st, 0) + 1

    return {
        "loa_id": loa_id,
        "total_visible": len(visible),
        "total_unresolved": len(unresolved),
        "total_blocking": len(blocking),
        "by_field": by_field,
        "by_section": by_section,
        "by_status": by_status,
    }


# ═══════════════════════════════════════════════════════════════════════
# PATCH /comments/{comment_id} — edit (author only, within 5 min)
# ═══════════════════════════════════════════════════════════════════════

@router.patch("/comments/{comment_id}")
def edit_comment(
    comment_id: str,
    body: CommentEdit,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    comment = db.query(Comment).filter(Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    if comment.deleted_at:
        raise HTTPException(status_code=410, detail="Comment has been deleted")

    if comment.author_email != user.email:
        raise HTTPException(status_code=403, detail="Only the author can edit a comment")

    if comment.created_at and (datetime.utcnow() - comment.created_at) > EDIT_WINDOW:
        raise HTTPException(
            status_code=403,
            detail="Comments can only be edited within 5 minutes of posting",
        )

    comment.content = body.content
    comment.edited_at = datetime.utcnow()
    db.commit()
    db.refresh(comment)

    loa = db.query(LOA).filter(LOA.id == comment.loa_id).first()
    return _enrich(comment, user, loa)


# ═══════════════════════════════════════════════════════════════════════
# POST /comments/{comment_id}/resolve
# ═══════════════════════════════════════════════════════════════════════

@router.post("/comments/{comment_id}/resolve")
def resolve_comment(
    comment_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    comment = db.query(Comment).filter(Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    loa = db.query(LOA).filter(LOA.id == comment.loa_id).first()
    if not loa:
        raise HTTPException(status_code=404, detail="LOA not found")

    if not can_resolve_comment(user, comment, loa):
        raise HTTPException(
            status_code=403,
            detail="You do not have permission to resolve this comment.",
        )

    if comment.resolved:
        return _enrich(comment, user, loa)  # idempotent

    comment.resolved = True
    comment.resolved_at = datetime.utcnow()
    comment.resolved_by = user.email
    db.commit()
    db.refresh(comment)
    return _enrich(comment, user, loa)


# ═══════════════════════════════════════════════════════════════════════
# POST /comments/{comment_id}/reopen
# ═══════════════════════════════════════════════════════════════════════

@router.post("/comments/{comment_id}/reopen")
def reopen_comment(
    comment_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    comment = db.query(Comment).filter(Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    loa = db.query(LOA).filter(LOA.id == comment.loa_id).first()
    if not loa:
        raise HTTPException(status_code=404, detail="LOA not found")

    if not can_reopen_comment(user, comment, loa):
        raise HTTPException(
            status_code=403,
            detail="You do not have permission to reopen this comment.",
        )

    if not comment.resolved:
        return _enrich(comment, user, loa)  # idempotent

    comment.resolved = False
    comment.resolved_at = None
    comment.resolved_by = None
    db.commit()
    db.refresh(comment)
    return _enrich(comment, user, loa)


# ═══════════════════════════════════════════════════════════════════════
# DELETE /comments/{comment_id} — soft delete
# ═══════════════════════════════════════════════════════════════════════

@router.delete("/comments/{comment_id}")
def delete_comment(
    comment_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    comment = db.query(Comment).filter(Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    is_author = comment.author_email == user.email
    is_super = user.role_obj and user.role_obj.code == "super_admin"

    if not is_author and not is_super:
        raise HTTPException(
            status_code=403,
            detail="Only the author or a super-admin can delete a comment.",
        )

    if comment.deleted_at:
        return {"ok": True, "message": "Already deleted"}

    comment.deleted_at = datetime.utcnow()
    db.commit()
    return {"ok": True, "message": "Comment soft-deleted"}


# ═══════════════════════════════════════════════════════════════════════
# GET /comments/mine — my comments across all LOAs
# ═══════════════════════════════════════════════════════════════════════

@router.get("/comments/mine")
def list_my_comments(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    comments = (
        db.query(Comment)
        .filter(Comment.author_email == user.email)
        .filter(Comment.deleted_at.is_(None))
        .order_by(Comment.created_at.desc())
        .all()
    )

    by_loa: dict[str, dict] = {}
    for c in comments:
        if c.loa_id not in by_loa:
            by_loa[c.loa_id] = {
                "loa_id": c.loa_id,
                "count": 0,
                "unresolved": 0,
                "last_section": c.section,
                "last_field_key": c.field_key,
                "last_content": c.content[:140],
                "last_at": c.created_at.isoformat(),
            }
        by_loa[c.loa_id]["count"] += 1
        if not c.resolved:
            by_loa[c.loa_id]["unresolved"] += 1

    return {
        "total_comments": len(comments),
        "loas": list(by_loa.values()),
    }
