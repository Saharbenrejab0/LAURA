/**
 * Admin route segment layout.
 *
 * - Loads IBM Plex Mono (self-hosted via @fontsource, weights 400/500/600).
 * - Loads scoped admin design tokens.
 * - Wraps children in [data-admin-scope] so all --admin-* vars + .type-*
 *   classes only apply within /admin and never leak to the rest of the app.
 */

import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import '@fontsource/ibm-plex-mono/600.css'

import './admin-tokens.css'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div data-admin-scope>{children}</div>
}
