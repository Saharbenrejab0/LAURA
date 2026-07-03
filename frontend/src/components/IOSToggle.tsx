'use client';

/**
 * IOSToggle — iPhone-style light/dark mode switch.
 *
 * 44x24 capsule, sliding knob with sun/moon icon.
 * Click → toggles theme via useTheme hook.
 *
 * Usage: <IOSToggle /> (drop it anywhere)
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
      style={{
        position: 'relative',
        width: 44,
        height: 24,
        borderRadius: 999,
        background: isDark ? 'var(--laura-action)' : 'var(--laura-border-strong)',
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: isDark ? 'var(--laura-action)' : 'var(--laura-border-strong)',
        padding: 0,
        cursor: 'pointer',
        transition: 'background-color 220ms cubic-bezier(0.2, 0, 0, 1), border-color 220ms cubic-bezier(0.2, 0, 0, 1)',
        flexShrink: 0,
      }}
    >
      {/* Track icons */}
      <span style={{
        position: 'absolute',
        left: 6, top: '50%', transform: 'translateY(-50%)',
        fontSize: 9, opacity: isDark ? 0.4 : 0,
        color: '#FFFFFF', lineHeight: 1,
        pointerEvents: 'none',
        transition: 'opacity 220ms cubic-bezier(0.2, 0, 0, 1)',
      }}>☾</span>
      <span style={{
        position: 'absolute',
        right: 6, top: '50%', transform: 'translateY(-50%)',
        fontSize: 9, opacity: isDark ? 0 : 0.5,
        color: '#5A554F', lineHeight: 1,
        pointerEvents: 'none',
        transition: 'opacity 220ms cubic-bezier(0.2, 0, 0, 1)',
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
          ? '0 2px 6px rgba(10, 10, 10, 0.20), 0 0 0 1px rgba(10, 10, 10, 0.04)'
          : '0 1px 3px rgba(10, 10, 10, 0.16), 0 0 0 1px rgba(10, 10, 10, 0.04)',
        transition: 'left 220ms cubic-bezier(0.2, 0, 0, 1), box-shadow 140ms cubic-bezier(0.2, 0, 0, 1), transform 140ms cubic-bezier(0.2, 0, 0, 1)',
        transform: hover ? 'translateY(-0.5px)' : 'translateY(0)',
      }} />
    </button>
  );
}
