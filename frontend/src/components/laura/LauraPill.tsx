'use client';

/**
 * LauraPill → Topbar · Editorial Finance redesign.
 * ------------------------------------------------
 * The old center "Dynamic Island" pill is replaced by a horizontal sticky
 * topbar (prototype parity): page title · "Search or ask Laura ⌘K" · Ask
 * Laura button · avatar.
 *
 * Logic preserved: uses the SAME useLaura() context — openChat() opens the
 * exact same chat surface. pillState/pillBadge (thinking/results) are shown
 * as a subtle inline indicator instead of being lost.
 *
 * Kept the filename LauraPill.tsx so layout.tsx imports don't change.
 */

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useLaura } from './LauraProvider';
import { Avatar, initialsOf } from '@/components/ui/atoms';

const PAGE_TITLES: { match: (p: string) => boolean; title: string }[] = [
  { match: (p) => p === '/' || p.startsWith('/?'), title: 'Tracker' },
  { match: (p) => p.startsWith('/past-campaigns'), title: 'Past Campaigns' },
  { match: (p) => p.startsWith('/admin'), title: 'Admin' },
  { match: (p) => p.startsWith('/loa/new'), title: 'New LOA' },
  { match: (p) => p.startsWith('/loa/'), title: 'LOA Detail' },
];

function titleFor(pathname: string | null): string {
  if (!pathname) return 'LAURA';
  const found = PAGE_TITLES.find((t) => t.match(pathname));
  return found ? found.title : 'LAURA';
}

export default function LauraPill() {
  const pathname = usePathname();
  const { isOpen, pillState, pillBadge, openChat } = useLaura();
  const [hoverSearch, setHoverSearch] = useState(false);
  const [hoverAsk, setHoverAsk] = useState(false);
  const [user, setUser] = useState<{ full_name?: string; email?: string } | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('laura_user');
      if (raw) setUser(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  // ⌘K / Ctrl+K opens Laura
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        openChat();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openChat]);

  // Hide on login
  if (pathname?.startsWith('/login')) return null;

  const title = titleFor(pathname);
  const isThinking = pillState === 'thinking';
  const isResults = pillState === 'results';

  return (
    <header
      style={{
        position: 'sticky', top: 0, zIndex: 50,
        height: 56,
        display: 'flex', alignItems: 'center', gap: 16,
        padding: '0 24px',
        background: 'var(--canvas)',
        borderBottom: '1px solid var(--border)',
        fontFamily: 'var(--font-sans)',
        // The topbar spans the content area to the right of the sidebar.
      }}
    >
      {/* Page title */}
      <div style={{
        fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)',
        minWidth: 110, whiteSpace: 'nowrap',
      }}>
        {title}
      </div>

      {/* Search / ask Laura pill */}
      <button
        className="la-cmdk"
        onClick={() => openChat()}
        onMouseEnter={() => setHoverSearch(true)}
        onMouseLeave={() => setHoverSearch(false)}
        style={{
          borderColor: hoverSearch ? 'var(--border-strong)' : 'var(--border)',
        }}
        aria-label="Search or ask Laura"
      >
        <span style={{ opacity: 0.55 }}>⌕</span>
        {isThinking ? (
          <span style={{ color: 'var(--gold)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              width: 6, height: 6, borderRadius: 99, background: 'var(--gold)',
              display: 'inline-block',
              animation: 'laPulseDot 1s ease-in-out infinite',
            }} />
            Searching…
          </span>
        ) : isResults && pillBadge != null ? (
          <span style={{ color: 'var(--text-secondary)' }}>
            {pillBadge} source{pillBadge !== 1 ? 's' : ''} found — open Laura
          </span>
        ) : (
          <span style={{ color: 'var(--text-tertiary)' }}>Search or ask Laura…</span>
        )}
        <span style={{
          marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 11,
          padding: '2px 6px', border: '1px solid var(--border)', borderRadius: 5,
          color: 'var(--text-tertiary)', background: 'var(--surface)',
        }}>⌘K</span>
      </button>

      {/* Right cluster: Ask Laura + avatar */}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={() => openChat()}
          onMouseEnter={() => setHoverAsk(true)}
          onMouseLeave={() => setHoverAsk(false)}
          style={{
            display: 'inline-flex', alignItems: 'center',
            height: 34, padding: '0 14px', borderRadius: 8,
            background: isOpen ? 'var(--surface-sunken)' : 'transparent',
            border: `1px solid ${hoverAsk ? 'var(--border-strong)' : 'var(--border)'}`,
            color: 'var(--text-primary)', cursor: 'pointer',
            fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-sans)',
            transition: 'all .15s ease', whiteSpace: 'nowrap',
          }}
        >
          <span style={{ color: 'var(--gold)', marginRight: 7 }}>✦</span>
          Ask Laura
        </button>

        <Avatar initials={initialsOf(user?.full_name || user?.email)} size={30} />
      </div>

      <style>{`@keyframes laPulseDot {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.4; transform: scale(0.7); }
      }`}</style>
    </header>
  );
}
