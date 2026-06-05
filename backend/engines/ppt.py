"""
LAURA — PPT Engine v2.1
Fixed layout: proper spacing between table and content, photos fit correctly.
Rules confirmed by Vanessa Stöecklein:
- Title: [Brand]: [Activity Type] (Coop ADV: [Customer] · [Subject])
- Table: SAP code · Event type · Brands · Description · # Cust · Avg/Cust · Vendor · Budget · Date
- Left: Description (WHY) · Tools (HOW) · KPI · Cost drill down · Avg/door
- Right: 2 photos max (mandatory for CEO deck)
- Footer: Cluster · Strictly confidential · EssilorLuxottica
- PPT required if FY Total > €50,000
"""

import io
import os
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN

# ── EL Brand Colors ────────────────────────────────────────────────────────────
EL_DARK   = RGBColor(0x0D, 0x1B, 0x2A)
EL_GOLD   = RGBColor(0xC9, 0xA8, 0x4C)
EL_WHITE  = RGBColor(0xFF, 0xFF, 0xFF)
EL_GRAY   = RGBColor(0x64, 0x64, 0x64)
EL_LIGHT  = RGBColor(0xF2, 0xF2, 0xF2)
EL_BORDER = RGBColor(0xCC, 0xCC, 0xCC)
EL_GREEN  = RGBColor(0x1A, 0x73, 0x48)

SLIDE_W = Inches(13.33)
SLIDE_H = Inches(7.5)

UPLOAD_DIR = "uploads/loa_photos"

BRAND_ABBREV = {
    "HB - Ray-Ban": "RB", "HB - Ray-Ban Meta": "RB META",
    "HB - Oakley": "OAK", "HB - Oakley Meta": "OAK META",
    "HB - Vogue": "VOG", "HB - Persol": "PER",
    "HB - Oliver Peoples": "OP", "HB - Alain Mikli": "AM",
    "All HB": "ALL HB", "All HB + All LB": "ALL HB+LB",
    "LB - Chanel": "CHANEL", "LB - Prada": "PRADA",
    "LB - Versace": "VERS", "LB - Dolce & Gabbana": "D&G",
    "LB - Burberry": "BURB", "All LB": "ALL LB",
    "Essilor - Varilux": "VARILUX", "Essilor - Stellest": "STELLEST",
    "Essilor - Eyezen": "EYEZEN", "Essilor - Masterbrand": "ESS",
    "Essilor - Multibrand": "ESS MULTI", "Transitions": "TRANS",
    "Nikon": "NIKON",
}

ACTIVITY_TITLE = {
    "Tailor Made Seasonal": "Tailor Made Seasonal",
    "Tailor Made Permanent": "Tailor Made Permanent",
    "Coop Advertising": "Coop Advertising",
    "In Store / Consumer Activation": "In Store / Consumer Activation",
    "Events": "Events", "Trade Incentive": "Trade Incentive",
    "Sponsorship": "Sponsorship", "Catalogues & Brochures": "Catalogues & Brochures",
    "Other ADV Expenses": "Other ADV Expenses", "Medical Affairs": "Medical Affairs",
    "Training": "Training", "PR": "PR", "e-Tools": "e-Tools",
    "Others (non ADV)": "Others",
}


def _fmt(n):
    if not n: return "—"
    if n >= 1_000_000: return f"€{n/1_000_000:.1f}M"
    if n >= 1_000: return f"€{round(n/1_000)}k"
    return f"€{n:,.0f}"


def _textbox(slide, text, l, t, w, h, size=9, bold=False, italic=False,
             color=None, align=PP_ALIGN.LEFT, wrap=True):
    tb = slide.shapes.add_textbox(l, t, w, h)
    tf = tb.text_frame
    tf.word_wrap = wrap
    tf.margin_left = 0
    tf.margin_right = 0
    tf.margin_top = 0
    tf.margin_bottom = 0
    p = tf.paragraphs[0]
    p.alignment = align
    r = p.add_run()
    r.text = str(text) if text else ""
    r.font.size = Pt(size)
    r.font.bold = bold
    r.font.italic = italic
    r.font.color.rgb = color or EL_DARK
    return tb


def _rect(slide, l, t, w, h, fill=None, line=None):
    shp = slide.shapes.add_shape(1, l, t, w, h)
    if fill:
        shp.fill.solid()
        shp.fill.fore_color.rgb = fill
    else:
        shp.fill.background()
    if line:
        shp.line.color.rgb = line
    else:
        shp.line.fill.background()
    return shp


def generate_loa_slide(loa: dict) -> bytes:
    prs = Presentation()
    prs.slide_width = SLIDE_W
    prs.slide_height = SLIDE_H
    slide = prs.slides.add_slide(prs.slide_layouts[6])

    # ── Extract fields ─────────────────────────────────────────────────────
    loa_id       = str(loa.get("id", ""))
    activity     = loa.get("activity_type", "")
    brand        = loa.get("brand", "")
    category     = loa.get("category", "")
    cluster      = loa.get("cluster", "")
    country      = loa.get("country", "")
    customer     = loa.get("customer", "")
    vendor       = loa.get("vendor", "")
    description  = loa.get("description", "") or ""
    detail       = loa.get("detail", "") or ""
    kpi          = loa.get("kpi", "") or ""
    cost_drill   = loa.get("cost_drill_down", "") or ""
    loa_number   = loa.get("loa_number", "") or loa.get("loa_draft_id", "")
    start_date   = loa.get("start_date", "") or ""
    end_date     = loa.get("end_date", "") or ""
    fy_total     = loa.get("fy_2026_total", 0) or 0
    num_doors    = loa.get("num_doors") or 0
    num_customers = loa.get("num_customers") or 0
    avg_per_door = loa.get("avg_investment_per_door")
    event_type   = loa.get("event_type", "") or ""
    sap_code     = loa.get("sap_event_code", "") or "TBC"
    ppt_required = loa.get("ppt_slide_required", False)

    activity_title = ACTIVITY_TITLE.get(activity, activity)
    brand_abbrev   = BRAND_ABBREV.get(brand, brand)

    if activity == "Coop Advertising" and customer:
        slide_title = f"{customer} · {activity_title}"
    else:
        slide_title = f"{brand}: {activity_title}" if brand else activity_title

    date_str = f"{start_date} – {end_date}" if start_date and end_date else start_date or "—"

    avg_per_cust = (fy_total / num_customers) if num_customers and fy_total else None

    # ══════════════════════════════════════════════════════════════════════
    # LAYOUT — fixed pixel-perfect positions
    # ══════════════════════════════════════════════════════════════════════
    M          = Inches(0.3)       # left margin
    TOP_BAR_H  = Inches(0.45)      # dark navy top bar
    TITLE_Y    = Inches(0.5)       # title just below top bar
    TITLE_H    = Inches(0.32)
    TABLE_Y    = Inches(0.88)      # table starts here
    TABLE_H    = Inches(0.72)      # header row + data row
    CONTENT_Y  = Inches(1.7)       # left content starts well below table
    FOOTER_Y   = Inches(7.1)       # footer
    FOOTER_H   = Inches(0.35)
    LEFT_W     = Inches(7.6)       # left content zone width
    RIGHT_X    = Inches(8.0)       # right photos start here
    RIGHT_W    = Inches(5.05)      # photo width
    PHOTO_H    = Inches(2.6)       # each photo height
    PHOTO_GAP  = Inches(0.1)

    # ── TOP BAR ────────────────────────────────────────────────────────────
    _rect(slide, 0, 0, SLIDE_W, TOP_BAR_H, fill=EL_DARK)

    _textbox(slide, category.upper(),
             M, Inches(0.07), Inches(3), Inches(0.3),
             size=11, bold=True, color=EL_WHITE)

    _textbox(slide, f"{country.upper()}  ·  {_fmt(fy_total)}",
             Inches(7.5), Inches(0.07), Inches(4), Inches(0.3),
             size=10, bold=True, color=EL_WHITE, align=PP_ALIGN.RIGHT)

    # LOA badge (gold, top right)
    _rect(slide, Inches(11.75), Inches(0.07), Inches(1.35), Inches(0.3), fill=EL_GOLD)
    _textbox(slide, f"LOA: #{loa_number}",
             Inches(11.77), Inches(0.08), Inches(1.31), Inches(0.28),
             size=7.5, bold=True, color=EL_WHITE, align=PP_ALIGN.CENTER)

    # PPT SLIDE badge (green, below LOA badge)
    if ppt_required:
        _rect(slide, Inches(11.75), Inches(0.42), Inches(1.35), Inches(0.22), fill=EL_GREEN)
        _textbox(slide, "✓ PPT SLIDE",
                 Inches(11.77), Inches(0.43), Inches(1.31), Inches(0.2),
                 size=7, bold=True, color=EL_WHITE, align=PP_ALIGN.CENTER)

    # ── TITLE ──────────────────────────────────────────────────────────────
    _textbox(slide, slide_title,
             M, TITLE_Y, Inches(13.0), TITLE_H,
             size=14, bold=True, color=EL_DARK)

    # ── TABLE ──────────────────────────────────────────────────────────────
    # Background
    _rect(slide, M, TABLE_Y, SLIDE_W - M * 2, TABLE_H, fill=EL_LIGHT, line=EL_BORDER)

    # Separator line between header and data row
    HDR_H = Inches(0.28)
    _rect(slide, M, TABLE_Y + HDR_H, SLIDE_W - M * 2, Inches(0.01), fill=EL_BORDER)

    # Columns: (header, x, width)
    COLS = [
        ("SAP EVENT CODE", Inches(0.35), Inches(1.15)),
        ("EVENT TYPE",     Inches(1.55), Inches(1.1)),
        ("BRANDS",         Inches(2.7),  Inches(1.3)),
        ("DESCRIPTION",    Inches(4.05), Inches(2.55)),
        ("# CUST",         Inches(6.65), Inches(0.65)),
        ("AVG/CUST",       Inches(7.35), Inches(0.85)),
        ("VENDOR",         Inches(8.25), Inches(1.35)),
        ("BUDGET",         Inches(9.65), Inches(0.8)),
        ("DATE",           Inches(10.5), Inches(2.5)),
    ]

    HDR_Y  = TABLE_Y + Inches(0.04)
    DATA_Y = TABLE_Y + HDR_H + Inches(0.05)

    desc_short = (description[:70] + "…") if len(description) > 70 else description
    ROW_DATA = [
        sap_code or "TBC",
        event_type or activity_title[:15],
        brand_abbrev,
        desc_short,
        str(num_customers) if num_customers else "—",
        _fmt(avg_per_cust) if avg_per_cust else "—",
        (vendor or "—")[:20],
        _fmt(fy_total),
        date_str[:22],
    ]

    for (hdr, x, w), val in zip(COLS, ROW_DATA):
        _textbox(slide, hdr, x, HDR_Y, w, Inches(0.22),
                 size=6.5, bold=True, color=EL_GRAY)
        _textbox(slide, val, x, DATA_Y, w, Inches(0.3),
                 size=8, color=EL_DARK)

    # ── LEFT CONTENT ────────────────────────────────────────────────────────
    cy = CONTENT_Y
    GAP = Inches(0.12)

    def section(label, value, y):
        if not value:
            return y
        # Label
        _textbox(slide, label + ":", M, y, LEFT_W, Inches(0.2),
                 size=8, bold=True, color=EL_GRAY)
        y += Inches(0.2)
        # Value — estimate height from length
        chars_per_line = 100
        n_lines = max(1, (len(value) + chars_per_line - 1) // chars_per_line)
        val_h = Inches(0.18 * n_lines)
        _textbox(slide, value, M, y, LEFT_W - Inches(0.1), val_h,
                 size=9, color=EL_DARK, wrap=True)
        y += val_h + GAP
        return y

    cy = section("Description", description, cy)
    cy = section("Tools", detail, cy)
    cy = section("KPI", kpi, cy)
    cy = section("Cost Drill Down", cost_drill, cy)

    # Avg/door (not for Events/Medical/Sponsorship)
    if avg_per_door and activity not in ("Events", "Medical Affairs", "Sponsorship"):
        _textbox(slide, f"{_fmt(avg_per_door)}  |  #{num_doors} doors",
                 M, cy, LEFT_W, Inches(0.22),
                 size=9, bold=True, color=EL_GREEN)

    # ── RIGHT — PHOTOS ─────────────────────────────────────────────────────
    # Photo 1: starts at CONTENT_Y, height PHOTO_H
    # Photo 2: starts at CONTENT_Y + PHOTO_H + GAP
    for idx in range(1, 3):
        py = CONTENT_Y + (idx - 1) * (PHOTO_H + PHOTO_GAP)

        # Make sure photos don't go below footer
        max_h = FOOTER_Y - py - Inches(0.05)
        ph = min(PHOTO_H, max_h)
        if ph < Inches(0.5):
            break

        photo_path = None
        if loa_id and os.path.exists(UPLOAD_DIR):
            for f in os.listdir(UPLOAD_DIR):
                if f.startswith(f"{loa_id}_photo{idx}"):
                    photo_path = os.path.join(UPLOAD_DIR, f)
                    break

        if photo_path and os.path.exists(photo_path):
            try:
                slide.shapes.add_picture(photo_path, RIGHT_X, py, RIGHT_W, ph)
            except Exception:
                _photo_placeholder(slide, RIGHT_X, py, RIGHT_W, ph, idx)
        else:
            _photo_placeholder(slide, RIGHT_X, py, RIGHT_W, ph, idx)

    # ── FOOTER ────────────────────────────────────────────────────────────
    _rect(slide, 0, FOOTER_Y, SLIDE_W, FOOTER_H, fill=EL_DARK)

    _textbox(slide, "● ●",
             Inches(0.2), FOOTER_Y + Inches(0.06),
             Inches(0.5), Inches(0.22), size=8, color=EL_WHITE)
    _textbox(slide, cluster.upper(),
             Inches(0.65), FOOTER_Y + Inches(0.06),
             Inches(2), Inches(0.22), size=9, bold=True, color=EL_WHITE)
    _textbox(slide, "Strictly confidential — for internal use only. Do not share or forward.",
             Inches(3.5), FOOTER_Y + Inches(0.06),
             Inches(6), Inches(0.22), size=8,
             color=RGBColor(0xAA, 0xAA, 0xAA), align=PP_ALIGN.CENTER)
    _textbox(slide, "EssilorLuxottica",
             Inches(10.5), FOOTER_Y + Inches(0.06),
             Inches(2.6), Inches(0.22),
             size=9, bold=True, color=EL_WHITE, align=PP_ALIGN.RIGHT)

    buf = io.BytesIO()
    prs.save(buf)
    buf.seek(0)
    return buf.read()


def _photo_placeholder(slide, x, y, w, h, idx):
    _rect(slide, x, y, w, h,
          fill=RGBColor(0xEE, 0xEE, 0xEE),
          line=RGBColor(0xCC, 0xCC, 0xCC))
    _textbox(slide, f"[ Photo {idx} ]",
             x, y + h / 2 - Inches(0.15), w, Inches(0.3),
             size=10, color=RGBColor(0xAA, 0xAA, 0xAA),
             align=PP_ALIGN.CENTER, italic=True)
    _textbox(slide, "Upload photo in LAURA form",
             x, y + h / 2 + Inches(0.05), w, Inches(0.25),
             size=8, color=RGBColor(0xBB, 0xBB, 0xBB),
             align=PP_ALIGN.CENTER, italic=True)