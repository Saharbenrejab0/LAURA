// ============================================================
// LAURA — Review system types + deck generator
//
// Built to docs/cmo-ppt-design.html. Four slide templates:
//   title_slide · section_divider · category_overview · loa_detail
//
// Deck order:
//   1. Title slide (one, first)
//   2. Per category:  divider → overview → per activity: divider → LOA slides
// ============================================================

import type { LOA } from './loa'
import { ACTIVITY_TYPES } from './loa'
export { formatAmount, formatEuro, formatBudget, formatCompact } from '@/lib/euro'

// ── Primitive types ──────────────────────────────────────────
export type SlideType = 'title_slide' | 'section_divider' | 'category_overview' | 'loa_detail'
export type VerdictDecision = 'approved' | 'rejected'
export type ReviewMode = 'slideshow' | 'board' | 'list'

/** Section divider background — deck-wide, chosen in the Slide setup panel. */
export type DividerStyle = 'black' | 'navy' | 'light'

/**
 * Category overview layout — per category, chosen in the Slide setup panel.
 * priorities / family → Frames, Wearables, etc.
 * lens_overview / lens_investment → Lenses (programme & breakdown columns).
 */
export type OverviewLayout = 'priorities' | 'family' | 'lens_overview' | 'lens_investment'

export type FontSize = 'small' | 'medium' | 'large'

// ── LOA detail slide sizing ──────────────────────────────────────────────────
// The reviewer controls this from the Slide setup panel. It is per-session, not
// persisted with the deck: it changes how the slide reads on *this* screen, and
// the field card stays a fixed, non-overflowing box at every setting.

export type SlideScale = 'compact' | 'standard' | 'roomy'
export const SLIDE_SCALES: SlideScale[] = ['compact', 'standard', 'roomy']

export interface LOASlideSizing {
  /** Type ramp for the DESCRIPTION / TOOLS / KPI / COST card. */
  text: SlideScale
  /** Share of the slide width given to the execution photos. */
  photos: SlideScale
}

export const DEFAULT_LOA_SIZING: LOASlideSizing = { text: 'standard', photos: 'standard' }

/** Body/label type ramp per text scale, plus how many lines each section shows. */
export const TEXT_RAMP: Record<SlideScale, {
  label: number; labelLine: number; body: number; bodyLine: number; lines: number
}> = {
  compact:  { label: 8,   labelLine: 11, body: 9.5,  bodyLine: 13, lines: 3 },
  standard: { label: 9,   labelLine: 12, body: 11,   bodyLine: 15, lines: 2 },
  roomy:    { label: 10,  labelLine: 13, body: 12.5, bodyLine: 17, lines: 2 },
}

/** Photo column width, as a grid fraction against the text card's 1fr. */
export const PHOTO_RAMP: Record<SlideScale, number> = {
  compact:  0.44,
  standard: 0.62,
  roomy:    0.82,
}

// ── Photo type (from API) ────────────────────────────────────
export interface LOAPhotoRecord {
  id: string
  loaId?: string
  cycleId?: string
  categorySlug?: string
  photoType: string
  url: string
  mimeType: string
  width?: number
  height?: number
  uploadedAt?: string
  /** Crop/pan/zoom — persisted per photo. Defaults: 0.5 / 0.5 / 1.0 */
  focalX?: number
  focalY?: number
  zoom?: number
}

// ── Lens slide column types ──────────────────────────────────

/**
 * One column in the "Lens Overview" (programme columns) template.
 * id is a stable UUID used as the photo_type suffix: "lens_col_{id}".
 */
export interface LensColumn {
  id: string
  /** Black header box text, e.g. "ESSILOR EXPERTS" */
  header: string
  /** Subtitle line: LOA count + budget. Editable; auto-populated on creation. */
  subtitle: string
  /** Editable bullet list beneath the photo. */
  bullets: string[]
}

/**
 * One column in the "Lens Investment" (breakdown columns) template.
 */
export interface LensInvestmentColumn {
  id: string
  /** Black header box with two-part label, e.g. "IN STORE | WINDOW VISIBILITY" */
  header: string
  /** Italic caption block: LOA count · countries · budget, e.g. "10 LOAs / FR, IT / 1.67M€" */
  caption: string
}

export interface LensLayoutConfig {
  /** Title for the Lens Overview slide (Slide A). */
  slideTitle?: string
  /** Title for the Lens Investment slide (Slide B). */
  investmentSlideTitle?: string
  overviewColumns?: LensColumn[]
  investmentColumns?: LensInvestmentColumn[]
}

// ── Deck config (persisted per cycle) ────────────────────────
export interface TitleConfig {
  id?: string
  cycleId?: string
  title?: string
  subtitle?: string
  year?: string
  titleFontSize?: FontSize
  titleColor?: string
  subtitleFontSize?: FontSize
  subtitleColor?: string
  dividerStyle?: DividerStyle
  overviewLayouts?: Record<string, OverviewLayout>
  /** Per-category lens slide text/column configs. Keys are category names. */
  lensConfigs?: Record<string, LensLayoutConfig>
  /** Photo count intent per LOA: 0 | 1 | 2. Drives the Slide setup panel radio. */
  loaPhotoModes?: Record<string, number>
  updatedAt?: string
}

// ── Design tokens shared by slides + the setup panel ─────────

/** Title slide type ramp: [title, subtitle, year] — from the design's `sizes` map. */
export const TITLE_SIZES: Record<FontSize, [number, number, number]> = {
  small: [30, 11.5, 13],
  medium: [42, 13, 15],
  large: [56, 14.5, 17],
}

/** The four text colours offered on the title slide. */
export const TITLE_COLORS = ['#FFFFFF', '#0A0A0A', '#C9A678', '#A6C4E0'] as const

/** Soft (secondary) text colour derived from the chosen title colour. */
export function softTitleColor(color: string): string {
  return color === '#0A0A0A' ? 'rgba(10,10,10,.72)' : 'rgba(255,255,255,.78)'
}

export interface DividerPalette {
  bg: string
  fg: string
  sub: string
  rule: string
  label: string
  swatch: string
}

export const DIVIDER_STYLES: Record<DividerStyle, DividerPalette> = {
  black: {
    bg: '#0A0A0A', fg: '#FFFFFF', sub: 'rgba(255,255,255,.5)', rule: 'rgba(255,255,255,.22)',
    label: 'Black — house standard', swatch: '#0A0A0A',
  },
  navy: {
    bg: '#2C3E5D', fg: '#FFFFFF', sub: 'rgba(255,255,255,.58)', rule: 'rgba(255,255,255,.26)',
    label: 'Navy — brand header blue', swatch: '#2C3E5D',
  },
  light: {
    bg: '#F2F1EE', fg: '#0A0A0A', sub: '#8E887E', rule: '#D9D2C8',
    label: 'Light — matches LOA ground', swatch: '#F2F1EE',
  },
}

// ── Slide data shapes ────────────────────────────────────────

export interface TitleSlideData {
  cycleName: string
  cycleYear: string
  backgroundPhotoUrl?: string
  backgroundPhotoId?: string
  titleConfig?: TitleConfig
}

export interface SectionDividerData {
  label: string
  kind: 'category' | 'activity'
  loaCount: number
  totalBudget: number
  style: DividerStyle
  category?: string
}

/** One black tile in the overview grid. */
export interface OverviewTile {
  label: string
  amount: number
  loaCount: number
}

export interface CategoryOverviewData {
  category: string
  layout: OverviewLayout
  loaCount: number
  totalBudget: number
  opex: number
  capex: number
  /** Top brand-priority groups — 4 tiles in the design. */
  priorityTiles: OverviewTile[]
  /** Activity families — 5 tiles in the design. */
  familyTiles: OverviewTile[]
  countries: string[]
  activityTypes: string[]
  photos: LOAPhotoRecord[]
  /** Lens layout columns (lens_overview / lens_investment) — from TitleConfig. */
  lensConfig?: LensLayoutConfig
  /** ISO date strings from the parent cycle — used for scope line / subtitle. */
  cycleStartDate?: string
  cycleEndDate?: string
  cycleName?: string
}

export interface LOADetailData {
  loa: LOA & { photos?: LOAPhotoRecord[] }
}

export type SlideData =
  | TitleSlideData
  | SectionDividerData
  | CategoryOverviewData
  | LOADetailData

// ── Slide ────────────────────────────────────────────────────
export interface Slide {
  id: string
  type: SlideType
  /** Descriptive name shown in the navigator, e.g. "Divider — FRAMES". */
  navTitle: string
  sectionId?: string   // category name — groups slides in navigator
  loaId?: string       // populated only on loa_detail
  data: SlideData
}

// ── Verdict ──────────────────────────────────────────────────
export interface ReviewVerdict {
  id: string
  cycleId: string
  loaId: string
  reviewerId: string
  decision: VerdictDecision
  reason?: string
  createdAt: string
  updatedAt: string
}

// ── Comment ──────────────────────────────────────────────────
export interface ReviewComment {
  id: string
  cycleId: string
  slideId: string
  authorId: string
  authorName: string
  text: string
  anchor?: string   // e.g. "field:budget", "section:description" — null for legacy CMO comments
  createdAt: string
}

// ── Alignment review stage ────────────────────────────────────
export type AlignmentStage = 'local_alignment' | 'global_function_review' | 'global_brand_review'
export const ALIGNMENT_STAGES: AlignmentStage[] = [
  'local_alignment', 'global_function_review', 'global_brand_review',
]
export const ALIGNMENT_STAGE_LABELS: Record<AlignmentStage, string> = {
  local_alignment:        'Local Alignment',
  global_function_review: 'Global Function Review',
  global_brand_review:    'Global Brand Review',
}

export interface LOAReviewStageRecord {
  id: string
  loaId: string
  stage: AlignmentStage
  status: 'pending' | 'approved'
  approvedBy?: string
  /** Display name of the approver — what the stepper's approval history shows. */
  approvedByName?: string | null
  approvedAt?: string
}

export interface LOAWithStages {
  id: string
  loa_draft_id: string
  loa_number?: string
  requestor_email: string
  cluster: string
  country: string
  brand: string
  activity_type: string
  category: string[]
  fy_2026_total: number
  status: string
  submitted_at?: string
  stages: Record<AlignmentStage, LOAReviewStageRecord>
}

// ── Submission ───────────────────────────────────────────────
export interface ReviewSubmission {
  id: string
  cycleId: string
  reviewerId: string
  submittedAt: string
  summary: { approved: number; rejected: number; total: number }
}

// ── ReviewMode config ────────────────────────────────────────
export interface ReviewModeConfig {
  id: string
  roleName: string
  mode: ReviewMode
  updatedAt: string
  updatedBy?: string
}

// ── Ordering ─────────────────────────────────────────────────
const CATEGORY_ORDER = [
  'Frames', 'Lenses', 'Wearables', 'Audio', 'Instruments', 'All cat.',
]

// Canonical order comes from ACTIVITY_TYPES — one list, in reference_data order.
// This was the third hand-written copy in Title Case; once the data moved to
// UPPER_SNAKE codes it matched nothing and every activity ranked 999 (unsorted).
const ACTIVITY_ORDER: string[] = ACTIVITY_TYPES

function activityRank(activity: string): number {
  const i = ACTIVITY_ORDER.indexOf(activity)
  return i === -1 ? 999 : i
}

function categoryRank(cat: string): number {
  const i = CATEGORY_ORDER.indexOf(cat)
  return i === -1 ? 999 : i
}

// ── Brand → investment priority grouping ─────────────────────
// The overview slide's top row aggregates spend into the portfolio priority
// groups the EMEA PS decks use. Brands that match none fall into OTHER.
const PRIORITY_GROUPS: Array<{ label: string; match: RegExp }> = [
  { label: 'RAY-BAN + RAY-BAN META', match: /ray[\s-]?ban|meta/i },
  { label: 'OAKLEY + OAKLEY META', match: /oakley|sport|costa|native|arnette/i },
  { label: 'LUXURY', match: /chanel|prada|versace|burberry|tiffany|cartier|bulgari|bvlgari|dolce|miu|valentino|armani|ferrari|swarovski|coach|jimmy\s?choo|tory\s?burch|ralph\s?lauren/i },
]
const PRIORITY_OTHER = 'OTHER'

// Fixed order for all 4 priority groups — empty groups always render with 0€.
const FIXED_PRIORITY_ORDER = PRIORITY_GROUPS.map(g => g.label).concat([PRIORITY_OTHER])

function priorityGroup(brand: string): string {
  const b = cleanBrand(brand)
  for (const g of PRIORITY_GROUPS) {
    if (g.match.test(b)) return g.label
  }
  return PRIORITY_OTHER
}

/** Sum tiles from LOAs by a key function, sorted by amount desc. */
function tilesBy(
  loas: LOA[],
  key: (loa: LOA) => string,
): OverviewTile[] {
  const map = new Map<string, OverviewTile>()
  for (const loa of loas) {
    const k = key(loa)
    if (!k) continue
    const tile = map.get(k) || { label: k, amount: 0, loaCount: 0 }
    tile.amount += loa.fy_2026_total || 0
    tile.loaCount += 1
    map.set(k, tile)
  }
  return [...map.values()].sort((a, b) => b.amount - a.amount)
}

/**
 * Build exactly 4 priority tiles in fixed brand-group order.
 * Empty groups are always included (at 0€) so the layout is stable across cycles.
 */
function buildPriorityTiles(loas: LOA[]): OverviewTile[] {
  const seed = new Map<string, OverviewTile>(
    FIXED_PRIORITY_ORDER.map(label => [label, { label, amount: 0, loaCount: 0 }])
  )
  for (const loa of loas) {
    const group = priorityGroup(loa.brand || '')
    const tile = seed.get(group)!
    tile.amount += loa.fy_2026_total || 0
    tile.loaCount += 1
  }
  return FIXED_PRIORITY_ORDER.map(label => seed.get(label)!)
}

/** Build the activity-family tiles — top 5 by budget, as in the design. */
function buildFamilyTiles(loas: LOA[]): OverviewTile[] {
  return tilesBy(loas, l => (l.activity_type || '').toUpperCase()).slice(0, 5)
}

/** Split a category's spend into OPEX / CAPEX using the capex_opex flag. */
function splitCapexOpex(loas: LOA[]): { opex: number; capex: number } {
  let opex = 0
  let capex = 0
  for (const loa of loas) {
    const amount = loa.fy_2026_total || 0
    if (/capex/i.test(loa.capex_opex || '')) capex += amount
    else opex += amount
  }
  return { opex, capex }
}

// ── Deck generator ───────────────────────────────────────────

export function generateDeck(
  cycleName: string,
  loas: Array<LOA & { photos?: LOAPhotoRecord[] }>,
  titleConfig?: TitleConfig | null,
  titlePhotoUrl?: string | null,
  overviewPhotos?: Record<string, LOAPhotoRecord[]> | null,
  cycleStartDate?: string,
  cycleEndDate?: string,
): Slide[] {
  const slides: Slide[] = []
  const dividerStyle: DividerStyle = titleConfig?.dividerStyle || 'black'
  const overviewLayouts = titleConfig?.overviewLayouts || {}

  // ── 1. Title slide ─────────────────────────────────────────
  const cycleYear = titleConfig?.year || new Date().getFullYear().toString()
  slides.push({
    id: 'title',
    type: 'title_slide',
    navTitle: `Title — ${titleConfig?.title || cycleName}`,
    data: {
      cycleName,
      cycleYear,
      backgroundPhotoUrl: titlePhotoUrl || undefined,
      titleConfig: titleConfig || undefined,
    } satisfies TitleSlideData,
  })

  // ── 2. Group LOAs by primary category ──────────────────────
  const byCategory = new Map<string, Array<LOA & { photos?: LOAPhotoRecord[] }>>()
  for (const loa of loas) {
    const cat = primaryCategory(loa)
    if (!byCategory.has(cat)) byCategory.set(cat, [])
    byCategory.get(cat)!.push(loa)
  }

  const sortedCategories = [...byCategory.keys()].sort(
    (a, b) => categoryRank(a) - categoryRank(b)
  )

  for (const category of sortedCategories) {
    const categoryLOAs = byCategory.get(category)!

    categoryLOAs.sort((a, b) => {
      const ar = activityRank(a.activity_type) - activityRank(b.activity_type)
      if (ar !== 0) return ar
      return (b.fy_2026_total || 0) - (a.fy_2026_total || 0)
    })

    const sectionBudget = categoryLOAs.reduce((s, l) => s + (l.fy_2026_total || 0), 0)
    const countries = [...new Set(categoryLOAs.map(l => l.country).filter(Boolean))]
    const activityTypes = [...new Set(categoryLOAs.map(l => l.activity_type).filter(Boolean))]
    const { opex, capex } = splitCapexOpex(categoryLOAs)

    // ── a. Category divider ──────────────────────────────────
    slides.push({
      id: `divider-${category}`,
      type: 'section_divider',
      navTitle: `Divider — ${category.toUpperCase()}`,
      sectionId: category,
      data: {
        label: category,
        kind: 'category',
        loaCount: categoryLOAs.length,
        totalBudget: sectionBudget,
        style: dividerStyle,
        category,
      } satisfies SectionDividerData,
    })

    // ── b. Category overview ─────────────────────────────────
    // Lenses always gets two consecutive slides (overview + investment).
    // All other categories get one slide whose layout is user-selectable.
    const isLensesCategory = category === 'Lenses'
    if (isLensesCategory) {
      const sharedData = {
        category,
        loaCount: categoryLOAs.length,
        totalBudget: sectionBudget,
        opex, capex,
        priorityTiles: buildPriorityTiles(categoryLOAs),
        familyTiles: buildFamilyTiles(categoryLOAs),
        countries, activityTypes,
        photos: overviewPhotos?.[category] || [],
        lensConfig: titleConfig?.lensConfigs?.[category],
        cycleName,
        cycleStartDate,
        cycleEndDate,
      }
      slides.push({
        id: `overview-${category}-overview`,
        type: 'category_overview',
        navTitle: `${category} — Lens overview`,
        sectionId: category,
        data: { ...sharedData, layout: 'lens_overview' } satisfies CategoryOverviewData,
      })
      slides.push({
        id: `overview-${category}-investment`,
        type: 'category_overview',
        navTitle: `${category} — Lens investment`,
        sectionId: category,
        data: { ...sharedData, layout: 'lens_investment' } satisfies CategoryOverviewData,
      })
    } else {
    const layout: OverviewLayout = overviewLayouts[category] || 'priorities'
    const layoutLabel =
      layout === 'family' ? 'family split' :
      layout === 'lens_overview' ? 'lens overview' :
      layout === 'lens_investment' ? 'lens investment' :
      'priorities'
    slides.push({
      id: `overview-${category}`,
      type: 'category_overview',
      navTitle: `${category} overview — ${layoutLabel}`,
      sectionId: category,
      data: {
        category,
        layout,
        loaCount: categoryLOAs.length,
        totalBudget: sectionBudget,
        opex,
        capex,
        priorityTiles: buildPriorityTiles(categoryLOAs),
        familyTiles: buildFamilyTiles(categoryLOAs),
        countries,
        activityTypes,
        photos: overviewPhotos?.[category] || [],
        lensConfig: titleConfig?.lensConfigs?.[category],
        cycleName,
        cycleStartDate,
        cycleEndDate,
      } satisfies CategoryOverviewData,
    })
    } // end non-Lenses

    // ── c. Group by activity type ────────────────────────────
    const byActivity = new Map<string, Array<LOA & { photos?: LOAPhotoRecord[] }>>()
    for (const loa of categoryLOAs) {
      if (!byActivity.has(loa.activity_type)) byActivity.set(loa.activity_type, [])
      byActivity.get(loa.activity_type)!.push(loa)
    }

    const sortedActivities = [...byActivity.keys()].sort(
      (a, b) => activityRank(a) - activityRank(b)
    )

    for (const activity of sortedActivities) {
      const activityLOAs = byActivity.get(activity)!
      const activityBudget = activityLOAs.reduce((s, l) => s + (l.fy_2026_total || 0), 0)

      // ── i. Activity family divider ───────────────────────
      slides.push({
        id: `divider-${category}-${activity}`,
        type: 'section_divider',
        navTitle: `Divider — ${activity}`,
        sectionId: category,
        data: {
          label: activity,
          kind: 'activity',
          loaCount: activityLOAs.length,
          totalBudget: activityBudget,
          style: dividerStyle,
          category,
        } satisfies SectionDividerData,
      })

      // ── ii. LOA detail slides ────────────────────────────
      for (const loa of activityLOAs) {
        slides.push({
          id: `loa-${loa.id}`,
          type: 'loa_detail',
          navTitle: loaCaption(loa),
          sectionId: category,
          loaId: loa.id,
          data: { loa } satisfies LOADetailData,
        })
      }
    }
  }

  return slides
}

// ── Slide counters ────────────────────────────────────────────

export function countReviewable(slides: Slide[]): number {
  return slides.filter(s => s.type === 'loa_detail').length
}

export function countDecided(slides: Slide[], verdicts: Record<string, ReviewVerdict>): number {
  return slides.filter(s => s.type === 'loa_detail' && s.loaId && verdicts[s.loaId]).length
}

/** Index of the next loa_detail slide after `from`, or -1 if none remain. */
export function nextLOAIndex(slides: Slide[], from: number): number {
  for (let i = from + 1; i < slides.length; i++) {
    if (slides[i].type === 'loa_detail') return i
  }
  return -1
}

// ── Deck labelling ───────────────────────────────────────────

export function primaryCategory(loa: LOA): string {
  const cats = loa.category
  if (typeof cats === 'string') return cats
  if (!Array.isArray(cats) || cats.length === 0) return 'Frames'
  if (cats.length > 1 && cats.every(c => String(c).length === 1)) return cats.join('')
  return String(cats[0])
}

export function cleanBrand(brand?: string): string {
  return (brand || '').replace(/^(HB|LB)\s*-\s*/, '').trim()
}

export function loaCaption(loa: LOA): string {
  const brand = cleanBrand(loa.brand)
  return brand ? `${brand}: ${loa.activity_type}` : loa.activity_type
}

export function slideCaption(slide?: Slide): string {
  if (!slide) return ''
  return slide.navTitle
}

// ── Number formatting ────────────────────────────────────────
// Re-exported from @/lib/euro (see top of file).
// Importing from either path gives the same functions.
