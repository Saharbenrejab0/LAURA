'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'

// ── Auto-save hook ─────────────────────────────────────────────────────────
export function useAutoSave(
  data: Record<string, any>,
  key: string,
  intervalMs = 30000
) {
  useEffect(() => {
    const id = setInterval(() => {
      if (typeof window !== 'undefined') {
        localStorage.setItem(`laura_draft_${key}`, JSON.stringify({
          data,
          savedAt: new Date().toISOString(),
        }))
      }
    }, intervalMs)
    return () => clearInterval(id)
  }, [data, key, intervalMs])
}

export function loadDraft(key: string): { data: Record<string, any>; savedAt: string } | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(`laura_draft_${key}`)
  return raw ? JSON.parse(raw) : null
}

export function clearDraft(key: string) {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(`laura_draft_${key}`)
  }
}

// ── Scroll to first error ──────────────────────────────────────────────────
export function scrollToFirstError(errors: Record<string, string>) {
  const firstKey = Object.keys(errors)[0]
  if (!firstKey) return
  const el = document.querySelector(`[data-field="${firstKey}"]`)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    // Shake animation
    el.classList.add('field-error-shake')
    setTimeout(() => el.classList.remove('field-error-shake'), 600)
  }
}

// ── Leave confirmation ─────────────────────────────────────────────────────
export function useLeaveConfirmation(isDirty: boolean) {
  useEffect(() => {
    if (!isDirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])
}
