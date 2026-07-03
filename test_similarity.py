from sentence_transformers import SentenceTransformer
from backend.models.database import SessionLocal
from sqlalchemy import text

model = SentenceTransformer("intfloat/multilingual-e5-large")
db = SessionLocal()

query = "Ray-Ban summer events in Italy"
vec = model.encode(f"query: {query}", normalize_embeddings=True)
vec_str = "[" + ",".join(str(float(v)) for v in vec) + "]"

results = db.execute(text("""
    SELECT brand, activity_type, country, fy_2025_total, fy_2026_total,
           embedding <=> :vec AS distance,
           LEFT(embedding_text, 120) as preview
    FROM loas
    WHERE embedding IS NOT NULL
    ORDER BY embedding <=> :vec
    LIMIT 5
"""), {"vec": vec_str}).fetchall()

print(f"Query: {query}")
print(f"{'='*80}")
for i, r in enumerate(results):
    fy = r.fy_2025_total or r.fy_2026_total or 0
    print(f"{i+1}. [{r.distance:.4f}] {r.brand} | {r.activity_type} | {r.country} | EUR {fy:,.0f}")
    print(f"   {r.preview}")
    print()

db.close()
