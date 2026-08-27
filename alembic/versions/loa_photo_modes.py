"""cycle_title_config: add loa_photo_modes JSON column

Persists the CMO's photo-count intent per LOA (0|1|2) so the Slide setup
panel's photo-count radio survives a hard reload. Additive only.

Revision ID: loa_photo_modes_v1
Revises: photo_crop_zoom_lens_v1
"""
from alembic import op
import sqlalchemy as sa

revision = "loa_photo_modes_v1"
down_revision = "photo_crop_zoom_lens_v1"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "cycle_title_config",
        sa.Column("loa_photo_modes", sa.JSON(), nullable=True),
    )


def downgrade():
    op.drop_column("cycle_title_config", "loa_photo_modes")
