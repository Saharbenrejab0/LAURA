/**
 * Shared money formatting. Uses a real € (U+20AC).
 *
 * The old inline formatEuros in PreviewModal.tsx had a mojibake bug — the euro
 * symbol was saved in a non-UTF-8 encoding and rendered as "â‚¬". This is the
 * single clean version; import it everywhere instead of re-declaring.
 */

export function formatEuros(n: number | null | undefined): string {
  if (!n) return '€0'
  if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `€${Math.round(n / 1_000)}k`
  return `€${n}`
}

/** Full precision, for table cells that shouldn't round to k/M. */
export function formatEurosExact(n: number | null | undefined): string {
  if (n == null) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n)
}

/**
 * Format one Excel cell by its column type. Empty values → "—" (present but
 * blank, matching the export). Keeps the on-screen row faithful to the file.
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
      return typeof value === 'number' ? new Intl.NumberFormat('en-US').format(value) : String(value)
    case 'percent':
      return typeof value === 'number' ? `${(value * 100).toFixed(0)}%` : String(value)
    case 'date':
      return String(value)
    default:
      return String(value)
  }
}
