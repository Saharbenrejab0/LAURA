"""
LAURA — Rock 1: Migrate cmo_comment blobs → comments table

Reads every LOA that has a non-empty `cmo_comment` text column,
parses the blob (entries separated by \\n---\\n or \\n\\n---\\n\\n),
and inserts each entry as a proper row in the `comments` table.

Migrated comments get:
  - anchor_type  = 'loa'          (the old system was LOA-level)
  - field_key    = NULL
  - section      = 'legacy_cmo_comment'
  - visibility   = 'loa_participants'
  - severity     = 'note'
  - written_at_status = 'cmo_cfo_review'  (the column was named cmo_comment)
  - metadata     = {"migrated_from": "loas.cmo_comment", ...}

Safe to run multiple times — checks if a blob was already migrated
by looking for existing comments with section = 'legacy_cmo_comment'
for that LOA.

Usage:
    cd C:\\Users\\sahar\\Desktop\\Laura
    python backend/scripts/migrate_cmo_comments.py
"""

import re
import sys
import os
import uuid
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from sqlalchemy import text
from backend.models.database import SessionLocal


# ── Parsing ───────────────────────────────────────────────────────────────

# Pattern: [12 Mar 2026 14:30] email@domain.com:\ncontent
HEADER_RE = re.compile(
    r"^\[([^\]]+)\]\s+([^\s:]+@[^\s:]+):\s*\n?([\s\S]*)",
    re.MULTILINE,
)

# Alternate pattern: email@domain.com — content (simpler format seen in some blobs)
SIMPLE_RE = re.compile(
    r"^([^\s:]+@[^\s:]+)\s*[-–—:]\s*([\s\S]+)",
    re.MULTILINE,
)


def parse_blob(blob: str) -> list[dict]:
    """
    Parse a cmo_comment blob into a list of comment dicts.

    Tries multiple separators because different code paths used different
    formats historically.
    """
    if not blob or not blob.strip():
        return []

    # Try splitting by \n---\n first, then \n\n---\n\n
    entries = re.split(r"\n+\s*---\s*\n+", blob.strip())
    if len(entries) == 1 and "---" not in blob:
        # Single comment, no separator
        entries = [blob.strip()]

    results = []
    for raw in entries:
        raw = raw.strip()
        if not raw:
            continue

        entry = _parse_single(raw)
        results.append(entry)

    return results


def _parse_single(raw: str) -> dict:
    """Parse one comment entry from a blob."""
    # Try header format: [timestamp] email:\ncontent
    m = HEADER_RE.match(raw)
    if m:
        timestamp_str, email, content = m.groups()
        return {
            "author_email": email.strip(),
            "content": content.strip(),
            "timestamp_raw": timestamp_str.strip(),
            "created_at": _parse_timestamp(timestamp_str.strip()),
            "parse_ok": True,
        }

    # Try simple format: email — content
    m = SIMPLE_RE.match(raw)
    if m:
        email, content = m.groups()
        return {
            "author_email": email.strip(),
            "content": content.strip(),
            "timestamp_raw": None,
            "created_at": None,
            "parse_ok": True,
        }

    # Fallback: couldn't parse author/timestamp, keep as-is
    return {
        "author_email": "unknown@legacy",
        "content": raw,
        "timestamp_raw": None,
        "created_at": None,
        "parse_ok": False,
    }


def _parse_timestamp(s: str) -> datetime | None:
    """Try common timestamp formats."""
    for fmt in [
        "%d %b %Y %H:%M",      # 12 Mar 2026 14:30
        "%d %b %Y %H:%M:%S",   # 12 Mar 2026 14:30:00
        "%Y-%m-%d %H:%M",      # 2026-03-12 14:30
        "%Y-%m-%d %H:%M:%S",   # 2026-03-12 14:30:00
        "%d/%m/%Y %H:%M",      # 12/03/2026 14:30
    ]:
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue
    return None


# ── User resolution ───────────────────────────────────────────────────────

def resolve_user(db, email: str) -> dict:
    """Try to find the user in DB to get their name and role."""
    row = db.execute(text(
        "SELECT full_name, email FROM users WHERE email = :email"
    ), {"email": email}).fetchone()

    if row:
        return {"name": row[0] or email.split("@")[0], "email": row[1]}

    # Try matching by email prefix (some old data might have different domains)
    prefix = email.split("@")[0]
    row = db.execute(text(
        "SELECT full_name, email FROM users WHERE email LIKE :prefix"
    ), {"prefix": f"{prefix}@%"}).fetchone()

    if row:
        return {"name": row[0] or prefix, "email": row[1]}

    return {"name": email.split("@")[0], "email": email}


def resolve_role(db, email: str) -> str:
    """Try to find the user's role display name."""
    try:
        row = db.execute(text(
            "SELECT role FROM users WHERE email = :email"
        ), {"email": email}).fetchone()
        if row and row[0]:
            return row[0]
    except Exception:
        pass
    return "legacy"


# ── Main migration ────────────────────────────────────────────────────────

def run():
    print("=" * 60)
    print("LAURA — cmo_comment blob migration (Rock 1)")
    print("=" * 60)

    db = SessionLocal()

    try:
        # Find all LOAs with cmo_comment data
        rows = db.execute(text(
            "SELECT id, loa_draft_id, cmo_comment, status "
            "FROM loas "
            "WHERE cmo_comment IS NOT NULL AND cmo_comment != ''"
        )).fetchall()

        print(f"\nFound {len(rows)} LOAs with cmo_comment data.\n")

        total_migrated = 0
        total_skipped = 0

        for loa_id, draft_id, blob, loa_status in rows:
            # Check if already migrated
            existing = db.execute(text(
                "SELECT COUNT(*) FROM comments "
                "WHERE loa_id = :loa_id AND section = 'legacy_cmo_comment'"
            ), {"loa_id": loa_id}).scalar()

            if existing > 0:
                print(f"  [{draft_id}] Already migrated ({existing} comments). Skipping.")
                total_skipped += 1
                continue

            # Parse the blob
            entries = parse_blob(blob)
            print(f"  [{draft_id}] Parsed {len(entries)} comments from blob")

            for i, entry in enumerate(entries):
                user_info = resolve_user(db, entry["author_email"])
                role_name = resolve_role(db, user_info["email"])

                comment_id = str(uuid.uuid4())
                created_at = entry["created_at"] or datetime.utcnow()

                db.execute(text("""
                    INSERT INTO comments (
                        id, loa_id, anchor_type, field_key, section,
                        author_email, author_name, author_role,
                        content, content_format, written_at_status,
                        visibility, severity,
                        resolved, created_at, metadata
                    ) VALUES (
                        :id, :loa_id, 'loa', NULL, 'legacy_cmo_comment',
                        :email, :name, :role,
                        :content, 'plain_text', :status,
                        'loa_participants', 'note',
                        false, :created_at, :metadata
                    )
                """), {
                    "id": comment_id,
                    "loa_id": loa_id,
                    "email": user_info["email"],
                    "name": user_info["name"],
                    "role": role_name,
                    "content": entry["content"],
                    "status": "cmo_cfo_review",
                    "created_at": created_at,
                    "metadata": str({
                        "migrated_from": "loas.cmo_comment",
                        "parse_ok": entry["parse_ok"],
                        "timestamp_raw": entry["timestamp_raw"],
                        "entry_index": i,
                        "source_loa_draft_id": draft_id,
                    }).replace("'", '"').replace("True", "true").replace("False", "false"),
                })

                status_icon = "✓" if entry["parse_ok"] else "⚠"
                print(f"    {status_icon} [{user_info['email']}] {entry['content'][:60]}...")
                total_migrated += 1

        db.commit()

        print(f"\n{'=' * 60}")
        print(f"Migration complete.")
        print(f"  Migrated:  {total_migrated} comments from {len(rows) - total_skipped} LOAs")
        print(f"  Skipped:   {total_skipped} LOAs (already migrated)")
        print(f"\nNext steps:")
        print(f"  1. Verify: SELECT * FROM comments WHERE section = 'legacy_cmo_comment';")
        print(f"  2. Once confirmed, the old cmo_comment column can be dropped later.")
        print(f"  3. Do NOT drop it now — keep it as backup for one release cycle.")

    except Exception as e:
        db.rollback()
        print(f"\n!! Migration failed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run()
