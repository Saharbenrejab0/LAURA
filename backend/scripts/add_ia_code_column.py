"""
LAURA — Add ia_code column to the loas table (Corporate Review, Task 5).

Stores the sequential IA code (format 2026-XXXX) assigned when a corporate
reviewer approves a LOA.

Safe to run multiple times — checks column existence before ALTER.

Usage:
    cd C:\\Users\\sahar\\Desktop\\Laura
    python backend/scripts/add_ia_code_column.py
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from sqlalchemy import text
from backend.models.database import engine


def run():
    print("LAURA — add loas.ia_code")
    with engine.connect() as conn:
        exists = conn.execute(text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_name = 'loas' AND column_name = 'ia_code'"
        )).fetchone()
        if exists:
            print("  [skip] Column 'ia_code' already exists")
        else:
            conn.execute(text("ALTER TABLE loas ADD COLUMN ia_code VARCHAR(20)"))
            print("  [add]  Column 'ia_code' added")
        conn.commit()
    print("Done.")


if __name__ == "__main__":
    run()
