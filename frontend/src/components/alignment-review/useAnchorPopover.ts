'use client'
/**
 * Positions a comment popover next to whichever `[data-anchor]` element the
 * active anchor names, measured inside one panel.
 *
 * Both halves of the split screen use this. `activeAnchor` is owned by
 * SplitScreenReview, so a click in the Excel row, on the slide, on a rail pin
 * or in the comment-summary drawer all resolve to the same highlighted anchor —
 * and whichever panel actually contains that node is the one that draws the
 * popover.
 *
 * Placement is tried below → above → right → left, and only falls back to a
 * clamped position when the anchor genuinely has no room around it. Flipping
 * above used to be the only fallback, which parked the popover on top of the
 * panel headers whenever the slide sat low in a short pane.
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import type { RefObject } from 'react'

export type PopoverSide = 'below' | 'above' | 'right' | 'left'

export interface PopoverPos {
  left: number
  top: number
  side: PopoverSide
  /** Caret offset along the popover edge the caret sits on. */
  caret: number
}

const POP_W = 312
const GAP = 12
const EDGE = 10

export function useAnchorPopover(
  containerRef: RefObject<HTMLElement | null>,
  activeAnchor: string | null,
  /** Number of comments on the active anchor — drives the height estimate. */
  threadLength: number,
  /** Extra dependencies that move the anchor (scale changes, collapse, …). */
  deps: unknown[] = [],
) {
  const [pos, setPos] = useState<PopoverPos | null>(null)
  const frame = useRef<number | null>(null)

  const measure = useCallback(() => {
    const pane = containerRef.current
    if (!pane || !activeAnchor) { setPos(null); return }
    const node = pane.querySelector<HTMLElement>(`[data-anchor="${activeAnchor}"]`)
    if (!node) { setPos(null); return }

    const pr = pane.getBoundingClientRect()
    const er = node.getBoundingClientRect()
    const h = 118 + Math.max(1, threadLength) * 78

    // Anchor box in pane-local coordinates.
    const aLeft = er.left - pr.left
    const aRight = er.right - pr.left
    const aTop = er.top - pr.top
    const aBottom = er.bottom - pr.top

    const clampX = (x: number) => Math.max(EDGE, Math.min(x, Math.max(EDGE, pr.width - POP_W - EDGE)))
    const clampY = (y: number) => Math.max(EDGE, Math.min(y, Math.max(EDGE, pr.height - h - EDGE)))

    const fitsBelow = aBottom + GAP + h <= pr.height - EDGE
    const fitsAbove = aTop - GAP - h >= EDGE
    const fitsRight = aRight + GAP + POP_W <= pr.width - EDGE
    const fitsLeft = aLeft - GAP - POP_W >= EDGE

    let side: PopoverSide
    if (fitsBelow) side = 'below'
    else if (fitsAbove) side = 'above'
    else if (fitsRight) side = 'right'
    else if (fitsLeft) side = 'left'
    else side = 'below'   // nothing fits — clamped below, still the closest edge

    let left: number
    let top: number
    if (side === 'below' || side === 'above') {
      // Align the popover's leading edge to the anchor, pulling it back inside
      // the pane when the anchor sits near the right edge.
      left = aLeft + POP_W > pr.width - EDGE ? aRight - POP_W : aLeft
      left = clampX(left)
      top = clampY(side === 'below' ? aBottom + GAP : aTop - GAP - h)
    } else {
      left = side === 'right' ? aRight + GAP : aLeft - GAP - POP_W
      left = clampX(left)
      // Centre on the anchor vertically.
      top = clampY(aTop + er.height / 2 - h / 2)
    }

    // Caret tracks the anchor's centre along whichever edge it sits on.
    const caret = (side === 'below' || side === 'above')
      ? Math.max(16, Math.min(aLeft + Math.min(er.width / 2, 60) - left, POP_W - 26))
      : Math.max(16, Math.min(aTop + er.height / 2 - top, h - 26))

    setPos({ left, top, side, caret })
  }, [containerRef, activeAnchor, threadLength])

  // Re-measure on the next frame so layout (and any transform scale) has settled.
  useEffect(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(measure)
    return () => { if (frame.current !== null) cancelAnimationFrame(frame.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measure, ...deps])

  useEffect(() => {
    if (!activeAnchor) return
    const onResize = () => measure()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [activeAnchor, measure])

  return pos
}

export const POPOVER_WIDTH = POP_W
