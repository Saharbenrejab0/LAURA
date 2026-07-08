"""
LAURA — PPT deck ingestion runner (Rock 5)
==========================================
Orchestrates the full pipeline: extract → dedup → insert → match → RAG.

Usage:
    python -m backend.scripts.ingest_ppt data/decks/DECK.pptx
    python -m backend.scripts.ingest_ppt data/decks/       # all files in dir

Idempotent: uses UNIQUE(source_file, slide_index) + ON CONFLICT DO UPDATE,
and content_hash for cross-deck deduplication. Safe to re-run on the same
files without creating duplicates.

Requires: DATABASE_URL env var or defaults to local laura_db.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import psycopg2
import psycopg2.extras


# ────────────────────────────────────────────────────────────────────────
# Config
# ────────────────────────────────────────────────────────────────────────

DB_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:laura1234@localhost:5432/laura_db",
)

# ────────────────────────────────────────────────────────────────────────
# Import engines (adjust path for script execution)
# ────────────────────────────────────────────────────────────────────────

_root = Path(__file__).resolve().parent.parent.parent
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))

from backend.engines.deck_extract import extract_deck, deck_report, PageRecord
from backend.engines.ppt_match import match_slides, MatchResult


# ════════════════════════════════════════════════════════════════════════
# Step 1: Insert extracted slides (idempotent via ON CONFLICT)
# ════════════════════════════════════════════════════════════════════════

_INSERT_SQL = """
INSERT INTO ppt_slides (
    source_file, slide_index, slide_kind,
    section_category, section_activity,
    title, country, budget_eur,
    loa_number, sap_event_code,
    description, tools, kpi, cost_drill_down,
    brands, clients, timing,
    budget_lines, photo_count,
    raw_text, content_hash
) VALUES (
    %(source_file)s, %(page_index)s, %(page_kind)s,
    %(section_category)s, %(section_activity)s,
    %(title)s, %(country)s, %(budget_eur)s,
    %(loa_number)s, %(sap_event_code)s,
    %(description)s, %(tools)s, %(kpi)s, %(cost_drill_down)s,
    %(brands)s, %(clients)s, %(timing)s,
    %(budget_lines_json)s, %(photo_count)s,
    %(raw_text)s, %(content_hash)s
)
ON CONFLICT (source_file, slide_index) DO UPDATE SET
    slide_kind       = EXCLUDED.slide_kind,
    section_category = EXCLUDED.section_category,
    section_activity = EXCLUDED.section_activity,
    title            = EXCLUDED.title,
    country          = EXCLUDED.country,
    budget_eur       = EXCLUDED.budget_eur,
    loa_number       = EXCLUDED.loa_number,
    sap_event_code   = EXCLUDED.sap_event_code,
    description      = EXCLUDED.description,
    tools            = EXCLUDED.tools,
    kpi              = EXCLUDED.kpi,
    cost_drill_down  = EXCLUDED.cost_drill_down,
    brands           = EXCLUDED.brands,
    clients          = EXCLUDED.clients,
    timing           = EXCLUDED.timing,
    budget_lines     = EXCLUDED.budget_lines,
    photo_count      = EXCLUDED.photo_count,
    raw_text         = EXCLUDED.raw_text,
    content_hash     = EXCLUDED.content_hash
"""


def insert_slides(conn, records: list[PageRecord]) -> tuple[int, int]:
    """Insert/update slides. Returns (inserted, cross_deck_dupes_skipped)."""
    cur = conn.cursor()

    # Fetch existing hashes to detect cross-deck duplicates
    cur.execute("SELECT content_hash FROM ppt_slides")
    existing_hashes = {row[0] for row in cur.fetchall()}

    inserted = 0
    skipped = 0

    for rec in records:
        # Skip non-LOA separator/overview duplicates across decks
        if rec.page_kind != "loa" and rec.content_hash in existing_hashes:
            skipped += 1
            continue

        params = rec.to_dict()
        params["budget_lines_json"] = json.dumps(params.pop("budget_lines"))
        params.pop("id", None)
        params.pop("loa_id", None)
        params.pop("match_score", None)
        params.pop("match_method", None)
        params.pop("created_at", None)

        cur.execute(_INSERT_SQL, params)
        inserted += 1
        existing_hashes.add(rec.content_hash)

    conn.commit()
    return inserted, skipped


# ════════════════════════════════════════════════════════════════════════
# Step 2: Match slides to LOAs
# ════════════════════════════════════════════════════════════════════════

def run_matching(conn, source_file: str | None = None) -> dict:
    """Match unlinked LOA slides against the loas table."""
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    # Get unmatched LOA slides
    where = "WHERE slide_kind = 'loa' AND loa_id IS NULL"
    if source_file:
        where += " AND source_file = %s"
        cur.execute(f"SELECT * FROM ppt_slides {where}", (source_file,))
    else:
        cur.execute(f"SELECT * FROM ppt_slides {where}")
    slides = [dict(row) for row in cur.fetchall()]

    if not slides:
        return {"matched": 0, "unmatched": 0, "total": 0}

    # Get all LOAs for matching
    cur.execute("""
        SELECT id, loa_number, sap_event_code, country,
               fy_2026_total, brand, activity_type
        FROM loas
    """)
    loas = [dict(row) for row in cur.fetchall()]

    # Adapt slide dicts for the matcher (uses page_index, not slide_index)
    for sl in slides:
        sl["page_index"] = sl["slide_index"]
        sl["page_kind"] = sl["slide_kind"]

    results = match_slides(slides, loas)

    # Apply matches
    matched = 0
    update_cur = conn.cursor()
    for res in results:
        if res.loa_id:
            update_cur.execute("""
                UPDATE ppt_slides
                SET loa_id = %s, match_score = %s, match_method = %s
                WHERE source_file = %s AND slide_index = %s
            """, (res.loa_id, res.score, res.method,
                  res.slide_source, res.slide_index))
            matched += 1

    conn.commit()
    return {
        "total": len(slides),
        "matched": matched,
        "unmatched": len(slides) - matched,
        "by_method": _count_methods(results),
    }


def _count_methods(results: list[MatchResult]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for r in results:
        key = r.method or "unmatched"
        counts[key] = counts.get(key, 0) + 1
    return counts


# ════════════════════════════════════════════════════════════════════════
# Step 3: Enrich LOA embedding_text with PPT content (Rock 4)
# ════════════════════════════════════════════════════════════════════════

def enrich_embeddings(conn) -> int:
    """
    For each matched LOA, append PPT content to embedding_text.
    Only touches LOAs whose embedding_text doesn't already contain [PPT].
    Returns number of LOAs enriched.
    """
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    cur.execute("""
        SELECT ps.loa_id,
               string_agg(
                   COALESCE(ps.description, '') || ' ' ||
                   COALESCE(ps.kpi, '') || ' ' ||
                   COALESCE(ps.cost_drill_down, '') || ' ' ||
                   COALESCE(ps.tools, ''),
                   ' ||| '
               ) AS ppt_content
        FROM ppt_slides ps
        WHERE ps.loa_id IS NOT NULL
          AND ps.slide_kind = 'loa'
        GROUP BY ps.loa_id
    """)
    ppt_by_loa = {str(row["loa_id"]): row["ppt_content"] for row in cur.fetchall()}

    if not ppt_by_loa:
        return 0

    enriched = 0
    update_cur = conn.cursor()
    for loa_id, ppt_text in ppt_by_loa.items():
        ppt_text = ppt_text.strip()
        if not ppt_text:
            continue

        # Check if already enriched
        cur.execute(
            "SELECT embedding_text FROM loas WHERE id = %s",
            (loa_id,),
        )
        row = cur.fetchone()
        if not row or not row["embedding_text"]:
            continue
        existing = row["embedding_text"]
        if "[PPT]" in existing:
            continue

        enriched_text = existing + f"\n\n[PPT] {ppt_text}"
        update_cur.execute(
            "UPDATE loas SET embedding_text = %s WHERE id = %s",
            (enriched_text, loa_id),
        )
        enriched += 1

    conn.commit()
    return enriched


# ════════════════════════════════════════════════════════════════════════
# CLI entry point
# ════════════════════════════════════════════════════════════════════════

def main():
    if len(sys.argv) < 2:
        print("Usage: python -m backend.scripts.ingest_ppt <file_or_dir>")
        sys.exit(1)

    target = Path(sys.argv[1])
    files: list[Path] = []

    if target.is_dir():
        files = sorted(
            p for p in target.iterdir()
            if p.suffix.lower() in (".pptx", ".pdf")
        )
    elif target.is_file():
        files = [target]
    else:
        print(f"Not found: {target}")
        sys.exit(1)

    if not files:
        print("No .pptx or .pdf files found.")
        sys.exit(1)

    conn = psycopg2.connect(DB_URL)
    total_inserted = 0
    total_skipped = 0

    for f in files:
        print(f"\n{'='*60}")
        print(f"Extracting: {f.name}")
        print(f"{'='*60}")

        records = extract_deck(f)
        print(deck_report(records))

        inserted, skipped = insert_slides(conn, records)
        total_inserted += inserted
        total_skipped += skipped
        print(f"DB: {inserted} inserted/updated, {skipped} cross-deck dupes skipped")

    print(f"\n{'='*60}")
    print(f"MATCHING")
    print(f"{'='*60}")
    match_stats = run_matching(conn)
    print(f"total unlinked: {match_stats['total']}")
    print(f"matched: {match_stats['matched']}")
    print(f"unmatched: {match_stats['unmatched']}")
    if "by_method" in match_stats:
        for method, count in match_stats["by_method"].items():
            print(f"  {method}: {count}")

    print(f"\n{'='*60}")
    print(f"RAG ENRICHMENT")
    print(f"{'='*60}")
    enriched = enrich_embeddings(conn)
    print(f"LOAs enriched with [PPT] content: {enriched}")

    conn.close()

    print(f"\n{'='*60}")
    print(f"SUMMARY")
    print(f"{'='*60}")
    print(f"files processed: {len(files)}")
    print(f"slides inserted: {total_inserted}")
    print(f"cross-deck dupes: {total_skipped}")
    print(f"LOAs matched: {match_stats['matched']}")
    print(f"LOAs RAG-enriched: {enriched}")
    print("DONE")


if __name__ == "__main__":
    main()
