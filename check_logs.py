from backend.models.database import SessionLocal
from sqlalchemy import text
db = SessionLocal()
r = db.execute(text("SELECT COUNT(*) FROM information_schema.tables WHERE table_name='rag_logs'")).scalar()
print(f'rag_logs table exists: {r > 0}')
if r > 0:
    cols = db.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='rag_logs' ORDER BY ordinal_position")).fetchall()
    print(f'Columns: {[c[0] for c in cols]}')
    count = db.execute(text("SELECT COUNT(*) FROM rag_logs")).scalar()
    print(f'Rows in rag_logs: {count}')
db.close()
