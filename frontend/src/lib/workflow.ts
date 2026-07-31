/**
 * LAURA — Workflow helpers for the LOA detail page.
 *
 * ⚠️ WORKFLOW_ORDER is inferred from the key order in tokens.ts'
 * `statusBadge` — it has not been confirmed against the actual backend
 * state machine / transition graph. Confirm before relying on it for
 * anything beyond rendering the stepper.
 */

import type { LOAStatus } from '@/types/loa'
import { statusBadge } from '@/styles/tokens'

/** Linear happy-path order. `rejected` and `closed` are branch states, not steps. */
export const WORKFLOW_ORDER: LOAStatus[] = [
  'draft',
  'emea_review',
  'global_review',
  'emea_post_global_review',
  'cmo_cfo_review',
  'emea_final_review',
  'corporate_review',
  'approved',
]

export function buildStepperSteps(status: LOAStatus) {
  const currentIndex = WORKFLOW_ORDER.indexOf(status)
  return WORKFLOW_ORDER.map((step, i) => ({
    key: step,
    label: statusBadge[step]?.label ?? step,
    done: currentIndex >= 0 && i <= currentIndex,
  }))
}

/**
 * Section visibility is NOT part of the permissions payload (can_view/
 * can_edit/can_comment/can_validate say nothing about Excel vs PPT) —
 * it comes from the role code itself.
 *
 * regional_cmo  → PPT only  (story & impact)
 * regional_cfo  → Excel only (data integrity)
 * everyone else → both, stacked (marketer, finance, emea_ps_editor,
 *                 global brand commenters, super-admin)
 */
export function getSectionVisibility(roleCode: string | null) {
  if (roleCode === 'regional_cmo') return { showExcel: false, showPpt: true }
  if (roleCode === 'regional_cfo') return { showExcel: true, showPpt: false }
  return { showExcel: true, showPpt: true }
}

export function statusStyle(status: LOAStatus) {
  const s = statusBadge[status]
  return s ? { bg: s.bg, color: s.text, border: s.border, label: s.label } : null
}
