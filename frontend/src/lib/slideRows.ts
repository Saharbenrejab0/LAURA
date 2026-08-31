/**
 * Slide table shape — the frontend's one copy of what backend/engines/ppt.py does.
 *
 * The preview and the real deck have to agree, and before this file they did
 * not: PreviewModal drew exactly ONE hardcoded data row with the event column
 * set, whatever the LOA actually was. A two-row multi-brand LOA previewed as a
 * single blank event row, and a standard LOA previewed with "SAP CODE" and
 * "# CUST" columns it does not have.
 *
 * Everything here mirrors a named thing in ppt.py. When ppt.py changes, change
 * this too — the pairs are called out per export. Longer term this belongs on
 * the /reference-data payload so there is one authority instead of two files
 * that agree today.
 */

import { EVENT_ACTIVITY_TYPES, activityLabel, type ActivityType } from '@/types/loa'

/** ppt.py `ROWS_WITH_CONTENT` — rows that fit above the description block. */
export const ROWS_WITH_CONTENT = 3

/** ppt.py `ROWS_TABLE_ONLY` — rows on a continuation slide that carries no content. */
export const ROWS_TABLE_ONLY = 9

/** One row of the slide's table. Mirrors a `loa_line` dict, or the LOA itself. */
export interface SlideRow {
  brand?: string
  activityType?: string
  customer?: string
  vendor?: string
  detail?: string
  numDoors?: number
  q1?: number
  q2?: number
  q3?: number
  q4?: number
}

export function rowTotal(r: SlideRow): number {
  return (r.q1 || 0) + (r.q2 || 0) + (r.q3 || 0) + (r.q4 || 0)
}

/**
 * ppt.py `_paginate_rows`, same algorithm.
 *
 * <= ROWS_WITH_CONTENT   one page: table + description + photos
 * more                   table-only page(s) for the leading rows, then a final
 *                        page with the last ROWS_WITH_CONTENT rows plus content
 *
 * With at most 12 rows the prefix is always 1-9, so a split LOA is exactly
 * two pages.
 */
export function paginateRows<T>(rows: T[]): T[][] {
  const n = rows.length
  if (n <= ROWS_WITH_CONTENT) return [rows]
  const head = rows.slice(0, n - ROWS_WITH_CONTENT)
  const tail = rows.slice(n - ROWS_WITH_CONTENT)
  const pages: T[][] = []
  for (let i = 0; i < head.length; i += ROWS_TABLE_ONLY) {
    pages.push(head.slice(i, i + ROWS_TABLE_ONLY))
  }
  pages.push(tail)
  return pages
}

/** How many slides this LOA becomes. */
export function slidePageCount(rowCount: number): number {
  return paginateRows(new Array(rowCount).fill(0)).length
}

/**
 * Events / Medical Affairs get the event layout.
 *
 * Takes the stored CODE. The check that used to live in these components was
 * `['Events', 'Medical Affairs'].includes(...)` against a column that holds
 * `EVENTS` / `MEDICAL_AFFAIRS`, so it never matched and no LOA ever rendered
 * the event layout.
 */
export function isEventActivity(code: string | null | undefined): boolean {
  return !!code && (EVENT_ACTIVITY_TYPES as string[]).includes(code)
}

/** ppt.py `_standard_columns` headers, in order. */
export const STANDARD_HEADERS = [
  'COUNTRY', 'TYPE / PLANNING', 'CUSTOMER', 'BRAND', 'DETAIL',
  '# DOORS', 'AVG INV / DOOR', 'VENDOR', 'FY-26',
] as const

/** ppt.py `_render_events_table` headers, in order. */
export const EVENT_HEADERS = [
  'SAP EVENT CODE', 'EVENT TYPE', 'BRANDS', 'DESCRIPTION',
  '# CUST', 'AVG INV / CUST', 'VENDOR', 'BUDGET', 'DATE',
] as const

/** Relative column widths, from the inch widths in ppt.py. */
export const STANDARD_WIDTHS = '0.85fr 1.55fr 1.55fr 1.55fr 1.5fr 0.7fr 1.05fr 1.2fr 0.75fr'
export const EVENT_WIDTHS    = '1.4fr 1.1fr 1.3fr 2.4fr 0.65fr 1fr 1.25fr 0.9fr 1.43fr'

function clip(s: string | null | undefined, n: number): string {
  if (!s) return '—'
  return s.length > n ? s.slice(0, n) + '…' : s
}

/** Shared values that come from the parent LOA, never from a row. */
export interface SlideShared {
  country?: string
  activityType?: string
  brand?: string
  detail?: string
  customer?: string
  vendor?: string
  numDoors?: number
  /** Events only. */
  sapEventCode?: string
  eventType?: string
  description?: string
  numCustomers?: number
  startDate?: string
  fyTotal?: number
}

/**
 * One table row's cells, formatted.
 *
 * `row` supplies the per-row values; anything shared (country, and on a
 * standard LOA the activity or the brand depending on which axis the rows
 * carry) falls back to the parent — the same split ppt.py makes.
 */
export function standardCells(
  row: SlideRow,
  shared: SlideShared,
  fmt: (n: number) => string,
): string[] {
  const total = rowTotal(row)
  const doors = row.numDoors || 0
  const activity = row.activityType || shared.activityType || ''
  return [
    shared.country || '—',
    activity ? activityLabel(activity as ActivityType) : '—',
    clip(row.customer ?? shared.customer, 22),
    clip(row.brand ?? shared.brand, 20),
    clip(row.detail ?? shared.detail, 24),
    doors ? String(doors) : '—',
    doors && total ? fmt(Math.round(total / doors)) : '—',
    clip(row.vendor ?? shared.vendor, 18),
    total ? fmt(total) : '—',
  ]
}

/**
 * The event table's single row.
 *
 * Events do not paginate: ppt.py's `_render_events_layout` does `del rows` and
 * reads the parent LOA, because the event columns (SAP code, brand split,
 * # customers) are LOA-level, not row-level.
 */
export function eventCells(shared: SlideShared, fmt: (n: number) => string): string[] {
  const cust = shared.numCustomers || 0
  const total = shared.fyTotal || 0
  return [
    shared.sapEventCode || 'TBC',
    clip(shared.eventType, 14),
    clip(shared.brand, 16),
    clip(shared.description, 46),
    cust ? String(cust) : '—',
    cust && total ? fmt(Math.round(total / cust)) : '—',
    clip(shared.vendor, 18),
    total ? fmt(total) : '—',
    shared.startDate || 'FY',
  ]
}

/** TOTAL strip under the last row — ppt.py `_render_table_total`. */
export function totalCells(
  rows: SlideRow[],
  fmt: (n: number) => string,
): string[] {
  const doors = rows.reduce((s, r) => s + (r.numDoors || 0), 0)
  const total = rows.reduce((s, r) => s + rowTotal(r), 0)
  return [
    'TOTAL', '', '', '', '',
    doors ? String(doors) : '',
    '',
    '',
    total ? fmt(total) : '',
  ]
}
