"""cycle traceability: lifecycle status, LOA backfill, cycle_id NOT NULL

Revision ID: cycle_trace_v1
Revises: cmo_deck_cfg_v1

Three things happen here, in order:

  1. loa_cycle gains `status` / `closed_at` / `closed_by`, backfilled from the
     existing `is_active` flag, plus a partial unique index enforcing
     "at most one OPEN normal cycle".
  2. Every LOA with a NULL cycle_id is assigned one (see _backfill_loas), then
     loas.cycle_id becomes NOT NULL. If any row is still NULL at that point the
     migration aborts rather than leaving a half-linked table.
  3. cycle_close_notification is created.

The backfill deliberately does NOT match emergency cycles against ordinary
LOAs. Emergency windows are short and overlap normal ones, so a naive nearest-
date match would sweep years of ordinary history into a two-day emergency
window. Emergency cycles only ever receive LOAs flagged is_emergency.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "cycle_trace_v1"
down_revision = "cmo_deck_cfg_v1"
branch_labels = None
depends_on = None


# --------------------------------------------------------------------------- #
# Backfill                                                                     #
# --------------------------------------------------------------------------- #

def _pick_cycle(created_at, cycles):
    """Choose the cycle a LOA belongs to.

    `cycles` is a list of (id, name, start, end) already restricted to the
    right type (emergency vs normal) and sorted by start date.

      - created_at inside [start, end]        -> that cycle
      - between two cycles                    -> nearest by date distance
      - before every cycle                    -> the earliest
      - after every cycle                     -> the latest
    """
    if not cycles:
        return None
    if created_at is None:
        return cycles[-1][0]

    for cid, _name, start, end in cycles:
        if start <= created_at <= end:
            return cid

    if created_at < cycles[0][2]:
        return cycles[0][0]
    if created_at > cycles[-1][3]:
        return cycles[-1][0]

    # Falls in a gap — nearest edge wins.
    best, best_gap = cycles[-1][0], None
    for cid, _name, start, end in cycles:
        gap = (start - created_at) if created_at < start else (created_at - end)
        gap = abs(gap.total_seconds())
        if best_gap is None or gap < best_gap:
            best, best_gap = cid, gap
    return best


def _backfill_loas(conn) -> None:
    cycles = conn.execute(sa.text(
        "SELECT id, name, cycle_type, start_date, end_date "
        "FROM loa_cycle ORDER BY start_date"
    )).fetchall()

    if not cycles:
        raise RuntimeError(
            "Cannot backfill loas.cycle_id: no cycles exist. "
            "Create at least one cycle before running this migration."
        )

    normal = [(c[0], c[1], c[3], c[4]) for c in cycles if c[2] != "emergency"]
    emergency = [(c[0], c[1], c[3], c[4]) for c in cycles if c[2] == "emergency"]
    # If the deployment has never had a normal cycle, fall back to everything
    # rather than refusing to link the table.
    normal_pool = normal or [(c[0], c[1], c[3], c[4]) for c in cycles]
    names = {c[0]: c[1] for c in cycles}

    orphans = conn.execute(sa.text(
        "SELECT id, created_at, COALESCE(is_emergency, false) "
        "FROM loas WHERE cycle_id IS NULL"
    )).fetchall()

    print(f"Backfilling LOA cycle_id... ({len(orphans)} unlinked)")
    if not orphans:
        print("  nothing to do")
        return

    # Keys stay as UUID objects so psycopg2 adapts them to the uuid columns.
    assignments: dict[object, list[object]] = {}
    for loa_id, created_at, is_emergency in orphans:
        pool = (emergency or normal_pool) if is_emergency else normal_pool
        target = _pick_cycle(created_at, pool)
        assignments.setdefault(target, []).append(loa_id)

    for cycle_id, loa_ids in assignments.items():
        # Chunked so the IN list stays a sane size on large tables.
        for i in range(0, len(loa_ids), 1000):
            chunk = loa_ids[i:i + 1000]
            conn.execute(
                sa.text("UPDATE loas SET cycle_id = :cid WHERE id IN :ids")
                .bindparams(sa.bindparam("ids", expanding=True)),
                {"cid": cycle_id, "ids": chunk},
            )
        print(f'  Cycle "{names.get(cycle_id, cycle_id)}": assigned {len(loa_ids)} LOAs')

    remaining = conn.execute(
        sa.text("SELECT COUNT(*) FROM loas WHERE cycle_id IS NULL")
    ).scalar()
    total = conn.execute(sa.text("SELECT COUNT(*) FROM loas")).scalar()
    print(f"  Total: {total} LOAs, {remaining} orphans")

    if remaining:
        raise RuntimeError(
            f"Backfill incomplete: {remaining} LOAs still have a NULL cycle_id. "
            "Refusing to apply the NOT NULL constraint."
        )


# --------------------------------------------------------------------------- #
# Migration                                                                    #
# --------------------------------------------------------------------------- #

def upgrade():
    conn = op.get_bind()

    # ── 1. Cycle lifecycle ────────────────────────────────────────────────
    op.add_column("loa_cycle", sa.Column("status", sa.String(20), nullable=True))
    op.add_column("loa_cycle", sa.Column("closed_at", sa.DateTime(), nullable=True))
    op.add_column("loa_cycle", sa.Column("closed_by", sa.String(255), nullable=True))

    # Existing rows: active ones are open, the rest are already finished.
    conn.execute(sa.text(
        "UPDATE loa_cycle SET status = CASE WHEN is_active THEN 'open' ELSE 'closed' END"
    ))
    # Give the previously-inactive cycles a closing timestamp so the archive
    # view has something to show. created_at is the best proxy available.
    conn.execute(sa.text(
        "UPDATE loa_cycle SET closed_at = COALESCE(closed_at, end_date) "
        "WHERE status = 'closed'"
    ))
    op.alter_column("loa_cycle", "status", nullable=False,
                    server_default="open", existing_type=sa.String(20))

    # At most one OPEN normal cycle, enforced by the database.
    op.execute(
        "CREATE UNIQUE INDEX uq_one_open_normal_cycle ON loa_cycle (cycle_type) "
        "WHERE status = 'open' AND cycle_type = 'normal'"
    )

    # ── 2. Backfill + lock down loas.cycle_id ─────────────────────────────
    _backfill_loas(conn)
    op.alter_column("loas", "cycle_id", nullable=False, existing_type=UUID(as_uuid=True))
    op.create_index("ix_loas_cycle_id", "loas", ["cycle_id"])

    # ── 3. Close notification audit table ─────────────────────────────────
    op.create_table(
        "cycle_close_notification",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("cycle_id", UUID(as_uuid=True),
                  sa.ForeignKey("loa_cycle.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sent_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("sent_by", sa.String(255), nullable=True),
        sa.Column("recipients", sa.JSON(), nullable=True),
        sa.Column("results", sa.JSON(), nullable=True),
        sa.Column("teams_message_id", sa.String(255), nullable=True),
        sa.Column("excel_file_path", sa.String(500), nullable=True),
        sa.Column("webhook_delivered", sa.Boolean(), server_default=sa.false()),
        sa.Column("webhook_error", sa.Text(), nullable=True),
    )
    op.create_index("ix_cycle_close_notification_cycle_id",
                    "cycle_close_notification", ["cycle_id"])


def downgrade():
    op.drop_index("ix_cycle_close_notification_cycle_id", "cycle_close_notification")
    op.drop_table("cycle_close_notification")

    op.drop_index("ix_loas_cycle_id", "loas")
    op.alter_column("loas", "cycle_id", nullable=True, existing_type=UUID(as_uuid=True))

    op.execute("DROP INDEX IF EXISTS uq_one_open_normal_cycle")
    op.drop_column("loa_cycle", "closed_by")
    op.drop_column("loa_cycle", "closed_at")
    op.drop_column("loa_cycle", "status")
