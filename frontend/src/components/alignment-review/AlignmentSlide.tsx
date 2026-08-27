'use client'
/**
 * AlignmentSlide — the LOA detail slide as the reviewer sees it, at its native
 * 1280 × 720. Same anatomy as the CMO deck slide (navy category badge, badge
 * stack, nine-column strip, bordered field card, photo column), but typed for
 * a full-size slide rather than the deck's ~940px stage, and with every section
 * and photo wired as a comment anchor.
 *
 * "Generated from the submitted row — layout, table strip and photos are fixed."
 * Everything here is derived from the LOA; nothing is editable.
 */
import type { LOA } from '@/types/loa'
import type { LOAPhotoRecord } from '@/types/review'
import { formatAmount, formatEuro, cleanBrand, loaCaption, primaryCategory } from '@/types/review'
import { photoSrc } from '@/app/cmo-review/[cycleId]/components/PhotoUploader'
import { PIN, ACTIVE_RING } from './anchors'
import { activityLabel } from '@/types/loa'

const NAVY = '#2C3E5D'
const FONT = 'Inter, ui-sans-serif, system-ui, sans-serif'
const MONO = "'IBM Plex Mono', ui-monospace, monospace"

export const SLIDE_W = 1280
export const SLIDE_H = 720

// Field-card type ramp. The card gets ~329px of the 720px slide, and has to
// hold four sections plus the avg/door line. At these sizes that comes to
// ~286px, so nothing is ever shrunk into a half-cut line.
const LABEL_SIZE = 13
const LABEL_LINE = 16
const BODY_SIZE = 14
const BODY_LINE = 19
const SECTION_GAP = 6

const TABLE_COLS = '1fr 1.3fr 1.4fr 1.2fr 1.2fr .7fr 1.1fr 1.6fr 1.1fr'
const TABLE_HEAD = [
  'COUNTRY', 'TYPE / PLANNING', 'CUSTOMER', 'BRAND',
  'DETAIL', '# DOORS', 'AVG INV / DOOR', 'VENDOR', 'TOTAL EUR',
]

function orDash(v?: string | number | null): string {
  if (v === null || v === undefined || v === '') return '—'
  return String(v)
}

interface SectionDef {
  anchor: string
  label: string
  body?: string
}

interface Props {
  loa: LOA
  photos: LOAPhotoRecord[]
  /** anchor → comment count, for the gold pins. */
  counts: Record<string, number>
  activeAnchor: string | null
  /** Null makes the slide inert (marketer read-only with nothing to open). */
  onAnchorClick: ((anchor: string, el: HTMLElement) => void) | null
}

export default function AlignmentSlide({
  loa, photos, counts, activeAnchor, onAnchorClick,
}: Props) {
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

  const sections: SectionDef[] = [
    { anchor: 'section:description',     label: 'Description',     body: loa.description },
    { anchor: 'section:tools',           label: 'Tools',           body: loa.tools },
    { anchor: 'section:kpi',             label: 'KPI',             body: loa.kpi },
    { anchor: 'section:cost_drill_down', label: 'Cost drill down', body: loa.cost_drill_down },
  ]

  const photo1 = photos.find(p => p.photoType === 'execution_1')
  const photo2 = photos.find(p => p.photoType === 'execution_2')

  return (
    <div style={{
      width: SLIDE_W, height: SLIDE_H,
      display: 'flex', flexDirection: 'column',
      background: '#FDFBF7', color: '#0A0A0A', fontFamily: FONT, overflow: 'hidden',
    }}>
      {/* ── Header: category badge · country / budget / ref stack ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ background: NAVY, padding: '14px 40px', display: 'flex', alignItems: 'center' }}>
          <span style={{ color: '#fff', fontSize: 23, fontWeight: 700, letterSpacing: '.04em' }}>
            {category}
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 276 }}>
          <span style={{ background: NAVY, color: '#fff', fontSize: 19, fontWeight: 700, textAlign: 'center', padding: '6px 23px' }}>
            {(loa.country || '').toUpperCase() || '—'}
          </span>
          <span style={{ background: '#A6C4E0', color: '#0D1B2A', fontSize: 19, fontWeight: 700, textAlign: 'center', padding: '6px 23px' }}>
            {formatEuro(loa.fy_2026_total || 0)}
          </span>
          <span style={{ background: '#F2E56B', color: '#c0392b', fontSize: 16, fontWeight: 700, textAlign: 'center', padding: '5px 23px' }}>
            LOA {reference}
          </span>
        </div>
      </div>

      {/* ── Title ── */}
      <div style={{ padding: '23px 40px 16px', flexShrink: 0 }}>
        <p style={{ fontSize: 36, fontWeight: 700, color: '#111', margin: 0, lineHeight: 1.15, letterSpacing: '-.01em' }}>
          {loaCaption(loa)}
        </p>
      </div>

      {/* ── Nine-column summary strip ── */}
      <div style={{ padding: '0 33px', flexShrink: 0 }}>
        <div style={{ display: 'grid', gridTemplateColumns: TABLE_COLS, gap: 3, background: '#000' }}>
          {TABLE_HEAD.map(h => (
            <span key={h} style={{ color: '#fff', fontWeight: 700, fontSize: 14, letterSpacing: '.02em', padding: '10px 8px' }}>
              {h}
            </span>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: TABLE_COLS, gap: 3 }}>
          {row.map((c, i) => (
            <span
              key={TABLE_HEAD[i]}
              title={c}
              style={{
                color: '#222', fontSize: 15.5, padding: '10px 8px',
                background: '#fff', borderBottom: '1px solid #eee',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}
            >
              {c}
            </span>
          ))}
        </div>
      </div>

      {/* ── Body: bordered field card + photo column ── */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 440px',
        flex: 1, minHeight: 0, padding: '20px 33px 13px', gap: 23,
      }}>
        {/*
          Real submissions run much longer than the design's sample copy, and a
          slide cannot scroll. So the four sections share the card's height and
          each clamps its own body — that keeps every section label (and every
          comment anchor) on the slide, and keeps the avg/door line from being
          pushed off the bottom.
        */}
        <div style={{
          border: '1px solid #000', padding: '13px 16px',
          display: 'flex', flexDirection: 'column', gap: SECTION_GAP,
          minHeight: 0, overflow: 'hidden',
        }}>
          {sections.map(s => (
            <SlideSection
              key={s.anchor}
              def={s}
              count={counts[s.anchor] || 0}
              active={activeAnchor === s.anchor}
              onClick={onAnchorClick}
            />
          ))}
          {(avgPerDoor || doors) && (
            <p style={{
              fontSize: 15.5, fontWeight: 700, color: '#8A6A3F', lineHeight: '20px',
              margin: '2px 0 0', flexShrink: 0,
            }}>
              {avgPerDoor ? `${formatEuro(avgPerDoor)} avg/door` : null}
              {avgPerDoor && doors ? ' · ' : null}
              {doors ? `#${formatAmount(doors)} doors` : null}
            </p>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 13, minHeight: 0 }}>
          <PhotoFrame
            anchor="section:execution_photo_1"
            label="EXECUTION EXAMPLE 1"
            url={photo1?.url}
            count={counts['section:execution_photo_1'] || 0}
            active={activeAnchor === 'section:execution_photo_1'}
            onClick={onAnchorClick}
          />
          <PhotoFrame
            anchor="section:execution_photo_2"
            label="EXECUTION EXAMPLE 2"
            url={photo2?.url}
            count={counts['section:execution_photo_2'] || 0}
            active={activeAnchor === 'section:execution_photo_2'}
            onClick={onAnchorClick}
          />
        </div>
      </div>

      {/* ── Footer ── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '9px 33px', flexShrink: 0, borderTop: '1px solid #ccc',
      }}>
        <span style={{ color: '#111', fontSize: 16, fontWeight: 700 }}>●●</span>
        <span style={{ color: '#999', fontSize: 13 }}>
          Strictly confidential — for internal use only. Do not share or forward.
        </span>
        <span style={{ color: '#111', fontSize: 15, fontWeight: 700 }}>EssilorLuxottica</span>
      </div>
    </div>
  )
}

// ── Pieces ──────────────────────────────────────────────────────────────────

function Pin({ count, size }: { count: number; size: number }) {
  const has = count > 0
  return (
    <span style={{
      fontFamily: MONO, fontSize: size * 0.6, fontWeight: 500,
      minWidth: size, height: size, borderRadius: 99,
      background: has ? PIN.bg : 'transparent',
      border: `1px solid ${has ? PIN.bd : 'transparent'}`,
      color: has ? PIN.fg : 'transparent',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      {has ? count : ''}
    </span>
  )
}

function SlideSection({ def, count, active, onClick }: {
  def: SectionDef
  count: number
  active: boolean
  onClick: ((anchor: string, el: HTMLElement) => void) | null
}) {
  const clickable = onClick !== null
  return (
    <div
      data-anchor={def.anchor}
      onClick={clickable ? e => { e.stopPropagation(); onClick!(def.anchor, e.currentTarget) } : undefined}
      title={clickable ? `Comment on ${def.label}` : undefined}
      style={{
        position: 'relative',
        background: active ? '#FFFBEF' : 'transparent',
        boxShadow: active ? ACTIVE_RING : 'none',
        borderRadius: 4, padding: '2px 7px', margin: '0 -7px',
        cursor: clickable ? 'pointer' : 'default',
        display: 'flex', flexDirection: 'column',
        // Fixed height, so flex can never shrink a section into a half-cut line.
        flexShrink: 0, overflow: 'hidden',
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', gap: 9,
        height: LABEL_LINE, marginBottom: 3, flexShrink: 0,
      }}>
        <p style={{
          fontSize: LABEL_SIZE, fontWeight: 700, color: '#555', margin: 0,
          lineHeight: `${LABEL_LINE}px`,
          textTransform: 'uppercase', letterSpacing: '.05em',
        }}>
          {def.label}
        </p>
        <Pin count={count} size={16} />
      </div>
      {/*
        Exactly two lines, height pinned rather than left to the clamp, so long
        copy always ends in an ellipsis on a whole line. Four sections at this
        height plus the avg/door line fit the card at 720px with room to spare;
        the full text stays one click away in the Excel row above.
      */}
      <p
        title={def.body || undefined}
        style={{
          fontSize: BODY_SIZE, color: '#222', margin: 0,
          lineHeight: `${BODY_LINE}px`, height: BODY_LINE * 2,
          whiteSpace: 'pre-line', overflow: 'hidden', flexShrink: 0,
          display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2,
        }}
      >
        {def.body || '—'}
      </p>
    </div>
  )
}

function PhotoFrame({ anchor, label, url, count, active, onClick }: {
  anchor: string
  label: string
  url?: string
  count: number
  active: boolean
  onClick: ((anchor: string, el: HTMLElement) => void) | null
}) {
  const clickable = onClick !== null
  return (
    <div
      data-anchor={anchor}
      onClick={clickable ? e => { e.stopPropagation(); onClick!(anchor, e.currentTarget) } : undefined}
      title={clickable ? `Comment on ${label.toLowerCase()}` : undefined}
      style={{
        display: 'flex', flexDirection: 'column', gap: 6, minHeight: 0,
        cursor: clickable ? 'pointer' : 'default',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.07em', color: '#555' }}>
          {label}
        </span>
        <Pin count={count} size={18} />
      </div>
      <div style={{
        flex: 1, minHeight: 0, overflow: 'hidden',
        border: '1px solid #000',
        boxShadow: active ? ACTIVE_RING : 'none',
        background: url ? 'transparent' : '#F0EDE5',
        display: url ? 'block' : 'flex',
        alignItems: 'center', justifyContent: 'center',
      }}>
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoSrc(url)}
            alt={label}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <span style={{
            fontSize: 13, fontWeight: 700, letterSpacing: '.07em',
            color: '#B5AFA7', textTransform: 'uppercase',
          }}>
            No photo
          </span>
        )}
      </div>
    </div>
  )
}
