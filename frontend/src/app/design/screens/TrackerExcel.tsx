'use client'
/**
 * 2c · Excel view for the CFO — the validation session as a spreadsheet, the
 * deck hierarchy kept as grouped rows, with a session total + summary dock.
 */
import Link from 'next/link'
import { C, FONT, excelFilters, excelRows } from '../_data'

const COLS = '26px 250px 62px 128px 40px 118px 150px 56px 62px 96px 74px 74px 84px 96px'

export default function TrackerExcel() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 900, background: C.canvas, color: C.ink }}>
      {/* top bar */}
      <div style={{ height: 56, flex: 'none', display: 'flex', alignItems: 'center', gap: 14, padding: '0 22px', background: '#FFFFFF', borderBottom: `1px solid ${C.border}` }}>
        <Link href="/" style={{ fontFamily: FONT.display, fontSize: 20, fontWeight: 600, color: C.ink, textDecoration: 'none' }}>LAURA<span style={{ color: C.gold }}>.</span></Link>
        <div style={{ fontSize: 12.5, color: C.t2 }}>Q3 2026 validation session · <strong style={{ color: C.ink }}>Reviewing as CFO</strong></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 6, padding: 3, background: C.cream, borderRadius: 9 }}>
          {['List', 'Deck', 'Excel'].map((v) => {
            const on = v === 'Excel'
            return <span key={v} style={{ height: 26, padding: '0 12px', borderRadius: 6, display: 'flex', alignItems: 'center', fontSize: 11.5, fontWeight: on ? 600 : 500, color: on ? C.ink : C.t2, background: on ? '#fff' : 'transparent', boxShadow: on ? '0 1px 2px rgba(26,24,21,.06)' : 'none' }}>{v}</span>
          })}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{ display: 'inline-flex', background: C.canvas, border: `1px solid ${C.goldSoft}`, borderRadius: 9, overflow: 'hidden' }}>
            {['By Section', 'By Cluster', 'By Quarter'].map((g) => {
              const on = g === 'By Section'
              return <span key={g} className="dc-btn" style={{ padding: '7px 15px', background: on ? C.ink : 'transparent', color: on ? '#F4F1EA' : C.ink, fontSize: 12, fontWeight: 600 }}>{g}</span>
            })}
          </div>
          <div className="dc-btn" style={{ height: 32, padding: '0 12px', borderRadius: 8, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', fontSize: 12, fontWeight: 600, color: C.t2 }}>↧ Export xlsx · 39 cols</div>
          <div className="dc-btn" style={{ height: 32, padding: '0 14px', borderRadius: 8, background: C.ink, color: C.inkText, display: 'flex', alignItems: 'center', fontSize: 12, fontWeight: 600 }}>⧉ Open slide</div>
        </div>
      </div>

      {/* filter strip */}
      <div style={{ height: 40, flex: 'none', display: 'flex', alignItems: 'center', gap: 10, padding: '0 22px', background: C.subtle, borderBottom: `1px solid ${C.border}` }}>
        <span style={{ font: `600 10.5px ${FONT.sans}`, letterSpacing: '.08em', textTransform: 'uppercase', color: C.t3 }}>Filters</span>
        {excelFilters.map((f, i) => (
          <span key={i} style={{ font: `500 11.5px ${FONT.sans}`, background: '#FFFFFF', border: `1px solid ${C.border}`, borderRadius: 7, padding: '5px 10px', color: C.t2 }}>{f.label} <span style={{ color: C.t3 }}>▾</span></span>
        ))}
        <span style={{ marginLeft: 'auto', font: `500 11.5px ${FONT.mono}`, color: C.t2 }}>1 248 lines · 376 LOAs · columns 1–16 of 39 · ⸻ more</span>
      </div>

      {/* grid */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: '#FFFFFF', overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: COLS, background: C.cream, borderBottom: `1px solid ${C.borderStrong}`, font: `700 9px ${FONT.sans}`, letterSpacing: '.05em', color: C.t2, textTransform: 'uppercase' }}>
          {['', 'Section / LOA / line', 'Country', 'Type/Planning 2.0', 'COT', 'Customer', 'Brand', '# Doors', 'Avg Inv/Door', 'Vendor', 'Q3-26', 'Q4-26', 'FY-26 Total', 'Decision'].map((h, i) => (
            <div key={i} style={{ padding: '8px 6px', textAlign: [7, 8, 10, 11, 12].includes(i) ? 'right' : i === 13 ? 'center' : 'left', borderRight: i < 13 ? `1px solid ${C.border}` : 'none' }}>{h}</div>
          ))}
        </div>
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          {excelRows.map((e, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: COLS, background: e.bg, borderBottom: `1px solid ${e.bd}`, alignItems: 'center', font: e.font, color: e.fg }}>
              <div style={{ padding: '5px 4px', textAlign: 'center', color: C.t3, fontSize: 8, borderRight: `1px solid ${C.cream}` }}>{e.chev}</div>
              <div style={{ padding: '5px 8px', paddingLeft: e.indent, borderRight: `1px solid ${C.cream}`, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name}</div>
              <div style={{ padding: '5px 6px', borderRight: `1px solid ${C.cream}` }}>{e.country}</div>
              <div style={{ padding: '5px 6px', borderRight: `1px solid ${C.cream}`, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.activity}</div>
              <div style={{ padding: '5px 4px', borderRight: `1px solid ${C.cream}` }}>{e.cot}</div>
              <div style={{ padding: '5px 6px', borderRight: `1px solid ${C.cream}`, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.customer}</div>
              <div style={{ padding: '5px 6px', borderRight: `1px solid ${C.cream}`, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.brand}</div>
              <div style={{ padding: '5px 6px', textAlign: 'right', fontFamily: FONT.mono, borderRight: `1px solid ${C.cream}` }}>{e.doors}</div>
              <div style={{ padding: '5px 8px 5px 6px', textAlign: 'right', fontFamily: FONT.mono, borderRight: `1px solid ${C.cream}`, color: e.doorFg }}>{e.perDoor}</div>
              <div style={{ padding: '5px 6px', borderRight: `1px solid ${C.cream}`, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.vendor}</div>
              <div style={{ padding: '5px 6px', textAlign: 'right', fontFamily: FONT.mono, borderRight: `1px solid ${C.cream}` }}>{e.q3}</div>
              <div style={{ padding: '5px 6px', textAlign: 'right', fontFamily: FONT.mono, borderRight: `1px solid ${C.cream}` }}>{e.q4}</div>
              <div style={{ padding: '5px 6px', textAlign: 'right', fontFamily: FONT.mono, fontWeight: 600, borderRight: `1px solid ${C.cream}` }}>{e.total}</div>
              <div style={{ padding: '5px 6px', textAlign: 'center' }}>{e.dec && <span style={{ font: `600 9px ${FONT.sans}`, background: e.decBg, color: e.decFg, borderRadius: 99, padding: '2px 7px' }}>{e.dec}</span>}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: COLS, background: C.ink, color: '#F4EEDF', font: `600 10.5px ${FONT.sans}`, alignItems: 'center' }}>
          <div /><div style={{ padding: '9px 8px' }}>Session total</div><div /><div /><div /><div /><div />
          <div style={{ padding: '9px 6px', textAlign: 'right', fontFamily: FONT.mono }}>14 620</div>
          <div style={{ padding: '9px 6px', textAlign: 'right', fontFamily: FONT.mono, color: C.darkMuted }}>avg 412</div>
          <div />
          <div style={{ padding: '9px 6px', textAlign: 'right', fontFamily: FONT.mono }}>19,4 M</div>
          <div style={{ padding: '9px 6px', textAlign: 'right', fontFamily: FONT.mono }}>14,7 M</div>
          <div style={{ padding: '9px 6px', textAlign: 'right', fontFamily: FONT.mono, color: C.gold2 }}>34,1 M€</div>
          <div style={{ padding: '9px 6px', textAlign: 'center', color: C.greenGlow }}>31 ✓ · 5 ↺</div>
        </div>
      </div>

      {/* summary dock */}
      <div style={{ height: 100, flex: 'none', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', alignItems: 'center', gap: 26, padding: '0 26px', background: C.ink, borderTop: `2px solid rgba(176,141,47,.5)`, color: '#F4F1EA' }}>
        <div>
          <div style={{ font: `600 11px ${FONT.sans}`, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(244,241,234,.5)' }}>Total cycle budget</div>
          <div style={{ font: `600 28px ${FONT.sans}`, fontVariantNumeric: 'tabular-nums', marginTop: 3 }}>EUR 34.10M</div>
          <div style={{ fontSize: 12, color: 'rgba(244,241,234,.5)' }}>376 LOAs · 1 248 lines</div>
        </div>
        {[['Frames 54%', '54%', 'EUR 18.40M / EUR 14.30M'], ['OpEx 85%', '85%', 'EUR 28.90M / EUR 5.20M']].map(([lbl, pct, sub], i) => (
          <div key={i}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, height: 10, borderRadius: 5, background: 'rgba(244,241,234,.14)' }}><div style={{ width: pct, height: '100%', borderRadius: 5, background: C.gold }} /></div>
              <span style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{lbl}</span>
            </div>
            <div style={{ fontSize: 11, color: 'rgba(244,241,234,.4)', marginTop: 5 }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* selection bar */}
      <div style={{ height: 58, flex: 'none', display: 'flex', alignItems: 'center', gap: 12, padding: '0 26px', background: '#FFFFFF', borderTop: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 12, color: C.t2 }}>Selected <strong style={{ color: C.ink }}>3 lines</strong> · 214 500 € · all Tailor Made Seasonal / Italy</div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 9 }}>
          <div className="dc-btn" style={{ height: 36, padding: '0 14px', borderRadius: 9, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', fontSize: 12.5, fontWeight: 600, color: C.t2 }}>Comment on selection</div>
          <div className="dc-btn" style={{ height: 36, padding: '0 14px', borderRadius: 9, border: `1.5px solid ${C.dangerBd}`, color: C.dangerDeep, display: 'flex', alignItems: 'center', fontSize: 12.5, fontWeight: 600 }}>Send lines back</div>
          <div className="dc-btn" style={{ height: 36, padding: '0 18px', borderRadius: 9, background: C.ink, color: C.inkText, display: 'flex', alignItems: 'center', fontSize: 12.5, fontWeight: 600 }}>Approve selection</div>
        </div>
      </div>
    </div>
  )
}
