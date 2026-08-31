"""Rock 1 — Parallel gates + new EMEA statuses

Adds:
  - Widens loas.status from VARCHAR(20) to VARCHAR(50)
    (needed for 'emea_post_global_review' = 25 chars)
  - 4 boolean columns for the brand/function parallel gate:
      brand_review_done, function_review_done,
      brand_review_skipped, function_review_skipped
  - Resets all mid-workflow LOAs to 'emea_review'
    (workflow structure is changing — these must restart cleanly)

Does NOT touch:
  - cmo_approved / cfo_approved (already exist, still valid)
  - The role_permission matrix (that's Rock 2)
  - Any backend logic (that's Rock 3)

Revision ID: rock1_parallel_gates
Revises: rag_002_logs
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers
revision = 'rock1_parallel_gates'
down_revision = 'rag_002_logs'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── 1. Widen status column ────────────────────────────────────────
    # Current: VARCHAR(20), but 'global_functions_review' (24 chars) already
    # exists in the DB, meaning it was widened at some point or Postgres
    # is lenient. We make it VARCHAR(50) to be safe for all new statuses.
    op.alter_column(
        'loas', 'status',
        type_=sa.String(50),
        existing_type=sa.String(20),
        existing_nullable=True,
    )

    # ── 2. Add parallel gate columns for brand/function review ────────
    op.add_column('loas', sa.Column(
        'brand_review_done', sa.Boolean(),
        nullable=False, server_default=sa.text('false'),
    ))
    op.add_column('loas', sa.Column(
        'function_review_done', sa.Boolean(),
        nullable=False, server_default=sa.text('false'),
    ))
    op.add_column('loas', sa.Column(
        'brand_review_skipped', sa.Boolean(),
        nullable=False, server_default=sa.text('false'),
    ))
    op.add_column('loas', sa.Column(
        'function_review_skipped', sa.Boolean(),
        nullable=False, server_default=sa.text('false'),
    ))

    # ── 3. Reset mid-workflow LOAs to emea_review ─────────────────────
    # These LOAs are in statuses whose meaning is about to change.
    # Approved, draft, and rejected stay untouched.
    op.execute(sa.text("""
        UPDATE loas
        SET status = 'emea_review',
            cmo_approved = false,
            cfo_approved = false
        WHERE status IN (
            'global_brand_review',
            'global_functions_review',
            'cmo_cfo_review',
            'corporate_review'
        )
    """))


def downgrade() -> None:
    # ── Reverse: move LOAs back (best-effort — data loss possible) ────
    # We can't know which LOAs were in which status before, so we leave
    # them in emea_review. The columns are simply dropped.
    op.drop_column('loas', 'function_review_skipped')
    op.drop_column('loas', 'brand_review_skipped')
    op.drop_column('loas', 'function_review_done')
    op.drop_column('loas', 'brand_review_done')

    op.alter_column(
        'loas', 'status',
        type_=sa.String(20),
        existing_type=sa.String(50),
        existing_nullable=True,
    )
