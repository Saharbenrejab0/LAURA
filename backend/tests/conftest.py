"""
Shared fixtures for the LAURA regression suite.

ISOLATION CONTRACT
------------------
These tests run against the real development PostgreSQL database, through the
real SQLAlchemy models and the real FastAPI app - that is deliberate. Mocking
the session would not exercise the CHECK constraints, the partial unique index
or the ON DELETE rules, which are exactly the guarantees under test.

Isolation is therefore achieved by construction, not by mocking:

  * Every row these tests touch is created by these fixtures and deleted in
    teardown. Nothing pre-existing is read for mutation, updated or deleted.
  * Test rows are namespaced: users on @laura-test.invalid, LOAs carrying a
    LAURA-TEST- draft id, and a cycle named "TEST ...", is_test=True.
  * The cycle is an EMERGENCY cycle. Normal cycles are governed by the partial
    unique index uq_one_open_normal_cycle, so opening a second normal cycle
    would collide with the real open cycle. Emergency cycles are exempt, which
    makes an open, writable, submission-accepting cycle possible without
    touching 2026-Q3-N1.
  * Because emergency cycles are confidential (hidden_cycle_ids), every test
    actor is listed in authorized_emails so visibility behaves normally.

Teardown order is forced: LOAs are deleted BEFORE the cycle. loas.cycle_id is
ON DELETE SET NULL, and ck_loa_live_has_cycle forbids a laura_created row with
a NULL cycle - dropping the cycle first would raise on the constraint.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from backend.main import app
from backend.models.database import SessionLocal
from backend.models.loa import LOA, SOURCE_LAURA_CREATED
from backend.models.loa_cycle import LoaCycle
from backend.models.role import Role
from backend.models.user import User
from backend.api.auth import create_token


TEST_EMAIL_DOMAIN = "laura-test.invalid"
TEST_DRAFT_PREFIX = "LAURA-TEST-"


@pytest.fixture(scope="session")
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture(scope="session")
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


# --------------------------------------------------------------------------- #
# Actors                                                                       #
# --------------------------------------------------------------------------- #
class Actor:
    """A disposable user bound to a real role, plus its bearer token."""

    def __init__(self, user: User, role_code: str, token: str):
        self.id = user.id
        self.email = user.email
        self.role_code = role_code
        self.token = token

    @property
    def headers(self) -> dict:
        return {"Authorization": f"Bearer {self.token}"}

    def __repr__(self) -> str:
        return f"<Actor {self.role_code}>"


@pytest.fixture(scope="session")
def make_actor(db):
    """Factory: make_actor('france_marketer') -> Actor. Cleaned up at session end."""
    created: list = []

    def _make(role_code: str, legacy_role: str = "editor", cluster=None) -> Actor:
        role = db.query(Role).filter(Role.code == role_code).first()
        assert role is not None, (
            "role " + repr(role_code) + " is not seeded in this database; "
            "the authorization tests describe roles that must exist"
        )
        user = User(
            id=uuid.uuid4(),
            email="test-" + role_code + "-" + uuid.uuid4().hex[:8] + "@" + TEST_EMAIL_DOMAIN,
            full_name="TEST " + role_code,
            hashed_password="x" * 20,   # never used: tests mint tokens directly
            role=legacy_role,
            cluster=cluster,
            role_id=role.id,
            is_active=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        created.append(user.id)
        return Actor(user, role_code, create_token(user))

    yield _make

    for uid in created:
        db.query(User).filter(User.id == uid).delete(synchronize_session=False)
    db.commit()


@pytest.fixture(scope="session")
def bad_token_headers() -> dict:
    return {"Authorization": "Bearer not.a.real.token"}


# --------------------------------------------------------------------------- #
# Cycle + LOA factory                                                          #
# --------------------------------------------------------------------------- #
TEST_CYCLE_NAME_PREFIX = "TEST regression cycle "


@pytest.fixture(scope="session", autouse=True)
def sweep_stale_fixtures(db):
    """Delete fixture rows left behind by a previous run that crashed.

    Strictly namespaced: only emergency cycles flagged is_test whose name
    carries the suite's prefix, only users on the suite's domain, and only
    LOAs carrying the suite's draft-id prefix. Nothing outside that namespace
    is examined, let alone deleted.
    """
    stale = (
        db.query(LoaCycle)
        .filter(LoaCycle.name.like(TEST_CYCLE_NAME_PREFIX + "%"),
                LoaCycle.is_test.is_(True),
                LoaCycle.cycle_type == "emergency")
        .all()
    )
    for cycle in stale:
        db.execute(text("DELETE FROM ppt_slides WHERE loa_id IN "
                        "(SELECT id FROM loas WHERE cycle_id = :cid)"),
                   {"cid": cycle.id})
        db.query(LOA).filter(LOA.cycle_id == cycle.id).delete(synchronize_session=False)
        db.commit()
        db.query(LoaCycle).filter(LoaCycle.id == cycle.id).delete(synchronize_session=False)
    db.query(User).filter(User.email.like("%@" + TEST_EMAIL_DOMAIN)).delete(
        synchronize_session=False)
    db.query(LOA).filter(LOA.loa_draft_id.like(TEST_DRAFT_PREFIX + "%")).delete(
        synchronize_session=False)
    db.commit()


@pytest.fixture(scope="session")
def test_cycle(db, sweep_stale_fixtures):
    """An open, writable, submission-accepting cycle owned by the test suite."""
    cycle = LoaCycle(
        id=uuid.uuid4(),
        name=TEST_CYCLE_NAME_PREFIX + uuid.uuid4().hex[:6] + " - delete me",
        cycle_type="emergency",
        status="open",
        start_date=datetime.utcnow() - timedelta(days=1),
        end_date=datetime.utcnow() + timedelta(days=30),
        is_active=True,
        created_by="suite@" + TEST_EMAIL_DOMAIN,
        is_test=True,
        emergency_reason="Automated regression suite fixture.",
        authorized_emails=[],
    )
    db.add(cycle)
    db.commit()

    yield cycle

    # LOAs first - see module docstring.
    db.execute(text("DELETE FROM ppt_slides WHERE loa_id IN "
                    "(SELECT id FROM loas WHERE cycle_id = :cid)"), {"cid": cycle.id})
    db.query(LOA).filter(LOA.cycle_id == cycle.id).delete(synchronize_session=False)
    db.commit()
    db.query(LoaCycle).filter(LoaCycle.id == cycle.id).delete(synchronize_session=False)
    db.commit()


@pytest.fixture(scope="session")
def authorize_actors(test_cycle, db):
    """Emergency cycles are confidential; let every @laura-test.invalid user in.

    Re-read after each actor is created, so ordering between fixtures does
    not matter.
    """
    def _sync():
        emails = [
            e for (e,) in db.query(User.email)
            .filter(User.email.like("%@" + TEST_EMAIL_DOMAIN)).all()
        ]
        test_cycle.authorized_emails = emails
        db.commit()

    return _sync


@pytest.fixture
def make_loa(db, test_cycle, authorize_actors):
    """Factory for a disposable LOA inside the test cycle.

    Defaults satisfy LOA.validate() so the row can be submitted; override any
    field via keyword. Rows are deleted after each test.
    """
    created: list = []

    def _make(requestor_email: str, status: str = "draft", **overrides) -> LOA:
        authorize_actors()
        fields = dict(
            id=uuid.uuid4(),
            loa_draft_id=TEST_DRAFT_PREFIX + uuid.uuid4().hex[:8].upper(),
            requestor_email=requestor_email,
            cluster="FRANCE",
            country="France",
            legal_entity="Essilor International",
            activity_type="TM_SEASONAL",
            brand="Ray-Ban (RB)",
            category=["Frames"],
            cot="All COT",
            status=status,
            source=SOURCE_LAURA_CREATED,
            cycle_id=test_cycle.id,
            is_demo=False,
            q1_2026=10_000.0,
            # The rest of LOA.validate()'s required set, so the fixture row is
            # submittable by default. Tests that want a submission refused
            # blank one field explicitly rather than relying on an empty row.
            description="TEST why",
            detail="TEST how",
            kpi="TEST kpi",
            start_date="2026-01-01",
            end_date="2026-06-30",
        )
        fields.update(overrides)
        loa = LOA(**fields)
        db.add(loa)
        db.commit()
        db.refresh(loa)
        created.append(loa.id)
        return loa

    yield _make

    if created:
        db.execute(text("DELETE FROM ppt_slides WHERE loa_id = ANY(:ids)"),
                   {"ids": created})
        db.query(LOA).filter(LOA.id.in_(created)).delete(synchronize_session=False)
        db.commit()


@pytest.fixture
def raw_db():
    """A private session, for tests that deliberately provoke IntegrityError.

    A failed commit poisons the session until it is rolled back, so these must
    not share the suite-wide `db` fixture - one constraint test failing would
    otherwise cascade into every test that ran after it.
    """
    session = SessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


@pytest.fixture
def reload(db):
    """Re-read a row from the database, bypassing the identity map."""
    def _reload(loa):
        db.expire_all()
        return db.query(LOA).filter(LOA.id == loa.id).first()
    return _reload
