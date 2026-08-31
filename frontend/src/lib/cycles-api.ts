// ============================================================
// LAURA — Cycles API client
// ============================================================

import axios from 'axios'
import { newestFirst } from './sort'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

function authHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  const token = localStorage.getItem('laura_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

const client = axios.create({ baseURL: API_BASE })
client.interceptors.request.use(cfg => {
  Object.assign(cfg.headers, authHeaders())
  return cfg
})

export type CycleStatus = 'draft' | 'open' | 'under_review' | 'closed'
export type CycleType = 'normal' | 'emergency'

export interface Cycle {
  id: string
  /** Stable human-facing reference code, e.g. "2026-Q3-N1". Null for cycles
   *  created before the cycle_code_column migration ran. */
  code: string | null
  name: string
  cycleType: CycleType
  status: CycleStatus
  isActive: boolean
  isClosed: boolean
  startDate: string | null
  endDate: string | null
  /** Days until end_date for open cycles; null for closed/draft. */
  daysRemaining: number | null
  createdBy: string | null
  createdAt: string | null
  closedAt: string | null
  closedBy: string | null
  /** Throwaway cycle — the only kind an admin may delete. */
  isTest: boolean
  /** Why this cycle ran off-schedule. Emergency cycles only.
   *  Optional: a backend older than the cycle-CRUD work omits it entirely. */
  emergencyReason?: string | null
  /** Emergency cycles: the only people who can see the cycle or its LOAs.
   *  Optional for the same reason — never dereference without a `?? []`. */
  authorizedEmails?: string[]
  totalLoas: number
  totalBudget: number
  approved: number
  rejected: number
  /** Top 5 brand pills (normalized), may include "+N more" as last entry. */
  brandsInScope: string[]
  /** Distinct cluster names present in this cycle's LOAs. */
  clustersInScope: string[]
  /** LOAs in this cycle where the current user has cast a verdict. */
  reviewedByCurrentUser: number
  exportAvailable?: boolean
}

export interface CycleCloseResult {
  id: string
  name: string
  status: CycleStatus
  closedAt: string
  closedBy: string
  results: { totalLoas: number; totalBudget: number; approved: number; rejected: number }
  excelGenerated: boolean
  notification: { delivered: boolean; recipients: number; error: string | null }
}

export async function fetchCycles(params?: {
  status?: CycleStatus
  cycleType?: CycleType
}): Promise<Cycle[]> {
  const { data } = await client.get('/cycles', {
    params: {
      status: params?.status,
      cycle_type: params?.cycleType,
    },
  })
  return newestFirst<Cycle>(data)
}

export interface CreateCyclePayload {
  name: string
  cycle_type: CycleType
  /** Required for normal cycles. Emergency cycles have no fixed window — an
   *  admin opens and closes them by hand — so both are omitted for those. */
  start_date?: string
  end_date?: string
  is_test?: boolean
  /** Emergency only — both are rejected by the API if missing. */
  reason?: string
  authorized_emails?: string[]
}

/** Create a cycle. It always lands in `draft`; opening it is a separate step. */
export async function createCycle(payload: CreateCyclePayload): Promise<Cycle> {
  const { data } = await client.post('/cycles', payload)
  return data
}

export async function fetchCycle(cycleId: string): Promise<Cycle> {
  const { data } = await client.get(`/cycles/${cycleId}`)
  return data
}

/**
 * Move a cycle along its lifecycle. Going backwards (reopening) needs
 * `confirmReopen` — the API rejects it otherwise, so it cannot happen by slip.
 */
export async function setCycleStatus(
  cycleId: string, status: CycleStatus, confirmReopen = false,
): Promise<Cycle> {
  const { data } = await client.post(`/cycles/${cycleId}/status`, {
    status, confirm_reopen: confirmReopen,
  })
  return data
}

export interface UpdateCyclePayload {
  name?: string
  /** Only accepted while the cycle is draft or open — extending a deadline. */
  end_date?: string
  /** Emergency only. Takes effect immediately, both granting and revoking. */
  authorized_emails?: string[]
  reason?: string
}

export async function updateCycle(cycleId: string, payload: UpdateCyclePayload): Promise<Cycle> {
  const { data } = await client.patch(`/cycles/${cycleId}`, payload)
  return data
}

export async function closeCycle(cycleId: string): Promise<CycleCloseResult> {
  const { data } = await client.post(`/cycles/${cycleId}/close`)
  return data
}

export interface CycleDeleteResult {
  deleted: boolean
  cycleId: string
  cycleName: string
  loasDeleted: number
  rowsDeleted: Record<string, number>
}

/**
 * Permanently delete a cycle. The backend refuses unless the cycle is flagged
 * is_test or holds zero LOAs, so this can never wipe out live submissions.
 */
export async function deleteCycle(cycleId: string): Promise<CycleDeleteResult> {
  const { data } = await client.delete(`/cycles/${cycleId}`)
  return data
}

/** Prior name, kept so the test-cycle banner and grid keep working unchanged. */
export const deleteTestCycle = deleteCycle

/** Absolute URL for the workbook download — used as a plain link href. */
export function cycleExcelUrl(cycleId: string): string {
  return `${API_BASE}/cycles/${cycleId}/export/excel`
}

/**
 * Download the cycle workbook. Goes through axios rather than a bare link so
 * the Authorization header is attached.
 */
export async function downloadCycleExcel(cycleId: string, filename: string): Promise<void> {
  const { data } = await client.get(`/cycles/${cycleId}/export/excel`, { responseType: 'blob' })
  const url = URL.createObjectURL(data as Blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
