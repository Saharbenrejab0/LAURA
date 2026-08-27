"""
LAURA — Historical Campaigns API

The client's pre-LAURA campaign records. These rows never belong to a cycle and
are never reviewable — they exist for reference, grouped by the batch that
loaded them.

GET /historical/loas            — historical LOAs (filter by import_batch_id)
GET /historical/import-batches  — every bulk load, with row counts
GET /historical/deck            — deck-shaped payload for the slideshow view
GET /historical/excel           — grid-shaped payload for the spreadsheet view
GET /historical/export          — download as .xlsx

`demo_seed` rows are excluded everywhere here: they are fixtures, not client
history.
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.models.database import get_db
from backend.api.ordering import newest_first
from backend.models.loa import LOA, SOURCE_HISTORICAL_IMPORT
from backend.models.import_batch import ImportBatch
from backend.models.user import User
from backend.api.auth import get_current_user

router = APIRouter(prefix="/historical", tags=["historical"])

XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def _historical_query(db: Session, batch_id: Optional[str] = None):
    """Base query — historical rows only, optionally narrowed to one batch."""
    q = db.query(LOA).filter(LOA.source == SOURCE_HISTORICAL_IMPORT)
    if batch_id:
        q = q.filter(LOA.import_batch_id == batch_id)
    return q


def _batch_out(b: ImportBatch, live_count: Optional[int] = None) -> dict:
    return {
        "id": str(b.id),
        "label": b.label,
        "importedAt": b.imported_at.isoformat() if b.imported_at else None,
        "importedBy": str(b.imported_by) if b.imported_by else None,
        "rowCount": live_count if live_count is not None else (b.row_count or 0),
        "sourceFileName": b.source_file_name,
        "notes": b.notes,
    }


# ── Batches ──────────────────────────────────────────────────────────────────

@router.get("/import-batches")
def list_import_batches(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Every bulk load. Row counts are recomputed live, so deletions show up."""
    batches = newest_first(db.query(ImportBatch), ImportBatch).all()
    counts = dict(
        db.query(LOA.import_batch_id, func.count(LOA.id))
        .filter(LOA.source == SOURCE_HISTORICAL_IMPORT)
        .group_by(LOA.import_batch_id)
        .all()
    )
    return [_batch_out(b, int(counts.get(b.id, 0))) for b in batches]


# ── LOAs ─────────────────────────────────────────────────────────────────────

@router.get("/loas")
def list_historical_loas(
    import_batch_id: Optional[str] = Query(None),
    limit: int = Query(500, le=5000),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from backend.api.review import _loa_out

    q = _historical_query(db, import_batch_id)
    total = q.count()
    rows = newest_first(q, LOA).offset(offset).limit(limit).all()
    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "loas": [_loa_out(l) for l in rows],
    }


# ── Deck view ────────────────────────────────────────────────────────────────

@router.get("/deck")
def historical_deck(
    import_batch_id: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Deck payload shaped like /review/{id}/deck so the slideshow components
    render it unchanged — minus anything reviewable."""
    from backend.api.review import _loa_out

    loas = newest_first(_historical_query(db, import_batch_id), LOA).all()

    label = "All historical data"
    if import_batch_id:
        batch = db.query(ImportBatch).filter(ImportBatch.id == import_batch_id).first()
        if not batch:
            raise HTTPException(status_code=404, detail="Import batch not found")
        label = batch.label

    total_budget = sum((l.fy_2026_total or 0) for l in loas)
    return {
        "cycle": {
            "id": import_batch_id or "all",
            "name": label,
            "cycleType": "historical",
            "status": "closed",
            "startDate": None,
            "endDate": None,
            "isActive": False,
            "isClosed": True,
            "closedAt": None,
            "closedBy": None,
        },
        "loas": [{**_loa_out(l), "photos": []} for l in loas],
        "titleConfig": None,
        "titlePhoto": None,
        "overviewPhotos": {},
        "totalBudget": total_budget,
    }


# ── Excel / grid view ────────────────────────────────────────────────────────

@router.get("/excel")
def historical_excel_grid(
    import_batch_id: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Spreadsheet payload. Verdict columns are replaced by import provenance —
    there is nothing to approve on historical data."""
    from backend.api.review import _loa_out

    loas = newest_first(_historical_query(db, import_batch_id), LOA).all()
    batches = {b.id: b for b in db.query(ImportBatch).all()}

    rows = []
    for l in loas:
        b = batches.get(l.import_batch_id)
        rows.append({
            **_loa_out(l),
            "importBatchId": str(l.import_batch_id) if l.import_batch_id else None,
            "importBatchLabel": b.label if b else "—",
            "importedAt": b.imported_at.isoformat() if b and b.imported_at else None,
        })

    return {
        "total": len(rows),
        "totalBudget": sum((l.fy_2026_total or 0) for l in loas),
        "rows": rows,
    }


# ── Export ───────────────────────────────────────────────────────────────────

@router.get("/export")
def export_historical(
    import_batch_id: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Download the historical set as .xlsx, in the standard workbook layout."""
    from backend.engines.excel import loas_to_rows, export_excel_bytes, safe_filename

    loas = _historical_query(db, import_batch_id).all()
    if not loas:
        raise HTTPException(status_code=404, detail="No historical LOAs to export")

    name = "Historical campaigns"
    if import_batch_id:
        batch = db.query(ImportBatch).filter(ImportBatch.id == import_batch_id).first()
        if batch:
            name = batch.label

    xlsx = export_excel_bytes(loas_to_rows(loas), title="Historical", include_summary=True)
    filename = f"{safe_filename(name)}.xlsx"
    return Response(
        content=xlsx,
        media_type=XLSX_MIME,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
