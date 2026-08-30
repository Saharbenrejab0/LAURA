'use client'
/**
 * LensInvestmentSlide — Template B "INVESTMENT INTO [programme]"
 *
 * N columns (default 3), each with:
 *   • Editable black header
 *   • Photo frame with pan/zoom crop
 *   • Editable italic caption
 *
 * Columns can be added or removed. Config persists via
 * onConfigChange → saveTitleConfig(lensConfigs[category]).
 */
import { useState, useEffect } from 'react'
import type { CategoryOverviewData, LensInvestmentColumn, LensLayoutConfig } from '@/types/review'
import PhotoUploader, { type CropState } from '../PhotoUploader'

const FONT = "Inter, ui-sans-serif, system-ui, sans-serif"

/**
 * Column ids double as the photo key: a frame persists as
 * `photo_type = lens_col_<column id>` under this cycle + category, and BOTH
 * lens slides read back from the same `data.photos` array. The ids therefore
 * have to be unique across the two templates, not just within one.
 *
 * They were not: this file and LensOverviewSlide both seeded
 * `default-1, default-2, ...`, so the overview slide's column 1 and
 * this slide's column A were literally the same stored photo —
 * uploading on one slide replaced the other's frame, and removing on one
 * cleared both. Columns added at runtime already use crypto.randomUUID(), so
 * these constants were the only collision source.
 */
const DEFAULT_COLUMNS: LensInvestmentColumn[] = [
  { id: 'investment-1', header: 'PROGRAMME A', caption: 'Supporting caption goes here.' },
  { id: 'investment-2', header: 'PROGRAMME B', caption: 'Supporting caption goes here.' },
  { id: 'investment-3', header: 'PROGRAMME C', caption: 'Supporting caption goes here.' },
]

interface Props {
  data: CategoryOverviewData
  canEdit: boolean
  onConfigChange?: (patch: Partial<LensLayoutConfig>) => void
  onPhotoUpload?: (columnId: string, file: File) => void
  onPhotoRemove?: (photoId: string) => void
  onPhotoCropChange?: (photoId: string, crop: CropState) => void
}

export default function LensInvestmentSlide({
  data, canEdit, onConfigChange, onPhotoUpload, onPhotoRemove, onPhotoCropChange,
}: Props) {
  const columns = data.lensConfig?.investmentColumns ?? DEFAULT_COLUMNS
  // The investment slide title is stored separately from the overview slide title
  // under a different key so both slides can be edited independently.
  const slideTitle = data.lensConfig?.investmentSlideTitle ?? `INVESTMENT INTO ${data.category.toUpperCase()}`

  const setColumns = (next: LensInvestmentColumn[]) => onConfigChange?.({ investmentColumns: next })
  const patchColumn = (id: string, patch: Partial<LensInvestmentColumn>) =>
    setColumns(columns.map(c => c.id === id ? { ...c, ...patch } : c))

  const addColumn = () => {
    const id = crypto.randomUUID()
    setColumns([...columns, { id, header: 'NEW PROGRAMME', caption: '' }])
  }

  const removeColumn = (id: string) => {
    if (columns.length <= 1) return
    setColumns(columns.filter(c => c.id !== id))
  }

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      background: '#FDFBF7', color: '#0A0A0A', fontFamily: FONT, overflow: 'hidden',
    }}>
      {/* Header bar */}
      <div style={{
        display: 'flex', alignItems: 'baseline', gap: 8,
        borderBottom: '1px solid #111', padding: '13px 22px 8px', flexShrink: 0,
      }}>
        <EditableText
          value={slideTitle}
          canEdit={canEdit}
          textStyle={{ fontSize: 13.5, fontWeight: 700, letterSpacing: '.04em' }}
          onCommit={v => onConfigChange?.({ investmentSlideTitle: v })}
        />
      </div>

      {/* Column grid */}
      <div style={{
        flex: 1, minHeight: 0, display: 'flex', gap: 0,
        padding: '10px 22px 8px', overflowX: 'auto',
      }}>
        {columns.map((col, i) => {
          const photoRec = data.photos?.find(p => p.photoType === `lens_col_${col.id}`)
          return (
            <div
              key={col.id}
              style={{
                flex: '1 0 160px', display: 'flex', flexDirection: 'column', gap: 8,
                paddingRight: i < columns.length - 1 ? 10 : 0, minHeight: 0,
              }}
            >
              {/* Black header */}
              <div style={{ background: '#0A0A0A', padding: '9px 11px', flexShrink: 0 }}>
                <EditableText
                  value={col.header}
                  canEdit={canEdit}
                  textStyle={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', color: '#fff' }}
                  onCommit={v => patchColumn(col.id, { header: v })}
                />
              </div>

              {/* Photo — fills remaining height */}
              <div style={{ flex: 1, minHeight: 60 }}>
                <PhotoUploader
                  existingUrl={photoRec?.url}
                  existingId={photoRec?.id}
                  canEdit={canEdit}
                  label={col.header}
                  border="1px solid #111"
                  cropState={photoRec ? {
                    focalX: photoRec.focalX ?? 0.5,
                    focalY: photoRec.focalY ?? 0.5,
                    zoom: photoRec.zoom ?? 1.0,
                  } : undefined}
                  onUpload={file => onPhotoUpload?.(col.id, file)}
                  onRemove={() => photoRec?.id && onPhotoRemove?.(photoRec.id)}
                  onCropChange={crop => photoRec?.id && onPhotoCropChange?.(photoRec.id, crop)}
                />
              </div>

              {/* Italic caption */}
              <EditableText
                value={col.caption}
                canEdit={canEdit}
                textStyle={{ fontSize: 9, fontStyle: 'italic', color: '#555', paddingLeft: 1 }}
                onCommit={v => patchColumn(col.id, { caption: v })}
              />

              {/* Remove column */}
              {canEdit && columns.length > 1 && (
                <button onClick={() => removeColumn(col.id)} style={tinyBtn}>
                  × remove column
                </button>
              )}
            </div>
          )
        })}

        {/* Add column button */}
        {canEdit && (
          <div style={{ display: 'flex', alignItems: 'center', paddingLeft: 10, flexShrink: 0 }}>
            <button
              onClick={addColumn}
              title="Add column"
              style={{
                width: 26, height: 26, borderRadius: 99,
                border: '1.5px dashed #C6C1B8', background: '#F7F4ED',
                color: '#8E887E', fontSize: 15, lineHeight: 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', padding: 0,
              }}
            >
              +
            </button>
          </div>
        )}
      </div>

      <Footer />
    </div>
  )
}

// ── Editable inline text ──────────────────────────────────────────────────────

function EditableText({ value, canEdit, textStyle, onCommit }: {
  value: string
  canEdit: boolean
  textStyle: React.CSSProperties
  onCommit: (v: string) => void
}) {
  const [draft, setDraft] = useState(value)
  const [focused, setFocused] = useState(false)

  useEffect(() => { if (!focused) setDraft(value) }, [value, focused])

  if (!canEdit) {
    return <span style={textStyle}>{value}</span>
  }

  return (
    <input
      value={draft}
      onFocus={() => setFocused(true)}
      onChange={e => setDraft(e.target.value)}
      onBlur={() => { setFocused(false); if (draft !== value) onCommit(draft) }}
      onKeyDown={e => {
        if (e.key === 'Enter') e.currentTarget.blur()
        else if (e.key === 'Escape') { setDraft(value); setFocused(false); e.currentTarget.blur() }
      }}
      style={{
        ...textStyle, fontFamily: FONT,
        background: focused ? 'rgba(255,255,255,.15)' : 'transparent',
        border: 'none', outline: focused ? '1px solid rgba(201,166,120,.6)' : 'none',
        borderRadius: 2, padding: focused ? '1px 3px' : 0, width: '100%',
      }}
    />
  )
}

// ── Shared primitives ─────────────────────────────────────────────────────────

const tinyBtn: React.CSSProperties = {
  fontSize: 8, color: '#9B9690', background: 'none', border: 'none',
  cursor: 'pointer', padding: '1px 0', fontFamily: FONT,
}

function Footer() {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '6px 22px', flexShrink: 0, borderTop: '1px solid #ccc',
    }}>
      <span style={{ color: '#111', fontSize: 10, fontWeight: 700 }}>●</span>
      <span style={{ color: '#999', fontSize: 8.5 }}>
        Strictly confidential — for internal use only. Do not share or forward.
      </span>
      <span style={{ color: '#111', fontSize: 10, fontWeight: 700 }}>EssilorLuxottica</span>
    </div>
  )
}
