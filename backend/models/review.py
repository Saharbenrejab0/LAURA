"""
LAURA — Review system models
ReviewMode, ReviewVerdict, ReviewComment, ReviewSubmission, LOAPhoto, CycleTitleConfig,
LOAReviewStage (3-stage alignment chain before CMO/CFO)
"""
from sqlalchemy import Column, String, Boolean, DateTime, Text, ForeignKey, UniqueConstraint, JSON, Integer, Float
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid

from backend.models.database import Base

# Stage sequence (order is enforced server-side)
ALIGNMENT_STAGES = ("local_alignment", "global_function_review", "global_brand_review")


class ReviewMode(Base):
    """Maps a role name to its review UI mode (slideshow | board | list)."""
    __tablename__ = "review_mode"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    role_name  = Column(String(100), unique=True, nullable=False)  # e.g. "cmo", "cfo"
    mode       = Column(String(20), nullable=False, default="slideshow")  # slideshow|board|list
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    updated_by = Column(String(255), nullable=True)

    def __repr__(self):
        return f"<ReviewMode role={self.role_name} mode={self.mode}>"


class ReviewVerdict(Base):
    """Per-LOA approve/reject decision for one reviewer in one cycle."""
    __tablename__ = "review_verdict"
    __table_args__ = (
        UniqueConstraint("cycle_id", "loa_id", "reviewer_id", name="uq_verdict_cycle_loa_reviewer"),
    )

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cycle_id    = Column(UUID(as_uuid=True), ForeignKey("loa_cycle.id", ondelete="CASCADE"), nullable=False)
    loa_id      = Column(UUID(as_uuid=True), ForeignKey("loas.id", ondelete="CASCADE"), nullable=False)
    reviewer_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    decision    = Column(String(20), nullable=False)  # "approved" | "rejected"
    reason      = Column(Text, nullable=True)          # required when rejected
    created_at  = Column(DateTime, server_default=func.now())
    updated_at  = Column(DateTime, server_default=func.now(), onupdate=func.now())

    def __repr__(self):
        return f"<ReviewVerdict loa={self.loa_id} decision={self.decision}>"


class ReviewComment(Base):
    """Comment pinned to a slide (identified by slide_id) within a review cycle."""
    __tablename__ = "review_comment"

    id        = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cycle_id  = Column(UUID(as_uuid=True), ForeignKey("loa_cycle.id", ondelete="CASCADE"), nullable=False)
    slide_id  = Column(String(100), nullable=False)  # e.g. "loa-<uuid>" or "overview"
    author_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    text      = Column(Text, nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    anchor    = Column(String(200), nullable=True)   # e.g. "field:budget", "section:description"

    def __repr__(self):
        return f"<ReviewComment slide={self.slide_id} author={self.author_id}>"


class ReviewSubmission(Base):
    """Marks a reviewer's pass as final for a cycle. Read-only after this."""
    __tablename__ = "review_submission"
    __table_args__ = (
        UniqueConstraint("cycle_id", "reviewer_id", name="uq_submission_cycle_reviewer"),
    )

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cycle_id     = Column(UUID(as_uuid=True), ForeignKey("loa_cycle.id", ondelete="CASCADE"), nullable=False)
    reviewer_id  = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    submitted_at = Column(DateTime, server_default=func.now())
    summary      = Column(JSON, nullable=True)  # {approved: N, rejected: N, total: N}

    def __repr__(self):
        return f"<ReviewSubmission cycle={self.cycle_id} reviewer={self.reviewer_id}>"


class CycleCloseNotification(Base):
    """Audit record of the MS Teams announcement fired when a cycle closed.

    One row per close attempt, written whether or not the n8n webhook is
    configured — so a cycle closed while the integration was down is still
    traceable, and `webhook_delivered` says what actually happened.
    """
    __tablename__ = "cycle_close_notification"

    id                = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cycle_id          = Column(UUID(as_uuid=True), ForeignKey("loa_cycle.id", ondelete="CASCADE"), nullable=False)
    sent_at           = Column(DateTime, server_default=func.now())
    sent_by           = Column(String(255), nullable=True)   # actor email
    recipients        = Column(JSON, nullable=True)          # [{id, email, role}]
    results           = Column(JSON, nullable=True)          # counts + budget snapshot
    teams_message_id  = Column(String(255), nullable=True)   # from the Teams API response
    excel_file_path   = Column(String(500), nullable=True)
    webhook_delivered = Column(Boolean, default=False)
    webhook_error     = Column(Text, nullable=True)

    def __repr__(self):
        return f"<CycleCloseNotification cycle={self.cycle_id} delivered={self.webhook_delivered}>"


class LOAPhoto(Base):
    """Execution photos and background images for the CMO review slideshow."""
    __tablename__ = "loa_photo"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # loa_id is null for title / overview / lens photos
    loa_id      = Column(UUID(as_uuid=True), ForeignKey("loas.id", ondelete="CASCADE"), nullable=True)
    cycle_id    = Column(UUID(as_uuid=True), ForeignKey("loa_cycle.id", ondelete="CASCADE"), nullable=True)
    # category_slug is the category name, used for overview and lens photos
    category_slug = Column(String(100), nullable=True)
    # execution_1|execution_2|title_background|overview_1..4|lens_col_<uuid>
    photo_type  = Column(String(100), nullable=False)
    file_path   = Column(String(500), nullable=False)
    file_name   = Column(String(255), nullable=False)
    mime_type   = Column(String(100), nullable=False)
    uploaded_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    uploaded_at = Column(DateTime, server_default=func.now())
    width       = Column(Integer, nullable=True)
    height      = Column(Integer, nullable=True)
    # Crop / pan / zoom — persisted per photo (0.0–1.0; zoom ≥ 1.0)
    focal_x     = Column(Float, nullable=True, default=0.5)
    focal_y     = Column(Float, nullable=True, default=0.5)
    zoom        = Column(Float, nullable=True, default=1.0)

    def __repr__(self):
        return f"<LOAPhoto loa={self.loa_id} type={self.photo_type}>"


class CycleTitleConfig(Base):
    """Deck configuration for a CMO review cycle (one per cycle).

    Holds the title slide text/typography plus the two deck-wide choices the
    preparer makes in the Slide setup panel: the section divider background
    and, per category, which overview layout to render.
    """
    __tablename__ = "cycle_title_config"
    __table_args__ = (
        UniqueConstraint("cycle_id", name="uq_title_config_cycle"),
    )

    id                 = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cycle_id           = Column(UUID(as_uuid=True), ForeignKey("loa_cycle.id", ondelete="CASCADE"), nullable=False)
    title              = Column(String(500), nullable=True)
    subtitle           = Column(String(500), nullable=True)
    year               = Column(String(20), nullable=True)
    # "small" | "medium" | "large" — drives the S/M/L size ramp on the title slide
    title_font_size    = Column(String(20), nullable=True, default="medium")
    title_color        = Column(String(20), nullable=True, default="#FFFFFF")
    subtitle_font_size = Column(String(20), nullable=True, default="medium")
    subtitle_color     = Column(String(20), nullable=True, default="#FFFFFF")
    # "black" | "navy" | "light" — section divider background, deck-wide
    divider_style      = Column(String(20), nullable=True, default="black")
    # {category_name: "priorities"|"family"|"lens_overview"|"lens_investment"}
    overview_layouts   = Column(JSON, nullable=True, default=dict)
    # {category_name: {slideTitle?, overviewColumns: [...], investmentColumns: [...]}}
    lens_configs       = Column(JSON, nullable=True, default=dict)
    # {loa_id: 0|1|2} — photo count intent per LOA (drives the Slide setup panel radio)
    loa_photo_modes    = Column(JSON, nullable=True, default=dict)
    updated_at         = Column(DateTime, server_default=func.now(), onupdate=func.now())

    def __repr__(self):
        return f"<CycleTitleConfig cycle={self.cycle_id}>"


class LOAReviewStage(Base):
    """One row per (LOA, stage) in the 3-stage pre-CMO/CFO alignment chain.

    Stages must be approved in sequence:
      local_alignment → global_function_review → global_brand_review
    Once all three are 'approved', the LOA is eligible for CMO/CFO review.
    """
    __tablename__ = "loa_review_stage"
    __table_args__ = (
        UniqueConstraint("loa_id", "stage", name="uq_loa_review_stage"),
    )

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    loa_id      = Column(UUID(as_uuid=True), ForeignKey("loas.id", ondelete="CASCADE"), nullable=False)
    stage       = Column(String(50), nullable=False)   # ALIGNMENT_STAGES
    status      = Column(String(20), nullable=False, default="pending")  # pending | approved
    approved_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)

    def __repr__(self):
        return f"<LOAReviewStage loa={self.loa_id} stage={self.stage} status={self.status}>"
