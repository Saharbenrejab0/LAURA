"""review: add ReviewMode, ReviewVerdict, ReviewComment, ReviewSubmission tables

Revision ID: review_tables_v1
Revises: wf3_local_align_cycles
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "review_tables_v1"
down_revision = "wf3_local_align_cycles"
branch_labels = None
depends_on = None


def upgrade():
    # review_mode — maps role name to UI mode (slideshow|board|list)
    op.create_table(
        "review_mode",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("role_name", sa.String(100), nullable=False, unique=True),
        sa.Column("mode", sa.String(20), nullable=False, server_default="slideshow"),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_by", sa.String(255), nullable=True),
    )

    # review_verdict — per-LOA approve/reject decision
    op.create_table(
        "review_verdict",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("cycle_id", UUID(as_uuid=True), sa.ForeignKey("loa_cycle.id", ondelete="CASCADE"), nullable=False),
        sa.Column("loa_id", UUID(as_uuid=True), sa.ForeignKey("loas.id", ondelete="CASCADE"), nullable=False),
        sa.Column("reviewer_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("decision", sa.String(20), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("cycle_id", "loa_id", "reviewer_id", name="uq_verdict_cycle_loa_reviewer"),
    )

    # review_comment — comment pinned to a slide
    op.create_table(
        "review_comment",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("cycle_id", UUID(as_uuid=True), sa.ForeignKey("loa_cycle.id", ondelete="CASCADE"), nullable=False),
        sa.Column("slide_id", sa.String(100), nullable=False),
        sa.Column("author_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_review_comment_cycle_slide", "review_comment", ["cycle_id", "slide_id"])

    # review_submission — marks reviewer's pass as final
    op.create_table(
        "review_submission",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("cycle_id", UUID(as_uuid=True), sa.ForeignKey("loa_cycle.id", ondelete="CASCADE"), nullable=False),
        sa.Column("reviewer_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("submitted_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("summary", sa.JSON(), nullable=True),
        sa.UniqueConstraint("cycle_id", "reviewer_id", name="uq_submission_cycle_reviewer"),
    )

    # seed default review modes for known roles
    op.execute("""
        INSERT INTO review_mode (id, role_name, mode)
        VALUES
            (gen_random_uuid(), 'cmo', 'slideshow'),
            (gen_random_uuid(), 'cfo', 'slideshow')
        ON CONFLICT (role_name) DO NOTHING
    """)


def downgrade():
    op.drop_table("review_submission")
    op.drop_index("ix_review_comment_cycle_slide", "review_comment")
    op.drop_table("review_comment")
    op.drop_table("review_verdict")
    op.drop_table("review_mode")
