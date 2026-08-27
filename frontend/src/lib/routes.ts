/**
 * Routes — every view in LAURA has a real URL.
 *
 * Before this file, almost the whole app lived at `/` and switched with
 * `useState`, which is why Back always landed on the auth page: there was only
 * ever one history entry to go back to. Each entry below is a real Next.js
 * route, so Back and Forward walk the user's actual path and deep links work.
 *
 * Existing conventions are preserved rather than renamed: sign-in stays at
 * `/login`, LOA detail stays at `/loa/[id]`. The spec's `/welcome` and
 * `/loas/:id` are the same screens under this project's existing names.
 */

import type { Interface, Template } from './roles'
import {
  canSeeAdmin, canSeeHistorical, canSeePastCampaigns, canCreateLOAs, landsOnFolder,
  canUseTemplate, allowedTemplates, needsTemplateChooser, soleTemplate, canSeeLOAList,
  canRememberTemplate,
} from './roles'

export const ROUTES = {
  login:         '/login',
  welcome:       '/welcome',
  cycles:        '/cycles',
  loas:          '/loas',
  loaNew:        '/loa/new',
  loaNewType:    '/loa/new/type',
  /**
   * Campaign Library — the single entry that replaced `/historical` and
   * `/past-campaigns`. Both old paths still resolve (they redirect here), so an
   * old bookmark or a link in an email keeps working.
   */
  campaigns:     '/campaigns',
  historical:    '/historical',
  pastCampaigns: '/past-campaigns',
  admin:         '/admin',
} as const

export const cycleDeck  = (id: string) => `/cycles/${id}/deck`
export const cycleSheet = (id: string) => `/cycles/${id}/sheet`
export const cycleBoth  = (id: string) => `/cycles/${id}/both`
export const cycleList  = (id: string) => `/cycles/${id}/list`
export const loaDetail   = (id: string) => `/loa/${id}`

/** Reachable without a session. Must agree with PUBLIC_PATHS in middleware.ts. */
export const PUBLIC_ROUTES = [ROUTES.login, ROUTES.welcome] as const

/**
 * Where a role lands after sign-in. `/` is a redirector that calls this — it
 * renders no UI of its own, so it never becomes a dumping ground for state again.
 */
export function landingFor(iface: Interface): string {
  if (landsOnFolder(iface)) return ROUTES.cycles
  return ROUTES.loas
}

// ═══════════════════════════════════════════════════════════════════════════
// TEMPLATE RESOLUTION — the one function that turns (role, cycle) into a route.
// ═══════════════════════════════════════════════════════════════════════════

/** Where a template lives at CYCLE scope. */
export function templateHref(cycleId: string, t: Template): string {
  if (t === 'sheet') return cycleSheet(cycleId)
  if (t === 'split') return cycleBoth(cycleId)
  if (t === 'list') return cycleList(cycleId)
  return cycleDeck(cycleId)
}

/** Which template a cycle-scoped URL is serving. Used by the route guard. */
export function templateOfPath(pathname: string): Template | null {
  if (!pathname.startsWith('/cycles/')) return null
  if (pathname.endsWith('/sheet')) return 'sheet'
  if (pathname.endsWith('/both')) return 'split'
  if (pathname.endsWith('/deck')) return 'deck'
  if (pathname.endsWith('/list')) return 'list'
  return null
}

export type FolderOpen =
  | { kind: 'route'; href: string }
  | { kind: 'choose'; templates: readonly Template[] }

/**
 * Opening a cycle folder.
 *
 *   - exactly one allowed template  -> route straight to it, no interstitial
 *   - more than one                 -> ask, offering ONLY the allowed ones
 *   - a remembered choice           -> honoured, provided it is still allowed
 *
 * Roles whose only template is the per-LOA split-screen (marketers, stage
 * reviewers) go to their list instead: at cycle scope they have nothing to
 * open, and the split-screen is reached per LOA from that list.
 */
export function resolveFolderOpen(
  iface: Interface,
  cycleId: string,
  remembered: Template | null,
): FolderOpen {
  const allowed = allowedTemplates(iface)

  if (!needsTemplateChooser(iface)) {
    const only = soleTemplate(iface)
    if (only === 'split') return { kind: 'route', href: ROUTES.loas }
    return { kind: 'route', href: templateHref(cycleId, only) }
  }

  // A remembered choice that is no longer permitted must not be replayed, and
  // admin is never routed straight through — see canRememberTemplate.
  if (remembered && canRememberTemplate(iface) && canUseTemplate(iface, remembered)) {
    return { kind: 'route', href: templateHref(cycleId, remembered) }
  }

  return { kind: 'choose', templates: allowed }
}

export interface Destination {
  key: string
  label: string
  href: string
  icon: string
}

/**
 * The navigation menu, filtered by the SAME predicates the route guards use.
 * One list, so the menu can never offer a page the route will bounce.
 */
export function destinationsFor(iface: Interface): Destination[] {
  const all: (Destination & { allowed: boolean })[] = [
    { key: 'cycles',     label: 'Review cycles',        href: ROUTES.cycles,        icon: '▦', allowed: true },
    { key: 'loas',       label: 'LOAs',                 href: ROUTES.loas,          icon: '▤', allowed: canSeeLOAList(iface) },
    { key: 'new',        label: 'New LOA',              href: ROUTES.loaNew,        icon: '＋', allowed: canCreateLOAs(iface) },
    // One entry, two tabs inside. It replaced two that both misled: "Past
    // campaigns" was a template picker whose contents were 99.4% imported
    // history, and "Historical campaigns" sat beside it showing the same rows.
    // Visible to anyone who can create an LOA — it exists to seed one — or to
    // anyone allowed to read the imported archive.
    { key: 'campaigns',  label: 'Campaign Library',     href: ROUTES.campaigns,     icon: '◷', allowed: canSeePastCampaigns(iface) || canSeeHistorical(iface) },
    { key: 'admin',      label: 'Admin panel',          href: ROUTES.admin,         icon: '⚙', allowed: canSeeAdmin(iface) },
  ]
  return all.filter(d => d.allowed).map(({ allowed, ...d }) => d)
}

/**
 * The guard side of the same coin. A page calls this; the menu calls
 * `destinationsFor`. Both resolve through `roles.ts`.
 */
export function canAccess(iface: Interface, pathname: string): boolean {
  // Template routes are gated by the SAME set the chooser lists from, so the
  // chooser can never offer a template this would refuse.
  const t = templateOfPath(pathname)
  if (t) return canUseTemplate(iface, t)

  if (pathname.startsWith(ROUTES.admin))         return canSeeAdmin(iface)
  // The library holds both stores, so either permission opens it. The two old
  // paths keep their original predicate — they only redirect.
  if (pathname.startsWith(ROUTES.campaigns))     return canSeePastCampaigns(iface) || canSeeHistorical(iface)
  if (pathname.startsWith(ROUTES.pastCampaigns)) return canSeePastCampaigns(iface)
  if (pathname.startsWith(ROUTES.historical))    return canSeeHistorical(iface)
  if (pathname.startsWith(ROUTES.loaNew))        return canCreateLOAs(iface)
  if (pathname === ROUTES.loas)                  return canSeeLOAList(iface)
  return true
}

/** Breadcrumb trail for the navbar. Longest prefix wins. */
const CRUMBS: [string, string[]][] = [
  ['/cycles/',       ['Review cycles', 'Cycle']],
  ['/cycles',        ['Review cycles']],
  ['/loa/new',       ['LOAs', 'New LOA']],
  ['/loa/',          ['LOAs', 'LOA']],
  ['/loas',          ['LOAs']],
  ['/campaigns',     ['Campaign Library']],
  ['/historical',    ['Campaign Library', 'Imported history']],
  ['/past-campaigns',['Campaign Library']],
  ['/admin',         ['Admin']],
  ['/welcome',       ['Welcome']],
]

export function crumbsFor(pathname: string): string[] {
  for (const [prefix, trail] of CRUMBS) {
    if (pathname === prefix || pathname.startsWith(prefix)) return trail
  }
  return ['LAURA']
}
