"""
LAURA — tests for the Excel engine
Run with: pytest backend/tests/test_excel.py -v
"""

import pytest
from backend.engines.excel import generate_excel, _get_value
import openpyxl
from io import BytesIO


# Sample LOA dict for testing
SAMPLE_LOA = {
    "id": "test-123",
    "loa_draft_id": "LAURA-2026-001",
    "loa_number": None,
    "requestor_email": "test@essilorluxottica.com",
    "cluster": "FRANCE",
    "country": "France Lenses ESSILOR",
    "legal_entity": "Essilor International",
    "activity_type": "Tailor Made Seasonal",
    "event_type": None,
    "event_purpose": None,
    "cot": "All COT",
    "category": "Lenses",
    "brand": "Essilor - Stellest",
    "capex_opex": "OpEx",
    "adv_selling": "ADV",
    "detail": "Maximize Stellest visibility",
    "customer": "Essilor Experts",
    "vendor": "ALTAVIA",
    "currency": "EUR",
    "num_customers": None,
    "num_doors": 800,
    "q4_2025": 0,
    "q1_2026": 55_000,
    "q2_2026": 35_000,
    "q3_2026": 0,
    "q4_2026": 0,
    "fy_2026_total": 90_000,
    "description": "Maximize visibility of Essilor Stellest in-store.",
    "tools": "Window kit · Instore kit",
    "kpi": "+10-15% sell-out",
    "timing": "H1 2026",
    "start_date": None,
    "end_date": None,
    "cost_drill_down": None,
    "status": "submitted",
    "created_at": "2026-05-13T10:00:00",
}


class TestCalculatedFields:
    def test_fy26_total_correct(self):
        val = _get_value(SAMPLE_LOA, "_fy26_total")
        assert val == 90_000, f"Expected 90000 got {val}"

    def test_fy25_total_is_q4_only(self):
        val = _get_value(SAMPLE_LOA, "_fy25_total")
        assert val == 0  # No Q4-25 in sample

    def test_avg_per_door_correct(self):
        val = _get_value(SAMPLE_LOA, "_avg_per_door")
        assert val == 112.5, f"Expected 112.5 got {val}"

    def test_ppt_required_above_50k(self):
        val = _get_value(SAMPLE_LOA, "_ppt_slide")
        assert val == "YES"

    def test_ppt_not_required_below_50k(self):
        small_loa = {**SAMPLE_LOA, "fy_2026_total": 30_000}
        val = _get_value(small_loa, "_ppt_slide")
        assert val == "NO"

    def test_avg_door_zero_when_no_doors(self):
        no_doors = {**SAMPLE_LOA, "num_doors": 0}
        val = _get_value(no_doors, "_avg_per_door")
        assert val == ""


class TestExcelGeneration:
    def test_generates_bytes(self):
        result = generate_excel([SAMPLE_LOA])
        assert isinstance(result, bytes)
        assert len(result) > 0

    def test_readable_by_openpyxl(self):
        result = generate_excel([SAMPLE_LOA])
        wb = openpyxl.load_workbook(BytesIO(result))
        assert "LOA Tracker" in wb.sheetnames

    def test_header_row_populated(self):
        result = generate_excel([SAMPLE_LOA])
        wb = openpyxl.load_workbook(BytesIO(result))
        ws = wb["LOA Tracker"]
        # Row 2 is header
        headers = [ws.cell(row=2, column=i).value for i in range(1, 5)]
        assert "LOA # / SAP Event Code" in headers

    def test_data_row_correct_cluster(self):
        result = generate_excel([SAMPLE_LOA])
        wb = openpyxl.load_workbook(BytesIO(result))
        ws = wb["LOA Tracker"]
        # Row 3 is first data row — col 3 is Cluster
        assert ws.cell(row=3, column=3).value == "FRANCE"

    def test_multiple_loas(self):
        loas = [SAMPLE_LOA, {**SAMPLE_LOA, "country": "Italy", "cluster": "ITALY"}]
        result = generate_excel(loas)
        wb = openpyxl.load_workbook(BytesIO(result))
        ws = wb["LOA Tracker"]
        assert ws.cell(row=4, column=4).value == "Italy"
