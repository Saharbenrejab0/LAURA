// ============================================================
// LAURA — Historical Campaigns API client
// ============================================================

import axios from 'axios'
import type { LOA } from '@/types/loa'
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

export interface ImportBatch {
  id: string
  label: string
  importedAt: string | null
  importedBy: string | null
  rowCount: number
  sourceFileName: string | null
  notes: string | null
}

/** A historical LOA carries its import provenance instead of a verdict. */
export type HistoricalRow = LOA & {
  importBatchId: string | null
  importBatchLabel: string
  importedAt: string | null
}

export interface HistoricalDeckResponse {
  cycle: {
    id: string
    name: string
    cycleType: string
    status: string
    startDate: string | null
    endDate: string | null
    isActive: boolean
    isClosed: boolean
    closedAt: string | null
    closedBy: string | null
  }
  loas: LOA[]
  titleConfig: null
  titlePhoto: null
  overviewPhotos: Record<string, never>
  totalBudget: number
}

export async function fetchImportBatches(): Promise<ImportBatch[]> {
  const { data } = await client.get('/historical/import-batches')
  return newestFirst<ImportBatch>(data)
}

export async function fetchHistoricalDeck(batchId?: string): Promise<HistoricalDeckResponse> {
  const { data } = await client.get('/historical/deck', {
    params: batchId ? { import_batch_id: batchId } : undefined,
  })
  return data
}

export async function fetchHistoricalGrid(batchId?: string): Promise<{
  total: number
  totalBudget: number
  rows: HistoricalRow[]
}> {
  const { data } = await client.get('/historical/excel', {
    params: batchId ? { import_batch_id: batchId } : undefined,
  })
  return { ...data, rows: newestFirst<HistoricalRow>(data?.rows) }
}

export async function downloadHistoricalExcel(batchId: string | undefined, filename: string): Promise<void> {
  const { data } = await client.get('/historical/export', {
    params: batchId ? { import_batch_id: batchId } : undefined,
    responseType: 'blob',
  })
  const url = URL.createObjectURL(data as Blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
