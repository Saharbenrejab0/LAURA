"""
RolePermission model — the heart of the permission system.

This is the matrix that says, for each combination of (role, LOA status),
which permission applies.

Example rows:
  france_marketer | draft           | edit      (only if author — checked at user level)
  france_marketer | local_prep      | edit
  france_marketer | country_review  | edit
  france_marketer | global_review   | view
  ...
  regional_cmo    | cmo_review      | validate
  regional_cfo    | cfo_review      | validate
  ceo_validator   | ceo_validation  | validate

The unique constraint (role_id, loa_status) means each cell of the matrix
has exactly one permission. If a (role, status) combination has no row in
this table, the role has NO access at all to LOAs in that status.

This is intentional: "defaults are restrictive" (audit rule #4).
"""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import relationship

from backend.models.database import Base


class RolePermission(Base):
    __tablename__ = 'role_permission'

    id = Column(Integer, primary_key=True)
    role_id = Column(Integer, ForeignKey('role.id', ondelete='CASCADE'), nullable=False)
    loa_status = Column(String(50), nullable=False)
    permission_id = Column(Integer, ForeignKey('permission.id', ondelete='CASCADE'), nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        UniqueConstraint('role_id', 'loa_status', name='uq_role_status'),
    )

    role = relationship('Role', back_populates='role_permissions')
    permission = relationship('Permission', back_populates='role_permissions')

    def __repr__(self):
        return f"<RolePermission role={self.role_id} status={self.loa_status} perm={self.permission_id}>"
