"""
LAURA - Past Campaigns / Templates browse endpoint

GET  /loa/templates
    List historical LOAs available to the caller as creation templates.
    Marketers see only their cluster's history; admins see everything.
    Supports search, filters, sort, and pagination.

POST /loa/templates/search
    Same data, but ranked by semantic similarity to a free-text brief.
    Uses pgvector embeddings for semantic search, falls back to keyword
    matching if the vector search fails.

    Results are sorted by:
      1. Semantic similarity score (highest first)
      2. Budget total (highest first) as tiebreaker for same score
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import or_, text as sa_text
from sqlalchemy.orm import Session

from backend.api.auth import get_current_user
from backend.models.database import get_db
from backend.models.loa import LOA
from backend.models.user import User

router = APIRouter()


# ---------------------------------------------------------------------------
# Response shapes (kept stable so the frontend can rely on them)
# ---------------------------------------------------------------------------

def _template_dto(loa: LOA, match_score: int | None = None,
                  matched_on: list[str] | None = None) -> dict[str, Any]:
    """Project a LOA row into the slim shape the explorer needs."""
    title = (loa.description or "").strip()
    if not title:
        parts = [p for p in (loa.activity_type, loa.country, loa.brand) if p]
        title = " - ".join(parts) or loa.loa_draft_id

    return {
        "id":             str(loa.id),
        "loa_draft_id":   loa.loa_draft_id,
        "title":          title[:120],
        "status":         loa.status,
        "cluster":        loa.cluster,
        "country":        loa.country,
        "brand":          loa.brand,
        "activity_type":  loa.activity_type,
        "category":       loa.category,
        "cot":            loa.cot,
        "fy_2025_total":  loa.fy_2025_total,
        "fy_2026_total":  loa.fy_2026_total,
        "budget_total":   (loa.fy_2025_total or 0) + (loa.fy_2026_total or 0),
        "match_score":    match_score,
        "matched_on":     matched_on or [],
    }


# ---------------------------------------------------------------------------
# Scope: which LOAs is the caller allowed to see as templates?
# ---------------------------------------------------------------------------

def _scope_query(db: Session, user: User):
    """Return a query already filtered to what the user is allowed to browse."""
    q = db.query(LOA)

    role = user.role_obj
    if not role:
        return q.filter(LOA.id == None)  # noqa: E711

    if role.can_override_lock:
        return q

    if (role.scope_type or "").lower() == "cluster" and role.scope_value:
        return q.filter(LOA.cluster == role.scope_value)

    if (role.scope_type or "").lower() == "country" and role.scope_value:
        return q.filter(LOA.country == role.scope_value)

    return q.filter(LOA.id == None)  # noqa: E711


def _get_scope_sql_conditions(user: User) -> tuple[list[str], dict]:
    """Return SQL WHERE conditions + params matching user scope for raw SQL queries."""
    role = user.role_obj
    if not role:
        return ["1 = 0"], {}  # empty result

    if role.can_override_lock:
        return [], {}  # no restrictions

    scope_type = (role.scope_type or "").lower()
    if scope_type == "cluster" and role.scope_value:
        return ["cluster = :scope_val"], {"scope_val": role.scope_value}
    if scope_type == "country" and role.scope_value:
        return ["country = :scope_val"], {"scope_val": role.scope_value}

    return ["1 = 0"], {}


# ---------------------------------------------------------------------------
# "Most reusable" composite score - used as the default sort in GET /templates
# ---------------------------------------------------------------------------

def _reusable_score(loa: LOA, viewer_cluster: str | None) -> int:
    """Higher = better template candidate. Deterministic, no ML."""
    score = 0
    if loa.status == "approved":
        score += 40
    elif loa.status == "closed":
        score += 30
    elif loa.status == "rejected":
        score -= 20

    key_fields = ("description", "kpi", "detail", "activity_type",
                  "brand", "category", "cot", "fy_2026_total")
    filled = sum(1 for f in key_fields if getattr(loa, f, None))
    score += filled * 3

    if viewer_cluster and loa.cluster == viewer_cluster:
        score += 15

    if (loa.fy_2026_total or 0) > 0:
        score += 10

    return score


# ---------------------------------------------------------------------------
# GET /loa/templates  - the explorer feed
# ---------------------------------------------------------------------------

@router.get("/templates")
def list_templates(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    search:        str | None = Query(None, description="Free text search"),
    brand:         str | None = None,
    country:       str | None = None,
    cluster:       str | None = None,
    activity_type: str | None = None,
    status:        str | None = Query(None, description="approved | closed | any"),
    fy:            int | None = None,
    sort:          str = Query("most_reusable",
                               regex="^(most_reusable|recently_approved|highest_budget|fy_desc)$"),
    limit:         int = Query(50, ge=1, le=200),
    offset:        int = Query(0,  ge=0),
):
    """Paginated, filtered list of past LOAs usable as templates."""
    q = _scope_query(db, user)

    if search:
        like = f"%{search}%"
        q = q.filter(or_(
            LOA.description.ilike(like),
            LOA.activity_type.ilike(like),
            LOA.country.ilike(like),
            LOA.brand.ilike(like),
            LOA.customer.ilike(like) if hasattr(LOA, "customer") else False,
        ))
    if brand:         q = q.filter(LOA.brand == brand)
    if country:       q = q.filter(LOA.country == country)
    if cluster:       q = q.filter(LOA.cluster == cluster)
    if activity_type: q = q.filter(LOA.activity_type == activity_type)

    if status == "approved":
        q = q.filter(LOA.status == "approved")
    elif status == "closed":
        q = q.filter(LOA.status == "closed")
    elif status is None:
        q = q.filter(LOA.status.in_(("approved", "closed")))

    total = q.count()

    if sort == "highest_budget":
        q = q.order_by(LOA.fy_2026_total.desc().nullslast())
    elif sort == "fy_desc":
        q = q.order_by(LOA.created_at.desc())
    elif sort == "recently_approved":
        q = q.order_by(LOA.approved_at.desc().nullslast())

    rows = q.offset(offset).limit(limit).all()

    viewer_cluster = user.role_obj.scope_value if user.role_obj else None
    if sort == "most_reusable":
        rows.sort(key=lambda l: _reusable_score(l, viewer_cluster), reverse=True)

    return {
        "templates":    [_template_dto(l) for l in rows],
        "total":        total,
        "limit":        limit,
        "offset":       offset,
        "viewer_scope": {
            "type":  user.role_obj.scope_type if user.role_obj else None,
            "value": viewer_cluster,
            "is_admin": bool(user.role_obj and user.role_obj.can_override_lock),
        },
    }


# ---------------------------------------------------------------------------
# POST /loa/templates/search  - the "Ask Laura" precedent engine (RAG-powered)
# ---------------------------------------------------------------------------

class BriefSearchRequest(BaseModel):
    brief: str
    limit: int = 5


def _match_brief(loa: LOA, brief_lower: str) -> tuple[int, list[str]]:
    """Keyword-based fallback matcher. Returns (score 0-99, matched dimensions)."""
    score = 0
    matched: list[str] = []

    for field, label in (
        (loa.brand,         "brand"),
        (loa.country,       "country"),
        (loa.cluster,       "cluster"),
        (loa.activity_type, "activity"),
        (loa.cot,           "channel"),
    ):
        if field and field.lower() in brief_lower:
            score += 18
            matched.append(label)

    if loa.category:
        cats = loa.category if isinstance(loa.category, list) else [loa.category]
        if any(c and c.lower() in brief_lower for c in cats):
            score += 12
            matched.append("category")

    if loa.description and any(
        word for word in brief_lower.split()
        if len(word) > 4 and word in loa.description.lower()
    ):
        score += 10
        matched.append("wording")

    if loa.status == "approved":
        score += 10
        matched.append("approved")

    return min(score, 99), matched


@router.post("/templates/search")
def search_templates(
    body: BriefSearchRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Semantic search over past LOAs, ranked by similarity then by budget.

    Pipeline:
      1. Encode the brief locally (sentence-transformers, no external API)
      2. pgvector cosine similarity across LOAs in user's scope
      3. Pull a wide pool (limit * 6, min 30) of nearest neighbors
      4. Sort in Python by (score DESC, budget DESC) — highest score wins,
         highest budget breaks ties
      5. Return top N (body.limit)
    """
    brief = (body.brief or "").strip()
    if not brief:
        return {"templates": [], "brief": body.brief}

    try:
        # ── Encode query with local embedding model ──
        from backend.engines.rag import _get_embed_model
        model = _get_embed_model()
        vec = model.encode(f"query: {brief}", normalize_embeddings=True)
        vec_str = "[" + ",".join(str(float(v)) for v in vec) + "]"

        # ── Build scope + WHERE clauses ──
        scope_conds, scope_params = _get_scope_sql_conditions(user)

        # If scope resolves to empty (1=0), short-circuit
        if scope_conds == ["1 = 0"]:
            return {"templates": [], "brief": body.brief}

        where_parts = [
            "embedding IS NOT NULL",
            "status IN ('approved', 'closed')",
        ] + scope_conds

        pool_size = max(body.limit * 6, 30)
        params = {"vec": vec_str, "limit": pool_size, **scope_params}
        where_clause = " AND ".join(where_parts)

        # ── Vector search: pull wide pool, ordered by pure similarity ──
        rows = db.execute(sa_text(f"""
            SELECT id, loa_draft_id, description, activity_type, country,
                   brand, cluster, category, cot, status,
                   fy_2025_total, fy_2026_total,
                   1 - (embedding <=> :vec) AS similarity
            FROM loas
            WHERE {where_clause}
            ORDER BY embedding <=> :vec
            LIMIT :limit
        """), params).fetchall()

        # ── Build response DTOs ──
        brief_lower = brief.lower()
        templates: list[dict[str, Any]] = []
        for row in rows:
            title = (row.description or "").strip()
            if not title:
                parts = [p for p in (row.activity_type, row.country, row.brand) if p]
                title = " - ".join(parts) or (row.loa_draft_id or "?")

            score = int(max(0, row.similarity * 100))
            matched_on = ["semantic"]
            if row.brand and row.brand.lower() in brief_lower:
                matched_on.append("brand")
            if row.country and row.country.lower() in brief_lower:
                matched_on.append("country")
            if row.activity_type and row.activity_type.lower() in brief_lower:
                matched_on.append("activity")

            budget_total = (row.fy_2025_total or 0) + (row.fy_2026_total or 0)

            templates.append({
                "id": str(row.id),
                "loa_draft_id": row.loa_draft_id,
                "title": title[:120],
                "status": row.status,
                "cluster": row.cluster,
                "country": row.country,
                "brand": row.brand,
                "activity_type": row.activity_type,
                "category": row.category,
                "cot": row.cot,
                "fy_2025_total": row.fy_2025_total,
                "fy_2026_total": row.fy_2026_total,
                "budget_total": budget_total,
                "match_score": score,
                "matched_on": matched_on,
            })

        # ── Final sort: highest score first, then highest budget for ties ──
        templates.sort(
            key=lambda t: (t["match_score"], t["budget_total"]),
            reverse=True,
        )

        # ── Trim to requested limit ──
        templates = templates[:body.limit]

        return {"brief": body.brief, "templates": templates}

    except Exception:
        # ── Fallback: keyword matching if vector search fails ──
        rows = _scope_query(db, user).filter(
            LOA.status.in_(("approved", "closed"))
        ).all()

        brief_lower = brief.lower()
        scored = [(loa, *_match_brief(loa, brief_lower)) for loa in rows]
        scored = [s for s in scored if s[1] > 0]

        # Sort by (score DESC, budget DESC)
        scored.sort(
            key=lambda t: (
                t[1],
                (t[0].fy_2025_total or 0) + (t[0].fy_2026_total or 0),
            ),
            reverse=True,
        )

        top = scored[: body.limit]
        return {
            "brief": body.brief,
            "templates": [
                _template_dto(loa, match_score=score, matched_on=matched)
                for loa, score, matched in top
            ],
        }
