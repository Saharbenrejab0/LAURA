'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getLOA, approveLOA, rejectLOA, downloadExcel, downloadPPT } from '@/lib/api'
import type { LOA } from '@/types/loa'
import { STATUS_CONFIG } from '@/types/loa'

function formatEuros(n: number) {
  if (!n) return '€0'
  if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `€${Math.round(n / 1_000)}k`
  return `€${n}`
}

function Row({ label, value }: { label: string; value?: string | number | null }) {
  if (!value && value !== 0) return null
  return (
    <div className="flex justify-between py-2 border-b border-brand-border last:border-0">
      <span className="text-xs text-slate-400 w-40 shrink-0">{label}</span>
      <span className="text-xs text-slate-200 text-right">{String(value)}</span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-5 mb-4">
      <h2 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-4">
        {title}
      </h2>
      {children}
    </div>
  )
}

export default function LOADetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [loa, setLoa] = useState<LOA | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [comment, setComment] = useState('')
  const [acting, setActing] = useState(false)

  useEffect(() => {
    fetchLOA()
  }, [id])

  async function fetchLOA() {
    try {
      const data = await getLOA(id)
      setLoa(data)
    } catch {
      setNotFound(true)
    } finally {
      setLoading(false)
    }
  }

  async function handleApprove() {
    if (!loa) return
    setActing(true)
    try {
      const updated = await approveLOA(loa.id, comment)
      setLoa(updated)
    } finally {
      setActing(false)
    }
  }

  async function handleReject() {
    if (!loa || !comment) return
    setActing(true)
    try {
      const updated = await rejectLOA(loa.id, comment)
      setLoa(updated)
    } finally {
      setActing(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-dark flex items-center justify-center">
        <p className="text-slate-500 text-sm">Loading LOA…</p>
      </div>
    )
  }

  if (notFound || !loa) {
    return (
      <div className="min-h-screen bg-brand-dark flex flex-col items-center justify-center gap-4">
        <p className="text-white text-lg font-medium">LOA not found</p>
        <p className="text-slate-400 text-sm">This LOA may have been deleted or the ID is incorrect.</p>
        <button onClick={() => router.push('/')} className="btn-primary">
          Back to tracker
        </button>
      </div>
    )
  }

  const statusCfg = STATUS_CONFIG[loa.status]
  const canApprove = ['submitted', 'brand_review', 'cmo_review', 'cfo_review'].includes(loa.status)
  const isApproved = loa.status === 'approved'
  const isRejected = loa.status === 'rejected'

  return (
    <div className="min-h-screen bg-brand-dark">
      {/* Header */}
      <header className="border-b border-brand-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/')} className="text-slate-400 hover:text-white text-sm">
            ← Back
          </button>
          <div>
            <span className="text-white font-medium">{loa.loa_number || loa.loa_draft_id}</span>
            <span className="text-slate-500 text-sm ml-3">{loa.activity_type}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`badge ${statusCfg.color}`}>{statusCfg.label}</span>
          {loa.ppt_slide_required && (
            <span className="badge bg-green-900 text-green-300">PPT required</span>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6 grid grid-cols-[1fr_320px] gap-6">

        {/* LEFT — LOA details */}
        <div>
          <Section title="Location">
            <Row label="Cluster" value={loa.cluster} />
            <Row label="Country" value={loa.country} />
            <Row label="Legal entity" value={loa.legal_entity} />
          </Section>

          <Section title="Activity">
            <Row label="Type / Planning 2.0" value={loa.activity_type} />
            <Row label="Event type" value={loa.event_type} />
            <Row label="COT" value={loa.cot} />
            <Row label="Category" value={loa.category} />
            <Row label="Brand" value={loa.brand} />
            <Row label="CapEx / OpEx" value={loa.capex_opex} />
            <Row label="ADV / Selling" value={loa.adv_selling} />
          </Section>

          <Section title="Investment">
            <Row label="Customer" value={loa.customer} />
            <Row label="Vendor" value={loa.vendor} />
            <Row label="# Doors" value={loa.num_doors} />
            <Row label="Currency" value={loa.currency} />
            <Row label="Q4-25" value={loa.q4_2025 ? formatEuros(loa.q4_2025) : undefined} />
            <Row label="Q1-26" value={loa.q1_2026 ? formatEuros(loa.q1_2026) : undefined} />
            <Row label="Q2-26" value={loa.q2_2026 ? formatEuros(loa.q2_2026) : undefined} />
            <Row label="Q3-26" value={loa.q3_2026 ? formatEuros(loa.q3_2026) : undefined} />
            <Row label="Q4-26" value={loa.q4_2026 ? formatEuros(loa.q4_2026) : undefined} />
            <div className="flex justify-between py-2 border-b border-brand-border">
              <span className="text-xs text-slate-400">FY-26 total</span>
              <span className="text-sm font-semibold text-white">{formatEuros(loa.fy_2026_total)}</span>
            </div>
            {loa.avg_investment_per_door && (
              <div className="flex justify-between py-2 border-b border-brand-border">
                <span className="text-xs text-slate-400">Avg invest / door</span>
                <span className="text-xs text-green-400">{formatEuros(loa.avg_investment_per_door)} ✓ auto</span>
              </div>
            )}
          </Section>

          <Section title="PPT content">
            {loa.description && (
              <div className="mb-3">
                <p className="text-xs text-slate-400 mb-1">Description (the WHY)</p>
                <p className="text-sm text-slate-200 bg-brand-dark rounded px-3 py-2">{loa.description}</p>
              </div>
            )}
            {loa.tools && (
              <div className="mb-3">
                <p className="text-xs text-slate-400 mb-1">Tools</p>
                <p className="text-sm text-slate-200 bg-brand-dark rounded px-3 py-2 whitespace-pre-line">{loa.tools}</p>
              </div>
            )}
            {loa.kpi && (
              <div className="mb-3">
                <p className="text-xs text-slate-400 mb-1">KPI</p>
                <p className="text-sm text-slate-200 bg-brand-dark rounded px-3 py-2">{loa.kpi}</p>
              </div>
            )}
            {loa.timing && (
              <div>
                <p className="text-xs text-slate-400 mb-1">Timing</p>
                <p className="text-sm text-slate-200 bg-brand-dark rounded px-3 py-2">{loa.timing}</p>
              </div>
            )}
            {!loa.description && !loa.tools && !loa.kpi && (
              <p className="text-xs text-slate-600">No PPT content filled yet.</p>
            )}
          </Section>

          <Section title="Metadata">
            <Row label="LOA draft ID" value={loa.loa_draft_id} />
            <Row label="LOA number" value={loa.loa_number || '— pending assignment'} />
            <Row label="Requestor" value={loa.requestor_email} />
            <Row label="Created" value={loa.created_at?.slice(0, 16).replace('T', ' ')} />
            <Row label="Submitted" value={loa.submitted_at?.slice(0, 16).replace('T', ' ')} />
            <Row label="Approved" value={loa.approved_at?.slice(0, 16).replace('T', ' ')} />
            {loa.rejection_reason && (
              <div className="mt-2 bg-red-950 border border-red-800 rounded px-3 py-2">
                <p className="text-xs text-red-400 font-medium mb-1">Rejection reason</p>
                <p className="text-xs text-slate-300">{loa.rejection_reason}</p>
              </div>
            )}
          </Section>
        </div>

        {/* RIGHT — actions + preview */}
        <div className="space-y-4 sticky top-6 self-start">

          {/* Status card */}
          <div className="card p-5">
            <h2 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-4">
              Status
            </h2>
            <div className={`badge ${statusCfg.color} mb-4`}>{statusCfg.label}</div>

            {isApproved && (
              <div className="bg-green-950 border border-green-800 rounded px-3 py-2 mb-4">
                <p className="text-xs text-green-400">✓ This LOA is approved</p>
              </div>
            )}

            {isRejected && (
              <div className="bg-red-950 border border-red-800 rounded px-3 py-2 mb-4">
                <p className="text-xs text-red-400">✗ This LOA was rejected</p>
              </div>
            )}

            {canApprove && (
              <div className="space-y-3">
                <div>
                  <label className="label">Comment (required to reject)</label>
                  <textarea
                    className="input resize-none"
                    rows={3}
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    placeholder="Add a comment or reason…"
                  />
                </div>
                <button
                  onClick={handleApprove}
                  disabled={acting}
                  className="btn-primary w-full"
                >
                  {acting ? 'Processing…' : '✓ Approve LOA'}
                </button>
                <button
                  onClick={handleReject}
                  disabled={acting || !comment}
                  className="w-full btn-secondary text-red-400 border-red-900 hover:bg-red-950"
                >
                  ✗ Reject LOA
                </button>
              </div>
            )}
          </div>

          {/* Downloads */}
          <div className="card p-5">
            <h2 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-4">
              Download
            </h2>
            <div className="space-y-2">
              <button
                onClick={() => downloadExcel(loa.id)}
                className="btn-secondary w-full text-left"
              >
                ↓ Excel row (.xlsx)
              </button>
              {loa.ppt_slide_required && (
                <button
                  onClick={() => downloadPPT(loa.id)}
                  className="btn-secondary w-full text-left"
                >
                  ↓ PPT slide (.pptx)
                </button>
              )}
            </div>
          </div>

          {/* Mini PPT preview */}
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-brand-border">
              <span className="text-sm font-medium text-white">Slide preview</span>
            </div>
            <div className="m-3 border border-brand-border rounded overflow-hidden text-[10px]">
              <div className="bg-slate-900 px-3 py-1.5 flex justify-between">
                <span className="text-slate-400">{loa.category}</span>
                <span className="font-semibold text-white">
                  {loa.country} · {formatEuros(loa.fy_2026_total)}
                </span>
              </div>
              <div className="px-3 py-1.5 font-semibold text-white border-b border-brand-border text-xs">
                {loa.activity_type}
              </div>
              <div className="grid grid-cols-2 divide-x divide-brand-border">
                <div className="px-3 py-3 space-y-2">
                  <div>
                    <p className="text-slate-500 font-medium">Description:</p>
                    <p className="text-slate-300">{loa.description || '—'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 font-medium">KPI:</p>
                    <p className="text-slate-300">{loa.kpi || '—'}</p>
                  </div>
                  {loa.avg_investment_per_door && (
                    <p className="text-green-600 font-medium">
                      Avg: {formatEuros(loa.avg_investment_per_door)} | #{loa.num_doors} doors
                    </p>
                  )}
                </div>
                <div className="bg-brand-dark flex items-center justify-center min-h-[80px]">
                  <p className="text-slate-600 text-center px-2">Photos<br />(max 2)</p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  )
}
