from backend.models.database import SessionLocal
from backend.models.rag_log import RagLog
db = SessionLocal()
logs = db.query(RagLog).order_by(RagLog.created_at.desc()).limit(3).all()
for l in logs:
    print(f'[{l.created_at}] {l.tool} | {l.question[:60]}')
    print(f'  total_ms={l.total_ms} sources={len(l.sources) if l.sources else 0}')
    print()
db.close()
