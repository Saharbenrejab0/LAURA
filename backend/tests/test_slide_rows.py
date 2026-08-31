"""
Regression tests for the code-vs-label bugs in the slide/deck path.

Every assertion here failed before 2026-08-26. The shared cause: dicts and sets
keyed by the Title Case DISPLAY LABEL ("Events", "Seasonal Visibility") being
tested against `loas.activity_type`, which holds the canonical CODE ("EVENTS",
"TM_SEASONAL"). Nothing raised — the lookups just silently missed, so events got
the standard layout, Sponsorship kept its door columns, titles printed raw
codes, and the AI's KPI templates never fired.
"""
import io

import pytest
from pptx import Presentation

from backend.reference_data import ACTIVITY_TYPE_LABELS
from backend.engines.ppt import (
    EVENT_LAYOUT_ACTIVITIES, NO_DOOR_ACTIVITIES, ACTIVITY_TO_TAG,
    ROWS_WITH_CONTENT, _paginate_rows, generate_loa_slide,
)
from backend.engines.loa_display import compute_display_title
from backend.engines.ai import KPI_TEMPLATES, _resolve_activities, _kpi_hints


CODES = set(ACTIVITY_TYPE_LABELS)


def _loa(**over):
    base = dict(
        loa_type="standard", activity_type="TM_SEASONAL", brand="Ray-Ban (RB)",
        country="France", currency="EUR", category=["Frames"], cot="All COT",
        description="Drive Varilux penetration", detail="POS kits", kpi="+12%",
        vendor="Altavia", customer="Krys", num_doors=600,
        fy_2026_total=450_000, q1_2026=450_000,
        sap_event_code="SAP-1", event_type="Roadshow", num_customers=300,
    )
    base.update(over)
    return base


def _lines(n, per=50_000):
    return [
        dict(brand=f"Brand{i} (X{i})", fy_2026_total=per, q1_2026=per,
             num_doors=50, vendor="Altavia", detail="window kit")
        for i in range(n)
    ]


# ── The activity sets must hold codes, not labels ────────────────────────────

@pytest.mark.parametrize("name,values", [
    ("EVENT_LAYOUT_ACTIVITIES", EVENT_LAYOUT_ACTIVITIES),
    ("NO_DOOR_ACTIVITIES", NO_DOOR_ACTIVITIES),
    ("ACTIVITY_TO_TAG", set(ACTIVITY_TO_TAG)),
    ("KPI_TEMPLATES", set(KPI_TEMPLATES)),
])
def test_activity_keys_are_canonical_codes(name, values):
    """A label leaking back in here is a silent miss, not an error — catch it."""
    unknown = values - CODES
    assert not unknown, f"{name} holds non-code keys: {sorted(unknown)}"


def test_every_activity_has_kpi_templates():
    """The AI fell back to two generic hints for all 14 activities."""
    assert not CODES - set(KPI_TEMPLATES)


# ── Layout selection actually fires ─────────────────────────────────────────

def test_event_codes_select_the_event_layout():
    assert "EVENTS" in EVENT_LAYOUT_ACTIVITIES
    assert "MEDICAL_AFFAIRS" in EVENT_LAYOUT_ACTIVITIES
    # The old spelling must NOT be what the code matches on.
    assert "Events" not in EVENT_LAYOUT_ACTIVITIES


def test_sponsorship_hides_doors():
    assert "SPONSORSHIP" in NO_DOOR_ACTIVITIES


# ── Titles show labels, never raw codes ─────────────────────────────────────

def test_standard_title_uses_the_label():
    assert compute_display_title(_loa()) == "Seasonal Visibility: Ray-Ban (RB)"


def test_multi_brand_title_uses_the_label():
    title = compute_display_title(_loa(loa_type="multi_brand", brand=None, lines=_lines(2)))
    assert "TM_SEASONAL" not in title
    assert title.startswith("Seasonal Visibility")


def test_coop_advertising_puts_the_customer_first():
    """`activity == "Coop Advertising"` never matched the stored code."""
    title = compute_display_title(_loa(activity_type="COOP_ADVERTISING", customer="Krys"))
    assert title.startswith("Krys")


# ── Pagination: the rule the preview mirrors ─────────────────────────────────

@pytest.mark.parametrize("rows,slides", [
    (1, 1), (2, 1), (3, 1), (4, 2), (6, 2), (9, 2), (12, 2),
])
def test_pagination_page_count(rows, slides):
    assert len(_paginate_rows(list(range(rows)))) == slides


def test_final_page_carries_the_content_rows():
    """The last page holds the last ROWS_WITH_CONTENT rows — it is the one with
    the description and photos, so those rows sit next to their own text."""
    pages = _paginate_rows(list(range(6)))
    assert pages[-1] == [3, 4, 5]
    assert len(pages[-1]) == ROWS_WITH_CONTENT


@pytest.mark.parametrize("rows,slides", [(2, 1), (3, 1), (4, 2), (6, 2), (12, 2)])
def test_generated_deck_slide_count(rows, slides):
    """End to end: the real .pptx has as many slides as the rule promises."""
    pptx = generate_loa_slide(
        _loa(loa_type="multi_brand", brand=None, lines=_lines(rows))
    )
    assert len(Presentation(io.BytesIO(pptx)).slides) == slides


def test_events_never_paginate():
    """`_render_events_layout` does `del rows` — the event columns are LOA-level,
    so an event LOA is one slide however many rows it carries."""
    pptx = generate_loa_slide(
        _loa(loa_type="multi_brand", activity_type="EVENTS", brand=None, lines=_lines(8))
    )
    assert len(Presentation(io.BytesIO(pptx)).slides) == 1


# ── Multi-activity AI input ─────────────────────────────────────────────────

def test_resolve_activities_single():
    assert _resolve_activities("TM_SEASONAL") == ("Seasonal Visibility", ["TM_SEASONAL"])


def test_resolve_activities_joined():
    """A multi-activity LOA has no shared activity, so the form joins each row's
    code with ' + '. Claude must read labels; the templates need the codes."""
    text, codes = _resolve_activities("EVENTS + MEDICAL_AFFAIRS")
    assert text == "Events + Medical Affairs"
    assert codes == ["EVENTS", "MEDICAL_AFFAIRS"]


def test_resolve_activities_accepts_the_old_label():
    """144 historical rows still carry the Title Case spelling."""
    assert _resolve_activities("Seasonal Visibility")[1] == ["TM_SEASONAL"]


def test_kpi_hints_merge_across_activities():
    hints = _kpi_hints(["EVENTS", "MEDICAL_AFFAIRS"])
    assert "Vision Care Champion" in hints          # from MEDICAL_AFFAIRS
    assert "forecasted sales" in hints              # from EVENTS


def test_kpi_hints_fall_back_when_nothing_matches():
    assert _kpi_hints([]) == "X% sell-out uplift · X doors activated"
