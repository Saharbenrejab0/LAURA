"""
LAURA — Rock 1 verification

Run after the schema extension + blob migration to confirm everything is clean.

Usage:
    cd C:\\Users\\sahar\\Desktop\\Laura
    python backend/scripts/verify_rock1.py
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from sqlalchemy import text
from backend.models.database import engine


def run():
    print("=" * 60)
    print("LAURA — Rock 1 verification")
    print("=" * 60)

    with engine.connect() as conn:
        # 1. Check all expected columns exist
        print("\n1. Checking columns on comments table...")
        expected_cols = {
            "id", "loa_id", "anchor_type", "field_key", "section",
            "parent_comment_id",
            "author_email", "author_name", "author_role",
            "content", "content_format", "content_json",
            "written_at_status",
            "visibility", "severity",
            "resolved", "resolved_at", "resolved_by",
            "created_at", "edited_at", "deleted_at",
            "metadata",
        }
        result = conn.execute(text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_name = 'comments'"
        ))
        actual_cols = {row[0] for row in result}
        missing = expected_cols - actual_cols
        extra = actual_cols - expected_cols

        if missing:
            print(f"   MISSING columns: {missing}")
        else:
            print(f"   All {len(expected_cols)} expected columns present")
        if extra:
            print(f"   Extra columns (ok): {extra}")

        # 2. Check indexes
        print("\n2. Checking indexes...")
        expected_idx = {
            "idx_comments_loa_resolved",
            "idx_comments_anchor",
            "idx_comments_status",
            "idx_comments_parent",
            "idx_comments_created_at",
            "idx_comments_severity",
            "idx_comments_deleted",
        }
        result = conn.execute(text(
            "SELECT indexname FROM pg_indexes WHERE tablename = 'comments'"
        ))
        actual_idx = {row[0] for row in result}
        missing_idx = expected_idx - actual_idx
        if missing_idx:
            print(f"   MISSING indexes: {missing_idx}")
        else:
            print(f"   All {len(expected_idx)} expected indexes present")

        # 3. Check comment counts
        print("\n3. Comment data summary...")
        total = conn.execute(text("SELECT COUNT(*) FROM comments")).scalar()
        print(f"   Total comments: {total}")

        by_anchor = conn.execute(text(
            "SELECT anchor_type, COUNT(*) FROM comments GROUP BY anchor_type"
        )).fetchall()
        for anchor, count in by_anchor:
            print(f"   anchor_type='{anchor}': {count}")

        by_section = conn.execute(text(
            "SELECT section, COUNT(*) FROM comments GROUP BY section ORDER BY COUNT(*) DESC"
        )).fetchall()
        for section, count in by_section:
            print(f"   section='{section}': {count}")

        by_severity = conn.execute(text(
            "SELECT severity, COUNT(*) FROM comments GROUP BY severity"
        )).fetchall()
        for sev, count in by_severity:
            print(f"   severity='{sev}': {count}")

        migrated = conn.execute(text(
            "SELECT COUNT(*) FROM comments WHERE section = 'legacy_cmo_comment'"
        )).scalar()
        print(f"   Migrated from cmo_comment blob: {migrated}")

        # 4. Check old cmo_comment blobs still exist (backup)
        print("\n4. Legacy cmo_comment backup check...")
        n_blob = conn.execute(text(
            "SELECT COUNT(*) FROM loas WHERE cmo_comment IS NOT NULL AND cmo_comment != ''"
        )).scalar()
        print(f"   LOAs with cmo_comment blob (backup): {n_blob}")

        # 5. Summary
        print("\n" + "=" * 60)
        if not missing and not missing_idx:
            print("Rock 1 verification: PASSED")
        else:
            print("Rock 1 verification: ISSUES FOUND (see above)")
        print("=" * 60)


if __name__ == "__main__":
    run()
