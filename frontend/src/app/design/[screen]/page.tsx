/**
 * LAURA — single design screen, full size at /design/<slug>.
 */
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { REGISTRY } from '../screens/registry'
import { C, FONT, TURNS } from '../_data'

export function generateStaticParams() {
  return Object.keys(REGISTRY).map(screen => ({ screen }))
}

export default async function ScreenPage({ params }: { params: Promise<{ screen: string }> }) {
  const { screen } = await params
  const entry = REGISTRY[screen]
  if (!entry) notFound()
  const Screen = entry.Component

  const all = TURNS.flatMap(t => t.screens)
  const idx = all.findIndex(s => s.href.endsWith('/' + screen))
  const here = all[idx]
  const prev = all[(idx - 1 + all.length) % all.length]
  const next = all[(idx + 1) % all.length]

  return (
    <div>
      <header style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 24px', borderBottom: '1px solid rgba(0,0,0,.08)', background: 'rgba(237,234,227,.92)', position: 'sticky', top: 0, zIndex: 20, backdropFilter: 'blur(6px)' }}>
        <Link href="/design" style={{ font: `600 12.5px ${FONT.sans}`, color: C.ink }}>← Design build</Link>
        <span style={{ font: `600 10px ${FONT.mono}`, padding: '3px 7px', background: C.ink, color: '#F6F4EF', borderRadius: 4 }}>{here?.id}</span>
        <span style={{ font: `400 12.5px ${FONT.sans}`, color: 'rgba(26,24,21,.6)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{here?.label}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <Link href={prev.href} style={{ font: `600 11.5px ${FONT.sans}`, color: 'rgba(26,24,21,.6)', border: '1px solid rgba(26,24,21,.15)', borderRadius: 8, padding: '6px 11px' }}>‹ {prev.id}</Link>
          <Link href={next.href} style={{ font: `600 11.5px ${FONT.sans}`, color: 'rgba(26,24,21,.6)', border: '1px solid rgba(26,24,21,.15)', borderRadius: 8, padding: '6px 11px' }}>{next.id} ›</Link>
        </div>
      </header>
      <div style={{ overflowX: 'auto', padding: 24 }}>
        <div style={{ width: entry.w, maxWidth: '100%', margin: '0 auto', border: '1px solid rgba(26,24,21,.12)', borderRadius: 8, overflow: 'hidden', boxShadow: '0 2px 14px rgba(26,24,21,.10)' }}>
          <div style={{ width: entry.w }}><Screen /></div>
        </div>
      </div>
    </div>
  )
}
