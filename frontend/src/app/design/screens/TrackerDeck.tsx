'use client'
/**
 * 2b · Deck view — the LOA slide rebuilt to the exact EssilorLuxottica template.
 * The left rail is the real generated deck order (dividers + family overviews
 * included); the right panel comments on individual brand lines.
 */
import { C, FONT, deckRail, tplRows, lineComments } from '../_data'

const SLIDE_COLS = '44px 96px 32px 96px 104px 1fr 42px 48px 82px 52px 52px 62px'
const HEAD = ['COUNTRY', 'TYPE / PLANNING 2.0 ACTIVITY', 'COT', 'CUSTOMER', 'BRAND', 'DETAIL', '# DOORS', 'AVG INV / DOOR', 'VENDOR', 'Q3-26', 'Q4-26', 'TOTAL H2-26']

export default function TrackerDeck() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 900, background: C.canvas, color: C.ink }}>
      {/* top bar */}
      <div style={{ height: 56, flex: 'none', display: 'flex', alignItems: 'center', gap: 14, padding: '0 22px', background: '#FFFFFF', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ fontFamily: FONT.display, fontSize: 20, fontWeight: 600 }}>LAURA<span style={{ color: C.gold }}>.</span></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12 }}>
          <span style={{ font: `600 9.5px ${FONT.sans}`, letterSpacing: '.1em', textTransform: 'uppercase', background: C.navy2, color: '#fff', borderRadius: 4, padding: '4px 9px' }}>Frames</span>
          <span style={{ color: C.borderStrong }}>›</span><span style={{ fontWeight: 600 }}>Tailor Made Seasonal</span>
          <span style={{ color: C.borderStrong }}>›</span><span style={{ color: C.t2 }}>Italy · LOA #45690</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 10, padding: 3, background: C.cream, borderRadius: 9 }}>
          {['List', 'Deck', 'Excel'].map((v) => {
            const on = v === 'Deck'
            return <span key={v} style={{ height: 26, padding: '0 12px', borderRadius: 6, display: 'flex', alignItems: 'center', fontSize: 11.5, fontWeight: on ? 600 : 500, color: on ? C.ink : C.t2, background: on ? '#fff' : 'transparent', boxShadow: on ? '0 1px 2px rgba(26,24,21,.06)' : 'none' }}>{v}</span>
          })}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ font: `600 11.5px ${FONT.sans}`, color: C.t2, fontVariantNumeric: 'tabular-nums' }}>9 of 376 · 31 approved</span>
          <div style={{ width: 150, height: 5, borderRadius: 3, background: C.cream }}><div style={{ width: '24%', height: '100%', borderRadius: 3, background: C.gold }} /></div>
          <div className="dc-btn" style={{ height: 32, padding: '0 12px', borderRadius: 8, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', fontSize: 12, fontWeight: 600, color: C.t2 }}>▶ Present</div>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        {/* deck order rail */}
        <div style={{ width: 230, flex: 'none', background: C.subtle, borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '11px 14px', borderBottom: `1px solid ${C.border}`, font: `600 11px ${FONT.sans}`, letterSpacing: '.08em', textTransform: 'uppercase', color: C.t3 }}>Deck order</div>
          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 3 }}>
            {deckRail.map((d, i) => (
              <div key={i} className="dc-film" style={{ display: 'flex', alignItems: 'center', gap: 9, padding: d.pad, borderRadius: 7, background: d.bg, border: d.border }}>
                <div style={{ width: 38, height: 22, flex: 'none', borderRadius: 3, background: d.thumbBg, border: `1px solid ${d.thumbBd}`, display: 'flex', alignItems: 'center', justifyContent: 'center', font: `700 6.5px ${FONT.sans}`, color: d.thumbFg, letterSpacing: '.04em' }}>{d.thumbLabel}</div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ font: d.font, color: d.fg, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.label}</div>
                  <div style={{ font: `400 9px ${FONT.sans}`, color: C.t3 }}>{d.meta}</div>
                </div>
                <span style={{ width: 8, height: 8, borderRadius: 99, background: d.dot, flex: 'none' }} />
              </div>
            ))}
          </div>
        </div>

        {/* slide stage */}
        <div style={{ flex: 1, minWidth: 0, background: C.stage, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, position: 'relative' }}>
          <div style={{ width: '100%', maxWidth: 880, aspectRatio: '16 / 9', background: C.subtle, boxShadow: '0 24px 60px rgba(0,0,0,.45)', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '16px 22px 0' }}>
              <div style={{ font: `700 11px ${FONT.sans}`, letterSpacing: '.09em', background: C.navy2, color: '#fff', padding: '5px 16px 5px 12px' }}>Frames</div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', width: 150 }}>
                <div style={{ font: `700 12px ${FONT.sans}`, background: C.navy2, color: '#fff', textAlign: 'center', padding: '4px 0' }}>ITALY</div>
                <div style={{ font: `700 12px ${FONT.sans}`, background: C.navyMid, color: '#fff', textAlign: 'center', padding: '3px 0' }}>554,5K€</div>
                <div style={{ font: `600 10px ${FONT.sans}`, background: C.navyLight, color: '#fff', textAlign: 'center', padding: '2px 0' }}>LOA: #45690</div>
              </div>
            </div>
            <div style={{ padding: '6px 22px 0', font: `700 21px ${FONT.sans}`, color: '#111' }}>Seasonal Visibility: HB &amp; LB</div>
            <div style={{ padding: '2px 22px 0', font: `400 8.5px ${FONT.sans}`, color: C.t2 }}>Table continued on next slide</div>
            <div style={{ padding: '8px 22px 0' }}>
              <div style={{ display: 'grid', gridTemplateColumns: SLIDE_COLS, background: '#111', color: '#fff', font: `700 6px ${FONT.sans}`, letterSpacing: '.03em', textAlign: 'center' }}>
                {HEAD.map((h, i) => <div key={i} style={{ padding: '5px 3px' }}>{h}</div>)}
              </div>
              {tplRows.map((r, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: SLIDE_COLS, font: `400 6.5px/1.5 ${FONT.sans}`, color: '#111', borderBottom: `1px solid ${C.border}`, textAlign: 'center', background: r.bg }}>
                  <div style={{ padding: '2px 3px' }}>Italy</div><div style={{ padding: '2px 3px' }}>Tailor Made Seasonal</div><div style={{ padding: '2px 3px' }}>{r.cot}</div><div style={{ padding: '2px 3px' }}>Top Loc, Stars, DoM</div><div style={{ padding: '2px 3px', textAlign: 'left' }}>{r.brand}</div><div style={{ padding: '2px 3px' }}>Super Trade Light set-up</div><div style={{ padding: '2px 3px' }}>{r.doors}</div><div style={{ padding: '2px 3px' }}>{r.avg}</div><div style={{ padding: '2px 3px' }}>Vetrina In</div><div style={{ padding: '2px 3px', textAlign: 'right' }}>{r.q3}</div><div style={{ padding: '2px 3px', textAlign: 'right' }}>—</div><div style={{ padding: '2px 3px', textAlign: 'right', fontWeight: 600 }}>{r.q3}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 268px', gap: 12, padding: '10px 22px 20px', flex: 1, minHeight: 0 }}>
              <div style={{ border: '1px solid #111', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 5, font: `400 7.5px/1.45 ${FONT.sans}`, color: '#111', position: 'relative' }}>
                <div><strong>Description:</strong> Seasonal window visibility — Super Trade Light across HB &amp; LB doors (T1/T2/A)</div>
                <div><strong>Timing:</strong> Q3 install / Q4 refresh</div>
                <div><strong>Tools:</strong></div>
                <div style={{ paddingLeft: 9 }}>• Monobrand digital windows &nbsp;• Windows covering &nbsp;• Banner + plinth</div>
                <div><strong>KPIs:</strong></div>
                <div style={{ paddingLeft: 9 }}>• Sell-in conditions + sell-out boost +10–15%</div>
                <div style={{ position: 'relative', padding: '2px 3px', margin: '-2px -3px' }}>
                  <strong>Costs drill down:</strong> RB: 120K€ (#240) | 500€/door · PR: 54K€ (#120) | 450€/door · VE: 40,5K€ (#90) | 450€/door · EA: 40K€ (#130) | 500€/door
                  <div className="dc-zone" style={{ inset: 0, background: 'transparent' }} />
                  <div className="dc-pin" style={{ top: -8, left: -13, background: C.dangerDeep, color: '#fff', width: 17, height: 17, fontSize: 9 }}>1</div>
                </div>
                <div style={{ marginTop: 'auto', display: 'flex', gap: 14 }}><span><strong>#Doors:</strong> 1 222</span><span><strong>Cost / door:</strong> 453 €</span></div>
              </div>
              <div style={{ border: '1px solid #111', padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ font: `400 8px ${FONT.sans}`, color: '#111', textAlign: 'center' }}>Examples of 2025 Campaign Execution</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, flex: 1 }}>
                  {['Ray-Ban window', 'Prada window'].map((t, i) => (
                    <div key={i} style={{ background: C.cream, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 7.5, color: C.t3, textAlign: 'center' }}>Portrait<br />{t}</div>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 10px', fontSize: 6, color: C.t3 }}><span>9</span><span>Strictly confidential - for internal use only. Do not share or forward.</span><span>EssilorLuxottica</span></div>
          </div>
        </div>

        {/* comments panel */}
        <div style={{ width: 318, flex: 'none', background: '#FFFFFF', borderLeft: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '13px 15px', borderBottom: `1px solid ${C.border}`, background: C.subtle }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}><span style={{ color: C.gold, fontSize: 12 }}>✦</span><span style={{ font: `600 11.5px ${FONT.sans}` }}>Laura, in one line</span></div>
            <div style={{ font: `400 12px/1.6 ${FONT.sans}`, marginTop: 6 }}>19 brand lines, 1 222 doors, all Q3. Drill-down reconciles. <strong style={{ color: C.dangerDeep }}>Ray-Ban is 22% of the slide at 500 €/door</strong> — 2,1× the Italy median.</div>
          </div>
          <div style={{ padding: '11px 15px', borderBottom: `1px solid ${C.border}` }}>
            <div style={{ font: `600 11px ${FONT.sans}`, letterSpacing: '.08em', textTransform: 'uppercase', color: C.t3, marginBottom: 8 }}>Comment on a line</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {lineComments.map((l, i) => (
                <div key={i} className="dc-btn" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 9px', border: `1px solid ${l.bd}`, borderRadius: 8, background: l.bg }}>
                  <span style={{ font: `600 10.5px ${FONT.sans}`, minWidth: 74 }}>{l.brand}</span>
                  <span style={{ font: `500 10.5px ${FONT.mono}`, color: C.t2 }}>{l.amt}</span>
                  <span style={{ marginLeft: 'auto', font: `600 9.5px ${FONT.sans}`, color: l.tagFg, background: l.tagBg, borderRadius: 99, padding: '2px 7px' }}>{l.tag}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ flex: 1, minHeight: 0, padding: '12px 15px', display: 'flex', flexDirection: 'column', gap: 9 }}>
            <div style={{ border: `1px solid ${C.gold}`, borderRadius: 10, padding: '11px 12px', background: C.subtle }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="dc-pin" style={{ position: 'static', background: C.dangerDeep, color: '#fff' }}>1</span>
                <div><div style={{ font: `600 11.5px ${FONT.sans}` }}>Alexandra</div><div style={{ fontSize: 9.5, color: C.t3 }}>Regional CMO · entered by Thibault</div></div>
              </div>
              <div style={{ font: `400 11.5px/1.55 ${FONT.sans}`, marginTop: 7 }}>Phase Ray-Ban: Q3 pilot on 120 doors, rest to Q4. Everything else can go.</div>
              <div style={{ font: `500 9.5px ${FONT.sans}`, color: C.t3, marginTop: 6 }}>on line <span style={{ color: C.gold }}>HB - Ray-Ban</span> · Costs drill down</div>
              <div style={{ display: 'flex', gap: 6, marginTop: 9 }}>
                <div className="dc-btn" style={{ padding: '5px 10px', borderRadius: 7, background: C.dangerDeep, color: '#fff', fontSize: 10.5, fontWeight: 600 }}>Return this line only</div>
                <div className="dc-btn" style={{ padding: '5px 10px', borderRadius: 7, border: `1px solid ${C.border}`, color: C.t2, fontSize: 10.5, fontWeight: 600 }}>Resolve</div>
              </div>
            </div>
            <div style={{ border: `1px dashed ${C.borderStrong}`, borderRadius: 10, padding: '10px 12px', font: `400 10.5px/1.5 ${FONT.sans}`, color: C.t3 }}>Pick a line above, or click any zone on the slide, to pin a new comment.</div>
          </div>
          <div style={{ padding: '11px 15px', borderTop: `1px solid ${C.border}`, background: C.subtle, display: 'flex', gap: 8 }}>
            <div className="dc-btn" style={{ flex: 1, height: 36, borderRadius: 9, border: `1.5px solid ${C.dangerBd}`, color: C.dangerDeep, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12.5, fontWeight: 600 }}>Send back</div>
            <div className="dc-btn" style={{ flex: 1, height: 36, borderRadius: 9, background: C.ink, color: C.inkText, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12.5, fontWeight: 600 }}>Approve LOA</div>
          </div>
        </div>
      </div>
    </div>
  )
}
