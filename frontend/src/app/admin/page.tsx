'use client'
/**
 * Admin Console — built from `docs/LAURA Admin Console.html`.
 *
 * Structure, groups, screen titles and body copy come from that document.
 * Eleven screens are listed; five are wired to real data, six state the schema
 * they are waiting on (see `_nav.ts`).
 *
 * Absorbs the previous four-tab admin page entirely:
 *   Pulse  → Admin home
 *   People → Users & people
 *   Access → Roles & permissions
 *   Audit  → Cycles (the force-status override moves here as an admin action;
 *            the real Audit log needs an `audit_log` table that does not exist)
 *
 * Not one hard-coded colour: every value is a semantic token, so both themes
 * work from the first render rather than being retrofitted.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import './console-tokens.css'
import { SCREENS, GROUPS, byId, isPending, type ScreenId } from './_nav'
import {
  getAdminStats, getAdminUsers, getAdminRoles,
  updateUserRole, createUser, deactivateUser, reactivateUser,
  type AdminUser, type AdminRole, type CreateUserPayload,
} from '@/lib/admin-api'
import api from '@/lib/api'
import {
  fetchCycles, createCycle, updateCycle, setCycleStatus, closeCycle, deleteCycle,
  type Cycle, type CycleStatus, type CycleType,
  type CreateCyclePayload, type UpdateCyclePayload,
} from '@/lib/cycles-api'
import { fetchImportBatches, type ImportBatch } from '@/lib/historical-api'
import { formatBudget } from '@/lib/euro'
import { newestFirst } from '@/lib/sort'
import { useMyRole } from '@/hooks/usePermissions'
import { useToast } from '@/components/Toast'
import { buildChain } from '@/lib/workflow'
import { statusBadge } from '@/styles/tokens'

// ── Screens without a data layer ────────────────────────────────────────────

function PendingScreen({ id }: { id: ScreenId }) {
  const s = byId(id)
  return (
    <div className="ac-pending">
      <span className="ac-pending-tag">Pending database audit</span>
      <span className="ac-pending-title">{s.title} is designed but not yet buildable</span>
      <p className="ac-pending-body">
        This screen needs tables the database does not have. Rather than render it
        against placeholder data — which would look finished and create an
        expectation the data layer cannot meet — it states what is missing:
      </p>
      <ul className="ac-pending-list">
        {s.pending!.map(p => <li key={p}>{p}</li>)}
      </ul>
      <p className="ac-pending-body">
        Reported, not created. Unplanned schema from a UI build is what the queued
        database audit exists to prevent.
      </p>
    </div>
  )
}

// ── 01 Admin home ───────────────────────────────────────────────────────────

const BUDGET_ALERT_THRESHOLD = 50_000

interface HighValueLOA {
  id: string
  cycle_id: string | null
  draft_id?: string
  cluster?: string
  country?: string
  brand?: string
  fy_2026_total: number
  status: string
}

interface Stats {
  status_counts?: Record<string, number>
  total_loas?: number
  total_fy26?: number
  total_users?: number
  locked_count?: number
  pipeline_count?: number
  source_counts?: Record<string, number>
  high_value_loas?: HighValueLOA[]
}

function AdminHome({
  stats, users, cycles, batches, onGoto,
}: {
  stats: Stats | null
  users: AdminUser[]
  cycles: Cycle[]
  batches: ImportBatch[]
  onGoto: (id: ScreenId) => void
}) {
  const open = cycles.find(c => c.isActive) ?? null
  const noRole = users.filter(u => !u.role_code)
  const counts = stats?.status_counts ?? {}

  // Review progress by gate, from the live status counts. Derived from the same
  // chain as everything else — this used to be a hand-written five, which hid
  // the two EMEA re-reviews and undercounted every LOA sitting in one.
  const GATES: [string, string][] = buildChain('')
    .filter(s => !s.terminal)
    .map(s => [s.key, s.label])
  const inCycle = GATES.reduce((n, [k]) => n + (counts[k] ?? 0), 0)

  const attention = [
    noRole.length > 0 && {
      icon: '◔',
      title: `${noRole.length} user${noRole.length === 1 ? '' : 's'} without a role`,
      sub: noRole.slice(0, 3).map(u => u.email).join(', ') || '—',
      cta: 'Assign', go: 'users' as ScreenId,
    },
    (counts.corporate_review ?? 0) > 0 && {
      icon: '◷',
      title: `${counts.corporate_review} awaiting Corporate Review`,
      sub: 'The final gate before approved',
      cta: 'View', go: 'cycles' as ScreenId,
    },
    (stats?.locked_count ?? 0) > 0 && {
      icon: '⚿',
      title: `${stats!.locked_count} locked LOA${stats!.locked_count === 1 ? '' : 's'}`,
      sub: 'Locked records cannot be edited by their author',
      cta: 'Cycles', go: 'cycles' as ScreenId,
    },
    !open && {
      icon: '⚑', title: 'No normal cycle is open',
      sub: 'Marketers cannot submit until one is opened',
      cta: 'Open one', go: 'cycles' as ScreenId,
    },
  ].filter(Boolean) as { icon: string; title: string; sub: string; cta: string; go: ScreenId }[]

  return (
    <div className="ac-stack">
      <div className="ac-card ac-card-strong ac-stack">
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {open ? <span className="ac-pill"><span className="ac-dot" />Open</span>
                    : <span className="ac-card-note">No open cycle</span>}
              <span className="ac-mono ac-card-note">{open?.code || open?.name || '—'}</span>
            </div>
            <p style={{ margin: '9px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
              {open
                ? `${open.name}${open.daysRemaining != null ? ` — ${open.daysRemaining} day${open.daysRemaining === 1 ? '' : 's'} remaining` : ''}`
                : 'Open a cycle so marketers can submit.'}
            </p>
            <div className="ac-statgrid" style={{ marginTop: 16 }}>
              {[
                [String(inCycle), 'LOAs in review'],
                [formatBudget(stats?.total_fy26 ?? 0), 'FY26 requested'],
                [String(counts.approved ?? 0), 'Approved'],
                [String(counts.rejected ?? 0), 'Rejected'],
              ].map(([v, l]) => (
                <div className="ac-stat" key={l}>
                  <span className="ac-stat-v">{v}</span>
                  <span className="ac-stat-l">{l}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <button className="ac-btn" onClick={() => onGoto('cycles')}>Cycle settings</button>
          </div>
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
            <span className="ac-card-title">Review progress by gate</span>
            <span className="ac-card-note">{inCycle} LOAs across the chain</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 18 }}>
            {GATES.map(([key, label]) => {
              const n = counts[key] ?? 0
              const pct = inCycle > 0 ? Math.round((n / inCycle) * 100) : 0
              return (
                <div className="ac-gate" key={key}>
                  <div className="ac-gate-top">
                    <span className="ac-gate-role">{label}</span>
                    <span className="ac-gate-n">{n}</span>
                  </div>
                  <div className="ac-bar"><div className="ac-bar-fill" style={{ width: `${pct}%` }} /></div>
                  <span className="ac-gate-note">{n === 0 ? 'nothing waiting' : `${pct}% of the chain`}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="ac-cols">
        <div className="ac-card">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
            <span className="ac-card-title">Needs an admin</span>
            <span className="ac-mono ac-card-note">{attention.length}</span>
          </div>
          {attention.length === 0 ? (
            <p className="ac-card-note" style={{ marginTop: 10 }}>Nothing else is blocked right now.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', marginTop: 8 }}>
              {attention.map(a => (
                <button
                  key={a.title}
                  onClick={() => onGoto(a.go)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
                    padding: '11px 4px', background: 'transparent', cursor: 'pointer',
                    border: 'none', borderTop: '1px solid var(--border)', fontFamily: 'var(--font-sans)',
                  }}
                >
                  <span style={{ fontSize: 14, color: 'var(--accent-dim)' }} aria-hidden="true">{a.icon}</span>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>{a.title}</span>
                    <span style={{ display: 'block', fontSize: 11, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.sub}</span>
                  </span>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--accent-dim)', whiteSpace: 'nowrap' }}>{a.cta} →</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="ac-stack">
          <div className="ac-card">
            <span className="ac-card-title">Platform at a glance</span>
            <div className="ac-statgrid" style={{ marginTop: 14 }}>
              {[
                [String(stats?.total_loas ?? 0), 'LOAs', 'all sources'],
                [String(stats?.total_users ?? 0), 'users', `${new Set(users.map(u => u.role_code)).size} roles in use`],
                [String(cycles.length), 'cycles', `${cycles.filter(c => c.isActive).length} open`],
                [String(batches.length), 'import batches', 'all reversible'],
              ].map(([v, l, note]) => (
                <div className="ac-stat" key={l}>
                  <span className="ac-stat-v">{v}</span>
                  <span className="ac-stat-l">{l}</span>
                  <span className="ac-stat-note">{note}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="ac-card">
            {(() => {
              const sc = stats?.source_counts ?? {}
              const total = Object.values(sc).reduce((a, b) => a + b, 0)
              const SOURCES: [string, string, string][] = [
                ['laura_created', 'Live', 'var(--accent)'],
                ['historical_import', 'Historical', 'var(--accent-dim)'],
                ['demo_seed', 'Demo', 'var(--border)'],
              ]
              return (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
                    <span className="ac-card-title">LOAs by source</span>
                    <span className="ac-mono ac-card-note" style={{ marginLeft: 'auto' }}>{total} rows total</span>
                  </div>
                  <div style={{ height: 9, borderRadius: 99, overflow: 'hidden', display: 'flex', background: 'var(--surface-sunken)' }}>
                    {SOURCES.map(([key, , color]) => {
                      const pct = total > 0 ? (sc[key] ?? 0) / total * 100 : 0
                      return pct > 0 ? <div key={key} style={{ width: `${pct}%`, background: color }} /> : null
                    })}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 12 }}>
                    {SOURCES.map(([key, label, color]) => (
                      <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                        <span style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
                        <span style={{ fontSize: 11.5, fontWeight: 500, flex: 1, color: 'var(--text-secondary)' }}>{label}</span>
                        <span className="ac-mono ac-card-note">{sc[key] ?? 0}</span>
                      </div>
                    ))}
                  </div>
                </>
              )
            })()}
          </div>
        </div>
      </div>

      {(stats?.high_value_loas?.length ?? 0) > 0 && (
        <div className="ac-card">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
            <span className="ac-card-title">High-value LOAs</span>
            <span className="ac-card-note">over {formatBudget(BUDGET_ALERT_THRESHOLD)} — highest first</span>
            <span className="ac-mono ac-card-note" style={{ marginLeft: 'auto' }}>{stats!.high_value_loas!.length}</span>
          </div>
          <div className="ac-tablewrap">
            <table className="ac-table">
              <thead>
                <tr>{['Brand', 'Cluster', 'Country', 'Status', 'FY26 Total'].map(h => <th key={h}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {stats!.high_value_loas!.map(loa => (
                  <tr key={loa.id}
                    style={{ cursor: loa.cycle_id ? 'pointer' : 'default' }}
                    onClick={() => loa.cycle_id && (window.location.href = `/cycles/${loa.cycle_id}/both?loa=${loa.id}`)}
                  >
                    <td style={{ fontWeight: 600 }}>{loa.brand || '—'}</td>
                    <td>{loa.cluster || '—'}</td>
                    <td>{loa.country || '—'}</td>
                    <td><span className="ac-badge">{loa.status}</span></td>
                    <td className="ac-mono" style={{ fontWeight: 600, color: 'var(--accent-dim)' }}>{formatBudget(loa.fy_2026_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ── 02 Users & people ───────────────────────────────────────────────────────

const BLANK_FORM: CreateUserPayload = { email: '', full_name: '', password: '', role_code: '', is_active: true }

function UsersScreen({
  users, roles, onChangeRole, onAddUser, onDeactivate, onReactivate,
}: {
  users: AdminUser[]
  roles: AdminRole[]
  onChangeRole:  (userId: string, roleCode: string) => void
  onAddUser:     (payload: CreateUserPayload) => Promise<void>
  onDeactivate:  (userId: string) => Promise<void>
  onReactivate:  (userId: string) => Promise<void>
}) {
  const [q, setQ]               = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [modalOpen, setModalOpen]   = useState(false)
  const [form, setForm]             = useState<CreateUserPayload>(BLANK_FORM)
  const [formErr, setFormErr]       = useState<string | null>(null)
  const [saving, setSaving]         = useState(false)

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase()
    return users.filter(u => {
      if (roleFilter && u.role_code !== roleFilter) return false
      if (!t) return true
      return [u.full_name, u.email, u.role_display_name, u.role_code]
        .filter(Boolean).some(v => String(v).toLowerCase().includes(t))
    })
  }, [users, q, roleFilter])

  const openModal = () => { setForm(BLANK_FORM); setFormErr(null); setModalOpen(true) }
  const closeModal = () => { if (!saving) setModalOpen(false) }

  const handleAdd = async () => {
    if (!form.email.trim() || !form.full_name.trim() || !form.password.trim() || !form.role_code) {
      setFormErr('Name, email, password, and role are all required.')
      return
    }
    setSaving(true); setFormErr(null)
    try {
      await onAddUser(form)
      setModalOpen(false)
    } catch (e: any) {
      setFormErr(e?.response?.data?.detail || e?.message || 'Could not create user.')
    } finally { setSaving(false) }
  }

  const scopeLabel = (u: AdminUser) => {
    if (u.role_scope_type === 'all') return 'All LOAs'
    if (u.role_scope_type === 'author_only') return 'Own LOAs'
    if (u.role_scope_value?.length) return u.role_scope_value.join(', ')
    return u.role_scope_type || '—'
  }

  return (
    <>
      <div className="ac-filterbar">
        <label className="ac-search">
          <span aria-hidden="true">⌕</span>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name, email or role" aria-label="Search users" />
        </label>
        <select className="ac-select" value={roleFilter} onChange={e => setRoleFilter(e.target.value)} aria-label="Filter by role">
          <option value="">Role: all</option>
          {roles.map(r => <option key={r.code} value={r.code}>{r.display_name}</option>)}
        </select>
        <span className="ac-card-note" style={{ marginRight: 'auto' }}>Showing {shown.length} of {users.length}</span>
        <button className="ac-btn-primary" onClick={openModal}>+ Add user</button>
      </div>

      {shown.length === 0 ? (
        <div className="ac-empty">No user matches that search.</div>
      ) : (
        <div className="ac-tablewrap">
          <table className="ac-table">
            <thead>
              <tr>
                {['Name / email', 'Role & scope', 'Status', 'Last active', 'Change role', 'Actions'].map(h => <th key={h}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {shown.map(u => (
                <tr key={u.id}>
                  <td>
                    <span style={{ display: 'block', fontWeight: 600 }}>{u.full_name || '—'}</span>
                    <span className="ac-sub2">{u.email}</span>
                  </td>
                  <td>
                    <span style={{ display: 'block' }}>{u.role_display_name || <em>no role</em>}</span>
                    <span className="ac-sub2">{scopeLabel(u)}</span>
                  </td>
                  <td>
                    <span className="ac-badge" style={{ background: u.is_active ? undefined : 'var(--st-rejected-bg)', color: u.is_active ? undefined : 'var(--st-rejected-fg)' }}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="ac-mono ac-sub2">
                    {u.last_login ? new Date(u.last_login).toLocaleDateString('en-GB') : 'never'}
                  </td>
                  <td>
                    <select
                      className="ac-select"
                      value={u.role_code ?? ''}
                      onChange={e => onChangeRole(u.id, e.target.value)}
                      aria-label={`Role for ${u.email}`}
                    >
                      <option value="" disabled>Select…</option>
                      {roles.map(r => <option key={r.code} value={r.code}>{r.display_name}</option>)}
                    </select>
                  </td>
                  <td>
                    {u.is_active
                      ? <button className="ac-btn" style={{ fontSize: 11.5 }} onClick={() => onDeactivate(u.id)}>Deactivate</button>
                      : <button className="ac-btn" style={{ fontSize: 11.5 }} onClick={() => onReactivate(u.id)}>Reactivate</button>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="ac-card-note" style={{ marginTop: 10 }}>
        Deactivating revokes login immediately but preserves all historical actions (comments, approvals, verdicts).
      </p>

      {/* Add user modal */}
      {modalOpen && (
        <div
          onClick={closeModal}
          style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--surface)', borderRadius: 14, padding: '28px 32px',
            maxWidth: 480, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,.25)',
          }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, color: 'var(--text-primary)' }}>Add new user</div>

            {[
              { label: 'Full name', key: 'full_name', type: 'text', placeholder: 'Jane Smith' },
              { label: 'Email', key: 'email', type: 'email', placeholder: 'jane@example.com' },
              { label: 'Temporary password', key: 'password', type: 'password', placeholder: '••••••••' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 5, color: 'var(--text-secondary)' }}>{f.label}</label>
                <input
                  type={f.type}
                  value={(form as any)[f.key]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  style={{
                    width: '100%', boxSizing: 'border-box', padding: '9px 12px',
                    borderRadius: 8, border: '1.5px solid var(--border-strong)',
                    background: 'var(--surface-raised)', color: 'var(--text-primary)',
                    fontSize: 13, outline: 'none',
                  }}
                />
              </div>
            ))}

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 5, color: 'var(--text-secondary)' }}>Role</label>
              <select
                className="ac-select"
                value={form.role_code}
                onChange={e => setForm(p => ({ ...p, role_code: e.target.value }))}
                style={{ width: '100%' }}
              >
                <option value="" disabled>Select a role…</option>
                {roles.map(r => (
                  <option key={r.code} value={r.code}>
                    {r.display_name}
                    {r.scope_value?.length ? ` · ${r.scope_value.join(', ')}` : r.scope_type !== 'all' ? ` · ${r.scope_type}` : ''}
                  </option>
                ))}
              </select>
              <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 5 }}>
                Scope is determined by the role. Each role is pre-configured for a specific cluster, brand, or function.
              </p>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 20, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={form.is_active ?? true}
                onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))}
              />
              Active immediately
            </label>

            {formErr && (
              <div style={{ padding: '8px 12px', background: 'var(--st-rejected-bg)', color: 'var(--st-rejected-fg)', borderRadius: 8, fontSize: 12, marginBottom: 14 }}>
                {formErr}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="ac-btn" onClick={closeModal} disabled={saving}>Cancel</button>
              <button className="ac-btn-primary" onClick={handleAdd} disabled={saving}>
                {saving ? 'Creating…' : 'Create user'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ── 03 Roles & permissions ──────────────────────────────────────────────────

/**
 * Exactly what GET /admin/permission-matrix returns.
 *
 * One permission per (role, status) — not a set — so a cell is a single choice,
 * and PATCH takes `'none'` to revoke. Guessing a richer shape here is what broke
 * the whole console page: `matrix.roles.map` on an undefined field threw during
 * render, so every screen went blank, not just this one.
 */
interface MatrixResponse {
  statuses: string[]
  matrix: { role_code: string; role_name: string; permissions: Record<string, string> }[]
}

interface PermissionDef { code: string; display_name: string; description?: string | null }

/** Revoking is a value, not a delete, in the PATCH contract. */
const NONE = 'none'

function RolesScreen({
  matrix, permissions, edits, onCell, onSave, onDiscard, saving,
}: {
  matrix: MatrixResponse | null
  permissions: PermissionDef[]
  /** key = `${role_code}|${status}`, value = permission code or NONE. */
  edits: Record<string, string>
  onCell: (key: string, next: string) => void
  onSave: () => void
  onDiscard: () => void
  saving: boolean
}) {
  const [q, setQ] = useState('')
  if (!matrix) return <p className="ac-msg">Loading the permission matrix…</p>

  const dirty = Object.keys(edits).length
  const t = q.trim().toLowerCase()
  const rows = t
    ? matrix.matrix.filter(r => r.role_code.toLowerCase().includes(t) || r.role_name.toLowerCase().includes(t))
    : matrix.matrix

  return (
    <>
      <div className="ac-filterbar">
        <label className="ac-search">
          <span aria-hidden="true">⌕</span>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search role" aria-label="Search roles" />
        </label>
        <span className="ac-card-note">{rows.length} of {matrix.matrix.length} roles</span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 9 }}>
          <button className="ac-btn" onClick={onDiscard} disabled={!dirty || saving}>
            Discard{dirty ? ` (${dirty})` : ''}
          </button>
          <button className="ac-btn-primary" onClick={onSave} disabled={!dirty || saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="ac-empty">No role matches that search.</div>
      ) : (
        <div className="ac-tablewrap">
          <table className="ac-table ac-matrix">
            <thead>
              <tr>
                <th className="ac-matrix-role">Role</th>
                {matrix.statuses.map(st => <th key={st} title={st}>{st.replace(/_/g, ' ')}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.role_code}>
                  <td className="ac-matrix-role">
                    <span style={{ display: 'block', fontWeight: 600 }}>{r.role_name}</span>
                    <span className="ac-sub2 ac-mono">{r.role_code}</span>
                  </td>
                  {matrix.statuses.map(st => {
                    const key = `${r.role_code}|${st}`
                    const base = r.permissions[st] ?? NONE
                    const val = key in edits ? edits[key] : base
                    const changed = key in edits && edits[key] !== base
                    return (
                      <td key={st}>
                        <select
                          className="ac-select"
                          value={val}
                          onChange={e => onCell(key, e.target.value)}
                          aria-label={`${r.role_name} on ${st}`}
                          style={changed ? { borderColor: 'var(--accent)', fontWeight: 600 } : undefined}
                        >
                          <option value={NONE}>—</option>
                          {permissions.map(p => (
                            <option key={p.code} value={p.code}>{p.display_name}</option>
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
    </>
  )
}

// ── 06 Cycles ───────────────────────────────────────────────────────────────

const CYCLE_STATUS_LABEL: Record<CycleStatus, string> = {
  draft: 'Draft', open: 'Open', under_review: 'In Review', closed: 'Closed',
}

/** Badge colours read straight off the status tokens, so both themes work. */
const CYCLE_STATUS_STYLE: Record<CycleStatus, React.CSSProperties> = {
  draft:        { background: 'transparent', color: 'var(--text-tertiary)', border: '1px solid var(--border-strong)' },
  open:         { background: 'var(--st-approved-bg)', color: 'var(--st-approved-fg)', border: '1px solid var(--st-approved-fg)' },
  under_review: { background: 'var(--st-rework-bg)', color: 'var(--st-rework-fg)', border: '1px solid var(--st-rework-fg)' },
  closed:       { background: 'var(--surface-sunken)', color: 'var(--text-tertiary)', border: '1px solid var(--border)' },
}

/**
 * The one forward transition offered from each state, with the sentence the
 * admin has to agree to. Each step is one-way — that is the point of confirming.
 */
const CYCLE_NEXT: Partial<Record<CycleStatus, { to: CycleStatus; label: string; confirm: (c: Cycle) => string }>> = {
  draft: {
    to: 'open', label: 'Open',
    confirm: c => `Open "${c.name}"? Marketers will be able to submit LOAs into it immediately.`,
  },
  open: {
    to: 'under_review', label: 'Close submissions',
    confirm: c => `Close the submission window?\n\nMarketers will no longer be able to submit new LOAs to "${c.name}". Its ${c.totalLoas} LOA${c.totalLoas === 1 ? '' : 's'} stay in review.`,
  },
  under_review: {
    to: 'closed', label: 'Close cycle',
    confirm: c => `Close "${c.name}" for good?\n\nIt is frozen read-only, the workbook is exported and the close announcement goes out.`,
  },
}

/** The backwards move, offered only where it makes sense. Always confirmed twice. */
const CYCLE_REOPEN: Partial<Record<CycleStatus, { to: CycleStatus; label: string; confirm: (c: Cycle) => string }>> = {
  under_review: {
    to: 'open', label: 'Reopen',
    confirm: c => `Reopen submissions on "${c.name}"?\n\nReviewers have already started working through this cycle. New LOAs will join it mid-review.`,
  },
  closed: {
    to: 'under_review', label: 'Reopen',
    confirm: c => `Reopen "${c.name}"?\n\nIt has already been exported and announced as closed. Reopening does not retract that announcement.`,
  },
}

const BLANK_CYCLE: CreateCyclePayload = {
  name: '', cycle_type: 'normal', start_date: '', end_date: '',
  is_test: false, reason: '', authorized_emails: [],
}

/**
 * Who can be named on an emergency cycle, with the role shown beside the name.
 * An admin picking people needs to see that they are covering both sides —
 * someone to write the LOAs and someone to approve them.
 */
function PeoplePicker({
  users, selected, onToggle,
}: {
  users: AdminUser[]
  selected: string[]
  onToggle: (email: string) => void
}) {
  const [q, setQ] = useState('')
  const [area, setArea] = useState('')
  const t = q.trim().toLowerCase()

  // Areas come from the roles themselves — role_scope_value is the cluster list
  // a cluster-scoped role can see. No second source of truth to keep in sync.
  const areas = useMemo(() => {
    const set = new Set<string>()
    for (const u of users) {
      if (u.role_scope_type !== 'cluster') continue
      for (const v of u.role_scope_value ?? []) if (v) set.add(String(v))
    }
    return [...set].sort()
  }, [users])

  const shown = useMemo(() => {
    let rows = users
    if (area) {
      // Admins and other 'all'-scope roles stay visible whatever area is
      // picked: an emergency cycle is invalid without one (see peopleShortfall),
      // so filtering them out would make the picker unable to produce a valid
      // selection.
      rows = rows.filter(u =>
        u.role_scope_type !== 'cluster' ||
        (u.role_scope_value ?? []).some(v => String(v) === area),
      )
    }
    if (t) {
      rows = rows.filter(u => [u.full_name, u.email, u.role_display_name]
        .filter(Boolean).some(v => String(v).toLowerCase().includes(t)))
    }
    return rows
  }, [users, area, t])

  return (
    <>
      <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search people by name, email or role"
          style={{ ...INPUT, flex: 1 }}
        />
        {areas.length > 0 && (
          <select
            value={area}
            onChange={e => setArea(e.target.value)}
            style={{ ...INPUT, width: 'auto', minWidth: 150, flexShrink: 0 }}
          >
            <option value="">All areas</option>
            {areas.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        )}
      </div>
      <div style={{
        maxHeight: 200, overflowY: 'auto', border: '1.5px solid var(--border-strong)',
        borderRadius: 8, padding: 6, background: 'var(--surface-raised)',
      }}>
        {shown.length === 0 ? (
          <p className="ac-card-note" style={{ padding: 6 }}>
            {users.length === 0
              ? 'No users to pick from.'
              : area
                ? `Nobody in ${area} matches that search.`
                : 'Nobody matches that search.'}
          </p>
        ) : shown.map(u => (
          <label key={u.id} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '5px 6px',
            fontSize: 12.5, cursor: 'pointer', borderRadius: 6,
          }}>
            <input
              type="checkbox"
              checked={selected.includes(u.email)}
              onChange={() => onToggle(u.email)}
            />
            <span style={{ minWidth: 0, flex: 1 }}>
              <span style={{ display: 'block', fontWeight: 600, color: 'var(--text-primary)' }}>
                {u.full_name || u.email}
                {u.role_display_name && (
                  <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}> ({u.role_display_name})</span>
                )}
              </span>
              <span className="ac-sub2">
                {u.email}{u.can_override_lock ? ' · admin' : ''}
              </span>
            </span>
          </label>
        ))}
      </div>
    </>
  )
}

/** Emergency cycles need cover on both sides: someone to write, someone to approve. */
function peopleShortfall(users: AdminUser[], selected: string[]): string | null {
  if (selected.length === 0) return 'Pick at least one involved person. Nobody else will be able to see this cycle.'
  const picked = users.filter(u => selected.includes(u.email))
  // Unknown emails count as neither — better to prompt than to assume cover.
  const hasMarketer = picked.some(u => (u.role_code ?? '').endsWith('_marketer'))
  const hasAdmin = picked.some(u => u.can_override_lock)
  if (!hasMarketer) return 'Include at least one marketer — otherwise nobody can create LOAs in this cycle.'
  if (!hasAdmin) return 'Include at least one admin — otherwise nobody can manage this cycle.'
  return null
}

function CyclesScreen({
  cycles, users, onCreate, onEdit, onAdvance, onClose, onDelete, busyId, openCreate, onCreateHandled,
}: {
  cycles: Cycle[]
  users: AdminUser[]
  onCreate: (payload: CreateCyclePayload) => Promise<void>
  onEdit: (cycle: Cycle, payload: UpdateCyclePayload) => Promise<void>
  onAdvance: (cycle: Cycle, to: CycleStatus, reopen?: boolean) => Promise<void>
  onClose: (cycle: Cycle) => Promise<void>
  onDelete: (cycle: Cycle) => Promise<void>
  busyId: string | null
  /** Set by the header's "+ New cycle" button, which lives outside this screen. */
  openCreate: boolean
  onCreateHandled: () => void
}) {
  const [modalOpen, setModalOpen] = useState(false)
  /** null = creating; a Cycle = editing that one. */
  const [editing, setEditing] = useState<Cycle | null>(null)
  const [form, setForm] = useState<CreateCyclePayload>(BLANK_CYCLE)
  const [formErr, setFormErr] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const isEmergency = form.cycle_type === 'emergency'
  const openNormal = cycles.find(c => c.cycleType === 'normal' && c.status === 'open') ?? null

  const openCreateModal = useCallback(() => {
    setEditing(null); setForm(BLANK_CYCLE); setFormErr(null); setModalOpen(true)
  }, [])

  // The header button lives in the console shell, so it asks via this flag.
  useEffect(() => {
    if (openCreate) { openCreateModal(); onCreateHandled() }
  }, [openCreate, openCreateModal, onCreateHandled])

  const openEditModal = (c: Cycle) => {
    setEditing(c)
    setForm({
      name: c.name,
      cycle_type: c.cycleType,
      start_date: c.startDate ? c.startDate.slice(0, 10) : '',
      end_date: c.endDate ? c.endDate.slice(0, 10) : '',
      is_test: c.isTest,
      reason: c.emergencyReason ?? '',
      authorized_emails: c.authorizedEmails ?? [],
    })
    setFormErr(null); setModalOpen(true)
  }

  const closeModal = () => { if (!saving) setModalOpen(false) }

  // What an edit is still allowed to touch, per the API's own rules.
  const windowEditable = !editing || editing.status === 'draft' || editing.status === 'open'

  const submit = async () => {
    if (!form.name.trim()) { setFormErr('A name is required.'); return }
    // Emergency cycles have no fixed window — an admin opens and closes them.
    if (!isEmergency) {
      if (!form.start_date || !form.end_date) {
        setFormErr('A normal cycle needs a submission window — both dates.'); return
      }
      if (form.end_date <= form.start_date) {
        setFormErr('The end date must be after the start date.'); return
      }
    }
    if (isEmergency) {
      if (!form.reason?.trim()) {
        setFormErr('An emergency cycle needs a reason — it is the audit trail for going off-cycle.'); return
      }
      const short = peopleShortfall(users, form.authorized_emails ?? [])
      if (short) { setFormErr(short); return }
    }

    setSaving(true); setFormErr(null)
    try {
      if (editing) {
        const patch: UpdateCyclePayload = { name: form.name.trim() }
        if (windowEditable && form.end_date) patch.end_date = form.end_date
        if (editing.cycleType === 'emergency') {
          patch.reason = form.reason
          patch.authorized_emails = form.authorized_emails
        }
        await onEdit(editing, patch)
      } else {
        await onCreate({
          ...form,
          start_date: isEmergency ? undefined : form.start_date,
          end_date: isEmergency ? undefined : form.end_date,
          reason: isEmergency ? form.reason : undefined,
          authorized_emails: isEmergency ? form.authorized_emails : undefined,
        })
      }
      setModalOpen(false)
    } catch (e: any) {
      setFormErr(e?.response?.data?.detail || e?.message || 'Could not save that cycle.')
    } finally { setSaving(false) }
  }

  const toggleEmail = (email: string) => setForm(p => {
    const cur = p.authorized_emails ?? []
    return { ...p, authorized_emails: cur.includes(email) ? cur.filter(e => e !== email) : [...cur, email] }
  })

  return (
    <div className="ac-stack">
      <div className="ac-card">
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <span className="ac-card-title">Kickoff rules</span>
          <span style={{ marginLeft: 'auto' }}>
            <button className="ac-btn-primary" onClick={openCreateModal}>+ New cycle</button>
          </span>
        </div>
        <p className="ac-card-note" style={{ marginTop: 8 }}>
          <strong>1</strong> — One normal cycle may be Open at a time. Close the current one before opening the next.
          Historical and off-cycle batches can be imported without affecting the open cycle.
        </p>
        <p className="ac-card-note" style={{ marginTop: 6 }}>
          <strong>2</strong> — The lifecycle runs one way: Draft → Open → In Review → Closed. Submissions are accepted
          only while a cycle is Open; an emergency cycle runs the full nine-gate chain, but only the people named on it
          can see it or anything inside it.
        </p>
        {!openNormal && (
          <p className="ac-card-note" style={{ marginTop: 6, color: 'var(--st-rejected-fg)' }}>
            No normal cycle is open right now — marketers cannot submit.
          </p>
        )}
      </div>

      {cycles.length === 0 ? <div className="ac-empty">No cycles yet.</div> : (
      <div className="ac-tablewrap">
      <table className="ac-table">
        <thead>
          <tr>{['Cycle', 'Type', 'Status', 'Window', 'LOAs', 'Budget', 'Reference', 'Actions'].map(h => <th key={h}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {cycles.map(c => {
            const next = CYCLE_NEXT[c.status]
            const back = CYCLE_REOPEN[c.status]
            const busy = busyId === c.id
            // Deleting real submissions is never on the table — the API refuses
            // it too, so the button is simply absent rather than failing on click.
            const deletable = c.isTest || (c.totalLoas ?? 0) === 0
            // A backend older than the cycle-CRUD work omits this field, and a
            // stale dev server is the normal case — never dereference it bare.
            const emails = c.authorizedEmails ?? []
            return (
            <tr key={c.id}>
              <td>
                <span style={{ fontWeight: 600 }}>{c.name}</span>
                {c.cycleType === 'emergency' && c.emergencyReason && (
                  <span className="ac-sub2" style={{ display: 'block' }}>{c.emergencyReason}</span>
                )}
                {c.cycleType === 'emergency' && emails.length > 0 && (
                  <span className="ac-sub2" style={{ display: 'block' }}>
                    {emails.length} involved · {emails.slice(0, 2).join(', ')}
                    {emails.length > 2 ? ` +${emails.length - 2}` : ''}
                  </span>
                )}
              </td>
              <td className="ac-sub2">
                {c.cycleType === 'emergency'
                  ? <span className="ac-badge" style={{ background: 'var(--st-rejected-bg)', color: 'var(--st-rejected-fg)' }}>emergency</span>
                  : 'normal'}
                {c.isTest && <span className="ac-badge" style={{ marginLeft: 5 }}>test</span>}
              </td>
              <td>
                <span className="ac-badge" style={CYCLE_STATUS_STYLE[c.status]}>
                  {CYCLE_STATUS_LABEL[c.status] ?? c.status}
                </span>
              </td>
              <td className="ac-mono ac-sub2">
                {c.cycleType === 'emergency' ? (
                  <span>no fixed window</span>
                ) : (<>
                  {c.startDate ? new Date(c.startDate).toLocaleDateString('en-GB') : '—'}
                  {' → '}
                  {c.endDate ? new Date(c.endDate).toLocaleDateString('en-GB') : '—'}
                  {c.status === 'open' && c.daysRemaining != null && (
                    <span style={{ display: 'block' }}>
                      {c.daysRemaining < 0 ? `${-c.daysRemaining}d overdue`
                        : c.daysRemaining === 0 ? 'ends today' : `${c.daysRemaining}d left`}
                    </span>
                  )}
                </>)}
              </td>
              <td className="ac-mono">{c.totalLoas ?? '—'}</td>
              <td className="ac-mono">{formatBudget(c.totalBudget ?? 0)}</td>
              <td className="ac-mono ac-sub2">{c.code || '—'}</td>
              <td>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {next && (
                    <button
                      className="ac-btn" style={ACTION_BTN} disabled={busy}
                      onClick={() => {
                        if (!window.confirm(next.confirm(c))) return
                        if (next.to === 'closed') onClose(c); else onAdvance(c, next.to)
                      }}
                    >{busy ? '…' : next.label}</button>
                  )}
                  <button
                    className="ac-btn" style={ACTION_BTN} disabled={busy}
                    onClick={() => openEditModal(c)}
                  >Edit</button>
                  {back && (
                    <button
                      className="ac-btn" style={ACTION_BTN} disabled={busy}
                      onClick={() => {
                        if (!window.confirm(back.confirm(c))) return
                        onAdvance(c, back.to, true)
                      }}
                    >{back.label}</button>
                  )}
                  {deletable && (
                    <button
                      className="ac-btn"
                      style={{ ...ACTION_BTN, color: 'var(--st-rejected-fg)' }}
                      disabled={busy}
                      onClick={() => onDelete(c)}
                    >Delete</button>
                  )}
                </div>
              </td>
            </tr>
          )})}
        </tbody>
      </table>
      </div>
      )}

      {/* Create / edit modal — one form, two modes */}
      {modalOpen && (
        <div
          onClick={closeModal}
          style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--surface)', borderRadius: 14, padding: '28px 32px',
            maxWidth: 540, width: '100%', maxHeight: '88vh', overflowY: 'auto',
            boxShadow: '0 20px 60px rgba(0,0,0,.25)',
          }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4, color: 'var(--text-primary)' }}>
              {editing ? `Edit ${editing.code || editing.name}` : 'New cycle'}
            </div>
            <p className="ac-card-note" style={{ marginBottom: 20 }}>
              {editing
                ? 'The type and start date are fixed — they are what this cycle’s LOAs were filed under.'
                : 'It is created as a Draft. Nothing can be submitted into it until you open it.'}
            </p>

            {/* Type is chosen once, at creation. */}
            {!editing && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                {(['normal', 'emergency'] as CycleType[]).map(t => (
                  <button
                    key={t}
                    className={form.cycle_type === t ? 'ac-btn-primary' : 'ac-btn'}
                    onClick={() => setForm(p => ({ ...p, cycle_type: t }))}
                    style={{ flex: 1 }}
                  >
                    {t === 'normal' ? 'Normal' : 'Emergency'}
                  </button>
                ))}
              </div>
            )}

            <Field label="Name">
              <input
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder={isEmergency ? 'Emergency — Q3 product launch' : 'Cycle 4 2026'}
                style={INPUT}
              />
            </Field>

            {/* An emergency cycle runs until an admin closes it — no dates to set. */}
            {!isEmergency && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label={editing ? 'Opens (fixed)' : 'Opens'}>
                  <input
                    type="date" value={form.start_date ?? ''} disabled={!!editing}
                    onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))}
                    style={{ ...INPUT, opacity: editing ? 0.55 : 1 }}
                  />
                </Field>
                <Field label={windowEditable ? 'Closes' : 'Closes (fixed)'}>
                  <input
                    type="date" value={form.end_date ?? ''} disabled={!windowEditable}
                    onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))}
                    style={{ ...INPUT, opacity: windowEditable ? 1 : 0.55 }}
                  />
                </Field>
              </div>
            )}
            {editing && !isEmergency && windowEditable && (
              <p className="ac-card-note" style={{ marginTop: -6, marginBottom: 14 }}>
                Extending the closing date keeps the window open longer. It can no longer be changed once
                submissions close.
              </p>
            )}

            {isEmergency && (
              <>
                <Field label="Reason">
                  <textarea
                    value={form.reason ?? ''}
                    onChange={e => setForm(p => ({ ...p, reason: e.target.value }))}
                    placeholder="Why this has to run outside the normal window"
                    rows={2}
                    style={{ ...INPUT, resize: 'vertical', fontFamily: 'inherit' }}
                  />
                </Field>

                <Field label={`Involved people${form.authorized_emails?.length ? ` (${form.authorized_emails.length})` : ''}`}>
                  <PeoplePicker
                    users={users}
                    selected={form.authorized_emails ?? []}
                    onToggle={toggleEmail}
                  />
                  <p className="ac-card-note" style={{ marginTop: 6 }}>
                    Only these people — and admins — can see this cycle or the LOAs in it. Everyone else gets nothing
                    back from the API, not a hidden row. Changes take effect the moment you save.
                  </p>
                </Field>
              </>
            )}

            {/* The "Test cycle" checkbox was removed from cycle creation (Aug-26 action
                item A1). `is_test` itself is untouched: the column, the banner, the
                delete guard in cycles.py and the pytest fixtures all still read it —
                new cycles simply create with the BLANK_CYCLE default of false. */}

            {formErr && (
              <div style={{ padding: '8px 12px', background: 'var(--st-rejected-bg)', color: 'var(--st-rejected-fg)', borderRadius: 8, fontSize: 12, margin: '14px 0' }}>
                {formErr}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button className="ac-btn" onClick={closeModal} disabled={saving}>Cancel</button>
              <button className="ac-btn-primary" onClick={submit} disabled={saving}>
                {saving ? 'Saving…' : editing ? 'Save changes' : 'Create cycle'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const ACTION_BTN: React.CSSProperties = { fontSize: 11.5, whiteSpace: 'nowrap', padding: '4px 9px' }

const INPUT: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '9px 12px',
  borderRadius: 8, border: '1.5px solid var(--border-strong)',
  background: 'var(--surface-raised)', color: 'var(--text-primary)',
  fontSize: 13, outline: 'none',
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 5, color: 'var(--text-secondary)' }}>{label}</label>
      {children}
    </div>
  )
}

// ── 09 Data & imports ───────────────────────────────────────────────────────

function ImportsScreen({ batches, stats }: { batches: ImportBatch[]; stats: Stats | null }) {
  return (
    <div className="ac-stack">
      <div className="ac-card">
        <span className="ac-card-title">Rows by source</span>
        <div className="ac-statgrid" style={{ marginTop: 14 }}>
          <div className="ac-stat">
            <span className="ac-stat-v">{stats?.total_loas ?? 0}</span>
            <span className="ac-stat-l">rows total</span>
          </div>
          <div className="ac-stat">
            <span className="ac-stat-v">{batches.reduce((n, b) => n + (b.rowCount ?? 0), 0)}</span>
            <span className="ac-stat-l">historical, imported</span>
            <span className="ac-stat-note">{batches.length} batches</span>
          </div>
        </div>
      </div>

      <div className="ac-card">
        <p className="ac-card-note">Every batch is reversible for 90 days. Demo rows never appear in CMO or CFO review — they are filtered at query time and do not affect approval counts.</p>
      </div>

      {batches.length === 0 ? (
        <div className="ac-empty">No import batches.</div>
      ) : (
        <div className="ac-tablewrap">
          <table className="ac-table">
            <thead><tr>{['Batch', 'Rows', 'Imported', 'Notes'].map(h => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>
              {batches.map(b => (
                <tr key={b.id}>
                  <td style={{ fontWeight: 600 }}>{b.label}</td>
                  <td className="ac-mono">{b.rowCount}</td>
                  <td className="ac-mono ac-sub2">
                    {b.importedAt ? new Date(b.importedAt).toLocaleDateString('en-GB') : '—'}
                  </td>
                  <td className="ac-sub2">{b.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── 05 Approval chain (read-only) ───────────────────────────────────────────

function ChainScreen({ stats }: { stats: Stats | null }) {
  const counts = stats?.status_counts ?? {}
  // Same source as the split-screen stepper: buildChain() off WORKFLOW_ORDER.
  // The gate owners used to be a second map here, which is exactly how this
  // screen and the stepper would drift apart.
  const activeSteps = buildChain('')

  return (
    <div className="ac-stack">
      <div className="ac-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <span className="ac-card-title">Live gate sequence</span>
          <span className="ac-card-note">read-only · rendered from WORKFLOW_ORDER</span>
        </div>
        <p className="ac-card-note" style={{ marginTop: 6, marginBottom: 18 }}>
          Editing gate owners, reassigning reviewers and publishing chain changes need
          the <code>approval_chain</code> and <code>approval_gate</code> tables (queued for
          database audit). This view reflects the authoritative state machine in code.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {activeSteps.map((step, i) => {
            const stage = step.key
            const badge = statusBadge[stage as keyof typeof statusBadge]
            const n = counts[stage] ?? 0
            const isTerminal = step.terminal
            return (
              <div key={stage} style={{ display: 'flex', gap: 0 }}>
                {/* connector line */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 32, flexShrink: 0 }}>
                  <div style={{
                    width: 12, height: 12, borderRadius: 99, flexShrink: 0, marginTop: 14,
                    background: isTerminal ? 'var(--accent)' : n > 0 ? 'var(--accent-dim)' : 'var(--border-strong)',
                    border: `2px solid ${isTerminal ? 'var(--accent)' : 'var(--border-strong)'}`,
                  }} />
                  {i < activeSteps.length - 1 && (
                    <div style={{ width: 2, flex: 1, minHeight: 16, background: 'var(--border)' }} />
                  )}
                </div>

                <div style={{
                  flex: 1, padding: '10px 14px 16px', marginBottom: 0,
                  borderBottom: i < activeSteps.length - 1 ? '1px solid var(--border)' : 'none',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    {step.index && (
                      <span className="ac-mono" style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>
                        {step.index}
                      </span>
                    )}
                    <span style={{
                      fontSize: 10.5, fontWeight: 600, letterSpacing: '.04em',
                      color: badge?.text ?? 'var(--text-secondary)',
                      background: badge?.bg ?? 'var(--bg-surface)',
                      border: `1px solid ${badge?.border ?? 'var(--border)'}`,
                      borderRadius: 6, padding: '2px 8px',
                    }}>
                      {step.label}
                    </span>
                    {n > 0 && (
                      <span style={{
                        fontFamily: "'IBM Plex Mono', monospace", fontSize: 10.5,
                        color: 'var(--accent)', fontWeight: 600,
                      }}>
                        {n} LOA{n === 1 ? '' : 's'} here now
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: 11.5, color: 'var(--text-tertiary)', margin: '5px 0 0', lineHeight: 1.5 }}>
                    {step.owner}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="ac-card">
        <span className="ac-card-title" style={{ display: 'block', marginBottom: 10 }}>What editing needs</span>
        <ul className="ac-pending-list">
          <li>approval_chain — an ordered chain per activity type</li>
          <li>approval_gate — the gates in a chain and the role that owns each</li>
        </ul>
        <p className="ac-card-note" style={{ marginTop: 10 }}>
          Until those tables exist, chain changes require a code deploy.
          The read-only view above reflects the current deployed state machine.
        </p>
      </div>
    </div>
  )
}

// ── Console ─────────────────────────────────────────────────────────────────

export default function AdminConsolePage() {
  const router = useRouter()
  const toast = useToast()
  const { role } = useMyRole()

  const [screen, setScreen] = useState<ScreenId>('overview')
  const [stats, setStats] = useState<Stats | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [roles, setRoles] = useState<AdminRole[]>([])
  const [cycles, setCycles] = useState<Cycle[]>([])
  const [batches, setBatches] = useState<ImportBatch[]>([])
  const [matrix, setMatrix] = useState<MatrixResponse | null>(null)
  const [permissions, setPermissions] = useState<PermissionDef[]>([])
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [cycleBusy, setCycleBusy] = useState<string | null>(null)
  // The header's "+ New cycle" sits outside CyclesScreen, so it asks via a flag.
  const [wantCreateCycle, setWantCreateCycle] = useState(false)
  const [loading, setLoading] = useState(true)

  // The screen lives in the URL hash so Back inside the console works and a
  // link to a specific screen can be shared.
  useEffect(() => {
    const apply = () => {
      const h = window.location.hash.replace('#', '') as ScreenId
      if (SCREENS.some(s => s.id === h)) setScreen(h)
    }
    apply()
    window.addEventListener('hashchange', apply)
    return () => window.removeEventListener('hashchange', apply)
  }, [])

  const goto = useCallback((id: ScreenId) => {
    setScreen(id)
    if (typeof window !== 'undefined') window.location.hash = id
  }, [])

  useEffect(() => {
    let alive = true
    Promise.allSettled([
      getAdminStats(), getAdminUsers(), getAdminRoles(),
      fetchCycles(), fetchImportBatches(),
      api.get('/admin/permission-matrix').then(r => r.data),
      api.get('/admin/permissions').then(r => r.data),
    ]).then(([s, u, r, c, b, m, pm]) => {
      if (!alive) return
      if (s.status === 'fulfilled') setStats(s.value as Stats)
      if (u.status === 'fulfilled') setUsers(newestFirst<AdminUser>(u.value as AdminUser[]))
      if (r.status === 'fulfilled') setRoles(r.value as AdminRole[])
      if (c.status === 'fulfilled') setCycles(c.value as Cycle[])
      if (b.status === 'fulfilled') setBatches(b.value as ImportBatch[])
      if (m.status === 'fulfilled') setMatrix(m.value as MatrixResponse)
      if (pm.status === 'fulfilled') setPermissions(pm.value as PermissionDef[])
      setLoading(false)
    })
    return () => { alive = false }
  }, [])

  const changeRole = useCallback(async (userId: string, roleCode: string) => {
    try {
      await updateUserRole(userId, roleCode)
      const role = roles.find(r => r.code === roleCode)
      setUsers(prev => prev.map(u => u.id === userId
        ? { ...u, role_id: role?.id ?? u.role_id, role_code: roleCode, role_display_name: role?.display_name ?? u.role_display_name, role_scope_type: role?.scope_type ?? u.role_scope_type, role_scope_value: role?.scope_value ?? u.role_scope_value }
        : u))
      toast.success('Role updated')
    } catch {
      toast.error('Could not update that role')
    }
  }, [roles, toast])

  const addUser = useCallback(async (payload: CreateUserPayload) => {
    const created = await createUser(payload)
    const role = roles.find(r => r.code === payload.role_code)
    const newUser: AdminUser = {
      id:                created.id,
      email:             created.email,
      full_name:         created.full_name,
      is_active:         created.is_active,
      role_id:           role?.id ?? null,
      role_code:         role?.code ?? null,
      role_display_name: role?.display_name ?? null,
      role_scope_type:   role?.scope_type ?? null,
      role_scope_value:  role?.scope_value ?? null,
      can_override_lock: role?.can_override_lock ?? false,
      last_login:        null,
      created_at:        created.created_at,
    }
    setUsers(prev => [newUser, ...prev])
    toast.success('User created')
  }, [roles, toast])

  const doDeactivate = useCallback(async (userId: string) => {
    try {
      await deactivateUser(userId)
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_active: false } : u))
      toast.success('User deactivated')
    } catch {
      toast.error('Could not deactivate user')
    }
  }, [toast])

  const doReactivate = useCallback(async (userId: string) => {
    try {
      await reactivateUser(userId)
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_active: true } : u))
      toast.success('User reactivated')
    } catch {
      toast.error('Could not reactivate user')
    }
  }, [toast])

  const addCycle = useCallback(async (payload: CreateCyclePayload) => {
    const created = await createCycle(payload)
    setCycles(prev => [created, ...prev])
    toast.success(`Cycle created — ${created.code || created.name}`)
  }, [toast])

  const editCycle = useCallback(async (cycle: Cycle, payload: UpdateCyclePayload) => {
    const updated = await updateCycle(cycle.id, payload)
    setCycles(prev => prev.map(c => c.id === cycle.id ? updated : c))
    toast.success('Cycle updated')
  }, [toast])

  const advanceCycle = useCallback(async (cycle: Cycle, to: CycleStatus, reopen = false) => {
    setCycleBusy(cycle.id)
    try {
      const updated = await setCycleStatus(cycle.id, to, reopen)
      setCycles(prev => prev.map(c => c.id === cycle.id ? updated : c))
      toast.success(
        reopen ? 'Cycle reopened'
          : to === 'open' ? 'Cycle opened'
          : 'Submissions closed — cycle is now in review',
      )
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Could not move that cycle')
    } finally { setCycleBusy(null) }
  }, [toast])

  const removeCycle = useCallback(async (cycle: Cycle) => {
    const n = cycle.totalLoas ?? 0
    // A test cycle takes its LOAs with it, so that one is typed to confirm.
    if (cycle.isTest && n > 0) {
      const typed = window.prompt(
        `Deleting "${cycle.name}" also deletes its ${n} LOA${n === 1 ? '' : 's'} and every comment, verdict and photo on them. This cannot be undone.\n\nType the cycle name to confirm:`,
      )
      if (typed !== cycle.name) {
        if (typed !== null) toast.error('That did not match — nothing was deleted')
        return
      }
    } else if (!window.confirm(`Delete "${cycle.name}"? It holds no LOAs, so nothing else is removed.`)) {
      return
    }
    setCycleBusy(cycle.id)
    try {
      await deleteCycle(cycle.id)
      setCycles(prev => prev.filter(c => c.id !== cycle.id))
      toast.success('Cycle deleted')
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Could not delete that cycle')
    } finally { setCycleBusy(null) }
  }, [toast])

  const finishCycle = useCallback(async (cycle: Cycle) => {
    setCycleBusy(cycle.id)
    try {
      const res = await closeCycle(cycle.id)
      // The close response is a report, not a cycle row — refetch so the table
      // shows the real post-close stats rather than a hand-patched guess.
      setCycles(await fetchCycles())
      toast.success(
        res.notification.delivered
          ? `Cycle closed — ${res.notification.recipients} notified`
          : 'Cycle closed. The announcement could not be delivered.',
      )
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Could not close that cycle')
    } finally { setCycleBusy(null) }
  }, [toast])

  const saveMatrix = useCallback(async () => {
    setSaving(true)
    try {
      // The PATCH contract is `entries`, and `'none'` revokes — it is not a
      // boolean grant flag.
      const entries = Object.entries(edits).map(([key, permission_code]) => {
        const [role_code, loa_status] = key.split('|')
        return { role_code, loa_status, permission_code }
      })
      const res = await api.patch('/admin/permission-matrix', { entries })
      const fresh = await api.get('/admin/permission-matrix').then(r => r.data)
      setMatrix(fresh as MatrixResponse)
      setEdits({})
      const d = res.data || {}
      toast.success(`Saved · ${d.created ?? 0} added, ${d.updated ?? 0} changed, ${d.deleted ?? 0} revoked`)
    } catch {
      toast.error('Could not save those permissions')
    } finally {
      setSaving(false)
    }
  }, [edits, toast])

  const s = byId(screen)

  return (
    <div data-console>
      <div className="ac-body">
        <nav className="ac-nav" aria-label="Admin console">
          {GROUPS.map(g => {
            const items = SCREENS.filter(x => x.group === g)
            if (items.length === 0) return null
            return (
              <div className="ac-nav-group" key={g}>
                <span className="ac-nav-label">{g}</span>
                {items.map(item => {
                  const pending = isPending(item.id)
                  return (
                    <button
                      key={item.id}
                      className={item.id === screen ? 'ac-nav-item is-on' : 'ac-nav-item'}
                      onClick={() => goto(item.id)}
                      disabled={pending}
                      aria-current={item.id === screen ? 'page' : undefined}
                      title={pending ? 'Designed, but waiting on the database audit' : undefined}
                    >
                      <span className="ac-nav-item-icon" aria-hidden="true">{item.icon}</span>
                      <span className="ac-nav-item-label">{item.label}</span>
                      {pending
                        ? <span className="ac-nav-item-pending">pending</span>
                        : item.id === 'users' && users.length > 0
                          ? <span className="ac-nav-item-badge">{users.length}</span>
                          : item.id === 'cycles' && cycles.length > 0
                            ? <span className="ac-nav-item-badge">{cycles.length}</span>
                            : null}
                    </button>
                  )
                })}
              </div>
            )
          })}
          <div style={{ flex: 1 }} />
          <div className="ac-nav-foot">
            <span className="ac-nav-foot-line">
              <span className="ac-dot" />
              {role?.role_display_name || 'Admin'}
            </span>
            <span className="ac-nav-build">
              {SCREENS.length - SCREENS.filter(x => isPending(x.id)).length} of {SCREENS.length} screens wired
            </span>
          </div>
        </nav>

        <main className="ac-main">
          <div className="ac-head">
            <div style={{ minWidth: 0 }}>
              <span className="ac-kicker">{s.kicker}</span>
              <h2 className="ac-title">{s.title}</h2>
            </div>
            <p className="ac-sub">{s.sub}</p>
            <div className="ac-head-actions">
              {screen === 'cycles' && (
                <button className="ac-btn-primary" onClick={() => setWantCreateCycle(true)}>+ New cycle</button>
              )}
              <button className="ac-btn" onClick={() => router.push('/cycles')}>← Folder page</button>
            </div>
          </div>

          <div className="ac-scroll">
            {loading ? (
              <p className="ac-msg">Loading the console…</p>
            ) : isPending(screen) ? (
              <PendingScreen id={screen} />
            ) : screen === 'overview' ? (
              <AdminHome stats={stats} users={users} cycles={cycles} batches={batches} onGoto={goto} />
            ) : screen === 'users' ? (
              <UsersScreen users={users} roles={roles} onChangeRole={changeRole} onAddUser={addUser} onDeactivate={doDeactivate} onReactivate={doReactivate} />
            ) : screen === 'roles' ? (
              <RolesScreen
                matrix={matrix}
                permissions={permissions}
                edits={edits}
                onCell={(k, v) => setEdits(p => ({ ...p, [k]: v }))}
                onSave={saveMatrix}
                onDiscard={() => setEdits({})}
                saving={saving}
              />
            ) : screen === 'cycles' ? (
              <CyclesScreen
                cycles={cycles}
                users={users}
                onCreate={addCycle}
                onEdit={editCycle}
                onAdvance={advanceCycle}
                onClose={finishCycle}
                onDelete={removeCycle}
                busyId={cycleBusy}
                openCreate={wantCreateCycle}
                onCreateHandled={() => setWantCreateCycle(false)}
              />
            ) : screen === 'imports' ? (
              <ImportsScreen batches={batches} stats={stats} />
            ) : screen === 'chain' ? (
              <ChainScreen stats={stats} />
            ) : null}
          </div>
        </main>
      </div>
    </div>
  )
}
