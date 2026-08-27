"""
LAURA — push the active cycle's LOAs through the alignment chain so the
CMO deck and CFO spreadsheet have something to review.

Why this exists
---------------
`GET /review/{cycle_id}/deck` (which backs both the CMO slideshow and the CFO
Excel view) returns only LOAs that satisfy **both**:

  1. `LOA.cycle_id == cycle_id`
  2. all three LOAReviewStage rows approved

Condition 2 has never been satisfiable on this database — stage rows are only
written on `POST /loa/{id}/submit`, and every seeded/imported LOA predates that.
So the CMO and CFO screens rendered "Nothing to review" even though 21 LOAs are
correctly linked to the open normal cycle.

This marks the chain complete for the cycle's LOAs, attributing each stage to
the matching seeded reviewer, and advances pre-CMO LOAs to `cmo_cfo_review`.
Terminal statuses (approved / rejected / archived) are left alone.

Idempotent: safe to re-run.

    venv/Scripts/python.exe -m backend.seeds.seed_cmo_deck_ready
"""
from __future__ import annotations

import sys
from datetime import datetime, timezone

from backend.models.database import SessionLocal
from backend.models.loa import LOA
from backend.models.loa_cycle import LoaCycle
from backend.models.review import LOAReviewStage, ALIGNMENT_STAGES
from backend.models.user import User

# Stage → the seeded reviewer credited with the approval.
STAGE_APPROVER = {
    "local_alignment": "local-alignment@laura.local",
    "global_function_review": "global-function@laura.local",
    "global_brand_review": "global-brand@laura.local",
}

# Statuses that are finished; advancing these to cmo_cfo_review would rewrite history.
TERMINAL = {"approved", "rejected", "archived", "closed"}


def main() -> int:
    db = SessionLocal()
    try:
        cycles = (
            db.query(LoaCycle)
            .filter(LoaCycle.is_active.is_(True))
            .all()
        )
        if not cycles:
            print("No active cycle.")
            return 1

        approvers = {
            stage: db.query(User).filter(User.email == email).first()
            for stage, email in STAGE_APPROVER.items()
        }
        missing = [s for s, u in approvers.items() if u is None]
        if missing:
            print(f"Missing reviewer accounts for {missing}. "
                  f"Run backend.seeds.seed_alignment_roles first.", file=sys.stderr)
            return 1

        now = datetime.now(timezone.utc)
        total_approved = 0
        total_advanced = 0

        for cycle in cycles:
            loas = db.query(LOA).filter(LOA.cycle_id == cycle.id).all()
            print(f"{cycle.name!r}: {len(loas)} LOAs linked")
            if not loas:
                continue

            for loa in loas:
                rows = {
                    r.stage: r
                    for r in db.query(LOAReviewStage).filter_by(loa_id=str(loa.id)).all()
                }
                for stage in ALIGNMENT_STAGES:
                    row = rows.get(stage)
                    if row is None:
                        row = LOAReviewStage(loa_id=str(loa.id), stage=stage, status="pending")
                        db.add(row)
                        db.flush()
                    if row.status != "approved":
                        row.status = "approved"
                        row.approved_by = approvers[stage].id
                        row.approved_at = now
                        total_approved += 1

                if loa.status not in TERMINAL and loa.status != "cmo_cfo_review":
                    loa.status = "cmo_cfo_review"
                    total_advanced += 1

        db.commit()
        print(f"  {total_approved} stage rows approved, "
              f"{total_advanced} LOAs advanced to cmo_cfo_review")
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
