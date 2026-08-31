'use client'
/**
 * 3b · Start emergency cycle — dates + the marketers authorised to create in it.
 * Runs alongside the main cycle; only authorised marketers can create, and only
 * inside the window.
 */
import { C, FONT, marketerChips } from '../_data'

export default function AdminEmergency() {
  return (
    <div style={{ height: 600, background: 'rgba(26,24,21,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: 520, background: C.subtle, border: `1px solid ${C.border}`, borderRadius: 16, boxShadow: '0 24px 64px rgba(26,24,21,.30)', overflow: 'hidden' }}>
        <div style={{ padding: '20px 22px 14px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{ width: 22, height: 22, borderRadius: 99, background: C.dangerBg, color: C.danger, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>⚠</span>
            <span style={{ font: `600 16px ${FONT.sans}` }}>Start an emergency cycle</span>
          </div>
          <div style={{ font: `400 12.5px/1.55 ${FONT.sans}`, color: '#6B6558', marginTop: 7 }}>Runs alongside Cycle 3. Only the marketers you authorise can create LOAs in it, and only inside the window.</div>
        </div>
        <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <div style={{ font: `600 12.5px ${FONT.sans}`, letterSpacing: '.04em', textTransform: 'uppercase', color: '#6B6558' }}>Start date<span style={{ color: C.danger, marginLeft: 2 }}>*</span></div>
              <div style={{ marginTop: 6, height: 38, border: `1px solid ${C.border}`, borderRadius: 8, background: '#FFFFFF', display: 'flex', alignItems: 'center', padding: '0 12px', font: `400 13.5px ${FONT.sans}` }}>12 / 07 / 2026</div>
            </div>
            <div>
              <div style={{ font: `600 12.5px ${FONT.sans}`, letterSpacing: '.04em', textTransform: 'uppercase', color: '#6B6558' }}>End date<span style={{ color: C.danger, marginLeft: 2 }}>*</span></div>
              <div style={{ marginTop: 6, height: 38, border: `1px solid ${C.gold}`, borderRadius: 8, background: '#FFFFFF', display: 'flex', alignItems: 'center', padding: '0 12px', font: `400 13.5px ${FONT.sans}` }}>19 / 07 / 2026</div>
              <div style={{ fontSize: 12, color: '#9A9284', marginTop: 4 }}>7-day window · reminders at 3-2-1 days</div>
            </div>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ font: `600 12.5px ${FONT.sans}`, letterSpacing: '.04em', textTransform: 'uppercase', color: '#6B6558' }}>Authorised marketers<span style={{ color: C.danger, marginLeft: 2 }}>*</span></span>
              <span style={{ marginLeft: 'auto', font: `600 10.5px ${FONT.sans}`, background: C.dangerBg, color: C.danger, borderRadius: 99, padding: '3px 9px' }}>3 selected</span>
            </div>
            <div style={{ marginTop: 7, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {marketerChips.map((m, i) => (
                <span key={i} className="dc-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 99, border: `1px solid ${m.bd}`, background: m.bg, color: m.fg, font: `500 11.5px ${FONT.sans}` }}>{m.check}{m.name}</span>
              ))}
            </div>
            <div style={{ fontSize: 12, color: '#9A9284', marginTop: 7 }}>Everyone else keeps read-only access to the emergency lane.</div>
          </div>
          <div style={{ background: '#FFFFFF', border: `1px solid ${C.goldSoft}`, borderRadius: 9, padding: '11px 13px', font: `400 12px/1.55 ${FONT.sans}`, color: '#6B6558' }}>
            <strong style={{ color: C.ink }}>On confirm:</strong> kick-off email to the 3 marketers, a Teams post in their cluster channels, and the emergency lane appears on the Tracker's Emergency LOAs tab.
          </div>
        </div>
        <div style={{ padding: '14px 22px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 10, justifyContent: 'flex-end', background: C.canvas }}>
          <div className="dc-btn" style={{ height: 38, padding: '0 16px', borderRadius: 9, border: `1px solid ${C.border}`, background: '#FFFFFF', display: 'flex', alignItems: 'center', fontSize: 13, fontWeight: 600, color: '#6B6558' }}>Cancel</div>
          <div className="dc-btn" style={{ height: 38, padding: '0 18px', borderRadius: 9, background: C.danger, color: '#fff', display: 'flex', alignItems: 'center', fontSize: 13, fontWeight: 600 }}>Start emergency cycle</div>
        </div>
      </div>
    </div>
  )
}
