'use client'

/**
 * LAURA — Login · Editorial Finance redesign (Phase A)
 * -----------------------------------------------------
 * Visual layer rebuilt on styles/redesign.css (Cormorant, gold, cream canvas).
 * ALL auth logic preserved: group modal, search, POC_PASSWORD login flow,
 * router.push, useToast feedback.
 *
 * Corrections in this version:
 *   - Vanessa's admin email updated to vanessa@essilor.com (the vanessa-admin@
 *     account was removed from the DB during the workflow-V3 migration).
 */

import { useState, useMemo, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { login } from '@/lib/api'
import { useToast } from '@/components/Toast'
import { Btn, Overline, Avatar, initialsOf } from '@/components/ui/atoms'

interface Account {
  email: string
  name: string
  role_code: string
  sub_group?: string
}

interface Group {
  key: string
  label: string
  tagline: string
  description: string
  accounts: Account[]
}

const GROUPS: Group[] = [
  {
    key: 'local',
    label: 'Local Markets',
    tagline: 'The builders',
    description:
      'Cluster marketers and finance teams across the 8 EMEA clusters. They create LOAs and edit during EMEA review.',
    accounts: [
      { email: 'flora@laura.local',          name: 'Flora',           role_code: 'france_marketer',  sub_group: 'FRANCE' },
      { email: 'anais@laura.local',          name: 'Anaïs',           role_code: 'france_marketer',  sub_group: 'FRANCE' },
      { email: 'agathe@laura.local',         name: 'Agathe',          role_code: 'france_marketer',  sub_group: 'FRANCE' },
      { email: 'marie@laura.local',          name: 'Marie',           role_code: 'france_marketer',  sub_group: 'FRANCE' },
      { email: 'finance-france@laura.local', name: 'France Finance',  role_code: 'france_finance',   sub_group: 'FRANCE' },
      { email: 'chiara@laura.local',         name: 'Chiara',          role_code: 'italy_marketer',   sub_group: 'ITALY' },
      { email: 'alessandra@laura.local',     name: 'Alessandra',      role_code: 'italy_marketer',   sub_group: 'ITALY' },
      { email: 'finance-italy@laura.local',  name: 'Italy Finance',   role_code: 'italy_finance',    sub_group: 'ITALY' },
      { email: 'olaf@laura.local',           name: 'Olaf',            role_code: 'dach_marketer',    sub_group: 'DACH' },
      { email: 'finance-dach@laura.local',   name: 'DACH Finance',    role_code: 'dach_finance',     sub_group: 'DACH' },
      { email: 'nadia@laura.local',          name: 'Nadia',           role_code: 'iberia_marketer',  sub_group: 'IBERIA' },
      { email: 'finance-iberia@laura.local', name: 'Iberia Finance',  role_code: 'iberia_finance',   sub_group: 'IBERIA' },
      { email: 'ewelina@laura.local',        name: 'Ewelina',         role_code: 'north_marketer',   sub_group: 'NORTH' },
      { email: 'lindsey@laura.local',        name: 'Lindsey',         role_code: 'north_marketer',   sub_group: 'NORTH' },
      { email: 'finance-north@laura.local',  name: 'North Finance',   role_code: 'north_finance',    sub_group: 'NORTH' },
      { email: 'justine@laura.local',        name: 'Justine',         role_code: 'meta_marketer',    sub_group: 'META' },
      { email: 'finance-meta@laura.local',   name: 'Meta Finance',    role_code: 'meta_finance',     sub_group: 'META' },
      { email: 'aude@laura.local',           name: 'Aude',            role_code: 'east_gr_marketer', sub_group: 'EAST & GR' },
      { email: 'ionela@laura.local',         name: 'Ionela',          role_code: 'east_gr_marketer', sub_group: 'EAST & GR' },
      { email: 'finance-east@laura.local',   name: 'East&GR Finance', role_code: 'east_gr_finance',  sub_group: 'EAST & GR' },
      { email: 'elena@laura.local',          name: 'Elena',           role_code: 'russia_marketer',  sub_group: 'RUSSIA' },
      { email: 'alena@laura.local',          name: 'Alena',           role_code: 'russia_marketer',  sub_group: 'RUSSIA' },
      { email: 'finance-russia@laura.local', name: 'Russia Finance',  role_code: 'russia_finance',   sub_group: 'RUSSIA' },
    ],
  },
  {
    key: 'brands',
    label: 'Global Brands',
    tagline: 'The curators',
    description:
      'Brand custodians who comment during brand review — they cannot edit, only leave feedback.',
    accounts: [
      { email: 'marco@essilor.com',             name: 'Marco',             role_code: 'global_brand_rayban' },
      { email: 'brand-oakley@laura.local',      name: 'Oakley Brand Team', role_code: 'global_brand_oakley' },
      { email: 'brand-essilor@laura.local',     name: 'Essilor Lenses',    role_code: 'global_brand_essilor_lenses' },
      { email: 'brand-transitions@laura.local', name: 'Transitions',       role_code: 'global_brand_transitions' },
      { email: 'brand-other-hb@laura.local',    name: 'Other HB',          role_code: 'global_brand_other_hb' },
      { email: 'brand-license@laura.local',     name: 'License Brands',    role_code: 'global_brand_license' },
    ],
  },
  {
    key: 'functions',
    label: 'Global Functions',
    tagline: 'The specialists',
    description:
      'PR & Events, Medical Affairs, and Trade Marketing — they comment during the functions review step.',
    accounts: [
      { email: 'sofia@essilor.com',            name: 'Sofia',           role_code: 'global_function_pr_events' },
      { email: 'function-medical@laura.local', name: 'Medical Affairs', role_code: 'global_function_medical' },
      { email: 'function-trade@laura.local',   name: 'Trade Marketing', role_code: 'global_function_trade' },
    ],
  },
  {
    key: 'cmocfo',
    label: 'CMO / CFO',
    tagline: 'The regional gate',
    description:
      'Alexandra validates the PowerPoint, Giulia validates the Excel. Either can approve to move the LOA forward.',
    accounts: [
      { email: 'alexandra@essilor.com', name: 'Alexandra',      role_code: 'regional_cmo' },
      { email: 'giulia@essilor.com',    name: 'Giulia Uccelli', role_code: 'regional_cfo' },
    ],
  },
  {
    key: 'corporate',
    label: 'Corporate Finance',
    tagline: 'The final approval',
    description:
      'Paola and Diana validate at corporate review — the last gate before a LOA is approved.',
    accounts: [
      { email: 'paola@essilor.com', name: 'Paola Boneto',   role_code: 'corporate_paola' },
      { email: 'diana@essilor.com', name: 'Diana Canazaro', role_code: 'corporate_diana' },
    ],
  },
  {
    key: 'admin',
    label: 'Administration',
    tagline: 'Full access',
    description:
      'Super-admins with full control — can act at any step, lock/unlock LOAs, and manage permissions.',
    accounts: [
      { email: 'thibault@essilor.com', name: 'Thibault de Bodman', role_code: 'super_admin' },
      { email: 'vanessa@essilor.com',  name: 'Vanessa Stoecklein', role_code: 'super_admin' },
      { email: 'sandrine@essilor.com', name: 'Sandrine Goetz',     role_code: 'super_admin' },
    ],
  },
]

function roleDisplayName(code: string): string {
  return {
    france_marketer:  'France Marketer',
    italy_marketer:   'Italy Marketer',
    dach_marketer:    'DACH Marketer',
    iberia_marketer:  'Iberia Marketer',
    north_marketer:   'North Marketer',
    meta_marketer:    'Meta Marketer',
    east_gr_marketer: 'East & GR Marketer',
    russia_marketer:  'Russia Marketer',
    france_finance:   'France Finance',
    italy_finance:    'Italy Finance',
    dach_finance:     'DACH Finance',
    iberia_finance:   'Iberia Finance',
    north_finance:    'North Finance',
    meta_finance:     'Meta Finance',
    east_gr_finance:  'East & GR Finance',
    russia_finance:   'Russia Finance',
    regional_cmo:     'Regional CMO',
    regional_cfo:     'Regional CFO',
    global_brand_rayban:         'Ray-Ban Brand',
    global_brand_oakley:         'Oakley Brand',
    global_brand_essilor_lenses: 'Essilor Lenses Brand',
    global_brand_transitions:    'Transitions Brand',
    global_brand_other_hb:       'Other HB Brands',
    global_brand_license:        'License Brands',
    global_function_pr_events:   'PR & Events',
    global_function_medical:     'Medical Affairs',
    global_function_trade:       'Trade Marketing',
    corporate_paola: 'Corporate (Paola)',
    corporate_diana: 'Corporate (Diana)',
    super_admin:     'Super-Admin',
  }[code] || code
}

const TOTAL_ACCOUNTS = GROUPS.reduce((sum, g) => sum + g.accounts.length, 0)
const POC_PASSWORD = 'laura2026'

export default function LoginPage() {
  const router = useRouter()
  const { error: toastError, success } = useToast()

  const [openGroup, setOpenGroup] = useState<Group | null>(null)
  const [search, setSearch] = useState('')
  const [loggingIn, setLoggingIn] = useState<string | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Ensure the redesign palette variables apply on the login route
  // (AppShell is skipped on /login, so we set data-theme locally)
  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('laura.theme') : null
    const t = stored === 'dark' ? 'dark' : 'light'
    document.documentElement.setAttribute('data-theme', t)
    if (t === 'dark') document.documentElement.classList.add('dark')
    else document.documentElement.classList.remove('dark')
  }, [])

  useEffect(() => {
    if (openGroup) {
      setSearch('')
      setTimeout(() => searchInputRef.current?.focus(), 60)
    }
  }, [openGroup])

  useEffect(() => {
    document.body.style.overflow = openGroup ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [openGroup])

  useEffect(() => {
    if (!openGroup) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenGroup(null) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [openGroup])

  const visibleAccounts = useMemo(() => {
    if (!openGroup) return []
    const q = search.trim().toLowerCase()
    if (!q) return openGroup.accounts
    return openGroup.accounts.filter(a =>
      a.name.toLowerCase().includes(q) ||
      a.email.toLowerCase().includes(q) ||
      a.role_code.toLowerCase().includes(q) ||
      roleDisplayName(a.role_code).toLowerCase().includes(q) ||
      (a.sub_group?.toLowerCase().includes(q) ?? false)
    )
  }, [openGroup, search])

  async function handleSelectAccount(account: Account) {
    if (loggingIn) return
    setLoggingIn(account.email)
    try {
      await login(account.email, POC_PASSWORD)
      success(`Welcome, ${account.name}`)
      router.push('/welcome')
    } catch {
      toastError(`Sign-in failed for ${account.name}.`)
      setLoggingIn(null)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--canvas)',
      color: 'var(--text-primary)',
      fontFamily: 'var(--font-sans)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* ── Header ──────────────────────────────────────────────── */}
      <header style={{
        padding: '22px 44px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{
            fontFamily: 'var(--font-display)',
            fontSize: 28, fontWeight: 600, lineHeight: 1,
            color: 'var(--text-primary)',
          }}>
            LAURA<span style={{ color: 'var(--gold)' }}>.</span>
          </span>
          <span style={{
            fontSize: 11.5, color: 'var(--text-tertiary)',
            paddingLeft: 12, borderLeft: '1px solid var(--border)',
            letterSpacing: '.03em',
          }}>
            LOA Automation &amp; Review Agent
          </span>
        </div>

        <span style={{
          padding: '4px 12px',
          border: '1px solid var(--border-strong)',
          borderRadius: 99,
          fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase',
          fontWeight: 600, color: 'var(--text-secondary)',
        }}>
          Preview
        </span>
      </header>

      {/* ── Main ────────────────────────────────────────────────── */}
      <main style={{
        flex: 1,
        maxWidth: 1180, width: '100%',
        margin: '0 auto',
        padding: '76px 44px 60px',
        boxSizing: 'border-box',
        filter: openGroup ? 'blur(8px)' : 'none',
        opacity: openGroup ? 0.35 : 1,
        pointerEvents: openGroup ? 'none' : 'auto',
        transition: 'filter .35s ease, opacity .35s ease',
      }}>
        <div style={{
          textAlign: 'center',
          maxWidth: 640, margin: '0 auto 56px',
        }}>
          <Overline style={{ marginBottom: 18 }}>Welcome to Laura</Overline>
          <h1 style={{
            margin: 0,
            fontFamily: 'var(--font-display)',
            fontStyle: 'italic', fontWeight: 500,
            fontSize: 60, lineHeight: 1.05, letterSpacing: '-0.01em',
            color: 'var(--text-primary)',
          }}>
            Welcome back.
          </h1>
          <div style={{
            width: 64, height: 2, background: 'var(--gold)',
            margin: '22px auto 0',
          }} />
          <p style={{
            marginTop: 22, fontSize: 15, lineHeight: 1.6,
            color: 'var(--text-secondary)', maxWidth: 520, marginLeft: 'auto', marginRight: 'auto',
          }}>
            Choose where you sit in the LOA workflow, and we'll bring you
            straight to what matters.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 20,
          maxWidth: 1100, margin: '0 auto',
        }}>
          {GROUPS.map((group, i) => (
            <RoleCard
              key={group.key}
              group={group}
              index={i}
              onClick={() => setOpenGroup(group)}
            />
          ))}
        </div>
      </main>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer style={{
        padding: '26px 44px',
        borderTop: '1px solid var(--border)',
        textAlign: 'center',
        filter: openGroup ? 'blur(8px)' : 'none',
        opacity: openGroup ? 0.35 : 1,
        transition: 'filter .35s ease, opacity .35s ease',
      }}>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-tertiary)', letterSpacing: '.03em' }}>
          LAURA for EssilorLuxottica · {TOTAL_ACCOUNTS} accounts · Preview environment
        </p>
      </footer>

      {/* ── Account picker modal ────────────────────────────────── */}
      {openGroup && (
        <AccountPicker
          group={openGroup}
          search={search}
          setSearch={setSearch}
          searchInputRef={searchInputRef}
          visibleAccounts={visibleAccounts}
          loggingIn={loggingIn}
          onSelect={handleSelectAccount}
          onClose={() => setOpenGroup(null)}
        />
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   Role card
   ═══════════════════════════════════════════════════════════════ */

function RoleCard({
  group, index, onClick,
}: { group: Group; index: number; onClick: () => void }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative',
        display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
        textAlign: 'left',
        background: 'var(--ink)', color: 'var(--ink-text)',
        borderRadius: 16,
        padding: '26px 26px 20px',
        minHeight: 200,
        border: `1px solid ${hover ? 'var(--gold)' : 'transparent'}`,
        transition: 'all .25s cubic-bezier(0.16, 1, 0.3, 1)',
        cursor: 'pointer',
        fontFamily: 'var(--font-sans)',
        transform: hover ? 'translateY(-4px)' : 'none',
        boxShadow: hover
          ? '0 0 0 1px var(--gold), 0 24px 60px rgba(0,0,0,.28)'
          : '0 6px 20px rgba(0,0,0,.14)',
        animation: `laRoleIn .5s cubic-bezier(0.16, 1, 0.3, 1) ${index * 60}ms backwards`,
      }}
    >
      <style>{`@keyframes laRoleIn {
        from { opacity: 0; transform: translateY(12px); }
        to   { opacity: 1; transform: translateY(0); }
      }`}</style>

      <span style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '.14em',
        textTransform: 'uppercase',
        color: hover ? 'var(--gold)' : 'rgba(244, 238, 223, .55)',
        transition: 'color .25s ease',
      }}>
        {group.tagline}
      </span>

      <span style={{
        marginTop: 12,
        fontFamily: 'var(--font-display)', fontStyle: 'italic',
        fontSize: 27, fontWeight: 600, lineHeight: 1.15,
      }}>
        {group.label}
      </span>

      <span style={{
        marginTop: 10,
        fontSize: 12.5, lineHeight: 1.55, opacity: 0.7,
      }}>
        {group.description}
      </span>

      <div style={{
        marginTop: 'auto', paddingTop: 18, width: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        opacity: 0.85,
      }}>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 11.5, fontWeight: 500,
        }}>
          {group.accounts.length} account{group.accounts.length > 1 ? 's' : ''}
        </span>
        <span style={{
          fontSize: 16,
          transform: hover ? 'translateX(4px)' : 'none',
          color: hover ? 'var(--gold)' : 'inherit',
          transition: 'all .25s ease',
        }}>→</span>
      </div>
    </button>
  )
}

/* ═══════════════════════════════════════════════════════════════
   Account picker modal
   ═══════════════════════════════════════════════════════════════ */

function AccountPicker({
  group, search, setSearch, searchInputRef,
  visibleAccounts, loggingIn, onSelect, onClose,
}: {
  group: Group
  search: string
  setSearch: (v: string) => void
  searchInputRef: React.RefObject<HTMLInputElement>
  visibleAccounts: Account[]
  loggingIn: string | null
  onSelect: (a: Account) => void
  onClose: () => void
}) {
  return (
    <div className="la-dim" onClick={onClose}>
      <div
        className="la-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 620, padding: 0 }}
      >
        {/* Ink header — matches the role card */}
        <div style={{
          position: 'relative',
          background: 'var(--ink)', color: 'var(--ink-text)',
          padding: '28px 32px 26px',
          borderRadius: '16px 16px 0 0',
        }}>
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '.14em',
            textTransform: 'uppercase', color: 'var(--gold)',
          }}>
            {group.tagline}
          </span>
          <div style={{
            marginTop: 8,
            fontFamily: 'var(--font-display)', fontStyle: 'italic',
            fontSize: 30, fontWeight: 600, lineHeight: 1.1,
          }}>
            {group.label}
          </div>
          <p style={{
            margin: '14px 0 0',
            fontSize: 13, lineHeight: 1.6, opacity: 0.72,
            maxWidth: 480,
          }}>
            {group.description}
          </p>

          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              position: 'absolute', top: 20, right: 20,
              width: 32, height: 32, borderRadius: 99,
              background: 'rgba(244, 238, 223, .12)',
              border: '1px solid rgba(244, 238, 223, .25)',
              color: 'var(--ink-text)',
              fontSize: 16, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 0, fontFamily: 'var(--font-sans)',
            }}
          >×</button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 26px 26px' }}>
          <div className="la-search" style={{ maxWidth: 'none', marginBottom: 14 }}>
            <span style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>⌕</span>
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, cluster, or role…"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                style={{
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-sans)',
                }}
              >Clear</button>
            )}
          </div>

          {visibleAccounts.length === 0 ? (
            <div style={{
              padding: '32px 20px', textAlign: 'center',
              color: 'var(--text-tertiary)', fontSize: 13,
            }}>
              No accounts match "{search}".
            </div>
          ) : (
            <div style={{
              display: 'flex', flexDirection: 'column', gap: 6,
              maxHeight: '52vh', overflowY: 'auto',
              paddingRight: 4,
            }}>
              {visibleAccounts.map(account => (
                <AccountRow
                  key={account.email}
                  account={account}
                  loading={loggingIn === account.email}
                  disabled={loggingIn !== null && loggingIn !== account.email}
                  onClick={() => onSelect(account)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function AccountRow({
  account, loading, disabled, onClick,
}: {
  account: Account
  loading: boolean
  disabled: boolean
  onClick: () => void
}) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      onMouseDown={(e) => e.preventDefault()}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 14px', borderRadius: 10,
        background: hover && !disabled && !loading ? 'var(--surface-raised)' : 'var(--surface)',
        border: `1px solid ${hover && !disabled && !loading ? 'var(--gold)' : 'var(--border)'}`,
        cursor: disabled ? 'not-allowed' : loading ? 'wait' : 'pointer',
        opacity: disabled ? 0.4 : loading ? 0.6 : 1,
        textAlign: 'left', width: '100%',
        transition: 'all .15s ease',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <Avatar initials={initialsOf(account.name)} size={34} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14, fontWeight: 600, color: 'var(--text-primary)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {loading ? 'Signing in…' : account.name}
        </div>
        <div style={{
          marginTop: 2, fontSize: 11.5, color: 'var(--text-tertiary)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {roleDisplayName(account.role_code)}
          {account.sub_group && <> · {account.sub_group}</>}
        </div>
      </div>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 10.5,
        color: 'var(--text-tertiary)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        maxWidth: 200,
      }}>
        {account.email}
      </div>
    </button>
  )
}
