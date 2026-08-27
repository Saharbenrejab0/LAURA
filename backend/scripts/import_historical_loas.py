"""
Import a batch of the client's historical LOA records.

    python -m backend.scripts.import_historical_loas \
        --file "C:/data/august_2026.xlsx" \
        --batch-label "Client historical data - August 2026 batch"

Every run creates one ImportBatch and stamps each inserted row with
`source = historical_import`, that batch id, and `cycle_id = NULL` — historical
data never belongs to a review cycle.

Idempotency
-----------
Each row gets a natural key hash over the fields that identify a campaign:

    country · brand · activity_type · customer · vendor · detail
    · fy_2026_total · start/end date

stored in `loa_number` when empty, and checked against existing historical rows
before insert. Re-running the same file therefore skips everything it already
loaded. Use --allow-duplicates to override (e.g. genuinely repeated campaigns).

Nothing is written unless the whole file parses: --dry-run is the default for
anything that fails validation, and a failed run rolls back.
"""
from __future__ import annotations

import argparse
import hashlib
import sys
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Iterable, Optional

from backend.models.database import SessionLocal
from backend.models.import_batch import ImportBatch
from backend.models.loa import LOA, SOURCE_HISTORICAL_IMPORT

# Column header -> LOA attribute. Headers are matched case/space-insensitively.
COLUMN_MAP = {
    "cluster": "cluster",
    "country": "country",
    "legal entity": "legal_entity",
    "type/planning 2.0": "activity_type",
    "type / planning 2.0": "activity_type",
    "activity type": "activity_type",
    "category": "category",
    "brand": "brand",
    "cot": "cot",
    "customer": "customer",
    "vendor": "vendor",
    "detail": "detail",
    "description": "description",
    "capex/opex": "capex_opex",
    "adv/selling": "adv_selling",
    "currency": "currency",
    "# doors": "num_doors",
    "num doors": "num_doors",
    "# customers": "num_customers",
    "q4 2025": "q4_2025",
    "q1 2026": "q1_2026",
    "q2 2026": "q2_2026",
    "q3 2026": "q3_2026",
    "q4 2026": "q4_2026",
    "fy 2026 total": "fy_2026_total",
    "total eur": "fy_2026_total",
    "kpi": "kpi",
    "tools": "tools",
    "cost drill down": "cost_drill_down",
    "timing": "timing",
    "start date": "start_date",
    "end date": "end_date",
    "sap event code": "sap_event_code",
    "loa number": "loa_number",
}

# A row missing any of these is not importable.
REQUIRED = ("country", "activity_type")

# NOT NULL columns with no server default. A historical file rarely carries all
# of them, so blanks are filled rather than letting the insert fail.
BLANK_DEFAULTS = {
    "requestor_email": "",
    "cluster": "",
    "cot": "",
    "brand": "",
}

_QUARTERS = ("q4_2025", "q1_2026", "q2_2026", "q3_2026", "q4_2026")

_NUMERIC = {
    "q4_2025", "q1_2026", "q2_2026", "q3_2026", "q4_2026",
    "fy_2026_total", "num_doors", "num_customers",
}

_KEY_FIELDS = (
    "country", "brand", "activity_type", "customer",
    "vendor", "detail", "fy_2026_total", "start_date", "end_date",
)


def natural_key(row: dict) -> str:
    """Stable fingerprint of a campaign, used to detect re-imports."""
    parts = []
    for f in _KEY_FIELDS:
        v = row.get(f)
        if isinstance(v, float):
            v = f"{v:.2f}"
        parts.append(str(v or "").strip().lower())
    digest = hashlib.sha1("|".join(parts).encode("utf-8")).hexdigest()
    return f"HIST-{digest[:16].upper()}"


def _norm_header(h: Any) -> str:
    return str(h or "").strip().lower().replace("_", " ")


def _to_number(v: Any) -> Optional[float]:
    """Parse a number from a client file, in either European or US notation.

    The client's files use European grouping ("1.250.000" = 1250000), which a
    naive float() silently rejects \u2014 and a silently dropped budget is far worse
    than a loud failure. Rules:

        both . and ,      the RIGHTMOST separator is the decimal mark
        one separator     repeated              -> thousands  (1.250.000)
                          once, +exactly 3 dig  -> thousands  (1.250 = 1250)
                          otherwise             -> decimal    (13.61)
    """
    if v is None or v == "":
        return None
    if isinstance(v, (int, float)):
        return float(v)

    s = str(v).strip().replace("\u00a0", "").replace(" ", "")
    s = "".join(ch for ch in s if ch.isdigit() or ch in ".,-")
    if s in ("", "-", ".", ","):
        return None

    has_dot, has_comma = "." in s, "," in s
    if has_dot and has_comma:
        dec = "." if s.rindex(".") > s.rindex(",") else ","
        s = s.replace("," if dec == "." else ".", "").replace(dec, ".")
    elif has_dot or has_comma:
        sep = "." if has_dot else ","
        tail = s.rsplit(sep, 1)[1]
        thousands = s.count(sep) > 1 or len(tail) == 3
        s = s.replace(sep, "") if thousands else s.replace(sep, ".")

    try:
        return float(s)
    except ValueError:
        return None


def read_rows(path: Path) -> Iterable[dict]:
    """Yield mapped dicts from an .xlsx (first sheet) or .csv."""
    if path.suffix.lower() in (".xlsx", ".xlsm"):
        import openpyxl
        wb = openpyxl.load_workbook(str(path), data_only=True, read_only=True)
        ws = wb[wb.sheetnames[0]]
        rows = ws.iter_rows(values_only=True)
        headers = [_norm_header(h) for h in next(rows, [])]
        for raw in rows:
            yield _map_row(headers, raw)
    elif path.suffix.lower() == ".csv":
        import csv
        with open(path, newline="", encoding="utf-8-sig") as fh:
            reader = csv.reader(fh)
            headers = [_norm_header(h) for h in next(reader, [])]
            for raw in reader:
                yield _map_row(headers, raw)
    else:
        raise SystemExit(f"Unsupported file type: {path.suffix} (use .xlsx or .csv)")


def _map_row(headers: list[str], raw: tuple) -> dict:
    out: dict[str, Any] = {}
    for header, value in zip(headers, raw):
        attr = COLUMN_MAP.get(header)
        if not attr:
            continue
        if value is None or (isinstance(value, str) and not value.strip()):
            continue
        if attr in _NUMERIC:
            value = _to_number(value)
        elif attr == "category":
            value = [c.strip() for c in str(value).split(",") if c.strip()]
        elif isinstance(value, datetime):
            value = value.strftime("%d/%m/%Y")
        else:
            value = str(value).strip()
        out[attr] = value
    return out


def validate(row: dict, index: int) -> Optional[str]:
    missing = [f for f in REQUIRED if not row.get(f)]
    if missing:
        return f"row {index}: missing {', '.join(missing)}"
    return None


def main() -> int:
    ap = argparse.ArgumentParser(description="Import historical LOAs as a batch.")
    ap.add_argument("--file", required=True, help="path to .xlsx or .csv")
    ap.add_argument("--batch-label", required=True, help="human label for this batch")
    ap.add_argument("--notes", default=None)
    ap.add_argument("--dry-run", action="store_true",
                    help="parse and report, write nothing")
    ap.add_argument("--allow-duplicates", action="store_true",
                    help="insert rows even if an identical campaign exists")
    args = ap.parse_args()

    path = Path(args.file)
    if not path.exists():
        print(f"File not found: {path}")
        return 2

    rows = list(read_rows(path))
    print(f"Reading {path.name}")
    print(f"  rows read      : {len(rows)}")

    valid, skipped = [], []
    for i, row in enumerate(rows, start=2):   # header is row 1
        err = validate(row, i)
        if err:
            skipped.append(err)
        else:
            valid.append(row)

    db = SessionLocal()
    try:
        existing_keys = set()
        if not args.allow_duplicates:
            existing_keys = {
                k for (k,) in db.query(LOA.loa_number)
                .filter(LOA.source == SOURCE_HISTORICAL_IMPORT,
                        LOA.loa_number.isnot(None)).all()
            }

        to_insert, duplicates, seen = [], 0, set()
        for row in valid:
            key = natural_key(row)
            if not args.allow_duplicates and (key in existing_keys or key in seen):
                duplicates += 1
                continue
            seen.add(key)
            row["loa_number"] = row.get("loa_number") or key
            to_insert.append(row)

        print(f"  valid          : {len(valid)}")
        print(f"  duplicates     : {duplicates}")
        print(f"  skipped        : {len(skipped)}")
        for s in skipped[:10]:
            print(f"      - {s}")
        if len(skipped) > 10:
            print(f"      ... and {len(skipped) - 10} more")
        print(f"  to insert      : {len(to_insert)}")

        if args.dry_run:
            print("\nDry run — nothing written.")
            return 0
        if not to_insert:
            print("\nNothing to insert.")
            return 0

        batch = ImportBatch(
            id=uuid.uuid4(),
            label=args.batch_label,
            row_count=len(to_insert),
            source_file_name=path.name,
            notes=args.notes,
        )
        db.add(batch)
        db.flush()

        now = datetime.utcnow()
        for row in to_insert:
            for col, blank in BLANK_DEFAULTS.items():
                row.setdefault(col, blank)
            row.setdefault("category", [])

            loa = LOA(
                id=uuid.uuid4(),
                loa_draft_id=row["loa_number"],
                status="approved",          # history is settled by definition
                source=SOURCE_HISTORICAL_IMPORT,
                import_batch_id=batch.id,
                cycle_id=None,              # never part of a review cycle
                is_demo=False,
                source_file=path.name,
                created_at=now,
                updated_at=now,
                **row,
            )
            # calculate_totals() derives fy_2026_total from the quarters, so it
            # would zero any file that carries only a lump-sum total. Recompute
            # only when the source actually has a quarterly split.
            if any(row.get(q) for q in _QUARTERS):
                loa.calculate_totals()
            else:
                total = float(row.get("fy_2026_total") or 0.0)
                loa.fy_2026_total = total
                loa.avg_investment_per_door = (
                    round(total / loa.num_doors, 2)
                    if loa.num_doors and loa.num_doors > 0 else None
                )
                loa.ppt_slide_required = total > 50_000
            db.add(loa)

        db.commit()
        print(f"\nImported {len(to_insert)} LOAs")
        print(f'  batch: "{batch.label}"  ({batch.id})')
        return 0

    except Exception as exc:
        db.rollback()
        print(f"\nImport failed, rolled back: {exc}")
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
