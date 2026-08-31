/**
 * Comment anchors for the split-screen alignment review.
 *
 * Anchors live in two namespaces, and the design's summary panel names them
 * accordingly — "Excel · Vendor" for the row above, "Slide · Description" for
 * the slide below:
 *
 *   field:<loa_column>     → a cell in the Excel row (top half)
 *   section:<slide_block>  → a section or photo on the slide (bottom half)
 *
 * The same LOA column can therefore carry two independent threads: one raised
 * against the submitted value, one against how it reads on the deck slide.
 */
import type { LOA } from '@/types/loa'
import type { LOAPhotoRecord, ReviewComment } from '@/types/review'

export type AnchorSide = 'excel' | 'slide'

/** Gold pin — circle, fill #FAF5EA, stroke #C9A678. Used on both halves. */
export const PIN = {
  bg: '#FAF5EA',
  bd: '#C9A678',
  fg: '#8A6A3F',
} as const

/** The design's selected-anchor treatment. */
export const ACTIVE_RING = 'inset 0 0 0 1.5px #0A0A0A'

export function anchorSide(anchor: string): AnchorSide | null {
  if (anchor.startsWith('field:')) return 'excel'
  if (anchor.startsWith('section:')) return 'slide'
  return null
}

/**
 * Short names, matching the design's `names` map. Anything not listed falls
 * back to a prettified key so a new column never renders as `field:foo_bar`.
 */
const NAMES: Record<string, string> = {
  'field:sap_event_code':           'SAP event code',
  'field:category':                 'Category',
  'field:activity_type':            'Activity type',
  'field:brand':                    'Brand',
  'field:description':              'Description',
  'field:customer':                 'Customer',
  'field:country':                  'Country',
  'field:num_doors':                '# Doors',
  'field:avg_investment_per_door':  'Avg inv / door',
  'field:vendor':                   'Vendor',
  'field:fy_2026_total':            'Total budget',
  'field:timing':                   'Quarter',
  'field:capex_opex':               'OPEX / CAPEX',
  'field:cot':                      'Participant scope',
  'field:num_customers':            '# PAX',
  'field:cluster':                  'Cluster',
  'field:legal_entity':             'Legal entity',
  'field:adv_selling':              'ADV / Selling',
  'field:detail':                   'Detail (HOW)',
  'field:tools':                    'Tools',
  'field:kpi':                      'KPI',
  'field:cost_drill_down':          'Cost drill down',
  'field:q4_2025':                  'Q4 2025',
  'field:q1_2026':                  'Q1 2026',
  'field:q2_2026':                  'Q2 2026',
  'field:q3_2026':                  'Q3 2026',
  'field:q4_2026':                  'Q4 2026',

  'section:description':            'Description',
  'section:tools':                  'Tools',
  'section:kpi':                    'KPI',
  'section:cost_drill_down':        'Cost drill down',
  'section:execution_photo_1':      'Execution photo 1',
  'section:execution_photo_2':      'Execution photo 2',
}

export function anchorName(anchor?: string | null): string {
  if (!anchor) return 'General'
  const known = NAMES[anchor]
  if (known) return known
  const key = anchor.replace(/^(field|section):/, '').replace(/_/g, ' ')
  return key.charAt(0).toUpperCase() + key.slice(1)
}

/** "Excel · Vendor" / "Slide · Cost drill down" — the summary panel convention. */
export function anchorLabel(anchor?: string | null): string {
  if (!anchor) return 'General'
  const side = anchorSide(anchor)
  if (!side) return anchorName(anchor)
  return `${side === 'excel' ? 'Excel' : 'Slide'} · ${anchorName(anchor)}`
}

/** Which half a thread was raised on — the design's `origin` line. */
export function anchorOrigin(anchor?: string | null): string {
  const side = anchor ? anchorSide(anchor) : null
  if (side === 'excel') return 'top half'
  if (side === 'slide') return 'bottom half'
  return 'general'
}

export function countByAnchor(comments: ReviewComment[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const c of comments) {
    const k = c.anchor || ''
    if (!k) continue
    out[k] = (out[k] || 0) + 1
  }
  return out
}

/**
 * Normalise the two photo shapes the API can hand back into the one the slide
 * reads.  `/review/{cycle}/deck` returns `LOAPhotoRecord` rows from the
 * loa_photo table; `/loa/{id}` returns `[{index, url}]` scanned off disk. The
 * slide only cares about `photoType` + `url`, so both collapse to that.
 */
export function normalizeSlidePhotos(
  loa: (LOA & { photos?: Array<LOAPhotoRecord | { index?: number; url: string }> }) | null,
): LOAPhotoRecord[] {
  const raw = loa?.photos || []
  const out: LOAPhotoRecord[] = []
  raw.forEach((p, i) => {
    if (!p || !('url' in p) || !p.url) return
    if ('photoType' in p && p.photoType) {
      if (p.photoType === 'execution_1' || p.photoType === 'execution_2') out.push(p)
      return
    }
    const index = typeof (p as { index?: number }).index === 'number'
      ? (p as { index: number }).index
      : i + 1
    out.push({
      id: `${loa?.id}-photo-${index}`,
      loaId: loa?.id,
      photoType: index >= 2 ? 'execution_2' : 'execution_1',
      url: p.url,
      mimeType: 'image/*',
    })
  })
  // One slot each — a duplicate index wins on first sight.
  const seen = new Set<string>()
  return out.filter(p => (seen.has(p.photoType) ? false : (seen.add(p.photoType), true)))
}
