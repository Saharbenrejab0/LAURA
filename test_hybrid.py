from sentence_transformers import SentenceTransformer
from backend.models.database import SessionLocal
from sqlalchemy import text

model = SentenceTransformer("intfloat/multilingual-e5-large")
db = SessionLocal()

query = "summer retail visibility activations"
vec = model.encode(f"query: {query}", normalize_embeddings=True)
vec_str = "[" + ",".join(str(float(v)) for v in vec) + "]"

print("=== VECTOR ONLY (no filter) ===")
r1 = db.execute(text("""
    SELECT brand, activity_type, country, LEFT(embedding_text, 100) as preview,
           embedding <=> :vec AS dist
    FROM loas WHERE embedding IS NOT NULL
    ORDER BY embedding <=> :vec LIMIT 3
"""), {"vec": vec_str}).fetchall()
for r in r1:
    print(f"  [{r.dist:.4f}] {r.brand} | {r.activity_type} | {r.country}")
    print(f"           {r.preview}")

print()
print("=== HYBRID: brand=Ray-Ban + vector ===")
r2 = db.execute(text("""
    SELECT brand, activity_type, country, LEFT(embedding_text, 100) as preview,
           embedding <=> :vec AS dist
    FROM loas
    WHERE embedding IS NOT NULL AND brand ILIKE '%Ray-Ban%'
    ORDER BY embedding <=> :vec LIMIT 3
"""), {"vec": vec_str}).fetchall()
for r in r2:
    print(f"  [{r.dist:.4f}] {r.brand} | {r.activity_type} | {r.country}")
    print(f"           {r.preview}")

print()
print("=== HYBRID: brand=Ray-Ban + country=France + budget>50k + vector ===")
r3 = db.execute(text("""
    SELECT brand, activity_type, country,
           COALESCE(fy_2025_total, fy_2026_total, 0) as budget,
           LEFT(embedding_text, 100) as preview,
           embedding <=> :vec AS dist
    FROM loas
    WHERE embedding IS NOT NULL
      AND brand ILIKE '%Ray-Ban%'
      AND country ILIKE '%France%'
      AND COALESCE(fy_2025_total, fy_2026_total, 0) > 50000
    ORDER BY embedding <=> :vec LIMIT 3
"""), {"vec": vec_str}).fetchall()
for r in r3:
    print(f"  [{r.dist:.4f}] {r.brand} | {r.activity_type} | {r.country} | EUR {r.budget:,.0f}")
    print(f"           {r.preview}")

if not r3:
    print("  (no results)")

db.close()
