'use client';

/**
 * LauraPill — Dynamic Island-style pill at top center.
 *
 * Three visual states (driven by context):
 *   - 'idle'     : "◆ Ask Laura"
 *   - 'thinking' : "● Searching…" with champagne pulse
 *   - 'results'  : "◆ LOAs found [N]" with champagne badge
 *
 * Dark-mode rule applied here:
 *   - background uses var(--laura-action) which inverts (black ↔ white)
 *   - therefore text MUST use var(--laura-text-on-primary) which also inverts
 *   - the champagne accent stays constant in both modes (signature color)
 */

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useLaura } from './LauraProvider';

export default function LauraPill() {
  const pathname = usePathname();
  const { isOpen, pillState, pillBadge, openChat } = useLaura();
  const [hover, setHover] = useState(false);

  // Don't show on login page
  if (pathname?.startsWith('/login')) return null;

  const hidden = isOpen;

  return (
    <div
      style={{
        position: 'fixed',
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 100,
        opacity: hidden ? 0 : 1,
        pointerEvents: hidden ? 'none' : 'auto',
        transition: 'opacity 200ms cubic-bezier(0.2, 0, 0, 1)',
      }}
    >
      <button
        onClick={() => openChat()}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        aria-label="Open Laura"
        style={{
          background: 'var(--laura-action, #0A0A0A)',
          color: 'var(--laura-text-on-primary, #FFFFFF)', // ← inverts with theme
          borderRadius: 999,
          padding: '0 18px',
          height: 40,
          minWidth: 180,
          border: 'none',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          cursor: 'pointer',
          boxShadow: hover
            ? '0 6px 28px rgba(10, 10, 10, 0.22), 0 2px 4px rgba(10, 10, 10, 0.10)'
            : '0 4px 24px rgba(10, 10, 10, 0.16), 0 1px 3px rgba(10, 10, 10, 0.08)',
          transform: hover ? 'scale(1.02)' : 'scale(1)',
          transition: 'transform 240ms cubic-bezier(0.2, 0, 0, 1), box-shadow 240ms cubic-bezier(0.2, 0, 0, 1)',
          fontFamily: 'inherit',
          fontSize: 13,
          fontWeight: 500,
          letterSpacing: '0.01em',
          userSelect: 'none',
        }}
      >
        {pillState === 'idle' && (
          <>
            <span style={{ color: 'var(--laura-champagne, #C9A678)', fontSize: 14, lineHeight: 1 }}>◆</span>
            <span>Ask Laura</span>
          </>
        )}

        {pillState === 'thinking' && (
          <>
            <PulseDot />
            <span>Searching…</span>
          </>
        )}

        {pillState === 'results' && (
          <>
            <span style={{ color: 'var(--laura-champagne, #C9A678)', fontSize: 14, lineHeight: 1 }}>◆</span>
            <span>{(pillBadge ?? 0) > 1 ? 'LOAs found' : 'LOA found'}</span>
            {pillBadge !== null && pillBadge > 0 && (
              <span
                style={{
                  background: 'var(--laura-champagne, #C9A678)',
                  // Champagne bg is constant across modes — dark ink is always
                  // the most readable choice on it, so we keep this hardcoded.
                  color: '#0A0A0A',
                  fontWeight: 700,
                  padding: '2px 7px',
                  borderRadius: 999,
                  fontSize: 11,
                  fontFamily: 'IBM Plex Mono, ui-monospace, monospace',
                }}
              >
                {pillBadge}
              </span>
            )}
          </>
        )}
      </button>

      <style>{`
        @keyframes laura-pulse {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50%      { opacity: 1.0; transform: scale(1.3); }
        }
      `}</style>
    </div>
  );
}

function PulseDot() {
  return (
    <span
      style={{
        width: 6,
        height: 6,
        borderRadius: 999,
        background: 'var(--laura-champagne, #C9A678)',
        animation: 'laura-pulse 1.4s infinite cubic-bezier(0.2, 0, 0, 1)',
      }}
    />
  );
}
