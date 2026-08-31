"""merge heads — collapse empty v2 branches

Revision ID: f38d3d060ee3
Revises: 23214ae13ff8, a1b2c3d4e5f6
Create Date: 2026-06-08 09:16:16.018917

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f38d3d060ee3'
down_revision: Union[str, None] = ('23214ae13ff8', 'a1b2c3d4e5f6')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass