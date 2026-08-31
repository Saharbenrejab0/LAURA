"""
LAURA — Generate embedding_text for all LOAs
=============================================
Builds a natural-language "document" for each LOA that captures its
semantic meaning. This text will later be vectorized by sentence-transformers
for similarity search.

Usage:
    cd C:\\Users\\sahar\\Desktop\\Laura
    python scripts/generate_embedding_text.py --dry-run    (preview 5 examples)
    python scripts/generate_embedding_text.py              (update all LOAs)
    python scripts/generate_embedding_text.py --force      (regenerate even if already set)
"""

import argparse
import sys
from datetime import datetime
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from backend.models.database import SessionLocal
from backend.models.loa import LOA


def build_embedding_text(loa):
    """Build a natural-language document from a LOA's fields.

    Design principles:
    - Include every field that a user might search by (brand, country, activity, budget, KPI...)
    - Skip empty fields silently (no "N/A" or "unknown" — those pollute semantic space)
    - Use natural language, not key:value pairs (embeddings understand prose better)
    - Keep it concise (~50-200 words) to stay within the model's sweet spot
    """
    parts = []

    # ── Line 1: Identity (always present) ──
    brand = loa.brand or "Unknown brand"
    activity = loa.activity_type or "activity"
    country = loa.country or ""
    cluster = loa.cluster or ""

    geo = f"in {country}" if country else ""
    if cluster and cluster != country:
        geo += f" ({cluster})" if geo else f"in {cluster}"

    parts.append(f"{brand} {activity} {geo}.".strip())

    # ── Line 2: Category + COT + Customer ──
    cat_parts = []
    if loa.category:
        cat_val = loa.category if isinstance(loa.category, str) else ", ".join(loa.category)
        cat_parts.append(f"Category: {cat_val}")
    if loa.cot:
        cat_parts.append(f"Channel: {loa.cot}")
    if loa.customer:
        cat_parts.append(f"Customer: {loa.customer}")
    if cat_parts:
        parts.append(". ".join(cat_parts) + ".")

    # ── Line 3: Budget ──
    fy_total = loa.fy_2025_total or loa.fy_2026_total or loa.fy_2024_total or 0
    fy_label = "FY2025" if loa.fy_2025_total else ("FY2026" if loa.fy_2026_total else "FY2024")
    if fy_total > 0:
        budget_line = f"Budget: EUR {fy_total:,.0f} ({fy_label})"
        if loa.num_doors and loa.num_doors > 0:
            budget_line += f" across {loa.num_doors} doors"
        budget_line += "."
        parts.append(budget_line)

    # ── Line 4: Event type (if applicable) ──
    if loa.event_type:
        parts.append(f"Event type: {loa.event_type}.")

    # ── Line 5: Description (the richest semantic field) ──
    if loa.description and loa.description.strip():
        parts.append(loa.description.strip())

    # ── Line 6: Detail (often complementary to description) ──
    if loa.detail and loa.detail.strip():
        det = loa.detail.strip()
        # Avoid duplicating if detail == description
        if not loa.description or det.lower() != loa.description.strip().lower():
            parts.append(det)

    # ── Line 7: KPI ──
    if loa.kpi and loa.kpi.strip():
        parts.append(f"KPI: {loa.kpi.strip()}")

    # ── Line 8: Cost rationale ──
    if loa.cost_justification and loa.cost_justification.strip():
        parts.append(f"Cost rationale: {loa.cost_justification.strip()}")

    # ── Line 9: Vendor ──
    if loa.vendor and loa.vendor.strip():
        parts.append(f"Vendor: {loa.vendor.strip()}.")

    # ── Line 10: Finance metadata ──
    fin_parts = []
    if loa.capex_opex:
        fin_parts.append(loa.capex_opex)
    if loa.adv_selling:
        fin_parts.append(loa.adv_selling)
    if fin_parts:
        parts.append(f"Finance: {', '.join(fin_parts)}.")

    text = " ".join(parts)

    # Trim to ~1500 chars max (embeddings degrade on very long texts)
    if len(text) > 1500:
        text = text[:1497] + "..."

    return text


def main():
    parser = argparse.ArgumentParser(description="Generate embedding_text for LOAs")
    parser.add_argument("--dry-run", action="store_true", help="Preview 5 examples without updating")
    parser.add_argument("--force", action="store_true", help="Regenerate even if already set")
    args = parser.parse_args()

    db = SessionLocal()

    if args.force:
        query = db.query(LOA)
    else:
        query = db.query(LOA).filter(LOA.embedding_text == None)

    total = query.count()
    print(f"LOAs to process: {total}")

    if args.dry_run:
        # ── LIVE MODE: process in batches to avoid cursor invalidation ──
       updated = 0
       batch_size = 200
       while True:
         batch = db.query(LOA).filter(LOA.embedding_text == None).limit(batch_size).all()
         if not batch:
            break
         for loa in batch:
            loa.embedding_text = build_embedding_text(loa)
            updated += 1
         db.commit()
         print(f"  ... {updated}/{total}")

       db.close()
       print(f"\nDone. Updated {updated} LOAs with embedding_text.") 


if __name__ == "__main__":
    main()
