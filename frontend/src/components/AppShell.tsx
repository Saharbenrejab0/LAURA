'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { useMyRole } from '@/hooks/usePermissions'
import LauraPill from '@/components/laura/LauraPill'
import { layout } from '@/styles/tokens'
import { useTheme } from '@/lib/theme'

const SIDEBAR_PINNED_KEY = 'laura.sidebar.pinned'
const SIDEBAR_PIN_EVENT = 'laura:sidebar-pin-change'

/**
 * Routes that should NOT show the sidebar / app chrome.
 * Currently: /login (authentication page is full-screen).
 */
const BARE_ROUTES = ['/login', '/welcome']

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { role } = useMyRole()
  const { theme } = useTheme()
  const [pinned, setPinned] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(SIDEBAR_PINNED_KEY)
    if (stored === 'true') setPinned(true)
    setMounted(true)

    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      setPinned(detail.pinned)
    }
    window.addEventListener(SIDEBAR_PIN_EVENT, handler)
    return () => window.removeEventListener(SIDEBAR_PIN_EVENT, handler)
  }, [])

  // Sync the redesign palette (styles/redesign.css) with the app theme.
  useEffect(() => {
    if (typeof document === 'undefined') return
    document.documentElement.setAttribute('data-theme', theme === 'dark' ? 'dark' : 'light')
  }, [theme])

  const isBare = BARE_ROUTES.some(r => pathname?.startsWith(r))
  if (isBare) {
    return <>{children}</>
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--canvas)' }}>
      <Sidebar isAdmin={!!role?.can_override_lock} />
      <main style={{
        flex: 1,
        minWidth: 0,
        marginLeft: pinned ? layout.sidebarExpanded : layout.sidebarCollapsed,
        transition: mounted ? 'margin-left 180ms cubic-bezier(0.2,0,0,1)' : 'none',
        background: 'var(--canvas)',
        color: 'var(--text-primary)',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Horizontal topbar (replaces the old floating Ask Laura island). */}
        <LauraPill />
        <div style={{ flex: 1, minWidth: 0 }}>
          {children}
        </div>
      </main>
    </div>
  )
}
