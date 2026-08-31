"""
LAURA — Comment visibility service  (Rock 2)

Three responsibilities:
  1. default_visibility(author)  → what visibility a new comment gets
  2. can_view_comment(viewer, comment, loa)  → bool
  3. can_resolve_comment(viewer, comment, loa)  → bool

Visibility rules (from ChatGPT architecture + our refinements):

  loa_participants   → anyone with View access on this LOA can see it
  role_scoped        → only: same role group + EMEA PS + validators +
                       corporate + super-admin + LOA owner + local finance
  private_admin      → super_admin + ai_to_market_admin only

Role groups that get role_scoped by default:
  - global_brand_*      (6 roles)
  - global_function_*   (3 roles)

Everyone else gets loa_participants by default.

Resolve permissions:
  - Comment author can resolve own comment
  - EMEA PS Editor can resolve any comment during editable steps
  - Super Admin can resolve anything
  - LOA owner can resolve comments on their own LOA
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from backend.models.user import User
    from backend.models.comment import Comment
    from backend.models.loa import LOA

from backend.models.comment import (
    VIS_LOA_PARTICIPANTS,
    VIS_ROLE_SCOPED,
    VIS_PRIVATE_ADMIN,
    SEVERITY_BLOCKING,
)


# ── Role code prefixes ────────────────────────────────────────────────

_SCOPED_PREFIXES = ("global_brand_", "global_function_")

_GOVERNANCE_ROLES = frozenset({
    "emea_ps_editor",
    "regional_cmo",
    "regional_cfo",
    "corporate_paola",
    "corporate_diana",
    "super_admin",
    "ai_to_market_admin",
})

_ADMIN_ROLES = frozenset({
    "super_admin",
    "ai_to_market_admin",
})

_EMEA_AND_ABOVE = frozenset({
    "emea_ps_editor",
    "regional_cmo",
    "regional_cfo",
    "corporate_paola",
    "corporate_diana",
    "super_admin",
})


def _role_code(user: "User") -> str:
    """Get the effective role code for a user."""
    if user.role_obj:
        return user.role_obj.code
    return user.role or "unknown"


def _is_scoped_role(role_code: str) -> bool:
    """Does this role get role_scoped visibility by default?"""
    return any(role_code.startswith(p) for p in _SCOPED_PREFIXES)


def _same_role_group(code_a: str, code_b: str) -> bool:
    """
    Are two role codes in the same group?
    e.g. global_brand_oakley and global_brand_oakley → True
    e.g. global_brand_oakley and global_brand_rayban → False
    """
    return code_a == code_b


def _is_governance(role_code: str) -> bool:
    return role_code in _GOVERNANCE_ROLES


def _is_admin(role_code: str) -> bool:
    return role_code in _ADMIN_ROLES


def _is_loa_owner(user: "User", loa: "LOA") -> bool:
    return user.email == getattr(loa, "requestor_email", None)


def _is_local_finance_for_loa(user: "User", loa: "LOA") -> bool:
    """Local finance role for the same cluster as the LOA."""
    code = _role_code(user)
    if not code.endswith("_finance"):
        return False
    loa_cluster = getattr(loa, "cluster", None)
    user_cluster = getattr(user, "cluster", None)
    if loa_cluster and user_cluster:
        return loa_cluster.lower() == user_cluster.lower()
    return False


# ═══════════════════════════════════════════════════════════════════════
# 1. Default visibility for a new comment
# ═══════════════════════════════════════════════════════════════════════

def default_visibility(user: "User") -> str:
    """
    Determine the default visibility for a comment written by this user.

    - Global Brand / Global Function roles → role_scoped
      (their comments may contain sensitive brand judgment)
    - Everyone else → loa_participants
    """
    code = _role_code(user)
    if _is_scoped_role(code):
        return VIS_ROLE_SCOPED
    return VIS_LOA_PARTICIPANTS


# ═══════════════════════════════════════════════════════════════════════
# 2. Can a viewer see a specific comment?
# ═══════════════════════════════════════════════════════════════════════

def can_view_comment(
    viewer: "User",
    comment: "Comment",
    loa: "LOA",
) -> bool:
    """
    Decide whether `viewer` can see `comment` on `loa`.

    Rules by visibility level:
      loa_participants  → anyone with view access (caller already checked)
      role_scoped       → same role group OR governance OR LOA owner OR local finance
      private_admin     → admin roles only
    """
    vis = comment.visibility or VIS_LOA_PARTICIPANTS
    viewer_code = _role_code(viewer)

    # Soft-deleted comments are hidden from everyone except admins
    if comment.deleted_at is not None:
        return _is_admin(viewer_code)

    # ── private_admin ─────────────────────────────────────────────
    if vis == VIS_PRIVATE_ADMIN:
        return _is_admin(viewer_code)

    # ── loa_participants ──────────────────────────────────────────
    if vis == VIS_LOA_PARTICIPANTS:
        # The caller (API endpoint) already verified the viewer has
        # at least View access on the LOA. So return True.
        return True

    # ── role_scoped ───────────────────────────────────────────────
    if vis == VIS_ROLE_SCOPED:
        # The comment author's role
        author_role = comment.author_role_code if hasattr(comment, "author_role_code") else comment.author_role

        # 1. Same role → can see
        if _same_role_group(viewer_code, _normalize_author_role(comment)):
            return True

        # 2. Governance roles (EMEA PS, CMO, CFO, Corporate, Super-Admin, AI to Market) → can see
        if _is_governance(viewer_code):
            return True

        # 3. LOA owner → can see (they need to act on the feedback)
        if _is_loa_owner(viewer, loa):
            return True

        # 4. Local finance for same cluster → can see
        if _is_local_finance_for_loa(viewer, loa):
            return True

        # 5. Comment author themselves → can always see their own
        if viewer.email == comment.author_email:
            return True

        return False

    # Unknown visibility → default deny
    return False


def _normalize_author_role(comment: "Comment") -> str:
    """
    Extract the role code from the comment. The comment stores the
    display_name in author_role (e.g. "Global Brand Oakley"), but we
    need the code (e.g. "global_brand_oakley") for comparison.

    We store the code in metadata if available, otherwise derive it
    from the display name.
    """
    meta = comment.metadata_ or {}
    if "author_role_code" in meta:
        return meta["author_role_code"]

    # Derive from display name: "Global Brand Oakley" → "global_brand_oakley"
    display = comment.author_role or ""
    return display.lower().replace(" — ", "_").replace(" - ", "_").replace(" ", "_")


# ═══════════════════════════════════════════════════════════════════════
# 3. Can a viewer resolve/reopen a comment?
# ═══════════════════════════════════════════════════════════════════════

def can_resolve_comment(
    viewer: "User",
    comment: "Comment",
    loa: "LOA",
) -> bool:
    """
    Who can resolve a comment:
      - The comment's author (they can withdraw their own feedback)
      - EMEA PS Editor (they orchestrate the workflow)
      - Super Admin
      - LOA owner (they "addressed" the feedback)
    """
    viewer_code = _role_code(viewer)

    # Author can resolve own comment
    if viewer.email == comment.author_email:
        return True

    # Super admin can resolve anything
    if viewer_code == "super_admin":
        return True

    # EMEA PS Editor can resolve during editable steps
    if viewer_code == "emea_ps_editor":
        return True

    # LOA owner can resolve (they addressed the feedback)
    if _is_loa_owner(viewer, loa):
        return True

    return False


def can_reopen_comment(
    viewer: "User",
    comment: "Comment",
    loa: "LOA",
) -> bool:
    """
    Who can reopen a resolved comment:
      - The original comment author
      - EMEA PS Editor
      - Super Admin
    """
    viewer_code = _role_code(viewer)

    if viewer.email == comment.author_email:
        return True
    if viewer_code in ("super_admin", "emea_ps_editor"):
        return True

    return False


# ═══════════════════════════════════════════════════════════════════════
# 4. Severity permissions
# ═══════════════════════════════════════════════════════════════════════

def allowed_severities(user: "User") -> list[str]:
    """
    Which severity levels can this user set on a comment?

    - Everyone can write 'note' and 'suggestion'
    - Only governance roles can write 'blocking' (it affects workflow)
    """
    code = _role_code(user)
    base = ["note", "suggestion"]

    if code in _EMEA_AND_ABOVE:
        base.append("blocking")

    # Global Brand / Function can also write blocking during their step
    if _is_scoped_role(code):
        base.append("blocking")

    return base


# ═══════════════════════════════════════════════════════════════════════
# 5. Filter a list of comments for a viewer
# ═══════════════════════════════════════════════════════════════════════

def filter_visible_comments(
    viewer: "User",
    comments: list["Comment"],
    loa: "LOA",
) -> list["Comment"]:
    """Filter a list of comments to only those the viewer can see."""
    return [c for c in comments if can_view_comment(viewer, c, loa)]
