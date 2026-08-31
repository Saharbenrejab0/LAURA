'use client'
/**
 * ReviewTopBar — white 56px header above the stage.
 * Breadcrumb back to the tracker · session title · review-stage badge ·
 * theme toggle · full screen · reviewer identity. Built to docs/cmo-review-design.html.
 */
import Link from 'next/link'
import { useTheme } from '@/lib/theme'

const FONT = "Inter, ui-sans-serif, system-ui, sans-serif"

interface Props {
  cycleName: string
  reviewLabel: string
  userName: string
  userRole: string
  onFullscreen: () => void
  /** When set, the breadcrumb calls this instead of navigating to the tracker. */
  onBack?: () => void
  backLabel?: string
}

/** "Sophie Delacroix" → "S. Delacroix"; single names pass through. */
function shortName(full: string): string {
  const parts = full.trim().split(/\s+/).filter(Boolean)
  if (parts.length < 2) return parts[0] || 'Reviewer'
  return `${parts[0][0]}. ${parts.slice(1).join(' ')}`
}

function initials(full: string): string {
  const parts = full.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '—'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function ReviewTopBar({
  cycleName, reviewLabel, userName, userRole, onFullscreen,
  onBack, backLabel = 'Tracker',
}: Props) {
  const { theme, toggle } = useTheme()
  return (
    <header style={{
      height: 56,
      flexShrink: 0,
      background: '#fff',
      borderBottom: '1px solid #EAEAEA',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 22px',
      fontFamily: FONT,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
        {onBack ? (
          <button
            onClick={onBack}
            style={{
              fontSize: 11, color: '#9B9690', whiteSpace: 'nowrap',
              background: 'transparent', border: 'none', padding: 0,
              cursor: 'pointer', fontFamily: FONT,
            }}
          >
            ←&nbsp; {backLabel}
          </button>
        ) : (
          <Link
            href="/"
            style={{ fontSize: 11, color: '#9B9690', textDecoration: 'none', whiteSpace: 'nowrap' }}
          >
            ←&nbsp; {backLabel}
          </Link>
        )}
        <span style={{ width: 1, height: 18, background: '#EAEAEA', flexShrink: 0 }} />
        <span style={{
          fontSize: 14,
          fontWeight: 600,
          letterSpacing: '-.01em',
          color: '#0A0A0A',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {cycleName}
        </span>
        <span style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '.08em',
          textTransform: 'uppercase',
          color: '#3F3A33',
          background: '#F2F0EC',
          border: '1px solid #D9D2C8',
          borderRadius: 99,
          padding: '4px 10px',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}>
          {reviewLabel}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <button
          onClick={toggle}
          title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          style={{
            fontSize: 15,
            color: '#5A554F',
            border: '1px solid #EAEAEA',
            background: 'transparent',
            borderRadius: 8,
            padding: '5px 10px',
            cursor: 'pointer',
            fontFamily: FONT,
            lineHeight: 1,
          }}
        >
          {theme === 'dark' ? '☀' : '☾'}
        </button>
        <button
          onClick={onFullscreen}
          title="Full screen (F)"
          style={{
            fontSize: 11.5,
            fontWeight: 500,
            color: '#5A554F',
            border: '1px solid #EAEAEA',
            background: '#fff',
            borderRadius: 8,
            padding: '7px 12px',
            cursor: 'pointer',
            fontFamily: FONT,
          }}
        >
          ⤢&nbsp; Full screen
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            width: 28,
            height: 28,
            borderRadius: 99,
            background: '#0A0A0A',
            color: '#fff',
            fontSize: 10.5,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            {initials(userName)}
          </span>
          <span style={{ fontSize: 11.5, color: '#5A554F', whiteSpace: 'nowrap' }}>
            {shortName(userName)} · {userRole}
          </span>
        </div>
      </div>
    </header>
  )
}
