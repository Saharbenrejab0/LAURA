'use client'
/**
 * CommentsSummaryPanel — every thread on this LOA, labelled by its anchor.
 *
 * Entries are named the way the design names them: "Excel · Vendor",
 * "Slide · Cost drill down". Clicking one jumps to and highlights that exact
 * cell or section. The threads persist with the LOA, so CMO and CFO read the
 * same ones at final review.
 *
 * Rendered in flow (not fixed) so opening it narrows the split-screen pane
 * rather than covering the slide.
 */
import type { ReviewComment } from '@/types/review'
import { anchorLabel, anchorOrigin, anchorSide, PIN } from './anchors'

const MONO = "'IBM Plex Mono', ui-monospace, monospace"

interface Props {
  comments: ReviewComment[]
  activeAnchor: string | null
  onAnchorClick: (anchor: string) => void
  onClose: () => void
}

function initials(name?: string): string {
  const parts = (name || '?').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function whenLabel(iso: string): string {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  const hrs = Math.round((Date.now() - t) / 3600000)
  if (hrs < 1) return 'just now'
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.round(hrs / 24)
  if (days < 8) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

export default function CommentsSummaryPanel({
  comments, activeAnchor, onAnchorClick, onClose,
}: Props) {
  // One card per anchor, newest comment as the preview.
  const groups = new Map<string, ReviewComment[]>()
  for (const c of comments) {
    const k = c.anchor || ''
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k)!.push(c)
  }
  const threads = [...groups.entries()].sort((a, b) => b[1].length - a[1].length)

  return (
    <aside style={{
      width: 330, flexShrink: 0, background: 'var(--surface)', borderLeft: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', boxShadow: '-18px 0 40px rgba(10,10,10,.05)',
    }}>
      <div style={{
        padding: '15px 18px 12px', borderBottom: '1px solid var(--surface-sunken)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10,
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ fontSize: 13.5, fontWeight: 600 }}>Comments on this LOA</span>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
            {comments.length} comment{comments.length === 1 ? '' : 's'} across {threads.length} section
            {threads.length === 1 ? '' : 's'} · click to jump
          </span>
        </div>
        <button
          onClick={onClose}
          aria-label="Close comment summary"
          style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--text-tertiary)', cursor: 'pointer', padding: 2 }}
        >
          ✕
        </button>
      </div>

      <div style={{
        flex: 1, overflowY: 'auto', padding: '12px 14px',
        display: 'flex', flexDirection: 'column', gap: 9,
      }}>
        {threads.length === 0 && (
          <p style={{ fontSize: 11.5, color: 'var(--text-faint)', margin: 0, lineHeight: 1.55 }}>
            No comments on this LOA yet. Click any field above or any section on
            the slide to start a thread.
          </p>
        )}
        {threads.map(([anchor, list]) => {
          const last = list[list.length - 1]
          const on = activeAnchor === anchor
          const side = anchorSide(anchor)
          const excel = side === 'excel'
          return (
            <button
              key={anchor || 'general'}
              onClick={() => anchor && onAnchorClick(anchor)}
              style={{
                border: `1px solid ${on ? 'var(--text-primary)' : 'var(--surface-sunken)'}`,
                background: on ? 'var(--surface-raised)' : 'var(--surface)',
                borderRadius: 10, padding: '10px 11px',
                display: 'flex', flexDirection: 'column', gap: 7,
                cursor: anchor ? 'pointer' : 'default', textAlign: 'left',
                fontFamily: 'inherit',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  <span style={{
                    fontSize: 8.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase',
                    color: excel ? '#2C3E5D' : '#8A6A3F',
                    background: excel ? '#EDF3F9' : '#FAF5EA',
                    border: `1px solid ${excel ? '#CFE0EF' : '#E8D9B8'}`,
                    borderRadius: 4, padding: '2px 6px', whiteSpace: 'nowrap',
                  }}>
                    {anchorLabel(anchor)}
                  </span>
                  <span style={{ fontSize: 9.5, color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>
                    {anchorOrigin(anchor)}
                  </span>
                </span>
                <span style={{
                  fontFamily: MONO, fontSize: 9, minWidth: 15, height: 15, borderRadius: 99,
                  background: PIN.bg, border: `1px solid ${PIN.bd}`, color: PIN.fg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  {list.length}
                </span>
              </span>

              <span style={{ fontSize: 11.5, lineHeight: 1.5, color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
                {last.text}
              </span>

              <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{
                  width: 18, height: 18, borderRadius: 99, background: 'var(--surface-sunken)', color: 'var(--text-secondary)',
                  fontSize: 8, fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  {initials(last.authorName)}
                </span>
                <span style={{ fontSize: 10.5, color: 'var(--text-secondary)' }}>{last.authorName}</span>
                <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>· {whenLabel(last.createdAt)}</span>
              </span>
            </button>
          )
        })}
      </div>

      <div style={{
        padding: '12px 16px', borderTop: '1px solid var(--surface-sunken)', flexShrink: 0,
        display: 'flex', flexDirection: 'column', gap: 6,
      }}>
        {comments.length > 0 && (
          <span style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
            Your {comments.length} comment{comments.length === 1 ? '' : 's'} stay
            attached to their sections and move with the LOA.
          </span>
        )}
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.55 }}>
          Comments travel with the LOA through every stage — CMO and CFO see the
          same threads at final review.
        </span>
      </div>
    </aside>
  )
}
