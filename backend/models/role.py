"""
Role model.

A Role represents a position in the LAURA workflow. Examples:
  - france_marketer (scope: cluster=FRANCE)
  - emea_ps_editor (scope: all)
  - global_brand_rayban (scope: brand=[Ray-Ban, Ray-Ban Meta])
  - ceo_validator (scope: all, but only active during ceo_validation status)
  - super_admin (scope: all, can override edit-lock)

Scope determines WHICH LOAs a role can see, in conjunction with the
permission matrix (role_permission) which determines WHAT they can do.

Scope types:
  - 'all': sees all LOAs (Vanessa, Alexandra, Giulia, Paola, Diana,
                          Super-Admin, AI to Market)
  - 'cluster': sees only LOAs from a specific cluster (Local Marketers, Finance)
  - 'brand': sees only LOAs where brand is in scope_value list
  - 'function': sees only LOAs where activity_type is in scope_value list
  - 'author_only': sees only LOAs they personally created (used for drafts)

scope_value is a JSON array of allowed values, or null when scope_type is
'all' or 'author_only'.
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, JSON, func
from sqlalchemy.orm import relationship

from backend.models.database import Base


def _normalise_brand(name):
    """Strip prefixes and normalise for comparison: 'HB - Ray-Ban' -> 'ray-ban'."""
    if not name:
        return ""
    s = str(name).strip().lower()
    # Remove leading category prefixes with or without spaces
    for prefix in ("hb -", "hb-", "lb -", "lb-", "essilor -", "essilor-"):
        if s.startswith(prefix):
            s = s[len(prefix):].strip()
            break
    return s


def _brand_matches(loa_brand, scope_list):
    """Check if loa_brand matches any in scope_list, ignoring 'HB - ' / 'LB - ' prefixes."""
    if not loa_brand or not scope_list:
        return False
    loa_norm = _normalise_brand(loa_brand)
    scope_norm = {_normalise_brand(b) for b in scope_list}
    return loa_norm in scope_norm

class Role(Base):
    __tablename__ = 'role'

    id = Column(Integer, primary_key=True)
    code = Column(String(50), nullable=False, unique=True, index=True)
    display_name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    scope_type = Column(String(20), nullable=False, index=True)
    scope_value = Column(JSON, nullable=True)
    can_override_lock = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, server_default=func.now())

    role_permissions = relationship(
        'RolePermission',
        back_populates='role',
        cascade='all, delete-orphan',
    )
    users = relationship('User', back_populates='role_obj')

    def __repr__(self):
        return f"<Role {self.code} ({self.scope_type})>"

    def matches_loa(self, loa) -> bool:
        """
        Check whether this role's scope matches a given LOA.

        Returns True if the role's scope_type+scope_value gives the role
        visibility on this LOA, ignoring permission level (that's checked
        separately).

        For 'author_only', visibility depends on whether the user is the
        LOA's requestor_email — this is NOT checked here, only at the
        user level. This method only checks role-level scope.
        """
        if self.scope_type == 'all':
            return True

        if self.scope_type == 'author_only':
            # Caller must additionally check user.email == loa.requestor_email
            return True

        if self.scope_type == 'cluster':
            allowed = self.scope_value or []
            return loa.cluster in allowed

        if self.scope_type == 'brand':
            allowed = self.scope_value or []
            # A multi-brand LOA carries brand=NULL on the parent — its brands are
            # on loa_line. Matching any one of them grants visibility.
            if loa.brand:
                return _brand_matches(loa.brand, allowed)
            return any(
                _brand_matches(ln.brand, allowed)
                for ln in (getattr(loa, 'lines', None) or [])
                if ln.brand
            )

        if self.scope_type == 'function':
            allowed = self.scope_value or []
            # Same for multi-activity: activity_type is NULL on the parent.
            if loa.activity_type:
                return loa.activity_type in allowed
            return any(
                ln.activity_type in allowed
                for ln in (getattr(loa, 'lines', None) or [])
                if ln.activity_type
            )

        return False


# Scope type constants
SCOPE_ALL = 'all'
SCOPE_CLUSTER = 'cluster'
SCOPE_BRAND = 'brand'
SCOPE_FUNCTION = 'function'
SCOPE_AUTHOR_ONLY = 'author_only'
