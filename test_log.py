from backend.models.database import SessionLocal
from backend.models.rag_log import RagLog
from datetime import datetime

# Test manual insert to see the real error
db = SessionLocal()
try:
    log = RagLog(
        question='TEST manual insert',
        tool='deep_search',
        history_length=0,
        loa_count=0,
    )
    db.add(log)
    db.commit()
    print('Manual insert: SUCCESS')
except Exception as e:
    db.rollback()
    print(f'Manual insert FAILED:')
    print(f'  Error type: {type(e).__name__}')
    print(f'  Error: {str(e)[:500]}')
finally:
    db.close()
