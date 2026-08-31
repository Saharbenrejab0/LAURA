"""normalise_currency_eur

Collapse the six spellings of "euro" onto the single code EUR.

Found by the 2026-08-25 database audit: `loas.currency` held EUR (2123),
EURO (274), Eur (168), € (139), Euro (30) and eur (1). Every one of them means
the same thing, and every total in the product already added them together as
though they were identical — so this writes down what the code was assuming.

The € rows are NOT mojibake, despite how they look in a Windows terminal: the
value is U+20AC, the real euro sign. It is normalised as a spelling, not repaired.

Deliberately NOT touched — 19 rows that are genuinely not euros:
    CHF  14  (all DACH, Swiss suppliers)
    GBP   4  (all NORTH, UK retail)
    19000 1  (HIST-AE0C8353 — a column shift; the amount landed in the
              currency field, so that row's other columns are suspect too)
Relabelling those as EUR would silently assert £65,000 = €65,000. They need an
FX decision or a re-import, which is a business call, not a migration.

For the same reason this migration adds no CHECK constraint: one would fail
against those 19 rows today. The constraint belongs in a follow-up, once they
are resolved.

Revision ID: normalise_currency_eur
Revises: cycle_emergency_reason
Create Date: 2026-08-26
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'normalise_currency_eur'
down_revision: Union[str, None] = 'cycle_emergency_reason'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Every spelling that means "euro". Matched case-insensitively on the trimmed
# value, so a stray 'eUr' or ' EUR ' is caught too.
_EURO_SPELLINGS = ('eur', 'euro', '€', 'e', '€ uro')


def upgrade() -> None:
    op.execute(
        sa.text("""
            UPDATE loas
               SET currency = 'EUR'
             WHERE currency IS NOT NULL
               AND currency <> 'EUR'
               AND lower(btrim(currency)) IN :spellings
        """).bindparams(sa.bindparam('spellings', value=_EURO_SPELLINGS, expanding=True))
    )


def downgrade() -> None:
    # The original spelling of each row is not recoverable, and does not matter:
    # they all meant EUR. This is a no-op rather than a lie.
    pass
