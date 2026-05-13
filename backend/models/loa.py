"""
LAURA — LOA database model
Maps every Excel column to a typed, validated database field
"""

from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, Text, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
import enum

from backend.models.database import Base


class LOAStatus(str, enum.Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    BRAND_REVIEW = "brand_review"       # Global brands commenting (5-day window)
    CMO_REVIEW = "cmo_review"           # Regional CMO reviewing
    CFO_REVIEW = "cfo_review"           # CFO reviewing Excel
    APPROVED = "approved"
    REJECTED = "rejected"


class ActivityType(str, enum.Enum):
    TM_SEASONAL = "Tailor Made Seasonal"
    TM_PERMANENT = "Tailor Made Permanent"
    COOP_ADV = "Coop Advertising"
    IN_STORE = "In Store / Consumer Activation"
    EVENTS = "Events"
    TRADE_INCENTIVE = "Trade Incentive"
    SPONSORSHIP = "Sponsorship"
    CATALOGUES = "Catalogues & Brochures"
    OTHER_ADV = "Other ADV Expenses"
    MEDICAL = "Medical Affairs"
    TRAINING = "Training"


class LOA(Base):
    __tablename__ = "loas"

    # --- Identity ---
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    loa_number = Column(String(50), nullable=True)          # From external site (Lens) or SAP
    loa_draft_id = Column(String(50), unique=True)          # Internal placeholder until real # assigned
    requestor_email = Column(String(255), nullable=False)

    # --- Location (cascaded dropdowns) ---
    cluster = Column(String(50), nullable=False)
    country = Column(String(100), nullable=False)
    legal_entity = Column(String(150), nullable=True)

    # --- Activity classification ---
    activity_type = Column(Enum(ActivityType), nullable=False)
    event_type = Column(String(100), nullable=True)         # Only for Events
    event_purpose = Column(String(100), nullable=True)      # Only for Events
    cot = Column(String(100), nullable=False)               # Channel of trade
    category = Column(String(100), nullable=False)          # Frames / Lenses / etc
    brand = Column(String(200), nullable=False)

    # --- Financial classification ---
    capex_opex = Column(String(10), default="OpEx")
    adv_selling = Column(String(20), default="ADV")

    # --- Investment detail ---
    detail = Column(Text, nullable=True)                    # Free text description
    customer = Column(String(200), nullable=True)
    vendor = Column(String(300), nullable=True)
    currency = Column(String(5), default="EUR")
    num_customers = Column(Integer, nullable=True)
    num_doors = Column(Integer, nullable=True)

    # --- Financials (inputs — quarterly) ---
    q4_2025 = Column(Float, default=0.0)
    q1_2026 = Column(Float, default=0.0)
    q2_2026 = Column(Float, default=0.0)
    q3_2026 = Column(Float, default=0.0)
    q4_2026 = Column(Float, default=0.0)

    # --- Financials (calculated — never prompted) ---
    fy_2025_total = Column(Float, default=0.0)              # Auto: q4_2025 only
    fy_2026_total = Column(Float, default=0.0)              # Auto: sum q1-q4 2026
    avg_investment_per_door = Column(Float, nullable=True)  # Auto: fy_2026_total / num_doors
    ppt_slide_required = Column(Boolean, default=False)     # Auto: fy_2026_total > 50000

    # --- PPT content (filled by user or AI-suggested) ---
    description = Column(Text, nullable=True)               # The WHY (Vanessa rule)
    tools = Column(Text, nullable=True)                     # The HOW
    kpi = Column(Text, nullable=True)
    cost_drill_down = Column(Text, nullable=True)
    timing = Column(String(200), nullable=True)

    # --- Dates ---
    start_date = Column(String(50), nullable=True)
    end_date = Column(String(50), nullable=True)

    # --- Approval workflow ---
    status = Column(Enum(LOAStatus), default=LOAStatus.DRAFT)
    brand_review_deadline = Column(DateTime, nullable=True) # 5-day window
    cmo_comment = Column(Text, nullable=True)
    rejection_reason = Column(Text, nullable=True)

    # --- AI audit (EL security requirement CTRL-747) ---
    ai_suggestion_used = Column(Boolean, default=False)
    ai_suggestion_log_id = Column(String(100), nullable=True)  # Links to logs/

    # --- Metadata ---
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    submitted_at = Column(DateTime, nullable=True)
    approved_at = Column(DateTime, nullable=True)

    def calculate_totals(self):
        """Call this whenever quarterly values change. Never let frontend calculate."""
        self.fy_2025_total = self.q4_2025
        self.fy_2026_total = sum([
            self.q1_2026, self.q2_2026,
            self.q3_2026, self.q4_2026
        ])
        if self.num_doors and self.num_doors > 0:
            self.avg_investment_per_door = self.fy_2026_total / self.num_doors
        self.ppt_slide_required = self.fy_2026_total > 50000

    def __repr__(self):
        return f"<LOA {self.loa_draft_id} | {self.country} | {self.activity_type} | {self.status}>"
