"""
Seed script — Workflow v2.1 (progressive visibility, June 2026)

Based on the client-approved document: LAURA_Approval_Workflow_and_Permissions v2.

Key changes from v2.0:
  - Progressive visibility: roles only get access from their step onward
  - EMEA PS Editor = Super-Admin in the matrix (Advance everywhere)
  - Draft and Rejected have identical permissions
  - Local Finance gets Edit on draft/rejected (same as Local Marketer)
  - 195 matrix entries (was 226)

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


CLUSTERS = ['FRANCE', 'ITALY', 'DACH', 'IBERIA', 'NORTH', 'META',
            'EAST & GR', 'RUSSIA']


# ═══════════════════════════════════════════════════════════════════════
# THE 5 PERMISSIONS
# ═══════════════════════════════════════════════════════════════════════

PERMISSIONS_DATA = [
    {'code': 'view',          'display_name': 'View',          'description': 'Read-only access to the LOA.',                                        'hierarchy_level': 1},
    {'code': 'comment',       'display_name': 'Comment',       'description': 'Can add comments per section without modifying content.',              'hierarchy_level': 2},
    {'code': 'validate',      'display_name': 'Validate',      'description': 'Can click Approve / Reject / Approve-with-comment.',                  'hierarchy_level': 2},
    {'code': 'edit',          'display_name': 'Edit',          'description': 'Can modify the content of the LOA.',                                  'hierarchy_level': 3},
    {'code': 'advance_phase', 'display_name': 'Advance Phase', 'description': 'Can advance the LOA to the next step. Includes Edit, Validate, Comment, View.', 'hierarchy_level': 4},
]


# ═══════════════════════════════════════════════════════════════════════
# THE 31 ROLES
# ═══════════════════════════════════════════════════════════════════════

ROLES_DATA = []

# Local Marketers (8)
for cluster in CLUSTERS:
    cc = cluster.lower().replace(' & ', '_').replace(' ', '_')
    ROLES_DATA.append({
        'code': f'{cc}_marketer',
        'display_name': f'{cluster.title() if cluster != "DACH" else cluster} Marketer',
        'description': f'Local marketer for {cluster}. Creates LOAs, edits during draft and after rejection.',
        'scope_type': 'cluster', 'scope_value': [cluster], 'can_override_lock': False,
    })

# Local Finance (8)
for cluster in CLUSTERS:
    cc = cluster.lower().replace(' & ', '_').replace(' ', '_')
    ROLES_DATA.append({
        'code': f'{cc}_finance',
        'display_name': f'{cluster.title() if cluster != "DACH" else cluster} Finance',
        'description': f'Local finance for {cluster}. Edits during draft and after rejection, views during review.',
        'scope_type': 'cluster', 'scope_value': [cluster], 'can_override_lock': False,
    })

# EMEA PS Editor (kept as role, but matrix = Super-Admin)
ROLES_DATA.append({
    'code': 'emea_ps_editor',
    'display_name': 'EMEA PS Editor',
    'description': 'Vanessa, Thibault, Sandrine. Same permissions as Super-Admin in the matrix.',
    'scope_type': 'all', 'scope_value': None, 'can_override_lock': False,
})

# Regional CMO / CFO
ROLES_DATA.extend([
    {'code': 'regional_cmo', 'display_name': 'Regional CMO', 'description': 'Alexandra. Validates at CMO/CFO step (PowerPoint).',
     'scope_type': 'all', 'scope_value': None, 'can_override_lock': False},
    {'code': 'regional_cfo', 'display_name': 'Regional CFO', 'description': 'Giulia. Validates at CMO/CFO step (Excel).',
     'scope_type': 'all', 'scope_value': None, 'can_override_lock': False},
])

# Global Brands (6)
ROLES_DATA.extend([
    {'code': 'global_brand_rayban',         'display_name': 'Global Brand Ray-Ban',         'description': 'Comments on Ray-Ban LOAs during global review.',
     'scope_type': 'brand', 'scope_value': ['HB - Ray-Ban', 'HB - Ray-Ban Meta'], 'can_override_lock': False},
    {'code': 'global_brand_oakley',         'display_name': 'Global Brand Oakley',          'description': 'Comments on Oakley LOAs during global review.',
     'scope_type': 'brand', 'scope_value': ['HB - Oakley', 'HB - Oakley Meta', 'Sport (OO/ZB/OW)'], 'can_override_lock': False},
    {'code': 'global_brand_essilor_lenses', 'display_name': 'Global Brand Essilor Lenses',  'description': 'Comments on Essilor Lenses LOAs during global review.',
     'scope_type': 'brand', 'scope_value': ['Essilor - Varilux', 'Essilor - Stellest', 'Essilor - Eyezen', 'Essilor - Crizal', 'Essilor - Masterbrand', 'Essilor - Multibrand', 'Multibrand'], 'can_override_lock': False},
    {'code': 'global_brand_transitions',    'display_name': 'Global Brand Transitions',     'description': 'Comments on Transitions LOAs during global review.',
     'scope_type': 'brand', 'scope_value': ['Transitions'], 'can_override_lock': False},
    {'code': 'global_brand_other_hb',       'display_name': 'Global Brand — Other HB',      'description': 'Comments on Vogue, Persol, Oliver Peoples, etc.',
     'scope_type': 'brand', 'scope_value': ['HB - Vogue', 'HB - Persol', 'HB - Oliver Peoples', 'HB - Alain Mikli', 'HB - BLIZ', 'HB - Arnette', 'HB - Others'], 'can_override_lock': False},
    {'code': 'global_brand_license',        'display_name': 'Global Brand — License',       'description': 'Comments on License Brand LOAs.',
     'scope_type': 'brand', 'scope_value': ['LB - Luxury', 'LB - PFF', 'LB - Armani Exchange', 'LB - Brunello Cucinelli', 'LB - Burberry', 'LB - Chanel', 'LB - Dolce & Gabbana', 'LB - Emporio Armani', 'LB - Ferrari', 'LB - Ferrari Scuderia', 'LB - Giorgio Armani', 'LB - Jimmy Choo', 'LB - Michael Kors', 'LB - Miu Miu', 'LB - Moncler', 'LB - Prada', 'LB - Prada Linea Rossa', 'LB - Polo Ralph Lauren', 'LB - Polo', 'LB - Ralph', 'LB - Swarovski', 'LB - Starck Eye', 'LB - Tiffany', 'LB - Versace', 'LB - Others'], 'can_override_lock': False},
])

# Global Functions (3)
ROLES_DATA.extend([
    {'code': 'global_function_pr_events', 'display_name': 'Global Function PR & Events',    'description': 'Comments on PR and Events LOAs during functions review.',
     'scope_type': 'function', 'scope_value': ['PR', 'Events'], 'can_override_lock': False},
    {'code': 'global_function_medical',   'display_name': 'Global Function Medical Affairs', 'description': 'Comments on Medical Affairs LOAs during functions review.',
     'scope_type': 'function', 'scope_value': ['Medical Affairs'], 'can_override_lock': False},
    {'code': 'global_function_trade',     'display_name': 'Global Function Trade Marketing', 'description': 'Comments on Trade Incentive LOAs during functions review.',
     'scope_type': 'function', 'scope_value': ['Trade Incentive'], 'can_override_lock': False},
])

# Corporate (2)
ROLES_DATA.extend([
    {'code': 'corporate_paola', 'display_name': 'Corporate Marketing Finance — Paola', 'description': 'Validates at corporate review — final gate.',
     'scope_type': 'all', 'scope_value': None, 'can_override_lock': False},
    {'code': 'corporate_diana', 'display_name': 'Corporate Marketing Finance — Diana', 'description': 'Validates at corporate review — final gate.',
     'scope_type': 'all', 'scope_value': None, 'can_override_lock': False},
])

# Super-Admin (1)
ROLES_DATA.append({
    'code': 'super_admin',
    'display_name': 'Super-Admin',
    'description': 'Thibault, Vanessa, Sandrine. Full control everywhere + can_override_lock.',
    'scope_type': 'all', 'scope_value': None, 'can_override_lock': True,
})


# ═══════════════════════════════════════════════════════════════════════
# THE PERMISSION MATRIX — Progressive visibility
# ═══════════════════════════════════════════════════════════════════════
#
# Rule: a role gets access only from its active step onward.
# Once they've had access, they retain View for all subsequent steps.
# Draft and Rejected have identical permissions.
#
# ┌──────────────────────┬──────────┬──────┬────────┬─────────┬────────┬──────┬─────────┐
# │                      │draft/rej │ emea │ global │ cmo_cfo │   gf   │ corp │approved │
# ├──────────────────────┼──────────┼──────┼────────┼─────────┼────────┼──────┼─────────┤
# │ Local Marketer (×8)  │  Edit    │ View │  View  │  View   │  View  │ View │  View   │
# │ Local Finance  (×8)  │  Edit    │ View │  View  │  View   │  View  │ View │  View   │
# │ Global Brands  (×6)  │   —      │  —   │Comment │  View   │  View  │ View │  View   │
# │ Regional CMO         │   —      │  —   │   —    │Validate │  View  │ View │  View   │
# │ Regional CFO         │   —      │  —   │   —    │Validate │  View  │ View │  View   │
# │ Global Func.   (×3)  │   —      │  —   │   —    │   —     │Comment │ View │  View   │
# │ Corporate      (×2)  │   —      │  —   │   —    │   —     │   —    │Valid.│  View   │
# │ EMEA PS Editor       │ Advance  │ Adv  │  Adv   │  Adv    │  Adv   │ Adv  │  Adv    │
# │ Super-Admin          │ Advance  │ Adv  │  Adv   │  Adv    │  Adv   │ Adv  │  Adv    │
# └──────────────────────┴──────────┴──────┴────────┴─────────┴────────┴──────┴─────────┘

ALL_STATUSES = [
    'draft', 'emea_review', 'global_review', 'cmo_cfo_review',
    'global_functions_review', 'corporate_review', 'approved', 'rejected',
]


def build_matrix():
    matrix = []

    def add(role_code, perms):
        for status, perm in perms.items():
            matrix.append({'role_code': role_code, 'loa_status': status, 'permission_code': perm})

    # ─── Local Marketers — Edit on draft+rejected, View from emea onward
    for cluster in CLUSTERS:
        cc = cluster.lower().replace(' & ', '_').replace(' ', '_')
        add(f'{cc}_marketer', {
            'draft':                    'edit',
            'emea_review':              'view',
            'global_review':            'view',
            'cmo_cfo_review':           'view',
            'global_functions_review':  'view',
            'corporate_review':         'view',
            'approved':                 'view',
            'rejected':                 'edit',
        })

    # ─── Local Finance — same as Local Marketer
    for cluster in CLUSTERS:
        cc = cluster.lower().replace(' & ', '_').replace(' ', '_')
        add(f'{cc}_finance', {
            'draft':                    'edit',
            'emea_review':              'view',
            'global_review':            'view',
            'cmo_cfo_review':           'view',
            'global_functions_review':  'view',
            'corporate_review':         'view',
            'approved':                 'view',
            'rejected':                 'edit',
        })

    # ─── Global Brands — access starts at global_review
    for rc in ['global_brand_rayban', 'global_brand_oakley', 'global_brand_essilor_lenses',
               'global_brand_transitions', 'global_brand_other_hb', 'global_brand_license']:
        add(rc, {
            'global_review':            'comment',
            'cmo_cfo_review':           'view',
            'global_functions_review':  'view',
            'corporate_review':         'view',
            'approved':                 'view',
        })

    # ─── Regional CMO — access starts at cmo_cfo_review
    add('regional_cmo', {
        'cmo_cfo_review':           'validate',
        'global_functions_review':  'view',
        'corporate_review':         'view',
        'approved':                 'view',
    })

    # ─── Regional CFO — same pattern as CMO
    add('regional_cfo', {
        'cmo_cfo_review':           'validate',
        'global_functions_review':  'view',
        'corporate_review':         'view',
        'approved':                 'view',
    })

    # ─── Global Functions — access starts at global_functions_review
    for rc in ['global_function_pr_events', 'global_function_medical', 'global_function_trade']:
        add(rc, {
            'global_functions_review':  'comment',
            'corporate_review':         'view',
            'approved':                 'view',
        })

    # ─── Corporate — access starts at corporate_review
    for rc in ['corporate_paola', 'corporate_diana']:
        add(rc, {
            'corporate_review':         'validate',
            'approved':                 'view',
        })

    # ─── EMEA PS Editor — Advance everywhere (= Super-Admin in the matrix)
    for status in ALL_STATUSES:
        matrix.append({'role_code': 'emea_ps_editor', 'loa_status': status, 'permission_code': 'advance_phase'})

    # ─── Super-Admin — Advance everywhere
    for status in ALL_STATUSES:
        matrix.append({'role_code': 'super_admin', 'loa_status': status, 'permission_code': 'advance_phase'})

    return matrix


# ═══════════════════════════════════════════════════════════════════════
# SEEDING
# ═══════════════════════════════════════════════════════════════════════

def seed(db: Session) -> None:
    print("🌱 Seeding permissions, roles, and matrix (v2.1 — progressive visibility)...")

    # 1. Permissions
    print("  → Permissions...")
    permission_by_code = {}
    for p_data in PERMISSIONS_DATA:
        existing = db.query(Permission).filter_by(code=p_data['code']).first()
        if existing:
            permission_by_code[p_data['code']] = existing
        else:
            perm = Permission(**p_data)
            db.add(perm)
            db.flush()
            permission_by_code[p_data['code']] = perm
    print(f"     {len(PERMISSIONS_DATA)} permissions OK")

    # 2. Roles
    print("  → Roles...")
    role_by_code = {}
    for r_data in ROLES_DATA:
        existing = db.query(Role).filter_by(code=r_data['code']).first()
        if existing:
            role_by_code[r_data['code']] = existing
        else:
            role = Role(**r_data)
            db.add(role)
            db.flush()
            role_by_code[r_data['code']] = role
    print(f"     {len(ROLES_DATA)} roles OK")

    # 3. Matrix (wipe + rebuild)
    print("  → Rebuilding matrix...")
    deleted_count = db.query(RolePermission).delete()
    db.flush()
    print(f"     Wiped {deleted_count} old entries")

    matrix = build_matrix()
    created = 0
    errors = 0
    for entry in matrix:
        role = role_by_code.get(entry['role_code'])
        perm = permission_by_code.get(entry['permission_code'])
        if not role or not perm:
            print(f"     ⚠ Missing: role={entry['role_code']} perm={entry['permission_code']}")
            errors += 1
            continue
        rp = RolePermission(role_id=role.id, loa_status=entry['loa_status'], permission_id=perm.id)
        db.add(rp)
        created += 1

    db.commit()
    print(f"✅ Done — {len(PERMISSIONS_DATA)} perms, {len(ROLES_DATA)} roles, {created} matrix entries ({errors} errors)")


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
