from backend.models.database import SessionLocal
from backend.models.user import User
from backend.models.loa import LOA
from backend.api.permissions import compute_permissions
from sqlalchemy import text
db = SessionLocal()

# Prendre une LOA en cmo_cfo_review (ou n'importe quelle en review)
loa = db.execute(text("""
    SELECT id FROM loas WHERE status = 'cmo_cfo_review' LIMIT 1
""")).fetchone()
if not loa:
    print("No LOA in cmo_cfo_review status - creating test scenario below instead")
else:
    loa_obj = db.query(LOA).get(loa[0])
    for email in ["alexandra@essilor.com", "giulia@essilor.com"]:
        u = db.query(User).filter_by(email=email).first()
        if u:
            perms = compute_permissions(u, loa_obj, db)
            print(f"  {email}: can_comment={perms.get('can_comment')}  can_validate={perms.get('can_validate')}")
db.close()
