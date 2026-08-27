/**
 * Admin Console navigation — from `docs/LAURA Admin Console.html`.
 *
 * All 11 screens the design specifies are listed, in its groups and order, so
 * the shape of the console is visible. Five are built against real data; six
 * have no data layer yet and are `pending`, which renders them disabled in the
 * nav with a plain statement of what is missing.
 *
 * `pending` is deliberately not the same as "hidden": hiding them would lose the
 * design's structure, and stubbing them with placeholder data would make an
 * unbuilt screen look finished. The six tables they need are a required input to
 * the queued database audit — see `PENDING_SCHEMA`.
 */

export type ScreenId =
  | 'overview' | 'users' | 'roles' | 'views'
  | 'chain' | 'cycles' | 'emergency'
  | 'refdata' | 'imports'
  | 'audit' | 'notifs'

export interface Screen {
  id: ScreenId
  label: string
  icon: string
  /** Group label, verbatim from the design. */
  group: string
  /** Header copy, verbatim from the design's PAGES map. */
  kicker: string
  title: string
  sub: string
  /** Missing schema. Present = the screen cannot be built yet. */
  pending?: string[]
}

export const SCREENS: Screen[] = [
  {
    id: 'overview', group: 'Overview', label: 'Admin home', icon: '◈',
    kicker: 'Overview', title: 'Admin home',
    sub: 'The cycle, the gates, and anything waiting on an admin.',
  },
  {
    id: 'users', group: 'People', label: 'Users & people', icon: '◉',
    kicker: 'People', title: 'Users & people',
    sub: 'Cluster marketers are scoped to their own cluster only.',
  },
  {
    id: 'roles', group: 'People', label: 'Roles & permissions', icon: '▦',
    kicker: 'People', title: 'Roles & permissions',
    sub: 'The single source of truth for who can do what. Edits apply the moment a row is saved.',
  },
  {
    id: 'views', group: 'People', label: 'View access', icon: '◫',
    kicker: 'People', title: 'View access & per-role interface',
    sub: 'A role only ever sees the views it is granted — no dead toggles, no greyed-out menus.',
    pending: ['role_view_access — which review templates each role may use, currently held in frontend code (lib/roles.ts) rather than the database'],
  },
  {
    id: 'chain', group: 'Workflow', label: 'Approval chain', icon: '⇥',
    kicker: 'Workflow', title: 'Approval chain',
    sub: 'The live gate sequence — read-only. Editing, reassigning and publishing gates need the approval_chain and approval_gate tables (queued for database audit).',
  },
  {
    id: 'cycles', group: 'Workflow', label: 'Cycles', icon: '◷',
    kicker: 'Workflow', title: 'Cycle management',
    sub: 'One normal cycle may be open at a time. Emergency cycles run alongside it.',
  },
  {
    id: 'emergency', group: 'Workflow', label: 'Emergency LOAs', icon: '⚑',
    kicker: 'Workflow', title: 'Emergency LOA settings',
    sub: 'Off-cycle requests with a shortened chain and a restricted audience.',
    pending: ['emergency_settings — the shortened chain and the restricted audience, per cycle type'],
  },
  {
    id: 'refdata', group: 'Data', label: 'Reference data', icon: '☰',
    kicker: 'Data', title: 'Reference data',
    sub: 'Every dropdown a marketer sees. Nothing referenced by an existing LOA can be hard-deleted.',
    pending: ['reference_value — brands, activity types, countries and clusters as rows. They currently live in backend/reference_data.py, a Python module, so they cannot be edited without a deploy'],
  },
  {
    id: 'imports', group: 'Data', label: 'Data & imports', icon: '↧',
    kicker: 'Data', title: 'Data & imports',
    sub: 'Live, historical and demo rows. Every batch is reversible.',
  },
  {
    id: 'audit', group: 'System', label: 'Audit log', icon: '◍',
    kicker: 'System', title: 'Audit log',
    sub: 'Who did what, when — with the before and after value where one exists.',
    pending: ['audit_log — actor, action, target, before value, after value, timestamp. Nothing records this today; the current Admin "Audit" tab is a force-status override form, not a log'],
  },
  {
    id: 'notifs', group: 'System', label: 'Notifications', icon: '◎',
    kicker: 'System', title: 'Notifications',
    sub: 'Event → recipients → channel. Delivered through n8n to MS Teams and email.',
    pending: ['notification_rule — event, recipient roles and channel. Only cycle_close_notification exists, and it is a delivery log rather than a rule set'],
  },
]

/** Group order, verbatim from the design. */
export const GROUPS = ['Overview', 'People', 'Workflow', 'Data', 'System'] as const

export const byId = (id: ScreenId): Screen => SCREENS.find(s => s.id === id)!

export const isPending = (id: ScreenId): boolean => Boolean(byId(id).pending?.length)

/**
 * Every table the console needs and the database does not have. Reported, not
 * created — unplanned schema from a UI build is exactly what the queued database
 * audit exists to prevent.
 *
 * BUDGET_ALERT_THRESHOLD (currently €50 000) is a frontend constant in admin/page.tsx.
 * A future budget_alert_config table would let admins change it without a deploy.
 */
export const PENDING_SCHEMA: string[] = SCREENS.flatMap(s => s.pending ?? [])
