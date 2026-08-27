'use client'
/**
 * 1e · State — Session complete. The minutes write themselves.
 */
import { C, FONT, minutes } from '../_data'

const lauraNext = [
  'Push 31 approvals to EMEA Final Review and notify the 6 cluster owners.',
  'Return 5 LOAs with the CMO’s pinned comments attached to the exact slide zone.',
  'Rebuild the deck without the returned slides and re-issue the PPTX.',
]
const captured = [
  { who: 'Alexandra · slide 5, Costs drill down', body: 'Phase Ray-Ban: Q3 pilot on 120 doors, rest to Q4.', bar: C.dangerDeep },
  { who: 'Marc · slide 5, brand table', body: 'Confirm the 2026 Vetrina In rate card.', bar: C.warn },
  { who: 'Alexandra · slide 17, Sponsorship', body: 'Alta Badia approved, but visibility plan to be shared before September.', bar: C.border },
]

export default function CmoComplete() {
  return (
    <div style={{ minHeight: 664, background: C.canvas, color: C.ink, padding: '34px 40px 30px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 20 }}>
        <div>
          <div style={{ font: `500 10px ${FONT.sans}`, letterSpacing: '.14em', textTransform: 'uppercase', color: C.gold }}>Session closed · 12 July 2026, 11:42</div>
          <div style={{ font: `600 34px/1.15 ${FONT.display}`, marginTop: 7 }}>Q3 2026 validation session — Italy</div>
          <div style={{ fontSize: 12.5, color: C.t2, marginTop: 5 }}>39 slides presented in 1 h 04 · Alexandra (CMO), Marc (CFO) · driven by Thibault</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
          <div className="dc-btn" style={{ height: 38, padding: '0 16px', borderRadius: 9, border: `1px solid ${C.border}`, background: '#fff', display: 'flex', alignItems: 'center', fontSize: 13, fontWeight: 600, color: C.t2 }}>Download minutes (PDF)</div>
          <div className="dc-btn" style={{ height: 38, padding: '0 18px', borderRadius: 9, background: C.ink, color: C.inkText, display: 'flex', alignItems: 'center', fontSize: 13, fontWeight: 600 }}>Send decisions to clusters</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginTop: 26 }}>
        {[['Approved', '31', C.success, '14,9 M€'], ['Sent back', '5', C.dangerDeep, '2,1 M€'], ['Deferred to next session', '3', C.warn, '1,0 M€']].map(([l, n, col, v], i) => (
          <div key={i} style={{ background: '#FFFFFF', border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ fontSize: 10.5, color: C.t3 }}>{l}</div>
            <div style={{ font: `600 30px ${FONT.sans}`, color: col as string, marginTop: 4 }}>{n}</div>
            <div style={{ font: `600 13px ${FONT.mono}`, color: C.t2, marginTop: 2 }}>{v}</div>
          </div>
        ))}
        <div style={{ background: C.ink, borderRadius: 12, padding: '16px 18px', color: C.darkText }}>
          <div style={{ fontSize: 10.5, color: C.darkMuted }}>Approved envelope</div>
          <div style={{ font: `600 30px ${FONT.display}`, marginTop: 4 }}>14,9 M€</div>
          <div style={{ fontSize: 11.5, color: C.darkMuted, marginTop: 3 }}>83% of the 18,0 M€ submitted</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: 20, marginTop: 20 }}>
        <div style={{ background: '#FFFFFF', border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '13px 18px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 10 }}><span style={{ font: `600 13px ${FONT.sans}` }}>Decisions, in deck order</span><span style={{ marginLeft: 'auto', fontSize: 11.5, color: C.t3 }}>Frames → activity → brand</span></div>
          {minutes.map((m, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '40px 1fr 130px 92px 120px', alignItems: 'center', padding: '11px 18px', borderBottom: `1px solid ${C.cream}`, fontSize: 12 }}>
              <div style={{ fontFamily: FONT.mono, color: C.t3 }}>{m.no}</div>
              <div style={{ fontWeight: 600 }}>{m.title}</div>
              <div style={{ color: C.t2 }}>{m.activity}</div>
              <div style={{ textAlign: 'right', fontFamily: FONT.mono, fontWeight: 600 }}>{m.amount}</div>
              <div style={{ textAlign: 'right' }}><span style={{ font: `600 10px ${FONT.sans}`, background: m.bg, color: m.fg, borderRadius: 99, padding: '4px 10px' }}>{m.state}</span></div>
            </div>
          ))}
          <div style={{ padding: '11px 18px', fontSize: 11.5, color: C.t3, background: C.subtle }}>+ 32 more decisions in the exported minutes</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: '#FFFFFF', border: `1px solid ${C.goldSoft}`, borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}><span style={{ color: C.gold }}>✦</span><span style={{ font: `600 12.5px ${FONT.sans}` }}>What Laura will do next</span></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 11, fontSize: 12, lineHeight: 1.55, color: C.ink }}>
              {lauraNext.map((t, i) => (
                <div key={i} style={{ display: 'flex', gap: 9 }}><span style={{ color: C.gold }}>{i + 1}</span><span>{t}</span></div>
              ))}
            </div>
          </div>
          <div style={{ background: '#FFFFFF', border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px 18px', flex: 1 }}>
            <div style={{ font: `600 12.5px ${FONT.sans}`, marginBottom: 11 }}>Comments captured in session</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              {captured.map((c, i) => (
                <div key={i} style={{ borderLeft: `2px solid ${c.bar}`, paddingLeft: 11 }}>
                  <div style={{ font: `600 11.5px ${FONT.sans}` }}>{c.who}</div>
                  <div style={{ font: `400 11.5px/1.5 ${FONT.sans}`, color: C.t2, marginTop: 2 }}>{c.body}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
