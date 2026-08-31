"""
LAURA — frontend/backend WORKFLOW_ORDER parity.

The stage sequence exists twice: once in Python (backend/api/loa.py, the real
state machine) and once in TypeScript (frontend/src/lib/workflow.ts, which every
stage renderer in the UI derives from — the split-screen stepper, the Admin
Console's Approval Chain screen, the LOA detail page, and the tracker's status
filters).

They are kept in sync by hand. Nothing enforced it, which is exactly the setup
where a backend gate is added and the UI silently keeps rendering the old chain
— or worse, renders a gate the backend will never route an LOA to.

This test is that enforcement. It parses the TypeScript array rather than
importing it, because the alternative (a build step, or duplicating the list a
third time in a fixture) would add the very drift it is meant to prevent.

If this fails: change BOTH lists, in the same commit.
"""

import re
from pathlib import Path

import pytest

from backend.api.loa import WORKFLOW_ORDER

_REPO_ROOT = Path(__file__).resolve().parents[2]
_WORKFLOW_TS = _REPO_ROOT / "frontend" / "src" / "lib" / "workflow.ts"

# Matches:  export const WORKFLOW_ORDER: LOAStatus[] = [ 'draft', ... ]
# Tolerant of whitespace, trailing commas, and single or double quotes, but NOT
# of the declaration being renamed or retyped — if someone changes the shape,
# this should fail loudly rather than silently match nothing.
_ARRAY_RE = re.compile(
    r"export\s+const\s+WORKFLOW_ORDER\s*:\s*LOAStatus\[\]\s*=\s*\[(?P<body>.*?)\]",
    re.DOTALL,
)
_ITEM_RE = re.compile(r"['\"]([a-z_]+)['\"]")


def _frontend_workflow_order() -> list[str]:
    assert _WORKFLOW_TS.is_file(), f"missing frontend workflow file: {_WORKFLOW_TS}"
    source = _WORKFLOW_TS.read_text(encoding="utf-8")

    match = _ARRAY_RE.search(source)
    assert match, (
        "Could not find `export const WORKFLOW_ORDER: LOAStatus[] = [...]` in "
        f"{_WORKFLOW_TS}. If the declaration was intentionally renamed or "
        "retyped, update this test's regex in the same commit."
    )

    body = match.group("body")
    # Strip line and block comments so a commented-out status is not counted.
    body = re.sub(r"//[^\n]*", "", body)
    body = re.sub(r"/\*.*?\*/", "", body, flags=re.DOTALL)

    items = _ITEM_RE.findall(body)
    assert items, f"WORKFLOW_ORDER in {_WORKFLOW_TS} parsed as empty"
    return items


def test_frontend_workflow_order_matches_backend():
    """The two lists must be identical, including order."""
    frontend = _frontend_workflow_order()
    backend = list(WORKFLOW_ORDER)

    assert frontend == backend, (
        "WORKFLOW_ORDER has drifted between backend and frontend.\n"
        f"  backend  (backend/api/loa.py):        {backend}\n"
        f"  frontend (frontend/src/lib/workflow.ts): {frontend}\n"
        "Both lists must change together — every stage renderer in the UI "
        "derives from the frontend copy."
    )


def test_frontend_workflow_order_has_no_duplicates():
    """A duplicated status would make buildChain() mark two gates current."""
    frontend = _frontend_workflow_order()
    duplicates = {s for s in frontend if frontend.count(s) > 1}
    assert not duplicates, f"duplicate statuses in frontend WORKFLOW_ORDER: {sorted(duplicates)}"


@pytest.mark.parametrize("terminal", ["draft", "approved"])
def test_terminal_anchors_stay_at_the_ends(terminal):
    """
    buildChain() drops `draft` off the front and keeps `approved` as the end
    marker rather than a gate. Both depend on position, not just membership.
    """
    frontend = _frontend_workflow_order()
    expected_index = 0 if terminal == "draft" else len(frontend) - 1
    assert frontend[expected_index] == terminal, (
        f"expected {terminal!r} at index {expected_index} of frontend "
        f"WORKFLOW_ORDER, got {frontend[expected_index]!r} — buildChain() "
        "slices on these positions"
    )
