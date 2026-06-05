'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getLOA, approveLOA, rejectLOA, downloadPPT, createLOA } from '@/lib/api'
import PhotoUpload from '@/components/PhotoUpload'
import type { LOA } from '@/types/loa'
import { ThemeToggle } from '@/components/ThemeProvider'
import { useToast } from '@/components/Toast'

const STATUS: Record<string, { label: string; cls: string }> = {
  draft:        { label: 'Draft',        cls: 'badge-draft' },
  submitted:    { label: 'Submitted',    cls: 'badge-submitted' },
  brand_review: { label: 'Brand review', cls: 'badge-brand-review' },
  cmo_review:   { label: 'CMO review',   cls: 'badge-cmo-review' },
  cfo_review:   { label: 'CFO review',   cls: 'badge-cfo-review' },
  approved:     { label: 'Approved',     cls: 'badge-approved' },
  rejected:     { label: 'Rejected',     cls: 'badge-rejected' },
}

function formatEuros(n: number) {
  if (!n) return '€0'
  if (n >= 1_000_000) return `€${(n/1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `€${Math.round(n/1_000)}k`
  return `€${n}`
}

function Row({ label, value }: { label: string; value?: string | number | null }) {
  if (!value && value !== 0) return null
  return (
    <div className="flex justify-between py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
      <span className="text-xs w-44 shrink-0" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span className="text-sm text-right" style={{ color: 'var(--text-primary)' }}>{String(value)}</span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-5 mb-3">
      <p className="section-heading">{title}</p>
      {children}
    </div>
  )
}

// ── Activity timeline ──────────────────────────────────────────────────────
function Timeline({ loa }: { loa: LOA }) {
  const events = [
    { label: 'Created',   date: loa.created_at,  color: 'var(--accent)', done: true },
    { label: 'Submitted', date: loa.submitted_at, color: 'var(--blue)',   done: !!loa.submitted_at },
    { label: 'Approved',  date: loa.approved_at,  color: 'var(--green)',  done: !!loa.approved_at },
    loa.status === 'rejected' ? { label: 'Rejected', date: loa.updated_at, color: 'var(--red)', done: true } : null,
  ].filter(Boolean)

  return (
    <div style={{ paddingTop: '4px' }}>
      {events.map((ev: any, i) => (
        <div key={ev.label} className="timeline-item">
          <div className="timeline-dot" style={{
            background: ev.done ? ev.color : 'transparent',
            border: `2px solid ${ev.done ? ev.color : 'var(--border-strong)'}`,
            boxShadow: 'none',
          }} />
          <div>
            <p className="text-sm font-medium" style={{ color: ev.done ? 'var(--text-primary)' : 'var(--text-muted)' }}>
              {ev.label}
            </p>
            {ev.date && (
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {new Date(ev.date).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function LOADetailPage() {
  const params = useParams()
  const router = useRouter()
  const { success, error: toastError, info } = useToast()
  const id = params.id as string

  const [loa, setLoa]         = useState<LOA | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNF]     = useState(false)
  const [comment, setComment] = useState('')
  const [acting, setActing]   = useState(false)
  const [duplicating, setDuplicating] = useState(false)

  // Read-only mode for non-editors
  const user = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('laura_user') || 'null') : null
  const isApprover = user?.role === 'approver' || user?.role === 'finance' || user?.role === 'admin'

  useEffect(() => { fetchLOA() }, [id])

  async function fetchLOA() {
    try {
      const data = await getLOA(id)
      setLoa(data)
    } catch { setNF(true) }
    finally { setLoading(false) }
  }

  async function handleApprove() {
    if (!loa) return
    setActing(true)
    try {
      setLoa(await approveLOA(loa.id, comment))
      success('LOA approved ✓')
      setComment('')
    } catch { toastError('Approval failed — try again') }
    finally { setActing(false) }
  }

  async function handleReject() {
    if (!loa || !comment) return
    setActing(true)
    try {
      setLoa(await rejectLOA(loa.id, comment))
      toastError('LOA rejected')
      setComment('')
    } finally { setActing(false) }
  }

  async function handleDownloadPPT() {
    try {
      await downloadPPT(loa!.id)
      success('PPT downloaded ✓')
    } catch { toastError('PPT download failed') }
  }

  async function handleDuplicate() {
    if (!loa) return
    setDuplicating(true)
    try {
      const payload: any = { ...loa }
      delete payload.id
      delete payload.loa_draft_id
      delete payload.loa_number
      delete payload.status
      delete payload.created_at
      delete payload.updated_at
      delete payload.submitted_at
      delete payload.approved_at
      delete payload.rejection_reason
      delete payload.cmo_comment
      const newLoa = await createLOA(payload)
      success('LOA duplicated — editing new draft')
      router.push(`/loa/${newLoa.id}`)
    } catch { toastError('Duplicate failed') }
    finally { setDuplicating(false) }
  }

  async function handleRevise() {
    // For rejected LOAs — go back to edit (future: unlock edit mode)
    info('Revise mode — edit your LOA and resubmit')
    router.push(`/loa/new?from=${loa!.id}`)
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</p>
    </div>
  )

  if (notFound || !loa) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: 'var(--bg-base)' }}>
      <p className="font-medium" style={{ color: 'var(--text-primary)' }}>LOA not found</p>
      <button onClick={() => router.push('/')} className="btn-primary">Back to tracker</button>
    </div>
  )

  const st         = STATUS[loa.status] ?? { label: loa.status, cls: 'badge-draft' }
  const canApprove = ['submitted','brand_review','cmo_review','cfo_review'].includes(loa.status)
  const isApproved = loa.status === 'approved'
  const isRejected = loa.status === 'rejected'

  return (
    <div className="min-h-screen page-enter" style={{ background: 'var(--bg-base)' }}>

      {/* Header */}
      <header className="sticky top-0 z-20 px-6 py-3.5 flex items-center justify-between"
        style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/')} className="btn-ghost text-sm px-2">← Back</button>
          <span style={{ color: 'var(--border)', opacity: 0.4 }}>|</span>
          <span className="mono text-xs" style={{ color: 'var(--text-muted)' }}>{loa.loa_number || loa.loa_draft_id}</span>
          <span className={`badge ${st.cls}`}>{st.label}</span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {/* Edit button — only for draft and rejected LOAs */}
          {(loa.status === 'draft' || loa.status === 'rejected') && (
            <button
              onClick={() => router.push(`/loa/new?edit=${loa.id}`)}
              className="btn-primary text-xs px-3 py-1.5">
              ✎ Edit
            </button>
          )}
          <button onClick={handleDuplicate} disabled={duplicating} className="btn-secondary text-xs px-3 py-1.5 duplicate-btn">
            {duplicating ? '…' : '⎘ Duplicate'}
          </button>
          {loa.ppt_slide_required && (
            <button onClick={handleDownloadPPT} className="btn-secondary text-xs px-3 py-1.5">
              ↓ PPT slide
            </button>
          )}
          {/* Excel — coming soon */}
          <button disabled className="btn-secondary text-xs px-3 py-1.5 opacity-40 cursor-not-allowed" title="Coming soon">
            ↓ Excel
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6 grid grid-cols-[1fr_300px] gap-5">

        {/* LEFT */}
        <div>
          {/* Financial summary */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            {[
              { label: 'FY 2025',    value: formatEuros(loa.fy_2025_total), highlight: false },
              { label: 'FY 2026',    value: formatEuros(loa.fy_2026_total), highlight: loa.ppt_slide_required },
              { label: 'Avg / door', value: loa.avg_investment_per_door ? formatEuros(loa.avg_investment_per_door) : '—', highlight: false },
            ].map(c => (
              <div key={c.label} className="card px-4 py-3">
                <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>{c.label}</p>
                <p className="text-xl font-semibold tracking-tight"
                  style={{ color: c.highlight ? 'var(--green)' : 'var(--text-primary)' }}>
                  {c.value}
                </p>
              </div>
            ))}
          </div>

          <Section title="Geography & Classification">
            <Row label="Cluster" value={loa.cluster} />
            <Row label="Country" value={loa.country} />
            <Row label="Legal entity" value={loa.legal_entity} />
            <Row label="Activity type" value={loa.activity_type} />
            <Row label="Event type" value={loa.event_type} />
            <Row label="Event purpose" value={loa.event_purpose} />
            <Row label="SAP event code" value={(loa as any).sap_event_code} />
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
            <Row label="# Customers" value={loa.num_customers} />
            <Row label="Currency" value={loa.currency} />
            <Row label="Q4 2025" value={loa.q4_2025 ? formatEuros(loa.q4_2025) : undefined} />
            <Row label="Q1 2026" value={loa.q1_2026 ? formatEuros(loa.q1_2026) : undefined} />
            <Row label="Q2 2026" value={loa.q2_2026 ? formatEuros(loa.q2_2026) : undefined} />
            <Row label="Q3 2026" value={loa.q3_2026 ? formatEuros(loa.q3_2026) : undefined} />
            <Row label="Q4 2026" value={loa.q4_2026 ? formatEuros(loa.q4_2026) : undefined} />
          </Section>

          <Section title="Photos for PPT Slide">
            <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
              Upload up to 2 photos — embedded automatically in the PPT when downloaded
            </p>
            <PhotoUpload loaId={loa.id} />
          </Section>

          <Section title="Description & PPT Content">
            {loa.description && (
              <div className="mb-4">
                <p className="label mb-2">Description (WHY)</p>
                <p className="text-sm p-3 rounded-lg" style={{ background:'var(--bg-elevated)', color:'var(--text-primary)' }}>
                  {loa.description}
                </p>
              </div>
            )}
            {loa.detail && (
              <div className="mb-4">
                <p className="label mb-2">Detail / Tools (HOW)</p>
                <p className="text-sm p-3 rounded-lg whitespace-pre-line" style={{ background:'var(--bg-elevated)', color:'var(--text-primary)' }}>
                  {loa.detail}
                </p>
              </div>
            )}
            {loa.kpi && (
              <div className="mb-4">
                <p className="label mb-2">KPI</p>
                <p className="text-sm p-3 rounded-lg" style={{ background:'var(--bg-elevated)', color:'var(--text-primary)' }}>
                  {loa.kpi}
                </p>
              </div>
            )}
            {(loa as any).cost_drill_down && (
              <div>
                <p className="label mb-2">Cost Drill Down</p>
                <p className="text-sm p-3 rounded-lg" style={{ background:'var(--bg-elevated)', color:'var(--text-primary)' }}>
                  {(loa as any).cost_drill_down}
                </p>
              </div>
            )}
          </Section>
        </div>

        {/* RIGHT */}
        <div className="space-y-3 sticky top-20 self-start">

          {/* Approval card */}
          <div className="card p-5">
            <p className="section-heading">Approval</p>

            {isApproved && (
              <div className="rounded-lg px-3 py-2.5 mb-4 text-sm"
                style={{ background:'var(--green-bg)', color:'var(--green-text)', border:'1px solid var(--green-border)' }}>
                ✓ LOA approved
              </div>
            )}

            {isRejected && (
              <div className="rounded-lg px-3 py-2.5 mb-4 text-sm"
                style={{ background:'var(--red-bg)', color:'var(--red-text)', border:'1px solid var(--red-border)' }}>
                ✗ LOA rejected
                {loa.rejection_reason && <p className="mt-1 text-xs opacity-80">{loa.rejection_reason}</p>}
              </div>
            )}

            {isRejected && (
              <button onClick={handleRevise} className="btn-primary w-full text-sm mb-3">
                ↩ Revise & resubmit
              </button>
            )}

            {canApprove && isApprover && (
              <div className="space-y-3">
                <div>
                  <label className="label">Comment</label>
                  <textarea className="input resize-none" rows={3}
                    value={comment} onChange={e => setComment(e.target.value)}
                    placeholder="Required to reject…" />
                </div>
                <button onClick={handleApprove} disabled={acting} className="btn-primary w-full">
                  {acting ? 'Processing…' : '✓ Approve'}
                </button>
                <button onClick={handleReject} disabled={acting||!comment}
                  className="btn-secondary w-full text-sm"
                  style={{ color:'var(--red-text)', borderColor:'var(--red-border)' }}>
                  ✗ Reject
                </button>
              </div>
            )}

            {canApprove && !isApprover && (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Waiting for approver action.
              </p>
            )}

            {!canApprove && !isApproved && !isRejected && (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Submit this LOA to start the approval flow.
              </p>
            )}
          </div>

          {/* Activity timeline */}
          <div className="card p-5">
            <p className="section-heading">Timeline</p>
            <Timeline loa={loa} />
          </div>

          {/* Mini PPT preview */}
          <div className="card overflow-hidden">
            <div className="px-4 py-3" style={{ borderBottom:'1px solid var(--border)' }}>
              <span className="text-sm font-medium" style={{ color:'var(--text-primary)' }}>Slide preview</span>
            </div>
            <div className="m-3 rounded-lg overflow-hidden text-[10px]" style={{ border:'1px solid var(--border)' }}>
              <div className="px-3 py-1.5 flex justify-between" style={{ background:'#0D1B2A' }}>
                <span style={{ color:'#aaa' }}>{loa.category}</span>
                <span className="font-semibold" style={{ color:'white' }}>{loa.country} · {formatEuros(loa.fy_2026_total)}</span>
              </div>
              <div className="px-3 py-1.5 font-semibold text-xs truncate"
                style={{ color:'var(--text-primary)', borderBottom:'1px solid var(--border)', background:'var(--bg-surface)' }}>
                {loa.activity_type}
              </div>
              <div className="grid grid-cols-2 divide-x" style={{ borderColor:'var(--border)' }}>
                <div className="px-3 py-3 space-y-2" style={{ background:'var(--bg-surface)' }}>
                  {loa.description && <div><p className="font-medium" style={{ color:'var(--text-muted)' }}>Description:</p><p style={{ color:'var(--text-secondary)' }}>{loa.description}</p></div>}
                  {loa.kpi && <div><p className="font-medium" style={{ color:'var(--text-muted)' }}>KPI:</p><p style={{ color:'var(--text-secondary)' }}>{loa.kpi}</p></div>}
                  {!loa.description && !loa.kpi && <p style={{ color:'var(--text-muted)' }}>No content yet</p>}
                </div>
                <div className="flex items-center justify-center min-h-[80px]" style={{ background:'var(--bg-elevated)' }}>
                  <p className="text-center px-2" style={{ color:'var(--text-muted)' }}>Photos<br />(max 2)</p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  )
}
