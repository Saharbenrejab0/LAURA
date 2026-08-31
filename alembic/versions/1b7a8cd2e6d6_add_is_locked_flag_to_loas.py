"""add is_locked flag to loas

Revision ID: <ne touche pas, gardé tel quel>
Revises: sprint2_rolepermissions
Create Date: 2026-06-11

Adds a boolean `is_locked` column to the `loas` table.

Purpose:
    Allows a super-admin to lock a LOA against any editing, independently
    of its workflow status. The LOA keeps its real status (e.g. 'country_review')
    so its position in the workflow is preserved, but `is_locked = true`
    blocks any edit attempt.

    When a super-admin unlocks the LOA, `is_locked` returns to false and
    the LOA resumes its normal workflow.
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
# IMPORTANT: Do NOT change the 'revision' value — keep what Alembic generated.
# Just update 'down_revision' to point to our Sprint 2 migration.
revision = '1b7a8cd2e6d6'  # <-- garde ce que Alembic a mis
down_revision = 'sprint2_rolepermissions'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add is_locked column to loas table, default false."""
    op.add_column(
        'loas',
        sa.Column(
            'is_locked',
            sa.Boolean(),
            nullable=False,
            server_default=sa.text('false'),
        ),
    )
    op.create_index('ix_loas_is_locked', 'loas', ['is_locked'])


def downgrade() -> None:
    """Remove is_locked column."""
    op.drop_index('ix_loas_is_locked', 'loas')
    op.drop_column('loas', 'is_locked')