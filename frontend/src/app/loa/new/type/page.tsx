'use client'

/**
 * LAURA — LOA type selector.
 *
 * The step between "+ New LOA" and the form. Picks the shape of the LOA:
 * one row (standard), one row per brand, or one row per activity type.
 * Continue routes to /loa/new with ?type=, which the form reads to decide
 * whether to render its per-row section.
 */

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { ROUTES } from '@/lib/routes'

type LoaType = 'standard' | 'multi_brand' | 'multi_activity'

const CARDS: {
  type: LoaType
  title: string
  subtitle: string
  footLabel: string
  footValue: string
}[] = [
  {
    type: 'standard',
    title: 'Standard LOA',
    subtitle: 'One activity, one brand — the classic LOA.',
    footLabel: 'Produces',
    footValue: '1 Excel row · 1 slide',
  },
  {
    type: 'multi_brand',
    title: 'Multi-Brand LOA',
    subtitle: 'One activity type across several brands — each brand gets its own budget row.',
    footLabel: 'Typically',
    footValue: 'Frames — “Seasonal Visibility” over Ray-Ban, Oakley, Persol…',
  },
  {
    type: 'multi_activity',
    title: 'Multi-Activity LOA',
    subtitle: 'One brand across several activity types — each activity gets its own budget row.',
    footLabel: 'Typically',
    footValue: 'Lenses — “Nikon” over Launch Event, Trade Incentive, Digital…',
  },
]

const HINTS: Record<LoaType, string> = {
  standard:       'One brand, one activity type.',
  multi_brand:    'You will add one row per brand next.',
  multi_activity: 'You will add one row per activity type next.',
}

/** Miniature row-shape glyph, mirroring the design file's card icons. */
function Glyph({ type, active }: { type: LoaType; active: boolean }) {
  const ink   = active ? 'var(--accent)' : 'var(--text-secondary)'
  const faint = active ? 'var(--accent-dim, var(--border-strong))' : 'var(--border-strong)'
  const bar = (bg: string, h: number) => ({ height: h, borderRadius: 2, background: bg })

  if (type === 'standard') {
    return (
      <span style={{ display: 'flex', flexDirection: 'column', gap: 4, width: 46 }}>
        <span style={bar(ink, 9)} />
        <span style={bar(faint, 9)} />
      </span>
    )
  }
  if (type === 'multi_brand') {
    return (
      <span style={{ display: 'flex', gap: 5, alignItems: 'flex-start', width: 70 }}>
        <span style={{ width: 13, height: 31, borderRadius: 2, background: ink, flexShrink: 0 }} />
        <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={bar(faint, 7)} />
          <span style={bar(faint, 7)} />
          <span style={bar(faint, 7)} />
        </span>
      </span>
    )
  }
  return (
    <span style={{ display: 'flex', flexDirection: 'column', gap: 4, width: 70 }}>
      <span style={bar(ink, 13)} />
      <span style={{ display: 'flex', gap: 4 }}>
        <span style={{ flex: 1, ...bar(faint, 7) }} />
        <span style={{ flex: 1, ...bar(faint, 7) }} />
        <span style={{ flex: 1, ...bar(faint, 7) }} />
      </span>
    </span>
  )
}

export default function LOATypePage() {
  const router = useRouter()
  const [selected, setSelected] = useState<LoaType | null>(null)
  const [notSureOpen, setNotSureOpen] = useState(false)

  function cancel() { router.push(ROUTES.loas) }

  function cont() {
    if (!selected) return
    // Standard keeps the form's existing URL exactly as it was.
    if (selected === 'standard') router.push(ROUTES.loaNew)
    else router.push(`${ROUTES.loaNew}?type=${selected}`)
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 24px 48px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
        <h1 style={{ fontSize: 30, fontWeight: 600, letterSpacing: '-0.01em', margin: 0, color: 'var(--text-primary)' }}>
          What kind of LOA is this?
        </h1>
        <p style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--text-secondary)', margin: 0, maxWidth: 620 }}>
          This decides how your budget is broken down — and how many rows land in the
          Excel table on your slide.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {CARDS.map(card => {
          const active = selected === card.type
          return (
            <button
              key={card.type}
              type="button"
              onClick={() => setSelected(card.type)}
              aria-pressed={active}
              style={{
                position: 'relative', display: 'flex', flexDirection: 'column', gap: 16,
                padding: '24px 22px 22px', textAlign: 'left', cursor: 'pointer',
                background: active ? 'var(--bg-elevated)' : 'var(--bg-surface)',
                border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 14,
                boxShadow: active ? 'var(--shadow-md)' : 'none',
                transition: 'border-color .16s ease, background .16s ease',
              }}
            >
              <span
                aria-hidden
                style={{
                  position: 'absolute', top: 18, right: 18, width: 17, height: 17,
                  borderRadius: 99,
                  border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border-strong)'}`,
                  background: active ? 'var(--accent)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, fontWeight: 700, color: 'var(--accent-text)',
                }}
              >
                {active ? '✓' : ''}
              </span>

              <Glyph type={card.type} active={active} />

              <span style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <span style={{ fontSize: 16.5, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>
                  {card.title}
                </span>
                <span style={{ fontSize: 12.5, lineHeight: 1.55, color: 'var(--text-secondary)' }}>
                  {card.subtitle}
                </span>
              </span>

              <span style={{
                marginTop: 'auto', paddingTop: 14, borderTop: '1px solid var(--border)',
                display: 'flex', flexDirection: 'column', gap: 5,
              }}>
                <span style={{
                  fontSize: 9.5, fontWeight: 700, letterSpacing: '0.12em',
                  textTransform: 'uppercase', color: 'var(--text-muted)',
                }}>
                  {card.footLabel}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                  {card.footValue}
                </span>
              </span>
            </button>
          )
        })}
      </div>

      <div style={{
        marginTop: 20, display: 'flex', flexDirection: 'column',
        background: 'var(--bg-surface)', border: '1px solid var(--border)',
        borderRadius: 12, overflow: 'hidden',
      }}>
        <button
          type="button"
          onClick={() => setNotSureOpen(o => !o)}
          aria-expanded={notSureOpen}
          style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px',
            cursor: 'pointer', background: 'none', border: 'none', textAlign: 'left',
          }}
        >
          <span style={{ fontSize: 12, color: 'var(--accent)' }}>ⓘ</span>
          <span style={{ fontSize: 12.5, fontWeight: 500, flex: 1, color: 'var(--text-primary)' }}>
            Not sure which to pick?
          </span>
          <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{notSureOpen ? '▲' : '▼'}</span>
        </button>
        {notSureOpen && (
          <div style={{ padding: '0 18px 16px 40px', display: 'flex', flexDirection: 'column', gap: 9 }}>
            <span style={{ fontSize: 12.5, lineHeight: 1.65, color: 'var(--text-secondary)' }}>
              Frames are typically multi-brand — one activity, many brands. Lenses are
              typically multi-activity — one brand, many activities. If your LOA has just
              one brand and one activity type, choose Standard.
            </span>
            <span style={{ fontSize: 11.5, lineHeight: 1.6, color: 'var(--text-muted)' }}>
              Multi-brand and multi-activity LOAs need between 2 and 12 rows.
            </span>
          </div>
        )}
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 20, paddingTop: 18,
      }}>
        <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
          {selected ? HINTS[selected] : 'Pick a type to continue.'}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <button type="button" onClick={cancel} className="btn-secondary text-sm">Cancel</button>
          <button
            type="button"
            onClick={cont}
            disabled={!selected}
            className="btn-primary text-sm"
            style={{ opacity: selected ? 1 : 0.45, cursor: selected ? 'pointer' : 'not-allowed' }}
          >
            Continue →
          </button>
        </div>
      </div>
    </div>
  )
}
