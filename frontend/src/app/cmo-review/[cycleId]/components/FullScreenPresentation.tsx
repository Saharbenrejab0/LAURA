'use client'
/**
 * FullScreenPresentation — black background, centered slide, floating controls.
 * Controls auto-hide after 3 s of mouse inactivity.
 * Keys: ←→ navigate, Esc exit, C comment panel, A approve, R reject.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import type { Slide, ReviewVerdict, ReviewComment, TitleSlideData, SectionDividerData, CategoryOverviewData, LOADetailData } from '@/types/review'
import type { LOA } from '@/types/loa'
import TitleSlide from './slides/TitleSlide'
import SectionDividerSlide from './slides/SectionDividerSlide'
import CategoryOverviewSlide from './slides/CategoryOverviewSlide'
import LOADetailSlide from './slides/LOADetailSlide'
import { slideCaption, DIVIDER_STYLES } from '@/types/review'
import CommentPanel from './CommentPanel'

const FONT = "Inter, ui-sans-serif, system-ui, sans-serif"

interface Props {
  slides: Slide[]
  startIndex: number
  verdicts: Record<string, ReviewVerdict>
  comments: Record<string, ReviewComment[]>
  isSubmitted: boolean
  onApprove: (loaId: string) => void
  onReject: (loaId: string, loa: LOA) => void
  onAddComment: (slideId: string, text: string) => Promise<void>
  onClose: () => void
}

export default function FullScreenPresentation({
  slides, startIndex, verdicts, comments, isSubmitted,
  onApprove, onReject, onAddComment, onClose,
}: Props) {
  const [idx, setIdx] = useState(startIndex)
  const [controlsVisible, setControlsVisible] = useState(true)
  const [showComments, setShowComments] = useState(false)
  const hideTimer = useRef<ReturnType<typeof setTimeout>>()
  const prefersReduced = useRef(
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )

  const slide = slides[idx]
  const isLOA = slide?.type === 'loa_detail'
  const loa = isLOA ? (slide.data as LOADetailData).loa : null
  const verdict = loa ? verdicts[loa.id] : undefined
  const isApproved = verdict?.decision === 'approved'
  const isRejected = verdict?.decision === 'rejected'
  const slideComments = slide ? (comments[slide.id] || []) : []

  const navigate = useCallback((delta: number) => {
    setIdx(i => Math.max(0, Math.min(slides.length - 1, i + delta)))
    setShowComments(false)
  }, [slides.length])

  const showControls = useCallback(() => {
    setControlsVisible(true)
    clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setControlsVisible(false), 3000)
  }, [])

  useEffect(() => {
    showControls()
    return () => clearTimeout(hideTimer.current)
  }, [showControls])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return
      switch (e.key) {
        case 'ArrowRight': case 'ArrowDown': e.preventDefault(); navigate(1); break
        case 'ArrowLeft': case 'ArrowUp': e.preventDefault(); navigate(-1); break
        case 'Escape':
          if (showComments) setShowComments(false)
          else onClose()
          break
        case 'a': case 'A': if (loa && !isSubmitted) onApprove(loa.id); break
        case 'r': case 'R': if (loa && !isSubmitted) onReject(loa.id, loa); break
        case 'c': case 'C': setShowComments(s => !s); break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate, onClose, loa, isSubmitted, onApprove, onReject, showComments])

  const transition = prefersReduced.current ? 'none' : 'opacity 200ms cubic-bezier(0.2,0,0,1)'

  // Render the correct slide component
  let slideContent: React.ReactNode = null
  if (slide) {
    switch (slide.type) {
      // Presenting, not preparing — every slide is read-only in fullscreen.
      case 'title_slide':
        slideContent = <TitleSlide data={slide.data as TitleSlideData} canEdit={false} />
        break
      case 'section_divider':
        slideContent = <SectionDividerSlide data={slide.data as SectionDividerData} />
        break
      case 'category_overview':
        slideContent = (
          <CategoryOverviewSlide data={slide.data as CategoryOverviewData} canEdit={false} />
        )
        break
      case 'loa_detail':
        slideContent = loa ? (
          <LOADetailSlide loa={loa} commentCount={slideComments.length} canEdit={false} />
        ) : null
        break
    }
  }

  // Matches the slide's own ground so no seam shows at the sheet edge.
  const slideBg = slide?.type === 'section_divider'
    ? (DIVIDER_STYLES[(slide.data as SectionDividerData).style] || DIVIDER_STYLES.black).bg
    : slide?.type === 'title_slide' ? '#2A2724'
    : '#FDFBF7'

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: '#0E0D0B', zIndex: 300, display: 'flex', fontFamily: FONT }}
      onMouseMove={showControls}
    >
      {/* Slide stage */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}>
        {idx > 0 && <EdgeNav side="left" visible={controlsVisible} onClick={() => navigate(-1)} />}

        <div style={{
          width: '100%',
          maxWidth: 1200,
          aspectRatio: '16 / 9',
          background: slideBg,
          borderRadius: 2,
          boxShadow: '0 40px 100px rgba(0,0,0,.8)',
          overflow: 'hidden',
          margin: '0 72px',
        }}>
          {slideContent}
        </div>

        {idx < slides.length - 1 && <EdgeNav side="right" visible={controlsVisible} onClick={() => navigate(1)} />}

        {/* Floating pill controls */}
        <div style={{
          position: 'absolute',
          bottom: 28,
          left: '50%',
          transform: 'translateX(-50%)',
          opacity: controlsVisible ? 1 : 0,
          transition,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'rgba(22,21,15,.88)',
          border: '1px solid rgba(244,238,223,.14)',
          backdropFilter: 'blur(12px)',
          borderRadius: 99,
          padding: '8px 10px 8px 16px',
          boxShadow: '0 20px 50px rgba(0,0,0,.6)',
          whiteSpace: 'nowrap',
        }}>
          <span style={{ fontSize: 12, color: 'rgba(244,238,223,.5)', fontVariantNumeric: 'tabular-nums' }}>
            {idx + 1} / {slides.length}
          </span>
          <Divider />
          {loa && (
            <>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: '#F4EEDF', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {loa.brand}
              </span>
              <Divider />
            </>
          )}
          <PillBtn onClick={() => setShowComments(s => !s)} active={showComments}>
            Comment
            {slideComments.length > 0 && <Badge count={slideComments.length} />}
          </PillBtn>
          {isLOA && !isSubmitted && (
            <>
              <PillBtn onClick={() => loa && onReject(loa.id, loa)} danger active={isRejected}>
                {isRejected ? '✕ Rejected' : 'Reject'}
              </PillBtn>
              <PillBtn onClick={() => loa && !isApproved && onApprove(loa.id)} positive active={isApproved}>
                {isApproved ? '✓ Approved' : 'Approve'}
              </PillBtn>
            </>
          )}
          <Divider />
          <button
            onClick={onClose}
            title="Exit fullscreen (Esc)"
            style={{
              width: 28, height: 28, borderRadius: 99,
              border: '1px solid rgba(244,238,223,.18)', background: 'transparent',
              color: 'rgba(244,238,223,.6)', cursor: 'pointer', fontSize: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </div>

        {/* Status indicator */}
        <div style={{
          position: 'absolute', top: 20, right: 24,
          opacity: controlsVisible ? 1 : 0, transition,
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'rgba(22,21,15,.7)', border: '1px solid rgba(244,238,223,.12)',
          borderRadius: 99, padding: '6px 12px 6px 10px',
        }}>
          <span style={{ width: 7, height: 7, borderRadius: 99, background: '#D9B968', display: 'block' }} />
          <span style={{ fontSize: 11.5, color: 'rgba(244,238,223,.75)' }}>
            {isSubmitted ? 'Review submitted' : 'Recording decisions'}
          </span>
        </div>
      </div>

      {/* Comment panel */}
      {showComments && slide && (
        <CommentPanel
          slideId={slide.id}
          slideNumber={idx + 1}
          slideTitle={slideCaption(slide)}
          comments={slideComments}
          isSubmitted={isSubmitted}
          onAddComment={onAddComment}
          onClose={() => setShowComments(false)}
        />
      )}
    </div>
  )
}

function EdgeNav({ side, visible, onClick }: { side: 'left' | 'right'; visible: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        position: 'absolute', [side]: 12, top: '50%', transform: 'translateY(-50%)',
        width: 44, height: 44, borderRadius: 99,
        border: '1px solid rgba(244,238,223,.18)', background: 'rgba(22,21,15,.7)',
        color: 'rgba(244,238,223,.8)', fontSize: 22, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: visible ? 1 : 0, transition: 'opacity 200ms', zIndex: 10,
      }}
    >
      {side === 'left' ? '‹' : '›'}
    </button>
  )
}

function Divider() {
  return <span style={{ width: 1, height: 22, background: 'rgba(244,238,223,.14)', marginInline: 2 }} />
}

function Badge({ count }: { count: number }) {
  return (
    <span style={{ marginLeft: 5, width: 16, height: 16, borderRadius: 99, background: '#A7443E', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700 }}>
      {count}
    </span>
  )
}

function PillBtn({ onClick, children, danger, positive, active }: {
  onClick: () => void; children: React.ReactNode
  danger?: boolean; positive?: boolean; active?: boolean
}) {
  let bg = 'transparent', color = '#F4EEDF', border = '1px solid rgba(244,238,223,.2)'
  if (danger && active) { bg = 'rgba(167,68,62,.25)'; color = '#E6B3B3'; border = '1px solid rgba(167,68,62,.5)' }
  else if (danger) { color = '#E6B3B3'; border = '1px solid rgba(167,68,62,.4)' }
  else if (positive && active) { bg = '#0B653F'; color = '#DEF7ED'; border = '1px solid #0B653F' }
  else if (positive) { bg = '#C9A678'; color = '#1A1815'; border = 'none' }
  return (
    <button
      onClick={onClick}
      style={{ height: 32, padding: '0 14px', borderRadius: 99, border, background: bg, color, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: FONT, display: 'flex', alignItems: 'center', gap: 4, transition: 'all 120ms' }}
    >
      {children}
    </button>
  )
}
