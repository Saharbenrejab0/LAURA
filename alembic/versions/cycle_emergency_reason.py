"""cycle_emergency_reason

Record why an emergency cycle was opened.

Going outside the normal submission window is an exception, and the reason is
the audit trail for it. Nullable because normal cycles never carry one and the
emergency cycles that predate this column have no reason to invent.

Revision ID: cycle_emergency_reason
Revises: reject_flow_v2
Create Date: 2026-08-26
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'cycle_emergency_reason'
down_revision: Union[str, None] = 'reject_flow_v2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('loa_cycle', sa.Column('emergency_reason', sa.String(500), nullable=True))


def downgrade() -> None:
    op.drop_column('loa_cycle', 'emergency_reason')
