"""
Seed script for Sprint 2 — User accounts.

Creates all 52 LAURA users with their role assignments.

Run AFTER `seed_roles_and_permissions.py`.

Usage:
    python -m backend.seeds.seed_users

All POC passwords: laura2026
"""
import backend.models  # noqa: F401
import sys
from sqlalchemy.orm import Session
from passlib.context import CryptContext

from backend.models.database import SessionLocal
from backend.models.user import User
from backend.models.role import Role


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
DEFAULT_PASSWORD = "laura2026"


def hash_password(pw: str) -> str:
    return pwd_context.hash(pw)


# ═══════════════════════════════════════════════════════════════════════
# USER DEFINITIONS
# ═══════════════════════════════════════════════════════════════════════
#45users
# Format: (email, full_name, role_code, optional cluster shortcut for legacy
# `cluster` field — kept for backward compatibility).

USERS_DATA = [

    # ─── Local Markets — Marketers (15 users, 8 roles) ────────────────
    # France has 4 marketers per Thibault's kickoff email
    ('flora@laura.local',     'Flora (FR Marketer)',     'france_marketer',   'FRANCE'),
    ('anais@laura.local',     'Anais (FR Marketer)',     'france_marketer',   'FRANCE'),
    ('agathe@laura.local',    'Agathe (FR Marketer)',    'france_marketer',   'FRANCE'),
    ('marie@laura.local',     'Marie (FR Marketer)',     'france_marketer',   'FRANCE'),

    ('chiara@laura.local',    'Chiara (IT Marketer)',    'italy_marketer',    'ITALY'),
    ('alessandra@laura.local','Alessandra (IT Marketer)','italy_marketer',    'ITALY'),

    ('olaf@laura.local',      'Olaf (DACH Marketer)',    'dach_marketer',     'DACH'),

    ('nadia@laura.local',     'Nadia (IB Marketer)',     'iberia_marketer',   'IBERIA'),

    ('ewelina@laura.local',   'Ewelina (NORTH Marketer)','north_marketer',    'NORTH'),
    ('lindsey@laura.local',   'Lindsey (NORTH Marketer)','north_marketer',    'NORTH'),

    ('justine@laura.local',   'Justine (META Marketer)', 'meta_marketer',     'META'),

    ('aude@laura.local',      'Aude (EAST&GR Marketer)', 'east_gr_marketer',  'EAST & GR'),
    ('ionela@laura.local',    'Ionela (EAST&GR Marketer)','east_gr_marketer', 'EAST & GR'),

    ('elena@laura.local',     'Elena (RU Marketer)',     'russia_marketer',   'RUSSIA'),
    ('alena@laura.local',     'Alena (RU Marketer)',     'russia_marketer',   'RUSSIA'),

    # ─── Local Markets — Finance (8 users, 8 roles) ───────────────────
    ('finance-france@laura.local',   'France Finance',     'france_finance',   'FRANCE'),
    ('finance-italy@laura.local',    'Italy Finance',      'italy_finance',    'ITALY'),
    ('finance-dach@laura.local',     'DACH Finance',       'dach_finance',     'DACH'),
    ('finance-iberia@laura.local',   'Iberia Finance',     'iberia_finance',   'IBERIA'),
    ('finance-north@laura.local',    'North Finance',      'north_finance',    'NORTH'),
    ('finance-meta@laura.local',     'Meta Finance',       'meta_finance',     'META'),
    ('finance-east@laura.local',     'East & GR Finance',  'east_gr_finance',  'EAST & GR'),
    ('finance-russia@laura.local',   'Russia Finance',     'russia_finance',   'RUSSIA'),

    # ─── Regional / EMEA (3 users, 3 roles) ───────────────────────────
    ('vanessa@essilor.com',   'Vanessa Stöecklein',   'emea_ps_editor',  None),
    ('alexandra@essilor.com', 'Alexandra (Reg. CMO)', 'regional_cmo',    None),
    ('giulia@essilor.com',    'Giulia Uccelli',       'regional_cfo',    None),

    # ─── Global Brands (6 users, 6 roles) ─────────────────────────────
    ('marco@essilor.com',              'Marco (Ray-Ban Brand)',     'global_brand_rayban',         None),
    ('brand-oakley@laura.local',       'Oakley Brand Team',          'global_brand_oakley',         None),
    ('brand-essilor@laura.local',      'Essilor Lenses Brand Team',  'global_brand_essilor_lenses', None),
    ('brand-transitions@laura.local',  'Transitions Brand Team',     'global_brand_transitions',    None),
    ('brand-other-hb@laura.local',     'Other HB Brand Team',        'global_brand_other_hb',       None),
    ('brand-license@laura.local',      'License Brands Team',        'global_brand_license',        None),

    # ─── Global Functions (3 users, 3 roles) ──────────────────────────
    ('sofia@essilor.com',           'Sofia (PR & Events)',        'global_function_pr_events',  None),
    ('function-medical@laura.local','Medical Affairs Team',       'global_function_medical',    None),
    ('function-trade@laura.local',  'Trade Marketing Team',       'global_function_trade',      None),

    # ─── Corporate (2 users, 2 roles) ─────────────────────────────────
    ('paola@essilor.com', 'Paola Boneto',   'corporate_paola', None),
    ('diana@essilor.com', 'Diana Canazaro', 'corporate_diana', None),

    # ─── CEO presentation (1 user, 1 role) ────────────────────────────
    ('ceo-validator@laura.local', 'CEO Marketing Finance Assistant', 'ceo_validator', None),

    # ─── Super-Admin (3 users, 1 role) ────────────────────────────────
    ('thibault@essilor.com',  'Thibault de Bodman', 'super_admin', None),
    # Vanessa is also a super-admin (admin hat). We keep her main account
    # with emea_ps_editor and create a SECOND account for her admin role.
    # In production we'll merge by giving one user multiple roles.
    ('vanessa-admin@essilor.com', 'Vanessa (Super-Admin)', 'super_admin', None),
    ('sandrine@essilor.com', 'Sandrine Goetz', 'super_admin', None),

    # ─── AI to Market (4 users, 1 role) ───────────────────────────────
    ('sahar@aitomarketgroup.com',  'Sahar (AI to Market)',   'ai_to_market_admin', None),
    ('neha@aitomarketgroup.com',   'Neha (AI to Market)',    'ai_to_market_admin', None),
    ('vandana@aitomarketgroup.com','Vandana (AI to Market)', 'ai_to_market_admin', None),
    ('alabhya@essilor.com',        'Alabhya (AI to Market)', 'ai_to_market_admin', None),
]


def seed(db: Session) -> None:
    print("🌱 Seeding user accounts...")

    # Build lookup of role_code → role.id
    roles = db.query(Role).all()
    role_by_code = {r.code: r for r in roles}
    if not role_by_code:
        print("❌ No roles found in DB. Run seed_roles_and_permissions.py first.")
        sys.exit(1)

    hashed_default = hash_password(DEFAULT_PASSWORD)

    created = 0
    updated = 0
    for email, full_name, role_code, cluster in USERS_DATA:
        role = role_by_code.get(role_code)
        if not role:
            print(f"  ⚠ Role '{role_code}' not found — skipping user {email}")
            continue

        existing = db.query(User).filter_by(email=email).first()
        if existing:
            # Update role_id if it changed (don't reset password)
            if existing.role_id != role.id:
                existing.role_id = role.id
                existing.full_name = full_name
                existing.cluster = cluster
                updated += 1
            continue

        user = User(
            email=email,
            full_name=full_name,
            hashed_password=hashed_default,
            role_id=role.id,
            cluster=cluster,
            # Keep legacy `role` string aligned for backward compat
            role={
                'france_marketer': 'editor', 'italy_marketer': 'editor',
                'dach_marketer': 'editor',   'iberia_marketer': 'editor',
                'north_marketer': 'editor',  'meta_marketer': 'editor',
                'east_gr_marketer': 'editor','russia_marketer': 'editor',
                'france_finance': 'finance', 'italy_finance': 'finance',
                'dach_finance': 'finance',   'iberia_finance': 'finance',
                'north_finance': 'finance',  'meta_finance': 'finance',
                'east_gr_finance': 'finance','russia_finance': 'finance',
                'emea_ps_editor': 'editor',
                'regional_cmo': 'approver',
                'regional_cfo': 'approver',
                'super_admin': 'admin',
                'ai_to_market_admin': 'admin',
            }.get(role_code, 'editor'),
            is_active=True,
        )
        db.add(user)
        created += 1

    db.commit()
    print(f"✅ Seed complete: {created} created, {updated} updated")
    print(f"   Default password for all: {DEFAULT_PASSWORD}")


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
