"""
LAURA — Unified Chat API

Endpoints:
  GET  /loa/{loa_id}/chat/alerts     — auto-loaded proactive alerts (instant)
  POST /loa/{loa_id}/chat/ask        — comment summary + text-to-SQL + RAG
  POST /chat/ask                     — global RAG + text-to-SQL (no LOA context)

All chat interactions are logged to rag_logs for analytics and debugging.
Errors are logged to rag_logs.error and to server logs; users see a clean message.
"""

import time
import traceback
from uuid import UUID

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List, Dict
from sqlalchemy.orm import Session
from sqlalchemy import func, text

from backend.models.database import get_db
from backend.models.loa import LOA
from backend.models.comment import Comment
from backend.models.user import User
from backend.models.role_permission import RolePermission
from backend.models.rag_log import RagLog
from backend.api.auth import get_current_user
from backend.engines.chat import (
    generate_alerts,
    summarize_comments,
    generate_sql,
    format_sql_answer,
    _validate_sql,
)
from backend.engines.rag import ask_rag


def _inject_scope_into_sql(sql: str, user) -> str:
    """Hard-inject cluster scope into generated SQL for non-admin users.
    This is a safety net: even if the LLM ignores the scope hint in the
    prompt, the SQL will always be filtered to the user's clusters."""
    if not sql or not user or not user.role_obj:
        return sql
    if user.role_obj.can_override_lock:
        return sql  # admin sees everything
    from backend.api.templates import _extract_scope_values
    clusters = _extract_scope_values(user.role_obj.scope_value)
    if not clusters:
        return sql
    # Check if already filtered by cluster
    if "cluster" in sql.lower() and any(c.lower() in sql.lower() for c in clusters):
        return sql
    placeholders = ", ".join(f"\'{c}\'" for c in clusters)
    clause = f"cluster IN ({placeholders})"
    sql_upper = sql.upper()
    if "WHERE" in sql_upper:
        idx = sql_upper.index("WHERE") + 5
        sql = sql[:idx] + f" {clause} AND" + sql[idx:]
    elif "FROM LOAS" in sql_upper:
        idx = sql_upper.index("FROM LOAS") + len("FROM LOAS")
        sql = sql[:idx] + f" WHERE {clause}" + sql[idx:]
    return sql

router = APIRouter()


# ── User-facing error messages (never expose Python internals) ─────────

_FRIENDLY_ERROR = (
    "Something went wrong on my side while processing that question. "
    "Please try again in a moment, or rephrase if it persists."
)
_FRIENDLY_SQL_ERROR = (
    "I couldn't build a query for that question. Try rephrasing with "
    "specific fields like brand, country, cluster, or activity type."
)


# ── Request / Response schemas ──────────────────────────────────────────

class HistoryMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    tool: Optional[str] = None
    history: Optional[List[HistoryMessage]] = None
    session_id: Optional[str] = None


# ── Access guard ────────────────────────────────────────────────────────

def _is_reviewer_or_admin(user: User, loa: LOA, db: Session) -> bool:
    role = user.role_obj
    if not role:
        return False
    if role.can_override_lock:
        return True
    rp = (
        db.query(RolePermission)
        .filter(
            RolePermission.role_id == role.id,
            RolePermission.loa_status == loa.status,
        )
        .first()
    )
    return rp is not None


# ── Smart router ────────────────────────────────────────────────────────

_ROUTER_SYSTEM_PROMPT = """Classify the user's question into exactly one tool:
- "stats": counts, totals, averages, aggregations over the LOA database (SQL-friendly)
- "deep_search": finding similar/comparable historical LOAs, semantic search, examples
- "summarize": summarizing reviewer comments/feedback on a specific LOA
Respond with ONLY one word: stats, deep_search, or summarize."""


async def _detect_tool(message: str) -> str:
    from backend.engines.rag import _call_claude
    try:
        raw = await _call_claude(message, system=_ROUTER_SYSTEM_PROMPT, max_tokens=10)
        choice = raw.strip().lower()
        if choice in ("stats", "deep_search", "summarize"):
            return choice
    except Exception:
        pass
    return "stats"


def _history_to_dicts(history: Optional[List[HistoryMessage]]) -> List[Dict[str, str]]:
    if not history:
        return []
    return [{"role": h.role, "content": h.content} for h in history]


def _viewer_name(user: User) -> str:
    """Get a display name for the user, falling back safely."""
    name = getattr(user, "full_name", None)
    if name:
        return name
    email = getattr(user, "email", None)
    if email:
        return email.split("@")[0]
    return "Reviewer"


# ── Logging helper ──────────────────────────────────────────────────────

def _log_rag_query(
    db: Session,
    user: User,
    session_id: Optional[str],
    loa_context_id: Optional[str],
    question: str,
    tool: str,
    history_length: int,
    result: Optional[dict] = None,
    sql: Optional[str] = None,
    error: Optional[str] = None,
    total_ms: Optional[int] = None,
) -> None:
    """Persist a chat interaction to rag_logs. Never raises."""
    try:
        timing = (result or {}).get("timing", {})

        loa_ctx_uuid = None
        if loa_context_id:
            try:
                loa_ctx_uuid = UUID(loa_context_id) if isinstance(loa_context_id, str) else loa_context_id
            except (ValueError, TypeError):
                pass

        user_id_val = None
        if user is not None:
            uid = getattr(user, "id", None)
            if uid:
                try:
                    user_id_val = UUID(uid) if isinstance(uid, str) else uid
                except (ValueError, TypeError):
                    user_id_val = None

        filters_val = None
        if result:
            filters_val = result.get("filters_used") or result.get("filters")

        semantic_val = None
        if isinstance(filters_val, dict):
            semantic_val = filters_val.get("semantic_query")

        sources_val = (result or {}).get("sources")
        loa_count_val = (result or {}).get("loa_count")
        if loa_count_val is None and sources_val is not None:
            loa_count_val = len(sources_val)

        log = RagLog(
            user_id=user_id_val,
            session_id=session_id,
            loa_context_id=loa_ctx_uuid,
            question=question,
            tool=tool,
            history_length=history_length,
            filters_extracted=filters_val,
            semantic_query=semantic_val,
            sources=sources_val,
            loa_count=loa_count_val,
            answer=(result or {}).get("answer"),
            sql_generated=sql,
            extract_ms=timing.get("extract_ms"),
            search_ms=timing.get("search_ms"),
            answer_ms=timing.get("answer_ms"),
            total_ms=total_ms,
            error=error,
        )
        db.add(log)
        db.commit()
    except Exception:
        db.rollback()
        traceback.print_exc()


# ═════════════════════════════════════════════════════════════════════════
# 1. GET /loa/{loa_id}/chat/alerts — instant, rule-based
# ═════════════════════════════════════════════════════════════════════════

@router.get("/loa/{loa_id}/chat/alerts")
async def chat_alerts(
    loa_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    loa = db.query(LOA).filter(LOA.id == loa_id).first()
    if not loa:
        raise HTTPException(status_code=404, detail="LOA not found")

    if not _is_reviewer_or_admin(user, loa, db):
        raise HTTPException(status_code=403, detail="Reviewers and admins only.")

    budget_row = (
        db.query(
            func.avg(LOA.fy_2026_total).label("avg"),
            func.count(LOA.id).label("cnt"),
        )
        .filter(LOA.activity_type == loa.activity_type, LOA.fy_2026_total > 0, LOA.id != loa_id)
        .first()
    )
    cpd_row = (
        db.query(func.avg(LOA.fy_2026_total / LOA.num_doors).label("avg"))
        .filter(
            LOA.activity_type == loa.activity_type,
            LOA.fy_2026_total > 0, LOA.num_doors > 0, LOA.id != loa_id,
        )
        .first()
    )

    loa_data = {
        "fy_2026_total": loa.fy_2026_total,
        "num_doors": loa.num_doors,
        "activity_type": loa.activity_type,
        "description": loa.description,
        "kpi": loa.kpi,
        "cost_drill_down": loa.cost_drill_down,
        "cost_justification": loa.cost_justification,
        "ppt_slide_required": loa.ppt_slide_required,
        "capex_opex": loa.capex_opex,
    }
    stats = {
        "avg_budget": float(budget_row.avg) if budget_row and budget_row.avg else 0,
        "avg_cost_per_door": float(cpd_row.avg) if cpd_row and cpd_row.avg else 0,
        "sample_size": int(budget_row.cnt) if budget_row else 0,
    }

    return {"alerts": generate_alerts(loa_data, stats)}


# ═════════════════════════════════════════════════════════════════════════
# 2. POST /loa/{loa_id}/chat/ask — per-LOA chat
# ═════════════════════════════════════════════════════════════════════════

@router.post("/loa/{loa_id}/chat/ask")
async def chat_ask_loa(
    loa_id: str,
    body: ChatRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    t_start = time.time()
    loa = db.query(LOA).filter(LOA.id == loa_id).first()
    if not loa:
        raise HTTPException(status_code=404, detail="LOA not found")

    question = body.message.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Empty message")

    tool = body.tool or await _detect_tool(question)
    history = _history_to_dicts(body.history)
    session_id = body.session_id

    response = None
    sql_used = None
    error = None

    try:
        # ── Route: summarize comments ──
        if tool == "summarize":
            comments = (
                db.query(Comment)
                .filter(Comment.loa_id == loa_id, Comment.resolved == False)
                .order_by(Comment.created_at.desc())
                .limit(50)
                .all()
            )
            if not comments:
                response = {"answer": "No unresolved comments found on this LOA.",
                            "sql": None, "tool": "summarize"}
            else:
                comments_data = [
                    {
                        "author_name": getattr(c, "author_name", "Unknown"),
                        "author_role": getattr(c, "author_role", "?"),
                        "content": c.content,
                        "section": c.section,
                        "written_at_status": c.written_at_status,
                        "resolved": bool(c.resolved),
                    }
                    for c in comments
                ]
                viewer = _viewer_name(user)
                summary = await summarize_comments(comments_data, loa.status, viewer)
                response = {"answer": summary, "sql": None, "tool": "summarize"}

        # ── Route: RAG (deep search) ──
        elif tool == "deep_search":
            loa_context = (
                f"[Context: The user is viewing LOA {loa.loa_number or loa.id} — "
                f"{loa.brand or '?'} {loa.activity_type or '?'} in {loa.country or '?'} ({loa.cluster or '?'}), "
                f"budget EUR {loa.fy_2026_total or loa.fy_2025_total or 0:,.0f}, "
                f"{loa.num_doors or 0} doors. "
                f"Description: {(loa.description or loa.detail or 'N/A')[:200]}] "
                f"\nQuestion: {question}"
            )
            result = await ask_rag(loa_context, db, chat_history=history)
            response = {
                "answer": result["answer"],
                "sql": None,
                "tool": "deep_search",
                "sources": result.get("sources", []),
                "filters": result.get("filters_used", {}),
                "timing": result.get("timing", {}),
            }

        # ── Route: text-to-SQL ──
        else:
            # Build scope context for SQL generation (role-based filtering)
            _sql_scope = ""
            if user.role_obj and not user.role_obj.can_override_lock:
                from backend.api.templates import _extract_scope_values
                _clusters = _extract_scope_values(user.role_obj.scope_value)
                if _clusters:
                    _sql_scope = f"IMPORTANT: This user can only see LOAs in cluster(s): {', '.join(_clusters)}. Always add WHERE cluster IN ({', '.join(repr(c) for c in _clusters)}) to every query."
            sql_used = await generate_sql(question, history=history, scope_hint=_sql_scope)
            sql_used = _inject_scope_into_sql(sql_used, user)
            ok, err = _validate_sql(sql_used)
            if not ok:
                response = {"answer": _FRIENDLY_SQL_ERROR, "sql": sql_used, "tool": "stats"}
            else:
                rows = db.execute(text(sql_used)).mappings().all()
                rows_list = [dict(r) for r in rows]
                if not rows_list:
                    response = {"answer": "No results found for your query.",
                                 "sql": sql_used, "tool": "stats"}
                else:
                    answer = await format_sql_answer(question, sql_used, rows_list, history=history)
                    response = {"answer": answer, "sql": sql_used, "tool": "stats"}

    except Exception as e:
        # Keep full detail for backend logs + rag_logs.error, show user a clean message
        error = f"{type(e).__name__}: {str(e)[:500]}"
        traceback.print_exc()
        response = {"answer": _FRIENDLY_ERROR, "sql": sql_used or "", "tool": tool}

    total_ms = int((time.time() - t_start) * 1000)
    _log_rag_query(
        db=db, user=user, session_id=session_id, loa_context_id=loa_id,
        question=question, tool=tool, history_length=len(history),
        result=response, sql=sql_used, error=error, total_ms=total_ms,
    )

    return response


# ═════════════════════════════════════════════════════════════════════════
# 3. POST /chat/ask — global chat
# ═════════════════════════════════════════════════════════════════════════

@router.post("/chat/ask")
async def chat_ask_global(
    body: ChatRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    t_start = time.time()
    question = body.message.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Empty message")

    tool = body.tool or await _detect_tool(question)
    history = _history_to_dicts(body.history)
    session_id = body.session_id

    response = None
    sql_used = None
    error = None

    try:
        if tool == "deep_search":
            _scope = None
            if user.role_obj and not user.role_obj.can_override_lock:
                from backend.api.templates import _extract_scope_values
                _clusters = _extract_scope_values(user.role_obj.scope_value)
                if _clusters:
                    _scope = {"clusters": _clusters}
            result = await ask_rag(question, db, chat_history=history, user_scope=_scope)
            response = {
                "answer": result["answer"],
                "sql": None,
                "tool": "deep_search",
                "sources": result.get("sources", []),
                "filters": result.get("filters_used", {}),
                "timing": result.get("timing", {}),
            }
        else:
            # R10: scope filter for Stats in global endpoint
            _sql_scope_g = ""
            if user.role_obj and not user.role_obj.can_override_lock:
                from backend.api.templates import _extract_scope_values
                _clusters_g = _extract_scope_values(user.role_obj.scope_value)
                if _clusters_g:
                    _sql_scope_g = f"IMPORTANT: This user can only see LOAs in cluster(s): {', '.join(_clusters_g)}. Always add WHERE cluster IN ({', '.join(repr(c) for c in _clusters_g)}) to every query."
            sql_used = await generate_sql(question, history=history, scope_hint=_sql_scope_g)
            sql_used = _inject_scope_into_sql(sql_used, user)
            ok, err = _validate_sql(sql_used)
            if not ok:
                response = {"answer": _FRIENDLY_SQL_ERROR, "sql": sql_used, "tool": "stats"}
            else:
                rows = db.execute(text(sql_used)).mappings().all()
                rows_list = [dict(r) for r in rows]
                if not rows_list:
                    response = {"answer": "No results found for your query.",
                                 "sql": sql_used, "tool": "stats"}
                else:
                    answer = await format_sql_answer(question, sql_used, rows_list, history=history)
                    response = {"answer": answer, "sql": sql_used, "tool": "stats"}
    except Exception as e:
        error = f"{type(e).__name__}: {str(e)[:500]}"
        traceback.print_exc()
        response = {"answer": _FRIENDLY_ERROR, "sql": sql_used or "", "tool": tool}

    total_ms = int((time.time() - t_start) * 1000)
    _log_rag_query(
        db=db, user=user, session_id=session_id, loa_context_id=None,
        question=question, tool=tool, history_length=len(history),
        result=response, sql=sql_used, error=error, total_ms=total_ms,
    )

    return response
