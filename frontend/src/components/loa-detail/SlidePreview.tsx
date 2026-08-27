'use client'

/**
 * SlidePreview — the real EssilorLuxottica LOA slide (cream/navy), rendered
 * from one LOA, with per-field comment anchors.
 *
 * Two layouts by activity type (mirrors backend/engines/ppt.py):
 *   - EVENT     → Events, Medical Affairs (SAP code, event type, # PAX, LOA# tag)
 *   - STANDARD  → everything else (country, doors, avg/door)
 *
 * Reviewer mode (commentable=true):
 *   - Each content field (Description, Tools, KPI, Cost drill down) and the
 *     Photos zone becomes a clickable block with a count badge in its corner.
 *   - Clicking a field calls onComment(fieldKey) with the REAL backend
 *     field_key (description / detail / kpi / cost_drill_down / photos), so the
 *     comment is saved against that field — not a generic "photos".
 *   - The count badge shows how many comments that field has (from sectionCounts,
 *     keyed by the field's section).
 *
 * Photos: 1 photo → landscape (full width). 2 photos → portrait, stacked.
 */

import { formatEuros } from '@/lib/format'
import { API_BASE } from '@/lib/api'

/**
 * Was a local `['Events', 'Medical Affairs']`. `activity_type` holds the stored
 * CODE (`EVENTS` / `MEDICAL_AFFAIRS`), so that check never matched and no LOA
 * ever got the event layout here — every event rendered with standard columns.
 */
import { isEventActivity } from '@/lib/slideRows'
import { activityLabel } from '@/types/loa'

export interface SlideData {
  activity_type: string
  category: string[] | string
  country: string
  brand: string
  fy_2026_total: number
  loa_number?: string
  description?: string
  detail?: string
  tools?: string
  kpi?: string
  cost_drill_down?: string
  timing?: string
  customer?: string
  vendor?: string
  cot?: string
  num_doors?: number
  num_customers?: number
  avg_investment_per_door?: number
  sap_event_code?: string
  event_type?: string
  photos?: { index: number; url: string }[]
}

/**
 * Each commentable field → its backend field_key + the section it maps to.
 * These match backend FIELD_TO_SECTION exactly.
 */
const FIELDS = {
  description:     { fieldKey: 'description',     section: 'overview' },
  tools:           { fieldKey: 'detail',          section: 'overview' },
  kpi:             { fieldKey: 'kpi',             section: 'kpis' },
  cost_drill_down: { fieldKey: 'cost_drill_down', section: 'financials' },
  photos:          { fieldKey: 'photos',          section: 'photos' },
} as const

function categoryLabel(category: string[] | string | null | undefined): string {
  if (category == null) return 'CATEGORY'
  if (typeof category === 'string') return category || 'CATEGORY'
  if (Array.isArray(category)) {
    const parts = category.filter((p) => typeof p === 'string' && p.length > 0)
    return parts.length ? parts.join(', ') : 'CATEGORY'
  }
  return String(category)
}

function clip(s: string | undefined | null, n: number): string {
  if (!s) return '—'
  return s.length > n ? s.slice(0, n) + '…' : s
}

export function SlidePreview({
  loa,
  commentable = false,
  sectionCounts = {},
  fieldNumbers = {},
  activeField = null,
  onComment,
  onFieldHover,
}: {
  loa: SlideData
  commentable?: boolean
  sectionCounts?: Record<string, number>
  fieldNumbers?: Record<string, number>
  activeField?: string | null
  onComment?: (fieldKey: string) => void
  onFieldHover?: (fieldKey: string | null) => void
}) {
  const isEvent = isEventActivity(loa.activity_type)
  const activityText = activityLabel(loa.activity_type)
  const slideTitle = loa.brand ? `${loa.brand}: ${activityText}` : activityText || 'Activity title'

  const headers = isEvent
    ? ['SAP EVENT CODE', 'EVENT TYPE', 'BRANDS / TOPIC', 'DESCRIPTION', 'PARTICIPANT', '# PAX', 'VENDOR', 'BUDGET', 'DATE']
    : ['COUNTRY', 'TYPE / PLANNING', 'CUSTOMER', 'BRAND', 'DETAIL', '# DOORS', 'AVG INV / DOOR', 'VENDOR', 'TOTAL EUR']

  const cells = isEvent
    ? [
        loa.sap_event_code || 'TBC',
        loa.event_type?.slice(0, 14) || '—',
        loa.brand?.slice(0, 16) || '—',
        clip(loa.description, 45),
        loa.cot || '—',
        loa.num_customers != null ? String(loa.num_customers) : '—',
        clip(loa.vendor, 18),
        formatEuros(loa.fy_2026_total),
        loa.timing || 'FY',
      ]
    : [
        loa.country || '—',
        activityText.slice(0, 16) || '—',
        clip(loa.customer, 18),
        loa.brand?.slice(0, 14) || '—',
        clip(loa.detail, 16),
        loa.num_doors != null ? String(loa.num_doors) : '—',
        loa.avg_investment_per_door ? formatEuros(loa.avg_investment_per_door) : '—',
        clip(loa.vendor, 22),
        formatEuros(loa.fy_2026_total),
      ]

  const gridCols = isEvent
    ? '1.2fr 1.1fr 1.6fr 2.2fr 1fr 0.6fr 1.2fr 0.9fr 1fr'
    : '1fr 1.3fr 1.4fr 1.2fr 1.2fr 0.7fr 1.1fr 1.6fr 1.1fr'

  const photos = (loa.photos || []).slice(0, 2)
  const onePhoto = photos.length <= 1

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        paddingBottom: '56.25%',
        background: '#FDFBF7',
        borderRadius: 6,
        overflow: 'hidden',
        border: '1px solid #ddd',
        fontFamily: 'Arial, sans-serif',
      }}
    >
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
        {/* Top bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'stretch', flexShrink: 0 }}>
          <div style={{ background: '#2C3E5D', padding: '8px 20px', display: 'flex', alignItems: 'center' }}>
            <span style={{ color: '#fff', fontSize: 13, fontWeight: 700, letterSpacing: '0.03em' }}>
              {categoryLabel(loa.category)}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 130 }}>
            <span style={{ background: '#2C3E5D', color: '#fff', fontSize: 11, fontWeight: 700, textAlign: 'center', padding: '3px 12px' }}>
              {loa.country?.toUpperCase() || 'COUNTRY'}
            </span>
            <span style={{ background: '#A6C4E0', color: '#0D1B2A', fontSize: 11, fontWeight: 700, textAlign: 'center', padding: '3px 12px' }}>
              {formatEuros(loa.fy_2026_total)}
            </span>
            {isEvent && loa.loa_number && (
              <span style={{ background: '#F2E56B', color: '#c0392b', fontSize: 10, fontWeight: 700, textAlign: 'center', padding: '2px 12px' }}>
                {loa.loa_number}
              </span>
            )}
          </div>
        </div>

        {/* Title */}
        <div style={{ padding: '10px 20px 8px', flexShrink: 0 }}>
          <p style={{ fontSize: 17, fontWeight: 700, color: '#111', margin: 0, lineHeight: 1.2 }}>{slideTitle}</p>
        </div>

        {/* Table header + data row */}
        <div style={{ padding: '0 16px', flexShrink: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 2, background: '#000' }}>
            {headers.map((h) => (
              <span key={h} style={{ color: '#fff', fontWeight: 700, fontSize: 7, letterSpacing: '0.02em', padding: '5px 4px' }}>
                {h}
              </span>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 2 }}>
            {cells.map((v, i) => (
              <span key={i} style={{ color: '#222', fontSize: 8, padding: '5px 4px', background: '#fff', borderBottom: '1px solid #eee' }}>
                {v}
              </span>
            ))}
          </div>
        </div>

        {/* Body: content left, photos right */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 240px', flex: 1, minHeight: 0, padding: '10px 16px', gap: 12 }}>
          <div style={{ border: '1px solid #000', padding: '6px 8px', overflowY: 'auto' }}>
            <ClickField k="description" label="Description" value={loa.description}
              commentable={commentable} sectionCounts={sectionCounts} number={fieldNumbers['description']} activeField={activeField} onComment={onComment} onFieldHover={onFieldHover} />
            <ClickField k="tools" label="Tools" value={loa.tools || loa.detail}
              commentable={commentable} sectionCounts={sectionCounts} number={fieldNumbers['detail']} activeField={activeField} onComment={onComment} onFieldHover={onFieldHover} />
            <ClickField k="kpi" label="KPI" value={loa.kpi}
              commentable={commentable} sectionCounts={sectionCounts} number={fieldNumbers['kpi']} activeField={activeField} onComment={onComment} onFieldHover={onFieldHover} />
            <ClickField k="cost_drill_down" label="Cost drill down" value={loa.cost_drill_down}
              commentable={commentable} sectionCounts={sectionCounts} number={fieldNumbers['cost_drill_down']} activeField={activeField} onComment={onComment} onFieldHover={onFieldHover} />
            {(loa.num_doors ?? 0) > 0 && (
              <p style={{ fontSize: 9.5, fontWeight: 700, color: '#1A7348', margin: '6px 0 0' }}>
                {loa.avg_investment_per_door ? formatEuros(loa.avg_investment_per_door) : '—'} avg/door · #{loa.num_doors} doors
              </p>
            )}
          </div>

          {/* Photos zone — also commentable */}
          <PhotoZone
            photos={photos}
            onePhoto={onePhoto}
            commentable={commentable}
            count={sectionCounts[FIELDS.photos.section] ?? 0}
            number={fieldNumbers['photos']}
            active={activeField === FIELDS.photos.fieldKey}
            onComment={onComment}
            onFieldHover={onFieldHover}
          />
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 16px', flexShrink: 0, borderTop: '1px solid #ccc' }}>
          <span style={{ color: '#111', fontSize: 9, fontWeight: 700 }}>●●</span>
          <span style={{ color: '#999', fontSize: 7.5 }}>Strictly confidential — for internal use only. Do not share or forward.</span>
          <span style={{ color: '#111', fontSize: 9, fontWeight: 700 }}>EssilorLuxottica</span>
        </div>
      </div>
    </div>
  )
}

/** One content field. In reviewer mode the whole block is clickable, with a
 *  count badge in the corner. Otherwise plain text (create-page preview). */
function ClickField({
  k, label, value, commentable, sectionCounts, number, activeField, onComment, onFieldHover,
}: {
  k: keyof typeof FIELDS
  label: string
  value?: string | null
  commentable: boolean
  sectionCounts: Record<string, number>
  number?: number
  activeField: string | null
  onComment?: (fieldKey: string) => void
  onFieldHover?: (fieldKey: string | null) => void
}) {
  if (!value) return null
  const map = FIELDS[k]
  const count = sectionCounts[map.section] ?? 0
  const isActive = activeField === map.fieldKey

  const body = (
    <>
      <p style={{ fontSize: 8, fontWeight: 700, color: '#555', margin: '0 0 2px', textTransform: 'uppercase' }}>{label}:</p>
      <p style={{ fontSize: 9.5, color: '#222', margin: 0, lineHeight: 1.45, whiteSpace: 'pre-line' }}>{value}</p>
    </>
  )

  if (!commentable) {
    return <div style={{ marginBottom: 6 }}>{body}</div>
  }

  return (
    <button
      type="button"
      onClick={() => onComment?.(map.fieldKey)}
      onMouseEnter={() => onFieldHover?.(map.fieldKey)}
      onMouseLeave={() => onFieldHover?.(null)}
      title={`Comment on ${label}`}
      style={{
        display: 'block', width: '100%', textAlign: 'left', position: 'relative',
        background: isActive ? '#f2ede0' : 'transparent',
        border: `1px solid ${isActive ? '#d8cfb8' : 'transparent'}`,
        borderRadius: 4, padding: '4px 24px 4px 6px', marginBottom: 4, cursor: 'pointer',
        transition: 'background 120ms, border-color 120ms',
      }}
      onMouseOver={(e) => { if (!isActive) e.currentTarget.style.background = '#f7f3e9' }}
      onMouseOut={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
    >
      {body}
      {number != null ? (
        <span
          style={{
            position: 'absolute', top: 4, right: 4,
            width: 18, height: 18, borderRadius: '50%',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 700,
            background: '#c9a84c', color: '#fff',
            border: isActive ? '2px solid #fff' : 'none',
            boxShadow: isActive ? '0 0 0 1px #c9a84c, 0 2px 6px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.3)',
          }}
        >
          {number}
        </span>
      ) : (
        <span
          style={{
            position: 'absolute', top: 4, right: 4,
            minWidth: 16, height: 16, borderRadius: 8, padding: '0 4px',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9, fontWeight: 700,
            background: '#e8e0cc', color: '#a89a6f',
          }}
        >
          +
        </span>
      )}
    </button>
  )
}

function PhotoZone({
  photos, onePhoto, commentable, count, number, active, onComment, onFieldHover,
}: {
  photos: { index: number; url: string }[]
  onePhoto: boolean
  commentable: boolean
  count: number
  number?: number
  active: boolean
  onComment?: (fieldKey: string) => void
  onFieldHover?: (fieldKey: string | null) => void
}) {
  const frames = onePhoto ? [photos[0]] : [photos[0], photos[1]]

  const inner = (
    <>
      <p style={{ fontSize: 9, textAlign: 'center', color: '#555', margin: '6px 0', fontWeight: 600 }}>
        Examples of Previous Executions
      </p>
      <div style={{ flex: 1, display: 'flex', gap: 4, padding: '0 6px 6px', minHeight: 0, flexDirection: onePhoto ? 'row' : 'column' }}>
        {frames.map((photo, i) => (
          <div key={i} style={{ flex: 1, background: '#ececec', borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', minHeight: 0 }}>
            {photo ? (
              <img src={API_BASE + photo.url} alt={`Photo ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ fontSize: 9, color: '#bbb', fontStyle: 'italic' }}>[ Photo {i + 1} ]</span>
            )}
          </div>
        ))}
      </div>
    </>
  )

  if (!commentable) {
    return <div style={{ border: '1px solid #000', display: 'flex', flexDirection: 'column' }}>{inner}</div>
  }

  return (
    <button
      type="button"
      onClick={() => onComment?.(FIELDS.photos.fieldKey)}
      onMouseEnter={() => onFieldHover?.(FIELDS.photos.fieldKey)}
      onMouseLeave={() => onFieldHover?.(null)}
      title="Comment on Photos"
      style={{
        border: `1px solid ${active ? '#c9a84c' : '#000'}`, display: 'flex', flexDirection: 'column',
        position: 'relative', background: active ? '#f2ede0' : 'transparent', cursor: 'pointer', padding: 0, textAlign: 'left',
      }}
    >
      {inner}
      {number != null ? (
        <span
          style={{
            position: 'absolute', top: 4, right: 4,
            width: 18, height: 18, borderRadius: '50%',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 700, background: '#c9a84c', color: '#fff',
            border: active ? '2px solid #fff' : 'none',
            boxShadow: active ? '0 0 0 1px #c9a84c, 0 2px 6px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.3)',
          }}
        >
          {number}
        </span>
      ) : (
        <span
          style={{
            position: 'absolute', top: 4, right: 4,
            minWidth: 16, height: 16, borderRadius: 8, padding: '0 4px',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9, fontWeight: 700, background: '#e8e0cc', color: '#a89a6f',
          }}
        >
          +
        </span>
      )}
    </button>
  )
}
