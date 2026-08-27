'use client'

/**
 * LAURA — Corporate Review (Task 5, design element 9)
 * ---------------------------------------------------
 * The final gate. Every LOA sitting at `corporate_review` for this cycle,
 * with three verdicts per row:
 *   Approved (success) · On hold (gold outlined) · Rework (danger)
 *
 * On approve the row locks and collapses to a status chip + the inline
 * mono-gold IA code returned by the backend (format 2026-XXXX).
 * Bulk bar: Select all + Approve selected (runs sequentially so IA codes
 * never collide).
 *
 * Renders inside DesignShell automatically (non-bare route).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

import api, { getLOAs } from '@/lib/api'
import type { LOA } from '@/types/loa'
import { useToast } from '@/components/Toast'
import { Btn, Pill, Overline } from '@/components/ui/atoms'

const T_GOLD = '#B08D2F'
const T_CHAMP = '#E8D9B8'

function euro(n: number): string {
  if (!n) return '€0'
  if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `€${Math.round(n / 1_000)}k`
  return `€${Math.round(n)}`
}

type Verdict = 'approve' | 'hold' | 'rework'
const COLS = '34px 120px minmax(0,1fr) 170px 96px 280px'

export default function CorporateReviewPage() {
  const params = useParams<{ cycleId: string }>()
  const cycleId = params?.cycleId
  const { success, error: toastError } = useToast()

  const [loas, setLoas] = useState<LOA[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState<string | null>(null) // loa id, or 'bulk'

  const load = useCallback(() => {
    setLoading(true)
    getLOAs({ status: 'corporate_review' })
      .then((all) => {
        // Scope to this cycle; fall back to all corporate_review LOAs if the
        // cycle has none tagged (older LOAs may predate cycle_id).
        const inCycle = all.filter((l) => l.cycle_id === cycleId)
        setLoas(inCycle.length ? inCycle : all)
      })
      .catch(() => setLoas([]))
      .finally(() => setLoading(false))
  }, [cycleId])
  useEffect(() => { load() }, [load])

  const isPending = (l: LOA) => l.status === 'corporate_review'
  const pending = useMemo(() => loas.filter(isPending), [loas])
  const allSelected = pending.length > 0 && pending.every((l) => selected.has(l.id))

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(pending.map((l) => l.id)))
  }

  function applyResult(id: string, data: { status: string; ia_code?: string | null }) {
    setLoas((prev) => prev.map((l) => (l.id === id
      ? { ...l, status: data.status as LOA['status'], ia_code: data.ia_code ?? l.ia_code }
      : l)))
    setSelected((prev) => { const n = new Set(prev); n.delete(id); return n })
  }

  async function act(id: string, verdict: Verdict) {
    setBusy(id)
    try {
      const { data } = await api.post(`/corporate/${verdict}/${id}`)
      applyResult(id, data)
      success(verdict === 'approve' ? `Approved · ${data.ia_code}`
        : verdict === 'hold' ? 'Put on hold'
        : 'Sent back for rework')
    } catch (e: any) {
      toastError(e?.response?.data?.detail?.message || e?.response?.data?.detail || 'Action failed')
    } finally { setBusy(null) }
  }

  async function approveSelected() {
    const ids = pending.filter((l) => selected.has(l.id)).map((l) => l.id)
    if (ids.length === 0) return
    setBusy('bulk')
    let ok = 0
    // Sequential — each approve reads max(IA code)+1, so concurrent calls
    // could collide. One at a time keeps the sequence clean.
    for (const id of ids) {
      try {
        const { data } = await api.post(`/corporate/approve/${id}`)
        applyResult(id, data)
        ok++
      } catch { /* skip failures, keep going */ }
    }
    setBusy(null)
    if (ok > 0) success(`Approved ${ok} LOA${ok > 1 ? 's' : ''}`)
    if (ok < ids.length) toastError(`${ids.length - ok} could not be approved`)
  }

  const selectedCount = pending.filter((l) => selected.has(l.id)).length

  return (
    <div className="la-page" style={{ fontFamily: 'var(--font-sans)' }}>
      {/* Header */}
      <header style={{ marginBottom: 18 }}>
        <Overline>Corporate</Overline>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: '4px 0 0', fontFamily: 'var(--font-display)', fontSize: 34, lineHeight: 1.05, fontWeight: 600, color: 'var(--text-primary)' }}>Corporate Review</h1>
            <p style={{ margin: '8px 0 0', fontSize: 13.5, color: 'var(--text-secondary)' }}>
              {loading ? 'Loading…' : (
                <>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', fontWeight: 600 }}>{pending.length}</span>
                  {' '}awaiting your decision
                </>
              )}
            </p>
          </div>
          <Link href="/?scope=current" className="la-link" style={{ fontSize: 12.5 }}>← Back to tracker</Link>
        </div>
      </header>

      {/* Bulk bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
        padding: '10px 14px', marginBottom: 12, borderRadius: 10,
        border: `1px solid ${T_CHAMP}`, background: 'var(--surface-subtle)',
      }}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)', cursor: pending.length ? 'pointer' : 'not-allowed' }}>
          <input type="checkbox" checked={allSelected} disabled={pending.length === 0} onChange={toggleAll} style={{ accentColor: T_GOLD, cursor: 'inherit' }} />
          Select all
        </label>
        <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-secondary)' }}>{selectedCount}</span> selected
        </span>
        <div style={{ marginLeft: 'auto' }}>
          <Btn variant="primary" small onClick={approveSelected} disabled={selectedCount === 0 || busy !== null}>
            {busy === 'bulk' ? 'Approving…' : 'Approve selected'}
          </Btn>
        </div>
      </div>

      {/* Grid */}
      {loading ? null : loas.length === 0 ? (
        <div className="la-card" style={{ padding: '56px 24px', textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>Nothing at corporate review</div>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-tertiary)' }}>All clear for this cycle.</p>
        </div>
      ) : (
        <div className="la-card" style={{ overflow: 'hidden', padding: 0 }}>
          <div className="la-thead" style={{ display: 'grid', gridTemplateColumns: COLS, gap: 12 }}>
            <span />
            <span>LOA</span>
            <span>Activity</span>
            <span>Cluster / Country</span>
            <span style={{ textAlign: 'right' }}>FY26</span>
            <span style={{ textAlign: 'right' }}>Verdict</span>
          </div>

          {loas.map((l) => {
            const pend = isPending(l)
            const rowBusy = busy === l.id
            const title = (l as any).display_title || l.detail || l.description || l.activity_type || '—'
            return (
              <div key={l.id} className="la-row" style={{
                display: 'grid', gridTemplateColumns: COLS, gap: 12, alignItems: 'center',
                minHeight: 64, opacity: pend ? 1 : 0.72,
              }}>
                <span style={{ display: 'flex', justifyContent: 'center' }}>
                  <input type="checkbox" checked={selected.has(l.id)} disabled={!pend || busy !== null} onChange={() => toggleOne(l.id)} style={{ accentColor: T_GOLD, cursor: pend ? 'pointer' : 'not-allowed' }} />
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {l.loa_number || l.loa_draft_id}
                </span>
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.brand || '—'}</p>
                </div>
                <span style={{ fontSize: 12.5, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {l.cluster || '—'} · {l.country || '—'}
                </span>
                <span style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{euro(l.fy_2026_total || 0)}</span>

                {/* Verdict column */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
                  {pend ? (
                    <>
                      <button onClick={() => act(l.id, 'approve')} disabled={busy !== null}
                        style={verdictStyle('success', rowBusy)}>Approve</button>
                      <button onClick={() => act(l.id, 'hold')} disabled={busy !== null}
                        style={verdictStyle('hold', rowBusy)}>On hold</button>
                      <button onClick={() => act(l.id, 'rework')} disabled={busy !== null}
                        style={verdictStyle('rework', rowBusy)}>Rework</button>
                    </>
                  ) : (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <Pill status={l.status} />
                      {l.status === 'approved' && l.ia_code && (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: T_GOLD, letterSpacing: '.02em' }}>{l.ia_code}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* Three verdict button styles — success / gold-outlined hold / danger.
   Red appears at most twice on a row (Rework text + border), within budget. */
function verdictStyle(kind: 'success' | 'hold' | 'rework', busy: boolean): React.CSSProperties {
  const base: React.CSSProperties = {
    height: 30, padding: '0 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
    fontFamily: 'var(--font-sans)', cursor: busy ? 'wait' : 'pointer',
    background: 'transparent', border: '1px solid transparent', whiteSpace: 'nowrap',
    transition: 'all .15s ease',
  }
  if (kind === 'success') return { ...base, color: 'var(--st-approved-fg)', borderColor: 'var(--st-approved-fg)' }
  if (kind === 'hold') return { ...base, color: T_GOLD, borderColor: T_GOLD }
  return { ...base, color: 'var(--danger)', borderColor: 'var(--danger)' }
}
