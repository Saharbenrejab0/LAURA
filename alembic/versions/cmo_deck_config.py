"""cmo: add divider_style + overview_layouts to cycle_title_config

Revision ID: cmo_deck_cfg_v1
Revises: cmo_photos_v1
"""
from alembic import op
import sqlalchemy as sa

revision = "cmo_deck_cfg_v1"
down_revision = "cmo_photos_v1"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "cycle_title_config",
        sa.Column("divider_style", sa.String(20), nullable=True, server_default="black"),
    )
    op.add_column(
        "cycle_title_config",
        sa.Column("overview_layouts", sa.JSON(), nullable=True),
    )


def downgrade():
    op.drop_column("cycle_title_config", "overview_layouts")
    op.drop_column("cycle_title_config", "divider_style")
