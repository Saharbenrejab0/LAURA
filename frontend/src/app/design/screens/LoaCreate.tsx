'use client'
/**
 * 2d · LOA creation — multi-brand & multi-activity line editor (one row per
 * brand × activity, which is what the slide's many-row table requires).
 */
import { C, FONT, headerFields, createLines, brandGroups, brandPills, brandOptions } from '../_data'

const LINE_COLS = '20px 128px 150px 88px 68px 74px 96px 84px 26px'

export default function LoaCreate() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 900, background: C.canvas, color: C.ink }}>
      <div style={{ height: 56, flex: 'none', display: 'flex', alignItems: 'center', gap: 14, padding: '0 22px', background: '#FFFFFF', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ fontFamily: FONT.display, fontSize: 20, fontWeight: 600 }}>LAURA<span style={{ color: C.gold }}>.</span></div>
        <div style={{ fontSize: 12.5, color: C.t2 }}>New LOA · draft · saved 2 min ago</div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 9 }}>
          <div className="dc-btn" style={{ height: 32, padding: '0 13px', borderRadius: 8, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', fontSize: 12, fontWeight: 600, color: C.t2 }}>⧉ Preview slide</div>
          <div className="dc-btn" style={{ height: 32, padding: '0 15px', borderRadius: 8, background: C.ink, color: C.inkText, display: 'flex', alignItems: 'center', fontSize: 12, fontWeight: 600 }}>Submit for review</div>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '1fr 356px' }}>
        {/* editor */}
        <div style={{ minWidth: 0, padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14, overflow: 'hidden' }}>
          {/* section 1 */}
          <div style={{ background: '#FFFFFF', border: `1px solid ${C.border}`, borderRadius: 12, boxShadow: '0 1px 2px rgba(26,24,21,.06)', padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 12, borderBottom: `1px solid ${C.border}`, marginBottom: 16 }}>
              <span style={{ width: 20, height: 20, borderRadius: 99, background: C.gold, color: '#F4F1EA', display: 'flex', alignItems: 'center', justifyContent: 'center', font: `700 11px ${FONT.sans}` }}>1</span>
              <span style={{ font: `600 12px ${FONT.sans}`, letterSpacing: '.16em', textTransform: 'uppercase', color: C.t3 }}>Location &amp; classification</span>
              <span style={{ marginLeft: 'auto', font: `400 11.5px ${FONT.sans}`, color: C.t3 }}>decides where the slide files in the deck</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14 }}>
              {headerFields.map((h, i) => (
                <div key={i}>
                  <div style={{ font: `600 12.5px ${FONT.sans}`, letterSpacing: '.04em', textTransform: 'uppercase', color: C.t2 }}>{h.label}<span style={{ color: C.danger, marginLeft: 2 }}>*</span></div>
                  <div style={{ marginTop: 6, height: 38, border: `1px solid ${h.bd}`, borderRadius: 8, background: '#FFFFFF', display: 'flex', alignItems: 'center', padding: '0 12px', font: `400 13.5px ${FONT.sans}`, color: C.ink }}>{h.value}<span style={{ marginLeft: 'auto', color: C.t3, fontSize: 10 }}>▾</span></div>
                  <div style={{ fontSize: 12, color: C.t3, marginTop: 4 }}>{h.hint}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 8, font: `400 12px ${FONT.sans}`, color: C.t2, background: C.subtle, border: `1px solid ${C.goldSoft}`, borderRadius: 8, padding: '9px 12px' }}>
              <span style={{ color: C.gold }}>✦</span> Will appear as <strong style={{ color: C.ink }}>Frames › Tailor Made Seasonal › Italy</strong> — slide title <em>“Seasonal Visibility: HB &amp; LB”</em>, generated from the brands you pick below.
            </div>
          </div>

          {/* section 2 */}
          <div style={{ background: '#FFFFFF', border: `1px solid ${C.border}`, borderRadius: 12, boxShadow: '0 1px 2px rgba(26,24,21,.06)', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 20px 12px', borderBottom: `1px solid ${C.border}` }}>
              <span style={{ width: 20, height: 20, borderRadius: 99, background: C.gold, color: '#F4F1EA', display: 'flex', alignItems: 'center', justifyContent: 'center', font: `700 11px ${FONT.sans}` }}>2</span>
              <span style={{ font: `600 12px ${FONT.sans}`, letterSpacing: '.16em', textTransform: 'uppercase', color: C.t3 }}>Investment lines</span>
              <span style={{ font: `400 11.5px ${FONT.sans}`, color: C.t3 }}>one row per brand × activity — this is the slide's table</span>
              <div className="dc-btn" style={{ marginLeft: 'auto', height: 30, padding: '0 12px', borderRadius: 7, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', fontSize: 11.5, fontWeight: 600, color: C.t2 }}>+ Add activity</div>
              <div className="dc-btn" style={{ height: 30, padding: '0 12px', borderRadius: 7, background: C.ink, color: C.inkText, display: 'flex', alignItems: 'center', fontSize: 11.5, fontWeight: 600 }}>+ Add brands</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: LINE_COLS, padding: '8px 17px', borderBottom: `1px solid ${C.border}`, font: `700 9px ${FONT.sans}`, letterSpacing: '.06em', textTransform: 'uppercase', color: C.t3 }}>
              <div /><div>Activity</div><div>Brand</div><div>Detail</div><div style={{ textAlign: 'right' }}># Doors</div><div style={{ textAlign: 'right' }}>Avg inv/door</div><div>Vendor</div><div style={{ textAlign: 'right' }}>Line total</div><div />
            </div>
            <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
              {createLines.map((c, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: LINE_COLS, alignItems: 'center', padding: '6px 17px', borderBottom: `1px solid ${C.borderSoft}`, background: c.bg, font: `400 11.5px ${FONT.sans}` }}>
                  <div style={{ color: C.borderStrong, fontSize: 10 }}>⠿</div>
                  <div style={{ color: c.actFg, fontWeight: Number(c.actWeight) }}>{c.activity}</div>
                  <div style={{ fontWeight: 600 }}>{c.brand}</div>
                  <div style={{ color: C.t2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.detail}</div>
                  <div style={{ textAlign: 'right', fontFamily: FONT.mono }}>{c.doors}</div>
                  <div style={{ textAlign: 'right', fontFamily: FONT.mono, paddingRight: 14 }}>{c.perDoor}</div>
                  <div style={{ color: C.t2 }}>{c.vendor}</div>
                  <div style={{ textAlign: 'right', fontFamily: FONT.mono, fontWeight: 600 }}>{c.total}</div>
                  <div style={{ textAlign: 'center', color: C.borderStrong, fontSize: 11 }}>✕</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: LINE_COLS, padding: '9px 17px', background: C.subtle, borderTop: `1px solid ${C.border}`, font: `600 11.5px ${FONT.sans}` }}>
              <div /><div style={{ gridColumn: '2 / 5' }}>9 lines · 3 activities · 8 brands</div>
              <div style={{ textAlign: 'right', fontFamily: FONT.mono }}>1 222</div>
              <div style={{ textAlign: 'right', fontFamily: FONT.mono, color: C.t2, paddingRight: 14 }}>453</div>
              <div />
              <div style={{ textAlign: 'right', fontFamily: FONT.mono, color: C.gold }}>554 500 €</div>
              <div />
            </div>
          </div>
        </div>

        {/* right sidebar */}
        <div style={{ background: '#FFFFFF', borderLeft: `1px solid ${C.border}`, padding: 18, display: 'flex', flexDirection: 'column', gap: 13, overflowY: 'auto' }}>
          {/* add brands */}
          <div style={{ border: `1px solid ${C.gold}`, borderRadius: 11, boxShadow: '0 8px 26px rgba(26,24,21,.10)' }}>
            <div style={{ padding: '12px 14px', borderBottom: `1px solid ${C.goldSoft}`, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ font: `600 12.5px ${FONT.sans}` }}>Add brands</span>
              <span style={{ font: `500 10.5px ${FONT.sans}`, background: C.goldSoft, color: C.warn, borderRadius: 99, padding: '3px 8px' }}>8 selected</span>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: C.t3 }}>multi-select</span>
            </div>
            <div style={{ padding: '11px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <div style={{ font: `600 9.5px ${FONT.sans}`, letterSpacing: '.08em', textTransform: 'uppercase', color: C.t3, marginBottom: 6 }}>Group shortcuts</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {brandGroups.map((g, i) => (
                    <span key={i} className="dc-btn" style={{ font: `600 11px ${FONT.sans}`, border: `1px solid ${g.bd}`, background: g.bg, color: g.fg, borderRadius: 99, padding: '5px 11px' }}>{g.label}</span>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ font: `600 9.5px ${FONT.sans}`, letterSpacing: '.08em', textTransform: 'uppercase', color: C.t3, marginBottom: 6 }}>Brands</div>
                <div style={{ minHeight: 38, padding: '6px 10px', border: `1px solid ${C.border}`, borderRadius: '8px 8px 0 0', background: C.subtle, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                  {brandPills.map((p, i) => (
                    <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, font: `500 10.5px ${FONT.sans}`, background: C.cream, border: `1px solid ${C.border}`, borderRadius: 6, padding: '2px 7px' }}>{p.label} <span style={{ color: C.t3 }}>×</span></span>
                  ))}
                  <span style={{ marginLeft: 'auto', color: C.t3, fontSize: 11 }}>▾</span>
                </div>
                <div style={{ border: `1px solid ${C.borderStrong}`, borderTop: 'none', borderRadius: '0 0 8px 8px', background: '#FFFFFF', boxShadow: '0 4px 16px rgba(26,24,21,.08)', maxHeight: 154, overflow: 'hidden' }}>
                  {brandOptions.map((b, i) => (
                    <div key={i} className="dc-btn" style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 11px', font: `400 12px ${FONT.sans}`, background: b.bg }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 14, height: 14, border: `2px solid ${b.boxBd}`, borderRadius: 3, background: b.boxBg, color: '#fff', fontSize: 9 }}>{b.check}</span>{b.label}
                      <span style={{ marginLeft: 'auto', font: `500 10.5px ${FONT.mono}`, color: C.t3 }}>{b.hint}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: C.subtle, border: `1px solid ${C.border}`, borderRadius: 8, padding: '9px 11px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ font: `600 10px ${FONT.sans}`, color: C.t2 }}>Apply to all new lines</div>
                  <div style={{ fontSize: 10.5, color: C.t3, marginTop: 2 }}>Doors 33 · Avg inv/door 455 · Vendor Factory Group</div>
                </div>
                <div className="dc-btn" style={{ height: 30, padding: '0 12px', borderRadius: 7, background: C.ink, color: C.inkText, display: 'flex', alignItems: 'center', fontSize: 11.5, fontWeight: 600 }}>Add 8 lines</div>
              </div>
            </div>
          </div>

          {/* photos */}
          <div style={{ border: `1px solid ${C.border}`, borderRadius: 11, padding: '13px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 9 }}>
              <span style={{ font: `600 12.5px ${FONT.sans}` }}>Photos</span>
              <span style={{ font: `600 11px ${FONT.mono}`, color: C.gold }}>1/2</span>
              <span style={{ fontSize: 11, color: C.t3 }}>— required for CEO presentation</span>
            </div>
            <div style={{ fontSize: 11, color: C.t3, marginBottom: 9 }}>Previous edition photos · Reference photos · Creative renders/concepts</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
              <div style={{ height: 64, borderRadius: 8, background: C.cream, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: C.t2 }}>Photo 1</div>
              <div className="dc-btn" style={{ height: 64, borderRadius: 8, border: `1px dashed ${C.borderStrong}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: C.t3, lineHeight: 1.6 }}>+ Add photo</div>
            </div>
            <div style={{ fontSize: 11, color: C.t3, marginTop: 8 }}>1 photo prints landscape on the slide · 2 print as a portrait pair</div>
            <div style={{ marginTop: 11, paddingTop: 11, borderTop: `1px solid ${C.cream}`, display: 'flex', flexDirection: 'column', gap: 7, font: `400 12px ${FONT.sans}`, color: C.t2 }}>
              {['Section 7 — Description · Detail/Tools · KPI · Timing', 'Cost Drill Down — auto-built per brand'].map((t, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ width: 15, height: 15, borderRadius: 99, background: C.successBg, color: C.success, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9 }}>✓</span>{t}</div>
              ))}
            </div>
          </div>

          {/* laura checks */}
          <div style={{ border: `1px solid ${C.goldSoft}`, background: C.subtle, borderRadius: 11, padding: '13px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}><span style={{ color: C.gold }}>✦</span><span style={{ font: `600 12px ${FONT.sans}` }}>Laura checks</span></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 9, font: `400 11.5px/1.5 ${FONT.sans}` }}>
              <div style={{ color: C.success }}>✓ Drill-down equals the sum of the 9 lines</div>
              <div style={{ color: C.warn }}>~ Ray-Ban at 500 €/door is 2,1× your cluster median</div>
              <div style={{ color: C.warn }}>~ 19 brand lines will split the slide into (1 / 2)</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
