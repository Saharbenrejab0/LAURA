'use client'
/**
 * PastCyclesGrid — the Past Cycles archive.
 *
 * Closed cycles as folder cards: name, dates, weight, verdict split. Clicking
 * one opens that cycle's review deck read-only.
 */
import { useEffect, useState } from 'react'
import type { Cycle } from '@/lib/cycles-api'
import { fetchCycles, downloadCycleExcel, deleteTestCycle } from '@/lib/cycles-api'

const GOLD = '#B08D2F'

function formatBudget(n: number): string {
  const v = n || 0
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace('.', ',')} M€`
  if (v >= 1_000) return `${Math.round(v / 1_000)} K€`
  return `${Math.round(v)} €`
}

function formatRange(start: string | null, end: string | null): string {
  if (!start || !end) return '—'
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
  const s = new Date(start).toLocaleDateString('en-GB', opts)
  const e = new Date(end).toLocaleDateString('en-GB', { ...opts, year: 'numeric' })
  return `${s} – ${e}`
}

function formatDay(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

interface Props {
  onOpen: (cycle: Cycle) => void
}

export default function PastCyclesGrid({ onOpen }: Props) {
  const [cycles, setCycles] = useState<Cycle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    fetchCycles({ status: 'closed' })
      .then(data => { if (alive) { setCycles(data); setLoading(false) } })
      .catch(err => {
        if (!alive) return
        setError(err?.response?.data?.detail || 'Could not load past cycles.')
        setLoading(false)
      })
    return () => { alive = false }
  }, [])

  if (loading) {
    return <Msg>Loading past cycles…</Msg>
  }
  if (error) {
    return <Msg tone="error">{error}</Msg>
  }
  if (!cycles.length) {
    return (
      <Msg>
        No closed cycles yet. When an admin closes the current cycle it is
        archived here, with its deck and Excel summary.
      </Msg>
    )
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(288px, 1fr))',
      gap: 16,
      padding: '4px 0 28px',
    }}>
      {cycles.map(c => (
        <FolderCard key={c.id} cycle={c} onOpen={() => onOpen(c)} />
      ))}
    </div>
  )
}

function FolderCard({ cycle, onOpen }: { cycle: Cycle; onOpen: () => void }) {
  const [hover, setHover] = useState(false)
  const [busy, setBusy] = useState(false)

  const download = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setBusy(true)
    try {
      await downloadCycleExcel(cycle.id, `${cycle.name}.xlsx`)
    } catch { /* the button simply re-enables */ }
    setBusy(false)
  }

  return (
    <div
      onClick={onOpen}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() } }}
      role="button"
      tabIndex={0}
      style={{
        border: '1px solid var(--border, #E7E2D8)',
        background: 'var(--surface, #fff)',
        borderRadius: 14,
        padding: '16px 18px 14px',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        boxShadow: hover
          ? '0 12px 30px rgba(26,22,18,.10)'
          : '0 1px 2px rgba(26,22,18,.04)',
        transform: hover ? 'translateY(-2px)' : 'none',
        transition: 'box-shadow 180ms, transform 180ms, border-color 180ms',
        borderColor: hover ? GOLD : 'var(--border, #E7E2D8)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }} aria-hidden>📁</span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            fontSize: 14, fontWeight: 600, color: 'var(--text-primary, #211E1A)',
            lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          }}>
            {cycle.name}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-tertiary, #8B857A)', marginTop: 2 }}>
            {formatRange(cycle.startDate, cycle.endDate)}
          </div>
        </div>
        {cycle.cycleType === 'emergency' && (
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase',
            color: '#8A2E27', background: '#FBEDEB', border: '1px solid #EBCFCA',
            borderRadius: 99, padding: '2px 7px', flexShrink: 0, whiteSpace: 'nowrap',
          }}>
            Emergency
          </span>
        )}
      </div>

      {/* Weight */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{
          fontSize: 19, fontWeight: 700, letterSpacing: '-.02em',
          color: 'var(--text-primary, #211E1A)', fontVariantNumeric: 'tabular-nums',
        }}>
          {formatBudget(cycle.totalBudget)}
        </span>
        <span style={{ fontSize: 11.5, color: 'var(--text-secondary, #5C574F)' }}>
          {cycle.totalLoas} LOA{cycle.totalLoas === 1 ? '' : 's'}
        </span>
      </div>

      {/* Verdicts */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11.5 }}>
        <span style={{ color: '#3F7D5B', display: 'flex', alignItems: 'center', gap: 4 }}>
          ✓ {cycle.approved} approved
        </span>
        <span style={{ color: '#A5453B', display: 'flex', alignItems: 'center', gap: 4 }}>
          ✗ {cycle.rejected} rejected
        </span>
      </div>

      {/* Footer */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 8, borderTop: '1px solid var(--border, #E7E2D8)', paddingTop: 9, marginTop: 2,
      }}>
        <span style={{ fontSize: 10.5, color: 'var(--text-tertiary, #8B857A)' }}>
          Closed {formatDay(cycle.closedAt)}
          {cycle.closedBy ? ` · ${cycle.closedBy.split('@')[0]}` : ''}
        </span>
        <button
          onClick={download}
          disabled={busy}
          title="Download the Excel summary"
          style={{
            fontSize: 10.5, fontWeight: 600, fontFamily: 'inherit',
            color: busy ? 'var(--text-tertiary, #8B857A)' : GOLD,
            background: 'transparent', border: 'none', padding: 0,
            cursor: busy ? 'default' : 'pointer', whiteSpace: 'nowrap',
          }}
        >
          {busy ? 'Preparing…' : 'Excel ↓'}
        </button>
      </div>
    </div>
  )
}

function Msg({ children, tone }: { children: React.ReactNode; tone?: 'error' }) {
  return (
    <div style={{
      padding: '48px 24px', textAlign: 'center', maxWidth: 460, margin: '0 auto',
      fontSize: 13, lineHeight: 1.6,
      color: tone === 'error' ? '#A5453B' : 'var(--text-secondary, #5C574F)',
    }}>
      {children}
    </div>
  )
}
