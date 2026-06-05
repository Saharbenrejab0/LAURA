'use client'

import { createContext, useContext, useState, useCallback } from 'react'

type ToastType = 'success' | 'error' | 'info' | 'warning'

interface Toast {
  id: string
  type: ToastType
  message: string
}

interface ToastContextType {
  toast: (message: string, type?: ToastType) => void
  success: (message: string) => void
  error: (message: string) => void
  info: (message: string) => void
}

const ToastContext = createContext<ToastContextType>({
  toast: () => {},
  success: () => {},
  error: () => {},
  info: () => {},
})

export function useToast() {
  return useContext(ToastContext)
}

const ICONS: Record<ToastType, string> = {
  success: '✓',
  error:   '✕',
  info:    'ℹ',
  warning: '⚠',
}

const STYLES: Record<ToastType, { bg: string; border: string; color: string }> = {
  success: { bg: 'var(--green-bg)',   border: 'var(--green-border)',  color: 'var(--green-text)' },
  error:   { bg: 'var(--red-bg)',     border: 'var(--red-border)',    color: 'var(--red-text)' },
  info:    { bg: 'var(--blue-bg)',    border: 'var(--blue-border)',   color: 'var(--blue-text)' },
  warning: { bg: 'var(--amber-bg)',   border: 'var(--amber-border)',  color: 'var(--amber-text)' },
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts(t => t.filter(x => x.id !== id))
  }, [])

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).slice(2)
    setToasts(t => [...t, { id, type, message }])
    setTimeout(() => dismiss(id), 4000)
  }, [dismiss])

  const success = useCallback((msg: string) => toast(msg, 'success'), [toast])
  const error   = useCallback((msg: string) => toast(msg, 'error'),   [toast])
  const info    = useCallback((msg: string) => toast(msg, 'info'),    [toast])

  return (
    <ToastContext.Provider value={{ toast, success, error, info }}>
      {children}

      {/* Toast container — bottom right */}
      <div style={{
        position: 'fixed', bottom: '24px', right: '24px',
        display: 'flex', flexDirection: 'column', gap: '8px',
        zIndex: 9999, pointerEvents: 'none',
      }}>
        {toasts.map(t => {
          const s = STYLES[t.type]
          return (
            <div key={t.id}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 14px', borderRadius: '10px',
                background: s.bg, border: `1px solid ${s.border}`,
                color: s.color, fontSize: '13px', fontWeight: 500,
                boxShadow: 'var(--shadow-md)',
                animation: 'toastIn 0.2s ease',
                pointerEvents: 'all', minWidth: '240px', maxWidth: '360px',
              }}>
              <span style={{ fontSize: '14px', flexShrink: 0 }}>{ICONS[t.type]}</span>
              <span style={{ flex: 1, lineHeight: 1.4 }}>{t.message}</span>
              <button onClick={() => dismiss(t.id)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: s.color, opacity: 0.6, fontSize: '16px',
                  padding: '0 2px', flexShrink: 0,
                }}>×</button>
            </div>
          )
        })}
      </div>

      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateY(8px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </ToastContext.Provider>
  )
}
