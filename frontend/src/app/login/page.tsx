'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { login } from '@/lib/api'
import { ThemeToggle } from '@/components/ThemeProvider'

const QUICK_LOGINS = [
  { email: 'marketer@essilor.com',  label: 'Test Marketer', role: 'Editor · FRANCE' },
  { email: 'vanessa@essilor.com',   label: 'Vanessa S.',    role: 'Approver' },
  { email: 'thibault@essilor.com',  label: 'Thibault dB.',  role: 'Finance' },
  { email: 'admin@aitomarket.com',  label: 'Admin',         role: 'Admin' },
]

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !password) return
    setLoading(true)
    setError('')
    try {
      await login(email, password)
      router.push('/')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Incorrect email or password')
    } finally {
      setLoading(false)
    }
  }

  function quickLogin(em: string) {
    setEmail(em)
    setPassword('laura2026')
    setError('')
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-base)' }}>

      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold"
            style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}>
            L
          </div>
          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>LAURA</span>
        </div>
        <ThemeToggle />
      </div>

      {/* Center content */}
      <div className="flex-1 flex items-center justify-center px-4 pb-16">
        <div className="w-full max-w-[340px]">

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-semibold tracking-tight mb-1.5"
              style={{ color: 'var(--text-primary)' }}>
              Sign in
            </h1>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              LOA Automation & Review Agent
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-3">
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                className="input"
                placeholder="name@essilor.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
                autoFocus
              />
            </div>

            <div>
              <label className="label">Password</label>
              <input
                type="password"
                className="input"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>

            {error && (
              <p className="text-xs py-2 px-3 rounded-lg"
                style={{ background: 'var(--red-bg)', color: 'var(--red-text)', border: '1px solid var(--red-border)' }}>
                {error}
              </p>
            )}

            <button type="submit" disabled={loading || !email || !password}
              className="btn-primary w-full h-10 mt-1">
              {loading ? (
                <span className="w-4 h-4 border-2 rounded-full animate-spin"
                  style={{ borderColor: 'var(--accent-text)', borderTopColor: 'transparent' }} />
              ) : 'Continue'}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <hr className="flex-1 divider" />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>POC quick access</span>
            <hr className="flex-1 divider" />
          </div>

          {/* Quick login */}
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            {QUICK_LOGINS.map((u, i) => (
              <button key={u.email} onClick={() => quickLogin(u.email)}
                className="w-full flex items-center justify-between px-4 py-3 text-left transition-colors"
                style={{
                  background: email === u.email ? 'var(--bg-elevated)' : 'var(--bg-surface)',
                  borderBottom: i < QUICK_LOGINS.length - 1 ? '1px solid var(--border)' : 'none',
                }}>
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{u.label}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{u.email}</p>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full"
                  style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                  {u.role}
                </span>
              </button>
            ))}
          </div>

          <p className="text-center text-xs mt-6" style={{ color: 'var(--text-muted)' }}>
            All POC passwords: <code className="font-mono">laura2026</code>
          </p>

        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-6 py-4 text-xs" style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}>
        <span>AI to Market × EssilorLuxottica EMEA</span>
        <span>Strictly confidential</span>
      </div>
    </div>
  )
}
