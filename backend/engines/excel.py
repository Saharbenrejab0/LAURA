"""
LAURA — Excel engine
Generates the EssilorLuxottica LOA Excel file from a LOA object.
Uses openpyxl to write into the correct template structure.
Calculated fields (FY total, avg/door, PPT flag) are formula-locked.
"""

import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from io import BytesIO
from typing import Optional
import structlog

logger = structlog.get_logger()

# EssilorLuxottica colour palette (from real template)
HEADER_FILL = PatternFill("solid", fgColor="1F2D3D")   # Dark navy header
ROW_FILL    = PatternFill("solid", fgColor="F8F9FA")   # Light row
CALC_FILL   = PatternFill("solid", fgColor="E8F5E9")   # Green tint for calculated cells
FONT_HEADER = Font(name="Calibri", size=9, bold=True, color="FFFFFF")
FONT_BODY   = Font(name="Calibri", size=9)
FONT_CALC   = Font(name="Calibri", size=9, color="1B5E20")  # Dark green for calculated

THIN = Side(style="thin", color="CCCCCC")
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)

# Column definitions — matches the real Excel template exactly
COLUMNS = [
    # (header_label, attribute_name, width, is_calculated)
    ("LOA # / SAP Event Code",           "loa_number",              18, False),
    ("Requestor (email)",                 "requestor_email",         22, False),
    ("Cluster",                           "cluster",                 12, False),
    ("Country",                           "country",                 20, False),
    ("Legal Entity",                      "legal_entity",            20, False),
    ("Type / Planning 2.0 Activity",      "activity_type",           22, False),
    ("Event Type",                        "event_type",              15, False),
    ("Event Purpose",                     "event_purpose",           15, False),
    ("PPT Slide (YES/NO)",                "_ppt_slide",              14, True),   # Calculated
    ("COT",                               "cot",                     16, False),
    ("Customer",                          "customer",                20, False),
    ("Category",                          "category",                12, False),
    ("Brand",                             "brand",                   20, False),
    ("CapEx / OpEx",                      "capex_opex",              12, False),
    ("ADV / Selling",                     "adv_selling",             12, False),
    ("Detail",                            "detail",                  30, False),
    ("# Customers",                       "num_customers",           12, False),
    ("# Doors",                           "num_doors",               10, False),
    ("Avg Investment per Door",           "_avg_per_door",           18, True),   # Calculated
    ("Vendor",                            "vendor",                  20, False),
    ("Currency",                          "currency",                 8, False),
    ("Q4-25 (€)",                         "q4_2025",                 12, False),
    ("Q1-26 (€)",                         "q1_2026",                 12, False),
    ("Q2-26 (€)",                         "q2_2026",                 12, False),
    ("Q3-26 (€)",                         "q3_2026",                 12, False),
    ("Q4-26 (€)",                         "q4_2026",                 12, False),
    ("FY-25 Total",                       "_fy25_total",             13, True),   # Calculated
    ("FY-26 Total",                       "_fy26_total",             13, True),   # Calculated
    ("Description",                       "description",             40, False),
    ("Tools",                             "tools",                   30, False),
    ("KPI",                               "kpi",                     25, False),
    ("Timing",                            "timing",                  15, False),
    ("Start Date",                        "start_date",              12, False),
    ("End Date",                          "end_date",                12, False),
    ("Cost Drill Down",                   "cost_drill_down",         30, False),
    ("Status",                            "status",                  14, False),
    ("LOA Draft ID",                      "loa_draft_id",            20, False),
    ("Created At",                        "_created_at",             18, False),
]


def _get_value(loa_dict: dict, attr: str) -> object:
    """Extract value from LOA dict, handling calculated fields."""
    if attr == "_ppt_slide":
        return "YES" if loa_dict.get("fy_2026_total", 0) > 50_000 else "NO"
    if attr == "_avg_per_door":
        doors = loa_dict.get("num_doors") or 0
        total = loa_dict.get("fy_2026_total", 0)
        return round(total / doors, 2) if doors > 0 else ""
    if attr == "_fy25_total":
        return loa_dict.get("q4_2025", 0)
    if attr == "_fy26_total":
        return sum([
            loa_dict.get("q1_2026", 0), loa_dict.get("q2_2026", 0),
            loa_dict.get("q3_2026", 0), loa_dict.get("q4_2026", 0),
        ])
    if attr == "_created_at":
        val = loa_dict.get("created_at", "")
        return str(val)[:10] if val else ""
    val = loa_dict.get(attr, "")
    # Convert enum values to strings
    if hasattr(val, "value"):
        return val.value
    return val if val is not None else ""


def generate_excel(loas: list[dict], session_name: str = "Q1-Q2 2026") -> bytes:
    """
    Generate the EssilorLuxottica LOA Excel file.
    loas: list of LOA dicts (from LOA.__dict__ or Pydantic model)
    Returns: bytes of the .xlsx file
    """
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "LOA Tracker"

    # ---- Title row ----
    ws.merge_cells("A1:AJ1")
    title_cell = ws["A1"]
    title_cell.value = f"EMEA PS — Marketing ADV No Labor — {session_name}"
    title_cell.font = Font(name="Calibri", size=12, bold=True, color="FFFFFF")
    title_cell.fill = PatternFill("solid", fgColor="0D47A1")
    title_cell.alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[1].height = 22

    # ---- Header row (row 2) ----
    for col_idx, (label, attr, width, is_calc) in enumerate(COLUMNS, start=1):
        cell = ws.cell(row=2, column=col_idx, value=label)
        cell.font = FONT_HEADER
        cell.fill = CALC_FILL if is_calc else HEADER_FILL
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = BORDER
        ws.column_dimensions[get_column_letter(col_idx)].width = width

    ws.row_dimensions[2].height = 30
    ws.freeze_panes = "A3"  # Freeze header rows

    # ---- Data rows ----
    for row_idx, loa in enumerate(loas, start=3):
        fill = ROW_FILL if row_idx % 2 == 0 else PatternFill("solid", fgColor="FFFFFF")
        for col_idx, (label, attr, width, is_calc) in enumerate(COLUMNS, start=1):
            value = _get_value(loa, attr)
            cell = ws.cell(row=row_idx, column=col_idx, value=value)
            cell.font = FONT_CALC if is_calc else FONT_BODY
            cell.fill = CALC_FILL if is_calc else fill
            cell.alignment = Alignment(vertical="center", wrap_text=(attr == "description"))
            cell.border = BORDER

            # Lock calculated columns — protection set at sheet level
            cell.protection = openpyxl.styles.Protection(locked=is_calc)

        ws.row_dimensions[row_idx].height = 18

    # ---- Protect calculated columns (users can't overwrite formulas) ----
    ws.protection.sheet = True
    ws.protection.password = "laura2026"  # Light protection — not security, just guard rails
    ws.protection.enable()

    # ---- Auto-filter on header row ----
    ws.auto_filter.ref = f"A2:{get_column_letter(len(COLUMNS))}2"

    # ---- Save to bytes ----
    buffer = BytesIO()
    wb.save(buffer)
    buffer.seek(0)

    logger.info("Excel generated", num_loas=len(loas), session=session_name)
    return buffer.getvalue()


def generate_single_excel_row(loa: dict) -> bytes:
    """Generate an Excel file for a single LOA (for download from detail page)."""
    return generate_excel([loa], session_name=loa.get("cluster", ""))
