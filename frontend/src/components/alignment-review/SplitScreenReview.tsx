'use client'
/**
 * SplitScreenReview — the third review template.
 *
 *   header      LOA identity · queue position · viewer
 *   stepper     alignment chain + approval record + all-comments toggle
 *   [banner]    fully-aligned state
 *   top half    the submitted Excel row — every cell a comment anchor
 *   divider     collapse data / collapse slide
 *   bottom half the real deck slide at 1280 × 720, scaled to fill, + actions rail
 *   action bar  comment summary · next LOA · approve
 *   [drawer]    every thread on this LOA, labelled by anchor
 *
 * Two faces:
 *   reviewers (local_alignment / global_function_review / global_brand_review,
 *   and can_override_lock admins) comment and approve their stage;
 *   the LOA's own marketer sees the same two halves read-only.
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { LOA } from '@/types/loa'
import type {
  ReviewComment, AlignmentStage, LOAReviewStageRecord, LOAWithStages, LOAPhotoRecord,
} from '@/types/review'
import { ALIGNMENT_STAGES, ALIGNMENT_STAGE_LABELS } from '@/types/review'
import {
  fetchAlignmentQueue, fetchLoaStages, fetchComments, postComment,
} from '@/lib/review-api'
import { validateWorkflowStep } from '@/lib/api'
import { fetchCycle, type Cycle } from '@/lib/cycles-api'
import ReviewTopBar from './ReviewTopBar'
import StageStepper from './StageStepper'
import ExcelRowPanel from './ExcelRowPanel'
import SlidePanel from './SlidePanel'
import CommentsSummaryPanel from './CommentsSummaryPanel'
import SplitPaneShell from '@/components/layout/SplitPaneShell'
import ApproveConfirmModal from './ApproveConfirmModal'
import CommentPopover from './CommentPopover'
import { useAnchorPopover } from './useAnchorPopover'
import { countByAnchor, normalizeSlidePhotos } from './anchors'

const MONO = "'IBM Plex Mono', ui-monospace, monospace"

interface Props {
  cycleId: string | null
  roleCode: string
  userEmail: string
  userName?: string
  /** can_override_lock — lets an admin act on whichever stage is current. */
  isAdmin?: boolean
  /**
   * Deep link: open this LOA rather than the head of the queue. If it is not in
   * the viewer's queue (a marketer's own LOA sitting at nobody's stage, an admin
   * opening any LOA) it is prepended, so /loa/:id resolves for any role
   * permitted to see it. The API still decides permission — this only chooses
   * which record to show.
   */
  initialLoaId?: string
}

type CollapseState = 'none' | 'top' | 'bottom'

/**
 * Maps a role code to the alignment stage it acts on.
 * Canonical codes match directly; domain-expert codes match by family pattern.
 * emea_commenter_tm (Trade Marketing) is an outlier that doesn't follow the
 * global_function_ prefix but belongs to the Global Functions group.
 */
function stageForRole(roleCode: string): AlignmentStage | null {
  if (roleCode === 'local_alignment' || roleCode.endsWith('_finance') || roleCode.endsWith('_procurement') || roleCode.endsWith('_compliance')) return 'local_alignment'
  if (roleCode === 'global_function_review' || roleCode.startsWith('global_function_') || roleCode === 'emea_commenter_tm') return 'global_function_review'
  if (roleCode === 'global_brand_review' || roleCode.startsWith('global_brand_')) return 'global_brand_review'
  return null
}

/**
 * Which validate sub-gate this role submits.
 * Canonical codes ('local_alignment', 'global_brand_review', 'global_function_review')
 * return 'all' — the backend handles them via can_override_lock or their permission set.
 * Domain-expert codes return their specific sub-gate so the UI can show which
 * sub-gates are still outstanding.
 */
function subGateForRole(roleCode: string): 'finance' | 'procurement' | 'compliance' | 'brand' | 'function' | 'all' {
  if (roleCode.endsWith('_finance')) return 'finance'
  if (roleCode.endsWith('_procurement')) return 'procurement'
  if (roleCode.endsWith('_compliance')) return 'compliance'
  if ((roleCode.startsWith('global_brand_') && roleCode !== 'global_brand_review')) return 'brand'
  if ((roleCode.startsWith('global_function_') && roleCode !== 'global_function_review') || roleCode === 'emea_commenter_tm') return 'function'
  return 'all'
}

/** "04 Aug" — the compact day/month the design's history line uses. */
function shortDate(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

/**
 * `Submitted 04 Aug · Local Alignment approved 07 Aug · read-only until …`
 * — submission, then one segment per stage already approved, then what the
 * viewer is waiting on.
 */
function stageHistoryLine(
  submittedAt: string | null | undefined,
  stages: Partial<Record<AlignmentStage, LOAReviewStageRecord>>,
  currentStage: AlignmentStage | null,
  allApproved: boolean,
): string {
  const parts: string[] = []
  const submitted = shortDate(submittedAt)
  if (submitted) parts.push(`Submitted ${submitted}`)

  for (const s of ALIGNMENT_STAGES) {
    const rec = stages[s]
    if (rec?.status !== 'approved') continue
    const on = shortDate(rec.approvedAt)
    parts.push(`${ALIGNMENT_STAGE_LABELS[s]} approved${on ? ` ${on}` : ''}`)
  }

  parts.push(
    allApproved
      ? 'read-only — chain complete'
      : currentStage
        ? `read-only until ${ALIGNMENT_STAGE_LABELS[currentStage]} approves`
        : 'read-only until the chain completes',
  )
  return parts.join(' · ')
}

/** Cluster marketers are `<cluster>_marketer`; there is no bare `local_marketer` role. */
function isLocalMarketer(roleCode: string): boolean {
  return roleCode === 'local_marketer' || roleCode === 'marketer' || roleCode.endsWith('_marketer')
}

function roleLabel(roleCode: string): string {
  const stage = stageForRole(roleCode)
  if (stage) return ALIGNMENT_STAGE_LABELS[stage]
  if (isLocalMarketer(roleCode)) return 'Local Marketer'
  return roleCode.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export default function SplitScreenReview({
  cycleId, roleCode, userEmail, userName, isAdmin = false, initialLoaId,
}: Props) {
  const router = useRouter()

  /** The stage this viewer owns. Marketers own none — they only watch. */
  const ownStage = stageForRole(roleCode)
  const marketer = isLocalMarketer(roleCode)

  const [queue, setQueue] = useState<LOAWithStages[]>([])
  const [queueIdx, setQueueIdx] = useState(0)
  const [currentLoa, setCurrentLoa] = useState<LOA | null>(null)
  const [photos, setPhotos] = useState<LOAPhotoRecord[]>([])
  const [stages, setStages] = useState<Partial<Record<AlignmentStage, LOAReviewStageRecord>>>({})
  const [currentStage, setCurrentStage] = useState<AlignmentStage | null>(null)
  const [allApproved, setAllApproved] = useState(false)
  const [comments, setComments] = useState<ReviewComment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Which cycle this queue belongs to — drives the badge in the top bar so a
  // reviewer working across an emergency and the normal window knows which.
  const [cycle, setCycle] = useState<Cycle | null>(null)

  const [collapse, setCollapse] = useState<CollapseState>('none')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [activeAnchor, setActiveAnchor] = useState<string | null>(null)
  const [showApprove, setShowApprove] = useState(false)
  const [reloadNonce, setReloadNonce] = useState(0)
  const [downloading, setDownloading] = useState(false)
  const [slideScale, setSlideScale] = useState(0)

  useEffect(() => {
    if (!cycleId) { setCycle(null); return }
    let alive = true
    fetchCycle(cycleId)
      .then(c => { if (alive) setCycle(c) })
      .catch(() => { if (alive) setCycle(null) })   // a missing badge beats a broken bar
    return () => { alive = false }
  }, [cycleId])

  const paneRef = useRef<HTMLDivElement>(null)

  /**
   * An admin has no stage of their own, so they act on whichever stage the LOA
   * is actually waiting on — the backend already lets can_override_lock through.
   */
  const actingStage: AlignmentStage | null = ownStage ?? (isAdmin ? currentStage : null)
  const readOnly = marketer || (!ownStage && !isAdmin)

  // ── Queue ─────────────────────────────────────────────────────────────────
  // Reviewers get their stage queue. Everyone else sees their own submissions.
  const queueStage = ownStage ?? (isAdmin ? 'local_alignment' : null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    const load = queueStage
      ? fetchAlignmentQueue(queueStage).then(res => res.loas)
      : !userEmail
        ? Promise.resolve([] as LOAWithStages[])
        : import('@/lib/api')
            .then(m => m.getLOAs({ include_historical: false }))
            .then((all: LOA[]) => all
              .filter(l => l.requestor_email?.toLowerCase() === userEmail.toLowerCase() && l.status !== 'draft')
              .map(l => ({ ...l, stages: {} as Record<AlignmentStage, LOAReviewStageRecord> } as unknown as LOAWithStages)))

    load
      .then(async loas => {
        if (cancelled) return
        if (!initialLoaId) {
          setQueue(loas)
          setQueueIdx(i => (i < loas.length ? i : 0))
          return
        }
        const at = loas.findIndex(l => l.id === initialLoaId)
        if (at >= 0) { setQueue(loas); setQueueIdx(at); return }

        // Not in the queue — fetch it so a deep link still resolves. A 403/404
        // here is the API refusing, which is the correct outcome to surface.
        try {
          const { getLOA } = await import('@/lib/api')
          const one = await getLOA(initialLoaId)
          if (cancelled) return
          const asQueued = { ...one, stages: {} } as unknown as LOAWithStages
          setQueue([asQueued, ...loas])
          setQueueIdx(0)
        } catch {
          if (cancelled) return
          setQueue(loas)
          setQueueIdx(0)
          setError('That LOA is not available to you.')
        }
      })
      .catch(e => { if (!cancelled) setError(e?.message || 'Failed to load the review queue') })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [queueStage, userEmail, reloadNonce, initialLoaId])

  // ── Current LOA: full record, photos, stages, comments ────────────────────
  const currentId = queue[queueIdx]?.id

  useEffect(() => {
    if (!currentId) { setCurrentLoa(null); return }
    let cancelled = false

    setCurrentLoa(null)
    setPhotos([])
    setComments([])
    setActiveAnchor(null)

    import('@/lib/api').then(({ getLOA }) => getLOA(currentId)).then(loa => {
      if (cancelled) return
      setCurrentLoa(loa)
      // /loa/{id} hands photos back as [{index, url}]; the slide wants photoType.
      setPhotos(normalizeSlidePhotos(loa))
    }).catch(e => { if (!cancelled) setError(e?.message || 'Failed to load the LOA') })

    fetchLoaStages(currentId).then(res => {
      if (cancelled) return
      setStages(res.stages || {})
      setCurrentStage(res.currentStage)
      setAllApproved(res.allApproved)
    }).catch(() => { /* an LOA with no stage rows simply has no chain yet */ })

    if (cycleId) {
      fetchComments(cycleId, currentId)
        .then(cs => { if (!cancelled) setComments(cs) })
        .catch(() => { /* comments are non-fatal */ })
    }

    return () => { cancelled = true }
  }, [currentId, cycleId, reloadNonce])

  const counts = useMemo(() => countByAnchor(comments), [comments])
  const threadComments = useMemo(
    () => (activeAnchor ? comments.filter(c => c.anchor === activeAnchor) : []),
    [comments, activeAnchor],
  )

  const popoverPos = useAnchorPopover(
    paneRef, activeAnchor, threadComments.length,
    [slideScale, collapse, drawerOpen, currentId],
  )

  const handlePostComment = useCallback(async (text: string, anchor: string) => {
    if (!currentLoa || !cycleId) return
    const comment = await postComment(cycleId, `loa-${currentLoa.id}`, text, anchor)
    setComments(prev => [...prev, comment])
  }, [currentLoa, cycleId])

  const handleValidate = useCallback(async () => {
    if (!currentLoa) return
    await validateWorkflowStep(currentLoa.id)
    setShowApprove(false)
    setReloadNonce(n => n + 1)
  }, [currentLoa])

  const handleDownload = useCallback(async () => {
    if (!currentLoa) return
    setDownloading(true)
    try {
      const { downloadPPT } = await import('@/lib/api')
      await downloadPPT(currentLoa.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Download failed')
    } finally {
      setDownloading(false)
    }
  }, [currentLoa])

  // Escape closes whatever is open, outermost first.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      if (showApprove) { setShowApprove(false); return }
      if (activeAnchor) { setActiveAnchor(null); return }
      if (drawerOpen) setDrawerOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showApprove, activeAnchor, drawerOpen])

  // ── Gates ─────────────────────────────────────────────────────────────────

  if (loading) return <Centered>Loading alignment review…</Centered>
  if (error && !currentLoa) return <Centered tone="error">Error: {error}</Centered>

  if (!ownStage && !marketer && !isAdmin) {
    return <Centered>Your role is not part of the alignment review chain.</Centered>
  }

  if (queue.length === 0) {
    return (
      <Centered>
        <div style={{ fontSize: 32 }}>✓</div>
        <div>
          {queueStage
            ? 'No LOAs pending your review at this time.'
            : 'You have no submitted LOAs in the current cycle.'}
        </div>
        {queueStage && (
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            Stage: {ALIGNMENT_STAGE_LABELS[queueStage]}
          </div>
        )}
      </Centered>
    )
  }

  if (!currentLoa) return <Centered>Loading LOA…</Centered>

  // ── Action-bar state ──────────────────────────────────────────────────────
  const mySubGate = subGateForRole(roleCode)
  // Reviewers can submit once their own sub-gate is not yet done.
  const mySubGateDone = !readOnly && currentLoa ? (() => {
    const l = currentLoa as typeof currentLoa & {
      finance_review_done?: boolean
      procurement_review_done?: boolean
      compliance_review_done?: boolean
      brand_review_done?: boolean
      function_review_done?: boolean
    }
    if (mySubGate === 'finance') return !!l.finance_review_done
    if (mySubGate === 'procurement') return !!l.procurement_review_done
    if (mySubGate === 'compliance') return !!l.compliance_review_done
    if (mySubGate === 'brand') return !!l.brand_review_done
    if (mySubGate === 'function') return !!l.function_review_done
    return allApproved
  })() : false

  const canSubmitReview = !readOnly && !allApproved && !mySubGateDone && actingStage !== null
  const waiting = !readOnly && actingStage !== null && currentStage !== null && currentStage !== actingStage
  const actionNote = allApproved
    ? 'All alignment stages complete — nothing left to do here'
    : canSubmitReview
      ? 'Review the data and the slide, then submit when done'
      : mySubGateDone && !allApproved
        ? 'Your review is submitted — waiting for the other reviewers'
        : waiting
          ? `Waiting for ${ALIGNMENT_STAGE_LABELS[currentStage as AlignmentStage]} to complete first`
          : 'Leave comments where needed'

  const sectionCount = Object.keys(counts).length
  const rowLabel = `row ${queueIdx + 1} of ${queue.length}`
  const stageChip = allApproved
    ? 'Aligned'
    : readOnly
      ? 'Submitted · read-only'
      : `${roleLabel(roleCode)} review`

  // Layout, scrolling, pinning and the collapse toggles all live in
  // SplitPaneShell. This composition supplies only the per-LOA content and
  // behaviour — data, comment anchors, stage approval. If you find yourself
  // writing `overflow` or `position: sticky` here, it belongs in the shell.
  return (
    <>
    <SplitPaneShell
      ref={paneRef}
      collapse={collapse}
      onCollapseChange={setCollapse}
      collapseLabels={{ top: 'data', bottom: 'slide' }}
      header={<>
      <ReviewTopBar
        loa={currentLoa}
        stageLabel={stageChip.toUpperCase()}
        aligned={allApproved}
        readOnly={readOnly}
        userName={userName || userEmail || 'You'}
        userRoleLabel={roleLabel(roleCode)}
        current={queueIdx + 1}
        total={queue.length}
        onPrev={() => setQueueIdx(i => Math.max(0, i - 1))}
        onNext={() => setQueueIdx(i => Math.min(queue.length - 1, i + 1))}
        cycleLabel={cycle ? (cycle.code || cycle.name) : null}
        cycleIsEmergency={cycle?.cycleType === 'emergency'}
      />

      <StageStepper
        loaStatus={currentLoa.status}
        stages={stages}
        currentStage={currentStage}
        viewerRole={roleCode}
        viewerStage={actingStage}
        allApproved={allApproved}
        commentCount={comments.length}
        drawerOpen={drawerOpen}
        onToggleDrawer={() => setDrawerOpen(v => !v)}
        readOnly={readOnly}
      />

      {allApproved && (
        <div style={{
          flexShrink: 0, background: '#0E3B2A',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '11px 22px', gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
            <span style={{
              width: 20, height: 20, borderRadius: 99, background: '#2E8B57', color: 'var(--surface)',
              fontSize: 11, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>✓</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--surface)', whiteSpace: 'nowrap' }}>
              Fully aligned — ready for CMO / CFO review
            </span>
            <span style={{
              fontSize: 11.5, color: 'rgba(255,255,255,.62)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {ALIGNMENT_STAGES.map(s => ALIGNMENT_STAGE_LABELS[s]).join(' · ')} all approved
              {comments.length > 0 && ` · ${comments.length} comment${comments.length === 1 ? '' : 's'} recorded`}
            </span>
          </div>
          {cycleId && (
            <button
              onClick={() => router.push(`/cmo-review/${cycleId}?loa=${currentLoa.id}`)}
              style={{
                fontSize: 11.5, fontWeight: 500, color: '#0E3B2A', background: '#CFE8D9',
                border: 'none', borderRadius: 8, padding: '7px 13px', cursor: 'pointer', flexShrink: 0,
              }}
            >
              Open in CMO deck ›
            </button>
          )}
        </div>
      )}

      </>}
      top={<>
          
            <ExcelRowPanel
              loa={currentLoa}
              counts={counts}
              activeAnchor={activeAnchor}
              onAnchorSelect={setActiveAnchor}
              readOnly={readOnly}
              rowLabel={rowLabel}
            />
          
      </>}
      bottom={<>
          
            <SlidePanel
              loa={currentLoa}
              photos={photos}
              counts={counts}
              activeAnchor={activeAnchor}
              onAnchorSelect={setActiveAnchor}
              readOnly={readOnly}
              railOpen={!drawerOpen}
              onOpenInDeck={cycleId ? () => router.push(`/cmo-review/${cycleId}?loa=${currentLoa.id}`) : null}
              onDownloadSlide={handleDownload}
              downloading={downloading}
              queuePosition={`slide ${queueIdx + 1} of ${queue.length}`}
              onScaleChange={setSlideScale}
            />
      </>}
      overlay={
        /* One popover for the whole pane, anchored to whichever half owns it. */
        activeAnchor && popoverPos ? (
          <CommentPopover
            anchor={activeAnchor}
            comments={threadComments}
            pos={popoverPos}
            onPost={handlePostComment}
            readOnly={readOnly || !cycleId}
            onClose={() => setActiveAnchor(null)}
          />
        ) : null
      }
      actionBar={<>
            {readOnly ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
                  <span style={{ width: 9, height: 9, borderRadius: 99, background: '#C9A678', flexShrink: 0 }} />
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                    {allApproved
                      ? 'Fully aligned'
                      : currentStage
                        ? `Pending ${ALIGNMENT_STAGE_LABELS[currentStage]}`
                        : 'Awaiting review'}
                  </span>
                  <span
                    title={stageHistoryLine(currentLoa.submitted_at, stages, currentStage, allApproved)}
                    style={{
                      fontSize: 11.5, color: 'var(--text-tertiary)',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}
                  >
                    {stageHistoryLine(currentLoa.submitted_at, stages, currentStage, allApproved)}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                    You can view but not edit or comment at this stage
                  </span>
                  <button onClick={() => setDrawerOpen(v => !v)} style={ghostBtn}>
                    Comment summary
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0, flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: 11.5, color: 'var(--text-secondary)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {actionNote}
                  </span>
                  {comments.length > 0 && (
                    <span style={{
                      fontFamily: MONO, fontSize: 10.5, color: '#8A6A3F',
                      background: '#FAF5EA', border: '1px solid #C9A678',
                      borderRadius: 99, padding: '2px 8px', flexShrink: 0, whiteSpace: 'nowrap',
                    }}>
                      {comments.length} comment{comments.length === 1 ? '' : 's'} · {sectionCount} section
                      {sectionCount === 1 ? '' : 's'}
                    </span>
                  )}
                  <SubGateState loa={currentLoa} loaStatus={currentLoa.status} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  <button onClick={() => setDrawerOpen(v => !v)} style={ghostBtn}>
                    Comment summary
                  </button>
                  <button
                    onClick={() => setQueueIdx(i => Math.min(queue.length - 1, i + 1))}
                    disabled={queueIdx >= queue.length - 1}
                    style={{ ...ghostBtn, opacity: queueIdx >= queue.length - 1 ? 0.45 : 1 }}
                  >
                    Next LOA ›
                  </button>
                  <button
                    onClick={() => canSubmitReview && setShowApprove(true)}
                    disabled={!canSubmitReview}
                    title={
                      allApproved ? 'All alignment reviews are complete'
                        : canSubmitReview ? 'Submit your review pass for this LOA'
                        : mySubGateDone ? 'Your review is already submitted'
                        : waiting ? `${ALIGNMENT_STAGE_LABELS[currentStage as AlignmentStage]} must complete first`
                        : 'Nothing to submit at this stage'
                    }
                    style={{
                      fontSize: 12.5, fontWeight: 600,
                      color: allApproved ? '#0E3B2A' : canSubmitReview ? 'var(--surface)' : 'var(--text-tertiary)',
                      background: allApproved ? '#CFE8D9' : canSubmitReview ? '#1D6B45' : 'var(--surface-sunken)',
                      border: `1px solid ${allApproved ? '#A9D3BC' : canSubmitReview ? '#1D6B45' : 'var(--border)'}`,
                      borderRadius: 8, padding: '10px 26px',
                      cursor: canSubmitReview ? 'pointer' : 'default',
                      boxShadow: canSubmitReview ? '0 2px 8px rgba(10,10,10,.16)' : 'none',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {allApproved
                      ? 'Complete ✓'
                      : mySubGateDone
                        ? 'Submitted ✓'
                        : 'Submit my review'}
                  </button>
                </div>
              </>
            )}
      </>}
      aside={<>
        {drawerOpen && (
          <CommentsSummaryPanel
            comments={comments}
            activeAnchor={activeAnchor}
            onAnchorClick={anchor => setActiveAnchor(a => (a === anchor ? null : anchor))}
            onClose={() => setDrawerOpen(false)}
          />
        )}
      </>}
    />

      {showApprove && actingStage && (
        <ApproveConfirmModal
          loa={currentLoa}
          stage={actingStage}
          comments={comments}
          onConfirm={handleValidate}
          onCancel={() => setShowApprove(false)}
        />
      )}
    </>
  )
}

// ── Sub-gate state chips ─────────────────────────────────────────────────────

type SubGateRow = { key: string; label: string; done: boolean }

function SubGateState({ loa, loaStatus }: { loa: LOA; loaStatus: string }) {
  const l = loa as LOA & {
    finance_review_done?: boolean
    procurement_review_done?: boolean
    compliance_review_done?: boolean
    brand_review_done?: boolean
    function_review_done?: boolean
  }

  let gates: SubGateRow[] = []
  if (loaStatus === 'local_alignment') {
    gates = [
      { key: 'finance', label: 'Finance', done: !!l.finance_review_done },
      { key: 'procurement', label: 'Procurement', done: !!l.procurement_review_done },
      { key: 'compliance', label: 'Compliance', done: !!l.compliance_review_done },
    ]
  } else if (loaStatus === 'global_review') {
    gates = [
      { key: 'brand', label: 'Global Brand', done: !!l.brand_review_done },
      { key: 'function', label: 'Global Function', done: !!l.function_review_done },
    ]
  }
  if (!gates.length) return null

  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
      {gates.map(g => (
        <span key={g.key} style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          fontSize: 10.5, fontWeight: 500, fontFamily: MONO,
          color: g.done ? '#1A7348' : 'var(--text-tertiary)',
          background: g.done ? '#E5F2EA' : 'var(--surface-sunken)',
          border: `1px solid ${g.done ? '#BFDECC' : 'var(--border)'}`,
          borderRadius: 99, padding: '2px 7px', whiteSpace: 'nowrap',
        }}>
          <span>{g.done ? '✓' : '○'}</span>
          <span>{g.label}</span>
        </span>
      ))}
    </span>
  )
}

// ── Small pieces ────────────────────────────────────────────────────────────

function Centered({ children, tone }: { children: React.ReactNode; tone?: 'error' }) {
  return (
    <div style={{
      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', gap: 8,
      background: 'var(--surface-sunken)', color: tone === 'error' ? '#c0392b' : 'var(--text-tertiary)', fontSize: 14,
      textAlign: 'center', padding: 24,
    }}>
      {children}
    </div>
  )
}

const ghostBtn: React.CSSProperties = {
  fontSize: 12.5, fontWeight: 500, color: 'var(--text-secondary)',
  border: '1px solid var(--border)', background: 'var(--surface)',
  borderRadius: 8, padding: '9px 14px', cursor: 'pointer', whiteSpace: 'nowrap',
}

const dividerBtn: React.CSSProperties = {
  position: 'absolute', background: 'none', border: 'none', padding: 0,
  fontSize: 10.5, fontWeight: 500, color: 'var(--text-tertiary)', cursor: 'pointer', whiteSpace: 'nowrap',
}
