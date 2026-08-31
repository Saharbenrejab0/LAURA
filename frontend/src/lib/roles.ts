import { type Template, ALL_TEMPLATES, TEMPLATE_COPY } from './templates'
export { ALL_TEMPLATES, TEMPLATE_COPY }
export type { Template }

/**
 * Role model — one place, read by the navbar, the route guards, and the pages.
 *
 * The rule from the spec: "Never offer a destination the route will refuse."
 * That only holds if the menu and the guard consult the SAME function, so both
 * call `canAccess()` here. Adding a destination to the navbar without adding it
 * here does nothing — by design.
 *
 * Role codes are the real codes in the `role` table, verified against the
 * database. Where the spec named a role that does not exist yet, the mapping
 * comment records what it resolves to today.
 */

export type Interface =
  | 'admin'          // everything
  | 'cmo'            // folder → deck
  | 'cfo'            // folder → sheet
  | 'emea'           // folder → view chooser (deck | sheet | both)
  | 'corporate'      // folder, view + comment (see note on validate below)
  | 'alignment'      // list at their stage → split-screen, comment + approve
  | 'marketer'       // list of their OWN LOAs → split-screen, create + edit
  | 'tracker'        // the default full tracker — every role not named above

/** Regional CMO — folder page then the slideshow. */
const CMO_ROLES = ['regional_cmo'] as const

/** Regional CFO — folder page then the spreadsheet. */
const CFO_ROLES = ['regional_cfo'] as const

/**
 * Stage reviewers. One screen each: the list of LOAs at their stage, then the
 * split-screen. Comment and approve; never reject.
 */
const ALIGNMENT_ROLES = [
  'local_alignment',
  'global_function_review',
  'global_brand_review',
] as const

/**
 * EMEA. The spec asked for a role coded `emea`, which does not exist. These are
 * the EMEA roles that do, and they carry no `validate` on any status, so giving
 * them the view chooser takes nothing away.
 */
const EMEA_ROLES = ['emea_creator'] as const

/**
 * Corporate Finance. The spec asked for `corporate_finance`, which does not
 * exist; these two are "Corporate Marketing Finance" in the database.
 *
 * IMPORTANT — they are NOT stripped of approve. `corporate_review → approved`
 * is the last transition in the workflow and these are the only two roles
 * holding `validate` on it (only `super_admin` can override). Removing it would
 * strand every LOA one step short of approved. They get the folder landing and
 * view+comment; the approve gate stays until the permission-matrix work moves it.
 */
const CORPORATE_ROLES = ['corporate_paola', 'corporate_diana'] as const

export function interfaceFor(roleCode: string | null | undefined, isAdmin = false): Interface {
  const code = roleCode ?? ''
  if (isAdmin || code === 'super_admin') return 'admin'
  if ((CMO_ROLES as readonly string[]).includes(code)) return 'cmo'
  if ((CFO_ROLES as readonly string[]).includes(code)) return 'cfo'
  if ((EMEA_ROLES as readonly string[]).includes(code)) return 'emea'
  if ((CORPORATE_ROLES as readonly string[]).includes(code)) return 'corporate'
  if ((ALIGNMENT_ROLES as readonly string[]).includes(code)) return 'alignment'
  // Local alignment: cluster-scoped finance, procurement and compliance (e.g. france_finance).
  if (code.endsWith('_finance') || code.endsWith('_procurement') || code.endsWith('_compliance')) return 'alignment'
  // Domain-expert brand/function reviewers + Trade Marketing (emea_commenter_tm has no global_function_ prefix).
  if (code.startsWith('global_brand_') || code.startsWith('global_function_') || code === 'emea_commenter_tm') return 'alignment'
  if (code.endsWith('_marketer')) return 'marketer'
  return 'tracker'
}

/** Corporate keeps its approve gate — see CORPORATE_ROLES. */
export function keepsValidateGate(roleCode: string | null | undefined): boolean {
  return (CORPORATE_ROLES as readonly string[]).includes(roleCode ?? '')
}

/** Corporate is view + comment on everything except its own approve gate. */
export function canApproveInReview(iface: Interface): boolean {
  return iface === 'admin' || iface === 'alignment' || iface === 'cmo' || iface === 'cfo'
}

/** Nobody but admin rejects from these screens; alignment explicitly cannot. */
export function canReject(iface: Interface): boolean {
  return iface === 'admin' || iface === 'cmo' || iface === 'cfo'
}

export function canEditLOAs(iface: Interface): boolean {
  return iface === 'admin' || iface === 'marketer'
}

export function canCreateLOAs(iface: Interface): boolean {
  return iface === 'admin' || iface === 'marketer'
}

/**
 * Historical Campaigns. Deliberately widened to marketers — the spec calls this
 * out as an explicit decision, so the ROUTE gate changes here, not just a menu
 * entry. Reviewers who land on a folder page get it too; it is read-only data.
 */
export function canSeeHistorical(_iface: Interface): boolean {
  return true
}

/**
 * The LOA list. Offered only where /loas actually serves something:
 *
 *   - marketer / alignment  -> their own list (RoleLOAList)
 *   - admin / tracker       -> the full tracker
 *
 * NOT offered to CMO, CFO, EMEA or Corporate: /loas redirects them back to the
 * folder page, so advertising it would be offering a destination the route
 * refuses. Admin keeps it because the tracker is still reachable, and the spec
 * requires it to be reachable from the ⊙⊙ menu rather than as a landing page.
 */
export function canSeeLOAList(iface: Interface): boolean {
  return iface === 'admin' || iface === 'tracker'
    || iface === 'marketer' || iface === 'alignment'
}

/** Past Campaigns is a template picker — only people who can create LOAs need it. */
export function canSeePastCampaigns(iface: Interface): boolean {
  return canCreateLOAs(iface)
}

export function canSeeAdmin(iface: Interface): boolean {
  return iface === 'admin'
}

// ═══════════════════════════════════════════════════════════════════════════
// REVIEW TEMPLATES — the one place that answers "which templates may this
// role use". The chooser and the route guard both read from here; nothing
// else may encode a role→template rule.
//
// The template vocabulary itself (the union, the copy) lives in ./templates so
// that render-only consumers need not depend on a module about roles.
//
// Before this existed the answer was spread across three places that could
// disagree: `landsOnFolder`, a `defaultKind()` in the cycles page, and a
// hard-coded OPTIONS array inside the chooser component.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Order matters: it is the order the chooser lists them in, and the first
 * entry is the role's default when exactly one is allowed.
 *
 * The 34 roles outside the spec's table resolve to `tracker` and keep today's
 * behaviour — deck on folder open — per the standing decision not to touch them.
 */
const TEMPLATES: Record<Interface, readonly Template[]> = {
  // Admin gets every lens, including `list` — the plain roster a marketer sees.
  // The point of the admin folder page is to look at a cycle the way any role
  // would, so the set is the union of what the other roles get.
  admin:     ['deck', 'sheet', 'split', 'list'],
  emea:      ['deck', 'sheet', 'split'],
  cmo:       ['deck'],
  cfo:       ['sheet'],
  corporate: ['deck'],   // view + comment only; see CORPORATE_ROLES
  alignment: ['split'],
  marketer:  ['split'],
  tracker:   ['deck'],
}

export function allowedTemplates(iface: Interface): readonly Template[] {
  return TEMPLATES[iface] ?? ['deck']
}

/** The guard side. A route that serves a template must call this. */
export function canUseTemplate(iface: Interface, t: Template): boolean {
  return allowedTemplates(iface).includes(t)
}

/**
 * True when the role must be asked. Exactly one allowed template is never an
 * interstitial — one extra click on every folder open is a regression.
 */
export function needsTemplateChooser(iface: Interface): boolean {
  return allowedTemplates(iface).length > 1
}

/** The single template a role gets when it has no choice to make. */
export function soleTemplate(iface: Interface): Template {
  return allowedTemplates(iface)[0]
}

/**
 * Whether a remembered template may skip the chooser on the next folder open.
 *
 * Admin is deliberately excluded: an admin opens a cycle to inspect it as a
 * given role would, and which role that is changes from one visit to the next.
 * Silently replaying last time's pick is wrong for them, so they are asked
 * every time and the chooser hides its "remember" checkbox.
 */
export function canRememberTemplate(iface: Interface): boolean {
  return iface !== 'admin'
}

/** Roles that get a folder page rather than a list. */
export function landsOnFolder(iface: Interface): boolean {
  // Derived from the template set, not from a list of role names.
  //
  // Admin now lands here — leaving it out was the bug where admin landed on the
  // old tracker while every other role went through the folder page. Admin is
  // not a different application: it is the folder page plus wider permissions
  // plus the Admin Console.
  //
  // Two interfaces still land on a LIST rather than the folder:
  //   - a role whose only template is the per-LOA split-screen has nothing to
  //     open at cycle scope; it starts from its own LOA list (marketers, stage
  //     reviewers), which is what the spec's table asks for
  //   - `tracker`, the 34 roles outside the spec's table, which keep today's
  //     behaviour untouched
  if (iface === 'tracker') return false
  const t = allowedTemplates(iface)
  if (t.length === 1 && t[0] === 'split') return false
  return true
}

/**
 * No view toggles for any non-admin role — one screen each.
 */
/**
 * A view switcher is shown only where the role genuinely has a choice. Derived
 * from the template set, not from a role name, so it can never disagree with
 * the chooser.
 */
export function showsViewToggle(iface: Interface): boolean {
  return needsTemplateChooser(iface)
}
