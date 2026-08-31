"""Rock 2 prep — Allow multiple permissions per role per status

The old unique constraint uq_role_status only allowed ONE permission per
(role_id, loa_status) pair. The new matrix needs MULTIPLE permissions per
pair (e.g. a marketer gets edit + delete + duplicate on draft).

This migration replaces the constraint:
  OLD: UNIQUE(role_id, loa_status)
  NEW: UNIQUE(role_id, loa_status, permission_id)

Revision ID: rock2_fix_constraint
Revises: rock1_parallel_gates
"""

from alembic import op


revision = 'rock2_fix_constraint'
down_revision = 'rock1_parallel_gates'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint('uq_role_status', 'role_permission', type_='unique')
    op.create_unique_constraint(
        'uq_role_status_perm',
        'role_permission',
        ['role_id', 'loa_status', 'permission_id'],
    )


def downgrade() -> None:
    op.drop_constraint('uq_role_status_perm', 'role_permission', type_='unique')
    op.create_unique_constraint(
        'uq_role_status',
        'role_permission',
        ['role_id', 'loa_status'],
    )
