"""add missing loa fields manual

Revision ID: 3d4ae2f1fc0e
Revises: c3f4aeb8f496
Create Date: 2026-05-26
"""
from alembic import op
import sqlalchemy as sa

revision = '3d4ae2f1fc0e'
down_revision = 'c3f4aeb8f496'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('loas', sa.Column('sap_event_code', sa.String(100), nullable=True))
    op.add_column('loas', sa.Column('cost_split_lenses', sa.Float(), nullable=True))
    op.add_column('loas', sa.Column('cost_split_frames', sa.Float(), nullable=True))
    op.add_column('loas', sa.Column('forecasted_lenses_sales', sa.Float(), nullable=True))
    op.add_column('loas', sa.Column('forecasted_frames_sales', sa.Float(), nullable=True))
    op.add_column('loas', sa.Column('forecasted_instruments_sales', sa.Float(), nullable=True))
    op.add_column('loas', sa.Column('pct_central_budget', sa.Float(), nullable=True))
    op.add_column('loas', sa.Column('finance_validator_email', sa.String(255), nullable=True))


def downgrade():
    op.drop_column('loas', 'finance_validator_email')
    op.drop_column('loas', 'pct_central_budget')
    op.drop_column('loas', 'forecasted_instruments_sales')
    op.drop_column('loas', 'forecasted_frames_sales')
    op.drop_column('loas', 'forecasted_lenses_sales')
    op.drop_column('loas', 'cost_split_frames')
    op.drop_column('loas', 'cost_split_lenses')
    op.drop_column('loas', 'sap_event_code')