'use client'
/**
 * 1c · Portfolio first — the session opens on the money, then drills into slides.
 */
import { C, FONT, flagged } from '../_data'

const priorities = [
  { name: 'Tailor Made Seasonal', amt: '5,2 M€', pct: '100%', slides: '5 slides', flag: '2 flagged', flagFg: C.gold },
  { name: 'Coop Advertising', amt: '3,7 M€', pct: '71%', slides: '4 slides', flag: 'clean', flagFg: C.success },
  { name: 'TM Permanent', amt: '2,9 M€', pct: '56%', slides: '2 slides', flag: '1 flagged', flagFg: C.gold },
  { name: 'In-store / Activation', amt: '2,5 M€', pct: '48%', slides: '3 slides', flag: 'clean', flagFg: C.success },
  { name: 'Sponsorship', amt: '1,1 M€', pct: '21%', slides: '2 slides', flag: '1 flagged', flagFg: C.gold },
]
const legend = [
  ['Ray-Ban + RB Meta', '3,4 M€', C.ink], ['Oakley + OO Meta', '3,6 M€', '#4A4437'],
  ['Luxury', '5,5 M€', C.gold], ['Others', '2,6 M€', C.borderStrong],
]
const cmoComments = [
  { who: 'Vanessa · EMEA Review', body: 'Confirm the Q3 vendor split with Altavia before we proceed.', meta: 'slide 5 · Costs drill down', on: true },
  { who: 'Marco · Global Brand Ray-Ban', body: 'Seasonal materials must follow the S/S 2026 guidelines.', meta: 'slide 6 · Tools', on: true },
  { who: 'Thibault · EMEA Admin', body: '700-door coop needs phasing — Q3 pilot then Q4 scale.', meta: 'slide 12 · brand table', on: false },
]

export default function CmoPortfolio() {
  return (
    <div style={{ height: 900, background: C.canvas, color: C.ink, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ height: 56, flex: 'none', display: 'flex', alignItems: 'center', gap: 16, padding: '0 28px', background: '#FFFFFF', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ fontFamily: FONT.display, fontSize: 21, fontWeight: 600 }}>LAURA<span style={{ color: C.gold }}>.</span></div>
        <div style={{ fontSize: 12.5, color: C.t2 }}>Q3 2026 validation session · 39 slides · Italy</div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="dc-btn" style={{ height: 34, padding: '0 14px', borderRadius: 8, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', fontSize: 12.5, fontWeight: 600, color: C.t2 }}>Export minutes</div>
          <div className="dc-btn" style={{ height: 34, padding: '0 16px', borderRadius: 8, background: C.ink, color: C.inkText, display: 'flex', alignItems: 'center', fontSize: 12.5, fontWeight: 600 }}>Start presenting →</div>
        </div>
      </div>

      {/* hero */}
      <div style={{ padding: '26px 28px 0', display: 'flex', alignItems: 'flex-end', gap: 28 }}>
        <div>
          <div style={{ font: `500 10px ${FONT.sans}`, letterSpacing: '.14em', textTransform: 'uppercase', color: C.t3 }}>Total submission · Q3/Q4 2026</div>
          <div style={{ font: `600 46px/1 ${FONT.display}`, marginTop: 6 }}>18,0 M€</div>
          <div style={{ fontSize: 12, color: C.t2, marginTop: 4 }}>16,1 M€ OpEx · 1,9 M€ CapEx</div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 6 }}>
          {[['Ready to approve', '27', C.success, '11,4 M€ · routine', C.border, '#FFFFFF'],
            ['Needs your eyes', '8', C.gold, '5,6 M€ · flagged', C.goldSoft, C.subtle],
            ['Already sent back', '4', C.dangerDeep, '1,0 M€', C.border, '#FFFFFF']].map(([l, n, col, sub, bd, bg], i) => (
            <div key={i} style={{ border: `1px solid ${bd}`, background: bg, borderRadius: 11, padding: '12px 16px', minWidth: 132 }}>
              <div style={{ fontSize: 10, color: C.t3 }}>{l}</div>
              <div style={{ font: `600 22px ${FONT.sans}`, color: col as string, marginTop: 3 }}>{n}</div>
              <div style={{ fontSize: 10.5, color: C.t2 }}>{sub}</div>
            </div>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', marginBottom: 6, maxWidth: 330, border: `1px solid ${C.goldSoft}`, background: '#FFFFFF', borderRadius: 11, padding: '13px 15px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}><span style={{ color: C.gold }}>✦</span><span style={{ font: `600 11.5px ${FONT.sans}` }}>Laura's running order</span></div>
          <div style={{ font: `400 11.5px/1.55 ${FONT.sans}`, color: C.t2, marginTop: 6 }}>Start with the 8 flagged slides (42 min), then batch-approve the routine 27 as one block. Saves ~55 min vs. the full deck.</div>
        </div>
      </div>

      {/* priorities */}
      <div style={{ padding: '22px 28px 0' }}>
        <div style={{ font: `500 10px ${FONT.sans}`, letterSpacing: '.14em', textTransform: 'uppercase', color: C.t3, marginBottom: 10 }}>Key investment priorities · in deck order</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12 }}>
          {priorities.map((p, i) => (
            <div key={i} style={{ border: `1px solid ${C.border}`, background: '#FFFFFF', borderRadius: 12, padding: '14px 15px' }}>
              <div style={{ font: `600 12px ${FONT.sans}` }}>{p.name}</div>
              <div style={{ font: `600 24px ${FONT.display}`, marginTop: 6 }}>{p.amt}</div>
              <div style={{ height: 6, borderRadius: 4, background: C.cream, marginTop: 9 }}><div style={{ width: p.pct, height: '100%', borderRadius: 4, background: C.ink }} /></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: C.t2, marginTop: 7 }}><span>{p.slides}</span><span style={{ color: p.flagFg, fontWeight: 600 }}>{p.flag}</span></div>
            </div>
          ))}
        </div>
      </div>

      {/* flagged + side */}
      <div style={{ padding: '22px 28px 0', display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20, flex: 1, minHeight: 0 }}>
        <div style={{ border: `1px solid ${C.border}`, background: '#FFFFFF', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderBottom: `1px solid ${C.border}` }}>
            <span style={{ font: `600 13px ${FONT.sans}` }}>Flagged first — 8 slides</span>
            <span style={{ font: `600 10px ${FONT.sans}`, background: C.warnBg, color: C.warn, borderRadius: 99, padding: '3px 9px' }}>Laura triage</span>
            <span style={{ marginLeft: 'auto', fontSize: 11.5, color: C.t3 }}>Frames → activity → brand</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr 120px 96px 84px 108px', padding: '9px 18px', font: `600 9.5px ${FONT.sans}`, letterSpacing: '.08em', textTransform: 'uppercase', color: C.t3, borderBottom: `1px solid ${C.border}` }}>
            <div>#</div><div>Slide</div><div>Activity</div><div style={{ textAlign: 'right', paddingRight: 12 }}>Amount</div><div style={{ textAlign: 'right', paddingRight: 12 }}>€/door</div><div style={{ paddingLeft: 2 }}>Why flagged</div>
          </div>
          {flagged.map((g, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '44px 1fr 120px 96px 84px 108px', padding: '11px 18px', borderBottom: `1px solid ${C.cream}`, fontSize: 12, alignItems: 'center' }}>
              <div style={{ fontFamily: FONT.mono, color: C.t3 }}>{g.no}</div>
              <div style={{ fontWeight: 600 }}>{g.title}</div>
              <div style={{ color: C.t2 }}>{g.activity}</div>
              <div style={{ textAlign: 'right', fontFamily: FONT.mono, fontWeight: 600, paddingRight: 12 }}>{g.amount}</div>
              <div style={{ textAlign: 'right', fontFamily: FONT.mono, color: g.doorColor, paddingRight: 12 }}>{g.perDoor}</div>
              <div><span style={{ font: `600 9.5px ${FONT.sans}`, background: g.tagBg, color: g.tagFg, borderRadius: 99, padding: '3px 8px' }}>{g.tag}</span></div>
            </div>
          ))}
          <div style={{ marginTop: 'auto', padding: '12px 18px', background: C.subtle, borderTop: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 12, color: C.t2 }}>27 routine slides · 11,4 M€</span>
            <div className="dc-btn" style={{ marginLeft: 'auto', height: 34, padding: '0 16px', borderRadius: 8, border: `1px solid ${C.border}`, background: '#fff', display: 'flex', alignItems: 'center', fontSize: 12.5, fontWeight: 600 }}>Review one by one</div>
            <div className="dc-btn" style={{ height: 34, padding: '0 16px', borderRadius: 8, background: C.ink, color: C.inkText, display: 'flex', alignItems: 'center', fontSize: 12.5, fontWeight: 600 }}>Approve all routine</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minHeight: 0 }}>
          <div style={{ border: `1px solid ${C.border}`, background: '#FFFFFF', borderRadius: 12, padding: '15px 16px' }}>
            <div style={{ font: `600 12.5px ${FONT.sans}`, marginBottom: 11 }}>Brand split · Frames</div>
            <div style={{ display: 'flex', height: 11, borderRadius: 6, overflow: 'hidden' }}>
              <div style={{ width: '24%', background: C.ink }} /><div style={{ width: '26%', background: '#4A4437' }} /><div style={{ width: '32%', background: C.gold }} /><div style={{ width: '18%', background: C.borderStrong }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 11, fontSize: 11.5 }}>
              {legend.map(([l, v, col], i) => (
                <div key={i} style={{ display: 'flex' }}><span style={{ width: 9, height: 9, borderRadius: 2, background: col as string, margin: '4px 8px 0 0' }} />{l}<span style={{ marginLeft: 'auto', fontFamily: FONT.mono, fontWeight: 600 }}>{v}</span></div>
              ))}
            </div>
          </div>
          <div style={{ border: `1px solid ${C.border}`, background: '#FFFFFF', borderRadius: 12, padding: '15px 16px', flex: 1, minHeight: 0 }}>
            <div style={{ font: `600 12.5px ${FONT.sans}`, marginBottom: 10 }}>Comments waiting on the CMO</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {cmoComments.map((c, i) => (
                <div key={i} style={{ borderLeft: `2px solid ${c.on ? C.gold : C.border}`, paddingLeft: 10 }}>
                  <div style={{ font: `600 11.5px ${FONT.sans}` }}>{c.who}</div>
                  <div style={{ font: `400 11.5px/1.5 ${FONT.sans}`, color: C.t2, marginTop: 2 }}>{c.body}</div>
                  <div style={{ fontSize: 10, color: C.t3, marginTop: 3 }}>{c.meta}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div style={{ height: 22 }} />
    </div>
  )
}
