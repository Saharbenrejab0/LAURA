"""
LAURA — User model

UPDATED for Sprint 2: adds role_id foreign key to the new Role table.

Legacy fields (`role` string, `cluster` string) are KEPT for backward
compatibility during the transition. They can be dropped in a future
migration once Sprint 2 is fully tested and all code paths use role_id.
"""
from sqlalchemy import Column, String, Boolean, DateTime, Text, Integer, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import uuid

from backend.models.database import Base


class User(Base):
    __tablename__ = "users"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email           = Column(String(255), unique=True, nullable=False, index=True)
    full_name       = Column(String(200), nullable=False)
    hashed_password = Column(String(255), nullable=False)

    # ─── LEGACY fields (kept for backward compatibility) ──────────────
    # role: editor | approver | finance | admin
    #   editor   = local marketer, sees only their cluster
    #   approver = CMO / CFO / VP, sees all clusters
    #   finance  = Thibault / Simona, sees financial data
    #   admin    = AI to Market, full access
    role    = Column(String(20), nullable=False, default="editor")
    cluster = Column(String(50), nullable=True)   # editors are locked to one cluster

    # ─── NEW field (Sprint 2) ─────────────────────────────────────────
    # Foreign key to the new `role` table.
    # Nullable during transition: legacy users without role_id still work
    # via the old `role` string above, but new users must have role_id.
    role_id = Column(Integer, ForeignKey('role.id'), nullable=True, index=True)

    is_active  = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, server_default=func.now())
    last_login = Column(DateTime, nullable=True)

    # Relationship to Role (Sprint 2)
    # Named `role_obj` to avoid conflict with the legacy `role` string column.
    role_obj = relationship('Role', back_populates='users')

    def __repr__(self):
        return f"<User {self.email} | legacy_role={self.role} role_id={self.role_id}>"

    @property
    def effective_role_code(self) -> str:
        """
        Return the user's effective role code.
        Prefers the new role_id (via role_obj), falls back to legacy role string.
        """
        if self.role_obj:
            return self.role_obj.code
        return self.role or "unknown"