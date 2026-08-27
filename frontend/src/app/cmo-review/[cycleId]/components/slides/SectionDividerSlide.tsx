'use client'
/**
 * SectionDividerSlide — the punctuation between sections.
 *
 * A short rule, the section name at 60px with wide tracking, and the section's
 * weight underneath. Background follows the deck-wide divider style (black by
 * default; navy or light are the alternatives in the Slide setup panel).
 */
import type { SectionDividerData } from '@/types/review'
import { DIVIDER_STYLES, formatBudget } from '@/types/review'

const FONT = "Inter, ui-sans-serif, system-ui, sans-serif"

export default function SectionDividerSlide({ data }: { data: SectionDividerData }) {
  const p = DIVIDER_STYLES[data.style] || DIVIDER_STYLES.black
  // Activity dividers sit one level below category dividers, so they get a
  // slightly smaller face — the deck still reads as a hierarchy.
  const size = data.kind === 'activity' ? 42 : 60

  return (
    <div style={{ height: '100%', position: 'relative', fontFamily: FONT, background: p.bg }}>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 18,
        padding: '0 60px',
      }}>
        <span style={{ width: 44, height: 2, background: p.rule, flexShrink: 0 }} />
        <span style={{
          fontSize: size, fontWeight: 700, letterSpacing: '.14em',
          color: p.fg, lineHeight: 1, textAlign: 'center', textWrap: 'balance',
        }}>
          {data.label.toUpperCase()}
        </span>
        <span style={{
          fontSize: 12, fontWeight: 500, letterSpacing: '.22em',
          textTransform: 'uppercase', color: p.sub, textAlign: 'center',
        }}>
          {data.loaCount} LOA{data.loaCount === 1 ? '' : 's'} · {formatBudget(data.totalBudget)}
        </span>
      </div>

      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '8px 22px', borderTop: `1px solid ${p.rule}`,
      }}>
        <span style={{ color: p.sub, fontSize: 9 }}>
          Strictly confidential — for internal use only. Do not share or forward.
        </span>
        <span style={{ color: p.fg, fontSize: 10, fontWeight: 700 }}>EssilorLuxottica</span>
      </div>
    </div>
  )
}
