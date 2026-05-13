"""LAURA — LOA routes"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import uuid

router = APIRouter()

# In-memory store for now — replace with PostgreSQL once DB is set up
_loas: dict = {}


class LOACreate(BaseModel):
    cluster: str = ""
    country: str = ""
    legal_entity: Optional[str] = None
    activity_type: str = ""
    event_type: Optional[str] = None
    event_purpose: Optional[str] = None
    cot: str = ""
    category: str = ""
    brand: str = ""
    capex_opex: str = "OpEx"
    adv_selling: str = "ADV"
    detail: Optional[str] = None
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
    description: Optional[str] = None
    tools: Optional[str] = None
    kpi: Optional[str] = None
    timing: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    cost_drill_down: Optional[str] = None
    requestor_email: str = ""


def _calculate(loa: dict) -> dict:
    """Calculate derived fields — never trust frontend values."""
    loa["fy_2025_total"] = loa.get("q4_2025", 0)
    loa["fy_2026_total"] = sum([
        loa.get("q1_2026", 0), loa.get("q2_2026", 0),
        loa.get("q3_2026", 0), loa.get("q4_2026", 0),
    ])
    doors = loa.get("num_doors") or 0
    loa["avg_investment_per_door"] = (
        round(loa["fy_2026_total"] / doors, 2) if doors > 0 else None
    )
    loa["ppt_slide_required"] = loa["fy_2026_total"] > 50_000
    return loa


@router.get("")
async def get_loas(status: Optional[str] = None, cluster: Optional[str] = None):
    loas = list(_loas.values())
    if status:
        loas = [l for l in loas if l["status"] == status]
    if cluster:
        loas = [l for l in loas if l["cluster"] == cluster]
    return loas


@router.get("/{loa_id}")
async def get_loa(loa_id: str):
    if loa_id not in _loas:
        raise HTTPException(status_code=404, detail="LOA not found")
    return _loas[loa_id]


@router.post("")
async def create_loa(body: LOACreate):
    loa_id = str(uuid.uuid4())
    draft_id = f"LAURA-{datetime.now().strftime('%Y%m%d')}-{loa_id[:6].upper()}"
    loa = {
        "id": loa_id,
        "loa_draft_id": draft_id,
        "loa_number": None,
        "status": "draft",
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
        "submitted_at": None,
        "approved_at": None,
        "ai_suggestion_used": False,
        **body.model_dump(),
    }
    loa = _calculate(loa)
    _loas[loa_id] = loa
    return loa


@router.patch("/{loa_id}")
async def update_loa(loa_id: str, body: LOACreate):
    if loa_id not in _loas:
        raise HTTPException(status_code=404, detail="LOA not found")
    loa = {**_loas[loa_id], **body.model_dump(exclude_unset=True)}
    loa["updated_at"] = datetime.utcnow().isoformat()
    loa = _calculate(loa)
    _loas[loa_id] = loa
    return loa


@router.post("/{loa_id}/submit")
async def submit_loa(loa_id: str):
    if loa_id not in _loas:
        raise HTTPException(status_code=404, detail="LOA not found")
    _loas[loa_id]["status"] = "submitted"
    _loas[loa_id]["submitted_at"] = datetime.utcnow().isoformat()
    return _loas[loa_id]


@router.post("/{loa_id}/approve")
async def approve_loa(loa_id: str):
    if loa_id not in _loas:
        raise HTTPException(status_code=404, detail="LOA not found")
    _loas[loa_id]["status"] = "approved"
    _loas[loa_id]["approved_at"] = datetime.utcnow().isoformat()
    return _loas[loa_id]


@router.post("/{loa_id}/reject")
async def reject_loa(loa_id: str, reason: str = ""):
    if loa_id not in _loas:
        raise HTTPException(status_code=404, detail="LOA not found")
    _loas[loa_id]["status"] = "rejected"
    _loas[loa_id]["rejection_reason"] = reason
    return _loas[loa_id]


@router.post("/suggest")
async def suggest(
    activity_type: str,
    cluster: str = "",
    category: str = "",
    brand: str = "",
    fy_total: float = 0,
    num_doors: int = 0,
):
    from backend.engines.ai import suggest_loa_content
    result = await suggest_loa_content(
        activity_type=activity_type,
        cluster=cluster,
        category=category,
        brand=brand,
        fy_total=fy_total,
        num_doors=num_doors,
        requestor_email="system",
    )
    return result
