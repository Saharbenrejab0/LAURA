"""
backend/engines/excel.py
========================
LAURA — Consolidated LOA Excel generation engine.

Produces the working Excel that Thibault & Vanessa rely on: a single
navy-headed, filterable table with one row per LOA, live SUM / Avg formulas,
and a Summary sheet for the spend-by-activity / spend-by-brand slide.

DESIGN PRINCIPLES
-----------------
1. PURE ENGINE — no DB, no request, no session. Renders whatever rows it
   receives. Scope/permission filtering happens in the API layer.
2. LIVE FORMULAS — FY total = SUM(quarters), Avg/Door = IFERROR(FY/Doors,""),
   PPT Required = IF(FY>50000,"YES","NO"). Never hardcoded.
3. SECURE — user text neutralised against formula injection.
4. FAITHFUL COLUMN ORDER — matches the 2.5-year-old Excel format.

PUBLIC API
----------
    build_workbook(rows, ...)        -> openpyxl.Workbook
    export_excel_bytes(rows, ...)    -> bytes   (ready to stream / upload)
    export_single_loa_row(row)       -> bytes   (detail page "↓ Excel" button)
    loa_to_row(loa)                  -> LoaRow  (SQLAlchemy LOA -> DTO)
    loas_to_rows(loas)               -> list[LoaRow]
    safe_filename(name)              -> str     (Content-Disposition safe)
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from io import BytesIO
from typing import Any, Iterable

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.worksheet import Worksheet

__all__ = [
    "LoaRow",
    "build_workbook",
    "export_excel_bytes",
    "export_single_loa_row",
    "loa_to_row",
    "loas_to_rows",
    "safe_filename",
]

# --------------------------------------------------------------------------- #
# Brand palette & format constants                                            #
# --------------------------------------------------------------------------- #
NAVY = "2C3E5D"
WHITE = "FFFFFF"
ROW_FILL_A = "FFFFFF"
ROW_FILL_B = "F6F5F2"
GRID = "E3E3DE"
TEXT = "1F2933"
MUTED = "6B7280"

HEADER_FONT_NAME = "Calibri"
BODY_FONT_NAME = "Calibri"

MONEY_FMT = "#,##0;(#,##0);-"
AVG_FMT = "#,##0;(#,##0);-"
INT_FMT = "#,##0;(#,##0);-"
PERCENT_FMT = "0%"

PPT_THRESHOLD = 50_000

LONG_TEXT_HEADERS = {"Detail", "Description", "Tools", "KPI",
                     "Cost Drill Down", "Event Purpose"}
LONG_TEXT_WIDTH = 42
MAX_AUTO_WIDTH = 48
MIN_AUTO_WIDTH = 10

# --------------------------------------------------------------------------- #
# Fixed quarter columns (matches backend/models/loa.py)                       #
# --------------------------------------------------------------------------- #
QUARTER_COLUMNS = [
    ("Q4-25", "q4_2025"),
    ("Q1-26", "q1_2026"),
    ("Q2-26", "q2_2026"),
    ("Q3-26", "q3_2026"),
    ("Q4-26", "q4_2026"),
]
QUARTER_LABELS = [label for label, _ in QUARTER_COLUMNS]
FY_LABEL = "FY-26 Total"


# --------------------------------------------------------------------------- #
# Render-ready DTO                                                            #
# --------------------------------------------------------------------------- #
@dataclass
class LoaRow:
    """Flat, render-ready representation of one LOA."""

    cluster: str = ""
    country: str = ""
    legal_entity: str = ""
    activity_type: str = ""
    category: str = ""
    brand: str = ""
    cot: str = ""
    customer: str = ""
    vendor: str = ""
    detail: str = ""

    doors: int | None = None
    customers: int | None = None
    currency: str = ""

    quarters: dict[str, float] = field(default_factory=dict)

    description: str = ""
    tools: str = ""
    kpi: str = ""
    cost_drill_down: str = ""
    start_date: str = ""
    end_date: str = ""
    capex_opex: str = ""
    adv_selling: str = ""
    sap_event_code: str = ""
    event_type: str = ""
    event_purpose: str = ""

    cost_split_lenses: float | None = None
    cost_split_frames: float | None = None

    forecast_lenses_sales: float | None = None
    forecast_frames_sales: float | None = None
    forecast_instruments_sales: float | None = None

    loa_number: str = ""
    requestor_email: str = ""
    finance_validator_email: str = ""

    def fy_total(self) -> float:
        return sum(v for v in self.quarters.values() if v is not None)


# --------------------------------------------------------------------------- #
# Static column layout                                                        #
# --------------------------------------------------------------------------- #
_BEFORE_QUARTERS = [
    "Cluster", "Country", "Legal Entity", "Type/Planning 2.0", "Category",
    "Brand", "COT", "Customer", "Vendor", "Detail", "# Doors", "# Customers",
    "Avg Investment/Door", "Currency",
]
_AFTER_QUARTERS = [
    "Description", "Tools", "KPI", "Cost Drill Down", "Start Date", "End Date",
    "CapEx/OpEx", "ADV/Selling", "SAP Event Code", "Event Type", "Event Purpose",
    "Cost Split Lenses %", "Cost Split Frames %", "Forecasted Lenses Sales",
    "Forecasted Frames Sales", "Forecasted Instruments Sales", "PPT Required",
    "LOA Number", "Requestor Email", "Finance Validator Email",
]

HEADERS = _BEFORE_QUARTERS + QUARTER_LABELS + [FY_LABEL] + _AFTER_QUARTERS

N_BEFORE = len(_BEFORE_QUARTERS)            # 14
Q_START = N_BEFORE + 1                      # 15
Q_END = N_BEFORE + len(QUARTER_LABELS)      # 19
FY_COL = Q_END + 1                          # 20
AFTER_START = FY_COL + 1                    # 21
DOORS_COL = _BEFORE_QUARTERS.index("# Doors") + 1              # 11
AVG_COL = _BEFORE_QUARTERS.index("Avg Investment/Door") + 1    # 13
CURRENCY_COL = _BEFORE_QUARTERS.index("Currency") + 1          # 14
PPT_COL = AFTER_START + _AFTER_QUARTERS.index("PPT Required")  # 37
LAST_COL = len(HEADERS)                                        # 39
LONG_COLS = {i for i, h in enumerate(HEADERS, start=1) if h in LONG_TEXT_HEADERS}


# --------------------------------------------------------------------------- #
# Security helpers                                                            #
# --------------------------------------------------------------------------- #
_RISKY_LEADING = set("=+-@\t\r\n")


def _sanitize_text(value: Any) -> str:
    s = "" if value is None else str(value)
    if s and s[0] in _RISKY_LEADING:
        return "'" + s
    return s


def _num(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _int(value: Any) -> int | None:
    if value is None or value == "":
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def safe_filename(name: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "_", (name or "").strip())
    cleaned = cleaned.strip("._") or "export"
    return cleaned[:120]


def _safe_sheet_title(name: str) -> str:
    cleaned = re.sub(r"[\[\]:\*\?/\\]", " ", name or "Sheet").strip() or "Sheet"
    return cleaned[:31]


# --------------------------------------------------------------------------- #
# Reusable styles                                                             #
# --------------------------------------------------------------------------- #
_SIDE = Side(style="thin", color=GRID)
_BORDER = Border(left=_SIDE, right=_SIDE, top=_SIDE, bottom=_SIDE)
_HEADER_FILL = PatternFill("solid", fgColor=NAVY)
_HEADER_FONT = Font(name=HEADER_FONT_NAME, size=10, bold=True, color=WHITE)
_HEADER_ALIGN = Alignment(horizontal="center", vertical="center", wrap_text=True)


def _body_font() -> Font:
    return Font(name=BODY_FONT_NAME, size=10, color=TEXT)


# --------------------------------------------------------------------------- #
# Cell writing                                                                #
# --------------------------------------------------------------------------- #
def _put(ws: Worksheet, row: int, col: int, value: Any, *,
         fmt: str | None = None, align: str = "left",
         text: bool = False, wrap: bool = False):
    cell = ws.cell(row=row, column=col)
    cell.value = _sanitize_text(value) if text else value
    if fmt:
        cell.number_format = fmt
    cell.alignment = Alignment(horizontal=align, vertical="center", wrap_text=wrap)
    cell.font = _body_font()
    return cell


def _style_row(ws: Worksheet, row: int, fill_hex: str) -> None:
    fill = PatternFill("solid", fgColor=fill_hex)
    for col in range(1, LAST_COL + 1):
        cell = ws.cell(row=row, column=col)
        cell.fill = fill
        cell.border = _BORDER


def _write_header(ws: Worksheet) -> None:
    for col, header in enumerate(HEADERS, start=1):
        cell = ws.cell(row=1, column=col, value=header)
        cell.fill = _HEADER_FILL
        cell.font = _HEADER_FONT
        cell.alignment = _HEADER_ALIGN
        cell.border = _BORDER
    ws.row_dimensions[1].height = 30


def _write_data_row(ws: Worksheet, row: int, data: LoaRow) -> None:
    fy_ref = f"{get_column_letter(FY_COL)}{row}"

    # Identity
    _put(ws, row, 1, data.cluster, text=True)
    _put(ws, row, 2, data.country, text=True)
    _put(ws, row, 3, data.legal_entity, text=True)
    _put(ws, row, 4, data.activity_type, text=True)
    _put(ws, row, 5, data.category, text=True)
    _put(ws, row, 6, data.brand, text=True)
    _put(ws, row, 7, data.cot, text=True)
    _put(ws, row, 8, data.customer, text=True)
    _put(ws, row, 9, data.vendor, text=True)
    _put(ws, row, 10, data.detail, text=True, wrap=True)

    # Counts
    if data.doors is not None:
        _put(ws, row, DOORS_COL, data.doors, fmt=INT_FMT, align="right")
    if data.customers is not None:
        _put(ws, row, 12, data.customers, fmt=INT_FMT, align="right")

    # Avg Investment/Door = FY / Doors (IFERROR guards 0-doors)
    doors_ref = f"{get_column_letter(DOORS_COL)}{row}"
    _put(ws, row, AVG_COL, f'=IFERROR({fy_ref}/{doors_ref},"")',
         fmt=AVG_FMT, align="right")

    # Currency
    _put(ws, row, CURRENCY_COL, data.currency, text=True)

    # Quarter cells
    for offset, label in enumerate(QUARTER_LABELS):
        amount = data.quarters.get(label)
        if amount is not None and amount != 0:
            _put(ws, row, Q_START + offset, amount, fmt=MONEY_FMT, align="right")

    # FY total formula
    q_range = f"{get_column_letter(Q_START)}{row}:{get_column_letter(Q_END)}{row}"
    _put(ws, row, FY_COL, f"=SUM({q_range})", fmt=MONEY_FMT, align="right")

    # After-quarter columns
    a = AFTER_START
    _put(ws, row, a + 0, data.description, text=True, wrap=True)
    _put(ws, row, a + 1, data.tools, text=True, wrap=True)
    _put(ws, row, a + 2, data.kpi, text=True, wrap=True)
    _put(ws, row, a + 3, data.cost_drill_down, text=True, wrap=True)
    if data.start_date:
        _put(ws, row, a + 4, data.start_date, text=True, align="right")
    if data.end_date:
        _put(ws, row, a + 5, data.end_date, text=True, align="right")
    _put(ws, row, a + 6, data.capex_opex, text=True)
    _put(ws, row, a + 7, data.adv_selling, text=True)
    _put(ws, row, a + 8, data.sap_event_code, text=True)
    _put(ws, row, a + 9, data.event_type, text=True)
    _put(ws, row, a + 10, data.event_purpose, text=True, wrap=True)
    if data.cost_split_lenses is not None:
        _put(ws, row, a + 11, data.cost_split_lenses, fmt=PERCENT_FMT, align="right")
    if data.cost_split_frames is not None:
        _put(ws, row, a + 12, data.cost_split_frames, fmt=PERCENT_FMT, align="right")
    if data.forecast_lenses_sales is not None:
        _put(ws, row, a + 13, data.forecast_lenses_sales, fmt=MONEY_FMT, align="right")
    if data.forecast_frames_sales is not None:
        _put(ws, row, a + 14, data.forecast_frames_sales, fmt=MONEY_FMT, align="right")
    if data.forecast_instruments_sales is not None:
        _put(ws, row, a + 15, data.forecast_instruments_sales, fmt=MONEY_FMT, align="right")

    # PPT Required (live formula)
    _put(ws, row, PPT_COL, f'=IF({fy_ref}>{PPT_THRESHOLD},"YES","NO")', align="center")

    # References
    _put(ws, row, a + 17, data.loa_number, text=True)
    _put(ws, row, a + 18, data.requestor_email, text=True)
    _put(ws, row, a + 19, data.finance_validator_email, text=True)


# --------------------------------------------------------------------------- #
# Sheet assembly                                                              #
# --------------------------------------------------------------------------- #
def _autosize(ws: Worksheet) -> None:
    for col, header in enumerate(HEADERS, start=1):
        letter = get_column_letter(col)
        if col in LONG_COLS:
            ws.column_dimensions[letter].width = LONG_TEXT_WIDTH
            continue
        widest = len(str(header))
        for cell in ws[letter]:
            if cell.row == 1 or cell.value is None or cell.data_type == "f":
                continue
            widest = max(widest, len(str(cell.value)))
        ws.column_dimensions[letter].width = max(
            MIN_AUTO_WIDTH, min(widest + 2, MAX_AUTO_WIDTH)
        )


def _write_sheet(ws: Worksheet, rows: list[LoaRow]) -> None:
    _write_header(ws)

    for idx, data in enumerate(rows):
        excel_row = idx + 2
        fill = ROW_FILL_B if idx % 2 else ROW_FILL_A
        _write_data_row(ws, excel_row, data)
        _style_row(ws, excel_row, fill)

    last_row = max(len(rows) + 1, 1)
    ws.freeze_panes = "A2"
    ws.auto_filter.ref = f"A1:{get_column_letter(LAST_COL)}{last_row}"
    _autosize(ws)


# --------------------------------------------------------------------------- #
# Summary sheet                                                               #
# --------------------------------------------------------------------------- #
def _write_summary_block(ws: Worksheet, start_row: int, title: str,
                         pairs: list[tuple[str, float]], label_header: str) -> int:
    _put(ws, start_row, 1, title).font = Font(
        name=HEADER_FONT_NAME, size=11, bold=True, color=NAVY)

    head = start_row + 1
    for col, header in enumerate([label_header, "FY Total", "% of Total"], start=1):
        cell = ws.cell(row=head, column=col, value=header)
        cell.fill = _HEADER_FILL
        cell.font = _HEADER_FONT
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = _BORDER

    total = sum(v for _, v in pairs) or 0.0
    r = head + 1
    for label, value in pairs:
        _put(ws, r, 1, label, text=True)
        _put(ws, r, 2, value, fmt=MONEY_FMT, align="right")
        _put(ws, r, 3, (value / total) if total else 0.0, fmt=PERCENT_FMT, align="right")
        for c in range(1, 4):
            ws.cell(row=r, column=c).border = _BORDER
        r += 1

    _put(ws, r, 1, "Total").font = Font(
        name=BODY_FONT_NAME, size=10, bold=True, color=TEXT)
    tc = _put(ws, r, 2, total, fmt=MONEY_FMT, align="right")
    tc.font = Font(name=BODY_FONT_NAME, size=10, bold=True, color=TEXT)
    for c in range(1, 4):
        ws.cell(row=r, column=c).border = _BORDER
    return r + 2


def _write_summary_sheet(wb: Workbook, rows: list[LoaRow]) -> None:
    by_activity: dict[str, float] = {}
    by_brand: dict[str, float] = {}
    for r in rows:
        by_activity[r.activity_type or "—"] = by_activity.get(r.activity_type or "—", 0.0) + r.fy_total()
        by_brand[r.brand or "—"] = by_brand.get(r.brand or "—", 0.0) + r.fy_total()

    activity = sorted(by_activity.items(), key=lambda kv: kv[1], reverse=True)
    brand = sorted(by_brand.items(), key=lambda kv: kv[1], reverse=True)

    ws = wb.create_sheet(_safe_sheet_title("Summary"))
    note = ws.cell(row=1, column=1,
                   value="Summary — snapshot computed at export. Regenerate to refresh.")
    note.font = Font(name=BODY_FONT_NAME, size=9, italic=True, color=MUTED)

    next_row = _write_summary_block(ws, 3, "Spend by Activity Type",
                                    activity, "Type/Planning 2.0")
    _write_summary_block(ws, next_row, "Spend by Brand", brand, "Brand")

    ws.column_dimensions["A"].width = 34
    ws.column_dimensions["B"].width = 16
    ws.column_dimensions["C"].width = 12


# --------------------------------------------------------------------------- #
# Public builders                                                             #
# --------------------------------------------------------------------------- #
def build_workbook(rows: Iterable[LoaRow], *, title: str = "LOA Export",
                   split_by_cluster: bool = False,
                   include_summary: bool = True) -> Workbook:
    rows = list(rows)
    wb = Workbook()
    wb.remove(wb.active)

    if split_by_cluster:
        groups: dict[str, list[LoaRow]] = {}
        for r in rows:
            groups.setdefault(r.cluster or "Unassigned", []).append(r)
        for cluster_name in sorted(groups):
            ws = wb.create_sheet(_safe_sheet_title(cluster_name))
            _write_sheet(ws, groups[cluster_name])
    else:
        ws = wb.create_sheet(_safe_sheet_title(title))
        _write_sheet(ws, rows)

    if include_summary and rows:
        _write_summary_sheet(wb, rows)

    return wb


def export_excel_bytes(rows: Iterable[LoaRow], **options: Any) -> bytes:
    wb = build_workbook(rows, **options)
    buffer = BytesIO()
    wb.save(buffer)
    return buffer.getvalue()


def export_single_loa_row(row: LoaRow) -> bytes:
    return export_excel_bytes([row], title=row.loa_number or "LOA",
                              include_summary=False)


# --------------------------------------------------------------------------- #
# SQLAlchemy LOA -> DTO adapter                                               #
# Coupled to backend/models/loa.py — update field names here if model changes #
# --------------------------------------------------------------------------- #
def _extract_quarters(loa: Any) -> dict[str, float]:
    out: dict[str, float] = {}
    for label, attr in QUARTER_COLUMNS:
        val = _num(getattr(loa, attr, None))
        if val is not None and val != 0:
            out[label] = val
    return out


def loa_to_row(loa: Any, line: Any = None) -> LoaRow:
    """
    Flatten one LOA to a spreadsheet row.

    When `line` is given (a loa_line of a multi-brand / multi-activity LOA), the
    per-row fields come from the line and everything shared still comes from the
    parent — so each line lands as its own row in the CFO spreadsheet.
    """
    def s(attr: str) -> str:
        v = getattr(loa, attr, None)
        return _sanitize_text(v) if v else ""

    def ls(attr: str) -> str:
        """Line value, falling back to the parent's."""
        v = getattr(line, attr, None) if line is not None else None
        if v in (None, ""):
            v = getattr(loa, attr, None)
        return _sanitize_text(v) if v else ""

    cat = getattr(loa, "category", None)
    if isinstance(cat, list):
        cat_str = ", ".join(str(c) for c in cat if c)
    else:
        cat_str = _sanitize_text(cat) if cat else ""

    budget_src = line if line is not None else loa

    return LoaRow(
        cluster=s("cluster"),
        country=s("country"),
        legal_entity=s("legal_entity"),
        activity_type=ls("activity_type"),
        category=cat_str,
        brand=ls("brand"),
        cot=s("cot"),
        customer=ls("customer"),
        vendor=ls("vendor"),
        detail=ls("detail"),
        doors=_int(getattr(budget_src, "num_doors", None)),
        customers=_int(getattr(loa, "num_customers", None)),
        currency=s("currency"),
        quarters=_extract_quarters(budget_src),
        description=s("description"),
        tools=s("tools"),
        kpi=s("kpi"),
        cost_drill_down=ls("cost_drill_down"),
        start_date=s("start_date"),
        end_date=s("end_date"),
        capex_opex=s("capex_opex"),
        adv_selling=s("adv_selling"),
        sap_event_code=s("sap_event_code"),
        event_type=s("event_type"),
        event_purpose=s("event_purpose"),
        cost_split_lenses=_num(getattr(loa, "cost_split_lenses", None)),
        cost_split_frames=_num(getattr(loa, "cost_split_frames", None)),
        forecast_lenses_sales=_num(getattr(loa, "forecasted_lenses_sales", None)),
        forecast_frames_sales=_num(getattr(loa, "forecasted_frames_sales", None)),
        forecast_instruments_sales=_num(getattr(loa, "forecasted_instruments_sales", None)),
        loa_number=s("loa_number"),
        requestor_email=s("requestor_email"),
        finance_validator_email=s("finance_validator_email"),
    )


def loas_to_rows(loas: Iterable[Any]) -> list[LoaRow]:
    """
    Flatten LOAs to spreadsheet rows.

    A standard LOA is one row. A multi-brand / multi-activity LOA expands to one
    row per line, which is exactly how the client's spreadsheets represent them.
    """
    rows: list[LoaRow] = []
    for loa in loas:
        lines = getattr(loa, "lines", None) or []
        if lines and getattr(loa, "loa_type", "standard") != "standard":
            rows.extend(loa_to_row(loa, line) for line in lines)
        else:
            rows.append(loa_to_row(loa))
    return rows
