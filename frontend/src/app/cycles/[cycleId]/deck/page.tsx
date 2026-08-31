'use client'
/**
 * /cycles/:id/deck — the CMO slideshow.
 *
 * A real route, so Back returns to /cycles (the folder page) instead of
 * unwinding to the auth screen, and the URL can be pasted or bookmarked.
 *
 * The slide itself is unchanged: ReviewWorkspace owns the 1280×720 canvas that
 * gets exported to PPTX, and that canvas is deliberately NOT themed.
 */
import { useParams } from 'next/navigation'
import ReviewWorkspace from '@/components/review/ReviewWorkspace'
import { useCycleView } from '@/components/cycles/useCycleView'
import CycleViewFrame from '@/components/cycles/CycleViewFrame'

export default function CycleDeckPage() {
  const params = useParams<{ cycleId: string }>()
  const cycleId = typeof params?.cycleId === 'string' ? params.cycleId : null
  const { cycle, loading, error } = useCycleView(cycleId)

  return (
    <CycleViewFrame
      cycleId={cycleId}
      cycleName={cycle?.name}
      active="deck"
      loading={loading}
      error={error}
    >
      {/* ReviewWorkspace already reads `?loa=` off the URL itself, so the
          selected slide survives back/forward without extra plumbing. */}
      <ReviewWorkspace cycleId={cycleId} cycleName={cycle?.name || 'Review'} embedded />
    </CycleViewFrame>
  )
}
