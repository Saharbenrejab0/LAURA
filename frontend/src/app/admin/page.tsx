'use client'

/**
 * LAURA — Admin Dashboard (Rock #2–5 redesign, June 2026)
 *
 * Design brief: "Bloomberg density inside an Apple grid."
 * References: Stripe permissions, Linear member management,
 *   AWS IAM permission sets, Mercury Treasury, Carta cap table.
 *
 * Visual language:
 *   - IBM Plex Mono for all numbers, IDs, financial values
 *   - System sans-serif for labels, titles, body
 *   - Single accent: champagne #C9A678
 *   - No colored status fills in admin — outline + text only
 *   - Sharp 2px border-radius (Essilor rectangles)
 *   - Light = annual report, Dark = operating terminal
 *
 * All fetching, RBAC, and action logic preserved from previous version.
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMyRole } from '@/hooks/usePermissions'
import { ThemeToggle } from '@/components/ThemeProvider'
import { useToast } from '@/components/Toast'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

/* ────────────────────────────────────────────────
   Types (unchanged)
   ──────────────────────────────────────────────── */

interface DashStats {
  status_counts: Record<string, number>
  total_loas: number
  total_fy26: number
  total_users: number
  locked_count: number
  pipeline_count: number
  cluster_budgets: { cluster: string; total: number }[]
  activity_budgets: { activity: string; total: number }[]
  recent_loas: {
    id: string; draft_id: string; status: string; cluster: string
    country: string; brand: string; fy_2026_total: number
    updated_at: string | null; requestor_email: string
  }[]
}

interface AdminUser {
  id: string; email: string; full_name: string; is_active: boolean
  role_code: string | null; role_name: string; scope_type: string | null
  can_override_lock: boolean; created_at: string | null
}

interface AdminRole {
  id: number; code: string; display_name: string; scope_type: string
  scope_value: string[] | null; can_override_lock: boolean; user_count: number
}

interface MatrixData {
  statuses: string[]
  matrix: { role_code: string; role_name: string; permissions: Record<string, string> }[]
}

type Tab = 'overview' | 'permissions' | 'users' | 'overrides'

/* ────────────────────────────────────────────────
   Helpers
   ──────────────────────────────────────────────── */

async function adminFetch(path: string, opts: RequestInit = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('laura_token') : null
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail))
  }
  return res.json()
}

function fmtEuro(n: number): string {
  if (!n) return '€0'
  if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `€${Math.round(n / 1_000)}k`
  return `€${Math.round(n)}`
}

function timeAgo(iso: string | null): string {
  if (!iso) return '—'
  const then = new Date(iso).getTime()
  if (!then) return '—'
  const diff = Date.now() - then
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  if (diff < 30 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`
  return new Date(iso).toLocaleDateString()
}

function fmtTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft', emea_review: 'EMEA', global_review: 'Global',
  cmo_cfo_review: 'CMO/CFO', global_functions_review: 'Functions',
  corporate_review: 'Corporate', approved: 'Approved', rejected: 'Rejected',
}

/* Workflow order for the strip */
const WORKFLOW_ORDER = [
  'draft', 'emea_review', 'global_review', 'cmo_cfo_review',
  'global_functions_review', 'corporate_review', 'approved', 'rejected',
]

/* Permission code display */
const PERM_CODES: Record<string, { code: string; cls: string; title: string }> = {
  advance_phase: { code: 'A', cls: 'admin-perm admin-perm--advance', title: 'Advance' },
  validate:      { code: 'V', cls: 'admin-perm admin-perm--validate', title: 'Validate' },
  edit:          { code: 'E', cls: 'admin-perm admin-perm--edit', title: 'Edit' },
  comment:       { code: 'C', cls: 'admin-perm admin-perm--comment', title: 'Comment' },
  view:          { code: 'R', cls: 'admin-perm admin-perm--view', title: 'Read' },
  none:          { code: '—', cls: 'admin-perm admin-perm--none', title: 'None' },
}

const PERM_OPTIONS = ['advance_phase', 'validate', 'edit', 'comment', 'view', 'none']

/* ────────────────────────────────────────────────
   Monday Brief generator (deterministic, no AI)
   ──────────────────────────────────────────────── */

function generateMondayBrief(stats: DashStats): string {
  const lines: string[] = []

  lines.push(
    `${fmtEuro(stats.total_fy26)} committed across ${stats.total_loas.toLocaleString()} LOAs.`
  )

  const activeReview = stats.pipeline_count
  const rejected = stats.status_counts.rejected || 0

  if (activeReview > 0 || rejected > 0) {
    const parts: string[] = []
    if (activeReview > 0) parts.push(`${activeReview} LOAs are in active review`)
    if (rejected > 0) parts.push(`${rejected} are rejected`)
    lines.push(parts.join('. ') + '.')
  }

  // Find bottleneck: the review stage with the most waiting LOAs
  const reviewStatuses = ['emea_review', 'global_review', 'cmo_cfo_review', 'global_functions_review', 'corporate_review']
  let maxWaiting = 0
  let bottleneck = ''
  for (const s of reviewStatuses) {
    const count = stats.status_counts[s] || 0
    if (count > maxWaiting) { maxWaiting = count; bottleneck = s }
  }
  if (maxWaiting > 0) {
    lines.push(`The current bottleneck is ${STATUS_LABELS[bottleneck]} review: ${maxWaiting} LOAs waiting.`)
  }

  if (stats.locked_count === 0) {
    lines.push('No locked workflows.')
  } else {
    lines.push(`${stats.locked_count} locked workflows need attention.`)
  }

  return lines.join('\n')
}

/* ────────────────────────────────────────────────
   Main page
   ──────────────────────────────────────────────── */

export default function AdminDashboard() {
  const router = useRouter()
  const { success, error: toastError } = useToast()
  const { role, loading: roleLoading } = useMyRole()

  const [tab, setTab] = useState<Tab>('overview')
  const [stats, setStats] = useState<DashStats | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [roles, setRoles] = useState<AdminRole[]>([])
  const [matrix, setMatrix] = useState<MatrixData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  /* Force/Override state */
  const [overrideLoaId, setOverrideLoaId] = useState('')
  const [overrideStatus, setOverrideStatus] = useState('emea_review')
  const [overrideReason, setOverrideReason] = useState('')
  const [overrideConfirm, setOverrideConfirm] = useState('')
  const [overriding, setOverriding] = useState(false)

  /* Matrix edit state */
  const [matrixEdits, setMatrixEdits] = useState<Record<string, string>>({})
  const [savingMatrix, setSavingMatrix] = useState(false)
  const [showAdvancedMatrix, setShowAdvancedMatrix] = useState(false)

  /* Users search */
  const [userSearch, setUserSearch] = useState('')

  useEffect(() => {
    if (roleLoading) return
    if (!role?.can_override_lock) {
      setError('Super-admin access required')
      setLoading(false)
      return
    }
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleLoading, role])

  async function loadAll() {
    setLoading(true)
    try {
      const [s, u, r, m] = await Promise.all([
        adminFetch('/admin/stats'),
        adminFetch('/admin/users'),
        adminFetch('/admin/roles'),
        adminFetch('/admin/permission-matrix'),
      ])
      setStats(s); setUsers(u); setRoles(r); setMatrix(m)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleChangeRole(userId: string, roleCode: string) {
    try {
      await adminFetch(`/admin/users/${userId}/role`, {
        method: 'PATCH', body: JSON.stringify({ role_code: roleCode }),
      })
      success('Role updated')
      setUsers(prev => prev.map(u => u.id === userId
        ? { ...u, role_code: roleCode, role_name: roles.find(r => r.code === roleCode)?.display_name || roleCode }
        : u
      ))
    } catch (e: any) { toastError(e.message) }
  }

  async function handleOverride() {
    if (!overrideLoaId.trim()) return
    setOverriding(true)
    try {
      const result = await adminFetch(`/admin/loa/${overrideLoaId.trim()}/force-status`, {
        method: 'POST',
        body: JSON.stringify({ new_status: overrideStatus, reason: overrideReason }),
      })
      success(`Override applied: ${result.draft_id} ${result.old_status} → ${result.new_status}`)
      setOverrideLoaId(''); setOverrideReason(''); setOverrideConfirm('')
    } catch (e: any) { toastError(e.message) }
    finally { setOverriding(false) }
  }

  function setMatrixCell(roleCode: string, status: string, perm: string) {
    setMatrixEdits(prev => ({ ...prev, [`${roleCode}:${status}`]: perm }))
  }

  async function saveMatrix() {
    const entries = Object.entries(matrixEdits).map(([key, perm]) => {
      const [role_code, loa_status] = key.split(':')
      return { role_code, loa_status, permission_code: perm }
    })
    if (entries.length === 0) return
    setSavingMatrix(true)
    try {
      const result = await adminFetch('/admin/permission-matrix', {
        method: 'PATCH', body: JSON.stringify({ entries }),
      })
      success(`Matrix saved: ${result.updated} updated, ${result.created} created, ${result.deleted} removed`)
      setMatrixEdits({})
      setMatrix(await adminFetch('/admin/permission-matrix'))
    } catch (e: any) { toastError(e.message) }
    finally { setSavingMatrix(false) }
  }

  /* ── Loading / Error gates ── */

  if (loading || roleLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'var(--admin-bg)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span className="type-body" style={{ color: 'var(--admin-text-faint)' }}>
          Loading admin dashboard…
        </span>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'var(--admin-bg)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 16,
      }}>
        <span className="type-body" style={{ color: 'var(--admin-text)' }}>{error}</span>
        <button onClick={() => router.push('/')} style={btnPrimary}>
          Back to tracker
        </button>
      </div>
    )
  }

  const editCount = Object.keys(matrixEdits).length

  return (
    <div style={{ minHeight: '100vh', background: 'var(--admin-bg)' }}>

      {/* ═══════════ HEADER ═══════════ */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 20,
        padding: '0 32px',
        background: 'var(--admin-surface)',
        borderBottom: '1px solid var(--admin-border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: 52,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button onClick={() => router.push('/')} style={btnGhost}>← Back</button>
          <span style={{ color: 'var(--admin-border)', userSelect: 'none' }}>|</span>
          <span className="type-section-title">Admin</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
          {(['overview', 'permissions', 'users', 'overrides'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                background: 'transparent',
                border: 'none',
                padding: '16px 20px',
                fontFamily: 'var(--admin-font-sans)',
                fontSize: 13,
                fontWeight: tab === t ? 600 : 400,
                color: tab === t ? 'var(--admin-text)' : 'var(--admin-text-faint)',
                borderBottom: tab === t ? '2px solid var(--admin-accent)' : '2px solid transparent',
                cursor: 'pointer',
                letterSpacing: '0.01em',
                transition: 'color 120ms ease',
              }}
            >
              {t === 'overrides' ? 'Overrides' : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
          <div style={{ marginLeft: 20 }}><ThemeToggle /></div>
        </div>
      </header>

      {/* ═══════════ CONTENT ═══════════ */}
      <main style={{ maxWidth: 1280, margin: '0 auto', padding: '28px 32px' }}>

        {tab === 'overview' && stats && (
          <OverviewTab stats={stats} onOpenLoa={(id) => router.push(`/loa/${id}`)} />
        )}

        {tab === 'permissions' && matrix && (
          <PermissionsTab
            matrix={matrix}
            roles={roles}
            edits={matrixEdits}
            editCount={editCount}
            saving={savingMatrix}
            showAdvanced={showAdvancedMatrix}
            onToggleAdvanced={() => setShowAdvancedMatrix(!showAdvancedMatrix)}
            onCellChange={setMatrixCell}
            onDiscard={() => setMatrixEdits({})}
            onSave={saveMatrix}
          />
        )}

        {tab === 'users' && (
          <UsersTab
            users={users}
            roles={roles}
            search={userSearch}
            onSearchChange={setUserSearch}
            onChangeRole={handleChangeRole}
          />
        )}

        {tab === 'overrides' && (
          <OverridesTab
            loaId={overrideLoaId} setLoaId={setOverrideLoaId}
            status={overrideStatus} setStatus={setOverrideStatus}
            reason={overrideReason} setReason={setOverrideReason}
            confirm={overrideConfirm} setConfirm={setOverrideConfirm}
            overriding={overriding} onSubmit={handleOverride}
          />
        )}
      </main>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   OVERVIEW TAB
   Monday Brief → Hero number → Workflow strip → Cluster bars →
   Activity mix → Recent activity
   ════════════════════════════════════════════════════════════════════════ */

function OverviewTab({ stats, onOpenLoa }: {
  stats: DashStats; onOpenLoa: (id: string) => void
}) {
  const now = new Date()
  const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const brief = generateMondayBrief(stats)
  const rejected = stats.status_counts.rejected || 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

      {/* ── Monday Brief ── */}
      <div style={{
        borderTop: '1px solid var(--admin-text)',
        borderLeft: '3px solid var(--admin-accent)',
        padding: '20px 24px',
        background: 'transparent',
      }}>
        <div className="type-micro" style={{ marginBottom: 12, color: 'var(--admin-text-faint)' }}>
          Monday Brief · {dateStr} · {timeStr}
        </div>
        <div className="type-body" style={{ whiteSpace: 'pre-line', lineHeight: 1.7 }}>
          {brief}
        </div>
      </div>

      {/* ── Hero number + control figures ── */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 48 }}>
        <div>
          <div className="type-hero" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {fmtEuro(stats.total_fy26)}
          </div>
          <div className="type-caption" style={{ marginTop: 4 }}>
            Committed FY26 marketing budget
          </div>
        </div>
        <div style={{ display: 'flex', gap: 32, paddingBottom: 6 }}>
          <ControlFigure value={stats.total_loas.toLocaleString()} label="LOAs" />
          <ControlFigure value={String(stats.pipeline_count)} label="active review" />
          <ControlFigure
            value={String(rejected)}
            label="rejected"
            warn={rejected > 0}
          />
          <ControlFigure value={String(stats.locked_count)} label="locked" />
        </div>
      </div>

      {/* ── Workflow strip ── */}
      <div>
        <div className="type-micro" style={{ marginBottom: 12 }}>Workflow state</div>
        <div style={{
          display: 'flex', gap: 0,
          borderTop: '1px solid var(--admin-border)',
          borderBottom: '1px solid var(--admin-border)',
        }}>
          {WORKFLOW_ORDER.map((s, i) => {
            const count = stats.status_counts[s] || 0
            const isLast = i === WORKFLOW_ORDER.length - 1
            return (
              <div key={s} style={{
                flex: 1,
                padding: '12px 8px',
                borderRight: isLast ? 'none' : '1px solid var(--admin-border)',
                textAlign: 'center',
              }}>
                <div style={{
                  fontFamily: 'var(--admin-font-mono)',
                  fontWeight: 600,
                  fontSize: 18,
                  color: count > 0 ? 'var(--admin-text)' : 'var(--admin-text-faint)',
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {count.toLocaleString()}
                </div>
                <div style={{
                  fontFamily: 'var(--admin-font-sans)',
                  fontSize: 10,
                  fontWeight: 500,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: 'var(--admin-text-faint)',
                  marginTop: 2,
                }}>
                  {STATUS_LABELS[s]}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Budget by cluster + Activity mix ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
        <div>
          <div className="type-micro" style={{ marginBottom: 16 }}>Budget by cluster</div>
          <BudgetBars items={stats.cluster_budgets.map(c => ({ label: c.cluster, value: c.total }))} />
        </div>
        <div>
          <div className="type-micro" style={{ marginBottom: 16 }}>Activity mix</div>
          <BudgetBars items={stats.activity_budgets.slice(0, 8).map(a => ({ label: a.activity, value: a.total }))} />
        </div>
      </div>

      {/* ── Recent activity ── */}
      <div>
        <div className="type-micro" style={{ marginBottom: 12 }}>Recent activity</div>
        <div className="admin-surface" style={{ overflow: 'hidden' }}>
          {/* Table header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '56px 140px 90px minmax(0,1fr) 90px 100px 80px',
            gap: 0,
            padding: '10px 16px',
            background: 'var(--admin-surface-subtle)',
            borderBottom: '1px solid var(--admin-border)',
          }}>
            {['Time', 'LOA ID', 'Status', 'Description', 'Cluster', 'FY 2026', 'Updated'].map(h => (
              <span key={h} className="type-th">{h}</span>
            ))}
          </div>
          {/* Rows */}
          {stats.recent_loas.map(loa => (
            <RecentRow key={loa.id} loa={loa} onClick={() => onOpenLoa(loa.id)} />
          ))}
          {stats.recent_loas.length === 0 && (
            <div style={{ padding: '32px 16px', textAlign: 'center' }}>
              <span className="type-caption">No recent activity.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ControlFigure({ value, label, warn }: { value: string; label: string; warn?: boolean }) {
  return (
    <div>
      <span style={{
        fontFamily: 'var(--admin-font-mono)',
        fontWeight: 500,
        fontSize: 20,
        letterSpacing: '-0.02em',
        color: warn ? 'var(--admin-accent-deep)' : 'var(--admin-text)',
        fontVariantNumeric: 'tabular-nums',
      }}>
        {value}
      </span>
      <span style={{
        fontFamily: 'var(--admin-font-sans)',
        fontSize: 13,
        color: 'var(--admin-text-muted)',
        marginLeft: 6,
      }}>
        {label}
      </span>
    </div>
  )
}

function BudgetBars({ items }: { items: { label: string; value: number }[] }) {
  const sorted = [...items].sort((a, b) => b.value - a.value)
  const max = Math.max(...sorted.map(i => i.value), 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {sorted.map((item, i) => {
        const pct = Math.max((item.value / max) * 100, 1)
        return (
          <div key={item.label}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
              marginBottom: 4, gap: 12,
            }}>
              <span style={{
                fontFamily: 'var(--admin-font-sans)',
                fontSize: 12, fontWeight: 500,
                color: 'var(--admin-text)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                flex: 1, minWidth: 0,
              }}>
                {item.label}
              </span>
              <span style={{
                fontFamily: 'var(--admin-font-mono)',
                fontSize: 13, fontWeight: 500,
                color: 'var(--admin-text)',
                flexShrink: 0,
                fontVariantNumeric: 'tabular-nums',
              }}>
                {fmtEuro(item.value)}
              </span>
            </div>
            <div style={{
              height: 3,
              background: 'var(--admin-surface-subtle)',
              overflow: 'hidden',
            }}>
              <div style={{
                width: `${pct}%`,
                height: '100%',
                background: i === 0 ? 'var(--admin-accent)' : 'var(--admin-text)',
                transition: 'width 500ms ease',
              }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function RecentRow({ loa, onClick }: {
  loa: DashStats['recent_loas'][number]; onClick: () => void
}) {
  const [hover, setHover] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: 'grid',
        gridTemplateColumns: '56px 140px 90px minmax(0,1fr) 90px 100px 80px',
        gap: 0,
        padding: '10px 16px',
        alignItems: 'center',
        borderBottom: '1px solid var(--admin-border)',
        background: hover ? 'var(--admin-surface-subtle)' : 'transparent',
        cursor: 'pointer',
        transition: 'background 100ms ease',
      }}
    >
      <span className="type-caption">{fmtTime(loa.updated_at)}</span>
      <span className="type-loa-id">{loa.draft_id}</span>
      <span className="admin-status-pill admin-status-pill--muted" style={{ fontSize: 10, padding: '2px 6px' }}>
        {STATUS_LABELS[loa.status] || loa.status}
      </span>
      <span style={{
        fontSize: 12, color: 'var(--admin-text)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {[loa.country, loa.brand].filter(Boolean).join(' · ') || '—'}
      </span>
      <span className="type-caption">{loa.cluster || '—'}</span>
      <span className="type-table-num" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {fmtEuro(loa.fy_2026_total)}
      </span>
      <span className="type-caption" style={{ textAlign: 'right' }}>{timeAgo(loa.updated_at)}</span>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   PERMISSIONS TAB
   Role groups view → Advanced matrix toggle
   ════════════════════════════════════════════════════════════════════════ */

function PermissionsTab({ matrix, roles, edits, editCount, saving, showAdvanced, onToggleAdvanced, onCellChange, onDiscard, onSave }: {
  matrix: MatrixData
  roles: AdminRole[]
  edits: Record<string, string>
  editCount: number
  saving: boolean
  showAdvanced: boolean
  onToggleAdvanced: () => void
  onCellChange: (role: string, status: string, perm: string) => void
  onDiscard: () => void
  onSave: () => void
}) {
  /* Group roles by scope_type for the summary view */
  const roleGroups = groupRoles(matrix, roles)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      <div>
        <div className="type-page-title" style={{ marginBottom: 4 }}>Permissions</div>
        <div className="type-body" style={{ color: 'var(--admin-text-muted)' }}>
          Role profiles, deviations, and workflow access.
        </div>
      </div>

      {/* Role groups summary */}
      {!showAdvanced && (
        <div className="admin-surface" style={{ overflow: 'hidden' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0,1fr) 80px 100px',
            gap: 0,
            padding: '10px 20px',
            background: 'var(--admin-surface-subtle)',
            borderBottom: '1px solid var(--admin-border)',
          }}>
            <span className="type-th">Role group</span>
            <span className="type-th" style={{ textAlign: 'center' }}>Roles</span>
            <span className="type-th" style={{ textAlign: 'center' }}>Users</span>
          </div>
          {roleGroups.map(g => (
            <div key={g.label} style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0,1fr) 80px 100px',
              gap: 0,
              padding: '14px 20px',
              borderBottom: '1px solid var(--admin-border)',
              alignItems: 'center',
            }}>
              <div>
                <div style={{
                  fontFamily: 'var(--admin-font-sans)',
                  fontSize: 14, fontWeight: 500,
                  color: 'var(--admin-text)',
                }}>
                  {g.label}
                </div>
                <div className="type-caption" style={{ marginTop: 2 }}>{g.summary}</div>
              </div>
              <div style={{
                fontFamily: 'var(--admin-font-mono)',
                fontSize: 14, fontWeight: 500,
                color: 'var(--admin-text)',
                textAlign: 'center',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {g.roleCount}
              </div>
              <div style={{
                fontFamily: 'var(--admin-font-mono)',
                fontSize: 14, fontWeight: 500,
                color: 'var(--admin-text)',
                textAlign: 'center',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {g.userCount}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Toggle + save controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <button onClick={onToggleAdvanced} style={btnSecondary}>
          {showAdvanced ? 'Show role groups' : 'Open matrix editor'}
        </button>
        {showAdvanced && (
          <div style={{ display: 'flex', gap: 8 }}>
            {editCount > 0 && (
              <button onClick={onDiscard} style={btnSecondary}>Discard ({editCount})</button>
            )}
            <button
              onClick={onSave}
              disabled={editCount === 0 || saving}
              style={{
                ...btnPrimary,
                opacity: editCount === 0 || saving ? 0.4 : 1,
                cursor: editCount === 0 || saving ? 'not-allowed' : 'pointer',
              }}
            >
              {saving ? 'Saving…' : `Save changes (${editCount})`}
            </button>
          </div>
        )}
      </div>

      {/* Advanced matrix */}
      {showAdvanced && (
        <div className="admin-surface" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                <th style={{
                  ...thBase,
                  position: 'sticky', left: 0, zIndex: 10,
                  background: 'var(--admin-surface)',
                  minWidth: 200, textAlign: 'left',
                  borderBottom: '1px solid var(--admin-border)',
                  borderRight: '1px solid var(--admin-border)',
                }}>
                  <span className="type-th">Role</span>
                </th>
                {matrix.statuses.map(s => (
                  <th key={s} style={{
                    ...thBase,
                    minWidth: 80,
                    textAlign: 'center',
                    borderBottom: '1px solid var(--admin-border)',
                  }}>
                    <span className="type-th">{STATUS_LABELS[s] || s}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.matrix.map(row => (
                <tr key={row.role_code}>
                  <td style={{
                    padding: '8px 16px',
                    position: 'sticky', left: 0, zIndex: 5,
                    background: 'var(--admin-surface)',
                    borderBottom: '1px solid var(--admin-border)',
                    borderRight: '1px solid var(--admin-border)',
                    fontFamily: 'var(--admin-font-sans)',
                    fontSize: 12, fontWeight: 500,
                    color: 'var(--admin-text)',
                  }}>
                    {row.role_name}
                  </td>
                  {matrix.statuses.map(status => {
                    const editKey = `${row.role_code}:${status}`
                    const current = edits[editKey] ?? row.permissions[status] ?? 'none'
                    const isEdited = editKey in edits
                    const pc = PERM_CODES[current] || PERM_CODES.none
                    return (
                      <td
                        key={status}
                        className={isEdited ? 'admin-cell-edited' : ''}
                        style={{
                          padding: '6px 4px',
                          textAlign: 'center',
                          borderBottom: '1px solid var(--admin-border)',
                          position: 'relative',
                        }}
                      >
                        <select
                          value={current}
                          onChange={e => onCellChange(row.role_code, status, e.target.value)}
                          title={pc.title}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            fontFamily: 'var(--admin-font-mono)',
                            fontSize: 12,
                            fontWeight: 500,
                            color: current === 'view' ? 'var(--admin-text-muted)'
                              : current === 'none' ? 'var(--admin-text-faint)'
                              : 'var(--admin-text)',
                            textAlign: 'center',
                            cursor: 'pointer',
                            padding: '4px 2px',
                            width: '100%',
                            appearance: 'none',
                            WebkitAppearance: 'none',
                          }}
                        >
                          {PERM_OPTIONS.map(p => (
                            <option key={p} value={p}>
                              {PERM_CODES[p]?.code || '—'} {PERM_CODES[p]?.title || p}
                            </option>
                          ))}
                        </select>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/** Group matrix roles by scope for the summary view */
function groupRoles(matrix: MatrixData, roles: AdminRole[]) {
  const groups: Record<string, { label: string; roles: string[]; userCount: number; summary: string }> = {}

  for (const role of roles) {
    const scope = role.scope_type || 'other'
    let groupKey: string
    let label: string
    let summary: string

    if (role.code === 'super_admin') {
      groupKey = 'super_admin'
      label = 'Super Admin'
      summary = 'Full access across all statuses'
    } else if (role.code.includes('emea_ps')) {
      groupKey = 'emea_ps'
      label = 'EMEA PS'
      summary = 'Advance across workflow'
    } else if (scope === 'cluster' && role.code.includes('marketer')) {
      groupKey = 'local_marketers'
      label = 'Local Marketers'
      summary = 'Edit at Draft, view elsewhere'
    } else if (scope === 'cluster' && role.code.includes('finance')) {
      groupKey = 'local_finance'
      label = 'Local Finance'
      summary = 'Edit at Draft, view elsewhere'
    } else if (role.code.includes('global') && role.code.includes('brand')) {
      groupKey = 'global_brands'
      label = 'Global Brands'
      summary = 'Comment at Global review'
    } else if (role.code.includes('global') && role.code.includes('function')) {
      groupKey = 'global_functions'
      label = 'Global Functions'
      summary = 'Comment at Functions review'
    } else if (role.code.includes('corporate')) {
      groupKey = 'corporate'
      label = 'Corporate'
      summary = 'Validate at Corporate review'
    } else {
      groupKey = scope
      label = scope.charAt(0).toUpperCase() + scope.slice(1)
      summary = 'Mixed access'
    }

    if (!groups[groupKey]) {
      groups[groupKey] = { label, roles: [], userCount: 0, summary }
    }
    groups[groupKey].roles.push(role.code)
    groups[groupKey].userCount += role.user_count
  }

  return Object.values(groups).map(g => ({
    label: g.label,
    roleCount: g.roles.length,
    userCount: g.userCount,
    summary: g.summary,
  }))
}

/* ════════════════════════════════════════════════════════════════════════
   USERS TAB
   Search-first table
   ════════════════════════════════════════════════════════════════════════ */

function UsersTab({ users, roles, search, onSearchChange, onChangeRole }: {
  users: AdminUser[]
  roles: AdminRole[]
  search: string
  onSearchChange: (v: string) => void
  onChangeRole: (id: string, code: string) => void
}) {
  const filtered = users.filter(u => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      u.email.toLowerCase().includes(q) ||
      (u.full_name || '').toLowerCase().includes(q) ||
      (u.role_name || '').toLowerCase().includes(q) ||
      (u.scope_type || '').toLowerCase().includes(q)
    )
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div>
          <div className="type-page-title" style={{ marginBottom: 4 }}>Users</div>
          <div className="type-caption">{users.length} users</div>
        </div>
      </div>

      {/* Search */}
      <div>
        <input
          type="text"
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          placeholder="Search email, name, role, cluster…"
          style={{
            width: '100%',
            maxWidth: 400,
            padding: '10px 14px',
            fontFamily: 'var(--admin-font-sans)',
            fontSize: 13,
            background: 'var(--admin-surface)',
            color: 'var(--admin-text)',
            border: '1px solid var(--admin-border)',
            borderRadius: 2,
            outline: 'none',
          }}
        />
      </div>

      {/* Table */}
      <div className="admin-surface" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Email', 'Name', 'Role', 'Scope', 'Admin', 'Change role'].map(h => (
                  <th key={h} style={{
                    ...thBase,
                    background: 'var(--admin-surface-subtle)',
                    borderBottom: '1px solid var(--admin-border)',
                    textAlign: 'left',
                  }}>
                    <span className="type-th">{h}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <UserRow key={u.id} user={u} roles={roles} onChangeRole={onChangeRole} />
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: '32px 16px', textAlign: 'center' }}>
                    <span className="type-caption">No users match "{search}"</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function UserRow({ user, roles, onChangeRole }: {
  user: AdminUser; roles: AdminRole[]; onChangeRole: (id: string, code: string) => void
}) {
  const [hover, setHover] = useState(false)
  return (
    <tr
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        borderBottom: '1px solid var(--admin-border)',
        background: hover ? 'var(--admin-surface-subtle)' : 'transparent',
        transition: 'background 100ms ease',
      }}
    >
      <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 500, color: 'var(--admin-text)' }}>
        {user.email}
      </td>
      <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--admin-text-muted)' }}>
        {user.full_name || '—'}
      </td>
      <td style={{ padding: '12px 16px' }}>
        <span className="admin-status-pill admin-status-pill--muted" style={{ fontSize: 10 }}>
          {user.role_name}
        </span>
      </td>
      <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--admin-text-faint)' }}>
        {user.scope_type || '—'}
      </td>
      <td style={{ padding: '12px 16px' }}>
        {user.can_override_lock ? (
          <span style={{ color: 'var(--admin-accent)', fontSize: 13 }}>✓</span>
        ) : (
          <span style={{ color: 'var(--admin-text-faint)' }}>—</span>
        )}
      </td>
      <td style={{ padding: '8px 16px' }}>
        <select
          value={user.role_code || ''}
          onChange={e => onChangeRole(user.id, e.target.value)}
          style={{
            background: 'var(--admin-surface)',
            color: 'var(--admin-text)',
            border: '1px solid var(--admin-border)',
            padding: '6px 10px',
            fontSize: 12,
            fontFamily: 'var(--admin-font-sans)',
            borderRadius: 2,
            cursor: 'pointer',
            minWidth: 200,
          }}
        >
          {roles.map(r => <option key={r.code} value={r.code}>{r.display_name}</option>)}
        </select>
      </td>
    </tr>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   OVERRIDES TAB (was "Force Status")
   Stripe-style confirmation pattern: type LOA ID to confirm.
   ════════════════════════════════════════════════════════════════════════ */

function OverridesTab({
  loaId, setLoaId, status, setStatus, reason, setReason,
  confirm, setConfirm, overriding, onSubmit,
}: {
  loaId: string; setLoaId: (v: string) => void
  status: string; setStatus: (v: string) => void
  reason: string; setReason: (v: string) => void
  confirm: string; setConfirm: (v: string) => void
  overriding: boolean; onSubmit: () => void
}) {
  const idTrimmed = loaId.trim()
  const confirmed = idTrimmed.length > 0 && confirm.trim() === idTrimmed
  const canSubmit = confirmed && reason.trim().length > 0 && !overriding

  return (
    <div style={{ maxWidth: 520 }}>
      <div className="type-page-title" style={{ marginBottom: 4 }}>Overrides</div>
      <div className="type-body" style={{ color: 'var(--admin-text-muted)', marginBottom: 28 }}>
        Emergency workflow override. Bypasses permission checks and writes an audit event.
      </div>

      <div className="admin-surface" style={{
        padding: '28px 24px',
        display: 'flex', flexDirection: 'column', gap: 20,
        borderColor: 'var(--admin-text)',
      }}>

        <FieldGroup label="LOA">
          <input
            value={loaId}
            onChange={e => setLoaId(e.target.value)}
            placeholder="Search by LAURA ID…"
            style={inputStyle}
          />
        </FieldGroup>

        <FieldGroup label="Move to">
          <select value={status} onChange={e => setStatus(e.target.value)} style={inputStyle}>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </FieldGroup>

        {idTrimmed && (
          <div style={{
            padding: '14px 16px',
            background: 'var(--admin-surface-subtle)',
            borderRadius: 2,
            borderLeft: '3px solid var(--admin-text)',
          }}>
            <div className="type-caption" style={{ lineHeight: 1.7 }}>
              <strong>Consequence:</strong> This will move the LOA forward without the current stage's validation.
              All current reviewers will lose comment access.
              The action will appear in the audit ledger.
            </div>
          </div>
        )}

        <FieldGroup label="Reason (required)">
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Why is this override necessary?"
            rows={2}
            style={{ ...inputStyle, resize: 'none' }}
          />
        </FieldGroup>

        <FieldGroup label="Confirmation">
          <div className="type-caption" style={{ marginBottom: 8 }}>
            Type <strong style={{ fontFamily: 'var(--admin-font-mono)', color: 'var(--admin-text)' }}>
              {idTrimmed || 'the LOA ID'}
            </strong> to confirm
          </div>
          <input
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            placeholder={idTrimmed || 'Enter LOA ID first'}
            style={inputStyle}
          />
        </FieldGroup>

        <button
          onClick={onSubmit}
          disabled={!canSubmit}
          style={{
            background: canSubmit ? 'var(--admin-text)' : 'var(--admin-border)',
            color: canSubmit ? 'var(--admin-bg)' : 'var(--admin-text-faint)',
            border: 'none',
            borderRadius: 2,
            padding: '12px 16px',
            fontFamily: 'var(--admin-font-sans)',
            fontSize: 13,
            fontWeight: 500,
            cursor: canSubmit ? 'pointer' : 'not-allowed',
            letterSpacing: '0.02em',
            transition: 'background 140ms ease, color 140ms ease',
          }}
        >
          {overriding ? 'Applying override…' : 'Create override'}
        </button>
      </div>
    </div>
  )
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="type-micro" style={{ marginBottom: 8 }}>{label}</div>
      {children}
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   Shared inline styles (used instead of className to keep everything
   in one file during this refactor; can be extracted to CSS later)
   ════════════════════════════════════════════════════════════════════════ */

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  fontFamily: 'var(--admin-font-sans)',
  fontSize: 13,
  background: 'var(--admin-bg)',
  color: 'var(--admin-text)',
  border: '1px solid var(--admin-border)',
  borderRadius: 2,
  outline: 'none',
}

const thBase: React.CSSProperties = {
  padding: '10px 16px',
}

const btnPrimary: React.CSSProperties = {
  background: 'var(--admin-text)',
  color: 'var(--admin-bg)',
  border: 'none',
  borderRadius: 2,
  padding: '8px 18px',
  fontFamily: 'var(--admin-font-sans)',
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
  letterSpacing: '0.01em',
}

const btnSecondary: React.CSSProperties = {
  background: 'transparent',
  color: 'var(--admin-text)',
  border: '1px solid var(--admin-border-strong)',
  borderRadius: 2,
  padding: '7px 16px',
  fontFamily: 'var(--admin-font-sans)',
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
}

const btnGhost: React.CSSProperties = {
  background: 'transparent',
  color: 'var(--admin-text-muted)',
  border: 'none',
  padding: '6px 10px',
  fontFamily: 'var(--admin-font-sans)',
  fontSize: 13,
  cursor: 'pointer',
}
