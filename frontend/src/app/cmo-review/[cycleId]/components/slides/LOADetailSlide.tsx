'use client'
/**
 * LOADetailSlide — the only reviewable slide type.
 *
 *   header  category badge · country / amount / LOA ref
 *   title   brand: activity
 *   table   9 columns, one row
 *   body    bordered field card + the execution photo column
 *
 * Photo rules (from the design's Slide setup panel):
 *   two photos → both portrait, side by side
 *   one photo  → landscape 16:9
 *   zero       → dashed upload zones, and the slide still generates
 */
import { useRef, useState, useLayoutEffect } from 'react'
import type { LOA } from '@/types/loa'
import type { LOAPhotoRecord, LOASlideSizing } from '@/types/review'
import {
  formatAmount, formatEuro, cleanBrand, loaCaption, primaryCategory,
  DEFAULT_LOA_SIZING, TEXT_RAMP, PHOTO_RAMP,
} from '@/types/review'
import PhotoUploader from '../PhotoUploader'
import { activityLabel } from '@/types/loa'

const NAVY = '#2C3E5D'
const FONT = "Inter, ui-sans-serif, system-ui, sans-serif"

// Field-card geometry, shared by the layout and the line-fitting measurement.
const SECTION_COUNT = 4
const CARD_GAP = 5
const LABEL_MB = 2

const TABLE_COLS = '1fr 1.3fr 1.4fr 1.2fr 1.2fr .7fr 1.1fr 1.6fr 1.1fr'
const TABLE_HEAD = [
  'COUNTRY', 'TYPE / PLANNING', 'CUSTOMER', 'BRAND',
  'DETAIL', '# DOORS', 'AVG INV / DOOR', 'VENDOR', 'TOTAL EUR',
]

function orDash(v?: string | number | null): string {
  if (v === null || v === undefined || v === '') return '—'
  return String(v)
}

interface Props {
  loa: LOA & { photos?: LOAPhotoRecord[] }
  commentCount?: number
  canEdit?: boolean
  /** Text ramp + photo column width, driven from the Slide setup panel. */
  sizing?: LOASlideSizing
  /** Explicit layout intent from the Slide setup panel (0 | 1 | 2). Falls back to uploaded count. */
  photoMode?: number
  onPhotoUpload?: (photoType: 'execution_1' | 'execution_2', file: File) => void
  onPhotoRemove?: (photoId: string) => void
  onPhotoCropChange?: (photoId: string, crop: import('../PhotoUploader').CropState) => void
}

export default function LOADetailSlide({
  loa, commentCount = 0, canEdit = false, sizing = DEFAULT_LOA_SIZING,
  photoMode,
  onPhotoUpload, onPhotoRemove, onPhotoCropChange,
}: Props) {
  const ramp = TEXT_RAMP[sizing.text]
  const cardRef = useRef<HTMLDivElement>(null)
  const hasAvgLine = Boolean(loa.avg_investment_per_door || loa.num_doors)

  /**
   * How many body lines each section can show without the card overflowing.
   *
   * The card's height is not knowable up front: the stage narrows when the setup
   * or comment panel opens, and a long LOA title wraps to a second line and eats
   * into it. So measure the box and derive the line count, clamped to the ramp's
   * maximum. This is what guarantees the card never overflows — at any stage
   * width, any text size, any length of paragraph.
   */
  const [lines, setLines] = useState(ramp.lines)

  useLayoutEffect(() => {
    const el = cardRef.current
    if (!el) return
    function fit() {
      const node = cardRef.current
      if (!node) return
      const avail = node.clientHeight
      if (avail <= 0) return
      const gaps = SECTION_COUNT - 1 + (hasAvgLine ? 1 : 0)
      const fixed = gaps * CARD_GAP
        + (hasAvgLine ? ramp.bodyLine : 0)
        + SECTION_COUNT * (ramp.labelLine + LABEL_MB)
      const perLine = SECTION_COUNT * ramp.bodyLine
      const fits = Math.floor((avail - fixed) / perLine)
      setLines(Math.max(1, Math.min(ramp.lines, fits)))
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ramp.bodyLine, ramp.labelLine, ramp.lines, hasAvgLine])
  const brand = cleanBrand(loa.brand)
  const category = primaryCategory(loa).toUpperCase()
  const reference = loa.loa_number || loa.loa_draft_id
  const doors = loa.num_doors
  const avgPerDoor = loa.avg_investment_per_door

  const row = [
    orDash(loa.country),
    orDash(activityLabel(loa.activity_type)),
    orDash(loa.customer),
    brand || '—',
    orDash(loa.detail),
    doors ? formatAmount(doors) : '—',
    avgPerDoor ? formatEuro(avgPerDoor) : '—',
    orDash(loa.vendor),
    formatEuro(loa.fy_2026_total || 0),
  ]

  const photos = loa.photos || []
  const photo1 = photos.find(p => p.photoType === 'execution_1')
  const photo2 = photos.find(p => p.photoType === 'execution_2')
  const uploadedCount = (photo1 ? 1 : 0) + (photo2 ? 1 : 0)
  // photoMode is the explicit intent from the setup panel; fall back to uploaded count.
  const effectiveMode = photoMode !== undefined ? photoMode : uploadedCount
  /**
   * Photo column as a grid fraction rather than a pixel width, so the frames
   * scale with the stage instead of shrinking when the setup or comment panel
   * narrows it. A single photo gets a little extra room for its 16:9 frame.
   */
  const photoFr = PHOTO_RAMP[sizing.photos] * (effectiveMode === 1 ? 1.12 : 1)

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      background: '#FDFBF7', color: '#0A0A0A', fontFamily: FONT, overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ background: NAVY, padding: '9px 24px', display: 'flex', alignItems: 'center' }}>
          <span style={{ color: '#fff', fontSize: 14, fontWeight: 700, letterSpacing: '.04em' }}>
            {category}
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 168 }}>
          <span style={{ background: NAVY, color: '#fff', fontSize: 11.5, fontWeight: 700, textAlign: 'center', padding: '4px 14px' }}>
            {(loa.country || '').toUpperCase()}
          </span>
          <span style={{ background: '#A6C4E0', color: '#0D1B2A', fontSize: 11.5, fontWeight: 700, textAlign: 'center', padding: '4px 14px' }}>
            {formatEuro(loa.fy_2026_total || 0)}
          </span>
          <span style={{ background: '#F2E56B', color: '#c0392b', fontSize: 10, fontWeight: 700, textAlign: 'center', padding: '3px 14px' }}>
            LOA {reference}
          </span>
        </div>
      </div>

      {/* Title */}
      <div style={{ padding: '14px 24px 10px', flexShrink: 0 }}>
        <p style={{ fontSize: 22, fontWeight: 700, color: '#111', margin: 0, lineHeight: 1.15, letterSpacing: '-.01em' }}>
          {loaCaption(loa)}
        </p>
      </div>

      {/* Summary table */}
      <div style={{ padding: '0 20px', flexShrink: 0 }}>
        <div style={{ display: 'grid', gridTemplateColumns: TABLE_COLS, gap: 2, background: '#000' }}>
          {TABLE_HEAD.map(h => (
            <span key={h} style={{ color: '#fff', fontWeight: 700, fontSize: 8.5, letterSpacing: '.02em', padding: '6px 5px' }}>
              {h}
            </span>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: TABLE_COLS, gap: 2 }}>
          {row.map((c, i) => (
            <span
              key={TABLE_HEAD[i]}
              title={c}
              style={{
                color: '#222', fontSize: 9.5, padding: '6px 5px',
                background: '#fff', borderBottom: '1px solid #eee',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}
            >
              {c}
            </span>
          ))}
        </div>
      </div>

      {/* Body */}
      <div style={{
        display: 'grid', gridTemplateColumns: `1fr ${photoFr}fr`,
        flex: 1, minHeight: 0, padding: '12px 20px 8px', gap: 16,
      }}>
        {/*
          Field card. Every section is a fixed box — label plus a clamped number
          of body lines — so the card is the same shape on every LOA and a long
          paragraph is truncated with an ellipsis instead of pushing the
          avg/door line (or the card's own border) off the slide.
        */}
        <div
          ref={cardRef}
          style={{
            border: '1px solid #000', padding: '8px 10px',
            display: 'flex', flexDirection: 'column', gap: CARD_GAP,
            minHeight: 0, overflow: 'hidden',
          }}
        >
          <Field label="Description" value={loa.description} count={commentCount} ramp={ramp} lines={lines} />
          <Field label="Tools" value={loa.tools} ramp={ramp} lines={lines} />
          <Field label="KPI" value={loa.kpi} ramp={ramp} lines={lines} />
          <Field label="Cost drill down" value={loa.cost_drill_down} ramp={ramp} lines={lines} />
          {(avgPerDoor || doors) && (
            <p style={{
              fontSize: ramp.body, lineHeight: `${ramp.bodyLine}px`,
              fontWeight: 700, color: '#8A6A3F', margin: '1px 0 0', flexShrink: 0,
            }}>
              {avgPerDoor ? `${formatEuro(avgPerDoor)} avg/door` : null}
              {avgPerDoor && doors ? ' · ' : null}
              {doors ? `#${formatAmount(doors)} doors` : null}
            </p>
          )}
        </div>

        {/* Execution photos — centred in their column so the frames read as a pair */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: 0 }}>
          {effectiveMode === 1 ? (
            // Landscape 16:9
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minHeight: 0 }}>
              <PhotoLabel>EXECUTION EXAMPLE</PhotoLabel>
              <PhotoUploader
                existingUrl={photo1?.url ?? photo2?.url}
                existingId={photo1?.id ?? photo2?.id}
                canEdit={canEdit}
                label="Execution example"
                aspectRatio="16 / 9"
                cropState={
                  (photo1 || photo2)
                    ? { focalX: (photo1 || photo2)!.focalX ?? 0.5, focalY: (photo1 || photo2)!.focalY ?? 0.5, zoom: (photo1 || photo2)!.zoom ?? 1.0 }
                    : undefined
                }
                onUpload={file => onPhotoUpload?.('execution_1', file)}
                onRemove={() => (photo1 || photo2)?.id && onPhotoRemove?.((photo1 || photo2)!.id)}
                onCropChange={crop => (photo1 || photo2)?.id && onPhotoCropChange?.((photo1 || photo2)!.id, crop)}
              />
            </div>
          ) : (
            // Two portraits side by side — also the zero-photo upload-zone pair
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr',
              gap: 8, flex: 1, minHeight: 0,
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minHeight: 0 }}>
                <PhotoLabel>EXECUTION EXAMPLE 1</PhotoLabel>
                <PhotoUploader
                  existingUrl={photo1?.url}
                  existingId={photo1?.id}
                  canEdit={canEdit}
                  label="Execution example 1"
                  cropState={photo1 ? { focalX: photo1.focalX ?? 0.5, focalY: photo1.focalY ?? 0.5, zoom: photo1.zoom ?? 1.0 } : undefined}
                  onUpload={file => onPhotoUpload?.('execution_1', file)}
                  onRemove={() => photo1?.id && onPhotoRemove?.(photo1.id)}
                  onCropChange={crop => photo1?.id && onPhotoCropChange?.(photo1.id, crop)}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minHeight: 0 }}>
                <PhotoLabel>EXECUTION EXAMPLE 2</PhotoLabel>
                <PhotoUploader
                  existingUrl={photo2?.url}
                  existingId={photo2?.id}
                  canEdit={canEdit}
                  label="Execution example 2"
                  cropState={photo2 ? { focalX: photo2.focalX ?? 0.5, focalY: photo2.focalY ?? 0.5, zoom: photo2.zoom ?? 1.0 } : undefined}
                  onUpload={file => onPhotoUpload?.('execution_2', file)}
                  onRemove={() => photo2?.id && onPhotoRemove?.(photo2.id)}
                  onCropChange={crop => photo2?.id && onPhotoCropChange?.(photo2.id, crop)}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '6px 20px', flexShrink: 0, borderTop: '1px solid #ccc',
      }}>
        <span style={{ color: '#111', fontSize: 10, fontWeight: 700 }}>●●</span>
        <span style={{ color: '#999', fontSize: 8.5 }}>
          Strictly confidential — for internal use only. Do not share or forward.
        </span>
        <span style={{ color: '#111', fontSize: 10, fontWeight: 700 }}>EssilorLuxottica</span>
      </div>
    </div>
  )
}

function PhotoLabel({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      fontSize: 8, fontWeight: 700, letterSpacing: '.07em', color: '#555', flexShrink: 0,
    }}>
      {children}
    </span>
  )
}

function Field({ label, value, count = 0, ramp, lines }: {
  label: string
  value?: string
  count?: number
  ramp: typeof TEXT_RAMP[keyof typeof TEXT_RAMP]
  /** Measured by the parent so the card can never overflow. */
  lines: number
}) {
  const flagged = count > 0
  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <p style={{
        fontSize: ramp.label, lineHeight: `${ramp.labelLine}px`,
        fontWeight: 700, color: '#555', margin: `0 0 ${LABEL_MB}px`,
        textTransform: 'uppercase', letterSpacing: '.05em',
      }}>
        {label}
      </p>
      {/* Fixed box: exactly `lines` whole lines, ellipsised beyond that. */}
      <p
        title={value || undefined}
        style={{
          fontSize: ramp.body, color: '#222', margin: 0,
          lineHeight: `${ramp.bodyLine}px`,
          height: ramp.bodyLine * lines,
          overflow: 'hidden', whiteSpace: 'pre-line',
          display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: lines,
        }}
      >
        {value || '—'}
      </p>
      {flagged && (
        <span style={{
          position: 'absolute', top: -1, right: 0,
          minWidth: 15, height: 15, borderRadius: 99,
          background: '#C9A678', color: '#1A1408',
          fontSize: 9, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '0 4px',
        }}>
          {count}
        </span>
      )}
    </div>
  )
}
