// ============================================================
// LAURA — TypeScript types
// Single source of truth — backend models mirror these
// ============================================================

export type LOAStatus =
  | 'draft'
  | 'submitted'
  | 'brand_review'
  | 'cmo_review'
  | 'cfo_review'
  | 'approved'
  | 'rejected'

export type ActivityType =
  | 'Tailor Made Seasonal'
  | 'Tailor Made Permanent'
  | 'Coop Advertising'
  | 'In Store / Consumer Activation'
  | 'Events'
  | 'Trade Incentive'
  | 'Sponsorship'
  | 'Catalogues & Brochures'
  | 'Other ADV Expenses'
  | 'Medical Affairs'
  | 'Training'

export interface LOA {
  id: string
  loa_draft_id: string
  loa_number?: string
  requestor_email: string

  // Location
  cluster: string
  country: string
  legal_entity?: string

  // Activity
  activity_type: ActivityType
  event_type?: string
  event_purpose?: string
  cot: string
  category: string
  brand: string

  // Financial classification
  capex_opex: 'OpEx' | 'CapEx'
  adv_selling: 'ADV' | 'Selling' | 'Others'

  // Investment
  detail?: string
  customer?: string
  vendor?: string
  currency: string
  num_customers?: number
  num_doors?: number

  // Financials — user inputs
  q4_2025: number
  q1_2026: number
  q2_2026: number
  q3_2026: number
  q4_2026: number

  // Financials — calculated (read-only in UI)
  fy_2025_total: number
  fy_2026_total: number
  avg_investment_per_door?: number
  ppt_slide_required: boolean

  // PPT content
  description?: string
  tools?: string
  kpi?: string
  cost_drill_down?: string
  timing?: string

  // Dates
  start_date?: string
  end_date?: string

  // Status
  status: LOAStatus
  brand_review_deadline?: string
  cmo_comment?: string
  rejection_reason?: string

  // AI
  ai_suggestion_used: boolean

  // Meta
  created_at: string
  updated_at: string
  submitted_at?: string
  approved_at?: string
}

// Form type — what the user fills in (excludes calculated fields)
export type LOAFormValues = Omit<
  LOA,
  | 'id'
  | 'loa_draft_id'
  | 'loa_number'
  | 'fy_2025_total'
  | 'fy_2026_total'
  | 'avg_investment_per_door'
  | 'ppt_slide_required'
  | 'status'
  | 'brand_review_deadline'
  | 'cmo_comment'
  | 'rejection_reason'
  | 'ai_suggestion_used'
  | 'created_at'
  | 'updated_at'
  | 'submitted_at'
  | 'approved_at'
>

export interface AISuggestion {
  description: string
  kpi: string
  tools: string
  call_id: string
  success: boolean
}

// ---- Dropdown reference data ----

export const CLUSTERS = [
  'DACH', 'EAST', 'FRANCE', 'GCC & EXPORT', 'IBERIA',
  'ITALY', 'META', 'NORTH', 'EMEA',
] as const

export const CLUSTER_COUNTRIES: Record<string, string[]> = {
  FRANCE:       ['France Frames', 'France Lenses ESSILOR', 'France Lenses BBGR', 'France Lenses NIKON'],
  ITALY:        ['Italy'],
  DACH:         ['Germany', 'Austria', 'Switzerland'],
  NORTH:        ['UKI', 'Nordics', 'BNL', 'Poland & Baltics'],
  IBERIA:       ['Spain', 'Portugal'],
  EAST:         ['CZ & SK', 'Greece', 'SEE', 'Turkey'],
  META:         ['UAE', 'KSA', 'GCC'],
  'GCC & EXPORT': ['GCC+Export', 'Russia', 'Export'],
  EMEA:         ['EMEA PS'],
}

export const ACTIVITY_TYPES: ActivityType[] = [
  'Tailor Made Seasonal',
  'Tailor Made Permanent',
  'Coop Advertising',
  'In Store / Consumer Activation',
  'Events',
  'Trade Incentive',
  'Sponsorship',
  'Catalogues & Brochures',
  'Other ADV Expenses',
  'Medical Affairs',
  'Training',
]

export const EVENT_TYPES = [
  'Roadshow', 'Showroom', 'Client Award Travel',
  'Trade Fair', 'Medical Symposium',
  'Internal Sales Convention', 'Brand Event',
]

export const COT_OPTIONS = [
  'All COT', 'Independents', 'Chains', 'Buying Groups',
  'E-Wholesale', 'Distribution & Export', 'Travel Retail',
  'Sport Channel', 'Others',
]

export const CATEGORY_OPTIONS = [
  'Frames', 'Lenses', 'All cat.',
  'Instruments', 'Wearables', 'Audio',
]

export const BRAND_OPTIONS = [
  'HB - Ray-Ban', 'HB - Oakley', 'HB - Vogue', 'HB - Persol',
  'HB - BLIZ', 'All HB', 'All HB + All LB',
  'LB - Chanel', 'LB - Prada', 'LB - Versace', 'LB - Luxury',
  'LB - Dolce & Gabbana', 'LB - Burberry', 'All LB',
  'Essilor - Multibrand', 'Essilor - Varilux', 'Essilor - Stellest',
  'Essilor - Crizal', 'Transitions', 'Nikon', 'Nuance',
  'Ray-Ban Meta', 'Oakley Meta',
]

// Status labels and colours for the UI
export const STATUS_CONFIG: Record<LOAStatus, { label: string; color: string }> = {
  draft:        { label: 'Draft',         color: 'bg-slate-700 text-slate-300' },
  submitted:    { label: 'Submitted',     color: 'bg-blue-900 text-blue-300' },
  brand_review: { label: 'Brand review',  color: 'bg-purple-900 text-purple-300' },
  cmo_review:   { label: 'CMO review',    color: 'bg-amber-900 text-amber-300' },
  cfo_review:   { label: 'CFO review',    color: 'bg-orange-900 text-orange-300' },
  approved:     { label: 'Approved',      color: 'bg-green-900 text-green-300' },
  rejected:     { label: 'Rejected',      color: 'bg-red-900 text-red-300' },
}

// Activity types that require Events-specific fields (SAP code, no doors)
export const EVENT_ACTIVITY_TYPES: ActivityType[] = ['Events', 'Medical Affairs']

// Activity types that need door count for avg/door calculation
export const DOOR_ACTIVITY_TYPES: ActivityType[] = [
  'Tailor Made Seasonal', 'Tailor Made Permanent',
  'Coop Advertising', 'In Store / Consumer Activation',
  'Trade Incentive', 'Training',
]
