"""
LAURA — Test RAG pipeline end-to-end
=====================================
Tests extract_filters → hybrid_search → generate_answer
without needing the FastAPI server running.

Usage:
    python scripts/test_rag.py
    python scripts/test_rag.py --question "Ray-Ban events in Italy around 100k"
"""

import argparse
import asyncio
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from backend.models.database import SessionLocal
from backend.engines.rag import ask_rag, extract_filters, hybrid_search


TEST_QUESTIONS = [
    "What are typical KPIs for events?",
    "Ray-Ban campaigns in France for events around 100k",
    "Find campaigns similar to summer retail visibility activations",
    "Show me Oakley sponsorships in DACH with budget over 50k",
    "What seasonal campaigns exist for lenses in Italy?",
]


async def test_single(question: str):
    db = SessionLocal()
    print(f"\n{'='*70}")
    print(f"  Question: {question}")
    print(f"{'='*70}")

    result = await ask_rag(question, db)

    print(f"\n  Filters: {result['filters_used']}")
    print(f"  LOAs found: {result['loa_count']}")
    print(f"  Timing: extract={result['timing']['extract_ms']}ms "
          f"search={result['timing']['search_ms']}ms "
          f"answer={result['timing']['answer_ms']}ms")

    print(f"\n  Sources:")
    for s in result["sources"][:5]:
        print(f"    [{s['distance']:.4f}] {s['brand']} | {s['activity_type']} "
              f"| {s['country']} | {s['budget']}")

    print(f"\n  Answer:")
    # Indent the answer for readability
    for line in result["answer"].split("\n"):
        print(f"    {line}")

    db.close()
    return result


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--question", "-q", type=str, help="Single question to test")
    args = parser.parse_args()

    if args.question:
        await test_single(args.question)
    else:
        print("Running 5 test questions...")
        for q in TEST_QUESTIONS:
            await test_single(q)


if __name__ == "__main__":
    asyncio.run(main())
