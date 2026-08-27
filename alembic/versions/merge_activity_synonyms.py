"""merge_activity_synonyms

Collapse four confirmed synonym pairs in loas.activity_type.

Audit question 4, answered by Sahar on 2026-08-26: each pair is the same
activity recorded two ways by two different importers. The longer, explicit form
survives in every case, because that is the one that reads correctly in the
CFO pivot and the CMO deck without a lookup.

    COOP_ADV             ->  COOP_ADVERTISING       (130 + 148 = 278)
    OTHER_ADV            ->  OTHER_ADVERTISING      (116 +  37 = 153)
    CATALOGUES           ->  CATALOGUES_BROCHURES   ( 27 +  23 =  50)
    MEDICAL              ->  MEDICAL_AFFAIRS        (  7 +   4 =  11)

Also applied to loa_line.activity_type: multi-activity LOAs carry the value on
the child row, and leaving those behind would split the very totals this merge
exists to join.

Not touched here: the 144 rows still using the old Title Case labels
("Seasonal Visibility" etc). Audit question 3 settled that the UPPER_SNAKE codes
are canonical, so those rows are a separate migration against a settled list.

Revision ID: merge_activity_synonyms
Revises: normalise_currency_eur
Create Date: 2026-08-26
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'merge_activity_synonyms'
down_revision: Union[str, None] = 'normalise_currency_eur'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

MERGES = {
    'COOP_ADV':   'COOP_ADVERTISING',
    'OTHER_ADV':  'OTHER_ADVERTISING',
    'CATALOGUES': 'CATALOGUES_BROCHURES',
    'MEDICAL':    'MEDICAL_AFFAIRS',
}


def upgrade() -> None:
    conn = op.get_bind()
    for table in ('loas', 'loa_line'):
        # loa_line arrived with the multi-brand work and may not exist on an
        # older database; skip rather than fail the whole migration.
        if not conn.dialect.has_table(conn, table):
            continue
        for old, new in MERGES.items():
            conn.execute(
                sa.text(f"UPDATE {table} SET activity_type = :new WHERE activity_type = :old"),
                {'new': new, 'old': old},
            )


def downgrade() -> None:
    # Which rows held the short form is not recorded, so a split cannot be
    # reversed faithfully. A no-op beats inventing an arbitrary one.
    pass
