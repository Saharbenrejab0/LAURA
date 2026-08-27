'use client'
/**
 * 2a · Tracker = the review page. Deck hierarchy is the spine; one toggle
 * switches List / Board / Deck / Excel. Review-mode dropdown recolours it per role.
 */
import { C, FONT, tree, trackerFilters } from '../_data'
import { Rail, TopBar } from '../_chrome'

const TREE_COLS = '1fr 96px 74px 92px 84px 96px'

export default function Tracker() {
  return (
    <div style={{ display: 'flex', height: 900, background: C.canvas, color: C.ink }}>
      <Rail active="tracker" />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <TopBar section="Tracker" bg="#FFFFFF" />

        {/* tabs + review mode + cycle banner */}
        <div style={{ padding: '20px 26px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'inline-flex', background: C.canvas, border: `1px solid ${C.goldSoft}`, borderRadius: 10, padding: 4, gap: 4 }}>
              <div className="dc-btn" style={{ padding: '7px 16px', borderRadius: 8, background: C.ink, color: C.inkText, fontSize: 12.5, fontWeight: 600 }}>Current Cycle</div>
              <div className="dc-btn" style={{ padding: '7px 16px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, color: C.ink }}>Past Cycles</div>
              <div className="dc-btn" style={{ padding: '7px 16px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, color: C.ink, display: 'flex', alignItems: 'center', gap: 6 }}>Emergency LOAs <span style={{ minWidth: 20, height: 20, borderRadius: 10, background: C.danger, color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px' }}>3</span></div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="dc-btn" style={{ height: 34, padding: '0 12px', borderRadius: 8, border: `1px solid ${C.border}`, background: '#FFFFFF', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600 }}>
                <span style={{ width: 7, height: 7, borderRadius: 99, background: C.gold }} />Review mode: CMO <span style={{ color: C.t3, fontWeight: 500 }}>▾</span>
              </div>
              <div className="dc-btn" style={{ height: 34, padding: '0 16px', borderRadius: 8, background: C.ink, color: C.inkText, display: 'flex', alignItems: 'center', fontSize: 12, fontWeight: 600 }}>▶ Present session</div>
            </div>
          </div>
          <div style={{ padding: '12px 16px', borderRadius: 10, border: `1px solid ${C.goldSoft}`, borderLeft: `4px solid ${C.gold}`, background: '#fbf7ed' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>Cycle 3 — Q3 2026</span>
              <span style={{ padding: '2px 10px', borderRadius: 12, background: C.gold, color: '#F4F1EA', fontSize: 11, fontWeight: 700 }}>OPEN</span>
            </div>
            <div style={{ fontSize: 12, color: C.t2, marginTop: 4 }}>
              <span style={{ background: 'rgba(176,141,47,.12)', color: C.gold, padding: '1px 8px', borderRadius: 10, fontWeight: 700, marginRight: 8 }}>4d remaining</span>1 Jul – 15 Jul 2026
            </div>
          </div>
        </div>

        {/* portfolio header */}
        <div style={{ padding: '18px 26px 0', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <div style={{ font: `700 10.5px ${FONT.sans}`, letterSpacing: '.09em', textTransform: 'uppercase', color: C.t3 }}>Portfolio</div>
            <div style={{ fontFamily: FONT.display, fontSize: 40, lineHeight: 1.05, fontWeight: 600, letterSpacing: '-.01em', marginTop: 4 }}>Tracker</div>
            <div style={{ fontSize: 13.5, color: C.t2, marginTop: 8 }}><span style={{ fontFamily: FONT.mono, fontWeight: 600, color: C.ink }}>376</span> LOAs · <span style={{ fontFamily: FONT.mono, fontWeight: 600, color: C.gold }}>EUR 34.1M</span> in pipeline</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'inline-flex', background: C.cream, borderRadius: 9, padding: 3, gap: 3 }}>
              {['List', 'Board', 'Deck', 'Excel'].map((v) => {
                const on = v === 'Deck'
                return <span key={v} className="dc-btn" style={{ height: 28, padding: '0 12px', borderRadius: 6, display: 'flex', alignItems: 'center', fontSize: 12, fontWeight: on ? 600 : 500, color: on ? C.ink : C.t3, background: on ? '#FFFFFF' : 'transparent', boxShadow: on ? '0 1px 2px rgba(26,24,21,.06)' : 'none' }}>{v}</span>
              })}
            </div>
            <div className="dc-btn" style={{ height: 32, padding: '0 12px', borderRadius: 8, border: `1px solid ${C.border}`, background: '#FFFFFF', display: 'flex', alignItems: 'center', fontSize: 12, fontWeight: 600, color: C.t2 }}>💬 My comments <span style={{ marginLeft: 6, fontFamily: FONT.mono, fontWeight: 700, color: C.ink }}>6</span></div>
            <div className="dc-btn" style={{ height: 32, padding: '0 12px', borderRadius: 8, border: `1px solid ${C.border}`, background: '#FFFFFF', display: 'flex', alignItems: 'center', fontSize: 12, fontWeight: 600, color: C.t2 }}>↧ Export Excel</div>
          </div>
        </div>

        {/* filters */}
        <div style={{ padding: '16px 26px 0', display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 34, padding: '0 12px', border: `1px solid ${C.border}`, borderRadius: 8, background: '#FFFFFF', flex: 1, maxWidth: 380 }}>
            <span style={{ opacity: 0.5, fontSize: 12 }}>⌕</span><span style={{ fontSize: 13, color: C.t3 }}>Search LOA, country, activity, brand, owner…</span>
          </div>
          {trackerFilters.map((f, i) => (
            <span key={i} className="dc-btn" style={{ display: 'inline-flex', alignItems: 'center', height: 34, padding: '0 12px', borderRadius: 8, border: `1px solid ${f.bd}`, fontSize: 12.5, fontWeight: 500, color: f.fg, background: f.bg }}>{f.label} <span style={{ color: C.t3, marginLeft: 6 }}>▾</span></span>
          ))}
          <span style={{ marginLeft: 'auto', font: `500 11.5px ${FONT.mono}`, color: C.t2 }}>376 of 376</span>
        </div>

        {/* main grid */}
        <div style={{ flex: 1, minHeight: 0, padding: '14px 26px 20px', display: 'grid', gridTemplateColumns: '1fr 316px', gap: 18 }}>
          {/* deck hierarchy */}
          <div style={{ background: '#FFFFFF', border: `1px solid ${C.border}`, borderRadius: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px', borderBottom: `1px solid ${C.border}` }}>
              <span style={{ font: `600 12.5px ${FONT.sans}` }}>Deck hierarchy</span>
              <span style={{ font: `400 11px ${FONT.sans}`, color: C.t3 }}>Category → activity family → LOA · the order the deck is generated in</span>
              <span style={{ marginLeft: 'auto', font: `500 11px ${FONT.sans}`, color: C.gold }}>Expand all</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: TREE_COLS, padding: '8px 16px', borderBottom: `1px solid ${C.border}`, font: `700 9.5px ${FONT.sans}`, letterSpacing: '.08em', textTransform: 'uppercase', color: C.t3 }}>
              <div>Section / LOA</div><div>Cluster</div><div style={{ textAlign: 'right' }}>Lines</div><div style={{ textAlign: 'right' }}>Amount</div><div style={{ textAlign: 'center' }}>Flags</div><div style={{ textAlign: 'right' }}>Decision</div>
            </div>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
              {tree.map((t, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: TREE_COLS, alignItems: 'center', padding: t.pad, borderBottom: `1px solid ${C.borderSoft}`, background: t.bg }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: t.indent, minWidth: 0 }}>
                    <span style={{ fontSize: 9, color: C.t3, width: 9 }}>{t.chev}</span>
                    <span style={{ font: t.font, color: t.fg, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
                    <span style={{ font: `500 9.5px ${FONT.sans}`, color: C.t3, letterSpacing: '.06em', textTransform: 'uppercase' }}>{t.kind}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: C.t2 }}>{t.cluster}</div>
                  <div style={{ textAlign: 'right', font: `500 11.5px ${FONT.mono}`, color: C.t2 }}>{t.lines}</div>
                  <div style={{ textAlign: 'right', font: `600 11.5px ${FONT.mono}` }}>{t.amount}</div>
                  <div style={{ textAlign: 'center' }}>{t.flag && <span style={{ font: `600 9.5px ${FONT.sans}`, background: t.flagBg, color: t.flagFg, borderRadius: 99, padding: '3px 8px' }}>{t.flag}</span>}</div>
                  <div style={{ textAlign: 'right', font: `600 11px ${FONT.sans}`, color: t.decFg }}>{t.dec}</div>
                </div>
              ))}
            </div>
            <div style={{ padding: '10px 16px', background: C.subtle, borderTop: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 11.5, color: C.t2 }}>Selected: <strong>Tailor Made Seasonal</strong> · 5 LOAs · 11,7 M€</span>
              <div className="dc-btn" style={{ marginLeft: 'auto', height: 32, padding: '0 14px', borderRadius: 8, border: `1px solid ${C.border}`, background: '#fff', display: 'flex', alignItems: 'center', fontSize: 12, fontWeight: 600 }}>Open in Deck view</div>
              <div className="dc-btn" style={{ height: 32, padding: '0 14px', borderRadius: 8, background: C.ink, color: C.inkText, display: 'flex', alignItems: 'center', fontSize: 12, fontWeight: 600 }}>Approve family</div>
            </div>
          </div>

          {/* right column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minHeight: 0 }}>
            <div style={{ background: '#FFFFFF', border: `1px solid ${C.goldSoft}`, borderRadius: 12, padding: '15px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}><span style={{ color: C.gold }}>✦</span><span style={{ font: `600 12px ${FONT.sans}` }}>Laura's triage</span></div>
              <div style={{ font: `400 12px/1.6 ${FONT.sans}`, color: C.t2, marginTop: 7 }}>8 slides need the room's attention — 5,6 M€. The other 27 reconcile against last cycle and can go as one block.</div>
              <div className="dc-btn" style={{ marginTop: 11, height: 32, borderRadius: 8, background: C.ink, color: C.inkText, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600 }}>Present flagged first</div>
            </div>
            <div style={{ background: '#FFFFFF', border: `1px solid ${C.border}`, borderRadius: 12, padding: '15px 16px' }}>
              <div style={{ font: `600 12px ${FONT.sans}`, marginBottom: 10 }}>Reconciliation</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {[['✓', C.successBg, C.success, 'Family overviews = sum of LOAs'], ['!', C.dangerBg2, C.dangerDeep, '2 LOAs: drill-down ≠ line totals'], ['~', C.warnBg, C.warn, '1 split slide missing its (2/2)']].map(([g, bg, fg, txt], i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 11.5 }}><span style={{ width: 16, height: 16, borderRadius: 99, background: bg as string, color: fg as string, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9 }}>{g}</span>{txt}</div>
                ))}
              </div>
            </div>
            <div style={{ background: '#FFFFFF', border: `1px solid ${C.border}`, borderRadius: 12, padding: '15px 16px', flex: 1, minHeight: 0 }}>
              <div style={{ font: `600 12px ${FONT.sans}`, marginBottom: 10 }}>Who sees what</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, font: `400 11.5px/1.5 ${FONT.sans}`, color: C.t2 }}>
                <div><strong style={{ color: C.ink }}>CMO</strong> — Deck view by default. Comments, approve, send back.</div>
                <div><strong style={{ color: C.ink }}>CFO</strong> — Excel view by default. Same rights, numbers first.</div>
                <div><strong style={{ color: C.ink }}>Marketer</strong> — List view, own cluster, read-only in session.</div>
                <div><strong style={{ color: C.ink }}>Admin</strong> — all views, drives the session, enters comments on behalf.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
