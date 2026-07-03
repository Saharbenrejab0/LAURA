'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { layout } from '@/styles/tokens'

const SIDEBAR_PINNED_KEY = 'laura.sidebar.pinned'
const SIDEBAR_PIN_EVENT = 'laura:sidebar-pin-change'

/**
 * Routes that should NOT show the sidebar / app chrome.
 * Currently: /login (authentication page is full-screen).
 */
const BARE_ROUTES = ['/login']

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
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

  // Bare routes (login): render children full-bleed, no sidebar
  const isBare = BARE_ROUTES.some(r => pathname?.startsWith(r))
  if (isBare) {
    return <>{children}</>
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar isAdmin={true} />
      <main style={{
        flex: 1,
        minWidth: 0,
        marginLeft: pinned ? layout.sidebarExpanded : layout.sidebarCollapsed,
        transition: mounted ? 'margin-left 180ms cubic-bezier(0.2,0,0,1)' : 'none',
      }}>
        {children}
      </main>
    </div>
  )
}
