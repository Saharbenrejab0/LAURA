// ============================================================
// LAURA — API client
// All calls to the FastAPI backend go through here
// ============================================================

import axios from 'axios'
import type { LOA, LOAFormValues, AISuggestion } from '@/types/loa'

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT token to every request if present
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('laura_token')
    if (token) config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Redirect to login on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('laura_token')
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  }
)

// ---- Auth ----
export const login = async (email: string, password: string) => {
  const { data } = await api.post('/auth/login', { email, password })
  if (typeof window !== 'undefined') {
    localStorage.setItem('laura_token', data.token)
    localStorage.setItem('laura_user', JSON.stringify(data.user))
    document.cookie = `laura_token=${data.token}; path=/; max-age=86400`
  }
  return data
}

export const logout = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('laura_token')
    localStorage.removeItem('laura_user')
    document.cookie = 'laura_token=; path=/; max-age=0'
    window.location.href = '/login'
  }
}

export const getStoredUser = (): {
  id: string; email: string; full_name: string; role: string; cluster: string | null
} | null => {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem('laura_user')
  return raw ? JSON.parse(raw) : null
}

// ---- LOAs ----
export const getLOAs = async (filters?: {
  status?: string
  cluster?: string
  activity_type?: string
  include_historical?: boolean
}): Promise<LOA[]> => {
  const { data } = await api.get('/loa', { params: filters })
  return data
}

export const getLOA = async (id: string): Promise<LOA> => {
  const { data } = await api.get(`/loa/${id}`)
  return data
}

export const createLOA = async (values: Partial<LOAFormValues>): Promise<LOA> => {
  const { data } = await api.post('/loa', values)
  return data
}

export const updateLOA = async (id: string, values: Partial<LOAFormValues>): Promise<LOA> => {
  const { data } = await api.patch(`/loa/${id}`, values)
  return data
}

export const submitLOA = async (id: string): Promise<LOA> => {
  const { data } = await api.post(`/loa/${id}/submit`)
  return data
}

// ── DEPRECATED — /approve does not exist in backend Sprint 2.5 ─────────────
// Kept for backward compatibility. New code should use validateWorkflowStep.
export const approveLOA = async (id: string, comment?: string): Promise<LOA> => {
  const { data } = await api.post(`/loa/${id}/approve`, { comment })
  return data
}

export const rejectLOA = async (id: string, reason: string): Promise<LOA> => {
  const { data } = await api.post(`/loa/${id}/reject`, null, { params: { reason } })
  return data
}

// ── Workflow — Sprint 2.5 endpoints ─────────────────────────────────────────

/**
 * Advance a LOA one step in the approval workflow.
 * Backend smart-dispatches: 'validate' permission for CMO/CFO/CEO steps,
 * 'advance_phase' for EMEA orchestration steps.
 * Frontend just calls this — backend decides what's allowed.
 */
export const validateWorkflowStep = async (id: string): Promise<LOA> => {
  const { data } = await api.post(`/loa/${id}/validate`)
  return data
}

/**
 * Lock a LOA against any editing. Super-admin only (can_override_lock).
 * The LOA keeps its workflow status — can resume once unlocked.
 */
export const lockLOA = async (id: string): Promise<LOA> => {
  const { data } = await api.post(`/loa/${id}/lock`)
  return data
}

/**
 * Unlock a LOA. Super-admin only (can_override_lock).
 */
export const unlockLOA = async (id: string): Promise<LOA> => {
  const { data } = await api.post(`/loa/${id}/unlock`)
  return data
}

export const deleteLOA = async (id: string) => {
  const { data } = await api.delete(`/loa/${id}`)
  return data
}
// ---- AI suggestions ----
export const getAISuggestion = async (params: {
  activity_type: string
  cluster: string
  category: string
  brand: string
  fy_total: number
  num_doors: number
}): Promise<AISuggestion> => {
  const { data } = await api.post('/loa/ai/suggest', {
    ...params,
    requestor_email: 'system',
  })
  return data
}

export const validateDescription = async (
  description: string,
  activity_type: string,
): Promise<{
  is_valid: boolean
  feedback: string
  suggested_correction?: string
  log_id?: string
}> => {
  const { data } = await api.post('/loa/ai/validate-description', {
    description,
    activity_type,
  })
  return data
}

// ---- File downloads ----
export const downloadPPT = async (id: string) => {
  const response = await api.get(`/loa/${id}/pptx`, { responseType: 'blob' })
  const url = window.URL.createObjectURL(new Blob([response.data]))
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', `LOA_${id}.pptx`)
  document.body.appendChild(link)
  link.click()
  link.remove()
}

export const downloadExcel = async (id: string) => {
  const response = await api.get(`/loa/${id}/excel`, { responseType: 'blob' })
  const url = window.URL.createObjectURL(new Blob([response.data]))
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', `LOA_${id}.xlsx`)
  document.body.appendChild(link)
  link.click()
  link.remove()
}

// ---- Photos ----
export const uploadPhoto = async (loaId: string, file: File) => {
  const formData = new FormData()
  formData.append('file', file)
  const { data } = await api.post(`/loa/${loaId}/photos`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export const deletePhoto = async (loaId: string, index: number) => {
  const { data } = await api.delete(`/loa/${loaId}/photos/${index}`)
  return data
}

// ═══════════════════════════════════════════════════════════════════════
// SPRINT 2 — Permissions API
// ═══════════════════════════════════════════════════════════════════════

/**
 * Get the current user's permissions on a specific LOA.
 * Endpoint: GET /permissions/loa/{loa_id}
 */
export async function getMyPermissionsOnLOA(loaId: string) {
  const response = await api.get(`/permissions/loa/${loaId}`)
  return response.data
}

/**
 * Get the current user's role info.
 * Endpoint: GET /permissions/my-role
 */
export async function getMyRole() {
  const response = await api.get('/permissions/my-role')
  return response.data
}
