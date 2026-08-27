'use client'
/**
 * CycleViewFrame — the chrome shared by /cycles/:id/deck, /sheet and /both.
 *
 * Holds three things so the three routes don't each reinvent them:
 *   - back to the folder page (a real route, so browser Back agrees with it)
 *   - loading / error states
 *   - the "change view" control
 *
 * The switcher lists exactly the templates `allowedTemplates()` grants — the
 * same set the chooser offers and the route guard enforces. A role with one
 * allowed template gets no switcher at all, because there is nothing to switch
 * to; that is `showsViewToggle()`, derived from the set rather than from a role
 * name so the two can never disagree.
 */
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMyRole } from '@/hooks/usePermissions'
import {
  interfaceFor, allowedTemplates, showsViewToggle, TEMPLATE_COPY, type Template,
} from '@/lib/roles'
import { ROUTES, templateHref } from '@/lib/routes'
import { rememberCycleView } from '@/components/cycles/cycleViewChoice'

export default function CycleViewFrame({
  cycleId,
  cycleName,
  active,
  loading,
  error,
  children,
}: {
  cycleId: string | null
  cycleName?: string | null
  active: Template
  loading?: boolean
  error?: string | null
  children: React.ReactNode
}) {
  const router = useRouter()
  const { role } = useMyRole()
  const iface = interfaceFor(role?.role_code, role?.can_override_lock === true)

  const canSwitch = showsViewToggle(iface)
  const options = allowedTemplates(iface)

  const switchTo = (t: Template) => {
    if (!cycleId) return
    // Switching from inside the view updates the remembered choice, per the
    // spec's "let them change it from within the view".
    rememberCycleView(cycleId, t)
    router.push(templateHref(cycleId, t))
  }

  return (
    <div className="la-cycleview">
      <div className="la-cycleview-bar">
        <Link href={ROUTES.cycles} className="la-cycleview-back">
          ← Review cycles
        </Link>
        {cycleName && <span className="la-cycleview-name">{cycleName}</span>}

        {canSwitch && cycleId && (
          <div className="la-cycleview-switch" role="group" aria-label="Change view">
            {options.map(t => (
              <button
                key={t}
                onClick={() => switchTo(t)}
                aria-pressed={active === t}
                className={active === t ? 'la-cycleview-seg is-on' : 'la-cycleview-seg'}
              >{TEMPLATE_COPY[t].title}</button>
            ))}
          </div>
        )}
      </div>

      <div className="la-cycleview-body">
        {error ? (
          <div className="la-cycleview-msg" role="alert">{error}</div>
        ) : loading ? (
          <div className="la-cycleview-msg">Loading cycle…</div>
        ) : (
          children
        )}
      </div>
    </div>
  )
}
