"""
LoaCycle model.

Represents a kickoff window for LOA submissions:
  - "normal"    : the regular quarterly validation cycle (admin sets start/end
                   dates; marketers can only Submit — not just save a draft —
                   while a normal cycle is active).
  - "emergency" : a fast-track window authorised by EMEA admins for urgent,
                   out-of-cycle LOAs. Kept isolated from the normal cycle's
                   summary Excel, but still counted in the yearly P&L total.

Only one 'normal' cycle should be is_active=True at a time (enforced in the
API layer, not by a DB constraint, so admins can still manage exceptions).
"""
from sqlalchemy import Column, String, Boolean, DateTime, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid

from backend.models.database import Base


class LoaCycle(Base):
    __tablename__ = "loa_cycle"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name        = Column(String(120), nullable=False)          # e.g. "Cycle 3 2026"
    cycle_type  = Column(String(20), nullable=False, default="normal")  # normal | emergency
    start_date  = Column(DateTime, nullable=False)
    end_date    = Column(DateTime, nullable=False)
    is_active   = Column(Boolean, default=True)
    created_by  = Column(String(255), nullable=True)
    created_at  = Column(DateTime, server_default=func.now())
    authorized_emails = Column(JSON, nullable=True)  # for emergency cycles: who can create under it

    def __repr__(self):
        return f"<LoaCycle {self.name} ({self.cycle_type}) {self.start_date}->{self.end_date} active={self.is_active}>"
