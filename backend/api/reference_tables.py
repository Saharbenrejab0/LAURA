"""
Reference data API — new cascade endpoints backed by DB tables.

GET /api/reference/clusters                    → [{ id, name }]
GET /api/reference/countries?cluster_id=X      → [{ id, name }]
GET /api/reference/legal-entities?country_id=X → [{ id, name }]
GET /api/reference/brands                      → [{ id, code, name }]
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import text

from backend.models.database import get_db

router = APIRouter(tags=["reference-tables"])


@router.get("/clusters")
def get_clusters(db: Session = Depends(get_db)):
    rows = db.execute(text("SELECT id, name FROM clusters ORDER BY name")).fetchall()
    return [{"id": r.id, "name": r.name} for r in rows]


@router.get("/countries")
def get_countries(cluster_id: int = Query(...), db: Session = Depends(get_db)):
    rows = db.execute(
        text("SELECT id, name FROM countries WHERE cluster_id = :cid ORDER BY name"),
        {"cid": cluster_id},
    ).fetchall()
    return [{"id": r.id, "name": r.name} for r in rows]


@router.get("/legal-entities")
def get_legal_entities(country_id: int = Query(...), db: Session = Depends(get_db)):
    rows = db.execute(
        text("SELECT id, name FROM legal_entities WHERE country_id = :cid ORDER BY name"),
        {"cid": country_id},
    ).fetchall()
    return [{"id": r.id, "name": r.name} for r in rows]


@router.get("/brands")
def get_brands(db: Session = Depends(get_db)):
    rows = db.execute(
        text("SELECT id, code, name FROM brands WHERE is_active = true ORDER BY name")
    ).fetchall()
    return [{"id": r.id, "code": r.code, "name": r.name} for r in rows]
