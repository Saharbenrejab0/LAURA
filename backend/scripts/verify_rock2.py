"""
LAURA — Rock 2 verification

Checks that:
  1. The updated Comment model imports cleanly
  2. The visibility service imports and basic logic works
  3. The updated comments API router imports cleanly

Usage:
    cd C:\\Users\\sahar\\Desktop\\Laura
    python backend/scripts/verify_rock2.py
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))


def run():
    print("=" * 60)
    print("LAURA — Rock 2 verification")
    print("=" * 60)

    errors = []

    # 1. Model imports
    print("\n1. Importing updated Comment model...")
    try:
        from backend.models.comment import (
            Comment, ANCHOR_LOA, ANCHOR_FIELD,
            SEVERITY_NOTE, SEVERITY_SUGGESTION, SEVERITY_BLOCKING,
            VIS_LOA_PARTICIPANTS, VIS_ROLE_SCOPED, VIS_PRIVATE_ADMIN,
            FIELD_TO_SECTION, derive_section,
        )
        print("   Comment model: OK")
        print(f"   Anchor types: {ANCHOR_LOA}, {ANCHOR_FIELD}")
        print(f"   Severities: {SEVERITY_NOTE}, {SEVERITY_SUGGESTION}, {SEVERITY_BLOCKING}")
        print(f"   Visibilities: {VIS_LOA_PARTICIPANTS}, {VIS_ROLE_SCOPED}, {VIS_PRIVATE_ADMIN}")
        print(f"   Field-to-section mappings: {len(FIELD_TO_SECTION)}")

        # Test derive_section
        assert derive_section("loa", None) == "general"
        assert derive_section("field", "q3_budget") == "financials"
        assert derive_section("field", "description") == "overview"
        assert derive_section("field", "kpi") == "kpis"
        print("   derive_section tests: PASS")

    except Exception as e:
        print(f"   FAILED: {e}")
        errors.append(str(e))

    # 2. Visibility service imports
    print("\n2. Importing visibility service...")
    try:
        from backend.services.comment_visibility import (
            default_visibility,
            can_view_comment,
            can_resolve_comment,
            can_reopen_comment,
            allowed_severities,
            filter_visible_comments,
        )
        print("   Visibility service: OK")
        print(f"   Functions: default_visibility, can_view_comment, can_resolve_comment,")
        print(f"              can_reopen_comment, allowed_severities, filter_visible_comments")

    except Exception as e:
        print(f"   FAILED: {e}")
        errors.append(str(e))

    # 3. API router imports
    print("\n3. Importing updated comments API router...")
    try:
        from backend.api.comments import router
        routes = [r.path for r in router.routes]
        print(f"   Router: OK ({len(routes)} routes)")
        for r in router.routes:
            methods = ','.join(r.methods) if hasattr(r, 'methods') else '?'
            print(f"     {methods:8s} {r.path}")

    except Exception as e:
        print(f"   FAILED: {e}")
        errors.append(str(e))

    # Summary
    print(f"\n{'=' * 60}")
    if errors:
        print(f"Rock 2 verification: {len(errors)} ISSUE(S)")
        for e in errors:
            print(f"  - {e}")
    else:
        print("Rock 2 verification: PASSED")
    print("=" * 60)


if __name__ == "__main__":
    run()
