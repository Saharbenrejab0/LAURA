"""
LAURA — Rock 1: Extend comments table schema

Adds the following columns to the existing `comments` table:
  - anchor_type     (text, NOT NULL, default 'loa')
  - field_key       (text, nullable)
  - parent_comment_id (uuid, nullable, FK to comments.id)
  - visibility      (text, NOT NULL, default 'loa_participants')
  - severity        (text, NOT NULL, default 'note')
  - content_format  (text, NOT NULL, default 'plain_text')
  - content_json    (jsonb, nullable)
  - edited_at       (timestamptz, nullable)
  - deleted_at      (timestamptz, nullable)
  - metadata        (jsonb, NOT NULL, default '{}')

Also makes `section` column nullable (LOA-level comments have section='general').

Creates indexes for efficient querying.

Safe to run multiple times — checks column existence before ALTER.

Usage:
    cd C:\\Users\\sahar\\Desktop\\Laura
    python backend/scripts/migrate_comments_schema.py
"""

import sys
import os

# Ensure project root is on path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from sqlalchemy import text
from backend.models.database import SessionLocal, engine


def column_exists(conn, table: str, column: str) -> bool:
    """Check if a column exists in a PostgreSQL table."""
    result = conn.execute(text(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_name = :table AND column_name = :col"
    ), {"table": table, "col": column})
    return result.fetchone() is not None


def index_exists(conn, index_name: str) -> bool:
    """Check if an index exists."""
    result = conn.execute(text(
        "SELECT 1 FROM pg_indexes WHERE indexname = :name"
    ), {"name": index_name})
    return result.fetchone() is not None


def run():
    print("=" * 60)
    print("LAURA — Comments schema extension (Rock 1)")
    print("=" * 60)

    with engine.connect() as conn:
        # ── New columns ──────────────────────────────────────────

        columns_to_add = [
            ("anchor_type",        "text NOT NULL DEFAULT 'loa'"),
            ("field_key",          "text NULL"),
            ("parent_comment_id",  "uuid NULL REFERENCES comments(id) ON DELETE SET NULL"),
            ("visibility",         "text NOT NULL DEFAULT 'loa_participants'"),
            ("severity",           "text NOT NULL DEFAULT 'note'"),
            ("content_format",     "text NOT NULL DEFAULT 'plain_text'"),
            ("content_json",       "jsonb NULL"),
            ("edited_at",          "timestamptz NULL"),
            ("deleted_at",         "timestamptz NULL"),
            ("metadata",           "jsonb NOT NULL DEFAULT '{}'"),
        ]

        for col_name, col_def in columns_to_add:
            if column_exists(conn, "comments", col_name):
                print(f"  [skip] Column '{col_name}' already exists")
            else:
                stmt = f"ALTER TABLE comments ADD COLUMN {col_name} {col_def}"
                conn.execute(text(stmt))
                print(f"  [add]  Column '{col_name}' added")

        # ── Make section nullable (for LOA-level comments) ────────
        # PostgreSQL: ALTER COLUMN ... DROP NOT NULL
        try:
            conn.execute(text(
                "ALTER TABLE comments ALTER COLUMN section DROP NOT NULL"
            ))
            print("  [fix]  Column 'section' is now nullable")
        except Exception:
            print("  [skip] Column 'section' already nullable or unchanged")

        # ── Set anchor_type for existing rows ─────────────────────
        # Existing rows have section but no anchor_type yet (they were
        # section-level in v1). We treat them as field-level since they
        # were attached to specific sections.
        conn.execute(text("""
            UPDATE comments
            SET anchor_type = 'field',
                field_key = section
            WHERE anchor_type = 'loa'
              AND section IS NOT NULL
              AND section != 'general'
              AND section != 'legacy_cmo_comment'
              AND field_key IS NULL
        """))
        print("  [fix]  Existing rows: anchor_type set to 'field', field_key = section")

        # ── Indexes ───────────────────────────────────────────────

        indexes = [
            ("idx_comments_loa_resolved",  "comments(loa_id, resolved)"),
            ("idx_comments_anchor",        "comments(loa_id, anchor_type, field_key)"),
            ("idx_comments_status",        "comments(loa_id, written_at_status)"),
            ("idx_comments_parent",        "comments(parent_comment_id)"),
            ("idx_comments_created_at",    "comments(created_at)"),
            ("idx_comments_severity",      "comments(loa_id, severity)"),
            ("idx_comments_deleted",       "comments(deleted_at)"),
        ]

        for idx_name, idx_def in indexes:
            if index_exists(conn, idx_name):
                print(f"  [skip] Index '{idx_name}' already exists")
            else:
                conn.execute(text(f"CREATE INDEX {idx_name} ON {idx_def}"))
                print(f"  [add]  Index '{idx_name}' created")

        conn.commit()

    print()
    print("Done. Schema extended successfully.")
    print("Next: run migrate_cmo_comments.py to move legacy blob data.")


if __name__ == "__main__":
    run()
