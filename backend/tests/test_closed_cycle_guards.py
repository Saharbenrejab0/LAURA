"""
A closed cycle is an archive. Every write to its LOAs must be refused.

`assert_cycle_open_for_writes()` has existed for a while and returned the right
423 — it was simply called in 1 of 43 write endpoints. Everything else (the
field-level autosave, commenting, review verdicts, stage approvals,
force-status, delete, photo upload) still wrote happily to archived data.

These tests build a throwaway closed cycle with one LOA in it, fire every
guarded endpoint at it, and assert 423. Nothing pre-existing is touched: the
fixture creates its own cycle and LOA and deletes both afterwards.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.models.database import SessionLocal
from backend.models.loa import LOA, SOURCE_LAURA_CREATED
from backend.models.loa_cycle import LoaCycle
from backend.models.role import Role
from backend.models.user import User
from backend.api.auth import create_token


client = TestClient(app)


@pytest.fixture(scope="module")
def admin_token():
    db = SessionLocal()
    try:
        user = (
            db.query(User)
            .join(Role, Role.id == User.role_id)
            .filter(Role.can_override_lock == True)  # noqa: E712
            .first()
        )
        assert user is not None, "no super-admin in the database"
        return create_token(user)
    finally:
        db.close()


@pytest.fixture
def closed_cycle_loa():
    """A closed cycle holding one LOA. Both are deleted on teardown.

    `ck_loa_live_has_cycle` requires a laura_created row to carry a cycle, so
    this is the only shape that can sit inside a cycle at all.
    """
    db = SessionLocal()
    cycle = LoaCycle(
        id=uuid.uuid4(),
        name="TEST guard cycle — delete me",
        cycle_type="normal",
        start_date=datetime.utcnow() - timedelta(days=30),
        end_date=datetime.utcnow() - timedelta(days=1),
        is_active=False,
        status="closed",
        closed_at=datetime.utcnow(),
        closed_by="test@laura.local",
        created_by="test@laura.local",
        is_test=True,
    )
    db.add(cycle)
    db.flush()

    loa = LOA(
        id=uuid.uuid4(),
        loa_draft_id=f"TEST-GUARD-{uuid.uuid4().hex[:6].upper()}",
        requestor_email="test@laura.local",
        cluster="FRANCE",
        country="France",
        activity_type="TM_SEASONAL",
        brand="Ray-Ban (RB)",
        category=["Frames"],
        cot="All COT",
        status="approved",
        source=SOURCE_LAURA_CREATED,
        cycle_id=cycle.id,
        is_demo=False,
        q1_2026=1000.0,
    )
    db.add(loa)
    db.commit()

    ids = (str(cycle.id), str(loa.id))
    try:
        yield ids
    finally:
        db.query(LOA).filter(LOA.id == loa.id).delete(synchronize_session=False)
        db.query(LoaCycle).filter(LoaCycle.id == cycle.id).delete(synchronize_session=False)
        db.commit()
        db.close()


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


# ── Every guarded write path ─────────────────────────────────────────────────
#
# (label, method, url template, json body). 423 = locked, the code
# assert_cycle_open_for_writes raises.
CASES = [
    ("field autosave",   "patch",  "/loa/{loa}/field",                  {"field": "kpi", "value": "hacked"}),
    ("full update",      "patch",  "/loa/{loa}",                        {"cluster": "FRANCE", "country": "France"}),
    ("submit",           "post",   "/loa/{loa}/submit",                 None),
    ("validate/advance", "post",   "/loa/{loa}/validate",               None),
    ("approve alias",    "post",   "/loa/{loa}/approve",                None),
    ("reject",           "post",   "/loa/{loa}/reject",                 {"reason": "no", "choice": "return_to_marketer"}),
    ("legacy comment",   "post",   "/loa/{loa}/comment",                {"comment": "no"}),
    ("lock",             "post",   "/loa/{loa}/lock",                   None),
    ("unlock",           "post",   "/loa/{loa}/unlock",                 None),
    ("delete LOA",       "delete", "/loa/{loa}",                        None),
    ("create comment",   "post",   "/loa/{loa}/comments",               {"content": "no"}),
    ("stage approve",    "post",   "/review-stage/{loa}/approve",       {"stage": "local_alignment"}),
    ("corporate approve","post",   "/corporate/approve/{loa}",          None),
    ("corporate hold",   "post",   "/corporate/hold/{loa}",             None),
    ("corporate rework", "post",   "/corporate/rework/{loa}",           None),
    ("force-status",     "post",   "/admin/loa/{loa}/force-status",     {"new_status": "draft", "reason": "x"}),
    ("review verdict",   "post",   "/review/{cycle}/verdict",           {"loa_id": "{loa}", "decision": "approved"}),
    ("review bulk",      "post",   "/review/{cycle}/bulk-verdict",      {"loa_ids": ["{loa}"], "decision": "rejected", "reason": "no"}),
    ("review comment",   "post",   "/review/{cycle}/comment",           {"slide_id": "{loa}", "text": "no"}),
    ("review submit",    "post",   "/review/{cycle}/submit",            None),
    ("title config",     "put",    "/review/{cycle}/title-config",      {"title": "no"}),
]


@pytest.mark.parametrize("label,method,path,body", CASES, ids=[c[0] for c in CASES])
def test_write_to_closed_cycle_is_refused(closed_cycle_loa, admin_token, label, method, path, body):
    cycle_id, loa_id = closed_cycle_loa
    url = path.format(loa=loa_id, cycle=cycle_id)
    if isinstance(body, dict):
        body = {
            k: (v.format(loa=loa_id) if isinstance(v, str) else
                [i.format(loa=loa_id) if isinstance(i, str) else i for i in v] if isinstance(v, list) else v)
            for k, v in body.items()
        }

    if method == "delete":
        # httpx's delete() takes no request body.
        resp = client.delete(url, headers=_auth(admin_token))
    else:
        resp = getattr(client, method)(url, headers=_auth(admin_token), json=body)

    assert resp.status_code == 423, (
        f"{label} ({method.upper()} {path}) returned {resp.status_code}, expected 423.\n"
        f"body: {resp.text[:300]}"
    )
    assert "closed" in resp.text.lower()


def test_reads_on_a_closed_cycle_still_work(closed_cycle_loa, admin_token):
    """The guard is write-only — an archive you cannot read is not an archive."""
    _, loa_id = closed_cycle_loa
    resp = client.get(f"/loa/{loa_id}", headers=_auth(admin_token))
    assert resp.status_code == 200
    assert resp.json()["loa_draft_id"].startswith("TEST-GUARD-")


def test_duplicate_from_a_closed_cycle_is_allowed(closed_cycle_loa, admin_token):
    """"Use as starting point" must keep working on archived work.

    It reads the closed LOA and writes a NEW draft into the OPEN cycle, so the
    guard must not fire. This is the whole point of the Campaign Library.
    """
    _, loa_id = closed_cycle_loa
    resp = client.post(f"/loa/{loa_id}/duplicate", headers=_auth(admin_token))

    if resp.status_code == 400 and "no open cycle" in resp.text.lower():
        pytest.skip("no open cycle in this database to duplicate into")

    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["status"] == "draft"
    assert data["source_id"] == loa_id

    # Clean up the draft this created.
    db = SessionLocal()
    try:
        db.query(LOA).filter(LOA.id == data["id"]).delete(synchronize_session=False)
        db.commit()
    finally:
        db.close()
