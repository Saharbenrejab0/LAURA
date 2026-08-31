'use client'
/**
 * NightLensPage — Night Lens welcome screen for CMO and CFO.
 *
 * Design source: docs/LAURA Welcome - Night Lens.html
 *
 * Replaces the old CycleFolderPage (flat tan folder). Every copy string,
 * colour, and layout detail is taken verbatim from the design. Data wiring
 * and behaviour follow the spec in the implementation document.
 */
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { Cycle } from '@/lib/cycles-api'
import { fetchCycles, deleteTestCycle } from '@/lib/cycles-api'
import { formatBudget } from '@/lib/euro'
import TestCycleBanner from '@/components/cycles/TestCycleBanner'

// ── Design tokens — now CSS custom properties so both themes are supported.
// Dark values match Night Lens exactly (the reference); light values come from
// the cream/warm palette defined in redesign.css :root.
const D = {
  pageBg:     'var(--canvas)',
  headerBg:   'var(--surface-bar)',
  border:     'var(--border)',
  borderFaint:'var(--border-subtle)',
  gold:       'var(--accent)',
  goldDim:    'var(--accent-dim)',
  textHi:     'var(--text-primary)',
  textMid:    'var(--text-secondary)',
  textLow:    'var(--text-tertiary)',
  textFaint:  'var(--text-faint)',
  textDimmer: 'var(--text-dimmer)',
  inkBg:      'var(--surface-sunken)',
  selBg:      'var(--surface-raised)',
  rowBg:      'var(--surface)',
  tileBg:     'var(--surface-tile)',
  tileHover:  'var(--surface-tile-hover)',
  openFg:     'var(--status-open-fg)',
  openBg:     'var(--status-open-bg)',
  openBd:     'var(--status-open-border)',
  mono:       'var(--font-mono)',
  sans:       'var(--font-sans)',
}

// Folder skin colours per state
type FolderSkin = { tab: string; back: string; front: string }

function folderSkin(isOpen: boolean, isSelected: boolean): FolderSkin {
  if (isOpen) return { tab: '#C08A2E', back: '#D79A38', front: 'linear-gradient(152deg,#F6D48A 0%,#E1AE4F 44%,#B8842A 100%)' }
  if (isSelected) return { tab: '#2A343D', back: '#39434D', front: 'linear-gradient(152deg,#4E5964 0%,#3A444E 100%)' }
  return { tab: '#1E242A', back: '#2A3138', front: 'linear-gradient(152deg,#3E464F 0%,#343C44 100%)' }
}

// ── Small folder SVG used in tile and inspector ───────────────────────────────
function FolderIcon({ skin, width = 98, height = 76 }: { skin: FolderSkin; width?: number; height?: number }) {
  const tabH = Math.round(height * 0.16)
  const tabW = Math.round(width * 0.43)
  const frontOff = Math.round(width * 0.06)
  const frontTop  = Math.round(height * 0.34)
  return (
    <div style={{ position: 'relative', width, height, flexShrink: 0 }}>
      {/* Tab */}
      <span style={{ position: 'absolute', left: 0, top: 0, width: tabW, height: tabH, background: skin.tab, borderRadius: '4px 4px 0 0' }} />
      {/* Back body */}
      <span style={{ position: 'absolute', left: 0, top: tabH - 2, right: 0, bottom: 0, background: skin.back, borderRadius: '2px 7px 7px 7px' }} />
      {/* Front card */}
      <span style={{ position: 'absolute', left: frontOff, top: frontTop, right: 0, bottom: 0, background: skin.front, borderRadius: '6px 7px 7px 7px', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.13),0 8px 14px -8px rgba(0,0,0,.6)' }} />
      {/* Tab sheen */}
      <span style={{ position: 'absolute', left: 0, top: 0, width: tabW, height: tabH, borderRadius: '4px 4px 0 0', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.10)' }} />
    </div>
  )
}

// Tiny inline folder for list rows
function MiniFolder({ skin }: { skin: FolderSkin }) {
  return (
    <div style={{ position: 'relative', width: 26, height: 21, flexShrink: 0 }}>
      <span style={{ position: 'absolute', left: 0, top: 0, width: 12, height: 4, background: skin.tab, borderRadius: '2px 2px 0 0' }} />
      <span style={{ position: 'absolute', left: 0, top: 3, right: 0, bottom: 0, background: skin.back, borderRadius: '1px 3px 3px 3px' }} />
      <span style={{ position: 'absolute', left: 2, top: 8, right: 0, bottom: 0, background: skin.front, borderRadius: '2px 3px 3px 3px' }} />
    </div>
  )
}

// ── Days-remaining copy — handles open, closes-today, and overdue ────────────
function openCycleMeta(c: Cycle): string {
  // Use server value (now possibly negative) when present; fall back to
  // client calculation only when null (e.g. open cycle with no end_date).
  const days = c.daysRemaining !== null && c.daysRemaining !== undefined
    ? c.daysRemaining
    : (c.endDate ? Math.round((new Date(c.endDate).getTime() - Date.now()) / 86400000) : null)
  if (days === null) return '● open — no end date'
  if (days > 1)  return `● closes in ${days} days`
  if (days === 1) return '● closes in 1 day'
  if (days === 0) return '● closes today'
  const abs = Math.abs(days)
  return `● overdue — ${abs} day${abs === 1 ? '' : 's'} past end date`
}

// ── Human date formatting ─────────────────────────────────────────────────────
const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function humanDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return `${d.getUTCDate()} ${MONTH_ABBR[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

function humanDateRange(start: string | null | undefined, end: string | null | undefined): string {
  if (!start || !end) return '—'
  const s = new Date(start), e = new Date(end)
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return '—'
  // Same year: "31 Jul – 30 Aug 2026"
  if (s.getUTCFullYear() === e.getUTCFullYear()) {
    return `${s.getUTCDate()} ${MONTH_ABBR[s.getUTCMonth()]} – ${e.getUTCDate()} ${MONTH_ABBR[e.getUTCMonth()]} ${e.getUTCFullYear()}`
  }
  return `${humanDate(start)} – ${humanDate(end)}`
}

function humanDateRangeShort(start: string | null | undefined, end: string | null | undefined): string {
  if (!start || !end) return '—'
  const s = new Date(start), e = new Date(end)
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return '—'
  const sy = String(s.getUTCFullYear()).slice(2)
  const ey = String(e.getUTCFullYear()).slice(2)
  if (sy === ey) {
    return `${s.getUTCDate()} ${MONTH_ABBR[s.getUTCMonth()]} – ${e.getUTCDate()} ${MONTH_ABBR[e.getUTCMonth()]} ${ey}`
  }
  return `${s.getUTCDate()} ${MONTH_ABBR[s.getUTCMonth()]} ${sy} – ${e.getUTCDate()} ${MONTH_ABBR[e.getUTCMonth()]} ${ey}`
}

// ── Group cycles by year for the grid ────────────────────────────────────────
interface CycleGroup { label: string; headFg: string; count: string; cycles: Cycle[] }

function groupCycles(cycles: Cycle[], sort: 'newest' | 'budget'): CycleGroup[] {
  const open   = cycles.filter(c => c.isActive)
  const closed = cycles.filter(c => !c.isActive)

  const sorted = sort === 'budget'
    ? [...closed].sort((a, b) => b.totalBudget - a.totalBudget)
    : closed

  if (sort === 'budget') {
    return [
      { label: 'Open now', headFg: D.gold, count: String(open.length), cycles: open },
      { label: 'Closed — largest budget first', headFg: D.textHi, count: `${sorted.length} folders`, cycles: sorted },
    ].filter(g => g.cycles.length > 0)
  }

  // Group by year (newest first)
  const byYear = new Map<number, Cycle[]>()
  for (const c of sorted) {
    const yr = c.startDate ? new Date(c.startDate).getUTCFullYear() : 0
    if (!byYear.has(yr)) byYear.set(yr, [])
    byYear.get(yr)!.push(c)
  }
  const yearGroups: CycleGroup[] = [...byYear.entries()]
    .sort(([a], [b]) => b - a)
    .map(([yr, cs]) => ({
      label: String(yr),
      headFg: D.textHi,
      count: `${cs.length} closed`,
      cycles: cs,
    }))

  return [
    ...(open.length ? [{ label: 'Open now', headFg: D.gold, count: String(open.length), cycles: open }] : []),
    ...yearGroups,
  ]
}

// ── User display helpers ──────────────────────────────────────────────────────
function initials(name: string | undefined | null): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function firstName(name: string | undefined | null): string {
  if (!name) return ''
  return name.trim().split(/\s+/)[0]
}

// ── Component ─────────────────────────────────────────────────────────────────
export interface NightLensPageProps {
  role: 'cmo' | 'cfo'
  userName: string | null | undefined
  isAdmin: boolean
  onEnterCycle: (cycleId: string, cycleName: string, isOpen: boolean) => void
}

export default function NightLensPage({ role, userName, isAdmin, onEnterCycle }: NightLensPageProps) {
  const router = useRouter()
  const [cycles, setCycles]     = useState<Cycle[]>([])
  const [loading, setLoading]   = useState(true)
  const [view,    setView]       = useState<'grid' | 'list'>('grid')
  const [sort,    setSort]       = useState<'newest' | 'budget'>('newest')
  const [filter,  setFilter]     = useState('')
  const [selId,   setSelId]      = useState<string | null>(null)

  const isCMO = role === 'cmo'

  const load = useCallback(() => {
    setLoading(true)
    fetchCycles()
      .then(data => {
        setCycles(data)
        // Pre-select the open cycle if present
        const open = data.find(c => c.isActive)
        if (open) setSelId(open.id)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  // Filter by search term
  const visible = filter.trim()
    ? cycles.filter(c =>
        c.name.toLowerCase().includes(filter.toLowerCase()) ||
        (c.code || '').toLowerCase().includes(filter.toLowerCase()) ||
        humanDateRange(c.startDate, c.endDate).toLowerCase().includes(filter.toLowerCase())
      )
    : cycles

  const groups = groupCycles(visible, sort)
  const sel    = visible.find(c => c.id === selId) || null
  const openCycle = cycles.find(c => c.isActive) || null

  const userFirstName = firstName(userName)

  const greeting = userFirstName
    ? `Good morning, ${userFirstName}`
    : (isCMO ? 'Good morning' : 'Good morning')

  const openCount   = cycles.filter(c => c.isActive).length
  const closedCount = cycles.filter(c => !c.isActive).length
  const openLabel   = openCount === 1 ? 'One cycle open' : `${openCount} cycles open`
  const subline = openCount > 0
    ? `${openLabel} · ${closedCount} closed folder${closedCount === 1 ? '' : 's'} kept read-only`
    : `No open cycle · ${closedCount} closed folder${closedCount === 1 ? '' : 's'} in archive`

  const totalFolders = cycles.length

  // Inspector stats for selected cycle
  const selSkin = sel ? folderSkin(sel.isActive, true) : folderSkin(false, true)

  function selCta(): string {
    if (!sel) return ''
    if (sel.isActive) return isCMO ? 'Open review deck →' : 'Open budget sheet →'
    return isCMO ? 'Open read-only deck →' : 'Open read-only sheet →'
  }

  function selFootnote(): string {
    if (!sel) return ''
    if (sel.isActive) {
      return isCMO ? 'Fullscreen slideshow · one slide per LOA' : 'Fullscreen sheet · 21 rows, 15 columns'
    }
    return 'Read-only. Decisions, comments and rejection reasons stay as recorded.'
  }

  const selStats: { k: string; v: string; fg: string }[] = sel ? [
    { k: 'LOAs in folder',   v: String(sel.totalLoas),                 fg: D.textHi },
    { k: 'Budget requested', v: formatBudget(sel.totalBudget),         fg: D.textHi },
    { k: 'Approved',         v: sel.isActive ? '—' : String(sel.approved), fg: sel.isActive ? D.textFaint : '#6FD39B' },
    { k: 'Rejected',         v: sel.isActive ? '—' : String(sel.rejected), fg: sel.isActive ? D.textFaint : '#E88A80' },
    { k: 'Cycle reference',  v: sel.code || '—',                       fg: D.gold },
  ] : []

  return (
    <div style={{
      background: D.pageBg,
      display: 'flex', flexDirection: 'column',
      // Fills what TopNav leaves of the viewport. The old value was
      // `position:fixed; inset:0; zIndex:1000`, which parked this page ON TOP of
      // the app chrome — that is why the folder page used to have to draw its
      // own header instead of using the shared one.
      minHeight: 'calc(100vh - 56px)',
      fontFamily: D.sans, color: D.textHi,
      overflow: 'hidden',
    }}>

      {/* ── Page toolbar ────────────────────────────────────────────────────
          Only the controls that belong to THIS page. Logo menu, wordmark,
          breadcrumb, theme and user chip all come from the shared TopNav now,
          so the ⊙⊙ menu that used to live here is no longer duplicated. */}
      <div style={{
        height: 48, flexShrink: 0,
        background: D.headerBg, borderBottom: `1px solid ${D.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
        gap: 14, padding: '0 20px',
      }}>
        {/* Filter input */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'var(--surface-tile)', border: `1px solid ${D.border}`,
          borderRadius: 8, padding: '7px 11px', width: 210,
        }}>
          <span style={{ fontSize: 11.5, color: D.textFaint }}>⌕</span>
          <input
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Filter folders"
            aria-label="Filter folders"
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              fontSize: 12, color: D.textHi, fontFamily: D.sans,
            }}
          />
          {filter && (
            <button onClick={() => setFilter('')} aria-label="Clear filter" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: D.textFaint, fontSize: 13, lineHeight: 1 }}>×</button>
          )}
        </div>

        {/* Folders / List — a layout choice for this page, not a role view toggle */}
        <div style={{ display: 'flex', gap: 2, background: 'var(--border-subtle)', borderRadius: 8, padding: 2 }}>
          {(['grid', 'list'] as const).map((k) => {
            const on = view === k
            const label = k === 'grid' ? '▦  Folders' : '☰  List'
            return (
              <button key={k} onClick={() => setView(k)} aria-pressed={on} style={{
                fontSize: 11.5, fontWeight: on ? 600 : 500,
                color: on ? D.textHi : D.textLow,
                background: on ? 'var(--border-strong)' : 'transparent',
                borderRadius: 6, padding: '6px 12px',
                border: 'none', cursor: 'pointer', fontFamily: D.sans,
              }}>
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Body: main area + inspector ───────────────────────────────────── */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'grid', gridTemplateColumns: '1fr 336px', gridTemplateRows: '1fr' }}>

        {/* ── Left: main content ──────────────────────────────────────────── */}
        <div style={{ minWidth: 0, position: 'relative', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Lens backdrop glow */}
          <span style={{
            position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none',
            background: `radial-gradient(120% 85% at 100% -12%,rgba(224,177,95,.07),rgba(224,177,95,0) 56%),
                         repeating-radial-gradient(circle at 86% 118%,rgba(224,177,95,0) 0 46px,rgba(224,177,95,.07) 46px 47px)`,
          }} />

          {/* ── Hero row ──────────────────────────────────────────────────── */}
          <div style={{
            position: 'relative', zIndex: 1, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 30,
            padding: '20px 32px 18px',
            background: 'linear-gradient(180deg,rgba(224,177,95,.07) 0%,rgba(224,177,95,0) 100%)',
            borderBottom: `1px solid ${D.border}`,
          }}>
            {/* Greeting */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 17, minWidth: 0 }}>
              {/* Brand logo placeholder (65×52 dark square) */}
              <span style={{
                width: 66, height: 52, flexShrink: 0,
                borderRadius: 12, background: '#1D1D1B', border: `1px solid var(--border-strong)`,
                overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 3px 12px rgba(0,0,0,.5)',
              }}>
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.1em', color: D.textFaint }}>
                  EL
                </span>
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
                <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: D.textMid }}>
                  Essilor · EMEA Professional Solutions
                </span>
                <h2 style={{ font: `600 25px/1.15 ${D.sans}`, margin: 0, letterSpacing: '-.02em' }}>
                  {greeting}
                </h2>
                <span style={{ fontSize: 12.5, color: D.textLow }}>{subline}</span>
              </div>
            </div>

            {/* Brands in scope (open cycle only) */}
            {openCycle && (openCycle.brandsInScope ?? []).length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end', flexShrink: 0 }}>
                <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.13em', textTransform: 'uppercase', color: D.textLow }}>
                  Brands in the open cycle
                </span>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'nowrap' }}>
                  {(openCycle.brandsInScope ?? []).map(b => (
                    <span key={b} style={{
                      fontSize: 11, fontWeight: 500, color: D.textMid,
                      background: 'var(--surface-tile)', border: `1px solid var(--border-strong)`,
                      borderRadius: 6, padding: '4px 9px', whiteSpace: 'nowrap',
                    }}>
                      {b}
                    </span>
                  ))}
                </div>
                <span style={{ fontSize: 10.5, color: D.textLow }}>
                  Frames · Lenses · Photochromics — 7 clusters, one calendar
                </span>
              </div>
            )}
          </div>

          {/* TEST CYCLE banner — inside main area, above the cycle list */}
          {openCycle?.isTest && (
            <div style={{ position: 'relative', zIndex: 1, flexShrink: 0, padding: '12px 32px 0' }}>
              <TestCycleBanner
                cycle={{ id: openCycle.id, name: openCycle.name, totalLoas: openCycle.totalLoas }}
                canDelete={isAdmin}
                onDeleted={() => { load() }}
              />
            </div>
          )}

          {/* ── Toolbar: title + sort ────────────────────────────────────── */}
          <div style={{
            position: 'relative', zIndex: 1, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 32px 12px',
          }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: D.textHi }}>All cycles</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: D.textLow }}>
                Sort
              </span>
              {(['newest', 'budget'] as const).map(k => {
                const on = sort === k
                const label = k === 'newest' ? 'Newest' : 'Budget'
                return (
                  <button key={k} onClick={() => setSort(k)} style={{
                    fontSize: 11.5, fontWeight: on ? 600 : 500,
                    color: on ? D.textHi : D.textLow,
                    background: on ? 'var(--border-strong)' : 'transparent',
                    border: on ? `1px solid var(--border-strong)` : '1px solid transparent',
                    borderRadius: 7, padding: '6px 11px',
                    cursor: 'pointer', fontFamily: D.sans,
                  }}>
                    {label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── Grid view ───────────────────────────────────────────────── */}
          {view === 'grid' && (
            <div style={{
              position: 'relative', zIndex: 1, flex: 1, minHeight: 0,
              overflowY: 'auto', padding: '0 32px 20px',
              display: 'flex', flexDirection: 'column', gap: 22,
            }}>
              {loading ? (
                <div style={{ padding: '48px 0', color: D.textFaint, fontSize: 13, textAlign: 'center' }}>
                  Loading…
                </div>
              ) : groups.length === 0 ? (
                <div style={{ padding: '48px 0', color: D.textFaint, fontSize: 13, textAlign: 'center' }}>
                  No cycles match this filter.
                </div>
              ) : groups.map(g => (
                <div key={g.label} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {/* Group header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: g.headFg }}>
                      {g.label}
                    </span>
                    <span style={{ flex: 1, height: 1, background: D.border }} />
                    <span style={{ fontFamily: D.mono, fontSize: 10, color: D.textFaint }}>{g.count}</span>
                  </div>
                  {/* Tiles */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {g.cycles.map(c => {
                      const isSel = selId === c.id
                      const skin  = folderSkin(c.isActive, isSel)
                      const meta     = c.isActive ? openCycleMeta(c) : `${c.totalLoas} LOAs`
                      const isOverdue = c.isActive && (c.daysRemaining !== null && c.daysRemaining !== undefined ? c.daysRemaining : 1) < 0
                      const title = c.code || c.name
                      return (
                        <button
                          key={c.id}
                          onClick={() => setSelId(c.id)}
                          title={c.name}
                          style={{
                            width: 152, padding: '15px 10px 13px',
                            borderRadius: 12,
                            background: isSel ? D.selBg : 'transparent',
                            border: `1px solid ${isSel ? D.gold : 'transparent'}`,
                            boxShadow: isSel ? '0 6px 18px rgba(0,0,0,.45)' : 'none',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 13,
                            cursor: 'pointer', userSelect: 'none',
                            transition: 'background .15s ease,border-color .15s ease',
                            fontFamily: D.sans,
                          }}
                          onMouseEnter={e => {
                            if (!isSel) (e.currentTarget as HTMLButtonElement).style.background = D.tileHover
                          }}
                          onMouseLeave={e => {
                            if (!isSel) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                          }}
                        >
                          <FolderIcon skin={skin} width={98} height={76} />
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, width: '100%' }}>
                            <span style={{
                              fontSize: 12, fontWeight: isSel ? 600 : 500,
                              color: isSel ? D.textHi : D.textMid,
                              borderRadius: 6, padding: '4px 9px',
                              textAlign: 'center', lineHeight: 1.3, letterSpacing: '-.005em',
                            }}>
                              {title}
                            </span>
                            <span style={{ fontFamily: D.mono, fontSize: 9.5, letterSpacing: '.01em',
                              color: isOverdue ? '#E88A80' : c.isActive ? D.gold : D.textFaint }}>
                              {meta}
                            </span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── List view ───────────────────────────────────────────────── */}
          {view === 'list' && (
            <div style={{
              position: 'relative', zIndex: 1, flex: 1, minHeight: 0,
              overflowY: 'auto', padding: '0 32px 20px',
              display: 'flex', flexDirection: 'column',
            }}>
              {/* Column headers */}
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 108px 84px 108px 132px',
                gap: 14, padding: '0 14px 9px', borderBottom: `1px solid ${D.border}`,
                flexShrink: 0,
              }}>
                {['Cycle', 'Status', 'LOAs', 'Requested', 'Window'].map((h, i) => (
                  <span key={h} style={{
                    fontSize: 9.5, fontWeight: 700, letterSpacing: '.13em',
                    textTransform: 'uppercase', color: D.textLow,
                    textAlign: i >= 2 ? 'right' : 'left',
                  }}>
                    {h}
                  </span>
                ))}
              </div>
              {/* Rows */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {(sort === 'budget'
                  ? [...cycles.filter(c => c.isActive), ...cycles.filter(c => !c.isActive).sort((a, b) => b.totalBudget - a.totalBudget)]
                  : visible
                ).map(c => {
                  const isSel = selId === c.id
                  const skin  = folderSkin(c.isActive, isSel)
                  return (
                    <button
                      key={c.id}
                      onClick={() => setSelId(c.id)}
                      title={c.name}
                      style={{
                        display: 'grid', gridTemplateColumns: '1fr 108px 84px 108px 132px',
                        gap: 14, alignItems: 'center', padding: '11px 14px',
                        borderRadius: 9,
                        background: isSel ? D.selBg : 'transparent',
                        border: `1px solid ${isSel ? D.gold : 'transparent'}`,
                        cursor: 'pointer', userSelect: 'none', fontFamily: D.sans,
                        textAlign: 'left',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
                        <MiniFolder skin={skin} />
                        <span style={{
                          fontSize: 12.5, fontWeight: isSel ? 600 : 500,
                          color: isSel ? D.textHi : D.textMid,
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>
                          {c.name}
                        </span>
                      </div>
                      <span style={{
                        fontSize: 10, fontWeight: 700, letterSpacing: '.1em',
                        color: c.isActive ? D.openFg : D.textLow,
                        background: c.isActive ? D.openBg : D.rowBg,
                        border: `1px solid ${c.isActive ? D.openBd : D.border}`,
                        borderRadius: 99, padding: '3px 9px', justifySelf: 'start',
                      }}>
                        {c.isActive ? 'OPEN' : 'CLOSED'}
                      </span>
                      <span style={{ fontFamily: D.mono, fontSize: 11.5, textAlign: 'right', color: D.textMid }}>
                        {c.totalLoas}
                      </span>
                      <span style={{ fontFamily: D.mono, fontSize: 11.5, textAlign: 'right', color: D.textMid }}>
                        {formatBudget(c.totalBudget)}
                      </span>
                      <span style={{ fontFamily: D.mono, fontSize: 10.5, textAlign: 'right', color: D.textLow }}>
                        {humanDateRangeShort(c.startDate, c.endDate)}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Status bar ──────────────────────────────────────────────── */}
          <div style={{
            position: 'relative', zIndex: 1, flexShrink: 0,
            height: 38, borderTop: `1px solid ${D.border}`,
            background: 'rgba(16,19,22,.86)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0 32px',
          }}>
            <span style={{ fontSize: 11, color: D.textLow }}>
              {totalFolders} folder{totalFolders === 1 ? '' : 's'} — {cycles.filter(c => c.isActive).length} open, {closedCount} closed
            </span>
            <span style={{ fontFamily: D.mono, fontSize: 10, color: D.textFaint, letterSpacing: '.02em' }}>
              {sel ? `Selected · ${sel.code || sel.name}` : '↑↓ move · ↵ open · ⌘F filter'}
            </span>
          </div>
        </div>

        {/* ── Right: inspector ───────────────────────────────────────────── */}
        <aside style={{
          background: D.headerBg, borderLeft: `1px solid ${D.border}`,
          display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden',
        }}>
          <div style={{
            height: 44, flexShrink: 0,
            borderBottom: `1px solid ${D.borderFaint}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0 20px',
          }}>
            <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: D.textHi }}>
              Inspector
            </span>
            <span style={{ fontFamily: D.mono, fontSize: 9.5, color: D.textFaint }}>
              {sel ? sel.code || '—' : '—'}
            </span>
          </div>

          {sel ? (
            /* Selection present */
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '22px 20px 20px', gap: 18, overflowY: 'auto' }}>
              {/* Folder + status + name + date */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                <FolderIcon skin={selSkin} width={66} height={52} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
                  {(() => {
                    const overdue = sel.isActive && (sel.daysRemaining !== null && sel.daysRemaining !== undefined ? sel.daysRemaining : 1) < 0
                    return (
                      <span style={{
                        fontSize: 10, fontWeight: 700, letterSpacing: '.1em',
                        color: overdue ? '#E88A80' : sel.isActive ? D.openFg : D.textLow,
                        background: overdue ? 'rgba(232,138,128,.12)' : sel.isActive ? D.openBg : D.rowBg,
                        border: `1px solid ${overdue ? 'rgba(232,138,128,.35)' : sel.isActive ? D.openBd : D.border}`,
                        borderRadius: 99, padding: '3px 9px', alignSelf: 'flex-start',
                      }}>
                        {overdue ? '⚠ OVERDUE' : sel.isActive ? '● OPEN' : 'CLOSED'}
                      </span>
                    )
                  })()}
                  <span style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.32, letterSpacing: '-.012em' }}>
                    {sel.name}
                  </span>
                  <span style={{ fontFamily: D.mono, fontSize: 10.5, color: D.gold }}>
                    {humanDateRange(sel.startDate, sel.endDate)}
                  </span>
                </div>
              </div>

              {/* Stats */}
              <div style={{ display: 'flex', flexDirection: 'column', borderTop: `1px solid ${D.borderFaint}` }}>
                {selStats.map(st => (
                  <div key={st.k} style={{
                    display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12,
                    padding: '10px 0', borderBottom: `1px solid var(--surface)`,
                  }}>
                    <span style={{ fontSize: 11.5, color: D.textLow }}>{st.k}</span>
                    <span style={{ fontFamily: D.mono, fontSize: 12, fontWeight: 500, color: st.fg, textAlign: 'right' }}>
                      {st.v}
                    </span>
                  </div>
                ))}
              </div>

              {/* Your progress (open cycle only) */}
              {sel.isActive && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: D.textLow }}>
                      Your progress
                    </span>
                    <span style={{ fontFamily: D.mono, fontSize: 10.5, color: D.textLow }}>
                      {sel.reviewedByCurrentUser ?? 0} / {sel.totalLoas} reviewed
                    </span>
                  </div>
                  <div style={{ height: 4, background: 'var(--border-subtle)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${sel.totalLoas > 0 ? Math.max(2, Math.round(((sel.reviewedByCurrentUser ?? 0) / sel.totalLoas) * 100)) : 2}%`,
                      background: D.gold, borderRadius: 99,
                    }} />
                  </div>
                </div>
              )}

              {/* Clusters in scope — fills the space between progress and CTAs */}
              {(sel.clustersInScope ?? []).length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: D.textLow }}>
                    Clusters in scope
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {(sel.clustersInScope ?? []).map(cl => (
                      <span key={cl} style={{ fontSize: 11, color: D.textLow, background: 'var(--surface)', border: `1px solid ${D.border}`, borderRadius: 6, padding: '4px 9px' }}>
                        {cl}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* CTAs */}
              <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 9 }}>
                <button
                  onClick={() => onEnterCycle(sel.id, sel.name, sel.isActive)}
                  style={{
                    fontSize: 13, fontWeight: 600,
                    color: sel.isActive ? D.inkBg : D.gold,
                    background: sel.isActive ? D.gold : 'var(--surface-tile)',
                    border: `1px solid ${sel.isActive ? D.gold : 'var(--border-strong)'}`,
                    boxShadow: sel.isActive ? '0 2px 10px rgba(0,0,0,.5)' : 'none',
                    borderRadius: 9, padding: '12px 16px',
                    textAlign: 'center', cursor: 'pointer', fontFamily: D.sans,
                  }}
                >
                  {selCta()}
                </button>

                <button
                  style={{
                    fontSize: 12, fontWeight: 500,
                    color: D.textMid,
                    background: 'var(--surface-tile)', border: `1px solid var(--border-strong)`,
                    borderRadius: 9, padding: '10px 16px',
                    textAlign: 'center', cursor: 'pointer', fontFamily: D.sans,
                  }}
                  onClick={() => {
                    // TODO: wire up download/export actions
                  }}
                >
                  {sel.isActive ? 'Download LOA pack (PDF)' : 'Export decisions (XLSX)'}
                </button>

                <span style={{ fontSize: 10.5, color: D.textFaint, textAlign: 'center', lineHeight: 1.5 }}>
                  {selFootnote()}
                </span>
              </div>
            </div>
          ) : (
            /* No selection */
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 30 }}>
              <div style={{ position: 'relative', width: 74, height: 58, opacity: .35 }}>
                <span style={{ position: 'absolute', left: 0, top: 0, width: 32, height: 9, background: 'var(--border-strong)', borderRadius: '3px 3px 0 0' }} />
                <span style={{ position: 'absolute', left: 0, top: 8, right: 0, bottom: 0, background: 'var(--surface-tile)', borderRadius: '2px 6px 6px 6px' }} />
                <span style={{ position: 'absolute', left: 5, top: 20, right: 0, bottom: 0, background: 'var(--surface-raised)', borderRadius: '5px 6px 6px 6px' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, alignItems: 'center' }}>
                <span style={{ fontSize: 13.5, fontWeight: 600 }}>Nothing selected</span>
                <span style={{ fontSize: 11.5, color: D.textLow, textAlign: 'center', lineHeight: 1.6, maxWidth: 210 }}>
                  Click a folder to read its cycle here — LOA count, budget requested, what was decided.
                </span>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
