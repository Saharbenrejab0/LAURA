"""wf3: local_alignment status + loa cycles + emergency flag

Adds:
  - 'local_alignment' status value (marketer submits -> finance/procurement/
    compliance comment -> then emea_review)
  - loa_cycle table (normal/emergency kickoff windows with start/end dates)
  - loas.cycle_id, loas.is_emergency

Revision ID: wf3_local_align_cycles
Revises: rock5_comment_pins
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
import uuid

revision = "wf3_local_align_cycles"
down_revision = "rock5_comment_pins"
branch_labels = None
depends_on = None


def upgrade():
    # 1. loa_cycle table -------------------------------------------------
    op.create_table(
        "loa_cycle",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("cycle_type", sa.String(20), nullable=False, server_default="normal"),  # normal | emergency
        sa.Column("start_date", sa.DateTime(), nullable=False),
        sa.Column("end_date", sa.DateTime(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_by", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )

    # 2. loas new columns ------------------------------------------------
    op.add_column("loas", sa.Column("cycle_id", UUID(as_uuid=True), nullable=True))
    op.add_column("loas", sa.Column("is_emergency", sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.create_foreign_key(
        "fk_loas_cycle_id", "loas", "loa_cycle",
        ["cycle_id"], ["id"], ondelete="SET NULL",
    )

    # 3. local_alignment gate flags on loas (like brand/function gates) --
    # finance / procurement / compliance each must comment before emea_review
    op.add_column("loas", sa.Column("finance_review_done", sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.add_column("loas", sa.Column("procurement_review_done", sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.add_column("loas", sa.Column("compliance_review_done", sa.Boolean(), nullable=False, server_default=sa.text("false")))

    # NOTE: the 'local_alignment' status value is a plain string in the
    # loas.status column (String, not a native PG enum), so no ALTER TYPE
    # is needed. The LOAStatus Python enum is updated in code separately.


def downgrade():
    op.drop_column("loas", "compliance_review_done")
    op.drop_column("loas", "procurement_review_done")
    op.drop_column("loas", "finance_review_done")
    op.drop_constraint("fk_loas_cycle_id", "loas", type_="foreignkey")
    op.drop_column("loas", "is_emergency")
    op.drop_column("loas", "cycle_id")
    op.drop_table("loa_cycle")
