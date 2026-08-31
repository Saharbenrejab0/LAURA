'use client'
/**
 * ReviewTopBar — LOA identity on the left, queue position and viewer on the right.
 */
import type { LOA } from '@/types/loa'
import { loaCaption } from '@/types/review'

const MONO = "'IBM Plex Mono', ui-monospace, monospace"

interface Props {
  loa: LOA
  /** e.g. "Local alignment review" — the viewer's own stage, uppercased in the chip. */
  stageLabel: string
  /** Reads as an archive/aligned state rather than an active review. */
  aligned: boolean
  readOnly: boolean
  userName: string
  userRoleLabel: string
  current: number
  total: number
  onPrev: () => void
  onNext: () => void
  onBack?: () => void
  /** Which cycle this LOA belongs to — code preferred, name as fallback. */
  cycleLabel?: string | null
  /** Emergency cycles read differently: confidential, off the normal window. */
  cycleIsEmergency?: boolean
}

function initials(name?: string): string {
  const parts = (name || '?').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function ReviewTopBar({
  loa, stageLabel, aligned, readOnly, userName, userRoleLabel,
  current, total, onPrev, onNext, onBack, cycleLabel, cycleIsEmergency,
}: Props) {
  const ref = loa.loa_number || loa.loa_draft_id
  return (
    <header style={{
      height: 56, flexShrink: 0, background: 'var(--surface)', borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 22px', gap: 14,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
        {onBack && (
          <>
            <button
              onClick={onBack}
              style={{ background: 'none', border: 'none', fontSize: 11, color: 'var(--text-tertiary)', cursor: 'pointer', padding: 0, whiteSpace: 'nowrap' }}
            >
              ←&nbsp; Tracker
            </button>
            <span style={{ width: 1, height: 18, background: 'var(--border)', flexShrink: 0 }} />
          </>
        )}
        <span style={{ fontFamily: MONO, fontSize: 11, color: '#8A6A3F', flexShrink: 0 }}>{ref}</span>
        {/* Which cycle you are reviewing inside — subtle, but a reviewer working
            across an emergency and the normal window needs to know which. */}
        {cycleLabel && (
          <span
            title={cycleIsEmergency ? 'Emergency cycle — visible only to the people named on it' : 'Cycle'}
            style={{
              fontFamily: MONO, fontSize: 10, flexShrink: 0, whiteSpace: 'nowrap',
              borderRadius: 5, padding: '3px 7px',
              color: cycleIsEmergency ? 'var(--st-rejected-fg)' : 'var(--text-tertiary)',
              background: cycleIsEmergency ? 'var(--st-rejected-bg)' : 'var(--surface-sunken)',
              border: `1px solid ${cycleIsEmergency ? 'var(--st-rejected-fg)' : 'var(--border)'}`,
            }}
          >
            {cycleIsEmergency ? '⚠ ' : ''}{cycleLabel}
          </span>
        )}
        <span style={{
          fontSize: 14, fontWeight: 600, letterSpacing: '-.01em',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {loaCaption(loa)}
        </span>
        <span style={{
          fontSize: 10, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase',
          color: aligned ? '#0E3B2A' : readOnly ? 'var(--text-secondary)' : 'var(--text-secondary)',
          background: aligned ? '#CFE8D9' : readOnly ? 'var(--surface-sunken)' : 'var(--surface-sunken)',
          border: `1px solid ${aligned ? '#A9D3BC' : 'var(--border-strong)'}`,
          borderRadius: 99, padding: '4px 10px', flexShrink: 0, whiteSpace: 'nowrap',
        }}>
          {stageLabel}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          border: '1px solid var(--border)', borderRadius: 8, padding: '5px 8px 5px 10px',
        }}>
          <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
            LOA {current} of {total}
          </span>
          <NavBtn label="‹" title="Previous LOA" disabled={current <= 1} onClick={onPrev} />
          <NavBtn label="›" title="Next LOA" disabled={current >= total} onClick={onNext} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            width: 28, height: 28, borderRadius: 99, background: 'var(--text-primary)', color: 'var(--surface)',
            fontSize: 10.5, fontWeight: 600,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            {initials(userName)}
          </span>
          <span style={{ fontSize: 11.5, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
            {userName} · {userRoleLabel}
          </span>
        </div>
      </div>
    </header>
  )
}

function NavBtn({ label, title, disabled, onClick }: {
  label: string; title: string; disabled: boolean; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      style={{
        width: 24, height: 24, borderRadius: 6, border: 'none',
        background: 'var(--surface-sunken)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, color: disabled ? 'var(--border-strong)' : 'var(--text-secondary)',
        cursor: disabled ? 'default' : 'pointer', padding: 0, lineHeight: 1,
      }}
    >
      {label}
    </button>
  )
}
