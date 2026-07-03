"""
LAURA — Vectorize LOAs with sentence-transformers (100% local)
==============================================================
Generates embedding vectors for all LOAs that have embedding_text
but no embedding yet. Uses intfloat/multilingual-e5-large (1024 dim).

Usage:
    cd C:\\Users\\sahar\\Desktop\\Laura
    python scripts/vectorize_loas.py --dry-run    (test with 3 LOAs, show timing)
    python scripts/vectorize_loas.py              (vectorize all)
    python scripts/vectorize_loas.py --force      (re-vectorize everything)

First run downloads the model (~2 GB). Subsequent runs use cache.
"""

import argparse
import sys
import time
from datetime import datetime
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from backend.models.database import SessionLocal
from backend.models.loa import LOA
from sqlalchemy import text


def main():
    parser = argparse.ArgumentParser(description="Vectorize LOAs")
    parser.add_argument("--dry-run", action="store_true", help="Test with 3 LOAs only")
    parser.add_argument("--force", action="store_true", help="Re-vectorize all")
    parser.add_argument("--batch-size", type=int, default=50, help="Batch size (default 50)")
    args = parser.parse_args()

    # ── Load model ──
    print("Loading sentence-transformers model (first run downloads ~2 GB)...")
    t0 = time.time()
    from sentence_transformers import SentenceTransformer
    model = SentenceTransformer("intfloat/multilingual-e5-large")
    print(f"Model loaded in {time.time() - t0:.1f}s")
    print(f"Embedding dimension: {model.get_sentence_embedding_dimension()}")

    # ── Count LOAs to process ──
    db = SessionLocal()

    if args.force:
        total = db.execute(text(
            "SELECT COUNT(*) FROM loas WHERE embedding_text IS NOT NULL"
        )).scalar()
    else:
        total = db.execute(text(
            "SELECT COUNT(*) FROM loas WHERE embedding_text IS NOT NULL AND embedding IS NULL"
        )).scalar()

    print(f"LOAs to vectorize: {total}")

    if total == 0:
        print("Nothing to do.")
        db.close()
        return

    if args.dry_run:
        limit = 3
        print(f"DRY RUN: processing only {limit} LOAs")
    else:
        limit = total

    # ── Process in batches ──
    processed = 0
    batch_size = args.batch_size
    t_start = time.time()

    while processed < limit:
        current_batch = min(batch_size, limit - processed)

        if args.force:
            rows = db.execute(text(
                "SELECT id, embedding_text FROM loas "
                "WHERE embedding_text IS NOT NULL "
                "ORDER BY id "
                "LIMIT :limit OFFSET :offset"
            ), {"limit": current_batch, "offset": processed}).fetchall()
        else:
            rows = db.execute(text(
                "SELECT id, embedding_text FROM loas "
                "WHERE embedding_text IS NOT NULL AND embedding IS NULL "
                "LIMIT :limit"
            ), {"limit": current_batch}).fetchall()

        if not rows:
            break

        ids = [r[0] for r in rows]
        texts = [r[1] for r in rows]

        # multilingual-e5 requires "query: " or "passage: " prefix
        # For storing documents, use "passage: "
        prefixed = [f"passage: {t}" for t in texts]

        # ── Encode batch ──
        vectors = model.encode(prefixed, show_progress_bar=False, normalize_embeddings=True)

        # ── Update DB ──
        now = datetime.utcnow()
        for loa_id, vec in zip(ids, vectors):
            vec_str = "[" + ",".join(str(float(v)) for v in vec) + "]"
            db.execute(text(
                "UPDATE loas SET embedding = :vec, embedded_at = :now WHERE id = :id"
            ), {"vec": vec_str, "now": now, "id": loa_id})

        db.commit()
        processed += len(rows)

        elapsed = time.time() - t_start
        rate = processed / elapsed if elapsed > 0 else 0
        eta = (limit - processed) / rate if rate > 0 else 0
        print(f"  {processed}/{limit} ({rate:.1f} LOAs/sec, ETA {eta:.0f}s)")

    db.close()
    total_time = time.time() - t_start
    print(f"\nDone. Vectorized {processed} LOAs in {total_time:.1f}s")


if __name__ == "__main__":
    main()
