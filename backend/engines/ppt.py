"""
LAURA — PPT Engine v3.0 (Gold Standard)
========================================
Rebuilt to match the EssilorLuxottica ADV NO LABOR Italy deck (June 2026).

Three distinct layouts based on activity type:
  1. STANDARD  — Permanent/Seasonal Visibility, Coop ADV, In Store,
                  Trade Incentive, Catalogues, Training, PR, e-Tools,
                  Other ADV, Others (non ADV)
     Table cols: Country · Type/Planning 2.0 · Customer · Brand · Detail ·
                 # Doors · AVG/door · Vendor · Curr · Q3-26 · Q4-26 · FY-26

  2. EVENTS    — Events, Medical Affairs
     Table cols: SAP Event Code · Event Type · Lenses Brands · Frames Brands ·
                 Description · # Cust · Avg invest/Cust · Vendor · Budget · Date

  3. SPONSORSHIP — Sponsorship
     Same as STANDARD but # Doors and AVG/door are hidden (per Vanessa Mtg 2)

Visual identity matches the gold deck:
  - Cream background (#FDFBF7)
  - Top-left:  category tag (dark navy rectangle, white text)
  - Top-right: ITALY/country tag (dark navy) + budget (light blue) + LOA# (light blue)
  - Title:     large bold black, left-aligned
  - Table:     full-width black header row, alternating black/white cells
  - Left:      bordered text box with Description / Brands / Clients /
               Timing / Tools / KPI / Costs drill down / Avg/door / # Doors
  - Right:     bordered photo box labeled "Examples of Previous Executions"
  - Footer:    ●● cluster | confidentiality line | page # | EssilorLuxottica
"""

import io
import os
import re
from datetime import datetime
from pptx import Presentation
from backend.engines.loa_display import compute_display_title
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE


# ════════════════════════════════════════════════════════════════════════
# Colors — exact tones from the gold deck
# ════════════════════════════════════════════════════════════════════════
CREAM        = RGBColor(0xFD, 0xFB, 0xF7)   # slide background
BLACK        = RGBColor(0x00, 0x00, 0x00)   # title, table header
NAVY         = RGBColor(0x2C, 0x3E, 0x5D)   # category tag, country tag
LIGHT_BLUE   = RGBColor(0xA6, 0xC4, 0xE0)   # budget tag, LOA # tag
WHITE        = RGBColor(0xFF, 0xFF, 0xFF)
GRAY_DARK    = RGBColor(0x50, 0x50, 0x50)
GRAY_MID     = RGBColor(0x88, 0x88, 0x88)
GRAY_LIGHT   = RGBColor(0xCC, 0xCC, 0xCC)
GRAY_FOOTER  = RGBColor(0xAA, 0xAA, 0xAA)


# ════════════════════════════════════════════════════════════════════════
# Slide dimensions (16:9 widescreen, matches the gold deck)
# ════════════════════════════════════════════════════════════════════════
SLIDE_W = Inches(13.33)
SLIDE_H = Inches(7.5)

UPLOAD_DIR = "uploads/loa_photos"


# ════════════════════════════════════════════════════════════════════════
# Brand abbreviations (from the gold deck cost drill-downs)
# ════════════════════════════════════════════════════════════════════════
BRAND_ABBREV = {
    # House Brands
    "HB - Ray-Ban":         "RB",
    "HB - Ray-Ban Meta":    "ME",
    "HB - Oakley":          "OO",
    "HB - Oakley Meta":     "OO ME",
    "HB - Vogue":           "VO",
    "HB - Persol":          "PO",
    "HB - Oliver Peoples":  "OV",
    "HB - Alain Mikli":     "AO",
    "HB - Arnette":         "AR",
    "HB - BLIZ":            "BL",
    "HB - Nuance":          "NU",
    "all HB":               "all HB",

    # License Brands
    "LB - Versace":             "VE",
    "LB - Emporio Armani":      "EA",
    "LB - Armani Exchange":     "EA7",
    "LB - Giorgio Armani":      "AR",
    "LB - Michael Kors":        "MK",
    "LB - Brunello Cucinelli":  "BC",
    "LB - Prada":               "PR",
    "LB - Miu Miu":             "MU",
    "LB - Prada Linea Rossa":   "PS",
    "LB - Dolce & Gabbana":     "DG",
    "LB - Burberry":            "BE",
    "LB - Jimmy Choo":          "JC",
    "LB - Tiffany":             "TF",
    "LB - Chanel":              "CH",
    "LB - Swarovski":           "SK",
    "LB - Ferrari":             "FZ",
    "LB - Ferrari Scuderia":    "FZ",
    "LB - Moncler":             "MO",
    "LB - Polo Ralph Lauren":   "PH",
    "LB - Polo":                "PH",
    "LB - Ralph":               "RA",
    "LB - Starck Eye":          "SE",
    "all LB":                   "all LB",
    "all HB + all LB":          "all HB + all LB",

    # Essilor lenses
    "Essilor - Varilux":     "VARILUX",
    "Essilor - Stellest":    "STELLEST",
    "Essilor - Eyezen":      "EYEZEN",
    "Essilor - Crizal":      "CRIZAL",
    "Essilor - Masterbrand": "ESS",
    "Essilor - Multibrand":  "ESS MB",
    "Transitions":           "TRANS",
    "Nikon":                 "NIKON",
    "Nuance":                "NU",
}


# Which activities get which layout — CANONICAL CODES, from reference_data.
#
# These three used to be local sets of Title Case LABELS ("Events",
# "Sponsorship"), tested against `loa["activity_type"]`, which holds the CODE
# ("EVENTS", "SPONSORSHIP"). None of them ever matched: every event LOA was
# rendered with the standard layout, Sponsorship never hid its door columns, and
# the category-tag fallback never fired. The first two now come from
# reference_data instead of being retyped here.
from backend.reference_data import (
    EVENT_ACTIVITY_TYPES as _EVENT_ACTIVITY_TYPES,
    NO_DOOR_ACTIVITY_TYPES as _NO_DOOR_ACTIVITY_TYPES,
    activity_label as _activity_label,

)

# Activity types that use the EVENTS layout
EVENT_LAYOUT_ACTIVITIES = set(_EVENT_ACTIVITY_TYPES)

# Activity types that hide # Doors / AVG per door
NO_DOOR_ACTIVITIES = set(_NO_DOOR_ACTIVITY_TYPES)

# Activity → category tag (top-left) fallback when no category is set
ACTIVITY_TO_TAG = {
    "SPONSORSHIP":     "Sponsorship",
    "EVENTS":          "All categories",
    "MEDICAL_AFFAIRS": "All categories",
    "TRAINING":        "All categories",
}


# ════════════════════════════════════════════════════════════════════════
# Helpers
# ════════════════════════════════════════════════════════════════════════

def _fmt_date(d) -> str:
    """Format YYYY-MM-DD → '01 Sep 2026'. Returns '' if empty, raw string if unparseable."""
    if not d:
        return ""
    try:
        return datetime.strptime(str(d), "%Y-%m-%d").strftime("%d %b %Y")
    except Exception:
        return str(d)


def _format_categories(cats) -> str:
    """List or str → 'Frames + Lenses' style string."""
    if not cats:
        return ""
    if isinstance(cats, str):
        return cats
    return " + ".join(str(c) for c in cats if c)


def _format_brands(brands) -> str:
    """List or str → full brand display string."""
    if not brands:
        return ""
    if isinstance(brands, str):
        return brands
    return " + ".join(str(b) for b in brands if b)


_BRAND_CODE_RE = re.compile(r"^(?P<name>.+?)\s*\((?P<code>[A-Za-z0-9]{1,6})\)$")


def _abbrev_brand(brand: str) -> str:
    """
    One brand → its short code.

    Handles both formats: the legacy labels in BRAND_ABBREV ('HB - Ray-Ban' → 'RB')
    and the current reference-data format that already carries the SAP code
    ('Ray-Ban (RB)' → 'RB').
    """
    if not brand:
        return ""
    if brand in BRAND_ABBREV:
        return BRAND_ABBREV[brand]
    m = _BRAND_CODE_RE.match(brand.strip())
    if m:
        return m.group("code")
    return brand


def _abbrev_brands(brands) -> str:
    """List or str → short abbreviations (e.g. 'RB + OO')."""
    if not brands:
        return ""
    if isinstance(brands, str):
        return _abbrev_brand(brands)
    return " + ".join(_abbrev_brand(b) for b in brands if b)


def _fmt_eur(n) -> str:
    """Format euro amount: €120K, €1.5M, €450."""
    if not n:
        return "—"
    n = float(n)
    if n >= 1_000_000:
        return f"{n/1_000_000:.1f}M€"
    if n >= 1_000:
        return f"{round(n/1_000)}K€"
    return f"{n:,.0f}€"


def _fmt_eur_full(n) -> str:
    """Format euro amount with thousand separators: €120,000."""
    if not n:
        return "—"
    return f"{n:,.0f}".replace(",", ".") + " €"


def _category_tag_label(category, activity_type) -> str:
    """
    Top-left tag: 'Frames', 'Lenses', 'All categories', 'Sponsorship', etc.
    Mirrors the gold deck where:
      - Single category → that category name (capitalised)
      - Multi-category   → 'All categories'
      - Sponsorship      → 'Sponsorship'
    """
    if activity_type in ACTIVITY_TO_TAG:
        return ACTIVITY_TO_TAG[activity_type]
    cats = category if isinstance(category, list) else [category] if category else []
    cats = [c for c in cats if c]
    if not cats:
        return "All categories"
    if len(cats) == 1:
        return cats[0]
    return "All categories"


def _add_text(slide, text, left, top, width, height,
              size=10, bold=False, italic=False, color=None,
              align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.TOP, wrap=True,
              font_name="Calibri"):
    """Add a textbox with the specified styling."""
    tb = slide.shapes.add_textbox(left, top, width, height)
    tf = tb.text_frame
    tf.word_wrap = wrap
    tf.margin_left = Emu(0)
    tf.margin_right = Emu(0)
    tf.margin_top = Emu(0)
    tf.margin_bottom = Emu(0)
    tf.vertical_anchor = anchor
    p = tf.paragraphs[0]
    p.alignment = align
    r = p.add_run()
    r.text = str(text) if text is not None else ""
    r.font.size = Pt(size)
    r.font.bold = bold
    r.font.italic = italic
    r.font.name = font_name
    r.font.color.rgb = color or BLACK
    return tb


def _add_rect(slide, left, top, width, height, fill=None, line=None, line_width=None):
    """Add a filled rectangle."""
    shp = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, left, top, width, height)
    if fill is not None:
        shp.fill.solid()
        shp.fill.fore_color.rgb = fill
    else:
        shp.fill.background()
    if line is not None:
        shp.line.color.rgb = line
        if line_width is not None:
            shp.line.width = line_width
    else:
        shp.line.fill.background()
    # Remove default shadow that pptx adds
    shp.shadow.inherit = False
    return shp


def _add_line(slide, x1, y1, x2, y2, color=GRAY_LIGHT, width=Pt(0.5)):
    """Add a thin line (used for table borders & footer divider)."""
    line = slide.shapes.add_connector(1, Emu(int(x1)), Emu(int(y1)),
                                       Emu(int(x2)), Emu(int(y2)))
    line.line.color.rgb = color
    line.line.width = width
    return line


# ════════════════════════════════════════════════════════════════════════
# Main entry point
# ════════════════════════════════════════════════════════════════════════

# ── Multi-row pagination thresholds ────────────────────────────────────────
# Measured against the 13.33" x 7.5" canvas:
#   table_y 1.65" + header 0.45" = 2.10"; each data row is 0.40"; footer at 7.18".
#
#   ROWS_WITH_CONTENT  rows that fit above the description/photo block on the
#                      final slide. 3 rows end at 3.30", so the content block
#                      moves to y=3.40" and shrinks 4.20" -> 3.60".
#   ROWS_TABLE_ONLY    rows on a table-only continuation slide (no description,
#                      no photos). 9 rows + TOTAL strip ends at 6.10".
ROWS_WITH_CONTENT = 3
ROWS_TABLE_ONLY   = 9

# Content block geometry on a final slide that also carries data rows.
MULTI_CONTENT_Y = Inches(3.40)
MULTI_CONTENT_H = Inches(3.60)


def _paginate_rows(rows: list) -> list[list]:
    """
    Split data rows across slides.

    <= ROWS_WITH_CONTENT   one slide, normal layout (table + description + photos)
    more                   table-only slides for the leading rows, then a final
                           slide carrying the last ROWS_WITH_CONTENT rows plus
                           the description and photos.

    With MAX_LOA_LINES = 12 the prefix is always 1-9 rows, so a split LOA
    produces exactly two slides.
    """
    n = len(rows)
    if n <= ROWS_WITH_CONTENT:
        return [rows]

    # Reserve the tail for the final slide; chunk everything before it.
    head, tail = rows[:n - ROWS_WITH_CONTENT], rows[n - ROWS_WITH_CONTENT:]
    pages = [head[i:i + ROWS_TABLE_ONLY] for i in range(0, len(head), ROWS_TABLE_ONLY)]
    pages.append(tail)
    return pages


def _loa_rows(loa: dict) -> list:
    """Per-row dicts for this LOA — its `lines` when multi, else the LOA itself."""
    if (loa.get("loa_type") or "standard") == "standard":
        return [loa]
    lines = loa.get("lines") or []
    return lines if lines else [loa]


def generate_loa_slide(loa: dict) -> bytes:
    """
    Generate a LOA slide deck as PPTX bytes.

    A standard LOA produces exactly one slide, byte-for-byte as before.
    A multi-brand / multi-activity LOA with more rows than fit produces a
    paginated set: table-only slides first, then a final slide with the
    remaining rows plus the description and photo blocks.
    """
    prs = Presentation()
    prs.slide_width = SLIDE_W
    prs.slide_height = SLIDE_H

    activity = (loa.get("activity_type") or "").strip()
    rows  = _loa_rows(loa)
    # The events layout ignores `rows` (its columns are LOA-level — SAP code,
    # brand split, # customers), so paginating one would emit N identical
    # slides. Only the standard layout splits.
    is_event_layout = activity in EVENT_LAYOUT_ACTIVITIES
    pages = [rows[:1]] if is_event_layout else _paginate_rows(rows)
    total_pages = len(pages)

    for page_idx, page_rows in enumerate(pages):
        slide = prs.slides.add_slide(prs.slide_layouts[6])  # blank layout
        _add_rect(slide, 0, 0, SLIDE_W, SLIDE_H, fill=CREAM)

        is_last = page_idx == total_pages - 1
        page_no = (page_idx + 1, total_pages) if total_pages > 1 else None

        if activity in EVENT_LAYOUT_ACTIVITIES:
            _render_events_layout(slide, loa, rows=page_rows,
                                  page_no=page_no, with_content=is_last)
        else:
            _render_standard_layout(slide, loa,
                                    hide_doors=(activity in NO_DOOR_ACTIVITIES),
                                    rows=page_rows, page_no=page_no,
                                    with_content=is_last)

        _render_footer(slide, loa)

    buf = io.BytesIO()
    prs.save(buf)
    buf.seek(0)
    return buf.read()


# ════════════════════════════════════════════════════════════════════════
# Top-right tag stack (country + budget + LOA #)
# ════════════════════════════════════════════════════════════════════════

def _render_top_right_tags(slide, loa):
    """Country (navy) → Budget (light blue) → LOA # (light blue, optional)."""
    country  = (loa.get("country") or "").upper() or "ITALY"
    fy_total = loa.get("fy_2026_total") or 0
    loa_num  = loa.get("loa_number") or ""

    tag_x = Inches(11.5)
    tag_w = Inches(1.65)
    tag_h = Inches(0.36)
    tag_y = Inches(0.25)

    # Country (dark navy)
    _add_rect(slide, tag_x, tag_y, tag_w, tag_h, fill=NAVY)
    _add_text(slide, country, tag_x, tag_y, tag_w, tag_h,
              size=13, bold=True, color=WHITE,
              align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)

    # Budget (light blue)
    tag_y2 = tag_y + tag_h
    _add_rect(slide, tag_x, tag_y2, tag_w, tag_h, fill=LIGHT_BLUE)
    _add_text(slide, _fmt_eur(fy_total), tag_x, tag_y2, tag_w, tag_h,
              size=13, bold=True, color=BLACK,
              align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)

    # LOA # (light blue, only if real LOA number exists)
    if loa_num and not loa_num.startswith("LAURA-"):
        tag_y3 = tag_y2 + tag_h
        _add_rect(slide, tag_x, tag_y3, tag_w, tag_h, fill=LIGHT_BLUE)
        _add_text(slide, f"LOA: #{loa_num}", tag_x, tag_y3, tag_w, tag_h,
                  size=10, bold=False, color=BLACK,
                  align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)


# ════════════════════════════════════════════════════════════════════════
# Top-left category tag
# ════════════════════════════════════════════════════════════════════════

def _render_category_tag(slide, loa):
    """Dark navy rectangle in top-left with category/activity label."""
    label = _category_tag_label(loa.get("category"), loa.get("activity_type"))
    tag_x = Inches(0.3)
    tag_y = Inches(0.25)
    tag_w = Inches(1.6)
    tag_h = Inches(0.4)
    _add_rect(slide, tag_x, tag_y, tag_w, tag_h, fill=NAVY)
    _add_text(slide, label, tag_x, tag_y, tag_w, tag_h,
              size=11, bold=True, color=WHITE,
              align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)


# ════════════════════════════════════════════════════════════════════════
# Title (slide subject)
# ════════════════════════════════════════════════════════════════════════

def _slide_title(loa) -> str:
    """
    Slide title. Multi-row LOAs name their axis values when there are few enough
    to read, and collapse to 'All Brands' / 'All Activities' beyond that — the
    deck reads better than the tracker's bare count.
    """
    loa_type = (loa.get("loa_type") or "standard").strip()
    if loa_type == "standard":
        return compute_display_title(loa)

    lines = loa.get("lines") or []

    if loa_type == "multi_brand":
        # Label, not code — the identity map this replaced was keyed by label
        # and so passed "TM_SEASONAL" straight into the title.
        activity_label = _activity_label((loa.get("activity_type") or "").strip())
        names = [_abbrev_brands(ln.get("brand")) for ln in lines if ln.get("brand")]
        label = ", ".join(names) if 0 < len(names) <= 3 else "All Brands"
        return f"{activity_label}: {label}" if activity_label else label

    if loa_type == "multi_activity":
        brand = _abbrev_brands(loa.get("brand"))
        names = [_activity_label(ln.get("activity_type")) for ln in lines if ln.get("activity_type")]
        label = ", ".join(names) if 0 < len(names) <= 3 else "All Activities"
        return f"{brand.upper()}: {label}" if brand else label

    return compute_display_title(loa)

def _render_title(slide, loa, page_no=None):
    """Large bold black title below the top tags."""
    title = _slide_title(loa)
    if page_no:
        title = f"{title} ({page_no[0]} / {page_no[1]})"
    _add_text(slide, title,
              Inches(0.3), Inches(0.9),
              Inches(10.5), Inches(0.6),
              size=26, bold=True, color=BLACK,
              align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.MIDDLE)


# ════════════════════════════════════════════════════════════════════════
# Table — STANDARD layout
# ════════════════════════════════════════════════════════════════════════

def _standard_row_cells(loa, row, hide_doors=False):
    """
    Column spec for one data row of the standard table.

    `row` is the source of the per-row values — for a standard LOA that is the
    LOA dict itself; for a multi-row LOA it is one `loa_line` dict. Shared
    values (country, currency) always come from the parent `loa`.

    Returns [(header, width_inches, value), ...]
    """
    activity = row.get("activity_type") or loa.get("activity_type") or ""
    # The deck's own wording for the two Tailor Made lines; everything else
    # renders its reference_data label. Keyed by code — this map used to be
    # keyed by label and so never fired, printing "TM_SEASONAL" in the cell.
    activity_label = {
        "TM_SEASONAL":  "Tailor Made Seasonal",
        "TM_PERMANENT": "Tailor Made Permanent",
    }.get(activity, _activity_label(activity))

    fy_total  = row.get("fy_2026_total") or 0
    q1        = row.get("q1_2026") or 0
    q2        = row.get("q2_2026") or 0
    q3        = row.get("q3_2026") or 0
    q4        = row.get("q4_2026") or 0
    num_doors = row.get("num_doors") or 0
    avg_door  = row.get("avg_investment_per_door")
    brand     = row.get("brand") or loa.get("brand")

    cols = [
        ("Country",            0.85, loa.get("country") or "—"),
        ("Type / Planning 2.0\nACTIVITY", 1.55, activity_label),
        ("CUSTOMER",           1.55, (row.get("customer") or "—")[:30]),
        ("BRAND",              1.55, _abbrev_brands(brand)),
        ("DETAIL",             1.5,  (row.get("detail") or "—")[:35]),
    ]

    if not hide_doors:
        cols += [
            ("# DOORS",            0.7,  str(num_doors) if num_doors else "—"),
            ("AVG Investment\nper door", 1.05, _fmt_eur(avg_door) if avg_door else "—"),
        ]
    else:
        # Sponsorship: replace door columns with N/A column or skip
        cols += [
            ("# DOORS",            0.7,  "N/A"),
            ("AVG Investment\nper door", 1.05, "N/A"),
        ]

    cols += [
        ("VENDOR",             1.2,  (row.get("vendor") or "—")[:20]),
        ("CURR.",              0.45, loa.get("currency") or "€"),
        ("Q1-26",              0.65, _fmt_eur_full(q1) if q1 else "—"),
        ("Q2-26",              0.65, _fmt_eur_full(q2) if q2 else "—"),
        ("Q3-26",              0.65, _fmt_eur_full(q3) if q3 else "—"),
        ("Q4-26",              0.65, _fmt_eur_full(q4) if q4 else "—"),
        ("FY-26",              0.75, _fmt_eur_full(fy_total) if fy_total else "—"),
    ]
    return cols


def _render_standard_table(slide, loa, hide_doors=False, rows=None, show_total=False):
    """
    Black header row + one data row per entry in `rows`.

    `rows` defaults to [loa] — the single-row behaviour every standard LOA has
    always had. Multi-row LOAs pass their `loa_line` dicts instead.
    When `show_total` is set, a TOTAL strip is appended under the last row.
    """
    if rows is None:
        rows = [loa]

    table_x = Inches(0.3)
    table_y = Inches(1.65)
    table_w = SLIDE_W - Inches(0.6)
    header_h = Inches(0.45)
    data_h   = Inches(0.4)

    # Header background
    _add_rect(slide, table_x, table_y, table_w, header_h, fill=BLACK)

    # One white banded background per data row
    for i in range(len(rows)):
        _add_rect(slide, table_x, table_y + header_h + data_h * i, table_w, data_h,
                  fill=WHITE, line=GRAY_LIGHT, line_width=Pt(0.5))

    # Headers come from the first row's spec — every row shares the same columns.
    header_cols = _standard_row_cells(loa, rows[0], hide_doors=hide_doors)
    cur_x = table_x
    for header, w_in, _ in header_cols:
        w = Inches(w_in)
        _add_text(slide, header,
                  cur_x, table_y, w, header_h,
                  size=7.5, bold=True, color=WHITE,
                  align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
        cur_x += w

    # Data rows
    for i, row in enumerate(rows):
        cols = _standard_row_cells(loa, row, hide_doors=hide_doors)
        row_y = table_y + header_h + data_h * i
        cur_x = table_x
        for _, w_in, value in cols:
            w = Inches(w_in)
            _add_text(slide, value,
                      cur_x, row_y, w, data_h,
                      size=8, color=BLACK,
                      align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
            cur_x += w

    if show_total and len(rows) > 1:
        _render_table_total(slide, rows, header_cols,
                            table_x, table_y + header_h + data_h * len(rows),
                            table_w, data_h)


def _render_table_total(slide, rows, header_cols, x, y, w, h):
    """TOTAL strip under a multi-row table — sums the quarter and FY columns."""
    _add_rect(slide, x, y, w, h, fill=BLACK)

    sums = {
        "Q1-26": sum(r.get("q1_2026") or 0 for r in rows),
        "Q2-26": sum(r.get("q2_2026") or 0 for r in rows),
        "Q3-26": sum(r.get("q3_2026") or 0 for r in rows),
        "Q4-26": sum(r.get("q4_2026") or 0 for r in rows),
        "FY-26": sum(r.get("fy_2026_total") or 0 for r in rows),
        "# DOORS": sum(r.get("num_doors") or 0 for r in rows),
    }

    cur_x = x
    for idx, (header, w_in, _) in enumerate(header_cols):
        cw = Inches(w_in)
        if idx == 0:
            text = "TOTAL"
        elif header in sums:
            v = sums[header]
            text = (str(v) if header == "# DOORS" else _fmt_eur_full(v)) if v else ""
        else:
            text = ""
        if text:
            _add_text(slide, text, cur_x, y, cw, h,
                      size=8, bold=True, color=WHITE,
                      align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
        cur_x += cw


# ════════════════════════════════════════════════════════════════════════
# Table — EVENTS layout
# ════════════════════════════════════════════════════════════════════════

def _render_events_table(slide, loa):
    """
    EVENTS layout (also Medical Affairs):
    SAP Event Code · Event Type · Lenses Brands · Frames Brands ·
    Description · # Cust · Avg invest/Cust · Vendor · Budget · Date
    """
    table_x = Inches(0.3)
    table_y = Inches(1.65)
    table_w = SLIDE_W - Inches(0.6)
    header_h = Inches(0.45)
    data_h   = Inches(0.4)

    _add_rect(slide, table_x, table_y, table_w, header_h, fill=BLACK)
    _add_rect(slide, table_x, table_y + header_h, table_w, data_h,
              fill=WHITE, line=GRAY_LIGHT, line_width=Pt(0.5))

    fy_total = loa.get("fy_2026_total") or 0
    num_cust = loa.get("num_customers") or 0
    avg_cust = (fy_total / num_cust) if (num_cust and fy_total) else None

    from datetime import datetime
    def _fmt_date(d):
        if not d: return ""
        try:
            return datetime.strptime(d, "%Y-%m-%d").strftime("%d %b %Y")
        except Exception:
            return d  # fallback if format is unexpected
    
    start_date = _fmt_date(loa.get("start_date"))
    end_date   = _fmt_date(loa.get("end_date"))
    if start_date and end_date:
        date_str = f"{start_date} – {end_date}"
    elif start_date:
        date_str = start_date
    else:
        date_str = "—"

    # Build brand split — frames vs lenses
    brand_all = loa.get("brand") or ""
    brand_list = brand_all if isinstance(brand_all, list) else [brand_all]
    brand_list = [b for b in brand_list if b]
    lens_brands  = [b for b in brand_list if b.startswith("Essilor") or b in ("Transitions", "Nikon", "Kodak")]
    frame_brands = [b for b in brand_list if b not in lens_brands]

    cols = [
        ("SAP EVENT CODE",   1.4,  loa.get("sap_event_code") or "TBC"),
        ("EVENT TYPE",       1.1,  loa.get("event_type") or "—"),
        ("LENSES BRANDS",    1.3,  _abbrev_brands(lens_brands) or "N/A"),
        ("FRAMES BRANDS",    1.3,  _abbrev_brands(frame_brands) or "—"),
        ("DESCRIPTION",      2.4,  (loa.get("description") or "—")[:50]),
        ("# CUST",           0.65, str(num_cust) if num_cust else "—"),
        ("Avg invest\n/ Cust", 1.0, _fmt_eur(avg_cust) if avg_cust else "—"),
        ("VENDOR",           1.25, (loa.get("vendor") or "—")[:20]),
        ("BUDGET",           0.9,  _fmt_eur(fy_total)),
        ("DATE OF EVENT",    1.43, date_str[:28]),
    ]

    cur_x = table_x
    for header, w_in, value in cols:
        w = Inches(w_in)
        _add_text(slide, header,
                  cur_x, table_y, w, header_h,
                  size=7.5, bold=True, color=WHITE,
                  align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
        _add_text(slide, value,
                  cur_x, table_y + header_h, w, data_h,
                  size=8, color=BLACK,
                  align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
        cur_x += w


# ════════════════════════════════════════════════════════════════════════
# Left content block (text)
# ════════════════════════════════════════════════════════════════════════

def _render_left_block(slide, loa, y=None, h=None):
    """
    Bordered text box containing:
      Description / Brands / Clients / Timing of installation /
      Tools / KPI / Costs drill down / Average investments | door / # Doors

    `y`/`h` override the default geometry when extra table rows sit above it.
    """
    block_x = Inches(0.3)
    block_y = y if y is not None else Inches(2.6)
    block_w = Inches(6.5)
    block_h = h if h is not None else Inches(4.2)

    # Border
    _add_rect(slide, block_x, block_y, block_w, block_h,
              fill=WHITE, line=GRAY_LIGHT, line_width=Pt(0.75))

    inner_x = block_x + Inches(0.2)
    inner_w = block_w - Inches(0.4)
    y = block_y + Inches(0.2)
    line_gap = Inches(0.05)

    activity = loa.get("activity_type") or ""

    def add_field(label, value, value_is_long=False):
        """Add 'Label: value' line. Returns new y position."""
        nonlocal y
        if not value:
            return
        value_str = str(value).strip()
        if not value_str:
            return
        # Estimate line height
        chars_per_line = 75
        n_lines = max(1, (len(value_str) + chars_per_line - 1) // chars_per_line)
        h = Inches(0.22 * n_lines) if value_is_long else Inches(0.22)

        # Use rich runs so label is bold, value is normal, on the same line
        tb = slide.shapes.add_textbox(inner_x, y, inner_w, h)
        tf = tb.text_frame
        tf.word_wrap = True
        tf.margin_left = Emu(0); tf.margin_right = Emu(0)
        tf.margin_top  = Emu(0); tf.margin_bottom = Emu(0)
        p = tf.paragraphs[0]
        p.alignment = PP_ALIGN.LEFT

        r1 = p.add_run()
        r1.text = f"{label}: "
        r1.font.bold = True
        r1.font.size = Pt(10)
        r1.font.color.rgb = BLACK
        r1.font.name = "Calibri"

        r2 = p.add_run()
        r2.text = value_str
        r2.font.bold = False
        r2.font.size = Pt(10)
        r2.font.color.rgb = BLACK
        r2.font.name = "Calibri"

        y = y + h + line_gap

    # Fields in the gold deck order
    add_field("Description", loa.get("description"), value_is_long=True)
    add_field("Brands",      _format_brands(loa.get("brand")))
    add_field("Clients",     loa.get("customer"))

    # Timing of installation: prefer timing field, else dates
    timing = loa.get("timing")
    if not timing:
        sd, ed = _fmt_date(loa.get("start_date")), _fmt_date(loa.get("end_date"))
        if sd and ed:
            timing = f"{sd} – {ed}"
        elif sd:
            timing = sd
    add_field("Timing of installation", timing)

    add_field("Tools", loa.get("tools") or loa.get("detail"), value_is_long=True)
    add_field("KPI",   loa.get("kpi"), value_is_long=True)
    add_field("Costs drill down", loa.get("cost_drill_down"), value_is_long=True)

    # Avg/door + # Doors — hidden for Events / Medical / Sponsorship
    if activity not in ("Events", "Medical Affairs", "Sponsorship"):
        avg_door = loa.get("avg_investment_per_door")
        n_doors  = loa.get("num_doors") or 0
        if avg_door:
            add_field("Average investments | door", _fmt_eur(avg_door))
        if n_doors:
            add_field("# Doors", str(n_doors))


# ════════════════════════════════════════════════════════════════════════
# Right photo block
# ════════════════════════════════════════════════════════════════════════

def _render_right_block(slide, loa, y=None, h=None):
    """
    Bordered photo area with label "Examples of Previous Executions".
    1 photo  → landscape (full block width, centered)
    2 photos → portrait stacked side-by-side
    3 photos → 3 portraits side-by-side (rare, but the gold deck has it)

    `y`/`h` override the default geometry when extra table rows sit above it.
    """
    block_x = Inches(7.0)
    block_y = y if y is not None else Inches(2.6)
    block_w = SLIDE_W - block_x - Inches(0.3)
    block_h = h if h is not None else Inches(4.2)

    # Border
    _add_rect(slide, block_x, block_y, block_w, block_h,
              fill=WHITE, line=GRAY_LIGHT, line_width=Pt(0.75))

    # Label at top
    _add_text(slide, "Examples of Previous Executions",
              block_x, block_y + Inches(0.1), block_w, Inches(0.3),
              size=12, bold=False, italic=False, color=BLACK,
              align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)

    # Photo area
    photo_x = block_x + Inches(0.2)
    photo_y = block_y + Inches(0.5)
    photo_w = block_w - Inches(0.4)
    photo_h = block_h - Inches(0.7)

    # Find photos for this LOA
    loa_id = str(loa.get("id", ""))
    photos = []
    if loa_id and os.path.exists(UPLOAD_DIR):
        for i in range(1, 4):
            for f in sorted(os.listdir(UPLOAD_DIR)):
                if f.startswith(f"{loa_id}_photo{i}"):
                    photos.append(os.path.join(UPLOAD_DIR, f))
                    break

    if not photos:
        # Placeholder
        _add_rect(slide, photo_x, photo_y, photo_w, photo_h,
                  fill=RGBColor(0xEE, 0xEE, 0xEE),
                  line=GRAY_LIGHT, line_width=Pt(0.5))
        _add_text(slide, "[ Photos will appear here ]",
                  photo_x, photo_y + photo_h/2 - Inches(0.15),
                  photo_w, Inches(0.3),
                  size=11, italic=True, color=GRAY_MID,
                  align=PP_ALIGN.CENTER)
        _add_text(slide, "Upload up to 2 photos in the LAURA form",
                  photo_x, photo_y + photo_h/2 + Inches(0.1),
                  photo_w, Inches(0.25),
                  size=9, italic=True, color=GRAY_MID,
                  align=PP_ALIGN.CENTER)
        return

    n = len(photos)
    if n == 1:
        # Single landscape photo
        try:
            slide.shapes.add_picture(photos[0], photo_x, photo_y, photo_w, photo_h)
        except Exception:
            pass
    elif n == 2:
        # Two portraits side by side
        gap = Inches(0.1)
        each_w = (photo_w - gap) / 2
        try:
            slide.shapes.add_picture(photos[0], photo_x, photo_y, each_w, photo_h)
            slide.shapes.add_picture(photos[1], photo_x + each_w + gap, photo_y, each_w, photo_h)
        except Exception:
            pass
    else:
        # Three or more — 3 columns
        gap = Inches(0.08)
        each_w = (photo_w - gap * 2) / 3
        try:
            for i in range(3):
                if i < len(photos):
                    slide.shapes.add_picture(
                        photos[i],
                        photo_x + (each_w + gap) * i,
                        photo_y, each_w, photo_h)
        except Exception:
            pass


# ════════════════════════════════════════════════════════════════════════
# Footer (matches gold deck)
# ════════════════════════════════════════════════════════════════════════

def _render_footer(slide, loa):
    """●● cluster | confidentiality line | page # | EssilorLuxottica"""
    footer_y = Inches(7.18)
    cluster  = (loa.get("cluster") or "").upper()

    # Thin divider above footer
    divider_y = Inches(7.05)
    _add_line(slide, Inches(0.3), divider_y,
              SLIDE_W - Inches(0.3), divider_y,
              color=BLACK, width=Pt(0.4))

    # ●● dots on the far left
    _add_text(slide, "● ●",
              Inches(0.3), footer_y, Inches(0.5), Inches(0.25),
              size=8, color=BLACK, align=PP_ALIGN.LEFT,
              anchor=MSO_ANCHOR.MIDDLE)

    # Cluster name next to dots
    _add_text(slide, cluster,
              Inches(0.7), footer_y, Inches(2), Inches(0.25),
              size=8, color=GRAY_DARK, align=PP_ALIGN.LEFT,
              anchor=MSO_ANCHOR.MIDDLE)

    # Center confidentiality
    _add_text(slide,
              "Strictly confidential - for internal use only. Do not share or forward.",
              Inches(3), footer_y, Inches(7.5), Inches(0.25),
              size=7.5, italic=False, color=GRAY_FOOTER,
              align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)

    # EssilorLuxottica (right)
    _add_text(slide, "EssilorLuxottica",
              SLIDE_W - Inches(2.0), footer_y, Inches(1.7), Inches(0.25),
              size=9, bold=True, color=BLACK,
              align=PP_ALIGN.RIGHT, anchor=MSO_ANCHOR.MIDDLE)


# ════════════════════════════════════════════════════════════════════════
# Layout orchestrators
# ════════════════════════════════════════════════════════════════════════

def _render_standard_layout(slide, loa, hide_doors=False, rows=None,
                            page_no=None, with_content=True):
    _render_category_tag(slide, loa)
    _render_top_right_tags(slide, loa)
    _render_title(slide, loa, page_no=page_no)
    if not with_content:
        _render_continued_note(slide)
    n_rows = len(rows) if rows else 1
    _render_standard_table(slide, loa, hide_doors=hide_doors, rows=rows,
                           show_total=not with_content or n_rows > 1)
    if with_content:
        offset = _content_offset(n_rows)
        _render_left_block(slide, loa, y=offset[0], h=offset[1])
        _render_right_block(slide, loa, y=offset[0], h=offset[1])


def _render_events_layout(slide, loa, rows=None, page_no=None, with_content=True):
    # The Events table has its own column set (SAP code, event type, lenses/frames
    # brand split, # customers) and stays single-row; `rows` is accepted so both
    # layouts share one call signature.
    del rows
    _render_category_tag(slide, loa)
    _render_top_right_tags(slide, loa)
    _render_title(slide, loa, page_no=page_no)
    if not with_content:
        _render_continued_note(slide)
    _render_events_table(slide, loa)
    if with_content:
        _render_left_block(slide, loa)
        _render_right_block(slide, loa)


def _content_offset(n_rows: int):
    """
    (y, h) for the description / photo blocks.

    A single-row slide keeps the frozen geometry exactly (2.60", 4.20"). Extra
    data rows push the blocks down and shrink them so the footer stays clear.
    """
    if n_rows <= 1:
        return (Inches(2.6), Inches(4.2))
    return (MULTI_CONTENT_Y, MULTI_CONTENT_H)


def _render_continued_note(slide):
    """'Table continued on next slide' note above the table on a split slide."""
    _add_text(slide, "Table continued on next slide",
              Inches(0.3), Inches(1.38), Inches(6.0), Inches(0.24),
              size=9, bold=True, color=GRAY_DARK,
              align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.MIDDLE)