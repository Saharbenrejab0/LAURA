'use client'
/**
 * 1d · State — Present mode. Projected in the room; chrome collapses to a pill.
 */
import { C, FONT, permRows } from '../_data'

const HEAD = ['COUNTRY', 'TYPE / PLANNING', 'CUSTOMER', 'BRAND', 'DETAIL', '#DOORS', 'AVG/DOOR', 'VENDOR', 'Q3-26', 'Q4-26', 'FY-26']
const GRID = '52px 132px 132px 128px 96px 52px 68px 108px 68px 68px 68px'

export default function CmoPresent() {
  return (
    <div style={{ height: 730, background: C.darkest, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', paddingBottom: 56, boxSizing: 'border-box', overflow: 'hidden' }}>
      <div style={{ width: 1000, aspectRatio: '16 / 9', flex: 'none', background: '#fff', boxShadow: '0 30px 80px rgba(0,0,0,.6)', position: 'relative', color: C.ink, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: C.navy }} />
        <div style={{ padding: '24px 30px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div><div style={{ font: `600 24px ${FONT.sans}`, color: C.navy }}>Permanent Visibility: HB + LB</div><div style={{ font: `500 10px ${FONT.sans}`, letterSpacing: '.14em', textTransform: 'uppercase', color: C.t3, marginTop: 5 }}>Tailor Made Permanent · Focus on RB / OO / PR</div></div>
          <div style={{ textAlign: 'right' }}><div style={{ font: `500 10px ${FONT.sans}`, letterSpacing: '.14em', textTransform: 'uppercase', color: C.t3 }}>Italy</div><div style={{ font: `600 28px ${FONT.display}` }}>270 K€</div></div>
        </div>
        <div style={{ padding: '0 30px' }}>
          <div style={{ border: `1px solid ${C.border}` }}>
            <div style={{ display: 'grid', gridTemplateColumns: GRID, background: C.navy, color: '#fff', font: `700 7px ${FONT.sans}`, letterSpacing: '.04em' }}>
              {HEAD.map((h, i) => <div key={i} style={{ padding: 5, textAlign: i >= 8 ? 'right' : 'left' }}>{h}</div>)}
            </div>
            {permRows.map((p, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: GRID, font: `400 7.5px/1.55 ${FONT.sans}`, borderTop: `1px solid ${C.cream}` }}>
                <div style={{ padding: '3px 5px' }}>Italy</div><div style={{ padding: '3px 5px' }}>TM Permanent</div><div style={{ padding: '3px 5px' }}>Top Loc, Dom</div><div style={{ padding: '3px 5px', fontWeight: 600 }}>{p.brand}</div><div style={{ padding: '3px 5px' }}>{p.detail}</div><div style={{ padding: '3px 5px' }}>{p.doors}</div><div style={{ padding: '3px 5px' }}>{p.avg}</div><div style={{ padding: '3px 5px' }}>Vetrina in</div><div style={{ padding: '3px 5px', textAlign: 'right', fontFamily: FONT.mono }}>{p.q3}</div><div style={{ padding: '3px 5px', textAlign: 'right', fontFamily: FONT.mono }}>—</div><div style={{ padding: '3px 5px', textAlign: 'right', fontFamily: FONT.mono, fontWeight: 600 }}>{p.q3}</div>
              </div>
            ))}
            <div style={{ padding: '3px 6px', font: `400 7px ${FONT.sans}`, color: C.t3, borderTop: `1px solid ${C.cream}`, background: C.subtle }}>200 doors · FY-26 total 270 000 €</div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22, padding: '16px 30px 0' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, fontSize: 11, lineHeight: 1.55 }}>
            <div><strong style={{ color: C.navy }}>Tools:</strong> Permanent corners, back-wall kits, illuminated signage</div>
            <div><strong style={{ color: C.navy }}>Description:</strong> Permanent corners &amp; back-wall refresh on top doors · Brands: RB; OO; PR · Clients: Stars + Dom · Timing: Q3 2026</div>
            <div><strong style={{ color: C.navy }}>Costs drill down:</strong> 270K € — of which RB 117K€; OO 50K€; PR 48K€; MU 28K€; PO 27K€</div>
            <div><strong style={{ color: C.navy }}>KPI:</strong> +12% sell-out on refreshed doors</div>
            <div style={{ marginTop: 4, display: 'flex', gap: 18, position: 'relative' }}><span><strong style={{ color: C.navy }}>Avg | door:</strong> 1 350 €</span><span><strong style={{ color: C.navy }}>#Doors:</strong> 200</span><div className="dc-pin" style={{ top: -7, left: -26, background: C.dangerDeep, color: '#fff' }}>1</div></div>
          </div>
          <div>
            <div style={{ font: `500 9px ${FONT.sans}`, letterSpacing: '.14em', textTransform: 'uppercase', color: C.t3, marginBottom: 6 }}>Examples of previous executions</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
              {['Corner · Ray-Ban', 'Back wall · Prada'].map((t, i) => (
                <div key={i} style={{ aspectRatio: '3 / 4', background: C.cream, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8.5, color: C.t3, textAlign: 'center', lineHeight: 1.4 }}>Portrait<br />{t}</div>
              ))}
            </div>
          </div>
        </div>
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px', fontSize: 6.5, color: C.t3 }}><span>11</span><span>Strictly confidential — for internal use only. Do not share or forward.</span><span>EssilorLuxottica</span></div>
      </div>

      {/* pill */}
      <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(22,21,15,.86)', border: '1px solid rgba(244,238,223,.14)', backdropFilter: 'blur(10px)', borderRadius: 99, padding: '8px 10px 8px 16px', boxShadow: '0 18px 44px rgba(0,0,0,.5)' }}>
        <span style={{ fontSize: 12, color: 'rgba(244,238,223,.55)', fontVariantNumeric: 'tabular-nums' }}>11 / 39</span>
        <span style={{ width: 1, height: 20, background: 'rgba(244,238,223,.16)', margin: '0 4px' }} />
        <span style={{ font: `600 12.5px ${FONT.sans}`, color: C.darkText }}>Permanent Visibility · 270 K€</span>
        <span style={{ width: 1, height: 20, background: 'rgba(244,238,223,.16)', margin: '0 4px' }} />
        <div className="dc-btn" style={{ height: 32, padding: '0 13px', borderRadius: 99, border: '1px solid rgba(244,238,223,.2)', color: C.darkText, display: 'flex', alignItems: 'center', fontSize: 12.5, fontWeight: 600 }}>Comment <span style={{ marginLeft: 6, width: 16, height: 16, borderRadius: 99, background: C.dangerDeep, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9 }}>1</span></div>
        <div className="dc-btn" style={{ height: 32, padding: '0 14px', borderRadius: 99, border: '1px solid rgba(230,179,179,.5)', color: C.redGlow, display: 'flex', alignItems: 'center', fontSize: 12.5, fontWeight: 600 }}>Send back</div>
        <div className="dc-btn" style={{ height: 32, padding: '0 18px', borderRadius: 99, background: C.inkText, color: C.ink, display: 'flex', alignItems: 'center', fontSize: 12.5, fontWeight: 700 }}>Approve</div>
      </div>

      {/* recording */}
      <div style={{ position: 'absolute', top: 22, right: 24, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(22,21,15,.7)', border: '1px solid rgba(244,238,223,.12)', borderRadius: 99, padding: '6px 12px 6px 10px' }}>
          <span style={{ width: 7, height: 7, borderRadius: 99, background: C.gold2 }} />
          <span style={{ fontSize: 11.5, color: 'rgba(244,238,223,.75)' }}>Recording decisions · 7 approved</span>
        </div>
        <div style={{ fontSize: 11, color: 'rgba(244,238,223,.35)', fontFamily: FONT.mono }}>ESC</div>
      </div>
    </div>
  )
}
