'use client'

import type { LOA } from '@/types/loa'
import type { LOAPermissions } from '@/hooks/usePermissions'

const STEP_ACTOR: Record<string, string> = {
  emea_review: 'EMEA PS',
  global_review: 'Global Brands',
  cmo_cfo_review: 'the CMO and the CFO',
  global_functions_review: 'Global Functions',
  corporate_review: 'Corporate Finance',
}

export default function WhyDisabled({
  loa,
  permissions,
}: {
  loa: LOA
  permissions: LOAPermissions | null
}) {
  if (loa.status === 'approved' || loa.status === 'rejected' || loa.status === 'draft') {
    return null
  }

  if (permissions?.can_validate) return null

  let reason: string

  if (loa.is_locked && !permissions?.can_override_lock) {
    reason = 'This LOA is locked by a super-admin. Actions are paused until it is unlocked.'
  } else if (permissions?.can_comment) {
    const actor = STEP_ACTOR[loa.status] || 'the assigned reviewer'
    reason = `You can comment at this step, but only ${actor} can move this LOA forward.`
  } else if (permissions?.can_view) {
    const actor = STEP_ACTOR[loa.status] || 'the assigned reviewer'
    reason = `Only ${actor} can act at this step. You have view access only.`
  } else {
    reason = 'You do not have access to act on this LOA at this stage.'
  }

  return (
    <div className="rounded-lg px-3 py-2.5 flex items-start gap-2"
      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
      <span className="flex-shrink-0" style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.4 }}>{'\u24D8'}</span>
      <p className="text-xs" style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}>{reason}</p>
    </div>
  )
}