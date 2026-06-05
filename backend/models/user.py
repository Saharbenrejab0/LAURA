"""
LAURA — User model
Roles: editor (local marketer), approver (CMO/CFO/VP), finance, admin
Rules enforced after Friday meeting — role field stored now, permissions TBD
"""

from sqlalchemy import Column, String, Boolean, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid

from backend.models.database import Base


class User(Base):
    __tablename__ = "users"

    id             = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email          = Column(String(255), unique=True, nullable=False)
    full_name      = Column(String(200), nullable=False)
    hashed_password = Column(String(255), nullable=False)

    # Role: editor | approver | finance | admin
    # editor   = local marketer, sees only their cluster
    # approver = CMO / CFO / VP, sees all clusters
    # finance  = Thibault / Simona, sees financial data
    # admin    = AI to Market, full access
    role    = Column(String(20), default="editor")
    cluster = Column(String(50), nullable=True)   # editors are locked to one cluster

    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    last_login = Column(DateTime, nullable=True)

    def __repr__(self):
        return f"<User {self.email} | {self.role}>"