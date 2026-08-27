/**
 * Shared list ordering — LAURA frontend.
 *
 * Mirror of `backend/api/ordering.py`. The backend already returns every list
 * newest-first, so this module exists for two jobs only:
 *
 *   1. Guarantee the order survives client-side merges, groupings and
 *      re-shapes that would otherwise scramble it.
 *   2. Give components ONE function to call, so no component invents its own
 *      `.sort((a,b) => ...)` on a creation date again.
 *
 * Apply it in `lib/*-api.ts` — the data layer — not inside components. A
 * component that re-sorts what the API ordered is the bug this replaces.
 */

/** Field names that mean "when did this come into existence", in priority order. */
const CREATED_KEYS = [
  'created_at', 'createdAt',
  'imported_at', 'importedAt',
  'submitted_at', 'submittedAt',
  'sent_at', 'sentAt',
  'startDate', 'start_date',
] as const

function createdValue(row: any): number | null {
  if (!row || typeof row !== 'object') return null
  for (const k of CREATED_KEYS) {
    const v = row[k]
    if (v == null || v === '') continue
    const t = v instanceof Date ? v.getTime() : Date.parse(String(v))
    if (!Number.isNaN(t)) return t
  }
  return null
}

/**
 * Newest first. Rows with no usable date sink to the bottom rather than
 * floating to the top on a NaN comparison.
 *
 * Non-mutating — returns a new array, so it is safe on props and on state.
 */
export function newestFirst<T>(rows: readonly T[] | null | undefined): T[] {
  if (!Array.isArray(rows)) return []
  return [...rows].sort((a, b) => {
    const ta = createdValue(a)
    const tb = createdValue(b)
    if (ta === tb) return 0
    if (ta === null) return 1
    if (tb === null) return -1
    return tb - ta
  })
}

/**
 * Same rule, explicit key — for rows whose date field isn't in CREATED_KEYS.
 */
export function newestFirstBy<T>(rows: readonly T[] | null | undefined, key: keyof T): T[] {
  if (!Array.isArray(rows)) return []
  return [...rows].sort((a, b) => {
    const pa = a?.[key], pb = b?.[key]
    const ta = pa == null ? NaN : Date.parse(String(pa))
    const tb = pb == null ? NaN : Date.parse(String(pb))
    const na = Number.isNaN(ta), nb = Number.isNaN(tb)
    if (na && nb) return 0
    if (na) return 1
    if (nb) return -1
    return tb - ta
  })
}
