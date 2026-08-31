'use client'
/**
 * ScrollHint — "there is more this way", but only when there actually is.
 *
 * Replaces a hardcoded `scroll for more →` that was always rendered: it lied on
 * a wide monitor where nothing overflowed, and kept pointing right after you had
 * already reached the end. A hint that is always on is decoration, not a hint.
 *
 * It points **both ways**. Forward-only was the first cut and it was worse than
 * the string it replaced: the Excel row keeps its scrollLeft when the reviewer
 * moves to the next LOA, so they could land on a row parked at the right end
 * with the leading columns off-screen and no affordance at all.
 *
 * Measurement lives in useOverflow (src/hooks/), so anything else that needs to
 * fade an edge or show an affordance can use it without importing this UI.
 */
import { useOverflow, type OverflowAxis } from '@/hooks/useOverflow'

interface Props {
  axis?: OverflowAxis
  /** Wording for the forward direction; the arrow is appended. */
  forwardLabel?: string
  /** Wording for the backward direction; the arrow is prepended. */
  backLabel?: string
  style?: React.CSSProperties
}

export interface ScrollHintHandle {
  /** Spread onto the element that has `overflow: auto`. */
  ref: (node: HTMLElement | null) => void
}

/**
 * Usage — the hook owns the ref, so the hint and the scroller are wired
 * together by the caller:
 *
 *   const scroll = useOverflow()
 *   <ScrollHintView {...scroll} />
 *   <div ref={scroll.ref} style={{ overflowX: 'auto' }}>…</div>
 */
export function ScrollHintView({
  canScrollBack,
  canScrollForward,
  axis = 'x',
  forwardLabel = 'scroll for more',
  backLabel = 'back to start',
  style,
}: Props & { canScrollBack: boolean; canScrollForward: boolean }) {
  if (!canScrollBack && !canScrollForward) return null

  const forwardArrow = axis === 'x' ? '→' : '↓'
  const backArrow = axis === 'x' ? '←' : '↑'

  // Forward wins when both directions are available: "there is more you have
  // not seen" is the more useful of the two.
  const text = canScrollForward
    ? `${forwardLabel} ${forwardArrow}`
    : `${backArrow} ${backLabel}`

  return (
    <span
      aria-hidden="true"
      style={{ fontSize: 10, color: 'var(--text-dimmer)', whiteSpace: 'nowrap', ...style }}
    >
      {text}
    </span>
  )
}

export default ScrollHintView
