'use client';

/**
 * Sidebar — Editorial Finance redesign (Phase 1b)
 * ------------------------------------------------
 * VISUAL layer only was changed. All behavior is preserved from the
 * previous version:
 *   - pin / peek (hover) with Ctrl+B shortcut and localStorage persistence
 *   - CreationChooser modal (New LOA entry point)
 *   - profile dropdown: role scope line, theme toggle, logout
 *   - nav: Tracker / Past Campaigns / Admin (admin-gated)
 *
 * New visuals come from styles/redesign.css variables:
 *   --canvas, --surface, --border, --gold, --ink, --font-display, …
 */

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import CreationChooser from '@/components/CreationChooser';
import { layout } from '@/styles/tokens';
import { useTheme } from '@/lib/theme';
import { useMyRole } from '@/hooks/usePermissions';
import { Avatar, initialsOf } from '@/components/ui/atoms';

const SIDEBAR_PINNED_KEY = 'laura.sidebar.pinned';
const SIDEBAR_PIN_EVENT  = 'laura:sidebar-pin-change';

interface SidebarProps {
  isAdmin?: boolean;
  clusterLabel?: string | null;
}

interface StoredUser {
  email?: string;
  full_name?: string;
}

type NavKey = 'tracker' | 'past-campaigns' | 'admin';

export default function Sidebar({ isAdmin = false }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { role } = useMyRole();

  const [pinned, setPinned]           = useState(false);
  const [peeking, setPeeking]         = useState(false);
  const [chooserOpen, setChooserOpen] = useState(false);
  const [chooserStep, setChooserStep] = useState<'chooser' | 'ask-laura'>('chooser');
  const [user, setUser]               = useState<StoredUser | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  // Initial: read pin pref + user
  useEffect(() => {
    const storedPin = localStorage.getItem(SIDEBAR_PINNED_KEY);
    if (storedPin === 'true') setPinned(true);
    try {
      const raw = localStorage.getItem('laura_user');
      if (raw) setUser(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  const togglePin = (next?: boolean) => {
    const v = typeof next === 'boolean' ? next : !pinned;
    setPinned(v);
    localStorage.setItem(SIDEBAR_PINNED_KEY, v ? 'true' : 'false');
    window.dispatchEvent(new CustomEvent(SIDEBAR_PIN_EVENT, { detail: { pinned: v } }));
    if (!v) setPeeking(false);
  };

  // Cmd+B / Ctrl+B
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        togglePin();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pinned]);

  // Click outside closes profile dropdown
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    if (profileOpen) document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [profileOpen]);

  // Sidebar stays expanded if dropdown is open
  const expanded = pinned || peeking || profileOpen;
  const isOverlay = !pinned && (peeking || profileOpen);
  const width = expanded ? layout.sidebarExpanded : layout.sidebarCollapsed;

  const onMouseEnter = () => {
    if (leaveTimer.current) { clearTimeout(leaveTimer.current); leaveTimer.current = null; }
    if (!pinned) setPeeking(true);
  };
  const onMouseLeave = () => {
    if (pinned || profileOpen) return;
    leaveTimer.current = setTimeout(() => setPeeking(false), 120);
  };

  const openChooser = (step: 'chooser' | 'ask-laura') => {
    setChooserStep(step);
    setChooserOpen(true);
  };

  const active: NavKey =
    pathname?.startsWith('/past-campaigns') ? 'past-campaigns'
    : pathname?.startsWith('/admin') ? 'admin'
    : 'tracker';

  return (
    <>
      <aside
        className="la-sidebar"
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        style={{
          position: 'fixed',
          top: 0, left: 0, bottom: 0,
          width,
          background: 'var(--canvas)',
          borderRight: '1px solid var(--border)',
          padding: '18px 12px 14px',
          display: 'flex', flexDirection: 'column',
          fontFamily: 'var(--font-sans)',
          transition: 'width 180ms cubic-bezier(0.2,0,0,1), box-shadow 180ms cubic-bezier(0.2,0,0,1)',
          zIndex: isOverlay ? 200 : 100,
          boxShadow: isOverlay ? 'var(--shadow-lg)' : 'none',
          overflow: 'visible',
        }}
      >
        {/* Brand header */}
        <header style={{
          padding: '0 8px 16px',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8,
        }}>
          <div style={{ overflow: 'hidden', flex: 1 }}>
            <p style={{
              margin: 0,
              fontFamily: 'var(--font-display)',
              fontSize: expanded ? 26 : 22,
              fontWeight: 600,
              lineHeight: 1,
              letterSpacing: '.01em',
              color: 'var(--text-primary)',
              whiteSpace: 'nowrap',
            }}>
              {expanded ? 'LAURA' : 'L'}<span style={{ color: 'var(--gold)' }}>.</span>
            </p>
            {expanded && (
              <p style={{
                margin: '4px 0 0', fontSize: 11.5, lineHeight: '15px',
                color: 'var(--text-tertiary)', letterSpacing: '.04em',
                whiteSpace: 'nowrap',
              }}>Marketing Finance</p>
            )}
          </div>
          {expanded && (
            <button
              onClick={() => togglePin()}
              title={pinned ? 'Unpin (Ctrl+B)' : 'Pin sidebar (Ctrl+B)'}
              style={{
                background: 'transparent',
                border: `1px solid ${pinned ? 'var(--gold)' : 'transparent'}`,
                borderRadius: 6, cursor: 'pointer',
                color: pinned ? 'var(--gold)' : 'var(--text-tertiary)',
                fontSize: 13, padding: '2px 8px', lineHeight: 1,
                fontFamily: 'var(--font-sans)',
                transition: 'all .15s ease',
              }}
            >{pinned ? '◉' : '◯'}</button>
          )}
        </header>

        {/* + New LOA */}
        <button
          onClick={() => openChooser('chooser')}
          title={!expanded ? 'New LOA' : undefined}
          style={{
            height: 38, borderRadius: 9,
            background: 'var(--ink)', color: 'var(--ink-text)',
            border: 'none', fontFamily: 'var(--font-sans)',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            marginBottom: 20, width: '100%',
            transition: 'opacity .15s ease',
            whiteSpace: 'nowrap', overflow: 'hidden',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.86'; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
        >
          <span style={{ fontSize: 15, lineHeight: 0 }}>+</span>
          {expanded && <span>New LOA</span>}
        </button>

        {/* Nav */}
        <SectionLabel expanded={expanded}>Work</SectionLabel>
        <NavItem expanded={expanded} icon="▤" label="Tracker"
          active={active === 'tracker'} onClick={() => router.push('/')} />
        <NavItem expanded={expanded} icon="◷" label="Past Campaigns"
          active={active === 'past-campaigns'} onClick={() => router.push('/past-campaigns')} />

        {isAdmin && (
          <>
            <SectionLabel expanded={expanded}>System</SectionLabel>
            <NavItem expanded={expanded} icon="⚙" label="Admin"
              active={active === 'admin'} onClick={() => router.push('/admin')} />
          </>
        )}

        <div style={{ flex: 1 }} />

        {/* Bottom: avatar + dropdown */}
        <div ref={profileRef} style={{ position: 'relative', marginTop: 8 }}>
          {/* Avatar trigger */}
          <button
            onClick={() => setProfileOpen(v => !v)}
            title={!expanded ? `${getFirstName(user)} — profile` : undefined}
            style={{
              width: '100%',
              padding: expanded ? '8px 8px' : 0,
              height: expanded ? 'auto' : 44,
              borderRadius: 10,
              background: profileOpen ? 'var(--surface-raised)' : 'transparent',
              border: '1px solid transparent',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center',
              justifyContent: expanded ? 'flex-start' : 'center',
              gap: 10,
              transition: 'background-color .15s ease',
              fontFamily: 'var(--font-sans)',
            }}
            onMouseEnter={(e) => {
              if (!profileOpen) e.currentTarget.style.background = 'var(--surface-raised)';
            }}
            onMouseLeave={(e) => {
              if (!profileOpen) e.currentTarget.style.background = 'transparent';
            }}
          >
            <Avatar initials={initialsOf(user?.full_name || user?.email)} size={30} />

            {expanded && (
              <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                <p style={{
                  margin: 0, fontSize: 13, fontWeight: 600,
                  color: 'var(--text-primary)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{getFirstName(user)}</p>
                {role?.role_display_name && (
                  <p style={{
                    margin: '1px 0 0', fontSize: 11,
                    color: 'var(--text-tertiary)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{role.role_display_name}</p>
                )}
              </div>
            )}
          </button>

          {profileOpen && (
            <div style={{
              position: 'absolute',
              bottom: 'calc(100% + 8px)', left: 0,
              minWidth: 240,
              background: 'var(--surface-raised)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              boxShadow: 'var(--shadow-lg)',
              padding: 8,
              zIndex: 300,
              animation: 'sidebarDropFadeIn 140ms cubic-bezier(0.2,0,0,1)',
            }}>
              <div style={{ padding: '8px 12px 12px' }}>
                <p style={{
                  margin: 0, fontSize: 14, fontWeight: 600,
                  color: 'var(--text-primary)',
                }}>{user?.full_name || getFirstName(user)}</p>
                {buildScopeLine(role) && (
                  <p style={{
                    margin: '2px 0 0', fontSize: 11,
                    color: 'var(--text-tertiary)',
                  }}>{buildScopeLine(role)}</p>
                )}
              </div>

              <Divider />
              <ThemeToggleRow />
              <Divider />

              <div style={{
                padding: '8px 12px',
                fontSize: 11, color: 'var(--text-tertiary)',
              }}>
                <span style={{ fontFamily: 'var(--font-mono)' }}>Ctrl + B</span>
                <span> to pin sidebar</span>
              </div>

              <Divider />
              <DropdownButton onClick={handleLogout} label="Log out" />
            </div>
          )}
        </div>
      </aside>

      <CreationChooser
        open={chooserOpen}
        onClose={() => setChooserOpen(false)}
        initialStep={chooserStep}
      />

      <style>{`@keyframes sidebarDropFadeIn {
        from { opacity: 0; transform: translateY(4px); }
        to { opacity: 1; transform: translateY(0); }
      }`}</style>
    </>
  );
}

/* ─── Subcomponents ──────────────────────────────────────────────── */

function SectionLabel({ expanded, children }: { expanded: boolean; children: string }) {
  if (!expanded) return <div style={{ height: 24 }} aria-hidden />;
  return (
    <p style={{
      margin: '18px 8px 6px',
      fontSize: 10.5, lineHeight: '15px', fontWeight: 700,
      letterSpacing: '.09em', textTransform: 'uppercase',
      color: 'var(--text-tertiary)', whiteSpace: 'nowrap',
    }}>{children}</p>
  );
}

function NavItem({ expanded, icon, label, active, onClick }: {
  expanded: boolean; icon: string; label: string; active: boolean; onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button onClick={onClick} title={!expanded ? label : undefined}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        height: 36,
        borderRadius: 8,
        padding: expanded ? '0 10px' : 0,
        marginBottom: 2,
        background: active ? 'var(--surface)' : hover ? 'var(--surface-raised)' : 'transparent',
        color: active ? 'var(--text-primary)' : hover ? 'var(--text-primary)' : 'var(--text-secondary)',
        border: active ? '1px solid var(--border)' : '1px solid transparent',
        boxShadow: active ? 'var(--shadow-sm)' : 'none',
        cursor: 'pointer',
        display: 'flex', alignItems: 'center',
        justifyContent: expanded ? 'flex-start' : 'center',
        gap: 10, fontFamily: 'var(--font-sans)', fontSize: 13.5,
        fontWeight: active ? 600 : 500,
        textAlign: 'left',
        transition: 'all .15s ease',
        width: '100%', whiteSpace: 'nowrap', overflow: 'hidden',
      }}>
      <span style={{ fontSize: 13, width: 18, textAlign: 'center', flexShrink: 0, opacity: .75 }}>{icon}</span>
      {expanded && <span>{label}</span>}
    </button>
  );
}

function ThemeToggleRow() {
  const { theme, setTheme } = useTheme();
  return (
    <div style={{
      padding: '8px 12px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    }}>
      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Theme</span>
      <div style={{
        display: 'inline-flex',
        background: 'var(--surface-sunken)',
        borderRadius: 8, padding: 3,
      }}>
        <ThemeChip active={theme === 'light'} onClick={() => setTheme('light')} label="☀ Light" />
        <ThemeChip active={theme === 'dark'}  onClick={() => setTheme('dark')}  label="☾ Dark" />
      </div>
    </div>
  );
}

function ThemeChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string}) {
  return (
    <button onClick={onClick} className="la-seg" style={{
      background: active ? 'var(--surface)' : 'transparent',
      color: active ? 'var(--text-primary)' : 'var(--text-tertiary)',
      borderRadius: 6, padding: '3px 10px',
      fontSize: 11.5, fontWeight: active ? 600 : 500,
      boxShadow: active ? 'var(--shadow-sm)' : 'none',
      cursor: 'pointer',
    }}>{label}</button>
  );
}

function Divider() {
  return (
    <div style={{
      height: 1, background: 'var(--border)',
      margin: '4px 0',
    }} />
  );
}

function DropdownButton({ onClick, label }: { onClick: () => void; label: string }) {
  const [hover, setHover] = useState(false);
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: '100%', textAlign: 'left',
        padding: '8px 12px',
        background: hover ? 'var(--surface-sunken)' : 'transparent',
        border: 'none', cursor: 'pointer',
        fontSize: 13, color: 'var(--text-primary)', fontFamily: 'var(--font-sans)',
        borderRadius: 7,
      }}>{label}</button>
  );
}

/* ─── Helpers ────────────────────────────────────────────────────── */

function getFirstName(user: StoredUser | null): string {
  if (!user) return 'You';
  if (user.full_name) return user.full_name.split(' ')[0];
  if (user.email) return user.email.split('@')[0];
  return 'You';
}

function buildScopeLine(role: any): string {
  if (!role) return '';
  if (role.role_scope_type === 'all') return `${role.role_display_name || 'Admin'} · full access`;
  if (role.role_scope_type === 'cluster' && role.role_scope_value?.length) {
    return `${role.role_display_name} · ${role.role_scope_value.join(', ')}`;
  }
  if (role.role_scope_type === 'brand' && role.role_scope_value?.length) {
    return `${role.role_display_name} · ${role.role_scope_value.length} brand${role.role_scope_value.length > 1 ? 's' : ''}`;
  }
  if (role.role_scope_type === 'function' && role.role_scope_value?.length) {
    return `${role.role_display_name} · ${role.role_scope_value.join(', ')}`;
  }
  return role.role_display_name || '';
}

function handleLogout() {
  localStorage.removeItem('laura_token');
  localStorage.removeItem('laura_user');
  sessionStorage.removeItem('laura.visitedLOAs');
  document.cookie = 'laura_token=; path=/; max-age=0';
  window.location.href = '/login';
}
