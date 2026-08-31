'use client'
/**
 * ThemeControl — the one dark/light control, rendered wherever a page needs it.
 *
 * There is exactly one theme preference per user and one place it lives
 * (`useTheme` in lib/theme.ts, key `laura.theme`). This component is only a
 * shape around that hook, so a page can drop the control into a navbar, a menu,
 * or a bare auth screen without any of them owning theme state.
 *
 * Available to every role: theme is a display preference, never a permission,
 * so this renders no role check of any kind.
 *
 * On the pre-auth screens (`/login`) the choice is written to the same
 * localStorage key, so it is already in effect when the session starts — the
 * preference carries into the app without a server round trip.
 */
import { useTheme } from '@/lib/theme'

export type ThemeControlVariant = 'icon' | 'menu-item' | 'inline'

export default function ThemeControl({
  variant = 'icon',
  className,
}: {
  variant?: ThemeControlVariant
  className?: string
}) {
  const { theme, toggle } = useTheme()
  const isDark = theme === 'dark'

  // The label states the ACTION, not the current state — a screen reader user
  // needs to know what activating it will do.
  const label = isDark ? 'Switch to light theme' : 'Switch to dark theme'
  const glyph = isDark ? '☀' : '☾'

  if (variant === 'menu-item') {
    return (
      <button
        type="button"
        role="menuitem"
        onClick={toggle}
        aria-label={label}
        className={className ? 'la-menu-item ' + className : 'la-menu-item'}
      >
        <span className="la-menu-icon" aria-hidden="true">{glyph}</span>
        <span className="la-menu-label">{isDark ? 'Light theme' : 'Dark theme'}</span>
      </button>
    )
  }

  if (variant === 'inline') {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-label={label}
        aria-pressed={isDark}
        className={className ? 'la-theme-inline ' + className : 'la-theme-inline'}
      >
        <span aria-hidden="true">{glyph}</span>
        <span>{isDark ? 'Light' : 'Dark'}</span>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      aria-pressed={isDark}
      title={label}
      className={className ? 'la-theme-icon ' + className : 'la-theme-icon'}
    >
      <span aria-hidden="true">{glyph}</span>
    </button>
  )
}
