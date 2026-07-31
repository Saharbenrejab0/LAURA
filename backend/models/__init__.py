"""
LAURA — Models package init.

Imports all models in dependency order so that SQLAlchemy resolves
relationships correctly, regardless of which code path triggers the load.

Order matters: classes referenced via string in relationships
(e.g. 'User' in role.users) must be importable before the referring class.
"""
# Database base must come first
from backend.models.database import Base, SessionLocal, engine, get_db

# Independent models
from backend.models.permission import Permission
from backend.models.user import User
from backend.models.loa_cycle import LoaCycle
from backend.models.loa import LOA

# Models that reference other models
from backend.models.role import Role
from backend.models.role_permission import RolePermission

__all__ = [
    'Base', 'SessionLocal', 'engine', 'get_db',
    'Permission', 'Role', 'RolePermission',
    'User', 'LOA', 'LoaCycle',
]