'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getLOAs } from '@/lib/api'
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

// Format short relative time: "2h ago", "Just now", "3d ago"
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
  if (loa.status === 'brand_review' || loa.status === 'cmo_review' || loa.status === 'cfo_review') return 'in review'
  if (loa.status === 'draft') return 'edited'
  return 'updated'
}

const STATUS: Record<string, { label: string; cls: string }> = {
  draft:        { label: 'Draft',        cls: 'badge-draft' },
  submitted:    { label: 'Submitted',    cls: 'badge-submitted' },
  brand_review: { label: 'Brand review', cls: 'badge-brand-review' },
  cmo_review:   { label: 'CMO review',   cls: 'badge-cmo-review' },
  cfo_review:   { label: 'CFO review',   cls: 'badge-cfo-review' },
  approved:     { label: 'Approved',     cls: 'badge-approved' },
  rejected:     { label: 'Rejected',     cls: 'badge-rejected' },
}

const CLUSTERS = ['FRANCE','ITALY','DACH','IBERIA','NORTH','META','EAST','EMEA','RUSSIA']

const PAGE_SIZE = 50

// Grid layout — 9 columns: visited dot + LOA # + Activity + Country + Category + FY + PPT + Last activity + Status
const GRID_COLS = 'grid-cols-[24px_110px_1fr_130px_90px_90px_60px_130px_100px]'

export default function TrackerPage() {
  const router = useRouter()
  const { info } = useToast()

  const [loas, setLOAs]              = useState<LOA[]>([])
  const [loading, setLoading]        = useState(true)
  const [filterStatus, setFS]        = useState('')
  const [filterCluster, setFC]       = useState('')
  const [filterQuarter, setFQ]       = useState('')
  const [search, setSearch]          = useState('')
  const [page, setPage]              = useState(1)
  const [user, setUser]              = useState<any>(null)
  const [showHistorical, setShowHistorical] = useState(false)   // ← NEW: demo-mode toggle

  // ── Visited LOAs this session (sessionStorage) ──────────────────────
  const [visitedIds, setVisitedIds] = useState<Set<string>>(new Set())

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
  const pending     = loas.filter(l => ['submitted','brand_review','cmo_review','cfo_review'].includes(l.status)).length
  const approved    = loas.filter(l => l.status === 'approved').length

  return (
    <div className="min-h-screen page-enter" style={{ background: 'var(--bg-base)' }}>

      <header style={{ background:'var(--bg-surface)', borderBottom:'1px solid var(--border)' }}
        className="sticky top-0 z-20 px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold"
            style={{ background:'var(--accent)', color:'var(--accent-text)' }}>L</div>
          <span className="font-semibold text-sm tracking-tight" style={{ color:'var(--text-primary)' }}>LAURA</span>
          <span className="text-xs px-2 py-0.5 rounded-full"
            style={{ background:'var(--bg-elevated)', color:'var(--text-muted)', border:'1px solid var(--border)' }}>
            EMEA
          </span>
          {!showHistorical && (
            <span className="text-xs px-2 py-0.5 rounded-full"
              style={{ background:'var(--blue-bg, rgba(59, 130, 246, 0.1))',
                       color:'var(--blue-text, #2563eb)',
                       border:'1px solid var(--blue-border, rgba(59, 130, 246, 0.3))' }}>
              Demo mode
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {user && (
            <div className="flex items-center gap-3 ml-2 pl-3" style={{ borderLeft:'1px solid var(--border)' }}>
              <div className="text-right hidden sm:block">
                <p className="text-xs font-medium" style={{ color:'var(--text-primary)' }}>{user.full_name}</p>
                <p className="text-xs" style={{ color:'var(--text-muted)' }}>{user.role}</p>
              </div>
              <button onClick={handleLogout} className="btn-ghost text-xs px-3 py-1.5">Sign out</button>
            </div>
          )}
          <Link href="/loa/new" className="btn-primary text-xs px-4 py-2 ml-1">+ New LOA</Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label:'Total LOAs',     value:loas.length,             color:'var(--text-primary)' },
            { label:'FY-26 budget',   value:formatEuros(totalBudget), color:'var(--text-primary)' },
            { label:'Pending review', value:pending,                  color:'var(--amber)' },
            { label:'Approved',       value:approved,                 color:'var(--green)' },
          ].map(card => (
            <div key={card.label} className="card px-5 py-4">
              <p className="text-xs mb-1.5" style={{ color:'var(--text-muted)' }}>{card.label}</p>
              <p className="text-2xl font-semibold tracking-tight" style={{ color:card.color }}>{card.value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-4 items-center">
          <input className="input h-8 w-52 text-xs" placeholder="Search LOAs…"
            value={search} onChange={e => setSearch(e.target.value)} />
          <select className="input h-8 w-36 text-xs" value={filterStatus} onChange={e => setFS(e.target.value)}>
            <option value="">All statuses</option>
            {Object.entries(STATUS).map(([v,s]) => <option key={v} value={v}>{s.label}</option>)}
          </select>
          <select className="input h-8 w-36 text-xs" value={filterCluster} onChange={e => setFC(e.target.value)}>
            <option value="">All clusters</option>
            {CLUSTERS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="input h-8 w-32 text-xs" value={filterQuarter} onChange={e => setFQ(e.target.value)}>
            <option value="">All quarters</option>
            <option value="Q1">Q1 2026</option>
            <option value="Q2">Q2 2026</option>
            <option value="Q3">Q3 2026</option>
            <option value="Q4">Q4 2026</option>
          </select>

          {/* ── DEMO MODE TOGGLE ────────────────────────────────────── */}
          <label className="flex items-center gap-1.5 text-xs cursor-pointer h-8 px-3 rounded-lg"
            style={{
              color: 'var(--text-secondary)',
              background: showHistorical ? 'var(--amber-bg, rgba(251, 191, 36, 0.1))' : 'transparent',
              border: showHistorical ? '1px solid var(--amber-border, rgba(251, 191, 36, 0.3))' : '1px solid transparent',
            }}>
            <input type="checkbox" checked={showHistorical}
              onChange={e => setShowHistorical(e.target.checked)}
              className="cursor-pointer" />
            <span>Show historical (1,330)</span>
          </label>

          {(filterStatus||filterCluster||filterQuarter||search) && (
            <button className="btn-ghost text-xs h-8 px-3"
              onClick={() => { setFS(''); setFC(''); setFQ(''); setSearch('') }}>Clear</button>
          )}
          <span className="ml-auto text-xs self-center" style={{ color:'var(--text-muted)' }}>
            {filtered.length} LOA{filtered.length!==1?'s':''}
            {totalPages > 1 ? ` · Page ${page}/${totalPages}` : ''}
          </span>
        </div>

        {/* Table */}
        <div className="card overflow-hidden">
          <div className={`grid ${GRID_COLS} gap-3 px-4 py-3`}
            style={{ borderBottom:'1px solid var(--border)', background:'var(--bg-elevated)' }}>
            {['','LOA #','Activity','Country / Cluster','Category','FY-26','PPT','Last activity','Status'].map((h, i) => (
              <span key={i} className="text-xs font-medium uppercase tracking-wide" style={{ color:'var(--text-muted)' }}>{h}</span>
            ))}
          </div>

          {loading && <div className="px-4 py-10 text-center text-sm" style={{ color:'var(--text-muted)' }}>Loading…</div>}

          {!loading && filtered.length === 0 && (
            <div className="px-4 py-10 text-center">
              <p className="text-sm mb-1" style={{ color:'var(--text-muted)' }}>
                {!showHistorical
                  ? 'No demo LOAs yet — create one or enable "Show historical"'
                  : 'No LOAs match your filters'}
              </p>
              <Link href="/loa/new" className="text-sm font-medium" style={{ color:'var(--accent)' }}>Create a new LOA →</Link>
            </div>
          )}

          {!loading && paginated.map((loa, i) => {
            const st       = STATUS[loa.status] ?? { label:loa.status, cls:'badge-draft' }
            const visited  = visitedIds.has(loa.id)
            const dupInfo  = duplicates.get(loa.id)
            const isDup    = !!dupInfo

            return (
              <Link key={loa.id} href={`/loa/${loa.id}`}
                onClick={() => markVisited(loa.id)}
                className={`grid ${GRID_COLS} gap-3 px-4 py-3 cursor-pointer transition-colors`}
                style={{
                  borderBottom: i < paginated.length-1 ? '1px solid var(--border)' : 'none',
                  background: isDup ? 'var(--amber-bg, rgba(251, 191, 36, 0.06))' : undefined,
                }}
                onMouseEnter={e => (e.currentTarget.style.background = isDup
                  ? 'var(--amber-bg, rgba(251, 191, 36, 0.12))'
                  : 'var(--bg-elevated)')}
                onMouseLeave={e => (e.currentTarget.style.background = isDup
                  ? 'var(--amber-bg, rgba(251, 191, 36, 0.06))'
                  : 'transparent')}
              >
                <span className="flex items-center justify-center" title={visited ? 'Visited this session' : ''}>
                  {visited && (
                    <span className="inline-block rounded-full"
                      style={{ width: '6px', height: '6px', background: 'var(--accent, #3b82f6)' }} />
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