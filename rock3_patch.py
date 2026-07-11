"""
Rock 3 — Workflow engine patcher for backend/api/loa.py

Usage:  python rock3_patch.py
        (run from C:\\Users\\sahar\\Desktop\\Laura)

This script finds 7 sections by their unique content markers and replaces
them with the new workflow engine code. It works bottom-to-top to preserve
line numbers. If any section can't be found, it aborts without writing.
"""

import sys

FILE = "backend/api/loa.py"
ENC = "latin-1"


def main():
    with open(FILE, "r", encoding=ENC) as f:
        lines = f.readlines()

    total = len(lines)
    print(f"Read {total} lines from {FILE}")

    # --- Helpers ---
    def find(marker, start=0):
        for i in range(start, len(lines)):
            if marker in lines[i]:
                return i
        return -1

    def find_block_end(start_idx):
        """Find end of a function/block: next line starting at column 0 that isn't blank."""
        for i in range(start_idx + 1, len(lines)):
            line = lines[i]
            if line.strip() == '':
                continue
            if len(line) > 0 and not line[0].isspace():
                # Found next top-level construct, go back to last non-blank
                end = i - 1
                while end > start_idx and lines[end].strip() == '':
                    end -= 1
                return end
        return len(lines) - 1

    # ===========================================================
    # LOCATE ALL 7 SECTIONS (verify markers exist)
    # ===========================================================
    print("\nLocating sections...")

    # --- Section 0: REJECT_DESTINATIONS ---
    s0_start = find("REJECT_DESTINATIONS = {")
    if s0_start < 0:
        print("ABORT: Cannot find REJECT_DESTINATIONS"); sys.exit(1)
    # Include the comment above it
    if s0_start > 0 and "reject" in lines[s0_start - 1].lower():
        s0_start -= 1
    s0_end = find("}", s0_start + 1)
    print(f"  [0] REJECT_DESTINATIONS: lines {s0_start+1}-{s0_end+1}")

    # --- Section 1: Workflow constants ---
    s1_start = find("WORKFLOW_TRANSITIONS = {")
    if s1_start < 0:
        print("ABORT: Cannot find WORKFLOW_TRANSITIONS"); sys.exit(1)
    # Include comment above
    if s1_start > 0 and "Workflow" in lines[s1_start - 1]:
        s1_start -= 1
    if s1_start > 0 and "Workflow" in lines[s1_start - 1]:
        s1_start -= 1
    s1_end = find("ADVANCE_PHASE_STATUSES", s1_start)
    if s1_end < 0:
        print("ABORT: Cannot find ADVANCE_PHASE_STATUSES"); sys.exit(1)
    # Find closing brace of ADVANCE_PHASE_STATUSES
    s1_end = find("}", s1_end)
    print(f"  [1] Workflow constants: lines {s1_start+1}-{s1_end+1}")

    # --- Section 2: Skip logic (_has_reviewer_for_step through _resolve_next_status) ---
    # Search AFTER s1_end to avoid matching "Sprint 5" in the module docstring
    s2_start = find("def _has_reviewer_for_step", s1_end)
    if s2_start < 0:
        print("ABORT: Cannot find _has_reviewer_for_step"); sys.exit(1)
    # Go back to include comments above the function (but not before s1_end + 2)
    min_s2 = s1_end + 2  # don't go past the scope filter section
    while s2_start > min_s2 and (lines[s2_start-1].strip().startswith('#') or lines[s2_start-1].strip() == ''):
        s2_start -= 1
    # Find end: last line of _resolve_next_status
    resolve_fn = find("def _resolve_next_status", s2_start)
    if resolve_fn < 0:
        print("ABORT: Cannot find _resolve_next_status"); sys.exit(1)
    s2_end = find_block_end(resolve_fn)
    print(f"  [2] Skip logic: lines {s2_start+1}-{s2_end+1}")

    # --- Section 3: _check_workflow_permission ---
    s3_comment = find("Workflow validation", s2_end)
    if s3_comment < 0:
        s3_comment = find("def _check_workflow_permission")
    s3_start = s3_comment
    if s3_start < 0:
        print("ABORT: Cannot find _check_workflow_permission"); sys.exit(1)
    # Find end: line before @router.post validate
    validate_decorator = find('@router.post("/{loa_id}/validate")', s3_start)
    if validate_decorator < 0:
        # Try with single quotes
        validate_decorator = find("@router.post('/{loa_id}/validate')", s3_start)
    if validate_decorator < 0:
        print("ABORT: Cannot find validate endpoint"); sys.exit(1)
    s3_end = validate_decorator - 1
    while s3_end > s3_start and lines[s3_end].strip() == '':
        s3_end -= 1
    print(f"  [3] _check_workflow_permission: lines {s3_start+1}-{s3_end+1}")

    # --- Section 4: validate + approve ---
    s4_start = validate_decorator
    approve_fn = find("Backward-compatible alias", s4_start)
    if approve_fn < 0:
        print("ABORT: Cannot find approve alias"); sys.exit(1)
    s4_end = find("return await validate_workflow_step", approve_fn)
    if s4_end < 0:
        print("ABORT: Cannot find approve return"); sys.exit(1)
    print(f"  [4] validate + approve: lines {s4_start+1}-{s4_end+1}")

    # --- Section 5: reject_loa ---
    s5_start = find('@router.post("/{loa_id}/reject")', s4_end)
    if s5_start < 0:
        s5_start = find("@router.post('/{loa_id}/reject')", s4_end)
    if s5_start < 0:
        print("ABORT: Cannot find reject endpoint"); sys.exit(1)
    # Include comment above
    temp = s5_start - 1
    while temp > s4_end and (lines[temp].strip().startswith('#') or lines[temp].strip() == ''):
        temp -= 1
    s5_start = temp + 1
    # Find end: the "return loa" after notify_n8n("loa_rejected")
    rejected_notify = find('notify_n8n("loa_rejected"', s5_start)
    if rejected_notify < 0:
        rejected_notify = find("loa_rejected", s5_start)
    s5_end = find("return loa", rejected_notify if rejected_notify > 0 else s5_start)
    if s5_end < 0:
        print("ABORT: Cannot find reject return"); sys.exit(1)
    print(f"  [5] reject_loa: lines {s5_start+1}-{s5_end+1}")

    # --- Section 6: add_comment ---
    s6_start = find("class CommentRequest", s5_end)
    if s6_start < 0:
        print("ABORT: Cannot find CommentRequest"); sys.exit(1)
    # Include comment above
    temp = s6_start - 1
    while temp > s5_end and (lines[temp].strip().startswith('#') or lines[temp].strip() == ''):
        temp -= 1
    s6_start = temp + 1
    s6_end = find('"comment_added"', s6_start)
    if s6_end < 0:
        print("ABORT: Cannot find comment return"); sys.exit(1)
    print(f"  [6] add_comment: lines {s6_start+1}-{s6_end+1}")

    # --- Section 7: delete_loa ---
    s7_start = find('@router.delete("/{loa_id}")', s6_end)
    if s7_start < 0:
        s7_start = find("@router.delete('/{loa_id}')", s6_end)
    if s7_start < 0:
        print("ABORT: Cannot find delete endpoint"); sys.exit(1)
    temp = s7_start - 1
    while temp > s6_end and (lines[temp].strip().startswith('#') or lines[temp].strip() == ''):
        temp -= 1
    s7_start = temp + 1
    s7_end = find('"deleted": True', s7_start)
    if s7_end < 0:
        print("ABORT: Cannot find delete return"); sys.exit(1)
    print(f"  [7] delete_loa: lines {s7_start+1}-{s7_end+1}")

    # ===========================================================
    # NEW CODE FOR EACH SECTION
    # ===========================================================

    new_s0 = """\
# -- Rejection rule (Rock 3) --
# Rejection at any step -> status becomes "rejected".
# Marketer re-edits and re-submits -> goes back to emea_review.
"""

    new_s1 = """\
# -- Workflow state machine (Rock 3 -- 9 statuses, parallel gates) ----------

# Linear transition map (for non-parallel-gate steps)
WORKFLOW_TRANSITIONS = {
    "emea_review":             "global_review",
    "global_review":           "emea_post_global_review",
    "emea_post_global_review": "cmo_cfo_review",
    "cmo_cfo_review":          "emea_final_review",
    "emea_final_review":       "corporate_review",
    "corporate_review":        "approved",
}

# Display order (used for rollback dropdown)
WORKFLOW_ORDER = [
    "draft", "emea_review", "global_review", "emea_post_global_review",
    "cmo_cfo_review", "emea_final_review", "corporate_review", "approved",
]

# Statuses requiring 'validate' permission (approval decisions)
VALIDATION_STATUSES = {"cmo_cfo_review", "corporate_review"}

# Statuses requiring 'advance_phase' permission (EMEA orchestration)
ADVANCE_PHASE_STATUSES = {"emea_review", "emea_post_global_review", "emea_final_review"}
"""

    new_s2 = """\
# -- Parallel gate helpers (Rock 3) ----------------------------------------

def _has_brand_reviewer(loa: LOA, db: Session) -> bool:
    \"\"\"Check if any global_brand_* role with active users matches this LOA's brand.\"\"\"
    from backend.models.role import Role
    if not loa.brand:
        return False
    brand_roles = db.query(Role).filter(Role.scope_type == 'brand').all()
    for role in brand_roles:
        scope_values = role.scope_value or []
        if loa.brand in scope_values:
            user_count = db.query(User).filter(User.role_id == role.id).count()
            if user_count > 0:
                return True
    return False


def _has_function_reviewer(loa: LOA, db: Session) -> bool:
    \"\"\"Check if any global_function_* role with active users matches this LOA's activity_type.\"\"\"
    from backend.models.role import Role
    if not loa.activity_type:
        return False
    func_roles = db.query(Role).filter(Role.scope_type == 'function').all()
    for role in func_roles:
        scope_values = role.scope_value or []
        if loa.activity_type in scope_values:
            user_count = db.query(User).filter(User.role_id == role.id).count()
            if user_count > 0:
                return True
    return False


def _compute_skip_flags(loa: LOA, db: Session) -> None:
    \"\"\"Set brand/function skip flags. Called when EMEA advances from emea_review.\"\"\"
    has_brand = _has_brand_reviewer(loa, db)
    has_func = _has_function_reviewer(loa, db)

    loa.brand_review_skipped = not has_brand
    loa.brand_review_done = not has_brand      # pre-mark done if skipped
    loa.function_review_skipped = not has_func
    loa.function_review_done = not has_func    # pre-mark done if skipped


def _is_global_review_complete(loa: LOA) -> bool:
    \"\"\"Check if both brand and function gates are satisfied (done or skipped).\"\"\"
    return loa.brand_review_done and loa.function_review_done
"""

    new_s3 = """\
# -- Workflow permission check (Rock 3) ------------------------------------

def _check_workflow_permission(user: User, loa: LOA, db: Session) -> str:
    \"\"\"
    Verify user has the required permission to act on this LOA.
    Returns permission code used. Raises HTTPException if denied.
    \"\"\"
    current_status = loa.status

    if current_status in VALIDATION_STATUSES:
        required_permission = 'validate'
    elif current_status in ADVANCE_PHASE_STATUSES:
        required_permission = 'advance_phase'
    else:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot advance a LOA in status '{current_status}'.",
        )

    role = user.role_obj
    if not role:
        raise HTTPException(status_code=403, detail="No role assigned")

    # Get ALL permissions this role has at this status
    perms = (
        db.query(Permission.code)
        .join(RolePermission, RolePermission.permission_id == Permission.id)
        .filter(
            RolePermission.role_id == role.id,
            RolePermission.loa_status == current_status,
        )
        .all()
    )
    perm_codes = {p[0] for p in perms}

    if not perm_codes:
        raise HTTPException(status_code=403, detail="No access at this workflow stage.")

    # advance_phase implies all others
    if 'advance_phase' in perm_codes:
        return 'advance_phase'
    if required_permission in perm_codes:
        return required_permission

    raise HTTPException(
        status_code=403,
        detail=f"You need '{required_permission}' permission. "
               f"You have: {', '.join(sorted(perm_codes))}",
    )
"""

    new_s4 = """\
@router.post("/{loa_id}/validate")
async def validate_workflow_step(
    loa_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    loa = db.query(LOA).filter(LOA.id == loa_id).first()
    if not loa:
        raise HTTPException(status_code=404, detail="LOA not found")

    if loa.is_locked:
        raise HTTPException(status_code=423, detail="LOA is locked by a super-admin.")

    current_status = loa.status

    # global_review advances automatically via comments, not via /validate
    if current_status == "global_review":
        raise HTTPException(
            status_code=400,
            detail="global_review advances automatically when reviewers comment.",
        )

    if current_status not in WORKFLOW_TRANSITIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot advance a LOA in status '{current_status}'.",
        )

    permission_used = _check_workflow_permission(user, loa, db)
    skipped = []

    # -- CMO/CFO parallel gate --
    if current_status == "cmo_cfo_review":
        role = user.role_obj
        role_code = role.code if role else ""

        if role_code == "regional_cmo":
            loa.cmo_approved = True
        elif role_code == "regional_cfo":
            loa.cfo_approved = True
        else:
            # Super-admin or advance_phase holder: approve both
            loa.cmo_approved = True
            loa.cfo_approved = True

        if loa.cmo_approved and loa.cfo_approved:
            new_status = WORKFLOW_TRANSITIONS[current_status]
            loa.status = new_status
        else:
            # One side approved, waiting for the other
            db.commit()
            db.refresh(loa)
            return loa

    # -- EMEA review -> global_review (with skip detection) --
    elif current_status == "emea_review":
        _compute_skip_flags(loa, db)
        if loa.brand_review_done and loa.function_review_done:
            # Both skipped -> jump past global_review
            loa.status = "emea_post_global_review"
            skipped.append("global_review")
        else:
            loa.status = "global_review"

    # -- All other steps: linear advance --
    else:
        new_status = WORKFLOW_TRANSITIONS.get(current_status)
        if not new_status:
            raise HTTPException(
                status_code=400,
                detail=f"No transition defined from status '{current_status}'.",
            )
        loa.status = new_status

    new_status = loa.status

    if new_status == "approved":
        loa.approved_at = datetime.utcnow()

    db.commit()
    db.refresh(loa)

    await notify_n8n("loa_validated", str(loa_id), {
        "requestor_email": loa.requestor_email,
        "loa_draft_id": loa.loa_draft_id,
        "from_status": current_status,
        "to_status": new_status,
        "skipped_steps": skipped,
        "validated_by": user.email,
        "permission_used": permission_used,
        "activity_type": loa.activity_type,
        "country": loa.country,
        "fy_total": loa.fy_2026_total,
    })

    if new_status == "approved":
        await notify_n8n("loa_approved", str(loa_id), {
            "requestor_email": loa.requestor_email,
            "loa_draft_id": loa.loa_draft_id,
            "loa_number": loa.loa_number or loa.loa_draft_id,
            "activity_type": loa.activity_type,
            "country": loa.country,
            "cluster": loa.cluster,
            "brand": loa.brand,
            "fy_total": loa.fy_2026_total,
        })

    return loa


@router.post("/{loa_id}/approve")
async def approve_loa(
    loa_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    \"\"\"Backward-compatible alias for POST /validate.\"\"\"
    return await validate_workflow_step(loa_id, db, user)
"""

    new_s5 = """\

@router.post("/{loa_id}/reject")
async def reject_loa(
    loa_id: str,
    reason: str = "",
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    loa = db.query(LOA).filter(LOA.id == loa_id).first()
    if not loa:
        raise HTTPException(status_code=404, detail="LOA not found")

    if loa.is_locked:
        raise HTTPException(status_code=423, detail="LOA is locked by a super-admin.")

    if not reason or not reason.strip():
        raise HTTPException(status_code=422, detail="A non-empty reason is required.")

    if loa.status == "draft":
        raise HTTPException(status_code=400, detail="Cannot reject a draft.")

    if loa.status in ("approved", "rejected"):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot reject a LOA already in status '{loa.status}'.",
        )

    _check_workflow_permission(user, loa, db)

    previous_status = loa.status
    loa.status = "rejected"
    loa.rejection_reason = reason.strip()

    # Reset ALL gate booleans
    loa.cmo_approved = False
    loa.cfo_approved = False
    loa.brand_review_done = False
    loa.function_review_done = False
    loa.brand_review_skipped = False
    loa.function_review_skipped = False

    db.commit()
    db.refresh(loa)

    await notify_n8n("loa_rejected", str(loa_id), {
        "requestor_email": loa.requestor_email,
        "loa_draft_id": loa.loa_draft_id,
        "rejected_by": user.email,
        "rejected_from_status": previous_status,
        "reason": reason.strip(),
    })

    return loa
"""

    new_s6 = """\

class CommentRequest(BaseModel):
    comment: str


@router.post("/{loa_id}/comment")
async def add_comment(
    loa_id: str,
    body: CommentRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    loa = db.query(LOA).filter(LOA.id == loa_id).first()
    if not loa:
        raise HTTPException(status_code=404, detail="LOA not found")

    if not body.comment or not body.comment.strip():
        raise HTTPException(status_code=422, detail="Comment cannot be empty.")

    role = user.role_obj
    if not role:
        raise HTTPException(status_code=403, detail="No role assigned")

    # Get ALL permissions this role has at this LOA's current status
    perms = (
        db.query(Permission.code)
        .join(RolePermission, RolePermission.permission_id == Permission.id)
        .filter(
            RolePermission.role_id == role.id,
            RolePermission.loa_status == loa.status,
        )
        .all()
    )
    perm_codes = {p[0] for p in perms}

    if not perm_codes:
        raise HTTPException(status_code=403, detail="No access at this stage.")

    # Need at least comment-level permission
    comment_perms = {'comment', 'validate', 'edit', 'advance_phase'}
    if not perm_codes & comment_perms:
        raise HTTPException(status_code=403, detail="You need at least comment permission.")

    timestamp = datetime.utcnow().strftime("%d %b %Y %H:%M")
    entry = f"[{timestamp}] {user.email}:\\n{body.comment.strip()}"

    if loa.cmo_comment:
        loa.cmo_comment = f"{loa.cmo_comment}\\n\\n---\\n\\n{entry}"
    else:
        loa.cmo_comment = entry

    # -- Parallel gate tracking for global_review --
    auto_advanced = False
    if loa.status == "global_review":
        if role.scope_type == "brand":
            loa.brand_review_done = True
        elif role.scope_type == "function":
            loa.function_review_done = True

        # Check if both gates are now complete -> auto-advance
        if _is_global_review_complete(loa):
            loa.status = "emea_post_global_review"
            auto_advanced = True

    db.commit()
    db.refresh(loa)

    result = {"status": "ok", "comment_added": entry}
    if auto_advanced:
        result["auto_advanced_to"] = "emea_post_global_review"
        await notify_n8n("loa_validated", str(loa_id), {
            "requestor_email": loa.requestor_email,
            "loa_draft_id": loa.loa_draft_id,
            "from_status": "global_review",
            "to_status": "emea_post_global_review",
            "skipped_steps": [],
            "validated_by": "auto (both review gates complete)",
            "permission_used": "comment",
            "activity_type": loa.activity_type,
            "country": loa.country,
            "fy_total": loa.fy_2026_total,
        })

    return result
"""

    new_s7 = """\
@router.delete("/{loa_id}")
async def delete_loa(
    loa_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    loa = db.query(LOA).filter(LOA.id == loa_id).first()
    if not loa:
        raise HTTPException(status_code=404, detail="LOA not found")

    role = user.role_obj
    if not role:
        raise HTTPException(status_code=403, detail="No role assigned")

    # Check matrix: does this role have 'delete' permission at this status?
    has_delete = (
        db.query(RolePermission)
        .join(Permission, RolePermission.permission_id == Permission.id)
        .filter(
            RolePermission.role_id == role.id,
            RolePermission.loa_status == loa.status,
            Permission.code == 'delete',
        )
        .first()
    )

    if not has_delete:
        raise HTTPException(
            status_code=403,
            detail=f"You don't have delete permission for LOAs in status '{loa.status}'.",
        )

    # Non-admin users can only delete their own LOAs
    if not role.can_override_lock and loa.requestor_email != user.email:
        raise HTTPException(
            status_code=403,
            detail="You can only delete your own LOAs.",
        )

    db.delete(loa)
    db.commit()
    return {"deleted": True, "loa_id": loa_id}
"""

    # ===========================================================
    # APPLY REPLACEMENTS (bottom to top)
    # ===========================================================

    def to_lines(text):
        return [l + "\n" for l in text.split("\n")]

    patches = [
        (s7_start, s7_end, to_lines(new_s7), "delete_loa"),
        (s6_start, s6_end, to_lines(new_s6), "add_comment"),
        (s5_start, s5_end, to_lines(new_s5), "reject_loa"),
        (s4_start, s4_end, to_lines(new_s4), "validate + approve"),
        (s3_start, s3_end, to_lines(new_s3), "_check_workflow_permission"),
        (s2_start, s2_end, to_lines(new_s2), "skip logic"),
        (s1_start, s1_end, to_lines(new_s1), "workflow constants"),
        (s0_start, s0_end, to_lines(new_s0), "REJECT_DESTINATIONS"),
    ]

    # Sort by start index descending (bottom to top)
    patches.sort(key=lambda p: p[0], reverse=True)

    print("\nApplying patches (bottom to top)...")
    for start, end, new_lines, name in patches:
        old_count = end - start + 1
        print(f"  {name}: replacing lines {start+1}-{end+1} ({old_count} lines) with {len(new_lines)} lines")
        lines[start:end+1] = new_lines

    # ===========================================================
    # WRITE RESULT
    # ===========================================================

    with open(FILE, "w", encoding=ENC) as f:
        f.writelines(lines)

    new_total = len(lines)
    print(f"\nDone. File saved: {FILE}")
    print(f"Lines: {total} -> {new_total}")


if __name__ == "__main__":
    main()
