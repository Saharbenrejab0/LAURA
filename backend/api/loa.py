"""LAURA — LOA routes"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from sqlalchemy.orm import Session
import uuid
import httpx
import os

from backend.models.database import get_db
from backend.models.loa import LOA, LOAStatus

router = APIRouter()


# ── n8n webhook ───────────────────────────────────────────────────────────────
async def notify_n8n(event: str, loa_id: str, extra: dict = {}):
    """Fire-and-forget webhook to n8n. Never blocks if n8n is down."""
    url = os.getenv("N8N_WEBHOOK_URL", "")
    if not url:
        return
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            await client.post(url, json={"event": event, "loa_id": loa_id, **extra})
    except Exception:
        pass


# ── Pydantic schemas ──────────────────────────────────────────────────────────
class LOACreate(BaseModel):
    cluster: str = ""
    country: str = ""
    legal_entity: Optional[str] = None
    activity_type: str = ""
    event_type: Optional[str] = None
    event_purpose: Optional[str] = None
    sap_event_code: Optional[str] = None
    cot: str = ""
    category: str = ""
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


class DescriptionValidateRequest(BaseModel):
    description: str
    activity_type: str


class SuggestRequest(BaseModel):
    activity_type: str
    cluster: str = ""
    category: str = ""
    brand: str = ""
    fy_total: float = 0
    num_doors: int = 0
    requestor_email: str = "system"


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("")
async def get_loas(
    status: Optional[str] = None,
    cluster: Optional[str] = None,
    db: Session = Depends(get_db),
):
    query = db.query(LOA)
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

    # Notify n8n
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

    # Notify n8n
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

    # Notify n8n
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
    from fastapi.responses import Response
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


# ── Photo upload ──────────────────────────────────────────────────────────────
import shutil
from fastapi import UploadFile, File
from fastapi.responses import FileResponse

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