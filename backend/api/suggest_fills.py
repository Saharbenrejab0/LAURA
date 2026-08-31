"""
LAURA - Laura suggest-fills endpoint  (slice 3)

POST /loa/{loa_id}/suggest-fills
    For each empty field on the draft, find the most likely value from
    similar past LOAs in the user's cluster. Returns a list of
    suggestions with confidence + source count.

MVP: structured-field similarity (same cluster + activity_type + brand).
For text fields like description / kpi, returns the value from the single
closest match. A real RAG retriever plugs in here later without changing
the contract.
"""
from __future__ import annotations

from collections import Counter
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.api.auth import get_current_user
from backend.models.database import get_db
from backend.models.loa import LOA
from backend.models.user import User

router = APIRouter()


# Fields Laura is allowed to suggest values for. Skip identity, lifecycle,
# audit. Skip financial totals (those are computed). Keep classification +
# qualitative content.
_SUGGESTABLE_FIELDS = (
    "description", "detail", "kpi", "success_criteria",
    "activity_type", "brand", "category", "cot",
    "capex_opex", "adv_selling",
    "cluster", "country", "legal_entity",
)


@router.post("/loa/{loa_id}/suggest-fills")
def suggest_fills(
    loa_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Return a list of {field, value, source_count, confidence}."""
    loa = db.query(LOA).filter(LOA.id == loa_id).first()
    if not loa:
        raise HTTPException(status_code=404, detail="LOA not found")

    # Pool of comparable past LOAs - same cluster as the draft, approved.
    comparable_q = (
        db.query(LOA)
          .filter(LOA.id != loa.id)
          .filter(LOA.status == "approved")
    )
    if loa.cluster:
        comparable_q = comparable_q.filter(LOA.cluster == loa.cluster)
    # Narrow further if we already know the activity_type
    if loa.activity_type:
        comparable_q = comparable_q.filter(LOA.activity_type == loa.activity_type)

    similar = comparable_q.limit(50).all()

    suggestions: list[dict[str, Any]] = []
    for field in _SUGGESTABLE_FIELDS:
        current = getattr(loa, field, None)
        if not _is_empty(current):
            continue
        if not similar:
            continue

        suggestion = _propose(field, similar)
        if suggestion is None:
            continue
        suggestions.append(suggestion)

    return {
        "loa_id": str(loa.id),
        "source_pool_size": len(similar),
        "suggestions": suggestions,
    }


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _is_empty(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, str) and not value.strip():
        return True
    if isinstance(value, (list, tuple)) and len(value) == 0:
        return True
    return False


def _propose(field: str, pool: list[LOA]) -> dict[str, Any] | None:
    """
    Return a suggestion for `field` based on `pool`.
    Strategy:
      - For categorical / short fields: most common value wins.
      - For long text (description, detail, kpi, success_criteria): pick
        the first non-empty one from the closest match (the pool is
        already ordered by recency since we didn't sort).
    """
    values = [getattr(p, field, None) for p in pool]
    values = [v for v in values if not _is_empty(v)]
    if not values:
        return None

    is_long_text = field in ("description", "detail", "kpi", "success_criteria")

    if is_long_text:
        chosen = values[0]
        return {
            "field": field,
            "value": chosen,
            "source_count": len(values),
            "confidence": "low" if len(values) < 3 else "medium",
            "kind": "text",
        }

    # Categorical: most common value
    if isinstance(values[0], list):
        # Flatten lists (category is multi-value) and pick top
        flat: list[str] = []
        for v in values:
            flat.extend(v)
        counter = Counter(flat)
        top = counter.most_common(3)
        chosen_list = [t[0] for t in top if t[1] >= 2] or [top[0][0]]
        return {
            "field": field,
            "value": chosen_list,
            "source_count": len(values),
            "confidence": "high" if top[0][1] >= len(values) * 0.6 else "medium",
            "kind": "list",
        }

    counter = Counter(values)
    top_value, top_count = counter.most_common(1)[0]
    confidence = (
        "high"   if top_count >= len(values) * 0.7
        else "medium" if top_count >= len(values) * 0.4
        else "low"
    )
    return {
        "field": field,
        "value": top_value,
        "source_count": len(values),
        "confidence": confidence,
        "kind": "scalar",
    }
