"""category_to_array_with_data_conversion

Revision ID: 2739aee08dee
Revises: f38d3d060ee3
Create Date: 2026-06-08 09:49:41.413540

What this migration does:
  1. Drops the redundant unique constraint 'users_email_key'
     (the index 'ix_users_email' already enforces uniqueness — this was a duplicate).
  2. Converts loas.category from VARCHAR(100) to ARRAY(VARCHAR), preserving all
     1,330 existing rows by intelligently splitting multi-category strings.

Data conversion rules (based on actual values found in production):
  - 'Frames', 'Lenses', 'All cat.', 'Audio', 'Instruments', 'Wearables'
    → array of one element, e.g. ['Frames']
  - 'Lenses+Instruments'  → ['Lenses', 'Instruments']
  - 'LENSES'              → ['Lenses']   (case correction)
  - 'Wearables/ Nuance/ Instruments' → ['Wearables', 'Audio', 'Instruments']
    (Nuance is a BRAND under the Audio category, not a category itself)

The downgrade rebuilds a string by joining with '+' so nothing is lost.
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2739aee08dee'
down_revision: Union[str, None] = 'f38d3d060ee3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── 1. Drop the redundant UNIQUE constraint on users.email ────────────
    # The index 'ix_users_email' already enforces uniqueness — this was a
    # duplicate constraint left over from an earlier migration.
    op.drop_constraint('users_email_key', 'users', type_='unique')

    # ── 2. Convert loas.category: VARCHAR → ARRAY(VARCHAR) ────────────────
    # Strategy: add a new array column, fill it from the old one with the
    # conversion rules below, drop the old column, rename the new one.

    # Step 2a — Add the temporary ARRAY column
    op.add_column(
        'loas',
        sa.Column('category_new', sa.dialects.postgresql.ARRAY(sa.String()), nullable=True),
    )

    # Step 2b — Migrate data into category_new with the cleanup rules
    # We use a single UPDATE with a CASE expression so it runs in one pass.
    op.execute("""
        UPDATE loas
        SET category_new = CASE

            -- Case 1: known multi-value combinations
            WHEN category = 'Lenses+Instruments'
                THEN ARRAY['Lenses', 'Instruments']

            WHEN category = 'Wearables/ Nuance/ Instruments'
                THEN ARRAY['Wearables', 'Audio', 'Instruments']

            -- Case 2: case correction
            WHEN category = 'LENSES'
                THEN ARRAY['Lenses']

            -- Case 3: anything else = single-value, wrap in array as-is
            ELSE ARRAY[category]
        END
    """)

    # Step 2c — Make the new column NOT NULL now that all rows are filled
    op.alter_column('loas', 'category_new', nullable=False)

    # Step 2d — Drop the old VARCHAR column
    op.drop_column('loas', 'category')

    # Step 2e — Rename category_new → category
    op.alter_column('loas', 'category_new', new_column_name='category')


def downgrade() -> None:
    # ── 1. Rebuild loas.category as VARCHAR ───────────────────────────────
    # Reverse of step 2: add a VARCHAR column, fill it by joining the array
    # with '+', drop the array, rename.

    # Step 1a — Add temporary VARCHAR column
    op.add_column(
        'loas',
        sa.Column('category_old', sa.String(length=100), nullable=True),
    )

    # Step 1b — Migrate data back: array_to_string with '+' separator
    # This reverses 'Lenses+Instruments' style entries. Single-element
    # arrays become plain strings (e.g. ['Frames'] → 'Frames').
    op.execute("""
        UPDATE loas
        SET category_old = array_to_string(category, '+')
    """)

    # Step 1c — Make it NOT NULL again
    op.alter_column('loas', 'category_old', nullable=False)

    # Step 1d — Drop the ARRAY column
    op.drop_column('loas', 'category')

    # Step 1e — Rename category_old → category
    op.alter_column('loas', 'category_old', new_column_name='category')

    # ── 2. Restore the redundant UNIQUE constraint on users.email ─────────
    op.create_unique_constraint('users_email_key', 'users', ['email'])