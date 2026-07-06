/**
 * Admin route segment layout — Editorial Finance redesign (Phase 4).
 *
 * The previous version loaded a scoped token system (admin-tokens.css,
 * IBM Plex Mono via @fontsource) that competed with the unified design
 * system. All admin styling now flows from styles/redesign.css
 * (--canvas, --gold, --st-*, JetBrains Mono), which follows the global
 * light/dark theme automatically.
 *
 * [data-admin-scope] is kept so any residual scoped selectors stay inert
 * rather than breaking.
 */

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div data-admin-scope>{children}</div>
}
