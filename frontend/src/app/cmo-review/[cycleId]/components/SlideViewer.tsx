'use client'
/**
 * SlideViewer — the stage plus the action bar under the slide.
 *
 * The action bar has two faces. On LOA slides it carries the decision controls;
 * on title/divider/overview slides there is nothing to decide, so it says so
 * and offers a jump to the next LOA instead.
 */
import { useRef, useEffect, useState } from 'react'
import type {
  Slide, ReviewVerdict, TitleSlideData, SectionDividerData,
  CategoryOverviewData, LOADetailData, LOASlideSizing, LensLayoutConfig,
} from '@/types/review'
import type { LOA } from '@/types/loa'
import TitleSlide from './slides/TitleSlide'
import SectionDividerSlide from './slides/SectionDividerSlide'
import CategoryOverviewSlide from './slides/CategoryOverviewSlide'
import LOADetailSlide from './slides/LOADetailSlide'
import type { CropState } from './PhotoUploader'

const FONT = "Inter, ui-sans-serif, system-ui, sans-serif"
const MONO = "'IBM Plex Mono', ui-monospace, SFMono-Regular, monospace"

interface Props {
  slides: Slide[]
  currentIndex: number
  verdicts: Record<string, ReviewVerdict>
  isSubmitted: boolean
  canEdit: boolean
  /** Narrows the stage when the setup panel or comment panel is open. */
  stageMax: number
  /** Text ramp + photo width for LOA slides, from the setup panel. */
  slideSizing?: LOASlideSizing
  /** True while a just-decided slide fades out before the deck turns. */
  leaving?: boolean
  onPrev: () => void
  onNext: () => void
  onApprove: (loaId: string) => void
  onReject: (loaId: string, loa: LOA) => void
  onToggleComments: () => void
  onSubmit: () => void
  /** Jumps to the next LOA detail slide; hidden when none remain. */
  onSkipToLOA?: () => void
  hasNextLOA: boolean
  allDecided: boolean
  /** Live progress, shown on the Submit button until every LOA is decided. */
  decidedCount?: number
  reviewableCount?: number
  commentCount: number
  onTitlePhotoUpload?: (file: File) => void
  onLOAPhotoUpload?: (loaId: string, photoType: 'execution_1' | 'execution_2', file: File) => void
  onLOAPhotoRemove?: (photoId: string) => void
  onLOAPhotoCropChange?: (photoId: string, crop: CropState) => void
  onOverviewPhotoUpload?: (category: string, photoType: string, file: File) => void
  onOverviewPhotoRemove?: (photoId: string) => void
  onOverviewPhotoCropChange?: (photoId: string, crop: CropState) => void
  onLensConfigChange?: (category: string, patch: Partial<LensLayoutConfig>) => void
  onLensPhotoUpload?: (category: string, columnId: string, file: File) => void
  onLensPhotoRemove?: (photoId: string) => void
  onLensPhotoCropChange?: (photoId: string, crop: CropState) => void
  /** Per-LOA photo layout intent from the Slide setup panel (0|1|2), keyed by LOA id. */
  loaPhotoModes?: Record<string, number>
}

export default function SlideViewer({
  slides, currentIndex, verdicts, isSubmitted, canEdit, stageMax,
  slideSizing, leaving = false,
  onPrev, onNext, onApprove, onReject, onToggleComments, onSubmit,
  onSkipToLOA, hasNextLOA, allDecided, decidedCount, reviewableCount, commentCount,
  onTitlePhotoUpload, onLOAPhotoUpload, onLOAPhotoRemove, onLOAPhotoCropChange,
  onOverviewPhotoUpload, onOverviewPhotoRemove, onOverviewPhotoCropChange,
  onLensConfigChange, onLensPhotoUpload, onLensPhotoRemove, onLensPhotoCropChange,
  loaPhotoModes,
}: Props) {
  const slide = slides[currentIndex]
  const [visible, setVisible] = useState(true)
  const prevIndex = useRef(currentIndex)

  useEffect(() => {
    if (prevIndex.current !== currentIndex) {
      setVisible(false)
      const t = setTimeout(() => { setVisible(true); prevIndex.current = currentIndex }, 120)
      return () => clearTimeout(t)
    }
  }, [currentIndex])

  if (!slide) return null

  const isLOA = slide.type === 'loa_detail'
  const loa = isLOA ? (slide.data as LOADetailData).loa : null
  const verdict = loa ? verdicts[loa.id] : undefined
  const isApproved = verdict?.decision === 'approved'
  const isRejected = verdict?.decision === 'rejected'
  const canDecide = isLOA && !isSubmitted
  const atFirst = currentIndex === 0
  const atLast = currentIndex === slides.length - 1

  let slideContent: React.ReactNode = null
  switch (slide.type) {
    case 'title_slide':
      slideContent = (
        <TitleSlide
          data={slide.data as TitleSlideData}
          canEdit={canEdit}
          onPhotoUpload={onTitlePhotoUpload}
        />
      )
      break
    case 'section_divider':
      slideContent = <SectionDividerSlide data={slide.data as SectionDividerData} />
      break
    case 'category_overview': {
      const ov = slide.data as CategoryOverviewData
      slideContent = (
        <CategoryOverviewSlide
          data={ov}
          canEdit={canEdit}
          onPhotoUpload={(photoType, file) => onOverviewPhotoUpload?.(ov.category, photoType, file)}
          onPhotoRemove={onOverviewPhotoRemove}
          onPhotoCropChange={onOverviewPhotoCropChange}
          onLensConfigChange={patch => onLensConfigChange?.(ov.category, patch)}
          onLensPhotoUpload={(colId, file) => onLensPhotoUpload?.(ov.category, colId, file)}
          onLensPhotoRemove={onLensPhotoRemove}
          onLensPhotoCropChange={onLensPhotoCropChange}
        />
      )
      break
    }
    case 'loa_detail':
      slideContent = loa ? (
        <LOADetailSlide
          loa={loa}
          commentCount={commentCount}
          canEdit={canEdit}
          sizing={slideSizing}
          photoMode={loaPhotoModes?.[loa.id]}
          onPhotoUpload={(photoType, file) => onLOAPhotoUpload?.(loa.id, photoType, file)}
          onPhotoRemove={onLOAPhotoRemove}
          onPhotoCropChange={onLOAPhotoCropChange}
        />
      ) : null
      break
  }

  return (
    <div style={{
      // minHeight:0 alongside overflowY:auto — otherwise this pane grows to the
      // slide's full height and the document scrolls, carrying the slide you are
      // reading up off the top of the screen instead of scrolling inside here.
      flex: 1, minWidth: 0, minHeight: 0,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      // LOA slides are the ones being read closely, so they get a tighter
      // surround — less dead ground, more slide.
      padding: isLOA ? '12px 14px 0' : '26px 28px 0',
      background: '#F2F1EE', overflowY: 'auto', fontFamily: FONT,
    }}>
      {/* Slide sheet */}
      <div style={{
        width: '100%', maxWidth: stageMax, aspectRatio: '16 / 9',
        background: '#FDFBF7',
        border: isLOA ? '1px solid #EAE6DE' : '1px solid #E3DFD6',
        borderRadius: isLOA ? 3 : 6,
        boxShadow: isLOA
          ? '0 10px 28px rgba(10,10,10,.08)'
          : '0 18px 44px rgba(10,10,10,.10)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 'none',
        // `leaving` is the decision fade; `visible` is the ordinary slide change.
        opacity: leaving || !visible ? 0 : 1,
        transform: leaving ? 'scale(.988)' : 'scale(1)',
        transition: 'opacity 240ms cubic-bezier(0.2,0,0,1), transform 240ms cubic-bezier(0.2,0,0,1)',
      }}>
        {slideContent}
      </div>

      {/* Action bar */}
      <div style={{
        width: '100%', maxWidth: stageMax,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 2px 20px', gap: 16, flex: 'none',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <NavArrow label="‹" disabled={atFirst} onClick={onPrev} title="Previous slide" />
          <NavArrow label="›" disabled={atLast} onClick={onNext} title="Next slide" />
          <span style={{
            fontFamily: MONO, fontSize: 12, color: '#9B9690',
            marginLeft: 6, fontVariantNumeric: 'tabular-nums',
          }}>
            {currentIndex + 1} / {slides.length}
          </span>
        </div>

        {isLOA ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={onToggleComments} title="Comments (C)" style={ghostBtn}>
              💬 Comment
              {commentCount > 0 && (
                <span style={{
                  fontFamily: MONO, fontSize: 10.5, color: '#8A6A3F',
                  background: '#FAF5EA', border: '1px solid #E8D9B8',
                  borderRadius: 99, padding: '1px 6px',
                }}>
                  {commentCount}
                </span>
              )}
            </button>

            <button
              onClick={() => loa && onReject(loa.id, loa)}
              disabled={!canDecide || isRejected}
              title="Reject (R)"
              style={{
                fontSize: 12.5, fontWeight: 600, fontFamily: FONT,
                color: !canDecide ? '#C2BDB6' : isRejected ? '#fff' : '#8A2E27',
                border: `1px solid ${isRejected ? '#8A2E27' : !canDecide ? '#EDEAE5' : '#E6C1BD'}`,
                background: isRejected ? '#8A2E27' : !canDecide ? '#fff' : '#FFF1EF',
                borderRadius: 8, padding: '10px 20px',
                cursor: canDecide && !isRejected ? 'pointer' : 'default',
              }}
            >
              {isRejected ? '✕ Rejected' : 'Reject'}
            </button>

            <button
              onClick={() => loa && !isApproved && onApprove(loa.id)}
              disabled={!canDecide || isApproved}
              title="Approve (A)"
              style={{
                fontSize: 12.5, fontWeight: 600, fontFamily: FONT,
                color: !canDecide ? '#C2BDB6' : '#fff',
                background: !canDecide ? '#EDEAE5' : isApproved ? '#1A7348' : '#0A0A0A',
                border: 'none', borderRadius: 8, padding: '10px 24px',
                cursor: canDecide && !isApproved ? 'pointer' : 'default',
                boxShadow: canDecide ? '0 2px 8px rgba(10,10,10,.18)' : 'none',
              }}
            >
              {isApproved ? '✓ Approved' : 'Approve'}
            </button>

            <span style={{ width: 1, height: 24, background: '#E0DED9', margin: '0 4px' }} />

            {isSubmitted ? (
              <span style={{ fontSize: 12.5, fontWeight: 600, color: '#1A7348' }}>
                ✓ Review submitted
              </span>
            ) : (
              /*
                Always clickable. Clicking it early opens the progress gate,
                which is more use than a button that refuses to respond.
              */
              <button
                onClick={onSubmit}
                title={allDecided ? 'Submit your review' : 'See what is left to decide'}
                style={{
                  fontSize: 12.5, fontWeight: 600, fontFamily: FONT,
                  color: allDecided ? '#fff' : '#5A554F',
                  background: allDecided ? '#0A0A0A' : '#fff',
                  border: `1px solid ${allDecided ? '#0A0A0A' : '#E0DED9'}`,
                  borderRadius: 8, padding: '10px 18px',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}
              >
                Submit review
                {!allDecided && decidedCount !== undefined && reviewableCount !== undefined && (
                  <span style={{
                    fontFamily: MONO, fontSize: 10.5, color: '#8A6A3F',
                    background: '#FAF5EA', border: '1px solid #E8D9B8',
                    borderRadius: 99, padding: '1px 6px',
                  }}>
                    {decidedCount}/{reviewableCount}
                  </span>
                )}
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11.5, color: '#9B9690' }}>
              Presentation slide — no decision required
            </span>
            {hasNextLOA && (
              <button onClick={onSkipToLOA} style={ghostBtn}>
                Skip to next LOA ›
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const ghostBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 7,
  fontSize: 12.5, fontWeight: 500, color: '#5A554F',
  border: '1px solid #E0DED9', background: '#fff',
  borderRadius: 8, padding: '9px 14px', cursor: 'pointer', fontFamily: FONT,
}

function NavArrow({ label, disabled, onClick, title }: {
  label: string; disabled: boolean; onClick: () => void; title: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      style={{
        width: 34, height: 34, borderRadius: 8,
        border: '1px solid #E0DED9', background: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, color: disabled ? '#C9C5BF' : '#5A554F',
        cursor: disabled ? 'default' : 'pointer', fontFamily: FONT, padding: 0, lineHeight: 1,
      }}
    >
      {label}
    </button>
  )
}
