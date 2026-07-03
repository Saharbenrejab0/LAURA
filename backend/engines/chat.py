"""
LAURA — Unified Chat Engine

One engine, three capabilities:
  1. Proactive alerts    — rule-based, no API cost, instant
  2. Comment summary     — Claude API, summarizes reviewer feedback
  3. Text-to-SQL         — Claude translates natural language → SQL → answer

Architecture: the engine receives pre-fetched data (comments, LOA dict,
historical stats) from the API layer. It NEVER touches the database.

Usage from API:
    from backend.engines.chat import generate_alerts, summarize_comments,
                                     generate_sql, format_sql_answer, _validate_sql
"""

import os
import re
import httpx

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
CLAUDE_MODEL = os.getenv("CLAUDE_MODEL", "claude-sonnet-4-6")


# ═════════════════════════════════════════════════════════════════════════
# CRITICAL: LOA context for all prompts (fixes "Leave of Absence" hallucination)
# ═════════════════════════════════════════════════════════════════════════

_LOA_CONTEXT = (
    "IMPORTANT CONTEXT: In this system, 'LOA' means 'Letter of Authorization' — "
    "a marketing budget request at EssilorLuxottica EMEA. "
    "LOA does NOT mean 'Leave of Absence' (HR term). "
    "The data is about marketing campaigns, brand activations, retail visibility, "
    "events, and cooperative advertising — not employee leave."
)


# ─────────────────────────────────────────────────────────────────────────
# 1. Proactive Alerts (rule-based, no API)
# ─────────────────────────────────────────────────────────────────────────

_WHY_KEYWORDS = frozenset({
    "why", "because", "objective", "goal", "purpose", "aim",
    "increase", "improve", "grow", "retain", "reduce", "accelerate",
    "strengthen", "expand", "boost", "capture", "protect", "drive",
})

_VAGUE_KPI = frozenset({
    "tbd", "t.b.d.", "n/a", "na", "none", "-", "see above",
    "as above", "to be defined", "to be confirmed",
})


def generate_alerts(loa: dict, stats: dict) -> list[dict]:
    """Compare a LOA against historical aggregates. Returns a list of alerts."""
    alerts: list[dict] = []
    budget = loa.get("fy_2026_total") or 0
    doors = loa.get("num_doors") or 0
    description = (loa.get("description") or "").strip()
    kpi = (loa.get("kpi") or "").strip()
    cost_drill = (loa.get("cost_drill_down") or "").strip()
    cost_just = (loa.get("cost_justification") or "").strip()
    activity = loa.get("activity_type", "this type")
    avg_budget = stats.get("avg_budget") or 0
    avg_cpd = stats.get("avg_cost_per_door") or 0
    sample = stats.get("sample_size") or 0

    if budget > 0 and avg_budget > 0 and sample >= 5:
        ratio = budget / avg_budget
        if ratio > 1.5:
            pct = int((ratio - 1) * 100)
            alerts.append({
                "severity": "warning", "code": "budget_outlier",
                "message": (
                    f"Budget (\u20ac{budget:,.0f}) is {pct}% above the "
                    f"historical average (\u20ac{avg_budget:,.0f}) for "
                    f"'{activity}' LOAs ({sample} compared)."
                ),
            })

    if budget > 0 and doors > 0 and avg_cpd > 0 and sample >= 5:
        cpd = budget / doors
        if cpd > avg_cpd * 1.5:
            alerts.append({
                "severity": "warning", "code": "cost_per_door_outlier",
                "message": (
                    f"Cost per door (\u20ac{cpd:,.0f}) is significantly above "
                    f"the historical average (\u20ac{avg_cpd:,.0f})."
                ),
            })

    if not description:
        alerts.append({
            "severity": "warning", "code": "description_empty",
            "message": "Description is empty. Reviewers need context.",
        })
    elif len(description) < 80:
        alerts.append({
            "severity": "info", "code": "description_short",
            "message": "Description is brief. Consider expanding.",
        })
    elif not set(description.lower().split()) & _WHY_KEYWORDS:
        alerts.append({
            "severity": "info", "code": "description_missing_why",
            "message": "Description explains WHAT but not WHY.",
        })

    if not kpi:
        alerts.append({
            "severity": "warning", "code": "kpi_empty",
            "message": "No KPI defined. Reviewers expect measurable criteria.",
        })
    elif kpi.lower().strip() in _VAGUE_KPI or len(kpi) < 30:
        alerts.append({
            "severity": "info", "code": "kpi_vague",
            "message": "KPI appears generic. Specific KPIs speed up approval.",
        })

    if budget > 100_000 and not cost_drill:
        alerts.append({
            "severity": "warning", "code": "cost_drill_missing",
            "message": f"Budget is \u20ac{budget:,.0f} but no cost drill-down.",
        })

    if budget > 50_000 and not cost_just:
        alerts.append({
            "severity": "info", "code": "cost_justification_missing",
            "message": "No cost justification. Benchmarks accelerate review.",
        })

    alerts.sort(key=lambda a: 0 if a["severity"] == "warning" else 1)
    return alerts


# ─────────────────────────────────────────────────────────────────────────
# 2. Comment Summary (Claude API)
# ─────────────────────────────────────────────────────────────────────────

async def summarize_comments(
    comments: list[dict],
    current_status: str,
    viewer_name: str,
) -> str:
    """Summarize reviewer comments in 2-5 sentences."""
    if not comments:
        return "No comments from previous reviewers."
    if not ANTHROPIC_API_KEY:
        return "AI summary unavailable (API key not configured)."

    lines = []
    for c in comments:
        tag = "RESOLVED" if c.get("resolved") else "OPEN"
        lines.append(
            f"- [{c.get('written_at_status', '?')}] {c.get('author_name', 'Unknown')} "
            f"({c.get('author_role', '?')}) on '{c.get('section', '?')}': "
            f"{c.get('content', '')} [{tag}]"
        )
    open_n = sum(1 for c in comments if not c.get("resolved"))
    resolved_n = sum(1 for c in comments if c.get("resolved"))

    prompt = (
        f"{_LOA_CONTEXT}\n\n"
        "You are LAURA, an LOA review assistant for EssilorLuxottica.\n\n"
        f"Summarize the following reviewer comments for **{viewer_name}** "
        f"at the **{current_status}** stage.\n\n"
        "Rules:\n"
        "- Group by review phase\n"
        "- Prefix unresolved items with \u26a0\n"
        "- Max 5 sentences\n"
        f"- End with: '{open_n} open \u00b7 {resolved_n} resolved'\n"
        "- English, professional, no intro/sign-off\n\n"
        f"Comments ({len(comments)} total):\n" + "\n".join(lines)
    )

    return await _call_claude(prompt, max_tokens=600)


# ─────────────────────────────────────────────────────────────────────────
# 3. Text-to-SQL (Claude API × 2 calls)
# ─────────────────────────────────────────────────────────────────────────

_LOAS_SCHEMA = """
TABLE: loas (PostgreSQL)

KEY COLUMNS:
  cluster          TEXT   — FRANCE, ITALY, DACH, IBERIA, NORTH, META, EAST, EMEA, RUSSIA
  country          TEXT   — e.g. France, Italy, Germany, Spain, UK, Netherlands
  brand            TEXT   — e.g. "HB - Ray-Ban", "HB - Oakley", "Essilor - Multibrand", "LB - Chanel", "all HB + all LB"
  category         TEXT[] — PostgreSQL array: ARRAY['Frames'], ARRAY['Lenses'], etc.
  activity_type    TEXT   — HISTORICAL: TM_SEASONAL, EVENTS, IN_STORE, TM_PERMANENT, COOP_ADV, OTHER_ADV, TRADE_INCENTIVE, TRAINING, SPONSORSHIP, CATALOGUES, MEDICAL, PR
                           NEW: Seasonal Visibility, Permanent Visibility, Events, In Store / Consumer Activation, Coop Advertising, Other ADV Expenses, etc.
  cot              TEXT   — "All COT", "Chains", "Independents", "Sport channel", "Buying Groups", etc.
  fy_2026_total    FLOAT  — total FY2026 budget in EUR
  fy_2025_total    FLOAT  — total FY2025 budget in EUR
  fy_2024_total    FLOAT  — total FY2024 budget in EUR
  q4_2024, q1_2025, q2_2025, q3_2025, q4_2025  FLOAT  — FY2025 quarters
  q1_2026, q2_2026, q3_2026, q4_2026  FLOAT  — FY2026 quarters
  num_doors        INT    — number of physical stores
  num_customers    INT    — number of customer accounts
  avg_investment_per_door  FLOAT
  status           TEXT   — draft, emea_review, global_review, cmo_cfo_review, global_functions_review, corporate_review, approved, rejected
  is_demo          BOOL   — true = created in LAURA app, false = historical import
  capex_opex       TEXT   — CapEx or OpEx
  adv_selling      TEXT   — ADV, Selling, Others
  currency         TEXT   — mostly EUR, some CHF
  created_at       TIMESTAMP  — WHEN the row was inserted (NOT the fiscal year!)
  approved_at      TIMESTAMP
  ppt_slide_required BOOL — true if budget > 50000
  description      TEXT   — often NULL for historical
  kpi              TEXT   — often NULL for historical
  vendor           TEXT   — vendor / supplier name
  customer         TEXT   — customer name
  event_type       TEXT   — event type (Roadshow, Trade Fair, Sales Convention, etc.)
  prioritization   TEXT
  source_file      TEXT   — origin file name

NOTES:
  - ~2712 total LOAs (~1337 etl_original historical + ~1337 from session imports + ~38 LAURA-created)
  - Historical LOAs use ENUM codes for activity_type (TM_SEASONAL, COOP_ADV, etc.)
  - For category array: use 'Frames' = ANY(category) or category @> ARRAY['Frames']
  - Use COALESCE for nullable numeric fields
  - Budget amounts are in EUR
  - When user asks about a fiscal year, filter on fy_XXXX_total or qN_YYYY columns, NEVER on created_at
"""

_FORBIDDEN_SQL = re.compile(
    r"\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|"
    r"exec|execute|pg_|information_schema|pg_catalog)\b",
    re.IGNORECASE,
)


def _validate_sql(sql: str) -> tuple[bool, str]:
    """Check that the generated SQL is safe to execute."""
    sql_clean = sql.strip().rstrip(";")
    if not sql_clean.lower().startswith("select"):
        return False, "Only SELECT queries are allowed."
    if _FORBIDDEN_SQL.search(sql_clean):
        match = _FORBIDDEN_SQL.search(sql_clean)
        return False, f"Forbidden keyword: {match.group()}"
    if ";" in sql_clean:
        return False, "Multiple statements not allowed."
    return True, ""


def _format_history(history: list[dict] | None) -> str:
    """Format conversation history for prompt inclusion. Empty if None."""
    if not history:
        return ""
    lines = []
    for msg in history[-6:]:  # last 3 exchanges max
        role = msg.get("role", "user")
        content = (msg.get("content", "") or "")[:300]
        lines.append(f"{role}: {content}")
    return "\n\nPrevious conversation:\n" + "\n".join(lines) + "\n"


async def generate_sql(question: str, history: list[dict] | None = None) -> str:
    """Ask Claude to translate a natural-language question into SQL."""
    history_block = _format_history(history)
    prompt = (
        f"{_LOA_CONTEXT}\n\n"
        "You are a SQL expert helping users query the LAURA LOA database.\n\n"
        f"Schema:\n{_LOAS_SCHEMA}\n"
        f"{history_block}\n"
        f"Current question: {question}\n\n"
        "Rules:\n"
        "- Return ONLY the SQL, no explanation, no markdown fences\n"
        "- Always add LIMIT 50 unless the user asks for a specific count\n"
        "- Use COALESCE for nullable numeric columns in aggregates\n"
        "- When the user asks about an activity type, search BOTH enum codes "
        "AND display names (use OR / IN with both variants)\n"
        "- For category arrays use ANY() operator\n"
        "- Round monetary results to 2 decimal places\n"
        "- For fiscal year filtering, use fy_YYYY_total or qN_YYYY columns, NEVER created_at\n"
        "- If the conversation history references a previous question ('what about 2024', "
        "'and for Italy'), interpret in that context\n"
        "- Keep the SELECT concise: pick only the columns needed for the answer, "
        "don't include 10+ ROUND(CAST(...)) columns unless the user asks for a detailed breakdown\n"
        "- If you cannot translate the question, return: SELECT 'I cannot answer this question' AS error\n"
    )
    return await _call_claude(prompt, max_tokens=2500)


async def format_sql_answer(
    question: str,
    sql: str,
    rows: list[dict],
    history: list[dict] | None = None,
) -> str:
    """Ask Claude to turn raw SQL results into a friendly answer."""
    if not rows:
        return "No results found for your query."

    rows_preview = rows[:20]
    rows_text = "\n".join(str(r) for r in rows_preview)
    if len(rows) > 20:
        rows_text += f"\n... and {len(rows) - 20} more rows"

    history_block = _format_history(history)
    prompt = (
        f"{_LOA_CONTEXT}\n\n"
        "You are LAURA, an LOA assistant for EssilorLuxottica.\n"
        f"{history_block}\n"
        f"The user asked: \"{question}\"\n\n"
        f"SQL executed:\n{sql}\n\n"
        f"Results ({len(rows)} rows):\n{rows_text}\n\n"
        "Write a concise, professional answer in 1-4 sentences. "
        "Include key numbers with \u20ac formatting for monetary values. "
        "If there are multiple rows, highlight the top 3-5. "
        "No markdown tables. No intro like 'Based on the data'. "
        "Just answer directly."
    )
    return await _call_claude(prompt, max_tokens=600)


# ─────────────────────────────────────────────────────────────────────────
# Claude API helper
# ─────────────────────────────────────────────────────────────────────────

async def _call_claude(prompt: str, max_tokens: int = 1500) -> str:
    """Single Claude API call. Returns text or a graceful error."""
    if not ANTHROPIC_API_KEY:
        return "AI unavailable (API key not configured)."
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": ANTHROPIC_API_KEY,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": CLAUDE_MODEL,
                    "max_tokens": max_tokens,
                    "messages": [{"role": "user", "content": prompt}],
                },
            )
        data = resp.json()
        if resp.status_code != 200:
            err_msg = data.get("error", {}).get("message", str(data))
            return f"Claude API error ({resp.status_code}): {err_msg}"
        if "content" not in data or not data["content"]:
            return f"Claude API returned no content: {data}"
        return data["content"][0]["text"].strip()
    except Exception as exc:
        import traceback
        traceback.print_exc()
        return f"AI temporarily unavailable ({type(exc).__name__}: {str(exc)[:200]})."
