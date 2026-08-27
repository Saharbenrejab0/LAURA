'use client'

import { usePathname } from 'next/navigation'
import TopNav from '@/components/TopNav'
import RouteGuard from '@/components/RouteGuard'

/**
 * AppShell — wraps every route in the one navigation surface.
 *
 * The 68px left rail (DesignShell) is gone. TopNav is now the single nav
 * surface on every page, so there is no second nav system to drift out of sync
 * and no page-specific chrome to re-theme.
 *
 * Only two kinds of route render bare:
 *   /login    — pre-auth. Draws its own full-bleed SSO screen and carries its
 *               own ThemeControl, so the choice made before signing in is
 *               already in effect once the session starts.
 *   /design/* — the static design-build showcase. Not part of the app.
 *
 * `/welcome`, `/cmo-review` and `/cfo-review` used to be bare too, which is one
 * reason the theme and the navigation "stopped working" on them. They are
 * inside the shell now.
 *
 * No theme effect here: lib/theme.ts owns applying `.dark` / `data-theme` to
 * <html>, and a blocking script in app/layout.tsx sets it before first paint.
 * AppShell writing it again on mount was a second source of truth.
 */
const BARE_ROUTES = ['/login', '/design']

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/'

  const isBare = BARE_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/'))
  if (isBare) return <>{children}</>

  return (
    <div className="la-app">
      <TopNav />
      <main className="la-app-main">
        <RouteGuard>{children}</RouteGuard>
      </main>
    </div>
  )
}
