# LAURA RAG Evals

Automated tests that measure the quality of the RAG pipeline against 50 curated questions.
Run these before every release, or when you change prompts / models / filters.

## Quick start

```powershell
# From the Laura root
python scripts/run_evals.py
```

Report will be written to `evals/results/eval_YYYY-MM-DD_HH-MM-SS.md`.

## What gets tested

The eval suite covers **5 categories**, 10 questions each:

1. **structured** — pure SQL aggregations ("Total budget by cluster")
2. **semantic** — pure vector search ("Campaigns like summer visibility")
3. **hybrid** — filters + semantic ("Ray-Ban events in Italy around 100k")
4. **memory** — multi-turn context carry-over ("and for Italy?" after "seasonal campaigns")
5. **adversarial** — traps, typos, ambiguity ("LOA balance for John")

## Scoring

Each eval is scored on 4 criteria, weighted:

| Metric | Weight | What it measures |
|--------|--------|------------------|
| `filter_accuracy`  | 30% | Did the extractor produce the expected filters? |
| `source_relevance` | 30% | Do retrieved LOAs match expected brand / country / activity? |
| `answer_quality`   | 30% | Does answer mention required keywords and avoid forbidden ones? |
| `no_hallucination` | 10% | No "Leave of Absence", no invented data |

An eval **passes** if total score ≥ 0.7 (70%).

## Commands

```powershell
# Run all 50 evals
python scripts/run_evals.py

# Run one category (structured | semantic | hybrid | memory | adversarial)
python scripts/run_evals.py --category memory

# Run a single eval by id
python scripts/run_evals.py --id hybrid_001

# Use a different eval file
python scripts/run_evals.py --evals-file evals/custom_evals.yaml
```

## Report structure

Two files per run:

- `eval_TIMESTAMP.md` — human-readable, opens in VS Code / any markdown viewer
- `eval_TIMESTAMP.json` — machine-readable, for diff-ing runs over time

The markdown report includes:

- Aggregate stats (pass rate, avg scores per metric)
- Breakdown by category
- **Failed evals section** — for each failure: question, actual filters, sources, issues, answer preview
- List of all passed evals (short lines)

## How to use the report

**When most evals fail on filter_accuracy:**
→ Your prompt in `extract_filters` (backend/engines/rag.py) needs improvement.

**When most evals fail on source_relevance:**
→ Your embeddings or SQL filters are too loose. Check `hybrid_search`.

**When memory evals fail:**
→ The carry-over prompt is failing. Consider Option B (Python fallback that re-injects previous filters if new ones drop them).

**When adversarial evals fail on hallucination:**
→ The `_LOA_CONTEXT` constant in `backend/engines/chat.py` isn't strong enough. Reinforce that LOA = Letter of Authorization.

**When answer_quality is low:**
→ The `ANSWER_SYSTEM_PROMPT` in rag.py needs adjustment. Check what keywords should always/never appear.

## Adding new evals

Edit `evals/eval_questions.yaml`. Each entry needs:

```yaml
- id: my_new_test_001
  category: hybrid
  question: "Persol events in France under 50k"
  tool: deep_search
  expected_filters:
    brand: "Persol"
    country: "France"
    activity_type: "Events"
    budget_max: 50000
  expected_sources_where:
    brand_contains: "Persol"
  expected_answer_mentions: ["Persol", "France"]
  expected_answer_avoids: ["Leave of Absence"]
```

**For memory evals**, add a `history` field:

```yaml
- id: my_memory_001
  category: memory
  question: "and for 2024?"
  tool: deep_search
  history:
    - role: user
      content: "Show me Ray-Ban events"
    - role: assistant
      content: "Ray-Ban has multiple events..."
  expected_filters:
    brand: "Ray-Ban"
```

## Cost & duration

- 50 evals ≈ **5-8 minutes** end-to-end (Claude API + local embeddings)
- ~2 Claude API calls per RAG eval (extract + answer)
- ~2 Claude API calls per Stats eval (generate_sql + format_sql_answer)
- Total API cost per full run: **~$0.15 to $0.30** (Sonnet 4.6)

Run when:
- Before showing a demo (baseline check)
- After changing any prompt in `rag.py` or `chat.py`
- After importing new LOAs (verify retrieval still works)
- After changing the embedding model
- Weekly during development to catch regressions

## Interpreting a good vs bad run

**Good run:**
- Total ≥ 80%
- No category below 60%
- No `no_hallucination` failures
- Filter accuracy ≥ 75% on hybrid

**Bad run needing action:**
- Total < 70%
- Any `no_hallucination` = 0
- Memory category < 50% (carry-over broken)
- Filter accuracy < 60% (extractor prompt needs work)
