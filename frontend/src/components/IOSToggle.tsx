'use client';

/**
 * IOSToggle — iPhone-style light/dark switch.
 *
 * Wired to the unified `useTheme` hook (@/lib/theme), which drives
 * BOTH the legacy `.dark` class and the new `data-theme` attribute.
 * Styled with the current design tokens (var(--*)), so it looks
 * right in either theme without ancient --laura-* variables.
 */

import { useState } from 'react';
import { useTheme } from '@/lib/theme';

export default function IOSToggle() {
  const { theme, toggle } = useTheme();
  const [hover, setHover] = useState(false);
  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggle}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Light mode' : 'Dark mode'}
      style={{
        position: 'relative',
        width: 44, height: 24,
        borderRadius: 999,
        background: isDark ? 'var(--ink)' : 'var(--surface-sunken)',
        border: `1px solid ${isDark ? 'var(--ink)' : 'var(--border-strong)'}`,
        padding: 0,
        cursor: 'pointer',
        transition: 'background-color 220ms cubic-bezier(0.2,0,0,1), border-color 220ms cubic-bezier(0.2,0,0,1)',
        flexShrink: 0,
      }}
    >
      {/* Moon (dark side) */}
      <span style={{
        position: 'absolute',
        left: 6, top: '50%', transform: 'translateY(-50%)',
        fontSize: 9, opacity: isDark ? 0.55 : 0,
        color: 'var(--ink-text)', lineHeight: 1, pointerEvents: 'none',
        transition: 'opacity 220ms cubic-bezier(0.2,0,0,1)',
      }}>☾</span>
      {/* Sun (light side) */}
      <span style={{
        position: 'absolute',
        right: 6, top: '50%', transform: 'translateY(-50%)',
        fontSize: 9, opacity: isDark ? 0 : 0.6,
        color: 'var(--text-secondary)', lineHeight: 1, pointerEvents: 'none',
        transition: 'opacity 220ms cubic-bezier(0.2,0,0,1)',
      }}>☀</span>

      {/* Sliding knob */}
      <span style={{
        position: 'absolute',
        top: 1,
        left: isDark ? 22 : 1,
        width: 20, height: 20,
        borderRadius: 999,
        background: '#FFFFFF',
        boxShadow: hover
          ? '0 2px 6px rgba(10,10,10,.24), 0 0 0 1px rgba(10,10,10,.06)'
          : '0 1px 3px rgba(10,10,10,.18), 0 0 0 1px rgba(10,10,10,.06)',
        transition: 'left 220ms cubic-bezier(0.2,0,0,1), box-shadow 140ms cubic-bezier(0.2,0,0,1), transform 140ms cubic-bezier(0.2,0,0,1)',
        transform: hover ? 'translateY(-0.5px)' : 'translateY(0)',
      }} />
    </button>
  );
}
