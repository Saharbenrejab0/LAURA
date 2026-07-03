"""Smoke test for backend/engines/excel.py — run: python smoke_test.py"""
from io import BytesIO
from openpyxl import load_workbook
import excel as E


class FakeLOA:
    """Simulates a SQLAlchemy LOA row with the real model's attribute names."""
    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)


loa1 = FakeLOA(
    cluster="FRANCE", country="France", legal_entity="EL France SAS",
    activity_type="In Store / Consumer Activation",
    category=["Frames", "Lenses"],
    brand="Ray-Ban", cot="Chains", customer="Optic 2000", vendor="POP Studio",
    detail="Window display refresh Q4",
    num_doors=120, num_customers=1, currency="EUR",
    q4_2025=40000, q1_2026=25000, q2_2026=0, q3_2026=0, q4_2026=0,
    description="Drive sell-out via national window programme",
    tools="Planogram, POS kit", kpi="Sell-out +8%",
    cost_drill_down="Print 18k, Install 22k, Logistics 25k",
    start_date="01/10/2025", end_date="30/06/2026",
    capex_opex="OpEx", adv_selling="ADV", sap_event_code="SAP-2025-0098",
    event_type=None, event_purpose=None,
    cost_split_lenses=None, cost_split_frames=None,
    forecasted_lenses_sales=None, forecasted_frames_sales=None,
    forecasted_instruments_sales=None,
    loa_number="LOA-FR-0421",
    requestor_email="marie.dupont@essilorluxottica.com",
    finance_validator_email="thibault.leroy@essilorluxottica.com",
)

loa2 = FakeLOA(
    cluster="ITALY", country="Italy", legal_entity="Luxottica Srl",
    activity_type="Events",
    category=["Frames"],
    brand="Oakley", cot="All COT", customer="Salmoiraghi", vendor="Eventi SpA",
    detail="Brand roadshow Milan",
    num_doors=0, num_customers=None, currency="EUR",
    q4_2025=0, q1_2026=15000, q2_2026=0, q3_2026=5000, q4_2026=0,
    # Formula-injection attempt
    description="=cmd|'/c calc'!A1",
    tools=None, kpi="Brand awareness +12%",
    cost_drill_down=None,
    start_date="15/01/2026", end_date="30/09/2026",
    capex_opex="OpEx", adv_selling="ADV", sap_event_code=None,
    event_type="Roadshow", event_purpose="Inspirational",
    cost_split_lenses=0.3, cost_split_frames=0.7,
    forecasted_lenses_sales=500, forecasted_frames_sales=1200,
    forecasted_instruments_sales=None,
    loa_number="LOA-IT-0099",
    requestor_email="giulia.rossi@essilorluxottica.com",
    finance_validator_email=None,
)

loa3 = FakeLOA(
    cluster="GERMANY", country="Germany", legal_entity="EL Germany GmbH",
    activity_type="Tailor Made Seasonal",
    category=["Lenses"],
    brand="Essilor", cot="Buying Groups", customer="Apollo", vendor="Frame Atelier",
    detail="Seasonal campaign",
    num_doors=50, num_customers=2, currency="EUR",
    q4_2025=60000, q1_2026=0, q2_2026=40000, q3_2026=0, q4_2026=0,
    description="Q4 seasonal push for Essilor lenses", tools=None, kpi="Volume +15%",
    cost_drill_down="Media 40k, POS 20k, Digital 40k",
    start_date="01/10/2025", end_date="30/06/2026",
    capex_opex="OpEx", adv_selling="ADV", sap_event_code=None,
    event_type=None, event_purpose=None,
    cost_split_lenses=None, cost_split_frames=None,
    forecasted_lenses_sales=None, forecasted_frames_sales=None,
    forecasted_instruments_sales=None,
    loa_number="LOA-DE-0301",
    requestor_email="hans.weber@essilorluxottica.com",
    finance_validator_email=None,
)

# --- Test loa_to_row adapter ---
rows = E.loas_to_rows([loa1, loa2, loa3])

assert rows[0].doors == 120, f"doors mapping: {rows[0].doors}"
assert rows[0].customers == 1
assert rows[0].category == "Frames, Lenses", f"category join: {rows[0].category}"
assert rows[0].quarters == {"Q4-25": 40000.0, "Q1-26": 25000.0}
assert rows[1].quarters == {"Q1-26": 15000.0, "Q3-26": 5000.0}
assert rows[2].quarters == {"Q4-25": 60000.0, "Q2-26": 40000.0}

# --- Test Excel generation ---
data = E.export_excel_bytes(rows, title="LAURA LOA Export")
open("sample.xlsx", "wb").write(data)

wb = load_workbook(BytesIO(data))
ws = wb[wb.sheetnames[0]]

headers = [c.value for c in ws[1]]
assert headers[:6] == ["Cluster", "Country", "Legal Entity",
                       "Type/Planning 2.0", "Category", "Brand"], headers[:6]
assert "FY-26 Total" in headers
assert "Q4-25" in headers and "Q4-26" in headers

fy_idx = headers.index("FY-26 Total") + 1
avg_idx = headers.index("Avg Investment/Door") + 1
ppt_idx = headers.index("PPT Required") + 1
desc_idx = headers.index("Description") + 1

# Row 2 (France): formulas are live
assert str(ws.cell(2, fy_idx).value).startswith("=SUM("), ws.cell(2, fy_idx).value
assert "IFERROR" in str(ws.cell(2, avg_idx).value), ws.cell(2, avg_idx).value
assert str(ws.cell(2, ppt_idx).value).startswith("=IF("), ws.cell(2, ppt_idx).value

# Category multi-select rendered
assert ws.cell(2, 5).value == "Frames, Lenses"

# Formula-injection neutralised (Italy row 3)
inj = ws.cell(3, desc_idx).value
assert ws.cell(3, desc_idx).data_type != "f", "injection became a formula!"
assert str(inj).startswith("'="), repr(inj)

# Freeze panes + autofilter
assert ws.freeze_panes == "A2"
assert ws.auto_filter.ref.startswith("A1:")
assert "Summary" in wb.sheetnames

# Single-row export
one = E.export_single_loa_row(rows[0])
wb1 = load_workbook(BytesIO(one))
assert "Summary" not in wb1.sheetnames
assert len(wb1.sheetnames) == 1

print("OK — all assertions passed")
print("   sheets:", wb.sheetnames)
print("   columns:", len(headers))
