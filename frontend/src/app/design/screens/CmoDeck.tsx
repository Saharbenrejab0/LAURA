'use client'
/**
 * 1a · CMO Deck Session — slide-first review, comments pinned to slide zones.
 * Interactive: click a zone or a comment card to open its pinned bubble,
 * navigate slides, approve (updates the decided counter + progress).
 * Faithful port of the DCLogic component from the design doc.
 */
import { useState } from 'react'
import { C, FONT, rows, slideComments } from '../_data'
import { Rail, TopBar } from '../_chrome'

const film = [
  { label: 'FRAMES', done: 'ok' }, { label: 'TM Seasonal', done: 'ok' },
  { label: 'HB & LB', done: 'live' }, { label: 'All HBs', done: 'todo' },
  { label: 'All LBs', done: 'todo' }, { label: 'High Vis LBs', done: 'todo' },
  { label: 'Digital Win.', done: 'todo' },
]

export default function CmoDeck() {
  const [open, setOpen] = useState<string | null>(null)
  const [decided, setDecided] = useState(3)
  const [slide, setSlide] = useState(5)
  const [approved, setApproved] = useState(false)

  const c = open ? slideComments[open] : null
  const zone1Bg = open === 'new' || open === '1' ? 'rgba(176,141,47,.16)' : 'transparent'
  const zone2Bg = open === 'new' ? 'rgba(176,141,47,.16)' : 'transparent'
  const progressPct = Math.round((decided / 18) * 100) + '%'
  const approve = () => { setApproved(true); setDecided(d => Math.min(18, d + 1)) }

  const Pin = ({ id, glyph, bg, style }: { id: string; glyph: string; bg: string; style: React.CSSProperties }) => (
    <div className="dc-pin" onClick={() => setOpen(open === id ? null : id)} style={{ background: bg, color: '#fff', ...style }}>{glyph}</div>
  )

  return (
    <div style={{ display: 'flex', height: 900, background: C.canvas, color: C.ink }}>
      <Rail active="review" />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <TopBar section="CMO Review" />

        {/* session header */}
        <div style={{ height: 60, flex: 'none', display: 'flex', alignItems: 'center', gap: 18, padding: '0 24px', background: '#FFFFFF', borderBottom: `1px solid ${C.border}` }}>
          <div>
            <div style={{ fontFamily: FONT.display, fontSize: 21, fontWeight: 600, lineHeight: 1.1 }}>EMEA PS — Q3 2026 validation session</div>
            <div style={{ fontSize: 11, color: C.t3, letterSpacing: '.03em' }}>Presenting to Alexandra (CMO) &amp; Marc (CFO) · driven by Thibault</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 20 }}>
            <span style={{ font: `600 10px ${FONT.sans}`, letterSpacing: '.09em', textTransform: 'uppercase', color: C.gold, background: C.goldSoft, borderRadius: 99, padding: '4px 10px' }}>Frames</span>
            <span style={{ color: C.borderStrong }}>›</span>
            <span style={{ font: `600 11px ${FONT.sans}`, color: C.ink }}>Tailor Made Seasonal</span>
            <span style={{ color: C.borderStrong }}>›</span>
            <span style={{ font: `400 11px ${FONT.sans}`, color: C.t2 }}>Slide 3 of 5</span>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ font: `600 11px ${FONT.sans}`, color: C.t2, fontVariantNumeric: 'tabular-nums' }}>{decided} of 18 decided</div>
              <div style={{ width: 180, height: 5, borderRadius: 3, background: C.cream, marginTop: 4 }}><div style={{ height: '100%', borderRadius: 3, background: C.gold, width: progressPct }} /></div>
            </div>
            <div className="dc-btn" style={{ height: 32, padding: '0 12px', borderRadius: 8, border: `1px solid ${C.border}`, background: '#FFFFFF', display: 'flex', alignItems: 'center', fontSize: 12, fontWeight: 600, color: C.t2 }}>▶ Present</div>
          </div>
        </div>

        {/* body */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
          {/* slide stage */}
          <div style={{ flex: 1, minWidth: 0, background: C.stage, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '22px 26px' }}>
            <div style={{ width: 1000, aspectRatio: '16 / 9', flex: 'none', background: '#FFFFFF', boxShadow: '0 24px 60px rgba(0,0,0,.45)', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: C.navy }} />
              <div style={{ padding: '20px 26px 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ font: `600 21px/1.2 ${FONT.sans}`, color: C.navy }}>Seasonal Visibility: HB &amp; LB</div>
                  <div style={{ font: `500 10px ${FONT.sans}`, letterSpacing: '.14em', textTransform: 'uppercase', color: C.t3, marginTop: 5 }}>Tailor Made Seasonal · Super Trade Light</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ font: `500 10px ${FONT.sans}`, letterSpacing: '.14em', textTransform: 'uppercase', color: C.t3 }}>Frames · Italy</div>
                  <div style={{ font: `600 26px/1.1 ${FONT.display}`, color: C.ink, marginTop: 2 }}>554,5 K€</div>
                </div>
              </div>

              {/* brand table */}
              <div style={{ padding: '12px 26px 0', position: 'relative' }}>
                <div style={{ border: `1px solid ${C.border}` }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '52px 118px 118px 118px 82px 48px 62px 92px 62px 62px 62px', background: C.navy, color: '#fff', font: `700 7px ${FONT.sans}`, letterSpacing: '.04em' }}>
                    {['COUNTRY', 'TYPE / PLANNING', 'CUSTOMER', 'BRAND', 'DETAIL', '#DOORS', 'AVG/DOOR', 'VENDOR', 'Q3-26', 'Q4-26', 'FY-26'].map((h, i) => (
                      <div key={i} style={{ padding: '5px 5px', textAlign: i >= 8 ? 'right' : 'left' }}>{h}</div>
                    ))}
                  </div>
                  {rows.map((r, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '52px 118px 118px 118px 82px 48px 62px 92px 62px 62px 62px', font: `400 7.5px/1.5 ${FONT.sans}`, color: C.ink, borderTop: `1px solid ${C.cream}`, background: r.bg }}>
                      <div style={{ padding: '3px 5px' }}>Italy</div>
                      <div style={{ padding: '3px 5px' }}>TM Seasonal</div>
                      <div style={{ padding: '3px 5px' }}>Top Loc, Dom, Stars</div>
                      <div style={{ padding: '3px 5px', fontWeight: 600 }}>{r.brand}</div>
                      <div style={{ padding: '3px 5px' }}>STL Set Up</div>
                      <div style={{ padding: '3px 5px' }}>{r.doors}</div>
                      <div style={{ padding: '3px 5px' }}>{r.avg}</div>
                      <div style={{ padding: '3px 5px' }}>Vetrina in</div>
                      <div style={{ padding: '3px 5px', textAlign: 'right', fontFamily: FONT.mono }}>{r.q3}</div>
                      <div style={{ padding: '3px 5px', textAlign: 'right', fontFamily: FONT.mono }}>—</div>
                      <div style={{ padding: '3px 5px', textAlign: 'right', fontFamily: FONT.mono, fontWeight: 600 }}>{r.q3}</div>
                    </div>
                  ))}
                  <div style={{ padding: '3px 6px', font: `400 7px ${FONT.sans}`, color: C.t3, borderTop: `1px solid ${C.cream}`, background: C.subtle }}>+ 7 more brand lines · 1 222 doors · FY-26 total 554 500 €</div>
                </div>
                <Pin id="2" glyph="2" bg={C.warn} style={{ top: 34, left: 150 }} />
              </div>

              {/* text block + photos */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 268px', gap: 22, padding: '12px 26px 22px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, position: 'relative' }}>
                  <div><span style={{ font: `600 9.5px ${FONT.sans}`, color: C.navy }}>Tools: </span><span style={{ fontSize: 9.5, color: C.ink }}>Windows covering · Super Trade Light set-up</span></div>
                  <div><span style={{ font: `600 9.5px ${FONT.sans}`, color: C.navy }}>Description: </span><span style={{ fontSize: 9.5, color: C.ink }}>Seasonal Visibilities — Super Trade Light · Brands: VO; PO; OV; AO; RB; ME; BC; VE; EA; AR; MK; OO; PR; MU; PS; DG; BE; TF; JC · Clients: Stars + Dom + Top Loc · Timing of installation: Q3–Q4 2026</span></div>
                  <div style={{ position: 'relative', padding: '3px 4px', margin: '-3px -4px' }}>
                    <span style={{ font: `600 9.5px ${FONT.sans}`, color: C.navy }}>Costs drill down: </span>
                    <span style={{ fontSize: 9.5, color: C.ink }}>554,5K € — of which VO 27K€; PO 36K€; OV 23K€; AO 10K€; RB 120K€; ME 6K€; BC 12K€; VE 40,5K€; EA 40K€; AR 18K€; MK 18K€; OO 8K€; PR 54K€; MU 40K€; PS 11K€; DG 31,5K€; BE 13,5K€; JC 13,5K€; TD 22,5K€</span>
                    <div className="dc-zone" onClick={() => setOpen(open === 'new' ? null : 'new')} style={{ inset: 0, background: zone1Bg }} />
                    <Pin id="1" glyph="1" bg={C.dangerDeep} style={{ top: -8, left: -14 }} />
                  </div>
                  <div><span style={{ font: `600 9.5px ${FONT.sans}`, color: C.navy }}>KPI: </span><span style={{ fontSize: 9.5, color: C.ink }}>Estimated +10–15% increase in sell out</span></div>
                  <div style={{ display: 'flex', gap: 18, marginTop: 2, position: 'relative', padding: 4, marginLeft: -4, alignSelf: 'flex-start' }}>
                    <div><span style={{ font: `600 9.5px ${FONT.sans}`, color: C.navy }}>Avg investment | door: </span><span style={{ font: `600 11px ${FONT.sans}`, color: C.ink }}>453 €</span></div>
                    <div><span style={{ font: `600 9.5px ${FONT.sans}`, color: C.navy }}>#Doors: </span><span style={{ font: `600 11px ${FONT.sans}`, color: C.ink }}>1 222</span></div>
                    <div className="dc-zone" onClick={() => setOpen(open === 'new' ? null : 'new')} style={{ inset: 0, background: zone2Bg }} />
                    <Pin id="new" glyph="✦" bg={C.gold} style={{ top: -7, right: -11 }} />
                  </div>
                </div>
                <div>
                  <div style={{ font: `500 9px ${FONT.sans}`, letterSpacing: '.14em', textTransform: 'uppercase', color: C.t3, marginBottom: 6 }}>Examples of previous executions</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
                    {['Window · Ray-Ban', 'Window · Prada'].map((t, i) => (
                      <div key={i} style={{ aspectRatio: '3 / 4', background: C.cream, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8.5, color: C.t3, textAlign: 'center', lineHeight: 1.4 }}>Portrait<br />{t}</div>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px', fontSize: 6.5, color: C.t3, letterSpacing: '.06em' }}>
                <span>5</span><span>Strictly confidential — for internal use only. Do not share or forward.</span><span>EssilorLuxottica</span>
              </div>

              {/* comment bubble */}
              {c && (
                <div style={{ position: 'absolute', top: c.top, left: c.left, width: 268, background: '#FFFFFF', border: `1px solid ${C.borderStrong}`, borderRadius: 10, boxShadow: '0 16px 48px rgba(26,24,21,.28)', padding: '12px 13px', zIndex: 9 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <div style={{ width: 22, height: 22, borderRadius: 99, background: c.avatar, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', font: `700 9px ${FONT.sans}` }}>{c.initials}</div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ font: `600 11.5px ${FONT.sans}`, color: C.ink }}>{c.author}</div>
                      <div style={{ fontSize: 9.5, color: C.t3 }}>{c.meta}</div>
                    </div>
                    <div className="dc-btn" onClick={() => setOpen(null)} style={{ marginLeft: 'auto', width: 20, height: 20, borderRadius: 6, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: C.t2 }}>✕</div>
                  </div>
                  <div style={{ font: `400 11.5px/1.55 ${FONT.sans}`, color: C.ink, marginTop: 8 }}>{c.body}</div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                    <div className="dc-btn" style={{ padding: '5px 11px', borderRadius: 7, background: C.ink, color: C.inkText, fontSize: 10.5, fontWeight: 600 }}>Reply</div>
                    <div className="dc-btn" style={{ padding: '5px 11px', borderRadius: 7, border: `1px solid ${C.border}`, color: C.t2, fontSize: 10.5, fontWeight: 600 }}>Resolve</div>
                    <div className="dc-btn" style={{ padding: '5px 11px', borderRadius: 7, border: `1px solid ${C.dangerBd}`, color: C.dangerDeep, fontSize: 10.5, fontWeight: 600, marginLeft: 'auto' }}>Send back</div>
                  </div>
                </div>
              )}
            </div>

            {/* slide nav */}
            <div style={{ position: 'absolute', left: 26, bottom: 22, display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="dc-btn" onClick={() => setSlide(s => Math.max(1, s - 1))} style={{ width: 30, height: 30, borderRadius: 99, background: 'rgba(255,255,255,.12)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>‹</div>
              <span style={{ fontSize: 11.5, color: 'rgba(244,238,223,.55)', fontVariantNumeric: 'tabular-nums' }}>Slide {slide} / 39</span>
              <div className="dc-btn" onClick={() => setSlide(s => Math.min(39, s + 1))} style={{ width: 30, height: 30, borderRadius: 99, background: 'rgba(255,255,255,.12)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>›</div>
            </div>
            <div style={{ position: 'absolute', right: 26, bottom: 22, display: 'flex', alignItems: 'center', gap: 8, fontSize: 10.5, color: 'rgba(244,238,223,.45)' }}>
              <span style={{ fontFamily: FONT.mono, border: '1px solid rgba(244,238,223,.22)', borderRadius: 4, padding: '1px 5px' }}>C</span> comment zone
              <span style={{ fontFamily: FONT.mono, border: '1px solid rgba(244,238,223,.22)', borderRadius: 4, padding: '1px 5px', marginLeft: 6 }}>A</span> approve
            </div>
          </div>

          {/* comment rail */}
          <div style={{ width: 340, flex: 'none', background: '#FFFFFF', borderLeft: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ padding: '14px 16px 10px', borderBottom: `1px solid ${C.border}`, background: C.subtle }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ color: C.gold, fontSize: 12 }}>✦</span><span style={{ font: `600 11.5px ${FONT.sans}`, color: C.ink }}>Laura, in one line</span></div>
              <div style={{ font: `400 12px/1.6 ${FONT.sans}`, color: C.ink, marginTop: 6 }}>19 brands, 1 222 doors, mostly Q3. In line with last cycle — <strong style={{ color: C.dangerDeep }}>except Ray-Ban at 120K€ (22% of the slide)</strong> and an avg/door of 453 €, 2.1× the Italy median.</div>
              <div style={{ display: 'flex', gap: 6, marginTop: 9 }}>
                <span style={{ font: `600 9.5px ${FONT.sans}`, background: C.dangerBg2, color: C.dangerDeep, borderRadius: 99, padding: '3px 8px' }}>1 outlier</span>
                <span style={{ font: `600 9.5px ${FONT.sans}`, background: C.warnBg, color: C.warn, borderRadius: 99, padding: '3px 8px' }}>Cost/door high</span>
                <span style={{ font: `600 9.5px ${FONT.sans}`, background: C.successBg, color: C.success, borderRadius: 99, padding: '3px 8px' }}>Budget on track</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '9px 16px', borderBottom: `1px solid ${C.border}` }}>
              <span style={{ font: `600 12px ${FONT.sans}`, color: C.ink, borderBottom: `2px solid ${C.gold}`, paddingBottom: 6, marginBottom: -9 }}>On this slide 2</span>
              <span style={{ font: `500 12px ${FONT.sans}`, color: C.t3 }}>Resolved 3</span>
              <span style={{ marginLeft: 'auto', fontSize: 10.5, color: C.t3 }}>Pins visible</span>
            </div>
            <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="dc-btn" onClick={() => setOpen(open === '1' ? null : '1')} style={{ border: `1px solid ${open === '1' ? C.gold : C.border}`, borderRadius: 10, padding: '11px 12px', background: open === '1' ? C.subtle : '#FFFFFF' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="dc-pin" style={{ position: 'static', background: C.dangerDeep, color: '#fff' }}>1</span>
                  <div><div style={{ font: `600 11.5px ${FONT.sans}` }}>Alexandra</div><div style={{ fontSize: 9.5, color: C.t3 }}>Regional CMO · entered by Thibault</div></div>
                  <span style={{ marginLeft: 'auto', fontSize: 9.5, color: C.t3 }}>now</span>
                </div>
                <div style={{ font: `400 11.5px/1.55 ${FONT.sans}`, marginTop: 7, color: C.ink }}>Ray-Ban at 120K€ inside a Super Trade Light slide is too heavy — phase it: Q3 pilot on 120 doors, rest to Q4.</div>
                <div style={{ font: `500 9.5px ${FONT.sans}`, color: C.t3, marginTop: 6 }}>pinned to <span style={{ color: C.gold }}>Costs drill down</span></div>
              </div>
              <div className="dc-btn" onClick={() => setOpen(open === '2' ? null : '2')} style={{ border: `1px solid ${open === '2' ? C.gold : C.border}`, borderRadius: 10, padding: '11px 12px', background: open === '2' ? C.subtle : '#FFFFFF' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="dc-pin" style={{ position: 'static', background: C.warn, color: '#fff' }}>2</span>
                  <div><div style={{ font: `600 11.5px ${FONT.sans}` }}>Marc</div><div style={{ fontSize: 9.5, color: C.t3 }}>Regional CFO</div></div>
                  <span style={{ marginLeft: 'auto', fontSize: 9.5, color: C.t3 }}>2 min</span>
                </div>
                <div style={{ font: `400 11.5px/1.55 ${FONT.sans}`, marginTop: 7, color: C.ink }}>Confirm the Vetrina In rate card is the 2026 one before we lock 554,5K€.</div>
                <div style={{ font: `500 9.5px ${FONT.sans}`, color: C.t3, marginTop: 6 }}>pinned to <span style={{ color: C.gold }}>brand table, row 12</span></div>
              </div>
              <div style={{ border: `1px dashed ${C.borderStrong}`, borderRadius: 10, padding: '10px 12px', font: `400 11px/1.5 ${FONT.sans}`, color: C.t3 }}>Click any zone on the slide to pin a new comment there.</div>
            </div>
            <div style={{ padding: '12px 16px', borderTop: `1px solid ${C.border}`, background: C.subtle }}>
              <div style={{ fontSize: 10.5, color: C.t3 }}>Speaking as <strong style={{ color: C.ink }}>Alexandra — Regional CMO</strong> · entered by Thibault</div>
              <div style={{ marginTop: 7, border: `1px solid ${C.border}`, borderRadius: 8, background: '#FFFFFF', padding: '8px 10px', fontSize: 11.5, color: C.t3 }}>Comment on this slide, or click a zone to pin…</div>
            </div>
          </div>
        </div>

        {/* decision bar */}
        <div style={{ height: 96, flex: 'none', background: '#FFFFFF', borderTop: `1px solid ${C.border}`, boxShadow: '0 -6px 18px rgba(26,24,21,.05)', display: 'flex', alignItems: 'center', gap: 16, padding: '0 24px' }}>
          <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
            {film.map((f, i) => {
              const live = f.done === 'live'
              return (
                <div key={i} className="dc-film" onClick={() => setSlide(5 + i)} style={{ width: 88, height: 50, borderRadius: 5, border: live ? `2px solid ${C.gold}` : `1px solid ${C.darkLine2}`, background: live ? C.darkPanel2 : C.darkPanel, position: 'relative', display: 'flex', alignItems: 'flex-end', padding: 4, overflow: 'hidden' }}>
                  <span style={{ font: `600 7.5px ${FONT.sans}`, color: f.done === 'todo' ? C.darkMuted : C.darkText, lineHeight: 1.2 }}>{f.label}</span>
                  <div style={{ position: 'absolute', top: 3, right: 3, width: 11, height: 11, borderRadius: 99, background: f.done === 'ok' ? C.success : live ? C.gold : 'transparent' }} />
                </div>
              )
            })}
          </div>
          <div style={{ width: 1, height: 52, background: C.border }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ font: `600 13.5px ${FONT.sans}`, color: C.ink }}>Seasonal Visibility: HB &amp; LB · Italy</div>
            <div style={{ fontSize: 11.5, color: C.t2 }}>LOA-26-013 · Tailor Made Seasonal · 554,5 K€</div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ font: `600 11.5px ${FONT.sans}`, color: approved ? C.success : C.warn }}>{approved ? '✓ Approved' : '2 open comments'}</span>
            <div className="dc-btn" onClick={() => setOpen('new')} style={{ height: 40, padding: '0 16px', borderRadius: 10, border: `1px solid ${C.border}`, background: '#FFFFFF', display: 'flex', alignItems: 'center', fontSize: 13.5, fontWeight: 600, color: C.ink }}>Comment</div>
            <div className="dc-btn" style={{ height: 40, padding: '0 18px', borderRadius: 10, border: `1.5px solid ${C.dangerBd}`, background: '#FFFFFF', display: 'flex', alignItems: 'center', fontSize: 13.5, fontWeight: 600, color: C.dangerDeep }}>Send back</div>
            <div className="dc-btn" onClick={approve} style={{ height: 40, padding: '0 24px', borderRadius: 10, background: C.ink, color: C.inkText, display: 'flex', alignItems: 'center', fontSize: 13.5, fontWeight: 600 }}>Approve →</div>
          </div>
        </div>
      </div>
    </div>
  )
}
