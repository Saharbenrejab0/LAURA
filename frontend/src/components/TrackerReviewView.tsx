'use client'
/**
 * TrackerReviewView — the review deck as an overlay inside the tracker
 * (`?view=review`, the Past Cycles archive, and the default landing for
 * CMO/CFO roles).
 *
 * Everything lives in ReviewWorkspace, which loads the deck from the cycle-
 * scoped API, so this view and /cmo-review/[cycleId] always agree.
 */
import ReviewWorkspace from './review/ReviewWorkspace'

interface Props {
  cycleId: string | null
  cycleName: string
  /** Set when viewing an archived cycle, to return to the folder grid. */
  onBack?: () => void
  backLabel?: string
}

export default function TrackerReviewView({ cycleId, cycleName, onBack, backLabel }: Props) {
  return (
    <ReviewWorkspace
      cycleId={cycleId}
      cycleName={cycleName}
      embedded
      onBack={onBack}
      backLabel={backLabel}
    />
  )
}
