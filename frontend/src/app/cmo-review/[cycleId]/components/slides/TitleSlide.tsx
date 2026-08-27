'use client'
/**
 * TitleSlide — the deck's cover.
 *
 * Full-bleed photo behind a left-weighted scrim, with the text stack pinned to
 * the left 56% of the slide: wordmark at the top, the title block in the
 * middle, the year at the bottom. Text is edited from the Slide setup panel;
 * the slide itself is a drop target for the cover photo.
 */
import { useRef, useState, useCallback } from 'react'
import type { TitleSlideData } from '@/types/review'
import { TITLE_SIZES, softTitleColor } from '@/types/review'
import { photoSrc } from '../PhotoUploader'

const FONT = "Inter, ui-sans-serif, system-ui, sans-serif"
const MONO = "'IBM Plex Mono', ui-monospace, SFMono-Regular, monospace"

interface Props {
  data: TitleSlideData
  canEdit: boolean
  onPhotoUpload?: (file: File) => void
}

export default function TitleSlide({ data, canEdit, onPhotoUpload }: Props) {
  const cfg = data.titleConfig
  const fileRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const title = cfg?.title || data.cycleName || 'EssilorLuxottica'
  const subtitle = cfg?.subtitle || ''
  const year = cfg?.year || data.cycleYear || ''
  const color = cfg?.titleColor || '#FFFFFF'
  const soft = softTitleColor(color)
  const [titlePx, subPx, yearPx] = TITLE_SIZES[cfg?.titleFontSize || 'medium']

  const hasPhoto = Boolean(data.backgroundPhotoUrl)

  const handleFiles = useCallback((files: FileList | null) => {
    const file = files?.[0]
    if (file && onPhotoUpload) onPhotoUpload(file)
  }, [onPhotoUpload])

  return (
    <div
      onClick={() => canEdit && fileRef.current?.click()}
      onDragOver={e => { if (canEdit) { e.preventDefault(); setDragging(true) } }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => {
        if (!canEdit) return
        e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files)
      }}
      style={{
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: FONT,
        background: '#2A2724',
        cursor: canEdit ? 'pointer' : 'default',
      }}
    >
      {/* Cover photo */}
      {hasPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoSrc(data.backgroundPhotoUrl!)}
          alt=""
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%', objectFit: 'cover', display: 'block',
          }}
        />
      ) : (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(135deg, #2C3E5D 0%, #14202F 100%)',
        }} />
      )}

      {/* Scrim — left-weighted so the text column stays legible on any image */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(90deg,rgba(10,10,10,.62) 0%,rgba(10,10,10,.34) 46%,rgba(10,10,10,0) 76%)',
        pointerEvents: 'none',
      }} />

      {/* Text column */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: '56%',
        padding: '38px 40px',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        pointerEvents: 'none',
      }}>
        <span style={{
          fontSize: 15, fontWeight: 700, letterSpacing: '.01em',
          color, textShadow: '0 1px 12px rgba(0,0,0,.5)',
        }}>
          EssilorLuxottica
        </span>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <span style={{
            fontSize: 11, fontWeight: 600, letterSpacing: '.18em', textTransform: 'uppercase',
            color: soft, textShadow: '0 1px 10px rgba(0,0,0,.5)',
          }}>
            EMEA PS — Mktg &amp; Cat&apos;
          </span>
          <span style={{
            fontSize: titlePx, fontWeight: 700, lineHeight: 1.02, letterSpacing: '-.025em',
            color, textShadow: '0 2px 20px rgba(0,0,0,.45)', textWrap: 'pretty',
          }}>
            {title}
          </span>
          {subtitle && (
            <span style={{
              fontSize: subPx, fontWeight: 400,
              color: soft, textShadow: '0 1px 10px rgba(0,0,0,.5)',
            }}>
              {subtitle}
            </span>
          )}
        </div>

        {year && (
          <span style={{
            fontFamily: MONO, fontSize: yearPx, fontWeight: 500, letterSpacing: '.06em',
            color, opacity: .9, textShadow: '0 1px 10px rgba(0,0,0,.5)',
          }}>
            {year}
          </span>
        )}
      </div>

      {/* Drop affordance — only while a preparer is dragging, or when bare */}
      {canEdit && (dragging || !hasPhoto) && (
        <div style={{
          position: 'absolute', inset: 12,
          border: `1.5px dashed ${dragging ? '#C9A678' : 'rgba(255,255,255,.35)'}`,
          background: dragging ? 'rgba(201,166,120,.18)' : 'transparent',
          borderRadius: 4,
          display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end',
          padding: 14, pointerEvents: 'none',
        }}>
          <span style={{
            fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,.8)',
            background: 'rgba(10,10,10,.55)', borderRadius: 6, padding: '5px 10px',
          }}>
            {dragging ? 'Drop to set the cover' : 'Drop a photo, or click to browse'}
          </span>
        </div>
      )}

      <div style={{
        position: 'absolute', right: 22, bottom: 18,
        fontSize: 9, color: 'rgba(255,255,255,.55)', pointerEvents: 'none',
      }}>
        Strictly confidential — for internal use only.
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: 'none' }}
        onChange={e => handleFiles(e.target.files)}
      />
    </div>
  )
}
