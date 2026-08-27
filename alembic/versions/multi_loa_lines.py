"""multi_loa_lines

Multi-Brand / Multi-Activity LOAs (Option B — parent + child lines).

  loas.loa_type  'standard' | 'multi_brand' | 'multi_activity'
  loa_line       one row per brand (multi_brand) or per activity type (multi_activity)

Standard LOAs are untouched: loa_type defaults to 'standard' and they have zero
loa_line rows. Parent aggregate columns (q*_2026, fy_2026_total) are recomputed
from the lines server-side, so every existing consumer that reads the parent
totals keeps working without modification.

Revision ID: multi_loa_lines
Revises: ref_data_tables
Create Date: 2026-08-26
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = 'multi_loa_lines'
down_revision: Union[str, None] = 'ref_data_tables'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'loas',
        sa.Column('loa_type', sa.String(20), nullable=False, server_default='standard'),
    )
    op.create_index('ix_loas_loa_type', 'loas', ['loa_type'])

    op.create_table(
        'loa_line',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('loa_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('loas.id', ondelete='CASCADE'), nullable=False),
        sa.Column('position', sa.Integer(), nullable=False, server_default='0'),

        # Axis field — brand for multi_brand, activity_type for multi_activity.
        # The unused one stays NULL.
        sa.Column('brand',         sa.String(200), nullable=True),
        sa.Column('activity_type', sa.String(50),  nullable=True),

        # Per-row detail
        sa.Column('customer', sa.String(200), nullable=True),
        sa.Column('vendor',   sa.String(300), nullable=True),
        sa.Column('detail',   sa.Text(),      nullable=True),
        sa.Column('num_doors', sa.Integer(),  nullable=True),
        sa.Column('avg_investment_per_door', sa.Float(), nullable=True),
        sa.Column('cost_drill_down', sa.Text(), nullable=True),

        # Per-row budget
        sa.Column('q4_2025', sa.Float(), nullable=False, server_default='0'),
        sa.Column('q1_2026', sa.Float(), nullable=False, server_default='0'),
        sa.Column('q2_2026', sa.Float(), nullable=False, server_default='0'),
        sa.Column('q3_2026', sa.Float(), nullable=False, server_default='0'),
        sa.Column('q4_2026', sa.Float(), nullable=False, server_default='0'),
        sa.Column('fy_2026_total', sa.Float(), nullable=False, server_default='0'),

        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index('ix_loa_line_loa_id', 'loa_line', ['loa_id'])
    op.create_unique_constraint('uq_loa_line_position', 'loa_line', ['loa_id', 'position'])

    # A line must carry exactly one axis value — brand XOR activity_type.
    op.create_check_constraint(
        'ck_loa_line_one_axis',
        'loa_line',
        '(brand IS NOT NULL AND activity_type IS NULL) OR '
        '(brand IS NULL AND activity_type IS NOT NULL)',
    )

    # loa_type must be one of the three known values.
    op.create_check_constraint(
        'ck_loas_loa_type',
        'loas',
        "loa_type IN ('standard', 'multi_brand', 'multi_activity')",
    )

    # The axis that varies per line is NULL on the parent; the shared axis stays set.
    #   standard        -> both brand and activity_type present
    #   multi_brand     -> brand NULL,          activity_type present (shared)
    #   multi_activity  -> brand present (shared), activity_type NULL
    op.alter_column('loas', 'brand',         existing_type=sa.String(200), nullable=True)
    op.alter_column('loas', 'activity_type', existing_type=sa.String(50),  nullable=True)

    op.create_check_constraint(
        'ck_loas_axis_by_type',
        'loas',
        "(loa_type = 'standard'       AND brand IS NOT NULL AND activity_type IS NOT NULL) OR "
        "(loa_type = 'multi_brand'    AND brand IS NULL     AND activity_type IS NOT NULL) OR "
        "(loa_type = 'multi_activity' AND brand IS NOT NULL AND activity_type IS NULL)",
    )


def downgrade() -> None:
    op.drop_constraint('ck_loas_axis_by_type', 'loas', type_='check')
    # Backfill before restoring NOT NULL so the constraint can be re-applied.
    op.execute("UPDATE loas SET brand = '—' WHERE brand IS NULL")
    op.execute("UPDATE loas SET activity_type = 'Others (non ADV)' WHERE activity_type IS NULL")
    op.alter_column('loas', 'activity_type', existing_type=sa.String(50),  nullable=False)
    op.alter_column('loas', 'brand',         existing_type=sa.String(200), nullable=False)

    op.drop_constraint('ck_loas_loa_type', 'loas', type_='check')
    op.drop_table('loa_line')
    op.drop_index('ix_loas_loa_type', table_name='loas')
    op.drop_column('loas', 'loa_type')
