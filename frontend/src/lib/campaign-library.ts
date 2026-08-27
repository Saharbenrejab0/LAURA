/**
 * Campaign Library — one surface, two stores that never share a query.
 *
 * LAURA has two kinds of past work and they are not the same thing:
 *
 *   Completed LAURA cycles   closed review periods. The SAME rows that were
 *                            live, still carrying their cycle, their final
 *                            status and their full approval history. They went
 *                            through nine gates.
 *   Imported history         the client's pre-LAURA spreadsheets. No cycle, no
 *                            workflow, provenance in `import_batch`.
 *
 * They are merged in the UI and NOWHERE else. Each tab calls its own endpoint:
 * closed cycles come from `/cycles?status=closed` + `/cycles/{id}/loas`,
 * imported history from `/historical/excel`. There is deliberately no UNION and
 * no shared query — if one grid ever shows a mixed `source`, the separation has
 * been lost. `loas.source` classifies, and the DB constraint
 * `ck_loa_live_has_cycle` makes the two mutually exclusive at the storage layer.
 *
 * Replaces two nav entries that both lied: "Past Campaigns" was a template
 * picker whose contents were 99.4% imported history, and "Historical
 * Campaigns" sat beside it showing the same rows through a correct filter.
 */

import axios from 'axios'
import type { LOA } from '@/types/loa'
import { activityLabel } from '@/types/loa'
import { fetchCycles, type Cycle } from './cycles-api'
import { fetchHistoricalGrid, fetchImportBatches, type ImportBatch, type HistoricalRow } from './historical-api'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

const client = axios.create({ baseURL: API_BASE })
client.interceptors.request.use(cfg => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('laura_token')
    if (token) Object.assign(cfg.headers, { Authorization: `Bearer ${token}` })
  }
  return cfg
})

export type { Cycle, ImportBatch, HistoricalRow }

// ════════════════════════════════════════════════════════════════════════
//  Display title
// ════════════════════════════════════════════════════════════════════════

/**
 * A name a person can read, never the raw database id.
 *
 * Historical rows are sparse — 2,547 of them have no `loa_number` at all — so
 * this degrades in steps rather than falling straight through to an id. The id
 * is internal and only surfaces when there is genuinely nothing else.
 */
export function campaignTitle(loa: Partial<LOA> & { display_title?: string; title?: string; id?: string }): string {
  const explicit = (loa.display_title || loa.title || '').trim()
  if (explicit && !explicit.startsWith('LAURA-')) return explicit

  const brand = (loa.brand || '').trim()
  const activity = activityLabel(loa.activity_type as string)

  if (brand && activity) return `${brand} · ${activity}`
  if (brand) return brand
  if (activity) return activity
  if (loa.loa_number) return `Campaign ${loa.loa_number}`
  return `Historical Campaign #${String(loa.id || '').slice(0, 8)}`
}

/** The grey line under the title: country · activity · period · budget. */
export function campaignSubtitle(
  loa: Partial<LOA> & { period?: Period | null },
  fmt: (n: number) => string,
): string {
  const bits: string[] = []
  if (loa.country) bits.push(loa.country)
  const activity = activityLabel(loa.activity_type as string)
  // Only repeat the activity here when the title did not already use it.
  if (activity && !loa.brand) bits.push(activity)
  const p = periodLabel(loa.period)
  if (p) bits.push(p)
  const total = loa.fy_2026_total || loa.fy_2025_total || 0
  if (total) bits.push(fmt(total))
  return bits.join(' · ')
}

// ════════════════════════════════════════════════════════════════════════
//  Year / Quarter
// ════════════════════════════════════════════════════════════════════════

export interface Period {
  year: number | null
  quarter: string | null
  /** Which field the period came from: start_date | budget | fy_total | null. */
  source: string | null
}

export const UNDATED = 'Undated'

/**
 * Period for one historical row, mirroring `_period_of` in templates.py.
 *
 * `loas.start_date` is `String(50)` free text rather than a date column, so this
 * is a parse and not a read. Measured over all 2,657 imported rows: 51% resolve
 * from a real date, 16% from which quarter carries budget, 19% year-only from a
 * fiscal total, and 12% have nothing usable and group under "Undated".
 *
 * It deliberately does NOT fall back to `created_at` — on an imported row that
 * is the day the ETL ran, which would file a 2024 campaign under 2026 and make
 * the grouping confidently wrong.
 */
export function periodOf(row: { start_date?: string | null; period?: Period | null } & Record<string, any>): Period {
  if (row.period && (row.period.year || row.period.quarter)) return row.period

  const raw = String(row.start_date || '').trim().replace(/[.\s]+$/, '')
  if (raw) {
    const iso = raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/)
    if (iso) return { year: +iso[1], quarter: quarterOfMonth(+iso[2]), source: 'start_date' }
    const dmy = raw.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/)
    if (dmy) return { year: +dmy[3], quarter: quarterOfMonth(+dmy[2]), source: 'start_date' }
    const bare = raw.match(/^(\d{4})$/)
    if (bare && +bare[1] >= 2000 && +bare[1] <= 2100) {
      return { year: +bare[1], quarter: null, source: 'start_date' }
    }
  }

  for (const [field, year, quarter] of [
    ['q4_2025', 2025, 'Q4'], ['q1_2026', 2026, 'Q1'], ['q2_2026', 2026, 'Q2'],
    ['q3_2026', 2026, 'Q3'], ['q4_2026', 2026, 'Q4'],
  ] as [string, number, string][]) {
    if ((row[field] || 0) > 0) return { year, quarter, source: 'budget' }
  }
  if ((row.fy_2025_total || 0) > 0) return { year: 2025, quarter: null, source: 'fy_total' }
  if ((row.fy_2026_total || 0) > 0) return { year: 2026, quarter: null, source: 'fy_total' }

  return { year: null, quarter: null, source: null }
}

function quarterOfMonth(m: number): string | null {
  if (m < 1 || m > 12) return null
  return `Q${Math.floor((m - 1) / 3) + 1}`
}

export function periodLabel(p: Period | null | undefined): string {
  if (!p || !p.year) return ''
  return p.quarter ? `${p.quarter} ${p.year}` : String(p.year)
}

export interface YearGroup {
  year: number | null
  label: string
  total: number
  count: number
  quarters: { quarter: string | null; label: string; rows: HistoricalRow[]; total: number }[]
}

/** Group imported rows Year → Quarter, newest year first, Q1→Q4 inside. */
export function groupByYearQuarter(rows: HistoricalRow[]): YearGroup[] {
  const byYear = new Map<string, HistoricalRow[]>()
  for (const r of rows) {
    const p = periodOf(r)
    const key = p.year == null ? UNDATED : String(p.year)
    const bucket = byYear.get(key)
    if (bucket) bucket.push(r)
    else byYear.set(key, [r])
  }

  const years = [...byYear.keys()].sort((a, b) => {
    if (a === UNDATED) return 1        // Undated always last
    if (b === UNDATED) return -1
    return Number(b) - Number(a)       // newest year first
  })

  return years.map(yk => {
    const yearRows = byYear.get(yk)!
    const byQ = new Map<string, HistoricalRow[]>()
    for (const r of yearRows) {
      const q = periodOf(r).quarter ?? '—'
      const bucket = byQ.get(q)
      if (bucket) bucket.push(r)
      else byQ.set(q, [r])
    }
    const qKeys = [...byQ.keys()].sort((a, b) => {
      if (a === '—') return 1
      if (b === '—') return -1
      return a.localeCompare(b)
    })
    return {
      year: yk === UNDATED ? null : Number(yk),
      label: yk === UNDATED ? UNDATED : yk,
      count: yearRows.length,
      total: yearRows.reduce((s, r) => s + (r.fy_2026_total || r.fy_2025_total || 0), 0),
      quarters: qKeys.map(q => {
        const qr = byQ.get(q)!
        return {
          quarter: q === '—' ? null : q,
          label: q === '—' ? 'Quarter unknown' : q,
          rows: qr,
          total: qr.reduce((s, r) => s + (r.fy_2026_total || r.fy_2025_total || 0), 0),
        }
      }),
    }
  })
}

// ════════════════════════════════════════════════════════════════════════
//  Search — one predicate, applied inside each tab, never across them
// ════════════════════════════════════════════════════════════════════════

/**
 * Fields the library searches. `source_file` and the batch label are admin-only
 * — a marketer has no use for the name of a spreadsheet they never saw.
 */
export function matchesSearch(
  row: Partial<LOA> & Record<string, any>,
  query: string,
  isAdmin: boolean,
): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true

  const p = periodOf(row)
  const haystack: (string | number | null | undefined)[] = [
    row.brand, row.activity_type, activityLabel(row.activity_type as string),
    row.country, row.cluster, row.description, row.detail, row.kpi,
    row.vendor, row.customer, row.cot, row.loa_number, row.legal_entity,
    p.year, p.quarter, periodLabel(p),
    Array.isArray(row.category) ? row.category.join(' ') : row.category,
  ]
  if (isAdmin) haystack.push(row.source_file, row.importBatchLabel, row.batch_name)

  // Budget: a bare number matches within ±10%, so "98000" finds a €98,200 row.
  const asNumber = Number(q.replace(/[^\d]/g, ''))
  if (asNumber > 0) {
    const total = row.fy_2026_total || row.fy_2025_total || 0
    if (total && Math.abs(total - asNumber) / asNumber <= 0.1) return true
  }

  return haystack.some(v => v != null && String(v).toLowerCase().includes(q))
}

// ════════════════════════════════════════════════════════════════════════
//  Fetchers — one per store. Never combined.
// ════════════════════════════════════════════════════════════════════════

export interface CompletedCycle {
  cycle: Cycle
  loas: LOA[]
}

/** Closed cycles only. Empty until a cycle with LOAs is actually closed. */
export async function fetchClosedCycles(): Promise<Cycle[]> {
  return fetchCycles({ status: 'closed' })
}

/** One closed cycle's LOAs — the same rows that were live, fetched on expand. */
export async function fetchCycleLoas(cycleId: string): Promise<LOA[]> {
  const { data } = await client.get(`/cycles/${cycleId}/loas`)
  return Array.isArray(data) ? data : []
}

export { fetchHistoricalGrid, fetchImportBatches }

/** "Use as starting point" — POST /loa/{id}/duplicate. */
export interface DuplicateResult {
  id: string
  loa_draft_id: string
  status: string
  requestor_email: string
  source_id: string
  warnings: {
    field: string
    severity: 'auto_fixed' | 'invalid_cleared' | 'partial_fix' | 'empty_required'
    original?: any
    mapped_to?: any
    message: string
  }[]
  warnings_summary: Record<string, number>
}

export async function useAsStartingPoint(loaId: string): Promise<DuplicateResult> {
  const { data } = await client.post(`/loa/${loaId}/duplicate`)
  return data
}

// ── Carry the duplicate's warnings across the navigation ────────────────────
//
// POST /duplicate returns per-field warnings naming the historical value it
// could not keep ("Cluster 'South Europe' not recognized. Field cleared."). The
// library then navigates to the form, which is a different page and never saw
// that response — so without a handoff the marketer lands on blank required
// fields with no explanation.
//
// sessionStorage rather than a query string: the payload is too big for a URL,
// and it must survive the redirect without ending up in browser history or
// server logs. Read-once — the form clears it so a later manual edit of the
// same draft is not re-annotated as if it were fresh.

const CARRY_KEY = 'laura.library.carried'

export interface CarriedContext {
  sourceTitle: string
  sourceKind: 'completed_cycle' | 'imported_history'
  warnings: DuplicateResult['warnings']
}

export function stashCarriedContext(draftId: string, ctx: CarriedContext): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(`${CARRY_KEY}.${draftId}`, JSON.stringify(ctx))
  } catch {
    // Private mode / quota. The draft is still correct — only the annotations
    // are lost, so this must never block the navigation.
  }
}

export function takeCarriedContext(draftId: string): CarriedContext | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(`${CARRY_KEY}.${draftId}`)
    if (!raw) return null
    sessionStorage.removeItem(`${CARRY_KEY}.${draftId}`)
    return JSON.parse(raw) as CarriedContext
  } catch {
    return null
  }
}

/** Backend warning field names → the form's `fieldKey`s. */
export const WARNING_FIELD_TO_KEY: Record<string, string> = {
  cluster:        'cluster',
  country:        'country',
  activity_type:  'activityType',
  cot:            'cot',
  category:       'category',
  brand:          'brand',
  event_type:     'eventType',
  event_purpose:  'eventPurpose',
  description:    'description',
  detail:         'detail',
  kpi:            'kpi',
}
