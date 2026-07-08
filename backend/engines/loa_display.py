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


_ACTIVITY_PRETTY = {
    "Seasonal Visibility":  "Seasonal Visibility",
    "Permanent Visibility": "Permanent Visibility",
}

_EVENT_LIKE_ACTIVITIES = {"Events", "Medical Affairs"}


def _format_brands(brand: Any) -> str:
    """List or str -> 'Ray-Ban + Oakley' style string."""
    if not brand:
        return ""
    if isinstance(brand, str):
        return brand
    return " + ".join(str(b) for b in brand if b)


def compute_display_title(loa: Any) -> str:
    """
    Compute the canonical display title for a LOA.
    Accepts either a dict (from API DTOs) or an ORM instance.
    """
    def _get(key: str) -> Any:
        if isinstance(loa, dict):
            return loa.get(key)
        return getattr(loa, key, None)

    activity = (_get("activity_type") or "").strip()
    brand = _format_brands(_get("brand"))
    customer = (_get("customer") or "").strip()

    if not activity:
        return "Untitled LOA"

    activity_pretty = _ACTIVITY_PRETTY.get(activity, activity)

    if activity == "Coop Advertising" and customer:
        return f"{customer} · {activity_pretty}"

    if activity in _EVENT_LIKE_ACTIVITIES:
        return activity_pretty

    if brand:
        return f"{activity_pretty}: {brand}"

    return activity_pretty