"""
LAURA — Match inspection tool
==============================
Runs the matching engine in-memory (no DB writes) and prints slide vs
LOA comparisons side-by-side, plus the score breakdown, so we can
eyeball whether the matches are correct before trusting them.

Usage:
    python -m backend.scripts.inspect_matches
    python -m backend.scripts.inspect_matches loa_number     # only test 1
    python -m backend.scripts.inspect_matches fuzzy_high     # only test 2
    python -m backend.scripts.inspect_matches fuzzy_low      # only test 3
    python -m backend.scripts.inspect_matches unmatched      # only test 4
    python -m backend.scripts.inspect_matches popular_loas   # only test 5
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import psycopg2
import psycopg2.extras


DB_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:laura1234@localhost:5432/laura_db",
)


_root = Path(__file__).resolve().parent.parent.parent
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))

from backend.engines.ppt_match import (  # noqa: E402
    match_slides, _norm_country, _extract_brand_tokens,
    _budget_similarity, _norm_activity,
)


# ────────────────────────────────────────────────────────────────────────
# Data loading
# ────────────────────────────────────────────────────────────────────────

def load_data(conn) -> tuple[list[dict], list[dict]]:
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("""
        SELECT source_file, slide_index AS page_index, slide_kind AS page_kind,
               country, budget_eur, brands, section_activity,
               title, loa_number, description, kpi, cost_drill_down,
               budget_lines, tools
        FROM ppt_slides
        WHERE slide_kind = 'loa'
    """)
    slides = [dict(row) for row in cur.fetchall()]

    cur.execute("""
        SELECT id::text AS id, loa_number, country,
               fy_2026_total, brand, activity_type,
               category, cluster, description AS loa_description,
               kpi AS loa_kpi, cost_drill_down AS loa_cdd,
               vendor, customer
        FROM loas
    """)
    loas = [dict(row) for row in cur.fetchall()]
    return slides, loas


# ────────────────────────────────────────────────────────────────────────
# Score breakdown (mirrors ppt_match logic, exposed as details)
# ────────────────────────────────────────────────────────────────────────

def score_breakdown(slide: dict, loa: dict) -> dict:
    sl_country = _norm_country(slide.get("country"))
    if not sl_country and slide.get("budget_lines"):
        for bl in (slide["budget_lines"] if isinstance(slide["budget_lines"], list) else []):
            if isinstance(bl, dict) and bl.get("country"):
                sl_country = _norm_country(bl["country"])
                break
    loa_country = _norm_country(loa.get("country"))
    country_score = 0.0
    if sl_country and loa_country:
        if sl_country == loa_country:
            country_score = 0.35
        elif sl_country in loa_country or loa_country in sl_country:
            country_score = 0.20

    budget_score = 0.25 * _budget_similarity(
        slide.get("budget_eur"), loa.get("fy_2026_total") or 0
    )

    sl_brands = _extract_brand_tokens(slide.get("brands"))
    loa_brands = _extract_brand_tokens(str(loa.get("brand") or ""))
    brand_score = 0.0
    if sl_brands and loa_brands:
        overlap = len(sl_brands & loa_brands)
        union = len(sl_brands | loa_brands)
        if union > 0:
            brand_score = 0.25 * (overlap / union)

    activity_score = 0.0
    sl_activity = _norm_activity(slide.get("section_activity"))
    loa_activity = _norm_activity(loa.get("activity_type"))
    if sl_activity and loa_activity and sl_activity == loa_activity:
        activity_score = 0.15

    total = country_score + budget_score + brand_score + activity_score
    return {
        "country": (round(country_score, 3), sl_country, loa_country),
        "budget": (round(budget_score, 3),
                   slide.get("budget_eur"),
                   float(loa.get("fy_2026_total") or 0)),
        "brand": (round(brand_score, 3), sl_brands, loa_brands),
        "activity": (round(activity_score, 3), sl_activity, loa_activity),
        "total": round(total, 3),
    }


# ────────────────────────────────────────────────────────────────────────
# Pretty-print one comparison
# ────────────────────────────────────────────────────────────────────────

def _short(s, n=60):
    if not s:
        return "—"
    s = str(s).replace("\n", " ")
    return s if len(s) <= n else s[:n] + "…"


def print_comparison(slide: dict, loa: dict, method: str, score: float):
    b = score_breakdown(slide, loa)
    print("─" * 78)
    print(f"METHOD: {method}   SCORE: {score}")
    print(f"  slide: {slide['source_file'][:40]} p{slide['page_index']}")
    print(f"    title:    {_short(slide.get('title'))}")
    print(f"    country:  {slide.get('country'):<20}  brand: {_short(slide.get('brands'), 40)}")
    print(f"    activity: {_short(slide.get('section_activity'), 30):<30}  budget: {slide.get('budget_eur')}")
    print(f"    loa#:     {slide.get('loa_number') or '—'}")
    print(f"    desc:     {_short(slide.get('description'), 90)}")
    print(f"    kpi:      {_short(slide.get('kpi'), 90)}")
    print(f"  LOA:   id={loa['id'][:8]}…  loa_number={loa.get('loa_number') or '—'}")
    print(f"    country:  {loa.get('country'):<20}  brand: {_short(loa.get('brand'), 40)}")
    print(f"    activity: {_short(loa.get('activity_type'), 30):<30}  fy_total: {loa.get('fy_2026_total')}")
    print(f"    customer: {_short(loa.get('customer'), 40)}  vendor: {_short(loa.get('vendor'), 30)}")
    print(f"    desc:     {_short(loa.get('loa_description'), 90)}")
    print(f"    kpi:      {_short(loa.get('loa_kpi'), 90)}")
    print(f"  SCORE BREAKDOWN:")
    print(f"    country  {b['country'][0]}   slide={b['country'][1]!r}   loa={b['country'][2]!r}")
    print(f"    budget   {b['budget'][0]}   slide={b['budget'][1]}   loa={b['budget'][2]}")
    print(f"    brand    {b['brand'][0]}   slide={b['brand'][1]}   loa={b['brand'][2]}")
    print(f"    activity {b['activity'][0]}   slide={b['activity'][1]!r}   loa={b['activity'][2]!r}")
    print(f"    TOTAL    {b['total']}")


# ────────────────────────────────────────────────────────────────────────
# The 5 inspection tests
# ────────────────────────────────────────────────────────────────────────

def test_loa_number(slides, loas, results, limit=5):
    """Show LOA# matches — should be perfect, but verify no year mismatch."""
    print("\n" + "=" * 78)
    print(f"TEST 1: LOA# MATCHES (should be perfect)")
    print("=" * 78)
    loa_by_id = {l["id"]: l for l in loas}
    slide_by_key = {(s["source_file"], s["page_index"]): s for s in slides}
    picked = [r for r in results if r.method == "loa_number"][:limit]
    print(f"showing {len(picked)} of {sum(1 for r in results if r.method == 'loa_number')} LOA# matches\n")
    for r in picked:
        slide = slide_by_key[(r.slide_source, r.slide_index)]
        loa = loa_by_id[r.loa_id]
        print_comparison(slide, loa, r.method, r.score)


def test_fuzzy_high(slides, loas, results, limit=5):
    """High-confidence fuzzy matches (≥0.85) — spot-check the top."""
    print("\n" + "=" * 78)
    print(f"TEST 2: HIGH-CONFIDENCE FUZZY MATCHES (score ≥ 0.85)")
    print("=" * 78)
    loa_by_id = {l["id"]: l for l in loas}
    slide_by_key = {(s["source_file"], s["page_index"]): s for s in slides}
    picked = sorted(
        (r for r in results if r.method == "fuzzy" and r.score >= 0.85),
        key=lambda r: -r.score,
    )[:limit]
    print(f"showing {len(picked)} of {sum(1 for r in results if r.method == 'fuzzy' and r.score >= 0.85)}\n")
    for r in picked:
        slide = slide_by_key[(r.slide_source, r.slide_index)]
        loa = loa_by_id[r.loa_id]
        print_comparison(slide, loa, r.method, r.score)


def test_fuzzy_low(slides, loas, results, limit=8):
    """Borderline fuzzy matches (0.55–0.65) — the dangerous ones."""
    print("\n" + "=" * 78)
    print(f"TEST 3: BORDERLINE FUZZY MATCHES (score 0.55–0.65) — LIKELY FALSE POSITIVES")
    print("=" * 78)
    loa_by_id = {l["id"]: l for l in loas}
    slide_by_key = {(s["source_file"], s["page_index"]): s for s in slides}
    picked = sorted(
        (r for r in results if r.method == "fuzzy" and 0.55 <= r.score < 0.65),
        key=lambda r: r.score,
    )[:limit]
    print(f"showing {len(picked)} of {sum(1 for r in results if r.method == 'fuzzy' and 0.55 <= r.score < 0.65)}\n")
    for r in picked:
        slide = slide_by_key[(r.slide_source, r.slide_index)]
        loa = loa_by_id[r.loa_id]
        print_comparison(slide, loa, r.method, r.score)


def test_unmatched(slides, loas, results, limit=8):
    """Unmatched slides with rich descriptions — what are we losing?"""
    print("\n" + "=" * 78)
    print(f"TEST 4: UNMATCHED SLIDES WITH RICH CONTENT (what we're missing)")
    print("=" * 78)
    slide_by_key = {(s["source_file"], s["page_index"]): s for s in slides}
    picked_keys = [
        (r.slide_source, r.slide_index) for r in results
        if r.method is None and r.slide_source
    ]
    rich = [
        slide_by_key[k] for k in picked_keys
        if slide_by_key[k].get("description")
        and len(slide_by_key[k]["description"]) > 100
    ][:limit]
    print(f"showing {len(rich)} unmatched slides with description > 100 chars\n")
    for s in rich:
        print("─" * 78)
        print(f"  {s['source_file'][:40]} p{s['page_index']}")
        print(f"    title:    {_short(s.get('title'))}")
        print(f"    country:  {s.get('country')}  brand: {_short(s.get('brands'), 40)}")
        print(f"    activity: {_short(s.get('section_activity'), 30)}   budget: {s.get('budget_eur')}")
        print(f"    loa#:     {s.get('loa_number') or '—'}")
        print(f"    desc:     {_short(s.get('description'), 140)}")


def test_popular_loas(slides, loas, results, limit=5):
    """LOAs matched by ≥2 slides — recurring campaigns across decks."""
    print("\n" + "=" * 78)
    print(f"TEST 5: LOAs MATCHED BY MULTIPLE SLIDES (recurring across decks)")
    print("=" * 78)
    from collections import defaultdict
    loa_slides = defaultdict(list)
    for r in results:
        if r.loa_id:
            loa_slides[r.loa_id].append(r)
    popular = sorted(loa_slides.items(), key=lambda x: -len(x[1]))[:limit]
    loa_by_id = {l["id"]: l for l in loas}
    slide_by_key = {(s["source_file"], s["page_index"]): s for s in slides}
    for loa_id, matches in popular:
        if len(matches) < 2:
            continue
        loa = loa_by_id[loa_id]
        print("─" * 78)
        print(f"LOA {loa_id[:8]}…  {loa.get('country')}  {_short(loa.get('brand'), 30)}"
              f"  {_short(loa.get('activity_type'), 20)}  fy_total={loa.get('fy_2026_total')}")
        print(f"  matched by {len(matches)} slides:")
        for r in matches[:5]:
            s = slide_by_key[(r.slide_source, r.slide_index)]
            print(f"    [{r.method} {r.score}] {s['source_file'][:30]} p{s['page_index']}"
                  f" — {_short(s.get('title'), 40)}")


# ────────────────────────────────────────────────────────────────────────
# CLI
# ────────────────────────────────────────────────────────────────────────

def main():
    only = sys.argv[1] if len(sys.argv) > 1 else "all"

    conn = psycopg2.connect(DB_URL)
    slides, loas = load_data(conn)
    print(f"loaded {len(slides)} LOA slides, {len(loas)} LOAs")
    print(f"running match_slides in-memory (no DB writes)...")
    results = match_slides(slides, loas)

    total_matched = sum(1 for r in results if r.loa_id)
    by_method = {}
    for r in results:
        key = r.method or "unmatched"
        by_method[key] = by_method.get(key, 0) + 1
    print(f"\nresult: {total_matched} matched of {len(slides)}")
    for k, v in sorted(by_method.items()):
        print(f"  {k}: {v}")

    tests = {
        "loa_number":   test_loa_number,
        "fuzzy_high":   test_fuzzy_high,
        "fuzzy_low":    test_fuzzy_low,
        "unmatched":    test_unmatched,
        "popular_loas": test_popular_loas,
    }
    if only == "all":
        for fn in tests.values():
            fn(slides, loas, results)
    elif only in tests:
        tests[only](slides, loas, results)
    else:
        print(f"unknown test: {only}. Available: {list(tests)}")
        sys.exit(1)

    conn.close()


if __name__ == "__main__":
    main()
