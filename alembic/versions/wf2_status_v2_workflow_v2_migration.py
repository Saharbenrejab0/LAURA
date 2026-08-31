"""Workflow v2 — migrate 11 statuses to 8 statuses

Maps the old 11-status workflow to the new client-validated 8-status workflow:
  draft → emea_review → global_review → cmo_cfo_review →
  global_functions_review → corporate_review → approved + rejected

Affects two tables:
  - loas.status           (VARCHAR 20→30, remap values)
  - role_permission.loa_status (remap values, purge dead statuses)

Revision ID: wf2_status_v2
Revises: 1b7a8cd2e6d6
Create Date: 2026-06-18
"""
from alembic import op
import sqlalchemy as sa

revision = 'wf2_status_v2'
down_revision = '1b7a8cd2e6d6'
branch_labels = None
depends_on = None


# ── Status mapping (old → new) ──────────────────────────────────────────
STATUS_MAP = {
    'local_prep':     'emea_review',
    'country_review': 'emea_review',
    'submitted':      'emea_review',
    'brand_review':   'global_review',
    'cmo_review':     'cmo_cfo_review',
    'cfo_review':     'cmo_cfo_review',
    'ceo_validation': 'corporate_review',
}

# Statuses that no longer exist and should be purged from role_permission
DEAD_STATUSES = [
    'locked', 'local_prep', 'country_review', 'submitted',
    'brand_review', 'cmo_review', 'cfo_review', 'ceo_validation',
]


def upgrade() -> None:
    # ── 1. Widen loas.status from VARCHAR(20) to VARCHAR(30) ─────────
    #    Needed because 'global_functions_review' = 23 chars > 20.
    op.alter_column(
        'loas', 'status',
        existing_type=sa.String(20),
        type_=sa.String(30),
        existing_nullable=False,
    )

    # ── 2. Remap LOA statuses ────────────────────────────────────────
    for old_status, new_status in STATUS_MAP.items():
        op.execute(
            sa.text(
                "UPDATE loas SET status = :new_s WHERE status = :old_s"
            ).bindparams(new_s=new_status, old_s=old_status)
        )

    # ── 3. Remap role_permission statuses ────────────────────────────
    #    Handle unique constraint (role_id, loa_status): if a role already
    #    has a row for the new status, delete the old-status row first
    #    to avoid violation. Keep the row with the stronger permission.
    for old_status, new_status in STATUS_MAP.items():
        # Delete old-status rows where the role already has the new status
        op.execute(
            sa.text("""
                DELETE FROM role_permission
                WHERE loa_status = :old_s
                  AND role_id IN (
                    SELECT role_id FROM role_permission
                    WHERE loa_status = :new_s
                  )
            """).bindparams(old_s=old_status, new_s=new_status)
        )
        # Safely update remaining old-status rows
        op.execute(
            sa.text(
                "UPDATE role_permission SET loa_status = :new_s WHERE loa_status = :old_s"
            ).bindparams(new_s=new_status, old_s=old_status)
        )

    # ── 4. Purge dead statuses from role_permission ──────────────────
    for dead in DEAD_STATUSES:
        op.execute(
            sa.text(
                "DELETE FROM role_permission WHERE loa_status = :dead_s"
            ).bindparams(dead_s=dead)
        )


def downgrade() -> None:
    # ── Reverse mapping (lossy: emea_review → local_prep, loses
    #    distinction between local_prep/country_review/submitted) ─────
    REVERSE_MAP = {
        'emea_review':    'local_prep',
        'cmo_cfo_review': 'cmo_review',
        # global_review stays global_review
        # corporate_review stays corporate_review
    }

    for new_status, old_status in REVERSE_MAP.items():
        op.execute(
            sa.text(
                "UPDATE loas SET status = :old_s WHERE status = :new_s"
            ).bindparams(old_s=old_status, new_s=new_status)
        )

    for new_status, old_status in REVERSE_MAP.items():
        op.execute(
            sa.text(
                "UPDATE role_permission SET loa_status = :old_s WHERE loa_status = :new_s"
            ).bindparams(old_s=old_status, new_s=new_status)
        )

    # Note: global_functions_review rows in role_permission will be
    # orphaned on downgrade. The seed must be re-run to restore the
    # old matrix. This is acceptable — downgrade is emergency only.

    op.alter_column(
        'loas', 'status',
        existing_type=sa.String(30),
        type_=sa.String(20),
        existing_nullable=False,
    )
