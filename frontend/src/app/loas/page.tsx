'use client'
/**
 * /loas — the LOA list.
 *
 * One route, three shapes, chosen by role rather than by a toggle (the spec is
 * explicit: no view toggles for any non-admin role, one screen each):
 *
 *   marketer  → RoleLOAList, their own LOAs
 *   alignment → RoleLOAList, the LOAs at their stage
 *   admin     → the full tracker, with its filters, board and deck views
 *   tracker   → the full tracker (every role not named in the spec's table
 *               keeps exactly the screen it has today — that was a deliberate
 *               decision, not an oversight)
 *
 * Roles that land on a folder (CMO / CFO / EMEA / Corporate) are redirected to
 * /cycles rather than shown a list they have no use for.
 */
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useMyRole } from '@/hooks/usePermissions'
import { interfaceFor } from '@/lib/roles'
import { landsOnFolder } from '@/lib/roles'
import { ROUTES } from '@/lib/routes'
import RoleLOAList from '@/components/loas/RoleLOAList'
import TrackerPage from '@/components/TrackerPage'

export default function LOAsPage() {
  const router = useRouter()
  const { role, loading } = useMyRole()

  const iface = interfaceFor(role?.role_code, role?.can_override_lock === true)
  const folderRole = !loading && landsOnFolder(iface)

  // `replace`, not `push`: a role that never belongs on this list should not
  // leave a history entry here for Back to fall into.
  useEffect(() => {
    if (folderRole) router.replace(ROUTES.cycles)
  }, [folderRole, router])

  if (loading) return <p className="la-rolelist-msg">Loading…</p>
  if (folderRole) return null

  if (iface === 'marketer' || iface === 'alignment') {
    return (
      <RoleLOAList
        iface={iface}
        roleCode={role?.role_code || ''}
        roleLabel={role?.role_display_name || role?.role_code || 'Your role'}
      />
    )
  }

  return <TrackerPage />
}
