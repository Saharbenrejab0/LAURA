/**
 * Shared money formatting.
 *
 * All euro output goes through lib/euro.ts which uses the European convention
 * ("." thousands, "," decimal). This file re-exports the two helpers used by
 * table cells and export views, so callers don't need two import paths.
 */
import { formatBudget, formatEuro } from './euro'
export { parseEuroInput } from './euro'

/** Compact amount for grid cells: "34,1 M€" / "9 K€" / "500 €" */
export function formatEuros(n: number | null | undefined): string {
  return formatBudget(n ?? 0)
}

/** Full precision for table cells that shouldn't round: "€ 150.000" */
export function formatEurosExact(n: number | null | undefined): string {
  if (n == null) return '—'
  return formatEuro(n)
}

/**
 * Format one Excel cell by its column type.
 * Empty values → "—". Keeps the on-screen row faithful to the export file.
 */
import type { ExcelFmt } from './excelColumns'

export function formatCell(value: any, fmt: ExcelFmt): string {
  if (fmt === 'ppt') return value ? 'YES' : 'NO'
  if (value == null || value === '') return '—'
  if (Array.isArray(value)) return value.length ? value.join(', ') : '—'
  switch (fmt) {
    case 'money':
      return typeof value === 'number' ? formatEurosExact(value) : String(value)
    case 'int':
      return typeof value === 'number' ? Math.round(value).toLocaleString('de-DE') : String(value)
    case 'percent':
      return typeof value === 'number' ? `${(value * 100).toFixed(0)}%` : String(value)
    case 'date':
      return String(value)
    default:
      return String(value)
  }
}

/**
 * The metadata line under an LOA's title in the lists.
 *
 * A multi-row LOA has NULL on the parent for whichever axis varies per row, so
 * the count stands in for it:
 *   standard        France · Ray-Ban (RB) · PR
 *   multi_brand     France · 4 brands · Seasonal Visibility
 *   multi_activity  Czech Republic · Nikon (NK) · 3 activity types
 */
export function loaMetaLine(loa: {
  country?: string | null
  cluster?: string | null
  brand?: string | null
  activity_type?: string | null
  loa_type?: string | null
  lines?: unknown[] | null
}): string {
  const where = loa.country || loa.cluster
  const n = loa.lines?.length ?? 0
  const type = loa.loa_type || 'standard'

  const brandPart =
    type === 'multi_brand' ? `${n} ${n === 1 ? 'brand' : 'brands'}` : loa.brand
  const activityPart =
    type === 'multi_activity' ? `${n} ${n === 1 ? 'activity type' : 'activity types'}` : loa.activity_type

  return [where, brandPart, activityPart].filter(Boolean).join(' · ')
}
