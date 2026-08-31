'use client'

/**
 * LAURA — Welcome / showcase sign-in page.
 *
 * Flow: /login (select account) -> /welcome (this page) -> Microsoft SSO -> Tracker.
 * Only the SSO button navigates onward. No page-level click. A session check
 * runs on mount (gated by `checking`) so we never redirect before hydration.
 */

import { useRouter } from 'next/navigation'
import ThemeControl from '@/components/ThemeControl'

/**
 * The left hero panel is a fixed brand composition — a dark editorial plate with
 * its own gradient — and stays identical in both themes, the same way the deck
 * slide canvas does. Everything AROUND it (page ground, sign-in panel, type)
 * reads from the theme variables, so a dark-mode user is not hit with a cream
 * slab on the way in.
 */
const GOLD = 'var(--accent)'

export default function WelcomePage() {
  const router = useRouter()
  const continueToTracker = () => router.replace('/')

  return (
    <div
      style={{ minHeight: '100vh', background: 'var(--canvas)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'var(--font-sans)', position: 'relative' }}
    >
      {/* Pre-auth theme control. Writes the same `laura.theme` key the app reads,
          so the choice made here is already in effect once the session starts. */}
      <div style={{ position: 'absolute', top: 20, right: 22 }}>
        <ThemeControl variant="inline" />
      </div>

      <div
        style={{
          width: '100%', maxWidth: 1200, minHeight: 640,
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          borderRadius: 20, overflow: 'hidden',
          boxShadow: '0 40px 120px rgba(0,0,0,0.55)',
        }}
      >
        {/* Left: dark editorial hero */}
        <div
          style={{
            position: 'relative',
            background:
              `linear-gradient(155deg, rgba(15,13,10,0.55) 0%, rgba(15,13,10,0.82) 60%, rgba(15,13,10,0.95) 100%), ` +
              `radial-gradient(120% 80% at 70% 30%, #3a3128 0%, #1a1712 55%, #0c0a08 100%)`,
            padding: '48px 52px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
            color: '#efe9dd',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 34, fontWeight: 600, color: '#f4efe6', lineHeight: 1 }}>L</span>
            <span style={{ color: GOLD, fontSize: 34, fontWeight: 700, lineHeight: 1 }}>.</span>
          </div>

          <div style={{ maxWidth: 420 }}>
            <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 52, fontWeight: 500, lineHeight: 1.05, margin: 0, letterSpacing: -0.5 }}>
              Where strategy<br />meets <span style={{ color: GOLD, fontStyle: 'italic' }}>execution.</span>
            </h1>
            <p style={{ marginTop: 22, fontSize: 15, lineHeight: 1.6, color: 'rgba(239,233,221,0.72)', maxWidth: 340 }}>
              LAURA brings structure to complexity so great ideas move forward, faster.
            </p>
          </div>

          <div style={{ fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(239,233,221,0.4)' }}>
            EssilorLuxottica
          </div>
        </div>

        {/* Right: light sign-in panel */}
        <div style={{ background: 'var(--surface)', padding: '48px 56px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--surface-raised)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 28px rgba(176,141,47,0.18), 0 0 0 1px rgba(0,0,0,0.03)', marginBottom: 28 }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
          </div>

          <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 40, fontWeight: 500, color: 'var(--text-primary)', margin: 0, letterSpacing: -0.5 }}>
            Welcome back
          </h2>
          <p style={{ marginTop: 10, fontSize: 15, color: 'var(--text-secondary)' }}>
            Sign in securely to continue to LAURA
          </p>

          <button
            onClick={continueToTracker}
            style={{
              marginTop: 36, width: '100%', maxWidth: 400,
              background: 'var(--ink)', color: 'var(--ink-text)', border: 'none', borderRadius: 12,
              padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
              cursor: 'pointer', fontSize: 15, fontWeight: 500,
              boxShadow: 'var(--shadow-md)', transition: 'transform 120ms, box-shadow 120ms',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)' }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'none' }}
          >
            <span style={{ display: 'inline-grid', gridTemplateColumns: '10px 10px', gridTemplateRows: '10px 10px', gap: 2 }}>
              <span style={{ background: '#F25022' }} />
              <span style={{ background: '#7FBA00' }} />
              <span style={{ background: '#00A4EF' }} />
              <span style={{ background: '#FFB900' }} />
            </span>
            Continue with Microsoft SSO
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 34, width: '100%', maxWidth: 400 }}>
            <span style={{ flex: 1, height: 1, background: 'rgba(176,141,47,0.3)' }} />
            <span style={{ fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase', color: GOLD }}>Secure</span>
            <span style={{ flex: 1, height: 1, background: 'rgba(176,141,47,0.3)' }} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 18, color: 'var(--text-secondary)', fontSize: 13 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
            Your work. Your data. Always protected.
          </div>
        </div>
      </div>
    </div>
  )
}