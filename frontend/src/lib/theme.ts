'use client';

/**
 * useTheme — LAURA unified theme hook.
 *
 * Single source of truth for light/dark mode. Drives BOTH:
 *   - `.dark` class on <html>  → switches legacy `theme.css` (--laura-*)
 *   - `data-theme` attr on <html> → switches new `redesign.css` (--canvas, --gold, --st-*)
 *
 * Storage key: 'laura.theme' (canonical). The old 'laura_theme' key is
 * read-only migrated on first load so users don't lose their preference.
 *
 * Emits a global `laura:theme-change` event so components that don't
 * consume the hook (e.g. IOSToggle in a portal) can react.
 */

import { useEffect, useState, useCallback } from 'react';

const STORAGE_KEY = 'laura.theme';
const LEGACY_STORAGE_KEY = 'laura_theme';
const CHANGE_EVENT = 'laura:theme-change';

type Theme = 'light' | 'dark';

function readStored(): Theme {
  if (typeof window === 'undefined') return 'light';
  try {
    let v = localStorage.getItem(STORAGE_KEY);
    if (!v) {
      // one-time migration from the old key
      const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacy === 'dark' || legacy === 'light') {
        v = legacy;
        localStorage.setItem(STORAGE_KEY, legacy);
        localStorage.removeItem(LEGACY_STORAGE_KEY);
      }
    }
    return v === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  // Drive legacy theme.css (--laura-*) via .dark class
  if (theme === 'dark') root.classList.add('dark');
  else root.classList.remove('dark');

  // Drive redesign.css (--canvas, --gold, --st-*) via data-theme attribute
  root.setAttribute('data-theme', theme);

  // Notify listeners that don't share React state (e.g. isolated toggles)
  try {
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { theme } }));
  } catch { /* ignore */ }
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>('light');

  // Initial sync on mount
  useEffect(() => {
    const initial = readStored();
    setThemeState(initial);
    applyTheme(initial);

    // Keep in sync if another component toggles the theme
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.theme && detail.theme !== theme) {
        setThemeState(detail.theme);
      }
    };
    window.addEventListener(CHANGE_EVENT, onChange);
    return () => window.removeEventListener(CHANGE_EVENT, onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch {}
    applyTheme(next);
  }, []);

  const toggle = useCallback(() => {
    setThemeState((current) => {
      const next: Theme = current === 'light' ? 'dark' : 'light';
      try { localStorage.setItem(STORAGE_KEY, next); } catch {}
      applyTheme(next);
      return next;
    });
  }, []);

  return { theme, setTheme, toggle };
}
