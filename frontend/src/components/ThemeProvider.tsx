'use client';

/**
 * ThemeProvider — LEGACY compatibility wrapper.
 * -----------------------------------------------------------------
 * The real theme logic now lives in `@/lib/theme` (useTheme hook).
 * This file used to be a parallel implementation with its own
 * storage key ('laura_theme') and its own state, which caused
 * two competing sources of truth and the "dark mode doesn't apply
 * everywhere" bug.
 *
 * This wrapper re-exports `useTheme` and provides a thin
 * `ThemeProvider` component + `ThemeToggle` button so existing
 * imports (`from '@/components/ThemeProvider'`) keep working
 * without behavioral drift. All state now flows through one place.
 */

import { useState } from 'react';
import { useTheme as useThemeHook } from '@/lib/theme';

/** No-op provider — kept so old `<ThemeProvider>` wraps still compile. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

/** Compat re-export of the real hook. */
export const useTheme = useThemeHook;

/** Compat `ThemeToggle` button — thin adapter over the unified hook. */
export function ThemeToggle() {
  const { theme, toggle } = useThemeHook();
  const [hover, setHover] = useState(false);
  const isDark = theme === 'dark';
  return (
    <button
      onClick={toggle}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      style={{
        width: 32, height: 32, borderRadius: 8,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: hover ? 'var(--surface-sunken)' : 'transparent',
        border: '1px solid var(--border)',
        color: 'var(--text-secondary)',
        cursor: 'pointer', transition: 'all .15s ease',
      }}
    >
      {isDark ? (
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
          <path
            d="M7.5 1.5V0M7.5 15v-1.5M1.5 7.5H0M15 7.5h-1.5M3.05 3.05L2 2M13 13l-1.05-1.05M11.953.05L13 2M2 13l1.05-1.05M10.5 7.5a3 3 0 11-6 0 3 3 0 016 0z"
            stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"
          />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path
            d="M13 7.5A6.5 6.5 0 016 1a6.5 6.5 0 100 13 6.5 6.5 0 007-6.5z"
            stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}
