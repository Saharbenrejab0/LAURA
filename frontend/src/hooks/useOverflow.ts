'use client'
/**
 * useOverflow — does this element have content off-screen, and in which direction?
 *
 * Returns a **callback ref**, not a RefObject, and that is the load-bearing
 * choice. An effect that reads `ref.current` runs once with stable deps, so if
 * the target is null on that pass (conditionally rendered, still loading) it is
 * never observed — silently, forever — and if React later swaps the node, the
 * listeners stay bound to the detached one. A callback ref re-runs the effect
 * with the actual node each time it changes.
 *
 * Re-measures on three triggers, because missing any one makes the hint lie:
 *   - box resizes (pane drag, window resize)      → ResizeObserver
 *   - content changes (rows load, a cell grows)   → MutationObserver on the
 *     subtree; a box can keep its size while its content grows past it
 *   - the user scrolls                            → scroll listener
 *
 * Measurement is coalesced into one rAF, so a trackpad flick at 120Hz costs one
 * layout read per frame rather than one per event.
 */
import { useCallback, useLayoutEffect, useRef, useState } from 'react'

export type OverflowAxis = 'x' | 'y'

export interface OverflowState {
  /** Scrollable backwards (left / up) — the user has scrolled away from the start. */
  canScrollBack: boolean
  /** Scrollable forwards (right / down) — there is more content that way. */
  canScrollForward: boolean
}

export interface UseOverflowResult extends OverflowState {
  /** Attach to the element that has `overflow: auto` — not its wrapper. */
  ref: (node: HTMLElement | null) => void
}

// 1px of slack: sub-pixel layout rounding otherwise reports a permanent
// half-pixel overflow on boxes that visibly fit.
const EPSILON = 1

export function useOverflow(axis: OverflowAxis = 'x'): UseOverflowResult {
  const [node, setNode] = useState<HTMLElement | null>(null)
  const [state, setState] = useState<OverflowState>({ canScrollBack: false, canScrollForward: false })
  const frame = useRef<number | null>(null)

  const measure = useCallback(() => {
    if (!node) return
    const scrollSize = axis === 'x' ? node.scrollWidth : node.scrollHeight
    const clientSize = axis === 'x' ? node.clientWidth : node.clientHeight
    const offset = axis === 'x' ? node.scrollLeft : node.scrollTop

    const canScrollBack = offset > EPSILON
    const canScrollForward = scrollSize - clientSize - offset > EPSILON

    setState(prev =>
      prev.canScrollBack === canScrollBack && prev.canScrollForward === canScrollForward
        ? prev // same object — no re-render
        : { canScrollBack, canScrollForward },
    )
  }, [node, axis])

  useLayoutEffect(() => {
    if (!node) {
      // Functional guard, not a bare setState: allocating a fresh object here
      // would re-render on every mount for no change.
      setState(prev =>
        prev.canScrollBack || prev.canScrollForward
          ? { canScrollBack: false, canScrollForward: false }
          : prev,
      )
      return
    }

    // Coalesce every trigger into one measurement per frame.
    const schedule = () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current)
      frame.current = requestAnimationFrame(() => {
        frame.current = null
        measure()
      })
    }

    // Measure before paint so the hint is correct on the first committed
    // frame rather than popping in one frame later.
    measure()

    node.addEventListener('scroll', schedule, { passive: true })
    const resize = new ResizeObserver(schedule)
    resize.observe(node)
    const mutation = new MutationObserver(schedule)
    mutation.observe(node, { childList: true, subtree: true, characterData: true })

    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current)
      frame.current = null
      node.removeEventListener('scroll', schedule)
      resize.disconnect()
      mutation.disconnect()
    }
  }, [node, measure])

  return { ref: setNode, ...state }
}
