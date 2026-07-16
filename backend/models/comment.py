"""
LAURA — Comment model  (v2 — field-level + severity + visibility)

A comment is anchored to either:
  - the LOA as a whole  (anchor_type = 'loa')
  - a specific field    (anchor_type = 'field', field_key = 'q3_budget')

Section is kept as a denormalized grouping key for filtering (derived from
field_key when anchor_type is 'field', or 'general' when anchor_type is 'loa').

Severity:
  - note       — informational, no action required
  - suggestion — the author thinks something should change
  - blocking   — must be resolved before the LOA can advance

Visibility:
  - loa_participants    — anyone with View access on this LOA
  - role_scoped         — author's role group + EMEA PS + validators + corporate
                          + super-admin + LOA owner + local finance
  - private_admin       — super_admin + ai_to_market_admin only
"""

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean, Column, DateTime, Float, ForeignKey, String, Text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from backend.models.database import Base


# ── Anchor constants ──────────────────────────────────────────────────────

ANCHOR_LOA = "loa"
ANCHOR_FIELD = "field"

# ── Severity constants ────────────────────────────────────────────────────

SEVERITY_NOTE = "note"
SEVERITY_SUGGESTION = "suggestion"
SEVERITY_BLOCKING = "blocking"
ALLOWED_SEVERITIES = {SEVERITY_NOTE, SEVERITY_SUGGESTION, SEVERITY_BLOCKING}

# ── Visibility constants ──────────────────────────────────────────────────

VIS_LOA_PARTICIPANTS = "loa_participants"
VIS_ROLE_SCOPED = "role_scoped"
VIS_PRIVATE_ADMIN = "private_admin"
ALLOWED_VISIBILITIES = {VIS_LOA_PARTICIPANTS, VIS_ROLE_SCOPED, VIS_PRIVATE_ADMIN}

# ── Section keys (denormalized from field_key for grouping) ───────────────
#    When anchor_type = 'field', section is derived from FIELD_TO_SECTION.
#    When anchor_type = 'loa', section = 'general'.

FIELD_TO_SECTION = {
    # Overview
    "description": "overview",
    "detail": "overview",
    # Geography
    "cluster": "geography",
    "country": "geography",
    "legal_entity": "geography",
    # Classification
    "activity_type": "classification",
    "brand": "classification",
    "category": "classification",
    "cot": "classification",
    # Financials
    "capex_opex": "financials",
    "adv_selling": "financials",
    "fy_2025_total": "financials",
    "fy_2026_total": "financials",
    "budget_total": "financials",
    "q1_budget": "financials",
    "q2_budget": "financials",
    "q3_budget": "financials",
    "q4_budget": "financials",
    "cost_drill_down": "financials",
    "avg_investment_per_door": "financials",
    # Customer & vendor
    "customer": "customer",
    "vendor": "customer",
    "num_doors": "customer",
    # KPIs
    "kpi": "kpis",
    "success_criteria": "kpis",
    # Photos
    "photos": "photos",
}

# All valid section values (for backward compat + new grouping)
COMMENTABLE_SECTIONS = set(FIELD_TO_SECTION.values()) | {
    "general",              # LOA-level comments
    "legacy_cmo_comment",   # migrated from old cmo_comment blob
    # Old section names from v1 — kept so existing rows don't violate constraints
    "activity_classification", "product", "investment_detail",
    "budget", "dates", "description", "detail", "kpi",
    "cost_drill_down", "photos",
}


def derive_section(anchor_type: str, field_key: str | None) -> str:
    """Given an anchor type and optional field key, return the section."""
    if anchor_type == ANCHOR_LOA:
        return "general"
    if field_key and field_key in FIELD_TO_SECTION:
        return FIELD_TO_SECTION[field_key]
    # Fallback: use the field_key itself as section (covers old v1 data)
    return field_key or "general"


class Comment(Base):
    __tablename__ = "comments"

    id = Column(
        UUID(as_uuid=False),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    loa_id = Column(
        UUID(as_uuid=False),
        ForeignKey("loas.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # ── Anchor ────────────────────────────────────────────────────────
    anchor_type = Column(String, nullable=False, default=ANCHOR_LOA)
    field_key = Column(String, nullable=True)     # e.g. "q3_budget", "description"
    section = Column(String, nullable=False, default="general")

    # -- Slide pin coordinates (relative 0-1; null = no pin) --
    anchor_x = Column(Float, nullable=True)
    anchor_y = Column(Float, nullable=True)

    # ── Threading (reserved, not used in MVP UI) ──────────────────────
    parent_comment_id = Column(
        UUID(as_uuid=False),
        ForeignKey("comments.id", ondelete="SET NULL"),
        nullable=True,
    )

    # ── Author ────────────────────────────────────────────────────────
    author_email = Column(String, nullable=False, index=True)
    author_name = Column(String, nullable=False)
    author_role = Column(String, nullable=False)

    # ── Content ───────────────────────────────────────────────────────
    content = Column(Text, nullable=False)
    content_format = Column(String, nullable=False, default="plain_text")
    content_json = Column(JSONB, nullable=True)

    # ── Workflow context ──────────────────────────────────────────────
    written_at_status = Column(String, nullable=False)

    # ── Visibility + severity ─────────────────────────────────────────
    visibility = Column(String, nullable=False, default=VIS_LOA_PARTICIPANTS)
    severity = Column(String, nullable=False, default=SEVERITY_NOTE)

    # ── Resolution ────────────────────────────────────────────────────
    resolved = Column(Boolean, nullable=False, default=False)
    resolved_at = Column(DateTime, nullable=True)
    resolved_by = Column(String, nullable=True)

    # ── Timestamps ────────────────────────────────────────────────────
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    edited_at = Column(DateTime, nullable=True)
    deleted_at = Column(DateTime, nullable=True)

    # ── Metadata (migration provenance, future extensibility) ─────────
    metadata_ = Column("metadata", JSONB, nullable=False, default=dict)

    # ── Relationship ──────────────────────────────────────────────────
    loa = relationship("LOA", backref="comments")
    replies = relationship(
        "Comment",
        backref="parent",
        remote_side=[id],
        foreign_keys=[parent_comment_id],
    )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "loa_id": self.loa_id,
            "anchor_type": self.anchor_type,
            "field_key": self.field_key,
            "section": self.section,
            "anchor_x": self.anchor_x,
            "anchor_y": self.anchor_y,
            "parent_comment_id": self.parent_comment_id,
            "author_email": self.author_email,
            "author_name": self.author_name,
            "author_role": self.author_role,
            "content": self.content,
            "content_format": self.content_format,
            "written_at_status": self.written_at_status,
            "visibility": self.visibility,
            "severity": self.severity,
            "resolved": self.resolved,
            "resolved_at": self.resolved_at.isoformat() if self.resolved_at else None,
            "resolved_by": self.resolved_by,
            "created_at": self.created_at.isoformat(),
            "edited_at": self.edited_at.isoformat() if self.edited_at else None,
            "deleted_at": self.deleted_at.isoformat() if self.deleted_at else None,
            "metadata": self.metadata_ or {},
        }
