"""
Regression lock on the LOA workflow, ahead of extracting it into a service.

WHY THIS FILE EXISTS
--------------------
WORKFLOW_TRANSITIONS lives in backend/api/loa.py, but three modules write
loa.status:

    api/loa.py          submit, validate (advance), reject
    api/corporate.py    approve, hold, rework
    api/review_stage.py stage approval

Moving the table without covering all three would leave two writers behind.
These tests freeze the OBSERVED behavior of every path so the extraction can
be proved behavior-preserving.

They assert what the code does today, not what it ought to do - except where a
defect is already known, which is marked xfail(strict=True) and explained.

Isolation: see conftest.py. Every row is created and destroyed by the fixtures.
"""
from __future__ import annotations

import pytest

from backend.api.loa import (
    WORKFLOW_TRANSITIONS, WORKFLOW_ORDER,
    VALIDATION_STATUSES, ADVANCE_PHASE_STATUSES,
)


# --------------------------------------------------------------------------- #
# Actors                                                                       #
# --------------------------------------------------------------------------- #
@pytest.fixture(scope="session")
def marketer(make_actor):
    return make_actor("france_marketer", cluster="FRANCE")


@pytest.fixture(scope="session")
def other_marketer(make_actor):
    return make_actor("france_marketer", cluster="FRANCE")


@pytest.fixture(scope="session")
def admin(make_actor):
    return make_actor("super_admin", legacy_role="admin")


@pytest.fixture(scope="session")
def cmo(make_actor):
    return make_actor("regional_cmo", legacy_role="approver")


@pytest.fixture(scope="session")
def cfo(make_actor):
    return make_actor("regional_cfo", legacy_role="approver")


@pytest.fixture(scope="session")
def paola(make_actor):
    return make_actor("corporate_paola", legacy_role="approver")


@pytest.fixture(scope="session")
def finance(make_actor):
    return make_actor("france_finance", cluster="FRANCE")


@pytest.fixture(scope="session")
def procurement(make_actor):
    return make_actor("france_procurement", cluster="FRANCE")


@pytest.fixture(scope="session")
def compliance(make_actor):
    return make_actor("france_compliance", cluster="FRANCE")


# --------------------------------------------------------------------------- #
# 1. The transition table itself                                               #
# --------------------------------------------------------------------------- #
class TestTransitionTable:
    """Pure structure. No database - these pin the table Phase B will move."""

    def test_the_happy_path_is_exactly_seven_hops(self):
        assert WORKFLOW_TRANSITIONS == {
            "local_alignment":         "emea_review",
            "emea_review":             "global_review",
            "global_review":           "emea_post_global_review",
            "emea_post_global_review": "cmo_cfo_review",
            "cmo_cfo_review":          "emea_final_review",
            "emea_final_review":       "corporate_review",
            "corporate_review":        "approved",
        }

    def test_approved_is_terminal(self):
        """The single most important invariant: nothing advances out of approved."""
        assert "approved" not in WORKFLOW_TRANSITIONS

    def test_terminal_and_restart_states_are_not_advanceable(self):
        for terminal in ("approved", "rejected", "returned", "draft"):
            assert terminal not in WORKFLOW_TRANSITIONS

    def test_the_chain_is_connected_end_to_end(self):
        """Walking from local_alignment reaches approved without a gap."""
        seen, cur = [], "local_alignment"
        while cur in WORKFLOW_TRANSITIONS:
            assert cur not in seen, "cycle detected in WORKFLOW_TRANSITIONS"
            seen.append(cur)
            cur = WORKFLOW_TRANSITIONS[cur]
        assert cur == "approved"
        assert len(seen) == 7

    def test_gate_permission_sets_are_disjoint(self):
        assert not (VALIDATION_STATUSES & ADVANCE_PHASE_STATUSES)

    def test_every_gate_status_is_in_the_transition_table(self):
        for status in VALIDATION_STATUSES | ADVANCE_PHASE_STATUSES:
            assert status in WORKFLOW_TRANSITIONS


# --------------------------------------------------------------------------- #
# 2. api/loa.py - submit                                                       #
# --------------------------------------------------------------------------- #
class TestSubmit:

    def test_draft_submits_to_local_alignment(self, client, make_loa, marketer, reload):
        loa = make_loa(requestor_email=marketer.email, status="draft")
        r = client.post(f"/loa/{loa.id}/submit", headers=marketer.headers)
        assert r.status_code == 200, r.text
        assert reload(loa).status == "local_alignment"

    def test_rejected_resubmits_to_emea_review(self, client, make_loa, marketer, reload):
        """Legacy path: a rejected LOA skips local_alignment on resubmission."""
        loa = make_loa(requestor_email=marketer.email, status="rejected")
        r = client.post(f"/loa/{loa.id}/submit", headers=marketer.headers)
        assert r.status_code == 200, r.text
        assert reload(loa).status == "emea_review"

    def test_returned_restarts_at_local_alignment(self, client, make_loa, marketer, reload):
        """An EMEA return is a full restart, unlike a reject."""
        loa = make_loa(requestor_email=marketer.email, status="returned")
        r = client.post(f"/loa/{loa.id}/submit", headers=marketer.headers)
        assert r.status_code == 200, r.text
        assert reload(loa).status == "local_alignment"

    def test_only_the_author_may_submit(self, client, make_loa, marketer,
                                        other_marketer, reload):
        loa = make_loa(requestor_email=marketer.email, status="draft")
        r = client.post(f"/loa/{loa.id}/submit", headers=other_marketer.headers)
        assert r.status_code == 403
        assert reload(loa).status == "draft"

    @pytest.mark.parametrize("status", [
        "local_alignment", "emea_review", "global_review",
        "emea_post_global_review", "cmo_cfo_review", "emea_final_review",
        "corporate_review", "approved",
    ])
    def test_mid_chain_statuses_cannot_be_submitted(self, client, make_loa,
                                                    marketer, reload, status):
        """Submit is only for draft / rejected / returned."""
        loa = make_loa(requestor_email=marketer.email, status=status)
        r = client.post(f"/loa/{loa.id}/submit", headers=marketer.headers)
        assert r.status_code == 400
        assert reload(loa).status == status

    def test_incomplete_loa_is_refused_with_validation_errors(
            self, client, make_loa, marketer, reload):
        """Submission runs LOA.validate(); a missing required field blocks it."""
        loa = make_loa(requestor_email=marketer.email, status="draft",
                       legal_entity=None)
        r = client.post(f"/loa/{loa.id}/submit", headers=marketer.headers)
        assert r.status_code == 422
        assert "validation_errors" in str(r.json())
        assert reload(loa).status == "draft"

    def test_submit_with_no_budget_is_refused(self, client, make_loa, marketer, reload):
        loa = make_loa(requestor_email=marketer.email, status="draft", q1_2026=0.0)
        r = client.post(f"/loa/{loa.id}/submit", headers=marketer.headers)
        assert r.status_code == 422
        assert reload(loa).status == "draft"


# --------------------------------------------------------------------------- #
# 3. api/loa.py - validate / advance                                           #
# --------------------------------------------------------------------------- #
class TestAdvance:

    def test_approved_cannot_be_advanced(self, client, make_loa, admin, reload):
        """NO BACKWARD OR FORWARD MOVEMENT AFTER APPROVAL.

        Guarded by 'approved' being absent from WORKFLOW_TRANSITIONS. This is
        the behavior that must survive Phase B untouched.
        """
        loa = make_loa(requestor_email=admin.email, status="approved")
        r = client.post(f"/loa/{loa.id}/validate", headers=admin.headers)
        assert r.status_code == 400
        assert reload(loa).status == "approved"

    @pytest.mark.parametrize("status", ["draft", "rejected", "returned"])
    def test_non_chain_statuses_cannot_be_advanced(self, client, make_loa,
                                                   admin, reload, status):
        loa = make_loa(requestor_email=admin.email, status=status)
        r = client.post(f"/loa/{loa.id}/validate", headers=admin.headers)
        assert r.status_code == 400
        assert reload(loa).status == status

    def test_emea_review_advances_to_global_review(self, client, make_loa,
                                                   admin, reload):
        loa = make_loa(requestor_email=admin.email, status="emea_review")
        r = client.post(f"/loa/{loa.id}/validate", headers=admin.headers)
        assert r.status_code == 200, r.text
        # Skip detection may jump past global_review when no reviewer exists
        # for the brand/function; both outcomes are forward moves.
        assert reload(loa).status in ("global_review", "emea_post_global_review")

    def test_emea_post_global_advances_to_cmo_cfo(self, client, make_loa,
                                                  admin, reload):
        loa = make_loa(requestor_email=admin.email, status="emea_post_global_review")
        r = client.post(f"/loa/{loa.id}/validate", headers=admin.headers)
        assert r.status_code == 200, r.text
        assert reload(loa).status == "cmo_cfo_review"

    def test_emea_final_advances_to_corporate(self, client, make_loa, admin, reload):
        loa = make_loa(requestor_email=admin.email, status="emea_final_review")
        r = client.post(f"/loa/{loa.id}/validate", headers=admin.headers)
        assert r.status_code == 200, r.text
        assert reload(loa).status == "corporate_review"

    def test_corporate_review_advances_to_approved_and_stamps_time(
            self, client, make_loa, admin, reload):
        loa = make_loa(requestor_email=admin.email, status="corporate_review")
        r = client.post(f"/loa/{loa.id}/validate", headers=admin.headers)
        assert r.status_code == 200, r.text
        fresh = reload(loa)
        assert fresh.status == "approved"
        assert fresh.approved_at is not None

    def test_a_locked_loa_cannot_advance(self, client, make_loa, admin, reload):
        loa = make_loa(requestor_email=admin.email,
                       status="emea_final_review", is_locked=True)
        r = client.post(f"/loa/{loa.id}/validate", headers=admin.headers)
        assert r.status_code == 423
        assert reload(loa).status == "emea_final_review"

    def test_unknown_loa_is_404(self, client, admin):
        r = client.post(
            "/loa/00000000-0000-0000-0000-000000000000/validate",
            headers=admin.headers)
        assert r.status_code == 404


# --------------------------------------------------------------------------- #
# 4. api/loa.py - parallel gates                                               #
# --------------------------------------------------------------------------- #
class TestParallelGates:
    """A gate advances only when every required side has signed off."""

    def test_cmo_alone_does_not_advance(self, client, make_loa, cmo, reload):
        loa = make_loa(requestor_email=cmo.email, status="cmo_cfo_review")
        r = client.post(f"/loa/{loa.id}/validate", headers=cmo.headers)
        assert r.status_code == 200, r.text
        fresh = reload(loa)
        assert fresh.status == "cmo_cfo_review", "one approval must not advance the gate"
        assert fresh.cmo_approved is True
        assert not fresh.cfo_approved

    def test_cmo_then_cfo_advances(self, client, make_loa, cmo, cfo, reload):
        loa = make_loa(requestor_email=cmo.email, status="cmo_cfo_review")
        assert client.post(f"/loa/{loa.id}/validate",
                           headers=cmo.headers).status_code == 200
        assert reload(loa).status == "cmo_cfo_review"
        assert client.post(f"/loa/{loa.id}/validate",
                           headers=cfo.headers).status_code == 200
        assert reload(loa).status == "emea_final_review"

    def test_local_alignment_needs_all_three_sides(
            self, client, make_loa, finance, procurement, compliance, reload):
        loa = make_loa(requestor_email=finance.email, status="local_alignment")

        assert client.post(f"/loa/{loa.id}/validate",
                           headers=finance.headers).status_code == 200
        assert reload(loa).status == "local_alignment", "finance alone is not enough"

        assert client.post(f"/loa/{loa.id}/validate",
                           headers=procurement.headers).status_code == 200
        assert reload(loa).status == "local_alignment", "two of three is not enough"

        assert client.post(f"/loa/{loa.id}/validate",
                           headers=compliance.headers).status_code == 200
        assert reload(loa).status == "emea_review"

    def test_local_alignment_records_each_side_independently(
            self, client, make_loa, finance, reload):
        loa = make_loa(requestor_email=finance.email, status="local_alignment")
        client.post(f"/loa/{loa.id}/validate", headers=finance.headers)
        fresh = reload(loa)
        assert fresh.finance_review_done is True
        assert not fresh.procurement_review_done
        assert not fresh.compliance_review_done

    def test_admin_completes_every_side_of_local_alignment(
            self, client, make_loa, admin, reload):
        loa = make_loa(requestor_email=admin.email, status="local_alignment")
        r = client.post(f"/loa/{loa.id}/validate", headers=admin.headers)
        assert r.status_code == 200, r.text
        assert reload(loa).status == "emea_review"

    def test_admin_completes_both_sides_of_global_review(
            self, client, make_loa, admin, reload):
        loa = make_loa(requestor_email=admin.email, status="global_review")
        r = client.post(f"/loa/{loa.id}/validate", headers=admin.headers)
        assert r.status_code == 200, r.text
        fresh = reload(loa)
        assert fresh.status == "emea_post_global_review"
        assert fresh.brand_review_done and fresh.function_review_done

    def test_a_marketer_cannot_push_a_gate(self, client, make_loa, marketer, reload):
        """view-only at every review status: the gate must refuse."""
        loa = make_loa(requestor_email=marketer.email, status="local_alignment")
        r = client.post(f"/loa/{loa.id}/validate", headers=marketer.headers)
        assert r.status_code == 403
        assert reload(loa).status == "local_alignment"


# --------------------------------------------------------------------------- #
# 5. api/loa.py - reject / resubmit                                            #
# --------------------------------------------------------------------------- #
class TestReject:

    def test_cmo_cfo_reject_routes_back_to_emea_final(
            self, client, make_loa, cmo, reload):
        loa = make_loa(requestor_email=cmo.email, status="cmo_cfo_review")
        r = client.post(f"/loa/{loa.id}/reject", headers=cmo.headers,
                        json={"reason": "budget too high"})
        assert r.status_code == 200, r.text
        assert reload(loa).status == "emea_final_review"

    def test_emea_reject_returning_to_marketer_sets_returned(
            self, client, make_loa, admin, reload):
        loa = make_loa(requestor_email=admin.email, status="emea_review")
        r = client.post(f"/loa/{loa.id}/reject", headers=admin.headers,
                        json={"reason": "needs rework",
                              "choice": "return_to_marketer"})
        assert r.status_code == 200, r.text
        assert reload(loa).status == "returned"

    def test_emea_reject_editing_myself_keeps_the_status(
            self, client, make_loa, admin, reload):
        loa = make_loa(requestor_email=admin.email, status="emea_review")
        r = client.post(f"/loa/{loa.id}/reject", headers=admin.headers,
                        json={"reason": "I will fix it", "choice": "edit_myself"})
        assert r.status_code == 200, r.text
        assert reload(loa).status == "emea_review"

    def test_a_returned_loa_round_trips_back_into_the_chain(
            self, client, make_loa, admin, marketer, reload):
        """reject -> returned -> author resubmits -> local_alignment."""
        loa = make_loa(requestor_email=marketer.email, status="emea_review")
        client.post(f"/loa/{loa.id}/reject", headers=admin.headers,
                    json={"reason": "rework", "choice": "return_to_marketer"})
        assert reload(loa).status == "returned"
        r = client.post(f"/loa/{loa.id}/submit", headers=marketer.headers)
        assert r.status_code == 200, r.text
        assert reload(loa).status == "local_alignment"

    @pytest.mark.parametrize("status", ["draft", "approved", "returned", "rejected"])
    def test_these_statuses_cannot_be_rejected(self, client, make_loa,
                                               admin, reload, status):
        loa = make_loa(requestor_email=admin.email, status=status)
        r = client.post(f"/loa/{loa.id}/reject", headers=admin.headers,
                        json={"reason": "no", "choice": "edit_myself"})
        assert r.status_code == 400
        assert reload(loa).status == status

    def test_a_reason_is_mandatory(self, client, make_loa, admin, reload):
        loa = make_loa(requestor_email=admin.email, status="emea_review")
        r = client.post(f"/loa/{loa.id}/reject", headers=admin.headers,
                        json={"reason": "   ", "choice": "edit_myself"})
        assert r.status_code == 422
        assert reload(loa).status == "emea_review"

    def test_a_locked_loa_cannot_be_rejected(self, client, make_loa, admin, reload):
        loa = make_loa(requestor_email=admin.email,
                       status="emea_review", is_locked=True)
        r = client.post(f"/loa/{loa.id}/reject", headers=admin.headers,
                        json={"reason": "no", "choice": "edit_myself"})
        assert r.status_code == 423
        assert reload(loa).status == "emea_review"


# --------------------------------------------------------------------------- #
# 6. api/corporate.py - the second status writer                               #
# --------------------------------------------------------------------------- #
class TestCorporatePath:

    def test_approve_sets_approved_and_assigns_an_ia_code(
            self, client, make_loa, paola, reload):
        loa = make_loa(requestor_email=paola.email, status="corporate_review")
        r = client.post(f"/corporate/approve/{loa.id}", headers=paola.headers)
        assert r.status_code == 200, r.text
        fresh = reload(loa)
        assert fresh.status == "approved"
        assert fresh.ia_code and fresh.ia_code.startswith("2026-")
        assert fresh.approved_at is not None

    def test_approve_keeps_an_existing_ia_code(self, client, make_loa, paola, reload):
        loa = make_loa(requestor_email=paola.email,
                       status="corporate_review", ia_code="2026-9999")
        client.post(f"/corporate/approve/{loa.id}", headers=paola.headers)
        assert reload(loa).ia_code == "2026-9999"

    def test_rework_steps_back_to_emea_final_review(
            self, client, make_loa, paola, reload):
        loa = make_loa(requestor_email=paola.email, status="corporate_review")
        r = client.post(f"/corporate/rework/{loa.id}", headers=paola.headers)
        assert r.status_code == 200, r.text
        assert reload(loa).status == "emea_final_review"

    def test_hold_sets_on_hold(self, client, make_loa, paola, reload):
        loa = make_loa(requestor_email=paola.email, status="corporate_review")
        r = client.post(f"/corporate/hold/{loa.id}", headers=paola.headers)
        assert r.status_code == 200, r.text
        assert reload(loa).status == "on_hold"

    def test_a_marketer_cannot_action_corporate_review(
            self, client, make_loa, marketer, reload):
        loa = make_loa(requestor_email=marketer.email, status="corporate_review")
        r = client.post(f"/corporate/approve/{loa.id}", headers=marketer.headers)
        assert r.status_code == 403
        assert reload(loa).status == "corporate_review"

    def test_corporate_endpoints_are_404_for_unknown_loas(self, client, paola):
        for action in ("approve", "hold", "rework"):
            r = client.post(
                f"/corporate/{action}/00000000-0000-0000-0000-000000000000",
                headers=paola.headers)
            assert r.status_code == 404

    @pytest.mark.xfail(
        strict=True,
        reason="backend/api/corporate.py::_authorize checks can_validate at the "
               "LOA's CURRENT status but never checks the LOA is actually at "
               "corporate_review. regional_cmo holds validate at cmo_cfo_review, "
               "so POST /corporate/approve on a cmo_cfo_review LOA jumps it "
               "straight to approved - skipping emea_final_review and "
               "corporate_review, and assigning an IA code. Found in Phase A "
               "regression work; needs a status guard.",
    )
    def test_corporate_approve_refuses_a_loa_not_at_corporate_review(
            self, client, make_loa, cmo, reload):
        loa = make_loa(requestor_email=cmo.email, status="cmo_cfo_review")
        r = client.post(f"/corporate/approve/{loa.id}", headers=cmo.headers)
        assert r.status_code in (400, 403, 409), (
            "expected a refusal, got " + str(r.status_code) +
            " and status " + str(reload(loa).status)
        )


# --------------------------------------------------------------------------- #
# 7. api/review_stage.py - the third status writer                             #
# --------------------------------------------------------------------------- #
class TestReviewStagePath:
    """Stage approval records WHO signed off. It must not move the LOA.

    This used to write loa.status = 'cmo_cfo_review' unguarded, which dragged
    approved LOAs backwards and skipped four gates. The guard is the absence of
    a status write - easy to reintroduce, so it is pinned here.
    """

    def test_stage_approval_never_moves_an_approved_loa(
            self, client, make_loa, admin, reload):
        loa = make_loa(requestor_email=admin.email, status="approved")
        client.post(f"/review-stage/{loa.id}/approve", headers=admin.headers,
                    json={"stage": "local_alignment"})
        assert reload(loa).status == "approved", (
            "stage approval must never move an approved LOA"
        )

    @pytest.mark.parametrize("status", ["draft", "local_alignment", "emea_review"])
    def test_stage_approval_leaves_the_status_alone(
            self, client, make_loa, admin, reload, status):
        loa = make_loa(requestor_email=admin.email, status=status)
        client.post(f"/review-stage/{loa.id}/approve", headers=admin.headers,
                    json={"stage": "local_alignment"})
        assert reload(loa).status == status

    def test_a_marketer_cannot_approve_a_stage(self, client, make_loa,
                                               marketer, reload):
        loa = make_loa(requestor_email=marketer.email, status="local_alignment")
        r = client.post(f"/review-stage/{loa.id}/approve", headers=marketer.headers,
                        json={"stage": "local_alignment"})
        assert r.status_code == 403
        assert reload(loa).status == "local_alignment"

    def test_unknown_loa_is_404(self, client, admin):
        r = client.post(
            "/review-stage/00000000-0000-0000-0000-000000000000/approve",
            headers=admin.headers, json={"stage": "local_alignment"})
        assert r.status_code == 404


# --------------------------------------------------------------------------- #
# 8. Cross-path invariant                                                      #
# --------------------------------------------------------------------------- #
class TestNoBackwardMovement:
    """The property Phase B must not regress, asserted across every writer."""

    ADVANCE_PATHS = [
        ("loa.validate",       "post", "/loa/{id}/validate",       None),
        ("corporate.approve",  "post", "/corporate/approve/{id}",  None),
        ("corporate.hold",     "post", "/corporate/hold/{id}",     None),
        ("corporate.rework",   "post", "/corporate/rework/{id}",   None),
        ("stage.approve",      "post", "/review-stage/{id}/approve",
         {"stage": "local_alignment"}),
    ]

    @pytest.mark.parametrize(
        "label,method,path,body", ADVANCE_PATHS,
        ids=[p[0] for p in ADVANCE_PATHS])
    def test_an_approved_loa_never_moves_backwards(
            self, client, make_loa, marketer, reload, label, method, path, body):
        """A marketer is view-only everywhere; no path may move an approved LOA.

        corporate.* and loa.validate refuse outright; stage.approve is allowed
        to no-op. What none of them may do is change the status.
        """
        loa = make_loa(requestor_email=marketer.email, status="approved")
        getattr(client, method)(
            path.format(id=loa.id), headers=marketer.headers, json=body)
        fresh = reload(loa)
        assert fresh.status == "approved", (
            label + " moved an approved LOA to " + str(fresh.status)
        )
        assert WORKFLOW_ORDER.index("approved") == len(WORKFLOW_ORDER) - 1
