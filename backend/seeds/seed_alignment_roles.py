"""
LAURA — seed the three alignment-chain reviewer roles, their demo users, and
the LOAReviewStage rows the chain runs on.

Why this exists
---------------
`backend/api/review_stage.py` maps one role code to each stage:

    local_alignment → global_function_review → global_brand_review

Those role codes were never seeded, so `/permissions/my-role` could never
return one, every viewer of the split-screen review fell through to the
read-only marketer branch, and `/review-stage/queue` was permanently empty.

Stage rows are only created on submit (`POST /loa/{id}/submit`), so LOAs that
predate the alignment feature — which is all of the imported/seeded ones — have
no chain either. This backfills the ones still inside the pre-CMO pipeline.

Idempotent: safe to re-run.

    venv/Scripts/python.exe -m backend.seeds.seed_alignment_roles
"""
from __future__ import annotations

import sys

from passlib.context import CryptContext

from backend.models.database import SessionLocal
from backend.models.loa import LOA
from backend.models.role import Role
from backend.models.user import User
from backend.models.review import LOAReviewStage, ALIGNMENT_STAGES

# Same default as seed_users.py, so these reviewers sign in like every other demo user.
_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
DEFAULT_PASSWORD = "laura2026"

# ── Roles ────────────────────────────────────────────────────────────────────
# scope_type='all': the alignment chain reviews every cluster's LOAs.
ROLES = {
    "local_alignment": {
        "display_name": "Local Alignment",
        "description": "Stage 1 of the alignment chain. Reviews and approves locally.",
    },
    "global_function_review": {
        "display_name": "Global Function Review",
        "description": "Stage 2 of the alignment chain. Function sign-off.",
    },
    "global_brand_review": {
        "display_name": "Global Brand Review",
        "description": "Stage 3 of the alignment chain. Brand sign-off before CMO/CFO.",
    },
}

# ── Demo reviewers ───────────────────────────────────────────────────────────
USERS = {
    "local-alignment@laura.local": ("J. Bertrand", "local_alignment"),
    "global-function@laura.local": ("A. Kowalski", "global_function_review"),
    "global-brand@laura.local": ("S. Moretti", "global_brand_review"),
}

# LOAs in these statuses are still upstream of CMO/CFO, so an alignment chain
# is meaningful for them. Approved/rejected/archived LOAs are left untouched.
BACKFILL_STATUSES = (
    "local_alignment",
    "emea_review",
    "global_review",
    "emea_post_global_review",
)


def seed_roles(db) -> dict[str, Role]:
    out: dict[str, Role] = {}
    for code, attrs in ROLES.items():
        role = db.query(Role).filter_by(code=code).first()
        if role is None:
            role = Role(
                code=code,
                display_name=attrs["display_name"],
                description=attrs["description"],
                scope_type="all",
                can_override_lock=False,
            )
            db.add(role)
            db.flush()
            print(f"  + role {code}")
        else:
            print(f"  = role {code} (exists)")
        out[code] = role
    return out


def seed_users(db, roles: dict[str, Role]) -> None:
    for email, (full_name, role_code) in USERS.items():
        user = db.query(User).filter(User.email == email).first()
        if user is None:
            user = User(
                email=email,
                full_name=full_name,
                hashed_password=_pwd.hash(DEFAULT_PASSWORD),
                role="approver",            # legacy string column
                role_id=roles[role_code].id,
                cluster=None,
                is_active=True,
            )
            db.add(user)
            print(f"  + user {email} -> {role_code}")
        else:
            if user.role_id != roles[role_code].id:
                user.role_id = roles[role_code].id
                print(f"  ~ user {email} -> {role_code} (role reassigned)")
            else:
                print(f"  = user {email} (exists)")


def backfill_stages(db) -> None:
    loas = db.query(LOA).filter(LOA.status.in_(BACKFILL_STATUSES)).all()
    have = {
        (str(r.loa_id), r.stage)
        for r in db.query(LOAReviewStage).all()
    }
    added = 0
    for loa in loas:
        for stage in ALIGNMENT_STAGES:
            if (str(loa.id), stage) in have:
                continue
            db.add(LOAReviewStage(loa_id=str(loa.id), stage=stage, status="pending"))
            added += 1
    print(f"  {len(loas)} LOAs in the pre-CMO pipeline, {added} stage rows created")


def main() -> int:
    db = SessionLocal()
    try:
        print("Roles:")
        roles = seed_roles(db)
        print("Users:")
        seed_users(db, roles)
        print("Stage backfill:")
        backfill_stages(db)
        db.commit()
        print("Done.")
        return 0
    except Exception as e:                                    # noqa: BLE001
        db.rollback()
        print(f"FAILED: {e}", file=sys.stderr)
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
