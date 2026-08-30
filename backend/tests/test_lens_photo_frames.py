"""
LAURA — lens slide photo frames: one photo per column, and it stays there.

Regression cover for the LENSES OVERVIEW photo-upload defect (2026-08-28).

Two things were wrong, and only one of them was visible.

1. LAYOUT (the reported symptom, covered by a browser harness, not here).
   PhotoUploader sized its frame with `flex: 1`, which does nothing under the
   plain block wrapper both lens slides give it. Every child of the FILLED
   state is absolutely positioned, so the frame collapsed to the 2px of its own
   border: the photo was invisible and the frame stopped being a hit target,
   killing click-to-upload, drag/drop, Replace and Remove on that column.

2. IDENTIFIER (covered here). A frame persists as
   `photo_type = lens_col_<column id>` keyed on cycle + category, and BOTH lens
   templates read back from the same photo array. Their seeded column ids were
   both `default-1, default-2, ...`, so the overview slide's column 1 and the
   investment slide's column A were the same stored row — uploading on one
   replaced the other, removing on one cleared both. That is the opposite of
   "each column is independent", and it is what these tests pin down.

The API tests below exercise the real endpoint, the real rows and the real
files on disk, then assert the deck payload hands each column back under its
own key — the exact path the slide rerenders from.
"""
from __future__ import annotations

import io
import re
import struct
import zlib
from pathlib import Path

import pytest

from backend.models.review import LOAPhoto


CATEGORY = "Lenses"
SLIDES_DIR = (
    Path(__file__).resolve().parents[2]
    / "frontend" / "src" / "app" / "cmo-review" / "[cycleId]" / "components" / "slides"
)


def _png_bytes(color: int = 0) -> bytes:
    """A real 1x1 PNG. The endpoint validates the mime type, so this must decode."""
    def chunk(tag: bytes, data: bytes) -> bytes:
        return (struct.pack(">I", len(data)) + tag + data
                + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF))

    ihdr = struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0)
    raw = bytes([0, color, color, color])
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr)
            + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b""))


# --------------------------------------------------------------------------- #
# Fixtures                                                                     #
# --------------------------------------------------------------------------- #
@pytest.fixture(scope="session")
def uploader(make_actor):
    """A role that passes _can_upload (CMO/CFO reviewers are read-only)."""
    return make_actor("emea_creator", legacy_role="editor")


@pytest.fixture
def lens_photos(client, db, test_cycle, uploader, authorize_actors):
    """Upload to a lens column and clean every created row + file afterwards."""
    created: list[str] = []
    authorize_actors()

    def _upload(column_id: str, color: int = 0):
        r = client.post(
            f"/review/{test_cycle.id}/lens-photo/{CATEGORY}/{column_id}",
            files={"file": (f"{column_id}.png", io.BytesIO(_png_bytes(color)), "image/png")},
            headers=uploader.headers,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        created.append(body["id"])
        return body

    yield _upload

    for row in db.query(LOAPhoto).filter(LOAPhoto.cycle_id == test_cycle.id).all():
        if row.file_path:
            Path(row.file_path).unlink(missing_ok=True)
        db.delete(row)
    db.commit()


# --------------------------------------------------------------------------- #
# 1. The frame identifier                                                      #
# --------------------------------------------------------------------------- #
class TestFrameIdentifier:

    def test_the_column_id_becomes_the_photo_key(self, lens_photos):
        photo = lens_photos("overview-1")
        assert photo["photoType"] == "lens_col_overview-1"
        assert photo["categorySlug"] == CATEGORY

    def test_the_two_lens_templates_seed_disjoint_column_ids(self):
        """The invariant the defect broke.

        Both templates write into one `lens_col_<id>` namespace per category, so
        a column id shared between them is the same photo. Runtime-added columns
        use crypto.randomUUID(); these constants were the only way to collide.
        """
        def default_ids(filename: str) -> set[str]:
            src = (SLIDES_DIR / filename).read_text(encoding="utf-8")
            block = re.search(r"const DEFAULT_COLUMNS[^=]*=\s*\[(.*?)\n\]", src, re.S)
            assert block, f"DEFAULT_COLUMNS not found in {filename}"
            ids = set(re.findall(r"id:\s*'([^']+)'", block.group(1)))
            assert ids, f"no column ids parsed from {filename}"
            return ids

        overview = default_ids("LensOverviewSlide.tsx")
        investment = default_ids("LensInvestmentSlide.tsx")
        assert overview.isdisjoint(investment), (
            "LensOverviewSlide and LensInvestmentSlide seed overlapping column "
            f"ids {sorted(overview & investment)}. Both persist as "
            "lens_col_<id> under the same cycle+category, so those columns are "
            "the same photo: uploading on one slide replaces the other."
        )


# --------------------------------------------------------------------------- #
# 2. Each column is independent                                                #
# --------------------------------------------------------------------------- #
class TestColumnsAreIndependent:

    def test_two_columns_hold_two_different_photos(self, lens_photos):
        a = lens_photos("overview-1", color=10)
        b = lens_photos("overview-2", color=200)
        assert a["id"] != b["id"]
        assert a["url"] != b["url"]
        assert {a["photoType"], b["photoType"]} == {
            "lens_col_overview-1", "lens_col_overview-2",
        }

    def test_replacing_one_column_leaves_the_others_alone(self, lens_photos, db, test_cycle):
        keep = lens_photos("overview-2")
        first = lens_photos("overview-1")
        replaced = lens_photos("overview-1")

        assert replaced["id"] != first["id"], "replace must write a new row"

        rows = db.query(LOAPhoto).filter_by(
            cycle_id=str(test_cycle.id), category_slug=CATEGORY,
        ).all()
        by_type = {r.photo_type: str(r.id) for r in rows}
        # Exactly one row survives for the replaced column...
        assert by_type["lens_col_overview-1"] == replaced["id"]
        assert sum(r.photo_type == "lens_col_overview-1" for r in rows) == 1
        # ...and the neighbour is untouched.
        assert by_type["lens_col_overview-2"] == keep["id"]

    def test_removing_one_column_leaves_the_others_alone(
        self, client, lens_photos, test_cycle, uploader,
    ):
        gone = lens_photos("overview-1")
        keep = lens_photos("overview-2")

        r = client.delete(
            f"/review/{test_cycle.id}/photos/{gone['id']}", headers=uploader.headers,
        )
        assert r.status_code == 200, r.text

        photos = self._deck_photos(client, test_cycle, uploader)
        types = {p["photoType"] for p in photos}
        assert "lens_col_overview-1" not in types
        assert "lens_col_overview-2" in types
        assert keep["id"] in {p["id"] for p in photos}

    @staticmethod
    def _deck_photos(client, test_cycle, actor) -> list[dict]:
        r = client.get(f"/review/{test_cycle.id}/deck", headers=actor.headers)
        assert r.status_code == 200, r.text
        return r.json()["overviewPhotos"].get(CATEGORY, [])


# --------------------------------------------------------------------------- #
# 3. It is still there after a refresh                                         #
# --------------------------------------------------------------------------- #
class TestSurvivesReload:

    def test_the_deck_returns_each_column_under_its_own_key(
        self, client, lens_photos, test_cycle, uploader,
    ):
        """This payload is what the slide rerenders from.

        LensOverviewSlide looks a column up with
        `photos.find(p => p.photoType === 'lens_col_' + col.id)`, so the deck
        must key them exactly that way under the category.
        """
        lens_photos("overview-1")
        lens_photos("overview-3")

        photos = TestColumnsAreIndependent._deck_photos(client, test_cycle, uploader)
        types = {p["photoType"] for p in photos}
        assert {"lens_col_overview-1", "lens_col_overview-3"} <= types
        assert "lens_col_overview-2" not in types

    def test_the_stored_file_is_actually_on_disk(self, lens_photos, db, test_cycle):
        photo = lens_photos("overview-1")
        row = db.query(LOAPhoto).filter_by(id=photo["id"]).first()
        assert row is not None
        assert Path(row.file_path).is_file(), "the upload wrote no file"
        assert photo["url"].endswith(row.file_name)

    def test_crop_defaults_come_back_so_the_frame_can_render(self, lens_photos):
        """LensOverviewSlide feeds these straight into PhotoUploader's cropState."""
        photo = lens_photos("overview-1")
        assert photo["focalX"] == 0.5
        assert photo["focalY"] == 0.5
        assert photo["zoom"] == 1.0


# --------------------------------------------------------------------------- #
# 4. Guards that must not be relaxed by the fix                                #
# --------------------------------------------------------------------------- #
class TestUploadGuards:

    def test_a_non_image_is_refused(self, client, test_cycle, uploader):
        r = client.post(
            f"/review/{test_cycle.id}/lens-photo/{CATEGORY}/overview-1",
            files={"file": ("x.svg", io.BytesIO(b"<svg/>"), "image/svg+xml")},
            headers=uploader.headers,
        )
        assert r.status_code == 415

    def test_a_review_only_role_cannot_upload(self, client, test_cycle, make_actor,
                                              authorize_actors):
        cmo = make_actor("regional_cmo", legacy_role="cmo")
        authorize_actors()
        r = client.post(
            f"/review/{test_cycle.id}/lens-photo/{CATEGORY}/overview-1",
            files={"file": ("a.png", io.BytesIO(_png_bytes()), "image/png")},
            headers=cmo.headers,
        )
        assert r.status_code == 403
