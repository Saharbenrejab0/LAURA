"""LAURA — LOA routes

Connected to:
  - backend.reference_data : source of truth for all dropdowns (validates inputs)
  - backend.models.loa     : SQLAlchemy LOA model (category is now ARRAY)
  - backend.engines.*      : PPT/Excel/AI generation

Sprint 2 + 2.5 additions:
  - Scope-based filtering on GET /loa and GET /loa/{id}
  - Permission-protected action endpoints (submit, validate, reject, lock, unlock)
  - Workflow state machine with 8 statuses (5 active transitions)
  - is_locked flag enforced on edits
  - Smart /validate endpoint dispatching between 'validate' (CMO/CFO,
    Corporate) and 'advance_phase' (EMEA PS orchestration)

Sprint 5 additions:
  - GET /export/excel           — consolidated Excel (scope-filtered)
  - GET /export/excel/approved  — all approved LOAs (called by n8n)
  - GET /{loa_id}/excel         — single LOA as one-row .xlsx
  - notify_n8n("loa_approved")  — triggers Excel regen + notification
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
from backend.engines.loa_display import compute_display_title


# -- Rejection rule (Rock 3) --
# Rejection at any step -> status becomes "rejected".
# Marketer re-edits and re-submits -> goes back to emea_review.

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
from backend.models.comment import Comment
from backend.api.auth import get_current_user
from backend.api.permission_middleware import require_permission

router = APIRouter()

XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


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
    cluster: str = ""
    country: str = ""
    legal_entity: Optional[str] = None
    activity_type: str = ""
    event_type: Optional[str] = None
    event_purpose: Optional[str] = None
    sap_event_code: Optional[str] = None
    cot: str = ""
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


# -- Workflow state machine (Rock 3 -- 9 statuses, parallel gates) ----------

# Linear transition map (for non-parallel-gate steps)
WORKFLOW_TRANSITIONS = {
    "emea_review":             "global_review",
    "global_review":           "emea_post_global_review",
    "emea_post_global_review": "cmo_cfo_review",
    "cmo_cfo_review":          "emea_final_review",
    "emea_final_review":       "corporate_review",
    "corporate_review":        "approved",
}

# Display order (used for rollback dropdown)
WORKFLOW_ORDER = [
    "draft", "emea_review", "global_review", "emea_post_global_review",
    "cmo_cfo_review", "emea_final_review", "corporate_review", "approved",
]

# Statuses requiring 'validate' permission (approval decisions)
VALIDATION_STATUSES = {"cmo_cfo_review", "corporate_review"}

# Statuses requiring 'advance_phase' permission (EMEA orchestration)
ADVANCE_PHASE_STATUSES = {"emea_review", "emea_post_global_review", "emea_final_review"}



# ── Scope filter helper (shared by get_loas and export_excel) ───────────
def _apply_scope_filter(query, user: User):
    """Apply role-based scope filtering to a LOA query."""
    role = user.role_obj
    if role is None:
        return query.filter(False)

    if role.scope_type == 'cluster':
        query = query.filter(LOA.cluster.in_(role.scope_value or []))
    elif role.scope_type == 'brand':
        query = query.filter(LOA.brand.in_(role.scope_value or []))
    elif role.scope_type == 'function':
        query = query.filter(LOA.activity_type.in_(role.scope_value or []))
    elif role.scope_type == 'all':
        pass
    elif role.scope_type == 'author_only':
        query = query.filter(LOA.requestor_email == user.email)
    return query
# -- Parallel gate helpers (Rock 3) ----------------------------------------

def _has_brand_reviewer(loa: LOA, db: Session) -> bool:
    """Check if any global_brand_* role with active users matches this LOA's brand."""
    from backend.models.role import Role
    if not loa.brand:
        return False
    brand_roles = db.query(Role).filter(Role.scope_type == 'brand').all()
    for role in brand_roles:
        scope_values = role.scope_value or []
        if loa.brand in scope_values:
            user_count = db.query(User).filter(User.role_id == role.id).count()
            if user_count > 0:
                return True
    return False


def _has_function_reviewer(loa: LOA, db: Session) -> bool:
    """Check if any global_function_* role with active users matches this LOA's activity_type."""
    from backend.models.role import Role
    if not loa.activity_type:
        return False
    func_roles = db.query(Role).filter(Role.scope_type == 'function').all()
    for role in func_roles:
        scope_values = role.scope_value or []
        if loa.activity_type in scope_values:
            user_count = db.query(User).filter(User.role_id == role.id).count()
            if user_count > 0:
                return True
    return False


def _compute_skip_flags(loa: LOA, db: Session) -> None:
    """Set brand/function skip flags. Called when EMEA advances from emea_review."""
    has_brand = _has_brand_reviewer(loa, db)
    has_func = _has_function_reviewer(loa, db)

    loa.brand_review_skipped = not has_brand
    loa.brand_review_done = not has_brand      # pre-mark done if skipped
    loa.function_review_skipped = not has_func
    loa.function_review_done = not has_func    # pre-mark done if skipped


def _is_global_review_complete(loa: LOA) -> bool:
    """Check if both brand and function gates are satisfied (done or skipped)."""
    return loa.brand_review_done and loa.function_review_done

# ════════════════════════════════════════════════════════════════════════
# ROUTES — order matters: /export/* BEFORE /{loa_id} to avoid UUID parse
# ════════════════════════════════════════════════════════════════════════



def _with_display_title(loa):
    """Serialize an ORM LOA to dict + inject display_title."""
    if loa is None:
        return None
    data = {c.name: getattr(loa, c.name) for c in loa.__table__.columns}
    data["display_title"] = compute_display_title(loa)
    return data

@router.get("")
async def get_loas(
    status: Optional[str] = None,
    cluster: Optional[str] = None,
    include_historical: bool = False,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = db.query(LOA)

    # Removed is_demo filter: tracker shows all LOAs regardless of source
    # (previously hid real user-created LOAs by mistake)

    role = user.role_obj
    if role is None:
        return []

    query = _apply_scope_filter(query, user)

    if not role.can_override_lock:
        allowed_statuses = (
            db.query(RolePermission.loa_status)
            .filter(RolePermission.role_id == role.id)
            .distinct()
            .all()
        )
        allowed = [s[0] for s in allowed_statuses]
        if allowed:
            query = query.filter(LOA.status.in_(allowed))
        else:
            return []

    if status:
        query = query.filter(LOA.status == status)
    if cluster:
        query = query.filter(LOA.cluster == cluster)

    if not role.can_override_lock:
        query = query.filter(
            (LOA.status != 'draft') | (LOA.requestor_email == user.email)
        )

    return [_with_display_title(loa) for loa in query.all()]


# ── Excel export (BEFORE /{loa_id} routes) ──────────────────────────────

@router.get("/export/excel")
async def export_excel(
    status: Optional[str] = None,
    cluster: Optional[str] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Export LOAs as .xlsx — powers the tracker "Export Excel" button.
    Respects scope filtering. Combine ?status=approved&cluster=FRANCE.
    """
    from backend.engines.excel import loas_to_rows, export_excel_bytes, safe_filename

    query = db.query(LOA)  # is_demo filter removed
    query = _apply_scope_filter(query, user)

    if status:
        query = query.filter(LOA.status == status)
    if cluster:
        query = query.filter(LOA.cluster == cluster)

    loas = query.all()
    if not loas:
        raise HTTPException(status_code=404, detail="No LOAs found matching filters.")

    rows = loas_to_rows(loas)
    xlsx_bytes = export_excel_bytes(
        rows,
        title=f"LAURA LOA {cluster or 'ALL'}",
        split_by_cluster=(cluster is None),
    )

    filename = safe_filename(f"LAURA_LOA_{status or 'all'}_{cluster or 'ALL'}")
    return Response(
        content=xlsx_bytes,
        media_type=XLSX_MIME,
        headers={"Content-Disposition": f'attachment; filename="{filename}.xlsx"'},
    )


@router.get("/export/excel/approved")
async def export_approved_excel(
    db: Session = Depends(get_db),
):
    """
    Consolidated Excel of ALL approved LOAs.
    Called by n8n after each approval — no user auth (internal endpoint).
    In production, protect with API key or internal-only network.
    """
    from backend.engines.excel import loas_to_rows, export_excel_bytes

    loas = db.query(LOA).filter(LOA.status == "approved").all()
    rows = loas_to_rows(loas)
    xlsx_bytes = export_excel_bytes(
        rows,
        title="LAURA Approved LOAs",
        split_by_cluster=True,
        include_summary=True,
    )
    return Response(
        content=xlsx_bytes,
        media_type=XLSX_MIME,
        headers={"Content-Disposition": 'attachment; filename="LAURA_Approved_LOAs.xlsx"'},
    )


# ── CRUD ────────────────────────────────────────────────────────────────

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


@router.get("/{loa_id}")
async def get_loa(
    loa_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
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

    return _with_display_title(loa)


@router.patch("/{loa_id}")
async def update_loa(
    loa_id: str,
    body: LOACreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    _: dict = Depends(require_permission('edit')),
):
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
    return _with_display_title(loa)


# ── Excel single-row download (detail page button) ─────────────────────

@router.get("/{loa_id}/excel")
async def export_loa_excel_row(
    loa_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Download a single LOA as a one-row .xlsx."""
    from backend.engines.excel import loa_to_row, export_single_loa_row, safe_filename

    loa = db.query(LOA).filter(LOA.id == loa_id).first()
    if not loa:
        raise HTTPException(status_code=404, detail="LOA not found")

    row = loa_to_row(loa)
    xlsx_bytes = export_single_loa_row(row)

    filename = safe_filename(f"LOA_{loa.loa_draft_id}")
    return Response(
        content=xlsx_bytes,
        media_type=XLSX_MIME,
        headers={"Content-Disposition": f'attachment; filename="{filename}.xlsx"'},
    )


# ── Submit ──────────────────────────────────────────────────────────────

@router.post("/{loa_id}/submit")
async def submit_loa(
    loa_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    loa = db.query(LOA).filter(LOA.id == loa_id).first()
    if not loa:
        raise HTTPException(status_code=404, detail="LOA not found")

    if loa.requestor_email != user.email:
        raise HTTPException(
            status_code=403,
            detail="Only the LOA author can submit or resubmit it.",
        )

    if loa.status == "draft":
        new_status = "emea_review"
        event_name = "loa_submitted"
    elif loa.status == "rejected":
        new_status = "emea_review"
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


# -- Workflow permission check (Rock 3) ------------------------------------

def _check_workflow_permission(user: User, loa: LOA, db: Session) -> str:
    """
    Verify user has the required permission to act on this LOA.
    Returns permission code used. Raises HTTPException if denied.
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

    # Get ALL permissions this role has at this status
    perms = (
        db.query(Permission.code)
        .join(RolePermission, RolePermission.permission_id == Permission.id)
        .filter(
            RolePermission.role_id == role.id,
            RolePermission.loa_status == current_status,
        )
        .all()
    )
    perm_codes = {p[0] for p in perms}

    if not perm_codes:
        raise HTTPException(status_code=403, detail="No access at this workflow stage.")

    # advance_phase implies all others
    if 'advance_phase' in perm_codes:
        return 'advance_phase'
    if required_permission in perm_codes:
        return required_permission

    raise HTTPException(
        status_code=403,
        detail=f"You need '{required_permission}' permission. "
               f"You have: {', '.join(sorted(perm_codes))}",
    )



@router.post("/{loa_id}/validate")
async def validate_workflow_step(
    loa_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    loa = db.query(LOA).filter(LOA.id == loa_id).first()
    if not loa:
        raise HTTPException(status_code=404, detail="LOA not found")

    if loa.is_locked:
        raise HTTPException(status_code=423, detail="LOA is locked by a super-admin.")

    current_status = loa.status

    # global_review advances automatically via comments, not via /validate
    if current_status == "global_review":
        raise HTTPException(
            status_code=400,
            detail="global_review advances automatically when reviewers comment.",
        )

    if current_status not in WORKFLOW_TRANSITIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot advance a LOA in status '{current_status}'.",
        )

    permission_used = _check_workflow_permission(user, loa, db)
    skipped = []

    # -- CMO/CFO parallel gate --
    if current_status == "cmo_cfo_review":
        role = user.role_obj
        role_code = role.code if role else ""

        if role_code == "regional_cmo":
            loa.cmo_approved = True
        elif role_code == "regional_cfo":
            loa.cfo_approved = True
        else:
            # Super-admin or advance_phase holder: approve both
            loa.cmo_approved = True
            loa.cfo_approved = True

        if loa.cmo_approved and loa.cfo_approved:
            new_status = WORKFLOW_TRANSITIONS[current_status]
            loa.status = new_status
        else:
            # One side approved, waiting for the other
            db.commit()
            db.refresh(loa)
            return loa

    # -- EMEA review -> global_review (with skip detection) --
    elif current_status == "emea_review":
        _compute_skip_flags(loa, db)
        if loa.brand_review_done and loa.function_review_done:
            # Both skipped -> jump past global_review
            loa.status = "emea_post_global_review"
            skipped.append("global_review")
        else:
            loa.status = "global_review"

    # -- All other steps: linear advance --
    else:
        new_status = WORKFLOW_TRANSITIONS.get(current_status)
        if not new_status:
            raise HTTPException(
                status_code=400,
                detail=f"No transition defined from status '{current_status}'.",
            )
        loa.status = new_status

    new_status = loa.status

    if new_status == "approved":
        loa.approved_at = datetime.utcnow()

    db.commit()
    db.refresh(loa)

    await notify_n8n("loa_validated", str(loa_id), {
        "requestor_email": loa.requestor_email,
        "loa_draft_id": loa.loa_draft_id,
        "from_status": current_status,
        "to_status": new_status,
        "skipped_steps": skipped,
        "validated_by": user.email,
        "permission_used": permission_used,
        "activity_type": loa.activity_type,
        "country": loa.country,
        "fy_total": loa.fy_2026_total,
    })

    if new_status == "approved":
        await notify_n8n("loa_approved", str(loa_id), {
            "requestor_email": loa.requestor_email,
            "loa_draft_id": loa.loa_draft_id,
            "loa_number": loa.loa_number or loa.loa_draft_id,
            "activity_type": loa.activity_type,
            "country": loa.country,
            "cluster": loa.cluster,
            "brand": loa.brand,
            "fy_total": loa.fy_2026_total,
        })

    return loa


@router.post("/{loa_id}/approve")
async def approve_loa(
    loa_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Backward-compatible alias for POST /validate."""
    return await validate_workflow_step(loa_id, db, user)


@router.post("/{loa_id}/reject")
async def reject_loa(
    loa_id: str,
    reason: str = "",
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    loa = db.query(LOA).filter(LOA.id == loa_id).first()
    if not loa:
        raise HTTPException(status_code=404, detail="LOA not found")

    if loa.is_locked:
        raise HTTPException(status_code=423, detail="LOA is locked by a super-admin.")

    if not reason or not reason.strip():
        raise HTTPException(status_code=422, detail="A non-empty reason is required.")

    if loa.status == "draft":
        raise HTTPException(status_code=400, detail="Cannot reject a draft.")

    if loa.status in ("approved", "rejected"):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot reject a LOA already in status '{loa.status}'.",
        )

    _check_workflow_permission(user, loa, db)

    previous_status = loa.status
    loa.status = "rejected"
    loa.rejection_reason = reason.strip()

    # Reset ALL gate booleans
    loa.cmo_approved = False
    loa.cfo_approved = False
    loa.brand_review_done = False
    loa.function_review_done = False
    loa.brand_review_skipped = False
    loa.function_review_skipped = False

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


class CommentRequest(BaseModel):
    comment: str


@router.post("/{loa_id}/comment")
async def add_comment(
    loa_id: str,
    body: CommentRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    loa = db.query(LOA).filter(LOA.id == loa_id).first()
    if not loa:
        raise HTTPException(status_code=404, detail="LOA not found")

    if not body.comment or not body.comment.strip():
        raise HTTPException(status_code=422, detail="Comment cannot be empty.")

    role = user.role_obj
    if not role:
        raise HTTPException(status_code=403, detail="No role assigned")

    # Get ALL permissions this role has at this LOA's current status
    perms = (
        db.query(Permission.code)
        .join(RolePermission, RolePermission.permission_id == Permission.id)
        .filter(
            RolePermission.role_id == role.id,
            RolePermission.loa_status == loa.status,
        )
        .all()
    )
    perm_codes = {p[0] for p in perms}

    if not perm_codes:
        raise HTTPException(status_code=403, detail="No access at this stage.")

    # Need at least comment-level permission
    comment_perms = {'comment', 'validate', 'edit', 'advance_phase'}
    if not perm_codes & comment_perms:
        raise HTTPException(status_code=403, detail="You need at least comment permission.")

    timestamp = datetime.utcnow().strftime("%d %b %Y %H:%M")
    entry = f"[{timestamp}] {user.email}:\n{body.comment.strip()}"

    if loa.cmo_comment:
        loa.cmo_comment = f"{loa.cmo_comment}\n\n---\n\n{entry}"
    else:
        loa.cmo_comment = entry

    # -- Parallel gate tracking for global_review --
    auto_advanced = False
    if loa.status == "global_review":
        if role.scope_type == "brand":
            loa.brand_review_done = True
        elif role.scope_type == "function":
            loa.function_review_done = True

        # Check if both gates are now complete -> auto-advance
        if _is_global_review_complete(loa):
            loa.status = "emea_post_global_review"
            auto_advanced = True

    db.commit()
    db.refresh(loa)

    result = {"status": "ok", "comment_added": entry}
    if auto_advanced:
        result["auto_advanced_to"] = "emea_post_global_review"
        await notify_n8n("loa_validated", str(loa_id), {
            "requestor_email": loa.requestor_email,
            "loa_draft_id": loa.loa_draft_id,
            "from_status": "global_review",
            "to_status": "emea_post_global_review",
            "skipped_steps": [],
            "validated_by": "auto (both review gates complete)",
            "permission_used": "comment",
            "activity_type": loa.activity_type,
            "country": loa.country,
            "fy_total": loa.fy_2026_total,
        })

    return result



# ── Lock / Unlock ───────────────────────────────────────────────────────

@router.post("/{loa_id}/lock")
async def lock_loa(
    loa_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
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
        return loa

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
        return loa

    loa.is_locked = False
    db.commit()
    db.refresh(loa)

    await notify_n8n("loa_unlocked", str(loa_id), {
        "loa_draft_id": loa.loa_draft_id,
        "unlocked_by": user.email,
        "current_status": loa.status,
    })

    return loa


# ── Field validation (GET — different from POST /validate) ──────────────

@router.get("/{loa_id}/validate")
async def validate_loa(loa_id: str, db: Session = Depends(get_db)):
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
    loa = db.query(LOA).filter(LOA.id == loa_id).first()
    if not loa:
        raise HTTPException(status_code=404, detail="LOA not found")

    role = user.role_obj
    if not role:
        raise HTTPException(status_code=403, detail="No role assigned")

    # Check matrix: does this role have 'delete' permission at this status?
    has_delete = (
        db.query(RolePermission)
        .join(Permission, RolePermission.permission_id == Permission.id)
        .filter(
            RolePermission.role_id == role.id,
            RolePermission.loa_status == loa.status,
            Permission.code == 'delete',
        )
        .first()
    )

    if not has_delete:
        raise HTTPException(
            status_code=403,
            detail=f"You don't have delete permission for LOAs in status '{loa.status}'.",
        )

    # Non-admin users can only delete their own LOAs
    if not role.can_override_lock and loa.requestor_email != user.email:
        raise HTTPException(
            status_code=403,
            detail="You can only delete your own LOAs.",
        )

    db.delete(loa)
    db.commit()
    return {"deleted": True, "loa_id": loa_id}



# ── PPT download ────────────────────────────────────────────────────────

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


# ── AI endpoints ────────────────────────────────────────────────────────

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
        raise HTTPException(
            status_code=400,
            detail=f"Maximum 2 photos per LOA. {len(existing)} already exist: {', '.join(existing)}. Delete existing photos first via DELETE /loa/{loa_id}/photos/1 or /2."
        )

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
            ext = f.rsplit(".", 1)[-1].lower()
            media_type = {
                "jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png",
            }.get(ext, "application/octet-stream")
            return FileResponse(os.path.join(UPLOAD_DIR, f), media_type=media_type)
    raise HTTPException(status_code=404, detail="Photo not found")


@router.delete("/{loa_id}/photos/{index}")
async def delete_photo(loa_id: str, index: int):
    for f in os.listdir(UPLOAD_DIR):
        if f.startswith(f"{loa_id}_photo{index}"):
            os.remove(os.path.join(UPLOAD_DIR, f))
            return {"deleted": True}
    raise HTTPException(status_code=404, detail="Photo not found")
