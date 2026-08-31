"""reference_data_tables

Create brands, clusters, countries, legal_entities reference tables.
These are the source of truth for the four cascade dropdowns on the LOA form.
LOA rows continue to store plain strings — no FK enforced on loas table.

Revision ID: ref_data_tables
Revises: cycle_code_column
Create Date: 2026-08-26
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'ref_data_tables'
down_revision: Union[str, None] = 'cycle_code_column'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'clusters',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('name', sa.String(100), nullable=False, unique=True),
    )

    op.create_table(
        'countries',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('name', sa.String(150), nullable=False, unique=True),
        sa.Column('cluster_id', sa.Integer(), sa.ForeignKey('clusters.id', ondelete='CASCADE'), nullable=False),
    )
    op.create_index('ix_countries_cluster_id', 'countries', ['cluster_id'])

    op.create_table(
        'legal_entities',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('name', sa.String(300), nullable=False),
        sa.Column('country_id', sa.Integer(), sa.ForeignKey('countries.id', ondelete='CASCADE'), nullable=False),
    )
    op.create_index('ix_legal_entities_country_id', 'legal_entities', ['country_id'])

    op.create_table(
        'brands',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('code', sa.String(20), nullable=False, unique=True),
        sa.Column('name', sa.String(150), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
    )
    op.create_index('ix_brands_code', 'brands', ['code'])


def downgrade() -> None:
    op.drop_table('legal_entities')
    op.drop_table('countries')
    op.drop_table('clusters')
    op.drop_table('brands')
