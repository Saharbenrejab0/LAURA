"""alignment review: loa_review_stage table + anchor column on review_comment

Revision ID: loa_review_stages_v1
Revises: loa_source_v1
Create Date: 2026-08-14
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = 'loa_review_stages_v1'
down_revision = 'loa_source_v1'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'loa_review_stage',
        sa.Column('id', UUID(as_uuid=True), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('loa_id', UUID(as_uuid=True), nullable=False),
        sa.Column('stage', sa.String(50), nullable=False),
        sa.Column('status', sa.String(20), nullable=False, server_default='pending'),
        sa.Column('approved_by', UUID(as_uuid=True), nullable=True),
        sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['loa_id'], ['loas.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['approved_by'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('loa_id', 'stage', name='uq_loa_review_stage'),
    )
    op.create_index('ix_loa_review_stage_loa_id', 'loa_review_stage', ['loa_id'])

    op.add_column(
        'review_comment',
        sa.Column('anchor', sa.String(200), nullable=True),
    )


def downgrade():
    op.drop_column('review_comment', 'anchor')
    op.drop_index('ix_loa_review_stage_loa_id', table_name='loa_review_stage')
    op.drop_table('loa_review_stage')
