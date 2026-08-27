'use client'
/**
 * `/` — a redirector, and nothing else.
 *
 * This route used to be the whole application: the tracker, the folder page, the
 * CMO deck, the CFO sheet, the split-screen and the past-cycles archive, all
 * switched with `useState`. Because none of those switches touched the URL,
 * every user had exactly one history entry, so Back from anywhere landed on the
 * entry before it — the auth page. That is the bug.
 *
 * It renders no UI now. Each of those screens is a real route, and `/` only
 * decides which one this role starts on. `router.replace` is deliberate: `/`
 * must not sit in the history stack, or Back from the landing screen would
 * bounce through here and out to auth again.
 */
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useMyRole } from '@/hooks/usePermissions'
import { interfaceFor } from '@/lib/roles'
import { landingFor } from '@/lib/routes'

export default function RootRedirect() {
  const router = useRouter()
  const { role, loading, error } = useMyRole()

  useEffect(() => {
    if (loading) return
    // A failed /me is an auth problem; middleware owns that redirect, so send
    // the user to the list and let the server decide, rather than guessing here.
    const iface = interfaceFor(role?.role_code, role?.can_override_lock === true)
    router.replace(landingFor(iface))
  }, [loading, role, error, router])

  return (
    <div className="la-boot" role="status" aria-live="polite">
      <span className="la-boot-mark" aria-hidden="true">
        <span className="la-logomark-a" />
        <span className="la-logomark-b" />
      </span>
      <p>Opening LAURA…</p>
    </div>
  )
}
