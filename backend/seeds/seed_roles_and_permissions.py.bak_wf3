"""
Seed script — Rock 2 (9-status workflow, July 2026)

Complete rewrite of the permission matrix for the definitive workflow:
  draft -> emea_review -> global_review -> emea_post_global_review ->
  cmo_cfo_review -> emea_final_review -> corporate_review -> approved
  + rejected (returns to draft)

Parallel gates:
  - global_review: brand + function teams comment simultaneously
    (tracked by brand_review_done / function_review_done booleans)
  - cmo_cfo_review: CMO + CFO validate simultaneously
    (tracked by cmo_approved / cfo_approved booleans)

7 permissions: view, comment, validate, edit, advance_phase, delete, duplicate
30 roles (no emea_ps_editor, no ai_to_market_admin, no ceo_validator)
9 statuses

Strategy: WIPE role_permission and rebuild from scratch.
Permissions and roles are upserted (create if missing, update if exists).

Fixes applied:
  - east_gr_marketer scope: ['EAST'] (was ['EAST'] already but east_gr_finance
    was ['EAST & GR'] — both normalized to ['EAST'] to match actual LOA data)
  - advance_phase hierarchy_level: 4 (was 2)
  - Added delete + duplicate permissions

Usage:
    python -m backend.seeds.seed_roles_and_permissions
"""

import backend.models  # noqa: F401

import sys
from sqlalchemy.orm import Session

from backend.models.database import SessionLocal
from backend.models.permission import Permission
from backend.models.role import Role
from backend.models.role_permission import RolePermission


# =====================================================================
# CONSTANTS
# =====================================================================

CLUSTERS = ['FRANCE', 'ITALY', 'DACH', 'IBERIA', 'NORTH', 'META',
            'EAST', 'RUSSIA']

ALL_STATUSES = [
    'draft', 'emea_review', 'global_review', 'emea_post_global_review',
    'cmo_cfo_review', 'emea_final_review', 'corporate_review',
    'approved', 'rejected',
]


# =====================================================================
# THE 7 PERMISSIONS
# =====================================================================

PERMISSIONS_DATA = [
    {
        'code': 'view',
        'display_name': 'View',
        'description': 'Read-only access to the LOA.',
        'hierarchy_level': 1,
    },
    {
        'code': 'comment',
        'display_name': 'Comment',
        'description': 'Can add comments per section without modifying content.',
        'hierarchy_level': 2,
    },
    {
        'code': 'validate',
        'display_name': 'Validate',
        'description': 'Can click Approve / Reject / Approve-with-comment.',
        'hierarchy_level': 2,
    },
    {
        'code': 'edit',
        'display_name': 'Edit',
        'description': 'Can modify the content of the LOA.',
        'hierarchy_level': 3,
    },
    {
        'code': 'advance_phase',
        'display_name': 'Advance Phase',
        'description': 'Can advance the LOA to the next step. Super-permission.',
        'hierarchy_level': 4,
    },
    {
        'code': 'delete',
        'display_name': 'Delete',
        'description': 'Can permanently delete a LOA.',
        'hierarchy_level': 1,
    },
    {
        'code': 'duplicate',
        'display_name': 'Duplicate',
        'description': 'Can duplicate a LOA as a new draft.',
        'hierarchy_level': 1,
    },
]


# =====================================================================
# THE 30 ROLES
# =====================================================================

ROLES_DATA = []

# -- Group 1: Local Marketers (8 clusters) ----------------------------
for cluster in CLUSTERS:
    code = cluster.lower().replace(' ', '_').replace('&', '').replace('__', '_')
    ROLES_DATA.append({
        'code': f'{code}_marketer',
        'display_name': f'{cluster} Marketer',
        'description': f'Local marketer for {cluster}. Creates and edits LOAs.',
        'scope_type': 'cluster',
        'scope_value': [cluster],
        'can_override_lock': False,
    })

# -- Group 2: Local Finance (8 clusters) ------------------------------
for cluster in CLUSTERS:
    code = cluster.lower().replace(' ', '_').replace('&', '').replace('__', '_')
    ROLES_DATA.append({
        'code': f'{code}_finance',
        'display_name': f'{cluster} Finance',
        'description': f'Local finance for {cluster}. Same edit rights as marketer on draft.',
        'scope_type': 'cluster',
        'scope_value': [cluster],
        'can_override_lock': False,
    })

# -- Group 3: Regional leadership (2 roles) ---------------------------
ROLES_DATA.extend([
    {
        'code': 'regional_cmo',
        'display_name': 'Regional CMO',
        'description': 'Alexandra. Validates at cmo_cfo_review step.',
        'scope_type': 'all',
        'scope_value': None,
        'can_override_lock': False,
    },
    {
        'code': 'regional_cfo',
        'display_name': 'Regional CFO',
        'description': 'Giulia. Validates at cmo_cfo_review step.',
        'scope_type': 'all',
        'scope_value': None,
        'can_override_lock': False,
    },
])

# -- Group 4: Global Brand teams (6 roles) ----------------------------
ROLES_DATA.extend([
    {
        'code': 'global_brand_rayban',
        'display_name': 'Global Brand - Ray-Ban',
        'description': 'Ray-Ban global team. Comments during global_review.',
        'scope_type': 'brand',
        'scope_value': ['HB - Ray-Ban', 'HB - Ray-Ban Meta'],
        'can_override_lock': False,
    },
    {
        'code': 'global_brand_oakley',
        'display_name': 'Global Brand - Oakley',
        'description': 'Oakley global team. Comments during global_review.',
        'scope_type': 'brand',
        'scope_value': ['HB - Oakley', 'HB - Oakley Meta', 'Sport (OO/ZB/OW)'],
        'can_override_lock': False,
    },
    {
        'code': 'global_brand_essilor_lenses',
        'display_name': 'Global Brand - Essilor Lenses',
        'description': 'Essilor lenses global team. Comments during global_review.',
        'scope_type': 'brand',
        'scope_value': [
            'Essilor - Varilux', 'Essilor - Stellest', 'Essilor - Eyezen',
            'Essilor - Crizal', 'Essilor - Masterbrand', 'Essilor - Multibrand',
            'Multibrand',
        ],
        'can_override_lock': False,
    },
    {
        'code': 'global_brand_transitions',
        'display_name': 'Global Brand - Transitions',
        'description': 'Transitions global team. Comments during global_review.',
        'scope_type': 'brand',
        'scope_value': ['Transitions'],
        'can_override_lock': False,
    },
    {
        'code': 'global_brand_license',
        'display_name': 'Global Brand - License Brands',
        'description': 'License brands global team. Comments during global_review.',
        'scope_type': 'brand',
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
    {
        'code': 'global_brand_other_hb',
        'display_name': 'Global Brand - Other House Brands',
        'description': 'Other HB global team (Vogue, Persol, etc.). Comments during global_review.',
        'scope_type': 'brand',
        'scope_value': [
            'HB - Vogue', 'HB - Persol', 'HB - Oliver Peoples',
            'HB - Alain Mikli', 'HB - BLIZ', 'HB - Arnette', 'HB - Others',
        ],
        'can_override_lock': False,
    },
])

# -- Group 5: Global Function teams (3 roles) -------------------------
ROLES_DATA.extend([
    {
        'code': 'global_function_pr_events',
        'display_name': 'Global Function - PR & Events',
        'description': 'PR and Events global team. Comments during global_review.',
        'scope_type': 'function',
        'scope_value': ['PR', 'Events'],
        'can_override_lock': False,
    },
    {
        'code': 'global_function_medical',
        'display_name': 'Global Function - Medical Affairs',
        'description': 'Medical Affairs global team. Comments during global_review.',
        'scope_type': 'function',
        'scope_value': ['Medical Affairs'],
        'can_override_lock': False,
    },
    {
        'code': 'global_function_trade',
        'display_name': 'Global Function - Trade Incentive',
        'description': 'Trade Incentive global team. Comments during global_review.',
        'scope_type': 'function',
        'scope_value': ['Trade Incentive'],
        'can_override_lock': False,
    },
])

# -- Group 6: Corporate (2 roles) -------------------------------------
ROLES_DATA.extend([
    {
        'code': 'corporate_paola',
        'display_name': 'Corporate Marketing Finance - Paola',
        'description': 'Paola Boneto. Validates at corporate_review step.',
        'scope_type': 'all',
        'scope_value': None,
        'can_override_lock': False,
    },
    {
        'code': 'corporate_diana',
        'display_name': 'Corporate Marketing Finance - Diana',
        'description': 'Diana Canazaro. Validates at corporate_review step.',
        'scope_type': 'all',
        'scope_value': None,
        'can_override_lock': False,
    },
])

# -- Group 7: Super-Admin (1 role) ------------------------------------
ROLES_DATA.append({
    'code': 'super_admin',
    'display_name': 'Super-Admin',
    'description': 'Thibault, Vanessa, Sandrine. Full access, can override locks.',
    'scope_type': 'all',
    'scope_value': None,
    'can_override_lock': True,
})


# =====================================================================
# THE PERMISSION MATRIX
# =====================================================================

def build_matrix():
    """
    Returns a list of dicts: [{role_code, loa_status, permission_code}, ...]

    Design principles:
      - Progressive visibility: roles gain access from their workflow step onward
      - Defaults are restrictive: no row = no access
      - draft + rejected have identical permissions for marketers/finance
      - Parallel gates: brand + function both get comment on global_review
      - CMO + CFO both get validate on cmo_cfo_review
      - Super-admin gets advance_phase + delete + duplicate on ALL statuses
    """
    entries = []

    def add(role_code, status, perm_code):
        entries.append({
            'role_code': role_code,
            'loa_status': status,
            'permission_code': perm_code,
        })

    # -- Helper: statuses from a starting point onward (progressive) ---
    status_order = [
        'draft', 'emea_review', 'global_review', 'emea_post_global_review',
        'cmo_cfo_review', 'emea_final_review', 'corporate_review', 'approved',
    ]

    def statuses_from(start):
        """Return all statuses from 'start' onward in the workflow."""
        idx = status_order.index(start)
        return status_order[idx:]

    # =================================================================
    # LOCAL MARKETERS + LOCAL FINANCE (16 roles, identical permissions)
    # =================================================================
    cluster_roles = []
    for cluster in CLUSTERS:
        code = cluster.lower().replace(' ', '_').replace('&', '').replace('__', '_')
        cluster_roles.append(f'{code}_marketer')
        cluster_roles.append(f'{code}_finance')

    for role_code in cluster_roles:
        # Draft: full edit + delete + duplicate
        add(role_code, 'draft', 'edit')
        add(role_code, 'draft', 'delete')
        add(role_code, 'draft', 'duplicate')

        # Rejected: edit + duplicate (no delete — rejected LOAs are kept for audit)
        add(role_code, 'rejected', 'edit')
        add(role_code, 'rejected', 'duplicate')

        # All review steps: view only
        for status in ['emea_review', 'global_review', 'emea_post_global_review',
                        'cmo_cfo_review', 'emea_final_review', 'corporate_review']:
            add(role_code, status, 'view')

        # Approved: view + duplicate
        add(role_code, 'approved', 'view')
        add(role_code, 'approved', 'duplicate')

    # =================================================================
    # GLOBAL BRAND TEAMS (6 roles)
    # Progressive visibility from global_review onward
    # =================================================================
    brand_roles = [
        'global_brand_rayban', 'global_brand_oakley',
        'global_brand_essilor_lenses', 'global_brand_transitions',
        'global_brand_license', 'global_brand_other_hb',
    ]

    for role_code in brand_roles:
        # global_review: comment + duplicate (this is where they act)
        add(role_code, 'global_review', 'comment')
        add(role_code, 'global_review', 'duplicate')

        # Everything after global_review: view only
        for status in ['emea_post_global_review', 'cmo_cfo_review',
                        'emea_final_review', 'corporate_review']:
            add(role_code, status, 'view')

        # Approved: view + duplicate
        add(role_code, 'approved', 'view')
        add(role_code, 'approved', 'duplicate')

    # =================================================================
    # GLOBAL FUNCTION TEAMS (3 roles)
    # Same as brand teams — comment on global_review (parallel gate)
    # =================================================================
    function_roles = [
        'global_function_pr_events', 'global_function_medical',
        'global_function_trade',
    ]

    for role_code in function_roles:
        # global_review: comment + duplicate (parallel with brand teams)
        add(role_code, 'global_review', 'comment')
        add(role_code, 'global_review', 'duplicate')

        # Everything after: view only
        for status in ['emea_post_global_review', 'cmo_cfo_review',
                        'emea_final_review', 'corporate_review']:
            add(role_code, status, 'view')

        # Approved: view + duplicate
        add(role_code, 'approved', 'view')
        add(role_code, 'approved', 'duplicate')

    # =================================================================
    # REGIONAL CMO + REGIONAL CFO
    # Progressive visibility from cmo_cfo_review onward
    # =================================================================
    for role_code in ['regional_cmo', 'regional_cfo']:
        # cmo_cfo_review: validate (this is where they act)
        add(role_code, 'cmo_cfo_review', 'validate')

        # After their step: view
        for status in ['emea_final_review', 'corporate_review']:
            add(role_code, status, 'view')

        # Approved: view + duplicate
        add(role_code, 'approved', 'view')
        add(role_code, 'approved', 'duplicate')

    # =================================================================
    # CORPORATE (Paola + Diana)
    # Only see corporate_review and approved
    # =================================================================
    for role_code in ['corporate_paola', 'corporate_diana']:
        add(role_code, 'corporate_review', 'validate')
        add(role_code, 'approved', 'view')

    # =================================================================
    # SUPER-ADMIN (Thibault, Vanessa, Sandrine)
    # advance_phase + delete + duplicate on ALL statuses
    # =================================================================
    for status in ALL_STATUSES:
        add('super_admin', status, 'advance_phase')
        add('super_admin', status, 'delete')
        add('super_admin', status, 'duplicate')

    return entries


# =====================================================================
# SEED FUNCTION
# =====================================================================

def seed(db: Session) -> None:
    print("Seeding permissions, roles, and matrix (Rock 2)...")

    # -- 1. Permissions (upsert) ---------------------------------------
    print("  -> Permissions...")
    permission_by_code = {}
    for p_data in PERMISSIONS_DATA:
        existing = db.query(Permission).filter_by(code=p_data['code']).first()
        if existing:
            # Update hierarchy_level and description in case they changed
            existing.hierarchy_level = p_data['hierarchy_level']
            existing.display_name = p_data['display_name']
            existing.description = p_data['description']
            permission_by_code[p_data['code']] = existing
        else:
            perm = Permission(**p_data)
            db.add(perm)
            db.flush()
            permission_by_code[p_data['code']] = perm
    print(f"     {len(PERMISSIONS_DATA)} permissions OK")

    # -- 2. Roles (upsert — update scope_value if changed) -------------
    print("  -> Roles...")

    # Delete roles that no longer exist
    for old_code in ['ceo_validator', 'emea_ps_editor', 'ai_to_market_admin']:
        old_role = db.query(Role).filter_by(code=old_code).first()
        if old_role:
            db.delete(old_role)
            db.flush()
            print(f"     Deleted obsolete role: {old_code}")

    role_by_code = {}
    for r_data in ROLES_DATA:
        existing = db.query(Role).filter_by(code=r_data['code']).first()
        if existing:
            # Update scope_value and other fields in case they changed
            existing.scope_type = r_data['scope_type']
            existing.scope_value = r_data['scope_value']
            existing.can_override_lock = r_data['can_override_lock']
            existing.display_name = r_data['display_name']
            existing.description = r_data['description']
            role_by_code[r_data['code']] = existing
        else:
            role = Role(**r_data)
            db.add(role)
            db.flush()
            role_by_code[r_data['code']] = role
    print(f"     {len(ROLES_DATA)} roles OK")

    # -- 3. Permission matrix (wipe + rebuild) -------------------------
    print("  -> Rebuilding permission matrix...")

    deleted_count = db.query(RolePermission).delete()
    db.flush()
    print(f"     Wiped {deleted_count} old matrix entries")

    matrix = build_matrix()
    created = 0
    errors = 0
    for entry in matrix:
        role = role_by_code.get(entry['role_code'])
        perm = permission_by_code.get(entry['permission_code'])
        if not role or not perm:
            print(f"     WARNING: Missing role '{entry['role_code']}' "
                  f"or permission '{entry['permission_code']}'")
            errors += 1
            continue

        rp = RolePermission(
            role_id=role.id,
            loa_status=entry['loa_status'],
            permission_id=perm.id,
        )
        db.add(rp)
        created += 1

    db.commit()
    print(f"     {created} matrix entries created ({errors} errors)")
    print(f"Done -- {len(PERMISSIONS_DATA)} permissions, "
          f"{len(ROLES_DATA)} roles, {created} matrix entries.")


def main():
    db = SessionLocal()
    try:
        seed(db)
    except Exception as e:
        print(f"Seed failed: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
        sys.exit(1)
    finally:
        db.close()


if __name__ == '__main__':
    main()
