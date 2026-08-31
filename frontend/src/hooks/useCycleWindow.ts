'use client'

/**
 * The submission window, as every "+ New LOA" entry point sees it.
 *
 * There is more than one such button (sidebar, role list, tracker), and each one
 * asking the API its own way is how they drift apart. They share this hook so a
 * closed window disables all of them at once, with the same sentence.
 *
 * The server enforces the same rule on POST /loa/{id}/submit — this is the
 * affordance, not the gate.
 */

import { useEffect, useState } from 'react'
import api from '@/lib/api'

export interface CycleWindow {
  /** The open normal cycle, if one is taking submissions. */
  cycle: { id: string; name: string; code: string | null; status: string; endDate: string } | null
  /** Whether a normal cycle is open right now. */
  canSubmit: boolean
  /** Why not — ready to use as a tooltip. Empty when submission is allowed. */
  reason: string
  loading: boolean
}

const CLOSED_REASON: Record<string, string> = {
  draft: 'The next cycle has not opened yet. An admin must open it before LOAs can be created.',
  under_review: 'Submissions are closed — the cycle is in review. No new LOAs can be created.',
  closed: 'The cycle is closed. An admin must open a new one before LOAs can be created.',
}

export function useCycleWindow(): CycleWindow {
  const [state, setState] = useState<CycleWindow>({
    cycle: null, canSubmit: false, reason: '', loading: true,
  })

  useEffect(() => {
    let alive = true
    api.get('/admin/cycle/current')
      .then(r => {
        if (!alive) return
        const d = r.data || {}
        const normal = (Array.isArray(d.active) ? d.active : [])
          .find((c: any) => c.cycle_type === 'normal') || null
        const canSubmit = !!d.can_submit
        setState({
          cycle: normal && {
            id: normal.id, name: normal.name, code: normal.code ?? null,
            status: normal.status, endDate: normal.end_date,
          },
          canSubmit,
          reason: canSubmit ? '' : (
            normal
              ? CLOSED_REASON[normal.status] ?? `The cycle is ${normal.status}.`
              : 'No cycle is open. An admin must open one before LOAs can be created.'
          ),
          loading: false,
        })
      })
      .catch(() => {
        // A context we could not load must not lock the button — the server is
        // the real gate, and a failed GET is not evidence the window is shut.
        if (alive) setState({ cycle: null, canSubmit: true, reason: '', loading: false })
      })
    return () => { alive = false }
  }, [])

  return state
}
