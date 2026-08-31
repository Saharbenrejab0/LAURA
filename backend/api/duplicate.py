"""
LAURA - LOA duplicate / "Use as template"  (rewrite, June 2026)

POST /loa/{loa_id}/duplicate
    Creates a new editable draft from ANY source LOA (historical or live).
    The result belongs to the caller, regardless of who authored the source.

Why this rewrite:
    The previous implementation copied requestor_email from the source LOA.
    That broke editing for marketers because permissions.compute_permissions
    treats requestor_email as the source of truth for draft authorship:

        if loa.status == 'draft':
            if not result['is_author']:   # is_author = requestor_email match
                return result             # zero permissions -> no Edit

    A duplicate must therefore explicitly re-attribute requestor_email to the
    caller. Status is forced to 'draft'. is_demo is never inherited (it was
    only meant to mark ETL seeds). duplicated_from_id keeps the audit trail.

    The mapping + sanitization layer is preserved and extracted to pure
    helpers so it can be unit-tested without a DB.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.api.auth import get_current_user
from backend.models.database import get_db
from backend.models.loa import LOA, LOALine
from backend.models.user import User
from backend.reference_data import (
    ACTIVITY_TYPES, ADV_SELLING, CAPEX_OPEX, CATEGORIES,
    CLUSTERS, COT_OPTIONS, EVENT_PURPOSES, EVENT_TYPES,
    activity_label, normalise_activity_type,
)

router = APIRouter()


# ---------------------------------------------------------------------------
# Legacy value mappings (kept identical to v1 - this is the source of truth
# for normalizing the 1332 historical LOAs)
# ---------------------------------------------------------------------------

# ── Activity type ────────────────────────────────────────────────────────────
#
# This used to be a dict mapping CODE -> LABEL ("TM_SEASONAL" ->
# "Seasonal Visibility"), which is backwards: `activity_type` stores the code.
# Every duplicate would have rewritten a perfectly valid code into a display
# label that `POST /loa` rejects. It never fired in production (no row has
# `duplicated_from_id`), so no data was corrupted — but the first real use of
# "Use as starting point" would have been.
#
# `normalise_activity_type()` in reference_data already resolves codes and the
# 14 Title Case labels. Verified against every distinct `activity_type` value in
# the database: it handles 27 of 35. This map covers only the 8 it cannot, and
# every value on the right is a CANONICAL CODE.
LEGACY_ACTIVITY_CODES: dict[str, str] = {
    # Old `models.loa.ActivityType` enum member names, from before codes were
    # the stored form. Not present in current data; kept so an old payload or a
    # re-import of an old export still resolves.
    "coop_adv":         "COOP_ADVERTISING",
    "other_adv":        "OTHER_ADVERTISING",
    "catalogues":       "CATALOGUES_BROCHURES",
    "medical":          "MEDICAL_AFFAIRS",
    "others_non_adv":   "OTHER",
    # The client's original spreadsheet wording for the two Tailor Made lines.
    "tailor made seasonal":   "TM_SEASONAL",
    "tailor made permanent":  "TM_PERMANENT",
    "tailored made seasonal":  "TM_SEASONAL",
    "tailored made permanent": "TM_PERMANENT",
    # A typo that reached the database on 3 historical rows. Left in the data
    # deliberately (the audit did not rewrite history); resolved on the way out.
    "in-store/ consummer activation": "IN_STORE",
    "in-store/ consumer activation":  "IN_STORE",
}

COT_MAP: dict[str, str] = {
    "All customers": "All COT",
    "all cot":       "All COT",
}


# Fields the duplicate must NEVER inherit from the source.
# Identity, ownership, lifecycle, computed totals.
_NEVER_COPY = frozenset({
    "id", "loa_number", "loa_draft_id",
    "requestor_email",          # re-assigned to the caller explicitly
    "cycle_id",                 # a duplicate is a new draft in the OPEN cycle,
                                # never the source's (possibly closed) one
    "source",                   # duplicating history produces a LIVE draft
    "import_batch_id",          # ...which belongs to no import batch
    "source_file",              # and carries no historical filename
    "status", "is_demo", "is_locked",
    "submitted_at", "approved_at", "created_at", "updated_at",
    "cmo_approved", "cfo_approved", "cmo_comment", "rejection_reason",
    "brand_review_deadline",
    "ai_suggestion_used", "ai_suggestion_log_id",
    "fy_2025_total", "fy_2026_total", "avg_investment_per_door",
    "ppt_slide_required",
})

# Fields cleared because they don't translate to a new request.
_RESET_TO_NONE = frozenset({"start_date", "end_date"})

# Fields whose absence blocks submission - surfaced as warnings.
_REQUIRED_FOR_SUBMIT: dict[str, str] = {
    "description": "Description (WHY) is empty - required before submission.",
    "detail":      "Detail / Tools (HOW) is empty - required before submission.",
    "kpi":         "KPI is empty - required before submission.",
}



# Columns that are NOT NULL in `loas`. Clearing an unrecognised value on one of
# these must write "" (or [] for the array), not None — the insert would fail
# the not-null constraint and the whole duplicate would 500.
#
# This is exactly what happened the first time the endpoint was ever called:
# 502 of the 2,657 historical rows carry a cluster the current list rejects
# ("META", "EMEA", "South Europe"), so `_sanitize_field` correctly returned None
# for them and Postgres refused the insert. An empty string is what the form
# already renders as "nothing selected", so the marketer sees an empty required
# dropdown with the reason underneath — which is the intent.
_NOT_NULL_TEXT = frozenset({"cluster", "country", "cot"})
_NOT_NULL_LIST = frozenset({"category"})


def _cleared_value(name: str):
    """What "no usable value" looks like for this column."""
    if name in _NOT_NULL_LIST:
        return []
    if name in _NOT_NULL_TEXT:
        return ""
    return None

# ---------------------------------------------------------------------------
# Pure sanitization helpers (no DB, no FastAPI - unit-testable in isolation)
# ---------------------------------------------------------------------------

def _sanitize_field(name: str, value: Any, warnings: list[dict]) -> Any:
    """Map legacy values to current reference_data; flag what can't be saved."""
    if value is None or value == "" or value == []:
        return value

    if name == "activity_type":
        # Already a canonical code (the common case, and the only case for a
        # completed-cycle LOA) — pass it straight through, unflagged.
        if value in ACTIVITY_TYPES:
            return value

        # Otherwise resolve to a code: reference_data's aliases first, then the
        # legacy spellings it does not know about.
        resolved = normalise_activity_type(value)
        if resolved not in ACTIVITY_TYPES:
            resolved = LEGACY_ACTIVITY_CODES.get(str(value).strip().lower())

        if resolved in ACTIVITY_TYPES:
            warnings.append({
                "field": name, "severity": "auto_fixed",
                "original": value, "mapped_to": resolved,
                "message": f"Activity type normalized: '{value}' -> '{activity_label(resolved)}'",
            })
            return resolved

        warnings.append({
            "field": name, "severity": "invalid_cleared",
            "original": value,
            "message": f"Activity type '{value}' no longer exists. Please pick a current value.",
        })
        return _cleared_value(name)

    if name == "cluster":
        if value in CLUSTERS:
            return value
        warnings.append({
            "field": name, "severity": "invalid_cleared",
            "original": value,
            "message": f"Cluster '{value}' not recognized. Field cleared.",
        })
        return _cleared_value(name)

    if name == "cot":
        mapped = COT_MAP.get(value)
        if mapped:
            warnings.append({
                "field": name, "severity": "auto_fixed",
                "original": value, "mapped_to": mapped,
                "message": f"COT normalized: '{value}' -> '{mapped}'",
            })
            return mapped
        if value in COT_OPTIONS:
            return value
        warnings.append({
            "field": name, "severity": "invalid_cleared",
            "original": value,
            "message": f"COT '{value}' not recognized. Field cleared.",
        })
        return _cleared_value(name)

    if name == "category" and isinstance(value, list):
        kept = [c for c in value if c in CATEGORIES]
        dropped = [c for c in value if c not in CATEGORIES]
        if dropped:
            warnings.append({
                "field": name, "severity": "partial_fix",
                "original": value, "mapped_to": kept,
                "message": f"Removed invalid categories: {dropped}.",
            })
        return kept

    if name == "event_type" and value not in EVENT_TYPES:
        warnings.append({"field": name, "severity": "invalid_cleared",
                         "original": value, "message": f"Event type '{value}' not recognized."})
        return _cleared_value(name)

    if name == "event_purpose" and value not in EVENT_PURPOSES:
        warnings.append({"field": name, "severity": "invalid_cleared",
                         "original": value, "message": f"Event purpose '{value}' not recognized."})
        return _cleared_value(name)

    if name == "capex_opex" and value not in CAPEX_OPEX:
        return "OpEx"   # safe default

    if name == "adv_selling" and value not in ADV_SELLING:
        return "ADV"    # safe default

    return value


def _check_required(payload: dict, warnings: list[dict]) -> None:
    """Surface fields that are empty but required for submission."""
    for field, message in _REQUIRED_FOR_SUBMIT.items():
        val = payload.get(field)
        if val is None or (isinstance(val, str) and not val.strip()):
            warnings.append({
                "field": field, "severity": "empty_required", "message": message,
            })


def _next_draft_id(db: Session, now: datetime) -> str:
    """LAURA-YYYYMMDD-XXXX format; XXXX is a short uniqueness suffix."""
    import secrets
    suffix = secrets.token_hex(2).upper()
    return f"LAURA-{now.strftime('%Y%m%d')}-{suffix}"


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.post("/loa/{loa_id}/duplicate")
def duplicate_loa(
    loa_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Create a fresh draft owned by the current user, seeded with sanitized
    fields from the source LOA. Returns the new draft's id + the warnings
    list, so the frontend can route the user straight to the editable draft
    and surface what was normalized.
    """
    source = db.query(LOA).filter(LOA.id == loa_id).first()
    if source is None:
        raise HTTPException(status_code=404, detail="Source LOA not found")

    # Permission: any user with view access to the source can duplicate it.
    # We re-check via the same matcher used elsewhere to keep one source of truth.
    role = user.role_obj
    if not role:
        raise HTTPException(status_code=403, detail="No role assigned to user")
    if not role.can_override_lock and not role.matches_loa(source):
        raise HTTPException(
            status_code=403,
            detail="Source LOA is outside your scope - you cannot duplicate it",
        )

    warnings: list[dict] = []
    now = datetime.utcnow()

    # Build the payload field-by-field, sanitizing as we go.
    payload: dict[str, Any] = {}
    for col in LOA.__table__.columns:
        name = col.name
        if name in _NEVER_COPY:
            continue
        if name in _RESET_TO_NONE:
            payload[name] = None
            continue
        payload[name] = _sanitize_field(name, getattr(source, name), warnings)

    _check_required(payload, warnings)

    # Identity and ownership of the new draft - the critical part.
    from backend.services.cycle_service import resolve_cycle_for_new_loa
    from backend.models.loa import SOURCE_LAURA_CREATED
    cycle = resolve_cycle_for_new_loa(db, is_emergency=bool(payload.get("is_emergency")))

    new_loa = LOA(
        **payload,
        loa_draft_id    = _next_draft_id(db, now),
        status          = "draft",
        requestor_email = user.email,    # <-- THE fix. The draft belongs to the caller.
        cycle_id        = cycle.id,      # the open cycle, not the source's
        source          = SOURCE_LAURA_CREATED,
        # A duplicate is a real submission, not a fixture. This was hardcoded
        # True, which flagged every "Use as starting point" result as demo data —
        # and demo rows are filtered out of reporting and the tracker.
        is_demo         = False,
        is_locked       = False,
        created_at      = now,
        updated_at      = now,
    )

    new_loa.duplicated_from_id = source.id

    db.add(new_loa)
    db.flush()  # get new_loa.id before adding child lines

    # Copy child lines for multi-brand / multi-activity LOAs.
    # Without this, a multi-type LOA would be saved with loa_type='multi_*'
    # but zero lines, which fails the MIN_LOA_LINES validation on resubmit.
    for src_line in source.lines:
        db.add(LOALine(
            loa_id        = new_loa.id,
            position      = src_line.position,
            brand         = src_line.brand,
            activity_type = src_line.activity_type,
            customer      = src_line.customer,
            vendor        = src_line.vendor,
            detail        = src_line.detail,
            num_doors     = src_line.num_doors,
            cost_drill_down = src_line.cost_drill_down,
            q4_2025       = src_line.q4_2025,
            q1_2026       = src_line.q1_2026,
            q2_2026       = src_line.q2_2026,
            q3_2026       = src_line.q3_2026,
            q4_2026       = src_line.q4_2026,
        ))

    # Recompute derived totals from the copied financial fields.
    if hasattr(new_loa, "calculate_totals"):
        new_loa.calculate_totals()

    db.commit()
    db.refresh(new_loa)

    return {
        "id":              str(new_loa.id),
        "loa_draft_id":    new_loa.loa_draft_id,
        "status":          new_loa.status,
        "requestor_email": new_loa.requestor_email,
        "source_id":       str(source.id),
        "warnings":        warnings,
        "warnings_summary": {
            "auto_fixed":      sum(1 for w in warnings if w["severity"] == "auto_fixed"),
            "invalid_cleared": sum(1 for w in warnings if w["severity"] == "invalid_cleared"),
            "partial_fix":     sum(1 for w in warnings if w["severity"] == "partial_fix"),
            "empty_required": sum(1 for w in warnings if w["severity"] == "empty_required"),
        },
    }
