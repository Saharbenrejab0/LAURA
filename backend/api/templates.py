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
import json
import uuid
from datetime import datetime

from typing import Any

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import or_, text as sa_text
from sqlalchemy.orm import Session

from backend.api.auth import get_current_user
from backend.models.database import get_db
from backend.api.ordering import newest_first
from backend.models.loa import LOA
from backend.engines.loa_display import compute_display_title
from backend.models.user import User

router = APIRouter()


# ---------------------------------------------------------------------------
# Response shapes (kept stable so the frontend can rely on them)
# ---------------------------------------------------------------------------

def _template_dto(loa: LOA, match_score: int | None = None,
                  matched_on: list[str] | None = None,
                  cycle_name: str | None = None,
                  batch_name: str | None = None) -> dict[str, Any]:
    """Project a LOA row into the slim shape the explorer needs.

    Carries PROVENANCE. Without it the Campaign Library cannot tell a 2024
    imported spreadsheet row from an approved LOA that passed nine LAURA gates —
    which is exactly what the old payload did: one undifferentiated list where
    99.4% of the rows were imported history and nothing said so.

    `source` is the classifier. `cycle_id`/`cycle_name` are set only for
    laura_created rows, `import_batch_id`/`batch_name` only for imported ones —
    the DB constraint `ck_loa_live_has_cycle` makes the two mutually exclusive.
    """
    title = (loa.description or "").strip()
    if not title:
        parts = [p for p in (loa.activity_type, loa.country, loa.brand) if p]
        title = " - ".join(parts) or loa.loa_draft_id

    return {
        "id":             str(loa.id),
        "loa_draft_id":   loa.loa_draft_id,
        "title":          title[:120],
        "display_title":  compute_display_title(loa),
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

        # ── Provenance ──
        "source":           loa.source,
        "cycle_id":         str(loa.cycle_id) if loa.cycle_id else None,
        "cycle_name":       cycle_name,
        "import_batch_id":  str(loa.import_batch_id) if loa.import_batch_id else None,
        "batch_name":       batch_name,
        "source_file":      loa.source_file,
        # Year/Quarter grouping for imported history. `start_date` is free-text
        # String(50), so this is a best-effort parse, not a guarantee — see
        # `_period_of`.
        "period":           _period_of(loa),
    }



# ---------------------------------------------------------------------------
# Year / Quarter, for grouping imported history
# ---------------------------------------------------------------------------

_QUARTER_OF_MONTH = {
    1: "Q1", 2: "Q1", 3: "Q1",
    4: "Q2", 5: "Q2", 6: "Q2",
    7: "Q3", 8: "Q3", 9: "Q3",
    10: "Q4", 11: "Q4", 12: "Q4",
}


def _period_of(loa: LOA) -> dict[str, Any]:
    """Best-effort {year, quarter} for one row.

    `loas.start_date` is `String(50)` free text, not a date column, so this
    parses rather than reads. Falls back to the quarter that actually carries
    budget, then to the import date, then to nothing — a row with no usable
    date groups under "Undated" rather than being silently dropped or guessed.

    A real generated date column would make this exact; that is deliberately
    NOT created here (report-first decision) and stays on the historical
    architecture plan.
    """
    # Trailing separators are common in the imported files ("30.06.2026.").
    raw = (loa.start_date or "").strip().rstrip(". ")
    if raw:
        # Every format seen in the 1,431 historical rows that carry a date.
        for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%d.%m.%Y",
                    "%Y/%m/%d", "%Y.%m.%d", "%m/%d/%Y"):
            try:
                d = datetime.strptime(raw[:10], fmt)
                return {"year": d.year, "quarter": _QUARTER_OF_MONTH[d.month],
                        "source": "start_date"}
            except ValueError:
                continue
        # A bare year ("2025") also occurs.
        if len(raw) >= 4 and raw[:4].isdigit():
            y = int(raw[:4])
            if 2000 <= y <= 2100:
                return {"year": y, "quarter": None, "source": "start_date"}

    # No parseable date — infer from where the money sits. The quarter columns
    # are named for their fiscal period, so they are reliable when populated.
    for field, year, quarter in (
        ("q4_2025", 2025, "Q4"),
        ("q1_2026", 2026, "Q1"), ("q2_2026", 2026, "Q2"),
        ("q3_2026", 2026, "Q3"), ("q4_2026", 2026, "Q4"),
    ):
        if (getattr(loa, field, None) or 0) > 0:
            return {"year": year, "quarter": quarter, "source": "budget"}

    # Fiscal-year totals give the year but not the quarter.
    if (getattr(loa, "fy_2025_total", None) or 0) > 0:
        return {"year": 2025, "quarter": None, "source": "fy_total"}
    if (getattr(loa, "fy_2026_total", None) or 0) > 0:
        return {"year": 2026, "quarter": None, "source": "fy_total"}

    # Deliberately NOT falling back to created_at: on an imported row that is
    # the date the ETL ran, so it would file 2024 campaigns under 2026 and make
    # the grouping confidently wrong. "Undated" is the honest answer.
    return {"year": None, "quarter": None, "source": None}

# ---------------------------------------------------------------------------
# Scope: which LOAs is the caller allowed to see as templates?
# ---------------------------------------------------------------------------

def _extract_scope_values(scope_value) -> list[str]:
    """Normalise scope_value (JSON array or string) into a Python list."""
    if scope_value is None:
        return []
    if isinstance(scope_value, list):
        return [str(v) for v in scope_value if v]
    if isinstance(scope_value, str):
        try:
            parsed = json.loads(scope_value)
            if isinstance(parsed, list):
                return [str(v) for v in parsed if v]
            return [str(parsed)] if parsed else []
        except (json.JSONDecodeError, TypeError):
            return [scope_value] if scope_value.strip() else []
    return []


def _scope_query(db: Session, user: User):
    """
    STRICT Past Campaigns access rule:
      - Super-Admin (can_override_lock=True) ? sees all
      - Marketer (role code ends with '_marketer') ? sees their cluster(s)
      - Everyone else ? sees nothing
    """
    q = db.query(LOA)
    role = user.role_obj
    if not role:
        return q.filter(LOA.id == None)  # noqa: E711
    if role.can_override_lock:
        return q
    if (role.code or "").endswith("_marketer"):
        clusters = _extract_scope_values(role.scope_value)
        if not clusters:
            return q.filter(LOA.id == None)  # noqa: E711
        return q.filter(LOA.cluster.in_(clusters))
    return q.filter(LOA.id == None)  # noqa: E711


def _get_scope_sql_conditions(user: User) -> tuple[list[str], dict]:
    """SQL WHERE conditions matching Past Campaigns access rule."""
    role = user.role_obj
    if not role:
        return ["1 = 0"], {}
    if role.can_override_lock:
        return [], {}
    if (role.code or "").endswith("_marketer"):
        clusters = _extract_scope_values(role.scope_value)
        if not clusters:
            return ["1 = 0"], {}
        placeholders = ", ".join(f":scope_c{i}" for i in range(len(clusters)))
        params = {f"scope_c{i}": v for i, v in enumerate(clusters)}
        return [f"cluster IN ({placeholders})"], params
    return ["1 = 0"], {}



def _provenance_names(db: Session, rows: list[LOA]) -> tuple[dict, dict]:
    """{cycle_id: name}, {batch_id: label} for one page of rows.

    Two queries for the whole page rather than a lookup per row. The two maps
    are disjoint by construction: `ck_loa_live_has_cycle` means a row has a
    cycle or a batch, never both.
    """
    from backend.models.loa_cycle import LoaCycle
    from backend.models.import_batch import ImportBatch

    cycle_ids = {l.cycle_id for l in rows if l.cycle_id}
    batch_ids = {l.import_batch_id for l in rows if l.import_batch_id}

    cycles = {}
    if cycle_ids:
        cycles = {
            c.id: c.name
            for c in db.query(LoaCycle).filter(LoaCycle.id.in_(cycle_ids)).all()
        }
    batches = {}
    if batch_ids:
        batches = {
            b.id: b.label
            for b in db.query(ImportBatch).filter(ImportBatch.id.in_(batch_ids)).all()
        }
    return cycles, batches

# ---------------------------------------------------------------------------
# "Most reusable" composite score - used as the default sort in GET /templates
# ---------------------------------------------------------------------------

def _reusable_score(loa: LOA, viewer_cluster: str | None) -> int:
    """Higher = better template candidate. Deterministic, no ML.

    There is no `closed` LOA status — the branch that scored one (+30) was dead.
    `closed` is a *cycle* lifecycle state; an LOA in a closed cycle keeps its own
    terminal status, which is `approved`.
    """
    score = 0
    if loa.status == "approved":
        score += 40
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
    status:        str | None = Query(None, description="approved | rejected | any"),
    fy:            int | None = None,
    sort:          str = Query("newest",
                               regex="^(newest|most_reusable|recently_approved|highest_budget|fy_desc)$"),
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

    # `closed` is a CYCLE state, never an LOA status — the old branches here
    # (and the `IN ('approved','closed')` default) matched 0 rows on the second
    # value. `approved` is the only terminal status a reusable LOA has.
    if status and status != "any":
        q = q.filter(LOA.status == status)
    elif status is None:
        q = q.filter(LOA.status == "approved")

    total = q.count()

    # Newest-first is the DEFAULT branch (shared project rule). The other
    # branches stay available because this list has an explicit user-chosen sort.
    if sort == "highest_budget":
        q = q.order_by(LOA.fy_2026_total.desc().nullslast())
    elif sort == "recently_approved":
        q = q.order_by(LOA.approved_at.desc().nullslast())
    else:
        # newest | fy_desc | most_reusable — all start from newest-first, so
        # `most_reusable` re-ranks a deterministic page instead of an arbitrary one.
        q = newest_first(q, LOA)

    rows = q.offset(offset).limit(limit).all()

    cycle_names, batch_names = _provenance_names(db, rows)

    viewer_cluster = user.role_obj.scope_value if user.role_obj else None
    if sort == "most_reusable":
        rows.sort(key=lambda l: _reusable_score(l, viewer_cluster), reverse=True)

    return {
        "templates":    [
            _template_dto(
                l,
                cycle_name=cycle_names.get(l.cycle_id),
                batch_name=batch_names.get(l.import_batch_id),
            )
            for l in rows
        ],
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
            "status = 'approved'",
        ] + scope_conds

        pool_size = max(body.limit * 6, 30)
        params = {"vec": vec_str, "limit": pool_size, **scope_params}
        where_clause = " AND ".join(where_parts)

        # ── Vector search: pull wide pool, ordered by pure similarity ──
        rows = db.execute(sa_text(f"""
            SELECT id, loa_draft_id, description, activity_type, country,
                   brand, cluster, category, cot, status,
                   fy_2025_total, fy_2026_total,
                   source, cycle_id, import_batch_id, source_file, start_date,
                   q4_2025, q1_2026, q2_2026, q3_2026, q4_2026, created_at,
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

            # Exact-match bonuses (same principle as RAG re-ranking)
            # Check both directions + normalize dashes so "Ray-Ban Meta"
            # matches "HB - Ray-Ban Meta" without needing the "HB" prefix.
            _brand_db = (row.brand or "").lower().replace(" - ", " ").replace("-", " ")
            _brand_q = brief_lower.replace("-", " ")
            _brand_hit = (_brand_db and _brand_db in _brand_q) or (_brand_db and _brand_q and any(w in _brand_db for w in _brand_q.split() if len(w) > 2))
            if row.brand and _brand_hit:
                matched_on.append("brand")
                if _brand_db.strip() == _brand_q.strip() or _brand_q.strip() in _brand_db.strip():
                    score = min(score + 5, 99)
                else:
                    score = min(score + 2, 99)
            if row.country and row.country.lower() in brief_lower:
                matched_on.append("country")
                score = min(score + 2, 99)
            if row.activity_type and row.activity_type.lower() in brief_lower:
                matched_on.append("activity")
                score = min(score + 3, 99)

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

                # ── Provenance (same shape as _template_dto) ──
                "source":          row.source,
                "cycle_id":        str(row.cycle_id) if row.cycle_id else None,
                "cycle_name":      None,   # filled below, one query for the page
                "import_batch_id": str(row.import_batch_id) if row.import_batch_id else None,
                "batch_name":      None,
                "source_file":     row.source_file,
                "period":          _period_of(row),
            })

        # ── Final sort: highest score first, then highest budget for ties ──
        templates.sort(
            key=lambda t: (t["match_score"], t["budget_total"]),
            reverse=True,
        )

        # ── Trim to requested limit ──
        templates = templates[:body.limit]

        # Names for whatever survived the trim, two queries total.
        cycle_names, batch_names = _provenance_names(
            db, [r for r in rows if str(r.id) in {t["id"] for t in templates}]
        )
        for t in templates:
            if t["cycle_id"]:
                t["cycle_name"] = cycle_names.get(uuid.UUID(t["cycle_id"]))
            if t["import_batch_id"]:
                t["batch_name"] = batch_names.get(uuid.UUID(t["import_batch_id"]))

        return {"brief": body.brief, "templates": templates}

    except Exception:
        # ── Fallback: keyword matching if vector search fails ──
        rows = _scope_query(db, user).filter(LOA.status == "approved").all()

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
        cycle_names, batch_names = _provenance_names(db, [t[0] for t in top])
        return {
            "brief": body.brief,
            "templates": [
                _template_dto(
                    loa, match_score=score, matched_on=matched,
                    cycle_name=cycle_names.get(loa.cycle_id),
                    batch_name=batch_names.get(loa.import_batch_id),
                )
                for loa, score, matched in top
            ],
        }
