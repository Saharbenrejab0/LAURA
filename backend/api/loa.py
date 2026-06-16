"""LAURA — LOA routes

Connected to:
  - backend.reference_data : source of truth for all dropdowns (validates inputs)
  - backend.models.loa     : SQLAlchemy LOA model (category is now ARRAY)
  - backend.engines.*       : PPT/Excel/AI generation

Sprint 2 + 2.5 additions:
  - Scope-based filtering on GET /loa and GET /loa/{id}
  - Permission-protected action endpoints (submit, validate, reject, lock, unlock)
  - Workflow state machine with 9 statuses
  - is_locked flag enforced on edits
  - Smart /validate endpoint dispatching between 'validate' (CMO/CFO/CEO)
    and 'advance_phase' (EMEA orchestration) permissions
"""

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import datetime
from sqlalchemy.orm import Session
import uuid
import httpx
import os
import shutil

from backend.models.database import get_db
from backend.models.loa import LOA, LOAStatus
from backend.models.permission import Permission, implies
from backend.models.role_permission import RolePermission
from backend.reference_data import (
    CLUSTERS,
    CATEGORIES,
    ACTIVITY_TYPES,
    EVENT_TYPES,
    EVENT_PURPOSES,
    COT_OPTIONS,
    CAPEX_OPEX,
    ADV_SELLING,
    is_valid_cluster,
    is_valid_country,
    is_valid_activity_type,
)
from backend.models.user import User
from backend.models.role import Role
from backend.api.auth import get_current_user
from backend.api.permission_middleware import require_permission

router = APIRouter()


# ── n8n webhook ─────────────────────────────────────────────────────────
async def notify_n8n(event: str, loa_id: str, extra: dict = None):
    """Fire-and-forget webhook to n8n. Never blocks if n8n is down."""
    if extra is None:
        extra = {}
    url = os.getenv("N8N_WEBHOOK_URL", "")
    if not url:
        return
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            await client.post(url, json={"event": event, "loa_id": loa_id, **extra})
    except Exception:
        pass


# ── Pydantic schemas ────────────────────────────────────────────────────
class LOACreate(BaseModel):
    """
    Schema for creating / updating a LOA.

    Validation rules:
      - `category` is now a list (multi-select, e.g. ["Frames", "Lenses"])
      - All dropdown fields validated against reference_data.py
      - Empty strings allowed during draft creation (only blocking at /submit)
    """
    cluster: str = ""
    country: str = ""
    legal_entity: Optional[str] = None
    activity_type: str = ""
    event_type: Optional[str] = None
    event_purpose: Optional[str] = None
    sap_event_code: Optional[str] = None
    cot: str = ""

    # ── CATEGORY: now a LIST (multi-select) ─────────────────────────────
    category: list[str] = []

    brand: str = ""
    capex_opex: str = "OpEx"
    adv_selling: str = "ADV"
    detail: Optional[str] = None
    description: Optional[str] = None
    customer: Optional[str] = None
    vendor: Optional[str] = None
    cost_justification: Optional[str] = None
    currency: str = "EUR"
    num_customers: Optional[int] = None
    num_doors: Optional[int] = None
    q4_2025: float = 0
    q1_2026: float = 0
    q2_2026: float = 0
    q3_2026: float = 0
    q4_2026: float = 0
    tools: Optional[str] = None
    kpi: Optional[str] = None
    timing: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    cost_drill_down: Optional[str] = None
    cost_split_lenses: Optional[float] = None
    cost_split_frames: Optional[float] = None
    forecasted_lenses_sales: Optional[float] = None
    forecasted_frames_sales: Optional[float] = None
    forecasted_instruments_sales: Optional[float] = None
    pct_central_budget: Optional[float] = None
    finance_validator_email: Optional[str] = None
    requestor_email: str = ""

    @field_validator("category", mode="before")
    @classmethod
    def normalize_category(cls, v):
        if v is None or v == "":
            return []
        if isinstance(v, str):
            v = [v]
        seen = set()
        result = []
        for item in v:
            if item and item not in seen:
                seen.add(item)
                result.append(item)
        return result

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: list[str]):
        if v:
            invalid = [c for c in v if c not in CATEGORIES]
            if invalid:
                raise ValueError(
                    f"Invalid category value(s): {invalid}. Allowed: {CATEGORIES}"
                )
        return v

    @field_validator("cluster")
    @classmethod
    def validate_cluster(cls, v: str):
        if v and not is_valid_cluster(v):
            raise ValueError(f"Invalid cluster '{v}'. Allowed: {CLUSTERS}")
        return v

    @field_validator("activity_type")
    @classmethod
    def validate_activity_type(cls, v: str):
        if v and not is_valid_activity_type(v):
            raise ValueError(f"Invalid activity_type '{v}'. Allowed: {ACTIVITY_TYPES}")
        return v

    @field_validator("event_type")
    @classmethod
    def validate_event_type(cls, v: Optional[str]):
        if v and v not in EVENT_TYPES:
            raise ValueError(f"Invalid event_type '{v}'. Allowed: {EVENT_TYPES}")
        return v

    @field_validator("event_purpose")
    @classmethod
    def validate_event_purpose(cls, v: Optional[str]):
        if v and v not in EVENT_PURPOSES:
            raise ValueError(f"Invalid event_purpose '{v}'. Allowed: {EVENT_PURPOSES}")
        return v

    @field_validator("cot")
    @classmethod
    def validate_cot(cls, v: str):
        if v and v not in COT_OPTIONS:
            raise ValueError(f"Invalid cot '{v}'. Allowed: {COT_OPTIONS}")
        return v

    @field_validator("capex_opex")
    @classmethod
    def validate_capex_opex(cls, v: str):
        if v and v not in CAPEX_OPEX:
            raise ValueError(f"Invalid capex_opex '{v}'. Allowed: {CAPEX_OPEX}")
        return v

    @field_validator("adv_selling")
    @classmethod
    def validate_adv_selling(cls, v: str):
        if v and v not in ADV_SELLING:
            raise ValueError(f"Invalid adv_selling '{v}'. Allowed: {ADV_SELLING}")
        return v


class DescriptionValidateRequest(BaseModel):
    description: str
    activity_type: str


class SuggestRequest(BaseModel):
    """Input for AI suggestion. category is now multi-select too."""
    activity_type: str
    cluster: str = ""
    category: list[str] = []
    brand: str = ""
    fy_total: float = 0
    num_doors: int = 0
    requestor_email: str = "system"

    @field_validator("category", mode="before")
    @classmethod
    def normalize_category(cls, v):
        if v is None or v == "":
            return []
        if isinstance(v, str):
            return [v]
        return list(v)


# ── Workflow state machine ──────────────────────────────────────────────
#
# Status transition map: defines the next status after a successful
# /validate call on the current status. This map IS the workflow.
WORKFLOW_TRANSITIONS = {
    "local_prep":       "country_review",
    "country_review":   "global_review",
    "global_review":    "cmo_review",
    "cmo_review":       "cfo_review",
    "cfo_review":       "corporate_review",
    "corporate_review": "ceo_validation",
    "ceo_validation":   "approved",
}

# Statuses that require the 'validate' permission to advance
# (explicit approval moments by named approvers).
VALIDATION_STATUSES = {"cmo_review", "cfo_review", "ceo_validation"}

# Statuses that require the 'advance_phase' permission to advance
# (phase opening/closing acts, orchestrated by EMEA).
ADVANCE_PHASE_STATUSES = {
    "local_prep", "country_review", "global_review", "corporate_review",
}


# ── Routes ──────────────────────────────────────────────────────────────

@router.get("")
async def get_loas(
    status: Optional[str] = None,
    cluster: Optional[str] = None,
    include_historical: bool = False,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Return LOAs filtered by the current user's role scope.
    """
    query = db.query(LOA)

    if not include_historical:
        query = query.filter(LOA.is_demo == True)

    role = user.role_obj
    if role is None:
        return []

    if role.scope_type == 'cluster':
        allowed_clusters = role.scope_value or []
        query = query.filter(LOA.cluster.in_(allowed_clusters))
    elif role.scope_type == 'brand':
        allowed_brands = role.scope_value or []
        query = query.filter(LOA.brand.in_(allowed_brands))
    elif role.scope_type == 'function':
        allowed_functions = role.scope_value or []
        query = query.filter(LOA.activity_type.in_(allowed_functions))
    elif role.scope_type == 'all':
        pass
    elif role.scope_type == 'author_only':
        query = query.filter(LOA.requestor_email == user.email)

    if status:
        query = query.filter(LOA.status == status)
    if cluster:
        query = query.filter(LOA.cluster == cluster)

    if not role.can_override_lock:
        query = query.filter(
            (LOA.status != 'draft') | (LOA.requestor_email == user.email)
        )

    return query.all()


@router.get("/{loa_id}")
async def get_loa(
    loa_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Return a single LOA, only if the user has visibility on it."""
    loa = db.query(LOA).filter(LOA.id == loa_id).first()
    if not loa:
        raise HTTPException(status_code=404, detail="LOA not found")

    role = user.role_obj
    if role is None:
        raise HTTPException(status_code=403, detail="No role assigned")

    if not role.can_override_lock:
        if loa.status == 'draft' and loa.requestor_email != user.email:
            raise HTTPException(status_code=403, detail="Draft is private to its author")
        if not role.matches_loa(loa):
            raise HTTPException(status_code=403, detail="LOA outside your scope")

    return loa


@router.post("")
async def create_loa(body: LOACreate, db: Session = Depends(get_db)):
    loa_id = str(uuid.uuid4())
    draft_id = f"LAURA-{datetime.now().strftime('%Y%m%d')}-{loa_id[:6].upper()}"

    loa = LOA(
        id=loa_id,
        loa_draft_id=draft_id,
        status="draft",
        is_demo=True,
        **body.model_dump(),
    )
    loa.calculate_totals()
    db.add(loa)
    db.commit()
    db.refresh(loa)
    return loa


@router.patch("/{loa_id}")
async def update_loa(
    loa_id: str,
    body: LOACreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    _: dict = Depends(require_permission('edit')),
):
    """
    Update a LOA's fields. Protected by 'edit' permission on the current
    status, plus the is_locked flag check.
    """
    loa = db.query(LOA).filter(LOA.id == loa_id).first()
    if not loa:
        raise HTTPException(status_code=404, detail="LOA not found")

    if loa.is_locked:
        role = user.role_obj
        if not role or not role.can_override_lock:
            raise HTTPException(
                status_code=423,
                detail="LOA is locked. Only a super-admin can edit it while locked.",
            )

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(loa, field, value)

    loa.calculate_totals()
    db.commit()
    db.refresh(loa)
    return loa


@router.post("/{loa_id}/submit")
async def submit_loa(
    loa_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Submit a LOA from draft (or rejected) to local_prep.

    Only the LOA's author can submit. Handles both first submit (draft -> local_prep)
    and Revise & Resubmit (rejected -> local_prep).
    """
    loa = db.query(LOA).filter(LOA.id == loa_id).first()
    if not loa:
        raise HTTPException(status_code=404, detail="LOA not found")

    if loa.requestor_email != user.email:
        raise HTTPException(
            status_code=403,
            detail="Only the LOA author can submit or resubmit it.",
        )

    if loa.status == "draft":
        new_status = "local_prep"
        event_name = "loa_submitted"
    elif loa.status == "rejected":
        new_status = "local_prep"
        event_name = "loa_resubmitted"
    else:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot submit a LOA in status '{loa.status}'. "
                   f"Only 'draft' or 'rejected' LOAs can be submitted.",
        )

    issues = loa.validate()
    errors = [i for i in issues if i["type"] == "error"]
    if errors:
        raise HTTPException(status_code=422, detail={"validation_errors": errors})

    loa.status = new_status
    loa.submitted_at = datetime.utcnow()
    if event_name == "loa_resubmitted":
        loa.rejection_reason = None
    db.commit()
    db.refresh(loa)

    await notify_n8n(event_name, str(loa_id), {
        "requestor_email": loa.requestor_email,
        "loa_draft_id": loa.loa_draft_id,
        "activity_type": loa.activity_type,
        "country": loa.country,
        "cluster": loa.cluster,
        "fy_total": loa.fy_2026_total,
    })

    return loa


# ── Helper for /validate permission resolution ──────────────────────────
def _check_workflow_permission(user: User, loa: LOA, db: Session) -> str:
    """
    For the /validate endpoint: determine which permission is required
    based on the LOA's current status, and verify the user has it.

    Returns the permission code that was required (for logging/notification).
    Raises HTTPException 403 if the user does not have the required permission.

    The dispatch logic:
      - status in VALIDATION_STATUSES   -> 'validate' (explicit approval moment)
      - status in ADVANCE_PHASE_STATUSES -> 'advance_phase' (orchestration)
    """
    current_status = loa.status

    if current_status in VALIDATION_STATUSES:
        required_permission = 'validate'
    elif current_status in ADVANCE_PHASE_STATUSES:
        required_permission = 'advance_phase'
    else:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot advance a LOA in status '{current_status}'.",
        )

    role = user.role_obj
    if not role:
        raise HTTPException(status_code=403, detail="No role assigned")

    # Look up the actual permission from the matrix for (role, status)
    rp = (
        db.query(RolePermission, Permission)
        .join(Permission, RolePermission.permission_id == Permission.id)
        .filter(
            RolePermission.role_id == role.id,
            RolePermission.loa_status == current_status,
        )
        .first()
    )
    actual_permission = rp[1].code if rp else None

    if not actual_permission or not implies(actual_permission, required_permission):
        raise HTTPException(
            status_code=403,
            detail={
                'error': 'Permission denied',
                'required_permission': required_permission,
                'user_role': role.code,
                'loa_status': current_status,
                'message': (
                    f"Your role '{role.code}' cannot perform "
                    f"'{required_permission}' on a LOA in status '{current_status}'."
                ),
            },
        )

    return required_permission


@router.post("/{loa_id}/validate")
async def validate_workflow_step(
    loa_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Advance a LOA to the next step in the approval workflow.

    The backend is the single source of truth for which transition applies.
    The permission required depends on the current status:
      - 'validate' for cmo_review, cfo_review, ceo_validation
      - 'advance_phase' for local_prep, country_review, global_review,
        corporate_review

    The frontend just calls this endpoint; the backend dispatches.
    """
    loa = db.query(LOA).filter(LOA.id == loa_id).first()
    if not loa:
        raise HTTPException(status_code=404, detail="LOA not found")

    if loa.is_locked:
        raise HTTPException(
            status_code=423,
            detail="LOA is locked by a super-admin. It must be unlocked first.",
        )

    current_status = loa.status
    if current_status not in WORKFLOW_TRANSITIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot validate a LOA in status '{current_status}'. "
                   f"Valid statuses: {list(WORKFLOW_TRANSITIONS.keys())}",
        )

    # Permission check (raises 403 if denied)
    permission_used = _check_workflow_permission(user, loa, db)

    new_status = WORKFLOW_TRANSITIONS[current_status]
    loa.status = new_status

    if new_status == "approved":
        loa.approved_at = datetime.utcnow()

    db.commit()
    db.refresh(loa)

    await notify_n8n("loa_validated", str(loa_id), {
        "requestor_email": loa.requestor_email,
        "loa_draft_id": loa.loa_draft_id,
        "from_status": current_status,
        "to_status": new_status,
        "validated_by": user.email,
        "permission_used": permission_used,
        "activity_type": loa.activity_type,
        "country": loa.country,
        "fy_total": loa.fy_2026_total,
    })

    return loa


# ── Keep /approve as alias for /validate (backward compatibility) ──
@router.post("/{loa_id}/approve")
async def approve_loa(
    loa_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Backward-compatible alias for POST /validate.
    The frontend currently calls /approve in some places; we redirect
    to the same logic. Eventually remove this once frontend is updated.
    """
    return await validate_workflow_step(loa_id, db, user)


@router.post("/{loa_id}/reject")
async def reject_loa(
    loa_id: str,
    reason: str = "",
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Reject a LOA at any workflow step (except draft).

    Rejection requires either 'validate' OR 'advance_phase' permission on
    the current status — anyone who can move the workflow forward can also
    halt it with a rejection.

    The reason is mandatory and stored on the LOA so the author can read
    it on Revise & Resubmit. After rejection, the LOA stays in 'rejected'
    until resubmitted.
    """
    loa = db.query(LOA).filter(LOA.id == loa_id).first()
    if not loa:
        raise HTTPException(status_code=404, detail="LOA not found")

    if loa.is_locked:
        raise HTTPException(
            status_code=423,
            detail="LOA is locked by a super-admin.",
        )

    if not reason or not reason.strip():
        raise HTTPException(
            status_code=422,
            detail="A non-empty reason is required to reject a LOA.",
        )

    if loa.status == "draft":
        raise HTTPException(
            status_code=400,
            detail="Cannot reject a draft. Drafts can be discarded instead.",
        )
    if loa.status in ("approved", "rejected"):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot reject a LOA already in status '{loa.status}'.",
        )

    # Permission check: same logic as validate (whoever can advance can reject)
    _check_workflow_permission(user, loa, db)

    previous_status = loa.status
    loa.status = "rejected"
    loa.rejection_reason = reason.strip()
    db.commit()
    db.refresh(loa)

    await notify_n8n("loa_rejected", str(loa_id), {
        "requestor_email": loa.requestor_email,
        "loa_draft_id": loa.loa_draft_id,
        "rejected_by": user.email,
        "rejected_from_status": previous_status,
        "reason": reason.strip(),
    })

    return loa


@router.post("/{loa_id}/lock")
async def lock_loa(
    loa_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Lock a LOA against any editing.

    Only super-admins (users with can_override_lock = true) can lock or
    unlock a LOA. The LOA keeps its workflow status so it can resume
    normally once unlocked.
    """
    loa = db.query(LOA).filter(LOA.id == loa_id).first()
    if not loa:
        raise HTTPException(status_code=404, detail="LOA not found")

    role = user.role_obj
    if not role or not role.can_override_lock:
        raise HTTPException(
            status_code=403,
            detail="Only super-admins can lock a LOA.",
        )

    if loa.is_locked:
        return loa  # idempotent

    loa.is_locked = True
    db.commit()
    db.refresh(loa)

    await notify_n8n("loa_locked", str(loa_id), {
        "loa_draft_id": loa.loa_draft_id,
        "locked_by": user.email,
        "current_status": loa.status,
    })

    return loa


@router.post("/{loa_id}/unlock")
async def unlock_loa(
    loa_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Unlock a LOA. Super-admins only."""
    loa = db.query(LOA).filter(LOA.id == loa_id).first()
    if not loa:
        raise HTTPException(status_code=404, detail="LOA not found")

    role = user.role_obj
    if not role or not role.can_override_lock:
        raise HTTPException(
            status_code=403,
            detail="Only super-admins can unlock a LOA.",
        )

    if not loa.is_locked:
        return loa  # idempotent

    loa.is_locked = False
    db.commit()
    db.refresh(loa)

    await notify_n8n("loa_unlocked", str(loa_id), {
        "loa_draft_id": loa.loa_draft_id,
        "unlocked_by": user.email,
        "current_status": loa.status,
    })

    return loa


# ── Field validation endpoint (kept as GET, different from POST /validate) ──
@router.get("/{loa_id}/validate")
async def validate_loa(loa_id: str, db: Session = Depends(get_db)):
    """Validate that a LOA's fields are complete (form-level validation)."""
    loa = db.query(LOA).filter(LOA.id == loa_id).first()
    if not loa:
        raise HTTPException(status_code=404, detail="LOA not found")
    issues = loa.validate()
    return {
        "loa_id": loa_id,
        "is_valid": not any(i["type"] == "error" for i in issues),
        "issues": issues,
    }

@router.delete("/{loa_id}")
async def delete_loa(
    loa_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Delete a LOA. Only allowed when status is draft or local_prep,
    and only by the author or a super-admin.
    """
    loa = db.query(LOA).filter(LOA.id == loa_id).first()
    if not loa:
        raise HTTPException(status_code=404, detail="LOA not found")

    role = user.role_obj
    is_author = loa.requestor_email == user.email
    is_admin = role and role.can_override_lock

    if not is_author and not is_admin:
        raise HTTPException(status_code=403, detail="Only the author or a super-admin can delete a LOA.")

    if loa.status not in ("draft", "local_prep"):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete a LOA in status '{loa.status}'. Only draft and local_prep LOAs can be deleted.",
        )

    db.delete(loa)
    db.commit()
    return {"deleted": True, "loa_id": loa_id}


@router.get("/{loa_id}/pptx")
async def download_loa_pptx(loa_id: str, db: Session = Depends(get_db)):
    loa = db.query(LOA).filter(LOA.id == loa_id).first()
    if not loa:
        raise HTTPException(status_code=404, detail="LOA not found")
    from backend.engines.ppt import generate_loa_slide

    loa_dict = {c.name: getattr(loa, c.name) for c in loa.__table__.columns}
    pptx_bytes = generate_loa_slide(loa_dict)
    filename = f"LOA_{loa.loa_draft_id}.pptx"
    return Response(
        content=pptx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.post("/ai/validate-description")
async def validate_description(body: DescriptionValidateRequest):
    from backend.engines.ai import validate_description as ai_validate
    return await ai_validate(body.description, body.activity_type)


@router.post("/ai/suggest")
async def suggest_content(body: SuggestRequest):
    from backend.engines.ai import suggest_loa_content
    return await suggest_loa_content(
        activity_type=body.activity_type,
        cluster=body.cluster,
        category=body.category,
        brand=body.brand,
        fy_total=body.fy_total,
        num_doors=body.num_doors,
        requestor_email=body.requestor_email,
    )


# ── Photo upload ────────────────────────────────────────────────────────
UPLOAD_DIR = "uploads/loa_photos"
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/{loa_id}/photos")
async def upload_photo(
    loa_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    loa = db.query(LOA).filter(LOA.id == loa_id).first()
    if not loa:
        raise HTTPException(status_code=404, detail="LOA not found")

    existing = [f for f in os.listdir(UPLOAD_DIR) if f.startswith(loa_id)]
    if len(existing) >= 2:
        raise HTTPException(status_code=400, detail="Maximum 2 photos per LOA")

    ext = file.filename.split(".")[-1].lower()
    if ext not in ["jpg", "jpeg", "png"]:
        raise HTTPException(status_code=400, detail="Only JPG and PNG allowed")

    photo_index = len(existing) + 1
    filename = f"{loa_id}_photo{photo_index}.{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)

    with open(filepath, "wb") as f:
        shutil.copyfileobj(file.file, f)

    return {"filename": filename, "url": f"/loa/{loa_id}/photos/{photo_index}"}


@router.get("/{loa_id}/photos/{index}")
async def get_photo(loa_id: str, index: int):
    for f in os.listdir(UPLOAD_DIR):
        if f.startswith(f"{loa_id}_photo{index}"):
            return FileResponse(os.path.join(UPLOAD_DIR, f))
    raise HTTPException(status_code=404, detail="Photo not found")


@router.delete("/{loa_id}/photos/{index}")
async def delete_photo(loa_id: str, index: int):
    for f in os.listdir(UPLOAD_DIR):
        if f.startswith(f"{loa_id}_photo{index}"):
            os.remove(os.path.join(UPLOAD_DIR, f))
            return {"deleted": True}
    raise HTTPException(status_code=404, detail="Photo not found")