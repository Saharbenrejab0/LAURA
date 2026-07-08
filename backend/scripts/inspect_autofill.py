"""
LAURA — Autofill inspection tool
=================================
Answers the question: "when I use LOA X as a template, what gets copied?"

Usage:
    python -m backend.scripts.inspect_autofill HIST-64CC9551
    python -m backend.scripts.inspect_autofill LAURA-20260613-DEMO002

Output:
    1. SOURCE       — every field of the LOA that would be used as template
    2. WHAT COPIES  — the fields the duplicate endpoint would carry over
    3. LAURA WOULD SUGGEST — what suggest_fills would propose for empty fields

Read-only: no DB writes, no side effects.
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


# Fields that a duplicate copies (mirrors backend/api/duplicate.py logic).
# If your duplicate.py uses a different list, adjust here.
_DUPLICATED_FIELDS = (
    "cluster", "country", "legal_entity",
    "activity_type", "cot", "capex_opex", "adv_selling",
    "category", "brand", "customer", "vendor",
    "detail", "description", "kpi", "tools",
    "cost_drill_down", "success_criteria",
    "num_doors", "num_customers",
    "cost_split_lenses", "cost_split_frames",
    "forecasted_lenses", "forecasted_frames", "forecasted_instruments",
    "sap_event_code", "event_type", "event_purpose",
    "start_date", "end_date",
    "q4_2025", "q1_2026", "q2_2026", "q3_2026", "q4_2026",
)

# Fields the duplicate does NOT copy — identity, lifecycle, audit
_NOT_DUPLICATED = (
    "id", "loa_draft_id", "status", "requestor_email",
    "created_at", "updated_at", "approved_at",
    "duplicated_from_id", "is_locked", "is_demo",
    "fy_2025_total", "fy_2026_total",   # computed
    "avg_investment_per_door",           # computed
    "ppt_slide_required",                # computed
    "embedding_text", "embedding",       # RAG internals
)


def _fmt(value) -> str:
    if value is None:
        return "—"
    s = str(value).replace("\n", " ")
    return s[:80] + "…" if len(s) > 80 else s


def main():
    if len(sys.argv) < 2:
        print("Usage: python -m backend.scripts.inspect_autofill <LOA_DRAFT_ID>")
        print("Example: python -m backend.scripts.inspect_autofill HIST-64CC9551")
        sys.exit(1)

    loa_ref = sys.argv[1].strip()

    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    # Try loa_draft_id first, then id
    cur.execute("""
        SELECT * FROM loas
        WHERE loa_draft_id = %s OR id::text = %s
        LIMIT 1
    """, (loa_ref, loa_ref))
    loa = cur.fetchone()

    if not loa:
        print(f"LOA not found: {loa_ref}")
        sys.exit(1)

    print("=" * 78)
    print(f"INSPECTING LOA: {loa['loa_draft_id']}")
    print(f"  id: {loa['id']}")
    print(f"  status: {loa['status']}")
    print(f"  cluster/country: {loa.get('cluster')} / {loa.get('country')}")
    print("=" * 78)

    # ── PART 1: SOURCE — everything on the LOA ────────────────────────────
    print("\n" + "─" * 78)
    print("PART 1 — SOURCE VALUES (everything on this LOA)")
    print("─" * 78)

    all_keys = sorted(loa.keys())
    for key in all_keys:
        if key in _NOT_DUPLICATED and key not in ("id", "loa_draft_id", "status"):
            continue  # skip system fields for readability
        value = loa[key]
        marker = " ✓" if key in _DUPLICATED_FIELDS else "  "
        if value not in (None, "", 0):
            print(f"{marker} {key:30s} {_fmt(value)}")

    # ── PART 2: WHAT DUPLICATE WOULD COPY ─────────────────────────────────
    print("\n" + "─" * 78)
    print("PART 2 — WHAT 'Use as template' WOULD COPY (✓ fields)")
    print("─" * 78)

    copied_count = 0
    for field in _DUPLICATED_FIELDS:
        value = loa.get(field)
        if value not in (None, "", 0):
            print(f"  {field:30s} → {_fmt(value)}")
            copied_count += 1

    print(f"\n  {copied_count} fields would be copied to the new draft")

    # ── PART 3: WHAT LAURA WOULD SUGGEST ON TOP ───────────────────────────
    print("\n" + "─" * 78)
    print("PART 3 — WHAT LAURA'S suggest_fills WOULD ADD (empty fields only)")
    print("─" * 78)

    # Simulate: after duplicate, all _DUPLICATED_FIELDS with values are filled
    # For fields that are EMPTY in the source, Laura would search similar
    # approved LOAs (same cluster + activity_type) and propose values

    empty_fields = [
        f for f in _DUPLICATED_FIELDS
        if loa.get(f) in (None, "", 0)
    ]

    if not empty_fields:
        print("  All fields already have values in source. Laura has nothing to add.")
    else:
        print(f"  {len(empty_fields)} fields empty in source: {empty_fields}")
        print()
        print("  Searching similar approved LOAs...")

        cur.execute("""
            SELECT * FROM loas
            WHERE id != %s AND status = 'approved'
              AND cluster = %s
              AND activity_type = %s
            LIMIT 20
        """, (loa['id'], loa.get('cluster'), loa.get('activity_type')))
        similar = cur.fetchall()
        print(f"  Found {len(similar)} similar LOAs (same cluster + activity_type)")

        if similar:
            for field in empty_fields:
                values = [s[field] for s in similar if s.get(field) not in (None, "", 0)]
                if values:
                    from collections import Counter
                    if field in ("description", "detail", "kpi", "cost_drill_down",
                                 "success_criteria", "tools"):
                        # Long text: take the first non-empty
                        proposed = values[0]
                    else:
                        # Categorical: most common
                        proposed = Counter(str(v) for v in values).most_common(1)[0][0]
                    print(f"  + {field:30s} → {_fmt(proposed)} (from {len(values)} similar)")

    print("\n" + "=" * 78)
    print("DONE")
    print("=" * 78)

    conn.close()


if __name__ == "__main__":
    main()
