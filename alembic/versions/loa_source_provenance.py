"""loa provenance: source + import batches, cycles carry live data only

Revision ID: loa_source_v1
Revises: cycle_trace_v1

Separates the client's bulk-imported history from real submissions made in the
app, and stops cycles from carrying anything but live data.

Backfill rule — derived from investigating the table, not guessed:

    loa_draft_id LIKE 'LAURA-%' AND is_demo      -> demo_seed          (75)
    loa_draft_id LIKE 'LAURA-%' AND NOT is_demo  -> laura_created      (21)
    everything else                              -> historical_import  (2657)

`loa_draft_id` is the discriminator, NOT `source_file`: 42 app-created rows
carry a historical `source_file` because duplicate.py copies that column when
an LOA is duplicated from a historical record. Corroborating evidence — all
2657 bulk rows are status='approved' and landed in three single-minute bursts,
while the LAURA-* rows span 37 days, 12 requestors and five workflow statuses.

The three historical batches are reconstructed from `source_file`, since that
data was loaded outside this codebase and no ImportBatch rows exist for it.

Afterwards `loas.cycle_id` goes back to nullable, guarded by a CHECK so live
rows must have a cycle and non-live rows must not.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
import uuid

revision = "loa_source_v1"
down_revision = "cycle_trace_v1"
branch_labels = None
depends_on = None


# Reconstructed batches: (source_file value, human label)
_HISTORICAL_BATCHES = [
    ("etl_original", "Client historical data — initial ETL load"),
    ("session_nov_24_final.xlsx", "Client historical data — session Nov 2024"),
    ("session_q2_25_backup.xlsx", "Client historical data — session Q2 2025"),
]

_LAURA_LIKE = "loa_draft_id LIKE 'LAURA-%'"


def upgrade():
    conn = op.get_bind()

    # ── 1. Import batch registry ──────────────────────────────────────────
    op.create_table(
        "import_batch",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("label", sa.String(255), nullable=False),
        sa.Column("imported_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("imported_by", UUID(as_uuid=True), nullable=True),
        sa.Column("row_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("source_file_name", sa.String(500), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
    )

    op.add_column("loas", sa.Column("source", sa.String(30), nullable=True))
    op.add_column("loas", sa.Column(
        "import_batch_id", UUID(as_uuid=True),
        sa.ForeignKey("import_batch.id", ondelete="SET NULL"), nullable=True,
    ))

    # ── 2. Classify every row ─────────────────────────────────────────────
    conn.execute(sa.text(f"""
        UPDATE loas SET source = CASE
            WHEN {_LAURA_LIKE} AND COALESCE(is_demo, false) THEN 'demo_seed'
            WHEN {_LAURA_LIKE}                              THEN 'laura_created'
            ELSE 'historical_import'
        END
    """))

    counts = dict(conn.execute(sa.text(
        "SELECT source, COUNT(*) FROM loas GROUP BY source"
    )).fetchall())
    print("Classifying LOA provenance...")
    for key in ("historical_import", "laura_created", "demo_seed"):
        print(f"  {key:20s} {counts.get(key, 0)}")

    # ── 3. Reconstruct the historical import batches ──────────────────────
    for source_file, label in _HISTORICAL_BATCHES:
        n = conn.execute(
            sa.text("SELECT COUNT(*) FROM loas "
                    "WHERE source = 'historical_import' AND source_file = :sf"),
            {"sf": source_file},
        ).scalar()
        if not n:
            continue
        batch_id = uuid.uuid4()
        conn.execute(
            sa.text(
                "INSERT INTO import_batch "
                "(id, label, imported_at, row_count, source_file_name, notes) "
                "VALUES (:id, :label, "
                "(SELECT MIN(created_at) FROM loas WHERE source_file = :sf), "
                ":n, :sf, :notes)"
            ),
            {"id": batch_id, "label": label, "n": n, "sf": source_file,
             "notes": "Reconstructed by migration loa_source_v1 from source_file; "
                      "this data was loaded before the import registry existed."},
        )
        conn.execute(
            sa.text("UPDATE loas SET import_batch_id = :bid "
                    "WHERE source = 'historical_import' AND source_file = :sf"),
            {"bid": batch_id, "sf": source_file},
        )
        print(f'  batch "{label}": {n} LOAs')

    # Historical rows with no source_file at all get their own catch-all batch
    # so nothing on the Historical page is unattributable.
    orphan = conn.execute(sa.text(
        "SELECT COUNT(*) FROM loas "
        "WHERE source = 'historical_import' AND import_batch_id IS NULL"
    )).scalar()
    if orphan:
        batch_id = uuid.uuid4()
        conn.execute(
            sa.text("INSERT INTO import_batch (id, label, row_count, notes) "
                    "VALUES (:id, :label, :n, :notes)"),
            {"id": batch_id, "label": "Client historical data — unattributed",
             "n": orphan,
             "notes": "Historical rows with no source_file recorded."},
        )
        conn.execute(sa.text(
            "UPDATE loas SET import_batch_id = :bid "
            "WHERE source = 'historical_import' AND import_batch_id IS NULL"
        ), {"bid": batch_id})
        print(f'  batch "unattributed": {orphan} LOAs')

    # ── 4. Cycles carry live data only ────────────────────────────────────
    # Relax the NOT NULL from cycle_trace_v1 first — the detach below writes
    # NULLs, so the constraint has to go before the UPDATE, not after.
    op.alter_column("loas", "cycle_id", nullable=True, existing_type=UUID(as_uuid=True))

    detached = conn.execute(sa.text(
        "UPDATE loas SET cycle_id = NULL "
        "WHERE source <> 'laura_created' AND cycle_id IS NOT NULL"
    )).rowcount
    print(f"  detached from cycles: {detached}")

    still_null = conn.execute(sa.text("SELECT COUNT(*) FROM loas WHERE source IS NULL")).scalar()
    if still_null:
        raise RuntimeError(f"{still_null} LOAs have no source — refusing to continue.")

    op.alter_column("loas", "source", nullable=False, existing_type=sa.String(30))
    op.create_index("ix_loas_source", "loas", ["source"])
    op.create_index("ix_loas_import_batch_id", "loas", ["import_batch_id"])

    # cycle_id is now conditional: mandatory for live rows, forbidden otherwise.
    op.create_check_constraint(
        "ck_loa_live_has_cycle", "loas",
        "(source = 'laura_created' AND cycle_id IS NOT NULL) "
        "OR (source <> 'laura_created' AND cycle_id IS NULL)",
    )

    # ── 5. Flag throwaway cycles ──────────────────────────────────────────
    op.add_column("loa_cycle", sa.Column(
        "is_test", sa.Boolean(), nullable=False, server_default="false"))
    # The cycle that absorbed the whole backfill is exercise data, not a real
    # review period — mark it so the UI warns and an admin can delete it.
    flagged = conn.execute(sa.text(
        "UPDATE loa_cycle SET is_test = true "
        "WHERE cycle_type = 'normal' AND status = 'open'"
    )).rowcount
    print(f"  cycles flagged as test: {flagged}")

    live = conn.execute(sa.text(
        "SELECT COUNT(*) FROM loas WHERE source = 'laura_created'"
    )).scalar()
    print(f"  live LOAs remaining in cycles: {live}")


def downgrade():
    op.drop_constraint("ck_loa_live_has_cycle", "loas", type_="check")
    op.drop_column("loa_cycle", "is_test")
    op.drop_index("ix_loas_import_batch_id", "loas")
    op.drop_index("ix_loas_source", "loas")
    op.drop_column("loas", "import_batch_id")
    op.drop_column("loas", "source")
    op.drop_table("import_batch")
