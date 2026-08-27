'use client'
/**
 * ApproveConfirmModal — the last check before the LOA moves on.
 *
 * It restates what carries forward: the comment threads stay attached to their
 * anchors and travel with the LOA, and the named next stage is who picks it up.
 */
import { useState } from 'react'
import { ALIGNMENT_STAGE_LABELS, formatEuro, loaCaption } from '@/types/review'
import type { AlignmentStage, ReviewComment } from '@/types/review'
import type { LOA } from '@/types/loa'
import { anchorLabel, PIN } from './anchors'

const MONO = "'IBM Plex Mono', ui-monospace, monospace"

interface Props {
  loa: LOA
  stage: AlignmentStage
  comments: ReviewComment[]
  onConfirm: () => Promise<void>
  onCancel: () => void
}

export default function ApproveConfirmModal({
  loa, stage, comments, onConfirm, onCancel,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConfirm() {
    setLoading(true)
    setError(null)
    try {
      await onConfirm()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Approval failed')
    } finally {
      setLoading(false)
    }
  }

  const ref = loa.loa_number || loa.loa_draft_id

  // One line per anchor that carries a thread.
  const byAnchor = new Map<string, number>()
  for (const c of comments) {
    if (!c.anchor) continue
    byAnchor.set(c.anchor, (byAnchor.get(c.anchor) || 0) + 1)
  }
  const carried = [...byAnchor.entries()].sort((a, b) => b[1] - a[1])

  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed', inset: 0, zIndex: 400,
        background: 'rgba(10,10,10,.42)', backdropFilter: 'blur(2px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 520, maxWidth: '100%', background: 'var(--surface)', borderRadius: 16,
          boxShadow: '0 24px 64px rgba(10,10,10,.24)',
          padding: '26px 26px 22px', display: 'flex', flexDirection: 'column', gap: 16,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{
            fontSize: 10, fontWeight: 600, letterSpacing: '.14em',
            textTransform: 'uppercase', color: '#8A6A3F',
          }}>
            {ALIGNMENT_STAGE_LABELS[stage]} · submit review
          </span>
          <span style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-.01em', lineHeight: 1.3 }}>
            Submit your review of “{loaCaption(loa)}”?
          </span>
          <span style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
            {ref} · {loa.country || '—'} · {formatEuro(loa.fy_2026_total || 0)} · owner {loa.requestor_email}
          </span>
        </div>

        <div style={{
          border: '1px solid var(--surface-sunken)', background: 'var(--surface-sunken)', borderRadius: 10,
          padding: '13px 14px', display: 'flex', flexDirection: 'column', gap: 9,
        }}>
          <span style={{ fontSize: 11.5, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
            {carried.length > 0
              ? <>Your {comments.length} comment{comments.length === 1 ? '' : 's'} stay attached to their sections and travel with the LOA. </>
              : <>No comments are attached to this LOA. </>}
            The LOA advances once all reviewers at this stage have submitted.
          </span>
          {carried.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {carried.map(([anchor, count]) => (
                <div key={anchor} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    fontFamily: MONO, fontSize: 9, minWidth: 15, height: 15, borderRadius: 99,
                    background: PIN.bg, border: `1px solid ${PIN.bd}`, color: PIN.fg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    {count}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{anchorLabel(anchor)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {error && (
          <span style={{
            fontSize: 11.5, color: '#8A2E27', background: '#FFF1EF',
            border: '1px solid #E6C1BD', borderRadius: 8, padding: '9px 11px', lineHeight: 1.5,
          }}>
            {error}
          </span>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 2 }}>
          <button
            onClick={onCancel}
            style={{
              fontSize: 12.5, fontWeight: 500, color: 'var(--text-secondary)',
              background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8,
              padding: '10px 18px', cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            style={{
              fontSize: 12.5, fontWeight: 600, color: 'var(--surface)',
              background: '#1D6B45', border: 'none', borderRadius: 8,
              padding: '10px 20px', cursor: loading ? 'default' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Submitting…' : 'Submit review'}
          </button>
        </div>
      </div>
    </div>
  )
}
