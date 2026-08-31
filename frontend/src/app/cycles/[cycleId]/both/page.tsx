'use client'
/**
 * /cycles/:id/both — the `split` template at cycle scope.
 *
 * "Both" is the per-LOA SplitScreenReview (Excel row on top, LOA slide below),
 * navigating through every LOA in the cycle. It is NOT the whole-sheet +
 * whole-deck composition that used to live here — that composition was removed
 * because it duplicated CFOSpreadsheet and ReviewWorkspace at cycle scope, a
 * scope SplitScreenReview already handles per-LOA.
 *
 * Optional ?loa=<id> deep-links to a specific LOA in the review queue.
 */
import { useParams, useSearchParams } from 'next/navigation'
import { useMyRole } from '@/hooks/usePermissions'
import { getStoredUser } from '@/lib/api'
import SplitScreenReview from '@/components/alignment-review/SplitScreenReview'

export default function CycleBothPage() {
  const params = useParams<{ cycleId: string }>()
  const searchParams = useSearchParams()
  const cycleId = typeof params?.cycleId === 'string' ? params.cycleId : null
  const initialLoaId = searchParams?.get('loa') ?? undefined

  const { role } = useMyRole()

  return (
    <SplitScreenReview
      cycleId={cycleId}
      roleCode={role?.role_code || ''}
      userEmail={role?.email || ''}
      userName={getStoredUser()?.full_name || undefined}
      isAdmin={role?.can_override_lock === true}
      initialLoaId={initialLoaId}
    />
  )
}
