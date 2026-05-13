'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getLOAs } from '@/lib/api'
import type { LOA, LOAStatus } from '@/types/loa'
import { STATUS_CONFIG } from '@/types/loa'

// ---- Helpers ----
function formatEuros(n: number) {
  if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `€${Math.round(n / 1_000)}k`
  return `€${n}`
}

function StatusBadge({ status }: { status: LOAStatus }) {
  const cfg = STATUS_CONFIG[status]
  return (
    <span className={`badge ${cfg.color}`}>{cfg.label}</span>
  )
}

// ---- Main page ----
export default function TrackerPage() {
  const [loas, setLOAs] = useState<LOA[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [filterCluster, setFilterCluster] = useState<string>('')

  useEffect(() => {
    fetchLOAs()
  }, [filterStatus, filterCluster])

  async function fetchLOAs() {
    setLoading(true)
    try {
      const data = await getLOAs({
        status: filterStatus || undefined,
        cluster: filterCluster || undefined,
      })
      setLOAs(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  // Summary counts
  const total = loas.length
  const totalBudget = loas.reduce((s, l) => s + l.fy_2026_total, 0)
  const pending = loas.filter(l =>
    ['submitted', 'brand_review', 'cmo_review', 'cfo_review'].includes(l.status)
  ).length

  return (
    <div className="min-h-screen bg-brand-dark">
      {/* Top bar */}
      <header className="border-b border-brand-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-lg font-semibold text-white">LAURA</span>
          <span className="text-slate-500 text-sm">LOA tracker</span>
        </div>
        <Link href="/loa/new" className="btn-primary">
          + New LOA
        </Link>
      </header>

      <main className="px-6 py-6 max-w-7xl mx-auto">

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="card px-5 py-4">
            <p className="text-xs text-slate-400 mb-1">Total LOAs</p>
            <p className="text-2xl font-semibold text-white">{total}</p>
          </div>
          <div className="card px-5 py-4">
            <p className="text-xs text-slate-400 mb-1">FY-26 budget</p>
            <p className="text-2xl font-semibold text-white">{formatEuros(totalBudget)}</p>
          </div>
          <div className="card px-5 py-4">
            <p className="text-xs text-slate-400 mb-1">Pending review</p>
            <p className="text-2xl font-semibold text-amber-400">{pending}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-4">
          <select
            className="input w-40"
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
          >
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="submitted">Submitted</option>
            <option value="brand_review">Brand review</option>
            <option value="cmo_review">CMO review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <select
            className="input w-40"
            value={filterCluster}
            onChange={e => setFilterCluster(e.target.value)}
          >
            <option value="">All clusters</option>
            {['DACH','EAST','FRANCE','GCC & EXPORT','IBERIA','ITALY','META','NORTH','EMEA']
              .map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* LOA table */}
        <div className="card overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[120px_1fr_140px_100px_100px_80px_110px] gap-4 px-4 py-3
                          border-b border-brand-border text-xs font-medium text-slate-400 uppercase tracking-wide">
            <span>LOA #</span>
            <span>Activity</span>
            <span>Country / Cluster</span>
            <span>Category</span>
            <span>FY-26</span>
            <span>PPT</span>
            <span>Status</span>
          </div>

          {loading && (
            <div className="px-4 py-8 text-center text-slate-500 text-sm">Loading…</div>
          )}

          {!loading && loas.length === 0 && (
            <div className="px-4 py-8 text-center text-slate-500 text-sm">
              No LOAs yet.{' '}
              <Link href="/loa/new" className="text-primary-500 hover:underline">
                Create the first one
              </Link>
            </div>
          )}

          {!loading && loas.map((loa) => (
            <Link
              key={loa.id}
              href={`/loa/${loa.id}`}
              className="grid grid-cols-[120px_1fr_140px_100px_100px_80px_110px] gap-4 px-4 py-3
                         border-b border-brand-border last:border-0
                         hover:bg-white/5 transition-colors duration-100 cursor-pointer"
            >
              <span className="text-slate-400 text-xs font-mono pt-0.5">
                {loa.loa_number || loa.loa_draft_id}
              </span>
              <div>
                <p className="text-sm text-white leading-snug truncate">{loa.detail || loa.activity_type}</p>
                <p className="text-xs text-slate-500 mt-0.5">{loa.activity_type}</p>
              </div>
              <div>
                <p className="text-sm text-slate-200">{loa.country}</p>
                <p className="text-xs text-slate-500">{loa.cluster}</p>
              </div>
              <span className="text-sm text-slate-300 pt-0.5">{loa.category}</span>
              <span className="text-sm font-medium text-white pt-0.5">
                {formatEuros(loa.fy_2026_total)}
              </span>
              <span className="pt-0.5">
                {loa.ppt_slide_required
                  ? <span className="text-xs font-medium text-green-400">YES</span>
                  : <span className="text-xs text-slate-600">—</span>
                }
              </span>
              <span className="pt-0.5">
                <StatusBadge status={loa.status} />
              </span>
            </Link>
          ))}
        </div>
      </main>
    </div>
  )
}
