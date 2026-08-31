"""
LAURA — documented workflow defects.

These tests assert the behavior we believe is CORRECT. They are marked
xfail(strict=True) because the code does not do that yet.

Why strict: when someone fixes the defect the test starts passing, and
strict mode turns an unexpected pass into a failure. That forces whoever
fixed it to come here and delete the marker, so the defect cannot be
quietly resolved and left documented as broken — nor quietly forgotten.

Found during the Phase A architecture baseline (2026-08-27).
"""

import pytest

from backend.models.loa import LOAStatus
from backend.api.loa import WORKFLOW_TRANSITIONS, WORKFLOW_ORDER


ON_HOLD = "on_hold"


@pytest.mark.xfail(
    strict=True,
    reason="on_hold is written by POST /corporate/hold (backend/api/corporate.py) "
           "and rendered by the frontend (types/loa.ts), but was never added to "
           "the backend LOAStatus enum. Pending: confirm on_hold is a real status.",
)
def test_on_hold_is_a_declared_status():
    assert ON_HOLD in {s.value for s in LOAStatus}


@pytest.mark.xfail(
    strict=True,
    reason="on_hold is a dead end: nothing in the backend can move a LOA out of "
           "it once POST /corporate/hold sets it. 0 rows are affected today, so "
           "this is a latent trap, not an active incident. Pending: define where "
           "a held LOA resumes (most likely back to corporate_review).",
)
def test_on_hold_has_an_exit_transition():
    assert ON_HOLD in WORKFLOW_TRANSITIONS


def test_on_hold_is_currently_absent_from_the_happy_path():
    """Guards the above: on_hold is deliberately not a normal workflow step.

    Not xfail — this documents current intended behavior. If on_hold ever
    appears in WORKFLOW_ORDER it is a real design change, not a bug fix.
    """
    assert ON_HOLD not in WORKFLOW_ORDER


def test_every_transition_target_is_a_declared_status():
    """The rest of the workflow table is internally consistent."""
    declared = {s.value for s in LOAStatus}
    for source, target in WORKFLOW_TRANSITIONS.items():
        assert source in declared, f"source status {source!r} not in LOAStatus"
        assert target in declared, f"target status {target!r} not in LOAStatus"


def test_workflow_order_covers_every_transition():
    """WORKFLOW_ORDER is the rollback dropdown; it must not drift from the table."""
    for source, target in WORKFLOW_TRANSITIONS.items():
        assert source in WORKFLOW_ORDER, f"{source!r} missing from WORKFLOW_ORDER"
        assert target in WORKFLOW_ORDER, f"{target!r} missing from WORKFLOW_ORDER"
        assert WORKFLOW_ORDER.index(target) > WORKFLOW_ORDER.index(source), (
            f"{source!r} -> {target!r} moves backwards in WORKFLOW_ORDER"
        )
