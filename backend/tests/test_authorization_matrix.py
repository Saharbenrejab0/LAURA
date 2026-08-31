"""
Authorization regression lock.

The route-permission matrix here is derived from what the code actually
requires, not from an assumption that every mutating route needs the same
permission. LAURA's authorization is DATA, not code: the role_permission
table maps (role, loa_status) -> permission, and compute_permissions reads it.
So the matrix tests below are driven off that table plus the documented
business rules in backend/api/loa.py:

    VALIDATION_STATUSES    = {cmo_cfo_review, corporate_review}   -> 'validate'
    ADVANCE_PHASE_STATUSES = {emea_review, emea_post_global_review,
                              emea_final_review}                  -> 'advance_phase'
    local_alignment / global_review  -> parallel gates, 'comment' is enough
    submit                           -> authorship, not a permission
    corporate/*                      -> 'validate' at the LOA's current status
    review-stage/approve             -> STAGE_ROLES, not the permission matrix

TEST STYLE
----------
The structural test (TestEveryMutatingRouteIsGuarded) inspects the FastAPI
dependency graph rather than firing requests. That is deliberate: firing an
unauthenticated POST /loa CREATES A ROW, so probing it live would write to the
database it is meant to be protecting. Inspecting the graph proves the same
property without side effects, and fails closed when a new route is added.

Isolation: see conftest.py.
"""
from __future__ import annotations

import pytest

from backend.main import app
from backend.api.loa import VALIDATION_STATUSES, ADVANCE_PHASE_STATUSES


MUTATING = {"POST", "PUT", "PATCH", "DELETE"}


# --------------------------------------------------------------------------- #
# Route inventory, built from the live app                                     #
# --------------------------------------------------------------------------- #
def _auth_dependency_names(route) -> set:
    """Every dependency callable reachable from this route, by name."""
    names = set()
    dependant = getattr(route, "dependant", None)
    if dependant is None:
        return names

    stack = list(dependant.dependencies)
    seen = 0
    while stack and seen < 500:          # cheap cycle guard
        seen += 1
        dep = stack.pop()
        if dep.call is not None:
            names.add(getattr(dep.call, "__name__", str(dep.call)))
        stack.extend(dep.dependencies)
    return names


def _is_guarded(route) -> bool:
    names = _auth_dependency_names(route)
    return any("current_user" in n or n.startswith("require_") or n == "_check"
               for n in names)


def _mutating_routes():
    out = []
    for route in app.routes:
        methods = getattr(route, "methods", None)
        if not methods:
            continue
        for method in sorted(methods - {"HEAD", "OPTIONS"}):
            if method in MUTATING:
                out.append((method, route.path, route))
    return sorted(out, key=lambda r: (r[1], r[0]))


MUTATING_ROUTES = _mutating_routes()


# Routes that are unauthenticated ON PURPOSE.
PUBLIC_BY_DESIGN = {
    ("POST", "/auth/login"),      # issues the token; cannot require one
}

# Unauthenticated mutating routes found during the Phase A regression work.
# These are NOT approved exceptions - each is a fail-open gap awaiting a
# decision. Listed so the suite stays green while the defect is visible, and
# so TestEveryMutatingRouteIsGuarded fails the moment a NEW one appears.
KNOWN_UNGUARDED = {
    ("POST",   "/loa"),                          # creates a LOA with no token
    ("POST",   "/loa/ai/suggest"),               # bills the Anthropic API
    ("POST",   "/loa/ai/validate-description"),  # bills the Anthropic API
    ("POST",   "/loa/{loa_id}/photos"),          # writes a file to disk
    ("DELETE", "/loa/{loa_id}/photos/{index}"),  # deletes a file from disk
}


class TestEveryMutatingRouteIsGuarded:
    """Fail-closed structural check over all 53 mutating routes."""

    def test_the_inventory_is_the_expected_size(self):
        """Pins the route count so a new endpoint cannot slip in unnoticed."""
        assert len(MUTATING_ROUTES) == 53

    @pytest.mark.parametrize(
        "method,path",
        [(m, p) for m, p, _ in MUTATING_ROUTES],
        ids=[m + " " + p for m, p, _ in MUTATING_ROUTES])
    def test_route_requires_authentication(self, method, path):
        route = next(r for m, p, r in MUTATING_ROUTES if (m, p) == (method, path))
        key = (method, path)

        if key in PUBLIC_BY_DESIGN:
            pytest.skip("public by design")

        if key in KNOWN_UNGUARDED:
            pytest.xfail(
                "known fail-open gap found in Phase A: this mutating route has "
                "no authentication dependency. Awaiting a decision before Phase C."
            )

        assert _is_guarded(route), (
            method + " " + path + " is a mutating route with no authentication "
            "dependency. Add one, or add it to PUBLIC_BY_DESIGN with a reason."
        )

    def test_no_new_unguarded_routes_appeared(self):
        """The gap list must shrink, never grow."""
        actual = {
            (m, p) for m, p, r in MUTATING_ROUTES
            if not _is_guarded(r) and (m, p) not in PUBLIC_BY_DESIGN
        }
        new = actual - KNOWN_UNGUARDED
        assert not new, "new unguarded mutating route(s): " + str(sorted(new))

        fixed = KNOWN_UNGUARDED - actual
        assert not fixed, (
            "these routes are now guarded - remove them from KNOWN_UNGUARDED: "
            + str(sorted(fixed))
        )


# --------------------------------------------------------------------------- #
# Actors                                                                       #
# --------------------------------------------------------------------------- #
@pytest.fixture(scope="session")
def marketer(make_actor):
    return make_actor("france_marketer", cluster="FRANCE")


@pytest.fixture(scope="session")
def foreign_marketer(make_actor):
    """A marketer scoped to a DIFFERENT cluster than the fixture LOA."""
    return make_actor("italy_marketer", cluster="ITALY")


@pytest.fixture(scope="session")
def admin(make_actor):
    return make_actor("super_admin", legacy_role="admin")


@pytest.fixture(scope="session")
def cmo(make_actor):
    return make_actor("regional_cmo", legacy_role="approver")


@pytest.fixture(scope="session")
def paola(make_actor):
    return make_actor("corporate_paola", legacy_role="approver")


@pytest.fixture(scope="session")
def finance(make_actor):
    return make_actor("france_finance", cluster="FRANCE")


# Guarded, side-effect-free-on-failure endpoints. Every one of these loads the
# LOA and authorizes BEFORE writing, so an unauthorized call changes nothing.
GUARDED_CASES = [
    ("advance",           "post",   "/loa/{id}/validate",         None),
    ("reject",            "post",   "/loa/{id}/reject",           {"reason": "x", "choice": "edit_myself"}),
    ("submit",            "post",   "/loa/{id}/submit",           None),
    ("field autosave",    "patch",  "/loa/{id}/field",            {"field": "kpi", "value": "x"}),
    ("full update",       "patch",  "/loa/{id}",                  {"cluster": "FRANCE", "country": "France"}),
    ("delete",            "delete", "/loa/{id}",                  None),
    ("corporate approve", "post",   "/corporate/approve/{id}",    None),
    ("corporate hold",    "post",   "/corporate/hold/{id}",       None),
    ("corporate rework",  "post",   "/corporate/rework/{id}",     None),
    ("stage approve",     "post",   "/review-stage/{id}/approve", {"stage": "local_alignment"}),
]


def _call(client, method, url, headers=None, body=None):
    """TestClient.delete() rejects json=, so route everything through request()."""
    kwargs = {"headers": headers or {}}
    if body is not None:
        kwargs["json"] = body
    return client.request(method.upper(), url, **kwargs)


class TestUnauthenticatedIsRefused:
    """No token, or a junk token, must never reach business logic."""

    @pytest.mark.parametrize(
        "label,method,path,body", GUARDED_CASES,
        ids=[c[0] for c in GUARDED_CASES])
    def test_no_token_is_401(self, client, make_loa, marketer, reload,
                             label, method, path, body):
        loa = make_loa(requestor_email=marketer.email, status="cmo_cfo_review")
        r = _call(client, method, path.format(id=loa.id), body=body)
        assert r.status_code in (401, 403), (
            label + " allowed an unauthenticated call: " + str(r.status_code))
        assert reload(loa).status == "cmo_cfo_review"

    @pytest.mark.parametrize(
        "label,method,path,body", GUARDED_CASES,
        ids=[c[0] for c in GUARDED_CASES])
    def test_garbage_token_is_401(self, client, make_loa, marketer, reload,
                                  bad_token_headers, label, method, path, body):
        loa = make_loa(requestor_email=marketer.email, status="cmo_cfo_review")
        r = _call(client, method, path.format(id=loa.id),
                  headers=bad_token_headers, body=body)
        assert r.status_code in (401, 403)
        assert reload(loa).status == "cmo_cfo_review"


class TestWrongRoleIsRefused:
    """Authenticated but not entitled: 403, and nothing changes."""

    def test_marketer_cannot_advance_at_a_validation_gate(
            self, client, make_loa, marketer, reload):
        loa = make_loa(requestor_email=marketer.email, status="cmo_cfo_review")
        r = client.post(f"/loa/{loa.id}/validate", headers=marketer.headers)
        assert r.status_code == 403
        assert reload(loa).status == "cmo_cfo_review"

    def test_marketer_cannot_advance_at_an_emea_gate(
            self, client, make_loa, marketer, reload):
        loa = make_loa(requestor_email=marketer.email, status="emea_final_review")
        r = client.post(f"/loa/{loa.id}/validate", headers=marketer.headers)
        assert r.status_code == 403
        assert reload(loa).status == "emea_final_review"

    def test_cmo_cannot_validate_outside_cmo_cfo_review(
            self, client, make_loa, cmo, reload):
        """regional_cmo holds 'validate' at cmo_cfo_review ONLY."""
        loa = make_loa(requestor_email=cmo.email, status="emea_final_review")
        r = client.post(f"/loa/{loa.id}/validate", headers=cmo.headers)
        assert r.status_code == 403
        assert reload(loa).status == "emea_final_review"

    def test_finance_cannot_validate_a_corporate_gate(
            self, client, make_loa, finance, reload):
        loa = make_loa(requestor_email=finance.email, status="corporate_review")
        r = client.post(f"/loa/{loa.id}/validate", headers=finance.headers)
        assert r.status_code == 403
        assert reload(loa).status == "corporate_review"

    def test_corporate_reviewer_cannot_advance_an_emea_gate(
            self, client, make_loa, paola, reload):
        loa = make_loa(requestor_email=paola.email, status="emea_review")
        r = client.post(f"/loa/{loa.id}/validate", headers=paola.headers)
        assert r.status_code == 403
        assert reload(loa).status == "emea_review"

    def test_a_marketer_cannot_submit_someone_elses_loa(
            self, client, make_loa, marketer, foreign_marketer, reload):
        loa = make_loa(requestor_email=marketer.email, status="draft")
        r = client.post(f"/loa/{loa.id}/submit", headers=foreign_marketer.headers)
        assert r.status_code == 403
        assert reload(loa).status == "draft"


class TestPermissionMatrixIsTheSourceOfTruth:
    """compute_permissions must reflect the role_permission table, per status."""

    def test_marketer_owns_their_own_draft(self, db, make_loa, marketer):
        from backend.api.permissions import compute_permissions
        from backend.models.user import User
        loa = make_loa(requestor_email=marketer.email, status="draft")
        user = db.query(User).filter(User.id == marketer.id).first()
        perms = compute_permissions(user, loa, db)
        assert perms["is_author"] and perms["can_edit"] and perms["can_view"]
        assert not perms["can_validate"]

    def test_marketer_is_view_only_once_the_loa_is_in_review(
            self, db, make_loa, marketer):
        from backend.api.permissions import compute_permissions
        from backend.models.user import User
        user = db.query(User).filter(User.id == marketer.id).first()
        for status in sorted(VALIDATION_STATUSES | ADVANCE_PHASE_STATUSES):
            loa = make_loa(requestor_email=marketer.email, status=status)
            perms = compute_permissions(user, loa, db)
            assert perms["can_view"], status
            assert not perms["can_validate"], status
            assert not perms["can_edit"], status

    def test_cmo_validates_only_at_the_cmo_cfo_gate(self, db, make_loa, cmo):
        from backend.api.permissions import compute_permissions
        from backend.models.user import User
        user = db.query(User).filter(User.id == cmo.id).first()

        gate = make_loa(requestor_email=cmo.email, status="cmo_cfo_review")
        assert compute_permissions(user, gate, db)["can_validate"] is True

        for status in ("emea_review", "emea_final_review", "corporate_review"):
            other = make_loa(requestor_email=cmo.email, status=status)
            assert compute_permissions(user, other, db)["can_validate"] is False, status

    def test_corporate_validates_only_at_corporate_review(self, db, make_loa, paola):
        from backend.api.permissions import compute_permissions
        from backend.models.user import User
        user = db.query(User).filter(User.id == paola.id).first()

        gate = make_loa(requestor_email=paola.email, status="corporate_review")
        assert compute_permissions(user, gate, db)["can_validate"] is True

        for status in ("cmo_cfo_review", "emea_final_review"):
            other = make_loa(requestor_email=paola.email, status=status)
            assert compute_permissions(user, other, db)["can_validate"] is False, status

    def test_an_author_regains_edit_on_a_returned_loa(self, db, make_loa, marketer):
        """Rejection/return hands the LOA back to its author."""
        from backend.api.permissions import compute_permissions
        from backend.models.user import User
        user = db.query(User).filter(User.id == marketer.id).first()
        for status in ("rejected", "returned"):
            loa = make_loa(requestor_email=marketer.email, status=status)
            perms = compute_permissions(user, loa, db)
            assert perms["can_edit"] is True, status
            assert perms["is_author"] is True, status

    def test_a_draft_is_private_to_its_author(self, db, make_loa,
                                              marketer, foreign_marketer):
        from backend.api.permissions import compute_permissions
        from backend.models.user import User
        loa = make_loa(requestor_email=marketer.email, status="draft")
        other = db.query(User).filter(User.id == foreign_marketer.id).first()
        perms = compute_permissions(other, loa, db)
        assert perms["can_view"] is False
        assert perms["can_edit"] is False

    def test_a_user_with_no_role_can_do_nothing(self, db, make_loa, marketer):
        """Fail closed: an unroled account is not a partially-privileged account."""
        from backend.api.permissions import compute_permissions
        from backend.models.user import User
        loa = make_loa(requestor_email=marketer.email, status="emea_review")
        stub = User(email="norole@laura-test.invalid", full_name="No Role",
                    hashed_password="x", role="editor", role_id=None)
        perms = compute_permissions(stub, loa, db)
        assert not any([perms["can_view"], perms["can_edit"],
                        perms["can_comment"], perms["can_validate"]])


class TestScopeIsolation:
    """Cluster-scoped roles must not reach another cluster's LOAs."""

    def test_a_foreign_cluster_marketer_has_no_scope_match(
            self, db, make_loa, foreign_marketer):
        from backend.api.permissions import compute_permissions
        from backend.models.user import User
        loa = make_loa(requestor_email="someone@laura-test.invalid",
                       status="emea_review", cluster="FRANCE")
        user = db.query(User).filter(User.id == foreign_marketer.id).first()
        perms = compute_permissions(user, loa, db)
        assert perms["is_scope_match"] is False
        assert perms["can_view"] is False

    def test_an_admin_matches_every_scope(self, db, make_loa, admin):
        from backend.api.permissions import compute_permissions
        from backend.models.user import User
        user = db.query(User).filter(User.id == admin.id).first()
        for cluster in ("FRANCE", "ITALY", "DACH"):
            loa = make_loa(requestor_email="someone@laura-test.invalid",
                           status="emea_review", cluster=cluster)
            assert compute_permissions(user, loa, db)["can_override_lock"] is True
