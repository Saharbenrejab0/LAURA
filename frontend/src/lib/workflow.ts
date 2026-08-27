/**
 * LAURA — Workflow helpers for the LOA detail page.
 *
 * WORKFLOW_ORDER matches backend/api/loa.py's WORKFLOW_ORDER exactly, verified
 * against the running state machine. It is the single source every stage
 * sequence in the UI renders from — the split-screen stepper, the Admin
 * Console's Approval Chain screen, and the LOA detail page. A second stage list
 * anywhere else is a bug: the chain would drift the moment the backend changed.
 */

import type { LOAStatus } from '@/types/loa'
import { statusBadge } from '@/styles/tokens'

/** Linear happy-path order. `rejected` and `returned` are branch states, not steps. */
export const WORKFLOW_ORDER: LOAStatus[] = [
  'draft',
  'local_alignment',
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

// ── The chain, as every stage sequence in the UI renders it ──────────────────

/**
 * Per-gate display metadata, keyed by status code.
 *
 * This is NOT a second stage list — the ORDER comes from WORKFLOW_ORDER and
 * nothing here can add, remove or reorder a gate. It only says how to write one
 * down. A gate missing from this map still renders, from its status code.
 *
 * Note what is deliberately absent: any splitting of `global_review` or
 * `cmo_cfo_review`. Each is ONE gate whose sub-reviews run in parallel — the
 * LOA sits at a single status while both reviewers work. Rendering them as two
 * sequential boxes is what the old 4-step stepper got wrong.
 */
export const GATE_DISPLAY: Partial<Record<LOAStatus, {
  /** Full name, shown on the active gate and in tooltips. */
  label: string
  /** Two or three characters for the compact circle. */
  short: string
  /** Who owns the gate — used by the Admin Console's chain screen. */
  owner: string
}>> = {
  local_alignment:         { label: 'Local Alignment',                short: 'LA',  owner: 'Local Alignment · Finance / Procurement / Compliance (3 sub-gates)' },
  emea_review:             { label: 'EMEA Review',                    short: 'EM',  owner: 'EMEA PS Editor' },
  global_review:           { label: 'Global Function / Global Brand', short: 'GL',  owner: 'Global Brand + Global Function (2 parallel sub-gates)' },
  emea_post_global_review: { label: 'EMEA Post-Review',               short: 'EM2', owner: 'EMEA PS Editor' },
  cmo_cfo_review:          { label: 'CMO / CFO',                      short: 'CC',  owner: 'Regional CMO + Regional CFO (2 parallel sub-gates)' },
  emea_final_review:       { label: 'EMEA Final',                     short: 'EM3', owner: 'EMEA PS Editor' },
  corporate_review:        { label: 'Corporate Finance',              short: 'CF',  owner: 'Corporate Marketing Finance (Paola + Diana)' },
  approved:                { label: 'Approved',                       short: '✓',   owner: '— terminal state' },
}

export interface ChainStep {
  key: LOAStatus
  label: string
  short: string
  owner: string
  /** 1-based position among the gates. The terminal `approved` marker has none. */
  index: number | null
  done: boolean
  current: boolean
  /** The end marker, not a gate you wait at. */
  terminal: boolean
}

/**
 * The gates an LOA passes through, with live position.
 *
 * `draft` is dropped — by the time a chain is on screen the LOA has been
 * submitted — and `approved` is kept as the end marker rather than a gate.
 * Every role sees all of them: a marketer needs to know what is ahead, and a
 * reviewer needs to know what came before.
 */
export function buildChain(status: LOAStatus | string): ChainStep[] {
  // Typed explicitly: .filter() narrows the element type to exclude 'draft',
  // which then rejects a plain LOAStatus in the indexOf below.
  const gates: LOAStatus[] = WORKFLOW_ORDER.filter(s => s !== 'draft')
  // A branch state (returned / rejected) sits off the chain, so nothing is
  // current and nothing reads as done — the chain restarts from the top.
  const currentIndex = gates.indexOf(status as LOAStatus)
  let gateNo = 0

  return gates.map((key, i) => {
    const terminal = key === 'approved'
    if (!terminal) gateNo += 1
    const d = GATE_DISPLAY[key]
    return {
      key,
      label: d?.label ?? key.replace(/_/g, ' '),
      short: d?.short ?? String(gateNo),
      owner: d?.owner ?? '—',
      index: terminal ? null : gateNo,
      done: currentIndex >= 0 && i < currentIndex,
      current: currentIndex >= 0 && i === currentIndex,
      terminal,
    }
  })
}

/** What is happening right now, in one sentence, for the line under the stepper. */
export function chainStatusLabel(status: LOAStatus | string): string {
  switch (status) {
    case 'local_alignment':         return 'Awaiting Local Alignment review'
    case 'emea_review':             return 'Under EMEA review'
    case 'global_review':           return 'Awaiting Global Function and Global Brand review'
    case 'emea_post_global_review': return 'Under EMEA post-global review'
    case 'cmo_cfo_review':          return 'Awaiting CMO and CFO review'
    case 'emea_final_review':       return 'Under EMEA final review'
    case 'corporate_review':        return 'Awaiting Corporate Finance validation'
    case 'approved':                return 'Approved'
    case 'returned':                return 'Returned to marketer for edits'
    case 'rejected':                return 'Rejected — awaiting resubmission'
    case 'draft':                   return 'Draft — not yet submitted'
    default:                        return String(status).replace(/_/g, ' ')
  }
}

/** Branch states get warning styling rather than a position on the chain. */
export function isOffChain(status: LOAStatus | string): boolean {
  return status === 'returned' || status === 'rejected'
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
