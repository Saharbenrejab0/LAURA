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
from pydantic import BaseModel, field_validator, model_validator
from typing import Optional
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import or_ as sa_or_
import uuid
import httpx
import os
import shutil

from backend.models.database import get_db
from backend.models.loa import (
    LOA, LOALine, LOAStatus,
    LOA_TYPES, MIN_LOA_LINES, MAX_LOA_LINES,
    LOA_TYPE_STANDARD, LOA_TYPE_MULTI_BRAND, LOA_TYPE_MULTI_ACTIVITY,
)
from backend.engines.loa_display import compute_display_title
from backend.api.ordering import newest_first


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
    normalise_activity_type,
    is_valid_cluster,
    is_valid_country,
    is_valid_activity_type,
)
from backend.models.user import User
from backend.models.role import Role
from backend.models.comment import Comment
from backend.models.review import LOAReviewStage, ALIGNMENT_STAGES
from backend.api.auth import get_current_user
from backend.api.permission_middleware import require_permission
from backend.models.loa import SOURCE_LAURA_CREATED
from backend.models.loa_cycle import LoaCycle
from backend.services.cycle_service import (
    resolve_cycle_for_new_loa, assert_cycle_open_for_writes,
    assert_cycle_accepts_submissions, can_view_cycle, hidden_cycle_ids,
)

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

class LOALineIn(BaseModel):
    """One per-brand / per-activity row on a multi-row LOA."""
    position: int = 0
    # Exactly one axis is set — brand for multi_brand, activity_type for multi_activity.
    brand: Optional[str] = None
    activity_type: Optional[str] = None

    customer: Optional[str] = None
    vendor: Optional[str] = None
    detail: Optional[str] = None
    num_doors: Optional[int] = None
    cost_drill_down: Optional[str] = None

    q4_2025: float = 0
    q1_2026: float = 0
    q2_2026: float = 0
    q3_2026: float = 0
    q4_2026: float = 0


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
    # LAURA is a single-currency product going forward: anything created here is
    # in euros. Historical imports still hold CHF and GBP and are deliberately
    # left alone — they are a separate re-import decision — but nothing new joins
    # them, because every total in the product adds currencies blind.
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
    # LOA cycles — set only when a marketer opens an emergency LOA from the
    # tracker's emergency window (both default to a normal, non-emergency LOA).
    is_emergency: bool = False
    cycle_id: Optional[str] = None

    # Multi-row shape. 'standard' keeps today's single-row behaviour and ignores `lines`.
    loa_type: str = LOA_TYPE_STANDARD
    lines: list[LOALineIn] = []

    @field_validator("loa_type")
    @classmethod
    def validate_loa_type(cls, v: str):
        if v and v not in LOA_TYPES:
            raise ValueError(f"Invalid loa_type '{v}'. Allowed: {LOA_TYPES}")
        return v or LOA_TYPE_STANDARD

    @model_validator(mode="after")
    def validate_multi_shape(self):
        """A multi-row LOA needs 2-12 lines, each carrying the right axis."""
        if self.loa_type == LOA_TYPE_STANDARD:
            self.lines = []
            return self

        n = len(self.lines)
        if n < MIN_LOA_LINES:
            raise ValueError(
                f"A {self.loa_type} LOA needs at least {MIN_LOA_LINES} rows (got {n})."
            )
        if n > MAX_LOA_LINES:
            raise ValueError(
                f"A {self.loa_type} LOA allows at most {MAX_LOA_LINES} rows (got {n})."
            )

        if self.loa_type == LOA_TYPE_MULTI_BRAND:
            for i, ln in enumerate(self.lines):
                if not (ln.brand or "").strip():
                    raise ValueError(f"Row {i + 1}: brand is required on a multi-brand LOA.")
                ln.activity_type = None
            seen = [ln.brand for ln in self.lines]
            dupes = {b for b in seen if seen.count(b) > 1}
            if dupes:
                raise ValueError(f"Duplicate brands across rows: {', '.join(sorted(dupes))}")

        if self.loa_type == LOA_TYPE_MULTI_ACTIVITY:
            for i, ln in enumerate(self.lines):
                at = (ln.activity_type or "").strip()
                if not at:
                    raise ValueError(f"Row {i + 1}: activity_type is required on a multi-activity LOA.")
                if at not in ACTIVITY_TYPES:
                    raise ValueError(f"Row {i + 1}: invalid activity_type '{at}'.")
                ln.brand = None
            seen = [ln.activity_type for ln in self.lines]
            dupes = {a for a in seen if seen.count(a) > 1}
            if dupes:
                raise ValueError(f"Duplicate activity types across rows: {', '.join(sorted(dupes))}")

        return self

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
        if not v:
            return v
        if not is_valid_activity_type(v):
            raise ValueError(f"Invalid activity_type '{v}'. Allowed: {ACTIVITY_TYPES}")
        # Store the code, whatever spelling arrived — see reference_data.
        return normalise_activity_type(v)

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, v: str):
        """Everything created in LAURA is in euros.

        Accepts the spellings the old importers produced ('euro', '€', …) and
        normalises them, so a client sending a legacy value is corrected rather
        than rejected. Anything genuinely other than euro is refused: the pivot,
        the workbook and the deck all sum `fy_2026_total` without conversion, so
        one CHF row makes every total above it quietly wrong.
        """
        if v is None:
            return "EUR"
        if str(v).strip().lower() in ("eur", "euro", "€", "e"):
            return "EUR"
        raise ValueError(
            f"Invalid currency '{v}'. LOAs created in LAURA must be in EUR — "
            "every budget total is summed without conversion."
        )

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
    "local_alignment":         "emea_review",
    "emea_review":             "global_review",
    "global_review":           "emea_post_global_review",
    "emea_post_global_review": "cmo_cfo_review",
    "cmo_cfo_review":          "emea_final_review",
    "emea_final_review":       "corporate_review",
    "corporate_review":        "approved",
}

# Display order (used for rollback dropdown)
WORKFLOW_ORDER = [
    "draft", "local_alignment", "emea_review", "global_review", "emea_post_global_review",
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
        # On a multi-brand LOA the parent's brand is NULL and the brands live on
        # loa_line, so the scope must match either place or brand reviewers would
        # never see multi-brand LOAs at all.
        scope = role.scope_value or []
        query = query.filter(
            LOA.brand.in_(scope) | LOA.lines.any(LOALine.brand.in_(scope))
        )
    elif role.scope_type == 'function':
        # Same for multi-activity: activity_type is NULL on the parent.
        scope = role.scope_value or []
        query = query.filter(
            LOA.activity_type.in_(scope) | LOA.lines.any(LOALine.activity_type.in_(scope))
        )
    elif role.scope_type == 'all':
        pass
    elif role.scope_type == 'author_only':
        query = query.filter(LOA.requestor_email == user.email)

    # Emergency cycles are confidential to the people named on them. Enforced
    # here rather than at each call site so the list, the export and every other
    # consumer of the scope filter hide the same rows.
    hidden = hidden_cycle_ids(query.session, user)
    if hidden:
        query = query.filter(
            sa_or_(LOA.cycle_id.is_(None), LOA.cycle_id.notin_(hidden))
        )
    return query
# -- Parallel gate helpers (Rock 3) ----------------------------------------

def _has_brand_reviewer(loa: LOA, db: Session) -> bool:
    """Check if any global_brand_* role with active users matches this LOA's brand.

    A multi-brand LOA has brand=NULL on the parent, so every line brand counts —
    one matching brand is enough to keep the brand gate open.
    """
    from backend.models.role import Role
    brands = [loa.brand] if loa.brand else loa.line_axis_values()
    brands = [b for b in brands if b]
    if not brands:
        return False
    brand_roles = db.query(Role).filter(Role.scope_type == 'brand').all()
    for role in brand_roles:
        scope_values = role.scope_value or []
        if any(b in scope_values for b in brands):
            user_count = db.query(User).filter(User.role_id == role.id).count()
            if user_count > 0:
                return True
    return False


def _has_function_reviewer(loa: LOA, db: Session) -> bool:
    """Check if any global_function_* role with active users matches this LOA's activity_type.

    A multi-activity LOA has activity_type=NULL on the parent, so every line
    activity type counts.
    """
    from backend.models.role import Role
    types = [loa.activity_type] if loa.activity_type else loa.line_axis_values()
    types = [t for t in types if t]
    if not types:
        return False
    func_roles = db.query(Role).filter(Role.scope_type == 'function').all()
    for role in func_roles:
        scope_values = role.scope_value or []
        if any(t in scope_values for t in types):
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

def _has_local_role_reviewer(loa: LOA, db: Session, suffix: str) -> bool:
    """Check if a {cluster}_{suffix} role (finance/procurement/compliance)
    has at least one active user for this LOA's cluster.
    """
    from backend.models.role import Role
    if not loa.cluster:
        return False
    code = loa.cluster.lower().replace(' ', '_').replace('&', '').replace('__', '_') + f'_{suffix}'
    role = db.query(Role).filter(Role.code == code).first()
    if not role:
        return False
    return db.query(User).filter(User.role_id == role.id).count() > 0


def _compute_local_alignment_skip_flags(loa: LOA, db: Session) -> None:
    """Pre-mark finance/procurement/compliance done if no reviewer exists
    for this LOA's cluster (mirrors _compute_skip_flags for brand/function).
    """
    loa.finance_review_done = not _has_local_role_reviewer(loa, db, 'finance')
    loa.procurement_review_done = not _has_local_role_reviewer(loa, db, 'procurement')
    loa.compliance_review_done = not _has_local_role_reviewer(loa, db, 'compliance')


def _is_local_alignment_complete(loa: LOA) -> bool:
    """Check if finance + procurement + compliance gates are all satisfied."""
    return (loa.finance_review_done and loa.procurement_review_done
            and loa.compliance_review_done)

# ════════════════════════════════════════════════════════════════════════
# ROUTES — order matters: /export/* BEFORE /{loa_id} to avoid UUID parse
# ════════════════════════════════════════════════════════════════════════



def _get_loa_photos(loa_id: str) -> list[dict]:
    """List uploaded photos for a LOA from disk (not a DB column).
    Returns [{index, url}] sorted by index, matching what SlidePreview.tsx expects.
    """
    upload_dir = "uploads/loa_photos"
    if not os.path.isdir(upload_dir):
        return []
    matches = []
    for fname in os.listdir(upload_dir):
        if fname.startswith(f"{loa_id}_photo"):
            try:
                idx_part = fname.split("_photo")[1].split(".")[0]
                idx = int(idx_part)
            except (IndexError, ValueError):
                continue
            matches.append(idx)
    matches.sort()
    return [{"index": idx, "url": f"/loa/{loa_id}/photos/{idx}"} for idx in matches]


# can_* permission flags → flat action names exposed on the LOA response.
_ACTION_FLAGS = [
    ("view", "can_view"),
    ("comment", "can_comment"),
    ("edit", "can_edit"),
    ("validate", "can_validate"),
    ("delete", "can_delete"),
    ("duplicate", "can_duplicate"),
]


def _serialize_line(ln: LOALine) -> dict:
    return {
        "id":                      str(ln.id),
        "position":                ln.position,
        "brand":                   ln.brand,
        "activity_type":           ln.activity_type,
        "customer":                ln.customer,
        "vendor":                  ln.vendor,
        "detail":                  ln.detail,
        "num_doors":               ln.num_doors,
        "avg_investment_per_door": ln.avg_investment_per_door,
        "cost_drill_down":         ln.cost_drill_down,
        "q4_2025":                 ln.q4_2025,
        "q1_2026":                 ln.q1_2026,
        "q2_2026":                 ln.q2_2026,
        "q3_2026":                 ln.q3_2026,
        "q4_2026":                 ln.q4_2026,
        "fy_2026_total":           ln.fy_2026_total,
    }


def _sync_lines(loa: LOA, lines: list[LOALineIn]) -> None:
    """
    Replace the LOA's child rows with `lines`, in order.

    Full replace rather than diff-merge: rows are reorderable and deletable in
    the form, so positional identity is not stable enough to patch in place.
    delete-orphan on the relationship removes the old rows.
    """
    loa.lines.clear()
    for i, src in enumerate(lines):
        loa.lines.append(LOALine(
            position=i,
            brand=src.brand,
            activity_type=src.activity_type,
            customer=src.customer,
            vendor=src.vendor,
            detail=src.detail,
            num_doors=src.num_doors,
            cost_drill_down=src.cost_drill_down,
            q4_2025=src.q4_2025 or 0,
            q1_2026=src.q1_2026 or 0,
            q2_2026=src.q2_2026 or 0,
            q3_2026=src.q3_2026 or 0,
            q4_2026=src.q4_2026 or 0,
        ))


def _apply_axis_nulls(loa: LOA) -> None:
    """
    Enforce the ck_loas_axis_by_type invariant: the axis that varies per line is
    NULL on the parent, the shared axis stays set.
    """
    if loa.loa_type == LOA_TYPE_MULTI_BRAND:
        loa.brand = None
    elif loa.loa_type == LOA_TYPE_MULTI_ACTIVITY:
        loa.activity_type = None


def _with_display_title(loa, user=None, db=None):
    """Serialize an ORM LOA to dict + inject display_title + photos + actions."""
    if loa is None:
        return None
    data = {c.name: getattr(loa, c.name) for c in loa.__table__.columns}
    data["display_title"] = compute_display_title(loa)
    data["photos"] = _get_loa_photos(str(loa.id))
    data["lines"] = [_serialize_line(ln) for ln in loa.lines]
    data["available_actions"] = []
    # Map the current user's effective permissions on this LOA to a flat action
    # list. Anonymous/public (no user or db context) → stays an empty list.
    if user is not None and db is not None:
        try:
            from backend.api.permissions import compute_permissions
            perms = compute_permissions(user, loa, db)
            data["available_actions"] = [a for a, flag in _ACTION_FLAGS if perms.get(flag)]
        except Exception:
            pass
    return data

@router.get("")
async def get_loas(
    status: Optional[str] = None,
    cluster: Optional[str] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = db.query(LOA)

    # No source/is_demo filter here on purpose: the tracker returns every LOA in
    # the caller's scope and decides what to show client-side. An earlier
    # is_demo filter here hid real user-created LOAs, and the `include_historical`
    # parameter that used to drive it was left accepted-but-ignored for a while —
    # both are gone. `loas.source` is the classifier, wherever the choice is made.

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

    query = newest_first(query, LOA)

    return [_with_display_title(loa, user, db) for loa in query.all()]


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

    fields = body.model_dump()
    # Neither the cycle nor the provenance is chosen by the submitter. An LOA
    # belongs to whichever window was open when it was created, and anything
    # created here is by definition a real submission.
    fields.pop("cycle_id", None)
    fields.pop("source", None)
    fields.pop("import_batch_id", None)
    # Child rows are attached via the relationship, not as a column kwarg.
    fields.pop("lines", None)
    cycle = resolve_cycle_for_new_loa(db, is_emergency=bool(fields.get("is_emergency")))

    loa = LOA(
        id=loa_id,
        loa_draft_id=draft_id,
        status="draft",
        is_demo=True,
        cycle_id=cycle.id,
        source=SOURCE_LAURA_CREATED,
        **fields,
    )
    if body.lines:
        _sync_lines(loa, body.lines)
    _apply_axis_nulls(loa)
    loa.calculate_totals()
    db.add(loa)
    db.commit()
    db.refresh(loa)
    return _with_display_title(loa)


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

    # An emergency LOA is invisible to anyone not named on its cycle — 404, not
    # 403, so the response cannot confirm that the record exists.
    if loa.cycle_id is not None:
        cycle = db.query(LoaCycle).filter(LoaCycle.id == loa.cycle_id).first()
        if cycle is not None and not can_view_cycle(cycle, user):
            raise HTTPException(status_code=404, detail="LOA not found")

    if not role.can_override_lock:
        if loa.status == 'draft' and loa.requestor_email != user.email:
            raise HTTPException(status_code=403, detail="Draft is private to its author")
        if not role.matches_loa(loa):
            raise HTTPException(status_code=403, detail="LOA outside your scope")

    return _with_display_title(loa, user, db)


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

    # A closed cycle is an archive — nothing inside it changes again.
    assert_cycle_open_for_writes(db, loa.cycle_id, action="edited")

    updates = body.model_dump(exclude_unset=True)
    # cycle_id is set once, at creation. An LOA belongs to its cycle forever.
    updates.pop("cycle_id", None)
    # Child rows go through _sync_lines, not setattr.
    lines_update = updates.pop("lines", None)
    for field, value in updates.items():
        setattr(loa, field, value)

    if lines_update is not None:
        _sync_lines(loa, body.lines)
    _apply_axis_nulls(loa)
    loa.calculate_totals()
    db.commit()
    db.refresh(loa)
    return _with_display_title(loa, user, db)


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

    # A closed cycle is an archive — nothing inside it changes again.
    assert_cycle_open_for_writes(db, loa.cycle_id, action="submitted")

    if loa.requestor_email != user.email:
        raise HTTPException(
            status_code=403,
            detail="Only the LOA author can submit or resubmit it.",
        )

    if loa.status == "draft":
        new_status = "local_alignment"
        event_name = "loa_submitted"
    elif loa.status == "rejected":
        # Legacy path: rejected goes back to emea_review (skips local_alignment)
        new_status = "emea_review"
        event_name = "loa_resubmitted"
    elif loa.status == "returned":
        # EMEA returned it to the marketer → full restart at local_alignment
        new_status = "local_alignment"
        event_name = "loa_resubmitted"
    else:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot submit a LOA in status '{loa.status}'. "
                   f"Only 'draft', 'rejected', or 'returned' LOAs can be submitted.",
        )

    # Drafting stays possible outside the window; entering the chain does not.
    assert_cycle_accepts_submissions(db, loa.cycle_id)

    issues = loa.validate()
    errors = [i for i in issues if i["type"] == "error"]
    if errors:
        raise HTTPException(status_code=422, detail={"validation_errors": errors})

    loa.status = new_status
    if loa.status == "local_alignment":
        _compute_local_alignment_skip_flags(loa, db)
        if _is_local_alignment_complete(loa):
            loa.status = "emea_review"

        # Create 3 alignment review stage rows (idempotent — skip if already present)
        existing_stages = {
            r.stage for r in db.query(LOAReviewStage).filter_by(loa_id=str(loa_id)).all()
        }
        for stage in ALIGNMENT_STAGES:
            if stage not in existing_stages:
                db.add(LOAReviewStage(loa_id=str(loa_id), stage=stage, status="pending"))

    loa.submitted_at = datetime.utcnow()
    if event_name == "loa_resubmitted":
        loa.rejection_reason  = None
        loa.rejected_by_stage = None
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

    # A closed cycle is an archive — nothing inside it changes again.
    assert_cycle_open_for_writes(db, loa.cycle_id, action="advanced")

    if loa.is_locked:
        raise HTTPException(status_code=423, detail="LOA is locked by a super-admin.")

    current_status = loa.status

    if current_status not in WORKFLOW_TRANSITIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot advance a LOA in status '{current_status}'.",
        )

    skipped = []

    # -- global_review parallel gate (brand + function) --
    # A reviewer explicitly submitting their review flips ONLY their own side.
    # The LOA advances only once BOTH brand and function are done (or skipped).
    # (Previously this happened as a side-effect of commenting — now it requires
    # an explicit submit, so one reviewer can never advance it alone.)
    if current_status == "global_review":
        from backend.api.permissions import compute_permissions
        role = user.role_obj
        perms = compute_permissions(user, loa, db)
        if not (perms.get("can_validate") or perms.get("can_comment")):
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to submit a review at this stage.",
            )
        if role and role.scope_type == "brand":
            loa.brand_review_done = True
        elif role and role.scope_type == "function":
            loa.function_review_done = True
        elif role and role.can_override_lock:
            # Super-admin: complete both sides.
            loa.brand_review_done = True
            loa.function_review_done = True
        permission_used = "validate"
        if _is_global_review_complete(loa):
            loa.status = WORKFLOW_TRANSITIONS[current_status]
        else:
            # This side done, still waiting on the other reviewer.
            db.commit()
            db.refresh(loa)
            return loa

    # -- local_alignment gate (finance + procurement + compliance) --
    elif current_status == "local_alignment":
        from backend.api.permissions import compute_permissions
        role = user.role_obj
        perms = compute_permissions(user, loa, db)
        if not (perms.get("can_validate") or perms.get("can_comment")):
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to submit a review at this stage.",
            )
        role_code = (role.code if role else "") or ""
        if role_code.endswith("_finance"):
            loa.finance_review_done = True
        elif role_code.endswith("_procurement"):
            loa.procurement_review_done = True
        elif role_code.endswith("_compliance"):
            loa.compliance_review_done = True
        elif role and role.can_override_lock:
            loa.finance_review_done = True
            loa.procurement_review_done = True
            loa.compliance_review_done = True
        permission_used = "validate"
        if _is_local_alignment_complete(loa):
            loa.status = WORKFLOW_TRANSITIONS[current_status]
        else:
            db.commit()
            db.refresh(loa)
            return loa

    # -- CMO/CFO parallel gate --
    elif current_status == "cmo_cfo_review":
        permission_used = _check_workflow_permission(user, loa, db)
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
        permission_used = _check_workflow_permission(user, loa, db)
        _compute_skip_flags(loa, db)
        if loa.brand_review_done and loa.function_review_done:
            # Both skipped -> jump past global_review
            loa.status = "emea_post_global_review"
            skipped.append("global_review")
        else:
            loa.status = "global_review"

    # -- All other steps: linear advance --
    else:
        permission_used = _check_workflow_permission(user, loa, db)
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


# Stages where EMEA (advance_phase) acts and needs to choose edit vs. return
_EMEA_STAGES = frozenset({"emea_review", "emea_post_global_review", "emea_final_review"})

# Stages that auto-route a rejection to emea_final_review
_AUTO_ROUTE_TO_EMEA_FINAL = frozenset({"cmo_cfo_review", "corporate_review"})


def _reset_all_gates(loa: LOA) -> None:
    """Full gate reset. Called whenever a LOA returns to marketer (re-enters local_alignment)."""
    loa.cmo_approved             = False
    loa.cfo_approved             = False
    loa.brand_review_done        = False
    loa.function_review_done     = False
    loa.brand_review_skipped     = False
    loa.function_review_skipped  = False
    loa.finance_review_done      = False
    loa.procurement_review_done  = False
    loa.compliance_review_done   = False


class RejectRequest(BaseModel):
    reason: str
    # Required when rejecting at an EMEA stage. One of:
    #   "edit_myself"        — EMEA edits the LOA inline; status stays at current EMEA stage.
    #   "return_to_marketer" — LOA goes to `returned`; marketer re-edits and restarts chain.
    # Ignored (and not required) for cmo_cfo_review / corporate_review rejections.
    choice: str | None = None


@router.post("/{loa_id}/reject")
async def reject_loa(
    loa_id: str,
    body: RejectRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Reject a LOA. Routing depends on the current stage:

    EMEA stages (emea_review / emea_post_global_review / emea_final_review):
      → body.choice == "edit_myself":
            Status unchanged. EMEA edits the LOA form and then re-approves.
      → body.choice == "return_to_marketer":
            Status → `returned`. All gates reset. Marketer re-submits → local_alignment.

    cmo_cfo_review or corporate_review:
      → Status → `emea_final_review`. CMO/CFO gate flags reset.
         EMEA sees the rejection reason and then chooses edit or return.

    No other stages permit reject (permission check enforces this).
    """
    loa = db.query(LOA).filter(LOA.id == loa_id).first()
    if not loa:
        raise HTTPException(status_code=404, detail="LOA not found")

    # A closed cycle is an archive — nothing inside it changes again.
    assert_cycle_open_for_writes(db, loa.cycle_id, action="rejected")

    if loa.is_locked:
        raise HTTPException(status_code=423, detail="LOA is locked by a super-admin.")

    reason = (body.reason or "").strip()
    if not reason:
        raise HTTPException(status_code=422, detail="A non-empty reason is required.")

    if loa.status in ("draft", "approved", "returned", "rejected"):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot reject a LOA in status '{loa.status}'.",
        )

    _check_workflow_permission(user, loa, db)

    previous_status = loa.status

    # Who gets to choose what happens next, rather than having it routed for
    # them: the EMEA stages, and the super-admins (Thibault, Vanessa, Sandrine).
    # An admin rejecting anywhere in the chain is the person who then has to
    # deal with it, so they pick — fix it here, or send it back to the marketer.
    actor_is_admin = user.role_obj is not None and bool(user.role_obj.can_override_lock)
    offers_choice = actor_is_admin or previous_status in _EMEA_STAGES

    if offers_choice:
        choice = body.choice
        if choice not in ("edit_myself", "return_to_marketer"):
            raise HTTPException(
                status_code=422,
                detail="This rejection requires choice: 'edit_myself' or 'return_to_marketer'.",
            )
        loa.rejection_reason  = reason
        loa.rejected_by_stage = previous_status

        if choice == "edit_myself":
            # Status stays at the current EMEA stage. EMEA edits inline then re-approves.
            db.commit()
            db.refresh(loa)
            await notify_n8n("loa_rejected", str(loa_id), {
                "requestor_email":      loa.requestor_email,
                "loa_draft_id":         loa.loa_draft_id,
                "rejected_by":          user.email,
                "rejected_from_status": previous_status,
                "choice":               "edit_myself",
                "reason":               reason,
            })
            return loa

        # return_to_marketer
        loa.status = "returned"
        _reset_all_gates(loa)

    elif previous_status in _AUTO_ROUTE_TO_EMEA_FINAL:
        # CMO, CFO, or Corporate Finance rejected → EMEA decides next step
        loa.status            = "emea_final_review"
        loa.rejection_reason  = reason
        loa.rejected_by_stage = previous_status
        # Reset whichever parallel gate was open
        loa.cmo_approved      = False
        loa.cfo_approved      = False

    else:
        # Fallback for any other actionable stage (shouldn't normally reach here
        # given the permission matrix, but keep behaviour deterministic)
        loa.status            = "rejected"
        loa.rejection_reason  = reason
        loa.rejected_by_stage = previous_status
        _reset_all_gates(loa)

    db.commit()
    db.refresh(loa)

    await notify_n8n("loa_rejected", str(loa_id), {
        "requestor_email":      loa.requestor_email,
        "loa_draft_id":         loa.loa_draft_id,
        "rejected_by":          user.email,
        "rejected_from_status": previous_status,
        "new_status":           loa.status,
        "choice":               body.choice,
        "reason":               reason,
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

    # A closed cycle is an archive — nothing inside it changes again.
    assert_cycle_open_for_writes(db, loa.cycle_id, action="commented on")

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

    # Adding a comment NEVER advances the workflow. The reviewer stays in the
    # current stage and moves the LOA only by explicitly submitting their review
    # via POST /{loa_id}/validate. Gate flags are intentionally left untouched.
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

    # A closed cycle is an archive — nothing inside it changes again.
    assert_cycle_open_for_writes(db, loa.cycle_id, action="locked")

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

    # A closed cycle is an archive — nothing inside it changes again.
    assert_cycle_open_for_writes(db, loa.cycle_id, action="unlocked")

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

    # A closed cycle is an archive — nothing inside it changes again.
    assert_cycle_open_for_writes(db, loa.cycle_id, action="deleted")

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

    # A closed cycle is an archive — nothing inside it changes again.
    assert_cycle_open_for_writes(db, loa.cycle_id, action="modified")

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
async def delete_photo(loa_id: str, index: int, db: Session = Depends(get_db)):
    # NOTE: this endpoint has no auth dependency — it deletes a file off disk
    # for any caller who knows the LOA id. Left as-is (changing it is a separate
    # decision), but it now at least refuses to strip photos off an archived
    # cycle. The `db` session exists only for that check.
    loa = db.query(LOA).filter(LOA.id == loa_id).first()
    if loa is not None:
        assert_cycle_open_for_writes(db, loa.cycle_id, action="modified")

    for f in os.listdir(UPLOAD_DIR):
        if f.startswith(f"{loa_id}_photo{index}"):
            os.remove(os.path.join(UPLOAD_DIR, f))
            return {"deleted": True}
    raise HTTPException(status_code=404, detail="Photo not found")
