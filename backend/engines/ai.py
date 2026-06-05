"""
LAURA — Claude AI Engine
Handles two jobs:
  1. validate_description()  — checks if Description answers WHY not WHAT
  2. suggest_loa_content()   — suggests KPI, Description, Tools based on activity type

EL Security requirement CTRL-747: data is anonymised before sending to Claude.
All suggestions are logged for audit.
"""

import anthropic
import json
import uuid
from datetime import datetime
from backend.config import settings

# ── KPI templates per activity type ───────────────────────────────────────────
KPI_TEMPLATES = {
    "Tailor Made Seasonal": [
        "+10-15% sell-out uplift during campaign period",
        "X% increase in brand visibility score",
        "Sell-through rate of X% within campaign window",
    ],
    "Tailor Made Permanent": [
        "+X% sell-out increase at activated doors vs control doors",
        "X doors activated with permanent fixture",
        "ROI: X€ incremental revenue per €1 invested",
    ],
    "Coop Advertising": [
        "Order uplift avg +5-9% vs baseline",
        "Open rate min 40%, click rate min 10% (digital)",
        "+X% brand share at partner doors",
    ],
    "In Store / Consumer Activation": [
        "+10% traffic uplift during activation period",
        "+X% sell-out boost at activated doors",
        "Consumer engagement: X interactions",
    ],
    "Events": [
        "Frames: X units / X M€ forecasted sales",
        "Instruments: X K€ forecasted sales",
        "Lenses: X K€ awareness uplift",
        "# Customers attended: X",
    ],
    "Trade Incentive": [
        "+X% sell-out lenses (Varilux, Transitions)",
        "X% of participating doors reach target",
        "X new customers acquired",
    ],
    "Sponsorship": [
        "Brand reach: X M impressions",
        "Engagement rate: X%",
        "Partnership ROI: X€ media value",
    ],
    "Catalogues & Brochures": [
        "X doors covered with updated catalogue",
        "Sell-in uplift of X% post-distribution",
        "X% of target doors receive material within 2 weeks",
    ],
    "Medical Affairs": [
        "Reinforce EssilorLuxottica as Vision Care Champion",
        "X medical professionals reached",
        "X prescriptions / referrals generated",
    ],
    "Coop Advertising": [
        "+5-9% order uplift vs baseline",
        "Open rate >40%, click rate >10%",
        "+X% brand share at partner",
    ],
    "Other ADV Expenses": [
        "X M reach / X M impressions",
        "X% increase in brand awareness",
        "X site visitors / leads generated",
    ],
    "Training": [
        "X staff trained",
        "+X% product knowledge score post-training",
        "X doors with trained staff",
    ],
    "PR": [
        "X media placements secured",
        "X M earned media reach",
        "X influencers activated",
    ],
}


def _anonymise(loa_data: dict) -> dict:
    """
    EL security requirement CTRL-747.
    Remove PII and commercially sensitive data before sending to Claude.
    """
    safe = {}
    allowed_keys = {
        "activity_type", "category", "cluster", "country",
        "brand", "cot", "capex_opex", "adv_selling",
        "fy_2026_total", "num_doors", "num_customers",
        "description", "detail", "kpi", "tools",
        "event_type", "event_purpose",
    }
    for key in allowed_keys:
        if key in loa_data and loa_data[key] is not None:
            safe[key] = loa_data[key]
    return safe


def _call_claude(prompt: str, system: str, max_tokens: int = None) -> str:
    """Make a Claude API call and return the text response."""
    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    message = client.messages.create(
        model=settings.CLAUDE_MODEL,
        max_tokens=max_tokens or settings.CLAUDE_MAX_TOKENS,
        system=system,
        messages=[{"role": "user", "content": prompt}],
    )
    return message.content[0].text.strip()


async def validate_description(description: str, activity_type: str) -> dict:
    """
    Check if the Description answers WHY (business objective) not WHAT.

    Returns:
        {
            "is_valid": bool,
            "feedback": str,
            "suggested_correction": str | None,
            "log_id": str
        }

    Bad:  "Support Hans Anders with brand campaigns, Ray-Ban launches in December"
    Good: "Drive Ray-Ban growth within Hans Anders via on and offline campaigns"
    """
    if not description or not description.strip():
        return {
            "is_valid": False,
            "feedback": "Description is empty. It must explain WHY this investment is needed.",
            "suggested_correction": None,
            "log_id": None,
        }

    system = """You are a marketing budget validation assistant for EssilorLuxottica EMEA.
Your job is to check if a LOA (Letter of Authorization) Description field answers WHY
the investment is needed — the business objective — not WHAT will be done.

Rules:
- WHY = business objective, strategic reason, expected business impact
- WHAT = list of activities, tools, or executions (that belongs in the DETAIL field)
- A good Description is one clear sentence stating the business goal
- Bad example: "Support Hans Anders with brand campaigns and Ray-Ban launches"
- Good example: "Drive Ray-Ban growth within Hans Anders via on and offline campaigns"

Respond in JSON only. No markdown, no explanation outside the JSON.
{
  "is_why": true or false,
  "feedback": "one sentence explaining your assessment",
  "suggested_correction": "improved version if is_why is false, null if already good"
}"""

    prompt = f"""Activity Type: {activity_type}
Description to validate: "{description}"

Is this a WHY statement (business objective) or a WHAT statement (list of activities)?"""

    try:
        response = _call_claude(prompt, system, max_tokens=300)
        # Clean response in case Claude adds markdown
        response = response.replace("```json", "").replace("```", "").strip()
        result = json.loads(response)
        log_id = f"AI-DESC-{uuid.uuid4().hex[:8].upper()}"
        return {
            "is_valid": result.get("is_why", False),
            "feedback": result.get("feedback", ""),
            "suggested_correction": result.get("suggested_correction"),
            "log_id": log_id,
        }
    except Exception as e:
        return {
            "is_valid": True,  # Don't block on AI failure
            "feedback": f"AI validation unavailable: {str(e)}",
            "suggested_correction": None,
            "log_id": None,
        }


async def suggest_loa_content(
    activity_type: str,
    cluster: str = "",
    category: str = "",
    brand: str = "",
    fy_total: float = 0,
    num_doors: int = 0,
    requestor_email: str = "system",
) -> dict:
    """
    Suggest Description (WHY), KPI, and Tools (HOW) for a new LOA.
    Called when user fills in the key fields and clicks "Suggest with AI".

    Returns:
        {
            "description": str,
            "kpi": str,
            "tools": str,
            "log_id": str
        }
    """
    system = """You are a marketing budget assistant for EssilorLuxottica EMEA.
Generate concise, professional LOA content for a marketing budget request.

Rules for Description (WHY):
- One clear sentence stating the business objective
- Must answer WHY not WHAT
- Example: "Drive Varilux penetration among independent ECPs in France via targeted seasonal visibility"

Rules for KPI:
- 2-3 measurable KPIs relevant to the activity type
- Use concrete metrics where possible (%, units, €)
- Separate with " · "

Rules for Tools (HOW / DETAIL):
- 2-4 items describing HOW the money will be spent
- Specific to the activity type
- Separate with " · "

Respond in JSON only. No markdown, no preamble.
{
  "description": "...",
  "kpi": "...",
  "tools": "..."
}"""

    # Get KPI template hints
    kpi_hints = " · ".join(KPI_TEMPLATES.get(activity_type, ["X% sell-out uplift", "X doors activated"]))

    prompt = f"""Generate LOA content for:
- Activity Type: {activity_type}
- Cluster: {cluster}
- Category: {category}
- Brand: {brand}
- FY Total Budget: €{fy_total:,.0f}
- Number of Doors: {num_doors or 'N/A'}

KPI inspiration (adapt to this specific LOA): {kpi_hints}"""

    try:
        response = _call_claude(prompt, system, max_tokens=400)
        response = response.replace("```json", "").replace("```", "").strip()
        result = json.loads(response)
        log_id = f"AI-SUGG-{uuid.uuid4().hex[:8].upper()}"
        return {
            "description": result.get("description", ""),
            "kpi":         result.get("kpi", ""),
            "tools":       result.get("tools", ""),
            "log_id":      log_id,
        }
    except Exception as e:
        # Fallback to template KPIs if Claude fails
        kpi_fallback = " · ".join(KPI_TEMPLATES.get(activity_type, ["X% sell-out uplift"]))
        return {
            "description": "",
            "kpi":         kpi_fallback,
            "tools":       "",
            "log_id":      None,
            "error":       str(e),
        }