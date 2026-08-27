'use client'
/**
 * Remembered per-cycle template choice.
 *
 * "Honour the remembered choice per cycle" means the key is scoped to the cycle
 * id, not global: choosing Deck for the July cycle must not silently answer the
 * question for the next one.
 *
 * Stored in localStorage so it survives a hard reload and a new session, the
 * same durability the theme preference has.
 *
 * The stored value is a `Template` from lib/templates.ts. `resolveFolderOpen()`
 * re-checks it against the role's allowed set before replaying it, so a
 * remembered choice can never route somewhere the guard would refuse.
 */

import { isTemplate, type Template } from '@/lib/templates'

const KEY_PREFIX = 'laura.cycleView.'

/** Legacy values written before templates were named. */
const LEGACY: Record<string, Template> = { both: 'split' }

export function readCycleView(cycleId: string | null | undefined): Template | null {
  if (!cycleId || typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(KEY_PREFIX + cycleId)
    if (!raw) return null
    const v = LEGACY[raw] ?? raw
    return isTemplate(v) ? v : null
  } catch {
    return null
  }
}

export function rememberCycleView(cycleId: string, t: Template): void {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(KEY_PREFIX + cycleId, t) } catch { /* ignore */ }
}

export function forgetCycleView(cycleId: string): void {
  if (typeof window === 'undefined') return
  try { localStorage.removeItem(KEY_PREFIX + cycleId) } catch { /* ignore */ }
}
