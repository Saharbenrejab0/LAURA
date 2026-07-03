from backend.models.database import SessionLocal
from backend.models.loa import LOA
from scripts.generate_embedding_text import build_embedding_text

db = SessionLocal()
remaining = db.query(LOA).filter(LOA.embedding_text == None).count()
print(f"Remaining: {remaining}")

done = 0
while True:
    batch = db.query(LOA).filter(LOA.embedding_text == None).limit(200).all()
    if not batch:
        break
    for loa in batch:
        loa.embedding_text = build_embedding_text(loa)
    db.commit()
    done += len(batch)
    print(f"  {done}/{remaining}")

db.close()
print("Done.")
