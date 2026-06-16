'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  getLOA,
  validateWorkflowStep,
  rejectLOA,
  lockLOA,
  unlockLOA,
  downloadPPT,
  createLOA,
  deleteLOA,
} from '@/lib/api'
import PhotoUpload from '@/components/PhotoUpload'
import type { LOA } from '@/types/loa'
import { STATUS_CONFIG } from '@/types/loa'
import { ThemeToggle } from '@/components/ThemeProvider'
import { useToast } from '@/components/Toast'
import PermissionGuard from '@/components/PermissionGuard'
import { usePermissions } from '@/hooks/usePermissions'

// ── Workflow constants (mirrors backend/api/loa.py exactly) ───────────────
//
// VALIDATION_STATUSES     → require 'validate' permission (named approver)
// ADVANCE_PHASE_STATUSES  → require 'advance_phase' permission (EMEA orchestration)
//
// The frontend doesn't distinguish them — it always calls POST /validate,
// and the backend dispatches to the correct permission check internally.
// PermissionGuard uses `action="validate"` for both.
const VALIDATION_STATUSES = new Set(['cmo_review', 'cfo_review', 'ceo_validation'])
const ADVANCE_PHASE_STATUSES = new Set([
  'local_prep', 'country_review', 'global_review', 'corporate_review',
])
const ACTIONABLE_STATUSES = new Set([
  ...VALIDATION_STATUSES,
  ...ADVANCE_PHASE_STATUSES,
])

// Ordered workflow steps — must match backend WORKFLOW_TRANSITIONS keys + 'draft'.
// 'draft' is index 0 (created_at anchor). 'rejected' is not in the chain (handled separately).
const WORKFLOW_STEPS = [
  { key: 'draft',            label: 'Created'          },
  { key: 'local_prep',       label: 'Local prep'       },
  { key: 'country_review',   label: 'Country review'   },
  { key: 'global_review',    label: 'Global review'    },
  { key: 'cmo_review',       label: 'CMO review'       },
  { key: 'cfo_review',       label: 'CFO review'       },
  { key: 'corporate_review', label: 'Corporate review' },
  { key: 'ceo_validation',   label: 'CEO validation'   },
  { key: 'approved',         label: 'Approved'         },
] as const

const STATUS_ORDER = WORKFLOW_STEPS.map(s => s.key)

// ── Helpers ───────────────────────────────────────────────────────────────

function formatEuros(n: number) {
  if (!n) return '€0'
  if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `€${Math.round(n / 1_000)}k`
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

// ── Timeline ──────────────────────────────────────────────────────────────
//
// Renders the full 9-step approval chain. Determines done/current/pending
// by comparing each step's index to the current status position.
// Dates are shown for anchored timestamps only: created_at, submitted_at,
// approved_at, and updated_at for the current step.
// 'rejected' is a terminal side-branch rendered after the chain.
function Timeline({ loa }: { loa: LOA }) {
  const isRejected = loa.status === 'rejected'
  const currentIdx = STATUS_ORDER.indexOf(loa.status as any)

  return (
    <div style={{ paddingTop: '4px' }}>
      {WORKFLOW_STEPS.map((step, i) => {
        const isDone    = !isRejected && currentIdx >= i
        const isCurrent = !isRejected && currentIdx === i

        // Anchor real timestamps where we have them; fall back to updated_at for current.
        const date =
          i === 0              ? loa.created_at
          : i === 1            ? loa.submitted_at
          : step.key === 'approved' ? loa.approved_at
          : isCurrent          ? loa.updated_at
          : undefined

        return (
          <div key={step.key} className="timeline-item">
            <div
              className="timeline-dot"
              style={{
                background: isDone
                  ? isCurrent ? 'var(--accent)' : 'var(--green)'
                  : 'transparent',
                border: `2px solid ${
                  isDone
                    ? isCurrent ? 'var(--accent)' : 'var(--green)'
                    : 'var(--border-strong)'
                }`,
                boxShadow: isCurrent ? '0 0 0 3px rgba(26,26,26,0.10)' : 'none',
              }}
            />
            <div>
              <p
                className="text-sm"
                style={{
                  color: isDone ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontWeight: isCurrent ? 600 : 400,
                }}
              >
                {step.label}
                {isCurrent && (
                  <span className="ml-2 text-xs font-normal" style={{ color: 'var(--text-muted)' }}>
                    ← now
                  </span>
                )}
              </p>
              {date && (
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {new Date(date).toLocaleDateString('en-GB', {
                    day: '2-digit', month: 'short', year: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </p>
              )}
            </div>
          </div>
        )
      })}

      {/* Rejected — terminal side-branch, always last */}
      {isRejected && (
        <div className="timeline-item" style={{ paddingBottom: 0 }}>
          <div
            className="timeline-dot"
            style={{ background: 'var(--red)', border: '2px solid var(--red)' }}
          />
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--red-text)' }}>
              Rejected
            </p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {new Date(loa.updated_at).toLocaleDateString('en-GB', {
                day: '2-digit', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })}
            </p>
            {loa.rejection_reason && (
              <p
                className="text-xs mt-1.5 px-2 py-1.5 rounded-lg"
                style={{
                  background: 'var(--red-bg)',
                  color: 'var(--red-text)',
                  border: '1px solid var(--red-border)',
                }}
              >
                {loa.rejection_reason}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────
export default function LOADetailPage() {
  const params = useParams()
  const router = useRouter()
  const { success, error: toastError, info } = useToast()
  const id = params.id as string

  const [loa, setLoa]             = useState<LOA | null>(null)
  const [loading, setLoading]     = useState(true)
  const [notFound, setNF]         = useState(false)
  const [comment, setComment]     = useState('')
  const [acting, setActing]       = useState(false)
  const [duplicating, setDuplicating] = useState(false)
  const [photos, setPhotos] = useState<{ index: number; url: string }[]>([])
  // Sprint 2.5 — real per-LOA permissions from the 315-entry role-permission matrix.
  // Replaces the old `user.role === 'approver'` check that only covered 3 roles.
  const { permissions, loading: permsLoading } = usePermissions(id)

  useEffect(() => { fetchLOA() }, [id])

  async function fetchLOA() {
    try {
      const data = await getLOA(id)
      setLoa(data)
    } catch {
      setNF(true)
    } finally {
      setLoading(false)
    }
  }

  // ── Workflow actions ──────────────────────────────────────────────────

  // Advances the LOA one step. Backend smart-dispatches between 'validate'
  // and 'advance_phase' based on current status. Frontend just calls /validate.
  async function handleAdvance() {
    if (!loa) return
    const wasValidationStep = VALIDATION_STATUSES.has(loa.status)
    setActing(true)
    try {
      const updated = await validateWorkflowStep(loa.id)
      setLoa(updated)
      success(wasValidationStep ? 'LOA approved ✓' : 'Phase advanced ✓')
      setComment('')
    } catch (e: any) {
      const detail = e.response?.data?.detail
      const msg = typeof detail === 'object' ? detail.message : detail
      toastError(typeof msg === 'string' ? msg : 'Action failed — check your permissions')
    } finally {
      setActing(false)
    }
  }

  // Rejects the LOA. Reason is mandatory — the backend enforces non-empty.
  // The Reject button is disabled in the UI until comment has content.
  async function handleReject() {
    if (!loa || !comment.trim()) return
    setActing(true)
    try {
      setLoa(await rejectLOA(loa.id, comment.trim()))
      toastError('LOA rejected')
      setComment('')
    } catch (e: any) {
      const detail = e.response?.data?.detail
      toastError(typeof detail === 'string' ? detail : 'Rejection failed')
    } finally {
      setActing(false)
    }
  }

  // Lock / Unlock — super-admin only (can_override_lock).
  // Backend enforces this; PermissionGuard hides the button for non-admins.
  async function handleLock() {
    if (!loa) return
    try {
      setLoa(await lockLOA(loa.id))
      success('LOA locked 🔒')
    } catch {
      toastError('Lock failed')
    }
  }

  async function handleUnlock() {
    if (!loa) return
    try {
      setLoa(await unlockLOA(loa.id))
      success('LOA unlocked 🔓')
    } catch {
      toastError('Unlock failed')
    }
  }

  async function handleDownloadPPT() {
    try {
      await downloadPPT(loa!.id)
      success('PPT downloaded ✓')
    } catch {
      toastError('PPT download failed')
    }
  }

  async function handleDuplicate() {
    if (!loa) return
    setDuplicating(true)
    try {
      const payload: any = { ...loa }
      // Strip server-generated and status fields — start the duplicate fresh as draft
      delete payload.id
      delete payload.loa_draft_id
      delete payload.loa_number
      delete payload.status
      delete payload.is_locked
      delete payload.created_at
      delete payload.updated_at
      delete payload.submitted_at
      delete payload.approved_at
      delete payload.rejection_reason
      delete payload.cmo_comment
      // Fix: assign the duplicate to the current user, not the original author
      const currentUser = JSON.parse(localStorage.getItem('laura_user') || '{}')
      if (currentUser.email) payload.requestor_email = currentUser.email
      const newLoa = await createLOA(payload)
      success('LOA duplicated — editing new draft')
      router.push(`/loa/${newLoa.id}`)
    } catch {
      toastError('Duplicate failed')
    } finally {
      setDuplicating(false)
    }
  }

  async function handleRevise() {
    info('Revise mode — edit your LOA and resubmit')
    router.push(`/loa/new?edit=${loa!.id}`)
  }

  async function handleDelete() {
    if (!loa) return
    if (!confirm('Delete this LOA? This cannot be undone.')) return
    try {
      await deleteLOA(loa.id)
      success('LOA deleted')
      router.push('/')
    } catch (e: any) {
      const msg = e.response?.data?.detail
      toastError(typeof msg === 'string' ? msg : 'Delete failed')
    }
  }

  // ── Loading / not found ───────────────────────────────────────────────

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

  // ── Derived state ─────────────────────────────────────────────────────

  const st               = STATUS_CONFIG[loa.status] ?? { label: loa.status, cls: 'badge-draft' }
  const isApproved       = loa.status === 'approved'
  const isRejected       = loa.status === 'rejected'
  const isDraft          = loa.status === 'draft'
  const canBeAdvanced    = ACTIONABLE_STATUSES.has(loa.status)
  const isValidationStep = VALIDATION_STATUSES.has(loa.status)

  // Button label reflects the semantic action: explicit approval vs phase orchestration.
  const advanceLabel = isValidationStep ? '✓ Approve' : '→ Advance phase'

  // Edit is only meaningful on draft/rejected, and only when the LOA is not locked.
  // For locked LOAs, super-admins should unlock first (cleaner UX than bypassing).
  const showEditButton = (isDraft || isRejected) && !loa.is_locked

  const categoryDisplay = Array.isArray(loa.category)
    ? loa.category.join(' + ')
    : loa.category

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen page-enter" style={{ background: 'var(--bg-base)' }}>

      {/* Locked banner — shown above header for maximum visibility */}
      {loa.is_locked && (
        <div
          className="px-6 py-2.5 flex items-center gap-2.5 text-sm"
          style={{
            background: 'var(--amber-bg)',
            borderBottom: '1px solid var(--amber-border)',
            color: 'var(--amber-text)',
          }}
        >
          🔒{' '}
          <span>
            This LOA is <strong>locked</strong> by a super-admin.
            Workflow and edits are paused until unlocked.
          </span>
        </div>
      )}

      {/* ── Header ── */}
      <header
        className="sticky top-0 z-20 px-6 py-3.5 flex items-center justify-between"
        style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/')} className="btn-ghost text-sm px-2">
            ← Back
          </button>
          <span style={{ color: 'var(--border)', opacity: 0.4 }}>|</span>
          <span className="mono text-xs" style={{ color: 'var(--text-muted)' }}>
            {loa.loa_number || loa.loa_draft_id}
          </span>
          <span className={`badge ${st.cls}`}>{st.label}</span>
          {loa.is_locked && (
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{
                background: 'var(--amber-bg)',
                color: 'var(--amber-text)',
                border: '1px solid var(--amber-border)',
              }}
            >
              🔒 Locked
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />

          {/* Edit — PermissionGuard: hides automatically if role has no 'edit'
              permission on the current LOA status from the Sprint 2 matrix.  */}
          {showEditButton && (
            <PermissionGuard
              permissions={permissions}
              action="edit"
              loading={permsLoading}
              hideWhileLoading
            >
              <button
                onClick={() => router.push(`/loa/new?edit=${loa.id}`)}
                className="btn-primary text-xs px-3 py-1.5"
              >
                ✎ Edit
              </button>
            </PermissionGuard>
          )}

          {/* Lock / Unlock — visible only to super-admins (can_override_lock). */}
          <PermissionGuard
            permissions={permissions}
            action="override_lock"
            loading={permsLoading}
            hideWhileLoading
          >
            <button
              onClick={loa.is_locked ? handleUnlock : handleLock}
              className="btn-secondary text-xs px-3 py-1.5"
              style={{
                color: loa.is_locked ? 'var(--amber-text)' : 'var(--text-secondary)',
                borderColor: loa.is_locked ? 'var(--amber-border)' : undefined,
              }}
            >
              {loa.is_locked ? '🔓 Unlock' : '🔒 Lock'}
            </button>
          </PermissionGuard>

          <button
            onClick={handleDuplicate}
            disabled={duplicating}
            className="btn-secondary text-xs px-3 py-1.5 duplicate-btn"
          >
            {duplicating ? '…' : '⎘ Duplicate'}
          </button>

          {/* Delete — only for draft/local_prep, author or super-admin */}
          {(loa.status === 'draft' || loa.status === 'local_prep') && (
            <button
              onClick={handleDelete}
              className="btn-secondary text-xs px-3 py-1.5"
              style={{ color: 'var(--red-text)', borderColor: 'var(--red-border)' }}
            >
              ✕ Delete
            </button>
          )}

          {loa.ppt_slide_required && (
            <button onClick={handleDownloadPPT} className="btn-secondary text-xs px-3 py-1.5">
              ↓ PPT slide
            </button>
          )}

          {/* Excel — Sprint 5 */}
          <button
            disabled
            className="btn-secondary text-xs px-3 py-1.5 opacity-40 cursor-not-allowed"
            title="Coming in Sprint 5 — SharePoint Excel"
          >
            ↓ Excel
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6 grid grid-cols-[1fr_300px] gap-5">

        {/* ════════════════════════════════ LEFT ════════════════════════════ */}
        <div>

          {/* Financial summary */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            {[
              { label: 'FY 2025',    value: formatEuros(loa.fy_2025_total),         highlight: false },
              { label: 'FY 2026',    value: formatEuros(loa.fy_2026_total),         highlight: loa.ppt_slide_required },
              { label: 'Avg / door', value: loa.avg_investment_per_door
                  ? formatEuros(loa.avg_investment_per_door) : '—',                 highlight: false },
            ].map(c => (
              <div key={c.label} className="card px-4 py-3">
                <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>{c.label}</p>
                <p
                  className="text-xl font-semibold tracking-tight"
                  style={{ color: c.highlight ? 'var(--green)' : 'var(--text-primary)' }}
                >
                  {c.value}
                </p>
              </div>
            ))}
          </div>

          <Section title="Geography & Classification">
            <Row label="Cluster"        value={loa.cluster} />
            <Row label="Country"        value={loa.country} />
            <Row label="Legal entity"   value={loa.legal_entity} />
            <Row label="Activity type"  value={loa.activity_type} />
            <Row label="Event type"     value={loa.event_type} />
            <Row label="Event purpose"  value={loa.event_purpose} />
            <Row label="SAP event code" value={(loa as any).sap_event_code} />
            <Row label="COT"            value={loa.cot} />
            <Row label="Category"       value={categoryDisplay} />
            <Row label="Brand"          value={loa.brand} />
            <Row label="CapEx / OpEx"   value={loa.capex_opex} />
            <Row label="ADV / Selling"  value={loa.adv_selling} />
          </Section>

          <Section title="Investment">
            <Row label="Customer"    value={loa.customer} />
            <Row label="Vendor"      value={loa.vendor} />
            <Row label="# Doors"     value={loa.num_doors} />
            <Row label="# Customers" value={loa.num_customers} />
            <Row label="Currency"    value={loa.currency} />
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
            <PhotoUpload loaId={loa.id} onPhotosChange={setPhotos} />
          </Section>

          <Section title="Description & PPT Content">
            {loa.description && (
              <div className="mb-4">
                <p className="label mb-2">Description (WHY)</p>
                <p className="text-sm p-3 rounded-lg"
                  style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}>
                  {loa.description}
                </p>
              </div>
            )}
            {loa.detail && (
              <div className="mb-4">
                <p className="label mb-2">Detail / Tools (HOW)</p>
                <p className="text-sm p-3 rounded-lg whitespace-pre-line"
                  style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}>
                  {loa.detail}
                </p>
              </div>
            )}
            {loa.kpi && (
              <div className="mb-4">
                <p className="label mb-2">KPI</p>
                <p className="text-sm p-3 rounded-lg"
                  style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}>
                  {loa.kpi}
                </p>
              </div>
            )}
            {(loa as any).cost_drill_down && (
              <div>
                <p className="label mb-2">Cost Drill Down</p>
                <p className="text-sm p-3 rounded-lg"
                  style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}>
                  {(loa as any).cost_drill_down}
                </p>
              </div>
            )}
          </Section>
        </div>

        {/* ═══════════════════════════════ RIGHT ════════════════════════════ */}
        <div className="space-y-3 sticky top-20 self-start">

          {/* ── Approval card ── */}
          <div className="card p-5">
            <p className="section-heading">Approval</p>

            {/* Terminal: approved */}
            {isApproved && (
              <div className="rounded-lg px-3 py-2.5 mb-4 text-sm"
                style={{
                  background: 'var(--green-bg)',
                  color: 'var(--green-text)',
                  border: '1px solid var(--green-border)',
                }}>
                ✓ LOA approved
              </div>
            )}

            {/* Terminal: rejected — author sees reason + revise button */}
            {isRejected && (
              <>
                <div className="rounded-lg px-3 py-2.5 mb-3 text-sm"
                  style={{
                    background: 'var(--red-bg)',
                    color: 'var(--red-text)',
                    border: '1px solid var(--red-border)',
                  }}>
                  ✗ LOA rejected
                  {loa.rejection_reason && (
                    <p className="mt-1 text-xs opacity-80">{loa.rejection_reason}</p>
                  )}
                </div>
                <button onClick={handleRevise} className="btn-primary w-full text-sm mb-3">
                  ↩ Revise & resubmit
                </button>
              </>
            )}

            {/* Draft: not yet in workflow */}
            {isDraft && (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Submit this LOA to start the approval workflow.
              </p>
            )}

            {/* Active workflow — locked state */}
            {canBeAdvanced && loa.is_locked && (
              <p className="text-sm" style={{ color: 'var(--amber-text)' }}>
                🔒 Workflow paused — a super-admin must unlock this LOA first.
              </p>
            )}

            {/* Active workflow — permission-gated action panel.
                PermissionGuard checks `can_validate` from the Sprint 2 matrix:
                - true  → user has validate or advance_phase on this status
                - false → user can only observe; fallback shows waiting message  */}
            {canBeAdvanced && !loa.is_locked && (
              <PermissionGuard
                permissions={permissions}
                action="validate"
                loading={permsLoading}
                hideWhileLoading
                fallback={
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    Waiting for approver action at this stage.
                  </p>
                }
              >
                <div className="space-y-3">
                  <div>
                    <label className="label">Rejection reason</label>
                    <textarea
                      className="input resize-none"
                      rows={3}
                      value={comment}
                      onChange={e => setComment(e.target.value)}
                      placeholder="Required to reject — leave empty to advance…"
                    />
                  </div>
                  <button
                    onClick={handleAdvance}
                    disabled={acting}
                    className="btn-primary w-full"
                  >
                    {acting ? 'Processing…' : advanceLabel}
                  </button>
                  <button
                    onClick={handleReject}
                    disabled={acting || !comment.trim()}
                    className="btn-secondary w-full text-sm"
                    style={{ color: 'var(--red-text)', borderColor: 'var(--red-border)' }}
                  >
                    ✗ Reject
                  </button>
                </div>
              </PermissionGuard>
            )}
          </div>

          {/* ── Activity Timeline ── */}
          <div className="card p-5">
            <p className="section-heading">Timeline</p>
            <Timeline loa={loa} />
          </div>

          {/* ── Mini PPT preview ── */}
          <div className="card overflow-hidden">
            <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                Slide preview
              </span>
            </div>
            <div
              className="m-3 rounded-lg overflow-hidden text-[10px]"
              style={{ border: '1px solid var(--border)' }}
            >
              <div className="px-3 py-1.5 flex justify-between" style={{ background: '#0D1B2A' }}>
                <span style={{ color: '#aaa' }}>{categoryDisplay}</span>
                <span className="font-semibold" style={{ color: 'white' }}>
                  {loa.country} · {formatEuros(loa.fy_2026_total)}
                </span>
              </div>
              <div
                className="px-3 py-1.5 font-semibold text-xs truncate"
                style={{
                  color: 'var(--text-primary)',
                  borderBottom: '1px solid var(--border)',
                  background: 'var(--bg-surface)',
                }}
              >
                {loa.activity_type}
              </div>
              <div className="grid grid-cols-2 divide-x" style={{ borderColor: 'var(--border)' }}>
                <div className="px-3 py-3 space-y-2" style={{ background: 'var(--bg-surface)' }}>
                  {loa.description && (
                    <div>
                      <p className="font-medium" style={{ color: 'var(--text-muted)' }}>Description:</p>
                      <p style={{ color: 'var(--text-secondary)' }}>{loa.description}</p>
                    </div>
                  )}
                  {loa.kpi && (
                    <div>
                      <p className="font-medium" style={{ color: 'var(--text-muted)' }}>KPI:</p>
                      <p style={{ color: 'var(--text-secondary)' }}>{loa.kpi}</p>
                    </div>
                  )}
                  {!loa.description && !loa.kpi && (
                    <p style={{ color: 'var(--text-muted)' }}>No content yet</p>
                  )}
                </div>
                <div style={{ background: 'var(--bg-elevated)' }}>
                  {photos.length > 0 ? (
                    <div className="h-full flex flex-col">
                      {photos.map((p, i) => (
                        <div key={p.index} className="flex-1 overflow-hidden min-h-[40px]"
                          style={{ borderBottom: i < photos.length - 1 ? '1px solid var(--border)' : 'none' }}>
                          <img src={p.url} alt="" className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center min-h-[80px]">
                      <p className="text-center px-2" style={{ color: 'var(--text-muted)' }}>
                        Photos<br />(max 2)
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  )
}
