"""
LAURA — GET /review-stage/queue: what a reviewer is actually waiting on.

Regression cover for the "0 LOAs at your stage" defect on the Global Brand —
Oakley account (2026-08-28).

WHAT WAS WRONG
--------------
The queue read `loa_review_stage` as a strictly sequential chain: to be
actionable at stage S, the stage BEFORE S had to be `approved`. That is right
for `local_alignment` and wrong for the two after it. `global_function_review`
and `global_brand_review` are the two PARALLEL sides of the single
`global_review` gate — loa.py advances the LOA only once BOTH
`function_review_done` and `brand_review_done` are set, and neither side waits
on the other.

The sequential reading made the Global Brand queue permanently empty, for every
brand role, regardless of data: nothing in the live workflow ever flips one of
those stage rows to `approved`. Reviewers submit through POST /loa/{id}/validate,
which writes the `*_review_done` booleans and never touches `loa_review_stage`.
So the prerequisite could not become true. Oakley had two LOAs genuinely parked
on it and was told "0 LOAs at your stage".

The queue also applied NO role scope at all, so the moment the stage filter
matched anything, every brand team would have been handed every other brand's
LOAs. Both halves are covered below — the queue must show Oakley its own LOAs
and only its own.
"""
from __future__ import annotations

import pytest

from backend.models.loa import LOALine


BRAND_STAGE = "global_brand_review"
FUNCTION_STAGE = "global_function_review"


# --------------------------------------------------------------------------- #
# Actors                                                                       #
# --------------------------------------------------------------------------- #
@pytest.fixture(scope="session")
def oakley(make_actor):
    return make_actor("global_brand_oakley", legacy_role="viewer")


@pytest.fixture(scope="session")
def rayban(make_actor):
    return make_actor("global_brand_rayban", legacy_role="viewer")


@pytest.fixture(scope="session")
def pr_events(make_actor):
    return make_actor("global_function_pr_events", legacy_role="viewer")


@pytest.fixture
def queue(client):
    """GET the queue for one actor and return the list of LOA ids in it."""
    def _queue(actor, stage: str) -> list[str]:
        r = client.get(f"/review-stage/queue?stage={stage}", headers=actor.headers)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["stage"] == stage
        assert body["total"] == len(body["loas"])
        return [row["id"] for row in body["loas"]]
    return _queue


@pytest.fixture
def at_brand_gate(make_loa):
    """An LOA parked at `global_review` with the brand side still open.

    This is the state the reporting account was in: the function side had
    already been submitted, the brand side had not.
    """
    def _make(brand: str = "HB - Oakley", **overrides):
        fields = dict(
            status="global_review",
            brand=brand,
            brand_review_done=False,
            function_review_done=True,
        )
        fields.update(overrides)
        return make_loa(requestor_email="queue-fixture@laura-test.invalid", **fields)
    return _make


# --------------------------------------------------------------------------- #
# 1. The reported defect                                                       #
# --------------------------------------------------------------------------- #
class TestBrandQueueIsNotEmpty:

    def test_oakley_sees_its_own_loa_waiting_at_the_brand_gate(
        self, queue, at_brand_gate, oakley,
    ):
        """The headline regression: this returned 0 rows before the fix."""
        loa = at_brand_gate(brand="HB - Oakley")
        assert str(loa.id) in queue(oakley, BRAND_STAGE)

    def test_the_brand_gate_does_not_wait_on_the_function_gate(
        self, queue, at_brand_gate, oakley,
    ):
        """The root cause, isolated.

        Both sides of `global_review` are open here. Under the old sequential
        rule the brand side was unreachable until the function side was
        approved; the two run in parallel, so the LOA is Oakley's to review now.
        """
        loa = at_brand_gate(brand="HB - Oakley", function_review_done=False)
        assert str(loa.id) in queue(oakley, BRAND_STAGE)

    def test_the_function_gate_does_not_wait_on_the_brand_gate(
        self, queue, at_brand_gate, pr_events,
    ):
        """The same independence, from the other side."""
        loa = at_brand_gate(
            brand="HB - Oakley",
            activity_type="PR",
            function_review_done=False,
            brand_review_done=False,
        )
        assert str(loa.id) in queue(pr_events, FUNCTION_STAGE)


# --------------------------------------------------------------------------- #
# 2. Scope — the queue must not over-correct                                   #
# --------------------------------------------------------------------------- #
class TestBrandScopeIsEnforced:

    def test_rayban_does_not_see_oakleys_loa(
        self, queue, at_brand_gate, oakley, rayban,
    ):
        """Fixing the emptiness must not hand every brand team the whole stage."""
        loa = at_brand_gate(brand="HB - Oakley")
        assert str(loa.id) in queue(oakley, BRAND_STAGE)
        assert str(loa.id) not in queue(rayban, BRAND_STAGE)

    def test_oakley_does_not_see_raybans_loa(
        self, queue, at_brand_gate, oakley, rayban,
    ):
        loa = at_brand_gate(brand="HB - Ray-Ban")
        assert str(loa.id) in queue(rayban, BRAND_STAGE)
        assert str(loa.id) not in queue(oakley, BRAND_STAGE)

    def test_a_brand_outside_every_scope_reaches_nobody(
        self, queue, at_brand_gate, oakley, rayban,
    ):
        loa = at_brand_gate(brand="Nikon")
        assert str(loa.id) not in queue(oakley, BRAND_STAGE)
        assert str(loa.id) not in queue(rayban, BRAND_STAGE)


# --------------------------------------------------------------------------- #
# 3. Canonical brand values                                                    #
# --------------------------------------------------------------------------- #
class TestBrandSpellingIsNormalised:
    """`loas.brand` holds 'HB - Oakley', 'Oakley' and 'HB-Oakley' for the same
    brand. Role.matches_loa strips the category prefix before comparing, so all
    three reach the Oakley team — and none of them reaches Ray-Ban.
    """

    @pytest.mark.parametrize("spelling", ["HB - Oakley", "Oakley", "HB-Oakley"])
    def test_every_oakley_spelling_reaches_oakley(
        self, queue, at_brand_gate, oakley, spelling,
    ):
        loa = at_brand_gate(brand=spelling)
        assert str(loa.id) in queue(oakley, BRAND_STAGE)

    @pytest.mark.parametrize("spelling", ["HB - Oakley", "Oakley", "HB-Oakley"])
    def test_no_oakley_spelling_reaches_rayban(
        self, queue, at_brand_gate, rayban, spelling,
    ):
        loa = at_brand_gate(brand=spelling)
        assert str(loa.id) not in queue(rayban, BRAND_STAGE)


# --------------------------------------------------------------------------- #
# 4. Multi-brand LOAs                                                          #
# --------------------------------------------------------------------------- #
class TestMultiBrandLines:
    """A multi-brand LOA carries brand=NULL on the parent and its brands on
    loa_line. Matching any one line is enough to put it in that team's queue.

    `loa_type='multi_brand'` is not decoration: ck_loas_axis_by_type only
    permits a NULL brand under that type.
    """

    def test_a_line_brand_puts_the_loa_in_that_teams_queue(
        self, db, queue, at_brand_gate, oakley, rayban,
    ):
        loa = at_brand_gate(brand=None, loa_type="multi_brand")
        db.add(LOALine(loa_id=loa.id, position=0, brand="HB - Oakley"))
        db.commit()

        assert str(loa.id) in queue(oakley, BRAND_STAGE)
        assert str(loa.id) not in queue(rayban, BRAND_STAGE)

    def test_each_team_sees_a_shared_multi_brand_loa(
        self, db, queue, at_brand_gate, oakley, rayban,
    ):
        loa = at_brand_gate(brand=None, loa_type="multi_brand")
        db.add(LOALine(loa_id=loa.id, position=0, brand="HB - Oakley"))
        db.add(LOALine(loa_id=loa.id, position=1, brand="HB - Ray-Ban"))
        db.commit()

        assert str(loa.id) in queue(oakley, BRAND_STAGE)
        assert str(loa.id) in queue(rayban, BRAND_STAGE)


# --------------------------------------------------------------------------- #
# 5. The stage gate — no LOA appears before or after its turn                  #
# --------------------------------------------------------------------------- #
class TestStageGate:

    @pytest.mark.parametrize("status", [
        "draft", "local_alignment", "emea_review",
        "emea_post_global_review", "cmo_cfo_review", "emea_final_review",
        "corporate_review", "approved",
    ])
    def test_an_loa_not_at_global_review_is_not_in_the_brand_queue(
        self, queue, at_brand_gate, oakley, status,
    ):
        """Before the fix the queue ignored workflow status entirely, so LOAs
        still sitting at `emea_review` were listed as waiting on Global Brand.
        """
        loa = at_brand_gate(brand="HB - Oakley", status=status)
        assert str(loa.id) not in queue(oakley, BRAND_STAGE)

    def test_a_submitted_brand_review_leaves_the_queue(
        self, queue, at_brand_gate, oakley,
    ):
        """`brand_review_done` is the flag POST /loa/{id}/validate sets — once
        it is set, the LOA is no longer Oakley's to action.
        """
        loa = at_brand_gate(brand="HB - Oakley", brand_review_done=True)
        assert str(loa.id) not in queue(oakley, BRAND_STAGE)

    def test_a_done_brand_side_still_leaves_the_function_side_open(
        self, queue, at_brand_gate, pr_events,
    ):
        """The two sides clear independently."""
        loa = at_brand_gate(
            brand="HB - Oakley",
            activity_type="PR",
            brand_review_done=True,
            function_review_done=False,
        )
        assert str(loa.id) in queue(pr_events, FUNCTION_STAGE)


# --------------------------------------------------------------------------- #
# 6. Endpoint contract                                                         #
# --------------------------------------------------------------------------- #
class TestQueueContract:

    def test_an_unknown_stage_is_refused(self, client, oakley):
        r = client.get("/review-stage/queue?stage=not_a_stage", headers=oakley.headers)
        assert r.status_code == 400

    def test_the_queue_requires_authentication(self, client, bad_token_headers):
        r = client.get(f"/review-stage/queue?stage={BRAND_STAGE}",
                       headers=bad_token_headers)
        assert r.status_code in (401, 403)
