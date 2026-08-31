/**
 * LAURA — Design build gallery
 * A faithful reconstruction of the Claude design-doc viewer: three turns
 * (Admin, Tracker, CMO review) each with their option cards, rendered as real,
 * live React screens. Every card is also reachable at its own /design/<slug> URL.
 */
import Link from 'next/link'
import { C, FONT, TURNS } from './_data'
import { REGISTRY, slugFromHref } from './screens/registry'

export const metadata = { title: 'LAURA — Design build' }

export default function DesignGallery() {
  return (
    <div style={{ maxWidth: 1520, margin: '0 auto', padding: '0 0 60px' }}>
      {/* masthead */}
      <div style={{ padding: '40px 44px 26px', borderBottom: '1px solid rgba(0,0,0,.08)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <div style={{ fontFamily: FONT.display, fontSize: 30, fontWeight: 600 }}>LAURA<span style={{ color: C.gold }}>.</span></div>
          <div style={{ font: `600 11px ${FONT.mono}`, color: '#fff', background: C.ink, borderRadius: 4, padding: '4px 8px' }}>DESIGN BUILD</div>
        </div>
        <div style={{ font: `400 13.5px/1.6 ${FONT.sans}`, color: 'rgba(26,24,21,.6)', marginTop: 10, maxWidth: 720 }}>
          The CMO Review Mockups, built as live screens on Laura — 3 directions, 12 options. Click any option to open it full-size. The Deck Session (1a) is interactive: click a slide zone or a comment to pin it, navigate slides, approve.
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
          {TURNS.flatMap(t => t.screens).map(s => (
            <Link key={s.id} href={s.href} style={{ font: `600 11px ${FONT.mono}`, background: 'rgba(26,24,21,.06)', color: C.ink, borderRadius: 5, padding: '5px 9px' }}>{s.id}</Link>
          ))}
        </div>
      </div>

      {TURNS.map(turn => (
        <section key={turn.id} id={`t${turn.id}`} style={{ padding: '40px 44px 32px', borderBottom: '1px solid rgba(0,0,0,.08)' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, margin: '0 0 22px' }}>
            <span style={{ font: `600 10px ${FONT.mono}`, padding: '3px 7px', background: C.ink, color: '#F6F4EF', borderRadius: 4 }}>{turn.id}</span>
            <span style={{ font: `600 13px/1.2 ${FONT.sans}`, color: C.ink }}>{turn.title}</span>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 32, alignItems: 'flex-start' }}>
            {turn.screens.map(s => {
              const entry = REGISTRY[slugFromHref(s.href)]
              const Screen = entry.Component
              return (
                <div key={s.id} id={s.id} style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, font: `400 11.5px/1.3 ${FONT.sans}`, color: 'rgba(26,24,21,.55)', maxWidth: s.w }}>
                    <Link href={s.href} style={{ font: `600 10.5px ${FONT.mono}`, padding: '3px 7px', background: 'rgba(26,24,21,.08)', color: C.ink, borderRadius: 5 }}>{s.id}</Link>
                    {s.label}
                  </div>
                  <div style={{ width: 'min(100%, ' + s.w + 'px)', maxWidth: s.w, background: '#F6F4EF', border: '1px solid rgba(26,24,21,.12)', borderRadius: 8, boxShadow: '0 2px 10px rgba(26,24,21,.08)', overflow: 'auto' }}>
                    <div style={{ width: s.w }}><Screen /></div>
                  </div>
                </div>
              )
            })}
          </div>

          <p style={{ margin: '22px 0 0', font: `12.5px/1.6 ${FONT.sans}`, color: 'rgba(26,24,21,.5)' }}>Try next: {turn.tryNext}</p>
        </section>
      ))}
    </div>
  )
}
