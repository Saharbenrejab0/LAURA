"""photo crop/zoom + lens slide configs

Adds focal_x, focal_y, zoom columns to loa_photo (persisted crop/pan/zoom per photo)
and lens_configs JSON to cycle_title_config (per-category lens column definitions).

Revision ID: photo_crop_zoom_lens_v1
Revises: cmo_deck_config
"""
from alembic import op
import sqlalchemy as sa

revision = "photo_crop_zoom_lens_v1"
down_revision = "cmo_deck_cfg_v1"
branch_labels = None
depends_on = None


def upgrade():
    # Photo crop/pan/zoom fields
    op.add_column("loa_photo", sa.Column("focal_x", sa.Float(), nullable=True, server_default="0.5"))
    op.add_column("loa_photo", sa.Column("focal_y", sa.Float(), nullable=True, server_default="0.5"))
    op.add_column("loa_photo", sa.Column("zoom",    sa.Float(), nullable=True, server_default="1.0"))

    # Lens slide column configs per category (overview + investment templates)
    op.add_column("cycle_title_config", sa.Column("lens_configs", sa.JSON(), nullable=True))


def downgrade():
    op.drop_column("cycle_title_config", "lens_configs")
    op.drop_column("loa_photo", "zoom")
    op.drop_column("loa_photo", "focal_y")
    op.drop_column("loa_photo", "focal_x")
