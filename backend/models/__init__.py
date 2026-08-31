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
from backend.models.import_batch import ImportBatch
from backend.models.loa import (
    LOA, LOALine, LOA_SOURCES, NON_CYCLE_SOURCES,
    SOURCE_LAURA_CREATED, SOURCE_HISTORICAL_IMPORT, SOURCE_DEMO_SEED,
    LOA_TYPES, MULTI_LOA_TYPES, MIN_LOA_LINES, MAX_LOA_LINES,
    LOA_TYPE_STANDARD, LOA_TYPE_MULTI_BRAND, LOA_TYPE_MULTI_ACTIVITY,
)

# Models that reference other models
from backend.models.role import Role
from backend.models.role_permission import RolePermission

# Review system (cmo-review slideshow mode + alignment chain)
from backend.models.review import (
    ReviewMode, ReviewVerdict, ReviewComment, ReviewSubmission,
    LOAPhoto, CycleTitleConfig, CycleCloseNotification,
    LOAReviewStage, ALIGNMENT_STAGES,
)

__all__ = [
    'Base', 'SessionLocal', 'engine', 'get_db',
    'Permission', 'Role', 'RolePermission',
    'User', 'LOA', 'LOALine', 'LoaCycle', 'ImportBatch',
    'LOA_SOURCES', 'NON_CYCLE_SOURCES',
    'SOURCE_LAURA_CREATED', 'SOURCE_HISTORICAL_IMPORT', 'SOURCE_DEMO_SEED',
    'LOA_TYPES', 'MULTI_LOA_TYPES', 'MIN_LOA_LINES', 'MAX_LOA_LINES',
    'LOA_TYPE_STANDARD', 'LOA_TYPE_MULTI_BRAND', 'LOA_TYPE_MULTI_ACTIVITY',
    'ReviewMode', 'ReviewVerdict', 'ReviewComment', 'ReviewSubmission',
    'LOAPhoto', 'CycleTitleConfig', 'CycleCloseNotification',
    'LOAReviewStage', 'ALIGNMENT_STAGES',
]