"""add rag_logs table

Tracks every RAG query for debugging, analysis, and future eval dataset building.

To use:
  1. Copy this file to alembic/versions/
  2. Update `down_revision` to your current head (probably 'rag_001')
  3. Run: alembic upgrade head
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID


revision = "rag_002_logs"
down_revision = "rag_001"  # ← if your current head is different, update this
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "rag_logs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("created_at", sa.DateTime(), nullable=False,
                  server_default=sa.text("CURRENT_TIMESTAMP")),

        # Who / where
        sa.Column("user_id", UUID(as_uuid=True), nullable=True),
        sa.Column("session_id", sa.String(100), nullable=True),
        sa.Column("loa_context_id", UUID(as_uuid=True), nullable=True),

        # What was asked
        sa.Column("question", sa.Text(), nullable=False),
        sa.Column("tool", sa.String(50), nullable=False),  # deep_search | stats | summarize
        sa.Column("history_length", sa.Integer(), nullable=True),

        # What was extracted (RAG only, null for stats/summarize)
        sa.Column("filters_extracted", JSONB(), nullable=True),
        sa.Column("semantic_query", sa.Text(), nullable=True),

        # What was returned
        sa.Column("sources", JSONB(), nullable=True),          # array of LOA identifiers
        sa.Column("loa_count", sa.Integer(), nullable=True),
        sa.Column("answer", sa.Text(), nullable=True),
        sa.Column("sql_generated", sa.Text(), nullable=True),  # for stats only

        # Performance
        sa.Column("extract_ms", sa.Integer(), nullable=True),
        sa.Column("search_ms", sa.Integer(), nullable=True),
        sa.Column("answer_ms", sa.Integer(), nullable=True),
        sa.Column("total_ms", sa.Integer(), nullable=True),

        # Error tracking
        sa.Column("error", sa.Text(), nullable=True),
    )

    # Indexes for common queries
    op.create_index("ix_rag_logs_created_at", "rag_logs", ["created_at"])
    op.create_index("ix_rag_logs_user_id", "rag_logs", ["user_id"])
    op.create_index("ix_rag_logs_session_id", "rag_logs", ["session_id"])
    op.create_index("ix_rag_logs_tool", "rag_logs", ["tool"])


def downgrade():
    op.drop_index("ix_rag_logs_tool", table_name="rag_logs")
    op.drop_index("ix_rag_logs_session_id", table_name="rag_logs")
    op.drop_index("ix_rag_logs_user_id", table_name="rag_logs")
    op.drop_index("ix_rag_logs_created_at", table_name="rag_logs")
    op.drop_table("rag_logs")
