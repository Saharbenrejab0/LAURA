'use client'
/**
 * RouteGuard — enforces the route side of "never offer a destination the route
 * will refuse".
 *
 * The navbar builds its menu from `destinationsFor()`; this guards the route
 * with `canAccess()`. Both resolve through lib/roles.ts, so a page cannot be
 * reachable-but-hidden or offered-but-refused.
 *
 * Two things it deliberately does NOT do:
 *   - It never redirects to the auth page. Middleware owns authentication; a
 *     guard that bounced to /login on a permissions miss is exactly the "auth
 *     redirect as a side effect of navigation" the spec rules out.
 *   - It does not decide anything while the role is still loading, or a
 *     legitimate user would be thrown off the page on every hard reload.
 *
 * Historical Campaigns is intentionally open to marketers — `canSeeHistorical`
 * returns true for every authenticated role. That widening lives in roles.ts, so
 * this guard and the menu both honour it without a special case here.
 */
import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useMyRole } from '@/hooks/usePermissions'
import { interfaceFor } from '@/lib/roles'
import { canAccess, landingFor } from '@/lib/routes'

export default function RouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/'
  const router = useRouter()
  const { role, loading, error } = useMyRole()

  const iface = interfaceFor(role?.role_code, role?.can_override_lock === true)
  // `error` means /me failed — an auth problem, which is middleware's job. Don't
  // second-guess it here, or a flaky request looks like a permissions denial.
  const denied = !loading && !error && !canAccess(iface, pathname)

  useEffect(() => {
    // `replace`: the refused URL must not stay in history for Back to return to.
    if (denied) router.replace(landingFor(iface))
  }, [denied, iface, router])

  if (denied) {
    return (
      <p className="la-rolelist-msg" role="status">
        That page is not available for your role. Taking you back…
      </p>
    )
  }

  return <>{children}</>
}
