"""reject_flow_v2

Add two columns to `loas`:
  - rejected_by_stage   VARCHAR(50)  — records which workflow stage originated a rejection/return
  - duplicated_from_id  UUID         — audit trail link to the source LOA when duplicated

Revision ID: reject_flow_v2
Revises: multi_loa_lines
Create Date: 2026-08-26
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'reject_flow_v2'
down_revision: Union[str, None] = 'multi_loa_lines'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('loas', sa.Column('rejected_by_stage', sa.String(50), nullable=True))
    op.add_column('loas', sa.Column('duplicated_from_id', postgresql.UUID(as_uuid=True), nullable=True))


def downgrade() -> None:
    op.drop_column('loas', 'duplicated_from_id')
    op.drop_column('loas', 'rejected_by_stage')
