'use client'
/**
 * 3a · Admin as one screen — the cycle IS the dashboard. Pipeline of where the
 * 376 LOAs are stuck, tasks that need the admin today, notification schedule,
 * deck/xlsx generation, the permission matrix and the emergency lane. No tabs.
 */
import { C, FONT, pipeline, adminTasks, notifs, outputs, matrix, emergencies } from '../_data'
import { Rail, TopBar } from '../_chrome'

export default function Admin() {
  return (
    <div style={{ display: 'flex', height: 900, background: C.subtle, color: C.ink }}>
      <Rail active="admin" />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: '#FFFFFF' }}>
        <TopBar section="Admin" />

        {/* cycle control header */}
        <div style={{ padding: '22px 24px 0', display: 'flex', alignItems: 'flex-end', gap: 20 }}>
          <div>
            <div style={{ font: `700 10.5px ${FONT.sans}`, letterSpacing: '.09em', textTransform: 'uppercase', color: C.t4 }}>Cycle control</div>
            <div style={{ fontFamily: FONT.display, fontSize: 34, fontWeight: 600, lineHeight: 1.1, marginTop: 3 }}>Cycle 3 — Q3 2026</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
            <span style={{ padding: '3px 11px', borderRadius: 12, background: C.goldWarm, color: '#F4F1EA', fontSize: 11, fontWeight: 700 }}>OPEN</span>
            <span style={{ fontSize: 12.5, color: '#66615A' }}>1 Jul – 15 Jul · <strong style={{ color: C.ink }}>4 days left</strong></span>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 9 }}>
            <div className="dc-btn" style={{ height: 36, padding: '0 15px', borderRadius: 9, border: `1px solid ${C.line}`, background: '#FFFFFF', display: 'flex', alignItems: 'center', fontSize: 12.5, fontWeight: 600, color: '#66615A' }}>Extend deadline</div>
            <div className="dc-btn" style={{ height: 36, padding: '0 15px', borderRadius: 9, border: `1px solid ${C.dangerBd}`, background: '#FFFFFF', display: 'flex', alignItems: 'center', fontSize: 12.5, fontWeight: 600, color: C.danger }}>⚠ Start emergency</div>
            <div className="dc-btn" style={{ height: 36, padding: '0 17px', borderRadius: 9, background: C.ink, color: '#F5F5F3', display: 'flex', alignItems: 'center', fontSize: 12.5, fontWeight: 600 }}>Close cycle &amp; generate deck</div>
          </div>
        </div>

        {/* pipeline */}
        <div style={{ padding: '18px 24px 0' }}>
          <div style={{ background: '#FFFFFF', border: `1px solid ${C.line}`, borderRadius: 12, boxShadow: '0 1px 2px rgba(26,24,21,.06)', padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 14 }}>
              <span style={{ font: `600 12.5px ${FONT.sans}` }}>Where the 376 LOAs are stuck</span>
              <span style={{ font: `400 11.5px ${FONT.sans}`, color: C.t4 }}>Local → Regional → Global brands &amp; functions → CMO / CFO → Corporate → Final approval + IA code</span>
              <span style={{ marginLeft: 'auto', font: `500 11.5px ${FONT.sans}`, color: C.goldWarm }}>2 bottlenecks</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'stretch', gap: 6 }}>
              {pipeline.map((p, i) => (
                <div key={i} className="dc-btn" style={{ flex: p.flex, background: p.bg, border: `1px solid ${p.bd}`, borderRadius: 9, padding: '11px 12px', display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ font: `700 9px ${FONT.sans}`, letterSpacing: '.09em', textTransform: 'uppercase', color: p.labelFg, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.stage}</span>
                    <span style={{ marginLeft: 'auto', font: `600 9px ${FONT.sans}`, color: p.ownerFg }}>{p.owner}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ font: `600 24px ${FONT.sans}`, color: p.nFg }}>{p.n}</span>
                    <span style={{ font: `500 10.5px ${FONT.mono}`, color: '#66615A' }}>{p.amt}</span>
                  </div>
                  <div style={{ height: 4, borderRadius: 3, background: '#EDEBE6' }}><div style={{ width: p.pct, height: '100%', borderRadius: 3, background: p.barFg }} /></div>
                  <div style={{ font: `400 10px ${FONT.sans}`, color: p.noteFg, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.note}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* main grid */}
        <div style={{ flex: 1, minHeight: 0, padding: '16px 24px 22px', display: 'grid', gridTemplateColumns: '1fr 1fr 358px', gap: 16 }}>
          {/* needs you today */}
          <div style={{ background: '#FFFFFF', border: `1px solid ${C.line}`, borderRadius: 12, boxShadow: '0 1px 2px rgba(26,24,21,.06)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '13px 16px', borderBottom: `1px solid ${C.line}`, display: 'flex', alignItems: 'center', gap: 9 }}>
              <span style={{ font: `600 12.5px ${FONT.sans}` }}>Needs you today</span>
              <span style={{ font: `600 9.5px ${FONT.sans}`, background: C.dangerBg, color: C.danger, borderRadius: 99, padding: '3px 8px' }}>4</span>
            </div>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
              {adminTasks.map((a, i) => (
                <div key={i} className="dc-btn" style={{ padding: '12px 16px', borderBottom: `1px solid ${C.borderSoft}`, display: 'flex', gap: 11, alignItems: 'flex-start' }}>
                  <span style={{ width: 22, height: 22, flex: 'none', borderRadius: 99, background: a.iconBg, color: a.iconFg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>{a.icon}</span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ font: `600 12.5px ${FONT.sans}` }}>{a.title}</div>
                    <div style={{ font: `400 11.5px/1.5 ${FONT.sans}`, color: '#66615A', marginTop: 2 }}>{a.sub}</div>
                  </div>
                  <span style={{ font: `600 11px ${FONT.sans}`, color: C.goldWarm, whiteSpace: 'nowrap' }}>{a.cta}</span>
                </div>
              ))}
            </div>
          </div>

          {/* notifications + generate */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minHeight: 0 }}>
            <div style={{ background: '#FFFFFF', border: `1px solid ${C.line}`, borderRadius: 12, boxShadow: '0 1px 2px rgba(26,24,21,.06)', padding: '15px 17px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
                <span style={{ font: `600 12.5px ${FONT.sans}` }}>Notifications for this cycle</span>
                <span style={{ marginLeft: 'auto', font: `500 11px ${FONT.sans}`, color: C.goldWarm }}>Edit schedule</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {notifs.map((n, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 15, height: 15, flex: 'none', borderRadius: 99, background: n.dotBg, color: n.dotFg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8 }}>{n.dot}</span>
                    <span style={{ font: `500 12px ${FONT.sans}`, minWidth: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.label}</span>
                    <span style={{ font: `400 11px ${FONT.sans}`, color: C.t4, whiteSpace: 'nowrap' }}>{n.channel}</span>
                    <span style={{ font: `600 11px ${FONT.mono}`, color: n.whenFg, whiteSpace: 'nowrap' }}>{n.when}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ background: '#FFFFFF', border: `1px solid ${C.line}`, borderRadius: 12, boxShadow: '0 1px 2px rgba(26,24,21,.06)', padding: '15px 17px', flex: 1, minHeight: 0 }}>
              <div style={{ font: `600 12.5px ${FONT.sans}`, marginBottom: 12 }}>Generate &amp; distribute</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {outputs.map((o, i) => (
                  <div key={i} className="dc-btn" style={{ display: 'flex', alignItems: 'center', gap: 11, border: `1px solid ${C.line}`, borderRadius: 9, padding: '10px 12px' }}>
                    <span style={{ font: `700 9px ${FONT.sans}`, letterSpacing: '.06em', background: o.tagBg, color: o.tagFg, borderRadius: 5, padding: '4px 7px' }}>{o.tag}</span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ font: `600 12px ${FONT.sans}` }}>{o.title}</div>
                      <div style={{ fontSize: 10.5, color: C.t4 }}>{o.sub}</div>
                    </div>
                    <span style={{ font: `600 11px ${FONT.sans}`, color: C.goldWarm, whiteSpace: 'nowrap' }}>{o.cta}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* people + emergency */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minHeight: 0 }}>
            <div style={{ background: '#FFFFFF', border: `1px solid ${C.line}`, borderRadius: 12, boxShadow: '0 1px 2px rgba(26,24,21,.06)', padding: '15px 17px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 11 }}>
                <span style={{ font: `600 12.5px ${FONT.sans}` }}>People &amp; access</span>
                <span style={{ marginLeft: 'auto', font: `500 11px ${FONT.sans}`, color: C.goldWarm }}>Manage</span>
              </div>
              <div style={{ display: 'flex', gap: 9, marginBottom: 12 }}>
                {[['48', 'users', C.line, C.ink], ['9', 'role groups', C.line, C.ink], ['2', 'unassigned', '#EFE3C2', C.goldWarm]].map(([n, l, bd, col], i) => (
                  <div key={i} style={{ flex: 1, background: '#F5F5F3', border: `1px solid ${bd}`, borderRadius: 9, padding: '9px 11px' }}>
                    <div style={{ font: `600 19px ${FONT.sans}`, color: col as string }}>{n}</div>
                    <div style={{ fontSize: 10.5, color: C.t4 }}>{l}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr repeat(5,26px)', gap: 3, font: `700 8.5px ${FONT.sans}`, letterSpacing: '.05em', textTransform: 'uppercase', color: C.t4, marginBottom: 5 }}>
                <div>Role</div><div style={{ textAlign: 'center' }}>Loc</div><div style={{ textAlign: 'center' }}>Reg</div><div style={{ textAlign: 'center' }}>GB&amp;F</div><div style={{ textAlign: 'center' }}>CMO</div><div style={{ textAlign: 'center' }}>Corp</div>
              </div>
              {matrix.map((m, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr repeat(5,26px)', gap: 3, alignItems: 'center', marginBottom: 3 }}>
                  <div style={{ font: `500 11px ${FONT.sans}`, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.role}</div>
                  {m.cells.map((c, j) => (
                    <div key={j} style={{ height: 20, borderRadius: 4, background: c.bg, color: c.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', font: `700 9px ${FONT.sans}` }}>{c.label}</div>
                  ))}
                </div>
              ))}
              <div style={{ display: 'flex', gap: 9, marginTop: 9, font: `400 9.5px ${FONT.sans}`, color: C.t4, flexWrap: 'wrap' }}>
                <span>A advance</span><span>V validate</span><span>E edit</span><span>C comment</span><span>R read</span>
              </div>
            </div>
            <div style={{ background: '#FFFFFF', border: `1px solid ${C.dangerBd}`, borderRadius: 12, padding: '15px 17px', flex: 1, minHeight: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <span style={{ font: `600 12.5px ${FONT.sans}`, color: C.danger }}>⚠ Emergency lane</span>
                <span style={{ marginLeft: 'auto', font: `600 10px ${FONT.sans}`, background: C.dangerBg, color: C.danger, borderRadius: 99, padding: '3px 9px' }}>3 open</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 11 }}>
                {emergencies.map((e, i) => (
                  <div key={i} style={{ border: `1px solid ${C.line}`, borderRadius: 9, padding: '9px 11px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ font: `600 11.5px ${FONT.sans}`, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name}</span>
                      <span style={{ marginLeft: 'auto', font: `600 10px ${FONT.mono}`, color: e.leftFg, whiteSpace: 'nowrap' }}>{e.left}</span>
                    </div>
                    <div style={{ fontSize: 10.5, color: C.t4, marginTop: 3 }}>{e.window} · {e.who}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
