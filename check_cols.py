from backend.models.database import SessionLocal
from sqlalchemy import text
db = SessionLocal()
sql = "SELECT column_name FROM information_schema.columns WHERE table_name='loas' AND column_name IN ('embedding_text','q1_2025','source_file','embedding')"
r = db.execute(text(sql)).fetchall()
print('Columns in Postgres:', [x[0] for x in r])
db.close()
