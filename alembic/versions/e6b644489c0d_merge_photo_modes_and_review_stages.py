"""merge_photo_modes_and_review_stages

Revision ID: e6b644489c0d
Revises: loa_photo_modes_v1, loa_review_stages_v1
Create Date: 2026-08-16 16:25:30.464117

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e6b644489c0d'
down_revision: Union[str, None] = ('loa_photo_modes_v1', 'loa_review_stages_v1')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
