"""cycle_code_column

Add a stable, human-readable reference code to loa_cycle.

Format:
  Normal     → {YEAR}-Q{QUARTER}-N{seq}    e.g. 2026-Q3-N1
  Emergency  → {YEAR}-EX{seq}              e.g. 2026-EX2

Sequence is 1-based within (year, type, quarter) for normal cycles and within
(year, type) for emergency cycles, ordered by start_date — so the assignment
is deterministic and survives repeated runs.

Revision ID: cycle_code_column
Revises: e6b644489c0d
Create Date: 2026-08-16
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'cycle_code_column'
down_revision: Union[str, None] = 'e6b644489c0d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('loa_cycle', sa.Column('code', sa.String(32), nullable=True))

    op.execute("""
        WITH ranked AS (
            SELECT
                id,
                cycle_type,
                start_date,
                EXTRACT(YEAR    FROM start_date)::int AS yr,
                EXTRACT(QUARTER FROM start_date)::int AS qtr,
                ROW_NUMBER() OVER (
                    PARTITION BY
                        EXTRACT(YEAR    FROM start_date)::int,
                        cycle_type,
                        EXTRACT(QUARTER FROM start_date)::int
                    ORDER BY start_date
                ) AS rn_qtr,
                ROW_NUMBER() OVER (
                    PARTITION BY
                        EXTRACT(YEAR FROM start_date)::int,
                        cycle_type
                    ORDER BY start_date
                ) AS rn_yr
            FROM loa_cycle
            WHERE code IS NULL
        )
        UPDATE loa_cycle lc
        SET code = CASE
            WHEN r.cycle_type = 'normal' THEN
                r.yr::text || '-Q' || r.qtr::text || '-N' || r.rn_qtr::text
            WHEN r.cycle_type = 'emergency' THEN
                r.yr::text || '-EX' || r.rn_yr::text
            ELSE
                r.yr::text || '-' || UPPER(r.cycle_type) || r.rn_yr::text
        END
        FROM ranked r
        WHERE lc.id = r.id
    """)

    op.create_unique_constraint('uq_loa_cycle_code', 'loa_cycle', ['code'])


def downgrade() -> None:
    op.drop_constraint('uq_loa_cycle_code', 'loa_cycle', type_='unique')
    op.drop_column('loa_cycle', 'code')
