'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useMyRole } from '@/hooks/usePermissions'
import { ThemeToggle } from '@/components/ThemeProvider'

interface NavHeaderProps {
  /** Which page is currently active */
  active: 'tracker' | 'admin'
}

export default function NavHeader({ active }: NavHeaderProps) {
  const router = useRouter()
  const { role } = useMyRole()
  const [user, setUser] = useState<any>(null)

  const isSuperAdmin = role?.can_override_lock === true
  const scopeDescription = (() => {
    if (!role) return null
    const parts = [role.role_display_name]
    if (role.role_scope_type === 'cluster' && role.role_scope_value?.length) {
      parts.push(`viewing ${role.role_scope_value.join(', ')}`)
    } else if (role.role_scope_type === 'brand' && role.role_scope_value?.length) {
      parts.push(`viewing ${role.role_scope_value.length} brand(s)`)
    } else if (role.role_scope_type === 'function' && role.role_scope_value?.length) {
      parts.push(`viewing ${role.role_scope_value.join(', ')}`)
    } else if (role.role_scope_type === 'all') {
      parts.push('full access')
    }
    return parts.join(' · ')
  })()

  useEffect(() => {
    const raw = localStorage.getItem('laura_user')
    if (raw) setUser(JSON.parse(raw))
  }, [])

  function handleLogout() {
    localStorage.removeItem('laura_token')
    localStorage.removeItem('laura_user')
    sessionStorage.removeItem('laura.visitedLOAs')
    document.cookie = 'laura_token=; path=/; max-age=0'
    router.push('/login')
  }

  return (
    <header
      className="sticky top-0 z-20"
      style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}
    >
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">

        {/* Left: Logo + Nav pills + Scope badge */}
        <div className="flex items-center gap-4">
          <span
            className="text-base font-semibold tracking-tight"
            style={{ color: 'var(--text-primary)' }}
          >
            LAURA
          </span>

          {/* Nav pills */}
          <div
            className="flex gap-1 p-0.5 rounded-lg"
            style={{ background: 'var(--bg-elevated)' }}
          >
            <Link
              href="/"
              className="text-xs font-medium px-3.5 py-1.5 rounded-md transition-all"
              style={{
                background: active === 'tracker' ? 'var(--bg-surface)' : 'transparent',
                color: active === 'tracker' ? 'var(--text-primary)' : 'var(--text-muted)',
                boxShadow: active === 'tracker' ? 'var(--shadow-sm)' : 'none',
              }}
            >
              Tracker
            </Link>
            {isSuperAdmin && (
              <Link
                href="/admin"
                className="text-xs font-medium px-3.5 py-1.5 rounded-md transition-all"
                style={{
                  background: active === 'admin' ? 'var(--bg-surface)' : 'transparent',
                  color: active === 'admin' ? 'var(--text-primary)' : 'var(--text-muted)',
                  boxShadow: active === 'admin' ? 'var(--shadow-sm)' : 'none',
                }}
              >
                Admin
              </Link>
            )}
          </div>

          {/* Scope badge */}
          {scopeDescription && (
            <span
              className="text-xs px-2 py-1 rounded"
              style={{
                background: 'var(--bg-elevated)',
                color: 'var(--text-secondary)',
              }}
            >
              {scopeDescription}
            </span>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-3">
          {active === 'tracker' && (
            <Link href="/loa/new" className="btn-primary text-sm">
              + New LOA
            </Link>
          )}
          <ThemeToggle />
          <button onClick={handleLogout} className="btn-ghost text-sm px-3">
            Logout {user?.full_name ? `· ${user.full_name.split(' ')[0]}` : ''}
          </button>
        </div>

      </div>
    </header>
  )
}
