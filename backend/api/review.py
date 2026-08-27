"""
LAURA — Review API

GET    /review/{cycleId}/deck                          — slide deck manifest (LOAs + photos + title config)
GET    /review/{cycleId}/verdicts                      — reviewer's verdicts for the cycle
POST   /review/{cycleId}/verdict                       — upsert a verdict (approve or reject)
GET    /review/{cycleId}/comments                      — all comments for the cycle
POST   /review/{cycleId}/comment                       — add a comment to a slide
POST   /review/{cycleId}/submit                        — finalize the reviewer's pass
GET    /admin/review-modes                             — list all role → mode configs
PUT    /admin/review-modes                             — upsert a role → mode config
POST   /review/{cycleId}/loa/{loaId}/photos            — upload execution photo (multipart)
DELETE /review/{cycleId}/photos/{photoId}              — delete a photo
POST   /review/{cycleId}/title-photo                   — upload title slide background (multipart)
POST   /review/{cycleId}/overview-photo/{category}     — upload category overview photo (multipart)
GET    /review/{cycleId}/title-config                  — get title slide text config
PUT    /review/{cycleId}/title-config                  — save title slide text config
"""
from __future__ import annotations

import os
import uuid as _uuid
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Query
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session

from backend.models.database import get_db
from backend.api.ordering import newest_first, thread_order
from backend.models.loa import LOA
from backend.models.loa_cycle import LoaCycle
from backend.models.user import User
from backend.models.review import (
    ReviewMode, ReviewVerdict, ReviewComment, ReviewSubmission,
    LOAPhoto, CycleTitleConfig, LOAReviewStage, ALIGNMENT_STAGES,
)
from backend.api.auth import get_current_user

# ── Upload directory ─────────────────────────────────────────────────────────

_UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads" / "loa-photos"
_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

_ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp"}
# The extension is derived from the VALIDATED mime, never from the client's
# filename. /uploads is served by StaticFiles, so a filename of "x.html" wrote a
# document that the browser would then render from our own origin — stored XSS —
# and a name containing a path separator raised FileNotFoundError.
_MIME_EXT = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}
_MAX_FILE_BYTES = 10 * 1024 * 1024  # 10 MB

def _can_upload(user: User) -> bool:
    """CMO and CFO reviewers are read-only; everyone else can upload photos."""
    role = (user.role or "").lower()
    return "cmo" not in role and "cfo" not in role

router = APIRouter()


# ── Pydantic schemas ─────────────────────────────────────────────────────────

class VerdictBody(BaseModel):
    loa_id: str
    decision: str    # "approved" | "rejected"
    reason: Optional[str] = None

    @field_validator("decision")
    @classmethod
    def valid_decision(cls, v: str) -> str:
        if v not in ("approved", "rejected"):
            raise ValueError("decision must be 'approved' or 'rejected'")
        return v

    @field_validator("reason")
    @classmethod
    def reason_required_on_reject(cls, v, info):
        if info.data.get("decision") == "rejected" and not (v and v.strip()):
            raise ValueError("reason is required when rejecting")
        return v.strip() if v else None


class CommentBody(BaseModel):
    slide_id: str
    text: str
    anchor: Optional[str] = None  # e.g. "field:budget", "section:description"

    @field_validator("text")
    @classmethod
    def text_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("comment text cannot be empty")
        if len(v) > 5000:
            raise ValueError("comment text cannot exceed 5000 characters")
        return v.strip()


class BulkVerdictBody(BaseModel):
    loa_ids: list[str]
    decision: str    # only "rejected" is valid for bulk (can't bulk-approve)
    reason: str

    @field_validator("decision")
    @classmethod
    def valid_decision(cls, v: str) -> str:
        if v not in ("approved", "rejected"):
            raise ValueError("decision must be 'approved' or 'rejected'")
        return v

    @field_validator("reason")
    @classmethod
    def reason_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("reason is required for bulk verdict")
        return v.strip()


class ReviewModeBody(BaseModel):
    role_name: str
    mode: str

    @field_validator("mode")
    @classmethod
    def valid_mode(cls, v: str) -> str:
        if v not in ("slideshow", "board", "list"):
            raise ValueError("mode must be slideshow, board, or list")
        return v


# ── Helpers ──────────────────────────────────────────────────────────────────

def _get_cycle(cycle_id: str, db: Session) -> LoaCycle:
    cycle = db.query(LoaCycle).filter(LoaCycle.id == cycle_id).first()
    if not cycle:
        raise HTTPException(status_code=404, detail="Cycle not found")
    return cycle


def _get_writable_cycle(cycle_id: str, db: Session) -> LoaCycle:
    """Resolve a cycle for a write. Closed cycles are archives — read-only.

    The frontend already hides the controls, but a closed cycle must not be
    mutable through a hand-rolled request either.
    """
    cycle = _get_cycle(cycle_id, db)
    if cycle.status == "closed":
        raise HTTPException(
            status_code=423,
            detail=f'Cycle "{cycle.name}" is closed. This review is read-only.',
        )
    return cycle


def _is_submitted(cycle_id: str, reviewer_id: str, db: Session) -> bool:
    return db.query(ReviewSubmission).filter_by(
        cycle_id=cycle_id, reviewer_id=str(reviewer_id)
    ).first() is not None


def _loa_out(loa: LOA) -> dict:
    return {
        "id": str(loa.id),
        "loa_draft_id": loa.loa_draft_id,
        "loa_number": loa.loa_number,
        "requestor_email": loa.requestor_email,
        "cluster": loa.cluster,
        "country": loa.country,
        "legal_entity": loa.legal_entity,
        "activity_type": loa.activity_type,
        "event_type": loa.event_type,
        "event_purpose": loa.event_purpose,
        "sap_event_code": loa.sap_event_code,
        "cot": loa.cot,
        "category": loa.category or [],
        "brand": loa.brand,
        "capex_opex": loa.capex_opex,
        "adv_selling": loa.adv_selling,
        "detail": loa.detail,
        "description": loa.description,
        "customer": loa.customer,
        "vendor": loa.vendor,
        "currency": loa.currency,
        "num_customers": loa.num_customers,
        "num_doors": loa.num_doors,
        "q4_2025": loa.q4_2025,
        "q1_2026": loa.q1_2026,
        "q2_2026": loa.q2_2026,
        "q3_2026": loa.q3_2026,
        "q4_2026": loa.q4_2026,
        "fy_2025_total": loa.fy_2025_total,
        "fy_2026_total": loa.fy_2026_total,
        "avg_investment_per_door": loa.avg_investment_per_door,
        "ppt_slide_required": loa.ppt_slide_required,
        "description": loa.description,
        "tools": loa.tools,
        "kpi": loa.kpi,
        "cost_drill_down": loa.cost_drill_down,
        "timing": loa.timing,
        "start_date": loa.start_date,
        "end_date": loa.end_date,
        "status": loa.status,
        "is_locked": loa.is_locked,
        "ai_suggestion_used": loa.ai_suggestion_used,
        "cycle_id": str(loa.cycle_id) if loa.cycle_id else None,
        "is_emergency": loa.is_emergency,
        "ia_code": loa.ia_code,
        "created_at": loa.created_at.isoformat() if loa.created_at else None,
        "updated_at": loa.updated_at.isoformat() if loa.updated_at else None,
        "submitted_at": loa.submitted_at.isoformat() if loa.submitted_at else None,
        "approved_at": loa.approved_at.isoformat() if loa.approved_at else None,
    }


def _photo_out(p: LOAPhoto) -> dict:
    return {
        "id": str(p.id),
        "loaId": str(p.loa_id) if p.loa_id else None,
        "cycleId": str(p.cycle_id) if p.cycle_id else None,
        "categorySlug": p.category_slug,
        "photoType": p.photo_type,
        "url": f"/uploads/loa-photos/{p.file_name}",
        "mimeType": p.mime_type,
        "width": p.width,
        "height": p.height,
        "uploadedAt": p.uploaded_at.isoformat() if p.uploaded_at else None,
        # Crop / pan / zoom (defaults if not yet set)
        "focalX": p.focal_x if p.focal_x is not None else 0.5,
        "focalY": p.focal_y if p.focal_y is not None else 0.5,
        "zoom":   p.zoom   if p.zoom   is not None else 1.0,
    }


def _title_config_out(cfg: CycleTitleConfig) -> dict:
    return {
        "id": str(cfg.id),
        "cycleId": str(cfg.cycle_id),
        "title": cfg.title,
        "subtitle": cfg.subtitle,
        "year": cfg.year,
        "titleFontSize": cfg.title_font_size or "medium",
        "titleColor": cfg.title_color or "#FFFFFF",
        "subtitleFontSize": cfg.subtitle_font_size or "medium",
        "subtitleColor": cfg.subtitle_color or "#FFFFFF",
        "dividerStyle": cfg.divider_style or "black",
        "overviewLayouts": cfg.overview_layouts or {},
        "lensConfigs": cfg.lens_configs or {},
        "loaPhotoModes": cfg.loa_photo_modes or {},
        "updatedAt": cfg.updated_at.isoformat() if cfg.updated_at else None,
    }


def _verdict_out(v: ReviewVerdict) -> dict:
    return {
        "id": str(v.id),
        "cycleId": str(v.cycle_id),
        "loaId": str(v.loa_id),
        "reviewerId": str(v.reviewer_id),
        "decision": v.decision,
        "reason": v.reason,
        "createdAt": v.created_at.isoformat() if v.created_at else None,
        "updatedAt": v.updated_at.isoformat() if v.updated_at else None,
    }


def _comment_out(c: ReviewComment, author: User) -> dict:
    return {
        "id": str(c.id),
        "cycleId": str(c.cycle_id),
        "slideId": c.slide_id,
        "authorId": str(c.author_id),
        "authorName": author.full_name if author else "Unknown",
        "text": c.text,
        "anchor": c.anchor,
        "createdAt": c.created_at.isoformat() if c.created_at else None,
    }


# ── Deck endpoint ────────────────────────────────────────────────────────────

@router.get("/review/{cycle_id}/deck")
def get_deck(
    cycle_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return cycle metadata + all LOAs (with photos) + title config for deck generation.

    Only includes LOAs that have passed the full 3-stage alignment chain (all
    LOAReviewStage rows approved).  LOAs submitted before the alignment feature
    existed (no stage rows at all) are also excluded to keep the deck clean —
    an admin can manually back-fill stage rows if needed.
    """
    cycle = _get_cycle(cycle_id, db)

    # LOA IDs where all 3 alignment stages are approved
    from sqlalchemy import func as _func
    approved_loa_ids_q = (
        db.query(LOAReviewStage.loa_id)
        .filter(LOAReviewStage.status == "approved")
        .group_by(LOAReviewStage.loa_id)
        .having(_func.count(LOAReviewStage.id) >= len(ALIGNMENT_STAGES))
        .subquery()
    )

    loas = (
        db.query(LOA)
        .filter(LOA.cycle_id == cycle_id)
        .filter(LOA.id.in_(approved_loa_ids_q))
    )
    loas = newest_first(loas, LOA).all()

    # Fetch all photos for this cycle in one query
    all_photos = db.query(LOAPhoto).filter(LOAPhoto.cycle_id == cycle_id).all()

    # Split: LOA photos vs title/overview photos
    loa_photos: dict[str, list[dict]] = {}
    overview_photos: dict[str, list[dict]] = {}
    title_photo = None
    for p in all_photos:
        if p.photo_type == "title_background":
            title_photo = _photo_out(p)
        elif (
            p.photo_type.startswith("overview_") or p.photo_type.startswith("lens_col_")
        ) and p.category_slug:
            # overview_1..4 and lens_col_<uuid> are keyed by category slug
            slug = p.category_slug
            if slug not in overview_photos:
                overview_photos[slug] = []
            overview_photos[slug].append(_photo_out(p))
        elif p.loa_id:
            key = str(p.loa_id)
            if key not in loa_photos:
                loa_photos[key] = []
            loa_photos[key].append(_photo_out(p))

    # Attach photos to each LOA dict
    def loa_with_photos(loa: LOA) -> dict:
        d = _loa_out(loa)
        d["photos"] = loa_photos.get(str(loa.id), [])
        return d

    # Title config
    title_cfg = db.query(CycleTitleConfig).filter_by(cycle_id=cycle_id).first()

    return {
        "cycle": {
            "id": str(cycle.id),
            "name": cycle.name,
            "cycleType": cycle.cycle_type,
            "status": cycle.status,
            "startDate": cycle.start_date.isoformat() if cycle.start_date else None,
            "endDate": cycle.end_date.isoformat() if cycle.end_date else None,
            "isActive": cycle.status == "open",
            "isTest": bool(cycle.is_test),
            # Drives read-only mode in the review UI.
            "isClosed": cycle.status == "closed",
            "closedAt": cycle.closed_at.isoformat() if cycle.closed_at else None,
            "closedBy": cycle.closed_by,
        },
        "loas": [loa_with_photos(l) for l in loas],
        "titleConfig": _title_config_out(title_cfg) if title_cfg else None,
        "titlePhoto": title_photo,
        "overviewPhotos": overview_photos,
    }


# ── Verdicts ─────────────────────────────────────────────────────────────────

@router.get("/review/{cycle_id}/verdicts")
def get_verdicts(
    cycle_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return this reviewer's verdicts for the cycle."""
    _get_cycle(cycle_id, db)
    verdicts = (
        db.query(ReviewVerdict)
        .filter_by(cycle_id=cycle_id, reviewer_id=str(current_user.id))
        .all()
    )
    submitted = db.query(ReviewSubmission).filter_by(
        cycle_id=cycle_id, reviewer_id=str(current_user.id)
    ).first()
    return {
        "verdicts": [_verdict_out(v) for v in verdicts],
        "isSubmitted": submitted is not None,
        "submittedAt": submitted.submitted_at.isoformat() if submitted else None,
    }


@router.post("/review/{cycle_id}/verdict")
def upsert_verdict(
    cycle_id: str,
    body: VerdictBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create or update a verdict for one LOA. Blocked after submission."""
    _get_writable_cycle(cycle_id, db)
    if _is_submitted(cycle_id, str(current_user.id), db):
        raise HTTPException(status_code=409, detail="Review already submitted — verdicts are locked")

    # Verify LOA exists in this cycle
    loa = db.query(LOA).filter(LOA.id == body.loa_id, LOA.cycle_id == cycle_id).first()
    if not loa:
        raise HTTPException(status_code=404, detail="LOA not found in this cycle")

    existing = db.query(ReviewVerdict).filter_by(
        cycle_id=cycle_id,
        loa_id=body.loa_id,
        reviewer_id=str(current_user.id),
    ).first()

    if existing:
        existing.decision = body.decision
        existing.reason = body.reason
    else:
        existing = ReviewVerdict(
            cycle_id=cycle_id,
            loa_id=body.loa_id,
            reviewer_id=str(current_user.id),
            decision=body.decision,
            reason=body.reason,
        )
        db.add(existing)

    db.commit()
    db.refresh(existing)
    return _verdict_out(existing)


# ── Bulk verdict (CFO summary-cell reject fan-out) ───────────────────────────

@router.post("/review/{cycle_id}/bulk-verdict")
def bulk_verdict(
    cycle_id: str,
    body: BulkVerdictBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Upsert one verdict per LOA. Used by CFO summary-cell bulk rejection."""
    _get_writable_cycle(cycle_id, db)
    if _is_submitted(cycle_id, str(current_user.id), db):
        raise HTTPException(status_code=409, detail="Review already submitted — verdicts are locked")

    results = []
    for loa_id in body.loa_ids:
        loa = db.query(LOA).filter(LOA.id == loa_id, LOA.cycle_id == cycle_id).first()
        if not loa:
            continue
        existing = db.query(ReviewVerdict).filter_by(
            cycle_id=cycle_id,
            loa_id=loa_id,
            reviewer_id=str(current_user.id),
        ).first()
        if existing:
            existing.decision = body.decision
            existing.reason = body.reason
        else:
            existing = ReviewVerdict(
                cycle_id=cycle_id,
                loa_id=loa_id,
                reviewer_id=str(current_user.id),
                decision=body.decision,
                reason=body.reason,
            )
            db.add(existing)
        results.append(existing)

    db.commit()
    for v in results:
        db.refresh(v)
    return [_verdict_out(v) for v in results]


# ── Comments ─────────────────────────────────────────────────────────────────

@router.get("/review/{cycle_id}/comments")
def get_comments(
    cycle_id: str,
    loa_id: Optional[str] = Query(None, description="Filter by LOA id (for alignment review)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return review comments for the cycle, optionally filtered by loaId."""
    _get_cycle(cycle_id, db)
    q = (
        db.query(ReviewComment)
        .filter(ReviewComment.cycle_id == cycle_id)
    )
    if loa_id:
        # slide_id for an LOA is "loa-<uuid>"
        q = q.filter(ReviewComment.slide_id == f"loa-{loa_id}")
    # Newest thread first; ReviewComment is flat (no parent), so thread_order
    # degrades to a plain newest-first here.
    comments = thread_order(q, ReviewComment).all()

    author_ids = {str(c.author_id) for c in comments}
    authors = {
        str(u.id): u
        for u in db.query(User).filter(User.id.in_(author_ids)).all()
    }
    return [_comment_out(c, authors.get(str(c.author_id))) for c in comments]


@router.post("/review/{cycle_id}/comment")
def add_comment(
    cycle_id: str,
    body: CommentBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Add a comment to a slide. Allowed even after submission (for meeting notes)."""
    _get_writable_cycle(cycle_id, db)
    comment = ReviewComment(
        cycle_id=cycle_id,
        slide_id=body.slide_id,
        author_id=str(current_user.id),
        text=body.text,
        anchor=body.anchor,
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return _comment_out(comment, current_user)


# ── Submit ───────────────────────────────────────────────────────────────────

@router.post("/review/{cycle_id}/submit")
def submit_review(
    cycle_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Finalize reviewer's pass. Idempotent — safe to call twice."""
    _get_writable_cycle(cycle_id, db)

    existing = db.query(ReviewSubmission).filter_by(
        cycle_id=cycle_id, reviewer_id=str(current_user.id)
    ).first()
    if existing:
        return {
            "id": str(existing.id),
            "submittedAt": existing.submitted_at.isoformat(),
            "summary": existing.summary,
            "alreadySubmitted": True,
        }

    verdicts = db.query(ReviewVerdict).filter_by(
        cycle_id=cycle_id, reviewer_id=str(current_user.id)
    ).all()
    approved = sum(1 for v in verdicts if v.decision == "approved")
    rejected = sum(1 for v in verdicts if v.decision == "rejected")
    summary = {"approved": approved, "rejected": rejected, "total": approved + rejected}

    submission = ReviewSubmission(
        cycle_id=cycle_id,
        reviewer_id=str(current_user.id),
        summary=summary,
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)
    return {
        "id": str(submission.id),
        "submittedAt": submission.submitted_at.isoformat(),
        "summary": submission.summary,
        "alreadySubmitted": False,
    }


# ── Admin: review modes ───────────────────────────────────────────────────────

@router.get("/admin/review-modes")
def get_review_modes(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all role → mode configurations."""
    modes = db.query(ReviewMode).order_by(ReviewMode.role_name).all()
    return [
        {
            "id": str(m.id),
            "roleName": m.role_name,
            "mode": m.mode,
            "updatedAt": m.updated_at.isoformat() if m.updated_at else None,
            "updatedBy": m.updated_by,
        }
        for m in modes
    ]


@router.put("/admin/review-modes")
def upsert_review_mode(
    body: ReviewModeBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Upsert a role → mode config. Admin only."""
    if current_user.role not in ("admin", "approver"):
        raise HTTPException(status_code=403, detail="Admin access required")

    existing = db.query(ReviewMode).filter_by(role_name=body.role_name).first()
    if existing:
        existing.mode = body.mode
        existing.updated_by = current_user.email
    else:
        existing = ReviewMode(
            role_name=body.role_name,
            mode=body.mode,
            updated_by=current_user.email,
        )
        db.add(existing)

    db.commit()
    db.refresh(existing)
    return {
        "id": str(existing.id),
        "roleName": existing.role_name,
        "mode": existing.mode,
        "updatedAt": existing.updated_at.isoformat() if existing.updated_at else None,
        "updatedBy": existing.updated_by,
    }


# ── Photo upload helpers ──────────────────────────────────────────────────────

async def _save_upload(file: UploadFile, name_prefix: str) -> tuple[str, str, str]:
    """Save an uploaded file to disk. Returns (file_name, file_path, mime_type)."""
    content_type = file.content_type or ""
    if content_type not in _ALLOWED_MIME:
        raise HTTPException(status_code=415, detail="Only JPG, PNG, and WebP images are allowed")

    data = await file.read()
    if len(data) > _MAX_FILE_BYTES:
        raise HTTPException(status_code=413, detail="File exceeds 10 MB limit")

    ext = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}.get(content_type, "jpg")
    file_name = f"{name_prefix}_{_uuid.uuid4().hex}.{ext}"
    file_path = str(_UPLOAD_DIR / file_name)
    Path(file_path).write_bytes(data)
    return file_name, file_path, content_type


# ── LOA execution photo upload ────────────────────────────────────────────────

@router.post("/review/{cycle_id}/loa/{loa_id}/photos")
async def upload_loa_photo(
    cycle_id: str,
    loa_id: str,
    photo_type: str,   # "execution_1" | "execution_2"
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Upload an execution photo for one LOA slide. Max 2 per LOA."""
    if not _can_upload(current_user):
        raise HTTPException(status_code=403, detail="Review-only role cannot upload photos")
    if photo_type not in ("execution_1", "execution_2"):
        raise HTTPException(status_code=400, detail="photo_type must be execution_1 or execution_2")

    _get_writable_cycle(cycle_id, db)
    loa = db.query(LOA).filter(LOA.id == loa_id, LOA.cycle_id == cycle_id).first()
    if not loa:
        raise HTTPException(status_code=404, detail="LOA not found in this cycle")

    # Delete existing photo of same type for this LOA
    existing = db.query(LOAPhoto).filter_by(loa_id=loa_id, photo_type=photo_type).first()
    if existing:
        _delete_file(existing.file_path)
        db.delete(existing)
        db.flush()

    file_name, file_path, mime_type = await _save_upload(file, f"loa_{loa_id[:8]}_{photo_type}")
    photo = LOAPhoto(
        loa_id=loa_id,
        cycle_id=cycle_id,
        photo_type=photo_type,
        file_path=file_path,
        file_name=file_name,
        mime_type=mime_type,
        uploaded_by=str(current_user.id),
    )
    db.add(photo)
    db.commit()
    db.refresh(photo)
    return _photo_out(photo)


@router.delete("/review/{cycle_id}/photos/{photo_id}")
def delete_photo(
    cycle_id: str,
    photo_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a photo by id."""
    if not _can_upload(current_user):
        raise HTTPException(status_code=403, detail="Review-only role cannot delete photos")
    _get_writable_cycle(cycle_id, db)
    photo = db.query(LOAPhoto).filter_by(id=photo_id, cycle_id=cycle_id).first()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    _delete_file(photo.file_path)
    db.delete(photo)
    db.commit()
    return {"deleted": photo_id}


def _delete_file(file_path: str) -> None:
    try:
        p = Path(file_path)
        if p.exists():
            p.unlink()
    except OSError:
        pass


# ── Title slide background photo ──────────────────────────────────────────────

@router.post("/review/{cycle_id}/title-photo")
async def upload_title_photo(
    cycle_id: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Upload / replace the title slide background photo for this cycle."""
    if not _can_upload(current_user):
        raise HTTPException(status_code=403, detail="Review-only role cannot upload photos")
    _get_writable_cycle(cycle_id, db)

    existing = db.query(LOAPhoto).filter_by(cycle_id=cycle_id, photo_type="title_background").first()
    if existing:
        _delete_file(existing.file_path)
        db.delete(existing)
        db.flush()

    file_name, file_path, mime_type = await _save_upload(file, f"title_{cycle_id[:8]}")
    photo = LOAPhoto(
        cycle_id=cycle_id,
        photo_type="title_background",
        file_path=file_path,
        file_name=file_name,
        mime_type=mime_type,
        uploaded_by=str(current_user.id),
    )
    db.add(photo)
    db.commit()
    db.refresh(photo)
    return _photo_out(photo)


# ── Category overview photo ───────────────────────────────────────────────────

@router.post("/review/{cycle_id}/overview-photo/{category_slug}")
async def upload_overview_photo(
    cycle_id: str,
    category_slug: str,
    photo_type: str,   # "overview_1" | "overview_2" | "overview_3" | "overview_4"
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Upload / replace a category overview photo (slots 1-4)."""
    if not _can_upload(current_user):
        raise HTTPException(status_code=403, detail="Review-only role cannot upload photos")
    import re as _re
    if not _re.fullmatch(r"overview_\d+", photo_type):
        raise HTTPException(status_code=400, detail="photo_type must be overview_N (e.g. overview_1)")
    _get_writable_cycle(cycle_id, db)

    existing = db.query(LOAPhoto).filter_by(
        cycle_id=cycle_id, category_slug=category_slug, photo_type=photo_type
    ).first()
    if existing:
        _delete_file(existing.file_path)
        db.delete(existing)
        db.flush()

    file_name, file_path, mime_type = await _save_upload(
        file, f"overview_{category_slug[:8]}_{photo_type}"
    )
    photo = LOAPhoto(
        cycle_id=cycle_id,
        category_slug=category_slug,
        photo_type=photo_type,
        file_path=file_path,
        file_name=file_name,
        mime_type=mime_type,
        uploaded_by=str(current_user.id),
    )
    db.add(photo)
    db.commit()
    db.refresh(photo)
    return _photo_out(photo)


# ── Title slide text config ───────────────────────────────────────────────────

class TitleConfigBody(BaseModel):
    title: Optional[str] = None
    subtitle: Optional[str] = None
    year: Optional[str] = None
    title_font_size: Optional[str] = "medium"
    title_color: Optional[str] = "#FFFFFF"
    subtitle_font_size: Optional[str] = "medium"
    subtitle_color: Optional[str] = "#FFFFFF"
    divider_style: Optional[str] = "black"
    overview_layouts: Optional[dict] = None

    @field_validator("title_font_size", "subtitle_font_size")
    @classmethod
    def valid_font_size(cls, v: Optional[str]) -> Optional[str]:
        if v and v not in ("small", "medium", "large"):
            raise ValueError("font_size must be small, medium, or large")
        return v

    @field_validator("divider_style")
    @classmethod
    def valid_divider_style(cls, v: Optional[str]) -> Optional[str]:
        if v and v not in ("black", "navy", "light"):
            raise ValueError("divider_style must be black, navy, or light")
        return v

    lens_configs: Optional[dict] = None
    loa_photo_modes: Optional[dict] = None

    @field_validator("overview_layouts")
    @classmethod
    def valid_overview_layouts(cls, v: Optional[dict]) -> Optional[dict]:
        if v is None:
            return v
        valid = ("priorities", "family", "lens_overview", "lens_investment")
        for cat, layout in v.items():
            if layout not in valid:
                raise ValueError(f"overview layout for '{cat}' must be one of {valid}")
        return v


@router.get("/review/{cycle_id}/title-config")
def get_title_config(
    cycle_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _get_cycle(cycle_id, db)
    cfg = db.query(CycleTitleConfig).filter_by(cycle_id=cycle_id).first()
    if not cfg:
        return None
    return _title_config_out(cfg)


@router.put("/review/{cycle_id}/title-config")
def upsert_title_config(
    cycle_id: str,
    body: TitleConfigBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Save title slide text configuration. Restricted to uploaders."""
    if not _can_upload(current_user):
        raise HTTPException(status_code=403, detail="Review-only role cannot edit title config")
    _get_writable_cycle(cycle_id, db)

    cfg = db.query(CycleTitleConfig).filter_by(cycle_id=cycle_id).first()
    if cfg:
        cfg.title = body.title
        cfg.subtitle = body.subtitle
        cfg.year = body.year
        cfg.title_font_size = body.title_font_size
        cfg.title_color = body.title_color
        cfg.subtitle_font_size = body.subtitle_font_size
        cfg.subtitle_color = body.subtitle_color
        cfg.divider_style = body.divider_style
        cfg.overview_layouts = body.overview_layouts or {}
        if body.lens_configs is not None:
            cfg.lens_configs = body.lens_configs
        if body.loa_photo_modes is not None:
            cfg.loa_photo_modes = body.loa_photo_modes
    else:
        cfg = CycleTitleConfig(
            cycle_id=cycle_id,
            title=body.title,
            subtitle=body.subtitle,
            year=body.year,
            title_font_size=body.title_font_size,
            title_color=body.title_color,
            subtitle_font_size=body.subtitle_font_size,
            subtitle_color=body.subtitle_color,
            divider_style=body.divider_style,
            overview_layouts=body.overview_layouts or {},
            lens_configs=body.lens_configs or {},
            loa_photo_modes=body.loa_photo_modes or {},
        )
        db.add(cfg)
    db.commit()
    db.refresh(cfg)
    return _title_config_out(cfg)


# ── Photo crop PATCH ─────────────────────────────────────────────────────────

class CropBody(BaseModel):
    focal_x: float
    focal_y: float
    zoom: float

    @field_validator("focal_x", "focal_y")
    @classmethod
    def clamp_focal(cls, v: float) -> float:
        return max(0.0, min(1.0, v))

    @field_validator("zoom")
    @classmethod
    def clamp_zoom(cls, v: float) -> float:
        return max(1.0, min(4.0, v))


@router.patch("/review/{cycle_id}/photos/{photo_id}/crop")
def update_photo_crop(
    cycle_id: str,
    photo_id: str,
    body: CropBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Persist the pan/zoom crop for a single photo."""
    if not _can_upload(current_user):
        raise HTTPException(status_code=403, detail="Review-only role cannot edit photos")
    _get_writable_cycle(cycle_id, db)

    photo = db.query(LOAPhoto).filter_by(id=photo_id, cycle_id=cycle_id).first()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    photo.focal_x = body.focal_x
    photo.focal_y = body.focal_y
    photo.zoom = body.zoom
    db.commit()
    db.refresh(photo)
    return _photo_out(photo)


# ── Lens photo upload ────────────────────────────────────────────────────────

@router.post("/review/{cycle_id}/lens-photo/{category}/{column_id}")
async def upload_lens_photo(
    cycle_id: str,
    category: str,
    column_id: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Upload an image for a lens slide column (overview or investment layout)."""
    if not _can_upload(current_user):
        raise HTTPException(status_code=403, detail="Review-only role cannot upload photos")
    _get_writable_cycle(cycle_id, db)

    if file.content_type not in _ALLOWED_MIME:
        raise HTTPException(status_code=415, detail="Only JPEG, PNG and WebP images are accepted")

    content = await file.read()
    if len(content) > _MAX_FILE_BYTES:
        raise HTTPException(status_code=413, detail="File exceeds 10 MB limit")

    ext = _MIME_EXT[file.content_type]
    fname = f"{_uuid.uuid4().hex}.{ext}"
    fpath = _UPLOAD_DIR / fname
    fpath.write_bytes(content)

    # Remove previous lens photo for this column
    photo_type = f"lens_col_{column_id}"
    db.query(LOAPhoto).filter_by(
        cycle_id=cycle_id, category_slug=category, photo_type=photo_type
    ).delete()

    photo = LOAPhoto(
        cycle_id=cycle_id,
        category_slug=category,
        photo_type=photo_type,
        file_path=str(fpath),
        file_name=fname,
        mime_type=file.content_type,
        uploaded_by=current_user.id,
    )
    db.add(photo)
    db.commit()
    db.refresh(photo)
    return _photo_out(photo)
