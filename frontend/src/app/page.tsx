'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getLOAs } from '@/lib/api'
import { useMyRole } from '@/hooks/usePermissions'
import type { LOA } from '@/types/loa'
import { ThemeToggle } from '@/components/ThemeProvider'
import { useToast } from '@/components/Toast'

function formatEuros(n: number) {
  if (!n) return '€0'
  if (n >= 1_000_000) return `€${(n/1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `€${Math.round(n/1_000)}k`
  return `€${n}`
}

// Format category: handles both string (legacy) and string[] (new multi-select)
function formatCategory(cat: string | string[] | undefined | null): string {
  if (!cat) return '—'
  if (Array.isArray(cat)) return cat.length ? cat.join(' + ') : '—'
  return String(cat)
}

// Format short relative time
function timeAgo(iso: string | undefined | null): string {
  if (!iso) return '—'
  const then = new Date(iso).getTime()
  if (!then) return '—'
  const diff = Date.now() - then
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff/60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff/3_600_000)}h ago`
  if (diff < 30 * 86_400_000) return `${Math.floor(diff/86_400_000)}d ago`
  return new Date(iso).toLocaleDateString()
}

// Derive a short action label from LOA state
function lastAction(loa: LOA): string {
  if (loa.status === 'approved') return 'approved'
  if (loa.status === 'rejected') return 'rejected'
  if (loa.status === 'submitted') return 'submitted'
  if (loa.status === 'local_prep') return 'submitted'
  if (loa.status === 'country_review') return 'in country review'
  if (loa.status === 'global_review') return 'in global review'
  if (loa.status === 'brand_review') return 'in review'
  if (loa.status === 'cmo_review') return 'in CMO review'
  if (loa.status === 'cfo_review') return 'in CFO review'
  if (loa.status === 'corporate_review') return 'in corporate review'
  if (loa.status === 'ceo_validation') return 'awaiting CEO'
  if (loa.status === 'draft') return 'edited'
  if (loa.status === 'locked') return 'locked'
  return 'updated'
}

// Status labels cover BOTH legacy statuses (for historical LOAs) AND new
// Sprint 2 statuses (for LOAs going through the 9-step workflow).
const STATUS: Record<string, { label: string; cls: string }> = {
  // Legacy statuses (kept for historical LOAs imported from before Sprint 2)
  draft:            { label: 'Draft',            cls: 'badge-draft' },
  submitted:        { label: 'Submitted',        cls: 'badge-submitted' },
  brand_review:     { label: 'Brand review',     cls: 'badge-brand-review' },
  // New Sprint 2 workflow statuses
  local_prep:       { label: 'Local prep',       cls: 'badge-submitted' },
  country_review:   { label: 'Country review',   cls: 'badge-submitted' },
  global_review:    { label: 'Global review',    cls: 'badge-brand-review' },
  cmo_review:       { label: 'CMO review',       cls: 'badge-cmo-review' },
  cfo_review:       { label: 'CFO review',       cls: 'badge-cfo-review' },
  corporate_review: { label: 'Corporate review', cls: 'badge-cfo-review' },
  ceo_validation:   { label: 'CEO validation',   cls: 'badge-cmo-review' },
  approved:         { label: 'Approved',         cls: 'badge-approved' },
  rejected:         { label: 'Rejected',         cls: 'badge-rejected' },
  locked:           { label: 'Locked',           cls: 'badge-rejected' },
}

const CLUSTERS = ['FRANCE','ITALY','DACH','IBERIA','NORTH','META','EAST','EMEA','RUSSIA']

const PAGE_SIZE = 50

const GRID_COLS = 'grid-cols-[24px_110px_1fr_130px_90px_90px_60px_130px_100px]'

export default function TrackerPage() {
  const router = useRouter()
  const { info } = useToast()

  // Sprint 2.5: fetch the current user's role from the backend.
  // This gives us role_code, scope_type, can_override_lock — used to
  // tailor the UI to what the user is allowed to do.
  const { role, loading: roleLoading } = useMyRole()

  const [loas, setLOAs]              = useState<LOA[]>([])
  const [loading, setLoading]        = useState(true)
  const [filterStatus, setFS]        = useState('')
  const [filterCluster, setFC]       = useState('')
  const [filterQuarter, setFQ]       = useState('')
  const [search, setSearch]          = useState('')
  const [page, setPage]              = useState(1)
  const [user, setUser]              = useState<any>(null)
  const [showHistorical, setShowHistorical] = useState(false)
  const [visitedIds, setVisitedIds]  = useState<Set<string>>(new Set())

  useEffect(() => {
    const raw = localStorage.getItem('laura_user')
    if (raw) setUser(JSON.parse(raw))
    try {
      const v = sessionStorage.getItem('laura.visitedLOAs')
      if (v) setVisitedIds(new Set(JSON.parse(v)))
    } catch {}
  }, [])

  function markVisited(id: string) {
    setVisitedIds(prev => {
      if (prev.has(id)) return prev
      const next = new Set(prev)
      next.add(id)
      try {
        sessionStorage.setItem('laura.visitedLOAs', JSON.stringify([...next]))
      } catch {}
      return next
    })
  }

  // Re-fetch when filters or demo-mode toggle change
  useEffect(() => { fetchLOAs() }, [filterStatus, filterCluster, showHistorical])
  useEffect(() => { setPage(1) }, [search, filterStatus, filterCluster, filterQuarter, showHistorical])

  async function fetchLOAs() {
    setLoading(true)
    try {
      const data = await getLOAs({
        status:  filterStatus  || undefined,
        cluster: filterCluster || undefined,
        include_historical: showHistorical,
      })
      setLOAs(data)
    } catch { } finally { setLoading(false) }
  }

  function handleLogout() {
    localStorage.removeItem('laura_token')
    localStorage.removeItem('laura_user')
    sessionStorage.removeItem('laura.visitedLOAs')
    document.cookie = 'laura_token=; path=/; max-age=0'
    router.push('/login')
  }

  // ── Filtering ────────────────────────────────────────────────────────
  const filtered = loas.filter(l => {
    if (filterQuarter) {
      const field = `q${filterQuarter.slice(1)}_2026` as keyof LOA
      const v = Number((l as any)[field] ?? 0)
      if (!v || v <= 0) return false
    }
    if (!search) return true
    const q = search.toLowerCase()
    return (
      l.activity_type?.toLowerCase().includes(q) ||
      l.country?.toLowerCase().includes(q) ||
      l.brand?.toLowerCase().includes(q) ||
      l.loa_draft_id?.toLowerCase().includes(q) ||
      l.customer?.toLowerCase().includes(q) ||
      formatCategory(l.category).toLowerCase().includes(q)
    )
  })

  // ── Duplicate detection ──────────────────────────────────────────────
  const duplicates = useMemo(() => {
    const buckets = new Map<string, LOA[]>()
    for (const l of loas) {
      const sig = [
        l.brand || '',
        l.country || '',
        l.activity_type || '',
        (l.description || '').slice(0, 30),
      ].join('|')
      if (sig.replace(/\|/g, '').trim() === '') continue
      if (!buckets.has(sig)) buckets.set(sig, [])
      buckets.get(sig)!.push(l)
    }
    const result = new Map<string, { isDuplicate: boolean; originalLoaNumber: string }>()
    for (const group of buckets.values()) {
      if (group.length < 2) continue
      const sorted = group.slice().sort((a, b) =>
        new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
      )
      const original = sorted[0]
      for (const dup of sorted.slice(1)) {
        result.set(dup.id, {
          isDuplicate: true,
          originalLoaNumber: original.loa_number || original.loa_draft_id?.slice(0, 14) || '—',
        })
      }
    }
    return result
  }, [loas])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated  = filtered.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE)

  const totalBudget = loas.reduce((s,l) => s + (l.fy_2026_total||0), 0)

  // Sprint 2.5: the "Show historical" toggle should only be visible to
  // super-admins (Thibault, Sandrine, Vanessa-admin). Other users see
  // ONLY the demo LOAs that match their scope.
  const canSeeHistorical = role?.can_override_lock === true

  // Sprint 2.5: a human-readable description of what the user is seeing.
  // E.g. "France Marketer — viewing FRANCE cluster"
  const scopeDescription = useMemo(() => {
    if (!role) return null
    const parts = [role.role_display_name]
    if (role.role_scope_type === 'cluster' && role.role_scope_value?.length) {
      parts.push(`viewing ${role.role_scope_value.join(', ')}`)
    } else if (role.role_scope_type === 'brand' && role.role_scope_value?.length) {
      parts.push(`viewing ${role.role_scope_value.length} brand(s)`)
    } else if (role.role_scope_type === 'function' && role.role_scope_value?.length) {
      parts.push(`viewing ${role.role_scope_value.join(', ')}`)
    } else if (role.role_scope_type === 'all') {
      parts.push('full access')
    }
    return parts.join(' · ')
  }, [role])

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      <header className="border-b" style={{ borderColor: 'var(--border)', background: 'var(--bg-secondary)' }}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
              LAURA · Tracker
            </h1>
            {scopeDescription && (
              <span
                className="text-xs px-2 py-1 rounded"
                style={{
                  background: 'var(--bg-tertiary, rgba(0,0,0,0.05))',
                  color: 'var(--text-secondary)',
                }}
              >
                {scopeDescription}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Link href="/loa/new" className="btn-primary text-sm">+ New LOA</Link>
            <ThemeToggle />
            <button onClick={handleLogout} className="btn-ghost text-sm px-3">
              Logout {user?.full_name ? `· ${user.full_name.split(' ')[0]}` : ''}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">

        {/* Sprint 2.5: scope summary banner */}
        <div className="mb-4 flex items-center justify-between text-sm">
          <div style={{ color: 'var(--text-secondary)' }}>
            {loading ? (
              <span>Loading…</span>
            ) : (
              <>
                Showing <strong style={{ color: 'var(--text-primary)' }}>{filtered.length}</strong> LOA{filtered.length !== 1 ? 's' : ''}
                {role?.role_scope_type !== 'all' && role?.role_scope_type !== undefined && (
                  <span> in your scope</span>
                )}
                {totalBudget > 0 && (
                  <span> · Total budget: <strong style={{ color: 'var(--text-primary)' }}>{formatEuros(totalBudget)}</strong></span>
                )}
              </>
            )}
          </div>

          {/* Historical toggle: super-admins only */}
          {canSeeHistorical && (
            <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: 'var(--text-muted)' }}>
              <input
                type="checkbox"
                checked={showHistorical}
                onChange={(e) => setShowHistorical(e.target.checked)}
              />
              Show historical LOAs (admin)
            </label>
          )}
        </div>

        {/* Filters bar */}
        <div className="flex flex-wrap gap-2 mb-4">
          <input
            type="text"
            placeholder="Search LOA #, activity, country, brand, customer…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[300px] px-3 py-2 text-sm rounded border"
            style={{
              background: 'var(--bg-tertiary, white)',
              borderColor: 'var(--border)',
              color: 'var(--text-primary)',
            }}
          />
          <select
            value={filterStatus}
            onChange={(e) => setFS(e.target.value)}
            className="px-3 py-2 text-sm rounded border"
            style={{
              background: 'var(--bg-tertiary, white)',
              borderColor: 'var(--border)',
              color: 'var(--text-primary)',
            }}
          >
            <option value="">All statuses</option>
            {Object.entries(STATUS).map(([key, val]) => (
              <option key={key} value={key}>{val.label}</option>
            ))}
          </select>
          <select
            value={filterCluster}
            onChange={(e) => setFC(e.target.value)}
            className="px-3 py-2 text-sm rounded border"
            style={{
              background: 'var(--bg-tertiary, white)',
              borderColor: 'var(--border)',
              color: 'var(--text-primary)',
            }}
          >
            <option value="">All clusters</option>
            {CLUSTERS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            value={filterQuarter}
            onChange={(e) => setFQ(e.target.value)}
            className="px-3 py-2 text-sm rounded border"
            style={{
              background: 'var(--bg-tertiary, white)',
              borderColor: 'var(--border)',
              color: 'var(--text-primary)',
            }}
          >
            <option value="">All quarters</option>
            <option value="Q1">Q1 2026</option>
            <option value="Q2">Q2 2026</option>
            <option value="Q3">Q3 2026</option>
            <option value="Q4">Q4 2026</option>
          </select>
        </div>

        {/* Empty state when user has no LOAs in scope */}
        {!loading && filtered.length === 0 && (
          <div
            className="text-center py-12 rounded border-2 border-dashed"
            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
          >
            <p className="text-sm mb-2">
              No LOAs to show
              {role?.role_scope_type !== 'all' && role?.role_scope_type !== undefined && ' in your scope'}.
            </p>
            <p className="text-xs">
              {role?.role_scope_type === 'cluster' && 'You will see LOAs from your cluster as they are created.'}
              {role?.role_scope_type === 'brand' && 'You will see LOAs for your brand(s) once they reach global review.'}
              {role?.role_scope_type === 'function' && 'You will see LOAs for your function once they reach global review.'}
              {role?.role_scope_type === 'all' && 'No LOAs match the current filters.'}
            </p>
          </div>
        )}

        {/* Grid header */}
        {paginated.length > 0 && (
          <div
            className={`grid ${GRID_COLS} gap-3 px-3 py-2 text-xs font-medium uppercase tracking-wider border-b`}
            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
          >
            <span></span>
            <span>LOA #</span>
            <span>Activity</span>
            <span>Country</span>
            <span>Category</span>
            <span>FY26</span>
            <span>PPT</span>
            <span>Last activity</span>
            <span>Status</span>
          </div>
        )}

        {/* Grid rows */}
        <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
          {paginated.map((loa) => {
            const st = STATUS[loa.status] ?? { label: loa.status, cls: 'badge-draft' }
            const visited = visitedIds.has(loa.id)
            const dupInfo = duplicates.get(loa.id)
            const isDup = !!dupInfo

            return (
              <Link
                key={loa.id}
                href={`/loa/${loa.id}`}
                onClick={() => markVisited(loa.id)}
                className={`grid ${GRID_COLS} gap-3 px-3 py-3 items-center hover:bg-opacity-50 transition`}
                style={{
                  background: visited ? 'transparent' : 'var(--bg-secondary)',
                }}
              >
                <span className="flex justify-center">
                  {!visited && (
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ background: 'var(--blue, #3b82f6)' }}
                      title="Not yet viewed"
                    />
                  )}
                </span>

                <span className="mono text-xs pt-0.5 truncate" style={{ color:'var(--text-muted)' }}>
                  {loa.loa_number || loa.loa_draft_id?.slice(0,14)}
                </span>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate" style={{ color:'var(--text-primary)' }}>
                      {loa.detail||loa.activity_type}
                    </p>
                    {isDup && (
                      <span title={`Duplicate of ${dupInfo!.originalLoaNumber}`}
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider flex-shrink-0"
                        style={{ background: 'var(--amber, #f59e0b)', color: 'white' }}>
                        Duplicate
                      </span>
                    )}
                  </div>
                  <p className="text-xs truncate" style={{ color:'var(--text-muted)' }}>
                    {loa.activity_type}
                    {isDup && (
                      <span style={{ color: 'var(--amber, #f59e0b)' }}> · original: {dupInfo!.originalLoaNumber}</span>
                    )}
                  </p>
                </div>

                <div>
                  <p className="text-sm" style={{ color:'var(--text-primary)' }}>{loa.country}</p>
                  <p className="text-xs" style={{ color:'var(--text-muted)' }}>{loa.cluster}</p>
                </div>

                <span className="text-sm truncate" style={{ color:'var(--text-secondary)' }}>
                  {formatCategory(loa.category)}
                </span>

                <span className="text-sm font-medium" style={{ color:'var(--text-primary)' }}>
                  {formatEuros(loa.fy_2026_total)}
                </span>

                <span>
                  {loa.ppt_slide_required
                    ? <span className="text-xs font-medium" style={{ color:'var(--green)' }}>YES</span>
                    : <span className="text-xs" style={{ color:'var(--text-muted)' }}>—</span>}
                </span>

                <div className="min-w-0">
                  <p className="text-xs truncate" style={{ color:'var(--text-primary)' }}>
                    {loa.requestor_email?.split('@')[0] || '—'}
                  </p>
                  <p className="text-xs truncate" style={{ color:'var(--text-muted)' }}>
                    {lastAction(loa)} · {timeAgo(loa.updated_at)}
                  </p>
                </div>

                <span><span className={`badge ${st.cls}`}>{st.label}</span></span>
              </Link>
            )
          })}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-4">
            <button className="pagination-btn" disabled={page===1} onClick={() => setPage(1)}>«</button>
            <button className="pagination-btn" disabled={page===1} onClick={() => setPage(p=>p-1)}>‹</button>
            {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
              const p = page <= 4 ? i+1 : page - 3 + i
              if (p < 1 || p > totalPages) return null
              return (
                <button key={p} className={`pagination-btn ${p===page?'active':''}`} onClick={() => setPage(p)}>{p}</button>
              )
            })}
            <button className="pagination-btn" disabled={page===totalPages} onClick={() => setPage(p=>p+1)}>›</button>
            <button className="pagination-btn" disabled={page===totalPages} onClick={() => setPage(totalPages)}>»</button>
          </div>
        )}

      </main>
    </div>
  )
}
