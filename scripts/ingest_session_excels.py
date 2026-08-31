"""
LAURA — Historical LOA Excel Ingestion Script
===============================================
Reads EMEA PS LOA session Excels, normalizes values, deduplicates
against existing DB records, and inserts new LOAs.

Usage:
    cd C:\\Users\\sahar\\Desktop\\Laura
    python -m scripts.ingest_session_excels --file data/session_q2_25_backup.xlsx --dry-run
    python -m scripts.ingest_session_excels --file data/session_q2_25_backup.xlsx
    python -m scripts.ingest_session_excels --file data/session_nov_24_final.xlsx
    python -m scripts.ingest_session_excels --all

Place this file at: scripts/ingest_session_excels.py
"""

import argparse
import hashlib
import os
import re
import sys
from datetime import datetime
from pathlib import Path

import pandas as pd

# ── Add project root to path ──
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from backend.models.database import SessionLocal
from backend.models.loa import LOA


# ═══════════════════════════════════════════════════════════════════
# 1. COLUMN MAPPING
# ═══════════════════════════════════════════════════════════════════
# Excel headers are messy (multiline, inconsistent). We match by
# keyword patterns, not exact strings. Order matters: first match wins.

COLUMN_PATTERNS = [
    # (db_column, keyword_pattern_in_header, transform_fn_or_None)
    ("loa_number",                  r"LOA\s*#|LOA\s*number",                          None),
    ("requestor_email",             r"Requestor|e-mail",                               None),
    ("cluster",                     r"^Cluster$",                                      None),
    ("country",                     r"^Country$",                                      None),
    ("legal_entity",                r"Legal\s*Entity",                                 None),
    ("prioritization",              r"PRIORIZATION|PRIORITIZATION",                    None),
    ("activity_type",               r"Type.*Planning.*ACTIVITY|Type.*2\.0",            None),
    ("event_type",                  r"EVENT.*specify\s*type|MEDICAL\s*AFFAIRS.*type",  None),
    ("ppt_slide_required",          r"PPT\s*SLIDE",                                   "bool"),
    ("cot",                         r"^COT$",                                          None),
    ("customer",                    r"^CUSTOMER$",                                     None),
    ("category",                    r"^Category$",                                     None),
    ("brand",                       r"^BRAND$",                                        None),
    ("capex_opex",                  r"CapEx.*OpEx",                                    None),
    ("adv_selling",                 r"ADV.*Selling",                                   None),
    ("detail",                      r"^\s*DETAIL\s*$",                                 None),
    ("num_doors",                   r"#\s*DOORS|DOORS",                                "int"),
    ("avg_investment_per_door",     r"AVG\s*Investment",                               "float"),
    ("vendor",                      r"^VENDOR$",                                       None),
    ("currency",                    r"^CURR",                                          None),
    # ── Quarter columns (order: most specific first) ──
    ("q4_2024",                     r"Q4.24(?!.*net)",                                 "float"),
    ("q1_2025",                     r"Q1.25(?!.*net)",                                 "float"),
    ("q2_2025",                     r"Q2.25(?!.*net)",                                 "float"),
    ("q3_2025",                     r"Q3.25(?!.*net)",                                 "float"),
    ("q4_2025",                     r"Q4.25(?!.*net)",                                 "float"),
    ("h2_2025",                     r"H2.25(?!.*net)",                                 "float"),
    # ── Totals ──
    ("fy_2024_total",               r"TOTAL.*FY.24(?!.*net)",                          "float"),
    ("fy_2025_total",               r"TOTAL.*FY.25(?!.*net)",                          "float"),
    # ── Percentages ──
    ("pct_central_budget",          r"%.*Central.*Regional.*FY.25|%.*supported.*25",   "pct"),
    # ── Dates ──
    ("start_date",                  r"Start\s*Date",                                   "date"),
    ("end_date",                    r"End\s*Date",                                     "date"),
    # ── Cost splits ──
    ("cost_split_lenses",           r"Cost\s*split.*Lenses",                           "pct"),
    ("cost_split_frames",           r"Cost\s*split.*Frames",                           "pct"),
    # ── Forecasted sales ──
    ("forecasted_lenses_sales",     r"Forecasted\s*Lenses",                            "float"),
    ("forecasted_frames_sales",     r"Forecasted\s*Frames",                            "float"),
    ("forecasted_instruments_sales", r"Forecasted\s*Instruments",                      "float"),
    # ── Comment ──
    ("cost_justification",          r"Comment\s*if\s*needed",                          None),
]

# Columns to skip (separators, calculated, neted corpo)
SKIP_PATTERNS = [r"^xx$", r"neted\s*corpo", r"More\s*or\s*less", r"Check\s*of\s*total"]


# ═══════════════════════════════════════════════════════════════════
# 2. NORMALIZATION MAPS
# ═══════════════════════════════════════════════════════════════════
# Keys are lowercase aliases → values are the canonical form in LAURA DB.

CLUSTER_MAP = {
    "france": "FRANCE",
    "fr": "FRANCE",
    "italy": "ITALY",
    "it": "ITALY",
    "dach": "DACH",
    "north": "NORTH",
    "northern europe": "NORTH",
    "east": "EAST",
    "eastern europe": "EAST",
    "meta": "META",
    "middle east": "META",
    "iberia": "IBERIA",
    "south europe": "IBERIA",
    "emea": "EMEA",
}

ACTIVITY_TYPE_MAP = {
    "tailor made seasonal": "TM_SEASONAL",
    "tailor-made seasonal": "TM_SEASONAL",
    "tm seasonal": "TM_SEASONAL",
    "seasonal visibility": "TM_SEASONAL",
    "tailor made permanent": "TM_PERMANENT",
    "tailor-made permanent": "TM_PERMANENT",
    "tm permanent": "TM_PERMANENT",
    "permanent visibility": "TM_PERMANENT",
    "coop advertising": "COOP_ADVERTISING",
    "co-op advertising": "COOP_ADVERTISING",
    "coop": "COOP_ADVERTISING",
    "events": "EVENTS",
    "event": "EVENTS",
    "in store/consumer activation": "IN_STORE",
    "in-store/consumer activation": "IN_STORE",
    "in store": "IN_STORE",
    "in-store": "IN_STORE",
    "consumer activation": "IN_STORE",
    "sponsorship": "SPONSORSHIP",
    "catalogues & brochures": "CATALOGUES_BROCHURES",
    "catalogues and brochures": "CATALOGUES_BROCHURES",
    "catalogue": "CATALOGUES_BROCHURES",
    "other advertising expenses": "OTHER_ADVERTISING",
    "other advertising": "OTHER_ADVERTISING",
    "other": "OTHER",
    "others": "OTHER",
    "pr": "PR",
    "medical affairs": "MEDICAL_AFFAIRS",
    "all frames <50k": "ALL_FRAMES_UNDER_50K",
    "all frames": "ALL_FRAMES_UNDER_50K",
}

BRAND_ALIASES = {
    "rayban": "Ray-Ban",
    "ray ban": "Ray-Ban",
    "ray-ban": "Ray-Ban",
    "rb": "Ray-Ban",
    "oakley": "Oakley",
    "oo": "Oakley",
    "persol": "Persol",
    "po": "Persol",
    "vogue": "Vogue",
    "vo": "Vogue",
    "varilux": "Varilux",
    "crizal": "Crizal",
    "transitions": "Transitions",
    "costa": "Costa",
    "oliver peoples": "Oliver Peoples",
    "prada": "Prada",
    "versace": "Versace",
    "burberry": "Burberry",
    "dolce & gabbana": "Dolce & Gabbana",
    "d&g": "Dolce & Gabbana",
    "tiffany": "Tiffany",
    "armani": "Armani",
    "giorgio armani": "Giorgio Armani",
    "michael kors": "Michael Kors",
    "emporio armani": "Emporio Armani",
    "multibrand": "Multibrand",
    "multi-brand": "Multibrand",
    "essilor": "Essilor",
    "luxottica": "Luxottica",
}


# ═══════════════════════════════════════════════════════════════════
# 3. VALUE TRANSFORMERS
# ═══════════════════════════════════════════════════════════════════

def to_float(val):
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return None
    if isinstance(val, (int, float)):
        return float(val)
    s = str(val).strip().replace(",", "").replace("€", "").replace(" ", "")
    if not s or s in ("-", "N/A", "n/a", "TBD", "#REF!", "#VALUE!", "#N/A"):
        return None
    try:
        return float(s)
    except ValueError:
        return None


def to_int(val):
    f = to_float(val)
    return int(f) if f is not None else None


def to_bool(val):
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return None
    s = str(val).strip().upper()
    return s in ("YES", "Y", "TRUE", "1", "OUI")


def to_pct(val):
    """Convert percentage: '60%' → 60.0, 0.6 → 60.0, 60 → 60.0"""
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return None
    if isinstance(val, (int, float)):
        return float(val) * 100 if val <= 1 else float(val)
    s = str(val).strip().replace("%", "").replace(",", "")
    if not s or s in ("-", "N/A"):
        return None
    try:
        f = float(s)
        return f * 100 if f <= 1 else f
    except ValueError:
        return None


def to_date(val):
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return None
    if isinstance(val, datetime):
        return val.date()
    s = str(val).strip()
    for fmt in ("%d/%m/%y", "%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y", "%d.%m.%Y"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    return None


def clean_str(val):
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return None
    s = str(val).strip()
    return s if s and s not in ("-", "N/A", "n/a", "#REF!") else None


TRANSFORMERS = {
    "float": to_float,
    "int": to_int,
    "bool": to_bool,
    "pct": to_pct,
    "date": to_date,
}


# ═══════════════════════════════════════════════════════════════════
# 4. NORMALIZE FUNCTIONS
# ═══════════════════════════════════════════════════════════════════

def normalize_cluster(raw):
    if not raw:
        return None
    return CLUSTER_MAP.get(raw.strip().lower(), raw.strip().upper())


def normalize_activity_type(raw):
    if not raw:
        return None
    key = raw.strip().lower()
    return ACTIVITY_TYPE_MAP.get(key, raw.strip())


def normalize_brand(raw):
    if not raw:
        return None
    key = raw.strip().lower()
    if key in BRAND_ALIASES:
        return BRAND_ALIASES[key]
    # Try prefix match for compound names like "HB - Ray-Ban"
    for alias, canonical in BRAND_ALIASES.items():
        if alias in key:
            return canonical
    return raw.strip()


# ═══════════════════════════════════════════════════════════════════
# 5. HEADER DETECTION & MAPPING
# ═══════════════════════════════════════════════════════════════════

def map_excel_columns(df_columns):
    """Match Excel column headers to DB fields using regex patterns.
    Returns dict: {excel_col_name: (db_field, transform)}
    """
    mapping = {}
    used_db_fields = set()

    for excel_col in df_columns:
        header = str(excel_col).replace("\n", " ").strip()

        # Check if this column should be skipped
        if any(re.search(pat, header, re.IGNORECASE) for pat in SKIP_PATTERNS):
            continue

        # Find the first matching pattern
        for db_field, pattern, transform in COLUMN_PATTERNS:
            if db_field in used_db_fields:
                continue
            if re.search(pattern, header, re.IGNORECASE):
                mapping[excel_col] = (db_field, transform)
                used_db_fields.add(db_field)
                break

    return mapping


# ═══════════════════════════════════════════════════════════════════
# 6. FINGERPRINTING (deduplication)
# ═══════════════════════════════════════════════════════════════════

def fingerprint(row_dict):
    """Create a dedup key from the most stable fields.
    loa_number is unreliable (often None), so we use a combo."""
    parts = [
        str(row_dict.get("cluster") or "").lower(),
        str(row_dict.get("country") or "").lower(),
        str(row_dict.get("brand") or "").lower(),
        str(row_dict.get("activity_type") or "").lower(),
        str(row_dict.get("detail") or "")[:60].lower(),
        str(row_dict.get("fy_2025_total") or row_dict.get("fy_2024_total") or "0"),
    ]
    raw = "|".join(parts)
    return hashlib.md5(raw.encode()).hexdigest()


def load_existing_fingerprints(db):
    """Build set of fingerprints for all existing historical LOAs."""
    existing = db.query(
        LOA.cluster, LOA.country, LOA.brand,
        LOA.activity_type, LOA.detail,
        LOA.fy_2025_total, LOA.fy_2024_total,
    ).filter(LOA.is_demo == False).all()

    fps = set()
    for row in existing:
        parts = [
            str(row.cluster or "").lower(),
            str(row.country or "").lower(),
            str(row.brand or "").lower(),
            str(row.activity_type or "").lower(),
            str(row.detail or "")[:60].lower(),
            str(row.fy_2025_total or row.fy_2024_total or "0"),
        ]
        fps.add(hashlib.md5("|".join(parts).encode()).hexdigest())

    return fps


# ═══════════════════════════════════════════════════════════════════
# 7. ROW → LOA DICT
# ═══════════════════════════════════════════════════════════════════

def row_to_loa_dict(row, col_mapping, source_filename):
    """Convert a pandas row to a dict of LOA field values."""
    record = {}

    for excel_col, (db_field, transform) in col_mapping.items():
        raw = row.get(excel_col)
        if transform and transform in TRANSFORMERS:
            val = TRANSFORMERS[transform](raw)
        else:
            val = clean_str(raw)
        record[db_field] = val

    # ── Normalize categorical fields ──
    record["cluster"] = normalize_cluster(record.get("cluster"))
    record["activity_type"] = normalize_activity_type(record.get("activity_type"))
    record["brand"] = normalize_brand(record.get("brand"))

    # ── Ensure country is clean ──
    if record.get("country"):
        record["country"] = record["country"].strip()

    # ── Compute description from detail if missing ──
    if not record.get("description") and record.get("detail"):
        record["description"] = record["detail"]

    # ── Metadata fields ──
    record["is_demo"] = False
    record["status"] = "approved"
    record["source_file"] = source_filename
    record["created_at"] = datetime.utcnow()
    record["updated_at"] = datetime.utcnow()

    # ── Calculate fy_2025_total if missing but quarters exist ──
    if not record.get("fy_2025_total"):
        q_sum = sum(filter(None, [
            record.get("q1_2025"),
            record.get("q2_2025"),
            record.get("q3_2025"),
            record.get("q4_2025"),
            record.get("h2_2025"),
        ]))
        if q_sum > 0:
            record["fy_2025_total"] = q_sum

    # ── ppt_slide_required from budget if missing ──
    fy = record.get("fy_2025_total") or record.get("fy_2024_total") or 0
    if record.get("ppt_slide_required") is None:
        record["ppt_slide_required"] = fy > 50000

    # ── Sanitize fields that can overflow or need special types ──

    # loa_number: sometimes multiple numbers stacked with \n — keep first only
    if record.get("loa_number"):
        first_num = str(record["loa_number"]).split("\n")[0].strip()
        record["loa_number"] = first_num[:50] if first_num else None

    # category: DB column is ARRAY(String) — wrap single value in list
    if record.get("category") and isinstance(record["category"], str):
        record["category"] = [record["category"]]

    # Truncate any string field that might overflow varchar limits
    VARCHAR_LIMITS = {
        "loa_number": 50, "cluster": 50, "country": 100, "brand": 100,
        "activity_type": 100, "event_type": 100, "cot": 100, "customer": 255,
        "legal_entity": 255, "vendor": 255, "currency": 10, "capex_opex": 50,
        "adv_selling": 50, "prioritization": 50, "source_file": 255,
        "requestor_email": 255,
    }
    for field, limit in VARCHAR_LIMITS.items():
        val = record.get(field)
        if val and isinstance(val, str) and len(val) > limit:
            record[field] = val[:limit]
            
    return record


# ═══════════════════════════════════════════════════════════════════
# 8. MAIN INGESTION
# ═══════════════════════════════════════════════════════════════════

def find_template_sheet(filepath):
    """Find the TEMPLATE sheet (may have trailing space)."""
    xls = pd.ExcelFile(filepath)
    for name in xls.sheet_names:
        if name.strip().upper() == "TEMPLATE":
            return name
    # Fallback: return first sheet
    return xls.sheet_names[0]


def detect_header_row(filepath):
    """Find which row contains the headers (look for 'LOA' in first 5 rows)."""
    sheet = find_template_sheet(filepath)
    df_peek = pd.read_excel(filepath, sheet_name=sheet, header=None, nrows=5)
    for i, row in df_peek.iterrows():
        row_text = " ".join(str(v) for v in row.values if pd.notna(v))
        if re.search(r"LOA\s*#", row_text, re.IGNORECASE):
            return i
    return 1# default: row 2 (0-indexed = 1)


def ingest_file(filepath, dry_run=False):
    filepath = Path(filepath)
    if not filepath.exists():
        print(f"ERROR: file not found: {filepath}")
        return

    print(f"\n{'='*60}")
    print(f"  Ingesting: {filepath.name}")
    print(f"  Mode: {'DRY RUN' if dry_run else 'LIVE INSERT'}")
    print(f"{'='*60}\n")

    # ── Detect header row ──
    header_row = detect_header_row(filepath)
    print(f"  Header row detected: {header_row + 1} (1-indexed)")

    # ── Read Excel ──
    sheet = find_template_sheet(filepath)
    df = pd.read_excel(filepath, sheet_name=sheet, header=header_row)
    print(f"  Sheet: '{sheet}'")

    print(f"  Raw rows: {len(df)}")

    # ── Drop fully empty rows ──
    df = df.dropna(how="all")
    print(f"  After dropping empty rows: {len(df)}")

    # ── Map columns ──
    col_mapping = map_excel_columns(df.columns)
    mapped_db_fields = [db_f for db_f, _ in col_mapping.values()]
    print(f"  Mapped {len(col_mapping)}/{len(df.columns)} columns:")
    for excel_col, (db_field, transform) in sorted(col_mapping.items(), key=lambda x: x[1][0]):
        t = f" [{transform}]" if transform else ""
        print(f"    {db_field:35s} ← {str(excel_col)[:50]}{t}")

    unmapped = []
    for col in df.columns:
        header = str(col).replace("\n", " ").strip()
        if col not in col_mapping and not any(
            re.search(pat, header, re.IGNORECASE) for pat in SKIP_PATTERNS
        ):
            unmapped.append(header[:60])
    if unmapped:
        print(f"\n  UNMAPPED columns (ignored):")
        for u in unmapped:
            print(f"    - {u}")

    # ── Load existing fingerprints ──
    db = SessionLocal()
    existing_fps = load_existing_fingerprints(db)
    print(f"\n  Existing historical LOAs in DB: {len(existing_fps)}")

    # ── Process rows ──
    inserted = 0
    skipped_dup = 0
    skipped_empty = 0
    errors = []

    for idx, row in df.iterrows():
        try:
            record = row_to_loa_dict(row, col_mapping, filepath.name)

            # Skip rows with no meaningful data
            has_data = any([
                record.get("brand"),
                record.get("detail"),
                record.get("fy_2025_total"),
                record.get("fy_2024_total"),
            ])
            if not has_data:
                skipped_empty += 1
                continue

            # Dedup check
            fp = fingerprint(record)
            if fp in existing_fps:
                skipped_dup += 1
                continue

            # Add to existing set (prevent intra-file duplicates)
            existing_fps.add(fp)

            if not dry_run:
                # Filter out keys that don't exist as LOA columns
                loa_columns = {c.name for c in LOA.__table__.columns}
                clean_record = {k: v for k, v in record.items() if k in loa_columns}
                loa = LOA(**clean_record)
                db.add(loa)

            inserted += 1

            if inserted % 50 == 0:
                if not dry_run:
                    db.commit()
                print(f"    ... processed {inserted} new records")

        except Exception as e:
            errors.append((idx + header_row + 2, str(e)))

    if not dry_run and inserted > 0:
        db.commit()

    db.close()

    # ── Report ──
    print(f"\n  {'─'*40}")
    print(f"  RESULTS for {filepath.name}:")
    print(f"    New LOAs inserted:  {inserted}")
    print(f"    Duplicates skipped: {skipped_dup}")
    print(f"    Empty rows skipped: {skipped_empty}")
    if errors:
        print(f"    Errors: {len(errors)}")
        for row_num, err in errors[:10]:
            print(f"      Row {row_num}: {err[:80]}")
    print(f"  {'─'*40}\n")

    return inserted


# ═══════════════════════════════════════════════════════════════════
# 9. CLI
# ═══════════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(description="LAURA — Ingest LOA session Excels")
    parser.add_argument("--file", type=str, help="Path to a single Excel file")
    parser.add_argument("--all", action="store_true", help="Ingest all files in data/")
    parser.add_argument("--dry-run", action="store_true", help="Parse and report without inserting")
    args = parser.parse_args()

    data_dir = PROJECT_ROOT / "data"

    if args.file:
        ingest_file(args.file, dry_run=args.dry_run)
    elif args.all:
        files = sorted(data_dir.glob("*.xlsx"))
        if not files:
            print(f"No .xlsx files found in {data_dir}")
            return
        total = 0
        for f in files:
            total += ingest_file(f, dry_run=args.dry_run) or 0
        print(f"\nTOTAL NEW LOAS: {total}")
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
