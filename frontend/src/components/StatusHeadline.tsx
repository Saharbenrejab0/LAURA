'use client'

import type { LOA } from '@/types/loa'

/**
 * #15 — Status headline (replaces the old DecisionSummary chain banner)
 *
 * A single elegant line at the top of the LOA detail page that tells the user
 * exactly what's happening now and what the next action is — forward-looking,
 * not a duplicate of the Timeline on the right.
 *
 * Drop it at the top of the detail page <main>, before the metrics grid.
 */

// Who acts at each step, and the human sentence to show.
const STEP_INFO: Record<string, { line: string }> = {
  emea_review: {
    line: 'Awaiting EMEA review \u2014 EMEA PS will move it to the next gate.',
  },
  global_review: {
    line: 'Awaiting comments from Global Brands.',
  },
  cmo_cfo_review: {
    line: 'Awaiting validation from the CMO and the CFO. Both must approve.',
  },
  global_functions_review: {
    line: 'Awaiting input from Global Functions.',
  },
  corporate_review: {
    line: 'Final gate \u2014 awaiting Corporate Finance.',
  },
}

function formatDate(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function StatusHeadline({ loa }: { loa: LOA }) {
  // Drafts: nothing has happened yet — show a gentle nudge.
  if (loa.status === 'draft') {
    return (
      <div className="mb-5 px-4 py-3 rounded-xl flex items-center gap-2.5"
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
        <span style={{ fontSize: '15px' }}>{'\u270E'}</span>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          This LOA is a draft. Submit it to start the approval workflow.
        </p>
      </div>
    )
  }

  // Approved: celebratory, with date.
  if (loa.status === 'approved') {
    const date = formatDate(loa.approved_at || loa.updated_at)
    return (
      <div className="mb-5 px-4 py-3 rounded-xl flex items-center gap-2.5"
        style={{ background: 'var(--green-bg)', border: '1px solid var(--green-border)' }}>
        <span style={{ fontSize: '15px', color: 'var(--green-text)' }}>{'\u2713'}</span>
        <p className="text-sm font-medium" style={{ color: 'var(--green-text)' }}>
          Fully approved{date ? ` on ${date}` : ''} — all gates cleared.
        </p>
      </div>
    )
  }

  // Rejected: show the reason inline.
  if (loa.status === 'rejected') {
    const date = formatDate(loa.updated_at)
    return (
      <div className="mb-5 px-4 py-3 rounded-xl"
        style={{ background: 'var(--red-bg)', border: '1px solid var(--red-border)' }}>
        <div className="flex items-center gap-2.5">
          <span style={{ fontSize: '15px', color: 'var(--red-text)' }}>{'\u2717'}</span>
          <p className="text-sm font-medium" style={{ color: 'var(--red-text)' }}>
            Sent back for changes{date ? ` on ${date}` : ''}.
          </p>
        </div>
        {loa.rejection_reason && (
          <p className="text-xs mt-1.5 ml-7" style={{ color: 'var(--red-text)', opacity: 0.85 }}>
            {'\u201C'}{loa.rejection_reason}{'\u201D'}
          </p>
        )}
      </div>
    )
  }

  // In review: show the contextual "what's next" line.
  const info = STEP_INFO[loa.status]
  const line = info ? info.line : 'This LOA is in review.'

  return (
    <div className="mb-5 px-4 py-3 rounded-xl flex items-center gap-2.5"
      style={{ background: 'var(--blue-bg)', border: '1px solid var(--blue-border)' }}>
      <span className="flex-shrink-0" style={{
        width: '8px', height: '8px', borderRadius: '50%',
        background: 'var(--accent)',
        boxShadow: '0 0 0 3px rgba(26,26,26,0.08)',
      }} />
      <p className="text-sm" style={{ color: 'var(--blue-text)' }}>{line}</p>
    </div>
  )
}
