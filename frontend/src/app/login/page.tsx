'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { login } from '@/lib/api'
import { ThemeToggle } from '@/components/ThemeProvider'

// ============================================================
// POC ACCOUNTS — grouped by approval-relay stage
// All share password `laura2026` (set in backend/api/auth.py · seed_users)
// ============================================================

type RelayAccount = {
  email: string
  name: string
  role: string
  scope: string
}

type RelayGroup = {
  id: string
  title: string
  subtitle: string
  accent: { bg: string; border: string; text: string; dot: string }
  accounts: RelayAccount[]
}

const RELAY_GROUPS: RelayGroup[] = [
  {
    id: 'local',
    title: 'Local Markets',
    subtitle: 'Stage 1 — country-level editors and finance advisors',
    accent: {
      bg:     'rgba(16, 185, 129, 0.08)',
      border: 'rgba(16, 185, 129, 0.25)',
      text:   '#059669',
      dot:    '#10b981',
    },
    accounts: [
      { email: 'france-marketer@laura-demo.local', name: 'Camille', role: 'France Marketer', scope: 'FRANCE · editor' },
      { email: 'france-finance@laura-demo.local',  name: 'Julien',  role: 'France Finance',  scope: 'FRANCE · finance commenter' },
    ],
  },
  {
    id: 'regional',
    title: 'Regional / EMEA',
    subtitle: 'Stage 2 — EMEA PS edits, Regional CMO + CFO approve',
    accent: {
      bg:     'rgba(245, 158, 11, 0.08)',
      border: 'rgba(245, 158, 11, 0.25)',
      text:   '#d97706',
      dot:    '#f59e0b',
    },
    accounts: [
      { email: 'emea-editor@laura-demo.local',   name: 'Vanessa',   role: 'EMEA PS Editor', scope: 'all clusters · editor' },
      { email: 'regional-cmo@laura-demo.local',  name: 'Alexandra', role: 'Regional CMO',   scope: 'all · approver (PPT)' },
      { email: 'regional-cfo@laura-demo.local',  name: 'Giulia',    role: 'Regional CFO',   scope: 'all · approver (Excel)' },
    ],
  },
  {
    id: 'global',
    title: 'Global & Corporate',
    subtitle: 'Stage 3 — Global brand + function commenters, Corporate green light',
    accent: {
      bg:     'rgba(59, 130, 246, 0.08)',
      border: 'rgba(59, 130, 246, 0.25)',
      text:   '#2563eb',
      dot:    '#3b82f6',
    },
    accounts: [
      { email: 'global-brand-rayban@laura-demo.local',    name: 'Marco',      role: 'Global Brand · Ray-Ban',   scope: 'brand commenter' },
      { email: 'global-function-events@laura-demo.local', name: 'Sofia',      role: 'Global Function · Events', scope: 'function commenter' },
      { email: 'corporate@laura-demo.local',              name: 'CEO Office', role: 'Corporate',                scope: 'final green light' },
    ],
  },
  {
    id: 'admin',
    title: 'Admin',
    subtitle: 'AI to Market — full access',
    accent: {
      bg:     'rgba(100, 116, 139, 0.08)',
      border: 'rgba(100, 116, 139, 0.25)',
      text:   '#475569',
      dot:    '#64748b',
    },
    accounts: [
      { email: 'admin@aitomarket.com', name: 'AI to Market', role: 'Admin', scope: 'full access' },
    ],
  },
]

// ============================================================

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail]                 = useState('')
  const [password, setPassword]           = useState('')
  const [loading, setLoading]             = useState(false)
  const [error, setError]                 = useState('')
  const [selectedEmail, setSelectedEmail] = useState('')

  async function handleLogin(em?: string, pw?: string) {
    const finalEmail = em || email
    const finalPw    = pw || password
    if (!finalEmail || !finalPw) return
    setLoading(true)
    setError('')
    try {
      await login(finalEmail, finalPw)
      router.push('/')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Incorrect email or password')
    } finally {
      setLoading(false)
    }
  }

  async function quickLogin(em: string) {
    setSelectedEmail(em)
    setEmail(em)
    setPassword('laura2026')
    await handleLogin(em, 'laura2026')
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    handleLogin()
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
          <span className="text-xs px-2 py-0.5 rounded-full"
            style={{ background:'var(--bg-elevated)', color:'var(--text-muted)', border:'1px solid var(--border)' }}>
            POC · EMEA
          </span>
        </div>
        <ThemeToggle />
      </div>

      {/* Center */}
      <div className="flex-1 flex items-start justify-center px-4 py-8">
        <div className="w-full max-w-[560px]">

          {/* Header */}
          <div className="mb-7 text-center">
            <h1 className="text-3xl font-semibold tracking-tight mb-2"
              style={{ color: 'var(--text-primary)' }}>
              Sign in to LAURA
            </h1>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              LOA Automation &amp; Review Agent — pick a demo account or sign in manually
            </p>
          </div>

          {/* Error banner */}
          {error && (
            <p className="text-xs py-2 px-3 rounded-lg mb-4"
              style={{ background: 'var(--red-bg)', color: 'var(--red-text)', border: '1px solid var(--red-border)' }}>
              {error}
            </p>
          )}

          {/* Relay groups */}
          <div className="space-y-4">
            {RELAY_GROUPS.map(g => (
              <div key={g.id} className="rounded-xl p-4"
                style={{
                  background: g.accent.bg,
                  border:     `1px solid ${g.accent.border}`,
                }}>

                {/* Group header */}
                <div className="flex items-center gap-2 mb-3">
                  <span className="inline-block rounded-full"
                    style={{ width: '8px', height: '8px', background: g.accent.dot }} />
                  <h3 className="text-sm font-semibold tracking-tight"
                    style={{ color: g.accent.text }}>
                    {g.title}
                  </h3>
                  <span className="text-xs ml-1" style={{ color: 'var(--text-muted)' }}>
                    {g.subtitle}
                  </span>
                </div>

                {/* Accounts grid */}
                <div className={`grid gap-2 ${
                  g.accounts.length === 1 ? 'grid-cols-1' :
                  g.accounts.length === 2 ? 'grid-cols-2' : 'grid-cols-3'
                }`}>
                  {g.accounts.map(a => {
                    const isSelected = selectedEmail === a.email && loading
                    return (
                      <button key={a.email}
                        onClick={() => quickLogin(a.email)}
                        disabled={loading}
                        className="text-left rounded-lg px-3 py-2.5 transition-all hover:scale-[1.01] disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{
                          background: 'var(--bg-surface)',
                          border: `1px solid ${g.accent.border}`,
                        }}>
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                            {a.role}
                          </p>
                          {isSelected && (
                            <span className="w-3 h-3 border-2 rounded-full animate-spin flex-shrink-0"
                              style={{ borderColor: g.accent.text, borderTopColor: 'transparent' }} />
                          )}
                        </div>
                        <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{a.name}</p>
                        <p className="text-[10px] mt-1 truncate" style={{ color: 'var(--text-muted)' }}>{a.scope}</p>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Manual sign in */}
          <details className="mt-6 rounded-xl"
            style={{ border: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
            <summary className="cursor-pointer px-4 py-3 text-xs font-medium select-none"
              style={{ color: 'var(--text-muted)' }}>
              Or sign in with email &amp; password
            </summary>
            <form onSubmit={onSubmit} className="px-4 pb-4 pt-1 space-y-3">
              <div>
                <label className="label">Email</label>
                <input type="email" className="input" placeholder="name@essilor.com"
                  value={email} onChange={e => setEmail(e.target.value)}
                  autoComplete="email" />
              </div>
              <div>
                <label className="label">Password</label>
                <input type="password" className="input" placeholder="••••••••"
                  value={password} onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password" />
              </div>
              <button type="submit" disabled={loading || !email || !password}
                className="btn-primary w-full h-10">
                {loading ? (
                  <span className="w-4 h-4 border-2 rounded-full animate-spin"
                    style={{ borderColor: 'var(--accent-text)', borderTopColor: 'transparent' }} />
                ) : 'Continue'}
              </button>
            </form>
          </details>

          <p className="text-center text-xs mt-6" style={{ color: 'var(--text-muted)' }}>
            All POC passwords: <code className="font-mono px-1.5 py-0.5 rounded"
              style={{ background:'var(--bg-elevated)', color:'var(--text-secondary)' }}>laura2026</code>
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-6 py-4 text-xs"
        style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}>
        <span>AI to Market × EssilorLuxottica EMEA</span>
        <span>Strictly confidential</span>
      </div>
    </div>
  )
}