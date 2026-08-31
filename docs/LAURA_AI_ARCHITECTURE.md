# Laura AI — Technical Architecture

> Internal reference for how the Laura conversational layer works in LAURA.
> This document is the single source of truth for explaining the AI to clients, stakeholders, and new team members.

---

## TL;DR

Laura is a **router over two retrieval strategies**, built on Anthropic's Claude API
(`claude-sonnet-4-6`). A cheap classifier call picks the tool, then one of these runs:

1. **Proactive alerts** on individual LOAs — pure Python rules, zero AI calls, instant
2. **Comment summary** when reviewers ask for a recap — one Claude call
3. **`stats` — text-to-SQL** — two Claude calls (one to write SQL, one to phrase the answer).
   Best for aggregates: counts, sums, averages, "how many", "total spend by country".
4. **`deep_search` — hybrid RAG** — SQL pre-filter + pgvector cosine similarity + a
   re-rank pass, then one Claude call to answer over the retrieved LOAs. Best for
   semantic questions: "find campaigns like this one", "what have we done for Ray-Ban
   in DACH".

She **does** use embeddings and vector search — 2,712 of 2,757 LOAs are embedded — and she
**does** receive conversation history, so follow-ups like *"and in Italy?"* work. Neither is
a planned future item; both are live. She does not use fine-tuning.

> **Correcting an earlier version of this document.** It described Laura as a pure
> text-to-SQL chatbot and listed semantic similarity and conversation memory as unbuilt
> Sprint 7 work. Both shipped. Text-to-SQL is still live and still correct as written
> below — it is now the `stats` branch of a router, not the whole system.

---

## 1. The four capabilities

### Capability 1 — Proactive alerts (no AI)

**Endpoint:** `GET /loa/{id}/chat/alerts`

When a reviewer opens a LOA, the frontend can call this to display warnings before the user asks anything. It is **deterministic** — same input always gives same output. No Claude call. No token cost. Sub-100ms response.

The engine in `backend/engines/chat.py::generate_alerts()` compares the LOA against historical averages from the same `activity_type`, and flags:

| Code | Trigger | Severity |
|---|---|---|
| `budget_outlier` | Budget > 1.5× historical average (sample ≥ 5) | ⚠ warning |
| `cost_per_door_outlier` | Cost per door > 1.5× historical average | ⚠ warning |
| `description_empty` | Description field is blank | ⚠ warning |
| `description_short` | Description < 80 characters | ℹ info |
| `description_missing_why` | No WHY keywords (purpose, goal, increase, etc.) | ℹ info |
| `kpi_empty` | KPI field is blank | ⚠ warning |
| `kpi_vague` | KPI is "TBD", "N/A", "see above" or < 30 chars | ℹ info |
| `cost_drill_missing` | Budget > €100k but no cost drill-down | ⚠ warning |
| `cost_justification_missing` | Budget > €50k but no cost justification | ℹ info |

These rules live in code. To change them, edit `_WHY_KEYWORDS`, `_VAGUE_KPI`, or the thresholds in `generate_alerts()`.

### Capability 2 — Comment summary (1 Claude call)

**Endpoint:** `POST /loa/{id}/chat/ask` with a message containing one of: `summarize`, `summary`, `résumé`, `comments`, `commentaires`, `feedback`, `what did reviewers say`, `previous reviews`, `recap`.

The smart router in `chat.py` detects these keywords and dispatches to the comment summary path instead of text-to-SQL.

**The exact prompt sent to Claude:**

```
You are LAURA, an LOA review assistant for EssilorLuxottica.

Summarize the following reviewer comments for **{viewer_name}**
at the **{current_status}** stage.

Rules:
- Group by review phase
- Prefix unresolved items with ⚠
- Max 5 sentences
- End with: '{open_n} open · {resolved_n} resolved'
- English, professional, no intro/sign-off

Comments ({total} total):
- [draft] Sandrine Guérin (CFO) on 'Budget': Cost-per-door above range. [OPEN]
- [emea_review] Thibault (PS) on 'KPI': Needs measurable target. [RESOLVED]
- ... (full list of comments)
```

Claude receives the full text of every comment on the LOA, with author name, role, section, status, and resolution flag. Max 400 tokens out.

### Capability 3 — Text-to-SQL historical Q&A (2 Claude calls)

**Endpoints:** `POST /chat/ask` (global) or `POST /loa/{id}/chat/ask` (scoped, when no summary keyword detected).

This is the heaviest path. Two separate calls to Claude:

#### Call A: question → SQL

```
You are a SQL expert. Given this schema:

[the full _LOAS_SCHEMA block from engines/chat.py]

Translate this question into a single PostgreSQL SELECT query.

Question: {user_question}

Rules:
- Return ONLY the SQL, no explanation, no markdown fences
- Always add LIMIT 50 unless the user asks for a specific count
- Use COALESCE for nullable numeric columns in aggregates
- When the user asks about an activity type, search BOTH enum codes
  AND display names (use OR / IN with both variants)
- For category arrays use ANY() operator
- Round monetary results to 2 decimal places
- If you cannot translate the question, return:
  SELECT 'I cannot answer this question' AS error
```

Claude returns a SQL string. The backend cleans markdown fences if present, then runs it through `_validate_sql()`.

#### Validation (no AI involved)

```python
_FORBIDDEN_SQL = re.compile(
    r"\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|"
    r"exec|execute|pg_|information_schema|pg_catalog)\b"
)
```

The SQL must:
- Start with `SELECT` (whitelist)
- Contain none of the forbidden keywords (blacklist)
- Contain no semicolons (prevents multi-statement attacks)
- Have a `LIMIT 50` (auto-added if missing)

If any check fails, Laura returns an error message; she does **not** execute.

#### Execution

The validated SQL runs against Postgres via SQLAlchemy in a read-only context with a 5-second timeout. Results are converted to a list of dicts.

#### Call B: results → natural-language answer

```
You are LAURA, an LOA assistant for EssilorLuxottica.

The user asked: "{user_question}"

SQL executed:
SELECT activity_type, COUNT(*), AVG(fy_2026_total)
FROM loas WHERE country = 'Italy' ...

Results (12 rows):
{'activity_type': 'EVENTS', 'count': 8, 'avg': 152340.50}
{'activity_type': 'TM_SEASONAL', 'count': 6, 'avg': 87210.00}
... and 10 more rows

Write a concise, professional answer in 1-4 sentences.
Include key numbers with € formatting for monetary values.
If there are multiple rows, highlight the top 3-5.
No markdown tables. No intro like 'Based on the data'.
Just answer directly.
```

Claude returns the human-readable answer that lands in the chat bubble.

---

### The router — which tool runs

`_detect_tool()` (`backend/api/chat.py:123-132`) makes one cheap Claude call
(`max_tokens=10`) against `_ROUTER_SYSTEM_PROMPT` and expects one of `stats`,
`deep_search`, or `summarize`. Anything else — or any exception — falls back to
`stats`. The caller can bypass the classifier entirely by passing `tool` in the
request body.

### Capability 4 — Deep search, hybrid RAG (2 Claude calls)

**Endpoints:** the `deep_search` branch of `POST /chat/ask` (`chat.py:428`) and
`POST /loa/{id}/chat/ask` (`chat.py:347`), both calling `ask_rag()` in
`backend/engines/rag.py`.

Three stages, only two of which touch Claude:

#### Stage 1 — `extract_filters()` (1 Claude call)

Claude turns the question into structured filters (brand, country, cluster,
activity_type, vendor, budget range) plus a free-text `semantic_query`. It is
**follow-up aware**: prior turns are passed in, so *"and in Italy?"* inherits the
brand and activity from the previous question instead of being read literally.

#### Stage 2 — `hybrid_search()` (no AI)

This is the "hybrid" in hybrid RAG — a SQL pre-filter **and** a vector search, not
either alone:

1. **SQL pre-filter.** The extracted filters become `ILIKE` conditions, always
   anchored on `embedding IS NOT NULL` (`rag.py:216-217`). Activity types are matched
   against both the `UPPER_SNAKE` code and a de-snaked variant, because the two
   importers disagree (see the currency/activity notes in the database audit).
2. **Vector search.** The `semantic_query` is embedded locally with
   `multilingual-e5-large` (1024-dim, sentence-transformers) using the e5 `"query: "`
   prefix convention and normalised embeddings. Postgres then ranks survivors by
   **cosine distance** via pgvector's `<=>` operator (`rag.py:277-280`).
3. **Re-rank.** `_rerank()` (`rag.py:193-212`) recomputes a composite score —
   `similarity + 0.5·brand + 0.2·activity + 0.15·vendor` token-match bonuses — to stop a
   semantically-near-but-wrong entity ("Ray-Ban Meta") outranking the exact match
   ("Ray-Ban") on raw vector distance alone.

Default `top_k` is **8**. That is the whole point of the design: Claude sees ~8 LOAs,
never the full 2,757-row table.

#### Stage 3 — `generate_answer()` (1 Claude call)

Claude answers over the retrieved rows and cites them. `ask_rag()` returns
`answer`, `loa_count`, `filters_used`, `sources` (id / loa_number / brand per cited
LOA), and `timing`. The frontend renders `sources` as citations under the answer.

#### Embedding coverage — a real operational caveat

Stage 2 hard-filters on `embedding IS NOT NULL`, so **an un-embedded LOA is invisible
to deep search** — it cannot be retrieved, and its absence is silent. As of
2026-08-31, **2,712 of 2,757 LOAs are embedded (45 missing)**. Backfill with
`scripts/vectorize_loas.py`. Note `stats` is unaffected: text-to-SQL queries the table
directly and sees all rows.

#### Row-level scope is enforced on both paths

A non-admin's cluster scope is applied before retrieval, not after: `deep_search`
receives a `user_scope` argument, and `stats` gets both a prompt-level `scope_hint` and
a post-hoc `_inject_scope_into_sql()` rewrite (`chat.py:437-448`). Do not treat the
prompt hint as the security boundary — the SQL injection-of-scope is what actually
enforces it.

#### Every question is logged

`_log_rag_query()` writes question, tool, history length, SQL, sources, error and
total latency to the `rag_log` table for every call on both paths. That table is the
place to look when someone reports a bad answer.

---

## 2. What Claude sees about your data

This is the single most important section. Read it twice.

### What Claude DOES see

| Phase | Sent to Claude |
|---|---|
| SQL generation | The hardcoded schema description (`_LOAS_SCHEMA`) + the user's question |
| SQL execution | Nothing — happens locally on Postgres |
| Answer formatting | The user's question + the generated SQL + up to 20 rows of result data |
| Comment summary | All comment text on a single LOA + author names + roles + sections |

The schema block sent to Claude is:

```
TABLE: loas (PostgreSQL)

KEY COLUMNS:
  cluster, country, brand, category, activity_type, cot,
  fy_2026_total, fy_2025_total, q4_2025, q1_2026, q2_2026, q3_2026, q4_2026,
  num_doors, num_customers, avg_investment_per_door,
  status, is_demo, capex_opex, adv_selling, currency,
  created_at, approved_at, ppt_slide_required,
  description, kpi
```

This is the **only** table Claude knows exists. She does not know about `users`, `comments`, `loa_drafts`, `roles`, `role_permissions`, `audit_logs`, or any other table.

### What Claude DOES NOT see

- Your Anthropic API key (kept in `ANTHROPIC_API_KEY` env var on the backend, never sent to Claude)
- User authentication tokens
- User emails (except `author_name` derived from email when summarizing comments)
- Other tables in the database
- Other LOAs that aren't returned by the SQL she generated
- Any file system content
- The frontend code
- Any environment variables

### About the "no raw data to LLM" promise

Sai's principle was "data stays inside the database, only metadata goes to the LLM". Laura honors this **at the SQL generation step** — Claude sees only the schema, not the rows. But at the **answer formatting step**, Claude does receive up to 20 rows of result data so she can phrase the answer naturally.

If a stricter "absolutely no row data to Claude" guarantee is required, the formatting step would need to be replaced with deterministic Python templating (e.g., "Found N matches: A, B, C"). The tradeoff is colder, less helpful answers. The current design is a deliberate balance.

---

## 3. The SQL safety net

Claude is a language model and can be tricked or simply produce wrong SQL. Multiple defenses live between her output and your database:

1. **Whitelist**: must start with `SELECT`
2. **Blacklist**: regex blocks INSERT, UPDATE, DELETE, DROP, ALTER, CREATE, TRUNCATE, GRANT, REVOKE, EXEC, EXECUTE, anything starting with `pg_`, `information_schema`, `pg_catalog`
3. **No multi-statement**: semicolons rejected
4. **Forced LIMIT 50**: appended if Claude forgot
5. **Read-only execution**: the Postgres user used by the chat engine has SELECT privileges only
6. **5-second timeout**: long-running queries die
7. **Error pathway**: if execution fails, Laura returns the error message instead of crashing — the user sees "Query failed: ..."

If a forbidden keyword appears, Laura's response is:

> I couldn't safely answer that question (Forbidden keyword: drop). Try rephrasing.

No SQL runs.

---

## 4. End-to-end example

User on `/loa/4a5263bb-...` types: **"What's the average budget for Events in France?"**

1. Frontend `LauraProvider.sendMessage()` detects LOA context from URL → calls `POST /loa/4a5263bb.../chat/ask` with `{ message: "What's the average budget for Events in France?" }`
2. Backend `chat_ask_loa()` checks for summary keywords — none found — dispatches to text-to-SQL
3. `generate_sql()` builds the SQL prompt (~600 tokens of schema + the question + rules) and POSTs to Claude
4. Claude returns:
   ```sql
   SELECT ROUND(AVG(COALESCE(fy_2026_total, 0))::numeric, 2) AS avg_budget,
          COUNT(*) AS sample_size
   FROM loas
   WHERE country = 'France'
     AND (activity_type = 'EVENTS' OR activity_type = 'Events')
   LIMIT 50
   ```
5. `_validate_sql()` accepts it (starts with SELECT, no forbidden keywords, no semicolons)
6. SQLAlchemy executes against Postgres, returns one row: `{avg_budget: 147823.50, sample_size: 38}`
7. `format_sql_answer()` builds the formatting prompt (question + SQL + 1 row) and POSTs to Claude
8. Claude returns: *"The average budget for Events in France is €147,824 across 38 LOAs."*
9. Backend responds with `{ type: "sql_result", answer: "...", sql: "...", row_count: 1 }`
10. Frontend appends the answer as a Laura bubble + the SQL in a collapsible "Show SQL" section

**Total cost per question:** roughly 1000-1500 tokens in, 100-300 tokens out, across two Claude calls. On `claude-sonnet-4-6` that's a few cents per question.

---

## 5. Capabilities matrix

### Laura answers these well

- Aggregations: `"average budget for X"`, `"total spend in DACH"`, `"how many LOAs in Q3 2026?"`
- Filtering: `"show me rejected LOAs over €100k"`, `"approved LOAs in Italy last quarter"`
- Counts and groupings: `"top 5 brands by total spend"`, `"LOAs per cluster"`, `"distribution of activity types"`
- Comparisons (when explicit): `"is this LOA's budget higher than the average for Sponsorship?"`
- Comment summaries: `"summarize the comments"`, `"recap reviewer feedback"`

### Laura struggles with these

- **Semantic similarity**: *"Find LOAs similar to this one"* — there is no embedding index, so she can only match exact column values. She has no concept of "similar" beyond filtering.
- ~~**Multi-turn context**~~ — **fixed.** `history` is sent on every request and threaded
  into all three paths (`_history_to_dicts`, `chat.py:135-138`); `extract_filters()` is
  explicitly follow-up aware. *"And in Italy?"* now inherits the prior turn's filters.
- **Reasoning about NULLs in historical data**: 1332 historical LOAs have NULL `description` and `kpi`. Questions like *"which LOAs mention sustainability?"* will mostly miss because the historical text isn't there.
- **Activity type ambiguity**: historical data uses enum codes like `TM_SEASONAL`, `COOP_ADV`; new LAURA-created LOAs use display names like `Seasonal Visibility`, `Coop Advertising`. The prompt tells Claude to search both, but she sometimes uses only one form.
- **Cross-table joins**: she cannot read `comments`, `users`, `audit_logs`, etc. unless those tables are explicitly added to the schema block.

---

## 6. The Thibault vision — what shipped, what's left

In Meeting 4, Thibault said:

> "Talk to Laura by voice. Give a keyword, have Laura search the historical LOAs for similar ones. Generate the new LOA from that history."

> "The agent will swallow 2+ years of LOAs and digest it — 99% of the training of the agent."

To deliver that, three pieces are missing from the current architecture:

### ~~Missing piece 1 — Semantic similarity~~ ✅ SHIPPED

Built, and built differently from the sketch below it. Embeddings are computed
**locally** with `multilingual-e5-large` via sentence-transformers — no OpenAI or
Anthropic embedding API, so no per-embedding cost and no data leaving the host. Ranking
uses **cosine** distance (`<=>`), not L2 (`<->`), and adds a re-rank pass on top. See
*Capability 4* above. Coverage: 2,712 / 2,757 LOAs.

### ~~Missing piece 2 — Conversation memory~~ ✅ SHIPPED

The frontend ships history with each request and the backend threads it through the
router, text-to-SQL, and RAG paths. The token-cost concern noted below was real but is
mitigated by `deep_search` sending only ~8 retrieved LOAs rather than wide result sets.

### ~~Missing piece 3 — Voice input~~ ✅ SHIPPED (Web Speech API)

`VoiceInput.tsx` uses the browser-native `SpeechRecognition` / `webkitSpeechRecognition`
API (lines 17, 28) and is wired into three fields on the LOA form — Description, Detail,
and KPI (`loa/new/page.tsx:1034, 1048, 1052`). The Whisper option was not taken, so
transcription quality is whatever the browser provides and **Firefox has no support** —
budget for a fallback if that matters.

### Missing piece 4 — Auto-fill bridge 🟡 BACKEND ONLY

Half-built, and the half that exists has no consumer. `POST /loa/{loa_id}/suggest-fills`
is implemented (`backend/api/suggest_fills.py:41`) and proposes values per empty field
from a pool of comparable LOAs. **No frontend code calls it** — a grep across
`frontend/src` for `suggest-fills` returns nothing. The remaining work is entirely UI:
call the endpoint from the LOA form and render the proposals as accept/reject
suggestions.

---

## 7. Operating costs (back-of-envelope)

Per question:
- Typical SQL gen prompt: ~600 tokens in, ~80 tokens out
- Typical answer format prompt: ~700 tokens in (with 20 rows), ~150 tokens out
- **Total: ~1300 tokens in, ~230 tokens out per question on Claude Sonnet 4.6**

Anthropic prices (June 2026): roughly $3/MTok input, $15/MTok output for Sonnet.
- Per question: ~$0.004 in + ~$0.003 out ≈ **~$0.007 per question**
- 100 questions/day: ~$0.70/day → **~$255/year**

This is negligible at current usage. The expensive call only happens when the user actually asks something — alerts are free.

---

## 8. Code map

| File | Purpose |
|---|---|
| `backend/api/chat.py` | The 3 endpoints — request handling, validation, dispatching |
| `backend/engines/chat.py` | The engine — alerts logic, prompts, Claude API client |
| `frontend/src/components/laura/LauraProvider.tsx` | Frontend state — sessions, message sending, localStorage |
| `frontend/src/components/laura/LauraPill.tsx` | The Dynamic Island pill |
| `frontend/src/components/laura/LauraChat.tsx` | The fullscreen chat with sidebar, conversation, composer |

All Claude API calls go through `engines/chat.py::_call_claude()`. To swap models or add new capabilities, that's the place.

---

*Last updated: June 28, 2026. Author: LAURA team (AI to Market × EssilorLuxottica).*
