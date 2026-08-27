'use client'

/**
 * LAURA — LOA Detail, rebuilt to design 2b: slide-centric 3-column review.
 *   [ deck-order filmstrip ] · [ slide (dark stage) or Excel for CFO ] · [ comments + approve ]
 *
 * All logic preserved verbatim:
 *  - getLOA / getLOAs (siblings) / listComments / createComment / resolve
 *  - usePermissions + useMyRole → role lanes (CFO=Excel, CMO=slide, else both feel)
 *  - SlidePreview per-field comment zones; pin composer; ApprovalPanel approve/reject
 *  - keyboard ← → to walk the deck order
 */

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useRouter } from 'next/navigation'
import api, { getLOA, getLOAs, downloadPPT, downloadExcel, listComments, createComment, type CommentItem } from '@/lib/api'
import type { LOA } from '@/types/loa'
import { STATUS_CONFIG } from '@/types/loa'
import { usePermissions, useMyRole } from '@/hooks/usePermissions'
import { formatCell } from '@/lib/format'
import { EXCEL_COLUMNS, columnWidth } from '@/lib/excelColumns'
import { Icon, ic, LoaNav } from '@/components/loa-detail/shared'
import { SlidePreview } from '@/components/loa-detail/SlidePreview'
import ApprovalPanel from '@/components/draft/ApprovalPanel'
import SplitScreenReview from '@/components/alignment-review/SplitScreenReview'
import { interfaceFor, canUseTemplate, needsTemplateChooser } from '@/lib/roles'
import { activityLabel } from '@/types/loa'

/**
 * /loa/:id — LOA detail.
 *
 * Which template renders here is decided by the role's allowed set, not by a
 * role name (see `allowedTemplates()` in lib/roles.ts):
 *
 *   - roles whose template is `split` (Local Marketer, Local Alignment, Global
 *     Function Review, Global Brand Review) get the SPLIT-SCREEN — Excel row
 *     panel on top, LOA slide below. This was the bug: they were being sent to
 *     the legacy detail layout below, so the split-screen template they were
 *     meant to use was unreachable.
 *   - everyone else keeps the legacy detail layout, unchanged.
 *
 * Deep links work for both: the id comes from the URL, and `initialLoaId` puts
 * the split-screen on that record.
 *
 * The spec's `/loas/:id` is this route — `/loa/:id` is the existing convention,
 * matching /loa/new and every existing link.
 */
export default function LOADetailPage() {
  const { role: routingRole, loading: routingRoleLoading } = useMyRole()
  const iface = interfaceFor(routingRole?.role_code, routingRole?.can_override_lock === true)

  // Wait for the role before choosing a template, or a split-screen role would
  // see the legacy layout flash first.
  if (routingRoleLoading) return <p className="la-cycleview-msg">Loading…</p>
  if (canUseTemplate(iface, 'split') && !needsTemplateChooser(iface)) {
    return <LOASplitScreen />
  }
  return <LOALegacyDetail />
}

/**
 * The split-screen template, scoped to the LOA in the URL. Reuses
 * SplitScreenReview as built — comment anchors, stage approval, no reject —
 * rather than reimplementing any of it.
 */
function LOASplitScreen() {
  const params = useParams<{ id: string }>()
  const { role } = useMyRole()
  const [cycleId, setCycleId] = useState<string | null>(null)

  // Comments are cycle-scoped, so the split-screen needs the LOA's cycle.
  useEffect(() => {
    let alive = true
    getLOA(params.id)
      .then(l => { if (alive) setCycleId((l as any)?.cycle_id ?? null) })
      .catch(() => { /* the split-screen surfaces its own load error */ })
    return () => { alive = false }
  }, [params.id])

  return (
    <SplitScreenReview
      cycleId={cycleId}
      roleCode={role?.role_code || ''}
      userEmail={role?.email || ''}
      userName={role?.full_name || undefined}
      isAdmin={role?.can_override_lock === true}
      initialLoaId={params.id}
    />
  )
}

function LOALegacyDetail() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const loaId = params.id

  const [loa, setLoa] = useState<LOA | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [siblings, setSiblings] = useState<LOA[]>([])

  const [comments, setComments] = useState<CommentItem[]>([])
  const [tab, setTab] = useState<'open' | 'resolved'>('open')
  const [activeField, setActiveField] = useState<string | null>(null)
  const [pending, setPending] = useState<{ fieldKey: string } | null>(null)
  const [draft, setDraft] = useState('')
  const [posting, setPosting] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)

  const { permissions, loading: permsLoading, refresh: refreshPerms } = usePermissions(loaId)
  const { role: roleInfo } = useMyRole()

  const fetchLOA = useCallback(async () => {
    setLoading(true); setNotFound(false)
    try {
      const data = await getLOA(loaId)
      setLoa(data)
    } catch (err: any) {
      if (err?.response?.status === 404) setNotFound(true)
      else throw err
    } finally {
      setLoading(false)
    }
  }, [loaId])

  const fetchComments = useCallback(async () => {
    try {
      const data: any = await listComments(loaId)
      const list = Array.isArray(data) ? data : (data?.comments ?? [])
      setComments(list)
    } catch { setComments([]) }
  }, [loaId])

  useEffect(() => { fetchLOA() }, [fetchLOA])
  useEffect(() => { fetchComments() }, [fetchComments])
  useEffect(() => { getLOAs().then((l) => setSiblings(l)).catch(() => {}) }, [])

  const siblingIds = siblings.map((x) => x.id)
  const currentIndex = siblingIds.indexOf(loaId)
  const goTo = useCallback((offset: number) => {
    const list = siblings.map((x) => x.id)
    const n = list.indexOf(loaId) + offset
    if (n < 0 || n >= list.length) return
    router.push(`/loa/${list[n]}`)
  }, [siblings, loaId, router])

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setFullscreen(false); return }
      if (e.key === 'ArrowLeft') goTo(-1)
      if (e.key === 'ArrowRight') goTo(1)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [goTo])

  useEffect(() => {
    if (fullscreen) {
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = '' }
    }
  }, [fullscreen])

  const roleCode = roleInfo?.role_code ?? null
  const showExcel = roleCode !== 'regional_cmo'
  const showPpt = roleCode !== 'regional_cfo' && !!loa?.ppt_slide_required

  const openComments = comments.filter((c) => !c.resolved)
  const resolvedComments = comments.filter((c) => c.resolved)

  const FIELD_SECTION: Record<string, string> = {
    description: 'overview', detail: 'overview', kpi: 'kpis',
    cost_drill_down: 'financials', photos: 'photos',
  }
  const sectionCounts: Record<string, number> = {}
  for (const c of openComments) {
    const sec = c.section || (c.field_key ? FIELD_SECTION[c.field_key] : undefined) || 'general'
    sectionCounts[sec] = (sectionCounts[sec] || 0) + 1
  }
  const activeSection = activeField ? FIELD_SECTION[activeField] : null

  const numberByCommentId = new Map<string, number>()
  openComments.forEach((c, i) => numberByCommentId.set(c.id, i + 1))
  const fieldNumbers: Record<string, number> = {}
  for (const c of openComments) {
    if (c.field_key && fieldNumbers[c.field_key] == null) {
      fieldNumbers[c.field_key] = numberByCommentId.get(c.id) as number
    }
  }

  const refreshAfterAction = useCallback(() => { fetchLOA(); refreshPerms(); fetchComments() }, [fetchLOA, refreshPerms, fetchComments])

  async function submitFieldComment() {
    if (!pending || !draft.trim()) return
    setPosting(true)
    try {
      const section = FIELD_SECTION[pending.fieldKey] || 'general'
      await createComment(loaId, section, draft.trim(), {
        anchor_type: 'field',
        field_key: pending.fieldKey,
      })
      setDraft(''); setPending(null)
      // A comment can auto-advance the workflow (backend/api/comments.py), so
      // refetch the LOA (stepper + status), permissions and comments — no reload.
      refreshAfterAction()
    } finally { setPosting(false) }
  }

  async function resolveComment(id: string) {
    try { await api.patch(`/comments/${id}/resolve`); await fetchComments() } catch {}
  }

  if (loading || permsLoading) return <Screen>Loading LOA…</Screen>
  if (notFound || !loa) return <Screen>This LOA doesn&rsquo;t exist or you don&rsquo;t have access to it.</Screen>
  if (permissions && !permissions.can_view) return <Screen>You don&rsquo;t have permission to view this LOA.</Screen>

  const badge = STATUS_CONFIG[loa.status]
  const totalFY = (loa as any).fy_2026_total ?? 0
  const cat = Array.isArray((loa as any).category) ? (loa as any).category.join(' / ') : ((loa as any).category || '')
  // Comment-only reviewers at multi-reviewer gate stages still submit their
  // review explicitly (they advance the LOA via /validate, not by commenting).
  const st = loa.status as string
  const isGateStage = st === 'global_review' || st === 'local_alignment'
  const reviewerCanSubmit = !!(permissions?.can_comment && isGateStage)
  const canApprove = !!(permissions?.can_validate || permissions?.can_override_lock || reviewerCanSubmit)
  const deck = siblings.length ? siblings : [loa]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 56px)', minHeight: 560, background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      {/* breadcrumb sub-header */}
      <div style={{ height: 52, flex: 'none', display: 'flex', alignItems: 'center', gap: 11, padding: '0 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
        <button onClick={() => router.push('/')} style={btnGhost}>
          <Icon d={ic.back} size={15} color="var(--text-muted)" /><span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Tracker</span>
        </button>
        {cat && (<><span style={{ color: 'var(--border-strong)' }}>›</span><span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{cat}</span></>)}
        <span style={{ color: 'var(--border-strong)' }}>›</span>
        <span style={{ fontSize: 12.5, fontWeight: 600 }}>{activityLabel(loa.activity_type) || 'LOA'}</span>
        <span style={{ color: 'var(--border-strong)' }}>›</span>
        <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{[loa.country, loa.loa_number || loa.loa_draft_id].filter(Boolean).join(' · ')}</span>
        {badge && <span className={`badge ${badge.cls}`} style={{ marginLeft: 6, padding: '2px 10px', borderRadius: 6, fontSize: 11, fontWeight: 500 }}>{badge.label}</span>}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--text-secondary)' }}>FY26 {formatCell(totalFY, 'money')}</span>
          {siblingIds.length > 0 && (
            <LoaNav current={Math.max(currentIndex, 0)} total={siblingIds.length} onPrev={() => goTo(-1)} onNext={() => goTo(1)}
              gold="var(--accent)" border="var(--border)" text2="var(--text-secondary)" text3="var(--text-muted)" />
          )}
          {permissions?.can_edit && (
            <button onClick={() => router.push(`/loa/new?edit=${loa.id}`)} style={btnOutline}><span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Edit</span></button>
          )}
          {showPpt && <button onClick={() => downloadPPT(loa.id)} style={btnOutline}><Icon d={ic.extLink} size={13} color="var(--text-secondary)" /><span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>PPT</span></button>}
          {showExcel && <button onClick={() => downloadExcel(loa.id)} style={btnOutline}><Icon d={ic.extLink} size={13} color="var(--text-secondary)" /><span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>xlsx</span></button>}
        </div>
      </div>

      {/* 3-column: deck order · slide/excel · comments+approve */}
      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '220px minmax(0,1fr) 344px' }}>
        {/* deck order filmstrip */}
        <div style={{ borderRight: '1px solid var(--border)', background: 'var(--bg-surface)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '11px 14px', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Deck order</div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
            {deck.map((s, i) => {
              const on = s.id === loaId
              const t = (s as any).display_title || s.brand || s.activity_type || s.loa_number || 'LOA'
              return (
                <button key={s.id} onClick={() => router.push(`/loa/${s.id}`)}
                  style={{ width: '100%', textAlign: 'left', display: 'flex', gap: 9, alignItems: 'center', padding: '7px 9px', marginBottom: 2, borderRadius: 7, border: on ? '1px solid var(--accent)' : '1px solid transparent', background: on ? 'var(--bg-elevated)' : 'transparent', cursor: 'pointer' }}>
                  <span style={{ width: 34, height: 20, flex: 'none', borderRadius: 3, background: 'var(--bg-elevated)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700, color: 'var(--text-muted)' }}>{(s.country || '').slice(0, 2).toUpperCase() || String(i + 1)}</span>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ display: 'block', fontSize: 11.5, fontWeight: on ? 600 : 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t}</span>
                    <span style={{ display: 'block', fontSize: 9.5, color: 'var(--text-muted)' }}>{[s.country, formatCell((s as any).fy_2026_total || 0, 'money')].filter(Boolean).join(' · ')}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* center: slide (CMO / most) or Excel (CFO / no ppt) */}
        <div style={{ minWidth: 0, background: showPpt ? '#16150F' : 'var(--bg-base)', display: 'flex', alignItems: showPpt ? 'center' : 'flex-start', justifyContent: 'center', padding: showPpt ? 24 : 18, overflow: 'auto' }}>
          {showPpt ? (
            <div style={{ position: 'relative', width: '100%', maxWidth: 920 }}>
              <SlidePreview
                loa={loa as any}
                commentable={!!permissions?.can_comment}
                sectionCounts={sectionCounts}
                fieldNumbers={fieldNumbers}
                activeField={activeField}
                onComment={(fieldKey) => permissions?.can_comment && setPending({ fieldKey })}
                onFieldHover={setActiveField}
              />
              <button onClick={() => setFullscreen(true)} title="Fullscreen preview (F)"
                style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 6, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(244,238,223,0.85)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" />
                  <line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" />
                </svg>
              </button>
              {permissions?.can_comment && <p style={{ fontSize: 11, color: 'rgba(244,238,223,.5)', margin: '10px 0 0', textAlign: 'center' }}>Click a field on the slide to comment on it</p>}
            </div>
          ) : (
            <div style={{ width: '100%' }}>
              <div style={{ background: 'var(--bg-surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 24, height: 24, borderRadius: 5, background: '#217346', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff' }}>X</span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>Excel data</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>· 1 row · {EXCEL_COLUMNS.length} columns</span>
                  </div>
                  <button onClick={() => downloadExcel(loa.id)} style={btnOutline}>
                    <Icon d={ic.extLink} size={14} color="var(--text-secondary)" /><span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Open in Excel</span>
                  </button>
                </div>
                <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                  <table style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                    <thead>
                      <tr>
                        <th style={{ position: 'sticky', left: 0, background: 'var(--bg-elevated)', padding: '10px 12px', borderBottom: '1px solid var(--border-strong)', borderRight: '1px solid var(--border)', zIndex: 2, width: 44 }} />
                        {EXCEL_COLUMNS.map((c, i) => (
                          <th key={c.header} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-strong)', whiteSpace: 'nowrap', minWidth: columnWidth(c.header) }}>
                            <span style={{ fontWeight: 600, marginRight: 8, color: 'var(--text-muted)', opacity: 0.7 }}>{excelColLetter(i)}</span>{c.header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td style={{ position: 'sticky', left: 0, background: 'var(--bg-surface)', padding: '12px', textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)', zIndex: 1, boxShadow: '2px 0 4px -2px rgba(0,0,0,0.15)' }}>2</td>
                        {EXCEL_COLUMNS.map((c) => (
                          <td key={c.header} title={c.backendOnly ? 'Not yet returned by the API' : undefined} style={{ padding: '12px 14px', fontSize: 13, color: (c.backendOnly) ? 'var(--text-muted)' : 'var(--text-primary)', borderBottom: '1px solid var(--border)', whiteSpace: c.fmt === 'text' && columnWidth(c.header) >= 240 ? 'normal' : 'nowrap', minWidth: columnWidth(c.header), verticalAlign: 'top', lineHeight: 1.45 }}>
                            {formatCell((loa as any)[c.field], c.fmt)}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* right: Laura one-line + comments + approve */}
        <div style={{ borderLeft: '1px solid var(--border)', background: 'var(--bg-surface)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ padding: '13px 15px', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}><span style={{ color: 'var(--accent)' }}>✦</span><span style={{ fontSize: 11.5, fontWeight: 600 }}>Laura, in one line</span></div>
            <div style={{ fontSize: 12, lineHeight: 1.55, color: 'var(--text-secondary)', marginTop: 6 }}>
              {[loa.brand, loa.activity_type].filter(Boolean).join(' · ')} in {loa.country || '—'} — {formatCell(totalFY, 'money')}. {openComments.length} open comment{openComments.length !== 1 ? 's' : ''}.
            </div>
          </div>

          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '10px 15px' }}>
            <div style={{ display: 'flex', gap: 14, borderBottom: '1px solid var(--border)', marginBottom: 10 }}>
              {([['open', `Open (${openComments.length})`], ['resolved', `Resolved (${resolvedComments.length})`]] as const).map(([k, l]) => (
                <button key={k} onClick={() => setTab(k)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, paddingBottom: 6, color: tab === k ? 'var(--text-primary)' : 'var(--text-muted)', borderBottom: tab === k ? '2px solid var(--accent)' : '2px solid transparent' }}>{l}</button>
              ))}
              {permissions?.can_comment && (
                <button onClick={() => setPending({ fieldKey: 'general' })} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--accent)', paddingBottom: 6 }}>+ Comment</button>
              )}
            </div>
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 100 }}>
              {(tab === 'open' ? openComments : resolvedComments).length === 0 ? (
                <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>{tab === 'open' ? 'No open comments' : 'Nothing resolved'}</p>
              ) : (
                (tab === 'open' ? openComments : resolvedComments).map((c) => {
                  const cSection = c.section || (c.field_key ? FIELD_SECTION[c.field_key] : undefined) || 'general'
                  const active = activeSection != null && cSection === activeSection
                  const fieldLabel = c.field_key ? c.field_key.replace(/_/g, ' ') : 'general'
                  return (
                    <div key={c.id}
                      onMouseEnter={() => setActiveField(c.field_key || null)} onMouseLeave={() => setActiveField(null)}
                      style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid var(--border)', background: active ? 'var(--bg-elevated)' : 'transparent', borderRadius: 8, padding: active ? 8 : '0 0 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        {tab === 'open' && numberByCommentId.get(c.id) != null && (
                          <span style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--accent)', color: 'var(--accent-text)', fontSize: 10, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{numberByCommentId.get(c.id)}</span>
                        )}
                        <span style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.3, background: 'var(--bg-elevated)', color: 'var(--text-muted)', padding: '1px 6px', borderRadius: 4 }}>{fieldLabel}</span>
                        <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500 }}>{c.author_name}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>— {c.author_role}</span>
                        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-muted)' }}>{new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.5, marginTop: 4 }}>{c.content}</div>
                      {tab === 'open' && permissions?.can_validate && (
                        <button onClick={() => resolveComment(c.id)} style={{ marginTop: 6, background: 'none', border: 'none', color: 'var(--accent)', fontSize: 11, cursor: 'pointer', padding: 0 }}>Mark resolved</button>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>

          <div style={{ padding: '12px 15px', borderTop: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
            {canApprove ? (
              <ApprovalPanel
                loa={{ id: loa.id, status: loa.status }}
                perms={{ can_validate: !!permissions?.can_validate, user_role: roleCode || '' }}
                reviewerCanSubmit={reviewerCanSubmit}
                onActionDone={refreshAfterAction}
              />
            ) : (
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Status: <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{badge?.label ?? loa.status}</span></div>
            )}
          </div>
        </div>
      </div>

      {/* Fullscreen slide overlay */}
      {fullscreen && showPpt && typeof document !== 'undefined' && createPortal(
        <div onClick={() => setFullscreen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.94)', zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 48px' }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 'min(90vw, calc(90vh * 16 / 9))' }}>
            <SlidePreview
              loa={loa as any}
              commentable={false}
              sectionCounts={{}}
              fieldNumbers={{}}
              activeField={null}
              onComment={() => {}}
              onFieldHover={() => {}}
            />
          </div>
          <button onClick={() => setFullscreen(false)} title="Exit fullscreen (Esc)"
            style={{ position: 'fixed', top: 18, right: 18, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.22)', borderRadius: '50%', width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'rgba(244,238,223,0.9)', fontSize: 22, lineHeight: 1, flexShrink: 0 }}>×</button>
        </div>,
        document.body
      )}

      {/* Pin composer popover */}
      {pending && permissions?.can_comment && (
        <div onClick={() => setPending(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 18, width: 360 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 10 }}>
              Comment on <span style={{ color: 'var(--accent)' }}>{pending.fieldKey && pending.fieldKey !== 'general' ? pending.fieldKey.replace(/_/g, ' ') : 'this LOA'}</span>
            </div>
            <textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Write a comment…" rows={3} autoFocus
              style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-strong)', borderRadius: 8, padding: '8px 10px', fontSize: 13, color: 'var(--text-primary)', resize: 'vertical' }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
              <button onClick={() => setPending(null)} style={btnOutline}><span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Cancel</span></button>
              <button onClick={submitFieldComment} disabled={posting || !draft.trim()} style={{ background: 'var(--accent)', color: 'var(--accent-text)', border: 'none', borderRadius: 8, padding: '7px 16px', fontSize: 12, fontWeight: 500, cursor: 'pointer', opacity: posting || !draft.trim() ? 0.5 : 1 }}>
                {posting ? 'Posting…' : 'Comment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function excelColLetter(index: number): string {
  let n = index, s = ''
  do { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1 } while (n >= 0)
  return s
}

function Screen({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: 40, minHeight: '60vh', background: 'var(--bg-base)', color: 'var(--text-muted)' }}>{children}</div>
}

const btnGhost: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', background: 'transparent', border: 'none', padding: 0 }
const btnOutline: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', background: 'transparent', border: '1px solid var(--border-strong)', borderRadius: 8, padding: '7px 12px' }
