'use client'
/**
 * ReviewWorkspace — the whole CMO slideshow: top bar, deck outline, stage,
 * slide setup panel and the decision overlays.
 *
 * Both entry points render this, so they cannot drift apart:
 *   /cmo-review/[cycleId]   — standalone, full viewport
 *   tracker ?view=review    — embedded, offset by the 68px nav rail
 *
 * The deck always comes from GET /review/{cycleId}/deck, which is scoped to the
 * cycle — that is what keeps the LOA counts honest.
 */
import { useEffect, useReducer, useCallback, useState, useRef } from 'react'
import type {
  Slide, ReviewVerdict, ReviewComment, TitleConfig, LOAPhotoRecord, LOASlideSizing,
} from '@/types/review'
import {
  generateDeck, countReviewable, countDecided, slideCaption, nextLOAIndex,
  DEFAULT_LOA_SIZING,
} from '@/types/review'
import type { LOA } from '@/types/loa'
import {
  fetchDeck, fetchVerdicts, fetchComments,
  submitVerdict, postComment, submitReview,
  uploadLOAPhoto, deletePhoto, uploadTitlePhoto, uploadOverviewPhoto, uploadLensPhoto,
  saveTitleConfig, patchPhotoCrop,
} from '@/lib/review-api'
import type { CropState } from '@/app/cmo-review/[cycleId]/components/PhotoUploader'
import type { LensLayoutConfig } from '@/types/review'
import { getStoredUser } from '@/lib/api'
import SlideNavigator from '@/app/cmo-review/[cycleId]/components/SlideNavigator'
import SlideViewer from '@/app/cmo-review/[cycleId]/components/SlideViewer'
import SlideSetupPanel from '@/app/cmo-review/[cycleId]/components/SlideSetupPanel'
import CommentPanel from '@/app/cmo-review/[cycleId]/components/CommentPanel'
import RejectReasonModal from '@/app/cmo-review/[cycleId]/components/RejectReasonModal'
import FullScreenPresentation from '@/app/cmo-review/[cycleId]/components/FullScreenPresentation'
import SubmitReviewModal from '@/app/cmo-review/[cycleId]/components/SubmitReviewModal'
import ReviewProgressGate from '@/app/cmo-review/[cycleId]/components/ReviewProgressGate'
import ReviewTopBar from '@/app/cmo-review/[cycleId]/components/ReviewTopBar'

const FONT = "Inter, ui-sans-serif, system-ui, sans-serif"

/** CMO and CFO reviewers see the deck read-only; everyone else can prepare it. */
export function canPrepareDeck(role?: string): boolean {
  const r = (role || '').toLowerCase()
  return !r.includes('cmo') && !r.includes('cfo')
}

type RawLOA = LOA & { photos?: LOAPhotoRecord[] }

interface State {
  loading: boolean
  error: string | null
  cycleName: string
  cycleStartDate: string
  cycleEndDate: string
  slides: Slide[]
  verdicts: Record<string, ReviewVerdict>
  comments: Record<string, ReviewComment[]>
  currentIndex: number
  isSubmitted: boolean
  /** Cycle is closed — the whole review is an archive. */
  isClosed: boolean
  closedAt: string | null
  closedBy: string | null
  isTest: boolean
  rawLoas: RawLOA[]
  titleConfig: TitleConfig | null
  titlePhotoUrl: string | null
  overviewPhotos: Record<string, LOAPhotoRecord[]>
  showComments: boolean
  showRejectModal: boolean
  showSubmitModal: boolean
  showFullscreen: boolean
  rejectTarget: { loaId: string; loa: LOA } | null
}

type Action =
  | { type: 'LOAD_START' }
  | {
      type: 'LOAD_OK'
      cycleName: string
      cycleStartDate: string
      cycleEndDate: string
      slides: Slide[]
      verdicts: ReviewVerdict[]
      comments: ReviewComment[]
      isSubmitted: boolean
      isClosed: boolean
      closedAt: string | null
      closedBy: string | null
      isTest: boolean
      rawLoas: RawLOA[]
      titleConfig: TitleConfig | null
      titlePhotoUrl: string | null
      overviewPhotos: Record<string, LOAPhotoRecord[]>
    }
  | { type: 'LOAD_ERR'; error: string }
  | { type: 'NAVIGATE'; index: number }
  | { type: 'VERDICT_SAVED'; verdict: ReviewVerdict }
  | { type: 'COMMENT_ADDED'; comment: ReviewComment }
  | { type: 'SUBMITTED' }
  | { type: 'SHOW_COMMENTS'; show: boolean }
  | { type: 'SHOW_REJECT'; loaId: string; loa: LOA }
  | { type: 'HIDE_REJECT' }
  | { type: 'SHOW_SUBMIT'; show: boolean }
  | { type: 'SHOW_FULLSCREEN'; show: boolean }
  | { type: 'CONFIG_UPDATED'; config: TitleConfig; slides: Slide[] }
  | { type: 'TITLE_PHOTO_UPDATED'; url: string; slides: Slide[] }
  | { type: 'LOA_PHOTOS_UPDATED'; rawLoas: RawLOA[]; slides: Slide[] }
  | { type: 'OVERVIEW_PHOTOS_UPDATED'; overviewPhotos: Record<string, LOAPhotoRecord[]>; slides: Slide[] }

function buildVerdictMap(verdicts: ReviewVerdict[]): Record<string, ReviewVerdict> {
  return Object.fromEntries(verdicts.map(v => [v.loaId, v]))
}

function buildCommentMap(comments: ReviewComment[]): Record<string, ReviewComment[]> {
  const map: Record<string, ReviewComment[]> = {}
  for (const c of comments) {
    if (!map[c.slideId]) map[c.slideId] = []
    map[c.slideId].push(c)
  }
  return map
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'LOAD_START':
      return { ...state, loading: true, error: null }
    case 'LOAD_OK':
      return {
        ...state,
        loading: false,
        cycleName: action.cycleName,
        cycleStartDate: action.cycleStartDate,
        cycleEndDate: action.cycleEndDate,
        slides: action.slides,
        verdicts: buildVerdictMap(action.verdicts),
        comments: buildCommentMap(action.comments),
        isSubmitted: action.isSubmitted,
        isClosed: action.isClosed,
        closedAt: action.closedAt,
        closedBy: action.closedBy,
        isTest: action.isTest,
        rawLoas: action.rawLoas,
        titleConfig: action.titleConfig,
        titlePhotoUrl: action.titlePhotoUrl,
        overviewPhotos: action.overviewPhotos,
        currentIndex: Math.min(state.currentIndex, Math.max(0, action.slides.length - 1)),
      }
    case 'LOAD_ERR':
      return { ...state, loading: false, error: action.error }
    case 'NAVIGATE':
      return { ...state, currentIndex: action.index, showComments: false }
    case 'VERDICT_SAVED':
      return {
        ...state,
        verdicts: { ...state.verdicts, [action.verdict.loaId]: action.verdict },
        showRejectModal: false,
        rejectTarget: null,
      }
    case 'COMMENT_ADDED': {
      const sid = action.comment.slideId
      const existing = state.comments[sid] || []
      return { ...state, comments: { ...state.comments, [sid]: [...existing, action.comment] } }
    }
    case 'SUBMITTED':
      return { ...state, isSubmitted: true, showSubmitModal: false }
    case 'SHOW_COMMENTS':
      return { ...state, showComments: action.show }
    case 'SHOW_REJECT':
      return { ...state, showRejectModal: true, rejectTarget: { loaId: action.loaId, loa: action.loa } }
    case 'HIDE_REJECT':
      return { ...state, showRejectModal: false, rejectTarget: null }
    case 'SHOW_SUBMIT':
      return { ...state, showSubmitModal: action.show }
    case 'SHOW_FULLSCREEN':
      return { ...state, showFullscreen: action.show }
    case 'CONFIG_UPDATED':
      return { ...state, titleConfig: action.config, slides: action.slides }
    case 'TITLE_PHOTO_UPDATED':
      return { ...state, titlePhotoUrl: action.url, slides: action.slides }
    case 'LOA_PHOTOS_UPDATED':
      return { ...state, rawLoas: action.rawLoas, slides: action.slides }
    case 'OVERVIEW_PHOTOS_UPDATED':
      return { ...state, overviewPhotos: action.overviewPhotos, slides: action.slides }
    default:
      return state
  }
}

const init: State = {
  loading: true, error: null, cycleName: '', cycleStartDate: '', cycleEndDate: '',
  slides: [], verdicts: {}, comments: {},
  currentIndex: 0, isSubmitted: false,
  isClosed: false, closedAt: null, closedBy: null, isTest: false,
  rawLoas: [], titleConfig: null, titlePhotoUrl: null, overviewPhotos: {},
  showComments: false, showRejectModal: false,
  showSubmitModal: false, showFullscreen: false,
  rejectTarget: null,
}

interface Props {
  cycleId: string | null
  /** Fallback name used before the deck resolves, or when there is no cycle. */
  cycleName?: string
  /** Embedded inside the tracker: fixed overlay to the right of the nav rail. */
  embedded?: boolean
  /** Overrides the breadcrumb — used to return to the Past Cycles archive. */
  onBack?: () => void
  backLabel?: string
}

/**
 * Turn an axios failure into something a human can act on. Raw API detail
 * strings ("Not Found") tell the reader nothing about which layer broke.
 */
function describeLoadError(err: unknown): string {
  const e = err as { response?: { status?: number; data?: { detail?: string } }; code?: string }
  const status = e?.response?.status

  if (!e?.response) {
    return 'Cannot reach the LAURA API. Is the backend running on port 8000?'
  }
  if (status === 401 || status === 403) {
    return 'Your session has expired. Sign in again to load the review.'
  }
  if (status === 404) {
    // Either the cycle is gone, or the API is serving a build without /review.
    return 'The review endpoint returned 404. The cycle may no longer exist, '
      + 'or the backend is running an older build without the review routes — '
      + 'restart the API and retry.'
  }
  return e?.response?.data?.detail || 'Failed to load the review session.'
}

/** How long the decided slide fades before the deck turns to the next LOA. */
const DECISION_FADE_MS = 260

export default function ReviewWorkspace({
  cycleId, cycleName = 'Review', embedded = false, onBack, backLabel,
}: Props) {
  const [state, dispatch] = useReducer(reducer, init)
  const [user, setUser] = useState<ReturnType<typeof getStoredUser>>(null)
  const [reloadKey, setReloadKey] = useState(0)
  /** True while the just-decided slide is fading out. */
  const [leaving, setLeaving] = useState(false)
  /** Per-session LOA slide sizing, driven from the setup panel. */
  const [slideSizing, setSlideSizing] = useState<LOASlideSizing>(DEFAULT_LOA_SIZING)

  useEffect(() => { setUser(getStoredUser()) }, [])

  // A closed cycle is frozen for everyone: no deck edits, no decisions,
  // no comments. The backend enforces the same thing with a 423.
  const readOnly = state.isClosed
  const canEdit = canPrepareDeck(user?.role) && !state.isSubmitted && !readOnly
  // Decisions are locked once submitted, and always in a closed cycle.
  const decisionsLocked = state.isSubmitted || readOnly

  // ── Load ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!cycleId) {
      dispatch({ type: 'LOAD_ERR', error: 'No active cycle to review.' })
      return
    }
    dispatch({ type: 'LOAD_START' })

    Promise.all([fetchDeck(cycleId), fetchVerdicts(cycleId), fetchComments(cycleId)])
      .then(([deckRes, verdictsRes, commentsRes]) => {
        const slides = generateDeck(
          deckRes.cycle.name,
          deckRes.loas,
          deckRes.titleConfig,
          deckRes.titlePhoto?.url ?? null,
          deckRes.overviewPhotos,
          deckRes.cycle.startDate,
          deckRes.cycle.endDate,
        )
        dispatch({
          type: 'LOAD_OK',
          cycleName: deckRes.cycle.name,
          cycleStartDate: deckRes.cycle.startDate ?? '',
          cycleEndDate: deckRes.cycle.endDate ?? '',
          slides,
          verdicts: verdictsRes.verdicts,
          comments: commentsRes,
          isSubmitted: verdictsRes.isSubmitted,
          isClosed: Boolean(deckRes.cycle.isClosed),
          closedAt: deckRes.cycle.closedAt ?? null,
          closedBy: deckRes.cycle.closedBy ?? null,
          isTest: Boolean(deckRes.cycle.isTest),
          rawLoas: deckRes.loas,
          titleConfig: deckRes.titleConfig,
          titlePhotoUrl: deckRes.titlePhoto?.url ?? null,
          overviewPhotos: deckRes.overviewPhotos,
        })
      })
      .catch(err => {
        dispatch({ type: 'LOAD_ERR', error: describeLoadError(err) })
      })
  }, [cycleId, reloadKey])

  // ── Derived ────────────────────────────────────────────────────────────────
  const { slides, verdicts, comments, currentIndex } = state
  const currentSlide = slides[currentIndex]
  const reviewableCount = countReviewable(slides)
  const decidedCount = countDecided(slides, verdicts)
  const currentComments = currentSlide ? (comments[currentSlide.id] || []) : []
  const allDecided = reviewableCount > 0 && decidedCount === reviewableCount
  const nextLOA = nextLOAIndex(slides, currentIndex)

  // The setup panel is for deck preparers; it yields to the comment panel.
  const showSetup = canEdit && !state.showComments && !!currentSlide
  const stageMax = showSetup || state.showComments ? 780 : 960

  // ── Navigation ─────────────────────────────────────────────────────────────
  const navigateTo = useCallback((index: number) => {
    dispatch({ type: 'NAVIGATE', index })
  }, [])

  // `?loa=<id>` deep-links straight to one LOA's slide — the alignment review's
  // "Open slide in deck" hands off that way. Runs once per deck load.
  const jumpedTo = useRef<string | null>(null)
  useEffect(() => {
    if (state.loading || slides.length === 0) return
    const target = new URLSearchParams(window.location.search).get('loa')
    if (!target || jumpedTo.current === target) return
    const index = slides.findIndex(s => s.loaId === target)
    jumpedTo.current = target
    if (index >= 0) dispatch({ type: 'NAVIGATE', index })
  }, [state.loading, slides])

  const navigateBy = useCallback((delta: number) => {
    dispatch({
      type: 'NAVIGATE',
      index: Math.max(0, Math.min(state.slides.length - 1, state.currentIndex + delta)),
    })
  }, [state.slides.length, state.currentIndex])

  // ── Verdicts ───────────────────────────────────────────────────────────────

  /**
   * A decision is a page turn: the slide fades out, then the deck lands on the
   * next LOA — skipping the title, dividers and overview slides, which carry no
   * decision. Reviewers work a queue, so they should never have to hunt for the
   * next thing to decide.
   */
  const advanceAfterDecision = useCallback((fromIndex: number) => {
    const next = nextLOAIndex(state.slides, fromIndex)
    if (next === -1) return              // last LOA — hold still, nothing left to turn to
    setLeaving(true)
    window.setTimeout(() => {
      dispatch({ type: 'NAVIGATE', index: next })
      setLeaving(false)
    }, DECISION_FADE_MS)
  }, [state.slides])

  const handleApprove = useCallback(async (loaId: string) => {
    if (decisionsLocked || !cycleId) return
    const at = state.currentIndex
    const optimistic: ReviewVerdict = {
      id: 'optimistic', cycleId, loaId, reviewerId: '',
      decision: 'approved',
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    }
    dispatch({ type: 'VERDICT_SAVED', verdict: optimistic })
    advanceAfterDecision(at)
    try {
      const saved = await submitVerdict(cycleId, loaId, 'approved')
      dispatch({ type: 'VERDICT_SAVED', verdict: saved })
    } catch { /* the optimistic verdict stands until the next load */ }
  }, [cycleId, decisionsLocked, state.currentIndex, advanceAfterDecision])

  const handleRejectOpen = useCallback((loaId: string, loa: LOA) => {
    if (decisionsLocked) return
    dispatch({ type: 'SHOW_REJECT', loaId, loa })
  }, [decisionsLocked])

  const handleRejectConfirm = useCallback(async (loaId: string, reason: string) => {
    if (!cycleId) return
    const at = state.currentIndex
    try {
      const saved = await submitVerdict(cycleId, loaId, 'rejected', reason)
      dispatch({ type: 'VERDICT_SAVED', verdict: saved })
      advanceAfterDecision(at)
    } catch { dispatch({ type: 'HIDE_REJECT' }) }
  }, [cycleId, state.currentIndex, advanceAfterDecision])

  const handleAddComment = useCallback(async (slideId: string, text: string) => {
    if (!cycleId) return
    try {
      const comment = await postComment(cycleId, slideId, text)
      dispatch({ type: 'COMMENT_ADDED', comment })
    } catch { /* surfaced by the panel staying open */ }
  }, [cycleId])

  const handleSubmitConfirm = useCallback(async () => {
    if (!cycleId) return
    try {
      await submitReview(cycleId)
      dispatch({ type: 'SUBMITTED' })
    } catch { /* modal stays open */ }
  }, [cycleId])

  // ── Deck config + photos ───────────────────────────────────────────────────
  const rebuild = useCallback((over: {
    titleConfig?: TitleConfig | null
    titlePhotoUrl?: string | null
    rawLoas?: RawLOA[]
    overviewPhotos?: Record<string, LOAPhotoRecord[]>
  }): Slide[] => generateDeck(
    state.cycleName,
    over.rawLoas ?? state.rawLoas,
    over.titleConfig !== undefined ? over.titleConfig : state.titleConfig,
    over.titlePhotoUrl !== undefined ? over.titlePhotoUrl : state.titlePhotoUrl,
    over.overviewPhotos ?? state.overviewPhotos,
    state.cycleStartDate,
    state.cycleEndDate,
  ), [state.cycleName, state.rawLoas, state.titleConfig, state.titlePhotoUrl, state.overviewPhotos, state.cycleStartDate, state.cycleEndDate])

  const handleConfigChange = useCallback(async (patch: Partial<TitleConfig>) => {
    if (!canEdit || !cycleId) return
    const merged = { ...state.titleConfig, ...patch } as TitleConfig
    // Paint immediately, then reconcile with whatever the server stored.
    dispatch({ type: 'CONFIG_UPDATED', config: merged, slides: rebuild({ titleConfig: merged }) })
    try {
      const saved = await saveTitleConfig(cycleId, merged)
      dispatch({ type: 'CONFIG_UPDATED', config: saved, slides: rebuild({ titleConfig: saved }) })
    } catch { /* keep the optimistic config */ }
  }, [canEdit, cycleId, state.titleConfig, rebuild])

  const handleTitlePhotoUpload = useCallback(async (file: File) => {
    if (!canEdit || !cycleId) return
    const photo = await uploadTitlePhoto(cycleId, file)
    dispatch({
      type: 'TITLE_PHOTO_UPDATED',
      url: photo.url,
      slides: rebuild({ titlePhotoUrl: photo.url }),
    })
  }, [canEdit, cycleId, rebuild])

  const handleLOAPhotoUpload = useCallback(async (
    loaId: string, photoType: 'execution_1' | 'execution_2', file: File,
  ) => {
    if (!canEdit || !cycleId) return
    const photo = await uploadLOAPhoto(cycleId, loaId, photoType, file)
    const rawLoas = state.rawLoas.map(l => l.id !== loaId ? l : {
      ...l,
      photos: [...(l.photos || []).filter(p => p.photoType !== photoType), photo],
    })
    dispatch({ type: 'LOA_PHOTOS_UPDATED', rawLoas, slides: rebuild({ rawLoas }) })
  }, [canEdit, cycleId, state.rawLoas, rebuild])

  const handleLOAPhotoRemove = useCallback(async (photoId: string) => {
    if (!canEdit || !cycleId) return
    await deletePhoto(cycleId, photoId)
    const rawLoas = state.rawLoas.map(l => ({
      ...l, photos: (l.photos || []).filter(p => p.id !== photoId),
    }))
    dispatch({ type: 'LOA_PHOTOS_UPDATED', rawLoas, slides: rebuild({ rawLoas }) })
  }, [canEdit, cycleId, state.rawLoas, rebuild])

  const handleOverviewPhotoUpload = useCallback(async (
    category: string,
    photoType: string,
    file: File,
  ) => {
    if (!canEdit || !cycleId) return
    const photo = await uploadOverviewPhoto(cycleId, category, photoType, file)
    const overviewPhotos = {
      ...state.overviewPhotos,
      [category]: [
        ...(state.overviewPhotos[category] || []).filter(p => p.photoType !== photoType),
        photo,
      ],
    }
    dispatch({ type: 'OVERVIEW_PHOTOS_UPDATED', overviewPhotos, slides: rebuild({ overviewPhotos }) })
  }, [canEdit, cycleId, state.overviewPhotos, rebuild])

  const handleOverviewPhotoRemove = useCallback(async (photoId: string) => {
    if (!canEdit || !cycleId) return
    await deletePhoto(cycleId, photoId)
    const overviewPhotos: Record<string, LOAPhotoRecord[]> = {}
    for (const [cat, photos] of Object.entries(state.overviewPhotos)) {
      overviewPhotos[cat] = photos.filter(p => p.id !== photoId)
    }
    dispatch({ type: 'OVERVIEW_PHOTOS_UPDATED', overviewPhotos, slides: rebuild({ overviewPhotos }) })
  }, [canEdit, cycleId, state.overviewPhotos, rebuild])

  /** Fire-and-forget — crop is cosmetic; errors are silently ignored. */
  const handlePhotoCropChange = useCallback(async (photoId: string, crop: CropState) => {
    if (!canEdit || !cycleId) return
    try { await patchPhotoCrop(cycleId, photoId, crop) } catch { /* crop stays as-is */ }
  }, [canEdit, cycleId])

  const handleLensPhotoUpload = useCallback(async (
    category: string, columnId: string, file: File,
  ) => {
    if (!canEdit || !cycleId) return
    const photo = await uploadLensPhoto(cycleId, category, columnId, file)
    const photoType = `lens_col_${columnId}`
    const overviewPhotos = {
      ...state.overviewPhotos,
      [category]: [
        ...(state.overviewPhotos[category] || []).filter(p => p.photoType !== photoType),
        photo,
      ],
    }
    dispatch({ type: 'OVERVIEW_PHOTOS_UPDATED', overviewPhotos, slides: rebuild({ overviewPhotos }) })
  }, [canEdit, cycleId, state.overviewPhotos, rebuild])

  const handleLensPhotoRemove = useCallback(async (photoId: string) => {
    if (!canEdit || !cycleId) return
    await deletePhoto(cycleId, photoId)
    const overviewPhotos: Record<string, LOAPhotoRecord[]> = {}
    for (const [cat, photos] of Object.entries(state.overviewPhotos)) {
      overviewPhotos[cat] = photos.filter(p => p.id !== photoId)
    }
    dispatch({ type: 'OVERVIEW_PHOTOS_UPDATED', overviewPhotos, slides: rebuild({ overviewPhotos }) })
  }, [canEdit, cycleId, state.overviewPhotos, rebuild])

  const handleLensConfigChange = useCallback(async (
    category: string, patch: Partial<LensLayoutConfig>,
  ) => {
    if (!canEdit || !cycleId) return
    const existing = state.titleConfig?.lensConfigs?.[category] ?? {}
    const merged = { ...existing, ...patch }
    const newLensConfigs = { ...(state.titleConfig?.lensConfigs ?? {}), [category]: merged }
    const merged2 = { ...state.titleConfig, lensConfigs: newLensConfigs } as TitleConfig
    dispatch({ type: 'CONFIG_UPDATED', config: merged2, slides: rebuild({ titleConfig: merged2 }) })
    try {
      const saved = await saveTitleConfig(cycleId, merged2)
      dispatch({ type: 'CONFIG_UPDATED', config: saved, slides: rebuild({ titleConfig: saved }) })
    } catch { /* optimistic config stands */ }
  }, [canEdit, cycleId, state.titleConfig, rebuild])

  // ── Keyboard ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (state.showFullscreen) return
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      const slide = state.slides[state.currentIndex]
      const loa = slide?.type === 'loa_detail' ? (slide.data as { loa: LOA }).loa : null

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); navigateBy(1) }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); navigateBy(-1) }
      else if ((e.key === 'a' || e.key === 'A') && loa && !decisionsLocked) handleApprove(loa.id)
      else if ((e.key === 'r' || e.key === 'R') && loa && !decisionsLocked) handleRejectOpen(loa.id, loa)
      else if (e.key === 'c' || e.key === 'C') dispatch({ type: 'SHOW_COMMENTS', show: !state.showComments })
      else if (e.key === 'f' || e.key === 'F') dispatch({ type: 'SHOW_FULLSCREEN', show: true })
      else if (e.key === 'Escape') dispatch({ type: 'SHOW_COMMENTS', show: false })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [
    state.slides, state.currentIndex, state.showComments,
    decisionsLocked, state.showFullscreen,
    navigateBy, handleApprove, handleRejectOpen,
  ])

  // ── Shell ──────────────────────────────────────────────────────────────────
  /**
   * The deck fills what TopNav leaves of the viewport.
   *
   * `embedded` used to mean `position:fixed; left:68` — pinned to the left rail,
   * which no longer exists, and which also parked the deck on top of the app
   * chrome. Both branches are ordinary blocks now; `embedded` only means "a host
   * is supplying my height" (the EMEA Both view, Past Cycles), so it fills 100%
   * instead of measuring off the viewport itself.
   *
   * The 1280×720 slide canvas inside is untouched and stays brand-fixed in both
   * themes — only this surrounding chrome is themed.
   */
  const shell: React.CSSProperties = embedded
    ? {
        display: 'flex', height: '100%', minHeight: 0, overflow: 'hidden',
        background: 'var(--canvas)', fontFamily: FONT,
      }
    : {
        display: 'flex', height: 'calc(100vh - 56px)', overflow: 'hidden',
        background: 'var(--canvas)', fontFamily: FONT,
      }

  // A deck of nothing but the title slide means no LOA is linked to this cycle
  // — say so, rather than presenting an empty deck the reviewer can't act on.
  const deckIsEmpty = !state.loading && !state.error && reviewableCount === 0

  // roleLabel is needed both in the early-return header and in the happy path.
  const roleLabel = (user?.role || 'Reviewer').toUpperCase()

  if (state.loading || state.error || deckIsEmpty) {
    return (
      <div style={{ ...shell, flexDirection: 'column' }}>
        {/* Header renders in ALL states — there must always be a way out */}
        <ReviewTopBar
          cycleName={state.cycleName || cycleName}
          reviewLabel={`${roleLabel} Review`}
          userName={user?.full_name || 'Reviewer'}
          userRole={roleLabel}
          onFullscreen={() => {}}
          onBack={onBack}
          backLabel={backLabel}
        />
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32,
        }}>
          {state.loading ? (
            <span style={{ fontSize: 14, color: '#5A554F' }}>Loading review session…</span>
          ) : (
            <div style={{
              maxWidth: 460, display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 14, textAlign: 'center',
            }}>
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '.14em',
                textTransform: 'uppercase', color: state.error ? '#8A2E27' : '#9B9690',
              }}>
                {state.error ? 'Review unavailable' : 'Nothing to review'}
              </span>
              <span style={{ fontSize: 14, lineHeight: 1.6, color: '#3F3A33' }}>
                {state.error
                  || `No LOAs are linked to “${state.cycleName || cycleName}”. `
                     + 'The deck is built from LOAs whose cycle matches this one, '
                     + 'so nothing can be reviewed until they are assigned to it.'}
              </span>
              {state.error && cycleId && (
                <button
                  onClick={() => setReloadKey(k => k + 1)}
                  style={{
                    fontSize: 12.5, fontWeight: 600, fontFamily: FONT,
                    color: '#fff', background: '#0A0A0A', border: 'none',
                    borderRadius: 8, padding: '10px 20px', cursor: 'pointer',
                  }}
                >
                  Retry
                </button>
              )}
              {/* Primary exit — always shown for the empty-deck case */}
              {deckIsEmpty && (
                onBack ? (
                  <button
                    onClick={onBack}
                    style={{
                      fontSize: 12.5, fontWeight: 600, fontFamily: FONT,
                      color: '#fff', background: '#0A0A0A', border: 'none',
                      borderRadius: 8, padding: '10px 20px', cursor: 'pointer',
                    }}
                  >
                    ← {backLabel || 'Back to review cycles'}
                  </button>
                ) : (
                  <a
                    href="/"
                    style={{
                      fontSize: 12.5, fontWeight: 600, fontFamily: FONT,
                      color: '#fff', background: '#0A0A0A',
                      borderRadius: 8, padding: '10px 20px',
                      textDecoration: 'none', display: 'inline-block',
                    }}
                  >
                    ← Back to tracker
                  </a>
                )
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <>
      <div style={shell}>
        <SlideNavigator
          slides={slides}
          verdicts={verdicts}
          comments={comments}
          currentIndex={currentIndex}
          reviewableCount={reviewableCount}
          decidedCount={decidedCount}
          onNavigate={navigateTo}
        />

        <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <ReviewTopBar
            cycleName={state.cycleName || cycleName}
            reviewLabel={`${roleLabel} Review`}
            userName={user?.full_name || 'Reviewer'}
            userRole={roleLabel}
            onFullscreen={() => dispatch({ type: 'SHOW_FULLSCREEN', show: true })}
            onBack={onBack}
            backLabel={backLabel}
          />

          {/* The "TEST CYCLE — will be deleted before go-live" banner is
              deliberately NOT rendered here.

              This workspace is the deck: it is presented on a screen and
              screenshotted, and a red strip across the top of every slide
              contaminates both. The warning belongs where someone is deciding
              what to do with the cycle, not where they are reading its content.

              Nothing about the flag itself changed. `state.isTest` is still
              fetched and carried (the deck fetch above still reads
              `Boolean(deckRes.cycle.isTest)`), and the warning still shows in
              full on every surface that governs the cycle rather than presents
              it — TestCycleBanner on the cycle page (with its delete action),
              the tracker's current-cycle notice, and the Admin Console's cycle
              list. Deletion is still refused server-side for anything not
              flagged is_test. This is a presentation-layer exception only; do
              not generalise it into hiding the flag elsewhere. */}

          {readOnly && (
            <div style={{
              flexShrink: 0,
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 22px',
              background: '#F3EAD3',
              borderBottom: '1px solid #E3D3A8',
              fontSize: 12, color: '#5C4A18',
            }}>
              <span aria-hidden>🔒</span>
              <span>
                <strong style={{ fontWeight: 600 }}>This cycle is closed.</strong>{' '}
                Review is read-only.
                {state.closedAt && (
                  <> Closed {new Date(state.closedAt).toLocaleDateString('en-GB', {
                    day: 'numeric', month: 'short', year: 'numeric',
                  })}{state.closedBy ? ` by ${state.closedBy.split('@')[0]}` : ''}.</>
                )}
              </span>
            </div>
          )}

          <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
            <SlideViewer
              slides={slides}
              currentIndex={currentIndex}
              verdicts={verdicts}
              isSubmitted={decisionsLocked}
              canEdit={canEdit}
              stageMax={stageMax}
              onPrev={() => navigateBy(-1)}
              onNext={() => navigateBy(1)}
              onApprove={handleApprove}
              onReject={handleRejectOpen}
              onToggleComments={() => dispatch({ type: 'SHOW_COMMENTS', show: !state.showComments })}
              onSubmit={() => dispatch({ type: 'SHOW_SUBMIT', show: true })}
              slideSizing={slideSizing}
              leaving={leaving}
              onSkipToLOA={() => nextLOA >= 0 && navigateTo(nextLOA)}
              hasNextLOA={nextLOA >= 0}
              allDecided={allDecided}
              decidedCount={decidedCount}
              reviewableCount={reviewableCount}
              commentCount={currentComments.length}
              onTitlePhotoUpload={canEdit ? handleTitlePhotoUpload : undefined}
              onLOAPhotoUpload={canEdit ? handleLOAPhotoUpload : undefined}
              onLOAPhotoRemove={canEdit ? handleLOAPhotoRemove : undefined}
              onLOAPhotoCropChange={canEdit ? handlePhotoCropChange : undefined}
              onOverviewPhotoUpload={canEdit ? handleOverviewPhotoUpload : undefined}
              onOverviewPhotoRemove={canEdit ? handleOverviewPhotoRemove : undefined}
              onOverviewPhotoCropChange={canEdit ? handlePhotoCropChange : undefined}
              onLensConfigChange={canEdit ? handleLensConfigChange : undefined}
              onLensPhotoUpload={canEdit ? handleLensPhotoUpload : undefined}
              onLensPhotoRemove={canEdit ? handleLensPhotoRemove : undefined}
              onLensPhotoCropChange={canEdit ? handlePhotoCropChange : undefined}
              loaPhotoModes={state.titleConfig?.loaPhotoModes}
            />

            {showSetup && currentSlide && (
              <SlideSetupPanel
                slide={currentSlide}
                slideNumber={currentIndex + 1}
                titleConfig={state.titleConfig}
                onConfigChange={handleConfigChange}
                sizing={slideSizing}
                onSizingChange={patch => setSlideSizing(s => ({ ...s, ...patch }))}
              />
            )}

            {state.showComments && currentSlide && (
              <CommentPanel
                slideId={currentSlide.id}
                slideNumber={currentIndex + 1}
                slideTitle={slideCaption(currentSlide)}
                comments={currentComments}
                isSubmitted={decisionsLocked}
                onAddComment={handleAddComment}
                onClose={() => dispatch({ type: 'SHOW_COMMENTS', show: false })}
              />
            )}
          </div>
        </div>
      </div>

      {state.showRejectModal && state.rejectTarget && (
        <RejectReasonModal
          loaId={state.rejectTarget.loaId}
          loa={state.rejectTarget.loa}
          onConfirm={handleRejectConfirm}
          onCancel={() => dispatch({ type: 'HIDE_REJECT' })}
        />
      )}

      {/*
        Submit is always clickable. If anything is still undecided the click
        opens the gentle progress gate instead of the confirmation, so the
        reviewer learns what is left rather than meeting a dead button.
      */}
      {state.showSubmitModal && (
        allDecided ? (
          <SubmitReviewModal
            slides={slides}
            verdicts={verdicts}
            cycleName={state.cycleName || cycleName}
            onConfirm={handleSubmitConfirm}
            onCancel={() => dispatch({ type: 'SHOW_SUBMIT', show: false })}
          />
        ) : (
          <ReviewProgressGate
            slides={slides}
            verdicts={verdicts}
            onResume={navigateTo}
            onClose={() => dispatch({ type: 'SHOW_SUBMIT', show: false })}
          />
        )
      )}

      {state.showFullscreen && (
        <FullScreenPresentation
          slides={slides}
          startIndex={currentIndex}
          verdicts={verdicts}
          comments={comments}
          isSubmitted={decisionsLocked}
          onApprove={handleApprove}
          onReject={handleRejectOpen}
          onAddComment={handleAddComment}
          onClose={() => dispatch({ type: 'SHOW_FULLSCREEN', show: false })}
        />
      )}
    </>
  )
}
