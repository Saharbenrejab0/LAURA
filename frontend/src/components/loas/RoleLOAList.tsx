'use client'
/**
 * RoleLOAList — the bulleted LOA list that single-screen roles land on.
 *
 * Spec item 4 gives Local Marketer, Local Alignment, Global Function Review and
 * Global Brand Review the same shape: a bulleted list, then click through to the
 * split-screen. The only differences are which LOAs are in the list and what the
 * viewer may do once inside, so this is one component with a scope, not four.
 *
 *   marketer  → only their OWN LOAs; may create and edit
 *   alignment → the LOAs at THEIR stage; may comment and approve, never reject
 *
 * Ordering comes from the data layer (newest-first) — this component does not
 * sort. That is the point of lib/sort.ts.
 */
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import type { LOA } from '@/types/loa'
import { getLOAs, getStoredUser } from '@/lib/api'
import { fetchAlignmentQueue } from '@/lib/review-api'
import type { AlignmentStage } from '@/types/review'
import { newestFirst } from '@/lib/sort'
import { formatEuro } from '@/lib/euro'
import { loaMetaLine } from '@/lib/format'
import { loaDetail, ROUTES } from '@/lib/routes'
import StatusBadge from '@/components/StatusBadge'
import type { Interface } from '@/lib/roles'
import { canCreateLOAs } from '@/lib/roles'
import { useCycleWindow } from '@/hooks/useCycleWindow'

/** Which alignment stage a reviewer role acts on. Handles both canonical codes and domain-expert patterns. */
function stageForRole(code: string): AlignmentStage | undefined {
  if (code === 'local_alignment' || code.endsWith('_finance') || code.endsWith('_procurement') || code.endsWith('_compliance')) return 'local_alignment'
  if (code === 'global_function_review' || code.startsWith('global_function_') || code === 'emea_commenter_tm') return 'global_function_review'
  if (code === 'global_brand_review' || code.startsWith('global_brand_')) return 'global_brand_review'
  return undefined
}

export default function RoleLOAList({
  iface,
  roleCode,
  roleLabel,
}: {
  iface: Interface
  roleCode: string
  roleLabel: string
}) {
  const [loas, setLoas] = useState<LOA[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const stage = stageForRole(roleCode)
  const myEmail = (getStoredUser() as any)?.email ?? ''
  const cycleWindow = useCycleWindow()

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)

    const load = stage
      ? fetchAlignmentQueue(stage).then(r => (r as any)?.loas ?? [])
      : getLOAs().then(rows =>
          // Marketers see only their own. The API already scope-filters, but a
          // marketer's scope is their cluster, not themselves — so narrow to
          // authorship here as well.
          rows.filter(l => l.requestor_email === myEmail),
        )

    load
      .then((rows: LOA[]) => { if (alive) setLoas(newestFirst<LOA>(rows)) })
      .catch((e: any) => {
        if (alive) setError(e?.response?.data?.detail || 'Could not load your LOAs.')
      })
      .finally(() => { if (alive) setLoading(false) })

    return () => { alive = false }
  }, [stage, myEmail])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return loas
    return loas.filter(l =>
      [(l as any).display_title, l.description, l.loa_draft_id, l.country, l.brand, l.activity_type, l.cluster]
        .filter(Boolean)
        .some(v => String(v).toLowerCase().includes(q)),
    )
  }, [loas, search])

  const heading = stage ? 'LOAs at your stage' : 'Your LOAs'
  const blurb = stage
    ? 'Open one to review the row and the slide together. Comment where needed, then approve.'
    : 'Open one to see the Excel row and the slide together.'

  return (
    <div className="la-rolelist">
      <header className="la-rolelist-head">
        <div>
          <p className="la-rolelist-over">{roleLabel}</p>
          <h1 className="la-rolelist-title">{heading}</h1>
          <p className="la-rolelist-blurb">
            {loading ? 'Loading…' : `${visible.length} LOA${visible.length === 1 ? '' : 's'} · ${blurb}`}
          </p>
        </div>

        <div className="la-rolelist-actions">
          <label className="la-rolelist-search">
            <span aria-hidden="true">⌕</span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search your list"
              aria-label="Search your list"
            />
          </label>
          {canCreateLOAs(iface) && (
            cycleWindow.canSubmit ? (
              <Link href={ROUTES.loaNewType} className="la-rolelist-new">+ New LOA</Link>
            ) : (
              <span
                className="la-rolelist-new"
                title={cycleWindow.reason}
                aria-disabled="true"
                style={{ opacity: 0.4, cursor: 'not-allowed' }}
              >+ New LOA</span>
            )
          )}
        </div>
      </header>

      {error ? (
        <p className="la-rolelist-msg" role="alert">{error}</p>
      ) : loading ? (
        <p className="la-rolelist-msg">Loading…</p>
      ) : visible.length === 0 ? (
        <p className="la-rolelist-msg">
          {stage
            ? 'Nothing is waiting on you right now.'
            : search
              ? 'No LOA in your list matches that search.'
              : 'You have not created an LOA yet.'}
        </p>
      ) : (
        /* A real <ul> — the spec asks for a bulleted list, and it is also what
           gives screen readers the item count for free. */
        <ul className="la-rolelist-items">
          {visible.map(l => (
            <li key={l.id} className="la-rolelist-item">
              <Link href={loaDetail(l.id)} className="la-rolelist-link">
                <span className="la-rolelist-name">
                  {(l as any).display_title || l.description || l.loa_draft_id || 'Untitled LOA'}
                </span>
                <span className="la-rolelist-meta">
                  {loaMetaLine(l as any)}
                </span>
                <span className="la-rolelist-amount">
                  {l.fy_2026_total ? formatEuro(l.fy_2026_total) : '—'}
                </span>
                <StatusBadge status={l.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
