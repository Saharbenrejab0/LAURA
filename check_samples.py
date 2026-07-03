from backend.models.database import SessionLocal
from backend.models.loa import LOA
db = SessionLocal()
samples = db.query(LOA).filter(LOA.is_demo == False, LOA.detail != None).offset(100).limit(3).all()
for i, s in enumerate(samples):
    fy = s.fy_2025_total or s.fy_2026_total or 0
    desc = (s.description or "")[:80]
    det = (s.detail or "")[:80]
    kpi = (s.kpi or "")[:80]
    print(f"--- LOA {i+1} ---")
    print(f"  {s.brand} | {s.activity_type} | {s.country} | {s.cluster}")
    print(f"  cat={s.category} cot={s.cot} customer={s.customer}")
    print(f"  budget={fy} doors={s.num_doors} vendor={s.vendor}")
    print(f"  desc: {desc}")
    print(f"  detail: {det}")
    print(f"  kpi: {kpi}")
    print()
db.close()
