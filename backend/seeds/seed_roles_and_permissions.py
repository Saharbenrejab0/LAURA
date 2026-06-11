"""
Seed script for Sprint 2 — Permissions, Roles, and the Permission Matrix.

This script populates the database with:
  - 4 permissions (view, edit, comment, validate)
  - 27 roles with their scopes
  - 297 entries in role_permission (the matrix)

Run AFTER the migration `sprint2_rolepermissions.py` has been applied.

Usage:
    python -m backend.seeds.seed_roles_and_permissions
"""

# Import the whole models package first so SQLAlchemy registers all classes
# before any mapper is initialized. This avoids "failed to locate a name 'User'"
# errors when models reference each other via string-based relationships.
import backend.models  # noqa: F401

import sys
from sqlalchemy.orm import Session

from backend.models.database import SessionLocal
from backend.models.permission import (
    Permission, PERMISSION_VIEW, PERMISSION_COMMENT,
    PERMISSION_VALIDATE, PERMISSION_EDIT,
)
from backend.models.role import (
    Role, SCOPE_ALL, SCOPE_CLUSTER, SCOPE_BRAND,
    SCOPE_FUNCTION, SCOPE_AUTHOR_ONLY,
)
from backend.models.role_permission import RolePermission


# ═══════════════════════════════════════════════════════════════════════
# THE 4 PERMISSIONS
# ═══════════════════════════════════════════════════════════════════════

PERMISSIONS_DATA = [
    {
        'code': PERMISSION_VIEW,
        'display_name': 'View',
        'description': 'Read-only access to the LOA.',
        'hierarchy_level': 1,
    },
    {
        'code': PERMISSION_COMMENT,
        'display_name': 'Comment',
        'description': 'Can add comments per section without modifying content.',
        'hierarchy_level': 2,
    },
    {
        'code': PERMISSION_VALIDATE,
        'display_name': 'Validate',
        'description': 'Can click Approve / Reject / Approve-with-comment.',
        'hierarchy_level': 2,  # sibling of comment, NOT parent of edit
    },
    {
        'code': PERMISSION_EDIT,
        'display_name': 'Edit',
        'description': 'Can modify the content of the LOA.',
        'hierarchy_level': 3,
    },
]


# ═══════════════════════════════════════════════════════════════════════
# THE 27 ROLES
# ═══════════════════════════════════════════════════════════════════════
#
# Each role definition includes:
#   code         : machine name (snake_case)
#   display_name : human-readable name shown in UI
#   scope_type   : 'all' / 'cluster' / 'brand' / 'function' / 'author_only'
#   scope_value  : list of allowed values for that scope (None if scope='all')
#   can_override_lock : True only for Super-Admin

# Clusters as defined in the LAURA dropdown rules document.
CLUSTERS = ['FRANCE', 'ITALY', 'DACH', 'IBERIA', 'NORTH', 'META',
            'EAST & GR', 'RUSSIA']

ROLES_DATA = []

# ─── Group 1: Local Marketers (8 roles) ──────────────────────────────
for cluster in CLUSTERS:
    cluster_code = cluster.lower().replace(' & ', '_').replace(' ', '_')
    # 'EAST & GR' -> 'east_gr', 'FRANCE' -> 'france'
    ROLES_DATA.append({
        'code': f'{cluster_code}_marketer',
        'display_name': f'{cluster.title() if cluster != "DACH" else cluster} Marketer',
        'description': f'Local marketer for the {cluster} cluster. Creates and edits LOAs during local prep and country review.',
        'scope_type': SCOPE_CLUSTER,
        'scope_value': [cluster],
        'can_override_lock': False,
    })

# ─── Group 2: Local Finance (8 roles) ────────────────────────────────
for cluster in CLUSTERS:
    cluster_code = cluster.lower().replace(' & ', '_').replace(' ', '_')
    ROLES_DATA.append({
        'code': f'{cluster_code}_finance',
        'display_name': f'{cluster.title() if cluster != "DACH" else cluster} Finance',
        'description': f'Local finance for the {cluster} cluster. Contributes to LOA editing during local prep and country review.',
        'scope_type': SCOPE_CLUSTER,
        'scope_value': [cluster],
        'can_override_lock': False,
    })

# ─── Group 3: Regional / EMEA (3 roles) ───────────────────────────────
ROLES_DATA.extend([
    {
        'code': 'emea_ps_editor',
        'display_name': 'EMEA PS Editor',
        'description': 'Vanessa Stöecklein. Sole editor from country_review onwards. Manages global comments.',
        'scope_type': SCOPE_ALL,
        'scope_value': None,
        'can_override_lock': False,
    },
    {
        'code': 'regional_cmo',
        'display_name': 'Regional CMO',
        'description': 'Alexandra. Validates the PowerPoint side. Will present to the CEO.',
        'scope_type': SCOPE_ALL,
        'scope_value': None,
        'can_override_lock': False,
    },
    {
        'code': 'regional_cfo',
        'display_name': 'Regional CFO',
        'description': 'Giulia Uccelli. Validates the Excel side. Ensures financial coherence.',
        'scope_type': SCOPE_ALL,
        'scope_value': None,
        'can_override_lock': False,
    },
])

# ─── Group 4: Global Brands (6 roles) ─────────────────────────────────
ROLES_DATA.extend([
    {
        'code': 'global_brand_rayban',
        'display_name': 'Global Brand Ray-Ban',
        'description': 'Comments on Ray-Ban LOAs during global review.',
        'scope_type': SCOPE_BRAND,
        'scope_value': ['HB - Ray-Ban', 'HB - Ray-Ban Meta'],
        'can_override_lock': False,
    },
    {
        'code': 'global_brand_oakley',
        'display_name': 'Global Brand Oakley',
        'description': 'Comments on Oakley LOAs during global review.',
        'scope_type': SCOPE_BRAND,
        'scope_value': ['HB - Oakley', 'HB - Oakley Meta', 'Sport (OO/ZB/OW)'],
        'can_override_lock': False,
    },
    {
        'code': 'global_brand_essilor_lenses',
        'display_name': 'Global Brand Essilor Lenses',
        'description': 'Comments on Essilor Lenses LOAs during global review.',
        'scope_type': SCOPE_BRAND,
        'scope_value': [
            'Essilor - Varilux', 'Essilor - Stellest', 'Essilor - Eyezen',
            'Essilor - Crizal', 'Essilor - Masterbrand', 'Essilor - Multibrand',
            'Multibrand',
        ],
        'can_override_lock': False,
    },
    {
        'code': 'global_brand_transitions',
        'display_name': 'Global Brand Transitions',
        'description': 'Comments on Transitions LOAs during global review.',
        'scope_type': SCOPE_BRAND,
        'scope_value': ['Transitions'],
        'can_override_lock': False,
    },
    {
        'code': 'global_brand_other_hb',
        'display_name': 'Global Brand — Other House Brands',
        'description': 'Comments on Vogue, Persol, Oliver Peoples, Alain Mikli, BLIZ, Arnette LOAs.',
        'scope_type': SCOPE_BRAND,
        'scope_value': [
            'HB - Vogue', 'HB - Persol', 'HB - Oliver Peoples',
            'HB - Alain Mikli', 'HB - BLIZ', 'HB - Arnette', 'HB - Others',
        ],
        'can_override_lock': False,
    },
    {
        'code': 'global_brand_license',
        'display_name': 'Global Brand — License Brands',
        'description': 'Comments on all License Brand LOAs (Chanel, Prada, Versace, etc.).',
        'scope_type': SCOPE_BRAND,
        'scope_value': [
            'LB - Luxury', 'LB - PFF', 'LB - Armani Exchange',
            'LB - Brunello Cucinelli', 'LB - Burberry', 'LB - Chanel',
            'LB - Dolce & Gabbana', 'LB - Emporio Armani', 'LB - Ferrari',
            'LB - Ferrari Scuderia', 'LB - Giorgio Armani', 'LB - Jimmy Choo',
            'LB - Michael Kors', 'LB - Miu Miu', 'LB - Moncler', 'LB - Prada',
            'LB - Prada Linea Rossa', 'LB - Polo Ralph Lauren', 'LB - Polo',
            'LB - Ralph', 'LB - Swarovski', 'LB - Starck Eye', 'LB - Tiffany',
            'LB - Versace', 'LB - Others',
        ],
        'can_override_lock': False,
    },
])

# ─── Group 5: Global Functions (3 roles) ──────────────────────────────
ROLES_DATA.extend([
    {
        'code': 'global_function_pr_events',
        'display_name': 'Global Function PR & Events',
        'description': 'Sofia. Comments on PR and Events LOAs during global review.',
        'scope_type': SCOPE_FUNCTION,
        'scope_value': ['PR', 'Events'],
        'can_override_lock': False,
    },
    {
        'code': 'global_function_medical',
        'display_name': 'Global Function Medical Affairs',
        'description': 'Comments on Medical Affairs LOAs during global review.',
        'scope_type': SCOPE_FUNCTION,
        'scope_value': ['Medical Affairs'],
        'can_override_lock': False,
    },
    {
        'code': 'global_function_trade',
        'display_name': 'Global Function Trade Marketing',
        'description': 'Comments on Trade Incentive LOAs during global review.',
        'scope_type': SCOPE_FUNCTION,
        'scope_value': ['Trade Incentive'],
        'can_override_lock': False,
    },
])

# ─── Group 6: Corporate (2 roles) ─────────────────────────────────────
ROLES_DATA.extend([
    {
        'code': 'corporate_paola',
        'display_name': 'Corporate Marketing Finance — Paola',
        'description': 'Paola Boneto. Comments during corporate_review, last gate before CEO.',
        'scope_type': SCOPE_ALL,
        'scope_value': None,
        'can_override_lock': False,
    },
    {
        'code': 'corporate_diana',
        'display_name': 'Corporate Marketing Finance — Diana',
        'description': 'Diana Canazaro. Comments during corporate_review, last gate before CEO.',
        'scope_type': SCOPE_ALL,
        'scope_value': None,
        'can_override_lock': False,
    },
])

# ─── Group 7: CEO Validator (1 role) ──────────────────────────────────
ROLES_DATA.append({
    'code': 'ceo_validator',
    'display_name': 'CEO Validator',
    'description': 'Marketing finance assistant who clicks Approve/Reject in real time during CEO presentation.',
    'scope_type': SCOPE_ALL,
    'scope_value': None,
    'can_override_lock': False,
})

# ─── Group 8: Super-Admin (1 role) ────────────────────────────────────
ROLES_DATA.append({
    'code': 'super_admin',
    'display_name': 'Super-Admin',
    'description': 'Thibault, Vanessa (admin hat), Sandrine. Can override edit-lock. Full visibility.',
    'scope_type': SCOPE_ALL,
    'scope_value': None,
    'can_override_lock': True,
})

# ─── Group 9: AI to Market Admin (1 role) ─────────────────────────────
ROLES_DATA.append({
    'code': 'ai_to_market_admin',
    'display_name': 'AI to Market Admin',
    'description': 'AI to Market team. Read-only access for support and debugging.',
    'scope_type': SCOPE_ALL,
    'scope_value': None,
    'can_override_lock': False,
})


# ═══════════════════════════════════════════════════════════════════════
# THE PERMISSION MATRIX (rule-based, not raw 297 entries)
# ═══════════════════════════════════════════════════════════════════════
#
# Each rule applies to one role × multiple LOA statuses.
# Generated rules are written to role_permission table.

# All 11 LOA statuses in workflow order
ALL_STATUSES = [
    'draft', 'local_prep', 'country_review', 'global_review',
    'cmo_review', 'cfo_review', 'corporate_review', 'ceo_validation',
    'approved', 'rejected', 'locked',
]

# For convenience, a "view all except draft" base used by many roles
VIEW_ALL_EXCEPT_DRAFT = [s for s in ALL_STATUSES if s != 'draft']


def build_matrix() -> list[dict]:
    """
    Returns a list of dicts: [{role_code, loa_status, permission_code}, ...]
    that represents the full matrix.
    """
    matrix = []

    # ─── Local Marketers ─────────────────────────────────────────────
    for cluster in CLUSTERS:
        cluster_code = cluster.lower().replace(' & ', '_').replace(' ', '_')
        role_code = f'{cluster_code}_marketer'
        marketer_perms = {
            'draft': 'edit',           # only if author — checked at user level
            'local_prep': 'edit',
            'country_review': 'edit',
            'global_review': 'view',
            'cmo_review': 'view',
            'cfo_review': 'view',
            'corporate_review': 'view',
            'ceo_validation': 'view',
            'approved': 'view',
            'rejected': 'edit',
            'locked': 'view',
        }
        for status, perm in marketer_perms.items():
            matrix.append({'role_code': role_code, 'loa_status': status, 'permission_code': perm})

    # ─── Local Finance ───────────────────────────────────────────────
    for cluster in CLUSTERS:
        cluster_code = cluster.lower().replace(' & ', '_').replace(' ', '_')
        role_code = f'{cluster_code}_finance'
        finance_perms = {
            # draft: no access — drafts are private to the marketer author
            'local_prep': 'edit',
            'country_review': 'edit',
            'global_review': 'view',
            'cmo_review': 'view',
            'cfo_review': 'view',
            'corporate_review': 'view',
            'ceo_validation': 'view',
            'approved': 'view',
            'rejected': 'edit',
            'locked': 'view',
        }
        for status, perm in finance_perms.items():
            matrix.append({'role_code': role_code, 'loa_status': status, 'permission_code': perm})

    # ─── EMEA PS Editor (Vanessa) ─────────────────────────────────────
    emea_perms = {
        # draft: no access (private to marketer)
        'local_prep': 'view',
        'country_review': 'edit',
        'global_review': 'edit',
        'cmo_review': 'edit',
        'cfo_review': 'edit',
        'corporate_review': 'edit',
        'ceo_validation': 'view',
        'approved': 'view',
        'rejected': 'edit',
        'locked': 'view',
    }
    for status, perm in emea_perms.items():
        matrix.append({'role_code': 'emea_ps_editor', 'loa_status': status, 'permission_code': perm})

    # ─── Regional CMO (Alexandra) ─────────────────────────────────────
    cmo_perms = {
        'global_review': 'view',
        'cmo_review': 'validate',  # key moment: validates the PPT
        'cfo_review': 'view',
        'corporate_review': 'view',
        'ceo_validation': 'view',
        'approved': 'view',
        'rejected': 'view',
        'locked': 'view',
    }
    for status, perm in cmo_perms.items():
        matrix.append({'role_code': 'regional_cmo', 'loa_status': status, 'permission_code': perm})

    # ─── Regional CFO (Giulia) ────────────────────────────────────────
    cfo_perms = {
        'global_review': 'view',
        'cmo_review': 'view',
        'cfo_review': 'validate',  # key moment: validates the Excel
        'corporate_review': 'view',
        'ceo_validation': 'view',
        'approved': 'view',
        'rejected': 'view',
        'locked': 'view',
    }
    for status, perm in cfo_perms.items():
        matrix.append({'role_code': 'regional_cfo', 'loa_status': status, 'permission_code': perm})

    # ─── Global Brands (6 roles, all same pattern) ────────────────────
    brand_roles = [
        'global_brand_rayban', 'global_brand_oakley',
        'global_brand_essilor_lenses', 'global_brand_transitions',
        'global_brand_other_hb', 'global_brand_license',
    ]
    brand_perms = {
        'global_review': 'comment',  # the 3-4 day comment window
        'cmo_review': 'view',
        'cfo_review': 'view',
        'corporate_review': 'view',
        'ceo_validation': 'view',
        'approved': 'view',
        'rejected': 'view',
        'locked': 'view',
    }
    for role_code in brand_roles:
        for status, perm in brand_perms.items():
            matrix.append({'role_code': role_code, 'loa_status': status, 'permission_code': perm})

    # ─── Global Functions (3 roles, same pattern as brands) ───────────
    function_roles = [
        'global_function_pr_events',
        'global_function_medical',
        'global_function_trade',
    ]
    for role_code in function_roles:
        for status, perm in brand_perms.items():  # same matrix as brands
            matrix.append({'role_code': role_code, 'loa_status': status, 'permission_code': perm})

    # ─── Corporate (Paola, Diana) ─────────────────────────────────────
    corporate_perms = {
        'global_review': 'view',
        'cmo_review': 'view',
        'cfo_review': 'view',
        'corporate_review': 'comment',  # their commenting window
        'ceo_validation': 'view',
        'approved': 'view',
        'rejected': 'view',
        'locked': 'view',
    }
    for role_code in ['corporate_paola', 'corporate_diana']:
        for status, perm in corporate_perms.items():
            matrix.append({'role_code': role_code, 'loa_status': status, 'permission_code': perm})

    # ─── CEO Validator ────────────────────────────────────────────────
    ceo_perms = {
        'ceo_validation': 'validate',  # the ONLY moment they have access
        'approved': 'view',
        'rejected': 'view',
    }
    for status, perm in ceo_perms.items():
        matrix.append({'role_code': 'ceo_validator', 'loa_status': status, 'permission_code': perm})

    # ─── Super-Admin (Thibault, Vanessa admin hat, Sandrine) ──────────
    # View everywhere, plus can_override_lock flag handled at role level
    for status in ALL_STATUSES:
        matrix.append({'role_code': 'super_admin', 'loa_status': status, 'permission_code': 'view'})

    # ─── AI to Market Admin ───────────────────────────────────────────
    # View everywhere, no edit/validate/override
    for status in ALL_STATUSES:
        matrix.append({'role_code': 'ai_to_market_admin', 'loa_status': status, 'permission_code': 'view'})

    return matrix


# ═══════════════════════════════════════════════════════════════════════
# SEEDING LOGIC
# ═══════════════════════════════════════════════════════════════════════

def seed(db: Session) -> None:
    print("🌱 Seeding permissions, roles, and permission matrix...")

    # 1. Permissions
    print("  → Creating permissions...")
    permission_by_code = {}
    for p_data in PERMISSIONS_DATA:
        existing = db.query(Permission).filter_by(code=p_data['code']).first()
        if existing:
            permission_by_code[p_data['code']] = existing
            continue
        perm = Permission(**p_data)
        db.add(perm)
        db.flush()
        permission_by_code[p_data['code']] = perm
    print(f"     {len(PERMISSIONS_DATA)} permissions OK")

    # 2. Roles
    print("  → Creating roles...")
    role_by_code = {}
    for r_data in ROLES_DATA:
        existing = db.query(Role).filter_by(code=r_data['code']).first()
        if existing:
            role_by_code[r_data['code']] = existing
            continue
        role = Role(**r_data)
        db.add(role)
        db.flush()
        role_by_code[r_data['code']] = role
    print(f"     {len(ROLES_DATA)} roles OK")

    # 3. Permission matrix
    print("  → Building permission matrix...")
    matrix = build_matrix()
    print(f"     {len(matrix)} matrix entries to create")

    created = 0
    skipped = 0
    for entry in matrix:
        role = role_by_code.get(entry['role_code'])
        perm = permission_by_code.get(entry['permission_code'])
        if not role or not perm:
            print(f"     ⚠ Missing role or permission: {entry}")
            continue

        existing = db.query(RolePermission).filter_by(
            role_id=role.id,
            loa_status=entry['loa_status'],
        ).first()
        if existing:
            skipped += 1
            continue

        rp = RolePermission(
            role_id=role.id,
            loa_status=entry['loa_status'],
            permission_id=perm.id,
        )
        db.add(rp)
        created += 1

    print(f"     {created} created, {skipped} already existed")

    db.commit()
    print("✅ Seed complete.")


def main():
    db = SessionLocal()
    try:
        seed(db)
    except Exception as e:
        print(f"❌ Seed failed: {e}")
        db.rollback()
        sys.exit(1)
    finally:
        db.close()


if __name__ == '__main__':
    main()
