'use client'
/**
 * /cycles/:id/list — the cycle's LOAs as a plain list.
 *
 * The fourth lens on a cycle, and the one that shows it the way a local marketer
 * sees their own: no slideshow, no grid, just the roster. It reuses the
 * `la-rolelist` markup RoleLOAList renders so the two read identically — an
 * admin checking "what does this look like to a marketer" gets the real answer,
 * not an approximation of it.
 *
 * Scoped to the cycle rather than to the viewer, which is the one deliberate
 * difference: a marketer's list is filtered to their own authorship, and an
 * admin opening a cycle folder wants everything in that cycle.
 */
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useCycleView } from '@/components/cycles/useCycleView'
import CycleViewFrame from '@/components/cycles/CycleViewFrame'
import StatusBadge from '@/components/StatusBadge'
import { loaDetail } from '@/lib/routes'
import { formatEuro } from '@/lib/euro'
import { loaMetaLine } from '@/lib/format'
import { newestFirst } from '@/lib/sort'
import type { LOA } from '@/types/loa'

export default function CycleListPage() {
  const params = useParams<{ cycleId: string }>()
  const cycleId = typeof params?.cycleId === 'string' ? params.cycleId : null
  const { cycle, loas, loading, error } = useCycleView(cycleId)
  const [search, setSearch] = useState('')

  const ordered = useMemo(() => newestFirst<LOA>(loas ?? []), [loas])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return ordered
    return ordered.filter(l =>
      [(l as any).display_title, l.description, l.loa_draft_id, l.country, l.brand, l.activity_type, l.cluster]
        .filter(Boolean)
        .some(v => String(v).toLowerCase().includes(q)),
    )
  }, [ordered, search])

  const total = visible.reduce((n, l) => n + (l.fy_2026_total || 0), 0)

  return (
    <CycleViewFrame
      cycleId={cycleId}
      cycleName={cycle?.name}
      active="list"
      loading={loading}
      error={error}
    >
      <div className="la-rolelist">
        <header className="la-rolelist-head">
          <div>
            <p className="la-rolelist-over">{cycle?.code || 'Cycle'}</p>
            <h1 className="la-rolelist-title">LOAs in this cycle</h1>
            <p className="la-rolelist-blurb">
              {`${visible.length} LOA${visible.length === 1 ? '' : 's'}`}
              {total > 0 && ` · ${formatEuro(total)}`}
              {' · Open one to see the Excel row and the slide together.'}
            </p>
          </div>

          <div className="la-rolelist-actions">
            <label className="la-rolelist-search">
              <span aria-hidden="true">⌕</span>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search this cycle"
                aria-label="Search this cycle"
              />
            </label>
          </div>
        </header>

        {visible.length === 0 ? (
          <p className="la-rolelist-msg">
            {search ? 'No LOA in this cycle matches that search.' : 'This cycle has no LOAs yet.'}
          </p>
        ) : (
          <ul className="la-rolelist-items">
            {visible.map(l => (
              <li key={l.id} className="la-rolelist-item">
                <Link href={loaDetail(l.id)} className="la-rolelist-link">
                  <span className="la-rolelist-name">
                    {(l as any).display_title || l.description || l.loa_draft_id || 'Untitled LOA'}
                  </span>
                  <span className="la-rolelist-meta">{loaMetaLine(l as any)}</span>
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
    </CycleViewFrame>
  )
}
