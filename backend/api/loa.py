"""LAURA — LOA routes

Connected to:
  - backend.reference_data : source of truth for all dropdowns (validates inputs)
  - backend.models.loa     : SQLAlchemy LOA model (category is now ARRAY)
  - backend.engines.*       : PPT/Excel/AI generation
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
    # Examples: ["Frames"], ["Frames", "Lenses"], ["All cat."]
    # Stored as PostgreSQL ARRAY in the database.
    category: list[str] = []

    brand: str = ""
    capex_opex: str = "OpEx"
    adv_selling: str = "ADV"
    detail: Optional[str] = None
    description: Optional[str] = None
    customer: Optional[str] = None
    vendor: Optional[str] = None
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

    # ── Validators against reference_data.py ────────────────────────────
    # These run on EVERY create/update — keep them lightweight.
    # Empty string = no value provided yet (draft mode), accepted.
    # A non-empty value MUST exist in the reference data.

    @field_validator("category", mode="before")
    @classmethod
    def normalize_category(cls, v):
        """
        Accepts a single string OR a list. Always returns a clean list:
          - "Frames"  → ["Frames"]
          - ["Frames", "Lenses"]  → ["Frames", "Lenses"]
          - ["Frames", "Frames"]  → ["Frames"]    (dedupes)
          - None / ""  → []
        """
        if v is None or v == "":
            return []
        if isinstance(v, str):
            v = [v]
        # Dedupe while preserving order
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
        if v:  # only validate non-empty (drafts can be empty)
            invalid = [c for c in v if c not in CATEGORIES]
            if invalid:
                raise ValueError(
                    f"Invalid category value(s): {invalid}. "
                    f"Allowed: {CATEGORIES}"
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
            raise ValueError(
                f"Invalid activity_type '{v}'. Allowed: {ACTIVITY_TYPES}"
            )
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
            raise ValueError(
                f"Invalid event_purpose '{v}'. Allowed: {EVENT_PURPOSES}"
            )
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
    category: list[str] = []   # ← was: str. Now multi.
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


# ── Routes ──────────────────────────────────────────────────────────────

@router.get("")
async def get_loas(
    status: Optional[str] = None,
    cluster: Optional[str] = None,
    include_historical: bool = False,
    db: Session = Depends(get_db),
):
    query = db.query(LOA)
    # Demo mode: by default, only show LOAs created via the LAURA form.
    # Set include_historical=true to also show the 1330 imported LOAs.
    if not include_historical:
        query = query.filter(LOA.is_demo == True)
    if status:
        query = query.filter(LOA.status == status)
    if cluster:
        query = query.filter(LOA.cluster == cluster)
    return query.all()


@router.get("/{loa_id}")
async def get_loa(loa_id: str, db: Session = Depends(get_db)):
    loa = db.query(LOA).filter(LOA.id == loa_id).first()
    if not loa:
        raise HTTPException(status_code=404, detail="LOA not found")
    return loa


@router.post("")
async def create_loa(body: LOACreate, db: Session = Depends(get_db)):
    loa_id = str(uuid.uuid4())
    draft_id = f"LAURA-{datetime.now().strftime('%Y%m%d')}-{loa_id[:6].upper()}"

    loa = LOA(
        id=loa_id,
        loa_draft_id=draft_id,
        status="draft",
        is_demo=True,   # Demo mode: all LOAs created via the form are demo
        **body.model_dump(),
    )
    loa.calculate_totals()

    db.add(loa)
    db.commit()
    db.refresh(loa)
    return loa


@router.patch("/{loa_id}")
async def update_loa(loa_id: str, body: LOACreate, db: Session = Depends(get_db)):
    loa = db.query(LOA).filter(LOA.id == loa_id).first()
    if not loa:
        raise HTTPException(status_code=404, detail="LOA not found")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(loa, field, value)

    loa.calculate_totals()
    db.commit()
    db.refresh(loa)
    return loa


@router.post("/{loa_id}/submit")
async def submit_loa(loa_id: str, db: Session = Depends(get_db)):
    loa = db.query(LOA).filter(LOA.id == loa_id).first()
    if not loa:
        raise HTTPException(status_code=404, detail="LOA not found")

    issues = loa.validate()
    errors = [i for i in issues if i["type"] == "error"]
    if errors:
        raise HTTPException(status_code=422, detail={"validation_errors": errors})

    loa.status = "submitted"
    loa.submitted_at = datetime.utcnow()
    db.commit()
    db.refresh(loa)

    await notify_n8n("loa_submitted", str(loa_id), {
        "requestor_email": loa.requestor_email,
        "loa_draft_id": loa.loa_draft_id,
        "activity_type": loa.activity_type,
        "country": loa.country,
        "cluster": loa.cluster,
        "fy_total": loa.fy_2026_total,
    })

    return loa


@router.post("/{loa_id}/approve")
async def approve_loa(loa_id: str, db: Session = Depends(get_db)):
    loa = db.query(LOA).filter(LOA.id == loa_id).first()
    if not loa:
        raise HTTPException(status_code=404, detail="LOA not found")

    loa.status = "approved"
    loa.approved_at = datetime.utcnow()
    db.commit()
    db.refresh(loa)

    await notify_n8n("loa_approved", str(loa_id), {
        "requestor_email": loa.requestor_email,
        "loa_draft_id": loa.loa_draft_id,
        "activity_type": loa.activity_type,
        "country": loa.country,
        "fy_total": loa.fy_2026_total,
    })

    return loa


@router.post("/{loa_id}/reject")
async def reject_loa(loa_id: str, reason: str = "", db: Session = Depends(get_db)):
    loa = db.query(LOA).filter(LOA.id == loa_id).first()
    if not loa:
        raise HTTPException(status_code=404, detail="LOA not found")

    loa.status = "rejected"
    loa.rejection_reason = reason
    db.commit()
    db.refresh(loa)

    await notify_n8n("loa_rejected", str(loa_id), {
        "requestor_email": loa.requestor_email,
        "loa_draft_id": loa.loa_draft_id,
        "reason": reason,
    })

    return loa


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


@router.get("/{loa_id}/pptx")
async def download_loa_pptx(loa_id: str, db: Session = Depends(get_db)):
    loa = db.query(LOA).filter(LOA.id == loa_id).first()
    if not loa:
        raise HTTPException(status_code=404, detail="LOA not found")
    from backend.engines.ppt import generate_loa_slide

    # Serialize to dict — category is already a list (PostgreSQL ARRAY → Python list)
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
    # category is now a list — pass the first element for legacy AI signature,
    # or join with " + " for prompts. We pass as-is and let ai.py handle it.
    return await suggest_loa_content(
        activity_type=body.activity_type,
        cluster=body.cluster,
        category=body.category,           # list[str] now
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