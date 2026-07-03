"""
RagLog model — tracks every AI query (RAG, Stats, Summarize)
for debugging, analytics, and eval dataset generation.
"""

from datetime import datetime
from sqlalchemy import Column, DateTime, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.sql import func

from backend.models.database import Base


class RagLog(Base):
    __tablename__ = "rag_logs"

    id = Column(UUID(as_uuid=True), primary_key=True,
                server_default=func.gen_random_uuid())
    created_at = Column(DateTime, nullable=False, server_default=func.current_timestamp())

    # Who / where
    user_id = Column(UUID(as_uuid=True), nullable=True)
    session_id = Column(String(100), nullable=True)
    loa_context_id = Column(UUID(as_uuid=True), nullable=True)

    # What was asked
    question = Column(Text, nullable=False)
    tool = Column(String(50), nullable=False)  # deep_search | stats | summarize
    history_length = Column(Integer, nullable=True)

    # What was extracted (RAG only)
    filters_extracted = Column(JSONB, nullable=True)
    semantic_query = Column(Text, nullable=True)

    # What was returned
    sources = Column(JSONB, nullable=True)
    loa_count = Column(Integer, nullable=True)
    answer = Column(Text, nullable=True)
    sql_generated = Column(Text, nullable=True)

    # Performance (ms)
    extract_ms = Column(Integer, nullable=True)
    search_ms = Column(Integer, nullable=True)
    answer_ms = Column(Integer, nullable=True)
    total_ms = Column(Integer, nullable=True)

    # Error tracking
    error = Column(Text, nullable=True)
