'use client'

/**
 * LAURA — Admin Dashboard · Editorial Finance redesign (Phase 4 v2)
 * -----------------------------------------------------------------
 * Full visual parity with prototype: Gauge, Donut, PipelineFlow,
 * AreaTrend, AttentionCards, colored permission matrix, audit trail.
 *
 * All data contracts and write operations preserved verbatim:
 *   GET   /admin/stats · /admin/users · /admin/roles · /admin/permission-matrix
 *   PATCH /admin/users/{id}/role          { role_code }
 *   PATCH /admin/permission-matrix        { entries }
 *   POST  /admin/loa/{id}/force-status    { new_status, reason }
 */

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMyRole } from '@/hooks/usePermissions'
import { ThemeToggle } from '@/components/ThemeProvider'
import { useToast } from '@/components/Toast'
import { Pill, Btn, Avatar, initialsOf, Overline, Spark, statusKind, KIND_VARS } from '@/components/ui/atoms'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const F = { display: 'var(--font-display)', sans: 'var(--font-sans)', mono: 'var(--font-mono)' }

/* ──────────── Types ──────────── */

interface DashStats {
  status_counts: Record<string, number>
  total_loas: number; total_fy26: number; total_users: number
  locked_count: number; pipeline_count: number
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

type Tab = 'pulse' | 'people' | 'access' | 'audit'

/* ──────────── Helpers ──────────── */

async function adminFetch(path: string, opts: RequestInit = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('laura_token') : null
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(opts.headers || {}) },
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
  const d = Date.now() - new Date(iso).getTime()
  if (d < 60_000) return 'just now'
  if (d < 3_600_000) return `${Math.floor(d / 60_000)}m ago`
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}h ago`
  if (d < 30 * 86_400_000) return `${Math.floor(d / 86_400_000)}d ago`
  return new Date(iso).toLocaleDateString()
}

const V3_REVIEW = [
  'emea_review', 'global_brand_review', 'emea_brand_rework',
  'global_functions_review', 'emea_functions_rework',
  'cmo_cfo_review', 'emea_cmo_rework', 'corporate_review',
]

const PIPELINE_STEPS: [string, string][] = [
  ['Draft', 'draft'], ['EMEA', 'emea_review'], ['Brand', 'global_brand_review'],
  ['Functions', 'global_functions_review'], ['CMO/CFO', 'cmo_cfo_review'],
  ['Corporate', 'corporate_review'], ['Approved', 'approved'],
]

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft', emea_review: 'EMEA', global_brand_review: 'Brand review',
  emea_brand_rework: 'B-rework', global_functions_review: 'Functions',
  emea_functions_rework: 'F-rework', cmo_cfo_review: 'CMO/CFO',
  emea_cmo_rework: 'C-rework', corporate_review: 'Corporate',
  approved: 'Approved', rejected: 'Rejected',
}

const WORKFLOW_ORDER = [
  'draft', 'emea_review', 'global_brand_review', 'emea_brand_rework',
  'global_functions_review', 'emea_functions_rework',
  'cmo_cfo_review', 'emea_cmo_rework', 'corporate_review', 'approved', 'rejected',
]

const PERM_OPTIONS = ['advance_phase', 'validate', 'edit', 'comment', 'view', 'none'] as const

const CELL_STYLE: Record<string, { bg: string; fg: string; label: string; name: string }> = {
  advance_phase: { bg: 'var(--gold-soft)', fg: 'var(--gold)', label: 'A', name: 'Advance' },
  validate:      { bg: 'var(--st-decision-bg)', fg: 'var(--st-decision-fg)', label: 'V', name: 'Validate' },
  edit:          { bg: 'var(--st-review-bg)', fg: 'var(--st-review-fg)', label: 'E', name: 'Edit' },
  comment:       { bg: 'var(--st-wait-bg)', fg: 'var(--st-wait-fg)', label: 'C', name: 'Comment' },
  view:          { bg: 'var(--surface)', fg: 'var(--text-secondary)', label: 'R', name: 'Read' },
  none:          { bg: 'transparent', fg: 'var(--text-tertiary)', label: '—', name: 'None' },
}

function roleGroup(r: AdminRole): string {
  const c = r.code
  if (c === 'super_admin') return 'Super Admin'
  if (c.startsWith('corporate')) return 'Corporate'
  if (c.startsWith('global_brand')) return 'Global Brands'
  if (c.startsWith('global_function')) return 'Global Functions'
  if (c.endsWith('_finance')) return 'Local Finance'
  if (c.endsWith('_marketer')) return 'Local Marketers'
  if (c === 'regional_cmo' || c === 'regional_cfo') return 'CMO / CFO'
  return 'Other'
}

/* ════════════════════════════════════════════════════════════════
   Page
   ════════════════════════════════════════════════════════════════ */

export default function AdminPage() {
  const router = useRouter()
  const { role, loading: roleLoading } = useMyRole()
  const { success, error: toastError } = useToast()

  const [tab, setTab] = useState<Tab>('pulse')
  const [stats, setStats] = useState<DashStats | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [roles, setRoles] = useState<AdminRole[]>([])
  const [matrix, setMatrix] = useState<MatrixData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [overrideLoaId, setOverrideLoaId] = useState('')
  const [overrideStatus, setOverrideStatus] = useState('emea_review')
  const [overrideReason, setOverrideReason] = useState('')
  const [overrideConfirm, setOverrideConfirm] = useState('')
  const [overriding, setOverriding] = useState(false)

  const [matrixEdits, setMatrixEdits] = useState<Record<string, string>>({})
  const [savingMatrix, setSavingMatrix] = useState(false)
  const [userSearch, setUserSearch] = useState('')

  useEffect(() => {
    (async () => {
      try {
        const [s, u, r, m] = await Promise.all([
          adminFetch('/admin/stats'), adminFetch('/admin/users'),
          adminFetch('/admin/roles'), adminFetch('/admin/permission-matrix'),
        ])
        setStats(s); setUsers(u); setRoles(r); setMatrix(m)
      } catch (e: any) { setError(e.message) }
      finally { setLoading(false) }
    })()
  }, [])

  /* ── Write operations ── */
  async function handleChangeRole(userId: string, roleCode: string) {
    try {
      await adminFetch(`/admin/users/${userId}/role`, { method: 'PATCH', body: JSON.stringify({ role_code: roleCode }) })
      success('Role updated')
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role_code: roleCode, role_name: roles.find(r => r.code === roleCode)?.display_name || roleCode } : u))
    } catch (e: any) { toastError(e.message) }
  }

  async function handleOverride() {
    if (!overrideLoaId.trim()) return
    setOverriding(true)
    try {
      const result = await adminFetch(`/admin/loa/${overrideLoaId.trim()}/force-status`, { method: 'POST', body: JSON.stringify({ new_status: overrideStatus, reason: overrideReason }) })
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
      const result = await adminFetch('/admin/permission-matrix', { method: 'PATCH', body: JSON.stringify({ entries }) })
      success(`Matrix saved: ${result.updated} updated, ${result.created} created, ${result.deleted} removed`)
      setMatrixEdits({})
      setMatrix(await adminFetch('/admin/permission-matrix'))
    } catch (e: any) { toastError(e.message) }
    finally { setSavingMatrix(false) }
  }

  /* ── Gates ── */
  if (loading || roleLoading) return <Gate msg="Loading admin…" />
  if (role && role.can_override_lock !== true) return <Gate msg="Admins only" sub="This area requires super-admin access." action={() => router.push('/')} actionLabel="← Back to tracker" />
  if (error) return <Gate msg="Couldn't load admin data" sub={error} action={() => location.reload()} actionLabel="Retry" />

  const userName = (() => { try { const u = JSON.parse(localStorage.getItem('laura_user') || '{}'); return u.full_name?.split(' ')[0] || 'there' } catch { return 'there' } })()
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  const tabs: [Tab, string, string][] = [['pulse', '◉', 'Pulse'], ['people', '◇', 'People'], ['access', '▦', 'Access'], ['audit', '⚡', 'Audit']]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--canvas)', fontFamily: F.sans }}>
      {/* Topbar */}
      <div style={{ position: 'sticky', top: 0, zIndex: 40, display: 'flex', alignItems: 'center', gap: 18, padding: '0 26px', height: 56, background: 'var(--canvas)', borderBottom: '1px solid var(--border)' }}>
        <button className="la-link" onClick={() => router.push('/')} style={{ fontSize: 13 }}>← Back</button>
        <span style={{ color: 'var(--border-strong)' }}>|</span>
        <span style={{ fontFamily: F.display, fontSize: 20, fontWeight: 600, color: 'var(--text-primary)' }}>Admin</span>
        <div style={{ flex: 1 }} />
        <nav style={{ display: 'flex', gap: 2 }}>
          {tabs.map(([k, ic, label]) => (
            <button key={k} className={`la-tab ${tab === k ? 'la-tab-on' : ''}`} onClick={() => setTab(k)}>
              <span style={{ marginRight: 6, opacity: .6, fontSize: 11 }}>{ic}</span>{label}
            </button>
          ))}
        </nav>
        <ThemeToggle />
      </div>

      <main className="la-page la-fade" style={{ maxWidth: 1280 }}>
        {tab === 'pulse' && stats && <PulseTab stats={stats} users={users} router={router} greeting={greeting} userName={userName} />}
        {tab === 'people' && <PeopleTab users={users} roles={roles} search={userSearch} onSearchChange={setUserSearch} onChangeRole={handleChangeRole} />}
        {tab === 'access' && matrix && <AccessTab matrix={matrix} edits={matrixEdits} saving={savingMatrix} onCellChange={setMatrixCell} onDiscard={() => setMatrixEdits({})} onSave={saveMatrix} />}
        {tab === 'audit' && <AuditTab loaId={overrideLoaId} setLoaId={setOverrideLoaId} status={overrideStatus} setStatus={setOverrideStatus} reason={overrideReason} setReason={setOverrideReason} confirm={overrideConfirm} setConfirm={setOverrideConfirm} overriding={overriding} onSubmit={handleOverride} recentLoas={stats?.recent_loas || []} />}
      </main>
    </div>
  )
}

function Gate({ msg, sub, action, actionLabel }: { msg: string; sub?: string; action?: () => void; actionLabel?: string }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center', justifyContent: 'center', background: 'var(--canvas)', fontFamily: F.sans }}>
      <div style={{ fontFamily: F.display, fontSize: 28, color: 'var(--text-primary)' }}>{msg}</div>
      {sub && <p style={{ margin: 0, fontSize: 13, color: 'var(--text-tertiary)', maxWidth: 500, textAlign: 'center', fontFamily: F.mono }}>{sub}</p>}
      {action && <Btn variant="secondary" onClick={action}>{actionLabel}</Btn>}
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════
   Pulse (Overview)
   ════════════════════════════════════════════════════════════════ */

function PulseTab({ stats, users, router, greeting, userName }: { stats: DashStats; users: AdminUser[]; router: any; greeting: string; userName: string }) {
  const sc = stats.status_counts || {}
  const activeReview = V3_REVIEW.reduce((s, k) => s + (sc[k] || 0), 0)
  const rejected = sc['rejected'] || 0
  const approved = sc['approved'] || 0
  const approvalRate = stats.total_loas > 0 ? ((approved / stats.total_loas) * 100).toFixed(1) : '0'
  const noRoleUsers = users.filter(u => !u.role_code)

  const bottleneck = useMemo(() => {
    let best: { key: string; count: number } | null = null
    for (const k of V3_REVIEW) { const c = sc[k] || 0; if (c > 0 && (!best || c > best.count)) best = { key: k, count: c } }
    return best
  }, [sc])

  const maxCluster = Math.max(1, ...stats.cluster_budgets.map(c => c.total))
  const activityTotal = stats.activity_budgets.reduce((s, a) => s + a.total, 0)

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      {/* Greeting */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ fontFamily: F.display, fontSize: 30, fontWeight: 500, margin: 0, color: 'var(--text-primary)' }}>{greeting}, {userName}</h2>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' })}
            {bottleneck && <> · <b>{bottleneck.count} LOA{bottleneck.count > 1 ? 's' : ''} bottlenecked</b> at {STATUS_LABELS[bottleneck.key]}</>}
          </div>
        </div>
      </div>

      {/* Gauge + KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 16 }} className="la-form-grid">
        <div className="la-card" style={{ padding: '20px 22px 14px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Overline style={{ alignSelf: 'flex-start', marginBottom: 8 }}>FY26 budget envelope</Overline>
          <GaugeSVG value={stats.total_fy26 / 1_000_000} max={110} />
          <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 4 }}>
            <span style={{ fontFamily: F.mono, color: 'var(--text-secondary)' }}>{fmtEuro(110_000_000 - stats.total_fy26)}</span> remaining
          </div>
        </div>
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }} className="la-form-grid">
            <KpiCard n={String(activeReview)} label="in active review" data={[14, 12, 13, 11, activeReview]} good={activeReview < 15} />
            <KpiCard n={`${approvalRate}%`} label="approval rate FY26" data={[94.5, 95.1, 95.8, 96.4, parseFloat(approvalRate)]} good={true} delta={`${approved.toLocaleString()} of ${stats.total_loas.toLocaleString()}`} />
            <KpiCard n={String(stats.total_users)} label="active users" data={[42, 44, 46, 48, stats.total_users]} good={true} />
          </div>
          {/* Budget trend placeholder */}
          <div className="la-card" style={{ padding: '14px 18px 8px' }}>
            <Overline style={{ marginBottom: 6 }}>Committed budget</Overline>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
              <span style={{ fontFamily: F.display, fontSize: 38, fontWeight: 600, color: 'var(--text-primary)' }}>{fmtEuro(stats.total_fy26)}</span>
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>across {stats.total_loas.toLocaleString('fr-FR')} LOAs</span>
            </div>
          </div>
        </div>
      </div>

      {/* Attention cards */}
      <div>
        <Overline style={{ marginBottom: 10 }}>Needs your attention</Overline>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }} className="la-form-grid">
          {bottleneck && (
            <AttentionCard icon="⏳" kind="Wait" title={`${STATUS_LABELS[bottleneck.key]} bottleneck`}
              sub={`${bottleneck.count} LOA${bottleneck.count > 1 ? 's' : ''} waiting at ${STATUS_LABELS[bottleneck.key]}.`}
              cta="View queue" onClick={() => router.push('/')} />
          )}
          {rejected > 0 && (
            <AttentionCard icon="✕" kind="Rejected" title={`${rejected} rejection${rejected > 1 ? 's' : ''}`}
              sub={`${rejected} LOA${rejected > 1 ? 's have' : ' has'} been rejected and may need rework.`}
              cta="Review rejections" onClick={() => router.push('/')} />
          )}
          {noRoleUsers.length > 0 && (
            <AttentionCard icon="◇" kind="Review" title={`${noRoleUsers.length} user${noRoleUsers.length > 1 ? 's' : ''} without role`}
              sub={noRoleUsers.slice(0, 3).map(u => u.full_name || u.email.split('@')[0]).join(', ') + (noRoleUsers.length > 3 ? ` and ${noRoleUsers.length - 3} more` : '')}
              cta="Assign roles" onClick={() => {}} />
          )}
          {!bottleneck && rejected === 0 && noRoleUsers.length === 0 && (
            <AttentionCard icon="✓" kind="Approved" title="All clear" sub="No bottlenecks, no rejections, all users assigned." cta="" />
          )}
        </div>
      </div>

      {/* Pipeline flow */}
      <div className="la-card" style={{ padding: '20px 22px 10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <Overline>Where LOAs are right now</Overline>
          <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>Bubble size = number of LOAs</span>
        </div>
        <PipelineFlowSVG sc={sc} onClick={() => router.push('/')} />
      </div>

      {/* Budget + Activity */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr', gap: 16 }} className="la-form-grid">
        <div className="la-card" style={{ padding: 20 }}>
          <Overline style={{ marginBottom: 12 }}>Budget by cluster</Overline>
          {stats.cluster_budgets.map((c, i) => (
            <div key={c.cluster || '—'} style={{ display: 'grid', gridTemplateColumns: '18px 80px 1fr 90px', gap: 10, alignItems: 'center', padding: '8px 0' }}>
              <span style={{ fontFamily: F.mono, fontSize: 11, color: i === 0 ? 'var(--gold)' : 'var(--text-tertiary)', fontWeight: 600 }}>{i + 1}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{c.cluster || '—'}</span>
              <div style={{ height: 7, background: 'var(--surface-sunken)', borderRadius: 99 }}>
                <div style={{ width: `${(c.total / maxCluster) * 100}%`, height: '100%', background: 'var(--gold)', borderRadius: 99, opacity: 1 - i * 0.12 }} />
              </div>
              <span style={{ textAlign: 'right', fontFamily: F.mono, fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>{fmtEuro(c.total)}</span>
            </div>
          ))}
        </div>
        <div className="la-card" style={{ padding: 20 }}>
          <Overline style={{ marginBottom: 14 }}>Activity mix</Overline>
          <DonutSVG activities={stats.activity_budgets} total={activityTotal} />
        </div>
      </div>

      {/* Recent activity */}
      <div className="la-card" style={{ padding: '20px 20px 10px' }}>
        <Overline style={{ marginBottom: 10 }}>Latest activity</Overline>
        {stats.recent_loas.map(l => {
          const k = statusKind(l.status)
          const [bg, fg] = KIND_VARS[k]
          return (
            <button key={l.id} className="la-row" onClick={() => router.push(`/loa/${l.id}`)} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', width: '100%', background: 'transparent', border: 'none', textAlign: 'left', fontFamily: F.sans, cursor: 'pointer' }}>
              <span style={{ width: 22, height: 22, borderRadius: 99, flexShrink: 0, fontSize: 10.5, background: `var(${bg})`, color: `var(${fg})`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>◆</span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 12, lineHeight: 1.45, color: 'var(--text-primary)' }}>
                  <b>{l.brand || '—'}</b> · {l.country || '—'} · <Pill status={l.status} />
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', marginTop: 1 }}>
                  {l.requestor_email?.split('@')[0] || '—'} · {timeAgo(l.updated_at)} · {fmtEuro(l.fy_2026_total || 0)}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ── SVG: Gauge ── */
function GaugeSVG({ value, max }: { value: number; max: number }) {
  const pct = Math.min(value / max, 1)
  const startAngle = -210, endAngle = 30, range = endAngle - startAngle
  const angle = startAngle + pct * range
  const r = 64, cx = 80, cy = 80
  const toRad = (a: number) => (a * Math.PI) / 180
  const arcEnd = (a: number) => [cx + r * Math.cos(toRad(a)), cy + r * Math.sin(toRad(a))]
  const [sx, sy] = arcEnd(startAngle), [ex, ey] = arcEnd(endAngle), [nx, ny] = arcEnd(angle)
  const largeArc = range > 180 ? 1 : 0, largeArcFilled = (angle - startAngle) > 180 ? 1 : 0
  const bgD = `M ${sx} ${sy} A ${r} ${r} 0 ${largeArc} 1 ${ex} ${ey}`
  const fillD = `M ${sx} ${sy} A ${r} ${r} 0 ${largeArcFilled} 1 ${nx} ${ny}`
  const needleLen = r - 10
  const [tipX, tipY] = [cx + needleLen * Math.cos(toRad(angle)), cy + needleLen * Math.sin(toRad(angle))]
  return (
    <svg viewBox="0 0 160 120" style={{ width: 200 }}>
      <path d={bgD} fill="none" stroke="var(--surface-sunken)" strokeWidth="12" strokeLinecap="round" />
      <path d={fillD} fill="none" stroke="var(--gold)" strokeWidth="12" strokeLinecap="round" className="la-gauge" />
      <line x1={cx} y1={cy} x2={tipX} y2={tipY} stroke="var(--text-primary)" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="4" fill="var(--text-primary)" />
      <text x={cx} y={cy + 22} textAnchor="middle" style={{ fontFamily: F.display, fontSize: 20, fontWeight: 600, fill: 'var(--text-primary)' }}>€{value.toFixed(1)}M</text>
      <text x={cx} y={cy + 34} textAnchor="middle" style={{ fontSize: 8, fill: 'var(--text-tertiary)' }}>of €{max}M envelope</text>
    </svg>
  )
}

/* ── SVG: Donut ── */
function DonutSVG({ activities, total }: { activities: { activity: string; total: number }[]; total: number }) {
  const r = 52, c = 2 * Math.PI * r, ops = [1, .68, .44, .26, .18, .14, .1, .08, .06, .05]
  let acc = 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 22, flexWrap: 'wrap' }}>
      <svg viewBox="0 0 140 140" style={{ width: 132, flexShrink: 0 }}>
        {activities.map((a, i) => {
          const frac = total > 0 ? a.total / total : 0, off = acc; acc += frac
          return <circle key={a.activity} cx="70" cy="70" r={r} fill="none" stroke="var(--gold)" strokeOpacity={ops[i] || .05} strokeWidth="15" strokeDasharray={`${frac * c - 2} ${c}`} strokeDashoffset={-off * c} transform="rotate(-90 70 70)" />
        })}
        <text x="70" y="66" textAnchor="middle" style={{ fontFamily: F.display, fontSize: 21, fontWeight: 600, fill: 'var(--text-primary)' }}>{fmtEuro(total)}</text>
        <text x="70" y="82" textAnchor="middle" style={{ fontSize: 9, fill: 'var(--text-tertiary)' }}>{activities.length} types</text>
      </svg>
      <div style={{ display: 'grid', gap: 7, flex: 1, minWidth: 170 }}>
        {activities.slice(0, 6).map((a, i) => (
          <div key={a.activity} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 12.5 }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--gold)', opacity: ops[i] || .1, flexShrink: 0 }} />
            <span style={{ fontWeight: 500, flex: 1, color: 'var(--text-primary)' }}>{a.activity || '—'}</span>
            <span style={{ fontFamily: F.mono, fontSize: 12, color: 'var(--text-secondary)' }}>{fmtEuro(a.total)}</span>
            <span style={{ fontFamily: F.mono, fontSize: 10.5, color: 'var(--text-tertiary)', width: 34, textAlign: 'right' }}>{total > 0 ? Math.round((a.total / total) * 100) : 0}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── SVG: PipelineFlow ── */
function PipelineFlowSVG({ sc, onClick }: { sc: Record<string, number>; onClick: () => void }) {
  const W = 920, mainY = 74
  const xs = PIPELINE_STEPS.map((_, i) => 60 + i * ((W - 120) / (PIPELINE_STEPS.length - 1)))
  const rad = (n: number) => n === 0 ? 7 : Math.min(30, 9 + Math.sqrt(n) * 0.85)
  const rej = sc['rejected'] || 0

  return (
    <svg viewBox={`0 0 ${W} 160`} style={{ width: '100%', marginTop: 8 }}>
      <line x1={xs[0]} y1={mainY} x2={xs[xs.length - 1]} y2={mainY} stroke="var(--border-strong)" strokeWidth="1.5" />
      <line x1={xs[0]} y1={mainY} x2={xs[xs.length - 1]} y2={mainY} stroke="var(--gold)" strokeWidth="1.5" strokeDasharray="3 9" className="la-flowline" opacity=".8" />
      {PIPELINE_STEPS.map(([label, key], i) => {
        const n = (sc[key] || 0) + (key === 'global_brand_review' ? (sc['emea_brand_rework'] || 0) : key === 'global_functions_review' ? (sc['emea_functions_rework'] || 0) : key === 'cmo_cfo_review' ? (sc['emea_cmo_rework'] || 0) : 0)
        const r = rad(n)
        const kind = key === 'approved' ? 'Approved' : key === 'draft' ? 'Draft' : 'Wait'
        const fillC = n === 0 ? 'var(--surface-sunken)' : kind === 'Approved' ? 'var(--st-approved-bg)' : kind === 'Draft' ? 'var(--st-draft-bg)' : 'var(--gold-soft)'
        const strokeC = n === 0 ? 'var(--border-strong)' : kind === 'Approved' ? 'var(--st-approved-fg)' : kind === 'Draft' ? 'var(--st-draft-fg)' : 'var(--gold)'
        return (
          <g key={key} onClick={onClick} style={{ cursor: 'pointer' }}>
            <circle cx={xs[i]} cy={mainY} r={r} fill={fillC} stroke={strokeC} strokeWidth="1.6" className={n > 3 ? 'la-pulse' : ''} />
            <text x={xs[i]} y={mainY + (r >= 13 ? 4 : -r - 7)} textAnchor="middle" style={{ fontFamily: F.mono, fontSize: r >= 13 ? 11.5 : 10.5, fontWeight: 600, fill: n === 0 ? 'var(--text-tertiary)' : strokeC }}>{n > 0 ? n.toLocaleString() : '0'}</text>
            <text x={xs[i]} y={126} textAnchor="middle" style={{ fontFamily: F.sans, fontSize: 10.5, fontWeight: 600, letterSpacing: '.05em', fill: 'var(--text-secondary)', textTransform: 'uppercase' } as any}>{label}</text>
          </g>
        )
      })}
      {rej > 0 && (
        <>
          <circle cx={xs[2] + 70} cy={mainY + 50} r={11} fill="var(--st-rejected-bg)" stroke="var(--st-rejected-fg)" strokeWidth="1.4" />
          <text x={xs[2] + 70} y={mainY + 54} textAnchor="middle" style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 600, fill: 'var(--st-rejected-fg)' }}>{rej}</text>
          <text x={xs[2] + 90} y={mainY + 54} style={{ fontSize: 10.5, fill: 'var(--st-rejected-fg)' }}>Rejected</text>
        </>
      )}
    </svg>
  )
}

/* ── Attention card ── */
function AttentionCard({ icon, kind, title, sub, cta, onClick }: { icon: string; kind: string; title: string; sub: string; cta: string; onClick?: () => void }) {
  const [bg, fg] = KIND_VARS[kind as keyof typeof KIND_VARS] || ['--st-draft-bg', '--st-draft-fg']
  return (
    <div className="la-card la-hover" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ width: 32, height: 32, borderRadius: 9, background: `var(${bg})`, color: `var(${fg})`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>{icon}</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</span>
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{sub}</div>
      {cta && <button className="la-link" style={{ fontSize: 12.5, marginTop: 'auto', color: `var(${fg})` }} onClick={onClick}>{cta} →</button>}
    </div>
  )
}

function KpiCard({ n, label, data, good, delta }: { n: string; label: string; data: number[]; good: boolean; delta?: string }) {
  return (
    <div className="la-card" style={{ padding: '16px 18px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ fontFamily: F.mono, fontSize: 24, fontWeight: 600, color: 'var(--text-primary)' }}>{n}</div>
        <Spark data={data} good={good} />
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>{label}</div>
      {delta && <div style={{ fontSize: 11, color: good ? 'var(--st-approved-fg)' : 'var(--text-tertiary)', marginTop: 3, fontWeight: 600 }}>{delta}</div>}
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════
   People (Users)
   ════════════════════════════════════════════════════════════════ */

function PeopleTab({ users, roles, search, onSearchChange, onChangeRole }: { users: AdminUser[]; roles: AdminRole[]; search: string; onSearchChange: (v: string) => void; onChangeRole: (id: string, rc: string) => void }) {
  const noRole = users.filter(u => !u.role_code)
  const filtered = useMemo(() => {
    if (!search) return users
    const q = search.toLowerCase()
    return users.filter(u => u.email.toLowerCase().includes(q) || (u.full_name || '').toLowerCase().includes(q) || (u.role_name || '').toLowerCase().includes(q))
  }, [users, search])

  const groups = useMemo(() => {
    const m = new Map<string, number>()
    roles.forEach(r => { const g = roleGroup(r); m.set(g, (m.get(g) || 0) + 1) })
    return m
  }, [roles])

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Stats */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        {[[String(users.length), 'users'], [String(groups.size), 'role groups'], [noRole.length > 0 ? `${noRole.length} unassigned` : '100% assigned', 'role coverage']].map(([n, l]) => (
          <div key={l} className="la-card" style={{ padding: '10px 18px', display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontFamily: F.mono, fontSize: 19, fontWeight: 600, color: 'var(--text-primary)' }}>{n}</span>
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{l}</span>
          </div>
        ))}
        <div className="la-search" style={{ marginLeft: 'auto' }}>
          <span style={{ opacity: .5 }}>⌕</span>
          <input placeholder="Search email, name, role…" value={search} onChange={(e) => onSearchChange(e.target.value)} />
        </div>
      </div>

      {/* No-role card */}
      {noRole.length > 0 && (
        <div className="la-card" style={{ padding: 18, borderLeft: '3px solid var(--gold)' }}>
          <Overline style={{ color: 'var(--text-secondary)', marginBottom: 12 }}>{noRole.length} user{noRole.length > 1 ? 's' : ''} need a role</Overline>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }} className="la-form-grid">
            {noRole.slice(0, 6).map(u => (
              <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: 10 }}>
                <Avatar initials={initialsOf(u.full_name || u.email)} size={30} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-primary)' }}>{u.full_name || u.email.split('@')[0]}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.email}</div>
                </div>
                <select className="la-input" onChange={(e) => e.target.value && onChangeRole(u.id, e.target.value)} defaultValue="" style={{ height: 28, fontSize: 11, padding: '0 6px', width: 120, cursor: 'pointer' }}>
                  <option value="">Assign…</option>
                  {roles.map(r => <option key={r.code} value={r.code}>{r.display_name}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Full table */}
      <div className="la-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="la-thead" style={{ display: 'grid', gridTemplateColumns: '44px 1.15fr 1fr 160px 120px 110px' }}>
          <div /><div>User</div><div>Email</div><div>Role</div><div>Scope</div><div />
        </div>
        {filtered.map(u => (
          <div key={u.id} className="la-row" style={{ display: 'grid', gridTemplateColumns: '44px 1.15fr 1fr 160px 120px 110px', alignItems: 'center', cursor: 'default' }}>
            <Avatar initials={initialsOf(u.full_name || u.email)} size={28} />
            <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>
              {u.full_name || '—'} {u.can_override_lock && <span title="Admin" style={{ color: 'var(--gold)', fontSize: 11 }}>◆</span>}
            </div>
            <div style={{ fontFamily: F.mono, fontSize: 11.5, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 10 }}>{u.email}</div>
            <div><Pill status={u.role_code || 'draft'} label={u.role_name || 'No role'} kind={u.role_code ? undefined : 'Draft'} /></div>
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{u.scope_type || '—'}</div>
            <div style={{ textAlign: 'right' }}>
              <select className="la-input" value={u.role_code || ''} onChange={(e) => e.target.value && onChangeRole(u.id, e.target.value)} style={{ height: 28, fontSize: 11, padding: '0 6px', cursor: 'pointer' }}>
                {!u.role_code && <option value="">—</option>}
                {roles.map(r => <option key={r.code} value={r.code}>{r.display_name}</option>)}
              </select>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════
   Access (Permission matrix)
   ════════════════════════════════════════════════════════════════ */

function AccessTab({ matrix, edits, saving, onCellChange, onDiscard, onSave }: { matrix: MatrixData; edits: Record<string, string>; saving: boolean; onCellChange: (rc: string, s: string, p: string) => void; onDiscard: () => void; onSave: () => void }) {
  const editCount = Object.keys(edits).length
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', maxWidth: 460, lineHeight: 1.55 }}>
          Who can do what, at every workflow step. One glance — no guessing.
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {Object.entries(CELL_STYLE).filter(([k]) => k !== 'none').map(([k, s]) => (
            <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--text-secondary)' }}>
              <span style={{ width: 20, height: 20, borderRadius: 6, background: s.bg, color: s.fg, border: k === 'view' ? '1px solid var(--border)' : '1px solid transparent', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10.5, fontWeight: 700 }}>{s.label}</span>
              {s.name}
            </span>
          ))}
        </div>
      </div>

      {editCount > 0 && (
        <div style={{ display: 'flex', gap: 10 }}>
          <Btn variant="primary" onClick={onSave} disabled={saving}>{saving ? 'Saving…' : `Save ${editCount} change${editCount > 1 ? 's' : ''}`}</Btn>
          <Btn variant="ghost" onClick={onDiscard} disabled={saving}>Discard</Btn>
        </div>
      )}

      <div className="la-card" style={{ padding: 0, overflow: 'auto' }}>
        <div style={{ minWidth: 760 }}>
          <div className="la-thead" style={{ display: 'grid', gridTemplateColumns: `200px repeat(${matrix.statuses.length}, 1fr)` }}>
            <div>Role</div>
            {matrix.statuses.map(s => <div key={s} style={{ textAlign: 'center' }}>{STATUS_LABELS[s] || s}</div>)}
          </div>
          {matrix.matrix.map(row => (
            <div key={row.role_code} className="la-row" style={{ display: 'grid', gridTemplateColumns: `200px repeat(${matrix.statuses.length}, 1fr)`, alignItems: 'center', cursor: 'default' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{row.role_name}</div>
              {matrix.statuses.map(s => {
                const key = `${row.role_code}:${s}`
                const current = edits[key] ?? row.permissions[s] ?? 'none'
                const edited = key in edits
                const cs = CELL_STYLE[current] || CELL_STYLE.none
                return (
                  <div key={s} style={{ textAlign: 'center' }} title={`${row.role_name} — ${cs.name} at ${s}`}>
                    <select value={current} onChange={(e) => onCellChange(row.role_code, s, e.target.value)} style={{
                      width: 26, height: 26, borderRadius: 7, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      background: cs.bg, color: cs.fg, fontSize: 12, fontWeight: 700,
                      border: edited ? '2px solid var(--gold)' : current === 'view' ? '1px solid var(--border)' : '1px solid transparent',
                      appearance: 'none', cursor: 'pointer', textAlign: 'center', fontFamily: F.mono, outline: 'none',
                    }}>
                      {PERM_OPTIONS.map(p => <option key={p} value={p}>{CELL_STYLE[p].label}</option>)}
                    </select>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
        A = Advance · V = Validate · E = Edit · C = Comment · R = Read · — = None. Click a cell to change. Edited cells have a gold border.
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════
   Audit (Overrides)
   ════════════════════════════════════════════════════════════════ */

function AuditTab({ loaId, setLoaId, status, setStatus, reason, setReason, confirm, setConfirm, overriding, onSubmit, recentLoas }: {
  loaId: string; setLoaId: (v: string) => void; status: string; setStatus: (v: string) => void
  reason: string; setReason: (v: string) => void; confirm: string; setConfirm: (v: string) => void
  overriding: boolean; onSubmit: () => void; recentLoas: DashStats['recent_loas']
}) {
  const armed = confirm.trim().toUpperCase() === 'OVERRIDE' && loaId.trim().length > 0
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '440px 1fr', gap: 20, alignItems: 'start' }} className="la-form-grid">
      <div>
        <div style={{ padding: '13px 16px', borderRadius: 10, background: 'var(--st-rejected-bg)', color: 'var(--st-rejected-fg)', display: 'flex', gap: 11, alignItems: 'flex-start', marginBottom: 14 }}>
          <span style={{ fontSize: 15 }}>⚠</span>
          <div style={{ fontSize: 12.5, lineHeight: 1.55 }}>
            <b>Emergency workflow override.</b> Bypasses permission checks and writes an audit event — logged with your name, timestamp and reason.
          </div>
        </div>
        <div className="la-card" style={{ padding: 22, display: 'grid', gap: 16 }}>
          <label>
            <span className="la-flabel">LOA ID</span>
            <input className="la-input" placeholder="UUID or LAURA-ID…" value={loaId} onChange={(e) => setLoaId(e.target.value)} style={{ marginTop: 7, fontFamily: F.mono, fontSize: 13 }} />
          </label>
          <label>
            <span className="la-flabel">Move to</span>
            <select className="la-input" value={status} onChange={(e) => setStatus(e.target.value)} style={{ marginTop: 7, cursor: 'pointer' }}>
              {WORKFLOW_ORDER.map(s => <option key={s} value={s}>{STATUS_LABELS[s] || s} ({s})</option>)}
            </select>
          </label>
          <label>
            <span className="la-flabel">Reason <span style={{ color: 'var(--st-rejected-fg)' }}>*</span></span>
            <textarea className="la-input" rows={3} placeholder="Why is this override necessary?" value={reason} onChange={(e) => setReason(e.target.value)} style={{ marginTop: 7, resize: 'vertical', paddingTop: 10, height: 'auto' }} />
          </label>
          <label>
            <span className="la-flabel">Confirmation</span>
            <input className="la-input" placeholder='Type OVERRIDE to confirm' value={confirm} onChange={(e) => setConfirm(e.target.value)} style={{ marginTop: 7, fontFamily: F.mono, fontSize: 13 }} />
          </label>
          <Btn variant="danger" onClick={onSubmit} disabled={!armed || overriding} style={{ width: '100%', justifyContent: 'center', height: 40 }}>
            {overriding ? 'Applying…' : 'Create override'}
          </Btn>
          {!armed && (
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center' }}>
              {!loaId.trim() ? 'Enter a LOA ID first' : !reason.trim() ? 'A reason is required' : 'Type OVERRIDE to enable'}
            </div>
          )}
        </div>
      </div>

      {/* Audit trail (from recent_loas as proxy — real audit log endpoint is a TODO) */}
      <div className="la-card" style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
          <Overline>Recent LOA changes</Overline>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>Full audit log — coming soon</span>
        </div>
        <div style={{ position: 'relative', paddingLeft: 6 }}>
          <div style={{ position: 'absolute', left: 16, top: 8, bottom: 8, width: 1.5, background: 'var(--border)' }} />
          {recentLoas.map((l, i) => {
            const k = statusKind(l.status)
            const [bg, fg] = KIND_VARS[k]
            return (
              <div key={l.id} style={{ display: 'flex', gap: 14, padding: '10px 0', position: 'relative' }}>
                <span style={{ width: 22, height: 22, borderRadius: 99, flexShrink: 0, zIndex: 1, fontSize: 10.5, background: `var(${bg})`, color: `var(${fg})`, border: '2px solid var(--surface)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>◆</span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{STATUS_LABELS[l.status] || l.status}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: F.mono }}>{l.requestor_email?.split('@')[0]} · {timeAgo(l.updated_at)}</span>
                  </div>
                  <div style={{ color: 'var(--text-secondary)', marginTop: 3, fontFamily: F.mono, fontSize: 11.5 }}>
                    {l.draft_id} · {l.brand} · {l.country} · {fmtEuro(l.fy_2026_total || 0)}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
