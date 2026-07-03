'use client';

/**
 * useTheme — manages light/dark mode globally.
 *
 * Reads from localStorage 'laura.theme'.
 * Toggles `.dark` class on <html>.
 * CSS variables in styles/theme.css handle the actual color switching.
 */

import { useEffect, useState, useCallback } from 'react';

const STORAGE_KEY = 'laura.theme';
type Theme = 'light' | 'dark';

function readStored(): Theme {
  if (typeof window === 'undefined') return 'light';
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme === 'dark') root.classList.add('dark');
  else root.classList.remove('dark');
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>('light');

  // Initial sync on mount
  useEffect(() => {
    const initial = readStored();
    setThemeState(initial);
    applyTheme(initial);
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
