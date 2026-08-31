"""
Reference data: drift alarm.

LAURA has three places that describe the same controlled vocabularies:

  1. backend/reference_data.py     the validators read this  (LIVE)
  2. the clusters/countries/legal_entities/brands tables
                                    the cascade API reads this (LIVE)
  3. the enums in backend/models/loa.py
                                    read by nothing            (DEAD)

Phase A measurement found 1 and 2 to be byte-identical, and 3 to have zero
references anywhere in the codebase. That is a much better position than it
looks - but nothing enforces it, so the moment someone edits one and not the
other, LAURA validates against a list the dropdowns do not offer.

These tests are the alarm. They do not pick a winner between 1 and 2 - that is
the Phase D design decision - they just fail loudly the moment the two live
sources disagree, so the decision is never forced by a production incident.

Isolation: read-only. This suite writes nothing.
"""
from __future__ import annotations

import pytest
from sqlalchemy import text

from backend.reference_data import (
    CLUSTERS, CLUSTER_CASCADE, CATEGORIES, ACTIVITY_TYPES,
    get_all_reference_data, REFERENCE_DATA_VERSION,
    is_valid_cluster,
)
from backend.models.loa import ClusterType, CategoryType, COTType


# --------------------------------------------------------------------------- #
# 1. The two live sources must agree                                           #
# --------------------------------------------------------------------------- #
class TestLiveSourcesAgree:

    def test_clusters_match_between_python_and_the_database(self, db):
        """THE drift alarm. reference_data.py validates; the DB feeds dropdowns."""
        in_db = sorted(r[0] for r in db.execute(text("SELECT name FROM clusters")))
        in_py = sorted(CLUSTERS)
        assert in_py == in_db, (
            "reference data has drifted.\n"
            "  only in reference_data.py: " + str(sorted(set(in_py) - set(in_db))) + "\n"
            "  only in the clusters table: " + str(sorted(set(in_db) - set(in_py))) + "\n"
            "Pick one owner (Phase D) rather than re-syncing by hand."
        )

    def test_every_cascade_cluster_exists_in_the_database(self, db):
        in_db = {r[0] for r in db.execute(text("SELECT name FROM clusters"))}
        for cluster in CLUSTER_CASCADE:
            assert cluster in in_db, "cascade cluster missing from DB: " + cluster

    def test_country_counts_are_consistent(self, db):
        """Each cluster's cascade length should match its DB country count."""
        rows = db.execute(text(
            "SELECT c.name, COUNT(co.id) FROM clusters c "
            "LEFT JOIN countries co ON co.cluster_id = c.id GROUP BY c.name")).fetchall()
        db_counts = {name: n for name, n in rows}
        mismatches = []
        for cluster, entries in CLUSTER_CASCADE.items():
            expected = len(entries)
            actual = db_counts.get(cluster, 0)
            if expected != actual:
                mismatches.append((cluster, expected, actual))
        assert not mismatches, (
            "cluster -> country counts differ (cluster, reference_data, db): "
            + str(mismatches))

    def test_the_reference_tables_are_populated(self, db):
        """A silently empty table would make every dropdown blank."""
        for table in ("clusters", "countries", "legal_entities", "brands"):
            n = db.execute(text("SELECT COUNT(*) FROM " + table)).scalar()
            assert n > 0, table + " is empty"


# --------------------------------------------------------------------------- #
# 2. The API contract the frontend consumes                                    #
# --------------------------------------------------------------------------- #
class TestReferenceApiContract:

    def test_the_payload_carries_every_key_the_frontend_expects(self, client):
        r = client.get("/reference-data/")
        assert r.status_code == 200
        payload = r.json()
        for key in ("version", "clusters", "cluster_cascade", "activity_types",
                    "categories", "cot_options", "brands_by_category"):
            assert key in payload, "missing key: " + key

    def test_the_api_serves_exactly_the_canonical_clusters(self, client):
        payload = client.get("/reference-data/").json()
        assert sorted(payload["clusters"]) == sorted(CLUSTERS)

    def test_the_api_serves_exactly_the_canonical_categories(self, client):
        payload = client.get("/reference-data/").json()
        assert sorted(payload["categories"]) == sorted(CATEGORIES)

    def test_the_version_endpoint_matches_the_payload(self, client):
        version = client.get("/reference-data/version").json()["version"]
        assert version == REFERENCE_DATA_VERSION
        assert client.get("/reference-data/").json()["version"] == version

    def test_the_version_is_stamped_as_a_header(self, client):
        r = client.get("/reference-data/")
        assert r.headers.get("X-Reference-Data-Version") == REFERENCE_DATA_VERSION

    def test_the_cascade_endpoints_agree_with_the_bulk_payload(self, client, db):
        """/api/reference/clusters reads the DB; /reference-data/ reads Python."""
        from_tables = sorted(c["name"] for c in
                             client.get("/api/reference/clusters").json())
        from_payload = sorted(client.get("/reference-data/").json()["clusters"])
        assert from_tables == from_payload, (
            "the two reference endpoints disagree - the frontend would show "
            "different dropdowns depending on which one it called"
        )

    def test_countries_cascade_from_a_cluster(self, client):
        clusters = client.get("/api/reference/clusters").json()
        assert clusters
        countries = client.get(
            "/api/reference/countries", params={"cluster_id": clusters[0]["id"]}).json()
        assert isinstance(countries, list)


# --------------------------------------------------------------------------- #
# 3. The validator is the enforcement point                                    #
# --------------------------------------------------------------------------- #
class TestValidatorTracksTheCanonicalList:

    @pytest.mark.parametrize("cluster", sorted(CLUSTERS))
    def test_every_canonical_cluster_validates(self, cluster):
        assert is_valid_cluster(cluster) is True

    @pytest.mark.parametrize("value", ["", "Atlantis", "france", "South Europe"])
    def test_non_canonical_values_are_refused(self, value):
        assert is_valid_cluster(value) is False

    def test_activity_types_are_codes_not_labels(self):
        """The validators speak codes; the labels are presentation only."""
        assert "TM_SEASONAL" in ACTIVITY_TYPES
        assert "Tailor Made Seasonal" not in ACTIVITY_TYPES


# --------------------------------------------------------------------------- #
# 4. The dead third source                                                     #
# --------------------------------------------------------------------------- #
class TestDeadEnums:
    """These enums are referenced by nothing. Pinned so the gap stays visible.

    They are NOT deleted here - removal is Phase G, after a repository-wide
    proof that nothing imports them. What this documents is that they must
    never be mistaken for the canonical list, because they already disagree
    with it.
    """

    def test_cluster_type_enum_has_already_drifted(self):
        enum_values = {c.value for c in ClusterType}
        canonical = set(CLUSTERS)
        assert enum_values != canonical, (
            "ClusterType now matches the canonical list. If it has been wired "
            "up as the source of truth, delete this test; if it is still dead "
            "code, it should be removed rather than kept in sync."
        )
        # The specific, known divergence as of the Phase A baseline.
        assert {"META", "EMEA"} <= enum_values
        assert "TURKEY" in canonical and "TURKEY" not in enum_values

    def test_category_enum_still_mirrors_the_canonical_categories(self):
        """This one happens to agree - which is exactly why it is dangerous."""
        assert {c.value for c in CategoryType} == set(CATEGORIES)

    def test_the_enums_are_not_imported_anywhere_outside_their_module(self):
        """If this fails, an enum became load-bearing and Phase G must adapt."""
        import subprocess
        for name in ("ClusterType", "COTType"):
            out = subprocess.run(
                ["git", "grep", "-l", name, "--", "backend", "frontend"],
                capture_output=True, text=True, cwd=r"C:\Users\sahar\Desktop\Laura")
            files = {f for f in out.stdout.split() if f}
            files -= {"backend/models/loa.py"}
            files = {f for f in files if not f.startswith("backend/tests/")}
            assert not files, name + " is referenced by: " + str(sorted(files))


# --------------------------------------------------------------------------- #
# 5. What is already in the data                                               #
# --------------------------------------------------------------------------- #
class TestLiveDataDivergence:
    """Read-only record of non-canonical values already stored.

    These rows are NOT modified. Normalising them is a separate, deliberate
    data decision - the point here is that the number must not grow silently.
    """

    def test_the_set_of_non_canonical_clusters_has_not_grown(self, db):
        rows = db.execute(text(
            "SELECT DISTINCT cluster FROM loas WHERE cluster IS NOT NULL")).fetchall()
        stored = {r[0] for r in rows}
        non_canonical = {c for c in stored if c not in set(CLUSTERS)}

        # Pre-existing, left alone deliberately (see module docstring).
        known = {"META", "EMEA", "South Europe"}

        # NOT pre-existing. Row 18a9cd4d-18ca-4c4d-a60c-c39bcf024b02, created
        # 2026-08-28 by a Phase A probe that fired POST /loa with no token and
        # an empty body - which is exactly the fail-open gap recorded in
        # test_authorization_matrix.KNOWN_UNGUARDED. It is a junk row with a
        # blank requestor_email and blank cluster sitting in the real open
        # cycle. It should be deleted; this entry and this comment go with it:
        #   DELETE FROM loas WHERE id = '18a9cd4d-18ca-4c4d-a60c-c39bcf024b02';
        pending_cleanup = {""}

        new = non_canonical - known - pending_cleanup
        assert not new, (
            "new non-canonical cluster value(s) reached the database: "
            + str(sorted(new)) +
            " - loas.cluster is free text with no FK or CHECK, so only the "
            "Pydantic validator stands in the way and something bypassed it."
        )

    def test_cluster_is_still_unconstrained_at_the_database_level(self, db):
        """Documents WHY the above can happen: there is no DB-level guard."""
        checks = db.execute(text(
            "SELECT conname, pg_get_constraintdef(c.oid) FROM pg_constraint c "
            "JOIN pg_class t ON t.oid = c.conrelid "
            "WHERE t.relname = 'loas' AND c.contype = 'c'")).fetchall()
        cluster_guards = [n for n, d in checks if "cluster" in (d or "")]
        assert not cluster_guards, (
            "a CHECK on loas.cluster now exists (" + str(cluster_guards) + "). "
            "That is an improvement - update this test and the Phase D notes."
        )
