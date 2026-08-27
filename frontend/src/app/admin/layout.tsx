/**
 * Admin route segment layout.
 *
 * Deliberately thin. The client-side access gate used to live here, duplicating
 * the check `RouteGuard` now performs from `canSeeAdmin()` — two copies of one
 * rule, which is how a menu and a route end up disagreeing. There is one client
 * gate (RouteGuard, reading lib/roles.ts) and the backend enforces admin-only on
 * every /admin endpoint independently.
 *
 * It also carried `data-admin-scope`, which activated a parallel `--admin-*`
 * token set in admin-tokens.css. The console reads the same semantic tokens as
 * the rest of the app, so that second palette is gone.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
