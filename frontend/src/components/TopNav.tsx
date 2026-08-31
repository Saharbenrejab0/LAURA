'use client'
/**
 * TopNav — the single navigation surface, on every page.
 *
 * Replaces the 68px left rail (DesignShell). Navigation lives in the logo-mark
 * (⊙⊙) menu, which is the control already built on the Night Lens folder page;
 * this is that menu promoted to a shared component so every page gets the same
 * one instead of a second nav system drifting away from the first.
 *
 * Everything the rail offered is still reachable — Tracker, Review, Past
 * campaigns, Historical, Admin, New LOA, Ask Laura, theme, sign out — and every
 * entry is filtered through `destinationsFor()`, the same predicates the route
 * guards use, so the menu can never offer a page the route will refuse.
 *
 * Themed entirely with CSS custom properties. The rail was painted from a fixed
 * light palette (`C` in app/design/_data.ts), which is why dark mode used to
 * stop at the edge of the content area.
 */
import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useMyRole } from '@/hooks/usePermissions'
import { logout, getStoredUser } from '@/lib/api'
import { interfaceFor } from '@/lib/roles'
import { destinationsFor, crumbsFor, ROUTES } from '@/lib/routes'
import { useLaura } from '@/components/laura/LauraProvider'
import ThemeControl from '@/components/ThemeControl'

export interface TopNavProps {
  /** Extra context after the breadcrumb, e.g. the cycle name. */
  context?: string | null
  /** Search / filter slot — pages that have one pass it here. */
  children?: React.ReactNode
}

export default function TopNav({ context, children }: TopNavProps) {
  const pathname = usePathname() || '/'
  const router = useRouter()
  const { role } = useMyRole()
  const laura = useLaura()
  const openChat = (laura as any)?.openChat as (() => void) | undefined

  const [navOpen, setNavOpen] = useState(false)
  const [userOpen, setUserOpen] = useState(false)
  const navBtnRef = useRef<HTMLButtonElement | null>(null)

  // Read after mount: getStoredUser() during render disagrees with the server
  // HTML (the server has no user) and trips a hydration error.
  const [name, setName] = useState('You')
  const [initials, setInitials] = useState('U')
  useEffect(() => {
    const u = getStoredUser() as any
    const n = u?.full_name || u?.name || u?.email?.split('@')[0] || 'You'
    setName(n)
    const base = String(n).split('(')[0]
    setInitials(
      base.split(/[ .@]/).filter(Boolean).slice(0, 2)
        .map((s: string) => s[0]?.toUpperCase()).join('') || 'U',
    )
  }, [])

  // Escape closes whichever menu is open — keyboard users must not get trapped.
  useEffect(() => {
    if (!navOpen && !userOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setNavOpen(false)
      setUserOpen(false)
      navBtnRef.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navOpen, userOpen])

  // A route change must not leave a menu hanging open over the new page.
  useEffect(() => { setNavOpen(false); setUserOpen(false) }, [pathname])

  const iface = interfaceFor(role?.role_code, role?.can_override_lock === true)
  const destinations = destinationsFor(iface)
  const crumbs = crumbsFor(pathname)

  const go = (href: string) => { setNavOpen(false); router.push(href) }
  const doLogout = () => {
    setUserOpen(false)
    try { logout() } catch {}
    if (typeof window !== 'undefined') window.location.href = ROUTES.login
  }

  const isHere = (href: string) =>
    href === ROUTES.cycles ? pathname.startsWith('/cycles') : pathname.startsWith(href)

  return (
    <header className="la-topnav">
      {/* Left: logo-mark menu + breadcrumb */}
      <div className="la-topnav-left">
        <div className="la-menu-anchor">
          <button
            ref={navBtnRef}
            onClick={() => setNavOpen(v => !v)}
            aria-label={navOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={navOpen}
            aria-haspopup="menu"
            className={navOpen ? 'la-logomark is-open' : 'la-logomark'}
          >
            <span className="la-logomark-a" />
            <span className="la-logomark-b" />
          </button>

          {navOpen && (
            <>
              <div className="la-menu-backdrop" onClick={() => setNavOpen(false)} />
              {/* Scrollable: the list must not run off a short viewport. */}
              <div className="la-menu" role="menu" aria-label="Navigation">
                <div className="la-menu-scroll">
                  {destinations.map(d => (
                    <button
                      key={d.key}
                      role="menuitem"
                      onClick={() => go(d.href)}
                      className={isHere(d.href) ? 'la-menu-item is-current' : 'la-menu-item'}
                      aria-current={isHere(d.href) ? 'page' : undefined}
                    >
                      <span className="la-menu-icon" aria-hidden="true">{d.icon}</span>
                      <span className="la-menu-label">{d.label}</span>
                    </button>
                  ))}

                  <div className="la-menu-sep" />

                  <button
                    role="menuitem"
                    className="la-menu-item"
                    onClick={() => { setNavOpen(false); openChat?.() }}
                  >
                    <span className="la-menu-icon la-menu-icon-gold" aria-hidden="true">✦</span>
                    <span className="la-menu-label">Ask LAURA</span>
                  </button>

                  {/* Theme stays open after activation so the change is visible. */}
                  <ThemeControl variant="menu-item" />

                  <button role="menuitem" className="la-menu-item la-menu-item-danger" onClick={doLogout}>
                    <span className="la-menu-icon" aria-hidden="true">↪</span>
                    <span className="la-menu-label">Sign out</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="la-wordmark">
          <span className="la-wordmark-name">LAURA</span>
          <span className="la-wordmark-tag">the LOA review room</span>
        </div>

        <span className="la-topnav-rule" aria-hidden="true" />

        <nav className="la-crumbs" aria-label="Breadcrumb">
          {crumbs.map((c, i) => (
            <span key={c + '-' + i} className="la-crumb-wrap">
              {i > 0 && <span className="la-crumb-sep" aria-hidden="true">/</span>}
              <span className={i === crumbs.length - 1 ? 'la-crumb is-last' : 'la-crumb'}>{c}</span>
            </span>
          ))}
          {context && (
            <span className="la-crumb-wrap">
              <span className="la-crumb-sep" aria-hidden="true">/</span>
              <span className="la-crumb is-last">{context}</span>
            </span>
          )}
        </nav>
      </div>

      {/* Right: page slot, theme, user chip */}
      <div className="la-topnav-right">
        {children}

        <ThemeControl variant="icon" />

        <div className="la-menu-anchor">
          <button
            onClick={() => setUserOpen(v => !v)}
            className="la-userchip"
            aria-label={'Account: ' + name}
            aria-expanded={userOpen}
            aria-haspopup="menu"
          >{initials}</button>
          {userOpen && (
            <>
              <div className="la-menu-backdrop" onClick={() => setUserOpen(false)} />
              <div className="la-menu la-menu-right" role="menu" aria-label="Account">
                <div className="la-user-name">{name}</div>
                <div className="la-user-meta">{role?.role_display_name || role?.role_code || '—'}</div>
                <div className="la-menu-sep" />
                <ThemeControl variant="menu-item" />
                <button role="menuitem" className="la-menu-item la-menu-item-danger" onClick={doLogout}>
                  <span className="la-menu-icon" aria-hidden="true">↪</span>
                  <span className="la-menu-label">Sign out</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
