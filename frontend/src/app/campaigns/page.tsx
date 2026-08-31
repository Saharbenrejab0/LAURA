'use client'

/**
 * Campaign Library — one nav entry, two stores, no shared query.
 *
 * Replaces two entries that both misled:
 *   "Past Campaigns"       was a template picker whose contents were 99.4%
 *                          imported history, with nothing on screen saying so.
 *   "Historical Campaigns"  sat beside it showing the same rows, correctly
 *                          filtered, so the two looked like duplicates.
 *
 * Merged on the surface only. Each tab owns its endpoint:
 *   Completed LAURA cycles  /cycles?status=closed  →  /cycles/{id}/loas
 *   Imported history        /historical/excel
 *
 * There is no UNION anywhere and no combined result set. If one grid ever shows
 * a mixed `source`, the domain separation has been lost — that is the regression
 * to watch for. See lib/campaign-library.ts.
 */

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

import {
  fetchClosedCycles, fetchCycleLoas, fetchHistoricalGrid, fetchImportBatches,
  useAsStartingPoint, stashCarriedContext, groupByYearQuarter, matchesSearch, campaignTitle,
  periodOf, periodLabel,
  type Cycle, type ImportBatch, type HistoricalRow, type DuplicateResult,
} from '@/lib/campaign-library'
import { formatBudget, formatEuro } from '@/lib/euro'
import { activityLabel } from '@/types/loa'
import type { LOA } from '@/types/loa'
import { useMyRole } from '@/hooks/usePermissions'
import { useToast } from '@/components/Toast'
import { statusBadge } from '@/styles/tokens'

type Tab = 'completed' | 'imported'

export default function CampaignLibraryPage() {
  const router = useRouter()
  const { info, error: toastError } = useToast()
  const { role } = useMyRole()
  const isAdmin = !!role?.can_override_lock

  const [tab, setTab] = useState<Tab>('completed')
  const [search, setSearch] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  // ── Tab 1 state: closed cycles ────────────────────────────────────────────
  const [cycles, setCycles] = useState<Cycle[]>([])
  const [cycleLoas, setCycleLoas] = useState<Record<string, LOA[]>>({})
  const [openCycle, setOpenCycle] = useState<string | null>(null)
  const [loadingCycles, setLoadingCycles] = useState(true)

  // ── Tab 2 state: imported history ─────────────────────────────────────────
  const [rows, setRows] = useState<HistoricalRow[]>([])
  const [batches, setBatches] = useState<ImportBatch[]>([])
  const [batchId, setBatchId] = useState('')
  const [yearFilter, setYearFilter] = useState('')
  const [quarterFilter, setQuarterFilter] = useState('')
  const [loadingRows, setLoadingRows] = useState(true)
  const [histError, setHistError] = useState<string | null>(null)

  useEffect(() => {
    fetchClosedCycles()
      .then(setCycles)
      .catch(() => setCycles([]))
      .finally(() => setLoadingCycles(false))
    fetchImportBatches().then(setBatches).catch(() => setBatches([]))
  }, [])

  useEffect(() => {
    let alive = true
    setLoadingRows(true)
    setHistError(null)
    fetchHistoricalGrid(batchId || undefined)
      .then(d => { if (alive) setRows(d.rows) })
      .catch(e => { if (alive) setHistError(e?.response?.data?.detail || 'Could not load imported history.') })
      .finally(() => { if (alive) setLoadingRows(false) })
    return () => { alive = false }
  }, [batchId])

  // ── Expanding a closed cycle loads its LOAs once ──────────────────────────
  function toggleCycle(id: string) {
    const next = openCycle === id ? null : id
    setOpenCycle(next)
    if (next && !cycleLoas[next]) {
      fetchCycleLoas(next)
        .then(l => setCycleLoas(prev => ({ ...prev, [next]: l })))
        .catch(() => setCycleLoas(prev => ({ ...prev, [next]: [] })))
    }
  }

  // ── "Use as starting point" — shared by both tabs ──────────────────────────
  //
  // Identical for a completed-cycle LOA and an imported one, on purpose: reuse
  // should not behave differently depending on where the campaign came from.
  // What differs is the OUTCOME — a completed-cycle LOA passed LAURA's own
  // validation, so its controlled fields arrive intact and nothing is flagged;
  // an imported row from 2024 may carry values that no longer exist.
  async function startFrom(loaId: string, label: string, kind: 'completed_cycle' | 'imported_history') {
    setBusyId(loaId)
    try {
      const res: DuplicateResult = await useAsStartingPoint(loaId)
      const cleared = res.warnings.filter(w => w.severity === 'invalid_cleared').length
      const fixed = res.warnings.filter(w => w.severity === 'auto_fixed').length

      // Hand the per-field warnings to the form — different page, so it never
      // saw this response.
      stashCarriedContext(res.id, { sourceTitle: label, sourceKind: kind, warnings: res.warnings })

      if (cleared > 0) {
        info(`Draft created from "${label}" — ${cleared} field${cleared > 1 ? 's' : ''} could not be carried over and need${cleared > 1 ? '' : 's'} your input.`)
      } else if (fixed > 0) {
        info(`Draft created from "${label}" — ${fixed} value${fixed > 1 ? 's' : ''} updated to current reference data.`)
      } else {
        info(`Draft created from "${label}".`)
      }
      router.push(`/loa/new?edit=${res.id}&from=library`)
    } catch (e: any) {
      toastError(e?.response?.data?.detail || 'Could not create a draft from this campaign.')
    } finally {
      setBusyId(null)
    }
  }

  // ── Tab 2 derived: filters then Year → Quarter grouping ───────────────────
  const years = useMemo(() => {
    const s = new Set<string>()
    rows.forEach(r => { const p = periodOf(r); if (p.year) s.add(String(p.year)) })
    return [...s].sort((a, b) => Number(b) - Number(a))
  }, [rows])

  const visibleRows = useMemo(() => rows.filter(r => {
    if (!matchesSearch(r, search, isAdmin)) return false
    const p = periodOf(r)
    if (yearFilter && String(p.year ?? '') !== yearFilter) return false
    if (quarterFilter && (p.quarter ?? '') !== quarterFilter) return false
    return true
  }), [rows, search, isAdmin, yearFilter, quarterFilter])

  const grouped = useMemo(() => groupByYearQuarter(visibleRows), [visibleRows])

  // ── Tab 1 derived: search inside each cycle's loaded LOAs ─────────────────
  const visibleCycles = useMemo(() => {
    if (!search.trim()) return cycles
    // A cycle stays visible if its name matches, or any LOA we have loaded does.
    const q = search.trim().toLowerCase()
    return cycles.filter(c =>
      (c.name || '').toLowerCase().includes(q) ||
      (c.code || '').toLowerCase().includes(q) ||
      (cycleLoas[c.id] || []).some(l => matchesSearch(l, search, isAdmin))
    )
  }, [cycles, cycleLoas, search, isAdmin])

  const importedTotal = visibleRows.reduce((s, r) => s + (r.fy_2026_total || r.fy_2025_total || 0), 0)

  return (
    <div className="la-lib">
      <header className="la-lib-head">
        <div>
          <p className="la-lib-over">Archive</p>
          <h1 className="la-lib-title">Campaign Library</h1>
          <p className="la-lib-blurb">
            Reuse past work as a starting point for a new LOA. Completed LAURA cycles kept
            their full approval history; imported history came from the client&rsquo;s own files
            and never went through a review.
          </p>
        </div>
        <div className="la-lib-actions">
          <label className="la-sr-only" htmlFor="la-lib-search">Search campaigns</label>
          <input
            id="la-lib-search"
            className="la-lib-search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search brand, activity, country, vendor, year, budget…"
          />
        </div>
      </header>

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <div className="la-lib-tabs" role="tablist">
        <button
          role="tab" aria-selected={tab === 'completed'}
          className={`la-lib-tab${tab === 'completed' ? ' is-on' : ''}`}
          onClick={() => setTab('completed')}
        >
          Completed LAURA Cycles
          <span className="la-lib-count">{visibleCycles.length}</span>
        </button>
        <button
          role="tab" aria-selected={tab === 'imported'}
          className={`la-lib-tab${tab === 'imported' ? ' is-on' : ''}`}
          onClick={() => setTab('imported')}
        >
          Imported History
          <span className="la-lib-count">{visibleRows.length}</span>
        </button>
      </div>

      {/* ═════════ TAB 1 — Completed LAURA cycles ═════════ */}
      {tab === 'completed' && (
        <section role="tabpanel">
          <div className="la-lib-banner is-laura">
            <span aria-hidden="true">✓</span>
            <span>
              <strong>LAURA&rsquo;s own finished work.</strong> These are the same LOA records that
              were live — same ids, same approvals, same comments. Read-only now that their
              cycle is closed.
            </span>
          </div>

          {/* Closed cycles exist but none of them holds an LOA — the state the
              database is actually in today. Saying so beats an empty list that
              looks like a loading failure, and beats hiding the cycles, which
              did close and are real. */}
          {!loadingCycles && cycles.length > 0 && cycles.every(c => !c.totalLoas) && (
            <p className="la-lib-msg" style={{ paddingTop: 0 }}>
              {cycles.length} cycle{cycles.length > 1 ? 's have' : ' has'} closed so far, none with LOAs in
              {cycles.length > 1 ? ' them' : ' it'}. The first cycle to close with approved work will show
              its LOAs here, ready to reuse.
            </p>
          )}

          {loadingCycles ? (
            <p className="la-lib-msg">Loading completed cycles…</p>
          ) : visibleCycles.length === 0 ? (
            <div className="la-lib-empty">
              <p className="la-lib-empty-title">
                {cycles.length === 0 ? 'No completed cycles yet.' : 'No completed cycle matches that search.'}
              </p>
              <p className="la-lib-empty-sub">
                {cycles.length === 0
                  ? 'When a live cycle closes, its LOAs will appear here with the approvals they finished with.'
                  : 'Clear the search to see all completed cycles.'}
              </p>
            </div>
          ) : (
            <ul className="la-lib-cycles">
              {visibleCycles.map(c => {
                const isOpen = openCycle === c.id
                const loas = cycleLoas[c.id]
                return (
                  <li key={c.id} className="la-lib-cycle">
                    <button className="la-lib-cycle-head" onClick={() => toggleCycle(c.id)} aria-expanded={isOpen}>
                      <span className="la-lib-chev" aria-hidden="true">{isOpen ? '▾' : '▸'}</span>
                      <span className="la-lib-cycle-name">
                        {c.name}
                        {c.code && <span className="la-lib-code">{c.code}</span>}
                      </span>
                      <span className="la-lib-cycle-meta">
                        {c.startDate && (
                          <span>
                            {new Date(c.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                            {c.endDate && ` → ${new Date(c.endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                          </span>
                        )}
                        <span><strong>{c.totalLoas}</strong> LOAs</span>
                        <span><strong>{formatBudget(c.totalBudget || 0)}</strong></span>
                        {c.closedAt && (
                          <span className="la-lib-dim">
                            Closed {new Date(c.closedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                            {c.closedBy ? ` by ${c.closedBy}` : ''}
                          </span>
                        )}
                      </span>
                    </button>

                    {isOpen && (
                      loas == null ? (
                        <p className="la-lib-msg is-inset">Loading this cycle&rsquo;s LOAs…</p>
                      ) : loas.length === 0 ? (
                        <p className="la-lib-msg is-inset">This cycle closed with no LOAs in it.</p>
                      ) : (
                        <ul className="la-lib-rows">
                          {loas
                            .filter(l => matchesSearch(l, search, isAdmin))
                            .map(l => (
                              <CampaignRow
                                key={l.id}
                                loa={l}
                                busy={busyId === l.id}
                                onStart={() => startFrom(l.id, campaignTitle(l), 'completed_cycle')}
                                showWorkflow
                              />
                            ))}
                        </ul>
                      )
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      )}

      {/* ═════════ TAB 2 — Imported history ═════════ */}
      {tab === 'imported' && (
        <section role="tabpanel">
          <div className="la-lib-banner is-imported">
            <span aria-hidden="true">🗄</span>
            <span>
              <strong>Imported from client records.</strong> Outside the review cycles, never
              decided on here. Grouped by the period the campaign ran.
            </span>
            <span className="la-lib-stats">
              <span><strong>{visibleRows.length}</strong> LOAs</span>
              <span><strong>{formatBudget(importedTotal)}</strong></span>
            </span>
          </div>

          <div className="la-lib-filters">
            <label className="la-sr-only" htmlFor="la-lib-year">Year</label>
            <select id="la-lib-year" className="la-lib-select" value={yearFilter} onChange={e => setYearFilter(e.target.value)}>
              <option value="">All years</option>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>

            <label className="la-sr-only" htmlFor="la-lib-quarter">Quarter</label>
            <select id="la-lib-quarter" className="la-lib-select" value={quarterFilter} onChange={e => setQuarterFilter(e.target.value)}>
              <option value="">All quarters</option>
              {['Q1', 'Q2', 'Q3', 'Q4'].map(q => <option key={q} value={q}>{q}</option>)}
            </select>

            {isAdmin && (
              <>
                <label className="la-sr-only" htmlFor="la-lib-batch">Import batch</label>
                <select id="la-lib-batch" className="la-lib-select" value={batchId} onChange={e => setBatchId(e.target.value)}>
                  <option value="">All import batches</option>
                  {batches.map(b => <option key={b.id} value={b.id}>{b.label} · {b.rowCount}</option>)}
                </select>
              </>
            )}

            {/* /historical is kept, not redirected: it renders this same data
                through the CFO spreadsheet (every column, frozen headers,
                category grouping), which the library's row list does not
                replace. It just no longer needs its own nav entry. */}
            <button
              className="la-lib-select"
              onClick={() => router.push(`/historical${batchId ? `?batch=${batchId}` : ''}`)}
              style={{ borderColor: 'var(--accent)', color: 'var(--accent)', fontWeight: 600 }}
            >
              Open spreadsheet view →
            </button>
          </div>

          {histError ? (
            <p className="la-lib-msg" role="alert">{histError}</p>
          ) : loadingRows ? (
            <p className="la-lib-msg">Loading imported history…</p>
          ) : visibleRows.length === 0 ? (
            <div className="la-lib-empty">
              <p className="la-lib-empty-title">Nothing matches those filters.</p>
              <p className="la-lib-empty-sub">Clear the search, year or quarter to see all imported campaigns.</p>
            </div>
          ) : (
            <div className="la-lib-years">
              {grouped.map(g => (
                <div key={g.label} className="la-lib-year">
                  <div className="la-lib-year-head">
                    <h2 className="la-lib-year-title">{g.label}</h2>
                    <span className="la-lib-year-meta">
                      <span><strong>{g.count}</strong> campaigns</span>
                      <span><strong>{formatBudget(g.total)}</strong></span>
                    </span>
                  </div>
                  {g.quarters.map(q => (
                    <div key={`${g.label}-${q.label}`} className="la-lib-quarter">
                      <div className="la-lib-quarter-head">
                        <span className="la-lib-quarter-title">{q.label}</span>
                        <span className="la-lib-dim">{q.rows.length} · {formatBudget(q.total)}</span>
                      </div>
                      <ul className="la-lib-rows">
                        {q.rows.map(r => (
                          <CampaignRow
                            key={r.id}
                            loa={r}
                            busy={busyId === r.id}
                            onStart={() => startFrom(r.id, campaignTitle(r), 'imported_history')}
                            provenance={isAdmin ? (r.source_file || r.importBatchLabel || null) : null}
                          />
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════
//  One campaign row — identical in both tabs, so reuse never looks different
//  depending on where the campaign came from.
// ════════════════════════════════════════════════════════════════════════

function CampaignRow({
  loa, busy, onStart, showWorkflow = false, provenance = null,
}: {
  loa: LOA & Record<string, any>
  busy: boolean
  onStart: () => void
  /** Completed-cycle LOAs show the approval state they finished with. */
  showWorkflow?: boolean
  /** Admin-only source file / batch label, imported rows only. */
  provenance?: string | null
}) {
  const badge = statusBadge[loa.status as keyof typeof statusBadge]
  const total = loa.fy_2026_total || loa.fy_2025_total || 0

  return (
    <li className="la-lib-row">
      <div className="la-lib-row-main">
        <p className="la-lib-row-title">{campaignTitle(loa)}</p>
        <p className="la-lib-row-sub">
          {[
            loa.country,
            activityLabel(loa.activity_type as string),
            periodLabel(periodOf(loa)),
            Array.isArray(loa.category) ? loa.category.join(' + ') : loa.category,
          ].filter(Boolean).join(' · ')}
        </p>
        {provenance && <p className="la-lib-row-prov">from {provenance}</p>}
      </div>

      {showWorkflow && (
        <div className="la-lib-row-flow">
          {badge && (
            <span
              className="la-lib-badge"
              style={{ color: badge.text, background: badge.bg, borderColor: badge.border }}
            >
              {badge.label}
            </span>
          )}
          {loa.ia_code && <span className="la-lib-ia">IA {loa.ia_code}</span>}
          {loa.approved_at && (
            <span className="la-lib-dim">
              {new Date(loa.approved_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          )}
        </div>
      )}

      <span className="la-lib-row-budget">{total ? formatEuro(total) : '—'}</span>

      <button className="la-lib-use" onClick={onStart} disabled={busy}>
        {busy ? 'Creating…' : 'Use as starting point'}
      </button>
    </li>
  )
}
