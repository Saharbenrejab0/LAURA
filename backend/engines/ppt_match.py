"""
LAURA — PPT slide ↔ LOA matching engine (Rock 3 v2)
====================================================
Links ppt_slides records to existing LOAs.

Matching hierarchy:
  1. loa_number exact match  → method='loa_number', score=1.0
  2. Weighted fuzzy match     → method='fuzzy',      score=0.0–1.0
     country (0.35) + budget ±5% (0.25) + brand overlap (0.25) +
     activity type (0.15)

SAP codes removed from matching (unreliable — duplicates across LOAs).
"""

from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass
class MatchResult:
    slide_source: str
    slide_index: int
    loa_id: str | None
    score: float
    method: str | None


# ════════════════════════════════════════════════════════════════════════
# Country normalisation
# ════════════════════════════════════════════════════════════════════════

_COUNTRY_ALIASES: dict[str, str] = {
    "nl": "netherlands",
    "north - nl": "netherlands",
    "bnl": "benelux",
    "north - uki": "uki",
    "uki": "uki",
    "uk": "uki",
    "united kingdom": "uki",
    "dach": "dach",
    "germany": "dach",
    "austria": "dach",
    "switzerland": "dach",
    "cz & sk": "czech republic+ slovakia",
    "czsk": "czech republic+ slovakia",
    "czech republic": "czech republic+ slovakia",
    "slovakia": "czech republic+ slovakia",
    "poland & baltics": "poland",
    "jzo poland": "poland",
    "gcc": "gcc",
    "gcc&export": "gcc",
    "gcc & export": "gcc",
    "meta": "meta",
    "meta – gcc + export": "meta",
    "uae": "meta",
    "north - nordics": "nordics",
    "nordics": "nordics",
    "france frames": "france",
    "france lenses essilor": "france",
    "france lenses bbgr nikon": "france",
    "france ps (all bus)": "france",
}


def _norm_country(c: str | None) -> str:
    if not c:
        return ""
    low = c.strip().lower()
    return _COUNTRY_ALIASES.get(low, low)


# ════════════════════════════════════════════════════════════════════════
# Helpers
# ════════════════════════════════════════════════════════════════════════

def _norm(s: str | None) -> str:
    if not s:
        return ""
    return re.sub(r"\s+", " ", s.strip().lower())


def _extract_brand_tokens(brands_str: str | None) -> set[str]:
    if not brands_str:
        return set()
    tokens = set()
    for part in re.split(r"[;,+&|/]", brands_str.lower()):
        cleaned = re.sub(r"^(hb|lb|essilor)\s*[-–:]\s*", "", part.strip())
        cleaned = cleaned.strip()
        if cleaned and len(cleaned) > 1:
            tokens.add(cleaned)
    return tokens


def _budget_similarity(a: float | None, b: float | None) -> float:
    if not a or not b or a <= 0 or b <= 0:
        return 0.0
    ratio = float(min(a, b)) / float(max(a, b))
    if ratio >= 0.95:
        return 1.0
    if ratio >= 0.80:
        return (ratio - 0.80) / 0.15
    return 0.0


# ════════════════════════════════════════════════════════════════════════
# Activity normalisation
# ════════════════════════════════════════════════════════════════════════

_ACTIVITY_MAP = {
    "tailor made permanent": "permanent visibility",
    "tailor made seasonal": "seasonal visibility",
    "tailored made permanent": "permanent visibility",
    "tailored made seasonal": "seasonal visibility",
    "coop advertising": "coop advertising",
    "coop adv": "coop advertising",
    "in store/consumer activation": "in store/consumer activation",
    "in store / consumer activation": "in store/consumer activation",
    "consumer activation": "in store/consumer activation",
    "trade incentive": "trade incentive",
    "sponsorship": "sponsorship",
    "events": "events",
    "commercial events": "events",
    "medical marketing": "medical affairs",
    "medical affairs": "medical affairs",
    "training": "training",
    "e-tools": "e-tools",
    "others": "others (non adv)",
    "other adv. expenses": "other adv",
    "pr": "pr",
}


def _norm_activity(activity: str | None) -> str:
    if not activity:
        return ""
    key = _norm(activity)
    for pattern, canonical in _ACTIVITY_MAP.items():
        if pattern in key:
            return canonical
    return key


# ════════════════════════════════════════════════════════════════════════
# Core matching
# ════════════════════════════════════════════════════════════════════════

def match_slides(
    slides: list[dict],
    loas: list[dict],
    auto_threshold: float = 0.55,
) -> list[MatchResult]:
    """
    Match slide dicts against LOA rows.

    Weights: country 0.35, budget 0.25, brand 0.25, activity 0.15.
    Threshold lowered to 0.55 (country+budget alone = 0.60 → matches).
    """
    by_loa_num: dict[str, dict] = {}
    for loa in loas:
        num = str(loa.get("loa_number") or "").strip()
        if num:
            by_loa_num[num] = loa

    results: list[MatchResult] = []

    for sl in slides:
        if sl.get("page_kind") != "loa":
            results.append(MatchResult(
                slide_source=sl["source_file"],
                slide_index=sl["page_index"],
                loa_id=None, score=0, method=None,
            ))
            continue

        # Priority 1: LOA number exact
        sl_num = str(sl.get("loa_number") or "").strip()
        if sl_num and sl_num in by_loa_num:
            loa = by_loa_num[sl_num]
            results.append(MatchResult(
                slide_source=sl["source_file"],
                slide_index=sl["page_index"],
                loa_id=str(loa["id"]),
                score=1.0,
                method="loa_number",
            ))
            continue

        # Priority 2: Fuzzy weighted match
        best_score = 0.0
        best_loa: dict | None = None

        sl_country = _norm_country(sl.get("country"))
        # Fallback: use first budget line's country
        if not sl_country and sl.get("budget_lines"):
            for bl in (sl["budget_lines"] if isinstance(sl["budget_lines"], list) else []):
                blc = bl.get("country") if isinstance(bl, dict) else None
                if blc:
                    sl_country = _norm_country(blc)
                    break

        sl_budget = sl.get("budget_eur")
        sl_brands = _extract_brand_tokens(sl.get("brands"))
        sl_activity = _norm_activity(sl.get("section_activity"))

        for loa in loas:
            score = 0.0

            # Country (0.35)
            loa_country = _norm_country(loa.get("country"))
            if sl_country and loa_country:
                if sl_country == loa_country:
                    score += 0.35
                elif sl_country in loa_country or loa_country in sl_country:
                    score += 0.20

            # Budget (0.25)
            loa_budget = loa.get("fy_2026_total") or loa.get("fy_total") or 0
            score += 0.25 * _budget_similarity(sl_budget, loa_budget)

            # Brand overlap (0.25)
            loa_brands = _extract_brand_tokens(str(loa.get("brand") or ""))
            if sl_brands and loa_brands:
                overlap = len(sl_brands & loa_brands)
                union = len(sl_brands | loa_brands)
                if union > 0:
                    score += 0.25 * (overlap / union)

            # Activity (0.15)
            loa_activity = _norm_activity(loa.get("activity_type"))
            if sl_activity and loa_activity and sl_activity == loa_activity:
                score += 0.15

            if score > best_score:
                best_score = score
                best_loa = loa

        if best_score >= auto_threshold and best_loa:
            results.append(MatchResult(
                slide_source=sl["source_file"],
                slide_index=sl["page_index"],
                loa_id=str(best_loa["id"]),
                score=round(best_score, 3),
                method="fuzzy",
            ))
        else:
            results.append(MatchResult(
                slide_source=sl["source_file"],
                slide_index=sl["page_index"],
                loa_id=None,
                score=round(best_score, 3),
                method=None,
            ))

    return results
