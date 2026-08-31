"""
Regression lock on LOA write paths and the guarantees underneath them.

Two layers are covered, deliberately:

  1. APPLICATION validation - the Pydantic validators on LOACreate, which are
     where controlled fields (cluster, category, activity_type) are checked
     against backend/reference_data.py.

  2. DATABASE guarantees - the CHECK constraints. These are asserted by trying
     to write an illegal row through a real session and expecting Postgres to
     refuse it. That only proves anything against a real database, which is
     why this suite does not mock the session.

The distinction matters for Phase B/C: layer 1 can be bypassed by any write
path that skips the schema, layer 2 cannot be bypassed at all.

Isolation: see conftest.py.
"""
from __future__ import annotations

import uuid

import pytest
from sqlalchemy.exc import IntegrityError
from pydantic import ValidationError

from backend.api.loa import LOACreate
from backend.models.loa import (
    LOA, SOURCE_LAURA_CREATED, SOURCE_HISTORICAL_IMPORT,
    LOA_TYPE_STANDARD, LOA_TYPE_MULTI_BRAND, LOA_TYPE_MULTI_ACTIVITY,
)
from backend.reference_data import CLUSTERS, CATEGORIES


@pytest.fixture(scope="session")
def marketer(make_actor):
    return make_actor("france_marketer", cluster="FRANCE")


def _valid_payload(**overrides) -> dict:
    payload = dict(
        requestor_email="test@laura-test.invalid",
        cluster="FRANCE",
        country="France",
        legal_entity="Essilor International",
        activity_type="TM_SEASONAL",
        brand="Ray-Ban (RB)",
        category=["Frames"],
        cot="All COT",
    )
    payload.update(overrides)
    return payload


# --------------------------------------------------------------------------- #
# 1. Controlled fields - application layer                                     #
# --------------------------------------------------------------------------- #
class TestControlledFieldValidation:

    def test_a_valid_payload_is_accepted(self):
        model = LOACreate(**_valid_payload())
        assert model.cluster == "FRANCE"

    def test_an_unknown_cluster_is_rejected(self):
        with pytest.raises(ValidationError) as exc:
            LOACreate(**_valid_payload(cluster="Atlantis"))
        assert "cluster" in str(exc.value).lower()

    def test_the_cluster_that_leaked_into_live_data_is_rejected_today(self):
        """'South Europe' exists on one real LOA but is not a canonical cluster.

        The row is left alone on purpose (it is real data, and normalising it
        is a separate decision). This test pins that the validator would now
        refuse it, so the same value cannot be introduced again.
        """
        assert "South Europe" not in CLUSTERS
        with pytest.raises(ValidationError):
            LOACreate(**_valid_payload(cluster="South Europe"))

    @pytest.mark.parametrize("cluster", sorted(CLUSTERS))
    def test_every_canonical_cluster_is_accepted(self, cluster):
        assert LOACreate(**_valid_payload(cluster=cluster)).cluster == cluster

    def test_an_unknown_category_is_rejected(self):
        with pytest.raises(ValidationError) as exc:
            LOACreate(**_valid_payload(category=["Hovercraft"]))
        assert "categor" in str(exc.value).lower()

    def test_categories_are_multi_select(self):
        model = LOACreate(**_valid_payload(category=["Frames", "Lenses"]))
        assert model.category == ["Frames", "Lenses"]

    def test_duplicate_categories_are_collapsed(self):
        model = LOACreate(**_valid_payload(category=["Frames", "Frames", "Lenses"]))
        assert model.category == ["Frames", "Lenses"]

    @pytest.mark.parametrize("category", sorted(CATEGORIES))
    def test_every_canonical_category_is_accepted(self, category):
        assert LOACreate(**_valid_payload(category=[category])).category == [category]

    def test_an_unknown_activity_type_is_rejected(self):
        with pytest.raises(ValidationError) as exc:
            LOACreate(**_valid_payload(activity_type="Interpretive Dance"))
        assert "activity" in str(exc.value).lower()


# --------------------------------------------------------------------------- #
# 2. Database guarantees - the layer nothing can bypass                        #
# --------------------------------------------------------------------------- #
class TestDatabaseConstraints:
    """Each test writes an illegal row and expects Postgres to refuse it."""

    def _base(self, cycle_id, **overrides) -> dict:
        fields = dict(
            id=uuid.uuid4(),
            loa_draft_id="LAURA-TEST-" + uuid.uuid4().hex[:8].upper(),
            requestor_email="constraint@laura-test.invalid",
            cluster="FRANCE",
            country="France",
            category=["Frames"],
            cot="All COT",
            status="draft",
            source=SOURCE_LAURA_CREATED,
            cycle_id=cycle_id,
            brand="Ray-Ban (RB)",
            activity_type="TM_SEASONAL",
            loa_type=LOA_TYPE_STANDARD,
        )
        fields.update(overrides)
        return fields

    def test_a_standard_loa_needs_both_brand_and_activity(self, raw_db, test_cycle):
        """ck_loas_axis_by_type: standard => brand AND activity_type present."""
        raw_db.add(LOA(**self._base(test_cycle.id, brand=None)))
        with pytest.raises(IntegrityError) as exc:
            raw_db.commit()
        assert "ck_loas_axis_by_type" in str(exc.value)
        raw_db.rollback()

    def test_a_multi_brand_loa_must_leave_brand_null(self, raw_db, test_cycle):
        """ck_loas_axis_by_type: the brand axis moves to loa_line."""
        raw_db.add(LOA(**self._base(test_cycle.id, loa_type=LOA_TYPE_MULTI_BRAND,
                                brand="Ray-Ban (RB)")))
        with pytest.raises(IntegrityError) as exc:
            raw_db.commit()
        assert "ck_loas_axis_by_type" in str(exc.value)
        raw_db.rollback()

    def test_a_multi_activity_loa_must_leave_activity_null(self, raw_db, test_cycle):
        raw_db.add(LOA(**self._base(test_cycle.id, loa_type=LOA_TYPE_MULTI_ACTIVITY,
                                activity_type="TM_SEASONAL")))
        with pytest.raises(IntegrityError) as exc:
            raw_db.commit()
        assert "ck_loas_axis_by_type" in str(exc.value)
        raw_db.rollback()

    def test_a_valid_multi_brand_loa_is_accepted(self, raw_db, test_cycle):
        loa = LOA(**self._base(test_cycle.id, loa_type=LOA_TYPE_MULTI_BRAND,
                               brand=None, activity_type="TM_SEASONAL"))
        raw_db.add(loa)
        raw_db.commit()
        assert loa.id is not None
        raw_db.query(LOA).filter(LOA.id == loa.id).delete(synchronize_session=False)
        raw_db.commit()

    def test_an_unknown_loa_type_is_refused(self, raw_db, test_cycle):
        """ck_loas_loa_type."""
        raw_db.add(LOA(**self._base(test_cycle.id, loa_type="quantum")))
        with pytest.raises(IntegrityError) as exc:
            raw_db.commit()
        # Either CHECK is a correct refusal: an unknown loa_type also fails to
        # match any branch of the axis constraint, which Postgres evaluates
        # first. What matters is that the row does not land.
        assert ("ck_loas_loa_type" in str(exc.value)
                or "ck_loas_axis_by_type" in str(exc.value))
        raw_db.rollback()

    def test_a_live_loa_cannot_exist_without_a_cycle(self, raw_db):
        """ck_loa_live_has_cycle - the provenance rule, enforced by the database."""
        raw_db.add(LOA(**self._base(None)))
        with pytest.raises(IntegrityError) as exc:
            raw_db.commit()
        assert "ck_loa_live_has_cycle" in str(exc.value)
        raw_db.rollback()

    def test_an_imported_loa_cannot_carry_a_cycle(self, raw_db, test_cycle):
        """The same constraint, from the other side."""
        raw_db.add(LOA(**self._base(test_cycle.id, source=SOURCE_HISTORICAL_IMPORT)))
        with pytest.raises(IntegrityError) as exc:
            raw_db.commit()
        assert "ck_loa_live_has_cycle" in str(exc.value)
        raw_db.rollback()


# --------------------------------------------------------------------------- #
# 3. Update paths                                                              #
# --------------------------------------------------------------------------- #
class TestUpdatePaths:

    def test_field_autosave_persists(self, client, make_loa, marketer, reload):
        loa = make_loa(requestor_email=marketer.email, status="draft")
        r = client.patch(f"/loa/{loa.id}/field", headers=marketer.headers,
                         json={"field": "kpi", "value": "+20% sell-out"})
        assert r.status_code == 200, r.text
        assert reload(loa).kpi == "+20% sell-out"

    def test_full_update_persists(self, client, make_loa, marketer, reload):
        loa = make_loa(requestor_email=marketer.email, status="draft")
        r = client.patch(f"/loa/{loa.id}", headers=marketer.headers,
                         json={"cluster": "ITALY", "country": "Italy"})
        assert r.status_code == 200, r.text
        fresh = reload(loa)
        assert fresh.cluster == "ITALY"
        assert fresh.country == "Italy"

    def test_a_marketer_cannot_edit_a_loa_in_review(
            self, client, make_loa, marketer, reload):
        """Editing rights end when the LOA leaves the author's hands."""
        loa = make_loa(requestor_email=marketer.email, status="emea_review")
        r = client.patch(f"/loa/{loa.id}/field", headers=marketer.headers,
                         json={"field": "kpi", "value": "sneaky"})
        assert r.status_code == 403
        assert reload(loa).kpi == "TEST kpi"

    def test_an_author_may_edit_a_returned_loa(self, client, make_loa,
                                               marketer, reload):
        loa = make_loa(requestor_email=marketer.email, status="returned")
        r = client.patch(f"/loa/{loa.id}/field", headers=marketer.headers,
                         json={"field": "kpi", "value": "revised"})
        assert r.status_code == 200, r.text
        assert reload(loa).kpi == "revised"

    def test_quarterly_values_round_trip_as_numbers(self, client, make_loa,
                                                    marketer, reload):
        loa = make_loa(requestor_email=marketer.email, status="draft")
        r = client.patch(f"/loa/{loa.id}/field", headers=marketer.headers,
                         json={"field": "q2_2026", "value": 25000})
        assert r.status_code == 200, r.text
        assert reload(loa).q2_2026 == 25000


# --------------------------------------------------------------------------- #
# 4. Provenance                                                                #
# --------------------------------------------------------------------------- #
class TestProvenance:

    def test_fixture_rows_are_laura_created_and_carry_a_cycle(
            self, make_loa, marketer, test_cycle):
        loa = make_loa(requestor_email=marketer.email)
        assert loa.source == SOURCE_LAURA_CREATED
        assert loa.cycle_id == test_cycle.id

    @pytest.mark.xfail(
        strict=True,
        reason="backend/api/draft.py guards the field endpoint with a DENYLIST "
               "(_PROTECTED), not an allowlist. 'source' is not on it, so "
               "provenance is writable inline; the only thing stopping it is the "
               "ck_loa_live_has_cycle CHECK, which surfaces as an unhandled "
               "IntegrityError rather than a 4xx. Same exposure for cycle_id, "
               "loa_type, brand, activity_type and ia_code. Needs an allowlist "
               "plus IntegrityError handling (stabilization sections 8 and 9).",
    )
    def test_source_is_not_editable_through_the_field_endpoint(
            self, client, make_loa, marketer, reload):
        """Provenance is set once at insert and never by a user."""
        loa = make_loa(requestor_email=marketer.email, status="draft")
        r = client.patch(f"/loa/{loa.id}/field", headers=marketer.headers,
                         json={"field": "source", "value": SOURCE_HISTORICAL_IMPORT})
        assert r.status_code == 400, (
            "expected a 400 refusal; got " + str(r.status_code))
        assert reload(loa).source == SOURCE_LAURA_CREATED

    @pytest.mark.xfail(
        strict=True,
        reason="Same denylist gap as above: ia_code is the corporate identifier "
               "assigned by POST /corporate/approve, but the inline field "
               "endpoint will happily set it on any editable LOA.",
    )
    def test_ia_code_is_not_editable_through_the_field_endpoint(
            self, client, make_loa, marketer, reload):
        loa = make_loa(requestor_email=marketer.email, status="draft")
        r = client.patch(f"/loa/{loa.id}/field", headers=marketer.headers,
                         json={"field": "ia_code", "value": "2026-0001"})
        assert r.status_code == 400, (
            "expected a 400 refusal; got " + str(r.status_code))
        assert reload(loa).ia_code is None

    def test_the_protected_denylist_still_blocks_what_it_covers(
            self, client, make_loa, marketer, reload):
        """The fields that ARE on _PROTECTED must stay refused."""
        loa = make_loa(requestor_email=marketer.email, status="draft")
        for field, value in [("status", "approved"),
                             ("requestor_email", "attacker@evil.invalid"),
                             ("is_locked", True),
                             ("loa_number", "FAKE-1")]:
            r = client.patch(f"/loa/{loa.id}/field", headers=marketer.headers,
                             json={"field": field, "value": value})
            assert r.status_code == 400, field
        fresh = reload(loa)
        assert fresh.status == "draft"
        assert fresh.requestor_email == marketer.email
