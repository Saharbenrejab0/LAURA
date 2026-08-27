"""
ImportBatch model.

One row per bulk load of the client's historical LOA records. Every imported
LOA points back at its batch, so an import can always be traced, filtered in
the Historical Campaigns view, or reversed.

Batches are created by `scripts/import_historical_loas.py`. The three batches
that exist from the initial data load were reconstructed by the
`loa_source_v1` migration from the `source_file` column, since that data was
loaded outside this codebase.
"""
from sqlalchemy import Column, String, DateTime, Integer, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid

from backend.models.database import Base


class ImportBatch(Base):
    __tablename__ = "import_batch"

    id               = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    label            = Column(String(255), nullable=False)
    imported_at      = Column(DateTime, server_default=func.now())
    # Null for the reconstructed initial batches — they predate this table.
    imported_by      = Column(UUID(as_uuid=True), nullable=True)
    row_count        = Column(Integer, nullable=False, default=0)
    source_file_name = Column(String(500), nullable=True)
    notes            = Column(Text, nullable=True)

    def __repr__(self):
        return f"<ImportBatch {self.label} rows={self.row_count}>"
