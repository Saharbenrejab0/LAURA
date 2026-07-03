'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import CreationChooser from '@/components/CreationChooser';
import { color, font, layout, motion, radius, shadow, space } from '@/styles/tokens';
import { useTheme } from '@/lib/theme';
import { useMyRole } from '@/hooks/usePermissions';

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
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        style={{
          position: 'fixed',
          top: 0, left: 0, bottom: 0,
          width,
          background: color.bg.subtle,
          borderRight: `1px solid ${color.border.soft}`,
          padding: `${space[4]}px ${space[3]}px`,
          display: 'flex', flexDirection: 'column',
          fontFamily: font.sans,
          transition: `width ${motion.duration.base}ms ${motion.easing}, box-shadow ${motion.duration.base}ms ${motion.easing}, background-color ${motion.duration.base}ms ${motion.easing}`,
          zIndex: isOverlay ? 200 : 100,
          boxShadow: isOverlay ? shadow.modal : 'none',
          overflow: 'visible',
        }}
      >
        {/* Brand header */}
        <header style={{
          padding: `${space[2]}px ${space[2]}px ${space[5]}px`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: space[2],
        }}>
          <div style={{ overflow: 'hidden', flex: 1 }}>
            <p style={{
              margin: 0, fontSize: 15, lineHeight: '20px', fontWeight: 600,
              letterSpacing: '-0.01em', color: color.text.primary, whiteSpace: 'nowrap',
            }}>{expanded ? 'LAURA' : 'L'}</p>
            {expanded && (
              <p style={{
                margin: '2px 0 0', fontSize: 12, lineHeight: '16px',
                color: color.text.secondary, whiteSpace: 'nowrap',
              }}>Marketing Finance</p>
            )}
          </div>
          {expanded && (
            <button
              onClick={() => togglePin()}
              title={pinned ? 'Unpin (Ctrl+B)' : 'Pin sidebar (Ctrl+B)'}
              style={{
                background: 'transparent',
                borderWidth: '1px', borderStyle: 'solid',
                borderColor: pinned ? color.action.primary : 'transparent',
                borderRadius: 6, cursor: 'pointer',
                color: pinned ? color.action.primary : color.text.tertiary,
                fontSize: 13, padding: '2px 8px', lineHeight: 1, fontFamily: font.sans,
              }}
            >{pinned ? '◉' : '◯'}</button>
          )}
        </header>

        {/* + New LOA */}
        <button
          onClick={() => openChooser('chooser')}
          title={!expanded ? 'New LOA' : undefined}
          style={{
            height: 40, borderRadius: 12,
            background: color.action.primary, color: color.text.onPrimary,
            border: 'none', fontFamily: font.sans,
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            marginBottom: space[6], width: '100%',
            transition: `background-color ${motion.duration.quick}ms ${motion.easing}`,
            whiteSpace: 'nowrap', overflow: 'hidden',
          }}
        >
          <span>+</span>
          {expanded && <span>New LOA</span>}
        </button>

        {/* Nav — "Ask Laura" removed (now lives in the Dynamic Island pill) */}
        <SectionLabel expanded={expanded}>Work</SectionLabel>
        <NavItem expanded={expanded} icon="▣" label="Tracker"
          active={active === 'tracker'} onClick={() => router.push('/')} />
        <NavItem expanded={expanded} icon="◌" label="Past Campaigns"
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
        <div ref={profileRef} style={{ position: 'relative', marginTop: space[2] }}>
          {/* Avatar trigger */}
          <button
            onClick={() => setProfileOpen(v => !v)}
            title={!expanded ? `${getFirstName(user)} — profile` : undefined}
            style={{
              width: '100%',
              padding: expanded ? `${space[2]}px ${space[2]}px` : 0,
              height: expanded ? 'auto' : 44,
              borderRadius: 10,
              background: profileOpen ? color.bg.canvas : 'transparent',
              borderWidth: '1px', borderStyle: 'solid', borderColor: 'transparent',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center',
              justifyContent: expanded ? 'flex-start' : 'center',
              gap: 10,
              transition: `background-color ${motion.duration.quick}ms ${motion.easing}`,
              fontFamily: font.sans,
            }}
            onMouseEnter={(e) => {
              if (!profileOpen) (e.currentTarget as HTMLButtonElement).style.background = color.bg.canvas;
            }}
            onMouseLeave={(e) => {
              if (!profileOpen) (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
            }}
          >
            <span style={{
              width: 32, height: 32, borderRadius: 999,
              background: color.action.primary,
              color: color.text.onPrimary,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 600, letterSpacing: '0.02em',
              flexShrink: 0,
            }}>{getInitials(user?.full_name || user?.email || '?')}</span>

            {expanded && (
              <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                <p style={{
                  margin: 0, fontSize: 13, fontWeight: 500,
                  color: color.text.primary,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{getFirstName(user)}</p>
                {role?.role_display_name && (
                  <p style={{
                    margin: '1px 0 0', fontSize: 11,
                    color: color.text.tertiary,
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
              background: color.bg.surface,
              borderWidth: '1px', borderStyle: 'solid', borderColor: color.border.soft,
              borderRadius: radius.card,
              boxShadow: shadow.popover,
              padding: space[2],
              zIndex: 300,
              animation: `sidebarDropFadeIn ${motion.duration.quick}ms ${motion.easing}`,
            }}>
              <div style={{ padding: `${space[2]}px ${space[3]}px ${space[3]}px` }}>
                <p style={{
                  margin: 0, fontSize: 14, fontWeight: 600,
                  color: color.text.primary,
                }}>{user?.full_name || getFirstName(user)}</p>
                {buildScopeLine(role) && (
                  <p style={{
                    margin: '2px 0 0', fontSize: 11,
                    color: color.text.tertiary,
                  }}>{buildScopeLine(role)}</p>
                )}
              </div>

              <Divider />
              <ThemeToggleRow />
              <Divider />

              <div style={{
                padding: `${space[2]}px ${space[3]}px`,
                fontSize: 11, color: color.text.tertiary,
              }}>
                <span style={{ fontFamily: font.mono }}>Ctrl + B</span>
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

/* ─── Subcomponents ──────────────────────────────────────────── */

function SectionLabel({ expanded, children }: { expanded: boolean; children: string }) {
  if (!expanded) return <div style={{ height: 24 }} aria-hidden />;
  return (
    <p style={{
      margin: `${space[6]}px ${space[2]}px ${space[2]}px`,
      fontSize: 11, lineHeight: '16px', fontWeight: 500,
      color: color.text.tertiary, whiteSpace: 'nowrap',
    }}>{children}</p>
  );
}

function NavItem({ expanded, icon, label, active, onClick }: {
  expanded: boolean; icon: string; label: string; active: boolean; onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  const bg = active ? color.bg.tint : hover ? color.bg.canvas : 'transparent';
  const fg = active ? color.action.primary : hover ? color.text.primary : color.text.secondary;
  return (
    <button onClick={onClick} title={!expanded ? label : undefined}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        height: 36, borderRadius: 10,
        padding: expanded ? '0 10px' : 0, marginBottom: 2,
        background: bg, color: fg, border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center',
        justifyContent: expanded ? 'flex-start' : 'center',
        gap: 10, fontFamily: font.sans, fontSize: 13, fontWeight: 500,
        textAlign: 'left',
        boxShadow: active ? `inset 2px 0 0 ${color.action.primary}` : 'none',
        transition: `background-color ${motion.duration.quick}ms ${motion.easing}, color ${motion.duration.quick}ms ${motion.easing}`,
        width: '100%', whiteSpace: 'nowrap', overflow: 'hidden',
      }}>
      <span style={{ fontSize: 14, width: 18, textAlign: 'center', flexShrink: 0 }}>{icon}</span>
      {expanded && <span>{label}</span>}
    </button>
  );
}

function ThemeToggleRow() {
  const { theme, setTheme } = useTheme();
  return (
    <div style={{
      padding: `${space[2]}px ${space[3]}px`,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: space[3],
    }}>
      <span style={{ fontSize: 12, color: color.text.secondary }}>Theme</span>
      <div style={{
        display: 'inline-flex',
        background: color.bg.subtle,
        borderRadius: 999, padding: 2,
        borderWidth: '1px', borderStyle: 'solid', borderColor: color.border.soft,
      }}>
        <ThemeChip active={theme === 'light'} onClick={() => setTheme('light')} label="Light" />
        <ThemeChip active={theme === 'dark'}  onClick={() => setTheme('dark')}  label="Dark" />
      </div>
    </div>
  );
}

function ThemeChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} style={{
      background: active ? color.bg.surface : 'transparent',
      color: active ? color.text.primary : color.text.tertiary,
      borderWidth: '1px', borderStyle: 'solid',
      borderColor: active ? color.border.soft : 'transparent',
      borderRadius: 999, padding: '3px 10px',
      fontSize: 11, fontWeight: active ? 500 : 400, fontFamily: font.sans,
      cursor: 'pointer',
      transition: `background-color ${motion.duration.quick}ms ${motion.easing}`,
    }}>{label}</button>
  );
}

function Divider() {
  return (
    <div style={{
      height: 1, background: color.border.soft,
      margin: `${space[1]}px 0`,
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
        padding: `${space[2]}px ${space[3]}px`,
        background: hover ? color.bg.canvas : 'transparent',
        border: 'none', cursor: 'pointer',
        fontSize: 13, color: color.text.primary, fontFamily: font.sans,
        borderRadius: radius.field,
      }}>{label}</button>
  );
}

/* ─── Helpers ────────────────────────────────────────────────── */

function getInitials(input: string): string {
  if (!input) return '?';
  const cleaned = input.replace(/@.+$/, '').replace(/[._-]/g, ' ').trim();
  const parts = cleaned.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

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
