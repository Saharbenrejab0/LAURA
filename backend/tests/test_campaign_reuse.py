"""
"Use as starting point" — the Campaign Library's reuse flow.

`POST /loa/{id}/duplicate` had never been called in this database
(`duplicated_from_id` was NULL on all 2,755 rows), so three defects sat in it
unnoticed. Every test here failed before 2026-08-27:

  1. `ACTIVITY_TYPE_MAP` mapped CODE -> LABEL ("TM_SEASONAL" ->
     "Seasonal Visibility"), backwards. The first duplicate would have written a
     display label into `activity_type`, which `POST /loa` rejects.
  2. `is_demo=True` was hardcoded, flagging every reused LOA as a fixture.
  3. Clearing an unrecognised controlled value returned None, and `cluster`,
     `country`, `cot` and `category` are NOT NULL — so duplicating any of the
     502 historical rows whose cluster the current list rejects ("META",
     "EMEA", "South Europe") raised IntegrityError and 500ed.

The invariant that matters most is at the bottom: a duplicate must not inherit
one bit of the source's workflow state.
"""
from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.models.database import SessionLocal
from backend.models.loa import LOA, SOURCE_LAURA_CREATED, SOURCE_HISTORICAL_IMPORT
from backend.models.role import Role
from backend.models.user import User
from backend.api.auth import create_token
from backend.api.duplicate import _sanitize_field, _cleared_value
from backend.reference_data import ACTIVITY_TYPES


client = TestClient(app)


@pytest.fixture(scope="module")
def admin_token():
    db = SessionLocal()
    try:
        user = (
            db.query(User).join(Role, Role.id == User.role_id)
            .filter(Role.can_override_lock == True)  # noqa: E712
            .first()
        )
        assert user is not None, "no super-admin in the database"
        return create_token(user)
    finally:
        db.close()


def _auth(t):
    return {"Authorization": f"Bearer {t}"}


@pytest.fixture
def created_drafts():
    """Collects draft ids made during a test and deletes them afterwards."""
    ids: list[str] = []
    yield ids
    if ids:
        db = SessionLocal()
        try:
            db.query(LOA).filter(LOA.id.in_(ids)).delete(synchronize_session=False)
            db.commit()
        finally:
            db.close()


# ── The sanitizer, in isolation ─────────────────────────────────────────────

@pytest.mark.parametrize("raw,expected", [
    # A canonical code passes through untouched.
    ("TM_SEASONAL",           "TM_SEASONAL"),
    ("EVENTS",                "EVENTS"),
    # The Title Case labels on 144 historical rows resolve to their code.
    ("Seasonal Visibility",   "TM_SEASONAL"),
    ("Coop Advertising",      "COOP_ADVERTISING"),
    ("Others (non ADV)",      "OTHER"),
    # Legacy spellings reference_data does not know.
    ("Tailor Made Seasonal",  "TM_SEASONAL"),
    ("COOP_ADV",              "COOP_ADVERTISING"),
    # The typo sitting on 3 historical rows.
    ("In-store/ consummer activation", "IN_STORE"),
])
def test_activity_type_resolves_to_a_code(raw, expected):
    """Never to a label — that is the direction the old map had backwards."""
    out = _sanitize_field("activity_type", raw, [])
    assert out == expected
    assert out in ACTIVITY_TYPES, f"{out!r} is not a canonical code"


def test_unresolvable_activity_type_is_cleared_and_flagged():
    warnings: list[dict] = []
    assert _sanitize_field("activity_type", "Interpretive Dance", warnings) is None
    assert [w["severity"] for w in warnings] == ["invalid_cleared"]
    assert "Interpretive Dance" in warnings[0]["message"]


@pytest.mark.parametrize("field,empty", [
    ("cluster", ""), ("country", ""), ("cot", ""),   # NOT NULL text
    ("category", []),                                # NOT NULL array
    ("activity_type", None), ("event_type", None),    # nullable
])
def test_cleared_value_respects_not_null(field, empty):
    assert _cleared_value(field) == empty


def test_invalid_cluster_clears_to_empty_string_not_none():
    """None here is what made the endpoint 500 on 502 historical rows."""
    warnings: list[dict] = []
    assert _sanitize_field("cluster", "META", warnings) == ""
    assert warnings[0]["severity"] == "invalid_cleared"
    assert "META" in warnings[0]["message"]


# ── End to end ──────────────────────────────────────────────────────────────

def _one(db, **filters):
    q = db.query(LOA)
    for k, v in filters.items():
        q = q.filter(getattr(LOA, k) == v)
    return q.first()


def test_duplicate_a_historical_row_with_an_invalid_cluster(admin_token, created_drafts):
    """The case that 500ed: imported row, cluster the current list rejects."""
    db = SessionLocal()
    try:
        src = (
            db.query(LOA)
            .filter(LOA.source == SOURCE_HISTORICAL_IMPORT, LOA.cluster == "META")
            .first()
        )
    finally:
        db.close()
    if src is None:
        pytest.skip("no historical row with cluster 'META' in this database")

    resp = client.post(f"/loa/{src.id}/duplicate", headers=_auth(admin_token))
    assert resp.status_code == 200, resp.text
    data = resp.json()
    created_drafts.append(data["id"])

    cleared = [w for w in data["warnings"] if w["severity"] == "invalid_cleared"]
    assert any(w["field"] == "cluster" for w in cleared), \
        "an unrecognised cluster must be flagged, not silently kept"

    db = SessionLocal()
    try:
        draft = _one(db, id=data["id"])
        # Provenance is re-attributed, never laundered.
        assert draft.source == SOURCE_LAURA_CREATED
        assert draft.import_batch_id is None
        assert draft.source_file is None
        assert draft.cycle_id is not None          # the OPEN cycle
        assert draft.duplicated_from_id == src.id
        # The NOT NULL columns hold an empty value, not NULL.
        assert draft.cluster == ""
        # Dates are not carried — a new campaign needs new dates.
        assert draft.start_date is None and draft.end_date is None
        # Budget IS carried, as a suggestion.
        assert (draft.q1_2026 or 0) == (src.q1_2026 or 0)
        # A real submission, not a fixture.
        assert draft.is_demo is False
    finally:
        db.close()


def test_duplicate_a_valid_loa_flags_nothing(admin_token, created_drafts):
    """A completed-cycle LOA passed LAURA's validation, so nothing is cleared."""
    db = SessionLocal()
    try:
        src = (
            db.query(LOA)
            .filter(
                LOA.source == SOURCE_LAURA_CREATED,
                LOA.cluster.in_(["FRANCE", "ITALY", "DACH", "IBERIA", "NORTH", "EAST", "RUSSIA", "TURKEY"]),
                LOA.activity_type.in_(ACTIVITY_TYPES),
            )
            .first()
        )
    finally:
        db.close()
    if src is None:
        pytest.skip("no fully-valid laura_created LOA in this database")

    resp = client.post(f"/loa/{src.id}/duplicate", headers=_auth(admin_token))
    assert resp.status_code == 200, resp.text
    data = resp.json()
    created_drafts.append(data["id"])

    assert data["warnings_summary"]["invalid_cleared"] == 0
    assert data["warnings_summary"]["auto_fixed"] == 0

    db = SessionLocal()
    try:
        draft = _one(db, id=data["id"])
        assert draft.cluster == src.cluster
        assert draft.activity_type == src.activity_type
        assert draft.cot == src.cot
    finally:
        db.close()


def test_duplicate_inherits_no_workflow_state(admin_token, created_drafts):
    """The whole point: a reused campaign starts over, it does not resume.

    A duplicate of an APPROVED LOA must not arrive approved, must not carry the
    gate flags, and must not keep the original's IA code or timestamps.
    """
    db = SessionLocal()
    try:
        src = _one(db, source=SOURCE_LAURA_CREATED, status="approved") \
            or _one(db, source=SOURCE_HISTORICAL_IMPORT, status="approved")
    finally:
        db.close()
    assert src is not None, "no approved LOA to duplicate"

    resp = client.post(f"/loa/{src.id}/duplicate", headers=_auth(admin_token))
    assert resp.status_code == 200, resp.text
    data = resp.json()
    created_drafts.append(data["id"])

    db = SessionLocal()
    try:
        d = _one(db, id=data["id"])
        assert d.status == "draft"
        assert d.approved_at is None
        assert d.submitted_at is None
        assert d.ia_code is None
        assert d.loa_number is None
        assert not d.cmo_approved and not d.cfo_approved
        assert not d.brand_review_done and not d.function_review_done
        assert not d.finance_review_done and not d.procurement_review_done
        assert not d.compliance_review_done
        assert d.is_locked is False
        assert d.rejection_reason is None and d.cmo_comment is None
        # And it belongs to the caller, not the original author.
        assert d.requestor_email != "" and d.requestor_email is not None
    finally:
        db.close()


def test_duplicate_result_never_carries_import_provenance(admin_token, created_drafts):
    """Reusing history must not turn a live draft into history.

    This is the guarantee the two Campaign Library tabs rest on: the stores
    never flow into each other. Enforced in code by `_NEVER_COPY` and at the
    storage layer by `ck_loa_live_has_cycle`.
    """
    db = SessionLocal()
    try:
        src = _one(db, source=SOURCE_HISTORICAL_IMPORT)
    finally:
        db.close()
    assert src is not None
    assert src.import_batch_id is not None, "pick a batched historical row"

    resp = client.post(f"/loa/{src.id}/duplicate", headers=_auth(admin_token))
    assert resp.status_code == 200, resp.text
    created_drafts.append(resp.json()["id"])

    db = SessionLocal()
    try:
        d = _one(db, id=resp.json()["id"])
        assert d.source == SOURCE_LAURA_CREATED
        assert d.import_batch_id is None
        assert d.cycle_id is not None
    finally:
        db.close()
