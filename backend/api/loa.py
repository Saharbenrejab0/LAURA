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


# Where does a LOA go when rejected at each step?
REJECT_DESTINATIONS = {
    "emea_review":              "draft",                # back to marketer
    "global_brand_review":      "emea_review",          # EMEA fixes brand feedback
    "emea_brand_rework":        "draft",                # EMEA sends back to marketer
    "global_functions_review":  "emea_brand_rework",    # EMEA fixes functions feedback
    "emea_functions_rework":    "draft",                # EMEA sends back to marketer
    "cmo_cfo_review":           "emea_functions_rework", # EMEA handles CMO/CFO feedback
    "corporate_review":         "emea_functions_rework", # EMEA handles corporate feedback
}
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


# ── Workflow state machine ──────────────────────────────────────────────
WORKFLOW_TRANSITIONS = {
    "emea_review":             "global_brand_review",
    "global_brand_review":           "cmo_cfo_review",
    "cmo_cfo_review":          "global_functions_review",
    "global_functions_review": "corporate_review",
    "corporate_review":        "approved",
}

VALIDATION_STATUSES = {"cmo_cfo_review", "corporate_review"}

ADVANCE_PHASE_STATUSES = {
    "emea_review", "global_brand_review", "global_functions_review",
}


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

# ─────────────────────────────────────────────────────────────────────────────
# Sprint 5 — Skip helper for orphan workflow steps
# ─────────────────────────────────────────────────────────────────────────────
# If a LOA reaches global_review or global_functions_review but no active
# reviewer is assigned for its brand/category, we skip the step automatically
# instead of letting the LOA hang forever.

def _has_reviewer_for_step(loa: LOA, target_status: str, db: Session) -> bool:
    """
    Returns True if at least one active user has comment rights at
    `target_status` AND a scope matching this LOA. False otherwise.
    """
    from backend.models.role import Role, RolePermission
    from backend.models.permission import Permission

    # Find all roles with `comment` permission at the target status.
    comment_perm = db.query(Permission).filter(Permission.code == "comment").first()
    if not comment_perm:
        return True  # safety: if permission system is misconfigured, do not skip

    roles_with_comment = (
        db.query(Role)
        .join(RolePermission, RolePermission.role_id == Role.id)
        .filter(RolePermission.permission_id == comment_perm.id)
        .filter(RolePermission.status == target_status)
        .all()
    )

    if not roles_with_comment:
        return False

    # For each candidate role, check if at least one user fits the LOA's scope
    for role in roles_with_comment:
        users_in_role = db.query(User).filter(User.role_id == role.id).all()
        if not users_in_role:
            continue

        # Scope check:
        #   - "all" scope → any user matches
        #   - "brand" scope → user.role.scope_value must include the LOA's brand
        #   - "function" scope → user.role.scope_value must include a LOA category
        #   - "cluster" scope → user.role.scope_value must include the LOA's cluster
        scope_type = role.scope_type
        scope_values = role.scope_value or []

        if scope_type == "all":
            return True

        if scope_type == "brand" and loa.brand:
            if any(loa.brand.lower() in (sv or "").lower() or (sv or "").lower() in loa.brand.lower() for sv in scope_values):
                return True

        if scope_type == "function" and loa.category:
            cats = loa.category if isinstance(loa.category, list) else [loa.category]
            for cat in cats:
                if any((cat or "").lower() in (sv or "").lower() or (sv or "").lower() in (cat or "").lower() for sv in scope_values):
                    return True

        if scope_type == "cluster" and loa.cluster:
            if any(loa.cluster.lower() == (sv or "").lower() for sv in scope_values):
                return True

    return False


# Status steps that we may skip if no reviewer is available
SKIPPABLE_STATUSES = {"global_brand_review", "global_functions_review"}


def _resolve_next_status(loa: LOA, current_status: str, db: Session) -> tuple[str, list[str]]:
    """
    Compute the next status, skipping orphan steps.
    Returns (final_status, list_of_skipped_steps).
    """
    skipped: list[str] = []
    next_status = WORKFLOW_TRANSITIONS.get(current_status)

    while next_status in SKIPPABLE_STATUSES:
        if _has_reviewer_for_step(loa, next_status, db):
            break  # someone can review here, stop and use this status
        skipped.append(next_status)
        next_status = WORKFLOW_TRANSITIONS.get(next_status)
        if next_status is None:
            break

    return next_status or "approved", skipped
# ════════════════════════════════════════════════════════════════════════
# ROUTES — order matters: /export/* BEFORE /{loa_id} to avoid UUID parse
# ════════════════════════════════════════════════════════════════════════

@router.get("")
async def get_loas(
    status: Optional[str] = None,
    cluster: Optional[str] = None,
    include_historical: bool = False,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = db.query(LOA)

    if not include_historical:
        query = query.filter(LOA.is_demo == True)

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

    return query.all()


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

    query = db.query(LOA).filter(LOA.is_demo == True)
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

    return loa


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
    return loa


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


# ── Workflow validation / advance ───────────────────────────────────────

def _check_workflow_permission(user: User, loa: LOA, db: Session) -> str:
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

    permission_used = _check_workflow_permission(user, loa, db)

    # Double validation for CMO/CFO step
    if current_status == "cmo_cfo_review":
        role = user.role_obj
        role_code = role.code if role else ""

        if role_code == "regional_cmo":
            loa.cmo_approved = True
        elif role_code == "regional_cfo":
            loa.cfo_approved = True
        else:
            loa.cmo_approved = True
            loa.cfo_approved = True

        if loa.cmo_approved and loa.cfo_approved:
            new_status = WORKFLOW_TRANSITIONS[current_status]
            skipped = []
            loa.status = new_status
        else:
            db.commit()
            db.refresh(loa)
            return loa
    else:
        new_status = WORKFLOW_TRANSITIONS[current_status]
        skipped = []
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
        "skipped_steps": skipped,
        "validated_by": user.email,
        "permission_used": permission_used,
        "activity_type": loa.activity_type,
        "country": loa.country,
        "fy_total": loa.fy_2026_total,
    })

    # When approved, fire a separate event for n8n to regenerate Excel
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


# ── Reject ──────────────────────────────────────────────────────────────

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

    _check_workflow_permission(user, loa, db)

    previous_status = loa.status
    loa.status = REJECT_DESTINATIONS.get(loa.status, "draft")
    loa.rejection_reason = reason.strip()
    loa.cmo_approved = False
    loa.cfo_approved = False
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


# ── Comment ─────────────────────────────────────────────────────────────

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
        raise HTTPException(status_code=403, detail="No access at this stage.")

    perm_code = rp[1].code
    if perm_code not in ('comment', 'validate', 'edit', 'advance_phase'):
        raise HTTPException(status_code=403, detail="You need at least comment permission.")

    timestamp = datetime.utcnow().strftime("%d %b %Y %H:%M")
    entry = f"[{timestamp}] {user.email}:\n{body.comment.strip()}"

    if loa.cmo_comment:
        loa.cmo_comment = f"{loa.cmo_comment}\n\n---\n\n{entry}"
    else:
        loa.cmo_comment = entry

    db.commit()
    db.refresh(loa)
    return {"status": "ok", "comment_added": entry}


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


# ── Delete ──────────────────────────────────────────────────────────────

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
    is_author = loa.requestor_email == user.email
    is_admin = role and role.can_override_lock

    if not is_author and not is_admin:
        raise HTTPException(status_code=403, detail="Only the author or a super-admin can delete a LOA.")

    if loa.status != "draft":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete a LOA in status '{loa.status}'. Only drafts can be deleted — submitted LOAs must be rejected instead.",
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
