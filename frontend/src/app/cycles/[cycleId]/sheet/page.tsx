'use client'
/**
 * /cycles/:id/sheet — the CFO spreadsheet.
 *
 * A real route. Same CFOSpreadsheet component the CFO has always used; the only
 * change is that it is now reached by URL instead of by a `view` state flag, so
 * Back goes to /cycles and the link is shareable.
 */
import { useParams } from 'next/navigation'
import CFOSpreadsheet from '@/components/cfo/CFOSpreadsheet'
import { useCycleView } from '@/components/cycles/useCycleView'
import CycleViewFrame from '@/components/cycles/CycleViewFrame'

export default function CycleSheetPage() {
  const params = useParams<{ cycleId: string }>()
  const cycleId = typeof params?.cycleId === 'string' ? params.cycleId : null
  const { cycle, loas, loading, error } = useCycleView(cycleId)

  return (
    <CycleViewFrame
      cycleId={cycleId}
      cycleName={cycle?.name}
      active="sheet"
      loading={loading}
      error={error}
    >
      <CFOSpreadsheet
        loas={loas}
        cycleId={cycleId}
        cycleName={cycle?.name || 'Review'}
      />
    </CycleViewFrame>
  )
}
