"""
LAURA — Historical deck extraction engine (Rock 1)
==================================================
Parses EssilorLuxottica LOA decks (PDF or PPTX) into structured records,
one per page/slide, ready for DB insertion and RAG indexing.

Supports both formats:
  - PDF  (SharePoint export)  → pdfplumber text + table extraction
  - PPTX (native PowerPoint)  → python-pptx shapes, real tables, pictures

Deck anatomy (validated on June 2024 master 126p + Q2-25 138p):
  cover → [CATEGORY separator: "FRAMES"] → brand overviews
    → [ACTIVITY separator: "TM Tailor Made PERMANENT..."] → LOA slides
    → [...] → [LENSES] → [...] → events/others/backup

Each LOA page yields:
  - identity:   loa_number, sap_event_code
  - context:    section_category, section_activity (inherited from separators)
  - header:     title, country, budget_eur
  - left block: description, tools, brands, clients, timing, kpi,
                cost_drill_down
  - table:      budget_lines (list of dicts, one per brand line)
  - raw_text:   full page text (RAG fallback)
  - content_hash: SHA-256 of normalised text (cross-deck dedup)

Design: PURE (no DB, no network). Input = file path, output = list[dict].
"""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Any


# ════════════════════════════════════════════════════════════════════════
# Canonical vocabularies
# ════════════════════════════════════════════════════════════════════════

CATEGORIES = (
    "Frames + Lenses + Instruments",
    "Frames + Lenses",
    "Lenses + Instruments",
    "Frames",
    "Lenses",
)

ACTIVITY_SEPARATORS = (
    "Tailor Made PERMANENT",
    "Tailor Made SEASONAL",
    "In Store/Consumer Activation",
    "In Store / Consumer Activation",
    "Consumer Activation",
    "Coop Advertising",
    "Trade Incentive",
    "Catalogues & Brochures",
    "Sales Events & Fairs",
    "Commercial Events",
    "Sponsorship",
    "Medical Marketing",
    "Medical Affairs",
    "e-Tools",
    "Training",
    "Events",
    "Others",
    "PR",
)

LEFT_BLOCK_LABELS = {
    "description": "description",
    "tools": "tools",
    "plan": "tools",
    "brands": "brands",
    "clients": "clients",
    "customers": "clients",
    "n° of customers": "clients",
    "nb of doors": "num_doors",
    "timing of installation": "timing",
    "timing": "timing",
    "kpis": "kpi",
    "kpi (if relevant)": "kpi",
    "kpi": "kpi",
    "expected results": "kpi",
    "costs drill down": "cost_drill_down",
    "cost drill down": "cost_drill_down",
    "cost": "cost_drill_down",
    "investment": "cost_drill_down",
    "average investments | door": "avg_per_door",
    "average investments | doors": "avg_per_door",
    "average investment per door": "avg_per_door",
    "# doors": "num_doors",
    "number of doors": "num_doors",
}

_RULES_MARKERS = (
    "GOLDEN RULES", "The Process", "SLIDE TEMPLATE", "BEST PRACTICE",
    "WORST PRACTICE", "ADDITIONAL SLIDES", "Thank you",
)

_FOOTER_RE = re.compile(
    r"Strictly confidential.*?forward\.?\s*\d*\s*$", re.IGNORECASE | re.DOTALL
)
_LOA_NUM_RE = re.compile(r"LOA[\s:#]+#?\s*(\d{4,6})")
_SAP_CODE_RE = re.compile(r"\b(20\d{2}[A-Z0-9]{2,}[A-Z]{2,}\d{3})\b")
_BUDGET_RE = re.compile(
    r"(?:€\s*)?([\d][\d\s.,]*)\s*(K|M)?\s*€|€\s*([\d][\d\s.,]*)\s*(K|M)?",
    re.IGNORECASE,
)


# ════════════════════════════════════════════════════════════════════════
# Text helpers
# ════════════════════════════════════════════════════════════════════════

def _fix_doubled_glyphs(text: str) -> str:
    fixed = []
    for line in text.split("\n"):
        compact = line.replace(" ", "")
        if len(compact) >= 8 and len(compact) % 2 == 0:
            pairs = [compact[i:i+2] for i in range(0, len(compact), 2)]
            if all(p[0] == p[1] for p in pairs):
                fixed.append(compact[::2])
                continue
        fixed.append(line)
    return "\n".join(fixed)


def _clean(text: str) -> str:
    text = _FOOTER_RE.sub("", text)
    text = re.sub(r"[ \t]+", " ", text)
    return text.strip()


def _content_hash(text: str) -> str:
    normalised = re.sub(r"\W+", "", text).lower()
    return hashlib.sha256(normalised.encode()).hexdigest()


def _parse_budget_eur(fragment: str) -> float | None:
    m = _BUDGET_RE.search(fragment)
    if not m:
        return None
    raw = (m.group(1) or m.group(3) or "").strip()
    unit = (m.group(2) or m.group(4) or "").upper()
    if not raw:
        return None
    cleaned = raw.replace(" ", "")
    if unit and "." in cleaned and len(cleaned.split(".")[-1]) in (1, 2):
        value = float(cleaned)
    else:
        value = float(cleaned.replace(".", "").replace(",", "."))
    if unit == "K":
        value *= 1_000
    elif unit == "M":
        value *= 1_000_000
    return value if value > 0 else None


# ════════════════════════════════════════════════════════════════════════
# Page record
# ════════════════════════════════════════════════════════════════════════

@dataclass
class PageRecord:
    source_file: str
    page_index: int
    page_kind: str
    section_category: str | None = None
    section_activity: str | None = None
    title: str | None = None
    country: str | None = None
    budget_eur: float | None = None
    loa_number: str | None = None
    sap_event_code: str | None = None
    description: str | None = None
    tools: str | None = None
    brands: str | None = None
    clients: str | None = None
    timing: str | None = None
    kpi: str | None = None
    cost_drill_down: str | None = None
    budget_lines: list[dict] = field(default_factory=list)
    photo_count: int = 0
    raw_text: str = ""
    content_hash: str = ""

    def to_dict(self) -> dict:
        return asdict(self)


# ════════════════════════════════════════════════════════════════════════
# Classification (shared by PDF and PPTX paths)
# ════════════════════════════════════════════════════════════════════════

def classify_page(text: str, n_tables: int, page_index: int,
                  n_shapes: int = 0) -> str:
    if page_index == 1:
        return "cover"
    stripped = text.strip()
    upper = stripped.upper()
    if any(marker.upper() in upper for marker in _RULES_MARKERS):
        return "rules"
    if "OVERVIEW" in upper and "KEY INVESTMENT" in upper:
        return "overview"
    if "TOTAL SUBMISSION" in upper and len(stripped) < 900:
        return "summary"
    # Separators: short text + few shapes (PPTX: <=5 shapes typical)
    is_short = len(stripped) < 220
    is_sparse = n_shapes > 0 and n_shapes <= 5
    if is_short or is_sparse:
        for cat in CATEGORIES:
            if cat.upper() in upper:
                return "separator_category"
        for act in ACTIVITY_SEPARATORS:
            if re.search(r"\b" + re.escape(act) + r"\b", stripped, re.IGNORECASE):
                return "separator_activity"
        if is_short:
            return "separator_activity"
    return "loa"


def _match_category(text: str) -> str | None:
    upper = text.upper()
    for cat in CATEGORIES:
        if cat.upper() in upper:
            return cat
    return None


def _match_activity(text: str) -> str | None:
    for act in ACTIVITY_SEPARATORS:
        if re.search(r"\b" + re.escape(act) + r"\b", text, re.IGNORECASE):
            return act
    return None


# ════════════════════════════════════════════════════════════════════════
# Header extraction (shared)
# ════════════════════════════════════════════════════════════════════════

_COUNTRY_REJECT_RE = re.compile(
    r"\d|€|K€|M€|DESCRIPTION|DETAIL|TOTAL|BUDGET|OVERVIEW|"
    r"SUBMISSION|HIDDEN|BACK.?UP|PLANNING|DOORS?|EUR\b|VENDOR",
    re.IGNORECASE,
)


def _extract_header(lines: list[str], category_hint: str | None
                    ) -> tuple[str | None, str | None, float | None]:
    title, country, budget = None, None, None
    header_zone = [ln for ln in lines[:6] if ln.strip()]
    for ln in header_zone:
        if country is None:
            probe = ln
            if category_hint and probe.lower().startswith(category_hint.lower()):
                probe = probe[len(category_hint):].strip(" :–-")
            letters = [c for c in probe if c.isalpha()]
            if (probe and letters
                    and sum(c.isupper() for c in letters) / len(letters) > 0.8
                    and len(probe) < 45
                    and not _COUNTRY_REJECT_RE.search(probe)):
                country = probe.strip()
                continue
        if title is None and len(ln) > 12 and (
                ":" in ln or not ln.isupper() or len(ln) > 45):
            title = ln.strip()
    for ln in header_zone:
        b = _parse_budget_eur(ln)
        if b and b >= 1_000:
            budget = b
            break
    if title:
        title = re.sub(r"[\d\s.,]+[KM]?\s*€.*$", "", title).strip(" :–-")
    return title, country, budget


# ════════════════════════════════════════════════════════════════════════
# Left block extraction (shared — works on full page text)
# ════════════════════════════════════════════════════════════════════════

def _extract_left_block(text: str) -> dict[str, str]:
    fields: dict[str, list[str]] = {}
    current: str | None = None
    label_re = re.compile(
        r"^\s*(" + "|".join(
            re.escape(k) for k in sorted(LEFT_BLOCK_LABELS, key=len, reverse=True)
        ) + r")\s*:?\s*(.*)$",
        re.IGNORECASE,
    )
    for line in text.split("\n"):
        m = label_re.match(line)
        if m:
            canonical = LEFT_BLOCK_LABELS[m.group(1).lower()]
            current = canonical
            fields.setdefault(canonical, [])
            rest = m.group(2).strip()
            if rest:
                fields[canonical].append(rest)
        elif current:
            stripped = line.strip()
            if stripped:
                fields[current].append(stripped)
    return {k: " ".join(v).strip() for k, v in fields.items() if v}


# ════════════════════════════════════════════════════════════════════════
# Budget lines — table parsing (shared logic, format-specific inputs)
# ════════════════════════════════════════════════════════════════════════

def _parse_table_rows(rows: list[list[str]]) -> list[dict]:
    """Turn a header + data rows grid into structured dicts."""
    if len(rows) < 2:
        return []
    header = [(c or "").replace("\n", " ").strip().lower() for c in rows[0]]

    def col_for(*needles):
        for i, h in enumerate(header):
            if any(n in h for n in needles):
                return i
        return None

    col_map = {
        "country": col_for("country"),
        "activity": col_for("planning", "type"),
        "cot": col_for("cot"),
        "customer": col_for("customer"),
        "brand": col_for("brand"),
        "detail": col_for("detail", "activity"),
        "num_doors": col_for("door"),
        "avg_per_door": col_for("avg"),
        "vendor": col_for("vendor"),
        "total_eur": col_for("total"),
    }
    quarter_cols = {
        h.upper().replace(" ", ""): i
        for i, h in enumerate(header)
        if re.fullmatch(r"q[1-4][\s\-–]?\d{2}", h.replace(" ", ""))
    }
    lines_out = []
    for row in rows[1:]:
        cells = [(c or "").replace("\n", " ").strip() for c in row]
        if not any(cells):
            continue
        line: dict = {}
        for key, idx in col_map.items():
            if idx is not None and idx < len(cells) and cells[idx]:
                line[key] = cells[idx]
        for qname, idx in quarter_cols.items():
            if idx < len(cells) and cells[idx]:
                line[qname] = cells[idx]
        if line.get("total_eur"):
            parsed = _parse_budget_eur(line["total_eur"])
            if parsed:
                line["total_eur_value"] = parsed
        if line:
            lines_out.append(line)
    return lines_out


# ════════════════════════════════════════════════════════════════════════
# PDF-specific helpers
# ════════════════════════════════════════════════════════════════════════

def _pdf_budget_lines(page: Any) -> list[dict]:
    tables = page.find_tables()
    if not tables:
        return []
    def area(t):
        rows = t.extract()
        return (len(rows) or 0) * (len(rows[0]) if rows else 0)
    rows = max(tables, key=area).extract()
    return _parse_table_rows(rows)


def _walk_pdf(path: Path) -> list[PageRecord]:
    import pdfplumber
    records: list[PageRecord] = []
    cat: str | None = None
    act: str | None = None
    with pdfplumber.open(path) as pdf:
        for i, page in enumerate(pdf.pages, start=1):
            raw = page.extract_text() or ""
            text = _clean(_fix_doubled_glyphs(raw))
            kind = classify_page(text, len(page.find_tables()), i)
            rec = PageRecord(
                source_file=path.name, page_index=i, page_kind=kind,
                raw_text=text, content_hash=_content_hash(text),
            )
            cat, act = _apply_context(rec, text, kind, cat, act, page,
                                      _pdf_budget_lines)
            records.append(rec)
    return records


# ════════════════════════════════════════════════════════════════════════
# PPTX-specific helpers
# ════════════════════════════════════════════════════════════════════════

def _pptx_slide_text(slide: Any) -> str:
    """Concatenate all textbox content from a PPTX slide."""
    parts = []
    for sh in slide.shapes:
        if sh.has_text_frame:
            parts.append(sh.text_frame.text)
    return "\n".join(parts)


def _pptx_budget_lines(slide: Any) -> list[dict]:
    """Extract the widest real PowerPoint table from the slide."""
    best_rows: list[list[str]] = []
    best_area = 0
    for sh in slide.shapes:
        if sh.has_table:
            tbl = sh.table
            rows = []
            for row in tbl.rows:
                rows.append([cell.text for cell in row.cells])
            area = len(rows) * (len(rows[0]) if rows else 0)
            if area > best_area:
                best_rows = rows
                best_area = area
    return _parse_table_rows(best_rows)


def _pptx_photo_count(slide: Any) -> int:
    """Count embedded pictures (type 13 = Picture in python-pptx)."""
    return sum(1 for sh in slide.shapes if sh.shape_type == 13)


def _pptx_table_count(slide: Any) -> int:
    return sum(1 for sh in slide.shapes if sh.has_table)


def _walk_pptx(path: Path) -> list[PageRecord]:
    from pptx import Presentation
    prs = Presentation(str(path))
    records: list[PageRecord] = []
    cat: str | None = None
    act: str | None = None
    for i, slide in enumerate(prs.slides, start=1):
        raw = _pptx_slide_text(slide)
        text = _clean(raw)
        n_shapes = len(slide.shapes)
        kind = classify_page(text, _pptx_table_count(slide), i,
                             n_shapes=n_shapes)
        rec = PageRecord(
            source_file=path.name, page_index=i, page_kind=kind,
            raw_text=text, content_hash=_content_hash(text),
            photo_count=_pptx_photo_count(slide),
        )
        cat, act = _apply_context(rec, text, kind, cat, act, slide,
                                  _pptx_budget_lines)
        records.append(rec)
    return records


# ════════════════════════════════════════════════════════════════════════
# Shared context propagation (used by both walkers)
# ════════════════════════════════════════════════════════════════════════

def _apply_context(rec: PageRecord, text: str, kind: str,
                   cat: str | None, act: str | None,
                   page_or_slide: Any,
                   budget_lines_fn) -> tuple[str | None, str | None]:
    """Update section context from separators; extract LOA data."""
    if kind == "separator_category":
        cat = _match_category(text) or cat
        act = None
    elif kind == "separator_activity":
        matched = _match_activity(text)
        if matched:
            act = matched
        else:
            head = [ln.strip() for ln in text.split("\n") if ln.strip()][:2]
            act = " ".join(head)[:60] or act
        found_cat = _match_category(text)
        if found_cat:
            cat = found_cat
    elif kind == "loa":
        first_line = text.split("\n")[0] if text else ""
        found_cat = _match_category(first_line)
        if found_cat:
            cat = found_cat
        lines = text.split("\n")
        title, country, budget = _extract_header(lines, cat)
        block = _extract_left_block(text)
        loa_m = _LOA_NUM_RE.search(text)
        sap_m = _SAP_CODE_RE.search(text)
        rec.title = title
        rec.country = country
        rec.budget_eur = budget
        rec.loa_number = loa_m.group(1) if loa_m else None
        rec.sap_event_code = sap_m.group(1) if sap_m else None
        rec.description = block.get("description")
        rec.tools = block.get("tools")
        rec.brands = block.get("brands")
        rec.clients = block.get("clients")
        rec.timing = block.get("timing")
        rec.kpi = block.get("kpi")
        rec.cost_drill_down = block.get("cost_drill_down")
        rec.budget_lines = budget_lines_fn(page_or_slide)

        # Fallback: use first budget line's country when header failed
        if not rec.country and rec.budget_lines:
            for bl in rec.budget_lines:
                bl_country = (bl.get("country") or "").strip()
                if bl_country and not _COUNTRY_REJECT_RE.search(bl_country):
                    rec.country = bl_country.upper()
                    break

    rec.section_category = cat
    rec.section_activity = act
    return cat, act


# ════════════════════════════════════════════════════════════════════════
# Public API
# ════════════════════════════════════════════════════════════════════════

def extract_deck(file_path: str | Path) -> list[PageRecord]:
    """
    Extract all pages/slides from a deck. Dispatches by extension:
      .pdf  → pdfplumber
      .pptx → python-pptx
    """
    path = Path(file_path)
    ext = path.suffix.lower()
    if ext == ".pdf":
        return _walk_pdf(path)
    elif ext == ".pptx":
        return _walk_pptx(path)
    else:
        raise ValueError(f"Unsupported format: {ext}. Use .pdf or .pptx")


def deck_report(records: list[PageRecord]) -> str:
    kinds: dict[str, int] = {}
    for r in records:
        kinds[r.page_kind] = kinds.get(r.page_kind, 0) + 1
    loas = [r for r in records if r.page_kind == "loa"]
    with_num = sum(1 for r in loas if r.loa_number)
    with_sap = sum(1 for r in loas if r.sap_event_code)
    with_desc = sum(1 for r in loas if r.description)
    with_lines = sum(1 for r in loas if r.budget_lines)
    with_photos = sum(1 for r in loas if r.photo_count > 0)
    return "\n".join([
        f"pages: {len(records)}",
        "kinds: " + ", ".join(f"{k}={v}" for k, v in sorted(kinds.items())),
        f"loa pages: {len(loas)} | loa#: {with_num} | sap: {with_sap}"
        f" | desc: {with_desc} | budget_lines: {with_lines}"
        f" | photos: {with_photos}",
    ])
