"""
LAURA — LOA database model
Maps every field confirmed in Field Connections v4.0 + Dropdown Data Reference v1.0
Sources: discovery meetings with Vanessa Stöecklein & Thibault de Bodman
"""

from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, Text, Enum
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.sql import func
import uuid
import enum

from backend.models.database import Base


# ── Enums ─────────────────────────────────────────────────────────────────────

# ── APRÈS — workflow client 8 statuts ──────────────────────────────────
# Single source of truth, aligné sur backend/api/loa.py WORKFLOW_TRANSITIONS
# et frontend/src/types/loa.ts LOAStatus.
class LOAStatus(str, enum.Enum):
    DRAFT                   = "draft"                    # author creates the LOA
    EMEA_REVIEW             = "emea_review"              # EMEA PS reviews XLS & PPT
    GLOBAL_REVIEW           = "global_review"            # Global Brands pre-validate (comment)
    CMO_CFO_REVIEW          = "cmo_cfo_review"           # Alexandra OR Giulia validates
    GLOBAL_FUNCTIONS_REVIEW = "global_functions_review"  # PR/Medical/Trade comment, EMEA PS advances
    CORPORATE_REVIEW        = "corporate_review"         # Paola + Diana — final gate
    APPROVED                = "approved"                 # terminal ✓ — Teams notif fires here
    REJECTED                = "rejected"                 # terminal ✗ — back to author via /submit


class ActivityType(str, enum.Enum):
    TM_SEASONAL      = "Tailor Made Seasonal"
    TM_PERMANENT     = "Tailor Made Permanent"
    COOP_ADV         = "Coop Advertising"
    E_TOOLS          = "e-Tools"
    IN_STORE         = "In Store / Consumer Activation"
    SPONSORSHIP      = "Sponsorship"
    TRADE_INCENTIVE  = "Trade Incentive"
    TRAINING         = "Training"
    PR               = "PR"
    CATALOGUES       = "Catalogues & Brochures"
    MEDICAL          = "Medical Affairs"
    EVENTS           = "Events"
    OTHER_ADV        = "Other ADV Expenses"
    OTHERS_NON_ADV   = "Others (non ADV)"


class EventType(str, enum.Enum):
    ROADSHOW          = "Roadshow"
    SHOWROOM          = "Showroom"
    SALES_CONVENTION  = "Sales Convention"
    TRADE_FAIRS       = "Trade Fairs"
    MEDICAL_SYMPOSIUM = "Medical Symposium"
    CLIENT_AWARD      = "Client Award Travel"
    TORTONA           = "Tortona EL Days"


class EventPurpose(str, enum.Enum):
    TRANSACTIONAL  = "Transactional"
    INSPIRATIONAL  = "Inspirational"
    INFLUENTIAL    = "Influential"
    RELATIONAL     = "Relational"


class CategoryType(str, enum.Enum):
    FRAMES      = "Frames"
    LENSES      = "Lenses"
    WEARABLES   = "Wearables"
    AUDIO       = "Audio"
    INSTRUMENTS = "Instruments"
    ALL_CAT     = "All cat."


class ClusterType(str, enum.Enum):
    NORTH  = "NORTH"
    FRANCE = "FRANCE"
    META   = "META"
    EAST   = "EAST"
    ITALY  = "ITALY"
    DACH   = "DACH"
    IBERIA = "IBERIA"
    RUSSIA = "RUSSIA"
    EMEA   = "EMEA"


class COTType(str, enum.Enum):
    CHAINS         = "Chains"
    BUYING_GROUPS  = "Buying Groups"
    INDEPENDENTS   = "Independents"
    E_WHOLESALE    = "E-Wholesale"
    SPORT          = "Sport channel"
    TRAVEL_RETAIL  = "Travel Retail"
    DISTR_EXPORT   = "Distr. & Export"
    OTHERS         = "Others"
    ALL_COT        = "All COT"


class CapExOpEx(str, enum.Enum):
    CAPEX = "CapEx"
    OPEX  = "OpEx"


class ADVSelling(str, enum.Enum):
    ADV     = "ADV"
    SELLING = "Selling"
    OTHERS  = "Others"


# ── Model ─────────────────────────────────────────────────────────────────────

class LOA(Base):
    __tablename__ = "loas"

    # ── Identity ──────────────────────────────────────────────────────────────
    id             = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    loa_number     = Column(String(50),  nullable=True)   # From SAP / external Lens site
    loa_draft_id   = Column(String(50),  unique=True)     # Internal placeholder until real # assigned
    requestor_email = Column(String(255), nullable=False)

    # ── Geographic cascade (Cluster → Country → Legal Entity) ─────────────────
    # Cluster: 9 confirmed options — confirmed NORTH/FRANCE/META/EAST/ITALY/DACH/IBERIA/RUSSIA/EMEA
    cluster      = Column(String(50),  nullable=False)
    # Country: 30 confirmed options, cascades from Cluster
    country      = Column(String(100), nullable=False)
    # Legal Entity: cascades from Country. Official list missing — stored as free text for now.
    # Finance/Thibault must provide the official list before we can make this a dropdown.
    legal_entity = Column(String(150), nullable=True)

    # ── Product cascade (Category → Brand) ────────────────────────────────────
    # Category: 6 confirmed options — Frames/Lenses/Wearables/Audio/Instruments/All cat.
    # Category — MULTI-SELECT (e.g. Frames + Lenses on the same LOA).
    # Stored as PostgreSQL ARRAY. Validation against reference_data.CATEGORIES.
    category = Column(ARRAY(String), nullable=False)
    # Brand: cascades from Category. Ray-Ban ≠ Ray-Ban Meta (separate entries, confirmed Vanessa Mtg 2)
    brand    = Column(String(200), nullable=False)

    # LOA # — Lens team only, hidden when Category = Frames.
    # Vanessa wants to abolish entirely; keeping optional pending Finance decision.
    # loa_number field above serves this purpose.

    # ── Activity classification ────────────────────────────────────────────────
    # Activity Type: the MASTER field — drives show/hide of every conditional field
    # 14 options confirmed. Usage from 1,320 real LOAs embedded in comment below.
    # TM Seasonal (419) · Events (177) · Consumer Activation (174) · TM Permanent (130)
    # Coop ADV (129) · Other ADV (53) · Trade Incentive (50) · Training (45) · PR (41)
    # Sponsorship (38) · Catalogues (27) · Medical Affairs (7) · Others non ADV (5) · e-Tools (4)
    activity_type = Column(String(50), nullable=False)

    # ── Conditional fields — Events & Medical Affairs only ────────────────────
    # Show when activity_type IN (Events, Medical Affairs) — confirmed Vanessa Mtg 1
    # event_type: 7 options — Roadshow/Showroom/Sales Convention/Trade Fairs/
    #             Medical Symposium/Client Award Travel/Tortona EL Days
    event_type    = Column(String(100), nullable=True)
    # event_purpose: 4 options — Transactional/Inspirational/Influential/Relational
    event_purpose = Column(String(100), nullable=True)
    # SAP Event Code — created in SAP first, then typed here manually
    # Shown only when activity = Events or Medical Affairs
    sap_event_code = Column(String(100), nullable=True)

    # ── Conditional fields — Events only ──────────────────────────────────────
    # Cost split: both must sum to exactly 1.0 — BLOCKING validation
    # Real historical example: 0.1406 + 0.8594 = 1.0
    cost_split_lenses = Column(Float, nullable=True)   # e.g. 0.30
    cost_split_frames = Column(Float, nullable=True)   # e.g. 0.70

    # Forecasted sales — justifies commercial return to approver
    # Mandatory when activity = Events (full rules pending Sandrine confirmation)
    forecasted_lenses_sales     = Column(Float, nullable=True)   # units
    forecasted_frames_sales     = Column(Float, nullable=True)   # units
    forecasted_instruments_sales = Column(Float, nullable=True)  # units (€)

    # ── Financial classification ───────────────────────────────────────────────
    # CapEx: normally only Tailor Made Permanent (63% CapEx). Warning if CapEx + non-Permanent.
    # 82 of 85 CapEx rows in history are Tailor Made Permanent.
    capex_opex  = Column(String(10), default="OpEx")   # CapEx / OpEx
    adv_selling = Column(String(20), default="ADV")    # ADV / Selling / Others

    # COT — Channel of Trade. 9 options. Most common: All COT (730 of 1,320 rows)
    cot = Column(String(100), nullable=False)

    # ── Investment detail ──────────────────────────────────────────────────────
    # DETAIL = answers HOW the money will be spent (= Tools in PPT)
    # Required. Claude validates this answers HOW not WHAT.
    detail   = Column(Text, nullable=True)
    # DESCRIPTION = answers WHY — the business objective. One clear sentence.
    # Bad: "Support Hans Anders with brand campaigns"
    # Good: "Drive Ray-Ban growth within Hans Anders via on and offline campaigns"
    # Claude AI validates and suggests corrected version if it reads as a WHAT.
    description = Column(Text, nullable=True)

    # Customer — free text (too many customers to dropdown)
    customer = Column(String(200), nullable=True)
    # Vendor — free text. Coop Advertising exception: vendor IS the customer.
    vendor   = Column(String(300), nullable=True)

    # Currency — default EUR. CHF appears in 7 Swiss rows.
    currency = Column(String(5), default="EUR")

    # # Customers — accounts/companies (≠ doors = physical stores)
    # Example: 2 retail chains (customers) with 200 stores (doors)
    num_customers = Column(Integer, nullable=True)

    # # Doors — TOTAL physical store locations for the WHOLE activation.
    # CRITICAL: one total across all brands — same store can carry multiple brands.
    # Hidden when activity = Sponsorship (confirmed Vanessa Mtg 2)
    # Required (★) for: TM Permanent (100%) · TM Seasonal (99%) · Coop ADV (98%)
    #                   Trade Incentive (92%) · Catalogues (93%)
    # Optional (○) for: Consumer Activation (87%) · Events (92%) · Training (82%)
    # Hidden (—) for: Sponsorship
    num_doors = Column(Integer, nullable=True)

    # ── Financials — user inputs quarterly values ──────────────────────────────
    q4_2025 = Column(Float, default=0.0)
    q1_2026 = Column(Float, default=0.0)
    q2_2026 = Column(Float, default=0.0)
    q3_2026 = Column(Float, default=0.0)
    q4_2026 = Column(Float, default=0.0)

    # ── Financials — auto-calculated, NEVER editable by user ──────────────────
    fy_2025_total          = Column(Float, default=0.0)   # Auto: q4_2025 only
    fy_2026_total          = Column(Float, default=0.0)   # Auto: q1+q2+q3+q4 2026
    avg_investment_per_door = Column(Float, nullable=True) # Auto: fy_2026_total / num_doors
    # PPT SLIDE: YES if FY Total > €50,000. Applies to TOTAL LOA — not per brand line.
    # A LOA with 3 brands totalling €80K gets YES even if each brand line is under €50K.
    ppt_slide_required     = Column(Boolean, default=False)

    # % supported by Central/Regional Budget — optional, Finance to confirm if still needed
    pct_central_budget = Column(Float, nullable=True)   # e.g. 0.30 = 30%

    # ── PPT content (filled by user, validated/suggested by Claude) ───────────
    # ── Sprint 4 #34: mandatory cost justification when FY-26 > 100K€ ────
    cost_justification = Column(Text, nullable=True)
    tools          = Column(Text, nullable=True)    # The HOW (= DETAIL field in PPT)
    kpi            = Column(Text, nullable=True)    # Required for all types except Others
    cost_drill_down = Column(Text, nullable=True)   # Investment breakdown for PPT
    timing         = Column(String(200), nullable=True)

    # ── Dates ─────────────────────────────────────────────────────────────────
    # Start date: critical for Finance P&L quarterisation (Thibault)
    # Marks when SPEND hits P&L — not necessarily when event happens
    start_date = Column(String(50), nullable=True)
    # End date: Required for all types EXCEPT Tailor Made Permanent (hidden)
    # Permanent convention: 01/01 → 31/12 stored in system
    end_date   = Column(String(50), nullable=True)

    # ── Approval workflow ──────────────────────────────────────────────────────
    status               = Column(String(20), default="draft")
    brand_review_deadline = Column(DateTime, nullable=True)  # 5-day window
    cmo_comment          = Column(Text, nullable=True)
    rejection_reason     = Column(Text, nullable=True)

    # Finance Validator — new field 2026. Thibault to confirm if always same person
    # or varies by cluster/country. Only confirmed example: Simona.Smacchia@ae.luxottica.com
    finance_validator_email = Column(String(255), nullable=True)

    # ── AI audit (EL security requirement CTRL-747) ────────────────────────────
    ai_suggestion_used   = Column(Boolean, default=False)
    ai_suggestion_log_id = Column(String(100), nullable=True)  # Links to logs/

    # ── Metadata ───────────────────────────────────────────────────────────────
    # ── Demo mode flag ──────────────────────────────────────────────
    # When True, this LOA was created via the LAURA form (visible in
    # tracker by default). When False, this is a historical/imported
    # LOA (hidden behind the "Show historical" toggle).
    # The 1330 historical LOAs from the ETL all have is_demo=False.
    is_demo = Column(Boolean, nullable=False, server_default='false', default=False, index=True)
    # Sprint 2.5: edit-lock flag, settable only by super-admin.
    # When true, all edits are blocked regardless of workflow status.
    # When unlocked, the LOA resumes its normal workflow at its current status.
    is_locked = Column(Boolean, nullable=False, server_default='false', default=False)
    created_at   = Column(DateTime, server_default=func.now())
    updated_at   = Column(DateTime, server_default=func.now(), onupdate=func.now())
    submitted_at = Column(DateTime, nullable=True)
    approved_at  = Column(DateTime, nullable=True)
    cmo_approved = Column(Boolean, default=False)
    cfo_approved = Column(Boolean, default=False)
    # ── Business rules (enforced server-side, never trusted from frontend) ─────

     # Near q4_2025, q1_2026, etc.
    q1_2025 = Column(Float, nullable=True)
    q2_2025 = Column(Float, nullable=True)
    q3_2025 = Column(Float, nullable=True)
    q4_2024 = Column(Float, nullable=True)
    fy_2024_total = Column(Float, nullable=True)
    h2_2025 = Column(Float, nullable=True)

    # Metadata
    prioritization = Column(String(50), nullable=True)
    source_file = Column(String(255), nullable=True)

    # RAG
    embedding_text = Column(Text, nullable=True)
    embedded_at = Column(DateTime, nullable=True)
    # embedding vector(1024) — handled by raw SQL in migration, not in ORM

    def calculate_totals(self):
        """
        Call whenever quarterly values change.
        Never let frontend calculate — people override formulas in Excel.
        """
        self.fy_2025_total = self.q4_2025 or 0.0
        self.fy_2026_total = sum([
            self.q1_2026 or 0,
            self.q2_2026 or 0,
            self.q3_2026 or 0,
            self.q4_2026 or 0,
        ])
        if self.num_doors and self.num_doors > 0:
            self.avg_investment_per_door = round(self.fy_2026_total / self.num_doors, 2)
        else:
            self.avg_investment_per_door = None
        # PPT SLIDE — YES if FY Total > €50,000
        self.ppt_slide_required = self.fy_2026_total > 50_000

    def validate(self) -> list[dict]:
        """
        Run all business validation rules.
        Returns list of errors (blocking) and warnings (non-blocking).

        Each item: {"type": "error"|"warning", "field": str, "message": str}
        """
        issues = []

        # ── Blocking errors ────────────────────────────────────────────────
        # Cost split must sum to 1.0 for Events
        if self.activity_type == "Events":
            lenses = self.cost_split_lenses or 0
            frames = self.cost_split_frames or 0
            total  = round(lenses + frames, 4)
            if lenses > 0 or frames > 0:
                if abs(total - 1.0) > 0.001:
                    issues.append({
                        "type":    "error",
                        "field":   "cost_split",
                        "message": f"Cost split Lenses ({lenses}) + Frames ({frames}) = {total} — must equal exactly 1.0.",
                    })

        # Required fields — always
        required_always = {
            "cluster":       "Cluster is required.",
            "country":       "Country is required.",
            "legal_entity":  "Legal Entity is required.",
            "activity_type": "Activity Type is required.",
            "category":      "Category is required.",
            "brand":         "Brand is required.",
            "cot":           "Channel of Trade is required.",
            "requestor_email": "Requestor email is required.",
        }
        for field, msg in required_always.items():
            if not getattr(self, field, None):
                issues.append({"type": "error", "field": field, "message": msg})

        # Quarterly values — at least one must be > 0
        total_q = sum([
            self.q4_2025 or 0, self.q1_2026 or 0,
            self.q2_2026 or 0, self.q3_2026 or 0, self.q4_2026 or 0
        ])
        if total_q == 0:
            issues.append({
                "type":    "error",
                "field":   "financials",
                "message": "At least one quarterly value must be greater than 0.",
            })

        # Description (WHY) required
        if not self.description:
            issues.append({
                "type":    "error",
                "field":   "description",
                "message": "Description (WHY) is required.",
            })

        # DETAIL (HOW) required
        if not self.detail:
            issues.append({
                "type":    "error",
                "field":   "detail",
                "message": "Detail / Tools (HOW) is required.",
            })

        # KPI required (except Others non ADV)
        if self.activity_type != "Others (non ADV)" and not self.kpi:
            issues.append({
                "type":    "error",
                "field":   "kpi",
                "message": "KPI is required.",
            })

        # Event TYPE + PURPOSE required when activity = Events or Medical Affairs
        if self.activity_type in ("Events", "Medical Affairs"):
            if not self.event_type:
                issues.append({
                    "type":    "error",
                    "field":   "event_type",
                    "message": "Event Type is required for Events and Medical Affairs.",
                })
            if not self.event_purpose:
                issues.append({
                    "type":    "error",
                    "field":   "event_purpose",
                    "message": "Event Purpose is required for Events and Medical Affairs.",
                })

        # Start date required
        if not self.start_date:
            issues.append({
                "type":    "error",
                "field":   "start_date",
                "message": "Start Date is required.",
            })

        # End date required (except Tailor Made Permanent)
        if self.activity_type != "Tailor Made Permanent" and not self.end_date:
            issues.append({
                "type":    "error",
                "field":   "end_date",
                "message": "End Date is required (except Tailor Made Permanent).",
            })

        # ── Warnings (non-blocking) ────────────────────────────────────────
        # CapEx + non-Permanent warning
        if self.capex_opex == "CapEx" and self.activity_type != "Tailor Made Permanent":
            issues.append({
                "type":    "warning",
                "field":   "capex_opex",
                "message": "Are you sure this is CapEx? CapEx is typically only for Tailor Made Permanent.",
            })

        # PPT slide info message
        if self.ppt_slide_required:
            issues.append({
                "type":    "info",
                "field":   "ppt_slide_required",
                "message": "This LOA exceeds €50,000 — a PPT slide will be automatically generated.",
            })

        return issues

    def is_valid(self) -> bool:
        """Returns True if there are no blocking errors."""
        return not any(i["type"] == "error" for i in self.validate())

    def __repr__(self):
        return f"<LOA {self.loa_draft_id} | {self.country} | {self.activity_type} | {self.status}>"