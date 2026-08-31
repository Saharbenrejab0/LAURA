"""
Sprint 2.5 — Add the 'advance_phase' permission and matrix entries.

The 'advance_phase' permission represents the right to MOVE a LOA from
one workflow status to the next, when that transition is not a validation
but a phase opening/closing act.

Examples of advance_phase transitions:
  - local_prep -> country_review        (open country review)
  - country_review -> global_review     (open global review)
  - global_review -> cmo_review         (close global comments)
  - corporate_review -> ceo_validation  (close corporate review)

These are distinct from 'validate' transitions which represent explicit
approval decisions:
  - cmo_review -> cfo_review            (CMO validates)
  - cfo_review -> corporate_review      (CFO validates)
  - ceo_validation -> approved          (CEO validates)

Who gets advance_phase?
  - emea_ps_editor (Vanessa)  -> on the 4 phase-opening transitions
  - super_admin                -> same 4 transitions (for override capability)

Run after `seed_roles_and_permissions.py`. Idempotent.

Usage:
    python -m backend.seeds.seed_advance_permission
"""
import backend.models  # noqa: F401 — register all models for SQLAlchemy

import sys
from sqlalchemy.orm import Session

from backend.models.database import SessionLocal
from backend.models.permission import Permission
from backend.models.role import Role
from backend.models.role_permission import RolePermission


# The 4 statuses where an "advance phase" action makes sense.
ADVANCE_PHASE_STATUSES = [
    'local_prep',        # advance -> country_review
    'country_review',    # advance -> global_review
    'global_review',     # advance -> cmo_review
    'corporate_review',  # advance -> ceo_validation
]

# Roles that get advance_phase permission on those statuses.
ADVANCE_PHASE_ROLES = [
    'emea_ps_editor',
    'super_admin',
]


def seed(db: Session) -> None:
    print("🌱 Adding 'advance_phase' permission and matrix entries...")

    # ── 1. Create the permission if missing ─────────────────────────
    perm = db.query(Permission).filter_by(code='advance_phase').first()
    if not perm:
        perm = Permission(
            code='advance_phase',
            display_name='Advance Phase',
            description='Move a LOA from one workflow status to the next '
                        '(phase opening/closing acts, not validation decisions).',
            hierarchy_level=2,  # same level as validate (sibling, not parent)
        )
        db.add(perm)
        db.flush()
        print("     advance_phase permission created")
    else:
        print("     advance_phase permission already exists")

    # ── 2. Add matrix entries for each (role, status) pair ──────────
    role_by_code = {
        r.code: r for r in db.query(Role).filter(Role.code.in_(ADVANCE_PHASE_ROLES)).all()
    }
    if len(role_by_code) != len(ADVANCE_PHASE_ROLES):
        missing = set(ADVANCE_PHASE_ROLES) - set(role_by_code.keys())
        print(f"  ⚠ Missing roles in DB: {missing}. Run seed_roles_and_permissions first.")
        sys.exit(1)

    created = 0
    replaced = 0
    skipped = 0
    for role_code, role in role_by_code.items():
        for status in ADVANCE_PHASE_STATUSES:
            existing = db.query(RolePermission).filter_by(
                role_id=role.id,
                loa_status=status,
            ).first()

            if existing:
                if existing.permission_id == perm.id:
                    # Already correctly configured
                    skipped += 1
                    continue
                # Existing has a different permission (likely 'view' or 'edit').
                # We REPLACE it: advance_phase is a stronger right that
                # supersedes view/edit on these specific transitions.
                existing.permission_id = perm.id
                replaced += 1
            else:
                rp = RolePermission(
                    role_id=role.id,
                    loa_status=status,
                    permission_id=perm.id,
                )
                db.add(rp)
                created += 1

    db.commit()
    print(f"     {created} new entries, {replaced} replaced, {skipped} unchanged")
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