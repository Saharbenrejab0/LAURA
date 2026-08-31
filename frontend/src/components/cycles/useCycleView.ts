'use client'
/**
 * Shared loader for the cycle-scoped routes
 * (/cycles/:id/deck | /sheet | /both | /list).
 *
 * Each of those routes needs the same three things — the cycle, its LOAs, and
 * whether the viewer is allowed in — so they resolve it here rather than each
 * route growing its own copy of the fetch and its own idea of what "loading"
 * means.
 */
import { useEffect, useState } from 'react'
import type { LOA } from '@/types/loa'
import type { Cycle } from '@/lib/cycles-api'
import { fetchCycle } from '@/lib/cycles-api'
import api from '@/lib/api'
import { newestFirst } from '@/lib/sort'

export interface CycleViewState {
  cycle: Cycle | null
  loas: LOA[]
  loading: boolean
  error: string | null
}

export function useCycleView(cycleId: string | null): CycleViewState {
  const [cycle, setCycle] = useState<Cycle | null>(null)
  const [loas, setLoas] = useState<LOA[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!cycleId) { setLoading(false); return }
    let alive = true
    setLoading(true)
    setError(null)

    Promise.all([
      fetchCycle(cycleId),
      api.get(`/cycles/${cycleId}/loas`).then(r => r.data),
    ])
      .then(([c, rows]) => {
        if (!alive) return
        setCycle(c)
        // Newest-first is already the API order; re-applying the shared sort
        // keeps it true if this ever merges another source in.
        setLoas(newestFirst<LOA>(rows))
      })
      .catch((e: any) => {
        if (!alive) return
        setError(e?.response?.data?.detail || 'Could not load this cycle.')
      })
      .finally(() => { if (alive) setLoading(false) })

    return () => { alive = false }
  }, [cycleId])

  return { cycle, loas, loading, error }
}
