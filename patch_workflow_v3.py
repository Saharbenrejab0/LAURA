"""
LAURA — Workflow V3 Patcher
Run this ONCE from the Laura root directory.
It patches backend + frontend files to implement the new 9-step workflow.

Usage:  python patch_workflow_v3.py
"""
import re
from pathlib import Path

ROOT = Path(".")

def patch_file(path: str, replacements: list[tuple[str, str]]):
    """Replace exact strings in a file."""
    p = Path(path)
    if not p.exists():
        print(f"  SKIP (not found): {path}")
        return
    content = p.read_text(encoding="utf-8")
    for old, new in replacements:
        if old in content:
            content = content.replace(old, new, 1)
            print(f"  OK: replaced block in {path}")
        else:
            print(f"  WARN: block not found in {path}:")
            print(f"    Looking for: {old[:80]}...")
    p.write_text(content, encoding="utf-8")


# ═══════════════════════════════════════════════════════════════════
# 1. backend/models/loa.py — LOAStatus enum + WORKFLOW_TRANSITIONS
# ═══════════════════════════════════════════════════════════════════

print("\n[1/5] Patching backend/models/loa.py ...")

patch_file("backend/models/loa.py", [
    # --- Fix WORKFLOW_TRANSITIONS ---
    (
        '''WORKFLOW_TRANSITIONS = {
    "emea_review":             "global_review",
    "global_review":           "cmo_cfo_review",
    "cmo_cfo_review":          "global_functions_review",
    "global_functions_review": "corporate_review",
    "corporate_review":        "approved",''',
        '''WORKFLOW_TRANSITIONS = {
    "emea_review":              "global_brand_review",
    "global_brand_review":      "emea_brand_rework",
    "emea_brand_rework":        "global_functions_review",
    "global_functions_review":  "emea_functions_rework",
    "emea_functions_rework":    "cmo_cfo_review",
    "cmo_cfo_review":           "corporate_review",
    "corporate_review":         "approved",'''
    ),
])

# Also update the LOAStatus enum if it references global_review
patch_file("backend/models/loa.py", [
    (
        "EMEA_REVIEW             = \"emea_review\"",
        "EMEA_REVIEW             = \"emea_review\""
    ),
])

# Patch any reference to "global_review" status string
content = Path("backend/models/loa.py").read_text(encoding="utf-8")
# Replace the enum value but not WORKFLOW_TRANSITIONS (already done)
if "GLOBAL_REVIEW" in content and "GLOBAL_BRAND_REVIEW" not in content:
    content = content.replace(
        "GLOBAL_REVIEW",
        "GLOBAL_BRAND_REVIEW"
    )
    content = content.replace(
        '"global_review"',
        '"global_brand_review"'
    )
    # Add new enum members after global_brand_review
    if "EMEA_BRAND_REWORK" not in content:
        content = content.replace(
            'GLOBAL_BRAND_REVIEW      = "global_brand_review"',
            'GLOBAL_BRAND_REVIEW      = "global_brand_review"\n'
            '    EMEA_BRAND_REWORK       = "emea_brand_rework"\n'
            '    EMEA_FUNCTIONS_REWORK   = "emea_functions_rework"'
        )
    Path("backend/models/loa.py").write_text(content, encoding="utf-8")
    print("  OK: updated LOAStatus enum in backend/models/loa.py")
else:
    # Try simpler approach: just find the line with global_review in quotes
    if '"global_review"' in content:
        content = content.replace('"global_review"', '"global_brand_review"')
        Path("backend/models/loa.py").write_text(content, encoding="utf-8")
        print("  OK: replaced global_review string references")


# ═══════════════════════════════════════════════════════════════════
# 2. backend/api/loa.py — Add REJECT_DESTINATIONS + update reject
# ═══════════════════════════════════════════════════════════════════

print("\n[2/5] Patching backend/api/loa.py ...")

loa_api = Path("backend/api/loa.py")
if loa_api.exists():
    content = loa_api.read_text(encoding="utf-8")

    # Add REJECT_DESTINATIONS after WORKFLOW_TRANSITIONS import/reference
    if "REJECT_DESTINATIONS" not in content:
        # Insert after the WORKFLOW_TRANSITIONS import
        insert_after = "from backend.models.loa import"
        if insert_after in content:
            # Find the end of that import line/block
            idx = content.index(insert_after)
            # Find the next newline after a closing paren or end of line
            end_idx = content.index("\n", idx)
            while content[end_idx-1] == "\\":
                end_idx = content.index("\n", end_idx + 1)
            
            reject_block = '''

# Where does a LOA go when rejected at each step?
REJECT_DESTINATIONS = {
    "emea_review":              "draft",                # back to marketer
    "global_brand_review":      "emea_review",          # EMEA fixes brand feedback
    "emea_brand_rework":        "draft",                # EMEA sends back to marketer
    "global_functions_review":  "emea_brand_rework",    # EMEA fixes functions feedback
    "emea_functions_rework":    "draft",                # EMEA sends back to marketer
    "cmo_cfo_review":           "emea_functions_rework", # EMEA handles CMO/CFO feedback
    "corporate_review":         "emea_functions_rework", # EMEA handles corporate feedback
}
'''
            content = content[:end_idx+1] + reject_block + content[end_idx+1:]
            print("  OK: added REJECT_DESTINATIONS")

    # Update the reject endpoint to use REJECT_DESTINATIONS
    # Find: loa.status = "draft"  or  loa.status = "rejected"
    # In the reject function
    if 'loa.status = "rejected"' in content:
        content = content.replace(
            'loa.status = "rejected"',
            'loa.status = REJECT_DESTINATIONS.get(loa.status, "draft")'
        )
        print("  OK: updated reject to use REJECT_DESTINATIONS")
    elif 'loa.status = "draft"' in content:
        # Check if this is inside the reject function
        # Be careful not to replace other occurrences
        pass

    # Also update any reference to "global_review" string
    content = content.replace("'global_review'", "'global_brand_review'")
    content = content.replace('"global_review"', '"global_brand_review"')

    loa_api.write_text(content, encoding="utf-8")
    print("  OK: updated global_review references")


# ═══════════════════════════════════════════════════════════════════
# 3. frontend/src/types/loa.ts — LOAStatus + STATUS_CONFIG
# ═══════════════════════════════════════════════════════════════════

print("\n[3/5] Patching frontend/src/types/loa.ts ...")

patch_file("frontend/src/types/loa.ts", [
    # Update LOAStatus type
    (
        "| 'global_review'            // Global Brands pre-validate (advance_phase)",
        "| 'global_brand_review'      // Global Brands review\n"
        "  | 'emea_brand_rework'        // EMEA checks brand comments, can edit or send back"
    ),
    # Add emea_functions_rework after global_functions_review
    (
        "| 'global_functions_review'  // PR/Medical/Trade comment, EMEA PS advances",
        "| 'global_functions_review'  // PR/Medical/Trade review\n"
        "  | 'emea_functions_rework'    // EMEA checks functions comments, can edit or send back"
    ),
    # Update STATUS_CONFIG
    (
        "global_review:            { label: 'Global review',      cls: 'badge-global-review' },",
        "global_brand_review:      { label: 'Brand review',       cls: 'badge-global-review' },\n"
        "  emea_brand_rework:        { label: 'EMEA rework',        cls: 'badge-emea-review' },"
    ),
    # Add emea_functions_rework after global_functions_review in STATUS_CONFIG
    (
        "global_functions_review:  { label: 'Global functions',   cls: 'badge-global-functions-review' },",
        "global_functions_review:  { label: 'Functions review',   cls: 'badge-global-functions-review' },\n"
        "  emea_functions_rework:    { label: 'EMEA final check',   cls: 'badge-emea-review' },"
    ),
])


# ═══════════════════════════════════════════════════════════════════
# 4. frontend/src/components/draft/ApprovalPanel.tsx — WORKFLOW_STEPS
# ═══════════════════════════════════════════════════════════════════

print("\n[4/5] Patching frontend/src/components/draft/ApprovalPanel.tsx ...")

patch_file("frontend/src/components/draft/ApprovalPanel.tsx", [
    (
        """const WORKFLOW_STEPS = [
  { key: 'draft',            label: 'Draft',             actor: 'Requestor' },
  { key: 'emea_review',      label: 'EMEA review',       actor: 'EMEA team' },
  { key: 'global_review',    label: 'Global review',     actor: 'Global Marketing' },
  { key: 'cmo_cfo_review',   label: 'CMO / CFO',         actor: 'CMO and CFO' },
  { key: 'global_functions', label: 'Global functions',  actor: 'Global Functions' },
  { key: 'corporate_review', label: 'Corporate',         actor: 'Corporate team' },
  { key: 'approved',         label: 'Approved',          actor: 'Final' },
];""",
        """const WORKFLOW_STEPS = [
  { key: 'draft',                    label: 'Draft',              actor: 'Requestor' },
  { key: 'emea_review',              label: 'EMEA review',        actor: 'EMEA team' },
  { key: 'global_brand_review',      label: 'Brand review',       actor: 'Global Brands' },
  { key: 'emea_brand_rework',        label: 'EMEA rework',        actor: 'EMEA team' },
  { key: 'global_functions_review',  label: 'Functions review',   actor: 'Global Functions' },
  { key: 'emea_functions_rework',    label: 'EMEA check',         actor: 'EMEA team' },
  { key: 'cmo_cfo_review',           label: 'CMO / CFO',          actor: 'CMO and CFO' },
  { key: 'corporate_review',         label: 'Corporate',          actor: 'Corporate team' },
  { key: 'approved',                 label: 'Approved',           actor: 'Final' },
];"""
    ),
])


# ═══════════════════════════════════════════════════════════════════
# 5. frontend/src/app/admin/page.tsx — status labels
# ═══════════════════════════════════════════════════════════════════

print("\n[5/5] Patching frontend/src/app/admin/page.tsx ...")

admin = Path("frontend/src/app/admin/page.tsx")
if admin.exists():
    content = admin.read_text(encoding="utf-8")
    content = content.replace("global_review: 'Global'", "global_brand_review: 'Brand Review'")
    content = content.replace("'global_review'", "'global_brand_review'")
    content = content.replace('"global_review"', '"global_brand_review"')
    admin.write_text(content, encoding="utf-8")
    print("  OK: updated admin page references")


print("\n" + "=" * 60)
print("  Workflow V3 patch complete!")
print("  Restart backend (uvicorn) and frontend (npm run dev)")
print("=" * 60)
