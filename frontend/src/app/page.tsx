'use client'

import { useEffect, useState } from 'react'
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

const STATUS: Record<string, { label: string; cls: string }> = {
  draft:        { label: 'Draft',        cls: 'badge-draft' },
  submitted:    { label: 'Submitted',    cls: 'badge-submitted' },
  brand_review: { label: 'Brand review', cls: 'badge-brand-review' },
  cmo_review:   { label: 'CMO review',   cls: 'badge-cmo-review' },
  cfo_review:   { label: 'CFO review',   cls: 'badge-cfo-review' },
  approved:     { label: 'Approved',     cls: 'badge-approved' },
  rejected:     { label: 'Rejected',     cls: 'badge-rejected' },
}

const CLUSTERS = ['DACH','EAST','FRANCE','GCC & EXPORT','IBERIA','ITALY','META','NORTH','EMEA']
const PAGE_SIZE = 50

export default function TrackerPage() {
  const router = useRouter()
  const { info } = useToast()
  const [loas, setLOAs]         = useState<LOA[]>([])
  const [loading, setLoading]   = useState(true)
  const [filterStatus, setFS]   = useState('')
  const [filterCluster, setFC]  = useState('')
  const [search, setSearch]     = useState('')
  const [page, setPage]         = useState(1)
  const [user, setUser]         = useState<any>(null)

  useEffect(() => {
    const raw = localStorage.getItem('laura_user')
    if (raw) setUser(JSON.parse(raw))
  }, [])

  useEffect(() => { fetchLOAs() }, [filterStatus, filterCluster])
  useEffect(() => { setPage(1) }, [search, filterStatus, filterCluster])

  async function fetchLOAs() {
    setLoading(true)
    try {
      const data = await getLOAs({ status: filterStatus||undefined, cluster: filterCluster||undefined })
      setLOAs(data)
    } catch { } finally { setLoading(false) }
  }

  function handleLogout() {
    localStorage.removeItem('laura_token')
    localStorage.removeItem('laura_user')
    document.cookie = 'laura_token=; path=/; max-age=0'
    router.push('/login')
  }

  const filtered = loas.filter(l => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      l.activity_type?.toLowerCase().includes(q) ||
      l.country?.toLowerCase().includes(q) ||
      l.brand?.toLowerCase().includes(q) ||
      l.loa_draft_id?.toLowerCase().includes(q) ||
      l.customer?.toLowerCase().includes(q)
    )
  })

  // Pagination
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated  = filtered.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE)

  const totalBudget = loas.reduce((s,l) => s + (l.fy_2026_total||0), 0)
  const pending     = loas.filter(l => ['submitted','brand_review','cmo_review','cfo_review'].includes(l.status)).length
  const approved    = loas.filter(l => l.status === 'approved').length

  return (
    <div className="min-h-screen page-enter" style={{ background: 'var(--bg-base)' }}>

      {/* Header */}
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

        {/* Summary cards */}
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
        <div className="flex flex-wrap gap-2 mb-4">
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
          {(filterStatus||filterCluster||search) && (
            <button className="btn-ghost text-xs h-8 px-3"
              onClick={() => { setFS(''); setFC(''); setSearch('') }}>Clear</button>
          )}
          <span className="ml-auto text-xs self-center" style={{ color:'var(--text-muted)' }}>
            {filtered.length} LOA{filtered.length!==1?'s':''}
            {totalPages > 1 ? ` · Page ${page}/${totalPages}` : ''}
          </span>
        </div>

        {/* Table */}
        <div className="card overflow-hidden">
          <div className="grid grid-cols-[110px_1fr_130px_90px_90px_70px_100px] gap-3 px-4 py-3"
            style={{ borderBottom:'1px solid var(--border)', background:'var(--bg-elevated)' }}>
            {['LOA #','Activity','Country / Cluster','Category','FY-26','PPT','Status'].map(h => (
              <span key={h} className="text-xs font-medium uppercase tracking-wide" style={{ color:'var(--text-muted)' }}>{h}</span>
            ))}
          </div>

          {loading && <div className="px-4 py-10 text-center text-sm" style={{ color:'var(--text-muted)' }}>Loading…</div>}

          {!loading && filtered.length === 0 && (
            <div className="px-4 py-10 text-center">
              <p className="text-sm mb-1" style={{ color:'var(--text-muted)' }}>No LOAs found</p>
              <Link href="/loa/new" className="text-sm font-medium" style={{ color:'var(--accent)' }}>Create the first one →</Link>
            </div>
          )}

          {!loading && paginated.map((loa, i) => {
            const st = STATUS[loa.status] ?? { label:loa.status, cls:'badge-draft' }
            return (
              <Link key={loa.id} href={`/loa/${loa.id}`}
                className="grid grid-cols-[110px_1fr_130px_90px_90px_70px_100px] gap-3 px-4 py-3 cursor-pointer"
                style={{ borderBottom: i < paginated.length-1 ? '1px solid var(--border)' : 'none' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <span className="mono text-xs pt-0.5 truncate" style={{ color:'var(--text-muted)' }}>
                  {loa.loa_number || loa.loa_draft_id?.slice(0,14)}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color:'var(--text-primary)' }}>{loa.detail||loa.activity_type}</p>
                  <p className="text-xs truncate" style={{ color:'var(--text-muted)' }}>{loa.activity_type}</p>
                </div>
                <div>
                  <p className="text-sm" style={{ color:'var(--text-primary)' }}>{loa.country}</p>
                  <p className="text-xs" style={{ color:'var(--text-muted)' }}>{loa.cluster}</p>
                </div>
                <span className="text-sm" style={{ color:'var(--text-secondary)' }}>{loa.category}</span>
                <span className="text-sm font-medium" style={{ color:'var(--text-primary)' }}>{formatEuros(loa.fy_2026_total)}</span>
                <span>
                  {loa.ppt_slide_required
                    ? <span className="text-xs font-medium" style={{ color:'var(--green)' }}>YES</span>
                    : <span className="text-xs" style={{ color:'var(--text-muted)' }}>—</span>}
                </span>
                <span><span className={`badge ${st.cls}`}>{st.label}</span></span>
              </Link>
            )
          })}
        </div>

        {/* Pagination */}
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
