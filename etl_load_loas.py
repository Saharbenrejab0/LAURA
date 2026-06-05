"""
LAURA — ETL script
Loads historical LOA data from CSV into PostgreSQL laura_db
Usage: python etl_load_loas.py --file "path/to/file.csv"
"""

import csv
import uuid
import argparse
import re
import sys
import os
from datetime import datetime
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# ---------------------------------------------------------------------------
# Bootstrap — make sure backend package is importable
# ---------------------------------------------------------------------------
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__))))
load_dotenv()

from backend.models.loa import LOA, LOAStatus  # noqa: E402

# ---------------------------------------------------------------------------
# DB setup
# ---------------------------------------------------------------------------
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./laura_dev.db")
engine = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)

# ---------------------------------------------------------------------------
# Column indices (0-based) — mapped from the CSV header row
# ---------------------------------------------------------------------------
COL = {
    "loa_number":       0,
    "requestor_email":  1,
    "cluster":          2,
    "country":          3,
    "legal_entity":     4,
    "activity_type":    5,
    "event_type":       6,
    "event_purpose":    7,
    "ppt_slide":        8,   # YES/NO — we recalculate, but log original
    "cot":              9,
    "customer":         10,
    "category":         11,
    "brand":            12,
    "capex_opex":       13,
    "adv_selling":      14,
    "detail":           15,
    "num_customers":    16,
    "num_doors":        17,
    "avg_per_door":     18,  # calculated field — ignored, recalculated
    "vendor":           19,
    "currency":         20,
    "q4_2025":          22,  # col 21 = blank spacer in some rows
    "fy_2025_total":    23,  # calculated — ignored
    "q1_2026":          24,
    "q2_2026":          25,
    "q3_2026":          26,
    "q4_2026":          27,
    "fy_2026_total":    28,  # calculated — ignored
    "start_date":       30,
    "end_date":         31,
}

# ---------------------------------------------------------------------------
# Activity type normalisation map
# ---------------------------------------------------------------------------
ACTIVITY_MAP = {
    "tailor made seasonal":     "Tailor Made Seasonal",
    "tailor made permanent":    "Tailor Made Permanent",
    "coop advertising":         "Coop Advertising",
    "in store / consumer activation": "In Store / Consumer Activation",
    "in store":                 "In Store / Consumer Activation",
    "consumer activation":      "In Store / Consumer Activation",
    "events":                   "Events",
    "trade incentive":          "Trade Incentive",
    "sponsorship":              "Sponsorship",
    "catalogues & brochures":   "Catalogues & Brochures",
    "catalogues":               "Catalogues & Brochures",
    "other adv expenses":       "Other ADV Expenses",
    "other adv":                "Other ADV Expenses",
    "medical affairs":          "Medical Affairs",
    "training":                 "Training",
    "pr":                       "Other ADV Expenses",  # map PR → Other ADV
}

VALID_ACTIVITY_TYPES = {
    "Tailor Made Seasonal", "Tailor Made Permanent", "Coop Advertising",
    "In Store / Consumer Activation", "Events", "Trade Incentive",
    "Sponsorship", "Catalogues & Brochures", "Other ADV Expenses",
    "Medical Affairs", "Training",
}


def normalise_activity(raw: str) -> str:
    """Map raw Excel activity type string to our enum value."""
    cleaned = raw.strip().lower().rstrip()
    # Direct match first
    for key, val in ACTIVITY_MAP.items():
        if cleaned == key:
            return val
    # Partial match fallback
    for key, val in ACTIVITY_MAP.items():
        if key in cleaned:
            return val
    return "Other ADV Expenses"  # safe default


def parse_float(val: str) -> float:
    """Parse European-style numbers like '1.000,50' or '35.000 €' → float."""
    if not val or not val.strip():
        return 0.0
    # Remove currency symbols, spaces, trailing dashes
    cleaned = re.sub(r"[€\$£\xa0\x80]", "", val).strip()
    cleaned = re.sub(r"\s+", "", cleaned)
    if cleaned in ("-", "—", "", "-   ", " -   "):
        return 0.0
    # European format: periods as thousand separators, comma as decimal
    if re.match(r"^\d{1,3}(\.\d{3})+(,\d+)?$", cleaned):
        cleaned = cleaned.replace(".", "").replace(",", ".")
    else:
        cleaned = cleaned.replace(",", "")
    try:
        return float(cleaned)
    except ValueError:
        return 0.0


def parse_int(val: str) -> int | None:
    """Parse integer fields — returns None if empty."""
    if not val or not val.strip():
        return None
    cleaned = re.sub(r"[^\d]", "", val.strip())
    try:
        return int(cleaned) if cleaned else None
    except ValueError:
        return None


def safe_str(val: str, max_len: int = None) -> str | None:
    """Clean string value."""
    if not val or not val.strip():
        return None
    cleaned = val.strip()
    if max_len:
        cleaned = cleaned[:max_len]
    return cleaned


def get(row: list, col: int) -> str:
    """Safe column getter."""
    try:
        return row[col]
    except IndexError:
        return ""


def load_csv(filepath: str) -> list[dict]:
    """
    Read the CSV, skip header rows (rows 1-20), return list of raw rows.
    The file uses ; as delimiter and has a multi-line header block.
    """
    rows = []
    with open(filepath, encoding="utf-8-sig", errors="replace") as f:
        content = f.read()

    # Split on newlines — but the header has embedded newlines in quoted fields
    # We'll use csv.reader which handles this correctly
    lines = list(csv.reader(content.splitlines(), delimiter=";"))

    # Find the first data row: starts when col 0 looks like a number or col 2 looks like a cluster
    data_start = None
    clusters = {"france", "italy", "dach", "iberia", "east", "benelux",
                "nordics", "uk", "middle east", "africa", "south europe",
                "north europe", "central europe"}

    for i, line in enumerate(lines):
        if len(line) < 3:
            continue
        cluster_val = line[2].strip().lower() if len(line) > 2 else ""
        if cluster_val in clusters:
            data_start = i
            break

    if data_start is None:
        print("❌ Could not find data rows — check the file format.")
        sys.exit(1)

    print(f"📄 Header ends at row {data_start}, data starts at row {data_start + 1}")

    for line in lines[data_start:]:
        if len(line) < 5:
            continue
        # Skip fully empty rows
        if not any(cell.strip() for cell in line):
            continue
        rows.append(line)

    return rows


def row_to_loa(row: list) -> LOA | None:
    """Convert a CSV row to a LOA model instance."""
    cluster = safe_str(get(row, COL["cluster"]), 50)
    country = safe_str(get(row, COL["country"]), 100)
    activity_raw = get(row, COL["activity_type"])

    # Skip rows with no meaningful data
    if not cluster and not country:
        return None
    if not activity_raw or not activity_raw.strip():
        return None

    activity_type = normalise_activity(activity_raw)

    loa_id = str(uuid.uuid4())
    draft_id = f"HIST-{loa_id[:8].upper()}"

    loa_number_raw = safe_str(get(row, COL["loa_number"]), 50)

    loa = LOA(
        id=loa_id,
        loa_draft_id=draft_id,
        loa_number=loa_number_raw,
        requestor_email=safe_str(get(row, COL["requestor_email"]), 255) or "unknown@essilor.com",
        cluster=cluster or "Unknown",
        country=country or "Unknown",
        legal_entity=safe_str(get(row, COL["legal_entity"]), 150),
        activity_type=activity_type,
        event_type=safe_str(get(row, COL["event_type"]), 100),
        event_purpose=safe_str(get(row, COL["event_purpose"]), 100),
        cot=safe_str(get(row, COL["cot"]), 100) or "All COT",
        customer=safe_str(get(row, COL["customer"]), 200),
        category=safe_str(get(row, COL["category"]), 100) or "Unknown",
        brand=safe_str(get(row, COL["brand"]), 200) or "Unknown",
        capex_opex=safe_str(get(row, COL["capex_opex"]), 10) or "OpEx",
        adv_selling=safe_str(get(row, COL["adv_selling"]), 20) or "ADV",
        detail=safe_str(get(row, COL["detail"])),
        num_customers=parse_int(get(row, COL["num_customers"])),
        num_doors=parse_int(get(row, COL["num_doors"])),
        vendor=safe_str(get(row, COL["vendor"]), 300),
        currency=safe_str(get(row, COL["currency"]), 5) or "EUR",
        q4_2025=parse_float(get(row, COL["q4_2025"])),
        q1_2026=parse_float(get(row, COL["q1_2026"])),
        q2_2026=parse_float(get(row, COL["q2_2026"])),
        q3_2026=parse_float(get(row, COL["q3_2026"])),
        q4_2026=parse_float(get(row, COL["q4_2026"])),
        start_date=safe_str(get(row, COL["start_date"]), 50),
        end_date=safe_str(get(row, COL["end_date"]), 50),
        status=LOAStatus.APPROVED,   # Historical = already approved
        ai_suggestion_used=False,
    )

    loa.calculate_totals()
    return loa


def main():
    parser = argparse.ArgumentParser(description="LAURA ETL — load historical LOAs")
    parser.add_argument("--file", required=True, help="Path to the CSV file")
    parser.add_argument("--dry-run", action="store_true", help="Parse only, don't write to DB")
    parser.add_argument("--clear", action="store_true", help="Clear existing historical records first")
    args = parser.parse_args()

    if not os.path.exists(args.file):
        print(f"❌ File not found: {args.file}")
        sys.exit(1)

    print(f"📂 Loading file: {args.file}")
    rows = load_csv(args.file)
    print(f"📊 Found {len(rows)} candidate rows")

    loas = []
    skipped = 0
    for i, row in enumerate(rows):
        loa = row_to_loa(row)
        if loa:
            loas.append(loa)
        else:
            skipped += 1

    print(f"✅ Parsed {len(loas)} valid LOAs, skipped {skipped} empty/invalid rows")

    if args.dry_run:
        print("🔍 Dry run — first 3 records:")
        for loa in loas[:3]:
            print(f"   {loa.loa_draft_id} | {loa.country} | {loa.activity_type} | FY26: {loa.fy_2026_total}")
        print("Dry run complete — nothing written to DB.")
        return

    db = Session()
    try:
        if args.clear:
            deleted = db.query(LOA).filter(LOA.loa_draft_id.like("HIST-%")).delete(synchronize_session=False)
            db.commit()
            print(f"🗑️  Cleared {deleted} existing historical records")

        # Batch insert
        batch_size = 100
        total = 0
        for i in range(0, len(loas), batch_size):
            batch = loas[i:i + batch_size]
            db.bulk_save_objects(batch)
            db.commit()
            total += len(batch)
            print(f"   Inserted {total}/{len(loas)} records...")

        print(f"\n🎉 Done — {total} LOAs loaded into laura_db")

        # Summary stats
        result = db.execute(text("SELECT cluster, COUNT(*) FROM loas WHERE loa_draft_id LIKE 'HIST-%' GROUP BY cluster ORDER BY COUNT(*) DESC"))
        print("\n📈 Records by cluster:")
        for row in result:
            print(f"   {row[0]:<20} {row[1]}")

    except Exception as e:
        db.rollback()
        print(f"❌ Error during insert: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
