"""add RAG and FY2025 columns

Phase 1: regular columns (no pgvector needed)
Phase 2: vector column will be added in a separate migration after pgvector is installed
"""

from alembic import op
import sqlalchemy as sa

revision = "rag_001"
down_revision = "1fcc624b3c06"
branch_labels = None
depends_on = None


def upgrade():
    # ── 1. FY2025 quarter columns ──
    op.add_column("loas", sa.Column("q1_2025", sa.Float(), nullable=True))
    op.add_column("loas", sa.Column("q2_2025", sa.Float(), nullable=True))
    op.add_column("loas", sa.Column("q3_2025", sa.Float(), nullable=True))

    # ── 2. FY2024 columns ──
    op.add_column("loas", sa.Column("q4_2024", sa.Float(), nullable=True))
    op.add_column("loas", sa.Column("fy_2024_total", sa.Float(), nullable=True))
    op.add_column("loas", sa.Column("h2_2025", sa.Float(), nullable=True))

    # ── 3. Ingestion metadata ──
    op.add_column("loas", sa.Column("prioritization", sa.String(50), nullable=True))
    op.add_column("loas", sa.Column("source_file", sa.String(255), nullable=True))

    # ── 4. RAG text columns (no pgvector needed) ──
    op.add_column("loas", sa.Column("embedding_text", sa.Text(), nullable=True))
    op.add_column("loas", sa.Column("embedded_at", sa.DateTime(), nullable=True))

    # ── 5. Tag existing historicals ──
    op.execute(
        "UPDATE loas SET source_file = 'etl_original' WHERE is_demo = false AND source_file IS NULL"
    )

    # NOTE: vector(1024) column will be added in migration rag_002
    # after pgvector is installed (GCP has it built-in, Windows needs manual install)


def downgrade():
    op.drop_column("loas", "embedded_at")
    op.drop_column("loas", "embedding_text")
    op.drop_column("loas", "source_file")
    op.drop_column("loas", "prioritization")
    op.drop_column("loas", "h2_2025")
    op.drop_column("loas", "fy_2024_total")
    op.drop_column("loas", "q4_2024")
    op.drop_column("loas", "q3_2025")
    op.drop_column("loas", "q2_2025")
    op.drop_column("loas", "q1_2025")