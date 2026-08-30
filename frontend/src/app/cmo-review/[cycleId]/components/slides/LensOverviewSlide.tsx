'use client'
/**
 * LensOverviewSlide — Template A "LENS OVERVIEW"
 *
 * N columns (default 4), each with:
 *   • Editable black header
 *   • Editable subtitle (e.g. LOA count / budget)
 *   • Photo frame with pan/zoom crop
 *   • Editable bullet list
 *
 * Columns can be added or removed. All column config persists server-side
 * via onConfigChange → saveTitleConfig(lensConfigs[category]).
 */
import { useState, useEffect } from 'react'
import type { CategoryOverviewData, LensColumn, LensLayoutConfig } from '@/types/review'
import PhotoUploader, { type CropState } from '../PhotoUploader'

const FONT = "Inter, ui-sans-serif, system-ui, sans-serif"
const GOLD = '#C9A678'

/**
 * Column ids double as the photo key: a frame persists as
 * `photo_type = lens_col_<column id>` under this cycle + category, and BOTH
 * lens slides read back from the same `data.photos` array. The ids therefore
 * have to be unique across the two templates, not just within one.
 *
 * They were not: this file and LensInvestmentSlide both seeded
 * `default-1, default-2, ...`, so this slide's column 1 and
 * the investment slide's column A were literally the same stored photo —
 * uploading on one slide replaced the other's frame, and removing on one
 * cleared both. Columns added at runtime already use crypto.randomUUID(), so
 * these constants were the only collision source.
 */
const DEFAULT_COLUMNS: LensColumn[] = [
  { id: 'overview-1', header: 'PROGRAMME 1', subtitle: '', bullets: [] },
  { id: 'overview-2', header: 'PROGRAMME 2', subtitle: '', bullets: [] },
  { id: 'overview-3', header: 'PROGRAMME 3', subtitle: '', bullets: [] },
  { id: 'overview-4', header: 'PROGRAMME 4', subtitle: '', bullets: [] },
]

interface Props {
  data: CategoryOverviewData
  canEdit: boolean
  onConfigChange?: (patch: Partial<LensLayoutConfig>) => void
  onPhotoUpload?: (columnId: string, file: File) => void
  onPhotoRemove?: (photoId: string) => void
  onPhotoCropChange?: (photoId: string, crop: CropState) => void
}

export default function LensOverviewSlide({
  data, canEdit, onConfigChange, onPhotoUpload, onPhotoRemove, onPhotoCropChange,
}: Props) {
  const columns = data.lensConfig?.overviewColumns ?? DEFAULT_COLUMNS
  const slideTitle = data.lensConfig?.slideTitle ?? 'LENS OVERVIEW'

  const setColumns = (next: LensColumn[]) => onConfigChange?.({ overviewColumns: next })
  const patchColumn = (id: string, patch: Partial<LensColumn>) =>
    setColumns(columns.map(c => c.id === id ? { ...c, ...patch } : c))

  const addColumn = () => {
    const id = crypto.randomUUID()
    setColumns([...columns, { id, header: 'NEW PROGRAMME', subtitle: '', bullets: ['Key action'] }])
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
      {/* Header bar — just the editable slide title (no redundant category prefix) */}
      <div style={{
        display: 'flex', alignItems: 'baseline', gap: 8,
        borderBottom: '1px solid #111', padding: '13px 22px 8px', flexShrink: 0,
      }}>
        <EditableText
          value={slideTitle}
          canEdit={canEdit}
          textStyle={{ fontSize: 13.5, fontWeight: 700, letterSpacing: '.04em' }}
          onCommit={v => onConfigChange?.({ slideTitle: v })}
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
                flex: '1 0 130px', display: 'flex', flexDirection: 'column', gap: 5,
                paddingRight: i < columns.length - 1 ? 8 : 0, minHeight: 0,
              }}
            >
              {/* Black header */}
              <div style={{ background: '#0A0A0A', padding: '6px 8px', flexShrink: 0 }}>
                <EditableText
                  value={col.header}
                  canEdit={canEdit}
                  textStyle={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.06em', color: '#fff' }}
                  onCommit={v => patchColumn(col.id, { header: v })}
                />
              </div>

              {/* Subtitle */}
              <EditableText
                value={col.subtitle || '— LOA · €—'}
                canEdit={canEdit}
                textStyle={{ fontSize: 8.5, color: '#666', paddingLeft: 1 }}
                onCommit={v => patchColumn(col.id, { subtitle: v })}
              />

              {/* Photo frame */}
              <div style={{ height: 88, flexShrink: 0 }}>
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

              {/* Bullet list */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3, minHeight: 0, overflow: 'hidden' }}>
                {col.bullets.map((b, bi) => (
                  <div key={bi} style={{ display: 'flex', gap: 4, alignItems: 'flex-start' }}>
                    <span style={{ color: GOLD, fontSize: 7.5, flexShrink: 0, marginTop: 2 }}>▸</span>
                    <EditableText
                      value={b}
                      canEdit={canEdit}
                      textStyle={{ fontSize: 8.5, lineHeight: 1.45, color: '#2A2A2A', flex: 1 }}
                      onCommit={v => {
                        const next = [...col.bullets]
                        next[bi] = v
                        patchColumn(col.id, { bullets: next })
                      }}
                    />
                    {canEdit && (
                      <button
                        onClick={() => {
                          const next = col.bullets.filter((_, j) => j !== bi)
                          patchColumn(col.id, { bullets: next.length ? next : ['Key action'] })
                        }}
                        title="Remove bullet"
                        style={tinyBtn}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                {canEdit && (
                  <button
                    onClick={() => patchColumn(col.id, { bullets: [...col.bullets, 'Key action'] })}
                    style={{ ...tinyBtn, textAlign: 'left', paddingLeft: 12 }}
                  >
                    + bullet
                  </button>
                )}
              </div>

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
          <div style={{ display: 'flex', alignItems: 'center', paddingLeft: 8, flexShrink: 0 }}>
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
  cursor: 'pointer', padding: '1px 0', fontFamily: FONT, flexShrink: 0,
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
