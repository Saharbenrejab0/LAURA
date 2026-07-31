// ============================================================
// LAURA â€” API client
// All calls to the FastAPI backend go through here
// ============================================================

import axios from 'axios'
import type { LOA, LOAFormValues, AISuggestion } from '@/types/loa'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

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
      if (!window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/welcome')) {
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

// â”€â”€ DEPRECATED â€” /approve does not exist in backend Sprint 2.5 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Kept for backward compatibility. New code should use validateWorkflowStep.
export const approveLOA = async (id: string, comment?: string): Promise<LOA> => {
  const { data } = await api.post(`/loa/${id}/approve`, { comment })
  return data
}

export const rejectLOA = async (id: string, reason: string): Promise<LOA> => {
  const { data } = await api.post(`/loa/${id}/reject`, null, { params: { reason } })
  return data
}

// â”€â”€ Workflow â€” Sprint 2.5 endpoints â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Advance a LOA one step in the approval workflow.
 * Backend smart-dispatches: 'validate' permission for CMO/CFO/CEO steps,
 * 'advance_phase' for EMEA orchestration steps.
 * Frontend just calls this â€” backend decides what's allowed.
 */
export const validateWorkflowStep = async (id: string): Promise<LOA> => {
  const { data } = await api.post(`/loa/${id}/validate`)
  return data
}

/**
 * Lock a LOA against any editing. Super-admin only (can_override_lock).
 * The LOA keeps its workflow status â€” can resume once unlocked.
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
  category: string[]
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



export async function downloadExcel(loaId: string) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('laura_token') : null
  const res = await fetch(`${API_BASE}/loa/${loaId}/excel`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) throw new Error('Excel download failed')
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `LOA_${loaId}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
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

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SPRINT 2 â€” Permissions API
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SPRINT 5 â€” Comments API
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export interface CommentItem {
  anchor_x?: number | null
  anchor_y?: number | null
  anchor_type?: string
  field_key?: string | null
  severity?: string
  id: string
  loa_id: string
  author_email: string
  author_name: string
  author_role: string
  section: string
  content: string
  written_at_status: string
  resolved: boolean
  resolved_at: string | null
  resolved_by: string | null
  created_at: string
}

export interface MyCommentsSummary {
  total_comments: number
  loas: {
    loa_id: string
    count: number
    last_section: string
    last_content: string
    last_at: string
  }[]
}

/**
 * Create a comment on a specific section of a LOA.
 */
export interface CreateCommentOpts {
  anchor_type?: 'loa' | 'field'
  field_key?: string | null
  anchor_x?: number | null
  anchor_y?: number | null
  severity?: 'note' | 'suggestion' | 'blocking'
}

export async function createComment(
  loaId: string,
  section: string,
  content: string,
  opts: CreateCommentOpts = {},
): Promise<CommentItem> {
  const { data } = await api.post(`/loa/${loaId}/comments`, {
    section,
    content,
    anchor_type: opts.anchor_type ?? (opts.field_key ? 'field' : 'loa'),
    field_key: opts.field_key,
    anchor_x: opts.anchor_x,
    anchor_y: opts.anchor_y,
    severity: opts.severity ?? 'note',
  })
  return data
}

/**
 * List all comments on a LOA. Optionally filter by section.
 */
export async function listComments(
  loaId: string,
  section?: string,
): Promise<CommentItem[]> {
  const { data } = await api.get(`/loa/${loaId}/comments`, {
    params: section ? { section } : {},
  })
  return data
}

/**
 * Mark a comment as resolved. Only the current step's reviewer can do this.
 */
export async function resolveComment(commentId: string): Promise<CommentItem> {
  const { data } = await api.patch(`/comments/${commentId}/resolve`)
  return data
}

/**
 * Get a summary of all comments authored by the current user â€” used
 * to power the "My comments" filter on the tracker.
 */
export async function getMyComments(): Promise<MyCommentsSummary> {
  const { data } = await api.get('/comments/mine')
  return data
}

export default api

