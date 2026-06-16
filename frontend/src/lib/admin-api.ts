// ============================================================
// LAURA — Admin API client (Sprint 3)
// Separate file: no need to edit the main api.ts
// ============================================================

import axios from 'axios'

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT token
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('laura_token')
    if (token) config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ── Types ──────────────────────────────────────────────────────────────

export interface AdminStats {
  total_loas: number
  total_budget_fy26: number
  locked_count: number
  total_users: number
  total_roles: number
  loas_by_status: Record<string, number>
}

export interface AdminUser {
  id: string
  email: string
  full_name: string
  is_active: boolean
  role_id: number | null
  role_code: string | null
  role_display_name: string | null
  role_scope_type: string | null
  role_scope_value: string[] | null
  can_override_lock: boolean
  last_login: string | null
  created_at: string | null
}

export interface AdminRole {
  id: number
  code: string
  display_name: string
  description: string | null
  scope_type: string
  scope_value: string[] | null
  can_override_lock: boolean
  user_count: number
}

// ── API calls ──────────────────────────────────────────────────────────

export async function getAdminStats(): Promise<AdminStats> {
  const { data } = await api.get('/admin/stats')
  return data
}

export async function getAdminUsers(): Promise<AdminUser[]> {
  const { data } = await api.get('/admin/users')
  return data
}

export async function getAdminRoles(): Promise<AdminRole[]> {
  const { data } = await api.get('/admin/roles')
  return data
}

export async function updateUserRole(userId: string, roleId: number) {
  const { data } = await api.patch(`/admin/users/${userId}`, { role_id: roleId })
  return data
}
