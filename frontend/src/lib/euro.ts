/**
 * Canonical European euro formatting for EssilorLuxottica LAURA.
 *
 * Convention (matching the source EMEA PPT decks):
 *   "." = thousands separator   → 150.000
 *   "," = decimal mark          → 34,1 M€
 *
 * Import from here everywhere — do NOT use ad-hoc toLocaleString('en') or
 * Intl.NumberFormat('en-US') for euro amounts; that produces English-format
 * commas (150,000) which is wrong for this app.
 *
 * Note: _to_number() in the backend parses "1.250.000" on import (input side).
 * This file is the output side — keep them consistent.
 */

/** Round and format as integer with European thousands: 150000 → "150.000" */
export function formatAmount(n: number): string {
  return Math.round(n || 0).toLocaleString('de-DE')
}

/** Full euro amount: 150000 → "€ 150.000" */
export function formatEuro(n: number): string {
  return `€ ${formatAmount(n)}`
}

/**
 * Compact / headline amount.
 * 34100000 → "34,1 M€"  ·  9000 → "9 K€"  ·  500 → "500 €"
 */
export function formatBudget(n: number): string {
  const v = n || 0
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace('.', ',')} M€`
  if (v >= 1_000) return `${Math.round(v / 1_000)} K€`
  return `${Math.round(v)} €`
}

/**
 * Pivot-table thousands value (no unit, for columns labelled "€ 000").
 * 150000 → "150"  ·  1250000 → "1.250"  ·  0 → ""
 */
export function formatThousands(n: number): string {
  if (!n || n === 0) return ''
  const k = Math.round(n / 1_000)
  if (k === 0) return ''
  return k.toLocaleString('de-DE')
}

/** Compact without currency unit: 1250000 → "1,25 M"  ·  840000 → "840 K" */
export function formatCompact(n: number): string {
  const v = n || 0
  if (v >= 1_000_000) {
    const m = (v / 1_000_000).toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
    return `${m.replace('.', ',')} M`
  }
  if (v >= 1_000) return `${Math.round(v / 1_000)} K`
  return String(Math.round(v))
}

/**
 * Normalize a user-typed budget string to a number for search / filter comparison.
 * Accepts European format ("150.000", "1.250.000,50") and plain integers ("150000").
 * Returns 0 for blank / unparseable input.
 *
 * @example
 *   parseEuroInput("150.000")   → 150000
 *   parseEuroInput("150000")    → 150000
 *   parseEuroInput("34,1")      → 34.1   (treated as decimal)
 *   parseEuroInput("€ 150.000") → 150000
 */
export function parseEuroInput(s: string): number {
  const stripped = (s || '').replace(/[€\s]/g, '').trim()
  if (!stripped) return 0
  // Remove dot-thousands separators, then replace comma decimal mark with dot.
  const normalized = stripped.replace(/\./g, '').replace(',', '.')
  const val = parseFloat(normalized)
  return isNaN(val) ? 0 : val
}
