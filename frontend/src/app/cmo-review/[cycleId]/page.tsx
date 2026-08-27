'use client'
/**
 * CMO review — standalone slideshow route.
 * The workspace is shared with the tracker's embedded review view.
 */
import { useParams } from 'next/navigation'
import ReviewWorkspace from '@/components/review/ReviewWorkspace'

export default function CmoReviewPage() {
  const params = useParams()
  const cycleId = (params?.cycleId as string) || null
  return <ReviewWorkspace cycleId={cycleId} />
}
