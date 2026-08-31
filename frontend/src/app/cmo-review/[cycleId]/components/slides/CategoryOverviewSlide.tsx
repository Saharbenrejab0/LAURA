'use client'
/**
 * CategoryOverviewSlide — section numbers on the black-tile grid.
 *
 * layouts:
 *   priorities   — total + brand-priority tiles + activity columns (tile + photo)
 *   family       — activity-family donut + brand tiles (NO photos)
 *   lens_overview    → delegates to LensOverviewSlide
 *   lens_investment  → delegates to LensInvestmentSlide
 */
import type { CategoryOverviewData, LensLayoutConfig, OverviewTile } from '@/types/review'
import { formatBudget } from '@/lib/euro'
import PhotoUploader, { type CropState } from '../PhotoUploader'
import LensOverviewSlide from './LensOverviewSlide'
import LensInvestmentSlide from './LensInvestmentSlide'

const FONT = "Inter, ui-sans-serif, system-ui, sans-serif"
const MONO = "'IBM Plex Mono', ui-monospace, SFMono-Regular, monospace"
const GOLD = '#C9A678'
const DONUT_COLORS = ['#0A0A0A', '#2C3E5D', '#C9A678', '#A6C4E0', '#8E887E']

function formatCyclePeriod(startDate?: string, endDate?: string): string {
  if (!startDate && !endDate) return ''
  const start = startDate ? new Date(startDate) : new Date(endDate!)
  const end = endDate ? new Date(endDate) : new Date(startDate!)
  const endYear = end.getFullYear()
  const quarters: string[] = []
  const d = new Date(start.getFullYear(), Math.floor(start.getMonth() / 3) * 3, 1)
  while (d <= end) {
    quarters.push(`Q${Math.floor(d.getMonth() / 3) + 1}`)
    d.setMonth(d.getMonth() + 3)
  }
  return quarters.length > 0 ? `${quarters.join('/')} ${endYear}` : String(endYear)
}

interface Props {
  data: CategoryOverviewData
  canEdit: boolean
  onPhotoUpload?: (photoType: string, file: File) => void
  onPhotoRemove?: (photoId: string) => void
  onPhotoCropChange?: (photoId: string, crop: CropState) => void
  onLensConfigChange?: (patch: Partial<LensLayoutConfig>) => void
  onLensPhotoUpload?: (columnId: string, file: File) => void
  onLensPhotoRemove?: (photoId: string) => void
  onLensPhotoCropChange?: (photoId: string, crop: CropState) => void
}

export default function CategoryOverviewSlide({
  data, canEdit, onPhotoUpload, onPhotoRemove, onPhotoCropChange,
  onLensConfigChange, onLensPhotoUpload, onLensPhotoRemove, onLensPhotoCropChange,
}: Props) {
  const { layout } = data

  if (layout === 'lens_overview') {
    return (
      <LensOverviewSlide
        data={data} canEdit={canEdit} onConfigChange={onLensConfigChange}
        onPhotoUpload={onLensPhotoUpload} onPhotoRemove={onLensPhotoRemove}
        onPhotoCropChange={onLensPhotoCropChange}
      />
    )
  }
  if (layout === 'lens_investment') {
    return (
      <LensInvestmentSlide
        data={data} canEdit={canEdit} onConfigChange={onLensConfigChange}
        onPhotoUpload={onLensPhotoUpload} onPhotoRemove={onLensPhotoRemove}
        onPhotoCropChange={onLensPhotoCropChange}
      />
    )
  }

  const isFamily = layout === 'family'
  const period = formatCyclePeriod(data.cycleStartDate, data.cycleEndDate)
  const countries = (data.countries ?? []).slice(0, 3).join(' · ')
  const scopeLine = [countries, period].filter(Boolean).join(' · ')

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      background: '#FDFBF7', color: '#0A0A0A', fontFamily: FONT, overflow: 'hidden',
    }}>
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        padding: '18px 22px 0', gap: 11, minHeight: 0,
      }}>
        {/* Rule header */}
        <div style={{
          display: 'flex', alignItems: 'baseline', gap: 8,
          borderBottom: '1px solid #111', paddingBottom: 7, flexShrink: 0,
        }}>
          <span style={{ fontSize: 13.5, fontWeight: 700, letterSpacing: '.04em' }}>
            {data.category.toUpperCase()} OVERVIEW
          </span>
          <span style={{ fontSize: 13.5, fontWeight: 400, color: '#666' }}>|</span>
          <span style={{ fontSize: 13.5, fontWeight: 700, letterSpacing: '.04em' }}>
            {isFamily ? 'FAMILY SPLIT' : 'KEY INVESTMENT PRIORITIES'}
          </span>
          {/* C5: scope line — countries + period */}
          {!isFamily && scopeLine && (
            <span style={{
              marginLeft: 'auto', fontSize: 9.5, fontWeight: 600,
              color: '#888', letterSpacing: '.04em', flexShrink: 0,
            }}>
              {scopeLine}
            </span>
          )}
        </div>

        {isFamily
          ? <FamilySplitBody data={data} />
          : (
            <PrioritiesBody
              data={data}
              canEdit={canEdit}
              period={period}
              onPhotoUpload={onPhotoUpload}
              onPhotoRemove={onPhotoRemove}
              onPhotoCropChange={onPhotoCropChange}
            />
          )
        }
      </div>

      <Footer />
    </div>
  )
}

// ── Layout A · key investment priorities (variant 1A) ────────────────────────

function PrioritiesBody({ data, canEdit, period, onPhotoUpload, onPhotoRemove, onPhotoCropChange }: {
  data: CategoryOverviewData
  canEdit: boolean
  period: string
  onPhotoUpload?: (photoType: string, file: File) => void
  onPhotoRemove?: (photoId: string) => void
  onPhotoCropChange?: (photoId: string, crop: CropState) => void
}) {
  const totalBudget = data.totalBudget || 1
  const activities = data.familyTiles.slice(0, 5)
  const colCount = Math.max(1, activities.length)

  return (
    <>
      {/* Total + 4 brand priority tiles */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1.8fr 1fr 1fr 1fr 1fr',
        gap: 6, height: 74, flexShrink: 0,
      }}>
        {/* Total tile — C6: subtitle uses period, not LOA count */}
        <div style={{
          border: '1px solid #111', background: '#fff', padding: '9px 12px',
          display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4,
          overflow: 'hidden',
        }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em' }}>
            TOTAL SUBMISSION{period ? ` · ${period}` : ''}
          </span>
          <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-.02em' }}>
            {formatBudget(data.totalBudget)}
          </span>
          <span style={{ fontSize: 9.5, color: '#555' }}>
            {formatBudget(data.opex)} OPEX + {formatBudget(data.capex)} CAPEX
          </span>
        </div>

        {/* C7: 4 brand tiles always rendered (LUXURY + OTHER included even at 0€) */}
        {data.priorityTiles.map(t => (
          <div key={t.label} style={blackTile}>
            <span style={tileLabel}>{t.label}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>
              {formatBudget(t.amount)}
            </span>
          </div>
        ))}
      </div>

      {/* C1+C2: Activity columns — tile (index / amount / % / bar) + photo well below */}
      <div style={{
        flex: 1, display: 'grid',
        gridTemplateColumns: `repeat(${colCount}, 1fr)`,
        gap: 6, minHeight: 0,
      }}>
        {activities.map((f, i) => {
          const pct = Math.round((f.amount / totalBudget) * 100)
          const photo = data.photos?.find(p => p.photoType === `overview_${i + 1}`)

          return (
            <div key={f.label} style={{ display: 'flex', flexDirection: 'column', gap: 4, minHeight: 0 }}>
              {/* Activity tile — C1 */}
              <div style={{
                background: '#0A0A0A', padding: '7px 9px', flexShrink: 0,
                display: 'flex', flexDirection: 'column', gap: 3,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 9.5, fontWeight: 700, color: GOLD, fontFamily: MONO }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span style={{ fontSize: 8, color: GOLD, fontFamily: MONO }}>{pct}%</span>
                </div>
                <span style={{
                  fontSize: 8.5, fontWeight: 700, color: '#fff', lineHeight: 1.25,
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}>
                  {f.label}
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>
                  {formatBudget(f.amount)}
                </span>
                {/* Gold horizontal progress bar */}
                <div style={{ height: 2, background: '#333', borderRadius: 1, marginTop: 1 }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: GOLD, borderRadius: 1 }} />
                </div>
              </div>

              {/* Photo well — C2: labelled with activity name, C3: placeholder when no photo */}
              <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                {!photo && !canEdit ? (
                  <div style={{
                    flex: 1, border: '1px dashed #CCC', borderRadius: 2,
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    gap: 4, background: '#F9F8F5',
                  }}>
                    <span style={{
                      fontSize: 9, color: '#9B9690', textAlign: 'center',
                      fontWeight: 600, letterSpacing: '.04em',
                    }}>
                      No photo submitted
                    </span>
                    <span style={{ fontSize: 8.5, color: '#B0ACA7', fontFamily: MONO }}>
                      {f.loaCount} LOA{f.loaCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                ) : (
                  <PhotoUploader
                    existingUrl={photo?.url}
                    existingId={photo?.id}
                    canEdit={canEdit}
                    label={f.label}
                    cornerLabel={f.label}
                    border="1px solid #111"
                    cropState={photo ? { focalX: photo.focalX ?? 0.5, focalY: photo.focalY ?? 0.5, zoom: photo.zoom ?? 1.0 } : undefined}
                    onUpload={file => onPhotoUpload?.(`overview_${i + 1}`, file)}
                    onRemove={() => photo?.id && onPhotoRemove?.(photo.id)}
                    onCropChange={crop => photo?.id && onPhotoCropChange?.(photo.id, crop)}
                  />
                )}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}

// ── Layout B · family split (donut + brand tiles) ────────────────────────────

function FamilySplitBody({ data }: { data: CategoryOverviewData }) {
  const total = data.familyTiles.reduce((s, f) => s + f.amount, 0) || 1

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '212px 1fr',
      gap: 10, height: 150, flexShrink: 0,
    }}>
      {/* Donut + legend */}
      <div style={{
        border: '1px solid #111', background: '#fff', padding: '9px 11px',
        display: 'grid', gridTemplateColumns: '96px 1fr', gap: 9, alignItems: 'center',
        overflow: 'hidden',
      }}>
        <Donut tiles={data.familyTiles} total={total} totalLabel={formatBudget(data.totalBudget)} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
          {data.familyTiles.map((f, i) => (
            <div key={f.label} style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
              <span style={{
                width: 7, height: 7, borderRadius: 1, flexShrink: 0,
                background: DONUT_COLORS[i % DONUT_COLORS.length],
              }} />
              <span style={{
                fontSize: 7.5, fontWeight: 600, letterSpacing: '.03em', color: '#222',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {f.label}
              </span>
              <span style={{ fontFamily: MONO, fontSize: 7.5, color: '#777', flexShrink: 0, marginLeft: 'auto' }}>
                {Math.round((f.amount / total) * 100)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Brand tiles */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2,1fr)', gridTemplateRows: 'repeat(2,1fr)',
        gap: 6, minHeight: 0,
      }}>
        {data.priorityTiles.map(t => (
          <div key={t.label} style={blackTile}>
            <span style={tileLabel}>{t.label}</span>
            <div style={{
              display: 'flex', alignItems: 'baseline',
              justifyContent: 'space-between', gap: 4,
            }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>
                {formatBudget(t.amount)}
              </span>
              <span style={{ fontFamily: MONO, fontSize: 8.5, color: GOLD, flexShrink: 0 }}>
                {t.loaCount} LOA
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** SVG donut — one arc per activity family, sized by share of spend. */
function Donut({ tiles, total, totalLabel }: {
  tiles: OverviewTile[]; total: number; totalLabel: string
}) {
  const R = 34
  const C = 2 * Math.PI * R
  let offset = 0

  return (
    <div style={{ position: 'relative', width: 92, height: 92 }}>
      <svg width={92} height={92} viewBox="0 0 92 92" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={46} cy={46} r={R} fill="none" stroke="#EFEBE3" strokeWidth={16} />
        {tiles.map((f, i) => {
          const frac = f.amount / total
          const dash = frac * C
          const el = (
            <circle
              key={f.label}
              cx={46} cy={46} r={R} fill="none"
              stroke={DONUT_COLORS[i % DONUT_COLORS.length]}
              strokeWidth={16}
              strokeDasharray={`${dash} ${C - dash}`}
              strokeDashoffset={-offset}
            />
          )
          offset += dash
          return el
        })}
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 1,
      }}>
        <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '-.02em', color: '#0A0A0A' }}>
          {totalLabel}
        </span>
        <span style={{ fontSize: 6.5, letterSpacing: '.1em', color: '#8E887E', textTransform: 'uppercase' }}>
          total
        </span>
      </div>
    </div>
  )
}

// ── Shared bits ──────────────────────────────────────────────────────────────

const blackTile: React.CSSProperties = {
  background: '#0A0A0A', padding: '8px 9px',
  display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
  overflow: 'hidden', minWidth: 0,
}

const tileLabel: React.CSSProperties = {
  fontSize: 9, fontWeight: 700, lineHeight: 1.25, letterSpacing: '.05em', color: '#fff',
  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
}

// C8: footer left label is "●● In Store Communication"
function Footer() {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '6px 22px', flexShrink: 0, borderTop: '1px solid #ccc',
    }}>
      <span style={{ color: '#111', fontSize: 10, fontWeight: 700 }}>●● In Store Communication</span>
      <span style={{ color: '#999', fontSize: 8.5 }}>
        Strictly confidential — for internal use only. Do not share or forward.
      </span>
      <span style={{ color: '#111', fontSize: 10, fontWeight: 700 }}>EssilorLuxottica</span>
    </div>
  )
}
