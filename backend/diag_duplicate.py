# backend/diag_duplicate.py
# Run from C:\Users\sahar\Desktop\Laura\backend with venv active:
#   python diag_duplicate.py
from sqlalchemy import select, desc
from models.database import SessionLocal
from models.loa import LOA

with SessionLocal() as s:
    rows = s.execute(
        select(LOA).order_by(desc(LOA.created_at)).limit(3)
    ).scalars().all()

    for loa in rows:
        print(f"--- LOA {loa.id} ---")
        print(f"  loa_draft_id     = {getattr(loa, 'loa_draft_id', 'N/A')!r}")
        print(f"  status           = {loa.status!r}")
        print(f"  requestor_email  = {loa.requestor_email!r}")   # ← LE champ critique
        print(f"  is_demo          = {loa.is_demo!r}")
        print(f"  created_at       = {loa.created_at}")
        # Si tu as déjà ajouté ces champs au duplicate :
        for opt in ('created_by', 'created_by_id', 'duplicated_from_id'):
            if hasattr(loa, opt):
                print(f"  {opt:17s}= {getattr(loa, opt)!r}")
        print()