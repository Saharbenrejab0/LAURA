'use client'
/**
 * CycleFolderPage — the landing screen for CMO and CFO after login.
 * Shows a gold folder hero and the active cycle as a clickable card.
 * Design: docs/LAURA Cycle Folders.html
 */
const FONT = "Inter, ui-sans-serif, system-ui, sans-serif"
const GOLD = '#C9A678'
const GOLD_DARK = '#A8834A'
const BG = '#EDEBE7'

interface Cycle {
  id: string
  name: string
  startDate?: string
  endDate?: string
  daysRemaining?: number | null
}

interface Props {
  activeCycle: Cycle | null
  onEnterCycle: (cycleId: string) => void
}

export default function CycleFolderPage({ activeCycle, onEnterCycle }: Props) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10,
      background: BG,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: FONT, overflow: 'auto', padding: '40px 24px',
    }}>

      {/* Hero folder illustration */}
      <HeroFolder />

      {/* Headline */}
      <div style={{ marginTop: 36, textAlign: 'center' }}>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-.01em', color: '#0A0A0A' }}>
          Review cycles
        </div>
        <div style={{ fontSize: 13, color: '#8E887E', marginTop: 6 }}>
          The door before the review
        </div>
      </div>

      {/* Cycle cards */}
      <div style={{ marginTop: 40, display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 400 }}>
        {activeCycle ? (
          <CycleCard cycle={activeCycle} onClick={() => onEnterCycle(activeCycle.id)} />
        ) : (
          <div style={{ textAlign: 'center', color: '#B5AFA7', fontSize: 13, padding: '32px 0' }}>
            No active cycle at the moment.
          </div>
        )}
      </div>
    </div>
  )
}

function HeroFolder() {
  return (
    <svg width="260" height="180" viewBox="0 0 260 180" fill="none" aria-hidden>
      {/* Folder tab */}
      <rect x="0" y="0" width="96" height="26" rx="8" fill={GOLD} />
      {/* Folder body */}
      <rect x="0" y="18" width="260" height="162" rx="14" fill={GOLD} />
      {/* Sheen overlay */}
      <rect x="0" y="18" width="260" height="162" rx="14" fill="#E4C48C" fillOpacity="0.35" />
      {/* Subtle inner line near top */}
      <line x1="14" y1="50" x2="246" y2="50" stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
      {/* LAURA wordmark inside folder */}
      <text x="130" y="112" textAnchor="middle" fill="rgba(255,255,255,0.55)"
        fontSize="28" fontWeight="800" fontFamily="Inter, ui-sans-serif, sans-serif"
        letterSpacing="0.12em">
        LAURA
      </text>
    </svg>
  )
}

function CycleCard({ cycle, onClick }: { cycle: Cycle; onClick: () => void }) {
  const dateRange = [cycle.startDate, cycle.endDate].filter(Boolean).join(' → ')
  const remaining = cycle.daysRemaining

  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', textAlign: 'left', cursor: 'pointer',
        background: '#fff', border: `1.5px solid #DDD9D2`,
        borderRadius: 14, padding: '18px 20px',
        display: 'flex', alignItems: 'center', gap: 16,
        transition: 'border-color 150ms, box-shadow 150ms',
        boxShadow: '0 2px 8px rgba(10,10,10,.04)',
        fontFamily: FONT,
      }}
      onMouseEnter={e => {
        const el = e.currentTarget
        el.style.borderColor = GOLD
        el.style.boxShadow = '0 4px 20px rgba(201,166,120,.18)'
      }}
      onMouseLeave={e => {
        const el = e.currentTarget
        el.style.borderColor = '#DDD9D2'
        el.style.boxShadow = '0 2px 8px rgba(10,10,10,.04)'
      }}
    >
      {/* Small folder icon */}
      <svg width="36" height="30" viewBox="0 0 36 30" fill="none" aria-hidden>
        <rect x="0" y="0" width="14" height="6" rx="3" fill={GOLD} />
        <rect x="0" y="4" width="36" height="26" rx="5" fill={GOLD} />
        <rect x="0" y="4" width="36" height="26" rx="5" fill="#E4C48C" fillOpacity="0.3" />
      </svg>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#0A0A0A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {cycle.name}
        </div>
        {dateRange && (
          <div style={{ fontSize: 11.5, color: '#8E887E', marginTop: 3 }}>
            {dateRange}
          </div>
        )}
      </div>

      {remaining != null && remaining > 0 && (
        <div style={{
          flexShrink: 0, padding: '4px 10px', borderRadius: 99,
          background: '#FBF7ED', border: `1px solid ${GOLD}`,
          fontSize: 11, fontWeight: 600, color: GOLD_DARK,
          whiteSpace: 'nowrap',
        }}>
          {remaining}d left
        </div>
      )}

      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden style={{ flexShrink: 0 }}>
        <path d="M6 3l5 5-5 5" stroke="#C6C1B8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}
