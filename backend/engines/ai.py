"""
LAURA — AI engine
Handles all Claude API calls with:
- Data anonymisation BEFORE sending (EL security requirement CTRL-716, CTRL-721)
- Full audit logging of every inference call (EL security requirement CTRL-747)
- Graceful fallback if Claude is unavailable
"""

import anthropic
import structlog
import json
import uuid
from datetime import datetime
from pathlib import Path

from backend.config import settings

logger = structlog.get_logger()
client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

# Audit log path — appends one JSON line per call
AUDIT_LOG_PATH = Path("backend/logs/ai_inference_audit.jsonl")
AUDIT_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)


def _write_audit_log(call_id: str, input_shape: dict, output_preview: str, user_email: str):
    """
    Write one line to the AI audit log.
    Stores shape/structure of input, NOT the actual values.
    Required by EL security questionnaire CTRL-747.
    """
    entry = {
        "call_id": call_id,
        "timestamp": datetime.utcnow().isoformat(),
        "model": settings.CLAUDE_MODEL,
        "user": user_email,
        "input_shape": input_shape,          # What fields were sent (no values)
        "output_preview": output_preview[:100],  # First 100 chars only
        "anonymised": settings.ANONYMISE_BEFORE_LLM,
    }
    with open(AUDIT_LOG_PATH, "a") as f:
        f.write(json.dumps(entry) + "\n")


def _anonymise(activity_type: str, cluster: str, fy_total: float) -> dict:
    """
    Build an anonymised context for Claude.
    We send STRUCTURE, not confidential values.
    Budget is converted to a range, not exact figure.
    Country/cluster is generalised to region.
    """
    # Budget range instead of exact figure
    if fy_total < 50_000:
        budget_range = "small (<€50k)"
    elif fy_total < 200_000:
        budget_range = "medium (€50k-€200k)"
    elif fy_total < 500_000:
        budget_range = "large (€200k-€500k)"
    else:
        budget_range = "major (>€500k)"

    return {
        "activity_type": activity_type,
        "budget_range": budget_range,
        "region": "EMEA",   # Never send specific country
    }


async def suggest_loa_content(
    activity_type: str,
    cluster: str,
    category: str,
    brand: str,
    fy_total: float,
    num_doors: int,
    requestor_email: str,
) -> dict:
    """
    Ask Claude to suggest Description, KPI, and Tools for a LOA.
    Returns a dict with keys: description, kpi, tools, call_id.
    Falls back to empty strings if Claude is unavailable.
    """
    call_id = str(uuid.uuid4())

    if not settings.ANONYMISE_BEFORE_LLM:
        logger.warning("ANONYMISE_BEFORE_LLM is False — check security policy")

    # Anonymised context — no confidential numbers or names
    ctx = _anonymise(activity_type, cluster, fy_total)

    prompt = f"""You are helping a marketing team write a Letter of Approval (LOA) for a marketing investment.

Activity type: {ctx['activity_type']}
Category: {category}
Brand group: {brand}
Budget range: {ctx['budget_range']}
Number of doors/stores: {num_doors if num_doors else 'not specified'}

Based on best practices for this type of marketing investment, suggest:

1. DESCRIPTION (1 sentence — the WHY, not the what)
2. KPI (1-2 measurable targets, e.g. "+10-15% sell-out increase")
3. TOOLS (bullet list of specific marketing tools/materials)

Respond ONLY with a JSON object, no markdown, no extra text:
{{"description": "...", "kpi": "...", "tools": "..."}}"""

    input_shape = {
        "activity_type": activity_type,
        "category": category,
        "brand_group": brand[:10] + "...",  # Truncated — no exact brand name in log
        "fields_sent": ["activity_type", "category", "brand_group", "budget_range", "num_doors"],
    }

    try:
        response = client.messages.create(
            model=settings.CLAUDE_MODEL,
            max_tokens=settings.CLAUDE_MAX_TOKENS,
            messages=[{"role": "user", "content": prompt}],
        )

        raw_text = response.content[0].text.strip()
        result = json.loads(raw_text)

        _write_audit_log(call_id, input_shape, raw_text, requestor_email)

        logger.info("AI suggestion generated", call_id=call_id, activity_type=activity_type)
        return {**result, "call_id": call_id, "success": True}

    except json.JSONDecodeError:
        logger.error("Claude returned non-JSON", call_id=call_id, raw=raw_text[:200])
        return _fallback(call_id)

    except Exception as e:
        logger.error("Claude API call failed", call_id=call_id, error=str(e))
        _write_audit_log(call_id, input_shape, f"ERROR: {str(e)}", requestor_email)
        return _fallback(call_id)


def _fallback(call_id: str) -> dict:
    """Return empty suggestions — never break the UI because AI failed."""
    return {
        "description": "",
        "kpi": "",
        "tools": "",
        "call_id": call_id,
        "success": False,
    }
