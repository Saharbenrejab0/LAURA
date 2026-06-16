'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useMyRole } from '@/hooks/usePermissions'
import NavHeader from '@/components/NavHeader'
import { useToast } from '@/components/Toast'
import {
  getAdminStats, getAdminUsers, getAdminRoles, updateUserRole,
  type AdminStats, type AdminUser, type AdminRole,
} from '@/lib/admin-api'
import { STATUS_CONFIG } from '@/types/loa'

// ── Helpers ───────────────────────────────────────────────────────────

function formatEuros(n: number) {
  if (!n) return '€0'
  if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `€${Math.round(n / 1_000)}k`
  return `€${n}`
}

function timeAgo(iso: string | null): string {
  if (!iso) return 'Never'
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 86_400_000) return 'Today'
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

// Scope badge color
function scopeColor(scope: string | null) {
  if (scope === 'all') return { bg: 'var(--green-bg)', color: 'var(--green-text)', border: 'var(--green-border)' }
  if (scope === 'cluster') return { bg: 'var(--blue-bg)', color: 'var(--blue-text)', border: 'var(--blue-border)' }
  if (scope === 'brand') return { bg: 'var(--indigo-bg)', color: 'var(--indigo-text)', border: 'var(--indigo-border)' }
  if (scope === 'function') return { bg: 'var(--amber-bg)', color: 'var(--amber-text)', border: 'var(--amber-border)' }
  return { bg: 'var(--bg-elevated)', color: 'var(--text-muted)', border: 'var(--border)' }
}

// ── Stat Card ─────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="card px-5 py-4">
      <p className="text-xs uppercase tracking-widest font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
        {label}
      </p>
      <p className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
        {value}
      </p>
      {sub && (
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{sub}</p>
      )}
    </div>
  )
}

// ── Tab Button ────────────────────────────────────────────────────────

function Tab({ active, label, count, onClick }: {
  active: boolean; label: string; count?: number; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="text-sm font-medium pb-2 transition-colors"
      style={{
        color: active ? 'var(--text-primary)' : 'var(--text-muted)',
        borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
      }}
    >
      {label}
      {count !== undefined && (
        <span className="ml-1.5 text-xs opacity-60">{count}</span>
      )}
    </button>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const router = useRouter()
  const { role, loading: roleLoading } = useMyRole()
  const { success, error: toastError } = useToast()

  const [stats, setStats] = useState<AdminStats | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [roles, setRoles] = useState<AdminRole[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'users' | 'roles'>('users')
  const [search, setSearch] = useState('')
  const [changingRole, setChangingRole] = useState<string | null>(null)

  // ── Super-admin guard ─────────────────────────────────────────────
  useEffect(() => {
    if (!roleLoading && (!role || !role.can_override_lock)) {
      router.replace('/')
    }
  }, [role, roleLoading])

  // ── Load data ─────────────────────────────────────────────────────
  useEffect(() => {
    if (roleLoading || !role?.can_override_lock) return
    loadAll()
  }, [role, roleLoading])

  async function loadAll() {
    setLoading(true)
    try {
      const [s, u, r] = await Promise.all([
        getAdminStats(),
        getAdminUsers(),
        getAdminRoles(),
      ])
      setStats(s)
      setUsers(u)
      setRoles(r)
    } catch {
      toastError('Failed to load admin data')
    } finally {
      setLoading(false)
    }
  }

  // ── Role change handler ───────────────────────────────────────────
  async function handleRoleChange(userId: string, newRoleId: number) {
    setChangingRole(userId)
    try {
      const result = await updateUserRole(userId, newRoleId)
      success(`${result.full_name}: ${result.old_role} → ${result.new_role}`)
      // Refresh users list
      const updated = await getAdminUsers()
      setUsers(updated)
      // Refresh roles for user counts
      const updatedRoles = await getAdminRoles()
      setRoles(updatedRoles)
    } catch {
      toastError('Role change failed')
    } finally {
      setChangingRole(null)
    }
  }

  // ── Filtered users ────────────────────────────────────────────────
  const filteredUsers = useMemo(() => {
    if (!search) return users
    const q = search.toLowerCase()
    return users.filter(u =>
      u.full_name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.role_display_name || '').toLowerCase().includes(q) ||
      (u.role_code || '').toLowerCase().includes(q)
    )
  }, [users, search])

  // ── Status breakdown for stats ────────────────────────────────────
  const statusBreakdown = useMemo(() => {
    if (!stats) return []
    return Object.entries(stats.loas_by_status)
      .sort(([, a], [, b]) => b - a)
      .map(([status, count]) => {
        const cfg = (STATUS_CONFIG as any)[status]
        return {
          status,
          label: cfg?.label || status,
          cls: cfg?.cls || 'badge-draft',
          count,
        }
      })
  }, [stats])

  // ── Loading / guard ───────────────────────────────────────────────
  if (roleLoading || (!role?.can_override_lock)) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {roleLoading ? 'Loading…' : 'Redirecting…'}
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen page-enter" style={{ background: 'var(--bg-base)' }}>

      <NavHeader active="admin" />

      {/* Admin action bar */}
      <div
        className="px-6 py-2.5 flex items-center justify-between"
        style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-2 max-w-7xl mx-auto w-full justify-between">
          <span className="text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
            Dashboard
          </span>
          <button onClick={loadAll} disabled={loading} className="btn-secondary text-xs px-3 py-1.5">
            {loading ? '…' : '↻ Refresh'}
          </button>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-6 py-6">

        {/* ── Stats cards ── */}
        {stats && (
          <div className="grid grid-cols-5 gap-3 mb-6">
            <StatCard label="Total LOAs" value={stats.total_loas} />
            <StatCard label="FY26 Budget" value={formatEuros(stats.total_budget_fy26)} />
            <StatCard label="Locked" value={stats.locked_count} sub="LOAs frozen by admin" />
            <StatCard label="Users" value={stats.total_users} />
            <StatCard label="Roles" value={stats.total_roles} />
          </div>
        )}

        {/* ── Status breakdown ── */}
        {statusBreakdown.length > 0 && (
          <div className="card px-5 py-4 mb-6">
            <p className="section-heading">LOAs by status</p>
            <div className="flex flex-wrap gap-3">
              {statusBreakdown.map(s => (
                <div key={s.status} className="flex items-center gap-2">
                  <span className={`badge ${s.cls}`}>{s.label}</span>
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {s.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Tabs ── */}
        <div className="flex gap-6 mb-5" style={{ borderBottom: '1px solid var(--border)' }}>
          <Tab active={activeTab === 'users'} label="Users" count={users.length} onClick={() => setActiveTab('users')} />
          <Tab active={activeTab === 'roles'} label="Roles" count={roles.length} onClick={() => setActiveTab('roles')} />
        </div>

        {/* ════════════════════ USERS TAB ════════════════════ */}
        {activeTab === 'users' && (
          <>
            <input
              type="text"
              placeholder="Search by name, email, or role…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input mb-4"
              style={{ maxWidth: '400px' }}
            />

            <div className="card overflow-hidden">
              {/* Table header */}
              <div
                className="grid gap-3 px-4 py-2.5 text-xs font-medium uppercase tracking-wider"
                style={{
                  gridTemplateColumns: '1fr 1.5fr 1.2fr 100px 80px',
                  borderBottom: '1px solid var(--border)',
                  color: 'var(--text-muted)',
                }}
              >
                <span>Name</span>
                <span>Email</span>
                <span>Role</span>
                <span>Scope</span>
                <span>Last login</span>
              </div>

              {/* Table rows */}
              {filteredUsers.map(u => {
                const sc = scopeColor(u.role_scope_type)
                return (
                  <div
                    key={u.id}
                    className="grid gap-3 px-4 py-3 items-center transition-colors"
                    style={{
                      gridTemplateColumns: '1fr 1.5fr 1.2fr 100px 80px',
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        {u.full_name}
                      </p>
                      {u.can_override_lock && (
                        <span className="text-[10px] font-bold uppercase" style={{ color: 'var(--red-text)' }}>
                          Super-Admin
                        </span>
                      )}
                    </div>

                    <span className="text-sm truncate" style={{ color: 'var(--text-secondary)' }}>
                      {u.email}
                    </span>

                    {/* Role dropdown */}
                    <select
                      className="input text-xs py-1.5"
                      value={u.role_id ?? ''}
                      onChange={e => {
                        const newId = parseInt(e.target.value)
                        if (!isNaN(newId) && newId !== u.role_id) {
                          handleRoleChange(u.id, newId)
                        }
                      }}
                      disabled={changingRole === u.id}
                      style={{ fontSize: '12px' }}
                    >
                      <option value="">No role</option>
                      {roles.map(r => (
                        <option key={r.id} value={r.id}>
                          {r.display_name}
                        </option>
                      ))}
                    </select>

                    {/* Scope badge */}
                    <span
                      className="text-[10px] font-medium px-2 py-0.5 rounded-full text-center"
                      style={{
                        background: sc.bg,
                        color: sc.color,
                        border: `1px solid ${sc.border}`,
                      }}
                    >
                      {u.role_scope_type || '—'}
                    </span>

                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {timeAgo(u.last_login)}
                    </span>
                  </div>
                )
              })}

              {filteredUsers.length === 0 && (
                <div className="px-4 py-8 text-center">
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    {search ? 'No users match your search.' : 'No users found.'}
                  </p>
                </div>
              )}
            </div>
          </>
        )}

        {/* ════════════════════ ROLES TAB ════════════════════ */}
        {activeTab === 'roles' && (
          <div className="card overflow-hidden">
            {/* Table header */}
            <div
              className="grid gap-3 px-4 py-2.5 text-xs font-medium uppercase tracking-wider"
              style={{
                gridTemplateColumns: '50px 1fr 1.2fr 100px 120px 80px',
                borderBottom: '1px solid var(--border)',
                color: 'var(--text-muted)',
              }}
            >
              <span>ID</span>
              <span>Role</span>
              <span>Description</span>
              <span>Scope</span>
              <span>Scope value</span>
              <span>Users</span>
            </div>

            {/* Table rows */}
            {roles.map(r => {
              const sc = scopeColor(r.scope_type)
              return (
                <div
                  key={r.id}
                  className="grid gap-3 px-4 py-3 items-center"
                  style={{
                    gridTemplateColumns: '50px 1fr 1.2fr 100px 120px 80px',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  <span className="mono text-xs" style={{ color: 'var(--text-muted)' }}>
                    {r.id}
                  </span>

                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {r.display_name}
                    </p>
                    <p className="mono text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      {r.code}
                    </p>
                  </div>

                  <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                    {r.description || '—'}
                  </p>

                  <span
                    className="text-[10px] font-medium px-2 py-0.5 rounded-full text-center"
                    style={{
                      background: sc.bg,
                      color: sc.color,
                      border: `1px solid ${sc.border}`,
                    }}
                  >
                    {r.scope_type}
                  </span>

                  <span className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                    {r.scope_value ? r.scope_value.join(', ') : '—'}
                  </span>

                  <span
                    className="text-sm font-medium text-center"
                    style={{ color: r.user_count > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}
                  >
                    {r.user_count}
                  </span>
                </div>
              )
            })}
          </div>
        )}

      </main>
    </div>
  )
}
