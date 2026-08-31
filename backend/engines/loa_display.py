"""
LAURA — LOA display title (single source of truth)
===================================================
Computes the display title used everywhere in the app: Tracker rows,
LOA Detail page header, Past Campaigns cards, and the PPT slide itself.

Rule (mirrors the gold deck spec):
  - Coop Advertising  → '{Customer} · {Activity}'
  - Sponsorship       → '{Brand}: {Subject or Activity}'
  - Events / Medical  → '{Activity Type}'
  - Default           → '{Activity Type}: {Brand}'
"""

from __future__ import annotations

from typing import Any


# Display wording for a stored activity CODE, and which codes are event-like.
#
# Both were Title Case LABELS tested against a column that holds codes, so
# `_ACTIVITY_PRETTY` never hit (titles showed "TM_SEASONAL"), the Coop
# Advertising special case below never fired, and no LOA was ever treated as
# event-like. reference_data is the authority for both.
from backend.reference_data import (
    activity_label as _ref_activity_label,
    EVENT_ACTIVITY_TYPES as _EVENT_ACTIVITY_TYPES,
)

_EVENT_LIKE_ACTIVITIES = set(_EVENT_ACTIVITY_TYPES)


def _format_brands(brand: Any) -> str:
    """List or str -> 'Ray-Ban + Oakley' style string."""
    if not brand:
        return ""
    if isinstance(brand, str):
        return brand
    return " + ".join(str(b) for b in brand if b)


def _line_count(loa: Any) -> int:
    lines = loa.get("lines") if isinstance(loa, dict) else getattr(loa, "lines", None)
    return len(lines) if lines else 0


def compute_display_title(loa: Any) -> str:
    """
    Compute the canonical display title for a LOA.
    Accepts either a dict (from API DTOs) or an ORM instance.

    Multi-row LOAs collapse the varying axis to a count, because the parent's
    own brand / activity_type column is NULL for that axis:
      multi_brand    -> 'Seasonal Visibility: 4 brands'
      multi_activity -> 'Nikon: 3 activity types'
    """
    def _get(key: str) -> Any:
        if isinstance(loa, dict):
            return loa.get(key)
        return getattr(loa, key, None)

    activity = (_get("activity_type") or "").strip()
    brand = _format_brands(_get("brand"))
    customer = (_get("customer") or "").strip()
    loa_type = (_get("loa_type") or "standard").strip()

    if loa_type == "multi_brand":
        n = _line_count(loa)
        label = f"{n} brands" if n != 1 else "1 brand"
        activity_pretty = _ref_activity_label(activity)
        return f"{activity_pretty}: {label}" if activity_pretty else label

    if loa_type == "multi_activity":
        n = _line_count(loa)
        label = f"{n} activity types" if n != 1 else "1 activity type"
        return f"{brand}: {label}" if brand else label

    if not activity:
        return "Untitled LOA"

    activity_pretty = _ref_activity_label(activity)

    if activity == "COOP_ADVERTISING" and customer:
        return f"{customer} · {activity_pretty}"

    if activity in _EVENT_LIKE_ACTIVITIES:
        return activity_pretty

    if brand:
        return f"{activity_pretty}: {brand}"

    return activity_pretty