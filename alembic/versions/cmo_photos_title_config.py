"""cmo: add loa_photo and cycle_title_config tables

Revision ID: cmo_photos_v1
Revises: review_tables_v1
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "cmo_photos_v1"
down_revision = "review_tables_v1"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "loa_photo",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("loa_id", UUID(as_uuid=True), sa.ForeignKey("loas.id", ondelete="CASCADE"), nullable=True),
        sa.Column("cycle_id", UUID(as_uuid=True), sa.ForeignKey("loa_cycle.id", ondelete="CASCADE"), nullable=True),
        sa.Column("category_slug", sa.String(100), nullable=True),
        sa.Column("photo_type", sa.String(50), nullable=False),
        sa.Column("file_path", sa.String(500), nullable=False),
        sa.Column("file_name", sa.String(255), nullable=False),
        sa.Column("mime_type", sa.String(100), nullable=False),
        sa.Column("uploaded_by", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("uploaded_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("width", sa.Integer(), nullable=True),
        sa.Column("height", sa.Integer(), nullable=True),
    )
    op.create_index("ix_loa_photo_loa_id", "loa_photo", ["loa_id"])
    op.create_index("ix_loa_photo_cycle_id", "loa_photo", ["cycle_id"])

    op.create_table(
        "cycle_title_config",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("cycle_id", UUID(as_uuid=True), sa.ForeignKey("loa_cycle.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(500), nullable=True),
        sa.Column("subtitle", sa.String(500), nullable=True),
        sa.Column("year", sa.String(20), nullable=True),
        sa.Column("title_font_size", sa.String(20), nullable=True, server_default="medium"),
        sa.Column("title_color", sa.String(20), nullable=True, server_default="#FFFFFF"),
        sa.Column("subtitle_font_size", sa.String(20), nullable=True, server_default="medium"),
        sa.Column("subtitle_color", sa.String(20), nullable=True, server_default="#FFFFFF"),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
        sa.UniqueConstraint("cycle_id", name="uq_title_config_cycle"),
    )


def downgrade():
    op.drop_table("cycle_title_config")
    op.drop_index("ix_loa_photo_cycle_id", "loa_photo")
    op.drop_index("ix_loa_photo_loa_id", "loa_photo")
    op.drop_table("loa_photo")
