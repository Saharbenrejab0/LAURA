'use client'
/**
 * 1b · One at a time — dark queue flow, running total, keyboard-driven.
 * A single LOA card sits on a stack; the deck order is the left rail.
 */
import { C, FONT, queueDeck } from '../_data'

const bars = [
  { label: 'HB · Ray-Ban', pct: '100%', color: C.dangerDeep, amt: '120,0K' },
  { label: 'LB · Prada', pct: '45%', color: C.gold, amt: '54,0K' },
  { label: 'LB · Versace', pct: '34%', color: C.borderStrong, amt: '40,5K' },
  { label: 'LB · Emporio Armani', pct: '33%', color: C.borderStrong, amt: '40,0K' },
  { label: 'LB · Miu Miu', pct: '33%', color: C.borderStrong, amt: '40,0K' },
]

export default function CmoQueue() {
  return (
    <div style={{ height: 900, background: C.dark, position: 'relative', display: 'flex', flexDirection: 'column', color: C.darkText, overflow: 'hidden' }}>
      {/* top bar */}
      <div style={{ height: 64, flex: 'none', display: 'flex', alignItems: 'center', gap: 18, padding: '0 28px', borderBottom: `1px solid ${C.darkLine}` }}>
        <div style={{ fontFamily: FONT.display, fontSize: 22, fontWeight: 600 }}>LAURA<span style={{ color: C.gold2 }}>.</span></div>
        <div style={{ fontSize: 12.5, color: C.darkMuted }}>Q3 2026 session · Frames — Tailor Made Seasonal</div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 22 }}>
          {[['Approved so far', '4,12 M€', C.greenGlow], ['Sent back', '0,55 M€', C.redGlow], ['Remaining', '13,3 M€', C.darkText]].map(([l, v, col], i) => (
            <div key={i} style={{ textAlign: 'right' }}>
              <div style={{ font: `500 9.5px ${FONT.sans}`, letterSpacing: '.12em', textTransform: 'uppercase', color: C.darkMuted2 }}>{l}</div>
              <div style={{ font: `600 17px ${FONT.mono}`, color: col }}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '236px 1fr' }}>
        {/* deck order rail */}
        <div style={{ borderRight: `1px solid ${C.darkLine}`, padding: '20px 18px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ font: `500 9.5px ${FONT.sans}`, letterSpacing: '.12em', textTransform: 'uppercase', color: C.darkMuted2 }}>Deck order</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {queueDeck.map((d, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: d.pad, borderRadius: 8, background: d.bg }}>
                {!d.indent && <span style={{ width: 6, height: 6, borderRadius: 99, background: d.dot || C.greenGlow }} />}
                <span style={{ font: `${d.weight} ${d.indent ? 11.5 : 12}px ${FONT.sans}`, color: d.fg }}>{d.label}</span>
                <span style={{ marginLeft: 'auto', font: `500 10.5px ${FONT.mono}`, color: (d as any).meta || C.darkMuted2 }}>{d.count}</span>
              </div>
            ))}
            {[['Lenses', '9'], ['Events', '7']].map(([l, n], i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 9px', borderRadius: 8, marginTop: i === 0 ? 6 : 0 }}>
                <span style={{ width: 6, height: 6, borderRadius: 99, background: C.darkLine2 }} />
                <span style={{ font: `600 12px ${FONT.sans}`, color: C.darkMuted }}>{l}</span>
                <span style={{ marginLeft: 'auto', font: `500 10.5px ${FONT.mono}`, color: C.darkMuted2 }}>{n}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 'auto', borderTop: `1px solid ${C.darkLine}`, paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 7, fontSize: 11, color: C.darkMuted2 }}>
            <div><Key>A</Key> approve · <Key>S</Key> send back</div>
            <div><Key>C</Key> comment · <Key>→</Key> skip</div>
          </div>
        </div>

        {/* card stack */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', width: 880, height: 520, background: C.darkPanel, border: `1px solid ${C.darkLine}`, borderRadius: 14, transform: 'translateY(38px) scale(.955)', opacity: 0.5 }} />
          <div style={{ position: 'absolute', width: 880, height: 520, background: C.darkPanel2, border: `1px solid ${C.darkLine}`, borderRadius: 14, transform: 'translateY(20px) scale(.978)', opacity: 0.75 }} />

          <div style={{ position: 'relative', width: 880, background: '#FFFFFF', borderRadius: 14, boxShadow: '0 30px 70px rgba(0,0,0,.55)', overflow: 'hidden', color: C.ink }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 22px 0' }}>
              <div>
                <div style={{ font: `500 9.5px ${FONT.sans}`, letterSpacing: '.14em', textTransform: 'uppercase', color: C.t3 }}>Frames · Italy · TM Seasonal</div>
                <div style={{ font: `600 20px ${FONT.sans}`, color: C.navy, marginTop: 3 }}>Seasonal Visibility: HB &amp; LB</div>
              </div>
              <div style={{ textAlign: 'right' }}><div style={{ font: `600 24px ${FONT.display}` }}>554,5 K€</div><div style={{ fontSize: 10, color: C.t3 }}>1 222 doors · 453 €/door</div></div>
            </div>
            <div style={{ margin: '12px 22px 0', padding: '10px 12px', border: `1px solid ${C.goldSoft}`, background: C.subtle, borderRadius: 9, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ color: C.gold, fontSize: 13, lineHeight: 1.2 }}>✦</span>
              <div style={{ font: `400 12px/1.55 ${FONT.sans}` }}>19 brands under one Super Trade Light line. Ray-Ban takes 120K€ (22%); avg/door 453 € is 2.1× the Italy median. Everything else matches Q3-25.</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', margin: '14px 22px 0', border: `1px solid ${C.border}`, borderRadius: 9, overflow: 'hidden' }}>
              {[['Timing', 'Q3–Q4 2026'], ['Tools', 'Windows covering'], ['KPI', '+10–15% sell-out']].map(([l, v], i) => (
                <div key={i} style={{ padding: '10px 12px', borderLeft: i ? `1px solid ${C.border}` : 'none' }}><div style={{ fontSize: 9.5, color: C.t3 }}>{l}</div><div style={{ font: `600 12.5px ${FONT.sans}`, marginTop: 2 }}>{v}</div></div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16, padding: '14px 22px 0' }}>
              <div>
                <div style={{ font: `500 9px ${FONT.sans}`, letterSpacing: '.14em', textTransform: 'uppercase', color: C.t3, marginBottom: 6 }}>Top brand lines</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {bars.map((b, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <span style={{ font: `600 11px ${FONT.sans}`, width: 130 }}>{b.label}</span>
                      <div style={{ flex: 1, height: 7, background: C.cream, borderRadius: 4 }}><div style={{ width: b.pct, height: '100%', background: b.color, borderRadius: 4 }} /></div>
                      <span style={{ font: `600 11px ${FONT.mono}`, width: 56, textAlign: 'right' }}>{b.amt}</span>
                    </div>
                  ))}
                  <div style={{ fontSize: 10, color: C.t3, marginTop: 2 }}>+ 14 brands · see full slide</div>
                </div>
              </div>
              <div>
                <div style={{ font: `500 9px ${FONT.sans}`, letterSpacing: '.14em', textTransform: 'uppercase', color: C.t3, marginBottom: 6 }}>Previous executions</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  <div style={{ aspectRatio: '4 / 3', background: C.cream, border: `1px solid ${C.border}`, borderRadius: 5 }} />
                  <div style={{ aspectRatio: '4 / 3', background: C.cream, border: `1px solid ${C.border}`, borderRadius: 5 }} />
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0 0', padding: '13px 22px', borderTop: `1px solid ${C.border}`, background: C.subtle }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5, color: C.t2 }}><span style={{ width: 20, height: 20, borderRadius: 99, background: C.dangerDeep, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', font: `700 9px ${FONT.sans}` }}>2</span> open comments from EMEA review</div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 9 }}>
                <div className="dc-btn" style={{ height: 38, padding: '0 15px', borderRadius: 9, border: `1px solid ${C.border}`, background: '#fff', display: 'flex', alignItems: 'center', fontSize: 13, fontWeight: 600, color: C.t2 }}>Skip</div>
                <div className="dc-btn" style={{ height: 38, padding: '0 15px', borderRadius: 9, border: `1px solid ${C.border}`, background: '#fff', display: 'flex', alignItems: 'center', fontSize: 13, fontWeight: 600 }}>Comment</div>
                <div className="dc-btn" style={{ height: 38, padding: '0 17px', borderRadius: 9, border: `1.5px solid ${C.dangerBd}`, background: '#fff', display: 'flex', alignItems: 'center', fontSize: 13, fontWeight: 600, color: C.dangerDeep }}>Send back</div>
                <div className="dc-btn" style={{ height: 38, padding: '0 24px', borderRadius: 9, background: C.ink, color: C.inkText, display: 'flex', alignItems: 'center', fontSize: 13, fontWeight: 600 }}>Approve</div>
              </div>
            </div>
          </div>

          <div style={{ position: 'absolute', bottom: 26, left: 0, right: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 9 }}>
            <span style={{ fontSize: 11.5, color: C.darkMuted2, fontVariantNumeric: 'tabular-nums' }}>3 of 18 · Frames</span>
            <div style={{ width: 220, height: 4, borderRadius: 3, background: C.darkLine }}><div style={{ width: '17%', height: '100%', borderRadius: 3, background: C.gold2 }} /></div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Key({ children }: { children: React.ReactNode }) {
  return <span style={{ fontFamily: FONT.mono, border: `1px solid ${C.darkLine2}`, borderRadius: 4, padding: '1px 5px', color: C.darkMuted }}>{children}</span>
}
