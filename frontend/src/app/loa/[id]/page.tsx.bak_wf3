'use client'

/**
 * LAURA — LOA Detail (reviewer view) — dark premium design.
 *
 * Matches the target: KPI band, single workflow, Excel block, and a
 * "Presentation review" split (cream/navy slide with per-field clickable comments
 * on the left, Comments panel on the right).
 *
 * - Role decides which halves show: regional_cfo → Excel only;
 *   regional_cmo → PPT only; everyone else → both.
 * - PPT slide hidden when ppt_slide_required is false (budget < €50k).
 * - Pins: click the slide → drop a pin at (x,y) → composer → posts a comment
 *   Each field (Description/Tools/KPI/Cost/Photos) is clickable with a count badge.
 * - Approve/Reject via the real ApprovalPanel, gated on can_validate ||
 *   can_override_lock.
 *
 * Colors are all CSS variables from globals.css so it flips light/dark.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
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

const WORKFLOW = [
  { key: 'draft', label: 'Draft' },
  { key: 'emea_review', label: 'EMEA review' },
  { key: 'global_review', label: 'Brand review' },
  { key: 'emea_post_global_review', label: 'Functions' },
  { key: 'cmo_cfo_review', label: 'CMO / CFO' },
  { key: 'corporate_review', label: 'Corporate' },
  { key: 'approved', label: 'Approved' },
]
const WF_ORDER = ['draft', 'emea_review', 'global_review', 'emea_post_global_review', 'cmo_cfo_review', 'emea_final_review', 'corporate_review', 'approved']

export default function LOADetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const loaId = params.id

  const [loa, setLoa] = useState<LOA | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [siblingIds, setSiblingIds] = useState<string[]>([])

  const [comments, setComments] = useState<CommentItem[]>([])
  const [tab, setTab] = useState<'open' | 'resolved'>('open')
  const [activeField, setActiveField] = useState<string | null>(null)
  const [pending, setPending] = useState<{ fieldKey: string } | null>(null)
  const [draft, setDraft] = useState('')
  const [posting, setPosting] = useState(false)

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
      // API returns { loa_id, total, comments: [...] } — but be robust to a
      // bare array too, in case listComments already unwraps it.
      const list = Array.isArray(data) ? data : (data?.comments ?? [])
      setComments(list)
    } catch { setComments([]) }
  }, [loaId])

  useEffect(() => { fetchLOA() }, [fetchLOA])
  useEffect(() => { fetchComments() }, [fetchComments])
  useEffect(() => { getLOAs().then((l) => setSiblingIds(l.map((x) => x.id))).catch(() => {}) }, [])

  const currentIndex = siblingIds.indexOf(loaId)
  const goTo = useCallback((offset: number) => {
    const n = currentIndex + offset
    if (n < 0 || n >= siblingIds.length) return
    router.push(`/loa/${siblingIds[n]}`)
  }, [currentIndex, siblingIds, router])

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'ArrowLeft') goTo(-1); if (e.key === 'ArrowRight') goTo(1) }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [goTo])

  const roleCode = roleInfo?.role_code ?? null
  const showExcel = roleCode !== 'regional_cmo'
  const showPpt = roleCode !== 'regional_cfo' && !!loa?.ppt_slide_required

  const openComments = comments.filter((c) => !c.resolved)
  const resolvedComments = comments.filter((c) => c.resolved)

  // Map each field_key to its section (matches backend FIELD_TO_SECTION) so we
  // can count comments per field for the slide badges.
  const FIELD_SECTION: Record<string, string> = {
    description: 'overview', detail: 'overview', kpi: 'kpis',
    cost_drill_down: 'financials', photos: 'photos',
  }
  // Count open comments per section (for the slide badges).
  const sectionCounts: Record<string, number> = {}
  for (const c of openComments) {
    const sec = c.section || (c.field_key ? FIELD_SECTION[c.field_key] : undefined) || 'general'
    sectionCounts[sec] = (sectionCounts[sec] || 0) + 1
  }
  // Which section is currently highlighted (from hovering a field or a card).
  const activeSection = activeField ? FIELD_SECTION[activeField] : null

  // Assign a stable number to each open comment (by creation order) and map
  // each field_key to the number of its FIRST comment — that's the marker
  // shown on the slide, echoed on the card. Matches the client mockup.
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
      // Section derived from the clicked field_key.
      const section = FIELD_SECTION[pending.fieldKey] || 'general'
      await createComment(loaId, section, draft.trim(), {
        anchor_type: 'field',
        field_key: pending.fieldKey,
      })
      setDraft(''); setPending(null)
      await fetchComments()
    } finally { setPosting(false) }
  }

  async function resolveComment(id: string) {
    try { await api.patch(`/comments/${id}/resolve`); await fetchComments() } catch {}
  }

  if (loading || permsLoading) return <Screen>Loading LOA…</Screen>
  if (notFound || !loa) return <Screen>This LOA doesn't exist or you don't have access to it.</Screen>
  if (permissions && !permissions.can_view) return <Screen>You don't have permission to view this LOA.</Screen>

  const badge = STATUS_CONFIG[loa.status]
  const title = loa.brand ? `${loa.brand}: ${loa.activity_type}` : (loa.activity_type || 'LOA')
  const wfIndex = WF_ORDER.indexOf(loa.status)
  const totalFY = (loa as any).fy_2026_total ?? 0

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px 40px' }}>

        {/* Top row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0 8px' }}>
          <button onClick={() => router.push('/')} style={btnGhost}>
            <Icon d={ic.back} size={16} color="var(--text-muted)" />
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Back to tracker</span>
          </button>
          {siblingIds.length > 0 && (
            <LoaNav current={Math.max(currentIndex, 0)} total={siblingIds.length} onPrev={() => goTo(-1)} onNext={() => goTo(1)}
              gold="var(--accent)" border="var(--border)" text2="var(--text-secondary)" text3="var(--text-muted)" />
          )}
        </div>

        {/* Title + actions */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 18 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--text-muted)' }}>{loa.loa_number || loa.loa_draft_id || loa.id}</span>
              {badge && <span className={`badge ${badge.cls}`} style={{ padding: '2px 10px', borderRadius: 6, fontSize: 11, fontWeight: 500 }}>{badge.label}</span>}
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 500, margin: 0, letterSpacing: -0.3, lineHeight: 1.2 }}>{title}</h1>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            {permissions?.can_edit && (
              <button onClick={() => router.push(`/loa/new?edit=${loa.id}`)} style={btnOutline}>
                <Icon d={ic.edit} size={14} color="var(--text-secondary)" /><span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Edit details</span>
              </button>
            )}
            {permissions?.can_comment && (
              <button onClick={() => setPending({ x: 0.5, y: 0.5 })} style={btnOutline}>
                <Icon d={ic.comment} size={14} color="var(--text-secondary)" /><span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Comments</span>
              </button>
            )}
          </div>
        </div>

        {/* KPI band */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 16 }}>
          <Kpi label="Approval status" value={badge?.label ?? loa.status} sub="Workflow" accent={loa.status === 'approved' ? 'var(--text-success)' : undefined} />
          <Kpi label="Rows" value="1" sub="This LOA" />
          <Kpi label="PPT required" value={loa.ppt_slide_required ? 'YES' : 'NO'} sub={loa.ppt_slide_required ? 'Slide generated' : 'Under threshold'} />
          <Kpi label="Comments" value={String(comments.length)} sub={`${openComments.length} open`} />
          <Kpi label="Total FY 2026" value={formatCell(totalFY, 'money')} sub={(loa as any).capex_opex || ''} />
        </div>

        {/* Workflow + Approve/Reject (single, from ApprovalPanel) */}
        <div style={{ marginBottom: 16 }}>
          {(permissions?.can_validate || permissions?.can_override_lock) ? (
            <ApprovalPanel
              loa={{ id: loa.id, status: loa.status }}
              perms={{ can_validate: !!permissions?.can_validate, user_role: roleCode || '' }}
              onActionDone={refreshAfterAction}
            />
          ) : (
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px' }}>
              <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', letterSpacing: 0.5, marginBottom: 14 }}>APPROVAL WORKFLOW</div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                {WORKFLOW.map((s, i) => {
                  const done = wfIndex >= 0 && WF_ORDER.indexOf(s.key) <= wfIndex
                  return (
                    <div key={s.key} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                      {i > 0 && <div style={{ flex: 1, height: 2, background: done ? 'var(--accent)' : 'var(--border-strong)' }} />}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 26, height: 26, borderRadius: 13, background: done ? 'var(--accent)' : 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: done ? 'none' : '1.5px solid var(--border-strong)' }}>
                          {done && <Icon d={ic.check} size={13} color="var(--accent-text)" />}
                        </div>
                        <span style={{ fontSize: 10, color: done ? 'var(--text-secondary)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>{s.label}</span>
                      </div>
                      {i < WORKFLOW.length - 1 && <div style={{ flex: 1, height: 2, background: (wfIndex >= 0 && WF_ORDER.indexOf(WORKFLOW[i + 1].key) <= wfIndex) ? 'var(--accent)' : 'var(--border-strong)' }} />}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Role lane hint */}
        {(!showExcel || (!showPpt && roleCode === 'regional_cfo')) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, padding: '10px 18px', borderRadius: 10, background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
            <Icon d={ic.user} size={16} color="var(--accent)" />
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>
              {roleCode === 'regional_cmo' ? 'CMO review — story & impact' : 'CFO review — data integrity'}
            </span>
          </div>
        )}

        {/* Excel */}
        {showExcel && (
          <div style={{ background: 'var(--bg-surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 20 }}>
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
        )}

        {/* Presentation review: slide with per-field comments + comments panel */}
        {showPpt && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 12 }}>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: 13, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Icon d={ic.extLink} size={14} color="var(--text-secondary)" /> Presentation review
                </span>
                <button onClick={() => downloadPPT(loa.id)} style={btnGhost}>
                  <Icon d={ic.extLink} size={14} color="var(--text-secondary)" /><span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Download PPT</span>
                </button>
              </div>
              <SlidePreview
                loa={loa as any}
                commentable={!!permissions?.can_comment}
                sectionCounts={sectionCounts}
                fieldNumbers={fieldNumbers}
                activeField={activeField}
                onComment={(fieldKey) => permissions?.can_comment && setPending({ fieldKey })}
                onFieldHover={setActiveField}
              />
              {permissions?.can_comment && (
                <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '8px 0 0', textAlign: 'center' }}>
                  Click a field (Description, Tools, KPI, Cost drill down, Photos) to comment on it
                </p>
              )}
            </div>

            {/* Comments panel */}
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 13, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  Comments
                  {comments.length > 0 && <span style={{ background: 'var(--accent)', color: 'var(--accent-text)', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 8 }}>{comments.length}</span>}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 14, borderBottom: '1px solid var(--border)', marginBottom: 10 }}>
                {([['open', `Open (${openComments.length})`], ['resolved', `Resolved (${resolvedComments.length})`]] as const).map(([k, l]) => (
                  <button key={k} onClick={() => setTab(k)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, paddingBottom: 6, color: tab === k ? 'var(--text-primary)' : 'var(--text-muted)', borderBottom: tab === k ? '2px solid var(--accent)' : '2px solid transparent' }}>{l}</button>
                ))}
              </div>
              <div style={{ flex: 1, overflowY: 'auto', minHeight: 120, maxHeight: 360 }}>
                {(tab === 'open' ? openComments : resolvedComments).length === 0 ? (
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>
                    {tab === 'open' ? 'No open comments' : 'Nothing resolved'}
                  </p>
                ) : (
                  (tab === 'open' ? openComments : resolvedComments).map((c) => {
                    const cSection = c.section || (c.field_key ? FIELD_SECTION[c.field_key] : undefined) || 'general'
                    const active = activeSection != null && cSection === activeSection
                    const fieldLabel = c.field_key ? c.field_key.replace(/_/g, ' ') : 'general'
                    return (
                      <div key={c.id}
                        onMouseEnter={() => setActiveField(c.field_key || null)} onMouseLeave={() => setActiveField(null)}
                        style={{ marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid var(--border)', background: active ? 'var(--bg-elevated)' : 'transparent', borderRadius: 8, padding: active ? 8 : '0 0 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {tab === 'open' && numberByCommentId.get(c.id) != null && (
                            <span style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--accent)', color: 'var(--accent-text)', fontSize: 10, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{numberByCommentId.get(c.id)}</span>
                          )}
                          <span style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.3, background: 'var(--bg-elevated)', color: 'var(--text-muted)', padding: '1px 6px', borderRadius: 4 }}>{fieldLabel}</span>
                          <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500 }}>{c.author_name}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>— {c.author_role}</span>
                          <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-muted)' }}>{new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5, marginTop: 4 }}>{c.content}</div>
                        {tab === 'open' && permissions?.can_validate && (
                          <button onClick={() => resolveComment(c.id)} style={{ marginTop: 6, background: 'none', border: 'none', color: 'var(--accent)', fontSize: 11, cursor: 'pointer', padding: 0 }}>Mark resolved</button>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Pin composer popover */}
      {pending && permissions?.can_comment && (
        <div onClick={() => setPending(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 18, width: 360 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 10 }}>
              Comment on <span style={{ color: 'var(--accent)' }}>{pending.fieldKey ? pending.fieldKey.replace(/_/g, ' ') : 'General comment'}</span>
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

function Kpi({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 600, color: accent || 'var(--text-primary)', lineHeight: 1.1, letterSpacing: -0.3 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sub}</div>}
    </div>
  )
}

function excelColLetter(index: number): string {
  let n = index, s = ''
  do { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1 } while (n >= 0)
  return s
}

function Screen({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: 40, minHeight: '100vh', background: 'var(--bg-base)', color: 'var(--text-muted)' }}>{children}</div>
}

const btnGhost: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', background: 'transparent', border: 'none', padding: 0 }
const btnOutline: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', background: 'transparent', border: '1px solid var(--border-strong)', borderRadius: 8, padding: '7px 12px' }
