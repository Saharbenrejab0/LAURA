"""add is_demo flag to loas

Revision ID: a691d6968278
Revises: 2739aee08dee
Create Date: 2026-06-08

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a691d6968278'
down_revision: Union[str, None] = '2739aee08dee'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add is_demo flag. Default false so the 1330 historical LOAs stay
    # marked as production-like data; only LOAs created via the form
    # going forward will be marked as demo.
    op.add_column('loas',
        sa.Column('is_demo', sa.Boolean(), nullable=False, server_default=sa.false())
    )
    op.create_index('ix_loas_is_demo', 'loas', ['is_demo'])


def downgrade() -> None:
    op.drop_index('ix_loas_is_demo', table_name='loas')
    op.drop_column('loas', 'is_demo')