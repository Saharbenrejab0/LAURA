'use client'

/**
 * Admin route segment layout — access-gated.
 *
 * Only super-admins (or roles that can override locks) may see /admin.
 * While the role is loading we show a neutral checking state; non-admins
 * are redirected to the tracker. This is the CLIENT-side guard — the backend
 * must also enforce admin-only on its /admin endpoints (defence in depth).
 */

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useMyRole } from '@/hooks/usePermissions'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { role, loading } = useMyRole()
  const router = useRouter()

  const isAdmin = role?.role_code === 'super_admin' || role?.can_override_lock === true

  useEffect(() => {
    if (!loading && !isAdmin) {
      router.replace('/')
    }
  }, [loading, isAdmin, router])

  if (loading) {
    return (
      <div data-admin-scope style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
        Checking access…
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div data-admin-scope style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
        Redirecting…
      </div>
    )
  }

  return <div data-admin-scope>{children}</div>
}
