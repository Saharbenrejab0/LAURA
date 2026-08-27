'use client'
/**
 * 3c · Submit & confirm — every role finishes their pass explicitly; nothing is
 * submitted by accident. A persistent bar + a confirm that always states who
 * sees it next and what you lose.
 */
import { C, FONT, submitSummary } from '../_data'

export default function AdminSubmit() {
  return (
    <div style={{ minHeight: 600, background: C.canvas, padding: 22, display: 'flex', flexDirection: 'column', gap: 18, color: C.ink }}>
      {/* persistent bar */}
      <div style={{ background: '#FFFFFF', border: `1px solid ${C.border}`, borderRadius: 12, boxShadow: '0 1px 2px rgba(26,24,21,.06)', overflow: 'hidden' }}>
        <div style={{ padding: '11px 16px', borderBottom: `1px solid ${C.border}`, font: `600 12px ${FONT.sans}`, letterSpacing: '.08em', textTransform: 'uppercase', color: C.t3 }}>Persistent bar — any reviewer, any view</div>
        <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ font: `600 13px ${FONT.sans}` }}>Your pass on Cycle 3 — Global Brand · Ray-Ban</div>
            <div style={{ fontSize: 11.5, color: '#6B6558', marginTop: 2 }}>14 of 18 LOAs reviewed · 6 comments left · 4 not opened yet</div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 150, height: 6, borderRadius: 3, background: C.cream }}><div style={{ width: '78%', height: '100%', borderRadius: 3, background: C.gold }} /></div>
            <div className="dc-btn" style={{ height: 38, padding: '0 14px', borderRadius: 9, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', fontSize: 12.5, fontWeight: 600, color: '#6B6558' }}>Show the 4 left</div>
            <div className="dc-btn" style={{ height: 38, padding: '0 18px', borderRadius: 9, background: C.ink, color: C.inkText, display: 'flex', alignItems: 'center', fontSize: 12.5, fontWeight: 600 }}>Submit my review</div>
          </div>
        </div>
      </div>

      {/* confirm modal */}
      <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', border: `1px solid ${C.border}` }}>
        <div style={{ background: 'rgba(26,24,21,.42)', padding: '34px 24px', display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: 460, background: C.subtle, border: `1px solid ${C.border}`, borderRadius: 16, boxShadow: '0 24px 64px rgba(26,24,21,.30)', overflow: 'hidden' }}>
            <div style={{ padding: '20px 22px 0' }}>
              <div style={{ font: `600 16px ${FONT.sans}` }}>Submit your review?</div>
              <div style={{ font: `400 12.5px/1.6 ${FONT.sans}`, color: '#6B6558', marginTop: 8 }}>Your 6 comments become visible to the Regional team and your pass is marked complete. You can still read everything afterwards, but you won't be able to edit or add comments unless it comes back to you.</div>
            </div>
            <div style={{ margin: '14px 22px', border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
              {submitSummary.map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderBottom: `1px solid ${C.borderSoft}`, background: s.bg }}>
                  <span style={{ width: 17, height: 17, borderRadius: 99, background: s.iconBg, color: s.iconFg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9 }}>{s.icon}</span>
                  <span style={{ font: `500 12px ${FONT.sans}`, flex: 1 }}>{s.label}</span>
                  <span style={{ font: `600 12px ${FONT.mono}`, color: s.nFg }}>{s.n}</span>
                </div>
              ))}
            </div>
            <div style={{ margin: '0 22px 14px', display: 'flex', alignItems: 'flex-start', gap: 9, background: '#FFFFFF', border: `1px solid ${C.goldSoft}`, borderRadius: 9, padding: '10px 12px' }}>
              <span style={{ width: 15, height: 15, flex: 'none', border: `2px solid ${C.gold}`, borderRadius: 3, background: C.gold, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9 }}>✓</span>
              <span style={{ font: `400 12px/1.5 ${FONT.sans}`, color: '#6B6558' }}>Notify the Regional team in Teams that my pass is done</span>
            </div>
            <div style={{ padding: '14px 22px', borderTop: `1px solid ${C.border}`, background: C.canvas, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <div className="dc-btn" style={{ height: 38, padding: '0 16px', borderRadius: 9, border: `1px solid ${C.border}`, background: '#FFFFFF', display: 'flex', alignItems: 'center', fontSize: 13, fontWeight: 600, color: '#6B6558' }}>Keep reviewing</div>
              <div className="dc-btn" style={{ height: 38, padding: '0 20px', borderRadius: 9, background: C.ink, color: C.inkText, display: 'flex', alignItems: 'center', fontSize: 13, fontWeight: 600 }}>Yes, submit</div>
            </div>
          </div>
        </div>
      </div>

      {/* explainer cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div style={{ background: '#FFFFFF', border: `1px solid ${C.border}`, borderRadius: 12, padding: '15px 17px' }}>
          <div style={{ font: `600 12.5px ${FONT.sans}`, marginBottom: 9 }}>Same pattern, different words</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, font: `400 11.5px/1.5 ${FONT.sans}`, color: '#6B6558' }}>
            <div><strong style={{ color: C.ink }}>Marketer</strong> — “Submit 4 LOAs to Regional?” lists what's incomplete first.</div>
            <div><strong style={{ color: C.ink }}>Regional</strong> — “Push 12 LOAs to Global brands &amp; functions?”</div>
            <div><strong style={{ color: C.ink }}>CMO / CFO</strong> — “Close the session? 31 approved, 5 returned, 3 deferred.”</div>
            <div><strong style={{ color: C.ink }}>Final approval</strong> — “Approve and issue IA codes?” shows the codes about to be minted.</div>
          </div>
        </div>
        <div style={{ background: '#FFFFFF', border: `1px solid ${C.border}`, borderRadius: 12, padding: '15px 17px' }}>
          <div style={{ font: `600 12.5px ${FONT.sans}`, marginBottom: 9 }}>Rules</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, font: `400 11.5px/1.5 ${FONT.sans}`, color: '#6B6558' }}>
            <div>Submitting is per <strong style={{ color: C.ink }}>pass</strong>, not per LOA — one act, so people know where they stopped.</div>
            <div>The confirm always states <strong style={{ color: C.ink }}>who sees it next</strong> and <strong style={{ color: C.ink }}>what you lose</strong>.</div>
            <div>Destructive or irreversible steps use the danger colour; everything else uses ink.</div>
            <div>Nothing auto-submits at deadline — the cycle closes, the pass stays visibly unfinished.</div>
          </div>
        </div>
      </div>
    </div>
  )
}
