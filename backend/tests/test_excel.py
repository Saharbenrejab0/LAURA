"""
LAURA — tests for the Excel engine
Run with: pytest backend/tests/test_excel.py -v

Rewritten against the current engine API. The previous version targeted
`generate_excel(list[dict])` + `_get_value(loa, "_fy26_total")`, neither of
which survived the rewrite to the `LoaRow` dataclass model — the module had
stopped importing entirely.

Each test below preserves the intent of the one it replaces. Two of them
changed shape for a real reason: Avg Investment/Door and PPT Required are no
longer computed in Python, they are live Excel formulas written into the cell
(so the sheet stays correct when a reviewer edits a budget by hand). There is
no Python value left to assert, so these tests assert the formula instead.
"""

import pytest
from io import BytesIO
import openpyxl

from backend.engines.excel import (
    LoaRow, build_workbook, export_excel_bytes, export_single_loa_row,
    HEADERS, DOORS_COL, AVG_COL, FY_COL, PPT_COL, PPT_THRESHOLD,
    safe_filename,
)


def sample_row(**overrides) -> LoaRow:
    """One representative LOA, mirroring the old SAMPLE_LOA fixture."""
    row = LoaRow(
        cluster="FRANCE",
        country="France Lenses ESSILOR",
        legal_entity="Essilor International",
        activity_type="Tailor Made Seasonal",
        category="Lenses",
        brand="Essilor - Stellest",
        cot="All COT",
        customer="Essilor Experts",
        vendor="ALTAVIA",
        detail="Maximize Stellest visibility",
        doors=800,
        currency="EUR",
        quarters={"Q1-26": 55_000.0, "Q2-26": 35_000.0},
        description="Maximize visibility of Essilor Stellest in-store.",
        tools="Window kit - Instore kit",
        kpi="+10-15% sell-out",
        loa_number="LAURA-2026-001",
        requestor_email="test@essilorluxottica.com",
    )
    for k, v in overrides.items():
        setattr(row, k, v)
    return row


def first_sheet(wb):
    return wb[wb.sheetnames[0]]


class TestCalculatedFields:
    def test_fy_total_sums_the_quarters(self):
        # was: test_fy26_total_correct
        assert sample_row().fy_total() == 90_000

    def test_fy_total_is_zero_when_no_quarters(self):
        # was: test_fy25_total_is_q4_only — the engine no longer models a
        # separate FY-25 total, so the surviving invariant is the empty case.
        assert sample_row(quarters={}).fy_total() == 0

    def test_avg_per_door_is_a_guarded_formula(self):
        # was: test_avg_per_door_correct (asserted 112.5 in Python).
        # 90_000 / 800 = 112.5 is now computed by Excel via this formula.
        ws = first_sheet(build_workbook([sample_row()], include_summary=False))
        assert ws.cell(row=2, column=AVG_COL).value == '=IFERROR(T2/K2,"")'

    def test_avg_per_door_survives_zero_doors(self):
        # was: test_avg_door_zero_when_no_doors. IFERROR is what makes the
        # divide-by-zero render blank instead of #DIV/0!.
        ws = first_sheet(build_workbook([sample_row(doors=0)], include_summary=False))
        assert ws.cell(row=2, column=AVG_COL).value.startswith("=IFERROR(")

    def test_ppt_required_formula_uses_the_threshold(self):
        # was: test_ppt_required_above_50k / test_ppt_not_required_below_50k.
        # YES/NO is decided by Excel now, so the invariant under test is that
        # the threshold is written live and never hardcoded to YES or NO.
        ws = first_sheet(build_workbook([sample_row()], include_summary=False))
        formula = ws.cell(row=2, column=PPT_COL).value
        assert formula == f'=IF(T2>{PPT_THRESHOLD},"YES","NO")'
        assert PPT_THRESHOLD == 50_000

    def test_fy_cell_is_a_live_sum(self):
        ws = first_sheet(build_workbook([sample_row()], include_summary=False))
        assert ws.cell(row=2, column=FY_COL).value.startswith("=SUM(")


class TestExcelGeneration:
    def test_generates_bytes(self):
        result = export_excel_bytes([sample_row()])
        assert isinstance(result, bytes)
        assert len(result) > 0

    def test_readable_by_openpyxl(self):
        wb = openpyxl.load_workbook(BytesIO(export_excel_bytes([sample_row()])))
        assert wb.sheetnames  # at least one sheet

    def test_sheet_title_follows_the_title_option(self):
        # was: assert "LOA Tracker" in sheetnames — the sheet is now named by
        # the caller, and every caller passes its own title.
        wb = build_workbook([sample_row()], title="LOA Tracker", include_summary=False)
        assert "LOA Tracker" in wb.sheetnames

    def test_header_row_populated(self):
        # Header moved from row 2 to row 1 in the rewrite.
        ws = first_sheet(build_workbook([sample_row()], include_summary=False))
        headers = [ws.cell(row=1, column=i).value for i in range(1, len(HEADERS) + 1)]
        assert headers == HEADERS
        assert "Cluster" in headers
        assert "PPT Required" in headers

    def test_data_row_correct_cluster(self):
        # Data starts at row 2 now, and Cluster is column 1.
        ws = first_sheet(build_workbook([sample_row()], include_summary=False))
        assert ws.cell(row=2, column=1).value == "FRANCE"

    def test_multiple_loas(self):
        rows = [sample_row(), sample_row(country="Italy", cluster="ITALY")]
        ws = first_sheet(build_workbook(rows, include_summary=False))
        assert ws.cell(row=3, column=2).value == "Italy"
        assert ws.cell(row=3, column=1).value == "ITALY"

    def test_doors_written_as_a_number(self):
        ws = first_sheet(build_workbook([sample_row()], include_summary=False))
        assert ws.cell(row=2, column=DOORS_COL).value == 800

    def test_split_by_cluster_creates_one_sheet_each(self):
        rows = [sample_row(), sample_row(cluster="ITALY")]
        wb = build_workbook(rows, split_by_cluster=True, include_summary=False)
        assert set(wb.sheetnames) == {"FRANCE", "ITALY"}

    def test_single_loa_export_has_no_summary(self):
        wb = openpyxl.load_workbook(BytesIO(export_single_loa_row(sample_row())))
        assert len(wb.sheetnames) == 1


class TestSecurity:
    def test_user_text_is_neutralised_against_formula_injection(self):
        # The engine documents this guarantee; nothing covered it.
        ws = first_sheet(build_workbook(
            [sample_row(customer="=cmd|'/c calc'!A1")], include_summary=False))
        value = ws.cell(row=2, column=8).value
        assert not str(value).startswith("=")

    def test_safe_filename_strips_path_separators(self):
        assert "/" not in safe_filename("FRANCE/2026")
        assert "\\" not in safe_filename("FRANCE\2026")
