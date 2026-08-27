'use client'
/**
 * LAURA — Design-doc shared chrome
 * The 68px sidebar rail + the "Search or ask Laura" top bar, reused across the
 * Admin (3a), Tracker (2a) and CMO Deck (1a) full-page screens. The rail icons
 * are real navigations so these screens work as live app routes.
 */
import Link from 'next/link'
import { C, FONT } from './_data'

type Nav = 'tracker' | 'review' | 'admin'
const HREF: Record<Nav, string> = { tracker: '/', review: '/cmo-review', admin: '/admin' }

export function Rail({ active }: { active?: Nav }) {
  const item = (key: Nav, glyph: string) => {
    const on = active === key
    return (
      <Link
        href={HREF[key]}
        style={{
          width: 44, height: 36, marginTop: 2, borderRadius: 8, textDecoration: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
          background: on ? '#FFFFFF' : 'transparent',
          border: on ? `1px solid ${C.border}` : '1px solid transparent',
          boxShadow: on ? '0 1px 2px rgba(26,24,21,.06)' : 'none',
          color: on ? C.ink : C.t2,
        }}
      >{glyph}</Link>
    )
  }
  return (
    <div style={{
      width: 68, flex: 'none', background: C.canvas, borderRight: `1px solid ${C.border}`,
      padding: '18px 10px 14px', display: 'flex', flexDirection: 'column', alignItems: 'center',
    }}>
      <Link href="/" style={{ fontFamily: FONT.display, fontSize: 22, fontWeight: 600, lineHeight: 1, color: C.ink, textDecoration: 'none' }}>
        L<span style={{ color: C.gold }}>.</span>
      </Link>
      <Link href="/loa/new" title="New LOA" style={{
        height: 38, width: 44, marginTop: 16, borderRadius: 9, background: C.ink, color: C.inkText, textDecoration: 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15,
      }}>+</Link>
      <div style={{ height: 20 }} />
      {item('tracker', '▤')}
      {item('review', '▷')}
      <div style={{ height: 20 }} />
      {item('admin', '⚙')}
      <div style={{ flex: 1 }} />
      <div style={{
        width: 30, height: 30, borderRadius: 99, background: C.cream, border: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: C.t2,
      }}>TB</div>
    </div>
  )
}

export function TopBar({ section, bg = C.canvas }: { section: string; bg?: string }) {
  return (
    <div style={{
      height: 56, flex: 'none', display: 'flex', alignItems: 'center', gap: 16,
      padding: '0 24px', background: bg, borderBottom: `1px solid ${C.border}`,
    }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: C.t2, minWidth: 110 }}>{section}</div>
      <div style={{
        flex: 1, maxWidth: 460, height: 34, display: 'flex', alignItems: 'center', gap: 8,
        padding: '0 10px 0 12px', border: `1px solid ${C.border}`, borderRadius: 9, background: '#FFFFFF', fontSize: 13,
      }}>
        <span style={{ opacity: 0.55 }}>⌕</span>
        <span style={{ color: C.t3 }}>Search or ask Laura…</span>
        <span style={{
          marginLeft: 'auto', fontFamily: FONT.mono, fontSize: 11, padding: '2px 6px',
          border: `1px solid ${C.border}`, borderRadius: 5, color: C.t3,
        }}>⌘K</span>
      </div>
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div className="dc-btn" style={{
          display: 'flex', alignItems: 'center', height: 34, padding: '0 14px', borderRadius: 8,
          border: `1px solid ${C.border}`, fontSize: 13, fontWeight: 600,
        }}>
          <span style={{ color: C.gold, marginRight: 7 }}>✦</span>Ask Laura
        </div>
        <div style={{
          width: 30, height: 30, borderRadius: 99, background: C.cream, border: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: C.t2,
        }}>TB</div>
      </div>
    </div>
  )
}
