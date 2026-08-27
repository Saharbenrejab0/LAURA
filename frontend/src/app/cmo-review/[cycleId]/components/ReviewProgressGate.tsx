'use client'
/**
 * ReviewProgressGate — the gentle screen shown when a reviewer hits Submit with
 * LOAs still undecided.
 *
 * It is deliberately not an error. Submitting locks the pass, so the useful
 * response to "I'm done" when they aren't is to show how far they've got, how
 * much is left, and offer to take them to the next undecided LOA. The counts
 * come straight from the live deck, so they move as decisions are made.
 */
import type { Slide, ReviewVerdict } from '@/types/review'
import { formatEuro } from '@/types/review'
import type { LOA } from '@/types/loa'

const FONT = "Inter, ui-sans-serif, system-ui, sans-serif"
const MONO = "'IBM Plex Mono', ui-monospace, SFMono-Regular, monospace"
const GOLD = '#B08D2F'

interface Props {
  slides: Slide[]
  verdicts: Record<string, ReviewVerdict>
  /** Jumps to the first LOA with no verdict yet. */
  onResume: (index: number) => void
  onClose: () => void
}

function loaOf(slide: Slide): LOA {
  return (slide.data as { loa: LOA }).loa
}

export default function ReviewProgressGate({ slides, verdicts, onResume, onClose }: Props) {
  const loaSlides = slides.filter(s => s.type === 'loa_detail')
  const decided = loaSlides.filter(s => s.loaId && verdicts[s.loaId])
  const pending = loaSlides.filter(s => !s.loaId || !verdicts[s.loaId])
  const total = loaSlides.length
  const pct = total === 0 ? 0 : Math.round((decided.length / total) * 100)

  const pendingBudget = pending.reduce((t, s) => t + (loaOf(s).fy_2026_total || 0), 0)
  const firstPendingIndex = slides.findIndex(
    s => s.type === 'loa_detail' && (!s.loaId || !verdicts[s.loaId]),
  )

  const remaining = pending.length
  const plural = remaining === 1 ? 'LOA' : 'LOAs'

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(10,10,10,.42)', backdropFilter: 'blur(2px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24, fontFamily: FONT,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 520, maxWidth: '100%', background: '#fff', borderRadius: 16,
          boxShadow: '0 24px 64px rgba(10,10,10,.24)',
          padding: '28px 28px 22px',
          display: 'flex', flexDirection: 'column', gap: 18,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <span style={{
            fontSize: 10, fontWeight: 600, letterSpacing: '.14em',
            textTransform: 'uppercase', color: GOLD,
          }}>
            Almost there
          </span>
          <span style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-.01em', lineHeight: 1.35 }}>
            You&rsquo;ve decided {decided.length} of {total} — {remaining} {plural} to go.
          </span>
          <span style={{ fontSize: 12.5, color: '#5A554F', lineHeight: 1.6 }}>
            Every LOA needs an approve or a reject before you can submit, because
            submitting locks your pass for this cycle. Nothing you&rsquo;ve decided so
            far is lost — pick up where you left off.
          </span>
        </div>

        {/* Progress */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{
            height: 8, borderRadius: 99, background: '#F0EFEC', overflow: 'hidden',
          }}>
            <div style={{
              width: `${pct}%`, height: '100%', borderRadius: 99,
              background: GOLD, transition: 'width 240ms cubic-bezier(0.2,0,0,1)',
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontFamily: MONO, fontSize: 11, color: '#8A6A3F' }}>
              {pct}% reviewed
            </span>
            <span style={{ fontSize: 11.5, color: '#9B9690' }}>
              {remaining} left · {formatEuro(pendingBudget)} still undecided
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 2 }}>
          <button
            onClick={onClose}
            style={{
              fontSize: 12.5, fontWeight: 500, color: '#5A554F',
              background: '#fff', border: '1px solid #E0DED9', borderRadius: 8,
              padding: '10px 18px', cursor: 'pointer', fontFamily: FONT,
            }}
          >
            Keep reviewing
          </button>
          <button
            onClick={() => {
              if (firstPendingIndex >= 0) onResume(firstPendingIndex)
              onClose()
            }}
            disabled={firstPendingIndex < 0}
            style={{
              fontSize: 12.5, fontWeight: 600, color: '#fff',
              background: '#0A0A0A', border: 'none', borderRadius: 8,
              padding: '10px 20px', cursor: firstPendingIndex < 0 ? 'default' : 'pointer',
              fontFamily: FONT, opacity: firstPendingIndex < 0 ? 0.5 : 1,
            }}
          >
            Go to next undecided ›
          </button>
        </div>
      </div>
    </div>
  )
}
