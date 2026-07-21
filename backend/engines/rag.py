"""
LAURA RAG Engine — Hybrid Retrieval-Augmented Generation

Three-stage pipeline:
  1. extract_filters  — Claude extracts structured filters + semantic query
                        with FOLLOW-UP AWARENESS (carries over context)
  2. hybrid_search    — SQL pre-filter + pgvector cosine similarity → top K
  3. generate_answer  — Claude answers with LOA citations, warns about sample

Usage from api/chat.py:
    from backend.engines.rag import ask_rag
    result = await ask_rag(question, db, chat_history=[...])

All embeddings computed locally (sentence-transformers).
Only 2 Claude API calls per question (filter + answer).
Only ~8 LOAs sent to Claude per question (not 2712).
"""

import json
import os
import re
import time
import logging
from datetime import datetime

import httpx
from sqlalchemy import text
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

# ── Config ──
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
CLAUDE_MODEL = os.getenv("CLAUDE_MODEL", "claude-sonnet-4-6")
ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"

# ── Embedding model (lazy-loaded, singleton) ──
_embed_model = None


def _get_embed_model():
    """Load sentence-transformers model once, reuse across requests."""
    global _embed_model
    if _embed_model is None:
        from sentence_transformers import SentenceTransformer
        _embed_model = SentenceTransformer("intfloat/multilingual-e5-large")
        logger.info("Loaded embedding model: multilingual-e5-large (1024 dim)")
    return _embed_model


# ═══════════════════════════════════════════════════════════════
# 1. CLAUDE API HELPER
# ═══════════════════════════════════════════════════════════════

async def _call_claude(prompt: str, system: str = "", max_tokens: int = 1500) -> str:
    """Call Claude API with optional system prompt."""
    headers = {
        "x-api-key": ANTHROPIC_API_KEY,
        "content-type": "application/json",
        "anthropic-version": "2023-06-01",
    }
    body = {
        "model": CLAUDE_MODEL,
        "max_tokens": max_tokens,
        "messages": [{"role": "user", "content": prompt}],
    }
    if system:
        body["system"] = system

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(ANTHROPIC_URL, headers=headers, json=body)
        resp.raise_for_status()
        data = resp.json()
        return data["content"][0]["text"]


# ═══════════════════════════════════════════════════════════════
# 2. FILTER EXTRACTION
# ═══════════════════════════════════════════════════════════════

FILTER_SYSTEM_PROMPT = """You are a query parser for LAURA, an LOA (Letter of Authorization) management system at EssilorLuxottica EMEA. LOA = marketing budget request, NOT "Leave of Absence".

Your job: extract structured filters and a semantic search query from the user's question.

Available filter fields:
- brand: e.g. "Ray-Ban", "HB - Ray-Ban", "HB - Ray-Ban Meta", "Oakley", "HB - Oakley", "Varilux", "Chanel", "Prada" (use exact brand name as it appears in the database)

CRITICAL BRAND RULE: The following are BRAND NAMES, not brand+cluster combinations:
  "Ray-Ban Meta" or "HB - Ray-Ban Meta" = brand (NOT Ray-Ban + cluster META)
  "Oakley Meta" or similar = brand (NOT Oakley + cluster META)
  When the user says "Ray-Ban Meta", set brand to "Ray-Ban Meta", do NOT set cluster to META.
  Only set cluster to META if the user explicitly mentions a geographic region like GCC, Export, Middle East, or Africa.
- country: e.g. "Italy", "France", "UK", "Spain", "Germany"
- cluster: e.g. "ITALY", "FRANCE", "DACH", "NORTH", "EAST", "META", "IBERIA", "EMEA"
- activity_type: e.g. "Events", "TM_SEASONAL", "TM_PERMANENT", "COOP_ADVERTISING", "IN_STORE", "SPONSORSHIP", "PR", "CATALOGUES_BROCHURES", "MEDICAL_AFFAIRS"
- budget_min: minimum budget in EUR (number only)
- budget_max: maximum budget in EUR (number only)
- category: e.g. "Frames", "Lenses", "Instruments"
- vendor: supplier/vendor name if explicitly mentioned (e.g. "Reklam centar")

CRITICAL: FOLLOW-UP QUESTIONS CARRY OVER FILTERS
If the current question is a follow-up like:
  - "and for Italy?"          → carry over ALL previous filters + add country='Italy'
  - "what about 2024?"        → carry over previous filters + change fiscal year
  - "and seasonal ones?"      → carry over previous filters + add activity_type='TM_SEASONAL'
  - "top 5?" / "and more?"    → carry over ALL previous filters
  - "in France instead?"      → carry over previous filters + REPLACE country

Look at the previous conversation carefully. If the last user question was about "seasonal campaigns"
and the current is "and for Italy?", the correct filters are: activity_type=TM_SEASONAL AND country=Italy.

Never drop a previous filter unless the user explicitly changes topic (new brand, new activity, etc.).

Filter rules:
- "around 100k" → budget_min: 70000, budget_max: 130000 (±30%)
- "more than 50k" → budget_min: 50000
- "less than 20k" → budget_max: 20000
- semantic_query: rephrase the resolved question (with carried-over context) for semantic search
- If purely structured (all info in filters), semantic_query can be brief

Respond with ONLY valid JSON, no markdown, no explanation:
{"brand": null, "country": null, "cluster": null, "activity_type": null, "budget_min": null, "budget_max": null, "category": null, "semantic_query": "..."}"""


async def extract_filters(question: str, chat_history: list[dict] = None) -> dict:
    """Extract structured filters + semantic query, aware of conversation context."""
    prompt = question
    if chat_history:
        context_lines = []
        for msg in chat_history[-6:]:
            role = msg.get('role', 'user')
            content = (msg.get('content', '') or '')[:400]
            context_lines.append(f"{role}: {content}")
        context = "\n".join(context_lines)
        prompt = (
            f"Previous conversation:\n{context}\n\n"
            f"Current question: {question}\n\n"
            f"Remember: carry over filters from previous questions unless the user "
            f"explicitly changes topic. Return the RESOLVED filters (previous + new)."
        )

    raw = await _call_claude(prompt, system=FILTER_SYSTEM_PROMPT, max_tokens=400)

    # Parse JSON (strip markdown fences if Claude adds them)
    cleaned = re.sub(r"```json\s*|\s*```", "", raw).strip()
    try:
        filters = json.loads(cleaned)
    except json.JSONDecodeError:
        logger.warning(f"Failed to parse filter JSON: {cleaned[:200]}")
        filters = {"semantic_query": question}

    # Ensure all expected keys exist
    defaults = {
        "brand": None, "country": None, "cluster": None,
        "activity_type": None, "budget_min": None, "budget_max": None,
        "category": None, "vendor": None, "semantic_query": question,
    }
    for key, default in defaults.items():
        filters.setdefault(key, default)

    return filters


# ═══════════════════════════════════════════════════════════════
# 3. HYBRID SEARCH
# ═══════════════════════════════════════════════════════════════

def _token_match_score(target: str, candidate: str) -> float:
    """
    Score how well `candidate` matches `target` at the token level.
    1.0  = exact match (case/spacing-insensitive)
    0.5  = candidate is a superset of target's tokens (e.g. "Ray-Ban Meta"
           vs "Ray-Ban", or "HB - Ray-Ban" vs "Ray-Ban") -- related but NOT
           the same thing, so it must rank below the exact match.
    0.3  = weak substring overlap only
    0.0  = no relation
    """
    if not target or not candidate:
        return 0.0
    t = target.strip().lower()
    c = candidate.strip().lower()
    if t == c:
        return 1.0
    t_tokens = set(t.replace("-", " ").split())
    c_tokens = set(c.replace("-", " ").split())
    if t_tokens and t_tokens <= c_tokens:
        return 1.0 if t_tokens == c_tokens else 0.5
    if t in c or c in t:
        return 0.3
    return 0.0


def _rerank(results: list[dict], filters: dict, top_k: int) -> list[dict]:
    """
    Re-rank retrieved LOAs with a composite score: vector similarity plus
    exact-match bonuses for brand, activity_type, and vendor. This fixes
    cases where a semantically-close-but-different entity (e.g. "Ray-Ban
    Meta") outranks the exact match ("Ray-Ban") on pure vector distance.
    """
    brand = filters.get("brand")
    activity = filters.get("activity_type")
    vendor = filters.get("vendor")

    for loa in results:
        similarity = 1 - loa.get("distance", 0)
        brand_score = _token_match_score(brand, loa.get("brand", "")) if brand else 0.0
        activity_score = _token_match_score(activity, loa.get("activity_type", "")) if activity else 0.0
        vendor_score = _token_match_score(vendor, loa.get("vendor", "")) if vendor else 0.0
        loa["_composite"] = similarity + brand_score * 0.5 + activity_score * 0.2 + vendor_score * 0.15

    results.sort(key=lambda r: r["_composite"], reverse=True)
    return results[:top_k]


def hybrid_search(filters: dict, db: Session, top_k: int = 8) -> list[dict]:
    """SQL pre-filter + pgvector cosine similarity → top K LOAs."""
    conditions = ["embedding IS NOT NULL"]
    params = {}

    if filters.get("brand"):
        conditions.append("brand ILIKE :brand")
        params["brand"] = f"%{filters['brand']}%"

    if filters.get("country"):
        conditions.append("country ILIKE :country")
        params["country"] = f"%{filters['country']}%"

    if filters.get("cluster"):
        conditions.append("cluster ILIKE :cluster")
        params["cluster"] = f"%{filters['cluster']}%"

    if filters.get("activity_type"):
        conditions.append("(activity_type ILIKE :activity_type OR activity_type ILIKE :activity_type2)")
        params["activity_type"] = f"%{filters['activity_type']}%"
        alt = filters["activity_type"].replace("_", " ").replace("TM ", "Tailor Made ")
        params["activity_type2"] = f"%{alt}%"

    if filters.get("category"):
        conditions.append(":category = ANY(category)")
        params["category"] = filters["category"]

    if filters.get("budget_min"):
        conditions.append("COALESCE(fy_2025_total, fy_2026_total, 0) >= :budget_min")
        params["budget_min"] = float(filters["budget_min"])

    if filters.get("budget_max"):
        conditions.append("COALESCE(fy_2025_total, fy_2026_total, 0) <= :budget_max")
        params["budget_max"] = float(filters["budget_max"])

    # Role-based scope filtering (R10)
    if filters.get("_scope_clusters"):
        placeholders = ", ".join(f":scope_{i}" for i in range(len(filters["_scope_clusters"])))
        conditions.append(f"cluster IN ({placeholders})")
        for i, c in enumerate(filters["_scope_clusters"]):
            params[f"scope_{i}"] = c

    where_clause = " AND ".join(conditions)

    # ── Embed the semantic query ──
    semantic_query = filters.get("semantic_query", "")
    model = _get_embed_model()
    vec = model.encode(f"query: {semantic_query}", normalize_embeddings=True)
    vec_str = "[" + ",".join(str(float(v)) for v in vec) + "]"
    params["query_vec"] = vec_str

    # ── Execute hybrid query ──
    sql = f"""
        SELECT id, loa_number, brand, activity_type, country, cluster,
               category, cot, customer, vendor,
               detail, description, kpi, cost_justification,
               num_doors, avg_investment_per_door,
               fy_2024_total, fy_2025_total, fy_2026_total,
               q1_2025, q2_2025, q3_2025, q4_2025,
               capex_opex, adv_selling,
               start_date, end_date,
               event_type, embedding_text,
               embedding <=> :query_vec AS distance
        FROM loas
        WHERE {where_clause}
        ORDER BY embedding <=> :query_vec
        LIMIT :pool_size
    """
    pool_size = max(top_k * 3, 15)
    params["pool_size"] = pool_size

    rows = db.execute(text(sql), params).fetchall()

    results = []
    for row in rows:
        loa = dict(row._mapping)
        loa["distance"] = float(loa["distance"])
        fy = loa.get("fy_2025_total") or loa.get("fy_2026_total") or loa.get("fy_2024_total") or 0
        loa["budget_display"] = f"EUR {fy:,.0f}"
        results.append(loa)

    return _rerank(results, filters, top_k)


# ═══════════════════════════════════════════════════════════════
# 4. ANSWER GENERATION
# ═══════════════════════════════════════════════════════════════

ANSWER_SYSTEM_PROMPT = """You are Laura, the AI assistant for LAURA (LOA Automation & Review Agent) at EssilorLuxottica EMEA. LOA means "Letter of Authorization" — a marketing budget request. NOT "Leave of Absence".

You answer questions about LOAs using ONLY the data provided below.

CRITICAL RULES:
- The retrieved LOAs are a SAMPLE (top K by semantic similarity), NOT the full dataset.
- NEVER claim "total budget across all X LOAs" as if the sample is exhaustive.
  Instead say: "across the retrieved sample" or "in these top matches" or "among these examples".
- If the user asks about totals, counts, or averages over the whole dataset, tell them:
  "For dataset-wide totals, please use the Stats tool. What I can show you here is a sample of the most relevant LOAs."
- Base every claim on the LOA data provided. Never invent data.
- Cite LOA numbers (e.g. LOA-2024-0421) when referencing specific LOAs.
- If no LOA number exists, cite by brand + country + activity (e.g. "Ray-Ban Events in Italy").
- Be specific with numbers: budgets, door counts, KPIs.
- If the retrieved LOAs don't answer the question, say so clearly.
- Respond in the same language as the question (French, English, etc.).
- Be concise but complete. No fluff.
- Use EUR for all currency amounts.
- If a filter was carried over from previous conversation, briefly acknowledge it
  (e.g. "Focusing on seasonal campaigns in Italy...").

FORMATTING STYLE (important):
- Write like Claude or ChatGPT default style: calm, clean, understated.
- Do NOT use decorative emoji in headings or as bullet markers (no trophy, globe,
  magnifying glass, warning-sign emoji, flag emoji, etc.).
- Use markdown headings sparingly, only for genuinely distinct sections.
- Prefer a short paragraph or a simple bullet list over multiple small tables.
- Use at most one table per answer, only when directly comparing several items.
- Bold only the 2-3 most important values, not every noun."""


def _format_loas_for_prompt(loas: list[dict]) -> str:
    """Format retrieved LOAs as context for Claude."""
    if not loas:
        return "No matching LOAs found."

    parts = []
    for i, loa in enumerate(loas, 1):
        fy = loa.get("fy_2025_total") or loa.get("fy_2026_total") or loa.get("fy_2024_total") or 0
        loa_id = loa.get("loa_number") or f"{loa.get('brand', '?')} {loa.get('activity_type', '?')} in {loa.get('country', '?')}"

        entry = f"--- LOA {i}: {loa_id} ---\n"
        entry += f"Brand: {loa.get('brand', 'N/A')}\n"
        entry += f"Activity: {loa.get('activity_type', 'N/A')}\n"
        entry += f"Country: {loa.get('country', 'N/A')} ({loa.get('cluster', '')})\n"
        entry += f"Budget: EUR {fy:,.0f}\n"

        if loa.get("category"):
            cat = loa["category"] if isinstance(loa["category"], str) else ", ".join(loa["category"])
            entry += f"Category: {cat}\n"
        if loa.get("num_doors"):
            entry += f"Doors: {loa['num_doors']}\n"
        if loa.get("cot"):
            entry += f"Channel: {loa['cot']}\n"
        if loa.get("customer"):
            entry += f"Customer: {loa['customer']}\n"
        if loa.get("event_type"):
            entry += f"Event type: {loa['event_type']}\n"
        if loa.get("description"):
            entry += f"Description: {loa['description'][:300]}\n"
        if loa.get("detail") and loa.get("detail") != loa.get("description"):
            entry += f"Detail: {loa['detail'][:300]}\n"
        if loa.get("kpi"):
            entry += f"KPI: {loa['kpi'][:200]}\n"
        if loa.get("cost_justification"):
            entry += f"Cost rationale: {loa['cost_justification'][:200]}\n"
        if loa.get("vendor"):
            entry += f"Vendor: {loa['vendor']}\n"
        if loa.get("capex_opex"):
            entry += f"CapEx/OpEx: {loa['capex_opex']}\n"
        if loa.get("start_date"):
            entry += f"Period: {loa['start_date']} to {loa.get('end_date', 'N/A')}\n"

        entry += f"Relevance score: {1 - loa.get('distance', 0):.2%}\n"
        parts.append(entry)

    return "\n".join(parts)


async def generate_answer(question: str, loas: list[dict], filters: dict) -> dict:
    """Generate a natural language answer from retrieved LOAs."""
    loa_context = _format_loas_for_prompt(loas)
    active_filters = {k: v for k, v in filters.items() if v is not None and k != "semantic_query"}
    filters_summary = ", ".join(f"{k}={v}" for k, v in active_filters.items())

    prompt = f"""Question: {question}

Active filters (carried over + new): {filters_summary or 'none (semantic search only)'}
Semantic search: "{filters.get('semantic_query', question)}"
Results found: {len(loas)} LOAs (sample, not exhaustive)
{"NOTE: The original filters returned no results, so these are the closest semantic matches WITHOUT the original filters. Mention this to the user: you could not find an exact match for their specific criteria, but here are the most similar LOAs from the broader dataset." if filters.get("_relaxed") else ""}

Retrieved LOAs:
{loa_context}

Answer the question based on these LOAs. Remember: this is a SAMPLE, not the complete dataset.
Do not present a "total" as if it covers all matching LOAs in the database."""

    answer = await _call_claude(prompt, system=ANSWER_SYSTEM_PROMPT, max_tokens=1500)

    return {
        "answer": answer,
        "loa_count": len(loas),
        "filters_used": active_filters,
        "sources": [
            {
                "id": str(loa.get("id", "")),
                "loa_number": loa.get("loa_number"),
                "brand": loa.get("brand"),
                "activity_type": loa.get("activity_type"),
                "country": loa.get("country"),
                "budget": loa.get("budget_display"),
                "distance": round(loa.get("distance", 0), 4),
            }
            for loa in loas
        ],
    }


# ═══════════════════════════════════════════════════════════════
# 5. MAIN ENTRY POINT
# ═══════════════════════════════════════════════════════════════

async def ask_rag(
    question: str,
    db: Session,
    chat_history: list[dict] = None,
    top_k: int = 8,
    user_scope: dict | None = None,
) -> dict:
    """Main RAG pipeline: extract → search → answer."""
    timing = {}

    # ── Stage 1: Extract filters (with context awareness) ──
    t0 = time.time()
    filters = await extract_filters(question, chat_history)
    if user_scope and user_scope.get("clusters"):
        filters["_scope_clusters"] = user_scope["clusters"]
    timing["extract_ms"] = int((time.time() - t0) * 1000)
    logger.info(f"Filters extracted: {filters}")

    # ── Stage 2: Hybrid search ──
    t1 = time.time()
    loas = hybrid_search(filters, db, top_k=top_k)
    timing["search_ms"] = int((time.time() - t1) * 1000)
    logger.info(f"Hybrid search returned {len(loas)} LOAs")

    # ── Handle no results: retry with relaxed filters ──
    if not loas and any(v for k, v in filters.items() if k != "semantic_query"):
        logger.info("No results with filters, retrying semantic-only")
        relaxed = {k: None for k in filters}
        relaxed["semantic_query"] = filters["semantic_query"]
        loas = hybrid_search(relaxed, db, top_k=top_k)
        if loas:
            filters["_relaxed"] = True

    # ── Stage 3: Generate answer ──
    t2 = time.time()
    result = await generate_answer(question, loas, filters)
    timing["answer_ms"] = int((time.time() - t2) * 1000)

    result["timing"] = timing
    return result
