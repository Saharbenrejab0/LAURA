'use client'
/**
 * SubmitReviewModal — final confirmation before locking the reviewer's pass.
 * Built to docs/cmo-review-design.html: two count tiles with their budgets, the
 * list of LOAs going back to their owners, and the finality note.
 */
import { useState } from 'react'
import type { Slide, ReviewVerdict } from '@/types/review'
import { formatEuro, loaCaption } from '@/types/review'
import type { LOA } from '@/types/loa'

const FONT = "Inter, ui-sans-serif, system-ui, sans-serif"
const MONO = "'IBM Plex Mono', ui-monospace, SFMono-Regular, monospace"
const RED = '#8A2E27'

interface Props {
  slides: Slide[]
  verdicts: Record<string, ReviewVerdict>
  cycleName: string
  onConfirm: () => Promise<void>
  onCancel: () => void
}

function loaOf(slide: Slide): LOA {
  return (slide.data as any).loa as LOA
}

export default function SubmitReviewModal({
  slides, verdicts, cycleName, onConfirm, onCancel,
}: Props) {
  const [submitting, setSubmitting] = useState(false)

  const loaSlides = slides.filter(s => s.type === 'loa_detail')
  const approved = loaSlides.filter(s => s.loaId && verdicts[s.loaId]?.decision === 'approved')
  const rejected = loaSlides.filter(s => s.loaId && verdicts[s.loaId]?.decision === 'rejected')
  const pending = loaSlides.filter(s => !s.loaId || !verdicts[s.loaId])

  const sum = (list: Slide[]) => list.reduce((t, s) => t + (loaOf(s).fy_2026_total || 0), 0)

  const handleConfirm = async () => {
    setSubmitting(true)
    try { await onConfirm() } finally { setSubmitting(false) }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(10,10,10,.42)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
        fontFamily: FONT,
      }}
      onClick={e => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div style={{
        width: 560,
        maxHeight: '86vh',
        overflowY: 'auto',
        background: '#fff',
        borderRadius: 16,
        boxShadow: '0 24px 64px rgba(10,10,10,.24)',
        padding: 28,
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.14em', textTransform: 'uppercase', color: '#8A6A3F' }}>
            Final step
          </span>
          <span style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-.015em', color: '#0A0A0A' }}>
            Submit your review
          </span>
          <span style={{ fontSize: 13, color: '#5A554F', lineHeight: 1.55 }}>
            {pending.length === 0
              ? `You have reviewed all ${loaSlides.length} LOAs in the ${cycleName} cycle.`
              : `${pending.length} of ${loaSlides.length} LOAs in the ${cycleName} cycle are still undecided.`}
          </span>
        </div>

        {/* Count tiles */}
        <div style={{ display: 'flex', gap: 12 }}>
          <Tile
            value={approved.length}
            label={`Approved · ${formatEuro(sum(approved))}`}
            color="#0A0A0A"
            border="#EAEAEA"
            background="#fff"
          />
          <Tile
            value={rejected.length}
            label={`Rejected · ${formatEuro(sum(rejected))}`}
            color={RED}
            border="#E6C1BD"
            background="#FFF1EF"
          />
        </div>

        {/* Returned to owners */}
        {rejected.length > 0 && (
          <div style={{ border: '1px solid #EAEAEA', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{
              padding: '9px 14px',
              background: '#FAFAFA',
              borderBottom: '1px solid #EAEAEA',
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '.1em',
              textTransform: 'uppercase',
              color: '#5A554F',
            }}>
              Returned to owners
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {rejected.map(s => {
                const loa = loaOf(s)
                return (
                  <div
                    key={s.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '9px 14px',
                      borderBottom: '1px solid #F4F3F0',
                      gap: 10,
                    }}
                  >
                    <span style={{ fontSize: 12, color: '#2A2A2A' }}>{loaCaption(loa)}</span>
                    <span style={{ fontFamily: MONO, fontSize: 11, color: '#9B9690', flexShrink: 0 }}>
                      {formatEuro(loa.fy_2026_total || 0)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Finality note */}
        <div style={{
          background: '#FFF8F0',
          border: '1px solid #E8D0B2',
          borderRadius: 10,
          padding: '11px 13px',
          fontSize: 11.5,
          lineHeight: 1.6,
          color: '#7A5416',
        }}>
          This action is final. Approved LOAs proceed to Corporate review. Rejected LOAs
          return to their owners with your comments.
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button
            onClick={onCancel}
            style={{
              fontSize: 12.5,
              fontWeight: 500,
              color: '#5A554F',
              border: '1px solid #E0DED9',
              background: '#fff',
              borderRadius: 8,
              padding: '11px 18px',
              cursor: 'pointer',
              fontFamily: FONT,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={submitting}
            style={{
              fontSize: 12.5,
              fontWeight: 600,
              color: '#fff',
              background: '#0A0A0A',
              border: 'none',
              borderRadius: 8,
              padding: '11px 24px',
              cursor: submitting ? 'default' : 'pointer',
              fontFamily: FONT,
            }}
          >
            {submitting ? 'Submitting…' : 'Submit review'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Tile({ value, label, color, border, background }: {
  value: number
  label: string
  color: string
  border: string
  background: string
}) {
  return (
    <div style={{
      flex: 1,
      border: `1px solid ${border}`,
      background,
      borderRadius: 12,
      padding: '14px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
    }}>
      <span style={{ fontFamily: MONO, fontSize: 26, fontWeight: 500, color }}>{value}</span>
      <span style={{ fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: color === '#0A0A0A' ? '#9B9690' : color }}>
        {label}
      </span>
    </div>
  )
}
