'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { login } from '@/lib/api'
import { useToast } from '@/components/Toast'

// ──────────────────────────────────────────────────────────────────────
// THE 45 LAURA ACCOUNTS, ORGANIZED IN 7 GROUPS
// ──────────────────────────────────────────────────────────────────────

interface Account {
  email: string
  name: string
  role_code: string
  sub_group?: string
}

interface Group {
  key: string
  label: string
  description: string
  accounts: Account[]
}

const GROUPS: Group[] = [
  {
    key: 'local',
    label: 'Local Markets',
    description: 'Cluster marketers and finance teams across the 8 EMEA clusters.',
    accounts: [
      { email: 'flora@laura.local',         name: 'Flora',         role_code: 'france_marketer',   sub_group: 'FRANCE' },
      { email: 'anais@laura.local',         name: 'Anais',         role_code: 'france_marketer',   sub_group: 'FRANCE' },
      { email: 'agathe@laura.local',        name: 'Agathe',        role_code: 'france_marketer',   sub_group: 'FRANCE' },
      { email: 'marie@laura.local',         name: 'Marie',         role_code: 'france_marketer',   sub_group: 'FRANCE' },
      { email: 'finance-france@laura.local',name: 'France Finance',role_code: 'france_finance',    sub_group: 'FRANCE' },
      { email: 'chiara@laura.local',        name: 'Chiara',         role_code: 'italy_marketer',   sub_group: 'ITALY' },
      { email: 'alessandra@laura.local',    name: 'Alessandra',     role_code: 'italy_marketer',   sub_group: 'ITALY' },
      { email: 'finance-italy@laura.local', name: 'Italy Finance',  role_code: 'italy_finance',    sub_group: 'ITALY' },
      { email: 'olaf@laura.local',          name: 'Olaf',         role_code: 'dach_marketer',   sub_group: 'DACH' },
      { email: 'finance-dach@laura.local',  name: 'DACH Finance', role_code: 'dach_finance',    sub_group: 'DACH' },
      { email: 'nadia@laura.local',         name: 'Nadia',          role_code: 'iberia_marketer', sub_group: 'IBERIA' },
      { email: 'finance-iberia@laura.local',name: 'Iberia Finance', role_code: 'iberia_finance',  sub_group: 'IBERIA' },
      { email: 'ewelina@laura.local',       name: 'Ewelina',        role_code: 'north_marketer', sub_group: 'NORTH' },
      { email: 'lindsey@laura.local',       name: 'Lindsey',        role_code: 'north_marketer', sub_group: 'NORTH' },
      { email: 'finance-north@laura.local', name: 'North Finance',  role_code: 'north_finance',  sub_group: 'NORTH' },
      { email: 'justine@laura.local',       name: 'Justine',        role_code: 'meta_marketer', sub_group: 'META' },
      { email: 'finance-meta@laura.local',  name: 'Meta Finance',   role_code: 'meta_finance',  sub_group: 'META' },
      { email: 'aude@laura.local',          name: 'Aude',           role_code: 'east_gr_marketer', sub_group: 'EAST & GR' },
      { email: 'ionela@laura.local',        name: 'Ionela',         role_code: 'east_gr_marketer', sub_group: 'EAST & GR' },
      { email: 'finance-east@laura.local',  name: 'East&GR Finance',role_code: 'east_gr_finance',  sub_group: 'EAST & GR' },
      { email: 'elena@laura.local',         name: 'Elena',          role_code: 'russia_marketer', sub_group: 'RUSSIA' },
      { email: 'alena@laura.local',         name: 'Alena',          role_code: 'russia_marketer', sub_group: 'RUSSIA' },
      { email: 'finance-russia@laura.local',name: 'Russia Finance', role_code: 'russia_finance',  sub_group: 'RUSSIA' },
    ],
  },
  {
    key: 'regional',
    label: 'Regional EMEA',
    description: 'The EMEA editor, Regional CMO, and Regional CFO who shape every LOA into its final form.',
    accounts: [
      { email: 'vanessa@essilor.com',   name: 'Vanessa Stöecklein', role_code: 'emea_ps_editor' },
      { email: 'alexandra@essilor.com', name: 'Alexandra',          role_code: 'regional_cmo' },
      { email: 'giulia@essilor.com',    name: 'Giulia Uccelli',     role_code: 'regional_cfo' },
    ],
  },
  {
    key: 'brands',
    label: 'Global Brands',
    description: 'Brand custodians who weigh in during global review.',
    accounts: [
      { email: 'marco@essilor.com',             name: 'Marco',              role_code: 'global_brand_rayban' },
      { email: 'brand-oakley@laura.local',      name: 'Oakley Brand Team',  role_code: 'global_brand_oakley' },
      { email: 'brand-essilor@laura.local',     name: 'Essilor Lenses',     role_code: 'global_brand_essilor_lenses' },
      { email: 'brand-transitions@laura.local', name: 'Transitions',        role_code: 'global_brand_transitions' },
      { email: 'brand-other-hb@laura.local',    name: 'Other HB',           role_code: 'global_brand_other_hb' },
      { email: 'brand-license@laura.local',     name: 'License Brands',     role_code: 'global_brand_license' },
    ],
  },
  {
    key: 'functions',
    label: 'Global Functions',
    description: 'PR & Events, Medical Affairs, and Trade Marketing — the cross-brand voices.',
    accounts: [
      { email: 'sofia@essilor.com',            name: 'Sofia',           role_code: 'global_function_pr_events' },
      { email: 'function-medical@laura.local', name: 'Medical Affairs', role_code: 'global_function_medical' },
      { email: 'function-trade@laura.local',   name: 'Trade Marketing', role_code: 'global_function_trade' },
    ],
  },
  {
    key: 'corporate',
    label: 'Corporate Milan',
    description: 'The final corporate check before each LOA reaches the CEO.',
    accounts: [
      { email: 'paola@essilor.com', name: 'Paola Boneto',   role_code: 'corporate_paola' },
      { email: 'diana@essilor.com', name: 'Diana Canazaro', role_code: 'corporate_diana' },
    ],
  },
  {
    key: 'ceo',
    label: 'CEO Validation',
    description: 'The assistant who approves or rejects each LOA live, beside the Group CEO.',
    accounts: [
      { email: 'ceo-validator@laura.local', name: 'CEO Assistant', role_code: 'ceo_validator' },
    ],
  },
  {
    key: 'admin',
    label: 'Administration',
    description: 'Super-admins from Essilor and the AI to Market team.',
    accounts: [
      { email: 'thibault@essilor.com',         name: 'Thibault de Bodman',     role_code: 'super_admin' },
      { email: 'vanessa-admin@essilor.com',    name: 'Vanessa (Admin)',        role_code: 'super_admin' },
      { email: 'sandrine@essilor.com',         name: 'Sandrine Goetz',         role_code: 'super_admin' },
      { email: 'sahar@aitomarketgroup.com',    name: 'Sahar',                  role_code: 'ai_to_market_admin' },
      { email: 'neha@aitomarketgroup.com',     name: 'Neha',                   role_code: 'ai_to_market_admin' },
      { email: 'vandana@aitomarketgroup.com',  name: 'Vandana',                role_code: 'ai_to_market_admin' },
      { email: 'alabhya@essilor.com',          name: 'Alabhya',                role_code: 'ai_to_market_admin' },
    ],
  },
]

function roleDisplayName(code: string): string {
  return {
    france_marketer:    'France Marketer',
    italy_marketer:     'Italy Marketer',
    dach_marketer:      'DACH Marketer',
    iberia_marketer:    'Iberia Marketer',
    north_marketer:     'North Marketer',
    meta_marketer:      'Meta Marketer',
    east_gr_marketer:   'East & GR Marketer',
    russia_marketer:    'Russia Marketer',
    france_finance:     'France Finance',
    italy_finance:      'Italy Finance',
    dach_finance:       'DACH Finance',
    iberia_finance:     'Iberia Finance',
    north_finance:      'North Finance',
    meta_finance:       'Meta Finance',
    east_gr_finance:    'East & GR Finance',
    russia_finance:     'Russia Finance',
    emea_ps_editor:     'EMEA PS Editor',
    regional_cmo:       'Regional CMO',
    regional_cfo:       'Regional CFO',
    global_brand_rayban:         'Ray-Ban Brand',
    global_brand_oakley:         'Oakley Brand',
    global_brand_essilor_lenses: 'Essilor Lenses Brand',
    global_brand_transitions:    'Transitions Brand',
    global_brand_other_hb:       'Other HB Brands',
    global_brand_license:        'License Brands',
    global_function_pr_events:   'PR & Events',
    global_function_medical:     'Medical Affairs',
    global_function_trade:       'Trade Marketing',
    corporate_paola:    'Corporate (Paola)',
    corporate_diana:    'Corporate (Diana)',
    ceo_validator:      'CEO Validator',
    super_admin:        'Super-Admin',
    ai_to_market_admin: 'AI to Market',
  }[code] || code
}

const POC_PASSWORD = 'laura2026'

export default function LoginPage() {
  const router = useRouter()
  const { error: toastError, success } = useToast()

  const [openGroup, setOpenGroup] = useState<Group | null>(null)
  const [search, setSearch] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [loggingIn, setLoggingIn] = useState<string | null>(null)
  const [hoveredCard, setHoveredCard] = useState<string | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (openGroup) {
      setSearch('')
      setSearchFocused(false)
      setTimeout(() => searchInputRef.current?.focus(), 50)
    }
  }, [openGroup])

  useEffect(() => {
    if (openGroup) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [openGroup])

  useEffect(() => {
    if (!openGroup) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenGroup(null)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [openGroup])

  // Filter accounts:
  //   - If user typed something → filter by query
  //   - If search is focused but empty → show all accounts in the group
  //   - If search is not focused → show nothing (empty state)
  const visibleAccounts = useMemo(() => {
    if (!openGroup) return []
    if (search.trim()) {
      const q = search.toLowerCase().trim()
      return openGroup.accounts.filter(a =>
        a.name.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q) ||
        a.role_code.toLowerCase().includes(q) ||
        roleDisplayName(a.role_code).toLowerCase().includes(q) ||
        (a.sub_group?.toLowerCase().includes(q) ?? false)
      )
    }
    if (searchFocused) return openGroup.accounts
    return []
  }, [openGroup, search, searchFocused])

  async function handleSelectAccount(account: Account) {
    if (loggingIn) return
    setLoggingIn(account.email)
    try {
      await login(account.email, POC_PASSWORD)
      success(`Welcome, ${account.name}`)
      router.push('/')
    } catch {
      toastError(`Sign-in failed for ${account.name}.`)
      setLoggingIn(null)
    }
  }

  return (
    <div style={styles.page}>

      {/* ── Header ──────────────────────────────────────────────── */}
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <div style={styles.brand}>
            <span style={styles.brandMark}>L</span>
            <div>
              <h1 style={styles.brandTitle}>LAURA</h1>
              <p style={styles.brandSub}>LOA Automation &amp; Review Agent</p>
            </div>
          </div>
          <span style={styles.pocBadge}>Preview</span>
        </div>
      </header>

      {/* ── Main: deck of black cards ──────────────────────────── */}
      <main
        style={{
          ...styles.main,
          ...(openGroup ? styles.mainBlurred : {}),
        }}
      >
        <div style={styles.intro}>
          <h2 style={styles.introTitle}>Welcome back.</h2>
          <p style={styles.introText}>
            Choose where you sit in the LOA workflow, and we'll bring you
            straight to what matters.
          </p>
        </div>

        <div style={styles.grid}>
          {GROUPS.map(group => {
            const isHover = hoveredCard === group.key
            return (
              <button
                key={group.key}
                onClick={() => setOpenGroup(group)}
                onMouseEnter={() => setHoveredCard(group.key)}
                onMouseLeave={() => setHoveredCard(null)}
                style={{
                  ...styles.card,
                  ...(isHover ? styles.cardHover : {}),
                }}
              >
                <div style={styles.cardShine} />
                <p style={styles.cardLabel}>{group.label}</p>
              </button>
            )
          })}
        </div>
      </main>

      <footer
        style={{
          ...styles.footer,
          ...(openGroup ? styles.footerBlurred : {}),
        }}
      >
        <p style={styles.footerText}>
          Crafted by AI to Market for EssilorLuxottica · 45 accounts seeded
        </p>
      </footer>

      {/* ── Modal (the chosen card, revealed in the foreground) ─── */}
      {openGroup && (
        <div style={styles.modalBackdrop} onClick={() => setOpenGroup(null)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>

            {/* Modal header: the chosen card revealed larger */}
            <div style={styles.modalHeader}>
              <div style={styles.modalCardPreview}>
                <div style={styles.modalCardShine} />
                <p style={styles.modalCardLabel}>{openGroup.label}</p>
              </div>
              <button
                onClick={() => setOpenGroup(null)}
                style={styles.modalClose}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <p style={styles.modalDescription}>{openGroup.description}</p>

            <div style={styles.modalBody}>
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                placeholder="Search by name…"
                style={styles.searchInput}
              />

              {/* Empty state: search not focused and no query */}
              {!searchFocused && !search.trim() && (
                <div style={styles.emptyState}>
                  <p style={styles.emptyText}>
                    {openGroup.accounts.length} account
                    {openGroup.accounts.length !== 1 ? 's' : ''} in this group.
                  </p>
                  <p style={styles.emptyHint}>
                    Tap the search field to see them all, or type your name.
                  </p>
                </div>
              )}

              {/* No results from query */}
              {search.trim() && visibleAccounts.length === 0 && (
                <div style={styles.emptyState}>
                  <p style={styles.emptyText}>No accounts match "{search}".</p>
                  <p style={styles.emptyHint}>Try a different keyword.</p>
                </div>
              )}

              {/* Results — either filtered or all accounts when focused */}
              {visibleAccounts.length > 0 && (
                <div style={styles.resultsList}>
                  {visibleAccounts.map(account => {
                    const isLoading = loggingIn === account.email
                    const disabled = loggingIn !== null && !isLoading
                    return (
                      <button
                        key={account.email}
                        onClick={() => handleSelectAccount(account)}
                        disabled={disabled || isLoading}
                        onMouseDown={(e) => e.preventDefault()}
                        style={{
                          ...styles.resultRow,
                          ...(isLoading ? styles.resultRowLoading : {}),
                          ...(disabled ? styles.resultRowDisabled : {}),
                        }}
                        onMouseEnter={(e) => {
                          if (!disabled && !isLoading) {
                            Object.assign(e.currentTarget.style, {
                              ...styles.resultRow,
                              ...styles.resultRowHover,
                            })
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!disabled && !isLoading) {
                            Object.assign(e.currentTarget.style, styles.resultRow)
                          }
                        }}
                      >
                        <div style={styles.resultMain}>
                          <p style={styles.resultName}>
                            {isLoading ? 'Signing in…' : account.name}
                          </p>
                          <p style={styles.resultMeta}>
                            {roleDisplayName(account.role_code)}
                            {account.sub_group && <> · {account.sub_group}</>}
                          </p>
                        </div>
                        <p style={styles.resultEmail}>{account.email}</p>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────
// STYLES — premium soft black & white, editorial typography
// ──────────────────────────────────────────────────────────────────────

const COLOR = {
  bg:         '#F8F6F3',   // soft warm off-white — easier on the eyes than pure white
  surface:    '#FFFFFF',
  surfaceSoft:'#FCFAF7',
  border:     '#E8E4DE',   // warm gray border
  borderSoft: '#F0EDE7',
  text:       '#1A1A1A',   // soft black, never pure 000
  textSoft:   '#4D4944',
  textMuted:  '#8A857E',
  textFaint:  '#B8B3AC',
  cardBg:     '#1A1A1A',   // soft black, not aggressive
  cardBgHover:'#262626',
  cardText:   '#FCFAF7',   // warm off-white on the cards
  shadow:     'rgba(26, 22, 18, 0.06)',
  shadowMd:   'rgba(26, 22, 18, 0.10)',
  shadowLg:   'rgba(26, 22, 18, 0.18)',
  shadowDeep: 'rgba(26, 22, 18, 0.28)',
}

// Editorial font stack — serif for headings, refined sans for body
const FONT_SERIF = '"Cormorant Garamond", "Playfair Display", Georgia, "Times New Roman", serif'
const FONT_SANS  = '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: COLOR.bg,
    color: COLOR.text,
    fontFamily: FONT_SANS,
    display: 'flex',
    flexDirection: 'column',
    fontFeatureSettings: '"liga" 1, "kern" 1',
    WebkitFontSmoothing: 'antialiased',
    MozOsxFontSmoothing: 'grayscale',
  },

  // ── Header ──────────────────────────────────────────────────
  header: {
    background: COLOR.bg,
    borderBottom: `1px solid ${COLOR.borderSoft}`,
  },
  headerInner: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '28px 48px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
  },
  brandMark: {
    width: '40px',
    height: '40px',
    borderRadius: '6px',
    background: COLOR.text,
    color: COLOR.cardText,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px',
    fontWeight: 500,
    letterSpacing: '0.5px',
    fontFamily: FONT_SERIF,
  },
  brandTitle: {
    fontSize: '16px',
    fontWeight: 500,
    letterSpacing: '2px',
    color: COLOR.text,
    margin: 0,
    fontFamily: FONT_SANS,
  },
  brandSub: {
    fontSize: '11px',
    color: COLOR.textMuted,
    margin: '2px 0 0 0',
    letterSpacing: '0.5px',
    fontWeight: 400,
  },
  pocBadge: {
    padding: '6px 14px',
    border: `1px solid ${COLOR.text}`,
    borderRadius: '20px',
    fontSize: '10px',
    letterSpacing: '2px',
    fontWeight: 500,
    color: COLOR.text,
    background: 'transparent',
    textTransform: 'uppercase',
  },

  // ── Main ────────────────────────────────────────────────────
  main: {
    flex: 1,
    maxWidth: '1200px',
    width: '100%',
    margin: '0 auto',
    padding: '80px 48px 64px 48px',
    boxSizing: 'border-box',
    transition: 'filter 0.35s ease, opacity 0.35s ease',
  },
  mainBlurred: {
    filter: 'blur(8px)',
    opacity: 0.35,
    pointerEvents: 'none',
  },
  intro: {
    marginBottom: '64px',
    textAlign: 'center',
    maxWidth: '600px',
    margin: '0 auto 64px auto',
  },
  introTitle: {
    fontSize: '52px',
    fontWeight: 400,
    letterSpacing: '-1px',
    color: COLOR.text,
    margin: '0 0 16px 0',
    lineHeight: 1.1,
    fontFamily: FONT_SERIF,
    fontStyle: 'italic',
  },
  introText: {
    fontSize: '16px',
    color: COLOR.textSoft,
    margin: 0,
    lineHeight: 1.6,
    fontWeight: 400,
    letterSpacing: '0.1px',
  },

  // ── Card deck ───────────────────────────────────────────────
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '24px',
    maxWidth: '1100px',
    margin: '0 auto',
  },
  card: {
    background: COLOR.cardBg,
    border: 'none',
    borderRadius: '16px',
    padding: '40px 24px',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    minHeight: '280px',
    position: 'relative',
    overflow: 'hidden',
    transition: 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.35s ease, background 0.35s ease',
    boxShadow: `0 4px 12px ${COLOR.shadow}, 0 12px 32px ${COLOR.shadowMd}`,
    fontFamily: FONT_SANS,
    color: COLOR.cardText,
    outline: 'none',
  },
  cardHover: {
    transform: 'translateY(-8px) scale(1.015)',
    background: COLOR.cardBgHover,
    boxShadow: `0 8px 20px ${COLOR.shadowMd}, 0 28px 60px ${COLOR.shadowLg}`,
  },
  cardShine: {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0) 45%, rgba(255,255,255,0) 100%)',
    pointerEvents: 'none',
  },
  cardLabel: {
    fontSize: '24px',
    fontWeight: 400,
    color: COLOR.cardText,
    margin: 0,
    letterSpacing: '-0.5px',
    lineHeight: 1.2,
    position: 'relative',
    zIndex: 1,
    fontFamily: FONT_SERIF,
    fontStyle: 'italic',
  },

  // ── Footer ──────────────────────────────────────────────────
  footer: {
    padding: '32px 48px',
    textAlign: 'center',
    borderTop: `1px solid ${COLOR.borderSoft}`,
    background: COLOR.bg,
    transition: 'filter 0.35s ease, opacity 0.35s ease',
  },
  footerBlurred: {
    filter: 'blur(8px)',
    opacity: 0.35,
  },
  footerText: {
    fontSize: '12px',
    color: COLOR.textMuted,
    margin: 0,
    letterSpacing: '0.3px',
    fontWeight: 400,
  },

  // ── Modal ───────────────────────────────────────────────────
  modalBackdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(26, 22, 18, 0.4)',
    backdropFilter: 'blur(3px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '24px',
  },
  modal: {
    background: COLOR.surface,
    borderRadius: '20px',
    width: '100%',
    maxWidth: '600px',
    maxHeight: '88vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: `0 40px 120px ${COLOR.shadowDeep}, 0 0 0 1px ${COLOR.borderSoft}`,
    overflow: 'hidden',
  },
  modalHeader: {
    padding: '20px 20px 0 20px',
    position: 'relative',
  },
  modalCardPreview: {
    background: COLOR.cardBg,
    borderRadius: '14px',
    padding: '40px 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: `0 12px 32px ${COLOR.shadowMd}`,
    position: 'relative',
    overflow: 'hidden',
  },
  modalCardShine: {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 50%)',
    pointerEvents: 'none',
  },
  modalCardLabel: {
    fontSize: '28px',
    fontWeight: 400,
    color: COLOR.cardText,
    margin: 0,
    letterSpacing: '-0.5px',
    textAlign: 'center',
    fontFamily: FONT_SERIF,
    fontStyle: 'italic',
    position: 'relative',
    zIndex: 1,
  },
  modalClose: {
    position: 'absolute',
    top: '30px',
    right: '30px',
    background: 'rgba(255, 255, 255, 0.12)',
    border: '1px solid rgba(255, 255, 255, 0.25)',
    fontSize: '20px',
    color: COLOR.cardText,
    cursor: 'pointer',
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    lineHeight: 1,
    zIndex: 2,
    fontFamily: FONT_SANS,
  },
  modalDescription: {
    padding: '24px 32px 8px 32px',
    fontSize: '15px',
    color: COLOR.textSoft,
    margin: 0,
    lineHeight: 1.6,
    fontStyle: 'italic',
    fontFamily: FONT_SERIF,
    fontWeight: 400,
    letterSpacing: '0.2px',
  },
  modalBody: {
    padding: '16px 32px 32px 32px',
    overflowY: 'auto',
    flex: 1,
  },
  searchInput: {
    width: '100%',
    padding: '14px 18px',
    fontSize: '14px',
    border: `1px solid ${COLOR.border}`,
    borderRadius: '12px',
    background: COLOR.surfaceSoft,
    color: COLOR.text,
    outline: 'none',
    fontFamily: FONT_SANS,
    marginBottom: '16px',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s ease, background 0.2s ease',
    letterSpacing: '0.1px',
  },
  emptyState: {
    padding: '40px 20px',
    textAlign: 'center',
  },
  emptyText: {
    fontSize: '14px',
    color: COLOR.textSoft,
    margin: '0 0 8px 0',
    fontWeight: 500,
    letterSpacing: '0.1px',
  },
  emptyHint: {
    fontSize: '13px',
    color: COLOR.textMuted,
    margin: 0,
    fontStyle: 'italic',
    fontFamily: FONT_SERIF,
  },
  resultsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  resultRow: {
    background: COLOR.surface,
    border: `1px solid ${COLOR.borderSoft}`,
    borderRadius: '10px',
    padding: '14px 18px',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '4px',
    transition: 'background 0.15s ease, border-color 0.15s ease, transform 0.15s ease',
    fontFamily: FONT_SANS,
    textAlign: 'left',
    color: COLOR.text,
    width: '100%',
  },
  resultRowHover: {
    background: COLOR.surfaceSoft,
    borderColor: COLOR.text,
    transform: 'translateX(2px)',
  },
  resultRowLoading: {
    background: COLOR.bg,
    borderColor: COLOR.textMuted,
    cursor: 'wait',
    opacity: 0.6,
  },
  resultRowDisabled: {
    opacity: 0.4,
    cursor: 'not-allowed',
  },
  resultMain: {
    width: '100%',
  },
  resultName: {
    fontSize: '15px',
    fontWeight: 500,
    color: COLOR.text,
    margin: 0,
    letterSpacing: '0.1px',
  },
  resultMeta: {
    fontSize: '12px',
    color: COLOR.textMuted,
    margin: '3px 0 0 0',
    letterSpacing: '0.2px',
  },
  resultEmail: {
    fontSize: '11px',
    color: COLOR.textFaint,
    margin: 0,
    fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
    letterSpacing: '0.2px',
  },
}
