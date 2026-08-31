"""
LAURA RAG Evals Runner
======================

Executes all eval questions from evals/eval_questions.yaml against the
current RAG pipeline, scores each result, and produces a detailed report.

Usage:
    python scripts/run_evals.py                  # Run all evals
    python scripts/run_evals.py --category memory  # Run one category
    python scripts/run_evals.py --id hybrid_001   # Run one specific test

Output:
    evals/results/eval_YYYY-MM-DD_HH-MM-SS.md    # Human-readable report
    evals/results/eval_YYYY-MM-DD_HH-MM-SS.json  # Machine-readable data

Scoring:
    - filter_accuracy    (30%)
    - source_relevance   (30%)
    - answer_quality     (30%)  (mentions + avoids keywords)
    - no_hallucination   (10%)
"""
from __future__ import annotations

import argparse
import asyncio
import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

import yaml

# Make backend importable
BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

from backend.models.database import SessionLocal
from backend.engines.rag import ask_rag
from backend.engines.chat import generate_sql, format_sql_answer, _validate_sql
from sqlalchemy import text as sa_text


# ─────────────────────────────────────────────────────────────────
# Loading
# ─────────────────────────────────────────────────────────────────

def load_evals(path: Path) -> list[dict]:
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f) or []


# ─────────────────────────────────────────────────────────────────
# Scoring helpers
# ─────────────────────────────────────────────────────────────────

def _norm(s: str | None) -> str:
    return (s or "").strip().lower()


def score_filter_accuracy(expected: dict | None, actual: dict) -> tuple[float, list[str]]:
    """Compare expected vs actual filters. Returns (score 0-1, list of issues)."""
    if not expected:
        return 1.0, []

    matches = 0
    total = 0
    issues = []

    for key, exp_val in expected.items():
        total += 1
        act_val = actual.get(key)

        if exp_val is None:
            if act_val is None:
                matches += 1
            else:
                issues.append(f"Filter {key}: expected None, got {act_val!r}")
            continue

        if act_val is None:
            issues.append(f"Filter {key}: expected {exp_val!r}, got None (filter missing)")
            continue

        # String comparison: case-insensitive contains
        if isinstance(exp_val, str) and isinstance(act_val, str):
            if _norm(exp_val) in _norm(act_val) or _norm(act_val) in _norm(exp_val):
                matches += 1
            else:
                issues.append(f"Filter {key}: expected {exp_val!r}, got {act_val!r}")
        # Numeric comparison
        elif isinstance(exp_val, (int, float)) and isinstance(act_val, (int, float)):
            # Allow 20% tolerance for budgets
            if abs(exp_val - act_val) / max(abs(exp_val), 1) < 0.2:
                matches += 1
            else:
                issues.append(f"Filter {key}: expected ~{exp_val}, got {act_val}")
        else:
            if exp_val == act_val:
                matches += 1
            else:
                issues.append(f"Filter {key}: expected {exp_val!r}, got {act_val!r}")

    score = matches / total if total > 0 else 1.0
    return score, issues


def score_source_relevance(
    expected_where: dict | None,
    sources: list[dict],
) -> tuple[float, list[str]]:
    """Check if at least one source matches expected criteria."""
    if not expected_where:
        return 1.0, []
    if not sources:
        return 0.0, ["No sources returned"]

    issues = []
    matching_count = 0

    for source in sources:
        source_matches = True
        for key, expected_val in expected_where.items():
            if key.endswith("_contains"):
                real_key = key.replace("_contains", "")
                actual = _norm(source.get(real_key))
                if _norm(expected_val) not in actual:
                    source_matches = False
                    break
            else:
                actual = _norm(source.get(key))
                if _norm(expected_val) not in actual and actual not in _norm(expected_val):
                    source_matches = False
                    break
        if source_matches:
            matching_count += 1

    score = matching_count / len(sources)
    if matching_count == 0:
        top_source = sources[0] if sources else {}
        issues.append(
            f"No source matched {expected_where}. Top source was: "
            f"{top_source.get('brand')} · {top_source.get('activity_type')} · {top_source.get('country')}"
        )
    elif matching_count < len(sources) / 2:
        issues.append(f"Only {matching_count}/{len(sources)} sources matched expected criteria")

    return score, issues


def score_answer_quality(
    expected_mentions: list[str] | None,
    expected_avoids: list[str] | None,
    answer: str,
) -> tuple[float, list[str]]:
    """Check if answer mentions required keywords and avoids forbidden ones."""
    issues = []
    answer_lower = _norm(answer)

    mentions_score = 1.0
    if expected_mentions:
        found = sum(1 for kw in expected_mentions if _norm(kw) in answer_lower)
        mentions_score = found / len(expected_mentions)
        missing = [kw for kw in expected_mentions if _norm(kw) not in answer_lower]
        if missing:
            issues.append(f"Answer missing keywords: {missing}")

    avoids_score = 1.0
    if expected_avoids:
        found_forbidden = [kw for kw in expected_avoids if _norm(kw) in answer_lower]
        if found_forbidden:
            avoids_score = 0.0
            issues.append(f"Answer contains forbidden keywords: {found_forbidden}")

    score = (mentions_score + avoids_score) / 2
    return score, issues


def score_no_hallucination(answer: str, sources: list[dict]) -> tuple[float, list[str]]:
    """Basic hallucination check: 'Leave of Absence' term is the biggest red flag."""
    issues = []
    answer_lower = _norm(answer)

    if "leave of absence" in answer_lower:
        issues.append("HALLUCINATION: Answer contains 'Leave of Absence'")
        return 0.0, issues

    if "employee leave" in answer_lower or "sick leave" in answer_lower:
        issues.append("SUSPICIOUS: Answer mentions employee leave / sick leave")
        return 0.5, issues

    return 1.0, []


# ─────────────────────────────────────────────────────────────────
# Execution
# ─────────────────────────────────────────────────────────────────

async def run_single_eval(eval_case: dict, db) -> dict:
    """Run one eval question and return scored result."""
    eval_id = eval_case["id"]
    category = eval_case["category"]
    question = eval_case["question"]
    expected_tool = eval_case.get("tool", "deep_search")
    history = eval_case.get("history") or []

    result = {
        "id": eval_id,
        "category": category,
        "question": question,
        "expected_tool": expected_tool,
        "answer": "",
        "filters": {},
        "sources": [],
        "sql": None,
        "timing_ms": 0,
        "error": None,
    }

    start = datetime.now()

    try:
        if expected_tool == "deep_search":
            rag_result = await ask_rag(question, db, chat_history=history)
            result["answer"] = rag_result.get("answer", "")
            result["filters"] = rag_result.get("filters_used", {})
            result["sources"] = rag_result.get("sources", [])
        elif expected_tool == "stats":
            sql = await generate_sql(question, history=history)
            result["sql"] = sql
            ok, err = _validate_sql(sql)
            if not ok:
                result["error"] = err
                result["answer"] = f"SQL validation failed: {err}"
            else:
                rows = db.execute(sa_text(sql)).mappings().all()
                rows_list = [dict(r) for r in rows]
                if not rows_list:
                    result["answer"] = "No results found."
                else:
                    result["answer"] = await format_sql_answer(question, sql, rows_list, history=history)
        elif expected_tool == "summarize":
            result["answer"] = "SKIPPED: summarize evals require a specific LOA context"
        else:
            result["error"] = f"Unknown tool: {expected_tool}"
    except Exception as e:
        result["error"] = f"{type(e).__name__}: {str(e)[:300]}"
        result["answer"] = ""

    result["timing_ms"] = int((datetime.now() - start).total_seconds() * 1000)

    # Score
    filter_score, filter_issues = score_filter_accuracy(
        eval_case.get("expected_filters"), result["filters"]
    )
    source_score, source_issues = score_source_relevance(
        eval_case.get("expected_sources_where"), result["sources"]
    )
    answer_score, answer_issues = score_answer_quality(
        eval_case.get("expected_answer_mentions"),
        eval_case.get("expected_answer_avoids"),
        result["answer"],
    )
    hallu_score, hallu_issues = score_no_hallucination(result["answer"], result["sources"])

    total_score = (
        filter_score * 0.3 +
        source_score * 0.3 +
        answer_score * 0.3 +
        hallu_score * 0.1
    )

    result["scores"] = {
        "filter_accuracy": round(filter_score, 3),
        "source_relevance": round(source_score, 3),
        "answer_quality": round(answer_score, 3),
        "no_hallucination": round(hallu_score, 3),
        "total": round(total_score, 3),
    }
    result["issues"] = filter_issues + source_issues + answer_issues + hallu_issues
    result["passed"] = total_score >= 0.7

    return result


async def run_all_evals(evals: list[dict]) -> list[dict]:
    """Run all evals sequentially (avoid Claude API rate limits)."""
    db = SessionLocal()
    results = []
    total = len(evals)

    print(f"\n▸ Running {total} evals sequentially...\n")

    try:
        for i, eval_case in enumerate(evals, 1):
            eid = eval_case["id"]
            cat = eval_case["category"]
            print(f"  [{i:2d}/{total}] {cat:12s} {eid} ... ", end="", flush=True)
            result = await run_single_eval(eval_case, db)
            passed = result["passed"]
            score = result["scores"]["total"]
            status = "✓ PASS" if passed else "✗ FAIL"
            print(f"{status}  {score:.2f}  ({result['timing_ms']}ms)")
            results.append(result)
            await asyncio.sleep(1)  # avoid API rate limits
    finally:
        db.close()

    return results


# ─────────────────────────────────────────────────────────────────
# Report generation
# ─────────────────────────────────────────────────────────────────

def generate_report(results: list[dict], output_dir: Path) -> Path:
    """Write both markdown and JSON reports."""
    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    output_dir.mkdir(parents=True, exist_ok=True)

    md_path = output_dir / f"eval_{timestamp}.md"
    json_path = output_dir / f"eval_{timestamp}.json"

    # Aggregate stats
    total = len(results)
    passed = sum(1 for r in results if r["passed"])
    by_category: dict[str, list[dict]] = {}
    for r in results:
        by_category.setdefault(r["category"], []).append(r)

    avg_scores = {
        "filter_accuracy": sum(r["scores"]["filter_accuracy"] for r in results) / total,
        "source_relevance": sum(r["scores"]["source_relevance"] for r in results) / total,
        "answer_quality": sum(r["scores"]["answer_quality"] for r in results) / total,
        "no_hallucination": sum(r["scores"]["no_hallucination"] for r in results) / total,
        "total": sum(r["scores"]["total"] for r in results) / total,
    }

    # JSON output (machine-readable)
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump({
            "timestamp": timestamp,
            "total": total,
            "passed": passed,
            "pass_rate": passed / total,
            "avg_scores": avg_scores,
            "results": results,
        }, f, indent=2, ensure_ascii=False)

    # Markdown report
    lines = [
        f"# LAURA RAG Evals Report",
        f"",
        f"**Run at:** {timestamp}",
        f"**Total:** {total} evals",
        f"**Passed:** {passed} / {total}  ({100 * passed / total:.1f}%)",
        f"",
        f"## Average Scores",
        f"",
        f"| Metric | Score |",
        f"|--------|-------|",
        f"| Filter accuracy   | **{avg_scores['filter_accuracy']:.1%}** |",
        f"| Source relevance  | **{avg_scores['source_relevance']:.1%}** |",
        f"| Answer quality    | **{avg_scores['answer_quality']:.1%}** |",
        f"| No hallucination  | **{avg_scores['no_hallucination']:.1%}** |",
        f"| **Total (weighted)** | **{avg_scores['total']:.1%}** |",
        f"",
        f"## Results by Category",
        f"",
        f"| Category | Passed | Total | Pass rate |",
        f"|----------|--------|-------|-----------|",
    ]
    for cat, cases in sorted(by_category.items()):
        cat_passed = sum(1 for r in cases if r["passed"])
        lines.append(
            f"| {cat:12s} | {cat_passed} | {len(cases)} | "
            f"{100 * cat_passed / len(cases):.0f}% |"
        )

    lines.extend([
        f"",
        f"---",
        f"",
        f"## Failed Evals",
        f"",
    ])

    failed = [r for r in results if not r["passed"]]
    if not failed:
        lines.append("**None. All evals passed.**")
    else:
        for r in failed:
            lines.extend([
                f"### {r['id']} · {r['category']}",
                f"",
                f"**Question:** {r['question']}",
                f"",
                f"**Total score:** {r['scores']['total']:.1%}  ",
                f"- Filter accuracy: {r['scores']['filter_accuracy']:.1%}  ",
                f"- Source relevance: {r['scores']['source_relevance']:.1%}  ",
                f"- Answer quality: {r['scores']['answer_quality']:.1%}  ",
                f"- No hallucination: {r['scores']['no_hallucination']:.1%}  ",
                f"",
                f"**Filters extracted:** `{r['filters']}`",
                f"",
                f"**Sources returned:** {len(r['sources'])} LOAs",
            ])
            if r["sources"]:
                for i, s in enumerate(r["sources"][:5], 1):
                    lines.append(
                        f"  {i}. {s.get('brand')} · {s.get('activity_type')} "
                        f"· {s.get('country')} · {s.get('budget')}"
                    )
            lines.extend([
                f"",
                f"**Issues:**",
            ])
            for issue in r["issues"]:
                lines.append(f"- {issue}")
            if r.get("error"):
                lines.append(f"- ERROR: {r['error']}")
            lines.extend([
                f"",
                f"**Answer preview:**",
                f"```",
                (r["answer"] or "")[:600],
                f"```",
                f"",
                f"---",
                f"",
            ])

    lines.extend([
        f"## All Passed Evals",
        f"",
    ])
    for r in results:
        if r["passed"]:
            lines.append(
                f"- ✓ **{r['id']}** ({r['category']}) — "
                f"{r['scores']['total']:.1%} — {r['question'][:70]}"
            )

    with open(md_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    return md_path


# ─────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────

async def main():
    parser = argparse.ArgumentParser(description="Run LAURA RAG evals")
    parser.add_argument("--category", type=str, help="Only run one category")
    parser.add_argument("--id", type=str, help="Only run one eval by id")
    parser.add_argument(
        "--evals-file", type=Path,
        default=Path("evals/eval_questions.yaml"),
        help="Path to eval questions yaml"
    )
    parser.add_argument(
        "--output-dir", type=Path,
        default=Path("evals/results"),
        help="Where to write reports"
    )
    args = parser.parse_args()

    all_evals = load_evals(args.evals_file)
    if args.category:
        all_evals = [e for e in all_evals if e["category"] == args.category]
    if args.id:
        all_evals = [e for e in all_evals if e["id"] == args.id]

    if not all_evals:
        print("No evals matched your filter.")
        return

    print(f"\n═══════════════════════════════════════════════════════")
    print(f"  LAURA RAG Evals — {len(all_evals)} question(s)")
    print(f"═══════════════════════════════════════════════════════")

    results = await run_all_evals(all_evals)

    print(f"\n═══════════════════════════════════════════════════════")
    passed = sum(1 for r in results if r["passed"])
    print(f"  Done: {passed} / {len(results)} passed ({100 * passed / len(results):.1f}%)")

    report_path = generate_report(results, args.output_dir)
    print(f"  Report: {report_path}")
    print(f"═══════════════════════════════════════════════════════\n")


if __name__ == "__main__":
    asyncio.run(main())
